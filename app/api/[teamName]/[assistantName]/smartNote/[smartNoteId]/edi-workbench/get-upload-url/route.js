import path from 'node:path';
import { NextResponse } from 'next/server';
import { generateTemporaryUploadLink } from '@/app/services/blobStorageService';

function sanitizeSegment(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-');
}

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;
    const { fileName, fileCategory } = await req.json();

    if (!fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
    }

    const safeFileName = sanitizeSegment(path.basename(fileName));
    const safeCategory = sanitizeSegment(fileCategory || 'edi');
    const containerName = `uploadeddocuments-${String(teamName).toLowerCase()}`;
    const blobName = `${sanitizeSegment(assistantName)}/${sanitizeSegment(smartNoteId)}/edi-workbench/${safeCategory}/${Date.now()}-${safeFileName}`;

    const sasUrl = await generateTemporaryUploadLink(containerName, blobName, 15);

    return NextResponse.json({
      sas_url: sasUrl,
      container: containerName,
      blobName,
      fileName: safeFileName,
      fileCategory: safeCategory,
    }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'ediWorkbenchGetUploadUrl',
        detail: { error: error?.message || 'Failed to generate upload URL' },
      },
    }));

    return NextResponse.json({ error: error?.message || 'Failed to generate upload URL' }, { status: 500 });
  }
}
