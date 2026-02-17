
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto-js';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import * as xlsx from 'xlsx';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const loginSessions: Record<string, { token: string; user: any }> = {};

// BigInt Serialization Helper
const toSafeJson = (obj: any) => {
    return JSON.parse(JSON.stringify(obj, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
    ));
};


app.use(cors());
app.use(express.json());

// Detailed Request Logging
app.use((req, res, next) => {
    console.log(`[AUTH] ${req.method} ${req.url} - Body keys: ${Object.keys(req.body)}`);
    next();
});

// Validation Schema
const LoginSchema = z.object({
    id: z.number(),
    first_name: z.string(),
    username: z.string().optional(),
    language_code: z.string().optional(),
});

const ADMIN_IDS = [1032563269];

// Mock Login Route (Simulates Telegram Auth)
app.post('/auth/login', async (req: any, res: any) => {
    try {
        const userData = LoginSchema.parse(req.body);
        const userId = BigInt(userData.id);

        let user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    id: userId,
                    firstName: userData.first_name,
                    username: userData.username,
                    language: userData.language_code,
                    role: ADMIN_IDS.includes(Number(userId)) ? 'admin' : 'user'
                }
            });
            console.log(`New user registered: ${user.firstName} (Role: ${user.role})`);
        } else {
            console.log(`User logged in: ${user.firstName}`);
        }

        res.json(toSafeJson({
            success: true,
            user: user,
            token: "mock-jwt-token"
        }));

    } catch (error) {
        console.error('Login error:', error);
        res.status(400).json({ success: false, message: 'Invalid data' });
    }
});

// Telegram Validation Helper
const verifyTelegramWebAppData = (telegramInitData: string): boolean => {
    const initData = new URLSearchParams(telegramInitData);
    const hash = initData.get('hash');
    const dataToCheck: string[] = [];

    initData.sort();
    initData.forEach((val, key) => {
        if (key !== 'hash') {
            dataToCheck.push(`${key}=${val}`);
        }
    });

    const secretKey = crypto.HmacSHA256(process.env.TELEGRAM_BOT_TOKEN!, "WebAppData");
    const _hash = crypto.HmacSHA256(dataToCheck.join('\n'), secretKey).toString(crypto.enc.Hex);

    return _hash === hash;
};

// Telegram Auth Route
app.post('/auth/telegram', async (req: any, res: any) => {
    try {
        const { initData } = req.body;

        if (!initData) {
            return res.status(400).json({ success: false, message: 'Missing initData' });
        }

        if (!process.env.TELEGRAM_BOT_TOKEN) {
            console.error("TELEGRAM_BOT_TOKEN is missing in .env");
            return res.status(500).json({ success: false, message: 'Server configuration error' });
        }

        const isValid = verifyTelegramWebAppData(initData);

        if (!isValid) {
            return res.status(403).json({ success: false, message: 'Invalid Telegram data' });
        }

        // Parse user data from initData
        const urlParams = new URLSearchParams(initData);
        const userStr = urlParams.get('user');

        if (!userStr) {
            return res.status(400).json({ success: false, message: 'Missing user data in initData' });
        }

        const telegramUser = JSON.parse(userStr);
        const userId = BigInt(telegramUser.id);

        // Register or Login
        let user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    id: userId,
                    firstName: telegramUser.first_name,
                    username: telegramUser.username,
                    photoUrl: telegramUser.photo_url,
                    language: telegramUser.language_code,
                    role: ADMIN_IDS.includes(telegramUser.id) ? 'admin' : 'user'
                }
            });
            console.log(`New Telegram user registered: ${user.firstName} (Role: ${user.role})`);
        } else {
            // Sync potentially changed data
            user = await prisma.user.update({
                where: { id: userId },
                data: {
                    username: telegramUser.username,
                    photoUrl: telegramUser.photo_url,
                    language: telegramUser.language_code,
                    // Ensure initial admin stays admin
                    role: ADMIN_IDS.includes(telegramUser.id) ? 'admin' : user.role
                }
            });
            console.log(`Telegram user logged in: ${user.firstName} (Role: ${user.role})`);
        }

        const userJson = JSON.parse(JSON.stringify(user, (key, value) =>
            typeof value === 'bigint' ? Number(value) : value
        ));

        res.json({
            success: true,
            user: userJson,
            token: "mock-jwt-token-telegram"
        });
    } catch (e: any) {
        console.error("Telegram Auth Error:", e);
        res.status(500).json({ success: false, message: 'Internal Server Error', error: e.toString() });
    }
});

