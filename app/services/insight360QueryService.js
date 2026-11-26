import { selectDocumentsExt } from "@/db/selectDocument";
import { validateInsight360Query, validateUpdateInsight360Query } from "./validation";
import { updateDocument } from "@/db/updateDocument";
import { insertDocument } from "@/db/insertDocument";

const documentType = 'SQLQuery';

export async function selectCompareQuery(query, teamName) {
  query.type = documentType;
  return await selectDocumentsExt(query, validateInsight360Query, null, `team-${teamName}-db`);
}

export async function updateCompareQuery(document, query, teamName) {
  query.type = documentType;
  document.type = documentType;
  return await updateDocument(document, query, validateUpdateInsight360Query, `team-${teamName}-db`);
}

export async function createCompareQuery(document, teamName) {
  return await insertDocument(document, validateInsight360Query, `team-${teamName}-db`);
}
