import { NextResponse } from "next/server";
import { withAppAdminGuard } from "@/app/api/guards";
import {
  getAllMessages,
  createMessage
} from '@/app/services/applicationMessaging';

export const GET = await withAppAdminGuard(getHandler);
export const POST = await withAppAdminGuard(postHandler);

// Get all application messages
async function getHandler(req) {
  try {
    const { searchParams } = new URL(req.url);

    const messages = await getAllMessages();
    return NextResponse.json({ messages: messages || [] }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'GET: Application Messages',
        detail: {
          error: error.message
        }
      }
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Create new application message
async function postHandler(req) {
  try {
    const { text, messageType, isEnabled, startDate, endDate, status } = await req.json();


    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Message text is required' }, { status: 400 });
    }

    const messageData = {
      text: text.trim(),
      messageType: messageType || 'INFO',
      isEnabled: isEnabled ?? true,
      startDate: startDate || null,
      endDate: endDate || null,
      status: status || 'Active'
    };

    const result = await createMessage(messageData);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ message: 'Message created successfully', data: result }, { status: 201 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'POST: Create Application Message',
        detail: {
          error: error.message
        }
      }
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
