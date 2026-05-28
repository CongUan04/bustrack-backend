const cron = require('node-cron');
const Student = require('../models/Student');
const Alert = require('../models/Alert');
const { sendMessageToParent } = require('../services/telegramService');
const socketHelper = require('../socket');

const initAnomalyDetectionJob = () => {
    // Chạy mỗi phút
    cron.schedule('* * * * *', async () => {
        try {
            // 1. Lấy thời gian hiện tại theo múi giờ VN (Asia/Ho_Chi_Minh)
            const now = new Date();
            // Hàm chuyển Date sang chuỗi format của VN để parse giờ/phút
            const vnTimeString = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
            // vnTimeString có định dạng vd: "5/20/2026, 03:45:39"
            
            const vnTimeParts = vnTimeString.split(', ')[1].split(':');
            const currentHours = vnTimeParts[0].padStart(2, '0');
            const currentMinutes = vnTimeParts[1].padStart(2, '0');
            const currentTimeStr = `${currentHours}:${currentMinutes}`;
            
            // Tìm ngày trong tuần ở VN (để check studyDays)
            // Lấy Date theo múi giờ VN
            const vnDateObj = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
            const currentDay = vnDateObj.getDay();

            const currentTotalMins = parseInt(currentHours) * 60 + parseInt(currentMinutes);

            // 2. Tìm các học sinh:
            // - Đang active
            // - Có lịch học hôm nay (studyDays chứa currentDay)
            // - Vẫn còn ở trên xe (On_Bus)
            // - Có classStartTime
            const students = await Student.find({
                isActive: true,
                studyDays: currentDay,
                currentStatus: 'On_Bus',
                classStartTime: { $ne: null, $ne: '' }
            }).populate('parent_id');

            if (students.length === 0) return;

            // 3. Lấy thời gian bắt đầu của "ngày hôm nay" theo giờ server để check Alert trùng lặp
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            for (const student of students) {
                // Parse classStartTime để tính tổng số phút
                const [cHour, cMin] = student.classStartTime.split(':').map(Number);
                const classStartMins = (cHour * 60) + cMin;

                // Nếu thời gian hiện tại từ (giờ vào lớp + 5) đến (giờ vào lớp + 60), thì báo động chuyến sáng
                if (currentTotalMins >= classStartMins + 5 && currentTotalMins <= classStartMins + 60) {
                    // Kiểm tra xem hôm nay đã tạo Alert STUDENT_FORGOTTEN cho học sinh này chưa
                    const existingAlert = await Alert.findOne({
                        student_id: student._id,
                        alert_type: 'STUDENT_FORGOTTEN',
                        timestamp: { $gte: startOfDay }
                    });

                    // Nếu đã cảnh báo trong ngày hôm nay rồi thì bỏ qua để không spam
                    if (existingAlert) continue;

                    console.warn(`[Anomaly Detection] 🚨 CẢNH BÁO: Học sinh ${student.fullName} (Lớp ${student.class}) bị bỏ quên trên xe! Giờ vào lớp: ${student.classStartTime}`);

                    // Tạo Alert mới
                    const newAlert = new Alert({
                    student_id: student._id,
                    bus_id: student.route_id || null, // Nếu có liên kết với xe/tuyến thì lấy route_id (hoặc bus)
                    alert_type: 'STUDENT_FORGOTTEN',
                    severity: 'danger',
                        message: `Học sinh ${student.fullName} (Lớp ${student.class}) có khả năng bị bỏ quên trên xe. Giờ vào học là ${student.classStartTime} nhưng hiện tại vẫn chưa xuống xe. Vui lòng kiểm tra ngay!`,
                        meta: { 
                        classStartTime: student.classStartTime, 
                        timeDetected: currentTimeStr,
                        lastStatus: student.currentStatus 
                    }
                });

                await newAlert.save();

                // Gửi sự kiện realtime cho Admin dashboard
                const io = socketHelper.getIo();
                if (io) {
                    // Populate để gửi kèm thông tin hiển thị tốt hơn
                    await newAlert.populate('student_id', 'fullName studentCode class');
                    io.emit('new_alert', newAlert);
                }

                // Gửi thông báo khẩn cấp qua Telegram cho Phụ huynh
                if (student.parent_id && student.parent_id.telegramChatId) {
                    const statusText = 'Vẫn đang trên xe (Có khả năng bị bỏ quên)';
                        
                    const telegramMsg = 
                        `🚨 *CẢNH BÁO KHẨN CẤP*\n\n` +
                        `Hệ thống phát hiện em *${student.fullName}* có khả năng bị bỏ quên trên xe.\n` +
                        `⏰ Giờ vào lớp: ${student.classStartTime} (Đã quá 5 phút)\n` +
                        `📍 Trạng thái lúc này: *${statusText}*\n\n` +
                        `Vui lòng liên hệ nhà trường hoặc tài xế ngay lập tức để xác minh!`;
                        
                    await sendMessageToParent(student.parent_id.telegramChatId, telegramMsg);
                }
            }
        }
        } catch (error) {
            console.error('[Anomaly Detection] ❌ Lỗi khi chạy cron job:', error.message);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Ho_Chi_Minh"
    });
};

module.exports = { initAnomalyDetectionJob };
