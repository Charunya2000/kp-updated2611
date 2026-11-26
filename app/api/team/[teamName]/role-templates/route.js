import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { getCurrentUserNuid } from '@/utils/getSession';
import { getTeamByName, updateTeam } from '@/app/services/teamService';
import { getAllGlobalRoleTemplates } from '@/app/services/roleTemplateService';
import { PERMISSIONS } from '@/app/config/permissions';

export const GET = withTeamPermissionGuard(
  [PERMISSIONS.TEAM_ROLE_TEMPLATES_MANAGE, PERMISSIONS.TEAM_MEMBERS_PERMISSIONS_MANAGE, PERMISSIONS.TEAM_MEMBERS_MANAGE],
  { any: true }
)(getHandler);
export const PUT = withTeamPermissionGuard(PERMISSIONS.TEAM_ROLE_TEMPLATES_MANAGE)(putHandler);

async function getHandler(request, { params }) {
  const { teamName } = await params;

  try {
    const [team, globalTemplates] = await Promise.all([
      getTeamByName(teamName),
      getAllGlobalRoleTemplates(),
    ]);

    const teamTemplates = team?.authorization?.roleTemplates || [];
    const enabledPermissions = team?.authorization?.enabledPermissions || [];

    return NextResponse.json({
      globalTemplates: globalTemplates || [],
      teamTemplates,
      enabledPermissions,
    }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'getTeamRoleTemplates', detail: { teamName, error: error.message } } }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function putHandler(request, { params }) {
  const { teamName } = await params;
  const nuid = await getCurrentUserNuid();

  try {
    const body = await request.json();
    const { roleTemplates } = body;

    if (!Array.isArray(roleTemplates)) {
      return NextResponse.json({ error: 'roleTemplates must be an array' }, { status: 400 });
    }

    const team = await getTeamByName(teamName);
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const authorization = team.authorization || {};
    authorization.roleTemplates = roleTemplates;

    const result = await updateTeam({ ...team, authorization });

    console.log(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'updateTeamRoleTemplates', detail: { teamName, nuid, count: roleTemplates.length } } }));

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'updateTeamRoleTemplates', detail: { teamName, error: error.message } } }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