// Helper to update ratings and balance
async function updateUserStats(winnerId?: bigint, loserId?: bigint, isDraw?: boolean, p1Id?: bigint, p2Id?: bigint) {
    if (isDraw && p1Id && p2Id) {
        await prisma.user.updateMany({
            where: { id: { in: [p1Id, p2Id] } },
            data: {
                rating: { increment: 1 },
                balance: { increment: 5 }
            }
        });
        return;
    }

    if (winnerId) {
        await prisma.user.update({
            where: { id: winnerId },
            data: {
                wins: { increment: 1 },
                rating: { increment: 5 },
                balance: { increment: 50 }
            }
        });
    }

    if (loserId) {
        const loser = await prisma.user.findUnique({ where: { id: loserId } });
        if (loser) {
            const newRating = Math.max(0, (loser.rating || 1000) - 5);
            await prisma.user.update({
                where: { id: loserId },
                data: {
                    losses: { increment: 1 },
                    rating: { set: newRating }
                }
            });
        }
    }
}

// Update Game Results
app.post('/auth/results', async (req: any, res: any) => {
    const { winnerId, loserId, isDraw, player1Id, player2Id } = req.body;
    try {
        await updateUserStats(
            winnerId ? BigInt(winnerId) : undefined,
            loserId ? BigInt(loserId) : undefined,
            isDraw,
            player1Id ? BigInt(player1Id) : undefined,
            player2Id ? BigInt(player2Id) : undefined
        );
        res.json({ success: true });
    } catch (e) {
        console.error("Error updating results:", e);
        res.status(500).json({ success: false });
    }
});

// Get User Rank
app.get('/auth/rank/:id', async (req: any, res: any) => {
    try {
        const userId = BigInt(req.params.id);
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user || !user.grade) {
            return res.json({ success: true, rank: 0, grade: 0, rating: user?.rating || 0 });
        }

        // Count users with SAME grade and HIGHER rating
        const count = await prisma.user.count({
            where: {
                grade: user.grade,
                rating: { gt: user.rating }
            }
        });

        // Rank is count + 1
        const rank = count + 1;

        console.log(`Rank for user ${user.firstName} (Grade ${user.grade}, Rating ${user.rating}): ${rank}`);

        res.json({ success: true, rank, grade: user.grade, rating: user.rating });

    } catch (e) {
        console.error("Error fetching rank:", e);
        res.status(500).json({ success: false, error: String(e) });
    }
});

app.get('/auth/profile/:id', async (req: any, res: any) => {
    try {
        const userId = BigInt(req.params.id);
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (user) {
            const userJson = JSON.parse(JSON.stringify(user, (key, value) =>
                typeof value === 'bigint' ? Number(value) : value
            ));
            res.json({ success: true, user: userJson });
        } else {
            res.status(404).json({ success: false, message: "User not found" });
        }
    } catch (e) {
        res.status(404).json({ success: false, message: "User not found" });
    }
});

// --- Admin Specific Endpoints ---

// List all users
app.get('/auth/admin/users', async (req: any, res: any) => {
    const allUsers = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    const usersJson = JSON.parse(JSON.stringify(allUsers, (key, value) =>
        typeof value === 'bigint' ? Number(value) : value
    ));
    res.json({ success: true, users: usersJson });
});

// Delete user
app.delete('/auth/admin/users/:id', async (req: any, res: any) => {
    const userId = BigInt(req.params.id);
    try {
        await prisma.user.delete({ where: { id: userId } });
        console.log(`Admin deleted user: ${userId}`);
        res.json({ success: true });
    } catch (e) {
        res.status(404).json({ success: false, message: "User not found" });
    }
});

// Update user (stats or role)
app.patch('/auth/admin/users/:id', async (req: any, res: any) => {
    const userId = BigInt(req.params.id);
    const updates = req.body;

    // Remove immutable DB fields if present
    delete updates.id;
    delete updates.createdAt;
    delete updates.updatedAt;

    // Map frontend camelCase to Prisma field names if needed (e.g. first_name -> firstName)
    if (updates.first_name) {
        updates.firstName = updates.first_name;
        delete updates.first_name;
    }

    try {
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updates
        });
        console.log(`Admin updated user ${userId}:`, updates);

        const userJson = JSON.parse(JSON.stringify(updatedUser, (key, value) =>
            typeof value === 'bigint' ? Number(value) : value
        ));
        res.json({ success: true, user: userJson });
    } catch (e) {
        res.status(404).json({ success: false, message: "User not found" });
    }
});

// Update user grade
app.post('/auth/update-grade', async (req: any, res: any) => {
    const { userId, grade } = req.body;

    if (!userId || grade === undefined) {
        return res.status(400).json({ success: false, message: 'Missing userId or grade' });
    }

    const uId = BigInt(userId);

    try {
        const user = await prisma.user.update({
            where: { id: uId },
            data: { grade: Number(grade) }
        });

        console.log(`User ${user.firstName} updated grade to ${grade}`);
        const userJson = JSON.parse(JSON.stringify(user, (key, value) =>
            typeof value === 'bigint' ? Number(value) : value
        ));
        res.json({ success: true, user: userJson });
    } catch (e) {
        res.status(404).json({ success: false, message: 'User not found' });
    }
});

