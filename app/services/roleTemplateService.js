'use server';

import { selectDocumentExt, selectDocumentsExt } from '@db/selectDocument';
import { validateBasicMulti, validateBasicSingle, validateDocumentDelete } from './validation';
import { prepDocument } from '../clientServices/insertDocument';
import { insertDocument } from '@/db/insertDocument';
import { updateDocument } from '@/db/updateDocument';
import { deleteDocument } from '@/db/deleteDocument';

/**
 * Get all global RoleTemplate documents from the app DB.
 */
export async function getAllGlobalRoleTemplates() {
  return await selectDocumentsExt(
    { type: 'RoleTemplate' },
    validateBasicMulti
  );
}

/**
 * Get a single global RoleTemplate by id.
 */
export async function getRoleTemplateById(id) {
  return await selectDocumentExt(
    { type: 'RoleTemplate', id },
    validateBasicSingle
  );
}

/**
 * Get a single global RoleTemplate by name.
 */
export async function getRoleTemplateByName(name) {
  return await selectDocumentExt(
    { type: 'RoleTemplate', name },
    validateBasicMulti
  );
}

/**
 * Create a new global RoleTemplate.
 */
export async function createRoleTemplate(roleTemplate) {
  const { name, label, description, permissions, isSystem, color } = roleTemplate;

  const doc = prepDocument({
    type: 'RoleTemplate',
    name,
    label,
    description: description || '',
    permissions: permissions || [],
    isSystem: isSystem || false,
    color: color || 'default',
  });

  return await insertDocument(doc, validateBasicMulti);
}

/**
 * Update an existing global RoleTemplate.
 */
export async function updateRoleTemplate(roleTemplate) {
  const { id, label, description, permissions, color } = roleTemplate;

  const updatedDoc = {
    type: 'RoleTemplate',
    label,
    description: description || '',
    permissions: permissions || [],
    color: color || 'default',
    updatedAt: new Date(),
  };

  const updateQuery = {
    type: 'RoleTemplate',
    id,
  };

  return await updateDocument(updatedDoc, updateQuery, validateBasicMulti);
}

/**
 * Delete a global RoleTemplate. Blocks deletion of system templates.
 */
export async function deleteRoleTemplate(id) {
  const existing = await getRoleTemplateById(id);
  if (!existing) {
    throw new Error('RoleTemplate not found');
  }
  if (existing.isSystem) {
    throw new Error('System role templates cannot be deleted');
  }

  const query = {
    type: 'RoleTemplate',
    id,
  };

  return await deleteDocument(query, validateDocumentDelete);
}
