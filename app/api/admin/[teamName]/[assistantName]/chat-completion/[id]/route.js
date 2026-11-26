
import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { deleteChatCompletionConfig, getChatCompletionConfigById, updateChatCompletionConfig } from '@/app/services/chatCompletionConfigService';
import { PERMISSIONS } from '@/app/config/permissions';


export const PUT = withTeamPermissionGuard(PERMISSIONS.ASSISTANT_SETTINGS_MANAGE, { scope: 'assistantName' })(putHandler);
export const DELETE = withTeamPermissionGuard(PERMISSIONS.ASSISTANT_SETTINGS_MANAGE, { scope: 'assistantName' })(deleteHandler);


async function putHandler(req, { params }) {
  try {
    const { teamName, assistantName, id } = await params;
    const completionData = await req.json();

    const completionById = await getChatCompletionConfigById(id, teamName);
    if (!completionById) {
      return NextResponse.json({ error: 'Chat completion config not found.' }, { status: 404 });
    }

    const updated = await updateChatCompletionConfig({ ...completionData, id }, teamName, assistantName);
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error('Error updating chat completion config:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function deleteHandler(req, { params }) {
  try {
    const { teamName, assistantName, id } = await params;
    const deleted = await deleteChatCompletionConfig(id, teamName);
    return NextResponse.json(deleted, { status: 200 });
  } catch (error) {
    console.error('Error deleting chat completion config:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}