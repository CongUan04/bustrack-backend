const Bus = require('../models/Bus');
const Student = require('../models/Student');
const User = require('../models/User');
const { sendMessageToParent } = require('../services/telegramService');
const mongoose = require('mongoose');
const socketHelper = require('../socket');

// Cache để chống spam thông báo (key: busId_stopName, value: timestamp)
const stopNotifications = new Map();

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Bán kính trái đất (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Helper: lấy io instance qua singleton (tránh circular dependency)
const getIo = () => socketHelper.getIo();

// ── GET /api/buses ────────────────────────────────────────────
const getAll = async (req, res) => {
    try {
        const { isOnline, isActive = 'true' } = req.query;
        const filter = {};
        if (isActive !== undefined) filter.isActive = isActive === 'true';
        if (isOnline !== undefined) filter.isOnline = isOnline === 'true';

        const buses = await Bus.find(filter)
            .populate('driver_id', 'fullName phone')
            .populate('route_id', 'routeName stops schoolPos')
            .sort({ licensePlate: 1 });

        return res.json({ success: true, count: buses.length, data: buses });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ── GET /api/buses/:id ────────────────────────────────────────
const getOne = async (req, res) => {
    try {
        const bus = await Bus.findById(req.params.id)
            .populate('driver_id', 'fullName phone')
            .populate('route_id', 'routeName stops schoolPos');
        if (!bus) return res.status(404).json({ success: false, message: 'Không tìm thấy xe' });
        return res.json({ success: true, data: bus });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ── PATCH /api/buses/:id/location ─────────────────────────────
// Nhận GPS update từ ESP32 (hoặc simulation)
const updateLocation = async (req, res) => {
    try {
        const { id } = req.params;
        const { lat, lng, speed, heading } = req.body;

        console.log(`\n[GPS 📡] Nhận dữ liệu từ xe có ID: ${id}`);
        console.log(`[GPS 📡] Payload nhận được:`, req.body);

        // 1. Tìm xe và cập nhật
        const bus = await Bus.findByIdAndUpdate(
            id,
            { currentLat: lat, currentLng: lng, currentSpeed: speed, isOnline: true, lastSeen: new Date() },
            { new: true }
        ).populate('route_id', 'routeName stops');

        // Nếu không tìm thấy xe trong MongoDB, in log rõ ràng
        if (!bus) {
            console.log(`[GPS ❌] LỖI 404: Không tìm thấy xe có ID '${id}' trong cơ sở dữ liệu MongoDB!`);
            return res.status(404).json({ success: false, message: 'Không tìm thấy xe (Hãy kiểm tra lại busId trong code ESP32!)' });
        }

        console.log(`[GPS ✅] Cập nhật tọa độ thành công cho xe: ${bus.licensePlate} (${lat}, ${lng})`);

        // 1.5 GPS Proximity Logic (Giai đoạn 2) - Thông báo sắp đến trạm
        if (bus.route_id && bus.route_id.stops && bus.route_id.stops.length > 0) {
            const NOW = Date.now();
            for (const stop of bus.route_id.stops) {
                if (!stop.lat || !stop.lng) continue;
                const distance = getDistanceFromLatLonInKm(lat, lng, stop.lat, stop.lng);
                
                // Nếu cách trạm <= 1km
                if (distance <= 1.0) {
                    const cacheKey = `${bus._id.toString()}_${stop.stopName}`;
                    const lastNotified = stopNotifications.get(cacheKey);
                    
                    // Chống spam: 30 phút mới thông báo lại 1 lần cho cùng 1 trạm
                    if (!lastNotified || NOW - lastNotified > 30 * 60 * 1000) {
                        stopNotifications.set(cacheKey, NOW);
                        
                        // 1. Tạo cảnh báo (Alert) cho Admin
                        const Alert = require('../models/Alert');
                        const adminMsg = `Xe ${bus.licensePlate} đang tiến đến trạm ${stop.stopName} (cách < 1km)`;
                        Alert.create({
                            type: 'Info',
                            message: adminMsg,
                            severity: 'info',
                            bus_id: bus._id
                        }).then(alertDoc => {
                            const io = getIo();
                            if (io) io.emit('new_alert', alertDoc);
                        }).catch(err => console.error('[GPS Proximity] Lỗi tạo Alert cho admin:', err));

                        // 2. Gửi Telegram cho phụ huynh
                        Student.find({ route_id: bus.route_id._id, isActive: true })
                            .populate('parent_id', 'telegram_chat_id')
                            .then(students => {
                                const chatIds = new Set();
                                students.forEach(s => {
                                    if (s.parent_id && s.parent_id.telegram_chat_id) {
                                        chatIds.add(s.parent_id.telegram_chat_id);
                                    }
                                });
                                
                                const msg = `🚌 *Thông báo Hành trình*\n\nXe buýt *${bus.licensePlate}* đang cách điểm đón/trả *${stop.stopName}* khoảng dưới 1km (tầm 3-5 phút).\nPhụ huynh vui lòng lưu ý và chuẩn bị!`;
                                
                                chatIds.forEach(chatId => {
                                    sendMessageToParent(chatId, msg);
                                });
                            })
                            .catch(err => console.error('[GPS Proximity] Lỗi khi gửi Telegram:', err));
                    }
                }
            }
        }

        // 2. BẮT BUỘC: Phát sự kiện GPS real-time ra Frontend qua Socket.io
        const io = getIo();
        if (io) {
            io.emit('gps_update', {
                busId: bus._id.toString(),
                licensePlate: bus.licensePlate,
                lat,
                lng,
                speed: speed ?? bus.currentSpeed,
                heading: heading ?? 0,
                routeName: bus.route_id?.routeName ?? null,
                timestamp: new Date().toISOString(),
            });
            console.log(`[GPS ⚡] Đã bắn sự kiện 'gps_update' qua Socket.io thành công!`);
        } else {
            console.log(`[GPS ⚠️] Socket.io chưa được khởi tạo!`);
        }

        return res.status(200).json({ success: true, message: 'Cập nhật vị trí thành công!', data: bus });
    } catch (err) {
        console.error(`[GPS ❌] Lỗi hệ thống:`, err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ── POST /api/buses ───────────────────────────────────────────
// Thêm một xe buýt mới (dùng cho trang Bus Management)
const createBus = async (req, res) => {
    try {
        const { licensePlate, name, device_mac_address, capacity } = req.body;

        if (!licensePlate) {
            return res.status(400).json({ success: false, message: 'Biển số xe là bắt buộc' });
        }

        const bus = await Bus.create({
            licensePlate: licensePlate.trim().toUpperCase(),
            name: name ? name.trim() : undefined,
            device_mac_address: device_mac_address ? device_mac_address.trim().toUpperCase() : undefined,
            capacity: capacity ?? 45,
        });

        return res.status(201).json({ success: true, data: bus });
    } catch (err) {
        // Lỗi duplicate biển số hoặc MAC
        if (err.code === 11000) {
            const field = Object.keys(err.keyPattern)[0];
            const msg = field === 'licensePlate' ? 'Biển số xe đã tồn tại' : 'Địa chỉ MAC đã được đăng ký cho xe khác';
            return res.status(409).json({ success: false, message: msg });
        }
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ── PATCH /api/buses/:id ──────────────────────────────────────
// Cập nhật thông tin xe (từ trang quản lý - dùng JWT)
const updateBus = async (req, res) => {
    try {
        const { licensePlate, name, device_mac_address, capacity, driver_id, route_id } = req.body;

        // Xây dựng object update — chỉ set những field được gửi lên
        const update = {};

        if (licensePlate !== undefined) {
            update.licensePlate = licensePlate.trim().toUpperCase();
        }
        if (name !== undefined) {
            update.name = name.trim();
        }
        if (capacity !== undefined) {
            update.capacity = Number(capacity);
        }
        if (driver_id !== undefined) {
            update.driver_id = driver_id || null;
        }
        if (route_id !== undefined) {
            update.route_id = route_id || null;
        }

        // MAC Address: gửi chuỗi rỗng "" → xoá MAC (set null); gửi giá trị → uppercase
        if (device_mac_address !== undefined) {
            update.device_mac_address = device_mac_address
                ? device_mac_address.trim().toUpperCase()
                : null;
        }

        const bus = await Bus.findByIdAndUpdate(
            req.params.id,
            { $set: update },
            { new: true, runValidators: true }
        )
            .populate('driver_id', 'fullName phone')
            .populate('route_id', 'routeName');

        if (!bus) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy xe' });
        }

        return res.json({ success: true, data: bus });
    } catch (err) {
        if (err.code === 11000) {
            const field = Object.keys(err.keyPattern)[0];
            const msg = field === 'licensePlate'
                ? 'Biển số xe đã tồn tại'
                : 'Địa chỉ MAC đã được đăng ký cho xe khác';
            return res.status(409).json({ success: false, message: msg });
        }
        return res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = { getAll, getOne, updateLocation, createBus, updateBus };
