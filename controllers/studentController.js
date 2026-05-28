const Student = require('../models/Student');
const User = require('../models/User');
const socketHelper = require('../socket');
const getIo = () => socketHelper.getIo();
const Route = require('../models/Route');
const { sendWelcomeEmail } = require('../services/emailService');
const Alert = require('../models/Alert');
const { sendMessageToParent } = require('../services/telegramService');

// ── GET /api/students ─────────────────────────────────────────
const getAll = async (req, res) => {
    try {
        const { search, route, isActive } = req.query;
        const filter = {};

        if (search) {
            filter.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { studentCode: { $regex: search, $options: 'i' } },
                { rfid_uid: { $regex: search, $options: 'i' } },
            ];
        }
        if (route) filter.route_id = route;
        if (isActive !== undefined) filter.isActive = isActive === 'true';

        const students = await Student.find(filter)
            .populate('parent_id', 'fullName phone telegram_chat_id')
            .populate('route_id', 'routeName')
            .sort({ studentCode: 1 });

        return res.json({ success: true, count: students.length, data: students });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ── GET /api/students/:id ─────────────────────────────────────
const getOne = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id)
            .populate('parent_id', 'fullName phone telegram_chat_id')
            .populate('route_id', 'routeName stops');
        if (!student) return res.status(404).json({ success: false, message: 'Không tìm thấy học sinh' });
        return res.json({ success: true, data: student });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ── Helper: tạo password ngẫu nhiên ──────────────────────────
const generatePassword = (len = 10) => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

