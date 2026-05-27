const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect } = require('../middleware/authMiddleware');
const fs = require('fs');

// Đảm bảo thư mục uploads tồn tại
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Cấu hình Multer lưu file
const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, 'uploads/'); // thư mục uploads nằm ở gốc thư mục backend
    },
    filename(req, file, cb) {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});

const checkFileType = (file, cb) => {
    const filetypes = /jpg|jpeg|png|webp|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb('Chỉ cho phép tải lên hình ảnh (jpg, jpeg, png, webp, gif)!');
    }
};

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    },
});

// POST /api/upload
// Route cho phép tải lên một ảnh
router.post('/', protect, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Vui lòng chọn một file ảnh' });
    }
    
    // Trả về đường dẫn tĩnh của file
    const url = `/uploads/${req.file.filename}`;
    res.json({
        success: true,
        message: 'Tải ảnh lên thành công',
        data: { url },
    });
});

module.exports = router;
