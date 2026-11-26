'use server';

import { NextResponse } from 'next/server';
import { addDesignDocument } from '@services/addDesignReferenceToIndex';

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName } = await params;
    const document = await req.json();
    if (!document.type || document.type !== 'DesignReference') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = await addDesignDocument(document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
