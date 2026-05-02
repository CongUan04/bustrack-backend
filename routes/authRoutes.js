const express = require('express');
const router = express.Router();
const { login, getMe, updateProfile, seed, forgotPassword, verifyResetOTP, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// POST /api/auth/login  — đăng nhập, nhận JWT
router.post('/login', login);

// POST /api/auth/forgot-password — gửi OTP
router.post('/forgot-password', forgotPassword);

// POST /api/auth/verify-otp — kiểm tra OTP hợp lệ
router.post('/verify-otp', verifyResetOTP);

// POST /api/auth/reset-password — đặt lại mật khẩu bằng OTP
router.post('/reset-password', resetPassword);

// GET  /api/auth/me     — lấy thông tin user hiện tại (cần JWT)
router.get('/me', protect, getMe);

// PUT  /api/auth/profile — cập nhật fullName, email, mật khẩu
router.put('/profile', protect, updateProfile);

// POST /api/auth/seed   — tạo tài khoản mẫu (CHỈ dùng khi dev)
router.post('/seed', seed);

module.exports = router;
