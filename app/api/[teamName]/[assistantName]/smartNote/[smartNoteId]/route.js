'use server';

import { NextResponse } from 'next/server';
import { selectSmartNote, updateSmartNote, deleteSmartNote } from '@services/smartNoteService';

export async function GET(_, { params }) {
  try {
    const { smartNoteId, teamName, assistantName } = await params;
    if (!smartNoteId) {
      console.error(error);
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
    const query = { type: 'SmartNote', parentId: { $exists: true }, id: smartNoteId };
    const smartNote = await selectSmartNote(query, teamName);
    return NextResponse.json(smartNote, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { smartNoteId, teamName, assistantName } = await params;
    const query = await req.json();
    query.id = smartNoteId;
    query.parentId = query?.parentId;
    const result = await updateSmartNote(query, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_, { params }) {
  try {
    const { smartNoteId, teamName, assistantName } = await params;
    const query = { type: 'SmartNote', parentId: { $exists: true }, id: smartNoteId, assistantName };
    const result = await deleteSmartNote(query, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
