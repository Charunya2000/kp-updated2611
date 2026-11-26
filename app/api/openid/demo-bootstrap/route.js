import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { sessionStore, computeSessionTimes } from '@/app/services/sessionStore';

function isEnabled() {
  return process.env.envName === 'dev' && process.env.DEMO_AUTH_BYPASS_ENABLED === 'true';
}

function sanitizeReturnTo(path) {
  if (!path) return '/';
  if (!path.startsWith('/')) return '/';
  if (path.startsWith('//')) return '/';
  return path;
}

function sanitizeNuid(value) {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase();
  if (!/^[A-Z0-9._-]{3,64}$/.test(normalized)) return null;
  return normalized;
}

function unauthorized(message) {
  return NextResponse.json({ error: message }, { status: 401 });
}

function buildBaseUrl(request) {
  if (process.env.AUTH_URL) return process.env.AUTH_URL.replace(/\/$/, '');
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function GET(request) {
  try {
    if (!isEnabled()) return NextResponse.json({ error: 'not_enabled' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token') || '';
    const expected = process.env.DEMO_AUTH_BYPASS_TOKEN || '';
    if (!token || !expected || token !== expected) {
      return unauthorized('invalid_token');
    }

    const nuid = sanitizeNuid(searchParams.get('nuid') || process.env.DEMO_AUTH_BYPASS_DEFAULT_NUID || 'DEMOUSER');
    if (!nuid) return unauthorized('invalid_nuid');

    const returnTo = sanitizeReturnTo(searchParams.get('returnTo') || '/');
    const secretRaw = process.env.AUTH_SECRET;
    if (!secretRaw) return NextResponse.json({ error: 'auth_secret_missing' }, { status: 500 });

    const secret = new TextEncoder().encode(secretRaw);
    const sessionId = crypto.randomUUID();
    const now = Date.now();
    const times = computeSessionTimes(now);

    sessionStore.create({
      sessionId,
      userId: nuid,
      createdAt: times.createdAt,
      lastActivity: times.lastActivity,
      expiresAt: now + (60 * 60 * 1000),
      absoluteExpiry: times.absoluteExpiry,
      revoked: false,
      demoBypass: true,
    });

    const sessionToken = await new SignJWT({
      sub: nuid,
      email: `${nuid.toLowerCase()}@demo.local`,
      name: `Demo ${nuid}`,
      firstName: 'Demo',
      lastName: nuid,
      nuid,
      groups: ['DEMO_BYPASS'],
      expiresAt: now + (60 * 60 * 1000),
      sessionId,
      demoBypass: true,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secret);

    const base = buildBaseUrl(request);
    const response = NextResponse.redirect(`${base}${returnTo}`);
    response.cookies.set('openid_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Demo bootstrap error:', error);
    return NextResponse.json({ error: 'demo_bootstrap_failed' }, { status: 500 });
  }
}
