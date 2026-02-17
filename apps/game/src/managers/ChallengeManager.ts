import { OnlineUser } from '../types';

export class ChallengeManager {
    private onlineUsers = new Map<string, OnlineUser>(); // Key: UserId string
    private HEARTBEAT_TIMEOUT = 120000; // Match Game/Queue timeout

    updateHeartbeat(socketId: string, user?: { id: number, name: string, grade: number }) {
        const now = Date.now();
        if (user) {
            this.onlineUsers.set(String(user.id), { ...user, socketId, lastSeen: now });
            // console.log(`Online User Updated: ${user.name} (${user.id})`);
        } else {
            // Find by socketId and update
            for (const [id, u] of this.onlineUsers.entries()) {
                if (u.socketId === socketId) {
                    u.lastSeen = now;
                    this.onlineUsers.set(id, u);
                    return;
                }
            }
        }
    }

    getOnlineUsers(grade: number, excludeUserId: string): Partial<OnlineUser>[] {
        return Array.from(this.onlineUsers.values())
            .filter(u => u.grade === grade && String(u.id) !== excludeUserId)
            .map(u => ({ id: u.id, name: u.name, grade: u.grade }));
    }

    getUser(userId: string): OnlineUser | undefined {
        return this.onlineUsers.get(userId);
    }

    getUserBySocketId(socketId: string): OnlineUser | undefined {
        for (const user of this.onlineUsers.values()) {
            if (user.socketId === socketId) return user;
        }
        return undefined;
    }

    cleanup(now: number) {
        for (const [id, user] of this.onlineUsers.entries()) {
            if (now - user.lastSeen > this.HEARTBEAT_TIMEOUT) {
                this.onlineUsers.delete(id);
            }
        }
    }
}
