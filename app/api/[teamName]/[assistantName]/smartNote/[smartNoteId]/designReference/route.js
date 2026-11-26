'use server';

import { NextResponse } from 'next/server';
import { createDesignReference, selectDesignReferences } from '@services/designReferenceService';

export async function GET(_, { params }) {
  try {
    const { smartNoteId, teamName, assistantName } = await params;
    const query = {
      type: 'DesignReference',
      parentId: smartNoteId,
    }
    const smartNotes = await selectDesignReferences(query, teamName);
    return NextResponse.json(smartNotes, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { teamName, assistant } = await params;
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
