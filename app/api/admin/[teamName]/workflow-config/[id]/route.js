import { updateWorkflow, deleteWorkflow } from "@/app/services/workflowService";
import { NextResponse } from "next/server";
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

export const PUT = withTeamPermissionGuard(PERMISSIONS.WORKFLOWS_MANAGE)(putHandler);
export const DELETE = withTeamPermissionGuard(PERMISSIONS.WORKFLOWS_MANAGE)(deleteHandler);

async function putHandler(req, { params }) {
  try {
    const { teamName, id } = await params;
    const workflow = await req.json();
    const result = await updateWorkflow(teamName, id, workflow);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function deleteHandler(req, { params }) {
  try {
    const { teamName, id } = await params;

    const result = await deleteWorkflow(teamName, id);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}