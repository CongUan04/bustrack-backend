const mongoose = require('mongoose');

// Schema cho mỗi điểm dừng trong tuyến đường
const stopSchema = new mongoose.Schema(
    {
        stopName: {
            type: String,
            required: true,
            trim: true,
        },
        lat: {
            type: Number,
            required: true,
        },
        lng: {
            type: Number,
            required: true,
        },
        // Giờ dự kiến xe đến điểm dừng (VD: "07:15")
        expected_time: {
            type: String,
            trim: true,
        },
        order: {
            type: Number,
            default: 0,
        },
    },
    { _id: false } // không cần _id cho sub-document
);

const routeSchema = new mongoose.Schema(
    {
        routeName: {
            type: String,
            required: [true, 'Vui lòng nhập tên tuyến'],
            unique: true,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        stops: {
            type: [stopSchema],
            default: [],
        },
        schoolPos: {
            lat: Number,
            lng: Number
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Route', routeSchema);
