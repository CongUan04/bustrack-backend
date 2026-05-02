const express = require('express');
const router = express.Router();
const { getAll, getOne, updateLocation, createBus, updateBus } = require('../controllers/busController');
const { protect, protectIoT } = require('../middleware/authMiddleware');

router.get('/', protect, getAll);
router.post('/', protect, createBus);
router.get('/:id', protect, getOne);
// ESP32 gửi GPS qua API Key — không dùng JWT (Thêm PUT để tương thích tốt hơn với ESP32)
router.put('/:id/location', protectIoT, updateLocation);
router.patch('/:id/location', protectIoT, updateLocation);
// Cập nhật thông tin xe (từ trang quản lý — dùng JWT)
router.patch('/:id', protect, updateBus);

module.exports = router;

