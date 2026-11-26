import { NextResponse } from 'next/server';

export async function POST(request, context) {
  const params = await context.params;
  const sessionId = params.sessionId;

  try {
    const body = await request.json().catch(() => ({}));
    const BACKEND_URL = process.env.ORCHESTRATION_APP_URL;

    let createdByNUID = body?.createdByNUID;
    if (!createdByNUID && sessionId) {
      const existingSessionResp = await fetch(`${BACKEND_URL}/api/pts/session/${sessionId}`, {
        method: 'GET',
      });
      if (existingSessionResp.ok) {
        const existingSession = await existingSessionResp.json();
        createdByNUID = existingSession?.createdByNUID || '';
      }
    }

    const payload = {
      ...body,
      ...(createdByNUID ? { createdByNUID } : {}),
    };

    const resp = await fetch(`${BACKEND_URL}/api/pts/load-sla/${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      return NextResponse.json({ error: 'Failed to load SLA' }, { status: resp.status });
    }

    const data = await resp.json();
    console.log(`✅ Loaded SLA data from blob storage for session ${sessionId}`);

    return NextResponse.json(data);
  } catch (e) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'POST: Load SLA',
        detail: {
          error: e.message,
          sessionId
        }
      }
    }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
