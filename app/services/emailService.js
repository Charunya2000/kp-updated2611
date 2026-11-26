import nodemailer from 'nodemailer';

const KP_HOST_PREFIX = 'aiportal-web-2.aisvc.aksnp.azure.kp.org';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 20;

function getMailKey(suffix) {
    const envName = process.env.envName;
    return `host.${envName}-${KP_HOST_PREFIX}.mail.smtp.${suffix}`;
}

function readSmtpConfig() {
    const host = process.env[getMailKey('host')];
    const portRaw = process.env[getMailKey('port')];
    const user = process.env[getMailKey('username')];
    const password = process.env[getMailKey('password')];

    const from = "HealthPlanAIServices@kp.org";

    const missing = [];
    if (!host) missing.push('mail.smtp.host');
    if (!user) missing.push('mail.smtp.username');
    if (!password) missing.push('mail.smtp.password');

    if (missing.length > 0) {
        console.error(JSON.stringify({
            kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'sendEmail',
                detail: { error: `Missing SMTP config: ${missing.join(', ')}` },
            },
        }));
        throw new Error('Email service is not configured');
    }

    let port = Number(portRaw);
    if (!Number.isFinite(port) || port <= 0) {
        console.warn(JSON.stringify({
            kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'sendEmail',
                detail: { error: `Invalid mail.smtp.port "${portRaw}", defaulting to 587` },
            },
        }));
        port = 587;
    }

    return { host, port, user, password, from };
}

function normalizeRecipients(recipients) {
    let list;
    if (Array.isArray(recipients)) {
        list = recipients;
    } else if (typeof recipients === 'string') {
        list = recipients.split(',');
    } else {
        throw new Error('recipients must be a string or array');
    }

    const cleaned = [...new Set(
        list.map((r) => String(r).trim()).filter((r) => r.length > 0)
    )];

    if (cleaned.length === 0) {
        throw new Error('At least one recipient email is required');
    }
    if (cleaned.length > MAX_RECIPIENTS) {
        throw new Error(`Too many recipients (max ${MAX_RECIPIENTS})`);
    }
    for (const email of cleaned) {
        if (!EMAIL_REGEX.test(email)) {
            throw new Error(`Invalid email address: ${email}`);
        }
    }
    return cleaned;
}

export async function sendEmail({ to, subject, text, html }) {
    const { host, port, user, password, from } = readSmtpConfig();

    const toList = Array.isArray(to) ? to.join(', ') : to;

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass: password },
    });

    try {
        const info = await transporter.sendMail({
            from,
            to: toList,
            subject,
            text,
            html,
        });

        console.log(JSON.stringify({
            kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'sendEmail',
                detail: {
                    recipientCount: Array.isArray(to) ? to.length : toList.split(',').length,
                    subject,
                    messageId: info?.messageId,
                },
            },
        }));

        return { success: true, messageId: info?.messageId };
    } catch (error) {
        console.error(JSON.stringify({
            kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'sendEmail',
                detail: { subject, error: error.message },
            },
        }));
        throw error;
    }
}

export async function sendEmailFromPortal({
    recipients,
    subject,
    text,
    html,
    sessionId,
    requestedByNUID,
}) {
    const cleanRecipients = normalizeRecipients(recipients);

    if (typeof subject !== 'string' || !subject.trim()) {
        throw new Error('subject is required');
    }
    if ((typeof text !== 'string' || !text.trim()) && (typeof html !== 'string' || !html.trim())) {
        throw new Error('Either text or html body is required');
    }

    console.log(JSON.stringify({
        kpmsg: {
            id: 'AI_PORTAL_NOTEBOOK',
            name: 'sendEmailFromPortal',
            detail: {
                sessionId,
                recipientCount: cleanRecipients.length,
                requestedByNUID,
            },
        },
    }));

    await sendEmail({ to: cleanRecipients, subject, text, html });

    return { success: true, recipientCount: cleanRecipients.length };
}
