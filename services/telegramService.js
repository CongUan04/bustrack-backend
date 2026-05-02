// services/telegramService.js
// Quản lý toàn bộ logic liên quan đến Telegram Bot

const TelegramBot = require('node-telegram-bot-api');

let bot = null; // Singleton instance

/**
 * Khởi tạo Bot với token từ biến môi trường.
 * Gọi hàm này 1 lần duy nhất trong server.js.
 * Dùng chế độ 'polling' để nhận tin nhắn từ người dùng (vd: /start).
 */
const initBot = () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
        console.warn('[Telegram] ⚠️  TELEGRAM_BOT_TOKEN chưa được đặt trong .env — Bot sẽ không hoạt động.');
        return;
    }

    try {
        // polling: true → Bot tự động lắng nghe tin nhắn đến (không cần webhook)
        bot = new TelegramBot(token, { polling: true });

        // ── Lắng nghe lệnh /start từ Phụ huynh ─────────────────────────────
        // Khi phụ huynh nhắn /start, bot trả về Chat ID để họ biết và sao chép
        bot.onText(/\/start/, async (msg) => {
            const chatId = msg.chat.id;
            const firstName = msg.from.first_name || 'Bạn';

            const welcomeMsg =
                `👋 Xin chào *${firstName}*! Chào mừng đến với hệ thống thông báo xe buýt trường học.\n\n` +
                `📋 *Chat ID* của bạn là:\n\`${chatId}\`\n\n` +
                `👉 Hãy sao chép mã này và cung cấp cho nhà trường để kích hoạt nhận thông báo điểm danh cho con bạn.`;

            await bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'Markdown' });
            console.log(`[Telegram] /start nhận từ chatId=${chatId}, user=${firstName}`);
        });

        // ── (Tùy chọn) Lắng nghe lệnh /mychatid ───────────────────────────
        bot.onText(/\/mychatid/, async (msg) => {
            const chatId = msg.chat.id;
            await bot.sendMessage(chatId, `🆔 Chat ID của bạn là: \`${chatId}\``, { parse_mode: 'Markdown' });
        });

        bot.on('polling_error', (error) => {
            // 401 = token sai; 409 = nhiều instance đang polling cùng lúc
            console.error(`[Telegram] Polling error: ${error.code} — ${error.message}`);
        });

        console.log('[Telegram] ✅ Bot đã khởi động và đang polling...');
    } catch (err) {
        console.error('[Telegram] ❌ Không thể khởi tạo Bot:', err.message);
    }
};

/**
 * Gửi tin nhắn văn bản tới một Chat ID cụ thể.
 * @param {string|number} telegramChatId  - Chat ID của phụ huynh
 * @param {string}        message         - Nội dung tin nhắn (hỗ trợ Markdown)
 * @returns {Promise<void>}
 */
const sendMessageToParent = async (telegramChatId, message) => {
    if (!bot) {
        console.warn('[Telegram] Bot chưa được khởi tạo — bỏ qua việc gửi tin nhắn.');
        return;
    }
    if (!telegramChatId) {
        console.warn('[Telegram] telegramChatId bị null/undefined — bỏ qua.');
        return;
    }

    try {
        await bot.sendMessage(String(telegramChatId), message, { parse_mode: 'Markdown' });
        console.log(`[Telegram] ✉️  Đã gửi tới chatId=${telegramChatId}`);
    } catch (err) {
        // Ghi log nhưng KHÔNG throw — tránh làm crash luồng chính điểm danh
        console.error(`[Telegram] Lỗi gửi tin tới chatId=${telegramChatId}:`, err.message);
    }
};

/**
 * Trả về instance bot hiện tại (dùng khi cần truy cập trực tiếp).
 * @returns {TelegramBot|null}
 */
const getBot = () => bot;

module.exports = { initBot, sendMessageToParent, getBot };
