'use server';

import { selectDocumentExt, selectDocumentsExt, aggregateTeamsWithOwners } from '@db/selectDocument';
import { validateBasicMulti, validateBasicSingleByName, validateBasicSingle, validateDocumentDelete } from './validation';
import { prepDocument } from '../clientServices/insertDocument';
import { insertDocument } from '@/db/insertDocument';
import { updateDocument } from '@/db/updateDocument';
import { deleteDocument } from '@/db/deleteDocument';
import { doesDatabaseExist, createTeamDatabase, updateDatabaseThroughput } from '../../db/connection.js';
import { getServerSession } from '@/utils/getSession';
import { formatName } from '@/utils/formatting';
import { removeUserFromTeam } from './userService';
// NOTE Team is stored in the Application Database: 'aisvc_userdb'
export async function getTeamByName(name, options) {
  return await selectDocumentExt({ type: 'Team', name }, validateBasicMulti, options);
};

export async function getTeamById(id) {
  return await selectDocumentExt({ type: 'Team', id }, validateBasicSingle);
};

export async function getAllTeams() {
  return await selectDocumentsExt({ type: 'Team' }, validateBasicMulti);
}

export async function getAllTeamsWithOwners() {
  return await aggregateTeamsWithOwners();
}

export async function addTeam(team) {
  const { nuid } = await getServerSession();
  let insertedTeam = null;

  // Create the Team document
  try {
    const { name, displayName, description, size, iconUrl } = team;

    const teamName = formatName(name);
    const newTeam = prepDocument({
      type: 'Team',
      name: teamName,
      dbName: `team-${teamName}-db`,
      displayName,
      description,
      size,
      iconUrl,
      createdBy: nuid,
      updatedBy: nuid
    });

    insertedTeam = await insertDocument(newTeam, validateBasicSingleByName);
  } catch (error) {
    console.error(JSON.stringify({ kpmsg: { id: "AI_PORTAL_NOTEBOOK", name: 'addTeam', detail: { message: 'Error creating new team', team: newTeam, error: error } } }));
    return null;
  }

  // Create the Team database
  try {
    // check if the db exists for this team and create it if not
    const dbExists = await doesDatabaseExist(insertedTeam.dbName);
    if (!dbExists) {
      await createTeamDatabase(insertedTeam.dbName, ['user_collection', 'statistics'], team.size);
    }
  } catch (error) {
    console.error(JSON.stringify({ kpmsg: { id: "AI_PORTAL_NOTEBOOK", name: 'addTeam', detail: { message: 'Error creating new database', team: insertedTeam, error: error } } }));
    // If database creation fails, rollback the team creation
    if (insertedTeam && insertedTeam.id) {
      await deleteTeam({ id: insertedTeam.id });
      return null;
    }
  }

  return insertedTeam;
}

export async function updateTeam(team) {
  const { nuid } = await getServerSession();
  let updatedDoc = null;

  try {
    const { displayName, description, iconUrl, size, id, authorization } = team;

    const updatedTeam = {
      type: 'Team',
      displayName,
      description,
      size,
      iconUrl,
      updatedBy: nuid,
      updatedAt: new Date()
    };

    // Persist authorization config if provided
    if (authorization !== undefined) {
      updatedTeam.authorization = authorization;
    }

    const updateQuery = {
      type: 'Team',
      id
    };

    updatedDoc = await updateDocument(updatedTeam, updateQuery, validateBasicMulti);
  } catch (error) {
    console.error('Error updating team:', error);
    return null;
  }

  try {
    await updateDatabaseThroughput(`team-${team.name}-db`, updatedDoc.size);

    return updatedDoc;
  } catch (error) {
    console.error('Error updating team database:', error);
    return updatedDoc;
  }
}

export async function deleteTeam(team) {
  try {
    const { id } = team;

    const query = {
      type: 'Team',
      id
    };

    const result = await deleteDocument(query, validateDocumentDelete);

    if (result) {
      const usersInDeletedTeam = await selectDocumentsExt({ type: 'UserDetail', teams: { $in: [team.name] } }, validateBasicMulti);
      for (const user of usersInDeletedTeam) {
        await removeUserFromTeam(user.nuid, team.name);
      }
    }
  } catch (error) {
    console.error('Error deleting team:', error);
    return false;
  }

  // TODO: Check if this is an operation we should even allow
  // try {
  //   team.dbName = team.dbName || `team-${team.name}-db`;
  //   const dbExists = await doesDatabaseExist(team.dbName);
  //   if (dbExists) {
  //     await deleteTeamDatabase(team.dbName);
  //   }

  // } catch (error) {
  //   console.error('Error deleting team:', error);
  //   return false;
  // }

  return true;
}
