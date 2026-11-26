'use server';

import { selectDocumentExt, selectDocumentsExt } from '@db/selectDocument';
import { validateBasicMulti, validateBasicSingleByName, validateBasicSingle, validateDocumentDelete } from './validation';
import { prepDocument } from '../clientServices/insertDocument';
import { insertDocument } from '@/db/insertDocument';
import { updateDocument } from '@/db/updateDocument';
import { deleteDocument } from '@/db/deleteDocument';

export async function getPtsSessionBySessionId(teamName, sessionId, options) {
  return await selectDocumentExt(
    { type: 'PtsSession', sessionId },
    validateBasicMulti,
    options,
    `team-${teamName}-db`
  );
}

export async function getPtsSessionById(teamName, id) {
  return await selectDocumentExt(
    { type: 'PtsSession', id: id },
    validateBasicSingle,
    {},
    `team-${teamName}-db`
  );
}

export async function getAllPtsSessions(teamName) {
  return await selectDocumentsExt(
    { type: 'PtsSession' },
    validateBasicMulti,
    { projection: { id: 1, sessionId: 1, createdAt: 1, status: 1 } },
    `team-${teamName}-db`
  );
}

export async function createPtsSession(teamName, ptsSession) {
  try {
    const { sessionId, status = 'active', slaData, sourceType, teamId } = ptsSession;

    const newSession = prepDocument({
      type: 'PtsSession',
      sessionId,
      status,
      slaData,
      sourceType,
      teamName,
      teamId,
      createdAt: new Date(),
    });

    return await insertDocument(newSession, validateBasicSingleByName, `team-${teamName}-db`);
  } catch (error) {
    console.error('Error creating PTS session:', error);
    return false;
  }
}

export async function updatePtsSession(teamName, sessionUpdate) {
  try {
    const { id, ...updateData } = sessionUpdate;

    const updatedSession = {
      type: 'PtsSession',
      ...updateData,
    };

    const updateQuery = {
      type: 'PtsSession',
      id: id,
    };

    return await updateDocument(updatedSession, updateQuery, validateBasicSingleByName, `team-${teamName}-db`);
  } catch (error) {
    console.error('Error updating PTS session:', error);
    return false;
  }
}

export async function deletePtsSession(teamName, sessionId) {
  try {
    const query = {
      type: 'PtsSession',
      sessionId: sessionId,
    };

    return await deleteDocument(query, validateDocumentDelete, `team-${teamName}-db`);
  } catch (error) {
    console.error('Error deleting PTS session:', error);
    return false;
  }
}

// Store analysis results
export async function storePtsAnalysisResult(teamName, analysisResult) {
  try {
    const { sessionId, result, status = 'completed' } = analysisResult;

    const analysisDoc = prepDocument({
      type: 'PtsAnalysisResult',
      sessionId,
      result,
      status,
      teamName,
      createdAt: new Date(),
    });

    return await insertDocument(analysisDoc, validateBasicSingleByName, `team-${teamName}-db`);
  } catch (error) {
    console.error('Error storing analysis result:', error);
    return false;
  }
}

export async function getPtsAnalysisResult(teamName, sessionId) {
  return await selectDocumentExt(
    { type: 'PtsAnalysisResult', sessionId },
    validateBasicSingle,
    {},
    `team-${teamName}-db`
  );
}
