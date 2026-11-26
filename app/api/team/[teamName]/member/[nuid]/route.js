import { NextResponse } from "next/server";
import { withTeamPermissionGuard } from "@/app/api/guards";
import { deleteTeamMember, getTeamMember, updateTeamMember } from "@/app/services/teamMemberService";
import { getTeamByName } from "@/app/services/teamService";
import { getTeamAccess } from "@/app/services/permissionsService";
import { PERMISSIONS } from "@/app/config/permissions";

export const PUT = withTeamPermissionGuard(PERMISSIONS.TEAM_MEMBERS_PERMISSIONS_MANAGE)(putHandler);
export const DELETE = withTeamPermissionGuard(PERMISSIONS.TEAM_MEMBERS_MANAGE)(deleteHandler);

export async function GET(request, { params }) {
  try {
    const { teamName, nuid } = await params;
    const member = await getTeamMember(teamName, nuid);
    // Include resolved permissions so clients can do permission-based UI filtering
    const access = await getTeamAccess(teamName, nuid);
    return NextResponse.json({ ...member, permissions: access?.permissions || [] }, { status: 200 });
  } catch (error) {
    console.error('Error getting team members:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function putHandler(request, { params }) {
  try {
    const { teamName, nuid: memberNuid } = await params;
    const { member } = await request.json();

    const team = await getTeamByName(teamName);
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const teamMember = await getTeamMember(teamName, memberNuid);
    if (!teamMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    if (member.roles !== undefined) {
      teamMember.roles = member.roles;
    }
    if (member.grants !== undefined) {
      teamMember.grants = member.grants;
    }

    const result = await updateTeamMember(teamMember, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error updating team member:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function deleteHandler(request, { params }) {
  try {
    const { teamName, nuid: memberNuid } = await params;

    // Get team to verify ownership
    const team = await getTeamByName(teamName);
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Find the member record to get the ID
    const memberToDelete = await getTeamMember(teamName, memberNuid);
    if (!memberToDelete) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const result = await deleteTeamMember({ id: memberToDelete.id, memberNuid }, teamName);
    return NextResponse.json({ success: result }, { status: 200 });
  } catch (error) {
    console.error('Error removing team member:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
