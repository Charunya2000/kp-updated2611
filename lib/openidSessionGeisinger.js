import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { sessionStore } from '@/app/services/sessionStore';

function getAuthSecret() {
    const secretRaw = process.env.AUTH_SECRET;
    if (!secretRaw) return null;
    return new TextEncoder().encode(secretRaw);
}

/**
 * Verify and parse the openid_session cookie on the server.
 * Returns null if cookie missing or invalid signature.
 * Performs server-side inactivity & absolute checks using sessionStore record if sessionId present.
 * Optionally updates lastActivity (touch) when not expired.
 */
export async function getOpenIdSession(options = {}) {
    const cookieStore = await cookies();
    const raw = cookieStore.get('openid_session')?.value;
    if (!raw) return null;

    const secret = getAuthSecret();
    if (!secret) return null;

    try {
        const { payload } = await jwtVerify(raw, secret, { algorithms: ['HS256'] });
        const openid = payload;
        const now = Date.now();
        const { idleExpired, absoluteExpired, revoked } = evaluateRecord(openid.sessionId, now, options.touch);

        const tokenExpired = !!openid.expiresAt && now >= openid.expiresAt;
        const jwtExpired = !!openid.exp && (openid.exp * 1000) <= now;
        // "expired" should reflect loss of session, not just access token expiry (refresh can occur)
        const sessionExpired = idleExpired || absoluteExpired || revoked || jwtExpired;

        return {
            payload: openid,
            expired: sessionExpired,
            tokenExpired,
            jwtExpired,
            idleExpired,
            absoluteExpired,
            revoked,
            org: 'geisinger',
            adminFlag: openid.sub.toUpperCase() === 'JBSELTZER@GEISINGER.EDU'
        };
    } catch (err) {
        if (process.env.OPENID_DEBUG === 'true') console.warn('[openidSession] verification failed', err);
        return null;
    }
}

/** Extract minimal safe user object from verified session */
export function getUserFromSession(sess) {
    // Allow user access even if tokenExpired; caller can initiate refresh.
    if (!sess || sess.expired) return null;
    const p = sess.payload;
    console.log(`############################   p.sub.toUpperCase(): ${p.sub.toUpperCase()}, p.Email: ${p.Email}`);
    return {
        nuid: p.sub.toUpperCase(),
        email: p.Email,
        firstName: p.firstName,
        lastName: p.lastName,
        name: p.name,
        org: 'geisinger',
        adminFlag: p.sub.toUpperCase() === 'JBSELTZER@GEISINGER.EDU',
    };
}

function evaluateRecord(sessionId, now, touch) {
    let idleExpired = false;
    let absoluteExpired = false;
    let revoked = false;

    if (!sessionId) return { idleExpired, absoluteExpired, revoked };

    const record = sessionStore.get(sessionId);
    if (!record) {
        // In dev / hot-reload scenarios the in-memory store may be lost. Treat as not expired
        // and rely solely on JWT expiry. This prevents false logout flashes on navigation.
        if (process.env.OPENID_DEBUG === 'true') {
            console.warn('[openidSession] sessionStore record missing for sessionId, using JWT only');
        }
        return { idleExpired, absoluteExpired, revoked };
    }

    const idleMs = +(process.env.OPENID_IDLE_TIMEOUT_MS || 15 * 60 * 1000);
    const absoluteMs = +(process.env.OPENID_ABSOLUTE_TIMEOUT_MS || 8 * 60 * 60 * 1000);

    idleExpired = (now - record.lastActivity) > idleMs;
    absoluteExpired = now >= record.absoluteExpiry;
    revoked = record.revoked;

    if (!idleExpired && !absoluteExpired && !revoked && touch) {
        sessionStore.touch(sessionId, now);
    }

    // leverage absoluteMs to show remaining time (debug only)
    if (process.env.OPENID_DEBUG === 'true' && !absoluteExpired) {
        const remaining = record.absoluteExpiry - now;
        if (remaining > absoluteMs) {
            // Should not happen; log for diagnostic
            console.warn('[openidSession] absolute expiry exceeds configured window', { remaining, absoluteMs });
        }
    }

    return { idleExpired, absoluteExpired, revoked };
}
