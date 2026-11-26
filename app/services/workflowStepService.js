'use server';

import { selectDocument, selectDocuments } from '@db/selectDocument';
import { insertDocument } from '@db/insertDocument';
import { updateDocument, updateDocuments } from '@db/updateDocument';
import { deleteDocument, deleteDocuments } from '@db/deleteDocument';
import { getServerSession } from '@utils/getSession';

export async function createWorkflowStep(document, teamName) {
  const { nuid } = await getServerSession();
  document.nuid = nuid;
  return await insertDocument(document, null, `team-${teamName}-db`);
}

export async function selectWorkflowStep(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await selectDocument(query, `team-${teamName}-db`);
}

export async function selectWorkflowSteps(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await selectDocuments(query, `team-${teamName}-db`);
}

export async function updateWorkflowStep(document, teamName) {
  const { nuid } = await getServerSession();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocument(document, null, null, `team-${teamName}-db`);
}

export async function updateWorkflowSteps(req, teamName) {
  const { nuid } = await getServerSession();
  const document = await req.json();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocuments(document, null, `team-${teamName}-db`);
}

export async function deleteWorkflowStep(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  return await deleteDocument(query, null, `team-${teamName}-db`);
}

export async function deleteWorkflowSteps(req, teamName) {
  const { nuid } = await getServerSession();
  const query = await req.json();
  query.nuid = nuid;
  return await deleteDocuments(query, `team-${teamName}-db`);
}

export async function generateMermaidWorkflow(workflowId, teamName) {
  const { nuid } = await getServerSession();

  // Step 1: Retrieve all workflowSteps with the given parent (workflowId)
  const workflowSteps = await selectDocuments({
    parent: workflowId,
    nuid: nuid
  }, `team-${teamName}-db`);

  // Step 2: Extract and concatenate the mermaidNode attributes
  const mermaidNodes = workflowSteps
    .map(step => step.mermaidNode)
    .filter(node => node) // Ensure only valid nodes are included
    .join('\n');

  // Step 3: Wrap the concatenated nodes in a Mermaid diagram structure
  const mermaidWorkflow = `graph TD\n${mermaidNodes}`;

  return mermaidWorkflow;
}
