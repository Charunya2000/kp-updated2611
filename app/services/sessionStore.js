// In-memory session store with inactivity & absolute timeout enforcement
// NOTE: Replace with Redis/Mongo for production clustering.

function parseTimeoutMs(value, fallback) {
    const parsed = Number(String(value ?? '').trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getTimeoutConfig() {
    return {
        idleMs: parseTimeoutMs(process.env.OPENID_IDLE_TIMEOUT_MS, 15 * 60 * 1000),
        absoluteMs: parseTimeoutMs(process.env.OPENID_ABSOLUTE_TIMEOUT_MS, 8 * 60 * 60 * 1000),
    };
}

class SessionStore {
    constructor() {
        this.store = new Map();
    }

    create(record) {
        this.store.set(record.sessionId, record);
        return record;
    }

    get(sessionId) {
        return this.store.get(sessionId);
    }

    touch(sessionId, now = Date.now()) {
        const rec = this.store.get(sessionId);
        if (!rec) return undefined;
        rec.lastActivity = now;
        return rec;
    }

    revoke(sessionId) {
        const rec = this.store.get(sessionId);
        if (rec) rec.revoked = true;
    }

    isExpired(rec, now = Date.now()) {
        const { idleMs } = getTimeoutConfig();
        if (rec.revoked) return true;
        if (now >= rec.absoluteExpiry) return true;
        if (now - rec.lastActivity > idleMs) return true;
        return false;
    }

    cleanup(now = Date.now()) {
        for (const [id, rec] of this.store.entries()) {
            if (this.isExpired(rec, now)) {
                this.store.delete(id);
            }
        }
    }
}

export const sessionStore = new SessionStore();

export function computeSessionTimes(now = Date.now()) {
    const { absoluteMs } = getTimeoutConfig();
    return {
        createdAt: now,
        lastActivity: now,
        absoluteExpiry: now + absoluteMs,
    };
}