// Update Profile (Name)
app.post('/auth/update-profile', async (req: any, res: any) => {
    const { userId, name } = req.body;

    if (!userId || !name) {
        return res.status(400).json({ success: false, message: 'Missing userId or name' });
    }

    const uId = BigInt(userId);

    try {
        const user = await prisma.user.update({
            where: { id: uId },
            data: { firstName: name }
        });

        console.log(`User ${userId} updated name to ${name}`);
        const userJson = JSON.parse(JSON.stringify(user, (key, value) =>
            typeof value === 'bigint' ? Number(value) : value
        ));
        res.json({ success: true, user: userJson });
    } catch (e) {
        res.status(404).json({ success: false, message: 'User not found' });
    }
});

// --- Leaderboard & Async Challenges ---

// Global Leaderboard
app.get('/auth/leaderboard', async (req: any, res: any) => {
    const { grade } = req.query;
    try {
        const where: any = {};
        if (grade) where.grade = parseInt(grade as string);

        const users = await prisma.user.findMany({
            where,
            orderBy: { rating: 'desc' },
            take: 100
        });

        const usersJson = JSON.parse(JSON.stringify(users, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));

        res.json({ success: true, users: usersJson });
    } catch (e) {
        res.status(500).json({ success: false, error: String(e) });
    }
});

// Initiate Async Challenge
app.post('/auth/async/challenge/initiate', async (req: any, res: any) => {
    const { challengerId, targetUserId, subjectId, questions } = req.body;
    try {
        const challenge = await prisma.asyncChallenge.create({
            data: {
                challengerId: BigInt(challengerId),
                targetUserId: BigInt(targetUserId),
                subjectId: parseInt(subjectId),
                questions: questions,
                status: 'pending'
            }
        });

        // Create notification for target user
        const challenger = await prisma.user.findUnique({ where: { id: BigInt(challengerId) } });
        await prisma.notification.create({
            data: {
                userId: BigInt(targetUserId),
                type: 'challenge_received',
                message: `${challenger?.firstName || 'Kimdir'} sizni bellashuvga chorladi!`,
                data: { challengeId: challenge.id, challengerName: challenger?.firstName }
            }
        });

        console.log(`[AUTH DEBUG] Async Challenge Initiated: ID=${challenge.id}, Challenger=${challengerId}, Target=${targetUserId}`);
        res.json(toSafeJson({ success: true, challengeId: challenge.id }));
    } catch (e) {
        console.error("Async challenge initiation error:", e);
        res.status(500).json({ success: false, error: String(e) });
    }
});

// Get Async Challenge Details
app.get('/auth/async/challenge/:challengeId', async (req: any, res: any) => {
    try {
        const challenge = await prisma.asyncChallenge.findUnique({
            where: { id: req.params.challengeId }
        });

        console.log(`[AUTH DEBUG] GET Challenge: ID=${req.params.challengeId}, Found=${!!challenge}`);
        if (challenge) {
            console.log(`[AUTH DEBUG] Challenge Details: ChallengerID=${challenge.challengerId}, TargetID=${challenge.targetUserId}, ChallengerScore=${challenge.challengerScore}, TargetScore=${challenge.targetScore}, Status=${challenge.status}`);
        }

        if (!challenge) return res.status(404).json({ success: false, message: 'Challenge not found' });

        // Manually fetch challenger info instead of using include (avoid schema relations for now)
        const challenger = await prisma.user.findUnique({
            where: { id: challenge.challengerId },
            select: { id: true, firstName: true, photoUrl: true }
        });

        res.json(toSafeJson({
            success: true,
            challenge: {
                ...challenge,
                challenger: challenger || { firstName: 'Foydalanuvchi' }
            }
        }));
    } catch (e) {
        console.error("Error fetching challenge:", e);
        res.status(500).json({ success: false, error: String(e) });
    }
});

// Submit Async Result
app.post('/auth/async/challenge/submit', async (req: any, res: any) => {
    const { challengeId, userId, score, time } = req.body;
    try {
        const challenge = await prisma.asyncChallenge.findUnique({ where: { id: challengeId } });
        if (!challenge) return res.status(404).json({ error: 'Challenge not found' });

        const uId = BigInt(userId);
        let updateData: any = {};
        if (uId === challenge.challengerId) {
            updateData = { challengerScore: score, challengerTime: time };
            console.log(`[AUTH DEBUG] User is CHALLENGER. Updating challenger data.`);
        } else if (uId === challenge.targetUserId) {
            updateData = { targetScore: score, targetTime: time };
            console.log(`[AUTH DEBUG] User is TARGET. Updating target data.`);
        } else {
            console.log(`[AUTH DEBUG] User ID ${userId} does not match Challenger (${challenge.challengerId}) or Target (${challenge.targetUserId})`);
        }

        const updatedChallenge = await prisma.asyncChallenge.update({
            where: { id: challengeId },
            data: updateData
        });

        console.log(`[AUTH DEBUG] Async Result Submitted: ChallengeID=${challengeId}, UserID=${userId}, Score=${score}, Time=${time}`);
        // Check completion
        if (updatedChallenge.challengerScore !== null && updatedChallenge.targetScore !== null) {
            console.log(`[AUTH DEBUG] Async Challenge COMPLETED: ID=${challengeId}. Settling...`);
            const settlement = await settleAsyncChallenge(updatedChallenge);
            return res.json(toSafeJson({
                success: true,
                settled: true,
                winnerId: settlement.winnerId,
                isDraw: settlement.isDraw
            }));
        }

        res.json({ success: true, settled: false });
    } catch (e) {
        console.error("Async result submission error:", e);
        res.status(500).json({ success: false, error: String(e) });
    }
});

