const mongoose = require('mongoose');

/**
 * TrackingLog — Lưu lịch sử vị trí GPS của xe
 * Ghi mỗi 5-10 giây từ ESP32 gửi về qua MQTT / Socket.io
 * TTL index tự xóa dữ liệu cũ sau 30 ngày để tiết kiệm dung lượng
 */
const trackingLogSchema = new mongoose.Schema(
    {
        bus_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Bus',
            required: true,
        },
        lat: {
            type: Number,
            required: true,
        },
        lng: {
            type: Number,
            required: true,
        },
        speed: {
            type: Number,
            default: 0,      // km/h
            min: 0,
        },
        heading: {
            type: Number,
            default: 0,      // độ (0-360)
        },
        satellites: {
            type: Number,
            default: null,   // số vệ tinh GPS bắt được
        },
        timestamp: {
            type: Date,
            default: Date.now,
            required: true,
        },
    },
    {
        // Không cần timestamps tự động vì đã có trường 'timestamp'
        timestamps: false,
    }
);

// Index để query lịch sử tuyến đường theo xe + thời gian
trackingLogSchema.index({ bus_id: 1, timestamp: -1 });

// TTL Index: MongoDB tự xóa documents sau 30 ngày (2592000 giây)
trackingLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('TrackingLog', trackingLogSchema);
