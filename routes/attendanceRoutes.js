const express = require('express');
const router = express.Router();
const { getLogs, getKpi, rfidScan, getBusStudentsToday } = require('../controllers/attendanceController');
const { protect, protectIoT } = require('../middleware/authMiddleware');

router.get('/', protect, getLogs);
router.get('/kpi', protect, getKpi);
router.get('/bus/:busId/today', protect, getBusStudentsToday);

// ESP32 gọi endpoint này bằng x-api-key, không cần JWT
router.post('/scan', protectIoT, rfidScan);

module.exports = router;

