import { NextResponse } from 'next/server';

export async function OPTIONS(request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const BACKEND_URL = process.env.ORCHESTRATION_APP_URL;

    const resp = await fetch(`${BACKEND_URL}/api/pts/get-upload-urls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      return NextResponse.json({ error: 'Failed to get upload URLs' }, { status: resp.status });
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error('Get upload URLs error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
