'use server';

import { selectDocumentsExt } from '@/db/selectDocument.js';
import { validateSingleUserDocument } from '@/app/services/validation';

const DEFAULT_DATABASE = 'aisvc_userdb';
const DEFAULT_COLLECTION = 'user_collection';

export async function getUserDetailNuidsCsv({
  dbName = DEFAULT_DATABASE,
  collectionName = DEFAULT_COLLECTION,
} = {}) {
  const documents = await selectDocumentsExt(
    { type: 'UserDetail', nuid: { $exists: true, $ne: null } },
    validateSingleUserDocument,
    { projection: { _id: 0, nuid: 1 } },
    dbName,
    collectionName
  );

  const nuids = Array.from(
    new Set(
      documents
        .map((document) => String(document?.nuid ?? '').trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'getUserDetailNuidsCsv',
      detail: {
        dbName,
        collectionName,
        nuidCount: nuids.length,
      },
    },
  }));

  return {
    csv: `NUID\n${nuids.join('\n')}\n`,
    nuidCount: nuids.length,
  };
}