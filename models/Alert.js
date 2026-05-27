const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
    {
        bus_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Bus',
            default: null,   // một số alert không liên quan đến xe cụ thể
        },
        student_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Student',
            default: null,
        },
        alert_type: {
            type: String,
            enum: [
                'OVERSPEED',          // Quá tốc độ
                'STUDENT_FORGOTTEN',  // Bỏ quên học sinh trên xe
                'GPS_LOST',           // Mất tín hiệu GPS
                'DEVICE_OFFLINE',     // ESP32 mất kết nối
                'LATE_ARRIVAL',       // Trễ giờ so với lịch
                'WRONG_RFID',         // Quẹt thẻ không đúng tuyến
                'ABNORMAL_SCAN',      // Quẹt thẻ bất thường
                'TELEGRAM_SENT',      // Đã gửi thông báo Telegram
                'ABSENCE_LOG',        // Lịch sử báo nghỉ
                'OTHER',
            ],
            required: true,
        },
        severity: {
            type: String,
            enum: ['danger', 'warning', 'info'],
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
        timestamp: {
            type: Date,
            default: Date.now,
        },
        isResolved: {
            type: Boolean,
            default: false,
        },
        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        resolvedAt: {
            type: Date,
            default: null,
        },
        // Metadata thêm (vd: tốc độ ghi nhận, tọa độ)
        meta: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
    }
);

alertSchema.index({ isResolved: 1, timestamp: -1 });
alertSchema.index({ bus_id: 1, timestamp: -1 });
alertSchema.index({ severity: 1, isResolved: 1 });

module.exports = mongoose.model('Alert', alertSchema);