// Mark Async Challenge as Viewed & Cleanup
app.post('/auth/async/challenge/viewed', async (req: any, res: any) => {
    const { challengeId, userId } = req.body;
    try {
        const challenge = await prisma.asyncChallenge.findUnique({ where: { id: challengeId } });
        if (!challenge) return res.status(404).json({ error: 'Challenge not found' });

        const uId = BigInt(userId);
        let updateData: any = {};

        // Determine which flag to update
        if (uId === challenge.challengerId) updateData.challengerViewed = true;
        else if (uId === challenge.targetUserId) updateData.targetViewed = true;

        const updated = await prisma.asyncChallenge.update({
            where: { id: challengeId },
            data: updateData
        });

        console.log(`[AUTH DEBUG] Challenge Viewed: ID=${challengeId} by User=${userId}. Challenger=${updated.challengerViewed}, Target=${updated.targetViewed}`);

        // Cleanup if both have viewed
        if (updated.challengerViewed && updated.targetViewed) {
            console.log(`[AUTH DEBUG] Async Challenge Cleanup: ID=${challengeId}. Deleting...`);
            await prisma.asyncChallenge.delete({ where: { id: challengeId } });
        }

        res.json(toSafeJson({ success: true }));
    } catch (e) {
        console.error("Viewed update error:", e);
        res.status(500).json({ success: false, error: String(e) });
    }
});

async function settleAsyncChallenge(challenge: any) {
    const cId = challenge.challengerId;
    const tId = challenge.targetUserId;

    let winnerId: bigint | undefined;
    let loserId: bigint | undefined;
    let isDraw = false;

    if (challenge.challengerScore > challenge.targetScore) {
        winnerId = cId; loserId = tId;
    } else if (challenge.targetScore > challenge.challengerScore) {
        winnerId = tId; loserId = cId;
    } else {
        if (challenge.challengerTime < challenge.targetTime) {
            winnerId = cId; loserId = tId;
        } else if (challenge.targetTime < challenge.challengerTime) {
            winnerId = tId; loserId = cId;
        } else {
            isDraw = true;
        }
    }

    await prisma.asyncChallenge.update({
        where: { id: challenge.id },
        data: { status: 'completed' }
    });

    console.log(`[AUTH DEBUG] Settling Challenge ${challenge.id}. Winner: ${winnerId}, IsDraw: ${isDraw}`);
    await updateUserStats(winnerId, loserId, isDraw, cId, tId);

    // Create notifications for both
    const msg = isDraw ? "Oflayn bellashuv durang bilan tugadi!" : "Oflayn bellashuv natijalari tayyor!";
    await prisma.notification.createMany({
        data: [
            { userId: cId, type: 'challenge_completed', message: msg, data: { challengeId: challenge.id } },
            { userId: tId, type: 'challenge_completed', message: msg, data: { challengeId: challenge.id } }
        ]
    });

    return { winnerId, isDraw };
}

// Notifications
app.get('/auth/notifications/:userId', async (req: any, res: any) => {
    try {
        const userId = BigInt(req.params.userId);
        const notifications = await prisma.notification.findMany({
            where: { userId, isRead: false },
            orderBy: { createdAt: 'desc' }
        });
        res.json(toSafeJson({ success: true, notifications }));
    } catch (e) {
        res.status(500).json({ success: false, error: String(e) });
    }
});

