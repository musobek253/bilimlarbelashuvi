import { GameState, Player, Question } from '../types';
import axios from 'axios';

export class GameManager {
    private games = new Map<string, GameState>();
    private AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
    private HEARTBEAT_TIMEOUT = 120000;

    createGame(player1: any, player2: any, questions: Question[]): { roomId: string, game: GameState } {
        const roomId = Math.random().toString(36).substring(7);
        const game: GameState = {
            id: roomId,
            player1: { ...player1, score: 0, answeredCount: 0, correctCount: 0, lastSeen: Date.now() },
            player2: { ...player2, score: 0, answeredCount: 0, correctCount: 0, lastSeen: Date.now() },
            p1SocketId: player1.socketId,
            p2SocketId: player2.socketId,
            status: 'playing',
            questions: questions,
            currentQuestionIndex: 0,
            ropePosition: 50,
            winner: null,
            startTime: Date.now(),
            playerAnswers: { player1: [], player2: [] },
            playerInputValues: { player1: [], player2: [] },
            playerTimes: { player1: [], player2: [] },
            stats: { player1: { score: 0, answeredCount: 0, correctCount: 0 }, player2: { score: 0, answeredCount: 0, correctCount: 0 } }
        };
        this.games.set(roomId, game);
        return { roomId, game };
    }

    private startBotLogic(roomId: string, role: 'player1' | 'player2') {
        const interval = setInterval(async () => {
            const game = this.games.get(roomId);
            if (!game || game.status !== 'playing') {
                clearInterval(interval);
                return;
            }

            const player = role === 'player1' ? game.player1 : game.player2;

            if (player.answeredCount < game.questions.length) {
                if (Math.random() > 0.3) {
                    const isCorrect = Math.random() > 0.2;
                    // Bot answers don't strictly need value stored, or we can fake it. Passing null/mock for now.
                    await this.submitAnswer(roomId, Number(player.id), isCorrect, player.answeredCount, isCorrect ? 'CORRECT' : 'WRONG');
                    console.log(`Bot (${role}) answered question ${player.answeredCount}. Correct: ${isCorrect}`);
                }
            } else {
                clearInterval(interval);
            }
        }, 4000);
    }

    getGame(roomId: string): GameState | undefined {
        return this.games.get(roomId);
    }

    getAllGames(): GameState[] {
        return Array.from(this.games.values());
    }

    async submitAnswer(roomId: string, userId: number, isCorrect: boolean, questionIndex: number, answerValue: string | number, timeTaken?: number, socketId?: string) {
        try {
            console.log(`[DEBUG] submitAnswer: Room=${roomId}, User=${userId}, Index=${questionIndex}, Val=${answerValue}, Socket=${socketId}`);

            const game = this.games.get(roomId);
            if (!game || game.status !== 'playing') {
                console.warn(`[DEBUG] Game not found or finished: ${roomId}`);
                return null;
            }

            const role = String(game.player1.id) === String(userId) ? 'player1' :
                String(game.player2.id) === String(userId) ? 'player2' : null;

            if (!role) {
                console.warn(`[DEBUG] User ${userId} not in room ${roomId}`);
                return null;
            }

            // Verify Socket ID if provided (Security against multi-login)
            if (socketId) {
                const registeredSocket = role === 'player1' ? game.p1SocketId : game.p2SocketId;
                if (registeredSocket && registeredSocket !== socketId) {
                    console.warn(`[Security Warning] Socket Mismatch: User=${userId}, Expected=${registeredSocket}, Got=${socketId}. Allowing for stability.`);
                }
            }

            // 1. Validate Question Index
            const expectedIndex = role === 'player1' ? game.player1.answeredCount : game.player2.answeredCount;

            // Allow re-submission of the CURRENT question (e.g. if network failed but server didn't get it first time)
            // OR submission of the NEXT question.
            if (questionIndex > expectedIndex) {
                console.warn(`[Security] Index Skip Attempt: User=${userId}, Expected=${expectedIndex}, Got=${questionIndex}. Returning sync.`);
                return game;
            }

            // 2. Determine Correctness Server-Side
            let serverCalculatedIsCorrect = false;
            const question = game.questions[questionIndex];

            if (question) {
                if (question.answers && question.answers.length > 0) {
                    // Multi-choice
                    const ansInt = parseInt(String(answerValue));
                    if (!isNaN(ansInt)) {
                        serverCalculatedIsCorrect = question.answers.includes(ansInt);
                    } else if (question.answers.includes(Number(answerValue))) {
                        serverCalculatedIsCorrect = true;
                    }
                } else {
                    // Numeric/Direct
                    serverCalculatedIsCorrect = String(answerValue).trim() === String(question.a).trim();
                }
            } else {
                console.error(`[Error] Question not found at index ${questionIndex}`);
                return null;
            }

            console.log(`[DEBUG] Validation: User=${userId}, Q=${questionIndex}, Val=${answerValue}, ServerCorrect=${serverCalculatedIsCorrect}`);

            const points = serverCalculatedIsCorrect ? 10 : -5;

            // Check if already answered to prevent double counting/scoring
            // If questionIndex < expectedIndex, it's a past question. Ignore scoring, just return game.
            if (questionIndex < expectedIndex) {
                console.log(`[DEBUG] Ignoring duplicate/past answer: Index=${questionIndex}, Expected=${expectedIndex}`);
                return game;
            }

            // Update Stats based on Server Calculation
            if (role === 'player1') {
                game.player1.score += points;
                game.player1.answeredCount++;
                if (serverCalculatedIsCorrect) game.player1.correctCount++;
                game.stats.player1.score = game.player1.score;
                game.stats.player1.answeredCount = game.player1.answeredCount;
                game.stats.player1.correctCount = game.player1.correctCount;
            } else {
                game.player2.score += points;
                game.player2.answeredCount++;
                if (serverCalculatedIsCorrect) game.player2.correctCount++;
                game.stats.player2.score = game.player2.score;
                game.stats.player2.answeredCount = game.player2.answeredCount;
                game.stats.player2.correctCount = game.player2.correctCount;
            }

            console.log(`[DEBUG] Stats Updated: User=${userId}, NewCount=${role === 'player1' ? game.player1.answeredCount : game.player2.answeredCount}`);

            // Move rope based on SERVER calculation
            const ropeChange = serverCalculatedIsCorrect ? (role === 'player1' ? -5 : 5) : (role === 'player1' ? 5 : -5);
            game.ropePosition = Math.max(0, Math.min(100, game.ropePosition + ropeChange));

            // Record Answer Details
            if (typeof questionIndex === 'number') {
                game.playerAnswers[role][questionIndex] = serverCalculatedIsCorrect;
                // Initialize array if needed
                if (!game.playerInputValues) game.playerInputValues = { player1: [], player2: [] };
                game.playerInputValues[role][questionIndex] = answerValue;
                if (!game.playerTimes) game.playerTimes = { player1: [], player2: [] };
                game.playerTimes[role][questionIndex] = timeTaken || 0;
            } else {
                // Should not happen with index logic
                game.playerAnswers[role].push(serverCalculatedIsCorrect);
            }

            // Record finish time
            if (game.player1.answeredCount >= game.questions.length && !game.player1.finishedTime) {
                game.player1.finishedTime = Date.now();
            }
            if (game.player2.answeredCount >= game.questions.length && !game.player2.finishedTime) {
                game.player2.finishedTime = Date.now();
            }

            // Check for finish
            const p1Finished = game.player1.answeredCount >= game.questions.length;
            const p2Finished = game.player2.answeredCount >= game.questions.length;

            if (p1Finished && p2Finished) {
                await this.finishGame(game);
            }

            return game;

        } catch (error) {
            console.error(`[CRITICAL] submitAnswer Crash:`, error);
            // Return existing game if possible to prevent client hang!
            const game = this.games.get(roomId);
            if (game) return game;
            return null;
        }
    }

