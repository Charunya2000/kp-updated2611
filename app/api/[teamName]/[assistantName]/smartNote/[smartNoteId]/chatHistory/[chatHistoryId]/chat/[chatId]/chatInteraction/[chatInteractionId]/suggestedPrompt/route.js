'use server';

import { NextResponse } from 'next/server';
import { createSuggestedPrompt, selectSuggestedPrompts } from '@services/suggestedPromptService';

export async function GET(_, { params }) {
  try {
    const { teamName, chatInteractionId } = await params;
    if (!chatInteractionId) {
      console.error('Missing chatInteractionId parameter');
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
    const query = { type: 'SuggestedPrompt', parentId: chatInteractionId };
    const suggestedPrompts = await selectSuggestedPrompts(query, teamName);
    return NextResponse.json(suggestedPrompts, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, chatHistoryId, chatId, chatInteractionId } = await params;

    const document = await req.json();
    document.parentId = chatInteractionId;
    document.type = 'SuggestedPrompt';
    if (!document.type || document.type !== 'SuggestedPrompt') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const insertedDocument = await createSuggestedPrompt(document, teamName);
    return NextResponse.json(insertedDocument, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
