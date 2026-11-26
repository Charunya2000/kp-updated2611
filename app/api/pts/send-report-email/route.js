import { NextResponse } from 'next/server';
import { sendEmailFromPortal } from '@/app/services/emailService';

export async function POST(request) {
    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { recipients, subject, text, html, sessionId, createdByNUID } = body || {};

    if (!recipients || !subject || (!text && !html)) {
        return NextResponse.json(
            { error: 'recipients, subject, and text/html body are required' },
            { status: 400 }
        );
    }

    try {
        const result = await sendEmailFromPortal({
            recipients,
            subject,
            text,
            html,
            sessionId,
            requestedByNUID: createdByNUID,
        });
        return NextResponse.json({ success: true, recipientCount: result.recipientCount });
    } catch (error) {
        const message = error?.message || '';
        const isValidation =
            message.startsWith('Invalid email address') ||
            message.startsWith('At least one recipient') ||
            message.startsWith('Too many recipients') ||
            message.startsWith('Either text or html') ||
            message.startsWith('subject is required') ||
            message.startsWith('recipients must be');

        console.error(JSON.stringify({
            kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'sendReportEmailRoute',
                detail: { sessionId, error: message },
            },
        }));

        if (isValidation) {
            return NextResponse.json({ error: message }, { status: 400 });
        }
        return NextResponse.json(
            { error: 'Failed to send email' },
            { status: 500 }
        );
    }
}
