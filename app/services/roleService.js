'use server';

import { selectDocumentExt, selectDocumentsExt } from '@db/selectDocument';
import { validateBasicMulti, validateBasicSingleByName, validateDefaultSingle, validateDocumentDeleteDefault } from './validation';
import { prepDocument } from '../clientServices/insertDocument';
import { insertDocument } from '@/db/insertDocument';
import { updateDocument } from '@/db/updateDocument';
import { deleteDocument } from '@/db/deleteDocument';
import { ObjectId } from 'mongodb';

export async function getRoleByName(name, options) {
  return await selectDocumentExt({ type: 'role', name }, validateBasicMulti, options);
};

export async function getRoleById(_id) {
  return await selectDocumentExt({ type: 'role', _id: new ObjectId(_id) }, validateDefaultSingle);
};

export async function getAllRoles() {
  return await selectDocumentsExt(
    { type: 'role' },
    validateBasicMulti,
    { projection: { _id: 1, name: 1, parentName: 1, displayName: 1 } }
  );
}

export async function addRole(role) {
  try {
    const { name, displayName, parentName } = role;

    const newRole = prepDocument({
      type: 'role',
      name,
      displayName,
      parentName
    });

    return await insertDocument(newRole, validateBasicSingleByName);
  } catch (error) {
    console.error('Error adding role:', error);
    return false;
  }
}

export async function updateRole(role) {
  try {
    const { name, displayName, parentName, _id } = role;

    const updatedRole = {
      type: 'role',
      name,
      displayName,
      parentName
    };

    const updateQuery = {
      type: 'role',
      _id: new ObjectId(_id)
    };

    return await updateDocument(updatedRole, updateQuery, validateBasicSingleByName);
  } catch (error) {
    console.error('Error updating role:', error);
    return false;
  }
}

export async function deleteRole(role) {
  try {
    const { _id } = role;

    const query = {
      type: 'role',
      _id: new ObjectId(_id)
    };

    return await deleteDocument(query, validateDocumentDeleteDefault);
  } catch (error) {
    console.error('Error deleting role:', error);
    return false;
  }
}