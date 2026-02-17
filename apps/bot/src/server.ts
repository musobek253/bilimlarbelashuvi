import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from auth app (centralized)
dotenv.config({ path: path.join(__dirname, '../../auth/.env') });

const token = process.env.TELEGRAM_BOT_TOKEN;
const WEB_APP_URL = process.env.GAME_URL || 'https://22-maktab.uz';

if (!token) {
    console.error('TELEGRAM_BOT_TOKEN topilmadi!');
    process.exit(1);
}

const bot = new Telegraf(token);

bot.start(async (ctx) => {
    const payload = ctx.payload; // "login_xyz" if exists

    if (payload && payload.startsWith('login_')) {
        const sessionId = payload.replace('login_', '');
        const user = ctx.from;

        try {
            // Notify Auth Service
            await fetch(`${process.env.AUTH_SERVICE_URL || 'http://auth:3001'}/auth/telegram-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, user })
            });
            ctx.reply(`✅ Muvaffaqiyatli kirdingiz!\n\nBrauzerga qaytishingiz mumkin.`);
        } catch (e) {
            console.error('Login Error:', e);
            ctx.reply('❌ Tizimga kirishda xatolik yuz berdi via Bot.');
        }
        return;
    }

    const firstName = ctx.from.first_name;
    const message = `Assalomu alaykum, ${firstName}! 🌟\n\nBotga xush kelibsiz! Bu o'yinda siz o'z bilimingizni sinab ko'rishingiz va do'stlaringiz bilan bellashishingiz mumkin.\n\nO'yinni boshlash uchun pastdagi **"O'yinni Boshlash"** tugmasini bosing.`;

    ctx.reply(message, Markup.inlineKeyboard([
        [Markup.button.webApp('O\'yinni Boshlash 🚀', WEB_APP_URL)]
    ]));
});

bot.launch()
    .then(() => {
        console.log('✅ Telegram Bot ishga tushdi!');
        console.log(`📱 Bot username: @${bot.botInfo?.username}`);
        console.log(`🌐 Web App URL: ${WEB_APP_URL}`);
    })
    .catch((error) => {
        console.error('❌ Bot ishga tushmadi:');
        console.error('Xato:', error.message);
        console.error('Token:', token?.substring(0, 10) + '...');
        process.exit(1);
    });

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
