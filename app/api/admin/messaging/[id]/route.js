import { NextResponse } from "next/server";
import { withAppAdminGuard } from "@/app/api/guards";
import {
  getMessageById,
  updateMessage,
  deleteMessage
} from '@/app/services/applicationMessaging';

export const GET = await withAppAdminGuard(getHandler);
export const PUT = await withAppAdminGuard(putHandler);
export const DELETE = await withAppAdminGuard(deleteHandler);

// Get single application message by ID
async function getHandler(req, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    const message = await getMessageById(id);

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    return NextResponse.json({ message }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'GET: Application Message By ID',
        detail: {
          error: error.message
        }
      }
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Update application message by ID
async function putHandler(req, { params }) {
  try {
    const { id } = await params;
    const { text, messageType, isEnabled, startDate, endDate, status } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

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

    const result = await updateMessage(id, messageData);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ message: 'Message updated successfully' }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'PUT: Update Application Message By ID',
        detail: {
          error: error.message
        }
      }
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Delete application message by ID
async function deleteHandler(req, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    const result = await deleteMessage(id);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ message: 'Message deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'DELETE: Application Message By ID',
        detail: {
          error: error.message
        }
      }
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
