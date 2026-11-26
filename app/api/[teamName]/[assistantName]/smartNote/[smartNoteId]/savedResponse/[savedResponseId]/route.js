'use server';

import { NextResponse } from 'next/server';
import { selectSavedResponse, updateSavedResponse, deleteSavedResponse } from '@services/savedResponseService';

export async function GET(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, savedResponseId } = await params;

    const smartNotes = await selectSavedResponse(req, teamName);
    return NextResponse.json(smartNotes, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, savedResponseId } = await params;

    const document = await req.json();
    if (!document.type || document.type !== 'SavedResponse') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = updateSavedResponse(document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, savedResponseId } = await params;

    const query = { type: 'SavedResponse', parentId: smartNoteId, id: savedResponseId };
    const result = deleteSavedResponse(query, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
