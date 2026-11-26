'use client';

export async function sendEmailFromPortal({ recipients, subject, text, html, sessionId, createdByNUID }) {
    const response = await fetch('/api/pts/send-report-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients, subject, text, html, sessionId, createdByNUID }),
    });

    let data = null;
    try {
        data = await response.json();
    } catch {
        // ignore body parse errors
    }

    if (!response.ok) {
        const message = (data && data.error) || `Request failed with status ${response.status}`;
        throw new Error(message);
    }

    return data || { success: true };
}
