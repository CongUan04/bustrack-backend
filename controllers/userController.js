// controllers/userController.js
// CRUD tài khoản — chỉ dành cho Admin

const User = require('../models/User');

// ── Helper: random password ───────────────────────────────────
const generatePassword = (len = 10) => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

// ── GET /api/users ────────────────────────────────────────────
const getAll = async (req, res) => {
    try {
        const { role, search, isActive } = req.query;
        const filter = {};

        if (role) filter.role = role;
        if (isActive !== undefined) filter.isActive = isActive === 'true';
        if (search) {
            filter.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
            ];
        }

        const users = await User.find(filter).sort({ createdAt: -1 });
        return res.json({ success: true, count: users.length, data: users });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ── GET /api/users/:id ────────────────────────────────────────
const getOne = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
        return res.json({ success: true, data: user });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ── PUT /api/users/:id ────────────────────────────────────────
const update = async (req, res) => {
    try {
        const { fullName, phone, role, isActive, telegram_chat_id, password } = req.body;

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });

        // Không cho phép Admin tự khóa chính mình
        if (req.user._id.toString() === req.params.id && isActive === false) {
            return res.status(400).json({ success: false, message: 'Không thể tự vô hiệu hóa tài khoản của chính mình' });
        }

        if (fullName !== undefined) user.fullName = fullName;
        if (phone !== undefined) user.phone = phone;
        if (role !== undefined) user.role = role;
        if (isActive !== undefined) user.isActive = isActive;
        if (telegram_chat_id !== undefined) user.telegram_chat_id = telegram_chat_id;
        if (password) user.password = password;

        await user.save();
        return res.json({ success: true, data: user });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ── POST /api/users/:id/reset-password ───────────────────────
const resetPassword = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('+password');
        if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });

        const newPassword = generatePassword();
        user.password = newPassword; // pre-save hook sẽ hash tự động
        await user.save();

        return res.json({
            success: true,
            message: `Đã reset mật khẩu cho ${user.fullName}`,
            newPassword, // Admin cần copy và thông báo cho user
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ── DELETE /api/users/:id ─────────────────────────────────────
const remove = async (req, res) => {
    try {
        // Không cho xóa chính mình
        if (req.user._id.toString() === req.params.id) {
            return res.status(400).json({ success: false, message: 'Không thể xóa tài khoản của chính mình' });
        }

        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });

        return res.json({ success: true, message: `Đã xóa tài khoản ${user.email}` });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ── PATCH /api/users/update-telegram ─────────────────────────────────────────
// Cho phép bất kỳ user đã đăng nhập tự cập nhật Telegram Chat ID của mình
const updateTelegram = async (req, res) => {
    try {
        const { telegramChatId } = req.body;

        // Cho phép xóa (truyền chuỗi rỗng) hoặc giá trị là số
        if (telegramChatId !== '' && telegramChatId !== undefined && telegramChatId !== null) {
            if (!/^\d+$/.test(String(telegramChatId).trim())) {
                return res.status(400).json({
                    success: false,
                    message: 'Telegram Chat ID phải là một dãy số (VD: 123456789)',
                });
            }
        }

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });

        user.telegram_chat_id = telegramChatId ? String(telegramChatId).trim() : null;
        await user.save();

        return res.json({
            success: true,
            message: telegramChatId
                ? 'Đã liên kết Telegram thành công! Bạn sẽ nhận thông báo qua Telegram.'
                : 'Đã gỡ liên kết Telegram.',
            data: { telegram_chat_id: user.telegram_chat_id },
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ── POST /api/users/test-telegram ────────────────────────────────────────────
// Gửi một tin nhắn thử nghiệm tới Telegram của user hiện tại
const testTelegram = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || !user.telegram_chat_id) {
            return res.status(400).json({ success: false, message: 'Tài khoản chưa được liên kết Telegram' });
        }

        const { sendMessageToParent } = require('../services/telegramService');
        await sendMessageToParent(
            user.telegram_chat_id,
            `✅ *Kết nối thành công!*\n\nĐây là tin nhắn thử nghiệm từ hệ thống BusTrack. Kể từ bây giờ, bạn sẽ nhận được thông báo điểm danh của học sinh qua kênh này.`
        );

        return res.json({ success: true, message: 'Đã gửi tin nhắn thử nghiệm, vui lòng kiểm tra Telegram của bạn.' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Không thể gửi tin nhắn thử nghiệm. Vui lòng đảm bảo Telegram Chat ID là chính xác và bạn đã bấm /start với bot.' });
    }
};

// ── POST /api/users/:id/test-telegram ─────────────────────────────────────────
// Chỉ Admin dùng: gửi tin nhắn thử nghiệm tới một user bất kỳ trong danh sách
const testTelegramAdmin = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user || !user.telegram_chat_id) {
            return res.status(400).json({ success: false, message: 'Người dùng này chưa có Telegram Chat ID hợp lệ' });
        }

        const { sendMessageToParent } = require('../services/telegramService');
        await sendMessageToParent(
            user.telegram_chat_id,
            `🔔 *Thông báo thử nghiệm (từ Admin)*\n\nXin chào ${user.fullName}, nhà trường đang kiểm tra đường truyền thông báo tới tài khoản Telegram của bạn. Nếu bạn nhận được tin nhắn này, cấu hình đã hoàn tất thành công!`
        );

        return res.json({ success: true, message: `Thành công! Đã gửi tin thử nghiệm tới Telegram của ${user.fullName}` });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Lỗi gửi tin: ' + err.message });
    }
};

module.exports = { getAll, getOne, update, resetPassword, remove, updateTelegram, testTelegram, testTelegramAdmin };
