import { NextResponse } from 'next/server';

export async function POST(request) {
  try {

    const backendBaseUrl = process.env.ORCHESTRATION_APP_URL;
    const backendUrl = `${backendBaseUrl}/api/v3/hppdm/format/convert`;

    console.log('Proxying to backend:', backendUrl);

    const body = await request.json();

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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
    console.error('Error in convert:', error);
    return NextResponse.json(
      { error: 'Failed to trigger conversion', details: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
