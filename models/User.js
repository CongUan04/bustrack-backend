const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: [true, 'Vui lòng nhập họ tên'],
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'Vui lòng nhập email'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Email không hợp lệ'],
        },
        username: {
            type: String,
            unique: true,
            sparse: true,
            trim: true,
        },
        isEmailSet: {
            type: Boolean,
            default: true, // Admin / Driver tạo thủ công → email thật
        },
        password: {
            type: String,
            required: [true, 'Vui lòng nhập mật khẩu'],
            minlength: 6,
            select: false, // không trả password về client theo mặc định
        },
        role: {
            type: String,
            enum: ['Admin', 'Parent', 'Driver'],
            default: 'Parent',
        },
        phone: {
            type: String,
            trim: true,
        },
        telegram_chat_id: {
            type: String,
            default: null,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        resetOtp: {
            type: String,
        },
        resetOtpExpire: {
            type: Date,
        },
        avatar: {
            type: String,
            default: '',
        },
    },
    { timestamps: true }
);

// ── Hash password trước khi save ──────────────────────────────
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// ── So sánh password khi đăng nhập ───────────────────────────
userSchema.methods.matchPassword = async function (enteredPassword) {
    return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
