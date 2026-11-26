'use server';

import { NextResponse } from 'next/server';
import { deleteMemoryItem, getMemoryItem, updateMemoryItem } from '@/app/services/memoryService';

export async function GET(_, { params }) {
  try {
    const { teamName, smartNoteId, memoryId } = await params;
    const memory = await getMemoryItem(teamName, smartNoteId, memoryId);

    if (!memory) {
      return NextResponse.json({ error: 'Memory item not found' }, { status: 404 });
    }

    return NextResponse.json(memory, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'MemoryItemRouteGetFailed',
        detail: { error: error.message }
      }
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { teamName, smartNoteId, memoryId } = await params;
    const payload = await req.json();
    const updated = await updateMemoryItem(teamName, smartNoteId, memoryId, payload);

    if (!updated) {
      return NextResponse.json({ error: 'Memory item not found' }, { status: 404 });
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'MemoryItemRoutePutFailed',
        detail: { error: error.message }
      }
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_, { params }) {
  try {
    const { teamName, smartNoteId, memoryId } = await params;
    const deleted = await deleteMemoryItem(teamName, smartNoteId, memoryId);

    if (!deleted) {
      return NextResponse.json({ error: 'Memory item not found' }, { status: 404 });
    }

    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'MemoryItemRouteDeleteFailed',
        detail: { error: error.message }
      }
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