    async forfeit(roomId: string, droppedSocketId: string) {
        const game = this.games.get(roomId);
        if (!game || game.status !== 'playing') return;

        console.log(`Forfeit triggered in room ${roomId}`);
        game.status = 'finished';

        if (game.p1SocketId === droppedSocketId) {
            game.winner = String(game.player2.id);
        } else {
            game.winner = String(game.player1.id);
        }
        await this.reportResults(game);
    }

    async finishGame(game: GameState) {
        console.log(`Game Finished: ${game.id}`);
        game.status = 'finished';

        if (game.player1.score > game.player2.score) {
            game.winner = String(game.player1.id);
        } else if (game.player2.score > game.player1.score) {
            game.winner = String(game.player2.id);
        } else {
            game.winner = 'draw';
        }

        await this.reportResults(game);
    }

    async reportResults(game: GameState) {
        try {
            console.log("Reporting results for game:", game.id);
            // Mock API call to Auth Service
            // Call Auth Service
            await axios.post(`${this.AUTH_SERVICE_URL}/auth/results`, {
                player1Id: game.player1.id,
                player2Id: game.player2.id,
                winnerId: game.winner,
                loserId: game.winner ? (game.player1.id === Number(game.winner) ? game.player2.id : game.player1.id) : null,
                isDraw: !game.winner,
                p1Score: game.player1.score,
                p2Score: game.player2.score
            });
        } catch (error) {
            console.error('Failed to report results:', error);
        }
    }

    // 1.5 Reconnect Logic
    reconnect(roomId: string, userId: string, socketId: string) {
        const game = this.games.get(roomId);
        if (!game) return;

        console.log(`Reconnecting User ${userId} to Room ${roomId} with Socket ${socketId}`);

        if (String(game.player1.id) === String(userId)) {
            game.p1SocketId = socketId;
            game.player1.lastSeen = Date.now();
        } else if (String(game.player2.id) === String(userId)) {
            game.p2SocketId = socketId;
            game.player2.lastSeen = Date.now();
        }
    }

    updateHeartbeat(socketId: string) {
        for (const game of this.games.values()) {
            if (game.status === 'playing') {
                if (game.p1SocketId === socketId) game.player1.lastSeen = Date.now();
                if (game.p2SocketId === socketId) game.player2.lastSeen = Date.now();
            }
        }
    }

    async cleanup(now: number) {
        for (const [roomId, game] of this.games.entries()) {
            if (game.status === 'playing') {
                // Timeout check (e.g. 60s inactivity)
                // For now relying on forfeits or explicit finish
            }
        }
    }
}
