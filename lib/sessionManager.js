/**
 * Client-side session storage manager
 * Uses localStorage as a fast cache hint only (server is source of truth)
 * Stores session data with basic encoding for obfuscation
 */

const SESSION_STORAGE_KEY = 'openid_session_cache';
const SESSION_EXPIRY_BUFFER_MS = 1 * 60 * 1000; // 5 minutes before actual expiry

export const sessionManager = {
    /**
     * Store session in localStorage with basic encoding
     */
    storeSession(session) {
        if (!session || !session.user) return;
        try {
            const cached = {
                user: session.user,
                accessToken: session.accessToken || '',
                refreshToken: session.refreshToken,
                expires: session.expires,
                storedAt: Date.now(),
            };
            const sessionData = JSON.stringify(cached);
            // Basic encoding (not encryption, just obfuscation)
            const encoded = btoa(sessionData);
            localStorage.setItem(SESSION_STORAGE_KEY, encoded);
        } catch (e) {
            if (process.env.OPENID_DEBUG === 'true') {
                console.warn('[sessionManager] Failed to store session:', e);
            }
        }
    },

    /**
     * Retrieve cached session from localStorage
     */
    getStoredSession() {
        if (process.env.OPENID_DEBUG === 'true') {
            console.log('[sessionManager] getStoredSession called');
        }
        try {
            const encoded = localStorage.getItem(SESSION_STORAGE_KEY);
            if (process.env.OPENID_DEBUG === 'true') {
                console.log('[sessionManager] encoded:', !!encoded);
            }
            if (!encoded) return null;

            // Decode the session data
            const sessionData = atob(encoded);
            const session = JSON.parse(sessionData);
            if (process.env.OPENID_DEBUG === 'true') {
                console.log('[sessionManager] decoded session user:', session.user?.id);
            }

            // Check if session is expired
            const expiresAt = new Date(session.expires).getTime();
            const now = Date.now();
            if (expiresAt <= now) {
                if (process.env.OPENID_DEBUG === 'true') {
                    console.warn('[sessionManager] Session expired, clearing');
                }
                this.clearSession();
                return null;
            }

            return session;
        } catch (error) {
            if (process.env.OPENID_DEBUG === 'true') {
                console.error('[sessionManager] Failed to retrieve session:', error);
            }
            this.clearSession(); // Clear corrupted session
            return null;
        }
    },

    /**
     * Clear session from localStorage
     */
    clearSession() {
        try {
            localStorage.removeItem(SESSION_STORAGE_KEY);
        } catch (e) {
            if (process.env.OPENID_DEBUG === 'true') {
                console.warn('[sessionManager] Failed to clear session:', e);
            }
        }
    },

    /**
     * Check if stored session needs refresh based on expiry time
     * Returns true if session expires within buffer window
     */
    needsRefresh(session) {
        if (!session || !session.expires) return true;
        try {
            const expiresAt = new Date(session.expires).getTime();
            const now = Date.now();
            const timeUntilExpiry = expiresAt - now;
            return timeUntilExpiry < SESSION_EXPIRY_BUFFER_MS;
        } catch (e) {
            if (process.env.OPENID_DEBUG === 'true') {
                console.warn('[sessionManager] Failed to check refresh need:', e);
            }
            return true;
        }
    },

    /**
     * Update just the tokens (keep user data)
     */
    updateTokens(accessToken, refreshToken, expires) {
        const currentSession = this.getStoredSession();
        if (!currentSession) return;

        const updatedSession = {
            ...currentSession,
            accessToken: accessToken || currentSession.accessToken,
            refreshToken: refreshToken || currentSession.refreshToken,
            expires: expires ? new Date(expires).toISOString() : currentSession.expires,
            storedAt: Date.now(),
        };

        this.storeSession(updatedSession);
    },
};
