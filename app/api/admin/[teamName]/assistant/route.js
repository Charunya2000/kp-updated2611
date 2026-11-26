import { NextResponse } from "next/server";
import { withTeamPermissionGuard } from "@/app/api/guards";
import { addAssistant, getAssistantByName } from "@/app/services/assistantService";
import { getTeamByName } from "@/app/services/teamService";
import { PERMISSIONS } from "@/app/config/permissions";

export const POST = withTeamPermissionGuard(PERMISSIONS.ASSISTANTS_MANAGE)(postHandler);

async function postHandler(req, { params }) {
  try {
    const { teamName } = await params;
    const assistant = await req.json();

    const isExistingAssistant = await getAssistantByName(teamName, assistant.name);
    if (isExistingAssistant) {
      return NextResponse.json({ error: 'Assistant already exists' }, { status: 409 });
    }

    const category = assistant.category;
    if (!category || category.trim() === '') {
      return NextResponse.json({ error: 'An assistant must have a category.' }, { status: 409 });
    }
    if (category.toLowerCase() === 'admin') {
      return NextResponse.json({ error: 'The category "admin" is reserved and cannot be used.' }, { status: 409 });
    }

    const team = await getTeamByName(teamName);
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    assistant.teamId = team.id;

    const result = await addAssistant(teamName, assistant);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}