'use server';

import { NextResponse } from 'next/server';
import { selectChatInteraction, updateChatInteraction } from '@services/chatInteractionService';

export async function POST(req, { params }) {
  try {
    const request = await req.json();
    const routeParams = await params;

    const teamName = String(request?.teamName || routeParams?.teamName || '').trim();
    const chatId = String(request?.chatId || '').trim();
    const chatInteractionId = String(request?.chatInteractionId || '').trim();

    if (!teamName || !chatInteractionId) {
      return NextResponse.json({ error: 'teamName and chatInteractionId are required' }, { status: 400 });
    }

    const strictQuery = {
      type: 'ChatInteraction',
      id: chatInteractionId,
      ...(chatId ? { parentId: chatId } : {}),
    };

    let chatInteraction = await selectChatInteraction(strictQuery, teamName);
    if (!chatInteraction && chatId) {
      chatInteraction = await selectChatInteraction({ type: 'ChatInteraction', id: chatInteractionId }, teamName);
    }

    if (!chatInteraction) {
      return NextResponse.json({ error: 'Chat interaction not found' }, { status: 404 });
    }

    const cancelledMessage = [
      '## Comparison Progress',
      '',
      'X Processing: Comparison cancelled by user.',
      '',
      '---',
    ].join('\n');

    const updated = {
      ...chatInteraction,
      cancellationRequested: true,
      cancellationRequestedAt: new Date().toISOString(),
      response: cancelledMessage,
      isComplete: true,
    };

    const result = await updateChatInteraction(updated, teamName);

    return NextResponse.json({
      success: Boolean(result),
      chatInteractionId,
      cancelled: true,
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to cancel comparison' }, { status: 500 });
  }
}
