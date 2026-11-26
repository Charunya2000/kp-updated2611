// Proxy route: forwards all /api/qtest-search/* requests to the backend search service.
// Auth: requires a valid session — no team restriction (open to all teams with a qTest project).
// Env vars:
//   QTEST_SEARCH_BASE_URL  - explicit local override for development
//   ORCHESTRATION_APP_URL  - deployed orchestration app base URL, already env-specific
import { getServerSession } from '@utils/getSession';
import { NextResponse } from 'next/server';

// Env vars (in priority order):
//   QTEST_SEARCH_BASE_URL  - explicit override (e.g. http://localhost:8080 in local dev)
//   ORCHESTRATION_APP_URL  - orchestration app URL resolved from KP config per environment
const QTEST_SEARCH_BASE = process.env.QTEST_SEARCH_BASE_URL
  || process.env.ORCHESTRATION_APP_URL
  || 'http://localhost:8080';

const normalizeBaseUrl = (url) => url.replace(/\/+$/, '');

async function proxy(req, { params }) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { path } = await params;
    const { searchParams } = new URL(req.url);
    const queryString = searchParams.toString();
    const backendPath = path.join('/');
    const searchBaseUrl = normalizeBaseUrl(QTEST_SEARCH_BASE);
    const backendUrl = queryString
      ? `${searchBaseUrl}/api/qtest-search/${backendPath}?${queryString}`
      : `${searchBaseUrl}/api/qtest-search/${backendPath}`;

    const init = { method: req.method };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const body = await req.text();
      init.body = body;
      init.headers = { 'Content-Type': 'application/json' };
    }

    const response = await fetch(backendUrl, init);
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'qtestSearchProxy', detail: { error: error.message } }
    }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET  = proxy;
export const POST = proxy;
