const Route = require('../models/Route');

// ── GET /api/routes ───────────────────────────────────────────
const getAll = async (req, res) => {
    try {
        const routes = await Route.find({ isActive: true }).sort({ routeName: 1 });
        return res.json({ success: true, count: routes.length, data: routes });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ── GET /api/routes/:id ───────────────────────────────────────
const getOne = async (req, res) => {
    try {
        const route = await Route.findById(req.params.id);
        if (!route) return res.status(404).json({ success: false, message: 'Không tìm thấy tuyến đường' });
        return res.json({ success: true, data: route });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ── POST /api/routes ──────────────────────────────────────────
const create = async (req, res) => {
    try {
        const { routeName, description, stops, schoolPos } = req.body;
        if (!routeName) return res.status(400).json({ success: false, message: 'Vui lòng nhập tên tuyến' });

        // Gán order tự động theo index nếu chưa có
        const normalizedStops = (stops || []).map((s, i) => ({
            stopName: s.stopName,
            lat: s.lat,
            lng: s.lng,
            expected_time: s.expected_time || '',
            order: s.order ?? i,
        }));

        const route = await Route.create({ routeName, description, stops: normalizedStops, schoolPos });
        return res.status(201).json({ success: true, data: route });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: 'Tên tuyến đã tồn tại' });
        }
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ── PUT /api/routes/:id ───────────────────────────────────────
const update = async (req, res) => {
    try {
        const { routeName, description, stops, schoolPos } = req.body;
        const normalizedStops = (stops || []).map((s, i) => ({
            stopName: s.stopName,
            lat: s.lat,
            lng: s.lng,
            expected_time: s.expected_time || '',
            order: s.order ?? i,
        }));

        const route = await Route.findByIdAndUpdate(
            req.params.id,
            { routeName, description, stops: normalizedStops, schoolPos },
            { new: true, runValidators: true }
        );
        if (!route) return res.status(404).json({ success: false, message: 'Không tìm thấy tuyến đường' });
        return res.json({ success: true, data: route });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ── DELETE /api/routes/:id (soft delete) ─────────────────────
const remove = async (req, res) => {
    try {
        const route = await Route.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );
        if (!route) return res.status(404).json({ success: false, message: 'Không tìm thấy tuyến đường' });
        return res.json({ success: true, message: 'Đã xóa tuyến đường' });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = { getAll, getOne, create, update, remove };
