const mongoose = require('mongoose');

/**
 * Kết nối MongoDB thông qua Mongoose
 * Gọi hàm này 1 lần trong server.js khi khởi động
 */
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            // Các option dưới đây không cần thiết từ Mongoose v6+
            // nhưng để rõ ràng vẫn nên liệt kê
        });

        console.log('✅ [MongoDB] Kết nối thành công!');
        console.log(`   Host     : ${conn.connection.host}`);
        console.log(`   Database : ${conn.connection.name}`);
    } catch (error) {
        console.error('❌ [MongoDB] Kết nối THẤT BẠI!');
        console.error(`   Lỗi: ${error.message}`);
        // Thoát process để tránh server chạy không có DB
        process.exit(1);
    }
};

module.exports = connectDB;
