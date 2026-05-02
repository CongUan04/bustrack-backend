const Student = require('../models/Student');
const Bus = require('../models/Bus');
const Alert = require('../models/Alert');
const AttendanceLog = require('../models/AttendanceLog');

// ── @desc   Lấy stats realtime cho Dashboard ──────────────────
// ── @route  GET /api/dashboard/stats
// ── @access Protected (Admin)
const getStats = async (req, res) => {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // Chạy tất cả query song song
        const [
            activeBuses,
            offlineBuses,
            totalBuses,
            studentsOnBus,
            totalStudents,
            unresolvedAlerts,
            dangerAlerts,
            warningAlerts,
            todayAttendance,
            recentLogs,
        ] = await Promise.all([
            Bus.countDocuments({ isOnline: true, isActive: true }),
            Bus.countDocuments({ isOnline: false, isActive: true }),
            Bus.countDocuments({ isActive: true }),
            Student.countDocuments({ currentStatus: 'On_Bus', isActive: true }),
            Student.countDocuments({ isActive: true }),
            Alert.countDocuments({ isResolved: false }),
            Alert.countDocuments({ isResolved: false, severity: 'danger' }),
            Alert.countDocuments({ isResolved: false, severity: 'warning' }),

            // Điểm danh hôm nay
            AttendanceLog.countDocuments({ scan_time: { $gte: todayStart } }),

            // 5 lượt quẹt thẻ gần nhất (populate student + bus)
            AttendanceLog
                .find()
                .sort({ scan_time: -1 })
                .limit(5)
                .populate({ path: 'student_id', select: 'fullName studentCode class' })
                .populate({ path: 'bus_id', select: 'licensePlate' }),
        ]);

        // Alert summary breakdown
        const alertsByType = await Alert.aggregate([
            { $match: { isResolved: false } },
            { $group: { _id: '$alert_type', count: { $sum: 1 } } },
        ]);

        // Bus status breakdown
        const busStatusCounts = await Bus.aggregate([
            { $match: { isActive: true } },
            {
                $group: {
                    _id: '$isOnline',
                    count: { $sum: 1 },
                },
            },
        ]);

        // Format recent swipes for frontend
        const recentSwipes = recentLogs.map(log => ({
            id: log._id,
            studentName: log.student_id?.fullName ?? 'Không xác định',
            studentId: log.student_id?.studentCode ?? '---',
            grade: log.student_id?.class ?? '---',
            busId: log.bus_id?.licensePlate ?? '---',
            action: log.action_type === 'Boarding' ? 'lên xe' : 'xuống xe',
            timestamp: log.scan_time,
        }));

        return res.status(200).json({
            success: true,
            data: {
                kpi: {
                    activeBuses,
                    offlineBuses,
                    totalBuses,
                    studentsOnBus,
                    totalStudents,
                    unresolvedAlerts,
                    dangerAlerts,
                    warningAlerts,
                    todayAttendance,
                },
                busStatus: {
                    online: activeBuses,
                    offline: offlineBuses,
                    total: totalBuses,
                },
                alertSummary: alertsByType.reduce((acc, cur) => {
                    acc[cur._id] = cur.count;
                    return acc;
                }, {}),
                recentSwipes,
                lastUpdate: new Date(),
            },
        });
    } catch (error) {
        console.error('[Dashboard] getStats error:', error.message);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

module.exports = { getStats };
