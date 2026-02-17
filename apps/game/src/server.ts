import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { QueueManager } from './managers/QueueManager';
import { GameManager } from './managers/GameManager';
import { QuestionManager } from './managers/QuestionManager';
import { ChallengeManager } from './managers/ChallengeManager';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Managers
const queueManager = new QueueManager();
const gameManager = new GameManager();
const questionManager = new QuestionManager();
const challengeManager = new ChallengeManager();

// --- Matchmaking & Queue ---

app.post('/game/find_match', async (req, res) => {
    try {
        const { user, socketId } = req.body;
        if (!user || !user.grade || !socketId) return res.status(400).json({ error: 'Missing data' });

        // 1. Check if match available
        const match = await queueManager.findMatch(user.grade, user.subjectId, socketId, user.id);

        if (match) {
            // Create Game
            const questions = await questionManager.getRandomQuestions(10, user.grade, user.subjectId);
            const { roomId, game } = gameManager.createGame(user, match.user, questions);

            // Return match data
            // For the polling client (Me/Player2)
            return res.json({ status: 'matched', roomId, game, yourRole: 'player1' });
        } else {
            // Check if I am already in a game (e.g. matched by someone else while I polled)
            // Or if I just created one.
            const allGames = gameManager.getAllGames();
            const existingGame = allGames.find(g =>
                (String(g.player1.id) === String(user.id) || String(g.player2.id) === String(user.id)) &&
                g.status !== 'finished'
            );

            if (existingGame) {
                const yourRole = String(existingGame.player1.id) === String(user.id) ? 'player1' : 'player2';

                // Check for multi-login hijack attempt
                const currentSocketId = yourRole === 'player1' ? existingGame.p1SocketId : existingGame.p2SocketId;
                const lastSeen = yourRole === 'player1' ? existingGame.player1.lastSeen : existingGame.player2.lastSeen;
                const now = Date.now();

                // If socket is different AND user was seen recently (< 30s), BLOCK IT
                if (currentSocketId && currentSocketId !== socketId && lastSeen && (now - lastSeen < 30000)) {
                    return res.status(403).json({ error: 'Account active on another device' });
                }

                // Update socket if needed (rejoin after crash/refresh)
                if (yourRole === 'player1') existingGame.p1SocketId = socketId;
                else existingGame.p2SocketId = socketId;

                return res.json({ status: 'matched', roomId: existingGame.id, game: existingGame, yourRole });
            } else {
                // Add to queue
                await queueManager.addToQueue(user, socketId);
                return res.json({ status: 'waiting' });
            }
        }
    } catch (error: any) {
        console.error('[GAME SERVICE] Find Match Error:', error);
        res.status(500).json({
            success: false,
            message: 'Matchmaking process failed',
            error: error.message
        });
    }
});

app.post('/game/leave', async (req, res) => {
    const { socketId, roomId } = req.body;
    await queueManager.removeFromQueue(socketId);
    if (roomId) await gameManager.forfeit(roomId, socketId);
    res.json({ success: true });
});

app.post('/game/submit', async (req, res) => {
    const { roomId, userId, isCorrect, questionIndex, answerValue, timeTaken, socketId } = req.body;
    const game = await gameManager.submitAnswer(roomId, userId, isCorrect, questionIndex, answerValue !== undefined ? answerValue : "REST_API", timeTaken, socketId);
    if (game) {
        res.json({
            success: true,
            update: true,
            game,
            gameOver: game.status === 'finished',
            winner: game.winner,
            state: { ropePosition: game.ropePosition }
        });
    } else {
        res.status(404).json({ error: 'Game not found or finished' });
    }
});

// --- Challenge System ---

app.get('/game/online-users', (req, res) => {
    const { grade, userId } = req.query;
    const users = challengeManager.getOnlineUsers(Number(grade), String(userId));
    res.json({ success: true, users });
});

app.post('/game/challenge', (req, res) => {
    const { fromUser, toUserId } = req.body;
    const target = challengeManager.getUser(String(toUserId));
    if (!target) return res.status(404).json({ error: 'User offline' });
    res.json({ success: true, targetSocketId: target.socketId });
});

app.post('/game/challenge/respond', async (req, res) => {
    const { fromUserId, toUserId, response, socketId } = req.body;

    if (response === 'reject') {
        const sender = challengeManager.getUser(String(fromUserId));
        if (sender) return res.json({ success: true, action: 'notify_reject', targetSocketId: sender.socketId });
        return res.json({ success: true, action: 'none' });
    }

    if (response === 'accept') {
        const sender = challengeManager.getUser(String(fromUserId));
        const acceptor = challengeManager.getUser(String(toUserId));

        if (!sender || !acceptor) return res.status(400).json({ error: 'Player offline' });

        const questions = await questionManager.getRandomQuestions(10, sender.grade);
        const { roomId, game } = gameManager.createGame(
            { ...sender, socketId: sender.socketId },
            { ...acceptor, socketId: socketId },
            questions
        );

        return res.json({
            success: true,
            action: 'start_game',
            roomId,
            game,
            p1SocketId: sender.socketId,
            p2SocketId: socketId
        });
    }
    res.status(400).json({ error: 'Invalid response' });
});

// --- Maintenance ---

app.post('/game/heartbeat', async (req, res) => {
    const { socketId, user } = req.body;
    if (socketId) {
        await queueManager.updateHeartbeat(socketId);
        gameManager.updateHeartbeat(socketId);
        challengeManager.updateHeartbeat(socketId, user);
    }
    res.json({ success: true });
});

// Admin Questions
app.get('/game/questions', (req, res) => res.json(questionManager.getAll()));
app.post('/game/questions', (req, res) => {
    const { q, a } = req.body;
    questionManager.add(q, a);
    res.json({ success: true });
});
app.delete('/game/questions/:id', (req, res) => {
    questionManager.delete(req.params.id);
    res.json({ success: true });
});

// Reconnect Endpoint
app.post('/game/reconnect', (req, res) => {
    const { roomId, userId, socketId } = req.body;
    gameManager.reconnect(roomId, userId, socketId);
    res.json({ success: true });
});

// Cleanup Loop
setInterval(async () => {
    const now = Date.now();
    await queueManager.cleanup(now);
    await gameManager.cleanup(now);
    challengeManager.cleanup(now);
}, 10000);

const PORT = 3002;
app.listen(PORT, () => {
    console.log(`Game Service (SOLID) running on port ${PORT}`);
});
