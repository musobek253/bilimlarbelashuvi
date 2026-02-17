
import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import proxy from 'express-http-proxy';
import path from 'path';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Barcha manbalarga ruxsat (dev uchun)
        methods: ["GET", "POST"]
    }
});

// Xizmatlar URL manzillari (Docker'siz localhost)
// Ishlab chiqarish muhitida bular xizmat nomlari yoki env o'zgaruvchilar bo'ladi
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const GAME_SERVICE_URL = process.env.GAME_SERVICE_URL || 'http://localhost:3002';

// Frontend statik fayllarini tarqatish
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDistPath));

// --- HTTP Proksi ---
// MUHIM: Proksilarni express.json() dan OLDIN qo'yish kerak,
// aks holda POST body'lari yo'qoladi.

app.use('/auth', proxy(AUTH_SERVICE_URL, {
    proxyReqPathResolver: (req) => {
        return `/auth${req.url}`;
    },
    proxyErrorHandler: (err, res, next) => {
        console.error('[GATEWAY] Auth Proxy Error:', err);
        res.status(500).json({ success: false, message: 'Auth service unreachable', error: err.message });
    }
}));

app.use('/game', proxy(GAME_SERVICE_URL, {
    proxyReqPathResolver: (req) => {
        return `/game${req.url}`;
    },
    proxyErrorHandler: (err, res, next) => {
        console.error(`[GATEWAY] Game Proxy Error [${res.req.method} ${res.req.url}]:`, err.message);
        res.status(500).json({
            success: false,
            message: 'Game service unreachable',
            error: err.message,
            path: res.req.url
        });
    }
}));

app.use(express.json());


// --- Gateway Hodisalari ---

