const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const { initBot } = require('./services/telegramService');
const Bus = require('./models/Bus');
const Student = require('./models/Student');
const socketHelper = require('./socket');
const cron = require('node-cron');
const { initAnomalyDetectionJob } = require('./cron/anomalyDetection');

// Load biến môi trường từ file .env
dotenv.config();

// Kết nối MongoDB
connectDB();

// Khởi động Telegram Bot (polling)
initBot();

const app = express();

// ── Middleware ────────────────────────────────────────────────
app.use(cors({
    origin: true, // Cho phép mọi origin động (rất tốt khi dev trên LAN)
    credentials: true,
}));
app.use(express.json());

// ── Static Files ──────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/alerts', require('./routes/alertRoutes'));
app.use('/api/buses', require('./routes/busRoutes'));
app.use('/api/routes', require('./routes/routeRoutes'));
app.use('/api/telegram', require('./routes/telegramRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));

// Health check
app.get('/', (req, res) => {
    res.json({ message: '🚌 BusTrack API đang chạy...', status: 'OK' });
});

// ── HTTP Server + Socket.io ───────────────────────────────────
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: "*", // [QUAN TRỌNG] Cho phép mọi frontend kết nối (Localhost, Vercel, Netlify...)
        methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    },
});

// ── Đăng ký io vào singleton để tránh circular dependency ────
socketHelper.setIo(io);

io.on('connection', (socket) => {
    console.log(`🔌 [Socket] Client kết nối: ${socket.id}`);
    socket.on('disconnect', () => {
        console.log(`❌ [Socket] Client ngắt kết nối: ${socket.id}`);
    });
});

// Export io để các controller dùng emit (backward compat)
module.exports.io = io;

// ── Cron Job: Đánh dấu xe offline nếu mất tín hiệu quá lâu ───
setInterval(async () => {
    try {
        const staleThreshold = new Date(Date.now() - 2 * 60 * 1000); // 2 phút
        const result = await Bus.updateMany(
            {
                isOnline: true,
                $or: [
                    { lastSeen: { $lt: staleThreshold } },
                    { lastSeen: null }
                ]
            },
            { $set: { isOnline: false, currentSpeed: 0 } }
        );
        if (result.modifiedCount > 0) {
            console.log(`[Bus Monitor] Đặt ${result.modifiedCount} xe về offline do mất kết nối GPS.`);
            // Phát sự kiện để cập nhật UI ngay lập tức
            io.emit('buses_offline', { message: 'Có xe bị mất kết nối GPS' });
        }
    } catch (error) {
        console.error('[Bus Monitor] Lỗi update offline:', error.message);
    }
}, 60000); // Kiểm tra mỗi 60 giây

// ── Cron Job: Reset trạng thái điểm danh học sinh mỗi ngày ───
// Chạy vào lúc 00:01 sáng mỗi ngày theo giờ Việt Nam
cron.schedule('1 0 * * *', async () => {
    try {
        console.log('[Cron] Bắt đầu reset trạng thái điểm danh ngày mới...');
        
        // 1. Reset toàn bộ học sinh về chưa lên xe và xoá lý do vắng mặt
        const result = await Student.updateMany(
            {}, 
            { 
                $set: { 
                    currentStatus: 'Not_Boarded', 
                    absenceReason: null 
                } 
            }
        );
        console.log(`[Cron] ✅ Đã reset trạng thái cho ${result.modifiedCount} học sinh về Not_Boarded.`);

        // 2. Chuyển trạng thái sang Absent cho những học sinh đã báo vắng mặt vào ngày hôm nay
        const today = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).substring(0, 10);
        const absentResult = await Student.updateMany(
            { 'absences.date': today },
            { $set: { currentStatus: 'Absent' } }
        );
        console.log(`[Cron] ℹ️ Cập nhật ${absentResult.modifiedCount} học sinh thành Absent vì đã báo nghỉ hôm nay (${today}).`);
        
        // Phát sự kiện qua socket.io để cập nhật Real-time trên giao diện Admin/Driver
        io.emit('daily_status_reset', { message: 'Trạng thái điểm danh đã được làm mới cho ngày mới' });
        
    } catch (error) {
        console.error('[Cron] ❌ Lỗi khi reset trạng thái:', error.message);
    }
}, {
    scheduled: true,
    timezone: "Asia/Ho_Chi_Minh" // Đảm bảo chạy đúng theo múi giờ VN
});

// ── Khởi động các Cron Job bổ sung ────────────────────────────
initAnomalyDetectionJob();

// ── Start Server ──────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
    console.log(`🚀 [Server] Đang chạy tại http://localhost:${PORT}`);
    console.log(`   Môi trường: ${process.env.NODE_ENV || 'development'}`);
});
