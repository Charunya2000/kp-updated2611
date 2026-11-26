import { NextResponse } from 'next/server';
import { selectChatInteraction, updateChatInteraction, deleteChatInteraction } from '@services/chatInteractionService';

export async function GET(_, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, chatHistoryId, chatId, chatInteractionId } = await params;

    const query = { type: 'ChatInteraction', parentId: chatId, id: chatInteractionId };
    const chatInteraction = await selectChatInteraction(query, teamName);
    return NextResponse.json(chatInteraction, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, chatHistoryId, chatId, chatInteractionId } = await params;

    const document = await req.json();
    document.id = chatInteractionId;
    document.parentId = chatId;
    document.smartNoteId = smartNoteId;
    if (!document.type || document.type !== 'ChatInteraction') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = await updateChatInteraction(document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, chatHistoryId, chatId, chatInteractionId } = await params;

    const document = await req.json();
    document.id = chatInteractionId;
    document.parentId = chatId;
    document.smartNoteId = smartNoteId;
    if (!document.type || document.type !== 'ChatInteraction') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = await deleteChatInteraction(document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