app.post('/auth/notifications/read', async (req: any, res: any) => {
    const { notificationIds } = req.body;
    try {
        await prisma.notification.updateMany({
            where: { id: { in: notificationIds } },
            data: { isRead: true }
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

// --- Subject & Question Management ---

// Get allowed subjects for a grade
app.get('/auth/subjects/allowed', async (req: any, res: any) => {
    const { grade } = req.query;
    if (!grade) return res.status(400).json({ success: false, message: 'Grade required' });

    try {
        const config = await prisma.gradeConfig.findUnique({
            where: { grade: parseInt(grade) }
        });

        if (!config || !config.allowedSubjectCodes.length) {
            return res.json({ success: true, subjects: [] });
        }

        // Robust Case-Insensitive Matching
        // 1. Normalize allowed codes from config
        const allowedCodesLc = config.allowedSubjectCodes.map((c: string) => c.toLowerCase().trim());

        // 2. Fetch all subjects (dataset is small enough)
        const allSubjects = await prisma.subject.findMany();

        // 3. Filter in memory
        const subjects = allSubjects.filter((s: any) => allowedCodesLc.includes(s.code.toLowerCase().trim()));

        const safeSubjects = subjects.map((s: any) => ({ ...s, id: Number(s.id) }));
        res.json({ success: true, subjects: safeSubjects });
    } catch (e) {
        console.error("Error fetching subjects:", e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Check question availability
app.get('/auth/questions/count', async (req: any, res: any) => {
    const { grade, subjectId } = req.query;
    const sId = parseInt(subjectId);
    const grd = parseInt(grade);

    console.log(`[GET /questions/count] Request: Grade=${grade}, Subject=${subjectId}`);

    try {
        const count = await prisma.question.count({
            where: {
                subjectId: sId,
                OR: [
                    { difficulty: grd },
                    { allowedGrades: { has: grd } }
                ]
            }
        });
        res.json({ success: true, count });
    } catch (e) {
        console.error("Error checking question count:", e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get random questions for game
app.get('/auth/questions/random', async (req: any, res: any) => {
    const { grade, subjectId, count } = req.query;
    const limit = parseInt(count) || 10;
    const sId = parseInt(subjectId);
    const grd = parseInt(grade);

    console.log(`[GET /questions/random] Request: Grade=${grade}, Subject=${subjectId}, Limit=${limit}`);

    try {
        // Optimization: Use raw query for random sampling if improved performance needed
        // For MVP, fetch all matching constraints and pick random JS side if dataset is small
        // OR usage of raw SQL "ORDER BY RANDOM()"

        // 1. Fetch available questions
        const questions = await prisma.question.findMany({
            where: {
                subjectId: sId,
                OR: [
                    { difficulty: grd },
                    { allowedGrades: { has: grd } }
                ]
            },
            take: 50 // Fetch pool
        });

        console.log(`[GET /questions/random] Found ${questions.length} questions matching Grade=${grd} and Subject=${sId}`);

        // 2. Shuffle and slice
        const shuffled = questions.sort(() => 0.5 - Math.random()).slice(0, limit);

        const safeQuestions = shuffled.map((q: any) => {

            // Handle Multiple Answers (comma separated)
            // Stored answer might be "0" or "A,B" or "Toshkent,Tashkent"
            const rawAnswer = q.answer.toString();
            let correctIndices: number[] = [];

            if (q.options && q.options.length > 0) {
                // It's an MCQ (or manual options)
                // Split by comma if multiple
                const parts = rawAnswer.split(',').map((s: string) => s.trim());

                parts.forEach((part: string) => {
                    const p = part.trim();
                    const pLower = p.toLowerCase();

                    // 1. Try matching by Option Value (Case Insensitive)
                    // This handles "1441" matching option "1441" (index 0) instead of index 1441
                    const valIdx = q.options.findIndex((opt: string) => String(opt).trim().toLowerCase() === pLower);
                    if (valIdx !== -1) {
                        correctIndices.push(valIdx);
                        return;
                    }

                    // 2. Try A/B/C/D Mapping
                    const letterMap: Record<string, number> = { 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
                    if (letterMap[pLower] !== undefined) {
                        correctIndices.push(letterMap[pLower]);
                        return;
                    }

                    // 3. Try as Explicit Index
                    // Only if it's a valid index range for the options provided
                    if (!isNaN(Number(p))) {
                        const idx = Number(p);
                        if (idx >= 0 && idx < q.options.length) {
                            correctIndices.push(idx);
                        }
                    }
                });
            } else {
                // Numeric answer (Math) or Open Text
                // For now, if no options, we assume it's Math/Numeric
                if (!isNaN(Number(rawAnswer))) {
                    correctIndices.push(Number(rawAnswer));
                }
            }

            // If only one answer, return number for backward compatibility (if possible)
            // BUT implementation plan says we switch to array support or resilient check.
            // Let's return ARRAY 'a' everywhere to be consistent? 
            // OR return 'a' as number if single, array if multiple?
            // Existing frontend expects 'a' to be number.
            // We should return rawAnswer string or parsed structure.
            // To minimize breakage, let's use a new field 'answers' and keep 'a' as first valid index or 0.

            const primaryAnswer = correctIndices.length > 0 ? correctIndices[0] : 0;

            return {
                ...q,
                id: Number(q.id),
                subjectId: Number(q.subjectId),
                q: q.text,
                a: primaryAnswer, // Deprecated single answer
                answers: correctIndices, // NEW: Full list of correct indices
                options: q.options || [],
                type: (q.options && q.options.length > 0) ? 'custom' : 'generated'
            };
        });

        res.json({ success: true, questions: safeQuestions });

    } catch (e) {
        console.error("Error fetching questions:", e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// --- Admin Endpoints ---

// --- Admin Endpoints ---

// Create/Update Grade Config
app.post('/auth/admin/grade-config', async (req: any, res: any) => {
    const { grade, subjects } = req.body;
    try {
        const config = await prisma.gradeConfig.upsert({
            where: { grade: parseInt(grade) },
            update: { allowedSubjectCodes: subjects },
            create: { grade: parseInt(grade), allowedSubjectCodes: subjects }
        });
        res.json({ success: true, config: { ...config, id: Number(config.id) } });
    } catch (e) {
        res.status(500).json({ success: false, error: e });
    }
});

// Create Subject
app.post('/auth/admin/subjects', async (req: any, res: any) => {
    const { name, code } = req.body;
    try {
        const normalizedCode = code.toLowerCase().trim();
        const subject = await prisma.subject.create({
            data: { name, code: normalizedCode }
        });
        res.json({ success: true, subject: { ...subject, id: Number(subject.id) } });
    } catch (e) {
        res.status(500).json({ success: false, error: e });
    }
});

// Get All Subjects
app.get('/auth/admin/subjects', async (req: any, res: any) => {
    try {
        const subjects = await prisma.subject.findMany();
        const safeSubjects = subjects.map((s: any) => ({ ...s, id: Number(s.id) }));
        res.json({ success: true, subjects: safeSubjects });
    } catch (e: any) {
        console.error("Admin Subjects Error:", e);
        res.status(500).json({ success: false, error: e.toString() });
    }
});


// Create Question (Manual)
app.post('/auth/admin/questions', async (req: any, res: any) => {
    const { q, a, subjectId, difficulty, options, allowedGrades } = req.body;

    if (!q || !a || !subjectId) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    try {
        const question = await prisma.question.create({
            data: {
                text: q,
                answer: String(a), // Store as string (e.g. "0" or "A,B")
                subjectId: Number(subjectId),
                difficulty: Number(difficulty) || 1,
                options: options || [],
                allowedGrades: allowedGrades || []
            }
        });
        res.json({ success: true, question: { ...question, id: Number(question.id) } });
    } catch (e) {
        console.error("Create Question Error:", e);
        res.status(500).json({ success: false, error: String(e) });
    }
});

// List All Questions (Admin)
app.get('/auth/admin/questions', async (req: any, res: any) => {
    try {
        const questions = await prisma.question.findMany({ orderBy: { id: 'desc' } });
        const safeQuestions = questions.map((q: any) => ({
            ...q,
            id: Number(q.id),
            subjectId: Number(q.subjectId),
            q: q.text, // Map Prisma 'text' to frontend 'q'
            allowedGrades: q.allowedGrades || [q.difficulty],
            a: Number(q.answer) || 0, // Legacy support
            answer: q.answer, // RAW value for display
            options: q.options || []
        }));
        res.json({ success: true, questions: safeQuestions });
    } catch (e) {
        res.status(500).json({ success: false, error: String(e) });
    }
});

// Update Question (Admin)
app.put('/auth/admin/questions/:id', async (req: any, res: any) => {
    const { id } = req.params;
    const { q, answer, options, subjectId, difficulty, allowedGrades } = req.body;

    try {
        const question = await prisma.question.update({
            where: { id: parseInt(id) },
            data: {
                text: q,
                answer: String(answer),
                options: options || [],
                subjectId: subjectId ? parseInt(subjectId) : undefined,
                difficulty: difficulty ? parseInt(difficulty) : undefined,
                allowedGrades: allowedGrades || undefined
            }
        });

        res.json({
            success: true,
            question: {
                ...question,
                id: Number(question.id),
                subjectId: Number(question.subjectId),
                q: question.text
            }
        });
    } catch (e) {
        res.status(404).json({ success: false, message: 'Question not found' });
    }
});

// Delete Question (Admin)
app.delete('/auth/admin/questions/:id', async (req: any, res: any) => {
    const { id } = req.params;
    try {
        await prisma.question.delete({
            where: { id: parseInt(id) }
        });
        res.json({ success: true, message: 'Question deleted' });
    } catch (e) {
        res.status(404).json({ success: false, message: 'Question not found' });
    }
});

// Bulk Delete Questions (Admin)
app.post('/auth/admin/questions/bulk-delete', async (req: any, res: any) => {
    const { ids } = req.body; // Expecting array of numbers
    if (!Array.isArray(ids)) return res.status(400).json({ success: false, message: 'Invalid IDs' });

    try {
        await prisma.question.deleteMany({
            where: { id: { in: ids.map((id: any) => parseInt(id)) } }
        });
        res.json({ success: true, message: `${ids.length} ta savol o'chirildi` });
    } catch (e) {
        res.status(500).json({ success: false, error: String(e) });
    }
});


// Configure Multer
const upload = multer({ storage: multer.memoryStorage() });

// Bulk Upload Questions (Excel)
app.post('/auth/admin/upload-questions', upload.single('file'), async (req: any, res: any) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    try {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data: any[] = xlsx.utils.sheet_to_json(sheet);

        console.log(`Processing ${data.length} rows from Excel...`);
        let count = 0;
        let errors = 0;
        let errorDetails: { row: number, error: string }[] = [];

        // xlsx.utils.sheet_to_json(sheet) starts from row 2 (data), but header is row 1.
        // So index 0 of data corresponds to row 2 in Excel.
        data.forEach((row, index) => {
            const excelRowNumber = index + 2;

            // Normalize keys to handle case/spaces
            const normalizedRow = Object.keys(row).reduce((acc: any, key) => {
                acc[key.trim().toLowerCase()] = row[key];
                return acc;
            }, {});

            const qText = normalizedRow['question'] || normalizedRow['savol'];
            const ans = normalizedRow['answer'] || normalizedRow['javob'];
            const subCode = normalizedRow['subjectcode'] || normalizedRow['subject'] || normalizedRow['fan'];
            const diffRaw = normalizedRow['difficulty'] || normalizedRow['grade'] || normalizedRow['sinf'];

            if (!qText) {
                errorDetails.push({ row: excelRowNumber, error: "Savol matni (question) yetishmayapti" });
                errors++;
                return;
            }
            if (!ans) {
                errorDetails.push({ row: excelRowNumber, error: "Javob (answer) yetishmayapti" });
                errors++;
                return;
            }
            if (!subCode) {
                errorDetails.push({ row: excelRowNumber, error: "Fan kodi (subject) yetishmayapti" });
                errors++;
                return;
            }

            // Parse Grade (support "6-11", "6+", "6,7,8")
            let difficulty = 1;
            let allowedGrades: number[] = [];
            const diffStr = String(diffRaw || '1').trim();

            if (diffStr.includes('-')) {
                const [start, end] = diffStr.split('-').map(Number);
                if (!isNaN(start) && !isNaN(end)) {
                    difficulty = start;
                    for (let i = start; i <= end; i++) allowedGrades.push(i);
                }
            } else if (diffStr.includes('+')) {
                const start = parseInt(diffStr);
                if (!isNaN(start)) {
                    difficulty = start;
                    for (let i = start; i <= 11; i++) allowedGrades.push(i);
                }
            } else if (diffStr.includes(',')) {
                allowedGrades = diffStr.split(',').map(Number).filter(n => !isNaN(n));
                if (allowedGrades.length > 0) difficulty = Math.min(...allowedGrades);
            } else {
                difficulty = Number(diffStr) || 1;
                allowedGrades = [difficulty];
            }

            // Options
            const optA = row['OptionA'] || row['A'] || row['a'];
            const optB = row['OptionB'] || row['B'] || row['b'];
            const optC = row['OptionC'] || row['C'] || row['c'];
            const optD = row['OptionD'] || row['D'] || row['d'];

            let options: string[] = [];
            const rawOptions = [optA, optB, optC, optD].filter(o => o !== undefined && o !== null && String(o).trim() !== '');
            if (rawOptions.length >= 2) {
                options = rawOptions.map(o => String(o));
            }

            // Actually forEach + async is tricky. Let's revert to for...of for safety with await.
            // NO-OP: Emptying this block as it's followed by a proper for...of loop
        });

        // Re-implementing as for...of for proper await support
        count = 0;
        errors = 0;
        errorDetails = [];
        let rowIndex = 0;
        for (const row of data) {
            const excelRowNumber = rowIndex + 2;
            rowIndex++;

            const normalizedRow = Object.keys(row).reduce((acc: any, key) => {
                acc[key.trim().toLowerCase()] = row[key];
                return acc;
            }, {});

            // Detect Question Text - often the first column has no header in user files
            let qText = normalizedRow['question'] || normalizedRow['savol'] || normalizedRow['__empty'];
            if (!qText) {
                // If still not found, check any key that looks like a question or is the first key
                const keys = Object.keys(normalizedRow);
                if (keys.length > 0 && !normalizedRow['a'] && !normalizedRow['b']) {
                    qText = normalizedRow[keys[0]];
                }
            }

            const rawAns = normalizedRow['answer'] || normalizedRow['javob'];
            const subCode = normalizedRow['subjectcode'] || normalizedRow['subject'] || normalizedRow['fan'];
            const diffRaw = normalizedRow['difficulty'] || normalizedRow['grade'] || normalizedRow['sinf'];

            // Pick up Options
            const optA = normalizedRow['optiona'] || normalizedRow['a'];
            const optB = normalizedRow['optionb'] || normalizedRow['b'];
            const optC = normalizedRow['optionc'] || normalizedRow['c'];
            const optD = normalizedRow['optiond'] || normalizedRow['d'];

            let options: string[] = [];
            const rawOptions = [optA, optB, optC, optD].filter(o => o !== undefined && o !== null && String(o).trim() !== '');
            if (rawOptions.length >= 2) options = rawOptions.map(o => String(o));

            // Map Answer from Letter (A, B, C, D) to value
            let ans = rawAns;
            if (String(ans).length === 1 && /^[a-dA-D]$/.test(String(ans))) {
                const letter = String(ans).toLowerCase();
                if (letter === 'a' && optA) ans = optA;
                else if (letter === 'b' && optB) ans = optB;
                else if (letter === 'c' && optC) ans = optC;
                else if (letter === 'd' && optD) ans = optD;
            }

            if (!qText || !ans || !subCode) {
                let missing = [];
                if (!qText) missing.push("savol");
                if (!ans) missing.push("javob");
                if (!subCode) missing.push("fan");
                errorDetails.push({ row: excelRowNumber, error: `Ma'lumot yetarli emas: ${missing.join(", ")}` });
                errors++;
                continue;
            }

            // Find subject: try code first, then name
            let subject = await prisma.subject.findUnique({ where: { code: String(subCode).toLowerCase() } });
            if (!subject) {
                subject = await prisma.subject.findFirst({
                    where: {
                        name: { equals: String(subCode), mode: 'insensitive' }
                    }
                });
            }

            if (!subject) {
                errorDetails.push({ row: excelRowNumber, error: `Fan topilmadi: "${subCode}"` });
                errors++;
                continue;
            }

            // Parse Grade logic
            let difficulty = 1;
            let allowedGrades: number[] = [];
            const diffStr = String(diffRaw || '1').trim().replace(/\s+/g, ' '); // Normalize spaces

            if (diffStr.includes('-')) {
                const parts = diffStr.split('-').map(s => parseInt(s.trim()));
                const start = parts[0];
                const end = parts[1];
                if (!isNaN(start) && !isNaN(end)) {
                    difficulty = start;
                    for (let i = start; i <= end; i++) allowedGrades.push(i);
                }
            } else if (diffStr.includes('+')) {
                const start = parseInt(diffStr);
                if (!isNaN(start)) {
                    difficulty = start;
                    for (let i = start; i <= 11; i++) allowedGrades.push(i);
                }
            } else if (diffStr.includes(',') || diffStr.includes(' ')) {
                // Support both comma-separated "3, 4" and space-separated "3 4"
                const separator = diffStr.includes(',') ? ',' : ' ';
                allowedGrades = diffStr.split(separator).map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                if (allowedGrades.length > 0) difficulty = Math.min(...allowedGrades);
            } else {
                difficulty = Number(diffStr) || 1;
                allowedGrades = [difficulty];
            }

            try {
                await prisma.question.create({
                    data: {
                        text: String(qText),
                        answer: String(ans),
                        options: options,
                        subjectId: Number(subject.id),
                        difficulty: difficulty,
                        allowedGrades: allowedGrades
                    }
                });
                count++;
            } catch (err) {
                errorDetails.push({ row: excelRowNumber, error: "Bazaga yozishda xatolik" });
                errors++;
            }
        }

        res.json({ success: true, imported: count, errors, errorDetails });
    } catch (e) {
        console.error("Upload error:", e);
        res.status(500).json({ success: false, message: 'Upload failed' });
    }
});



// Web Login: Bot calls this to authenticated session
app.post('/auth/telegram-login', async (req: any, res: any) => {
    const { sessionId, user } = req.body;
    if (!sessionId || !user) return res.status(400).json({ success: false });

    try {
        // Find or create user
        let dbUser = await prisma.user.findUnique({ where: { id: BigInt(user.id) } });

        if (!dbUser) {
            dbUser = await prisma.user.create({
                data: {
                    id: BigInt(user.id),
                    firstName: user.first_name,
                    username: user.username,
                    photoUrl: user.photo_url,
                    language: user.language_code
                }
            });
        }

        // Generate Token
        const token = jwt.sign(
            { id: String(dbUser.id), username: dbUser.username },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '7d' }
        );

        // Store session using safe JSON
        loginSessions[sessionId] = {
            token,
            user: toSafeJson(dbUser)
        };

        // Auto-expire after 5 minutes
        setTimeout(() => delete loginSessions[sessionId], 300000);

        res.json({ success: true });
    } catch (e) {
        console.error("Telegram Login Error:", e);
        res.status(500).json({ success: false, error: String(e) });
    }
});

// Web Login: Frontend polls this
app.get('/auth/check-login', async (req: any, res: any) => {
    const { sessionId } = req.query;
    if (!sessionId || !loginSessions[sessionId]) {
        return res.json({ success: false });
    }

    const session = loginSessions[sessionId];
    delete loginSessions[sessionId]; // One-time use

    res.json({ success: true, token: session.token, user: session.user });
});

// Verify Token Endpoint
app.get('/auth/me', async (req: any, res: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        const userId = BigInt(decoded.id);

        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json(toSafeJson({ success: true, user: user }));
    } catch (error) {
        console.error("Token verification failed:", error);
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
});

const PORT = 3001;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Auth Service running on port ${PORT}`);
});
