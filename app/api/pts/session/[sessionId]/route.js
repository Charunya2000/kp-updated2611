
import { NextResponse } from 'next/server';

export async function GET(request, context) {
  const params = await context.params;
  const sessionId = params.sessionId;

  try {
    const BACKEND_URL = process.env.ORCHESTRATION_APP_URL;

    // Check if this is a session creation request (has createdByNUID query param)
    const url = new URL(request.url);
    const createdByNUID = url.searchParams.get('createdByNUID');

    if (createdByNUID) {
      // Session creation request - first verify session doesn't exist by checking sessions list
      console.log(`🔍 [PTS API] Verifying session ${sessionId} doesn't exist before creating...`);

      // Get all sessions from backend to check if this session already exists
      const sessionsListUrl = `${BACKEND_URL}/api/pts/sessions`;
      const sessionsResp = await fetch(sessionsListUrl, { method: 'GET' });

      if (sessionsResp.ok) {
        const allSessions = await sessionsResp.json();
        console.log(`📋 [PTS API] Retrieved ${allSessions.length} existing sessions for comparison`);

        // Check if session already exists in the list
        const existingSession = allSessions.find(s => s.session_id === sessionId);
        if (existingSession) {
          console.log(`ℹ️ [PTS API] Session ${sessionId} already exists in sessions list, returning existing data`);
          console.log(`👤 [PTS API] Existing session owner: ${existingSession.createdByNUID}`);
          return NextResponse.json(existingSession);
        } else {
          console.log(`✅ [PTS API] Session ${sessionId} confirmed not in sessions list, proceeding with creation`);
        }
      } else {
        console.warn(`⚠️ [PTS API] Could not fetch sessions list (${sessionsResp.status}), proceeding with creation attempt`);
      }

      // Session doesn't exist in list, proceed with creation
      console.log(`🔄 [PTS API] Creating new session ${sessionId} for user ${createdByNUID}`);

      const createUrl = `${BACKEND_URL}/api/pts/session/${sessionId}?createdByNUID=${encodeURIComponent(createdByNUID.toUpperCase())}`;
      const createResp = await fetch(createUrl, {
        method: 'GET'
      });

      if (!createResp.ok) {
        const errorData = await createResp.text().catch(() => 'Unknown error');
        console.error(`❌ [PTS API] Failed to create session: ${createResp.status} ${errorData}`);
        return NextResponse.json({
          error: 'Failed to create session',
          details: errorData
        }, { status: createResp.status });
      }

      const newData = await createResp.json();
      console.log(`✅ [PTS API] Session ${sessionId} created successfully for ${createdByNUID}`);
      return NextResponse.json(newData);
    } else {
      // Regular session fetch request
      const resp = await fetch(`${BACKEND_URL}/api/pts/session/${sessionId}`);

      if (!resp.ok) {
        return NextResponse.json({ error: 'Failed to fetch session' }, { status: resp.status });
      }

      const data = await resp.json();
      return NextResponse.json(data);
    }
  } catch (e) {
    console.error('Session API error', e);
    return NextResponse.json({
      error: 'Internal server error',
      details: e.message
    }, { status: 500 });
  }
}


export async function DELETE(request, context) {
  const params = await context.params;
  const sessionId = params.sessionId;
  let body = null;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request body', message: e.message }, { status: 400 });
  }

  try {
    const BACKEND_URL = process.env.ORCHESTRATION_APP_URL;

    const resp = await fetch(`${BACKEND_URL}/api/pts/session/${sessionId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await resp.json();
    return new Response(JSON.stringify(data), {
      status: resp.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return NextResponse.json({ error: 'Invalid Response', message: e.message }, { status: 400 })
  }

}