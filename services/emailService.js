// services/emailService.js
// Quản lý toàn bộ logic gửi email qua Nodemailer + Gmail

const nodemailer = require('nodemailer');

// ── Tạo transporter (singleton, tái dùng trong suốt vòng đời app) ──────────
let transporter = null;

const getTransporter = () => {
    if (transporter) return transporter;

    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;

    if (!user || !pass) {
        console.warn('[Email] ⚠️  GMAIL_USER hoặc GMAIL_APP_PASSWORD chưa được đặt trong .env — Email sẽ không hoạt động.');
        return null;
    }

    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
    });

    console.log('[Email] ✅ Nodemailer transporter đã sẵn sàng.');
    return transporter;
};

// ── Template HTML đẹp cho Welcome Email ──────────────────────────────────────
const buildWelcomeEmailHTML = ({ studentName, username, password, loginUrl }) => `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Thông tin tài khoản BusTrack</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', Arial, sans-serif;
      background-color: #f0f4f8;
      color: #1a202c;
      padding: 32px 16px;
    }
    .wrapper {
      max-width: 560px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.10);
    }
    /* ── Header ── */
    .header {
      background: linear-gradient(135deg, #1a56db 0%, #0e9f6e 100%);
      padding: 36px 32px 28px;
      text-align: center;
    }
    .header-icon { font-size: 48px; margin-bottom: 12px; }
    .header h1 {
      color: #ffffff;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }
    .header p {
      color: rgba(255,255,255,0.85);
      font-size: 13px;
      margin-top: 6px;
    }
    /* ── Body ── */
    .body { padding: 32px; }
    .greeting {
      font-size: 15px;
      color: #374151;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .greeting strong { color: #1a56db; }
    /* ── Info card ── */
    .info-card {
      background: #f8faff;
      border: 1.5px solid #e0eaff;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .info-card-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #6b7280;
      margin-bottom: 16px;
    }
    .info-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid #e9effe;
    }
    .info-row:last-child { border-bottom: none; }
    .info-label {
      font-size: 13px;
      color: #6b7280;
      width: 130px;
      flex-shrink: 0;
    }
    .info-value {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
      word-break: break-all;
    }
    .info-value.password {
      font-family: 'Courier New', monospace;
      font-size: 16px;
      background: #fef3c7;
      color: #92400e;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid #fde68a;
    }
    /* ── CTA Button ── */
    .cta-wrap { text-align: center; margin: 28px 0 20px; }
    .cta-btn {
      display: inline-block;
      background: linear-gradient(135deg, #1a56db, #0e9f6e);
      color: #ffffff !important;
      text-decoration: none;
      font-size: 15px;
      font-weight: 600;
      padding: 14px 36px;
      border-radius: 50px;
      letter-spacing: 0.2px;
      box-shadow: 0 4px 14px rgba(26,86,219,0.35);
      transition: opacity 0.2s;
    }
    /* ── Warning box ── */
    .warning-box {
      background: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 14px 16px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 24px;
    }
    .warning-box p {
      font-size: 13px;
      color: #78350f;
      line-height: 1.5;
    }
    /* ── Footer ── */
    .footer {
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
      padding: 20px 32px;
      text-align: center;
    }
    .footer p {
      font-size: 12px;
      color: #9ca3af;
      line-height: 1.6;
    }
    .footer a { color: #1a56db; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">

    <!-- Header -->
    <div class="header">
      <div class="header-icon">🚌</div>
      <h1>Hệ thống Xe buýt Trường học</h1>
      <p>BusTrack — Theo dõi an toàn & minh bạch</p>
    </div>

    <!-- Body -->
    <div class="body">
      <p class="greeting">
        Kính gửi Quý Phụ huynh,<br/><br/>
        Nhà trường đã đăng ký thông tin cho học sinh <strong>${studentName}</strong> vào hệ thống theo dõi xe buýt.
        Dưới đây là thông tin tài khoản của bạn để đăng nhập theo dõi hành trình của con:
      </p>

      <!-- Thông tin đăng nhập -->
      <div class="info-card">
        <div class="info-card-title">🔐 Thông tin đăng nhập</div>
        <div class="info-row">
          <span class="info-label">👦 Học sinh</span>
          <span class="info-value">${studentName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">👤 Tên đăng nhập</span>
          <span class="info-value">${username}</span>
        </div>
        <div class="info-row">
          <span class="info-label">🔑 Mật khẩu</span>
          <span class="info-value password">${password}</span>
        </div>
      </div>

      <!-- Cảnh báo đổi mật khẩu -->
      <div class="warning-box">
        <p>⚠️ <strong>Lưu ý bảo mật:</strong> Hãy đổi mật khẩu ngay sau lần đăng nhập đầu tiên để bảo vệ tài khoản của bạn.</p>
      </div>

      <!-- Nút CTA -->
      <div class="cta-wrap">
        <a href="${loginUrl}" class="cta-btn">🚀 Đi đến trang Web</a>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>Email này được gửi tự động từ hệ thống BusTrack của nhà trường.<br/>
      Nếu bạn nhận nhầm email này, vui lòng bỏ qua hoặc liên hệ
      <a href="mailto:${process.env.GMAIL_USER}">${process.env.GMAIL_USER}</a>.</p>
    </div>

  </div>
</body>
</html>
`;

