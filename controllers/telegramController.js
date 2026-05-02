// controllers/telegramController.js
// Cho phép Phụ huynh liên kết Telegram Chat ID vào tài khoản của họ

const User = require('../models/User');
const { sendMessageToParent } = require('../services/telegramService');

/**
 * PUT /api/telegram/link
 * Body: { telegram_chat_id: "123456789" }
 * Headers: Authorization: Bearer <JWT>  (dùng middleware protect)
 *
 * Phụ huynh lấy Chat ID của mình bằng cách nhắn /start hoặc /mychatid
 * cho Bot, sau đó call API này để lưu vào profile.
 */
const linkChatId = async (req, res) => {
    try {
        const { telegram_chat_id } = req.body;

        if (!telegram_chat_id) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp telegram_chat_id',
            });
        }

        // req.user được gán bởi middleware protect
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { telegram_chat_id: String(telegram_chat_id).trim() },
            { new: true, select: '-password' }
        );

        // Gửi tin nhắn xác nhận tới chính Chat ID vừa liên kết
        const confirmMsg =
            `✅ *Liên kết thành công!*\n\n` +
            `Tài khoản *${user.fullName}* đã được liên kết với Telegram này.\n` +
            `Bạn sẽ nhận thông báo điểm danh khi con lên/xuống xe.`;
        sendMessageToParent(telegram_chat_id, confirmMsg); // fire-and-forget

        return res.json({
            success: true,
            message: 'Đã liên kết Telegram Chat ID thành công',
            data: { telegram_chat_id: user.telegram_chat_id },
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * DELETE /api/telegram/unlink
 * Headers: Authorization: Bearer <JWT>
 * Hủy liên kết Bot khỏi tài khoản.
 */
const unlinkChatId = async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, { telegram_chat_id: null });
        return res.json({ success: true, message: 'Đã hủy liên kết Telegram' });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/telegram/status
 * Kiểm tra trạng thái liên kết của user hiện tại.
 */
const linkStatus = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('telegram_chat_id fullName');
        return res.json({
            success: true,
            linked: !!user.telegram_chat_id,
            telegram_chat_id: user.telegram_chat_id,
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = { linkChatId, unlinkChatId, linkStatus };
