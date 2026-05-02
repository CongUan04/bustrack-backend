const mongoose = require('mongoose');

const busSchema = new mongoose.Schema(
    {
        licensePlate: {
            type: String,
            required: [true, 'Vui lòng nhập biển số xe'],
            unique: true,
            trim: true,
            uppercase: true,
        },
        name: {
            type: String,
            trim: true,
            default: '',
        },
        capacity: {
            type: Number,
            required: true,
            min: 1,
            max: 80,
        },
        driver_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        route_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Route',
            default: null,
        },
        // MAC address của module ESP32 gắn trên xe
        device_mac_address: {
            type: String,
            unique: true,
            sparse: true,
            uppercase: true,
            trim: true,
        },
        isOnline: {
            type: Boolean,
            default: false,
        },
        lastSeen: {
            type: Date,
            default: null,
        },
        currentLat: {
            type: Number,
            default: null,
        },
        currentLng: {
            type: Number,
            default: null,
        },
        currentSpeed: {
            type: Number,
            default: 0,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Bus', busSchema);