// ── Hàm chính: Gửi Welcome Email cho phụ huynh ──────────────────────────────
/**
 * Gửi email chào mừng chứa thông tin đăng nhập cho phụ huynh.
 * @param {string} parentEmail   - Địa chỉ Gmail của phụ huynh
 * @param {Object} loginInfo     - { studentName, username, password, loginUrl }
 * @returns {Promise<void>}
 */
const sendWelcomeEmail = async (parentEmail, loginInfo) => {
    const tp = getTransporter();
    if (!tp) return; // Bỏ qua nếu chưa cấu hình — KHÔNG crash app

    const { studentName, username, password, loginUrl = process.env.APP_URL || 'http://localhost:5173' } = loginInfo;

    const mailOptions = {
        from: `"BusTrack — Nhà trường 🚌" <${process.env.GMAIL_USER}>`,
        to: parentEmail,
        subject: `[BusTrack] Tài khoản theo dõi xe buýt cho học sinh ${studentName}`,
        html: buildWelcomeEmailHTML({ studentName, username, password, loginUrl }),
    };

    try {
        const info = await tp.sendMail(mailOptions);
        console.log(`[Email] ✅ Đã gửi welcome email tới ${parentEmail} — messageId: ${info.messageId}`);
    } catch (err) {
        // Ghi log nhưng KHÔNG throw — tránh làm hỏng luồng tạo học sinh
        console.error(`[Email] ❌ Gửi email tới ${parentEmail} thất bại:`, err.message);
    }
};

