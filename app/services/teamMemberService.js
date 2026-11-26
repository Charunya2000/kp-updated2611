'use server';

import { selectDocumentExt, selectDocumentsExt } from '@db/selectDocument';
import { validateBasicMulti, validateDocumentDelete } from './validation';
import { prepDocument } from '../clientServices/insertDocument';
import { insertDocument } from '@/db/insertDocument';
import { updateDocument } from '@/db/updateDocument';
import { deleteDocument } from '@/db/deleteDocument';
import { insertBulkDocuments } from '@/db/insertDocument';
import { getAllTeams, getTeamByName } from './teamService';
import { getServerSession, getCurrentUserNuid } from '@/utils/getSession';
import { getUserByNuid, removeUserFromTeam } from './userService';
import { getAllGlobalRoleTemplates } from './roleTemplateService';
import { resolvePermissionsBatch } from './permissionsService';

export async function getTeamMemberByNuidAndTeamId(nuid, teamId, options, teamName) {
  return await selectDocumentExt({
    type: 'TeamMember',
    nuid,
    teamId
  }, validateBasicMulti, options, `team-${teamName}-db`);
};

export async function getTeamMembersByTeamId(teamId, teamName) {
  return await selectDocumentsExt(
    { type: 'TeamMember', teamId },
    validateBasicMulti,
    {},
    `team-${teamName}-db`
  );
}

export async function getTeamMembersByNuid(nuids, teamName) {
  return await selectDocumentsExt(
    { type: 'TeamMember', nuid: { $in: nuids } },
    validateBasicMulti,
    {},
    `team-${teamName}-db`
  );
}

// export async function getTeamMemberTeamsList(teamName) {
//   const nuid = (await getServerSession()).nuid;
//   const teamMembers = await getTeamMembersByNuid([nuid], teamName);
//   const teamIds = teamMembers.map(member => member.teamId);
//   const uniqueTeamIds = [...new Set(teamIds)];

//   const teams = await getAllTeams();
//   const userTeams = teams.filter(team => uniqueTeamIds.includes(team.id));
//   return userTeams;
// }

export async function getTeamMemberTeamsListWithRoles(nuid) {
  if (!nuid) {
    nuid = await getCurrentUserNuid();
  }
  nuid = nuid.toUpperCase();

  // get user's associated teams from main DB
  const userDetail = await getUserByNuid(nuid);
  let teamNames = [];
  if (userDetail && userDetail.teams && userDetail.teams.length > 0) {
    teamNames = userDetail.teams;
  }
  // for each teamName the user has
  const teamMemberTeams = [];
  const teams = await getAllTeams();
  const globalTemplates = await getAllGlobalRoleTemplates();

  // Collect entries for batch permission resolution
  const entries = [];
  for (const teamName of teamNames) {
    const teamMember = await getTeamMember(teamName, nuid);
    if (teamMember) {
      const team = teams.find(t => t.name === teamName);
      if (team) {
        entries.push({ teamName, teamMember, team });
        teamMemberTeams.push({
          id: team?.id,
          teamName: team?.name,
          roles: teamMember.roles,
          grants: teamMember.grants || [],
          displayName: team?.displayName,
          description: team?.description,
          iconUrl: team?.iconUrl
        });
      } else {
        console.error(JSON.stringify({ kpmsg: { id: "AI_PORTAL_NOTEBOOK", name: 'getTeamMemberTeamsListWithRoles', detail: { error: `TeamMember assigned to non-existant team: ${teamName}`, teamName, teamMember } } }));
      }
    }
  }

  // Resolve permissions in batch and attach to each entry
  const permissionSets = resolvePermissionsBatch(entries, globalTemplates);
  for (let i = 0; i < teamMemberTeams.length; i++) {
    teamMemberTeams[i].permissions = permissionSets[i] || [];
  }

  return teamMemberTeams;
}

export async function getAllTeamMembers(teamName) {
  return await selectDocumentsExt(
    { type: 'TeamMember' },
    validateBasicMulti,
    {},
    `team-${teamName}-db`
  );
}

export async function getTeamMember(teamName, nuid) {
  return await selectDocumentExt(
    { type: 'TeamMember', nuid },
    validateBasicMulti,
    {},
    `team-${teamName}-db`
  );
}

