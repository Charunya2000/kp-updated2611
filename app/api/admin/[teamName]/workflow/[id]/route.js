import { getWorkflowById, updateWorkflow, deleteWorkflow } from "@/app/services/workflowService";
import { NextResponse } from "next/server";
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

export const GET = withTeamPermissionGuard(PERMISSIONS.WORKFLOWS_MANAGE)(getHandler);
export const PUT = withTeamPermissionGuard(PERMISSIONS.WORKFLOWS_MANAGE)(putHandler);
export const DELETE = withTeamPermissionGuard(PERMISSIONS.WORKFLOWS_MANAGE)(deleteHandler);

async function getHandler(_, { params }) {
  try {
    const { teamName, id } = await params;
    const template = await getWorkflowById(teamName, id);

    return NextResponse.json(template, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function putHandler(req, { params }) {
  try {
    const { teamName, id } = await params;
    const template = await req.json();
    const result = await updateWorkflow(template, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function deleteHandler(_, { params }) {
  try {
    const { teamName, id } = await params;
    const result = await deleteWorkflow(id, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}