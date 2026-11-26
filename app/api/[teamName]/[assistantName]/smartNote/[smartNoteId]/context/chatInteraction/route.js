'use server';

import { NextResponse } from 'next/server';
import { addInteraction } from '@services/addChatInteractionToIndex';

export async function POST(req) {
  try {
    const document = await req.json();
    if (!document.type || document.type !== 'ChatInteraction') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = await addInteraction(document);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
