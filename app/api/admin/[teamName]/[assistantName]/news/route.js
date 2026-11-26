import {
  deleteAssistantNews,
  saveAssistantNews,
} from '@/app/services/newsService';
import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

export const POST = withTeamPermissionGuard(PERMISSIONS.ASSISTANT_NEWS_MANAGE, { scope: 'assistantName' })(saveHandler);
export const PUT = withTeamPermissionGuard(PERMISSIONS.ASSISTANT_NEWS_MANAGE, { scope: 'assistantName' })(saveHandler);
export const DELETE = withTeamPermissionGuard(PERMISSIONS.ASSISTANT_NEWS_MANAGE, { scope: 'assistantName' })(deleteHandler);

async function saveHandler(req, { params }) {
  try {
    const { teamName, assistantName } = await params;
    const { news } = await req.json();

    const saved = await saveAssistantNews(news ?? '', teamName, assistantName);
    if (!saved) {
      return NextResponse.json({ error: 'Failed to save news' }, { status: 500 });
    }

    return NextResponse.json(saved, { status: 200 });
  } catch (error) {
    console.error('Error saving assistant news:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function deleteHandler(req, { params }) {
  try {
    const { teamName, assistantName } = await params;
    const deleted = await deleteAssistantNews(teamName, assistantName);
    return NextResponse.json(deleted, { status: 200 });
  } catch (error) {
    console.error('Error deleting assistant news:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
