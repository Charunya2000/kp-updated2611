'use server';

import { deleteDocument } from '@db/deleteDocument';
import { getServerSession } from '@utils/getSession';
import { selectDocumentExt } from '@db/selectDocument';
import { upsertDocument } from '@db/updateDocument';
import { v4 as uuidv4 } from 'uuid';
import { validateSelectNews, validateUpsertNews } from './validation';

const documentType = 'AssistantNews';

export async function getAssistantNews(teamName, assistantName) {
  const query = { type: documentType, assistantName };
  return await selectDocumentExt(query, validateSelectNews, null, `team-${teamName}-db`);
}

export async function saveAssistantNews(news, teamName, assistantName) {
  const { nuid } = await getServerSession();
  const existing = await getAssistantNews(teamName, assistantName);

  const document = {
    type: documentType,
    assistantName,
    teamName,
    news,
    id: existing?.id || uuidv4(),
    createdBy: existing?.createdBy || nuid,
    updatedBy: nuid,
  };

  const query = { type: documentType, assistantName, teamName };
  return await upsertDocument(document, query, validateUpsertNews, `team-${teamName}-db`);
}

export async function deleteAssistantNews(teamName, assistantName) {
  const query = { type: documentType, assistantName };
  return await deleteDocument(query, validateSelectNews, `team-${teamName}-db`);
}
