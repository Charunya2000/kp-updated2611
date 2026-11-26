import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { sessionStore } from '@/app/services/sessionStore';

export async function POST(request) {
    try {
        const { returnTo } = await request.json().catch(() => ({ returnTo: '/' }));
        const cookieStore = await (cookies());
        const sessionCookie = cookieStore.get('openid_session');
        const response = NextResponse.json({ success: true, redirectUrl: returnTo });
        response.cookies.set('openid_session', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0, path: '/' });
        if (sessionCookie?.value) {
            try {
                const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
                const { payload } = await jwtVerify(sessionCookie.value, secret);
                const sessionId = payload.sessionId;
                if (sessionId) sessionStore.revoke(sessionId);
                if (payload.accessToken && process.env.FAM_CLIENT_ID && process.env.FAM_CLIENT_SECRET) {
                    try {
                        await fetch(`${process.env.NEXT_PUBLIC_FAM_PREFIX}/as/revoke_token.oauth2`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: payload.accessToken, token_type_hint: 'access_token', client_id: process.env.FAM_CLIENT_ID, client_secret: process.env.FAM_CLIENT_SECRET }) });
                    } catch (revokeError) { console.warn('Token revocation failed:', revokeError); }
                }
            } catch (revokeError) { console.warn('Token revocation failed:', revokeError); }
        }
        return response;
    } catch (error) {
        console.error('Signout error:', error);
        return NextResponse.json({ error: 'logout_failed' }, { status: 500 });
    }
}

export async function GET(request) { return POST(request); }
