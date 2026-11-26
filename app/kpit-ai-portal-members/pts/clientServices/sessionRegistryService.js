'use client';

/**
 * PTS Session Registry Client Service
 * 
 * 
 * Session structure:
 * {
 *   sessionId: string,
 *   createdByNUID: string,
 *   createdByName: string,
 *   createdAt: string (ISO),
 *   lastAccessed: string (ISO),
 *   status: string,
 *   hasFiles: boolean,
 *   hasSLA: boolean,
 *   fileCount: number,
 *   sources: string[] (loadrunner, dynatrace, azure)
 * }
 */

const STORAGE_KEY = 'pts_session_registry';

/**
 * Get all sessions from localStorage
 */
export function getAllSessions() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const sessions = stored ? JSON.parse(stored) : [];

        // Sort by lastAccessed descending (most recent first)
        sessions.sort((a, b) => new Date(b.lastAccessed) - new Date(a.lastAccessed));

        return sessions;
    } catch (error) {
        console.error('Error loading sessions from registry:', error);
        return [];
    }
}

/**
 * Get sessions created by a specific user
 */
export function getSessionsByUser(nuid) {
    try {
        const allSessions = getAllSessions();
        return allSessions.filter(session =>
            session.createdByNUID && session.createdByNUID.toUpperCase() === nuid.toUpperCase()
        );
    } catch (error) {
        console.error('Error filtering sessions by user:', error);
        return [];
    }
}

/**
 * Get a specific session by ID
 */
export function getSession(sessionId) {
    try {
        const allSessions = getAllSessions();
        return allSessions.find(session => session.sessionId === sessionId);
    } catch (error) {
        console.error('Error getting session:', error);
        return null;
    }
}

/**
 * Save or update a session in the registry
 */
export function saveSession(sessionData) {
    try {
        const allSessions = getAllSessions();

        // Check if session already exists
        const existingIndex = allSessions.findIndex(
            session => session.sessionId === sessionData.sessionId
        );

        const now = new Date().toISOString();

        if (existingIndex >= 0) {
            // Update existing session
            allSessions[existingIndex] = {
                ...allSessions[existingIndex],
                ...sessionData,
                lastAccessed: now
            };
            console.log('📝 Updated session in registry:', sessionData.sessionId);
        } else {
            // Add new session
            const newSession = {
                ...sessionData,
                createdAt: sessionData.createdAt || now,
                lastAccessed: now
            };
            allSessions.push(newSession);
            console.log('✨ Added new session to registry:', sessionData.sessionId);
        }

        // Save back to localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allSessions));

        return true;
    } catch (error) {
        console.error('Error saving session to registry:', error);
        return false;
    }
}

/**
 * Update session metadata (for tracking file uploads, status changes, etc.)
 */
export function updateSession(sessionId, updates) {
    try {
        const allSessions = getAllSessions();
        const sessionIndex = allSessions.findIndex(
            session => session.sessionId === sessionId
        );

        if (sessionIndex >= 0) {
            allSessions[sessionIndex] = {
                ...allSessions[sessionIndex],
                ...updates,
                lastAccessed: new Date().toISOString()
            };

            localStorage.setItem(STORAGE_KEY, JSON.stringify(allSessions));
            console.log('🔄 Updated session metadata:', sessionId);
            return true;
        }

        return false;
    } catch (error) {
        console.error('Error updating session:', error);
        return false;
    }
}

/**
 * Delete a session from the registry
 */
export function deleteSession(sessionId) {
    try {
        const allSessions = getAllSessions();
        const filteredSessions = allSessions.filter(
            session => session.sessionId !== sessionId
        );

        localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredSessions));
        console.log('🗑️ Deleted session from registry:', sessionId);
        return true;
    } catch (error) {
        console.error('Error deleting session:', error);
        return false;
    }
}

/**
 * Check if current user owns a session
 */
export function isSessionOwner(sessionId, currentUserNUID) {
    try {
        const session = getSession(sessionId);
        if (!session || !session.createdByNUID || !currentUserNUID) {
            return false;
        }

        return session.createdByNUID.toUpperCase() === currentUserNUID.toUpperCase();
    } catch (error) {
        console.error('Error checking session ownership:', error);
        return false;
    }
}

/**
 * Update last accessed time for a session
 */
export function touchSession(sessionId) {
    try {
        updateSession(sessionId, {
            lastAccessed: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error touching session:', error);
    }
}

/**
 * Clean up old sessions (older than specified days)
 */
export function cleanupOldSessions(daysOld = 90) {
    try {
        const allSessions = getAllSessions();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        const recentSessions = allSessions.filter(session => {
            const lastAccessed = new Date(session.lastAccessed || session.createdAt);
            return lastAccessed > cutoffDate;
        });

        localStorage.setItem(STORAGE_KEY, JSON.stringify(recentSessions));

        const cleanedCount = allSessions.length - recentSessions.length;
        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedCount} old sessions`);
        }

        return cleanedCount;
    } catch (error) {
        console.error('Error cleaning up old sessions:', error);
        return 0;
    }
}

/**
 * Export sessions to JSON (for backup or sharing)
 */
export function exportSessions() {
    try {
        const allSessions = getAllSessions();
        const dataStr = JSON.stringify(allSessions, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `pts-sessions-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        console.log('📤 Exported sessions to JSON file');
        return true;
    } catch (error) {
        console.error('Error exporting sessions:', error);
        return false;
    }
}

/**
 * Import sessions from JSON file
 */
export function importSessions(jsonData) {
    try {
        const importedSessions = JSON.parse(jsonData);

        if (!Array.isArray(importedSessions)) {
            throw new Error('Invalid session data format');
        }

        const allSessions = getAllSessions();

        // Merge imported sessions (avoid duplicates)
        importedSessions.forEach(importedSession => {
            const existingIndex = allSessions.findIndex(
                session => session.sessionId === importedSession.sessionId
            );

            if (existingIndex >= 0) {
                // Update if imported is newer
                const existingDate = new Date(allSessions[existingIndex].lastAccessed);
                const importedDate = new Date(importedSession.lastAccessed);

                if (importedDate > existingDate) {
                    allSessions[existingIndex] = importedSession;
                }
            } else {
                // Add new session
                allSessions.push(importedSession);
            }
        });

        localStorage.setItem(STORAGE_KEY, JSON.stringify(allSessions));
        console.log(`📥 Imported ${importedSessions.length} sessions`);
        return true;
    } catch (error) {
        console.error('Error importing sessions:', error);
        return false;
    }
}

/**
 * Get statistics about sessions
 */
export function getSessionStats(currentUserNUID) {
    try {
        const allSessions = getAllSessions();
        const userSessions = currentUserNUID
            ? getSessionsByUser(currentUserNUID)
            : [];

        return {
            totalSessions: allSessions.length,
            mySessions: userSessions.length,
            otherSessions: allSessions.length - userSessions.length,
            withFiles: allSessions.filter(s => s.hasFiles).length,
            withSLA: allSessions.filter(s => s.hasSLA).length,
            completed: allSessions.filter(s => s.status === 'completed').length
        };
    } catch (error) {
        console.error('Error getting session stats:', error);
        return {
            totalSessions: 0,
            mySessions: 0,
            otherSessions: 0,
            withFiles: 0,
            withSLA: 0,
            completed: 0
        };
    }
}
