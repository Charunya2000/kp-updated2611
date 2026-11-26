'use server';

import { NextResponse } from 'next/server';
import { createMemoryItem, listMemoryItems } from '@/app/services/memoryService';

export async function GET(req, { params }) {
  try {
    const { teamName, smartNoteId } = await params;
    const { searchParams } = new URL(req.url);

    const scope = searchParams.get('scope') || undefined;
    const memoryType = searchParams.get('memoryType') || undefined;
    const includeExpired = searchParams.get('includeExpired') === 'true';

    const memories = await listMemoryItems(teamName, smartNoteId, {
      scope,
      memoryType,
      includeExpired
    });

    return NextResponse.json(memories, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'MemoryRouteGetFailed',
        detail: { error: error.message }
      }
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { teamName, smartNoteId } = await params;
    const payload = await req.json();
    const created = await createMemoryItem(teamName, smartNoteId, payload);

    return NextResponse.json(created, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'MemoryRoutePostFailed',
        detail: { error: error.message }
      }
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
