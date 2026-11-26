'use server';

import { selectDocumentsExt, selectDocumentExt } from '@db/selectDocument';
import { deleteDocument, deleteDocumentsExt } from '@db/deleteDocument';
import { getAssistantByName } from './assistantService';
import { insertBulkDocuments, insertDocument } from '@db/insertDocument';
import { updateBulkDocuments, updateDocument } from '@db/updateDocument';
import { getCurrentUserNuid } from '@utils/getSession';
import { validateBasicMulti, validateBasicSingleByName, validateBasicSingleUserAssistant, validateDocumentDelete, validateSingleUserDocument } from './validation';
import { getUserByNuid } from './userService';
import { getAllTeams } from './teamService';

function isDemoUserNuid(nuid) {
  const configuredDemoNuid = (process.env.DEMO_AUTH_BYPASS_DEFAULT_NUID || 'DEMOUSER').trim().toUpperCase();
  return !!nuid && nuid.toUpperCase() === configuredDemoNuid;
}

function getDemoAssumptions() {
  return {
    teamName: (process.env.DEMO_AUTH_BYPASS_DEFAULT_TEAM || '').trim(),
    assistantName: (process.env.DEMO_AUTH_BYPASS_DEFAULT_ASSISTANT || '').trim(),
  };
}

export async function createUserAssistant(req, teamName) {
  const { nuid } = await getCurrentUserNuid();
  const document = await req.json();
  document.nuid = nuid;
  return await insertDocument(document, null, `team-${teamName}-db`);
}

export async function getUserAssistant(assistantId, nuid, teamName) {
  const query = { type: 'UserAssistant', assistantId: assistantId, nuid: nuid };
  if (!query.nuid) {
    // if not selecting userAssistants for specific user
    // request for session owner's user
    const { nuid } = await getCurrentUserNuid();
    query.nuid = nuid.toUpperCase();
  }
  return await selectDocumentExt(query, validateBasicSingleUserAssistant, null, `team-${teamName}-db`);
}

export async function updateUserAssistant(req, teamName) {
  const { nuid } = await getCurrentUserNuid();
  const document = await req.json();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocument(document, null, null, `team-${teamName}-db`);
}

export async function getAllUserAssistantsByAssistantId(assistantId, teamName) {
  const query = { type: 'UserAssistant', assistantId: assistantId };
  return await selectDocumentsExt(query, validateBasicMulti, null, `team-${teamName}-db`);
}

export async function getUserAssistants(teamName, nuid) {
  // for each team, get the associated user assistants from the respective DB
  const userAssistants = await selectDocumentsExt({ type: 'UserAssistant', nuid: nuid }, validateBasicMulti, {}, `team-${teamName}-db`);
  const assistants = await selectDocumentsExt({ type: 'Assistant', $or: [{ id: { $in: userAssistants.map(ua => ua.assistantId) } }, { isPublic: true }] }, validateBasicMulti, {}, `team-${teamName}-db`);

  // merge the two lists
  const mergedAssistants = userAssistants.map(userAssistant => {
    const assistant = assistants.find(a => a.id === userAssistant.assistantId);
    return {
      ...userAssistant,
      ...(assistant ? { assistantName: assistant.name, category: assistant.category, displayName: assistant.displayName } : {})
    };
  });

  const result = {
    message: 'success',
    assistants: mergedAssistants.map(userAssistant => {
      return {
        name: userAssistant.assistantName,
        category: userAssistant.category,
        displayName: userAssistant.displayName
      }
    })
  };

  return result;
}

export async function getUserAssistantsByAssistantId(teamName, assistantId) {
  // for each team, get the associated user assistants from the respective DB
  const userAssistants = await selectDocumentsExt({ type: 'UserAssistant', assistantId }, validateBasicMulti, {}, `team-${teamName}-db`);
  const assistants = await selectDocumentsExt({ type: 'Assistant', $or: [{ id: { $in: userAssistants.map(ua => ua.assistantId) } }, { isPublic: true }] }, validateBasicMulti, {}, `team-${teamName}-db`);

  // merge the two lists
  const mergedAssistants = userAssistants.map(userAssistant => {
    const assistant = assistants.find(a => a.id === userAssistant.assistantId);
    return {
      ...userAssistant,
      ...(assistant ? { assistantName: assistant.name, category: assistant.category, displayName: assistant.displayName } : {})
    };
  });

  const result = {
    message: 'success',
    assistants: mergedAssistants.map(userAssistant => {
      return {
        name: userAssistant.assistantName,
        category: userAssistant.category,
        displayName: userAssistant.displayName
      }
    })
  };

  return result;
}

