/**
 * Single catch-all route for /api/ets/defect-insight-navigator/[...path]
 *
 * Handles three categories of requests:
 *   • Smart note CRUD  — path starts with "smartNote" or "smartNotes"
 *   • JIRA search proxy — path starts with one of the JIRA_PATHS segments
 *
 * Having everything in one file removes the need for the four separate route.js
 * files that previously lived next to this catch-all.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from '@utils/getSession';
import { createSmartNote, selectSmartNote, updateSmartNote, deleteSmartNote } from '@services/smartNoteService';
import { selectSmartNotesByTeam } from '@/app/services/smartNotesService';

function resolveJiraBaseUrl() {
  // ORCHESTRATION_APP_URL is set from KP Config (platform.services.orchestration.app.url)
  // and points to the same per-environment BFF host as the JIRA search backend.
  return (process.env.ORCHESTRATION_APP_URL || '').trim() || 'http://127.0.0.1:8080';
}

// Resolved lazily per-request so the value always reflects the env vars set
// by configActions.js at server startup (avoids module-init ordering issues).
function getJiraBase() { return resolveJiraBaseUrl(); }
const TEAM = 'ets';
const ASSISTANT = 'defect-insight-navigator';

const JIRA_PATHS = new Set([
  'rca', 'rca-summary', 'rca-analytics', 'feedback', 'team-insights', 'health', 'config-summary',
]);

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

function kplog(name, detail) {
  console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name, detail } }));
}

async function handler(req, { params }) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { path } = await params;
  const [seg0, seg1] = path || [];

  // ── Smart note: create ─────────────────────────────────────────────
  // POST /api/ets/defect-insight-navigator/smartNote
  if (seg0 === 'smartNote' && !seg1) {
    if (req.method !== 'POST') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
    try {
      const doc = await req.json();
      const result = await createSmartNote(doc, TEAM, ASSISTANT);
      return NextResponse.json(result);
    } catch (e) {
      kplog('createSmartNote', { error: e.message });
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  // ── Smart note: read / update / delete ─────────────────────────────
  // GET | PUT | DELETE /api/ets/defect-insight-navigator/smartNote/[id]
  if (seg0 === 'smartNote' && seg1) {
    const query = { type: 'SmartNote', parentId: { $exists: true }, id: seg1 };
    try {
      if (req.method === 'GET') {
        return NextResponse.json(await selectSmartNote(query, TEAM));
      }
      if (req.method === 'PUT') {
        const body = await req.json();
        body.id = seg1;
        return NextResponse.json(await updateSmartNote(body, TEAM));
      }
      if (req.method === 'DELETE') {
        return NextResponse.json(await deleteSmartNote(query, TEAM));
      }
      return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
    } catch (e) {
      kplog('smartNoteCrud', { id: seg1, method: req.method, error: e.message });
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  // ── Smart notes: list ──────────────────────────────────────────────
  // GET /api/ets/defect-insight-navigator/smartNotes/selectedUserAssistant
  if (seg0 === 'smartNotes' && seg1 === 'selectedUserAssistant') {
    try {
      return NextResponse.json(await selectSmartNotesByTeam(TEAM, ASSISTANT));
    } catch (e) {
      kplog('listSmartNotes', { error: e.message });
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  // ── JIRA search proxy ──────────────────────────────────────────────
  if (!JIRA_PATHS.has(seg0)) {
    return NextResponse.json({ error: `Unknown endpoint: ${seg0}` }, { status: 404, headers: NO_STORE });
  }

  try {
    const pathStr = path.join('/');
    const qs = new URL(req.url).searchParams.toString();
    const base = getJiraBase().replace(/\/+$/, '');
    const url = qs ? `${base}/api/jira-search/${pathStr}?${qs}` : `${base}/api/jira-search/${pathStr}`;

    const init = { method: req.method, headers: { Accept: 'application/json' } };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      init.body = await req.text();
      init.headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, init);
    const text = await res.text();
    if (!text) return new NextResponse(null, { status: res.status, headers: NO_STORE });

    try {
      return NextResponse.json(JSON.parse(text), { status: res.status, headers: NO_STORE });
    } catch {
      return new NextResponse(text, {
        status: res.status,
        headers: { 'Content-Type': res.headers.get('Content-Type') || 'text/plain', ...NO_STORE },
      });
    }
  } catch (e) {
    kplog('jiraSearchProxy', { error: e.message });
    return NextResponse.json({ error: `JIRA search backend unreachable: ${e.message}` }, { status: 500, headers: NO_STORE });
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
