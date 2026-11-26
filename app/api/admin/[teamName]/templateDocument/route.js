import { createTemplateDocument, getAllTemplateDocuments } from "@/app/services/templateDocumentService";
import { NextResponse } from "next/server";
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

export const GET = withTeamPermissionGuard(PERMISSIONS.CONTEXT_TEMPLATES_MANAGE)(getHandler);
export const POST = withTeamPermissionGuard(PERMISSIONS.CONTEXT_TEMPLATES_MANAGE)(postHandler);

async function getHandler(_, { params }) {
  try {
    const { teamName } = await params;
    const templates = await getAllTemplateDocuments(teamName);

    return NextResponse.json(templates, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function postHandler(req, { params }) {
  try {
    const { teamName } = await params;
    const templateDocument = await req.json();
    templateDocument.type = "TemplateDocument";
    const result = await createTemplateDocument(teamName, templateDocument);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}