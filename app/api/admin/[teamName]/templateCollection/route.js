import { createTemplateCollection, getAllTemplateCollections } from "@/app/services/templateCollectionService";
import { NextResponse } from "next/server";
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

export const POST = withTeamPermissionGuard(PERMISSIONS.CONTEXT_TEMPLATES_MANAGE)(postHandler);

async function postHandler(req, { params }) {
  try {
    const { teamName } = await params;

    const templateCollection = await req.json();
    templateCollection.type = "TemplateCollection";
    const result = await createTemplateCollection(teamName, templateCollection);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}