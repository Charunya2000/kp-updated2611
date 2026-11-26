import { getTemplatePurpose, updateTemplatePurpose, deleteTemplatePurpose } from "@/app/services/templatePurposeService";
import { NextResponse } from "next/server";
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

export const GET = withTeamPermissionGuard(PERMISSIONS.CONTEXT_TEMPLATES_MANAGE)(getHandler);
export const PUT = withTeamPermissionGuard(PERMISSIONS.CONTEXT_TEMPLATES_MANAGE)(putHandler);
export const DELETE = withTeamPermissionGuard(PERMISSIONS.CONTEXT_TEMPLATES_MANAGE)(deleteHandler);

async function getHandler(_, { params }) {
  try {
    const { teamName, id } = await params;
    const template = await getTemplatePurpose(teamName, id);

    return NextResponse.json(template, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function putHandler(req, { params }) {
  try {
    const { teamName } = await params;

    const template = await req.json();
    const result = await updateTemplatePurpose(teamName, template);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function deleteHandler(_, { params }) {
  try {
    const { teamName, id } = await params;
    const result = await deleteTemplatePurpose(teamName, id);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}