'use server';

import { selectDocumentsExt, selectDocumentExt } from '@db/selectDocument';
import { getRoleByName } from './roleService';
import { insertDocument } from '@db/insertDocument';
import { updateBulkDocuments, updateDocument } from '@db/updateDocument';
import { getServerSession } from '@utils/getSession';
import { validateBasicMulti, validateBasicSingleByName, validateBasicSingleUserRole } from './validation';
import { ObjectId } from 'mongodb';


export async function createUserRole(req) {
  const { nuid } = await getServerSession();
  const document = await req.json();
  document.nuid = nuid;
  return await insertDocument(document);
}

export async function selectUserRole(query) {
  if (!query.userNUID) {
    // if not selecting userRoles for specific user
    // request for session owner's user
    const { nuid } = await getServerSession();
    query.userNUID = nuid.toUpperCase();
  }
  return await selectDocumentExt(query, validateBasicSingleUserRole);
}

export async function updateUserRole(req) {
  const { nuid } = await getServerSession();
  const document = await req.json();
  document.nuid = nuid;
  document.updatedAt = new Date();
  return await updateDocument(document);
}

export async function getAllUserRolesByRoleId(_id) {
  const query = { type: 'userRole', roleId: new ObjectId(_id) };
  return await selectDocumentsExt(query, validateBasicMulti);
}

export async function getUserRolesByNUID(nuid) {
  let userNUID = nuid;
  if (!nuid) {
    userNUID = (await getServerSession()).nuid;
  }
  userNUID = userNUID.toUpperCase();

  const userRoles = await selectDocumentsExt({ type: 'userRole', userNUID }, validateBasicMulti);
  const roleIds = userRoles.map(userRole => userRole.roleId);
  const roles = await selectDocumentsExt({ type: 'role', _id: { $in: roleIds } }, validateBasicMulti);

  const result = {
    message: 'success',
    roles: roles.map(role => {
      return { name: role.name, parentName: role.parentName, displayName: role.displayName, roleId: role._id }
    })
  };

  return result;
};

export async function upsertUserRoles(nuid, userRoles) {
  // userRoles input looks like: {name: name, assigned: true}
  nuid = nuid.toUpperCase();
  const timestamp = new Date();
  const bulkOps = [];
  for (const role of userRoles) {
    const existingRole = await selectDocumentExt({ type: 'role', name: role.name }, validateBasicSingleByName);
    const roleId = existingRole._id
    if (!roleId) {
      return;
    }
    role.id = roleId;

    const existingUserRole = await selectUserRole({ type: 'userRole', userNUID: nuid, roleId: role.id });
    if (existingUserRole) {
      role.exists = true;
    }

    if (role.assigned && !role.exists) {
      bulkOps.push({
        insertOne: {
          document: { type: 'userRole', userNUID: nuid, roleId: role.id, createdAt: timestamp, updatedAt: timestamp },
        }
      });
    }
    if (!role.assigned && role.exists) {
      bulkOps.push({
        deleteOne: {
          filter: { type: 'userRole', userNUID: nuid, roleId: role.id }
        }
      });
    }
  }

  return await updateBulkDocuments(bulkOps, false);
}

export async function isAdminUser(nuid) {
  let userNUID = nuid;
  if (!nuid) {
    userNUID = (await getServerSession()).nuid;
  }
  userNUID = userNUID.toUpperCase();

  const adminRole = await getRoleByName('admin', { projection: { _id: 1 } });
  const adminUserRole = await selectDocumentExt({ type: 'userRole', userNUID: userNUID, roleId: adminRole._id }, validateBasicSingleUserRole);

  return !!adminUserRole;
}