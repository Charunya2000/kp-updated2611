'use server';

import { connectToDatabase } from './connection.js';
import { validateArgumentsSingle, validateArgumentsMulti } from '../app/services/validation.js';
import { formatDocument } from '../utils/formatting.js';
import { getServerSession } from '@/utils/getSession.js';

export async function updateDocument(document, query, validationFn, dbName = 'aisvc_userdb', dbCollection = 'user_collection') {
  let nuid = null;
  try {
    const session = await getServerSession();
    nuid = session.nuid;
  } catch (error) {
    console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'unauthorizedAction', detail: { action: 'updateDocument', id: document.id, query, error: error.message } } }));
  }

  let result = null;
  try {
    if (typeof validationFn === 'undefined' || validationFn === null) {
      await validateArgumentsSingle(document);
    } else {
      await validationFn(document);
    }

    if (typeof query === 'undefined' || query === null) {
      query = { id: document.id, parentId: document.parentId, type: document.type, nuid: document.nuid };
    }

    formatDocument(document);
    formatDocument(query);
    const db = await connectToDatabase(dbName);
    document.updatedAt = new Date();
    nuid && (document.updatedBy = nuid);
    delete document.createdAt;
    delete document._id;
    result = await db.collection(dbCollection).updateOne(
      query,
      { $set: document }
    );

    console.log(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'updateDocument', detail: { query, id: document.id, result } } }));
  } catch (error) {
    console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'updateDocument', detail: { query, id: document.id, error: error.message } } }));
  }
  return result && result.modifiedCount > 0 ? document : null;
}

export async function updateDocuments(query, document, dbName = 'aisvc_userdb', dbCollection = 'user_collection') {
  let nuid = null;
  try {
    const session = await getServerSession();
    nuid = session.nuid;
  } catch (error) {
    console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'unauthorizedAction', detail: { action: 'updateDocuments', id: document.id, query, error: error.message } } }));
  }

  await validateArgumentsMulti(query);
  formatDocument(query);
  const db = await connectToDatabase(dbName);
  const updatedAt = new Date();
  document.updatedAt = updatedAt;
  nuid && (document.updatedBy = nuid);
  const result = await db.collection(dbCollection).updateMany(
    query,
    { $set: document }
  );
  console.log(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'updateDocuments', detail: { query, id: document.id } } }));
  return result.modifiedCount > 0 ? document : null;
}

export async function upsertDocument(document, query, validateAppFn, dbName = 'aisvc_userdb', dbCollection = 'user_collection') {
  let nuid = null;
  try {
    const session = await getServerSession();
    nuid = session.nuid;
  } catch (error) {
    console.info(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'unauthorizedAction', detail: { action: 'upsertDocument', id: document.id, query, error: error.message } } }));
  }

  try {
    if (typeof validateAppFn === 'undefined' || validateAppFn === null) {
      await validateArgumentsSingle(document);
    } else {
      await validateAppFn(document);
    }

    formatDocument(document);
    formatDocument(query);
    const db = await connectToDatabase(dbName);
    document.createdAt ??= new Date();
    document.updatedAt = new Date();
    nuid && (document.updatedBy = nuid);
    const result = await db.collection(dbCollection).updateOne(
      query,
      { $set: document },
      { upsert: true }
    );

    console.log(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'upsertDocument', detail: { query, id: document.id, result } } }));
    return result && (result.upsertedCount > 0 || result.modifiedCount > 0) ? document : null;
  } catch (error) {
    console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'upsertDocument', detail: { query, id: document.id, error: error.message } } }));
    return null;
  }
}

export async function updateBulkDocuments(bulkOps, ordered = false, dbName = 'aisvc_userdb', dbCollection = 'user_collection') {
  try {
    const db = await connectToDatabase(dbName);

    let results;
    try {
      results = await db.collection(dbCollection).bulkWrite(bulkOps, { ordered: ordered });
    } catch (error) {
      if (error.code !== 11000) {
        throw error; // Ignore duplicate key errors
      }
    }

    console.log(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'updateBulkDocuments', detail: { bulkOps, results } } }));
    if (!results) {
      return { success: 'false', inserted: 0, deleted: 0 };
    }

    return { success: results.ok ? 'true' : 'false', inserted: results.insertedCount, deleted: results.deletedCount };
  } catch (error) {
    console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'updateBulkDocuments', detail: { bulkOps, error: error.message } } }));
    return { success: 'false', inserted: 0, deleted: 0 };
  }
}