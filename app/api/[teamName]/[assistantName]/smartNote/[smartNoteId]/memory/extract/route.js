'use server';

import { NextResponse } from 'next/server';
import { createMemoryItem, extractMemoryCandidatesFromText } from '@/app/services/memoryService';

export async function POST(req, { params }) {
  try {
    const { teamName, smartNoteId } = await params;
    const payload = await req.json();

    const candidates = extractMemoryCandidatesFromText({
      prompt: payload.prompt || '',
      response: payload.response || '',
      maxItems: payload.maxItems || 8
    });

    if (!payload.persist) {
      return NextResponse.json({ candidates, persisted: [] }, { status: 200 });
    }

    const persisted = [];
    for (const candidate of candidates) {
      const created = await createMemoryItem(teamName, smartNoteId, {
        ...candidate,
        source: payload.source || 'extraction',
        sourceInteractionId: payload.sourceInteractionId || null
      });
      persisted.push(created);
    }

    return NextResponse.json({ candidates, persisted }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'MemoryExtractRoutePostFailed',
        detail: { error: error.message }
      }
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
