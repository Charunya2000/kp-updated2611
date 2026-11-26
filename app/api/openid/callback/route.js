import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SignJWT } from 'jose';
import { sessionStore, computeSessionTimes } from '@/app/services/sessionStore.js';
import { prepDocument } from '@/app/clientServices/insertDocument';
import { recordUserActive } from '@/app/services/statisticsService';
import { upsertUser } from '@/app/services/userService';

// Dedicated OpenID error path
const OPENID_ERROR_PATH = process.env.OPENID_ERROR_PATH || '/openid/error';

function buildBaseUrl(request) {
  if (process.env.AUTH_URL) return process.env.AUTH_URL.replace(/\/$/, '');
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function sanitizeReturnTo(value) {
  if (!value) return '/';
  if (!value.startsWith('/')) return '/';
  // Prevent attempting to go to the callback or error pages directly again
  if (value.startsWith('/api/openid/callback') || value.startsWith(OPENID_ERROR_PATH)) return '/';
  return value;
}

function pathFromEnvUrl(fullUrl) {
  if (!fullUrl) return null;
  try {
    const u = new URL(fullUrl);
    return u.pathname;
  } catch {
    return null;
  }
}

function redirectWithError(request, errorCode) {
  const base = buildBaseUrl(request);
  const url = new URL(base + OPENID_ERROR_PATH);
  url.searchParams.set('error', errorCode);
  return NextResponse.redirect(url.toString());
}

async function extractCallbackContext(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code') || undefined;
  const state = searchParams.get('state') || undefined;
  const oauthError = searchParams.get('error') || undefined;
  if (oauthError) {
    if (process.env.OPENID_DEBUG === 'true') console.warn('[openid-callback] oauthError param', oauthError, searchParams.get('error_description'));
    return { returnTo: '/', error: searchParams.get('error_description') || oauthError };
  }
  if (!code || !state) return { returnTo: '/', error: 'missing_parameters' };
  // Next.js 15 may expose cookies() as async; await defensively to satisfy both type variants
  const cookieStore = await (cookies());
  const storedState = cookieStore.get('openid_state')?.value;
  if (state !== storedState) return { returnTo: '/', error: 'state_mismatch' };
  const returnToRaw = cookieStore.get('openid_return_to')?.value;
  const returnTo = sanitizeReturnTo(returnToRaw);
  const codeVerifier = cookieStore.get('openid_code_verifier')?.value;
  const redirectUri = process.env.AUTH_CALLBACK_URL;
  const callbackPath = pathFromEnvUrl(redirectUri);
  if (!redirectUri || !callbackPath) return { returnTo, error: 'callback_url_not_configured' };
  if (!callbackPath.startsWith('/api/openid/callback')) return { returnTo, error: 'callback_url_wrong_path' };
  if (!process.env.FAM_CLIENT_ID || !process.env.FAM_CLIENT_SECRET) return { returnTo, error: 'client_credentials_not_configured' };
  if (process.env.OPENID_DEBUG === 'true') console.log('[openid-callback] context extracted', { hasCode: !!code, hasState: !!state, codeVerifier: !!codeVerifier, returnTo });
  return { code, state, redirectUri, returnTo, codeVerifier };
}

async function exchangeCodeForTokens(code, redirectUri, codeVerifier) {
  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: process.env.FAM_CLIENT_ID || '',
    client_secret: process.env.FAM_CLIENT_SECRET || '',
  });
  if (codeVerifier) tokenParams.set('code_verifier', codeVerifier);
  else if (process.env.OPENID_DEBUG === 'true') console.warn('PKCE code_verifier cookie missing');
  const tokenEndpoint = `${process.env.NEXT_PUBLIC_FAM_PREFIX}/as/token.oauth2`;
  if (process.env.OPENID_DEBUG === 'true') {
    // Log params excluding secret
    const debugParams = Object.fromEntries([...tokenParams.entries()].filter(([k]) => k !== 'client_secret'));
    console.log('[openid-callback] token request', { tokenEndpoint, params: debugParams });
  }
  const tokenResponse = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: tokenParams.toString(),
  });
  if (!tokenResponse.ok) {
    let reasonSlug = 'unknown';
    try {
      const failText = await tokenResponse.text();
      if (process.env.OPENID_DEBUG === 'true') console.error('Token exchange failure body:', failText);
      reasonSlug = deriveErrorSlug(failText);
    } catch (e) {
      if (process.env.OPENID_DEBUG === 'true') console.error('Token exchange read body error', e);
    }
    return { error: `token_exchange_failed_${tokenResponse.status}_${reasonSlug}` };
  }
  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) return { error: 'missing_access_token' };
  return tokenData;
}

function deriveErrorSlug(body) {
  if (!body) return 'empty';
  try {
    const asJson = JSON.parse(body);
    const candidate = asJson.error_description || asJson.error || '';
    if (candidate) return slugify(candidate);
  } catch {
    // treat as plain text
  }
  return slugify(body.slice(0, 120));
}

function slugify(str) {
  return str
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/(?:^-+)|(?:-+$)/g, '')
    .slice(0, 60) || 'unknown';
}

