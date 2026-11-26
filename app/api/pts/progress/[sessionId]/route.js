import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.ORCHESTRATION_APP_URL;

// GET /api/pts/progress/[sessionId]?progress_id=...
export async function GET(request, context) {
  try {
    const { searchParams } = new URL(request.url);
    const progressId = searchParams.get('progress_id');

    // params is now async – await it
    const { sessionId } = await context.params;

    const url = new URL(
      `/api/pts/progress/${encodeURIComponent(sessionId)}`,
      BACKEND_URL
    );
    if (progressId) {
      url.searchParams.set('progress_id', progressId);
    }

    console.log('[Next API] Forwarding to backend:', url.toString());

    const resp = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!resp.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch progress' },
        { status: resp.status }
      );
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error('Progress proxy error', e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}