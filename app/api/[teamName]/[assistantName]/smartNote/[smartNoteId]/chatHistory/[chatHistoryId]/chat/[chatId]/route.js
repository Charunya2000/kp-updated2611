import { NextResponse } from 'next/server';
import { selectChat, updateChat, deleteChat } from '@services/chatService';

export async function GET(_, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, chatHistoryId, chatId } = await params;
    if (!smartNoteId || !chatId) {
      console.error(error);
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
    const query = { type: 'Chat', parentId: smartNoteId, id: chatId };
    const chat = await selectChat(query, teamName);
    return NextResponse.json(chat, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, chatHistoryId } = await params;

    const document = await req.json();
    if (!document.type || document.type !== 'Chat') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = updateChat(document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, chatHistoryId } = await params;

    const document = await req.json();
    if (!document.type || document.type !== 'Chat') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = deleteChat(document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
