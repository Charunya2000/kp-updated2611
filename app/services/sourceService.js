'use server';

import { selectDocument, selectDocumentExt, selectDocuments, selectDocumentsExt } from '@db/selectDocument';
import { insertDocument } from '@db/insertDocument';
import { updateBulkDocuments, updateDocument, updateDocuments } from '@db/updateDocument';
import { deleteDocument, deleteDocuments } from '@db/deleteDocument';
import { getServerSession } from '@utils/getSession';
import { v4 } from 'uuid';
import { validateArgumentsMulti, validateBasicChildMulti, validateBasicMulti } from './validation';

export async function createSource(document, teamName) {
  const { nuid } = await getServerSession();
  document.nuid = nuid;
  return await insertDocument(document, null, `team-${teamName}-db`);
}

export async function selectSource(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await selectDocument(query, `team-${teamName}-db`);
}

export async function selectSourceBySourceId(sourceId, parentId, teamName) {
  const { nuid } = await getServerSession();
  const query = { type: 'Source', nuid: nuid, sourceId: sourceId, parentId: parentId };
  return await selectDocumentExt(query, validateArgumentsMulti, null, `team-${teamName}-db`);
}

export async function selectSources(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await selectDocuments(query, `team-${teamName}-db`);
}

export async function updateSource(document, teamName) {
  const { nuid } = await getServerSession();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocument(document, null, null, `team-${teamName}-db`);
}

export async function updateSources(req, teamName) {
  const { nuid } = await getServerSession();
  const document = await req.json();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocuments(document, null, `team-${teamName}-db`);
}

export async function updateBulkSources(sources, teamName) {
  const updateOperations = [];
  for (const source of sources) {
    const opp = {
      updateOne: {
        filter: { id: source.id },
        update: {
          $set: {
            selected: source.selected,
            enabled: source.enabled,
            updatedAt: new Date()
          }
        }
      }
    }
    updateOperations.push(opp);
  }

  const batchSize = 100;
  for (let i = 0; i < updateOperations.length; i += batchSize) {
    const batch = updateOperations.slice(i, i + batchSize);
    await updateBulkDocuments(batch, false, `team-${teamName}-db`);
  }
}

export async function deleteSource(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await deleteDocument(query, null, `team-${teamName}-db`);
}

export async function deleteSources(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await deleteDocuments(query, `team-${teamName}-db`);
}

export async function getSourceBySearchIndexConfigId(teamName, assistantName, configId) {

  try {
    // Query for sources that are DesignIndex type and have a relationship to the config ID
    const query = {
      type: 'Source',
      sourceType: 'DesignIndex',
      searchIndexConfigId: configId
    };

    const sources = await selectDocumentsExt(query, validateBasicMulti, null, `team-${teamName}-db`);

    return sources || [];
  } catch (error) {
    console.error('Error fetching sources by config ID:', error);
    throw error;
  }
}

export async function cloneSources(templateQuery, newParentId, teamName) {
  const existingSources = await selectDocumentsExt(templateQuery, validateBasicChildMulti, null, `team-${teamName}-db`);
  if (!existingSources) {
    return null;
  }

  const newSources = [];
  const { nuid } = await getServerSession();

  await Promise.all(existingSources.map(async (src) => {
    const newDocument = { ...src };
    delete newDocument._id;

    newDocument.nuid = nuid;
    newDocument.smartNoteId = newParentId;
    newDocument.parentId = newParentId;
    newDocument.createdNUID = nuid;
    newDocument.id = v4();
    newDocument.sourceId = v4();

    const insertedDocument = await insertDocument(newDocument, null, `team-${teamName}-db`);

    newDocument.oldSourceId = src.sourceId;
    newSources.push(insertedDocument);
  }));

  return newSources;
}