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
    const formData = await request.formData();
    const file = formData.get('file');
    const sasUrl = formData.get('sas_url');

    if (!file || !sasUrl) {
      return NextResponse.json({ error: 'Missing file or SAS URL' }, { status: 400 });
    }

    const fileBuffer = await file.arrayBuffer();

    const uploadResponse = await fetch(sasUrl, {
      method: 'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: fileBuffer,
    });

    if (!uploadResponse.ok) {
      return NextResponse.json(
        { error: `Upload failed with status ${uploadResponse.status}` },
        { status: uploadResponse.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Upload file error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
