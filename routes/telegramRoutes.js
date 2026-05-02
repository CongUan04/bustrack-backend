// routes/telegramRoutes.js
const express = require('express');
const router = express.Router();
const { linkChatId, unlinkChatId, linkStatus } = require('../controllers/telegramController');
const { protect } = require('../middleware/authMiddleware');

// Tất cả các route dưới đây đều yêu cầu đăng nhập (JWT)

// PUT  /api/telegram/link    — Phụ huynh liên kết Chat ID vào tài khoản
router.put('/link', protect, linkChatId);

// DELETE /api/telegram/unlink — Hủy liên kết
router.delete('/unlink', protect, unlinkChatId);

// GET /api/telegram/status   — Kiểm tra trạng thái liên kết
router.get('/status', protect, linkStatus);

module.exports = router;