// ── Template HTML đẹp cho OTP Email ─────────────────────────────────────────
const buildOtpEmailHTML = ({ otp, loginUrl }) => `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Mã xác nhận BusTrack</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', Arial, sans-serif;
      background-color: #f0f4f8;
      color: #1a202c;
      padding: 32px 16px;
    }
    .wrapper {
      max-width: 520px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.10);
    }
    .header {
      background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%);
      padding: 32px;
      text-align: center;
    }
    .header-icon { font-size: 44px; margin-bottom: 10px; }
    .header h1 { color: #fff; font-size: 20px; font-weight: 700; }
    .header p  { color: rgba(255,255,255,0.8); font-size: 13px; margin-top: 4px; }
    .body { padding: 32px; }
    .intro { font-size: 14px; color: #374151; line-height: 1.6; margin-bottom: 24px; }
    /* ── OTP Box ── */
    .otp-box {
      text-align: center;
      background: linear-gradient(135deg, #fdf4ff, #fce7f3);
      border: 2px solid #e879f9;
      border-radius: 16px;
      padding: 28px 24px;
      margin-bottom: 24px;
    }
    .otp-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #9d174d;
      margin-bottom: 12px;
    }
    .otp-code {
      font-size: 44px;
      font-weight: 800;
      letter-spacing: 12px;
      color: #7c3aed;
      font-family: 'Courier New', monospace;
      line-height: 1;
    }
    .otp-expire {
      margin-top: 12px;
      font-size: 12px;
      color: #be185d;
      font-weight: 500;
    }
    /* ── Warning ── */
    .warning-box {
      background: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 12px 16px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 24px;
      font-size: 13px;
      color: #78350f;
      line-height: 1.5;
    }
    /* ── CTA ── */
    .cta-wrap { text-align: center; margin-bottom: 8px; }
    .cta-btn {
      display: inline-block;
      background: linear-gradient(135deg, #7c3aed, #db2777);
      color: #fff !important;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      padding: 13px 32px;
      border-radius: 50px;
      box-shadow: 0 4px 14px rgba(124,58,237,0.35);
    }
    .footer {
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
      padding: 18px 32px;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
      line-height: 1.6;
    }
    .footer a { color: #7c3aed; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">

    <div class="header">
      <div class="header-icon">🔐</div>
      <h1>Khôi phục mật khẩu</h1>
      <p>BusTrack — Hệ thống Xe buýt Trường học</p>
    </div>

    <div class="body">
      <p class="intro">
        Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.
        Vui lòng dùng mã OTP bên dưới để tiếp tục. Nếu bạn không yêu cầu, hãy bỏ qua email này.
      </p>

      <div class="otp-box">
        <div class="otp-label">🔢 Mã xác nhận OTP</div>
        <div class="otp-code">${otp}</div>
        <div class="otp-expire">⏱ Mã có hiệu lực trong <strong>5 phút</strong></div>
      </div>

      <div class="warning-box">
        ⚠️ <strong>Không chia sẻ</strong> mã này với bất kỳ ai, kể cả nhân viên nhà trường. BusTrack sẽ không bao giờ hỏi mã OTP của bạn.
      </div>

      <div class="cta-wrap">
        <a href="${loginUrl}" class="cta-btn">🚀 Đi đến trang đăng nhập</a>
      </div>
    </div>

    <div class="footer">
      <p>Email này được gửi tự động từ hệ thống BusTrack.<br/>
      Liên hệ hỗ trợ: <a href="mailto:${process.env.GMAIL_USER}">${process.env.GMAIL_USER}</a></p>
    </div>

  </div>
</body>
</html>
`;

// ── Hàm gửi OTP Email để khôi phục mật khẩu ─────────────────────────────────
/**
 * Gửi email chứa mã OTP 6 số để khôi phục mật khẩu.
 * @param {string} toEmail  - Địa chỉ email người nhận
 * @param {string} otp      - Mã OTP 6 số
 * @returns {Promise<boolean>} true nếu gửi thành công
 */
const sendOtpEmail = async (toEmail, otp) => {
    const tp = getTransporter();
    if (!tp) {
        console.warn('[Email] Transporter chưa sẵn sàng — không thể gửi OTP email.');
        return false;
    }

    const loginUrl = process.env.APP_URL || 'http://localhost:5173';

    const mailOptions = {
        from: `"BusTrack 🚌" <${process.env.GMAIL_USER}>`,
        to: toEmail,
        subject: `[BusTrack] Mã xác nhận OTP: ${otp}`,
        html: buildOtpEmailHTML({ otp, loginUrl }),
    };

    try {
        const info = await tp.sendMail(mailOptions);
        console.log(`[Email] Đã gửi OTP email tới ${toEmail} — messageId: ${info.messageId}`);
        return true;
    } catch (err) {
        console.error(`[Email] Gửi OTP email tới ${toEmail} thất bại:`, err.message);
        return false;
    }
};

module.exports = { sendWelcomeEmail, sendOtpEmail };

