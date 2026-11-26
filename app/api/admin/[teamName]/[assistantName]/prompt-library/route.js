import {
  createPrompt,
  getPromptByName,
} from '@/app/services/promptLibraryService';
import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

export const POST = withTeamPermissionGuard(PERMISSIONS.ASSISTANT_SETTINGS_MANAGE, { scope: 'assistantName' })(postHandler);

async function postHandler(req, { params }) {
  try {
    const { teamName, assistantName } = await params;
    const prompt = await req.json();

    // Check for duplicate names
    const existingPrompt = await getPromptByName(prompt.name, teamName, assistantName);
    if (existingPrompt) {
      return NextResponse.json({ error: 'A prompt library item with this name already exists.' }, { status: 409 });
    }

    const created = await createPrompt(prompt, teamName, assistantName);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Error creating prompt library item:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
