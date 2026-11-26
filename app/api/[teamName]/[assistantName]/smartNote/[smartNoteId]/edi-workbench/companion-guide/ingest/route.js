import { NextResponse } from 'next/server';
import { ingestEditableCompanionGuideFromBlob } from '@/app/services/ediWorkbenchService';

export async function POST(req) {
  try {
    const { companion, treatSlashAsComma = true } = await req.json();

    if (!companion?.container || !companion?.blobName) {
      return NextResponse.json({ error: 'Companion guide file location is required' }, { status: 400 });
    }

    const result = await ingestEditableCompanionGuideFromBlob({
      companionContainer: companion.container,
      companionBlobName: companion.blobName,
      treatSlashAsComma: treatSlashAsComma !== false,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'ingestEditableCompanionGuide',
        detail: { error: error?.message || 'Failed to ingest companion guide' },
      },
    }));

    return NextResponse.json(
      { error: error?.message || 'Failed to ingest companion guide' },
      { status: 500 },
    );
  }
}