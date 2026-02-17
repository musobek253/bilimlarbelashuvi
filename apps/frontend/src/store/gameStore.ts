
import { create } from 'zustand';
import { socket } from '../services/socket';

interface Player {
    id: number;
    name: string;
    avatar?: string;
}

interface Question {
    id?: string;
    q: string;
    a: number;
    answers?: number[]; // NEW
    options?: string[];
    type?: 'custom' | 'generated';
    subjectId?: number;
    difficulty?: number;
    allowedGrades?: number[];
    answer?: string | number; // Raw answer for display
}

// PlayerStats interface removed as it was unused and caused build error

interface UserProfile {
    id: number;
    username?: string;
    firstName: string;
    photoUrl?: string;
    wins: number;
    losses: number;
    rating: number;
    balance: number;
    grade: number | null;
    rank?: number; // NEW
    role?: 'user' | 'admin';
}

interface GameState {
    roomId: string | null;
    players: {
        me: Player | null;
        opponent: Player | null;
    };
    profile: UserProfile | null;
    ropePosition: number; // 0-100
    status: 'idle' | 'searching' | 'waiting' | 'playing' | 'finished' | 'timeout';
    winner: string | null;
    questions: Question[];
    stats: {
        player1: { answeredCount: number; score: number; correctCount: number };
        player2: { answeredCount: number; score: number; correctCount: number };
    };
    playerAnswers: {
        player1: boolean[];
        player2: boolean[];
    };
    playerInputValues: {
        player1: (string | number)[];
        player2: (string | number)[];
    };
    playerTimes: {
        player1: number[];
        player2: number[];
    };
    error: string | null;
    leaderboard: UserProfile[];
    notifications: any[];
    activeAsyncChallengeId: string | null;
    isAsyncMode: boolean;
    isLeaderboardView: boolean;
    isInitializing: boolean;

    // Actions
    setMe: (player: Player) => void;
    login: (initDataRaw: string) => Promise<void>;
    loginWithToken: (token: string, user: UserProfile) => void;
    checkAuth: () => Promise<void>; // New action
    setGrade: (grade: number) => Promise<void>;
    joinRoom: (roomId: string) => void;
    findMatch: (subjectId?: number) => void;
    createRoom: () => Promise<string>;
    submitAnswer: (isCorrect: boolean, questionIndex?: number, answerValue?: string | number, timeTaken?: number) => void;
    resetGame: () => void;
    yourRole: 'player1' | 'player2' | null;
    loading: boolean;
    initializeListeners: () => void;
    cleanupListeners: () => void;
    refreshProfile: () => Promise<void>;
    updateProfile: (name: string) => Promise<void>;
    fetchRank: () => Promise<void>; // NEW

    // Admin Actions
    isAdminView: boolean;
    adminUsers: any[];
    setAdminView: (view: boolean) => void;
    fetchAdminUsers: () => Promise<void>;
    adminUpdateUser: (userId: number, updates: any) => Promise<void>;
    adminDeleteUser: (userId: number) => Promise<void>;

    // Question Actions
    adminQuestions: Question[];
    fetchAdminQuestions: () => Promise<void>;
    adminAddQuestion: (data: any) => Promise<void>;
    adminUpdateQuestion: (id: string, data: any) => Promise<void>;
    adminDeleteQuestion: (id: string) => Promise<void>;
    adminBulkDeleteQuestions: (ids: string[]) => Promise<void>;

    // Leaderboard & Async Actions
    fetchLeaderboard: (grade?: number) => Promise<void>;
    fetchNotifications: () => Promise<void>;
    markNotificationsRead: (ids: string[]) => Promise<void>;
    initiateAsyncChallenge: (targetUserId: number, subjectId: number) => Promise<void>;
    joinAsyncChallenge: (challengeId: string) => Promise<void>;
    markChallengeAsViewed: (challengeId: string) => Promise<void>;
    setLeaderboardView: (view: boolean) => void;

    // Subject Actions
    adminSubjects: any[];
    fetchAdminSubjects: () => Promise<void>;
    adminCreateSubject: (name: string, code: string) => Promise<void>;

    // Config Actions
    adminGetGradeConfig: (grade: number) => Promise<string[]>;
    adminUpdateGradeConfig: (grade: number, subjects: string[]) => Promise<void>;

    // Upload
    adminUploadQuestions: (file: File) => Promise<any>;

