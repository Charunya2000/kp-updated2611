import { NextResponse } from "next/server";
import { withAppAdminGuard } from "@/app/api/guards";
import { addTeam, updateTeam, deleteTeam, getTeamByName, getTeamById } from "@/app/services/teamService";
import { getAllTeamMembers } from "@/app/services/teamMemberService";
import { upsertTeamOwners } from "@/app/services/teamMemberService";
import { getTeamOwners, updateTeamMember } from "@/app/services/teamMemberService";
import { addUserToTeam } from "@/app/services/userService";

export const POST = await withAppAdminGuard(postHandler);
export const PUT = await withAppAdminGuard(putHandler);
export const DELETE = await withAppAdminGuard(deleteHandler);

async function postHandler(req) {
  try {
    const team = await req.json();

    const isExistingTeam = await getTeamByName(team.name);
    if (isExistingTeam) {
      return NextResponse.json({ error: 'Team already exists' }, { status: 409 });
    }

    const owners = team.owners;
    delete team.owners;
    const result = await addTeam(team);

    // Add team owners
    if (owners && owners.length > 0) {
      await upsertTeamOwners(result.name, owners);
    }

    // Update UserDetail in App DB
    if (result && result.name && owners && owners.length > 0) {
      for (const nuid of owners) {
        await addUserToTeam(nuid, result.name);
      }
    }

    result.owners = await getTeamOwners(result.name);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function putHandler(req) {
  try {
    const team = await req.json();

    const existingTeam = await getTeamById(team.id);
    if (!existingTeam) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    if (existingTeam.name !== team.name) {
      return NextResponse.json({ error: "A team's name can not be changed after it's created" }, { status: 409 });
    }

    if (team.owners && team.owners.length === 0) {
      return NextResponse.json({ error: 'A team must have at least one owner.' }, { status: 409 });
    }

    // remove owners from the existing team if they're not in the team
    const existingTeamOwners = await getTeamOwners(team.name);
    const removedOwners = existingTeamOwners.filter(owner => !team.owners.includes(owner.nuid));
    for (const owner of removedOwners) {
      let newRolesList = owner.roles.filter(role => role !== 'owner');
      if (newRolesList.length === 0) {
        newRolesList = ['member']; // ensure at least member role remains
      }
      const newGrants = (owner.grants || []).filter(g => g !== '*');
      await updateTeamMember({ id: owner.id, roles: [...newRolesList], grants: newGrants }, team.name);
    }

    // update any team specific data
    const updatedTeam = await updateTeam(team);
    // add any new owners
    await upsertTeamOwners(team.name, team.owners);

    // Update UserDetail in App DB (addUserToTeam is a no-op for users already on the team)
    if (team.owners && team.owners.length > 0) {
      for (const nuid of team.owners) {
        await addUserToTeam(nuid, team.name);
      }
    }

    // ensure the owners list is up-to-date
    updatedTeam.owners = await getTeamOwners(team.name);
    return NextResponse.json(updatedTeam, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function deleteHandler(req) {
  try {
    const team = await req.json();

    const existingTeam = await getTeamById(team.id);
    if (!existingTeam) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if team has members before allowing deletion
    const existingTeamMembers = await getAllTeamMembers(team.name);
    if (existingTeamMembers && existingTeamMembers.length > 0) {
      return NextResponse.json({ error: 'A team can not be deleted if members are assigned to it.' }, { status: 409 });
    }

    const result = await deleteTeam(team);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