// ── POST /api/students ────────────────────────────────────────
const create = async (req, res) => {
    try {
        const { studentCode, fullName, class: cls, rfid_uid, route_id, fatherPhone, motherPhone, parentName, parentEmail, classStartTime, classEndTime, assigned_stop, studyDays, photoUrl } = req.body;

        // Kiểm tra trùng mã HS / RFID
        if (await Student.findOne({ studentCode: studentCode?.trim().toUpperCase() }))
            return res.status(400).json({ success: false, message: 'Mã học sinh đã tồn tại' });
        if (rfid_uid && await Student.findOne({ rfid_uid }))
            return res.status(400).json({ success: false, message: 'UID thẻ RFID đã được gán cho học sinh khác' });

        // Kiểm tra định dạng Gmail (nếu có nhập — không bắt buộc)
        const GMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@gmail\.com$/i;
        if (parentEmail && parentEmail.trim() && !GMAIL_REGEX.test(parentEmail.trim())) {
            return res.status(400).json({
                success: false,
                message: 'Email phụ huynh phải đúng định dạng Gmail (kết thúc bằng @gmail.com)',
            });
        }

        // ── Tự động tạo tài khoản Phụ huynh theo số điện thoại ──────────────────
        let parentPhone = fatherPhone || motherPhone;
        let parentUser = null;
        let isNewParent = false;
        let rawPassword = null; // lưu mật khẩu thô để gửi email
        let hasRealEmail = false;
        let emailSent = false;
        let shouldSendEmail = false;
        let emailTarget = null;

        if (parentPhone) {
            parentUser = await User.findOne({ phone: parentPhone.trim() });

            if (!parentUser) {
                // ── Phụ huynh chưa tồn tại → tạo mới ──
                hasRealEmail = !!(parentEmail && parentEmail.trim());
                const finalEmail = hasRealEmail
                    ? parentEmail.trim()
                    : `ph.${parentPhone.trim()}@placeholder.bustrack.vn`;

                rawPassword = '123456';

                parentUser = await User.create({
                    fullName: parentName?.trim() || `Phụ huynh HS ${studentCode.trim().toUpperCase()}`,
                    username: parentPhone.trim(),
                    phone: parentPhone.trim(),
                    email: finalEmail,
                    isEmailSet: hasRealEmail,
                    password: rawPassword,
                    role: 'Parent',
                });
                isNewParent = true;

                console.log(`[Student] ✅ Tạo tài khoản phụ huynh mới: ${parentPhone.trim()}, email: ${finalEmail}, isEmailSet: ${hasRealEmail}`);

                if (hasRealEmail) {
                    shouldSendEmail = true;
                    emailTarget = parentEmail.trim();
                    console.log(`[Student] 📧 Sẽ gửi welcome email tới: ${emailTarget}`);
                } else {
                    console.log(`[Student] ℹ️  Không có email thật → bỏ qua gửi email (dùng placeholder).`);
                }
            } else {
                // ── Phụ huynh đã tồn tại → kiểm tra có cần cập nhật email không ──
                console.log(`[Student] ℹ️  Phụ huynh đã tồn tại (phone: ${parentPhone.trim()}) → dùng lại tài khoản.`);

                // Nếu admin cung cấp email thật VÀ tài khoản chưa có email thật → cập nhật
                if (parentEmail && parentEmail.trim() && !parentUser.isEmailSet) {
                    rawPassword = '123456'; // mật khẩu hiện tại không thay đổi, chỉ thông báo
                    parentUser.email = parentEmail.trim();
                    parentUser.isEmailSet = true;
                    await parentUser.save();
                    shouldSendEmail = true;
                    emailTarget = parentEmail.trim();
                    console.log(`[Student] 📧 Cập nhật email thật cho phụ huynh và sẽ gửi thông báo tới: ${emailTarget}`);
                }
            }
        } else {
            console.log(`[Student] ⚠️  Không có số điện thoại phụ huynh → không tạo tài khoản.`);
        }

        // ── Tạo học sinh, gán parent_id ──────────────
        const student = await Student.create({
            studentCode, fullName, class: cls, rfid_uid,
            parent_id: parentUser ? parentUser._id : undefined,
            route_id, fatherPhone, motherPhone, classStartTime, classEndTime, assigned_stop, studyDays, photoUrl
        });

        // ── Gửi Welcome Email (blocking - await để đảm bảo gửi xong trước khi response) ──
        let emailError = null;
        if (shouldSendEmail && emailTarget) {
            console.log(`[Email] 🚀 Bắt đầu gửi email tới: ${emailTarget}`);
            console.log(`[Email] GMAIL_USER: ${process.env.GMAIL_USER ? '✅' : '❌ THIẾU'}`);
            console.log(`[Email] GMAIL_APP_PASSWORD: ${process.env.GMAIL_APP_PASSWORD ? '✅' : '❌ THIẾU'}`);
            try {
                await sendWelcomeEmail(emailTarget, {
                    studentName: fullName,
                    username: parentPhone.trim(),
                    password: rawPassword || '123456',
                });
                emailSent = true;
                console.log(`[Email] ✅ Gửi email thành công tới: ${emailTarget}`);
            } catch (err) {
                emailError = err.message;
                console.error(`[Email] ❌ Gửi email THẤT BẠI tới ${emailTarget}:`, err.message);
            }
        }

        // ── Trả về thông tin học sinh ──────────────
        let message = 'Đã thêm học sinh thành công';
        if (isNewParent) {
            message = shouldSendEmail
                ? (emailSent
                    ? `Đã tạo tài khoản phụ huynh và gửi email thông báo tới ${emailTarget}`
                    : `Đã tạo tài khoản phụ huynh nhưng gửi email thất bại: ${emailError}`)
                : 'Đã tạo tài khoản phụ huynh (không có email → dùng mật khẩu mặc định: 123456)';
        } else if (shouldSendEmail) {
            message = emailSent
                ? `Đã cập nhật email phụ huynh và gửi thông báo tới ${emailTarget}`
                : `Đã cập nhật email nhưng gửi email thất bại: ${emailError}`;
        }

        const responseData = {
            success: true,
            data: student,
            message,
            parentInfo: parentUser ? {
                isNew: isNewParent,
                emailSentTo: emailSent ? emailTarget : null,
                emailError: emailError || null,
            } : null,
        };

        return res.status(201).json(responseData);
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ── PUT /api/students/:id ─────────────────────────────────────
const update = async (req, res) => {
    try {
        const { studentCode, fullName, class: cls, rfid_uid, parent_id, route_id, isActive, fatherPhone, motherPhone, classStartTime, classEndTime, assigned_stop, studyDays, photoUrl } = req.body;

        // Kiểm tra RFID trùng với HS khác
        if (rfid_uid) {
            const dup = await Student.findOne({ rfid_uid, _id: { $ne: req.params.id } });
            if (dup) return res.status(400).json({ success: false, message: 'UID thẻ đã dùng cho học sinh khác' });
        }

        const student = await Student.findById(req.params.id);
        if (!student) return res.status(404).json({ success: false, message: 'Không tìm thấy học sinh' });

        // Cập nhật các trường
        if (studentCode !== undefined) student.studentCode = studentCode;
        if (fullName !== undefined) student.fullName = fullName;
        if (cls !== undefined) student.class = cls;
        if (rfid_uid !== undefined) student.rfid_uid = rfid_uid;
        if (parent_id !== undefined) student.parent_id = parent_id;
        if (route_id !== undefined) student.route_id = route_id;
        if (isActive !== undefined) student.isActive = isActive;
        if (fatherPhone !== undefined) student.fatherPhone = fatherPhone;
        if (motherPhone !== undefined) student.motherPhone = motherPhone;
        if (classStartTime !== undefined) student.classStartTime = classStartTime;
        if (classEndTime !== undefined) student.classEndTime = classEndTime;
        if (assigned_stop !== undefined) student.assigned_stop = assigned_stop;
        if (studyDays !== undefined) student.studyDays = studyDays;
        if (photoUrl !== undefined) student.photoUrl = photoUrl;

        await student.save(); // pre('validate') sẽ chạy ở đây

        // Populate lại sau khi save
        await student.populate([
            { path: 'parent_id', select: 'fullName phone' },
            { path: 'route_id', select: 'routeName' }
        ]);
        return res.json({ success: true, data: student });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ── DELETE /api/students/:id ──────────────────────────────────
const remove = async (req, res) => {
    try {
        const student = await Student.findByIdAndDelete(req.params.id);
        if (!student) return res.status(404).json({ success: false, message: 'Không tìm thấy học sinh' });
        return res.json({ success: true, message: `Đã xoá học sinh ${student.fullName}` });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ── GET /api/students/my-children ──────────────────────────────
// Phụ huynh lấy danh sách học sinh của mình
const getMyChildren = async (req, res) => {
    try {
        const children = await Student.find({ parent_id: req.user.id })
            .populate('route_id', 'routeName stops schoolPos')
            .sort({ fullName: 1 });
        return res.json({ success: true, data: children });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ── PUT /api/students/:id/absent ──────────────────────────────
const markAbsent = async (req, res) => {
    try {
        const { reason, date } = req.body; // lý do vắng mặt và ngày vắng mặt
        const student = await Student.findById(req.params.id).populate('parent_id');
        if (!student) return res.status(404).json({ success: false, message: 'Không tìm thấy học sinh' });

        // Format ngày muốn vắng mặt, mặc định là hôm nay
        const targetDate = date || new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).substring(0, 10);
        
        // Cập nhật vào mảng lịch sử báo nghỉ
        student.absences.push({ date: targetDate, reason: reason || 'Gia đình xin phép' });

        // Nếu ngày báo vắng là hôm nay, cập nhật luôn trạng thái hiện tại
        const today = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).substring(0, 10);
        if (targetDate === today) {
            student.currentStatus = 'Absent';
            student.absenceReason = reason || null;
        }

        await student.save();
        await student.populate('route_id', 'routeName stops');

        // Tạo cảnh báo "Lịch sử báo nghỉ"
        const alertMsg = `Học sinh ${student.fullName} được phụ huynh báo vắng ngày ${targetDate.split('-').reverse().join('/')}. Lý do: ${reason || 'Không có'}`;
        const newAlert = await Alert.create({
            student_id: student._id,
            alert_type: 'ABSENCE_LOG',
            severity: 'info',
            message: alertMsg,
            isResolved: true, // Tự đánh dấu đã xử lý để không hiện số đỏ làm phiền Admin
        });

        // Phát sự kiện realtime
        const io = getIo();
        if (io) {
            io.emit('new_alert', newAlert);
            if (targetDate === today) {
                io.emit('student_status_update', {
                    studentId: student._id,
                    status: 'Absent',
                    studentName: student.fullName,
                    reason: reason || null,
                });
            }
        }

        // Gửi Telegram cho phụ huynh
        if (student.parent_id?.telegram_chat_id) {
            await sendMessageToParent(student.parent_id.telegram_chat_id, `[Xác nhận] ${alertMsg}`);
        }

        return res.json({ success: true, message: `Đã báo vắng mặt ngày ${targetDate.split('-').reverse().join('/')} cho học sinh ${student.fullName}`, data: student });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ── PUT /api/students/:id/study-days (Parent only) ────────────
const updateStudyDays = async (req, res) => {
    try {
        const { studyDays } = req.body;
        if (!Array.isArray(studyDays)) {
            return res.status(400).json({ success: false, message: 'studyDays phải là mảng số nguyên' });
        }
        const student = await Student.findById(req.params.id);
        if (!student) return res.status(404).json({ success: false, message: 'Không tìm thấy học sinh' });

        // Chỉ phụ huynh sở hữu học sinh mới được sửa
        if (req.user.role === 'Parent' && String(student.parent_id) !== String(req.user.id)) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền sửa lịch học của học sinh này' });
        }

        student.studyDays = studyDays;
        await student.save();
        return res.json({ success: true, message: 'Đã cập nhật lịch học', data: student });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = { getAll, getOne, create, update, remove, getMyChildren, markAbsent, updateStudyDays };

