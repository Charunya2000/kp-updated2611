import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.ORCHESTRATION_APP_URL;

export async function GET(request, { params }) {
  try {
    const resolvedParams = await params;
    const path = resolvedParams.path.join('/');
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();

    const backendUrl = `${BACKEND_URL}/api/envtracker/${path}${queryString ? `?${queryString}` : ''}`;

    console.log(`[ENV TRACKER] Proxying GET to: ${backendUrl}`);

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[ENV TRACKER] Backend error: ${response.status}`, error);
      return NextResponse.json(
        { error: 'Backend request failed', details: error },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[ENV TRACKER] Proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    const resolvedParams = await params;
    const path = resolvedParams.path.join('/');
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    const body = await request.json();

    const backendUrl = `${BACKEND_URL}/api/envtracker/${path}${queryString ? `?${queryString}` : ''}`;

    console.log(`[ENV TRACKER] Proxying POST to: ${backendUrl}`);

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[ENV TRACKER] Backend error: ${response.status}`, error);
      return NextResponse.json(
        { error: 'Backend request failed', details: error },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[ENV TRACKER] Proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
