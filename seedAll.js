/**
 * seedAll.js — Seed toàn bộ dữ liệu mẫu vào MongoDB
 * Bao gồm: Routes, Buses, Users (Drivers/Parents), Students,
 *           AttendanceLogs, TrackingLogs, Alerts
 *
 * Chạy: node seedAll.js
 * Xóa sạch + seed lại: node seedAll.js --fresh
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');

const User = require('./models/User');
const Route = require('./models/Route');
const Bus = require('./models/Bus');
const Student = require('./models/Student');
const AttendanceLog = require('./models/AttendanceLog');
const TrackingLog = require('./models/TrackingLog');
const Alert = require('./models/Alert');

const FRESH = process.argv.includes('--fresh');

// ─────────────────────────────────────────────────────────────
// 1. ROUTES (5 tuyến đường)
// ─────────────────────────────────────────────────────────────
const ROUTE_DATA = [
    {
        routeName: 'Tuyến 1 - Quận 7',
        description: 'Tuyến đưa đón học sinh khu vực Quận 7',
        stops: [
            { order: 1, stopName: 'Điểm dừng 1 - Nguyễn Thị Thập', lat: 10.7310, lng: 106.7220, expected_time: '06:45' },
            { order: 2, stopName: 'Điểm dừng 2 - Lê Văn Lương', lat: 10.7380, lng: 106.7190, expected_time: '06:52' },
            { order: 3, stopName: 'Điểm dừng 3 - Nguyễn Hữu Thọ', lat: 10.7450, lng: 106.7150, expected_time: '06:58' },
            { order: 4, stopName: 'Điểm dừng 4 - Huỳnh Tấn Phát', lat: 10.7520, lng: 106.7100, expected_time: '07:05' },
            { order: 5, stopName: 'Điểm dừng 5 - Trường học', lat: 10.7700, lng: 106.7060, expected_time: '07:20' },
        ],
    },
    {
        routeName: 'Tuyến 2 - Bình Chánh',
        description: 'Tuyến đưa đón học sinh khu vực Bình Chánh',
        stops: [
            { order: 1, stopName: 'Điểm dừng 1 - Tân Kiên', lat: 10.7700, lng: 106.6400, expected_time: '06:30' },
            { order: 2, stopName: 'Điểm dừng 2 - Lê Minh Xuân', lat: 10.7750, lng: 106.6550, expected_time: '06:42' },
            { order: 3, stopName: 'Điểm dừng 3 - Nguyễn Văn Linh', lat: 10.7800, lng: 106.6700, expected_time: '06:55' },
            { order: 4, stopName: 'Điểm dừng 4 - Võ Văn Kiệt', lat: 10.7830, lng: 106.6850, expected_time: '07:08' },
            { order: 5, stopName: 'Điểm dừng 5 - Trường học', lat: 10.7700, lng: 106.7060, expected_time: '07:25' },
        ],
    },
    {
        routeName: 'Tuyến 3 - Nhà Bè',
        description: 'Tuyến đưa đón học sinh khu vực Nhà Bè',
        stops: [
            { order: 1, stopName: 'Điểm dừng 1 - Phước Kiển', lat: 10.7200, lng: 106.7300, expected_time: '06:35' },
            { order: 2, stopName: 'Điểm dừng 2 - Nhà Bè', lat: 10.7300, lng: 106.7250, expected_time: '06:47' },
            { order: 3, stopName: 'Điểm dừng 3 - Huỳnh Tấn Phát', lat: 10.7450, lng: 106.7180, expected_time: '07:00' },
            { order: 4, stopName: 'Điểm dừng 4 - Trường học', lat: 10.7700, lng: 106.7060, expected_time: '07:22' },
        ],
    },
    {
        routeName: 'Tuyến 4 - Gò Vấp',
        description: 'Tuyến đưa đón học sinh khu vực Gò Vấp',
        stops: [
            { order: 1, stopName: 'Điểm dừng 1 - Thống Nhất', lat: 10.8300, lng: 106.6700, expected_time: '06:25' },
            { order: 2, stopName: 'Điểm dừng 2 - Nguyễn Kiệm', lat: 10.8100, lng: 106.6750, expected_time: '06:38' },
            { order: 3, stopName: 'Điểm dừng 3 - Quang Trung', lat: 10.7950, lng: 106.6800, expected_time: '06:52' },
            { order: 4, stopName: 'Điểm dừng 4 - Phan Văn Trị', lat: 10.7800, lng: 106.6900, expected_time: '07:05' },
            { order: 5, stopName: 'Điểm dừng 5 - Trường học', lat: 10.7700, lng: 106.7060, expected_time: '07:28' },
        ],
    },
    {
        routeName: 'Tuyến 5 - Thủ Đức',
        description: 'Tuyến đưa đón học sinh khu vực Thủ Đức (TP Thủ Đức)',
        stops: [
            { order: 1, stopName: 'Điểm dừng 1 - Linh Xuân', lat: 10.8700, lng: 106.7700, expected_time: '06:20' },
            { order: 2, stopName: 'Điểm dừng 2 - Võ Văn Ngân', lat: 10.8500, lng: 106.7600, expected_time: '06:35' },
            { order: 3, stopName: 'Điểm dừng 3 - Kha Vạn Cân', lat: 10.8250, lng: 106.7450, expected_time: '06:50' },
            { order: 4, stopName: 'Điểm dừng 4 - Trường học', lat: 10.7700, lng: 106.7060, expected_time: '07:30' },
        ],
    },
];

// ─────────────────────────────────────────────────────────────
// 2. EXTRA USERS (thêm drivers + parents)
// ─────────────────────────────────────────────────────────────
const EXTRA_USERS = [
    // Drivers
    { fullName: 'Nguyễn Trung Hiếu', email: 'hieu.driver@bustrack.vn', password: 'Driver@123', role: 'Driver', phone: '0901111001' },
    { fullName: 'Trần Văn Hùng', email: 'hung.driver@bustrack.vn', password: 'Driver@123', role: 'Driver', phone: '0901111002' },
    { fullName: 'Lê Văn Minh', email: 'minh.driver@bustrack.vn', password: 'Driver@123', role: 'Driver', phone: '0901111003' },
    { fullName: 'Phạm Quang Vinh', email: 'vinh.driver@bustrack.vn', password: 'Driver@123', role: 'Driver', phone: '0901111004' },
    { fullName: 'Hoàng Anh Tuấn', email: 'tuan.driver@bustrack.vn', password: 'Driver@123', role: 'Driver', phone: '0901111005' },
    // Parents (phụ huynh cho 12 học sinh)
    { fullName: 'Bố/Mẹ Minh An', email: 'ph001@bustrack.vn', password: 'Parent@123', role: 'Parent', phone: '0901234567', telegram_chat_id: 'tg001' },
    { fullName: 'Bố/Mẹ Bảo', email: 'ph002@bustrack.vn', password: 'Parent@123', role: 'Parent', phone: '0912345678', telegram_chat_id: 'tg002' },
    { fullName: 'Bố/Mẹ Hoàng Nam', email: 'ph003@bustrack.vn', password: 'Parent@123', role: 'Parent', phone: '0923456789', telegram_chat_id: 'tg003' },
    { fullName: 'Bố/Mẹ Ngọc Linh', email: 'ph004@bustrack.vn', password: 'Parent@123', role: 'Parent', phone: '0934567890', telegram_chat_id: 'tg004' },
    { fullName: 'Bố/Mẹ Quốc Duy', email: 'ph005@bustrack.vn', password: 'Parent@123', role: 'Parent', phone: '0945678901', telegram_chat_id: 'tg005' },
    { fullName: 'Bố/Mẹ Thu Hà', email: 'ph006@bustrack.vn', password: 'Parent@123', role: 'Parent', phone: '0956789012', telegram_chat_id: 'tg006' },
    { fullName: 'Bố/Mẹ Khánh Huyền', email: 'ph007@bustrack.vn', password: 'Parent@123', role: 'Parent', phone: '0967890123', telegram_chat_id: 'tg007' },
    { fullName: 'Bố/Mẹ Thanh Tùng', email: 'ph008@bustrack.vn', password: 'Parent@123', role: 'Parent', phone: '0978901234', telegram_chat_id: 'tg008' },
    { fullName: 'Bố/Mẹ Mỹ Duyên', email: 'ph009@bustrack.vn', password: 'Parent@123', role: 'Parent', phone: '0989012345', telegram_chat_id: 'tg009' },
    { fullName: 'Bố/Mẹ Văn Khoa', email: 'ph010@bustrack.vn', password: 'Parent@123', role: 'Parent', phone: '0990123456', telegram_chat_id: 'tg010' },
    { fullName: 'Bố/Mẹ Bảo Châu', email: 'ph011@bustrack.vn', password: 'Parent@123', role: 'Parent', phone: '0901122334', telegram_chat_id: 'tg011' },
    { fullName: 'Bố/Mẹ Minh Khải', email: 'ph012@bustrack.vn', password: 'Parent@123', role: 'Parent', phone: '0912233445', telegram_chat_id: 'tg012' },
];

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
const run = async () => {
    await connectDB();

    if (FRESH) {
        console.log('\n🗑️  --fresh: Xóa toàn bộ dữ liệu cũ...');
        await Promise.all([
            Student.deleteMany({}),
            Bus.deleteMany({}),
            Route.deleteMany({}),
            AttendanceLog.deleteMany({}),
            TrackingLog.deleteMany({}),
            Alert.deleteMany({}),
            User.deleteMany({ email: { $ne: 'admin@bustrack.vn' } }), // giữ lại admin
        ]);
        console.log('   ✅ Đã xóa xong\n');
    }

    console.log('━'.repeat(55));
    console.log('🌱 Bắt đầu seed toàn bộ dữ liệu...');
    console.log('━'.repeat(55));

    // ── 1. Extra Users ──────────────────────────────────────────
    console.log('\n👤 [1/6] Tạo Users (drivers + parents)...');
    const createdUsers = {};
    for (const u of EXTRA_USERS) {
        const exists = await User.findOne({ email: u.email });
        if (exists) { createdUsers[u.email] = exists; continue; }
        const user = await User.create(u);
        createdUsers[u.email] = user;
    }
    console.log(`   ✅ ${Object.keys(createdUsers).length} users ready`);

    // ── 2. Routes ───────────────────────────────────────────────
    console.log('\n🗺️  [2/6] Tạo Routes...');
    const routeMap = {}; // routeName → doc
    for (const r of ROUTE_DATA) {
        let doc = await Route.findOne({ routeName: r.routeName });
        if (!doc) doc = await Route.create(r);
        routeMap[r.routeName] = doc;
    }
    console.log(`   ✅ ${Object.keys(routeMap).length} tuyến đường`);

    // ── 3. Buses ────────────────────────────────────────────────
    console.log('\n🚌 [3/6] Tạo Buses...');
    const busData = [
        { licensePlate: '51B-12345', capacity: 40, device_mac_address: 'AA:BB:CC:DD:EE:01', isOnline: true, currentLat: 10.7769, currentLng: 106.7009, currentSpeed: 32, driverEmail: 'hieu.driver@bustrack.vn', routeName: 'Tuyến 1 - Quận 7' },
        { licensePlate: '51B-67890', capacity: 40, device_mac_address: 'AA:BB:CC:DD:EE:02', isOnline: true, currentLat: 10.7850, currentLng: 106.6830, currentSpeed: 28, driverEmail: 'hung.driver@bustrack.vn', routeName: 'Tuyến 2 - Bình Chánh' },
        { licensePlate: '51C-11111', capacity: 35, device_mac_address: 'AA:BB:CC:DD:EE:03', isOnline: true, currentLat: 10.7550, currentLng: 106.7200, currentSpeed: 0, driverEmail: 'minh.driver@bustrack.vn', routeName: 'Tuyến 3 - Nhà Bè' },
        { licensePlate: '51D-22222', capacity: 40, device_mac_address: 'AA:BB:CC:DD:EE:04', isOnline: true, currentLat: 10.8050, currentLng: 106.6720, currentSpeed: 15, driverEmail: 'vinh.driver@bustrack.vn', routeName: 'Tuyến 4 - Gò Vấp' },
        { licensePlate: '51E-33333', capacity: 38, device_mac_address: 'AA:BB:CC:DD:EE:05', isOnline: false, currentLat: 10.8400, currentLng: 106.7500, currentSpeed: 0, driverEmail: 'tuan.driver@bustrack.vn', routeName: 'Tuyến 5 - Thủ Đức' },
    ];
    const busMap = {}; // licensePlate → doc
    for (const b of busData) {
        const driver = createdUsers[b.driverEmail] || await User.findOne({ email: b.driverEmail });
        const route = routeMap[b.routeName];
        let doc = await Bus.findOne({ licensePlate: b.licensePlate });
        if (!doc) {
            doc = await Bus.create({
                licensePlate: b.licensePlate,
                capacity: b.capacity,
                device_mac_address: b.device_mac_address,
                isOnline: b.isOnline,
                lastSeen: b.isOnline ? new Date() : new Date(Date.now() - 600000),
                currentLat: b.currentLat,
                currentLng: b.currentLng,
                currentSpeed: b.currentSpeed,
                driver_id: driver?._id,
                route_id: route?._id,
            });
        }
        busMap[b.licensePlate] = doc;
    }
    console.log(`   ✅ ${Object.keys(busMap).length} xe`);

    // ── 4. Students ─────────────────────────────────────────────
    console.log('\n🎓 [4/6] Tạo Students...');
    const studentRaw = [
        { code: 'HS001', fullName: 'Nguyễn Minh An', class: '6A', rfid: 'A1B2C3D4', parentEmail: 'ph001@bustrack.vn', routeName: 'Tuyến 1 - Quận 7', status: 'Not_Boarded' },
        { code: 'HS002', fullName: 'Trần Thị Bảo', class: '7B', rfid: 'E5F6G7H8', parentEmail: 'ph002@bustrack.vn', routeName: 'Tuyến 1 - Quận 7', status: 'Not_Boarded' },
        { code: 'HS003', fullName: 'Lê Hoàng Nam', class: '8C', rfid: 'I9J0K1L2', parentEmail: 'ph003@bustrack.vn', routeName: 'Tuyến 2 - Bình Chánh', status: 'On_Bus' },
        { code: 'HS004', fullName: 'Phạm Ngọc Linh', class: '6B', rfid: 'M3N4O5P6', parentEmail: 'ph004@bustrack.vn', routeName: 'Tuyến 2 - Bình Chánh', status: 'On_Bus' },
        { code: 'HS005', fullName: 'Vũ Quốc Duy', class: '9A', rfid: 'Q7R8S9T0', parentEmail: 'ph005@bustrack.vn', routeName: 'Tuyến 3 - Nhà Bè', status: 'Dropped_Off' },
        { code: 'HS006', fullName: 'Đặng Thu Hà', class: '7A', rfid: 'U1V2W3X4', parentEmail: 'ph006@bustrack.vn', routeName: 'Tuyến 1 - Quận 7', status: 'Not_Boarded' },
        { code: 'HS007', fullName: 'Bùi Khánh Huyền', class: '8A', rfid: 'Y5Z6A7B8', parentEmail: 'ph007@bustrack.vn', routeName: 'Tuyến 4 - Gò Vấp', status: 'On_Bus' },
        { code: 'HS008', fullName: 'Ngô Thanh Tùng', class: '6C', rfid: 'C9D0E1F2', parentEmail: 'ph008@bustrack.vn', routeName: 'Tuyến 4 - Gò Vấp', status: 'Not_Boarded', inactive: true },
        { code: 'HS009', fullName: 'Đinh Mỹ Duyên', class: '9B', rfid: 'G3H4I5J6', parentEmail: 'ph009@bustrack.vn', routeName: 'Tuyến 2 - Bình Chánh', status: 'Dropped_Off' },
        { code: 'HS010', fullName: 'Hoàng Văn Khoa', class: '7C', rfid: 'K7L8M9N0', parentEmail: 'ph010@bustrack.vn', routeName: 'Tuyến 3 - Nhà Bè', status: 'On_Bus' },
        { code: 'HS011', fullName: 'Phan Bảo Châu', class: '8B', rfid: 'O1P2Q3R4', parentEmail: 'ph011@bustrack.vn', routeName: 'Tuyến 3 - Nhà Bè', status: 'Not_Boarded' },
        { code: 'HS012', fullName: 'Trịnh Minh Khải', class: '9C', rfid: 'S5T6U7V8', parentEmail: 'ph012@bustrack.vn', routeName: 'Tuyến 4 - Gò Vấp', status: 'Not_Boarded', inactive: true },
    ];
    const studentDocs = [];
    for (const s of studentRaw) {
        const parent = createdUsers[s.parentEmail] || await User.findOne({ email: s.parentEmail });
        const route = routeMap[s.routeName];
        let doc = await Student.findOne({ studentCode: s.code });
        if (!doc) {
            doc = await Student.create({
                studentCode: s.code,
                fullName: s.fullName,
                class: s.class,
                rfid_uid: s.rfid,
                parent_id: parent?._id,
                route_id: route?._id,
                currentStatus: s.status,
                isActive: !s.inactive,
            });
        }
        studentDocs.push(doc);
    }
    console.log(`   ✅ ${studentDocs.length} học sinh`);

    // ── 5. AttendanceLogs ───────────────────────────────────────
    console.log('\n📋 [5/6] Tạo AttendanceLogs (40 bản ghi hôm nay)...');
    const existingLogs = await AttendanceLog.countDocuments({
        scan_time: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    });
    if (existingLogs > 0) {
        console.log(`   ⚠️  Đã có ${existingLogs} bản ghi hôm nay — bỏ qua`);
    } else {
        const now = Date.now();
        const buses = Object.values(busMap);
        const logData = [];
        for (let i = 39; i >= 0; i--) {
            const student = studentDocs[Math.floor(Math.random() * studentDocs.length)];
            const bus = buses[Math.floor(Math.random() * buses.length)];
            logData.push({
                student_id: student._id,
                bus_id: bus._id,
                scan_time: new Date(now - i * 180000 - Math.random() * 60000),
                action_type: Math.random() > 0.35 ? 'Boarding' : 'Dropping',
                lat_at_scan: 10.77 + (Math.random() - 0.5) * 0.05,
                lng_at_scan: 106.70 + (Math.random() - 0.5) * 0.05,
                stop_name: 'Điểm dừng ' + Math.ceil(Math.random() * 4),
                isAbnormal: Math.random() < 0.05,
            });
        }
        await AttendanceLog.insertMany(logData);
        console.log(`   ✅ 40 bản ghi điểm danh`);
    }

    // ── 6. TrackingLogs ─────────────────────────────────────────
    console.log('\n📍 [6a/6] Tạo TrackingLogs (60 điểm GPS / xe)...');
    const existingTracks = await TrackingLog.countDocuments();
    if (existingTracks > 0) {
        console.log(`   ⚠️  Đã có ${existingTracks} tracking points — bỏ qua`);
    } else {
        const trackData = [];
        for (const bus of Object.values(busMap)) {
            let lat = bus.currentLat || 10.77;
            let lng = bus.currentLng || 106.70;
            for (let i = 60; i >= 0; i--) {
                lat += (Math.random() - 0.5) * 0.002;
                lng += (Math.random() - 0.5) * 0.002;
                trackData.push({
                    bus_id: bus._id,
                    lat,
                    lng,
                    speed: bus.isOnline ? Math.random() * 50 + 10 : 0,
                    heading: Math.random() * 360,
                    timestamp: new Date(Date.now() - i * 10000),
                });
            }
        }
        await TrackingLog.insertMany(trackData);
        console.log(`   ✅ ${trackData.length} điểm GPS`);
    }

    // ── 7. Alerts ───────────────────────────────────────────────
    console.log('\n🚨 [6b/6] Tạo Alerts (20 cảnh báo mẫu)...');
    const existingAlerts = await Alert.countDocuments();
    if (existingAlerts > 0) {
        console.log(`   ⚠️  Đã có ${existingAlerts} alerts — bỏ qua`);
    } else {
        const buses = Object.values(busMap);
        const alertTemplates = [
            { type: 'OVERSPEED', severity: 'danger', msgFn: b => `Xe ${b.licensePlate} đang di chuyển 82 km/h (vượt giới hạn 30 km/h khu vực trường học)`, resolved: false },
            { type: 'STUDENT_FORGOTTEN', severity: 'danger', msgFn: () => `Học sinh Nguyễn Minh An chưa xuống xe sau khi xe đến điểm cuối tuyến`, resolved: false },
            { type: 'GPS_LOST', severity: 'warning', msgFn: b => `Xe ${b.licensePlate} mất tín hiệu GPS hơn 5 phút`, resolved: true },
            { type: 'DEVICE_OFFLINE', severity: 'warning', msgFn: b => `Module ESP32 trên ${b.licensePlate} mất kết nối server`, resolved: true },
            { type: 'LATE_ARRIVAL', severity: 'warning', msgFn: b => `Xe ${b.licensePlate} dự kiến trễ 12 phút do kẹt xe đường Nguyễn Kiệm`, resolved: false },
            { type: 'TELEGRAM_SENT', severity: 'info', msgFn: () => `Đã gửi thông báo xe cách 500m đến phụ huynh HS001 qua Telegram`, resolved: false },
            { type: 'WRONG_RFID', severity: 'warning', msgFn: () => `UID thẻ không khớp danh sách tuyến xe — HS009 quẹt thẻ trên XE-02`, resolved: true },
            { type: 'TELEGRAM_SENT', severity: 'info', msgFn: () => `Đã gửi thông báo hoàn thành chuyến buổi sáng tới tất cả phụ huynh`, resolved: false },
        ];
        const alertDocs = [];
        const now2 = Date.now();
        for (let i = 0; i < 20; i++) {
            const tpl = alertTemplates[i % alertTemplates.length];
            const bus = buses[Math.floor(Math.random() * buses.length)];
            alertDocs.push({
                bus_id: bus._id,
                alert_type: tpl.type,
                severity: tpl.severity,
                message: tpl.msgFn(bus),
                timestamp: new Date(now2 - i * 900000),
                isResolved: tpl.resolved,
            });
        }
        await Alert.insertMany(alertDocs);
        console.log(`   ✅ 20 cảnh báo`);
    }

    // ── Summary ─────────────────────────────────────────────────
    console.log('\n' + '━'.repeat(55));
    console.log('🎉 SEED HOÀN TẤT! Thống kê MongoDB:');
    console.log('━'.repeat(55));
    console.log(`   👤 Users:           ${await User.countDocuments()}`);
    console.log(`   🗺️  Routes:          ${await Route.countDocuments()}`);
    console.log(`   🚌 Buses:           ${await Bus.countDocuments()}`);
    console.log(`   🎓 Students:        ${await Student.countDocuments()}`);
    console.log(`   📋 AttendanceLogs:  ${await AttendanceLog.countDocuments()}`);
    console.log(`   📍 TrackingLogs:    ${await TrackingLog.countDocuments()}`);
    console.log(`   🚨 Alerts:          ${await Alert.countDocuments()}`);
    console.log('━'.repeat(55) + '\n');

    await mongoose.disconnect();
    process.exit(0);
};

run().catch(err => {
    console.error('\n❌ Lỗi seed:', err.message);
    mongoose.disconnect();
    process.exit(1);
});
