import { NextResponse } from "next/server";
import { getActiveMessages } from '@/app/services/applicationMessaging';

export const GET = getHandler;

// Get active application messages (for displaying to users)
async function getHandler(req) {
  try {
    const messages = await getActiveMessages();
    return NextResponse.json({ messages: messages || [] }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'GET: Active Messages',
        detail: {
          error: error.message
        }
      }
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
