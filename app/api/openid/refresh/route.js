import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify, SignJWT } from 'jose';
import { sessionStore, getTimeoutConfig } from '@/app/services/sessionStore';
import * as client from 'openid-client';

function normalizeExpiresAtMs(expiresAt, now) {
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) {
    return now + 3600 * 1000;
  }
  // OIDC providers typically return epoch seconds; convert to ms for internal consistency.
  return expiresAt < 1e12 ? expiresAt * 1000 : expiresAt;
}

export async function POST() {
  try {
    const cookieStore = await (cookies());
    const sessionCookie = cookieStore.get('openid_session');
    if (!sessionCookie?.value) return NextResponse.json({ error: 'no_session' }, { status: 401 });
    const secretRaw = process.env.AUTH_SECRET;
    if (!secretRaw) return NextResponse.json({ error: 'auth_secret_missing' }, { status: 500 });
    const secret = new TextEncoder().encode(secretRaw);
    const { payload } = await jwtVerify(sessionCookie.value, secret);
    const sessionId = payload.sessionId;
    if (!sessionId) return NextResponse.json({ error: 'invalid_session' }, { status: 401 });
    const record = sessionStore.get(sessionId);
    const now = Date.now();
    if (!record) return NextResponse.json({ error: 'session_expired' }, { status: 401 });
    const { idleMs: idleLimit } = getTimeoutConfig();
    const idleExpired = now - record.lastActivity > idleLimit;
    const absoluteExpired = now >= record.absoluteExpiry;
    if (record.revoked || idleExpired || absoluteExpired) {
      sessionStore.revoke(sessionId);
      let reason = 'revoked';
      if (idleExpired) reason = 'idle_timeout'; else if (absoluteExpired) reason = 'absolute_timeout';
      return NextResponse.json({ error: reason }, { status: 401 });
    }
    record.lastActivity = now;
    if (!payload.refreshToken) {
      // AUTH_MODE=bypass: no real refresh token — re-issue the JWT from existing payload to extend session
      if (process.env.AUTH_MODE === 'bypass') {
        const newExpiry = now + 3600 * 1000;
        const newSessionToken = await new SignJWT({
          ...payload,
          expiresAt: newExpiry,
          iat: undefined,
          exp: undefined,
        })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .setExpirationTime('1h')
          .sign(secret);
        record.expiresAt = newExpiry;
        const response = NextResponse.json({
          success: true,
          user: { id: payload.sub, email: payload.email, name: payload.name, firstName: payload.firstName, lastName: payload.lastName, nuid: payload.nuid },
          expiresAt: newExpiry,
        });
        response.cookies.set('openid_session', newSessionToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 3600, path: '/' });
        return response;
      }
      return NextResponse.json({ error: 'no_refresh_token' }, { status: 401 });
    }
    const config = await client.discovery(new URL(process.env.NEXT_PUBLIC_FAM_PREFIX), process.env.FAM_CLIENT_ID, process.env.FAM_CLIENT_SECRET);
    const tokenSet = await client.refreshTokenGrant(config, payload.refreshToken);
    const userinfo = await client.fetchUserInfo(config, tokenSet.access_token, payload.sub);
    const refreshedExpiresAt = normalizeExpiresAtMs(tokenSet.expires_at, now);
    const refreshedGroups = typeof (userinfo.Group) === 'string' ? [userinfo.Group]
      : Array.isArray(userinfo.Group) ? userinfo.Group
        : (payload.groups || []);
    const newSessionToken = await new SignJWT({ sub: userinfo.sub, email: userinfo.email || userinfo.Email, name: userinfo.name || `${userinfo.FirstName} ${userinfo.LastName}`, firstName: userinfo.given_name || userinfo.FirstName, lastName: userinfo.family_name || userinfo.LastName, nuid: userinfo.nuid || userinfo.employeeNumber, groups: refreshedGroups, accessToken: tokenSet.access_token, refreshToken: tokenSet.refresh_token || payload.refreshToken, expiresAt: refreshedExpiresAt, sessionId })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secret);
    const response = NextResponse.json({ success: true, user: { id: userinfo.sub, email: userinfo.email || userinfo.Email, name: userinfo.name || `${userinfo.FirstName} ${userinfo.LastName}`, firstName: userinfo.given_name || userinfo.FirstName, lastName: userinfo.family_name || userinfo.LastName, nuid: userinfo.nuid || userinfo.employeeNumber }, expiresAt: refreshedExpiresAt });
    response.cookies.set('openid_session', newSessionToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 3600, path: '/' });
    record.expiresAt = refreshedExpiresAt;
    return response;
  } catch (error) {
    console.error('Token refresh error:', error);
    const response = NextResponse.json({ error: 'token_refresh_failed' }, { status: 401 });
    response.cookies.set('openid_session', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0, path: '/' });
    return response;
  }
}
