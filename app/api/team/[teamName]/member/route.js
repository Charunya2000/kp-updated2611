import { NextResponse } from "next/server";
import { withTeamPermissionGuard } from "@/app/api/guards";
import { getAllTeamMembers, addTeamMember, deleteTeamMember, getTeamMember } from "@/app/services/teamMemberService";
import { getTeamByName } from "@/app/services/teamService";
import { addUserToTeam } from "@/app/services/userService";
import { PERMISSIONS } from "@/app/config/permissions";

export const POST = withTeamPermissionGuard(PERMISSIONS.TEAM_MEMBERS_MANAGE)(postHandler);
export const DELETE = withTeamPermissionGuard(PERMISSIONS.TEAM_MEMBERS_MANAGE)(deleteHandler);

export async function GET(request, { params }) {
  try {
    const { teamName } = await params;
    const members = await getAllTeamMembers(teamName);
    return NextResponse.json(members, { status: 200 });
  } catch (error) {
    console.error('Error getting team members:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function postHandler(request, { params }) {
  try {
    const { teamName } = await params;
    const { memberNuids } = await request.json();

    // Get team to verify ownership and get teamId
    const team = await getTeamByName(teamName);
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Get existing team members to check for duplicates
    const existingMembers = await getAllTeamMembers(teamName);
    const teamOwners = existingMembers.filter(member => member.roles?.includes('owner')).map(owner => owner.nuid);
    const existingMemberNuids = existingMembers.map(member => member.nuid);

    // Filter out duplicates and conflicts, only process valid members
    const duplicateMembers = [];
    const ownerConflicts = [];
    const validMembers = [];

    for (const memberNuid of memberNuids) {
      if (existingMemberNuids.includes(memberNuid)) {
        duplicateMembers.push(memberNuid);
      } else if (teamOwners.includes(memberNuid)) {
        ownerConflicts.push(memberNuid);
      } else {
        validMembers.push(memberNuid);
      }
    }

    // Add each valid member
    const results = [];
    for (const memberNuid of validMembers) {
      try {
        const result = await addTeamMember({
          nuid: memberNuid,
          teamId: team.id,
          roles: ['member']
        }, teamName);
        results.push(result);

        // Ensure their UserDetail is also updated
        await addUserToTeam(memberNuid, teamName);
      } catch (error) {
        console.error(`Error adding member ${memberNuid}:`, error);
        results.push({ error: `Failed to add ${memberNuid}` });
      }
    }

    // Return success with information about what was processed
    return NextResponse.json({
      addedMembers: results,
      skipped: {
        duplicates: duplicateMembers,
        owners: ownerConflicts
      },
      totalProcessed: validMembers.length,
      totalSkipped: duplicateMembers.length + ownerConflicts.length
    }, { status: 200 });
  } catch (error) {
    console.error('Error adding team members:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function deleteHandler(request, { params }) {
  try {
    const { teamName } = await params;
    const { members } = await request.json();

    // Get team to verify ownership
    const team = await getTeamByName(teamName);
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // TODO: Add a delete function to the database that will allow deletion of multiple members at once    
    // const result = await deleteTeamMembers(members, teamName);
    //return NextResponse.json({ success: result }, { status: 200 });

    return NextResponse.json({ error: 'Bulk delete not implemented yet' }, { status: 501 });
  } catch (error) {
    console.error('Error removing team member:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