export async function getUserAssistantsByNUID(nuid) {
  if (!nuid) {
    nuid = await getCurrentUserNuid();
  }
  nuid = nuid.toUpperCase();

  // get user's associated teams from main DB
  const userDetail = await getUserByNuid(nuid);
  let teamDBs = [];
  if (userDetail && userDetail.teams && userDetail.teams.length > 0) {
    teamDBs = userDetail.teams.map(teamName => `team-${teamName}-db`);
  }

  const demoUser = isDemoUserNuid(nuid);
  const { teamName: demoTeamName, assistantName: demoAssistantName } = getDemoAssumptions();
  if (demoUser && teamDBs.length === 0 && demoTeamName) {
    teamDBs = [`team-${demoTeamName}-db`];
  }

  if (!Array.isArray(teamDBs) || teamDBs.length === 0) {
    const demoFallbackAssistants = demoUser && demoTeamName && demoAssistantName
      ? [{
        name: demoAssistantName,
        parentName: null,
        category: null,
        displayName: demoAssistantName,
        assistantId: null,
        teamId: null,
        teamName: demoTeamName,
        teamDisplayName: demoTeamName,
      }]
      : [];

    return {
      message: 'success',
      assistants: demoFallbackAssistants
    };
  }

  // for each team, get the associated user assistants from the respective DB
  let assistants = [];
  const teams = await getAllTeams() || [];
  for (const teamDb of teamDBs) {
    const userAssistants = await selectDocumentsExt({ type: 'UserAssistant', nuid }, validateBasicMulti, {}, teamDb);
    const assistantIds = userAssistants.map(userAssistant => userAssistant.assistantId);
    const teamAssistants = await selectDocumentsExt({ type: 'Assistant', $or: [{ id: { $in: assistantIds } }, { isPublic: true }] }, validateBasicMulti, {}, teamDb);
    // get the Team displayName for each assistant if teamId is set
    for (const assistant of teamAssistants) {
      const team = teams.find(t => t.id === assistant.teamId);
      assistant.teamDisplayName = team?.displayName;
    }
    assistants = assistants.concat(teamAssistants);
  }

  if (demoUser && demoTeamName && demoAssistantName) {
    const alreadyIncluded = assistants.some(assistant =>
      assistant?.teamName === demoTeamName && assistant?.name === demoAssistantName
    );

    if (!alreadyIncluded) {
      assistants.push({
        name: demoAssistantName,
        category: null,
        displayName: demoAssistantName,
        id: null,
        teamId: null,
        teamName: demoTeamName,
        teamDisplayName: demoTeamName,
      });
    }
  }

  const result = {
    message: 'success',
    assistants: assistants.map(assistant => {
      return {
        name: assistant.name,
        parentName: assistant.category,
        category: assistant.category,
        displayName: assistant.displayName,
        description: assistant.description,
        assistantId: assistant.id,
        teamId: assistant.teamId,
        teamName: assistant.teamName,
        teamDisplayName: assistant.teamDisplayName,
        isNavRoute: assistant.isNavRoute ?? false, // default to false if not explicitly set
        isDeleteSmartNoteEnabled: assistant.isDeleteSmartNoteEnabled ?? true, // default to true if not explicitly set to false
      }
    })
  };

  return result;
}


export async function upsertUserAssistants(nuid, userAssistants, teamName) {
  // userAssistants input looks like: {name: name, assigned: true}
  nuid = nuid.toUpperCase();
  const timestamp = new Date();
  const bulkOps = [];

  for (const assistant of userAssistants) {
    const existingAssistant = await selectDocumentExt({ type: 'Assistant', name: assistant.name }, validateBasicSingleByName, null, `team-${teamName}-db`);
    const assistantId = existingAssistant.id;
    if (!assistantId) {
      console.warn(`Assistant with name "${assistant.name}" not found. Skipping.`);
      continue;
    }
    assistant.id = assistantId;

    const existingUserAssistant = await getUserAssistant(assistant.id, nuid, teamName);
    if (existingUserAssistant) {
      assistant.exists = true;
    }

    if (assistant.assigned && !assistant.exists) {
      bulkOps.push({
        insertOne: {
          document: {
            type: 'UserAssistant',
            nuid: nuid,
            assistantId: assistant.id,
            createdAt: timestamp,
            updatedAt: timestamp,
            updatedBy: nuid,
            app: 'SmartNotes'
          },
        }
      });
    }
    if (!assistant.assigned && assistant.exists) {
      bulkOps.push({
        deleteOne: {
          filter: { type: 'UserAssistant', nuid: nuid, assistantId: assistant.id }
        }
      });
    }
  }

  return await updateBulkDocuments(bulkOps, false, `team-${teamName}-db`);
}

/**
 * Utility function to check if a user has access to a specific assistant
 */
export async function userHasAssistant(nuid, assistantName, teamName) {
  if (!nuid) {
    nuid = await getCurrentUserNuid();
  }
  nuid = nuid.toUpperCase();

  const assistant = await getAssistantByName(teamName, assistantName, { projection: { id: 1 } });
  if (!assistant) {
    return false;
  }

  const userAssistant = await selectDocumentExt({
    type: 'UserAssistant',
    nuid: nuid,
    assistantId: assistant.id
  }, validateBasicSingleUserAssistant, null, `team-${teamName}-db`);

  return !!userAssistant;
}

export async function deleteUserAssistant(teamName, userAssistantId) {
  const query = { type: 'UserAssistant', id: userAssistantId };
  return await deleteDocument(query, validateDocumentDelete, `team-${teamName}-db`);
}

export async function deleteUserAssistantsByAssistantId(teamName, assistantId) {
  const query = { type: 'UserAssistant', assistantId: assistantId };
  return await deleteDocumentsExt(query, validateBasicMulti, `team-${teamName}-db`);
}

export async function addBulkUserAssistants(teamName, documents) {
  // Build UserAssistant documents for bulk insert

  return await insertBulkDocuments(documents, validateSingleUserDocument, `team-${teamName}-db`);
}