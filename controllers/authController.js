const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendOtpEmail } = require('../services/emailService');

// ── Helper: tạo JWT token ─────────────────────────────────────
const generateToken = (id, role) => {
    return jwt.sign(
        { id, role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

// ── Helper: định dạng response user (không kèm password) ──────
const userResponse = (user, token) => ({
    _id: user._id,
    fullName: user.fullName,
    email: user.email,
    username: user.username,
    role: user.role,
    phone: user.phone,
    isEmailSet: user.isEmailSet,
    telegram_chat_id: user.telegram_chat_id,
    avatar: user.avatar,
    token,
});

// ── @desc   Đăng nhập ─────────────────────────────────────────
// ── @route  POST /api/auth/login
// ── @access Public
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập email và mật khẩu' });
        }

        // Tìm user + lấy password (select: false cần +password)
        const user = await User.findOne({
            $or: [
                { email: email.toLowerCase() },
                { username: email.trim() },
                { phone: email.trim() }
            ]
        }).select('+password');
        if (!user) {
            return res.status(401).json({ success: false, message: 'Tài khoản hoặc mật khẩu không đúng' });
        }

        if (!user.isActive) {
            return res.status(403).json({ success: false, message: 'Tài khoản đã bị khóa' });
        }

        // So sánh password
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng' });
        }

        const token = generateToken(user._id, user.role);

        return res.status(200).json({
            success: true,
            message: 'Đăng nhập thành công',
            data: userResponse(user, token),
        });
    } catch (error) {
        console.error('[Auth] Login error:', error.message);
        return res.status(500).json({ success: false, message: 'Lỗi server, vui lòng thử lại' });
    }
};

// ── @desc   Lấy thông tin user hiện tại (cần JWT) ─────────
// ── @route  GET /api/auth/me
// ── @access Protected
const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy user' });
        }
        return res.status(200).json({ success: true, data: userResponse(user, null) });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// ── @desc   Cập nhật profile (fullName, email, password) ──────
// ── @route  PUT /api/auth/profile
// ── @access Protected
const updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('+password');
        if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });

        const { fullName, email, currentPassword, newPassword, avatar, phone } = req.body;

        // ── Cập nhật họ tên ────────────────────────────────────
        if (fullName) user.fullName = fullName.trim();

        // ── Cập nhật avatar ────────────────────────────────────
        if (avatar !== undefined) user.avatar = avatar;

        // ── Cập nhật số điện thoại ─────────────────────────────
        if (phone !== undefined) user.phone = phone.trim();

        // ── Cập nhật email ────────────────────────────────────
        if (email && email.trim()) {
            // Kiểm tra email đồng chục với tài khoản khác không
            const dup = await User.findOne({ email: email.trim().toLowerCase(), _id: { $ne: user._id } });
            if (dup) return res.status(400).json({ success: false, message: 'Email này đã được dùng bởi tài khoản khác' });
            user.email = email.trim().toLowerCase();
            user.isEmailSet = true; // đánh dấu email đã xác thực
        }

        // ── Đổi mật khẩu (cần xác nhận mật khẩu cũ) ──────────────
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ success: false, message: 'Vui lòng nhập mật khẩu hiện tại' });
            }
            const isMatch = await user.matchPassword(currentPassword);
            if (!isMatch) return res.status(401).json({ success: false, message: 'Mật khẩu hiện tại không đúng' });
            if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
            user.password = newPassword;
        }

        await user.save();
        const token = req.headers.authorization?.split(' ')[1] ?? null; // giữ JWT cũ
        return res.json({ success: true, message: 'Cập nhật thành công', data: userResponse(user, token) });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ── @desc   Seed tài khoản mặc định (chỉ dùng khi dev) ───────
