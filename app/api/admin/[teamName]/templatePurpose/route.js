import { createTemplatePurpose, getAllTemplatePurposes } from "@/app/services/templatePurposeService";
import { NextResponse } from "next/server";
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

export const POST = withTeamPermissionGuard(PERMISSIONS.CONTEXT_TEMPLATES_MANAGE)(postHandler);

async function postHandler(req, { params }) {
  try {
    const { teamName } = await params;

    const templatePurpose = await req.json();
    templatePurpose.type = "TemplatePurpose";
    const result = await createTemplatePurpose(teamName, templatePurpose);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}