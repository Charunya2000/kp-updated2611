import { NextResponse } from 'next/server';

export async function POST(request, context) {
  const params = await context.params;
  const sessionId = params.sessionId;

  try {
    const body = await request.json();
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

    const resp = await fetch(`${BACKEND_URL}/api/pts/adjust-sla/${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      return NextResponse.json({ error: 'Failed to adjust SLA' }, { status: resp.status });
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error('Adjust SLA error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
