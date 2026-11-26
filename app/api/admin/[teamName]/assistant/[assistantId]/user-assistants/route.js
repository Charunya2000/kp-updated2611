import { NextResponse } from "next/server";
import { withTeamPermissionGuard } from "@/app/api/guards";
import { addBulkUserAssistants, getAllUserAssistantsByAssistantId } from "@/app/services/userAssistantService";
import { getUsersByNuid, addUserToTeam } from "@/app/services/userService";
import { getAssistantById } from "@/app/services/assistantService";
import { getTeamByName } from "@/app/services/teamService";
import { getTeamMember, upsertTeamMembers } from "@/app/services/teamMemberService";
import { v4 as uuidv4 } from 'uuid';
import { PERMISSIONS } from "@/app/config/permissions";

async function resolveAssistantScope(req, params) {
  const assistant = await getAssistantById(params.teamName, params.assistantId);
  return assistant?.name;
}

export const GET = withTeamPermissionGuard(PERMISSIONS.ASSISTANTS_ASSIGN_USERS, { scope: resolveAssistantScope })(getHandler);
export const POST = withTeamPermissionGuard(PERMISSIONS.ASSISTANTS_ASSIGN_USERS, { scope: resolveAssistantScope })(postHandler);

async function getHandler(req, { params }) {
  try {
    const { teamName, assistantId } = await params;

    // Get all user assignments for this assistant
    const userAssistants = await getAllUserAssistantsByAssistantId(assistantId, teamName);

    if (!userAssistants || userAssistants.length === 0) {
      return NextResponse.json({ users: [] }, { status: 200 });
    }

    // Extract unique user NUIDs
    const nuids = [...new Set(userAssistants.map(ua => ua.nuid))];

    // Get user details for these NUIDs
    const users = await getUsersByNuid(nuids);

    // Map user assistants with user details
    const usersWithDetails = userAssistants.map(ua => {
      const userDetail = users.find(u => u.nuid === ua.nuid);
      return {
        nuid: ua.nuid,
        name: userDetail ? `${userDetail.firstName} ${userDetail.lastName}` : 'Unknown User',
        createdAt: ua.createdAt
      };
    });

    return NextResponse.json({ users: usersWithDetails }, { status: 200 });
  } catch (error) {
    console.error('Error fetching user assistants:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Bulk add user assistants
async function postHandler(req, { params }) {
  try {
    const { teamName, assistantId } = await params;
    const { nuids } = await req.json();

    if (!nuids || !Array.isArray(nuids) || nuids.length === 0) {
      return NextResponse.json({ error: 'NUIDs array is required' }, { status: 400 });
    }

    // Lookup the assistant to get the assistant name
    const assistant = await getAssistantById(teamName, assistantId);
    if (!assistant) {
      return NextResponse.json({ error: 'Assistant not found' }, { status: 404 });
    }

    // Lookup the team to get the team ID
    const team = await getTeamByName(teamName);
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Get existing user assistants to avoid duplicates
    const existingUserAssistants = await getAllUserAssistantsByAssistantId(assistantId, teamName);
    const existingNuids = new Set(existingUserAssistants.map(ua => ua.nuid));

    // Filter out NUIDs that are already assigned
    const newNuids = nuids.filter(nuid => !existingNuids.has(nuid.toUpperCase()));

    if (newNuids.length === 0) {
      return NextResponse.json({
        message: 'No new assignments needed - all NUIDs are already assigned',
        skipped: nuids.length,
        added: 0
      }, { status: 200 });
    }

    // Check if users are team members and add them if they're not
    const usersNotInTeam = [];
    for (const nuid of newNuids) {
      const teamMember = await getTeamMember(teamName, nuid.toUpperCase());
      if (!teamMember) {
        usersNotInTeam.push(nuid.toUpperCase());
      }
    }

    // Add non-members to the team
    if (usersNotInTeam.length > 0) {
      // Add as TeamMembers with default 'member' role
      await upsertTeamMembers(teamName, usersNotInTeam);

      // Add team to each user's teams array in UserDetail
      for (const nuid of usersNotInTeam) {
        await addUserToTeam(nuid, teamName);
      }
    }

    // Build UserAssistant documents for bulk insert
    const userAssistantDocuments = newNuids.map(nuid => ({
      type: 'UserAssistant',
      id: uuidv4(),
      nuid: nuid.toUpperCase(),
      assistantId: assistantId,
      assistantName: assistant.name,
      teamName: teamName,
      teamId: team.id,
      app: 'SmartNotes'
    }));

    // Bulk insert the UserAssistant documents
    await addBulkUserAssistants(teamName, userAssistantDocuments);

    return NextResponse.json({
      message: 'User assistants added successfully',
      added: userAssistantDocuments.length,
      skipped: nuids.length - newNuids.length,
      addedToTeam: usersNotInTeam.length,
    }, { status: 201 });

  } catch (error) {
    console.error('Error bulk adding user assistants:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