// ── @route  POST /api/auth/seed
// ── @access Public (xóa route này trước khi lên production!)
const seed = async (req, res) => {
    try {
        // Kiểm tra môi trường
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({ success: false, message: 'Không cho phép seed trong production' });
        }

        const accounts = [
            {
                fullName: 'Super Admin',
                email: 'admin@bustrack.vn',
                password: 'Admin@123',
                role: 'Admin',
                phone: '0900000001',
            },
            {
                fullName: 'Nguyễn Phụ Huynh',
                email: 'parent@bustrack.vn',
                password: 'Parent@123',
                role: 'Parent',
                phone: '0900000002',
                telegram_chat_id: '123456789',
            },
            {
                fullName: 'Trần Văn Tài Xế',
                email: 'driver@bustrack.vn',
                password: 'Driver@123',
                role: 'Driver',
                phone: '0900000003',
            },
        ];

        const created = [];
        const skipped = [];

        for (const acc of accounts) {
            const exists = await User.findOne({ email: acc.email });
            if (exists) {
                skipped.push(acc.email);
                continue;
            }
            await User.create(acc);
            created.push({ email: acc.email, role: acc.role, password: acc.password });
        }

        return res.status(201).json({
            success: true,
            message: `Seed hoàn tất: tạo ${created.length}, bỏ qua ${skipped.length} (đã tồn tại)`,
            created,
            skipped,
        });
    } catch (error) {
        console.error('[Auth] Seed error:', error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ── @desc   Quên mật khẩu (Gửi OTP) ────────────────────────
// ── @route  POST /api/auth/forgot-password
// ── @access Public
const forgotPassword = async (req, res) => {
    try {
        const { identity } = req.body;
        if (!identity) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp email hoặc số điện thoại' });
        }

        const user = await User.findOne({
            $or: [
                { email: identity.toLowerCase() },
                { phone: identity.trim() }
            ]
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản với thông tin này' });
        }

        // Tạo OTP 6 số ngẫu nhiên
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Lưu OTP vào DB (hết hạn sau 5 phút)
        user.resetOtp = otp;
        user.resetOtpExpire = Date.now() + 5 * 60 * 1000;
        await user.save();

        console.log(`[OTP Mock] Mã OTP của user ${user.email}: ${otp}`);

        // Gửi qua Email hoặc Telegram
        let sendMethod = '';
        if (identity.includes('@')) {
            // ── Gửi OTP qua Gmail (dùng emailService với GMAIL_USER) ──
            sendMethod = 'Gmail';
            const sent = await sendOtpEmail(user.email, otp);
            if (!sent) {
                // Nếu gửi thất bại (chưa cấu hình Gmail), trả lỗi rõ ràng
                return res.status(500).json({
                    success: false,
                    message: 'Không thể gửi email OTP. Vui lòng liên hệ nhà trường để được hỗ trợ.',
                });
            }
        } else {
            // ── Gửi OTP qua Telegram (dùng cho SĐT) ──
            sendMethod = 'Telegram';
            const { sendMessageToParent } = require('../services/telegramService');
            if (user.telegram_chat_id) {
                await sendMessageToParent(
                    user.telegram_chat_id,
                    `🔐 *Khôi phục mật khẩu BusTrack*\n\nMã OTP của bạn là: \`${otp}\`\n\n_Mã này chỉ có hiệu lực trong vòng 5 phút. Không chia sẻ cho bất kỳ ai._`
                );
            } else {
                // Không có Telegram — thông báo rõ để phụ huynh biết
                return res.status(400).json({
                    success: false,
                    message: 'Tài khoản chưa liên kết Telegram. Vui lòng dùng Email để khôi phục mật khẩu.',
                });
            }
        }

        return res.status(200).json({
            success: true,
            message: `Mã xác nhận đã được gửi qua ${sendMethod}. Vui lòng kiểm tra hộp thư.`,
        });
    } catch (error) {
        console.error('[Auth] forgotPassword error:', error.message);
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
};

// ── @desc   Xác nhận OTP ──────────────────────────────────────
// ── @route  POST /api/auth/verify-otp
// ── @access Public
const verifyResetOTP = async (req, res) => {
    try {
        const { identity, otp } = req.body;
        if (!identity || !otp) return res.status(400).json({ success: false, message: 'Vui lòng cung cấp đủ thông tin' });

        const user = await User.findOne({
            $or: [
                { email: identity.toLowerCase() },
                { phone: identity.trim() }
            ],
            resetOtp: otp,
            resetOtpExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Mã OTP không hợp lệ hoặc đã hết hạn' });
        }

        return res.status(200).json({ success: true, message: 'Mã OTP hợp lệ' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
};

// ── @desc   Đặt lại mật khẩu ──────────────────────────────────
// ── @route  POST /api/auth/reset-password
// ── @access Public
const resetPassword = async (req, res) => {
    try {
        const { identity, otp, newPassword } = req.body;
        if (!identity || !otp || !newPassword) return res.status(400).json({ success: false, message: 'Vui lòng cung cấp đủ thông tin' });

        if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'Mật khẩu phải từ 6 ký tự' });

        const user = await User.findOne({
            $or: [
                { email: identity.toLowerCase() },
                { phone: identity.trim() }
            ],
            resetOtp: otp,
            resetOtpExpire: { $gt: Date.now() }
        }).select('+password');

        if (!user) {
            return res.status(400).json({ success: false, message: 'OTP không hợp lệ hoặc hết hạn' });
        }

        user.password = newPassword;
        user.resetOtp = undefined;
        user.resetOtpExpire = undefined;
        await user.save();

        return res.status(200).json({ success: true, message: 'Mật khẩu đã được cập nhật, vui lòng đăng nhập lại' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
};

module.exports = { login, getMe, updateProfile, seed, forgotPassword, verifyResetOTP, resetPassword };
