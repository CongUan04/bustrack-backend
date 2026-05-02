/**
 * seed.js — Chạy độc lập, không cần server đang chạy
 * Cách dùng: node seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const connectDB = require('./config/db');

const User = require('./models/User');

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

const run = async () => {
    await connectDB();

    console.log('\n🌱 Bắt đầu seed dữ liệu...\n');

    for (const acc of accounts) {
        const exists = await User.findOne({ email: acc.email });
        if (exists) {
            console.log(`⚠️  Đã tồn tại: ${acc.email} (bỏ qua)`);
            continue;
        }
        const user = await User.create(acc);
        console.log(`✅ Đã tạo: [${user.role}] ${user.fullName} — ${user.email} / mật khẩu: ${acc.password}`);
    }

    console.log('\n🎉 Seed hoàn tất!\n');
    console.log('📋 Tài khoản để đăng nhập:');
    console.log('   Admin  : admin@bustrack.vn   / Admin@123');
    console.log('   Parent : parent@bustrack.vn  / Parent@123');
    console.log('   Driver : driver@bustrack.vn  / Driver@123');
    console.log('\n');

    await mongoose.disconnect();
    process.exit(0);
};

run().catch(err => {
    console.error('❌ Lỗi seed:', err.message);
    process.exit(1);
});
