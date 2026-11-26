'use server';

import { NextResponse } from 'next/server';
import { selectSavedNote, updateSavedNote, deleteSavedNote } from '@services/savedNoteService';

export async function GET(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;

    const smartNotes = await selectSavedNote(req, teamName);
    return NextResponse.json(smartNotes, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;

    const document = await req.json();
    if (!document.type || document.type !== 'SavedNote') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = updateSavedNote(document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;

    const document = await req.json();
    if (!document.type || document.type !== 'SavedNote') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = await deleteSavedNote(document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
