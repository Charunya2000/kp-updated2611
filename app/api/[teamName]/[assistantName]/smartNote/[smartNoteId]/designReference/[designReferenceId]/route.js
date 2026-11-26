'use server';

import { NextResponse } from 'next/server';
import { createDesignReference, selectDesignReference, updateDesignReference, deleteDesignReference } from '@services/designReferenceService';

export async function GET(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, designReferenceId } = await params;

    const smartNotes = await selectDesignReference(req, teamName);
    return NextResponse.json(smartNotes, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, designReferenceId } = await params;

    const document = await req.json();
    if (!document.type || document.type !== 'DesignReference') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = createDesignReference(document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, designReferenceId } = await params;

    const document = await req.json();
    if (!document.type || document.type !== 'DesignReference') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = updateDesignReference(document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, designReferenceId } = await params;

    const query = await req.json();
    if (!query.type || query.type !== 'DesignReference') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = deleteDesignReference(query, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
