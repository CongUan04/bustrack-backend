const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware bảo vệ route: kiểm tra JWT hợp lệ
 * Sử dụng: router.get('/me', protect, getMe)
 */
const protect = async (req, res, next) => {
    let token;

    // Lấy token từ header Authorization: Bearer <token>
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Không có quyền truy cập. Vui lòng đăng nhập.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select('-password');

        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Token không hợp lệ' });
        }
        next();
    } catch {
        return res.status(401).json({ success: false, message: 'Token hết hạn hoặc không hợp lệ' });
    }
};

/**
 * Middleware phân quyền theo role
 * Sử dụng: router.delete('/:id', protect, authorize('Admin'), deleteStudent)
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Role '${req.user.role}' không có quyền thực hiện thao tác này`,
            });
        }
        next();
    };
};

/**
 * protectIoT — Middleware linh hoạt cho thiết bị IoT (ESP32)
 *
 * Chấp nhận MỘT TRONG HAI cơ chế:
 *   1. Header "Authorization: Bearer <JWT>"  → dành cho Web App/Postman
 *   2. Header "x-api-key: <IOT_API_KEY>"     → dành cho ESP32 (không cần đăng nhập)
 *
 * Sử dụng: router.patch('/:id/location', protectIoT, updateLocation)
 */
async function protectIoT(req, res, next) {
    // ── Ưu tiên 1: JWT (dành cho browser/Postman test) ────────
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password');
            if (req.user) return next();
        } catch {
            // JWT không hợp lệ → thử API Key bên dưới
        }
    }

    // ── Ưu tiên 2: API Key (dành cho ESP32 phần cứng) ────────
    // Hỗ trợ cả Header (x-api-key) VÀ Query Parameter (?api_key=...)
    // Vì thư viện HTTPClient của ESP32 hay bị lỗi drop custom headers khi gửi PUT/PATCH
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    if (apiKey && apiKey === process.env.IOT_API_KEY) {
        req.user = { role: 'iot_device' }; // gán pseudo-user để log nếu cần
        return next();
    }

    // ── Không có cơ chế hợp lệ nào ───────────────────────────
    return res.status(401).json({
        success: false,
        message: 'Unauthorized: Cần JWT hoặc x-api-key hợp lệ',
    });
}

// ── Export — đặt SAU KHI tất cả hàm đã được định nghĩa ──────
module.exports = { protect, authorize, protectIoT };
