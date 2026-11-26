'use server'

import { validateBasicMulti, validateSingleUserDocument } from "./validation";
import { upsertDocument } from "@/db/updateDocument";
import { selectDocumentExt, selectDocumentsExt } from "@/db/selectDocument";
import { getAllTeams } from "./teamService";
import { getTeamMember } from "./teamMemberService";
import { prepDocument } from "../clientServices/insertDocument";

export async function upsertUser(user) {
  try {
    const query = { type: 'UserDetail', nuid: user.nuid };

    const userResult = await selectDocumentExt(query, validateBasicMulti);
    if (userResult) {
      delete user.id; // don't overwrite the existing id
      user.createdAt = userResult.createdAt;
    }

    user.teams = await ensureUserTeams(user.nuid);
    user.type = 'UserDetail';
    await upsertDocument(user, query, validateBasicMulti);
  } catch (error) {
    console.error("Error adding user:", error);
  }
}

async function ensureUserTeams(nuid) {
  try {
    if (!nuid) {
      console.error("Invalid NUID provided to ensureUserTeams");
      return;
    }

    // Get all teams in the system
    const allTeams = await getAllTeams();
    if (!allTeams || allTeams.length === 0) {
      return;
    }

    // Check each team to see if the user is a member
    const userTeams = new Set();

    for (const team of allTeams) {
      try {
        const teamMember = await getTeamMember(team.name, nuid);
        if (teamMember) {
          // User is a team member, ensure the team is in their teams array
          userTeams.add(team.name);
        }
      } catch (error) {
        console.error(`Error checking team membership for team ${team.name}:`, error);
      }
    }

    // Always ensure 'kpit-ai-portal-members' is included
    userTeams.add('kpit-ai-portal-members');

    // Convert Set back to array and update user
    return Array.from(userTeams);
  } catch (error) {
    console.error("Error ensuring user teams:", error);
  }
}

export async function addUserToTeam(nuid, teamName) {
  try {
    const query = { type: 'UserDetail', nuid: nuid };
    const user = await selectDocumentExt(query, validateSingleUserDocument);
    if (!user) {
      throw new Error('User not found');
    }

    const userTeams = user.teams || [];
    if (userTeams.includes(teamName)) {
      // User is already in the team
      return user;
    }

    user.teams = [...new Set([...userTeams, teamName])];
    return await upsertDocument(user, query, validateBasicMulti);
  } catch (error) {
    console.error("Error adding user to team:", error);
  }
}

export async function removeUserFromTeam(nuid, teamName) {
  try {
    const query = { type: 'UserDetail', nuid: nuid };
    const user = await selectDocumentExt(query, validateSingleUserDocument);
    if (!user) {
      throw new Error('User not found');
    }
    user.teams = user.teams.filter(name => name !== teamName);
    return await upsertDocument(user, query, validateBasicMulti);
  } catch (error) {
    console.error("Error removing user from team:", error);
  }
}

export async function getUserByNuid(nuid) {
  const query = {
    type: 'UserDetail',
    nuid: nuid
  };

  const user = await selectDocumentExt(query, validateSingleUserDocument);

  if (!user) {
    return null;
  }
  user.teamDbs = user.teams.map(teamName => `team-${teamName.toLowerCase()}-db`);

  return user;
};

export async function getUsersByNuid(nuids) {
  if (!Array.isArray(nuids) || nuids.length === 0) {
    throw new Error('NUIDs must be a non-empty array');
  }

  const query = {
    type: 'UserDetail',
    nuid: { $in: nuids }
  };

  const users = await selectDocumentsExt(query, validateBasicMulti);

  if (!users || users.length === 0) {
    return [];
  }

  return users;
};

export async function addHashedNuidMapping(nuid, hash) {
  let document = prepDocument({ type: 'UserIdHashMap', nuid: nuid, hash: hash });
  const query = { type: 'UserIdHashMap', nuid: nuid, hash: hash };

  const existingMapping = await selectDocumentExt({ type: 'UserIdHashMap', nuid: nuid, hash: hash }, validateBasicMulti);
  if (existingMapping) {
    delete document.id; // don't overwrite the existing id
    document.createdAt = existingMapping.createdAt; // preserve original createdAt
  }
  document.updatedBy = nuid;

  const result = await upsertDocument(document, query, validateBasicMulti);
  if (!result) {
    console.error(`Failed to upsert hashed NUID mapping for nuid: ${nuid}`);
  }
  return result;
}
