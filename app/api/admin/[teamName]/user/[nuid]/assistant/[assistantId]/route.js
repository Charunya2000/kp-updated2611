// create a delete route
import { NextResponse } from 'next/server';
import { getAssistantById } from '@/app/services/assistantService';
import { deleteUserAssistant, getUserAssistant } from '@/app/services/userAssistantService';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

async function resolveAssistantScope(req, params) {
  const assistant = await getAssistantById(params.teamName, params.assistantId);
  return assistant?.name;
}

export const DELETE = withTeamPermissionGuard(PERMISSIONS.ASSISTANTS_ASSIGN_USERS, { scope: resolveAssistantScope })(deleteHandler);

async function deleteHandler(req, { params }) {
  try {
    const { teamName, nuid, assistantId } = await params;

    // get the UserAssistant for this nuid:
    const userAssistant = await getUserAssistant(assistantId, nuid, teamName);
    if (!userAssistant) {
      return NextResponse.json({ error: 'UserAssistant not found' }, { status: 404 });
    }

    const result = await deleteUserAssistant(teamName, userAssistant.id);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}