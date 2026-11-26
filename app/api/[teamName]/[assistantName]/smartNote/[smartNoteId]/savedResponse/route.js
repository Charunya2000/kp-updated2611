'use server';

import { NextResponse } from 'next/server';
import { createSavedResponse, selectSavedResponses } from '@services/savedResponseService';

export async function GET(_, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, fileId } = await params;
    const query = { type: 'SavedResponse', parentId: smartNoteId }
    const sources = await selectSavedResponses(query, teamName);
    return NextResponse.json(sources, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, fileId } = await params;
    const document = await req.json();
    if (!document.type || document.type !== 'SavedResponse') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }

    if (!smartNoteId) {
      console.error(error);
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
    document.parentId = smartNoteId;
    const result = await createSavedResponse(document, teamName, assistantName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
