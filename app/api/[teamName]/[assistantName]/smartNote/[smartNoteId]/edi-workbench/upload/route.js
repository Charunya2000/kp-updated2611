import path from 'node:path';
import { NextResponse } from 'next/server';
import { writeFileBufferToBlobStorage } from '@/app/services/blobStorageService';

function sanitizeSegment(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-');
}

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;
    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get('fileName');
    const fileCategory = searchParams.get('fileCategory') || 'edi';

    if (!fileName) {
      return NextResponse.json({ error: 'A valid file name is required' }, { status: 400 });
    }

    const safeFileName = sanitizeSegment(path.basename(fileName));
    const safeCategory = sanitizeSegment(fileCategory);
    const containerName = `uploadeddocuments-${String(teamName).toLowerCase()}`;
    const blobName = `${sanitizeSegment(assistantName)}/${sanitizeSegment(smartNoteId)}/edi-workbench/${safeCategory}/${Date.now()}-${safeFileName}`;

    const arrayBuffer = await req.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      return NextResponse.json({ error: 'A non-empty file is required' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(arrayBuffer);
    const contentType = req.headers.get('content-type') || 'application/octet-stream';
    const isWriteSuccess = await writeFileBufferToBlobStorage(fileBuffer, containerName, blobName, contentType);

    if (!isWriteSuccess) {
      return NextResponse.json({ error: 'Failed to upload file to blob storage' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      container: containerName,
      blobName,
      fileName: safeFileName,
      fileCategory: safeCategory,
    }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'ediWorkbenchUpload',
        detail: { error: error?.message || 'Failed to upload file' },
      },
    }));

    return NextResponse.json({ error: error?.message || 'Failed to upload file' }, { status: 500 });
  }
}
