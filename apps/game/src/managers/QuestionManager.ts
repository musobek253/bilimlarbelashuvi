import { Question } from '../types';
import axios from 'axios';

export class QuestionManager {
    private questions: Question[] = [
        { q: "O'zbekiston poytaxti?", a: 0 }, // A: Toshkent
        { q: "2 + 2 = ?", a: 1 },             // B: 4
        { q: "Alisher Navoiy tug'ilgan yil?", a: 2 }, // C: 1441
        { q: "Eng katta okean?", a: 3 }       // D: Tinch
    ];
    private AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

    constructor() {
        // Load from DB if needed
    }

    getAll(): Question[] {
        return this.questions;
    }

    add(q: string, a: number): Question {
        const newQ: Question = { id: Date.now().toString(), q, a, type: 'custom' };
        this.questions.push(newQ);
        return newQ;
    }

    delete(id: string): boolean {
        const initialLength = this.questions.length;
        this.questions = this.questions.filter(q => q.id !== id);
        return this.questions.length < initialLength;
    }

    async getRandomQuestions(count: number, grade: number = 5, subjectId?: number): Promise<Question[]> {
        // 1. Try fetching from Auth Service if subjectId exists
        if (subjectId) {
            try {
                console.log(`[QuestionManager] Fetching questions: URL=${this.AUTH_SERVICE_URL}/auth/questions/random, Grade=${grade}, Subject=${subjectId}`);
                const res = await axios.get(`${this.AUTH_SERVICE_URL}/auth/questions/random`, {
                    params: { grade, subjectId, count }
                });

                if (res.data.success && res.data.questions) {
                    console.log(`[QuestionManager] Successfully fetched ${res.data.questions.length} questions`);
                    return res.data.questions;
                }
            } catch (e) {
                console.error("Failed to fetch questions from Auth:", e);
                return []; // Return empty, do NOT fallback to Math
            }
            return []; // No questions found for subject
        }

        // 2. Fallback to Local Generation (Legacy/Backup)
        const questions: Question[] = [];
        const remaining = count - questions.length;

        for (let i = 0; i < remaining; i++) {
            let q = '';
            let a = 0;

            if (grade == 1) {
                // Grade 1: +/- within 20
                const num1 = Math.floor(Math.random() * 20) + 1;
                const num2 = Math.floor(Math.random() * 20) + 1;
                if (Math.random() > 0.5) {
                    q = `${num1} + ${num2} = ?`;
                    a = num1 + num2;
                } else {
                    const max = Math.max(num1, num2);
                    const min = Math.min(num1, num2);
                    q = `${max} - ${min} = ?`;
                    a = max - min;
                }
            } else if (grade == 2) {
                // Grade 2: +/- within 100
                const num1 = Math.floor(Math.random() * 100) + 1;
                const num2 = Math.floor(Math.random() * 100) + 1;
                if (Math.random() > 0.5) {
                    q = `${num1} + ${num2} = ?`;
                    a = num1 + num2;
                } else {
                    const max = Math.max(num1, num2);
                    const min = Math.min(num1, num2);
                    q = `${max} - ${min} = ?`;
                    a = max - min;
                }
            } else {
                // Grade 3+: Mixed
                const ops = ['+', '-', '×', '÷'];
                const op = ops[Math.floor(Math.random() * ops.length)];

                if (op === '+') {
                    const num1 = Math.floor(Math.random() * 100) + 1;
                    const num2 = Math.floor(Math.random() * 100) + 1;
                    q = `${num1} + ${num2} = ?`;
                    a = num1 + num2;
                } else if (op === '-') {
                    const num1 = Math.floor(Math.random() * 100) + 1;
                    const num2 = Math.floor(Math.random() * 100) + 1;
                    const max = Math.max(num1, num2);
                    const min = Math.min(num1, num2);
                    q = `${max} - ${min} = ?`;
                    a = max - min;
                } else if (op === '×') {
                    const num1 = Math.floor(Math.random() * 12) + 1;
                    const num2 = Math.floor(Math.random() * 12) + 1;
                    q = `${num1} × ${num2} = ?`;
                    a = num1 * num2;
                } else {
                    const result = Math.floor(Math.random() * 12) + 1;
                    const divisor = Math.floor(Math.random() * 10) + 1;
                    const dividend = result * divisor;
                    q = `${dividend} ÷ ${divisor} = ?`;
                    a = result;
                }
            }

            questions.push({ q, a, type: 'generated' });
        }

        return questions;
    }
}
