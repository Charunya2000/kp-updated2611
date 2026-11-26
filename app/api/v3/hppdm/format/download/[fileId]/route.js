import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { fileId } = await params;


    const backendBaseUrl = process.env.ORCHESTRATION_APP_URL;
    const backendUrl = `${backendBaseUrl}/api/v3/hppdm/format/download/${encodeURIComponent(fileId)}`;

    const response = await fetch(backendUrl, {
      method: 'GET',
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `Backend error: ${response.status}`, details: text },
        { status: response.status }
      );
    }

    // Return the file as-is (binary or content)
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentDisposition = response.headers.get('content-disposition') || 'attachment';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
      },
    });
  } catch (error) {
    console.error('Error in download:', error);
    return NextResponse.json(
      { error: 'Failed to download file', details: error.message },
      { status: 500 }
    );
  }
}
