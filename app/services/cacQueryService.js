import { insertDocument } from "@/db/insertDocument";
import { selectDocumentExt } from "@/db/selectDocument";
import { validateBasicMulti, validateBasicSingle, validateDocumentDelete } from "./validation";
import { updateDocument } from "@/db/updateDocument";
import { deleteDocument } from "@/db/deleteDocument";

const documentType = 'DB Compare Query';

export async function selectCompareQuery(query, teamName) {
  query.type = documentType;
  return await selectDocumentExt(query, validateBasicMulti, null, `team-${teamName}-db`);
}

export async function createCompareQuery(document, teamName) {
  document.type = documentType;

  return await insertDocument(document, validateBasicSingle, `team-${teamName}-db`);
}

export async function updateCompareQuery(document, query, teamName) {
  query.type = documentType;
  document.type = documentType;
  return await updateDocument(document, query, validateBasicSingle, `team-${teamName}-db`);
}

export async function deleteCompareQuery(query, teamName) {
  query.type = documentType;
  return await deleteDocument(query, validateDocumentDelete, `team-${teamName}-db`);
}
