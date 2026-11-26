import {
  updatePrompt,
  deletePrompt,
  getPromptByName,
  getPromptById,
} from '@/app/services/promptLibraryService';
import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

export const PUT = withTeamPermissionGuard(PERMISSIONS.ASSISTANT_SETTINGS_MANAGE, { scope: 'assistantName' })(putHandler);
export const DELETE = withTeamPermissionGuard(PERMISSIONS.ASSISTANT_SETTINGS_MANAGE, { scope: 'assistantName' })(deleteHandler);

async function putHandler(req, { params }) {
  try {
    const { teamName, assistantName, id } = await params;
    const prompt = await req.json();

    const promptLibById = await getPromptById(id, teamName);
    if (!promptLibById) {
      return NextResponse.json({ error: 'Prompt library item not found.' }, { status: 404 });
    }

    // Check for duplicate names (excluding current prompt)
    const existingPrompt = await getPromptByName(prompt.name, teamName, assistantName);
    if (existingPrompt && existingPrompt.id !== id) {
      return NextResponse.json({ error: 'A prompt library item with this name already exists.' }, { status: 409 });
    }

    const updated = await updatePrompt(prompt, teamName, assistantName);
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error('Error updating prompt library item:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function deleteHandler(req, { params }) {
  try {
    const { teamName, assistantName, id } = await params;

    const query = { type: 'PromptLibrary', teamName, assistantName, id };
    const deleted = await deletePrompt(query, teamName, assistantName);
    return NextResponse.json(deleted, { status: 200 });
  } catch (error) {
    console.error('Error deleting prompt library item:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

