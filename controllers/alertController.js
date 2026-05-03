const Alert = require('../models/Alert');
const socketHelper = require('../socket');

const getIo = () => socketHelper.getIo();

// ── GET /api/alerts ───────────────────────────────────────────
const getAll = async (req, res) => {
    try {
        const { severity, isResolved, limit = 100 } = req.query;
        const filter = {};
        if (severity) filter.severity = severity;
        if (isResolved !== undefined) filter.isResolved = isResolved === 'true';

        const alerts = await Alert.find(filter)
            .populate('bus_id', 'licensePlate')
            .populate('student_id', 'fullName studentCode')
            .populate('resolvedBy', 'fullName')
            .sort({ timestamp: -1 })
            .limit(Number(limit));

        return res.json({ success: true, count: alerts.length, data: alerts });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ── PATCH /api/alerts/:id/acknowledge ────────────────────────
const acknowledge = async (req, res) => {
    try {
        const alert = await Alert.findByIdAndUpdate(
            req.params.id,
            { isResolved: true, resolvedBy: req.user._id, resolvedAt: new Date() },
            { new: true }
        );
        if (!alert) return res.status(404).json({ success: false, message: 'Không tìm thấy cảnh báo' });
        return res.json({ success: true, data: alert });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ── PATCH /api/alerts/acknowledge-all ────────────────────────
const acknowledgeAll = async (req, res) => {
    try {
        const result = await Alert.updateMany(
            { isResolved: false },
            { isResolved: true, resolvedBy: req.user._id, resolvedAt: new Date() }
        );
        return res.json({ success: true, count: result.modifiedCount, message: `Đã xử lý ${result.modifiedCount} cảnh báo` });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ── POST /api/alerts ──────────────────────────────────────────
const create = async (req, res) => {
    try {
        const alert = await Alert.create(req.body);
        
        const io = getIo();
        if (io) {
            io.emit('new_alert', alert);
        }
        
        return res.status(201).json({ success: true, data: alert });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = { getAll, acknowledge, acknowledgeAll, create };
