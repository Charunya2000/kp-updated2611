'use server';

import { NextResponse } from 'next/server';
import { selectChatHistory, updateChatHistory, deleteChatHistory } from '@services/chatHistoryService';

export async function GET(_, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, chatHistoryId } = await params;
    const query = { type: 'ChatHistory', parentId: smartNoteId, id: chatHistoryId };
    const chatHistory = await selectChatHistory(query, teamName);
    return NextResponse.json(chatHistory, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, chatHistoryId } = await params;

    const document = await req.json();
    if (!document.type || document.type !== 'ChatHistory') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = updateChatHistory(document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, chatHistoryId } = await params;

    const document = await req.json();
    if (!document.type || document.type !== 'ChatHistory') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = deleteChatHistory(document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
