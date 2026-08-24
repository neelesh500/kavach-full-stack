const crypto = require('crypto');
const redisClient = require('../config/redis');

const TOTAL_SHARES = 5;
const THRESHOLD = 3;
const SESSION_KEY = 'kavach_active_session';

class SessionService {
    async newSession() {
        const session = {
            sessionId: crypto.randomBytes(12).toString('hex'),
            shares: [],
            threshold: THRESHOLD,
            total: TOTAL_SHARES,
            masterKeyReconstructed: null,
            startedAt: new Date().toISOString()
        };
        if (redisClient) {
            await redisClient.set(SESSION_KEY, JSON.stringify(session));
        } else {
            this.localSession = session;
        }
        return session;
    }

    async getActiveSession() {
        if (redisClient) {
            const data = await redisClient.get(SESSION_KEY);
            if (data) return JSON.parse(data);
            return await this.newSession();
        } else {
            if (!this.localSession) await this.newSession();
            return this.localSession;
        }
    }

    async saveSession(session) {
        if (redisClient) {
            await redisClient.set(SESSION_KEY, JSON.stringify(session));
        } else {
            this.localSession = session;
        }
    }

    async resetSessions() {
        await this.newSession();
    }
}

module.exports = new SessionService();