    // Challenge System
    onlineUsers: { id: number, name: string, grade: number }[];
    incomingChallenge: { id: number, name: string, grade: number } | null;
    fetchOnlineUsers: () => Promise<void>;
    sendChallenge: (toUserId: number) => void;
    respondChallenge: (fromUserId: number, response: 'accept' | 'reject') => void;
}

export const useGameStore = create<GameState>((set, get) => ({
    roomId: null,
    players: {
        me: null,
        opponent: null
    },
    profile: null,
    ropePosition: 50,
    status: 'idle',
    winner: null,
    questions: [],
    stats: {
        player1: { answeredCount: 0, score: 0, correctCount: 0 },
        player2: { answeredCount: 0, score: 0, correctCount: 0 }
    },
    playerAnswers: {
        player1: [],
        player2: []
    },
    playerInputValues: {
        player1: [],
        player2: []
    },
    playerTimes: {
        player1: [],
        player2: []
    },
    error: null,
    leaderboard: [],
    notifications: [],
    activeAsyncChallengeId: null,
    isAsyncMode: false,
    isLeaderboardView: false,
    isInitializing: true,
    yourRole: null,
    loading: false,
    isAdminView: localStorage.getItem('isAdminView') === 'true',
    adminUsers: [],
    adminQuestions: [],
    adminSubjects: [],
    onlineUsers: [],
    incomingChallenge: null,

    setMe: (player) => set((state) => ({ players: { ...state.players, me: player } })),

    setLeaderboardView: (view) => set({ isLeaderboardView: view }),

    setAdminView: (view) => {
        localStorage.setItem('isAdminView', String(view));
        set({ isAdminView: view });
    },

    fetchAdminUsers: async () => {
        const BACKEND_URL = window.location.origin;
        try {
            const res = await fetch(`${BACKEND_URL}/auth/admin/users`);
            const data = await res.json();
            if (data.success) {
                set({ adminUsers: data.users });
            }
        } catch (error) {
            console.error("Fetch users error:", error);
        }
    },

    adminUpdateUser: async (userId, updates) => {
        const BACKEND_URL = window.location.origin;
        try {
            const res = await fetch(`${BACKEND_URL}/auth/admin/users/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            const data = await res.json();
            if (data.success) {
                await get().fetchAdminUsers(); // Refresh list
            }
        } catch (error) {
            console.error("Update user error:", error);
        }
    },

    adminDeleteUser: async (userId) => {
        const BACKEND_URL = window.location.origin;
        if (!confirm("Haqiqatdan ham ushbu foydalanuvchini o'chirmoqchimisiz?")) return;
        try {
            const res = await fetch(`${BACKEND_URL}/auth/admin/users/${userId}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                await get().fetchAdminUsers(); // Refresh list
            }
        } catch (error) {
            console.error("Delete user error:", error);
        }
    },

    fetchAdminQuestions: async () => {
        const BACKEND_URL = window.location.origin;
        try {
            const res = await fetch(`${BACKEND_URL}/auth/admin/questions`);
            const data = await res.json();
            if (data.success && Array.isArray(data.questions)) {
                set({ adminQuestions: data.questions });
            } else {
                set({ adminQuestions: [] });
            }
        } catch (error) {
            console.error('Failed to fetch questions:', error);
        }
    },

    adminAddQuestion: async (data: any) => {
        const BACKEND_URL = window.location.origin;
        try {
            await fetch(`${BACKEND_URL}/auth/admin/questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            await get().fetchAdminQuestions();
        } catch (error) {
            console.error('Failed to add question:', error);
        }
    },

    adminUpdateQuestion: async (id: string, data: any) => {
        const BACKEND_URL = window.location.origin;
        try {
            await fetch(`${BACKEND_URL}/auth/admin/questions/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            await get().fetchAdminQuestions();
        } catch (error) {
            console.error('Failed to update question:', error);
        }
    },

    adminBulkDeleteQuestions: async (ids: string[]) => {
        const BACKEND_URL = window.location.origin;
        if (!confirm(`${ids.length} ta savolni o'chirmoqchimisiz?`)) return;

        // Instant UI update
        set(state => ({
            adminQuestions: state.adminQuestions.filter(q => !q.id || !ids.includes(q.id))
        }));

        try {
            await fetch(`${BACKEND_URL}/auth/admin/questions/bulk-delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });
            await get().fetchAdminQuestions();
        } catch (error) {
            console.error('Failed to bulk delete questions:', error);
            await get().fetchAdminQuestions();
        }
    },

    adminDeleteQuestion: async (id: string) => {
        const BACKEND_URL = window.location.origin;
        if (!confirm("Haqiqatdan ham ushbu savolni o'chirmoqchimisiz?")) return;

        // Instant UI update
        set(state => ({
            adminQuestions: state.adminQuestions.filter(q => q.id !== id)
        }));

        try {
            await fetch(`${BACKEND_URL}/auth/admin/questions/${id}`, {
                method: 'DELETE'
            });
            // Final refresh to be sure
            await get().fetchAdminQuestions();
        } catch (error) {
            console.error('Failed to delete question:', error);
            // Revert on error? Or just refresh
            await get().fetchAdminQuestions();
        }
    },


    fetchAdminSubjects: async () => {
        const BACKEND_URL = window.location.origin;
        try {
            const res = await fetch(`${BACKEND_URL}/auth/admin/subjects`);
            const data = await res.json();
            if (data.success) set({ adminSubjects: data.subjects });
        } catch (error) {
            console.error('Failed to fetch subjects:', error);
        }
    },

    adminCreateSubject: async (name, code) => {
        const BACKEND_URL = window.location.origin;
        try {
            const res = await fetch(`${BACKEND_URL}/auth/admin/subjects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, code })
            });
            const data = await res.json();
            if (data.success) await get().fetchAdminSubjects();
        } catch (error) {
            console.error('Failed to create subject:', error);
        }
    },

    adminGetGradeConfig: async (grade) => {
        const BACKEND_URL = window.location.origin;
        try {
            const res = await fetch(`${BACKEND_URL}/auth/subjects/allowed?grade=${grade}`);
            const data = await res.json();
            if (data.success) {
                // Force lowercase to ensure UI consistency
                return data.subjects.map((s: any) => s.code.toLowerCase());
            }
            return [];
        } catch (error) {
            console.error('Failed to get grade config:', error);
            return [];
        }
    },

    adminUpdateGradeConfig: async (grade, subjects) => {
        const BACKEND_URL = window.location.origin;
        try {
            // Ensure we send lowercase codes
            const lowerSubjects = subjects.map(s => s.toLowerCase());
            await fetch(`${BACKEND_URL}/auth/admin/grade-config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ grade, subjects: lowerSubjects })
            });
        } catch (error) {
            console.error('Failed to update config:', error);
        }
    },

    adminUploadQuestions: async (file) => {
        const BACKEND_URL = window.location.origin;
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`${BACKEND_URL}/auth/admin/upload-questions`, {
                method: 'POST',
                body: formData
            });
            return await res.json();
        } catch (error) {
            console.error('Upload failed:', error);
            return { success: false };
        }
    },

    // Challenge & Online Users - (Initialized above)

    fetchOnlineUsers: async () => {
        const BACKEND_URL = window.location.origin;
        const profile = get().profile;
        if (!profile || !profile.grade) return;

        try {
            const res = await fetch(`${BACKEND_URL}/game/online-users?grade=${profile.grade}&userId=${profile.id}`);
            const data = await res.json();
            if (data.success) {
                set({ onlineUsers: data.users || [] });
            }
        } catch (error) {
            console.error('Failed to fetch online users:', error);
        }
    },

    sendChallenge: (toUserId: number) => {
        const profile = get().profile;
        if (profile) {
            socket.emit('send_challenge', { fromUser: { id: profile.id, name: profile.firstName, grade: profile.grade }, toUserId });
        }
    },

    respondChallenge: (fromUserId: number, response: 'accept' | 'reject') => {
        const profile = get().profile;
        if (profile) {
            socket.emit('respond_challenge', { fromUserId, toUserId: profile.id, response });
            set({ incomingChallenge: null });
        }
    },

    login: async (initDataRaw) => {
        const BACKEND_URL = window.location.origin; // Ngrok handles both
        try {
            const res = await fetch(`${BACKEND_URL}/auth/telegram`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initData: initDataRaw })
            });
            const data = await res.json();
            if (data.success) {
                set({
                    profile: data.user,
                    players: {
                        ...get().players,
                        me: { id: data.user.id, name: data.user.firstName }
                    }
                });
                if (data.token) {
                    localStorage.setItem('authToken', data.token);
                }
                get().fetchRank(); // Fetch rank
            }
        } catch (error) {
            console.error("Login hatosi:", error);
        }
    },

    loginWithToken: (token, user) => {
        localStorage.setItem('authToken', token);
        set({
            profile: user,
            players: {
                ...get().players,
                me: { id: user.id, name: user.firstName }
            }
        });
        console.log("Logged in via Web Token:", user, token.substring(0, 10) + '...');
    },

    checkAuth: async () => {
        set({ isInitializing: true });
        const token = localStorage.getItem('authToken');
        const tg = (window as any).Telegram?.WebApp;

        // Priority 1: Check for persistent token
        if (token) {
            const BACKEND_URL = window.location.origin;
            try {
                const res = await fetch(`${BACKEND_URL}/auth/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.success) {
                    set({
                        profile: data.user,
                        players: {
                            ...get().players,
                            me: { id: data.user.id, name: data.user.firstName }
                        },
                        isInitializing: false
                    });
                    get().fetchRank();
                    console.log("Session restored via token:", data.user);
                    return;
                }
            } catch (error) {
                console.error("Auth check failed:", error);
            }
        }

        // Priority 2: Check for Telegram InitData (Auto-login)
        if (tg && tg.initData) {
            console.log("Telegram data found during init, auto-logging in...");
            try {
                await get().login(tg.initData);
                set({ isInitializing: false });
                return;
            } catch (e) {
                console.error("Auto-login failed:", e);
            }
        }

        set({ isInitializing: false });
        localStorage.removeItem('authToken');
    },

    setGrade: async (grade) => {
        const BACKEND_URL = window.location.origin;
        const profile = get().profile;
        if (!profile) {
            console.error("Profile not found");
            return;
        }

        // Optimistic Update
        set({ profile: { ...profile, grade } });

        try {
            const res = await fetch(`${BACKEND_URL}/auth/update-grade`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: profile.id, grade })
            });
            const data = await res.json();
            if (data.success) {
                // Ensure synced with server response (optional, but good practice)
                set({ profile: data.user });
                console.log(`Grade updated to ${grade}`);
                get().fetchRank(); // Update rank immediately for the new grade
            } else {
                // Revert if failed (optional, omitting for simplicity/UX speed)
            }
        } catch (error) {
            console.error("Grade update hatosi:", error);
            // Revert?
        }
    },

    joinRoom: (roomId) => {
        socket.emit('join_room', { roomId, user: get().players.me });
        set({ roomId, status: 'waiting' });
    },

    findMatch: async (subjectId?: number) => {
        const BACKEND_URL = window.location.origin;
        const profile = get().profile;
        const playersMe = get().players.me;

        if (!profile || !playersMe) {
            console.error("Profile or player not found");
            return;
        }

        set({ status: 'searching', error: null });

        // PRE-CHECK: Verify questions exist before starting search
        if (subjectId) {
            try {
                const countRes = await fetch(`${BACKEND_URL}/auth/questions/count?grade=${profile.grade}&subjectId=${subjectId}`);
                const countData = await countRes.json();
                if (countData.success && countData.count === 0) {
                    set({
                        status: 'idle',
                        error: "Ushbu fandan hali savollar tayyorlanmadi. Boshqa fanni tanlang!"
                    });
                    return;
                }
            } catch (e) {
                console.error("Question count check failed:", e);
                // Continue anyway if check fails, to stay resilient
            }
        }


        const checkMatch = async () => {
            if (get().status === 'playing') return true; // Already playing, stop polling

            // Get updated state for socketId
            const socket = (await import('../services/socket')).socket;
            try {
                const res = await fetch(`${BACKEND_URL}/game/find_match`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user: {
                            id: profile.id,
                            name: profile.firstName,
                            grade: profile.grade,
                            subjectId
                        },
                        socketId: socket.id
                    })
                });

                if (res.status === 403) {
                    const errData = await res.json();
                    set({ status: 'idle', loading: false, error: errData.error || "Profilingiz boshqa qurilmada faol!" });
                    return true; // Stop polling
                }

                const data = await res.json();
                console.log('Matchmaking response FULL:', data);
                if (data.status === 'matched') {
                    // Match found!
                    const yourRole = data.yourRole;

                    // CRITICAL FIX: Ensure socket joins the room to receive updates!
                    // Even if we are just restoring state, the socket might be new (refresh)
                    socket.emit('join_room', { roomId: data.roomId, user: get().players.me || profile });

                    set({
                        roomId: data.roomId,
                        status: 'playing',
                        yourRole,
                        players: {
                            me: yourRole === 'player1' ? data.game.player1 : data.game.player2,
                            opponent: yourRole === 'player1' ? data.game.player2 : data.game.player1
                        },
                        questions: data.game.questions || [],
                        ropePosition: data.game.ropePosition,
                        stats: data.game.stats,
                        loading: false
                    });
                    return true; // Stop polling
                }
                return false; // Continue polling
            } catch (error) {
                console.error("Matchmaking error:", error);
                set({ status: 'idle', loading: false }); // Set loading to false on error
                return true; // Stop polling on error
            }
        };

        // Initial check
        const matched = await checkMatch();
        if (matched) return;

        // Poll every 2 seconds
        const pollInterval = setInterval(async () => {
            if (get().status !== 'searching') {
                clearInterval(pollInterval);
                return;
            }

            const matched = await checkMatch();
            if (matched) {
                clearInterval(pollInterval);
            }
        }, 2000);

        // Stop polling after 30 seconds
        setTimeout(() => {
            clearInterval(pollInterval);
            if (get().status === 'searching') {
                set({ status: 'timeout' as any, loading: false }); // Cast to any to allow new status if not in type yet
                console.log('Matchmaking timeout');
            }
        }, 30000);
    },

    fetchLeaderboard: async (grade) => {
        const BACKEND_URL = window.location.origin;
        try {
            const url = grade ? `${BACKEND_URL}/auth/leaderboard?grade=${grade}` : `${BACKEND_URL}/auth/leaderboard`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                set({ leaderboard: data.users });
            }
        } catch (e) {
            console.error("Leaderboard fetch error:", e);
        }
    },

    fetchNotifications: async () => {
        const profile = get().profile;
        if (!profile) return;
        const BACKEND_URL = window.location.origin;
        try {
            const res = await fetch(`${BACKEND_URL}/auth/notifications/${profile.id}`);
            const data = await res.json();
            if (data.success) {
                set({ notifications: data.notifications });
            }
        } catch (e) {
            console.error("Notifications fetch error:", e);
        }
    },

    markNotificationsRead: async (ids) => {
        const BACKEND_URL = window.location.origin;
        try {
            await fetch(`${BACKEND_URL}/auth/notifications/read`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notificationIds: ids })
            });
            set(state => ({
                notifications: state.notifications.filter(n => !ids.includes(n.id))
            }));
        } catch (e) {
            console.error("Mark read error:", e);
        }
    },

    initiateAsyncChallenge: async (targetUserId, subjectId) => {
        const profile = get().profile;
        if (!profile) return;
        const BACKEND_URL = window.location.origin;
        set({ loading: true, error: null });

        try {
            const qRes = await fetch(`${BACKEND_URL}/auth/questions/random?subjectId=${subjectId}&grade=${profile.grade}&count=10`);
            const qData = await qRes.json();

            if (!qData.success || !qData.questions.length) {
                set({ error: "Savollar topilmadi!", loading: false });
                return;
            }

            const questions = qData.questions.map((q: any) => ({
                id: q.id,
                q: q.q,
                a: q.a,
                options: q.options,
                answer: q.answer
            }));

            const cRes = await fetch(`${BACKEND_URL}/auth/async/challenge/initiate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    challengerId: profile.id,
                    targetUserId,
                    subjectId,
                    questions
                })
            });
            const cData = await cRes.json();

            if (cData.success) {
                set({
                    status: 'playing',
                    isAsyncMode: true,
                    activeAsyncChallengeId: cData.challengeId,
                    questions,
                    players: {
                        me: { id: profile.id, name: profile.firstName },
                        opponent: { id: targetUserId, name: "Raqib (Oflayn)" }
                    },
                    stats: {
                        player1: { answeredCount: 0, score: 0, correctCount: 0 },
                        player2: { answeredCount: 0, score: 0, correctCount: 0 }
                    },
                    playerAnswers: {
                        player1: [],
                        player2: []
                    },
                    playerInputValues: {
                        player1: [],
                        player2: []
                    },
                    playerTimes: {
                        player1: [],
                        player2: []
                    },
                    ropePosition: 50,
                    winner: null,
                    loading: false,
                    yourRole: 'player1'
                });
            }
        } catch (e) {
            set({ error: "Xatolik yuz berdi!", loading: false });
        }
    },

    joinAsyncChallenge: async (challengeId: string) => {
        const profile = get().profile;
        if (!profile) return;
        const BACKEND_URL = window.location.origin;
        set({ loading: true, error: null });

        try {
            const res = await fetch(`${BACKEND_URL}/auth/async/challenge/${challengeId}`);
            const data = await res.json();

            if (data.success) {
                const challenge = data.challenge;
                const questions = challenge.questions;
                const isChallenger = BigInt(profile.id) === BigInt(challenge.challengerId);
                const role = isChallenger ? 'player1' : 'player2';

                const isCompleted = challenge.status === 'completed';
                let winner: string | null = null;
                if (isCompleted) {
                    const cScore = challenge.challengerScore || 0;
                    const tScore = challenge.targetScore || 0;
                    const cTime = challenge.challengerTime || 0;
                    const tTime = challenge.targetTime || 0;

                    if (cScore > tScore) winner = String(challenge.challengerId);
                    else if (tScore > cScore) winner = String(challenge.targetUserId);
                    else {
                        if (cTime < tTime) winner = String(challenge.challengerId);
                        else if (tTime < cTime) winner = String(challenge.targetUserId);
                        else winner = 'draw';
                    }

                    // Mark as viewed immediately if joining a finished game
                    get().markChallengeAsViewed(challengeId);
                }

                console.log(`[DEBUG gameStore] Joining Async Challenge: ID=${challengeId}, Role=${role}, isCompleted=${isCompleted}, Winner=${winner}`);

                set({
                    status: isCompleted ? 'finished' : 'playing',
                    isAsyncMode: true,
                    activeAsyncChallengeId: challengeId,
                    questions,
                    players: {
                        me: { id: profile.id, name: profile.firstName },
                        opponent: {
                            id: challenge.challenger.id,
                            name: challenge.challenger.firstName
                        }
                    },
                    stats: {
                        player1: {
                            answeredCount: (challenge.challengerScore !== null) ? questions.length : 0,
                            score: challenge.challengerScore || 0,
                            correctCount: Math.floor((challenge.challengerScore || 0) / 10)
                        },
                        player2: {
                            answeredCount: (challenge.targetScore !== null) ? questions.length : 0,
                            score: challenge.targetScore || 0,
                            correctCount: Math.floor((challenge.targetScore || 0) / 10)
                        }
                    },
                    playerAnswers: {
                        // Fill with reasonable dummy data for the results table based on scores
                        player1: (challenge.challengerScore !== null)
                            ? new Array(questions.length).fill(false).map((_, i) => i < Math.floor((challenge.challengerScore || 0) / 10))
                            : [],
                        player2: (challenge.targetScore !== null)
                            ? new Array(questions.length).fill(false).map((_, i) => i < Math.floor((challenge.targetScore || 0) / 10))
                            : []
                    },
                    yourRole: role,
                    winner,
                    loading: false
                });
                console.log("[DEBUG gameStore] Game State Set successfully.");
            } else {
                set({ error: data.message || "Chaqiriqni yuklashda xatolik!", loading: false });
            }
        } catch (e) {
            console.error("Join async challenge error:", e);
            set({ error: "Server bilan aloqa uzildi!", loading: false });
        }
    },

    markChallengeAsViewed: async (challengeId: string) => {
        const profile = get().profile;
        if (!profile) return;
        const BACKEND_URL = window.location.origin;

        try {
            await fetch(`${BACKEND_URL}/auth/async/challenge/viewed`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ challengeId, userId: profile.id })
            });
        } catch (e) {
            console.error("Error marking challenge as viewed:", e);
        }
    },

    createRoom: async () => {
        const roomId = Math.random().toString(36).substring(7);
        get().joinRoom(roomId);
        return roomId;
    },

    submitAnswer: (isCorrect: boolean, questionIndex?: number, answerValue?: string | number, timeTaken?: number) => {
        const { roomId, yourRole, status, isAsyncMode, questions, stats, playerAnswers, playerInputValues, playerTimes } = get();
        if (status !== 'playing') return;

        const myRole = yourRole || 'player1';

        if (isAsyncMode) {
            console.log("[DEBUG gameStore] Async Submit Start. myRole:", myRole, "questionIndex:", questionIndex, "isCorrect:", isCorrect);
            const newStats = JSON.parse(JSON.stringify(stats));
            const newAnswers = JSON.parse(JSON.stringify(playerAnswers));
            const newInputValues = JSON.parse(JSON.stringify(playerInputValues));
            const newTimes = JSON.parse(JSON.stringify(playerTimes));

            if (!newAnswers[myRole]) newAnswers[myRole] = [];
            if (!newInputValues[myRole]) newInputValues[myRole] = [];
            if (!newTimes[myRole]) newTimes[myRole] = [];

            newStats[myRole].answeredCount += 1;
            if (isCorrect) {
                newStats[myRole].score += 10;
                newStats[myRole].correctCount += 1;
            }
            newAnswers[myRole][questionIndex!] = isCorrect;
            newInputValues[myRole][questionIndex!] = answerValue!;
            newTimes[myRole][questionIndex!] = timeTaken || 0;

            console.log("[DEBUG gameStore] Async Stats Updated. Next Count:", newStats[myRole].answeredCount);
            set({ stats: newStats, playerAnswers: newAnswers, playerInputValues: newInputValues, playerTimes: newTimes });

            if (newStats[myRole].answeredCount >= questions.length) {
                console.log("[DEBUG gameStore] Async Game Finished. Questions:", questions.length);
                const totalTime = newTimes[myRole].reduce((a: number, b: number) => a + (b || 0), 0);
                const score = newStats[myRole].score;
                const activeId = get().activeAsyncChallengeId;
                const profile = get().profile;
                const BACKEND_URL = window.location.origin;

                fetch(`${BACKEND_URL}/auth/async/challenge/submit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        challengeId: activeId,
                        userId: profile?.id,
                        score,
                        time: totalTime
                    })
                }).then(async (res) => {
                    const data = await res.json();
                    if (data.success && data.settled) {
                        let finalWinner: string | null = null;
                        if (data.isDraw) finalWinner = 'draw';
                        else {
                            const wId = BigInt(data.winnerId);
                            const pId = BigInt(profile?.id || 0);
                            finalWinner = (wId === pId) ? myRole : (myRole === 'player1' ? 'player2' : 'player1');
                        }
                        set({ status: 'finished', winner: finalWinner });
                    } else {
                        set({ status: 'finished', winner: 'async_pending' });
                    }
                });
            }
        } else if (roomId && yourRole) {
            const profile = get().profile;
            socket.emit('submit_answer', {
                roomId,
                userId: profile?.id,
                isCorrect,
                questionIndex,
                answerValue,
                timeTaken
            });
        }
    },

    resetGame: () => {
        set((state) => ({
            status: 'idle',
            roomId: null,
            players: {
                me: state.players.me,
                opponent: null
            },
            yourRole: null,
            questions: [],
            ropePosition: 50,
            stats: {
                player1: { answeredCount: 0, score: 0, correctCount: 0 },
                player2: { answeredCount: 0, score: 0, correctCount: 0 }
            },
            playerAnswers: {
                player1: [],
                player2: []
            },
            playerInputValues: {
                player1: [],
                player2: []
            },
            playerTimes: {
                player1: [],
                player2: []
            },
            winner: null,
            leaderboard: [],
            notifications: [],
            activeAsyncChallengeId: null,
            isAsyncMode: false,
            loading: false,
            error: null // Clear error on reset
        }));
        get().fetchRank(); // Refresh ranking after a game ends
    },

    updateProfile: async (name: string) => {
        const BACKEND_URL = window.location.origin;
        const profile = get().profile;
        if (!profile) return;

        try {
            const res = await fetch(`${BACKEND_URL}/auth/update-profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: profile.id, name })
            });
            const data = await res.json();
            if (data.success) {
                set({
                    profile: data.user,
                    players: { ...get().players, me: { ...get().players.me!, name: data.user.firstName } }
                });
                console.log("Profile updated:", data.user);
            }
        } catch (error) {
            console.error("Profile update hatosi:", error);
        }
    },

    fetchRank: async () => {
        const profile = get().profile;
        if (!profile) return;
        try {
            const BACKEND_URL = window.location.origin;
            const res = await fetch(`${BACKEND_URL}/auth/rank/${profile.id}`);
            const data = await res.json();
            if (data.success) {
                // Determine appropriate override for grade/rating
                // If backend returns grade=0, keep existing if valid
                const newGrade = (data.grade !== 0 && data.grade != null) ? data.grade : profile.grade;
                const newRating = (data.rating !== undefined) ? data.rating : profile.rating;

                set({
                    profile: {
                        ...profile,
                        rank: data.rank,
                        grade: newGrade,
                        rating: newRating
                    }
                });
            }
        } catch (e) {
            console.error("Fetch Rank Error:", e);
        }
    },

    cleanupListeners: () => {
        const { heartbeatInterval } = get() as any;
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        set({ heartbeatInterval: null } as any);

        socket.off('game_update');
        socket.off('rope_update');
        socket.off('game_over');
        socket.off('joined_room');
        socket.off('error');
        socket.off('match_found');
        socket.off('match_waiting');
        socket.off('player_joined');
        socket.off('connect');
        socket.off('disconnect');
        socket.off('connect_error');
    },

    refreshProfile: async () => {
        const BACKEND_URL = window.location.origin;
        const profile = get().profile;
        if (!profile) return;

        try {
            const res = await fetch(`${BACKEND_URL}/auth/profile/${profile.id}`);
            const data = await res.json();
            if (data.success) {
                set({ profile: data.user });
                console.log("Profile refreshed:", data.user);
            }
        } catch (error) {
            console.error("Profile refresh hatosi:", error);
        }
    },

    initializeListeners: () => {
        get().cleanupListeners();

        // Heartbeat with User Data
        const interval = setInterval(() => {
            if (socket.connected) {
                const profile = get().profile;
                if (profile) {
                    socket.emit('heartbeat', {
                        user: { id: profile.id, name: profile.firstName, grade: profile.grade }
                    });
                } else {
                    socket.emit('heartbeat');
                }
            }
        }, 3000);
        set({ heartbeatInterval: interval } as any);

        socket.on('joined_room', ({ roomId }) => {
            console.log("Joined room:", roomId);
            set({ roomId, status: 'waiting' });
        });

        socket.on('match_waiting', () => {
            console.log("Match waiting...");
            set({ status: 'searching' });
        });

        socket.on('match_found', (data: { roomId: string, game: any, yourRole: 'player1' | 'player2' }) => {
            console.log("Match Found via Socket!", data);
            set({
                status: 'playing',
                roomId: data.roomId,
                yourRole: data.yourRole,
                players: {
                    me: data.yourRole === 'player1' ? data.game.player1 : data.game.player2,
                    opponent: data.yourRole === 'player1' ? data.game.player2 : data.game.player1
                },
                questions: data.game.questions || [],
                ropePosition: data.game.ropePosition,
                stats: data.game.stats,
                playerAnswers: data.game.playerAnswers || { player1: [], player2: [] },
                playerInputValues: data.game.playerInputValues || { player1: [], player2: [] },
                playerTimes: data.game.playerTimes || { player1: [], player2: [] },
                loading: false,
                incomingChallenge: null // Clear any challenge modal
            });
        });

        // Challenge Events
        socket.on('challenge_received', (data: { fromUser: any }) => {
            console.log("Challenge Received:", data.fromUser);
            set({ incomingChallenge: data.fromUser });
        });

        socket.on('challenge_rejected', () => {
            alert("Raqib taklifni rad etdi."); // Simple alert for now
        });


        socket.on('game_update', (game: any) => {
            console.log("Game Update Received:", game.status, game.stats);
            set({
                ropePosition: game.ropePosition,
                stats: game.stats,
                playerAnswers: game.playerAnswers || { player1: [], player2: [] },
                playerInputValues: game.playerInputValues || { player1: [], player2: [] },
                playerTimes: game.playerTimes || { player1: [], player2: [] },
                status: game.status
            });

            // If game just finished, sync winner ID and refresh profile stats
            if (game.status === 'finished') {
                set({ winner: String(game.winner) });
                // Small delay to ensure auth service has processed the results
                setTimeout(() => {
                    get().refreshProfile();
                }, 1000);
            }
        });

        socket.on('rope_update', ({ ropePosition }: { ropePosition: number }) => {
            set({ ropePosition });
        });

        socket.on('error', (err: any) => {
            console.error("Socket Error:", err);
        });

        socket.on('connect', () => {
            console.log("Socket connected:", socket.id);
            const { roomId } = get();
            if (roomId) {
                console.log("Rejoining room:", roomId);
                socket.emit('reconnect_socket', { roomId, userId: get().profile?.id });
            }
        });

        socket.on('disconnect', () => {
            console.log("Socket disconnected");
        });
    }
}));
