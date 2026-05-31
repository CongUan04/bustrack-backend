const AttendanceLog = require('../models/AttendanceLog');
const Student = require('../models/Student');
const Bus = require('../models/Bus');
const User = require('../models/User');
const { sendMessageToParent } = require('../services/telegramService');
const socketHelper = require('../socket');

const getIo = () => socketHelper.getIo();

// ── GET /api/attendance ───────────────────────────────────────
// Query params: from, to, bus_id, student_id, action_type, limit
const getLogs = async (req, res) => {
    try {
        const { from, to, bus_id, student_id, action_type, limit = 50 } = req.query;
        const filter = {};

        if (from || to) {
            filter.scan_time = {};
            if (from) filter.scan_time.$gte = new Date(from);
            if (to) filter.scan_time.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
        }
        if (bus_id) filter.bus_id = bus_id;
        if (student_id) filter.student_id = student_id;
        if (action_type) filter.action_type = action_type;

        const logs = await AttendanceLog.find(filter)
            .populate('student_id', 'fullName studentCode class')
            .populate('bus_id', 'licensePlate')
            .sort({ scan_time: -1 })
            .limit(Number(limit));

        return res.json({ success: true, count: logs.length, data: logs });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ── GET /api/attendance/kpi ───────────────────────────────────
// Stats cho hôm nay: tổng lượt, lên xe, xuống xe, học sinh unique, xe hoạt động
const getKpi = async (req, res) => {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const [
            totalToday,
            boardingToday,
            droppingToday,
            uniqueStudents,
            uniqueBuses,
        ] = await Promise.all([
            AttendanceLog.countDocuments({ scan_time: { $gte: todayStart, $lte: todayEnd } }),
            AttendanceLog.countDocuments({ scan_time: { $gte: todayStart }, action_type: 'Boarding' }),
            AttendanceLog.countDocuments({ scan_time: { $gte: todayStart }, action_type: 'Dropping' }),
            AttendanceLog.distinct('student_id', { scan_time: { $gte: todayStart } }).then(r => r.length),
            AttendanceLog.distinct('bus_id', { scan_time: { $gte: todayStart } }).then(r => r.length),
        ]);

        return res.json({
            success: true,
            data: { totalToday, boardingToday, droppingToday, uniqueStudents, uniqueBuses },
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ── GET /api/attendance/bus/:busId/today ────────────────────────
// Danh sách học sinh đã quẹt thẻ lên xe hôm nay
const getBusStudentsToday = async (req, res) => {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const logs = await AttendanceLog.find({
            bus_id: req.params.busId,
            scan_time: { $gte: todayStart, $lte: todayEnd },
        })
            .populate('student_id', 'fullName studentCode class')
            .sort({ scan_time: -1 });

        // Group by student: chỉ lấy trạng thái mới nhất của mỗi em
        const seen = new Map();
        for (const log of logs) {
            if (!log.student_id) continue;
            const sid = log.student_id._id.toString();
            if (!seen.has(sid)) {
                seen.set(sid, {
                    student: log.student_id,
                    action_type: log.action_type,
                    scan_time: log.scan_time,
                });
            }
        }

        return res.json({ success: true, data: Array.from(seen.values()) });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ── Export — đặt SAU KHI rfidScan đã được định nghĩa ────────
module.exports = { getLogs, getKpi, rfidScan, getBusStudentsToday };

// ── POST /api/attendance/scan ─────────────────────────────────
// ESP32 gọi endpoint này mỗi khi đọc được thẻ RFID
async function rfidScan(req, res) {
    try {
        const { rfid_uid, device_mac_address } = req.body;

        if (!rfid_uid || !device_mac_address) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu rfid_uid hoặc device_mac_address',
            });
        }

        // 1. Tìm học sinh theo RFID UID
        const student = await Student.findOne({
            rfid_uid: rfid_uid.trim().toUpperCase(),
            isActive: true,
        });
        if (!student) {
            // Thẻ ch\u01b0a \u0111\u01b0\u1ee3c g\u00e1n cho h\u1ecdc sinh n\u00e0o
            // \u2192 Ph\u00e1t s\u1ef1 ki\u1ec7n \u0111\u1ec3 dashboard c\u00f3 th\u1ec3 t\u1ef1 \u0111i\u1ec1n UID khi th\u00eam h\u1ecdc sinh m\u1edbi
            const io = getIo();
            if (io) {
                io.emit('new_card_scanned', {
                    rfid_uid: rfid_uid.trim().toUpperCase(),
                    device_mac_address: device_mac_address.trim().toUpperCase(),
                    scanned_at: new Date().toISOString(),
                });
            }
            return res.status(404).json({
                success: false,
                code: 'STUDENT_NOT_FOUND',
                rfid_uid: rfid_uid.trim().toUpperCase(),
                message: `Th\u1ebb ch\u01b0a \u0111\u01b0\u1ee3c g\u00e1n. Dashboard \u0111\u00e3 \u0111\u01b0\u1ee3c th\u00f4ng b\u00e1o.`,
            });
        }

        // 2. Tìm xe bus theo MAC address của ESP32 (kèm theo tuyến đường để kiểm tra điểm dừng)
        const bus = await Bus.findOne({
            device_mac_address: device_mac_address.trim().toUpperCase(),
            isActive: true,
        }).populate('route_id');
        if (!bus) {
            return res.status(404).json({
                success: false,
                message: `Không tìm thấy xe với MAC: ${device_mac_address}`,
            });
        }

        // 2.5 Kiểm tra WRONG_RFID (Quẹt thẻ không đúng tuyến)
        if (student.route_id && bus.route_id && student.route_id.toString() !== bus.route_id._id.toString()) {
            const Alert = require('../models/Alert');
            const wrongRfidMsg = `Học sinh ${student.fullName} quẹt thẻ trên xe ${bus.licensePlate} không thuộc tuyến đường của mình!`;
            Alert.create({
                alert_type: 'WRONG_RFID',
                message: wrongRfidMsg,
                severity: 'warning',
                bus_id: bus._id,
                student_id: student._id
            }).then(alertDoc => {
                const io = getIo();
                if (io) io.emit('new_alert', alertDoc);
            }).catch(err => console.error('[RFID Alert] Lỗi tạo cảnh báo WRONG_RFID:', err));
        }

        // 3. Xác định hành động: toggle Boarding ↔ Dropping
        // Not_Boarded hoặc Dropped_Off  → Boarding
        // On_Bus                        → Dropping
        const isBoarding = student.currentStatus !== 'On_Bus';
        const action_type = isBoarding ? 'Boarding' : 'Dropping';
        const newStatus = isBoarding ? 'On_Bus' : 'Dropped_Off';

        // 4. Cập nhật trạng thái học sinh
        student.currentStatus = newStatus;
        await student.save();

        // 3.5 [Giai đoạn 3] Cảnh báo xuống sai điểm (Wrong Stop)
        let isAbnormal = false;
        let abnormalReason = null;
        let alertMessage = null;
        let matchedStop = null;

        if (bus.currentLat && bus.currentLng && bus.route_id) {
            function getDist(lat1, lon1, lat2, lon2) {
                const R = 6371;
                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLon = (lon2 - lon1) * Math.PI / 180;
                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
                return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            }

            const { schoolPos, stops } = bus.route_id;
            let minDist = 9999;

            // So sánh với điểm trường học
            if (schoolPos && schoolPos.lat && schoolPos.lng) {
                const dist = getDist(bus.currentLat, bus.currentLng, schoolPos.lat, schoolPos.lng);
                if (dist < minDist) {
                    minDist = dist;
                    matchedStop = 'Trường học';
                }
            }
            // So sánh với tất cả các điểm dừng
            if (stops && stops.length > 0) {
                stops.forEach(stop => {
                    if (stop.lat && stop.lng) {
                        const dist = getDist(bus.currentLat, bus.currentLng, stop.lat, stop.lng);
                        if (dist < minDist) {
                            minDist = dist;
                            matchedStop = stop.stopName || 'Điểm dừng';
                        }
                    }
                });
            }

            // Xử lý các lỗi bất thường khi xuống xe (Dropping)
            if (action_type === 'Dropping') {
                const now = new Date();
                const vnTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
                const currentHours = vnTime.getHours();

                // 1. Lỗi: Xuống xe giữa đường (cách xa tất cả điểm dừng > 0.5km)
                if (minDist > 0.5 && minDist !== 9999) {
                    isAbnormal = true;
                    matchedStop = 'Điểm không xác định'; // Ghi đè tên trạm để đồng bộ với lúc lên xe
                    abnormalReason = `Xuống sai điểm (Cách điểm hợp lệ gần nhất ~${(minDist).toFixed(1)}km)`;
                    alertMessage = `🚨 *CẢNH BÁO KHẨN CẤP*\n\nHọc sinh *${student.fullName}* vừa quẹt thẻ XUỐNG XE tại vị trí BẤT THƯỜNG (không khớp với bất kỳ điểm dừng nào trong lộ trình).\n\n📞 Phụ huynh vui lòng liên hệ nhà trường hoặc tài xế ngay lập tức!`;

                    const Alert = require('../models/Alert');
                    Alert.create({
                        alert_type: 'ABNORMAL_SCAN',
                        message: `Học sinh ${student.fullName} xuống xe tại vị trí bất thường (${(minDist).toFixed(1)}km so với điểm dừng gần nhất).`,
                        severity: 'warning',
                        bus_id: bus._id,
                        student_id: student._id
                    }).then(alertDoc => {
                        const io = getIo();
                        if (io) io.emit('new_alert', alertDoc);
                    }).catch(err => console.error('[RFID Alert] Lỗi tạo cảnh báo ABNORMAL_SCAN:', err));
                }
                // 2. Lỗi: Buổi chiều (sau 12h) xuống sai trạm đăng ký
                else if (currentHours >= 12 && student.assigned_stop && matchedStop !== student.assigned_stop && matchedStop !== 'Trường học') {
                    isAbnormal = true;
                    abnormalReason = `Xuống sai trạm đăng ký (Trạm của HS: ${student.assigned_stop})`;
                    alertMessage = `🚨 *CẢNH BÁO LƯU Ý*\n\nHọc sinh *${student.fullName}* vừa quẹt thẻ XUỐNG XE tại trạm *${matchedStop}*.\n⚠️ Tuy nhiên, trạm đăng ký đón/trả của em là *${student.assigned_stop}*.\n\n📞 Phụ huynh vui lòng xác nhận xem học sinh có xin xuống nhầm trạm không!`;

                    const Alert = require('../models/Alert');
                    Alert.create({
                        alert_type: 'ABNORMAL_SCAN',
                        message: `Học sinh ${student.fullName} xuống sai trạm đăng ký (Xuống tại: ${matchedStop} | Đăng ký: ${student.assigned_stop}).`,
                        severity: 'warning',
                        bus_id: bus._id,
                        student_id: student._id
                    }).then(alertDoc => {
                        const io = getIo();
                        if (io) io.emit('new_alert', alertDoc);
                    }).catch(err => console.error('[RFID Alert] Lỗi tạo cảnh báo ABNORMAL_SCAN:', err));
                }
            } else {
                // Nếu LÊN XE sai điểm thì ghi nhận vị trí không xác định, chưa cần báo động đỏ
                if (minDist > 0.5 && minDist !== 9999) {
                    matchedStop = 'Điểm không xác định';
                }
            }
        }

        // 5. Tạo bản ghi AttendanceLog
        const log = await AttendanceLog.create({
            student_id: student._id,
            bus_id: bus._id,
            action_type,
            lat_at_scan: bus.currentLat ?? null,
            lng_at_scan: bus.currentLng ?? null,
            stop_name: matchedStop,
            isAbnormal,
            abnormalReason,
        });

        // 6. Gửi thông báo Telegram cho Phụ huynh (nếu đã liên kết)
        if (student.parent_id) {
            // Chỉ select đúng trường cần, không lấy password
            const parentUser = await User.findById(student.parent_id).select('telegram_chat_id fullName');
            if (parentUser?.telegram_chat_id) {
                let telegramMsg;
                if (isAbnormal && alertMessage) {
                    telegramMsg = alertMessage;
                } else {
                    const scanTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
                    const actionText = action_type === 'Boarding' ? '🟢 *Lên xe*' : '🔴 *Xuống xe*';
                    let stopText = '';
                    if (matchedStop) {
                        stopText = `🛑 Điểm ${action_type === 'Boarding' ? 'đón' : 'xuống'}: ${matchedStop}\n`;
                    }
                    telegramMsg =
                        `🚌 *Thông báo điểm danh xe buýt*\n\n` +
                        `👦 Học sinh: *${student.fullName}*\n` +
                        `📋 Mã HS: ${student.studentCode}\n` +
                        `🚍 Xe: ${bus.licensePlate}\n` +
                        stopText +
                        `📍 Trạng thái: ${actionText}\n` +
                        `🕐 Thời gian: ${scanTime}`;
                }

                // Fire-and-forget: không dùng await để không chặn response về ESP32
                sendMessageToParent(parentUser.telegram_chat_id, telegramMsg);
            }
        }

        // 7. Phát sự kiện Socket.io cho frontend
        const io = getIo();
        if (io) {
            io.emit('rfid_scan', {
                studentId: student._id,
                studentName: student.fullName,
                studentCode: student.studentCode,
                grade: student.class,
                busId: bus._id,
                licensePlate: bus.licensePlate,
                action: action_type,
                timestamp: new Date().toISOString(),
                stopName: matchedStop,
                isAbnormal,
                abnormalReason,
            });
        }

        // 8. Trả kết quả cho ESP32 (text ngắn gọn để dễ log)
        return res.json({
            success: true,
            action: action_type,
            studentName: student.fullName,
            logId: log._id,
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}
