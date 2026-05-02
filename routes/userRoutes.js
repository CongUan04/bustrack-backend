// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { getAll, getOne, update, resetPassword, remove, updateTelegram, testTelegram, testTelegramAdmin } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// Middleware kiểm tra Admin
const isAdmin = (req, res, next) => {
    if (req.user?.role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'Chỉ Admin mới được phép thực hiện thao tác này' });
    }
    next();
};

// ── Route dành cho TẤT CẢ user đã đăng nhập (phụ huynh tự cập nhật Telegram) ──
router.patch('/update-telegram', protect, updateTelegram);
router.post('/test-telegram', protect, testTelegram);

// ── Routes chỉ dành cho Admin ──────────────────────────────────────────────────
router.use(protect, isAdmin);

router.get('/',    getAll);
router.get('/:id', getOne);
router.put('/:id', update);
router.post('/:id/reset-password', resetPassword);
router.post('/:id/test-telegram', testTelegramAdmin);
router.delete('/:id', remove);

module.exports = router;

