import { NextResponse, NextRequest } from 'next/server';
import { getOpenIdSession } from '@/lib/openidSession';
import { getOpenIdSession as getOpenIdSessionGeisinger } from '@/lib/openidSessionGeisinger'; // ensure sessionStore is initialized
import { sessionStore } from '@/app/services/sessionStore';

// Paths considered public (no auth required)
const PUBLIC_PATH_PREFIXES = [
  '/api/openid/signin',
  '/api/openid/callback',
  '/api/openid/session',
  '/api/openid/refresh',
  '/api/openid/signout',
  '/api/user', // internal route called by app itself
  '/api/snow', // internal route called by app itself
  '/api/proxy',
  '/api/statistics', // api for python app to call
  '/api/nps/npschatbot/nps', // NPS chatbot endpoint
  '/api/npscmat/cmatchatbot/cmat', // NPS CMAT chatbot endpoint
  '/api/bcs/bcschatbot/bcs', // BCS chatbot endpoint
  '/api/customer-and-contracts/free-text-to-json/completions', // CAC free-text-to-json endpoint
  '/api/admin/messaging/active', // api for getting application messages to display in header
  '/api/nexus/completions', // api for chat completions (used by orchestration app)
  '/api/nexus/embeddings', // api for embeddings (used by orchestration app)
  '/',
  '/health',
  '/error',
  '/livenessprobe',
  '/openid-test',
  '/no-assistants',
  '/_next',
  '/favicon.ico',
  '/public',
];

function isPublicPath(pathname) {
  return PUBLIC_PATH_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));
}

export async function proxy(req) {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Attempt session verification with activity touch to extend idle timeout
  let verified;
  if (typeof process.env.USE_VAULT !== 'undefined' && process.env.USE_VAULT === 'true') {
    verified = await getOpenIdSessionGeisinger({ touch: true });
  } else {
    verified = await getOpenIdSession({ touch: true });
  }

  if (process.env.OPENID_DEBUG === 'true') {
    let absoluteRemaining;
    let recordExists = false;
    if (verified?.payload.sessionId) {
      const rec = sessionStore.get(verified.payload.sessionId);
      if (rec) {
        recordExists = true;
        absoluteRemaining = rec.absoluteExpiry - Date.now();
      }
    }
    console.log('[middleware] session check', {
      path: pathname,
      hasSession: !!verified,
      expired: verified?.expired,
      idleExpired: verified?.idleExpired,
      absoluteExpired: verified?.absoluteExpired,
      jwtExpired: verified?.jwtExpired,
      recordExists,
      absoluteRemaining,
      jwtExpMs: verified?.payload.exp ? (verified.payload.exp * 1000) : undefined,
      now: Date.now(),
    });
  }
  if (verified && !verified.expired) {
    return NextResponse.next();
  }

  // Redirect to sign-in with returnTo preserving original path
  const signInUrl = new URL(req.nextUrl.origin + '/api/openid/signin');
  signInUrl.searchParams.set('returnTo', pathname);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};