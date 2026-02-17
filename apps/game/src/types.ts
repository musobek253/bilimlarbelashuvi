
export interface Player {
    id: number;
    name: string;
    grade: number;
    socketId: string;
    score: number;
    answeredCount: number;
    correctCount: number;
    lastSeen?: number;
    photo_url?: string;
    finishedTime?: number;
}

export interface Question {
    id?: string;
    q: string;
    a: number; // Index of correct answer (legacy/primary)
    answers?: number[]; // Indices of all correct answers
    options?: string[]; // ["Toshkent", "Samarqand", ...]
    type?: 'custom' | 'generated';
}

export interface GameState {
    id: string;
    player1: Player;
    player2: Player;
    p1SocketId?: string; // Kept for quick access, though in Player too
    p2SocketId?: string;
    status: 'waiting' | 'playing' | 'finished' | 'timeout';
    questions: Question[];
    currentQuestionIndex: number;
    ropePosition: number; // 0-100, 50 is center
    winner: string | null;
    startTime: number;
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
    stats: {
        player1: { answeredCount: number; score: number; correctCount: number };
        player2: { answeredCount: number; score: number; correctCount: number };
    };
}

export interface QueueItem {
    user: { id: number; name: string; grade: number; subjectId?: number };
    socketId: string;
    lastSeen: number;
}

export interface OnlineUser {
    id: number;
    name: string;
    grade: number;
    socketId: string;
    lastSeen: number;
}