export async function getTeamOwners(teamName) {
  const members = await selectDocumentsExt(
    { type: 'TeamMember' },
    validateBasicMulti,
    {},
    `team-${teamName}-db`
  );

  const owners = members.filter(member => member.roles?.includes('owner'));
  return owners;
}

export async function isTeamOwner(teamName, nuid) {
  const owners = await getTeamOwners(teamName);
  return owners.some(owner => owner.nuid === nuid);
}

export async function addTeamMember(teamMember, teamName) {
  try {
    const { nuid, roles, grants } = teamMember;

    const newTeamMember = prepDocument({
      type: 'TeamMember',
      nuid,
      teamName,
      roles: roles || ['member'], // default roles
      grants: grants || [],
    });

    return await insertDocument(newTeamMember, validateBasicMulti, `team-${teamName}-db`);
  } catch (error) {
    console.error('Error adding team member:', error);
    return false;
  }
}

export async function upsertTeamMembers(teamName, memberNuids) {
  try {
    return await upsertTeamMembersWithRoles(teamName, memberNuids, ['member']);
  } catch (error) {
    console.error('Error adding team members:', error);
    return false;
  }
}

export async function upsertTeamOwners(teamName, memberNuids) {
  try {
    return await upsertTeamMembersWithRoles(teamName, memberNuids, ['owner']);
  } catch (error) {
    console.error('Error adding team members:', error);
    return false;
  }
}

export async function upsertTeamMembersWithRoles(teamName, memberNuids, roles) {
  try {
    const existingMembers = await getTeamMembersByNuid(memberNuids, teamName);
    const existingNuids = existingMembers.map(member => member.nuid);
    const newMemberNuids = memberNuids.filter(nuid => !existingNuids.includes(nuid));

    // Resolve permissions from role templates so grants stay in sync
    const [globalTemplates, team] = await Promise.all([
      getAllGlobalRoleTemplates(),
      getTeamByName(teamName),
    ]);
    const templateMap = new Map();
    for (const t of (globalTemplates || [])) templateMap.set(t.name, t);
    for (const t of (team?.authorization?.roleTemplates || [])) templateMap.set(t.name, t);

    const rolePermissions = roles.flatMap(r => templateMap.get(r)?.permissions || []);
    const isOwner = roles.includes('owner');

    for (const member of existingMembers) {
      const updatedRoles = Array.from(new Set([...(member.roles || []), ...roles]));
      const allRolePerms = updatedRoles.flatMap(r => templateMap.get(r)?.permissions || []);
      if (updatedRoles.includes('owner')) allRolePerms.push('*');
      const updatedGrants = Array.from(new Set([...(member.grants || []), ...allRolePerms]));
      await updateTeamMember({ id: member.id, roles: updatedRoles, grants: updatedGrants }, teamName);
    }


    if (newMemberNuids.length === 0) {
      return true; // No new members to add
    }

    const grants = Array.from(new Set([...rolePermissions, ...(isOwner ? ['*'] : [])]));

    const teamMembers = newMemberNuids.map(nuid => prepDocument({
      type: 'TeamMember',
      nuid,
      teamName,
      roles: roles,
      grants,
    }));

    return await insertBulkDocuments(teamMembers, validateBasicMulti, `team-${teamName}-db`);
  } catch (error) {
    console.error('Error adding team members:', error);
    return false;
  }
}

export async function updateTeamMember(teamMember, teamName) {
  try {
    const { id, roles, grants } = teamMember;

    const updatedTeamMember = {
      type: 'TeamMember',
      roles,
    };

    // Persist grants if provided
    if (grants !== undefined) {
      updatedTeamMember.grants = grants;
    }

    const updateQuery = {
      type: 'TeamMember',
      id
    };

    return await updateDocument(updatedTeamMember, updateQuery, validateBasicMulti, `team-${teamName}-db`);
  } catch (error) {
    console.error('Error updating team member:', error);
    return false;
  }
}

export async function deleteTeamMember(teamMember, teamName) {
  try {
    const { id, memberNuid } = teamMember;

    const query = {
      type: 'TeamMember',
      id
    };

    const deletionResult = await deleteDocument(query, validateDocumentDelete, `team-${teamName}-db`);

    if (deletionResult) {
      await removeUserFromTeam(memberNuid, teamName);
    }

    return deletionResult;
  } catch (error) {
    console.error('Error deleting team member:', error);
    return false;
  }
}
