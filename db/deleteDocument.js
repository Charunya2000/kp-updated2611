'use server';

import { connectToDatabase } from './connection';
import { validateArgumentsSingle, validateArgumentsMulti, validateBasicMulti, validateArgumentsSmartNoteMulti } from '@/app/services/validation.js';
import { formatDocument } from '../utils/formatting';

export async function deleteDocument(query, validationFn, dbName = 'aisvc_userdb', dbCollection = 'user_collection') {
  let deleted = false;
  try {
    query.app = 'SmartNotes';
    if (typeof validationFn === 'undefined' || validationFn === null) {
      await validateArgumentsSingle(query);
    } else {
      await validationFn(query);
    }

    if (!validationFn) {
      query = { id: query.id, parentId: query.parentId, type: query.type, nuid: query.nuid };
    }
    formatDocument(query);

    const db = await connectToDatabase(dbName);
    const result = await db.collection(dbCollection).deleteOne(query);
    console.log(JSON.stringify({ kpmsg: { id: "AI_PORTAL_NOTEBOOK", name: "deleteDocument", detail: query, result } }));
    deleted = result.deletedCount > 0;
  } catch (error) {
    console.error(error)
  }
  return deleted
}

export async function deleteDocuments(query, dbName = 'aisvc_userdb', dbCollection = 'user_collection') {
  let deleted = false;
  try {
    query.app = 'SmartNotes';
    await validateArgumentsMulti(query);
    formatDocument(query);
    const db = await connectToDatabase(dbName);
    const result = await db.collection(dbCollection).deleteMany(query);
    console.log(JSON.stringify({ kpmsg: { id: "AI_PORTAL_NOTEBOOK", name: "deleteDocuments", detail: query, result } }));
    deleted = result.deletedCount > 0;
  } catch (error) {
    console.error(JSON.stringify({ kpmsg: { id: "AI_PORTAL_NOTEBOOK", name: "deleteDocuments", detail: query, error: error.message } }));
  }
  return deleted;
}

export async function deleteDocumentsExt(query, validationFn, dbName = 'aisvc_userdb', dbCollection = 'user_collection') {
  let deleted = false;
  try {
    query.app = 'SmartNotes';
    if (typeof validationFn === 'undefined' || validationFn === null) {
      await validateBasicMulti(query);
    }
    else {
      await validationFn(query);
    }
    formatDocument(query);
    const db = await connectToDatabase(dbName);
    const result = await db.collection(dbCollection).deleteMany(query);
    console.log(JSON.stringify({ kpmsg: { id: "AI_PORTAL_NOTEBOOK", name: "deleteDocumentsExt", detail: query, result } }));
    deleted = result.deletedCount > 0;
  } catch (error) {
    console.error(JSON.stringify({ kpmsg: { id: "AI_PORTAL_NOTEBOOK", name: "deleteDocumentsExt", detail: query, error: error.message } }));
  }
  return deleted;
}

export async function deleteSmartNoteDocuments(query, dbName = 'aisvc_userdb', dbCollection = 'user_collection') {
  let deleted = false;
  try {
    query.app = 'SmartNotes';
    await validateArgumentsSmartNoteMulti(query);
    formatDocument(query);
    const db = await connectToDatabase(dbName);
    const result = await db.collection(dbCollection).deleteMany(query);
    console.log(JSON.stringify({ kpmsg: { id: "AI_PORTAL_NOTEBOOK", name: "deleteSmartNoteDocuments", detail: query, result } }));
    deleted = result.deletedCount > 0;
  } catch (error) {
    console.error(JSON.stringify({ kpmsg: { id: "AI_PORTAL_NOTEBOOK", name: "deleteSmartNoteDocuments", detail: query, error: error.message } }));
  }
  return deleted;
}

// This is too dangerous to leave uncommented
// export async function deleteAll(query, dbName = 'aisvc_userdb', dbCollection = 'user_collection') {
//   query.app = 'SmartNotes';
//   await validateApp(query);
//   formatDocument(query);
//   const db = await connectToDatabase();
//   const result = await db.collection(dbCollection).deleteMany(query);
//   console.log(JSON.stringify({ kpmsg: { id: "AI_PORTAL_NOTEBOOK", name: "deleteAll", detail: query, result } }));
//   return result.deletedCount > 0;
// }