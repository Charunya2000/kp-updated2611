import { NextResponse } from "next/server";
import { withTeamPermissionGuard } from "@/app/api/guards";
import { updateAssistant, getAssistantById } from "@/app/services/assistantService";
import { deleteUserAssistantsByAssistantId } from "@/app/services/userAssistantService";
import { deleteAssistant } from "@/app/services/assistantService";
import { getUserAssistantsByAssistantId } from "@/app/services/userAssistantService";
import { PERMISSIONS } from "@/app/config/permissions";

export const GET = withTeamPermissionGuard(PERMISSIONS.ASSISTANTS_MANAGE)(getHandler);
export const PUT = withTeamPermissionGuard(PERMISSIONS.ASSISTANTS_MANAGE)(putHandler);
export const DELETE = withTeamPermissionGuard(PERMISSIONS.ASSISTANTS_MANAGE)(deleteHandler);

async function getHandler(req, { params }) {
  try {
    const { teamName, assistantId } = await params;

    const assistants = await getUserAssistantsByAssistantId(teamName, assistantId);
    return NextResponse.json(assistants, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function putHandler(req, { params }) {
  try {
    const { teamName, assistantId } = await params;
    const assistant = await req.json();

    const existingAssistant = await getAssistantById(teamName, assistantId);
    if (!existingAssistant) {
      return NextResponse.json({ error: 'Assistant not found' }, { status: 404 });
    }

    const category = assistant.category;
    if (!category || category.trim() === '') {
      return NextResponse.json({ error: 'An assistant must have a category.' }, { status: 409 });
    }
    if (category.toLowerCase() === 'admin') {
      return NextResponse.json({ error: 'The category "admin" is reserved and cannot be used.' }, { status: 409 });
    }

    if (existingAssistant && existingAssistant.name !== assistant.name) {
      return NextResponse.json({ error: "A assistant's name can not be changed after it's created" }, { status: 409 });
    }

    const result = await updateAssistant(teamName, assistant);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function deleteHandler(req, { params }) {
  const { teamName, assistantId } = await params;
  const assistant = await req.json();
  let existingUserAssistants = [];

  try {
    const existingAssistant = await getAssistantById(teamName, assistantId);
    if (!existingAssistant) {
      return NextResponse.json({ error: 'Assistant not found' }, { status: 404 });
    }
    await deleteUserAssistantsByAssistantId(teamName, assistantId);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    const result = await deleteAssistant(teamName, assistant);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.log(JSON.stringify({ kpmsg: { id: "AI_PORTAL_NOTEBOOK", name: `/api/admin/${teamName}/assistant/${assistantId}`, detail: { error, method: 'DELETE', teamName, assistantId } } }));
    return NextResponse.json({ error: error.message, deletedUserAssistants: existingUserAssistants }, { status: 500 });
  }
}