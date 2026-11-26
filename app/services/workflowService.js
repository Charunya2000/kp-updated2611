'use server';

import { selectDocumentExt, selectDocumentsExt } from '@db/selectDocument';
import { insertDocument } from '@db/insertDocument';
import { updateDocument } from '@db/updateDocument';
import { deleteDocument } from '@db/deleteDocument';
import { getServerSession } from '@utils/getSession';
import { validateDocumentDelete, validateBasicSingle, validateBasicMulti, validateBasicSingleByName } from './validation';
import { prepDocument } from '../clientServices/insertDocument';

// path,
// name,
// message,
// requiresUpload,
// disabled,
// associatedAssistants

const dbType = { Workflow: 'WorkflowConfig' };

export async function createWorkflow(teamName, document) {
  const { nuid } = await getServerSession();

  const workflow = prepDocument({
    type: dbType.Workflow,
    path: document.path,
    name: document.name,
    message: document.message,
    requiresUpload: document.requiresUpload,
    disabled: document.disabled,
    associatedAssistants: document.associatedAssistants,
    createdBy: nuid,
    updatedBy: nuid
  });

  return await insertDocument(workflow, validateBasicSingleByName, `team-${teamName}-db`);
}

export async function updateWorkflow(teamName, id, document) {
  const { nuid } = await getServerSession();

  const query = { type: dbType.Workflow, id: id };
  const workflow = {
    ...document,
    type: dbType.Workflow,
    updatedBy: nuid
  };
  return await updateDocument(workflow, query, validateBasicSingle, `team-${teamName}-db`);
}

export async function deleteWorkflow(teamName, id) {
  const { nuid } = await getServerSession();

  return await deleteDocument({ type: dbType.Workflow, id }, validateDocumentDelete, `team-${teamName}-db`);
}

export async function getAllWorkflows(teamName) {
  const { nuid } = await getServerSession();

  return await selectDocumentsExt({ type: dbType.Workflow }, validateBasicMulti, null, `team-${teamName}-db`);
}

export async function getWorkflowById(teamName, id) {
  const { nuid } = await getServerSession();

  const query = { type: dbType.Workflow, id: id };
  return await selectDocumentExt(query, validateBasicSingle, null, `team-${teamName}-db`);
}
