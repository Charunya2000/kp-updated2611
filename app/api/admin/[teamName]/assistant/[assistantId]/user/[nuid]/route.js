import { NextResponse } from "next/server";
import { withTeamPermissionGuard } from "@/app/api/guards";
import { getAssistantById } from "@/app/services/assistantService";
import { deleteUserAssistant, getUserAssistant } from "@/app/services/userAssistantService";
import { PERMISSIONS } from "@/app/config/permissions";

async function resolveAssistantScope(req, params) {
  const assistant = await getAssistantById(params.teamName, params.assistantId);
  return assistant?.name;
}

export const DELETE = withTeamPermissionGuard(PERMISSIONS.ASSISTANTS_ASSIGN_USERS, { scope: resolveAssistantScope })(deleteHandler);

async function deleteHandler(req, { params }) {
  try {
    const { teamName, assistantId, nuid } = await params;

    // Find the UserAssistant document to delete
    const userAssistant = await getUserAssistant(assistantId, nuid, teamName);
    if (!userAssistant) {
      return NextResponse.json({ error: 'User assignment not found' }, { status: 404 });
    }

    // Delete the UserAssistant document
    await deleteUserAssistant(teamName, userAssistant.id);

    return NextResponse.json({ message: 'User removed from assistant successfully' }, { status: 200 });

  } catch (error) {
    console.error('Error removing user from assistant:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}