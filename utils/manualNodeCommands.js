import { selectDocuments, selectDocumentsExt } from '../db/selectDocument.js';
import { insertDocument } from '../db/insertDocument.js';
import { validateBasicMulti } from '../app/services/validation.js';
import { setProcessEnvironment } from '../scripts/configActions.js';

export async function testGetSmartNote() {
  try {
    const type = 'smartNote';
    const nuid = 'A257371';
    const parentId = null;
    const documents = await selectDocuments(type, nuid, parentId);
    console.log('Documents:', documents);
  } catch (error) {
    console.error('Error:', error);
  }
}

export async function testCreateSmartNote() {
  try {
    const smartNote = {
      type: 'smartNote',
      nuid: 'A257371',
      parentId: null,
      team: 'Self Service',
      createdNUID: 'A257371',
      title: 'Test Smart Note'
    }
    const insertedSmartNote = await insertDocument(smartNote);
    console.log('Documents:', insertedSmartNote);
  } catch (error) {
    console.error('Error:', error);
  }
}

// used to get a list of all the assigned NUIDs in each role
// so we know who to assign when we create Active Directory groups
export async function listNUIDsInEachRole() {
  const userRoleType = { type: 'userRole' };
  const roleType = { type: 'role' };

  try {
    const userRoles = await selectDocumentsExt(userRoleType, validateBasicMulti);
    const roles = await selectDocumentsExt(roleType, validateBasicMulti);

    // create a list of nuid for each role
    const roleNUIDList = roles.reduce((acc, role) => {
      acc[role.name] = userRoles
        .filter(userRole => userRole.roleId.toString() === role._id.toString())
        .map(userRole => userRole.userNUID);
      return acc;
    }, {});

    console.log(`roleNUIDList: ${JSON.stringify(roleNUIDList)}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

(async () => {
  await setProcessEnvironment();

})();

// (async () => {
//   const { createSmartNote } = require('./app/services/smartNoteService.js');
//   console.log(createSmartNote);
// })();
