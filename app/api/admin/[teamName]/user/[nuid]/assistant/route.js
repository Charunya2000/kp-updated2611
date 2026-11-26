import { NextResponse } from "next/server";
import { getUserAssistants, upsertUserAssistants } from "@/app/services/userAssistantService";
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

export const GET = withTeamPermissionGuard([
  PERMISSIONS.ASSISTANTS_ASSIGN_USERS,
  { scoped: PERMISSIONS.ASSISTANTS_ASSIGN_USERS },
], { any: true })(getHandler);
export const PUT = withTeamPermissionGuard([
  PERMISSIONS.ASSISTANTS_ASSIGN_USERS,
  { scoped: PERMISSIONS.ASSISTANTS_ASSIGN_USERS },
], { any: true })(putHandler);

function getAllowedAssistantNames(access) {
  if (access?.has(PERMISSIONS.ASSISTANTS_ASSIGN_USERS)) {
    return null;
  }

  return access?.getScopedValues(PERMISSIONS.ASSISTANTS_ASSIGN_USERS) || [];
}

async function getHandler(req, { params }, access) {
  try {
    const { teamName, nuid } = await params;

    const assistants = await getUserAssistants(teamName, nuid);
    const allowedAssistantNames = getAllowedAssistantNames(access);

    if (allowedAssistantNames) {
      const allowedAssistantSet = new Set(allowedAssistantNames);
      assistants.assistants = (assistants.assistants || []).filter(assistant => allowedAssistantSet.has(assistant.name));
    }

    return NextResponse.json(assistants, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function putHandler(req, { params }, access) {
  try {
    const { teamName, nuid } = await params;

    const document = await req.json();
    const allowedAssistantNames = getAllowedAssistantNames(access);

    if (allowedAssistantNames) {
      const allowedAssistantSet = new Set(allowedAssistantNames);
      const requestedAssistantNames = Array.isArray(document) ? document.map(assistant => assistant.name) : [];
      const unauthorizedAssistant = requestedAssistantNames.find(name => !allowedAssistantSet.has(name));

      if (unauthorizedAssistant) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const result = await upsertUserAssistants(nuid, document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}