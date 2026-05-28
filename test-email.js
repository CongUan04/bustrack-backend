const dotenv = require('dotenv');
dotenv.config();
const { sendWelcomeEmail } = require('./services/emailService');

(async () => {
    try {
        await sendWelcomeEmail('ngaongao0044@gmail.com', {
            studentName: 'Test Student',
            username: '0123456789',
            password: 'password123',
            loginUrl: 'http://localhost:5173'
        });
        console.log('✅ Success!');
    } catch (e) {
        console.error('❌ Error:', e.message);
    }
})();
