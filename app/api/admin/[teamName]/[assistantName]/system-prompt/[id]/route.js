import {
  updateSystemPrompt,
  deleteSystemPrompt,
  getSystemPromptByName,
  getSystemPromptById
} from '@/app/services/systemPromptService';
import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

export const PUT = withTeamPermissionGuard(PERMISSIONS.ASSISTANT_SETTINGS_MANAGE, { scope: 'assistantName' })(putHandler);
export const DELETE = withTeamPermissionGuard(PERMISSIONS.ASSISTANT_SETTINGS_MANAGE, { scope: 'assistantName' })(deleteHandler);

async function putHandler(req, { params }) {
  try {
    const { teamName, assistantName, id } = await params;
    const systemPrompt = await req.json();

    const systemPromptById = await getSystemPromptById(id, teamName);
    if (!systemPromptById) {
      return NextResponse.json({ error: 'System prompt not found.' }, { status: 404 });
    }

    const existingPrompt = await getSystemPromptByName(systemPrompt.name, teamName, assistantName);
    if (existingPrompt && existingPrompt.id !== id) {
      return NextResponse.json({ error: 'A system prompt with this name already exists.' }, { status: 409 });
    }

    const updated = await updateSystemPrompt(systemPrompt, teamName, assistantName);
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error('Error updating system prompt:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function deleteHandler(req, { params }) {
  try {
    const { teamName, assistantName, id } = await params;

    const query = { type: 'SystemPrompt', teamName, assistantName, id };
    const deleted = await deleteSystemPrompt(query, teamName, assistantName);
    return NextResponse.json(deleted, { status: 200 });
  } catch (error) {
    console.error('Error deleting system prompt:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
