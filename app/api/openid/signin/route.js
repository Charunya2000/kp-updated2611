import { NextResponse } from 'next/server';
import { randomBytes, createHash } from 'node:crypto';
import { SignJWT } from 'jose';
import { sessionStore, computeSessionTimes } from '@/app/services/sessionStore';

function sanitizeReturnTo(path) {
  if (!path) return '/';
  if (!path.startsWith('/')) return '/';
  if (path.startsWith('//')) return '/';
  return path;
}

async function handleBypassSignin(returnTo, request) {
  const sub = process.env.DEV_USER_NUID;
  const email = process.env.DEV_USER_EMAIL;
  const firstName = process.env.DEV_USER_FIRST_NAME;
  const lastName = process.env.DEV_USER_LAST_NAME;
  const groups = process.env.DEV_USER_GROUPS ? process.env.DEV_USER_GROUPS.split(',').map(g => g.trim()) : [];

  const secretRaw = process.env.AUTH_SECRET;
  if (!secretRaw) return NextResponse.json({ error: 'AUTH_SECRET not configured' }, { status: 500 });
  const secret = new TextEncoder().encode(secretRaw);

  const sessionId = crypto.randomUUID();
  const now = Date.now();
  const times = computeSessionTimes(now);
  sessionStore.create({
    sessionId,
    userId: sub,
    createdAt: times.createdAt,
    lastActivity: times.lastActivity,
    expiresAt: now + 3600 * 1000,
    absoluteExpiry: times.absoluteExpiry,
    refreshToken: null,
    revoked: false,
  });

  const sessionToken = await new SignJWT({
    sub,
    email,
    name: `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    nuid: sub.toUpperCase(),
    groups,
    accessToken: null,
    refreshToken: null,
    expiresAt: now + 3600 * 1000,
    sessionId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);

  const url = new URL(request.url);
  const base = `${url.protocol}//${url.host}`;
  const response = NextResponse.redirect(`${base}${returnTo}`);
  response.cookies.set('openid_session', sessionToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 3600,
    path: '/',
  });
  console.log(`[signin] AUTH_MODE=bypass — signed in as ${sub.toUpperCase()}`);
  return response;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const returnToRaw = searchParams.get('returnTo') || '/';
    const returnTo = sanitizeReturnTo(returnToRaw);

    // Bypass SSO in local development — set AUTH_MODE=bypass in .env.local
    if (process.env.AUTH_MODE === 'bypass') {
      return handleBypassSignin(returnTo, request);
    }

    const state = randomBytes(32).toString('hex');
    const nonce = randomBytes(32).toString('hex');
    const codeVerifier = randomBytes(64).toString('hex');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

    const callbackEnv = process.env.AUTH_CALLBACK_URL;
    let callbackPath;
    try { if (callbackEnv) callbackPath = new URL(callbackEnv).pathname; } catch { callbackPath = undefined; }
    if (!callbackPath?.startsWith('/api/openid/callback')) {
      return NextResponse.json({ error: 'AUTH_CALLBACK_URL must point to /api/openid/callback for OpenID flow', value: callbackEnv }, { status: 500 });
    }

    const authUrl = new URL(process.env.NEXT_PUBLIC_FAM_PREFIX + '/as/authorization.oauth2');
    authUrl.searchParams.set('client_id', process.env.FAM_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', callbackEnv);
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('nonce', nonce);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    const response = NextResponse.redirect(authUrl.toString(), 302);

    const cookieOpts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 600, path: '/' };
    response.cookies.set('openid_state', state, cookieOpts);
    response.cookies.set('openid_nonce', nonce, cookieOpts);
    response.cookies.set('openid_return_to', returnTo, cookieOpts);
    response.cookies.set('openid_code_verifier', codeVerifier, cookieOpts);
    

    return response;
  } catch (error) {
    console.error('OpenID signin error:', error);
    return NextResponse.json({ error: 'Authentication initialization failed' }, { status: 500 });
  }
}