async function fetchUserInfo(accessToken) {
  const endpoint = `${process.env.NEXT_PUBLIC_FAM_PREFIX}/idp/userinfo.openid`;
  const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });
  if (!res.ok) return { error: `userinfo_failed_${res.status}` };
  if (process.env.OPENID_DEBUG === 'true') console.log('[openid-callback] userinfo success');
  return { data: await res.json() };
}

async function buildSessionJwt(userinfo, accessToken, refreshToken, expires_in, sessionId) {
  const secretRaw = process.env.AUTH_SECRET;
  if (!secretRaw) throw new Error('auth_secret_not_configured');
  const secret = new TextEncoder().encode(secretRaw);
  // Prefer multiple potential nuid keys
  const nuidCandidate = userinfo.sub || userinfo.nuid || userinfo.employeeNumber || userinfo.employee_number || userinfo.uid || undefined;
  if (process.env.OPENID_DEBUG === 'true') console.log('[openid-callback] userinfo keys', Object.keys(userinfo));
  return new SignJWT({
    sub: userinfo.sub,
    email: userinfo.email || userinfo.Email,
    name: userinfo.name || `${userinfo.FirstName || ''} ${userinfo.LastName || ''}`.trim(),
    firstName: userinfo.given_name || userinfo.FirstName,
    lastName: userinfo.family_name || userinfo.LastName,
    nuid: nuidCandidate ? nuidCandidate.toUpperCase() : undefined,
    groups: typeof (userinfo.Group) === 'string' ? [userinfo.Group]
      : Array.isArray(userinfo.Group) ? userinfo.Group
        : [],
    accessToken,
    refreshToken,
    expiresAt: Date.now() + ((expires_in || 3600) * 1000),
    sessionId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

function clearTempCookies(response) {
  response.cookies.delete('openid_state');
  response.cookies.delete('openid_nonce');
  response.cookies.delete('openid_return_to');
  response.cookies.delete('openid_code_verifier');
}

export async function GET(request) {
  try {
    const ctx = await extractCallbackContext(request);
    if (ctx.error) return redirectWithError(request, ctx.error);
    const tokenData = await exchangeCodeForTokens(ctx.code, ctx.redirectUri, ctx.codeVerifier);
    if (tokenData.error) return redirectWithError(request, tokenData.error);
    const userinfo = await fetchUserInfo(tokenData.access_token);
    if (userinfo.error) return redirectWithError(request, userinfo.error);
    if (!userinfo.data || !tokenData.access_token) return redirectWithError(request, 'missing_session_prerequisites');

    try {
      // console.log('[DEBUG] Raw userinfo.data:', JSON.stringify(userinfo.data, null, 2));

      // Handle groups that can be either array or string
      const groups = typeof (userinfo.data.Group) === 'string' ? [userinfo.data.Group]
        : Array.isArray(userinfo.data.Group) ? userinfo.data.Group
          : [];

      let firstName, lastName, email, nuid, usedGroups;
      const isGeisinger = process.env.USE_VAULT === 'true';
      if (isGeisinger) {
        firstName = userinfo.data.firstName || '';
        lastName = userinfo.data.lastName || '';
        email = userinfo.data.sub;
        nuid = (userinfo.data.sub).toUpperCase();
        usedGroups = userinfo.data.groups;
      }
      else {
        firstName = userinfo.data.FirstName;
        lastName = userinfo.data.LastName;
        email = userinfo.data.Email;
        nuid = (userinfo.data.sub).toUpperCase();
        usedGroups = groups;
      }

      const user = prepDocument({
        firstName,
        lastName,
        email,
        nuid,
        groups: usedGroups
      });

      // console.log('[DEBUG] User object being sent:', JSON.stringify(user, null, 2));

      // record user login for statistics
      recordUserActive(nuid, new Date());

      // add the user to the DB
      upsertUser(user);
    } catch (error) {
      console.error('[openid-callback] User provisioning failed:', error);
      // Continue with login even if user provisioning fails
    }

    if (process.env.OPENID_DEBUG === 'true') console.log('[openid-callback] building session');
    // Create server-side session record
    const sessionId = crypto.randomUUID();
    const now = Date.now();
    const times = computeSessionTimes(now);
    sessionStore.create({
      sessionId,
      userId: userinfo.data.sub,
      createdAt: times.createdAt,
      lastActivity: times.lastActivity,
      expiresAt: now + ((tokenData.expires_in || 3600) * 1000),
      absoluteExpiry: times.absoluteExpiry,
      refreshToken: tokenData.refresh_token,
      revoked: false,
    });
    const sessionToken = await buildSessionJwt(userinfo.data, tokenData.access_token, tokenData.refresh_token, tokenData.expires_in, sessionId);
    const base = buildBaseUrl(request);
    const response = NextResponse.redirect(`${base}${ctx.returnTo}`);
    response.cookies.set('openid_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600,
      path: '/',
    });
    clearTempCookies(response);
    return response;
  } catch (err) {
    console.error('OpenID callback error:', err);
    return redirectWithError(request, 'callback_failed');
  }
}