import { createClient } from 'redis';
import { QueueItem } from '../types';

export class QueueManager {
    private client: any;
    private memoryQueue: QueueItem[] = [];
    private redisConnected: boolean = false;
    private QUEUE_KEY = 'game_queue';
    private HEARTBEAT_TIMEOUT = 120000;

    constructor() {
        // Disable auto-reconnect spam by handling error once and closing if needed
        this.client = createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379',
            socket: {
                reconnectStrategy: false // Do not retry if failed, fallback to memory immediately
            }
        });

        this.client.on('error', (err: any) => {
            // Only log if we were previously connected or it's strict debugging
            if (this.redisConnected) {
                console.log('Redis/Queue Error:', err.message);
            }
            this.redisConnected = false;
        });

        this.client.connect().then(() => {
            this.redisConnected = true;
            console.log('Redis connected in QueueManager');
        }).catch(() => {
            // Quietly fail to memory
            console.log('Redis connection failed, using in-memory queue');
            this.redisConnected = false;
        });
    }

    async addToQueue(user: { id: number, name: string, grade: number, subjectId?: number }, socketId: string) {
        const item: QueueItem = { user, socketId, lastSeen: Date.now() };

        // Remove existing if any
        await this.removeFromQueue(socketId);

        if (this.redisConnected) {
            await this.client.rPush(this.QUEUE_KEY, JSON.stringify(item));
        } else {
            this.memoryQueue.push(item);
        }
    }

    async findMatch(grade: number, subjectId: number | undefined, excludeSocketId: string, excludeUserId: number): Promise<QueueItem | null> {
        // Matchmaking Logic:
        // 1. Must be same Grade
        // 2. Must NOT be same User (ID or Socket)
        // 3. Subject Compatibility:
        //    - If Searcher is Random (subjectId null/undefined) -> Match ANYONE in grade
        //    - If Queue Item is Random (item.user.subjectId null/undefined) -> Match ANYONE (Searcher dictates subject)
        //    - If Both have Subject -> Must be SAME Subject

        console.log(`Finding match for User=${excludeUserId}, Grade=${grade}, Subject=${subjectId}...`);

        if (this.redisConnected) {
            const list = await this.client.lRange(this.QUEUE_KEY, 0, -1);
            for (let i = 0; i < list.length; i++) {
                try {
                    const item = JSON.parse(list[i]);

                    const isGradeMatch = item.user.grade === grade;
                    const isNotSelf = item.socketId !== excludeSocketId && String(item.user.id) !== String(excludeUserId);

                    const itemSubject = item.user.subjectId;
                    const isSubjectMatch =
                        (subjectId === undefined || subjectId === null) ||
                        (itemSubject === undefined || itemSubject === null) ||
                        (Number(itemSubject) === Number(subjectId));

                    if (isGradeMatch && isNotSelf && isSubjectMatch) {
                        await this.client.lRem(this.QUEUE_KEY, 1, list[i]);
                        console.log(`Match found REDIS: ${item.user.name}`);
                        return item;
                    }
                } catch (e) {
                    console.error('[QueueManager] Redis Match JSON Parse Error:', e);
                    // Skip malformed item
                    continue;
                }
            }
        } else {
            const index = this.memoryQueue.findIndex(i => {
                const isGradeMatch = i.user.grade === grade;
                const isNotSelf = i.socketId !== excludeSocketId && String(i.user.id) !== String(excludeUserId);

                const itemSubject = i.user.subjectId;
                const isSubjectMatch =
                    (subjectId === undefined || subjectId === null) ||
                    (itemSubject === undefined || itemSubject === null) ||
                    (Number(itemSubject) === Number(subjectId));

                return isGradeMatch && isNotSelf && isSubjectMatch;
            });

            if (index !== -1) {
                const [item] = this.memoryQueue.splice(index, 1);
                console.log(`Match found MEMORY: ${item.user.name} (Index ${index})`);
                return item;
            }
        }

        console.log("No match found.");
        return null;
    }

    async removeFromQueue(socketId: string) {
        if (this.redisConnected) {
            const list = await this.client.lRange(this.QUEUE_KEY, 0, -1);
            for (const str of list) {
                try {
                    const item = JSON.parse(str);
                    if (item.socketId === socketId) {
                        await this.client.lRem(this.QUEUE_KEY, 0, str); // 0=remove all occurrences
                    }
                } catch (e) {
                    console.error('[QueueManager] Redis Remove JSON Parse Error:', e);
                }
            }
        } else {
            this.memoryQueue = this.memoryQueue.filter(i => i.socketId !== socketId);
        }
    }

    async updateHeartbeat(socketId: string) {
        const now = Date.now();
        if (this.redisConnected) {
            const list = await this.client.lRange(this.QUEUE_KEY, 0, -1);
            for (let i = 0; i < list.length; i++) {
                try {
                    const item = JSON.parse(list[i]);
                    if (item.socketId === socketId) {
                        item.lastSeen = now;
                        await this.client.lSet(this.QUEUE_KEY, i, JSON.stringify(item));
                        return;
                    }
                } catch (e) {
                    console.error('[QueueManager] Redis Heartbeat JSON Parse Error:', e);
                }
            }
        } else {
            const item = this.memoryQueue.find(i => i.socketId === socketId);
            if (item) item.lastSeen = now;
        }
    }

    async cleanup(now: number) {
        if (this.redisConnected) {
            const list = await this.client.lRange(this.QUEUE_KEY, 0, -1);
            for (const str of list) {
                try {
                    const item = JSON.parse(str);
                    if (now - (item.lastSeen || 0) > this.HEARTBEAT_TIMEOUT) {
                        console.log(`Removing zombie from queue: ${item.user.name}`);
                        await this.client.lRem(this.QUEUE_KEY, 0, str);
                    }
                } catch (e) {
                    console.error('[QueueManager] Redis Cleanup JSON Parse Error:', e);
                    await this.client.lRem(this.QUEUE_KEY, 0, str); // Remove corrupt data
                }
            }
        } else {
            this.memoryQueue = this.memoryQueue.filter(i => {
                const alive = now - (i.lastSeen || 0) <= this.HEARTBEAT_TIMEOUT;
                if (!alive) console.log(`Removing zombie from queue: ${i.user.name}`);
                return alive;
            });
        }
    }
}
