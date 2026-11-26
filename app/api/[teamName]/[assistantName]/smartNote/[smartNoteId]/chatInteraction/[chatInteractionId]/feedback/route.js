import { NextResponse } from 'next/server';
import { updateChatInteractionFeedback } from '@services/chatInteractionService';

const VALID_FEEDBACK_VALUES = [1, 0, null];

export async function PATCH(req, { params }) {
  try {
    const { teamName, smartNoteId, chatInteractionId } = await params;
    const body = await req.json();
    const { feedback } = body;

    if (!VALID_FEEDBACK_VALUES.includes(feedback)) {
      return NextResponse.json(
        { error: 'Invalid feedback value. Must be 1 (helpful), 0 (not helpful), or null.' },
        { status: 400 }
      );
    }

    const result = await updateChatInteractionFeedback(chatInteractionId, feedback, teamName, smartNoteId);
    if (!result) {
      return NextResponse.json(
        { error: 'ChatInteraction not found or could not be updated' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, feedback }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'submitChatInteractionFeedback',
        detail: { error: error.message }
      }
    }));

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
