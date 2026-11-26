import { NextResponse } from 'next/server';
import {
  parseAndEnrichEdiFromBlob,
  sanitizeEdiWorkbenchWorkerResult,
} from '@/app/services/ediWorkbenchService';

export async function POST(req) {
  try {
    const { edi, companion } = await req.json();

    if (!edi?.container || !edi?.blobName) {
      return NextResponse.json({ error: 'EDI file location is required' }, { status: 400 });
    }

    if (!companion?.container || !companion?.blobName) {
      return NextResponse.json({ error: 'Companion guide file location is required' }, { status: 400 });
    }

    const result = await parseAndEnrichEdiFromBlob({
      ediContainer: edi.container,
      ediBlobName: edi.blobName,
      companionContainer: companion.container,
      companionBlobName: companion.blobName,
    });

    return NextResponse.json(sanitizeEdiWorkbenchWorkerResult(result), { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'ediWorkbenchParse',
        detail: { error: error?.message || 'Failed to parse EDI file' },
      },
    }));

    return NextResponse.json({ error: error?.message || 'Failed to parse EDI file' }, { status: 500 });
  }
}
