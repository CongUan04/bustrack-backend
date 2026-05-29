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
            
            // Sử dụng Intl.DateTimeFormat để lấy chính xác giờ, phút, ngày theo timezone
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: 'Asia/Ho_Chi_Minh',
                hour: 'numeric',
                minute: 'numeric',
                hour12: false,
                weekday: 'numeric' // 1: Sun, 2: Mon, ..., 7: Sat (note: getDay() wants 0-6)
            });
            
            // Parse cẩn thận để tránh lỗi format string trên các hệ điều hành khác nhau
            const vnDateStr = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
            const vnDateObj = new Date(vnDateStr);
            
            const currentHours = vnDateObj.getHours();
            const currentMinutes = vnDateObj.getMinutes();
            const currentDay = vnDateObj.getDay();
            const currentTimeStr = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`;

            const currentTotalMins = currentHours * 60 + currentMinutes;

            // 2. Tìm các học sinh:
            // - Đang active
            // - Có lịch học hôm nay (studyDays chứa currentDay)
            // - Vẫn còn ở trên xe (On_Bus)
            // - Có classStartTime
            const students = await Student.find({
                isActive: true,
                studyDays: currentDay,
                currentStatus: 'On_Bus',
                $or: [
                    { classStartTime: { $ne: null, $ne: '' } },
                    { classEndTime: { $ne: null, $ne: '' } }
                ]
            }).populate('parent_id');

            if (students.length === 0) return;

            // 3. Lấy thời gian bắt đầu của "ngày hôm nay" theo giờ server để check Alert trùng lặp
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            for (const student of students) {
                // Parse classStartTime để tính tổng số phút
                const [cHour, cMin] = student.classStartTime.split(':').map(Number);
                const classStartMins = (cHour * 60) + cMin;

                // Parse classEndTime nếu có để tính chiều
                let classEndMins = -1;
                if (student.classEndTime) {
                    const [eHour, eMin] = student.classEndTime.split(':').map(Number);
                    classEndMins = (eHour * 60) + eMin;
                }

                // Nếu không có classEndTime, mặc định là 16:30 để chặn luồng sáng
                const safeClassEndMins = classEndMins > 0 ? classEndMins : (16 * 60 + 30);

                // Kiểm tra buổi sáng: Nếu thời gian hiện tại từ (giờ vào lớp + 5) đến trước (giờ tan học)
                const isMorningForgotten = classStartMins > 0 && 
                                           currentTotalMins >= classStartMins + 5 && 
                                           currentTotalMins < safeClassEndMins;
                
                // Kiểm tra buổi chiều: Nếu thời gian hiện tại lớn hơn (giờ tan học + 15 phút) cho đến hết ngày
                const isAfternoonForgotten = safeClassEndMins > 0 && 
                                             currentTotalMins >= safeClassEndMins + 15;

                if (isMorningForgotten || isAfternoonForgotten) {
                    const tripType = isMorningForgotten ? 'Morning' : 'Afternoon';

                    // Kiểm tra xem hôm nay đã tạo Alert STUDENT_FORGOTTEN cho học sinh này THEO BUỔI (Morning/Afternoon) chưa
                    const existingAlert = await Alert.findOne({
                        student_id: student._id,
                        alert_type: 'STUDENT_FORGOTTEN',
                        'meta.tripType': tripType,
                        timestamp: { $gte: startOfDay }
                    });

                    // Nếu đã cảnh báo trong buổi này rồi thì bỏ qua để không spam
                    if (existingAlert) continue;

                    const timeLabel = isMorningForgotten ? 'Giờ vào lớp' : 'Giờ tan học';
                    const timeValue = isMorningForgotten ? student.classStartTime : student.classEndTime;

                    console.warn(`[Anomaly Detection] 🚨 CẢNH BÁO: Học sinh ${student.fullName} (Lớp ${student.class}) bị bỏ quên trên xe! ${timeLabel}: ${timeValue}`);

                    // Tạo Alert mới
                    const newAlert = new Alert({
                    student_id: student._id,
                    bus_id: student.route_id || null, // Nếu có liên kết với xe/tuyến thì lấy route_id (hoặc bus)
                    alert_type: 'STUDENT_FORGOTTEN',
                    severity: 'danger',
                        message: `Học sinh ${student.fullName} (Lớp ${student.class}) có khả năng bị bỏ quên trên xe. ${timeLabel} là ${timeValue} nhưng hiện tại vẫn chưa xuống xe. Vui lòng kiểm tra ngay!`,
                        meta: { 
                        classStartTime: student.classStartTime,
                        classEndTime: student.classEndTime,
                        timeDetected: currentTimeStr,
                        lastStatus: student.currentStatus,
                        tripType: isMorningForgotten ? 'Morning' : 'Afternoon'
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
                if (student.parent_id && student.parent_id.telegram_chat_id) {
                    const statusText = 'Vẫn đang trên xe (Có khả năng bị bỏ quên)';
                        
                    const telegramMsg = 
                        `🚨 *CẢNH BÁO KHẨN CẤP*\n\n` +
                        `Hệ thống phát hiện em *${student.fullName}* có khả năng bị bỏ quên trên xe.\n` +
                        `⏰ ${timeLabel}: ${timeValue}\n` +
                        `📍 Trạng thái lúc này: *${statusText}*\n\n` +
                        `Vui lòng liên hệ nhà trường hoặc tài xế ngay lập tức để xác minh!`;
                        
                    await sendMessageToParent(student.parent_id.telegram_chat_id, telegramMsg);
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
