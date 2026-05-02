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
        currentStatus: {
            type: String,
            enum: ['Not_Boarded', 'On_Bus', 'Dropped_Off'],
            default: 'Not_Boarded',
        },
        photoUrl: {
            type: String,
            default: null,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
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
