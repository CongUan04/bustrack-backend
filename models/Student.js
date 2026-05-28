const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
    {
        studentCode: {
            type: String,
            required: [true, 'Vui lòng nhập mã học sinh'],
            unique: true,
            trim: true,
            uppercase: true,
        },
        fullName: {
            type: String,
            required: [true, 'Vui lòng nhập họ tên'],
            trim: true,
        },
        class: {
            type: String,
            required: [true, 'Vui lòng nhập lớp'],
            trim: true,
        },
        rfid_uid: {
            type: String,
            unique: true,
            sparse: true,   // cho phép null (chưa gán thẻ)
            uppercase: true,
            trim: true,
        },
        fatherPhone: {
            type: String,
            trim: true,
        },
        motherPhone: {
            type: String,
            trim: true,
        },
        parent_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,  // không bắt buộc khi thêm từ form Admin
        },
        route_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Route',
            default: null,
        },
        assigned_stop: {
            type: String,
            default: null,
        },
        currentStatus: {
            type: String,
            enum: ['Not_Boarded', 'On_Bus', 'Dropped_Off', 'Absent'],
            default: 'Not_Boarded',
        },
        classStartTime: {
            type: String,
            default: '07:30', // HH:mm
        },
        classEndTime: {
            type: String,
            default: '16:30', // HH:mm
        },
        photoUrl: {
            type: String,
            default: null,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        // Ngày học trong tuần: 0=CN, 1=T2, 2=T3, 3=T4, 4=T5, 5=T6, 6=T7
        // Mặc định T2-T6 (học sinh học từ Thứ 2 đến Thứ 6)
        studyDays: {
            type: [Number],
            default: [1, 2, 3, 4, 5],
            validate: {
                validator: (arr) => arr.every(d => d >= 0 && d <= 6),
                message: 'studyDays phải là số từ 0 (CN) đến 6 (T7)',
            },
        },
        // Lý do vắng mặt hôm nay (reset mỗi ngày bởi cron hoặc khi đổi trạng thái)
        absenceReason: {
            type: String,
            default: null,
        },
        absences: [
            {
                date: { type: String, required: true }, // Format: YYYY-MM-DD
                reason: { type: String },
                timestamp: { type: Date, default: Date.now }
            }
        ],
    },
    { timestamps: true }
);

// Hàm validate bắt buộc nhập ít nhất 1 số điện thoại
studentSchema.pre('validate', function (next) {
    // Chỉ kiểm tra khi có sự thay đổi (trường hợp tạo mới luôn có)
    if (!this.fatherPhone && !this.motherPhone) {
        this.invalidate('fatherPhone', 'Phải cung cấp ít nhất một số điện thoại phụ huynh để liên kết hệ thống');
        // ta có thể invalidate thêm motherPhone nếu muốn, nhưng 1 cái là đủ báo lỗi
    }
    next();
});

// unique:true ở trên đã tạo index — xóa khai báo trùng để tránh Mongoose warning
// studentSchema.index({ rfid_uid: 1 });

module.exports = mongoose.model('Student', studentSchema);