io.on('connection', (socket: Socket) => {
    console.log('Foydalanuvchi ulandi:', socket.id);


    // 1.5 Socketni qayta ulash (Xonaga qaytish)
    // 1.5 Socketni qayta ulash (Xonaga qaytish)
    socket.on('reconnect_socket', async (data: { roomId: string, userId?: string }) => {
        console.log(`Foydalanuvchi ${socket.id} xonaga qaytmoqda ${data.roomId}, User=${data.userId}`);
        socket.join(data.roomId);

        if (data.userId) {
            try {
                await axios.post(`${GAME_SERVICE_URL}/game/reconnect`, {
                    roomId: data.roomId,
                    userId: data.userId,
                    socketId: socket.id
                });
            } catch (e) {
                console.error("Reconnect notify error:", e);
            }
        }
    });

    // 2. Raqib topish (Tasodifiy raqib)
    socket.on('find_match', async (data: { user: any }) => {
        try {
            console.log(`Foydalanuvchi ${socket.id} raqib qidirmoqda...`);
            const response = await axios.post(`${GAME_SERVICE_URL}/game/find_match`, {
                socketId: socket.id,
                user: data.user
            });

            if (response.data.status === 'matched') {
                const { roomId, opponentSocketId, game } = response.data;

                // IKKALA o'yinchini o'z rolllari haqida xabardor qilish
                // 1. Joriy socket (Men) -> U Player 2 bo'ladi, chunki u Player 1 ga qo'shildi
                socket.join(roomId);
                socket.emit('match_found', { roomId, game, yourRole: 'player2' });

                // 2. Raqibni xabardor qilish (kutayotgan o'yinchi) -> U Player 1 bo'ladi
                const opponentSocket = io.sockets.sockets.get(opponentSocketId);
                if (opponentSocket) {
                    opponentSocket.join(roomId);
                    opponentSocket.emit('match_found', { roomId, game, yourRole: 'player1' });
                } else {
                    console.error('Raqib socketi topilmadi (uzilib qolgan bo\'lishi mumkin)');
                    socket.emit('error', { message: 'Raqib aloqani uzdi' });
                }

            } else {
                // Kutish
                socket.emit('match_waiting', { message: 'Raqib qidirilmoqda...' });
            }

        } catch (error) {
            console.error('Raqib topishda xatolik:', error);
            socket.emit('error', { message: 'Raqib topib bo\'lmadi' });
        }
    });

    // 2. Javob yuborish
    socket.on('submit_answer', async (data: { roomId: string, isCorrect: boolean, userId: string, socketId?: string, questionIndex?: number, answerValue?: string | number, timeTaken?: number }) => {
        console.log(`Gateway javob qabul qildi: Xona=${data.roomId}, User=${data.userId}, To'g'ri=${data.isCorrect}, Index=${data.questionIndex}, Val=${data.answerValue}`);

        // MUHIM TUZATISH: Socket xonada ekanligiga ishonch hosil qilish.
        console.log(`Socket ${socket.id} rooms BEFORE join:`, socket.rooms);
        socket.join(data.roomId);

        try {
            // Javobni Game servisiga yo'naltirish
            // FIX: Pass ALL data including questionIndex and answerValue
            const payload = {
                socketId: data.socketId || socket.id,
                roomId: data.roomId,
                isCorrect: data.isCorrect,
                userId: data.userId,
                questionIndex: data.questionIndex,
                answerValue: data.answerValue,
                timeTaken: data.timeTaken
            };

            const response = await axios.post(`${GAME_SERVICE_URL}/game/submit`, payload);

            if (response.data.update) {
                console.log(`game_update xonaga yuborilmoqda ${data.roomId}. Socket in room?`, socket.rooms.has(data.roomId));
                // Statistika yangilanishi uchun to'liq o'yin holatini yuborish
                io.to(data.roomId).emit('game_update', response.data.game);
                // Animatsiya uchun arqon holatini saqlash
                io.to(data.roomId).emit('rope_update', { ropePosition: response.data.state.ropePosition });
            }

            if (response.data.gameOver) {
                io.to(data.roomId).emit('game_over', response.data.winner);
            }

        } catch (error) {
            console.error('Javob yuborishda xatolik:', error);
        }
    });

    // 3. Yurak urishi (Aloqa signali)
    socket.on('heartbeat', async (data: { user?: any }) => {
        try {
            await axios.post(`${GAME_SERVICE_URL}/game/heartbeat`, { socketId: socket.id, user: data?.user });
        } catch (e) {
            // Heartbeat xatolarini e'tiborsiz qoldirish
        }
    });

    // 4. Bellashuv Tizimi
    socket.on('send_challenge', async (data: { fromUser: any, toUserId: number }) => {
        try {
            const response = await axios.post(`${GAME_SERVICE_URL}/game/challenge`, {
                fromUser: data.fromUser,
                toUserId: data.toUserId
            });

            if (response.data.success) {
                const targetSocketId = response.data.targetSocketId;
                io.to(targetSocketId).emit('challenge_received', { fromUser: data.fromUser });
            }
        } catch (e) {
            console.error('Challenge xatosi:', e);
            socket.emit('error', { message: 'Taklif yuborib bo\'lmadi' });
        }
    });

    socket.on('respond_challenge', async (data: { fromUserId: number, toUserId: number, response: 'accept' | 'reject' }) => {
        try {
            const res = await axios.post(`${GAME_SERVICE_URL}/game/challenge/respond`, {
                fromUserId: data.fromUserId,
                toUserId: data.toUserId,
                response: data.response,
                socketId: socket.id
            });

            const { action, targetSocketId, roomId, game, p1SocketId, p2SocketId } = res.data;

            if (action === 'notify_reject') {
                io.to(targetSocketId).emit('challenge_rejected', { message: 'Taklif rad etildi' });
            } else if (action === 'start_game') {
                // P1 ni xabardor qilish (Yuboruvchi)
                io.to(p1SocketId).emit('match_found', { roomId, game, yourRole: 'player1' });
                // P2 ni xabardor qilish (Qabul qiluvchi)
                io.to(p2SocketId).emit('match_found', { roomId, game, yourRole: 'player2' });
            }
        } catch (e) {
            console.error('Challenge javob xatosi:', e);
        }
    });

    socket.on('disconnect', async () => {
        console.log('Foydalanuvchi uzildi:', socket.id);
        // Uzilganda navbatdan yoki faol o'yindan tozalash
        try {
            const response = await axios.post(`${GAME_SERVICE_URL}/game/leave`, { socketId: socket.id });
            if (response.data.update) {
                const { roomId, game } = response.data;
                console.log(`Forfeit yangilanishi xonaga yuborilmoqda ${roomId}`);
                io.to(roomId).emit('game_update', game);
            }
        } catch (e) {
            console.error("Uzilish vaqtida xatolik:", e);
        }
    });
});

// SPA uchun qayta yo'naltirish: Boshqa barcha marshrutlar uchun index.html ni uzatish
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Gateway Service ishga tushdi: port ${PORT}`);
});

