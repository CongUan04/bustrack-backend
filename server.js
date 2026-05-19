const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const { initBot } = require('./services/telegramService');
const Bus = require('./models/Bus');
const socketHelper = require('./socket');

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

// ── Start Server ──────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
    console.log(`🚀 [Server] Đang chạy tại http://localhost:${PORT}`);
    console.log(`   Môi trường: ${process.env.NODE_ENV || 'development'}`);
});
