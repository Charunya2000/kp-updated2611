import { insertDocument } from "@/db/insertDocument";
import { selectDocumentExt, selectDocumentsExt } from "@/db/selectDocument";
import { validateBasicMulti, validateBasicSingle } from "./validation";
import { updateDocument } from "@/db/updateDocument";
import { deleteDocument } from "@/db/deleteDocument";

const documentType = 'CacControlReport';

function getDefaultTargetDatabase() {
  const envName = process.env.envName || 'dev';
  if (envName === 'dev') {
    return 'dev';
  }
  if (envName === 'uat') {
    return 'uat';
  }
  return 'default';
}

function normalizeTargetDatabase(targetDatabase) {
  const validTargetDatabases = ['default', 'dev', 'uat', 'rbc2'];
  if (!targetDatabase) {
    return getDefaultTargetDatabase();
  }
  if (targetDatabase === 'default') {
    return getDefaultTargetDatabase();
  }
  return validTargetDatabases.includes(targetDatabase) ? targetDatabase : getDefaultTargetDatabase();
}


export async function selectCacControlReports(teamName, dataset) {
  const query = { type: documentType, dataset: dataset };

  return await selectDocumentsExt(query, validateBasicMulti, null, `team-${teamName}-db`);
}

export async function selectCacControlReportsByTargetDatabase(teamName, dataset, targetDatabase = 'default') {
  const envName = process.env.envName || 'dev';
  const normalizedTargetDatabase = normalizeTargetDatabase(targetDatabase);
  const isProdLikeEnv = ['prod', 'pp', 'psup'].includes(envName);
  const includeLegacyDefault = isProdLikeEnv && normalizedTargetDatabase === 'default';
  const query = {
    type: documentType,
    dataset,
    $or: [
      { targetDatabase: normalizedTargetDatabase },
      ...(includeLegacyDefault ? [{ targetDatabase: 'default' }, { targetDatabase: { $exists: false } }] : []),
    ],
  };

  return await selectDocumentsExt(query, validateBasicMulti, null, `team-${teamName}-db`);
}

export async function selectCacControlReport(teamName, query) {
  query.targetDatabase = normalizeTargetDatabase(query.targetDatabase);
  query.type = documentType;
  return await selectDocumentExt(query, validateBasicMulti, null, `team-${teamName}-db`);
}

export async function createCacControlReport(teamName, document) {
  document.targetDatabase = normalizeTargetDatabase(document.targetDatabase);
  document.type = documentType;

  return await insertDocument(document, validateBasicSingle, `team-${teamName}-db`);
}

export async function updateCacControlReport(teamName, document, query) {
  const normalizedTargetDatabase = normalizeTargetDatabase(document.targetDatabase || query.targetDatabase);
  document.targetDatabase = normalizedTargetDatabase;
  query.targetDatabase = normalizedTargetDatabase;
  query.type = documentType;
  document.type = documentType;
  return await updateDocument(document, query, validateBasicSingle, `team-${teamName}-db`);
}

export async function deleteCacControlReport(teamName, query) {
  query.targetDatabase = normalizeTargetDatabase(query.targetDatabase);
  query.type = documentType;
  return await deleteDocument(query, validateBasicSingle, `team-${teamName}-db`);
}
