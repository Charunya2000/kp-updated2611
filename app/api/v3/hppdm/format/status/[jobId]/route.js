import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { jobId } = await params;

    const backendBaseUrl = process.env.ORCHESTRATION_APP_URL;
    const backendUrl = `${backendBaseUrl}/api/v3/hppdm/format/status/${encodeURIComponent(jobId)}`;

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `Backend error: ${response.status}`, details: text },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in status check:', error);
    return NextResponse.json(
      { error: 'Failed to check status', details: error.message },
      { status: 500 }
    );
  }
}
