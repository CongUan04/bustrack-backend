const mongoose = require('mongoose');

const attendanceLogSchema = new mongoose.Schema(
    {
        student_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Student',
            required: true,
        },
        bus_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Bus',
            required: true,
        },
        scan_time: {
            type: Date,
            default: Date.now,
            required: true,
        },
        // Loại hành động khi quẹt thẻ
        action_type: {
            type: String,
            enum: ['Boarding', 'Dropping'],
            required: true,
        },
        // Tọa độ GPS tại thời điểm quẹt thẻ
        lat_at_scan: {
            type: Number,
            default: null,
        },
        lng_at_scan: {
            type: Number,
            default: null,
        },
        stop_name: {
            type: String,
            default: null,
        },
        // Đánh dấu bất thường (vd: quẹt sai tuyến, quẹt ngoài giờ)
        isAbnormal: {
            type: Boolean,
            default: false,
        },
        abnormalReason: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
        // index để query nhanh theo ngày
    }
);

// Compound index để báo cáo điểm danh theo học sinh + ngày
attendanceLogSchema.index({ student_id: 1, scan_time: -1 });
attendanceLogSchema.index({ bus_id: 1, scan_time: -1 });
attendanceLogSchema.index({ scan_time: -1 }); // cho báo cáo tổng

module.exports = mongoose.model('AttendanceLog', attendanceLogSchema);
