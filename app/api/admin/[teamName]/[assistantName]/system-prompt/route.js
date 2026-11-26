import {
  createSystemPrompt,
  getSystemPromptByName,
} from '@/app/services/systemPromptService';
import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

export const POST = withTeamPermissionGuard(PERMISSIONS.ASSISTANT_SETTINGS_MANAGE, { scope: 'assistantName' })(postHandler);

async function postHandler(req, { params }) {
  try {

    const { teamName, assistantName } = await params;
    const systemPrompt = await req.json();
    const existingPrompt = await getSystemPromptByName(systemPrompt.name, teamName, assistantName);

    if (existingPrompt) {
      return NextResponse.json({ error: 'A system prompt with this name already exists.' }, { status: 409 });
    }

    const created = await createSystemPrompt(systemPrompt, teamName, assistantName);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Error creating system prompt:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
