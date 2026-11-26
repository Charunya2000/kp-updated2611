'use server';

import { NextResponse } from 'next/server';
import { createSource, selectSources, deleteSources } from '@services/sourceService';

export async function GET(_, { params }) {
  try {
    const { smartNoteId, teamName, assistantName } = await params;
    if (!smartNoteId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
    const query = { type: 'Source', parentId: smartNoteId }
    const sources = await selectSources(query, teamName);
    return NextResponse.json(sources, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { teamName, assistantName } = await params;
    const query = await req.json();
    if (!query.type || query.type !== 'Source') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = deleteSources(query, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName } = await params;
    const document = await req.json();
    if (!document.type || document.type !== 'Source') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = await createSource(document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
