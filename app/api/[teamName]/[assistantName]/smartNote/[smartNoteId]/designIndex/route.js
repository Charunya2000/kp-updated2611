'use server';

import { NextResponse } from 'next/server';
import { createDesignIndex, selectDesignIndexs } from '@services/designIndexService';

export async function GET(_, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;

    const query = {
      type: 'DesignIndex',
      parentId: smartNoteId,
    }
    const designIndexs = await selectDesignIndexs(query, teamName);
    return NextResponse.json(designIndexs, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;

    const document = await req.json();
    if (!document.type || document.type !== 'DesignIndex') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = await createDesignIndex(document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
