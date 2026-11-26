import { createWorkflow, getAllWorkflows } from "@/app/services/workflowService";
import { NextResponse } from "next/server";
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

export const POST = withTeamPermissionGuard(PERMISSIONS.WORKFLOWS_MANAGE)(postHandler);

export async function GET(req, { params }) {
  try {
    const { teamName } = await params;
    const workflows = await getAllWorkflows(teamName);
    return NextResponse.json(workflows, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function postHandler(req, { params }) {
  try {
    const { teamName } = await params;
    const workflow = await req.json();
    const result = await createWorkflow(teamName, workflow);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
