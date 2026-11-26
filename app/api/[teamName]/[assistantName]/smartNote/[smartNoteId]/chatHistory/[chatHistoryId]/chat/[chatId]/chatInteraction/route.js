import { NextResponse } from 'next/server';
import { createChatInteraction, selectChatInteractions, deleteChatInteractions } from '@services/chatInteractionService';

export async function GET(_, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, chatHistoryId, chatId } = await params;

    const query = { type: 'ChatInteraction', parentId: chatId };
    const chatInteractions = await selectChatInteractions(query, teamName);
    return NextResponse.json(chatInteractions, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, chatHistoryId, chatId } = await params;

    const document = await req.json();
    document.parentId = chatId;
    document.smartNoteId = smartNoteId;
    if (!document.type || document.type !== 'ChatInteraction') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = await createChatInteraction(document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, chatHistoryId } = await params;

    const query = { type: 'ChatInteraction', parentId: smartNoteId };
    if (!query.type || query.type !== 'ChatInteraction') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = await deleteChatInteractions(query, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
