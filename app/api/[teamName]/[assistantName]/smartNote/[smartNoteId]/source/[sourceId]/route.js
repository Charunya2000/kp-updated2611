'use server';

import { NextResponse } from 'next/server';
import { selectSource, updateSource, deleteSource } from '@services/sourceService';

export async function GET(_, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, sourceId } = await params;
    const query = { type: 'Source', parentId: smartNoteId, id: sourceId }
    const sources = await selectSource(query, teamName);
    return NextResponse.json(sources, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, sourceId } = await params;

    const document = await req.json();
    if (!document.type || document.type !== 'Source') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = updateSource(document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, sourceId } = await params;

    const document = await req.json();
    if (!document.type || document.type !== 'Source') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = deleteSource(document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
