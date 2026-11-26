import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { createChatCompletionConfig, getAllChatCompletionConfigs } from '@/app/services/chatCompletionConfigService'
import { PERMISSIONS } from '@/app/config/permissions';


export const GET = withTeamPermissionGuard(PERMISSIONS.ASSISTANT_SETTINGS_MANAGE, { scope: 'assistantName' })(getHandler);
export const POST = withTeamPermissionGuard(PERMISSIONS.ASSISTANT_SETTINGS_MANAGE, { scope: 'assistantName' })(postHandler);

async function getHandler(req, { params }) {
  try {
    const { teamName, assistantName } = await params;
    const completions = await getAllChatCompletionConfigs(teamName, assistantName);
    return NextResponse.json(completions, { status: 200 });
  } catch (error) {
    console.error('Error fetching completions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function postHandler(req, { params }) {
  try {
    const { teamName, assistantName } = await params;
    const completionData = await req.json();
    const created = await createChatCompletionConfig(completionData, teamName, assistantName);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Error creating chat completion:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}