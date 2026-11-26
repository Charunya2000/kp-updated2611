import { NextResponse } from 'next/server';

export async function GET(request, context) {
  const params = await context.params;
  const sessionId = params.sessionId;
  const { searchParams } = new URL(request.url);
  const sourceType = searchParams.get('source_type') || 'loadrunner';

  console.log(`[PTS] Checking session files from blob storage - Session: ${sessionId}, Source: ${sourceType}`);

  try {
    // Proxy all requests (including source_type=sla) to Python backend
    const BACKEND_URL = process.env.ORCHESTRATION_APP_URL;
    const backendUrl = `${BACKEND_URL}/api/pts/check-session-files/${sessionId}?source_type=${sourceType}`;

    console.log(`[PTS] Forwarding request to Python backend: ${backendUrl}`);

    const resp = await fetch(backendUrl);

    if (!resp.ok) {
      console.error(`[PTS] Backend returned error status: ${resp.status}`);
      return NextResponse.json({ error: 'Failed to check session files' }, { status: resp.status });
    }

    const data = await resp.json();
    console.log(`[PTS] Raw response from backend for ${sourceType}:`, JSON.stringify(data, null, 2));

    if (sourceType === 'sla') {
      console.log(`[PTS] SLA files from blob storage:`, data.data_files?.found || []);
      console.log(`[PTS] SLA file info:`, data.sla_file);
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'GET: Check Session Files',
        detail: {
          error: e.message,
          sessionId,
          sourceType
        }
      }
    }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
