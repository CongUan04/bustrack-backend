const express = require('express');
const router = express.Router();
const { getStats } = require('../controllers/dashboardController');
const { protect, authorize } = require('../middleware/authMiddleware');

// GET /api/dashboard/stats — chỉ Admin
router.get('/stats', protect, authorize('Admin'), getStats);

module.exports = router;
