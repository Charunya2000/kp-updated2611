import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { sessionStore, getTimeoutConfig } from '@/app/services/sessionStore';

function buildUserFromPayload(payload) {

  let modifiedGroups = payload.groups || [];
  const tempAppAdminFix = process.env.USE_VAULT === 'true' && process.env.GEISINGER_APP_ADMINS;
  const userIsTempAdmin = tempAppAdminFix && process.env.GEISINGER_APP_ADMINS.split(",").includes(payload.sub.toUpperCase());
  console.log(`in openid/session route - tempAppAdminFix: ${tempAppAdminFix}, userIsTempAdmin: ${userIsTempAdmin}`);
  if (userIsTempAdmin) {
    modifiedGroups = [...modifiedGroups, 'HPTS_AIPORTAL_ADMIN'];
  }
  console.log(`modifiedGroups: ${JSON.stringify(modifiedGroups)}`);

  const isGeisinger = process.env.USE_VAULT === 'true';

  return {
    id: payload.sub.toUpperCase(),
    email: payload.email,
    name: isGeisinger ? payload.sub : payload.name,
    firstName: payload.firstName,
    lastName: isGeisinger ? payload.sub : payload.lastName,
    nuid: payload.nuid?.toUpperCase() || payload.sub?.toUpperCase(),
    groups: modifiedGroups
  };
}

function buildAnonResponse(reason) {
  return NextResponse.json({ success: true, user: null, authenticated: false, ...(reason ? { reason } : {}) });
}

function expiredJwt(payload) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return !!(payload.exp && payload.exp < nowSeconds);
}

function computeExpiresMillis(payload, fallbackMs) {
  if (typeof payload.expiresAt === 'number') return payload.expiresAt;
  if (payload.exp) return payload.exp * 1000;
  return Date.now() + fallbackMs;
}

export async function GET(request) {
  try {

    const { idleMs: idleLimit } = getTimeoutConfig();
    // console.log(`[session API] Session check - idle timeout: ${Math.floor(idleLimit / 1000)}s`);

    const cookieStore = await (cookies());
    const sessionCookie = cookieStore.get('openid_session');
    if (!sessionCookie?.value) {
      return buildAnonResponse();
    }

    const secretRaw = process.env.AUTH_SECRET;
    if (!secretRaw) {
      return NextResponse.json({ success: false, error: 'auth_secret_missing' }, { status: 500 });
    }

    const secret = new TextEncoder().encode(secretRaw);
    const { payload } = await jwtVerify(sessionCookie.value, secret);
    const sessionId = payload.sessionId;
    if (!sessionId) {
      return buildAnonResponse();
    }

    const record = sessionStore.get(sessionId);
    if (!record) {
      // Ephemeral store fallback: in dev/hot-reload, sessionStore may be lost
      // but JWT is still valid. Don't delete the cookie; just validate JWT.
      const now = Date.now();
      const jwtExpiry = payload.exp ? payload.exp * 1000 : null;
      const timeUntilExpiry = jwtExpiry ? jwtExpiry - now : null;
      const minutesRemaining = timeUntilExpiry ? Math.floor(timeUntilExpiry / 60000) : '?';
      const secondsRemaining = timeUntilExpiry ? Math.floor((timeUntilExpiry % 60000) / 1000) : '?';

      // console.log(`[session API] ⚠️  JWT-only mode (no session record) - ⏱️  ${minutesRemaining}m ${secondsRemaining}s until logout`);

      if (expiredJwt(payload)) {
        return buildAnonResponse();
      }

      const expiresMillis = computeExpiresMillis(payload, 30 * 60 * 1000);
      return NextResponse.json({
        success: true,
        authenticated: true,
        user: buildUserFromPayload(payload),
        expires: new Date(expiresMillis).toISOString(),
        storeFallback: true
      });
    }

    const now = Date.now();
    const idleExpired = now - record.lastActivity > idleLimit;
    const absoluteExpired = now >= record.absoluteExpiry;

    // In development, be lenient: if sessionStore record is old but JWT is valid, keep the session
    // Only delete if explicitly revoked or in production with clear expiry
    if (record.revoked || idleExpired || absoluteExpired) {
      sessionStore.revoke(sessionId);
      let reason = 'revoked';

      if (idleExpired) {
        reason = 'idle_timeout';
      } else if (absoluteExpired) {
        reason = 'absolute_timeout';
      }

      // console.log(`[session API] ⏱️  TIMEOUT! Reason: ${reason}, idle: ${idleExpired}, absolute: ${absoluteExpired}`);

      const resp = buildAnonResponse(reason);
      resp.cookies.set('openid_session', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0, path: '/' });
      return resp;
    }

    // Treat an authenticated session check as activity to avoid false idle expiry during active use.
    sessionStore.touch(sessionId, now);

    // Calculate time remaining for countdown
    const timeRemainingMs = idleLimit;
    const minutesRemaining = Math.floor(timeRemainingMs / 60000);
    const secondsRemaining = Math.floor((timeRemainingMs % 60000) / 1000);

    // console.log(`[session API] ⏱️  Idle countdown - ${minutesRemaining}m ${secondsRemaining}s remaining until logout`);

    if (expiredJwt(payload)) {
      return buildAnonResponse();
    }

    const expiresMillis = computeExpiresMillis(payload, record.expiresAt - now);
    return NextResponse.json({
      success: true,
      authenticated: true,
      user: buildUserFromPayload(payload),
      expires: new Date(expiresMillis).toISOString()
    });
  } catch (error) {
    console.error('Session verification error:', error);
    return NextResponse.json({
      success: false,
      user: null,
      authenticated: false
    });
  }
}
