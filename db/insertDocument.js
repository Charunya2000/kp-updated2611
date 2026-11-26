'use server';

import { formatDocument } from '../utils/formatting.js';
import { connectToDatabase } from './connection.js';
import { validateArgumentsMulti } from '../app/services/validation.js';
import { getServerSession } from '../utils/getSession.js';

export async function insertDocument(document, validationFn, dbName = 'aisvc_userdb', dbCollection = 'user_collection') {
  let nuid = null;
  try {
    const session = await getServerSession();
    nuid = session.nuid;
  } catch (error) {
    console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'unauthorizedAction', detail: { action: 'insertDocument', id: document.id, error: error.message } } }));
  }

  if (typeof (validationFn) === 'undefined' || validationFn === null) {
    await validateArgumentsMulti(document);
  } else {
    await validationFn(document);
  }

  formatDocument(document);

  const db = await connectToDatabase(dbName);
  document.app = 'SmartNotes';
  nuid && (document.createdBy = nuid);
  nuid && (document.updatedBy = nuid);
  document.createdAt = new Date();
  document.updatedAt = new Date();
  const resp = await db.collection(dbCollection).insertOne(document);
  return document;
}

export async function insertBulkDocuments(documents, validationFn, dbName = 'aisvc_userdb', dbCollection = 'user_collection') {
  let nuid = null;
  try {
    const session = await getServerSession();
    nuid = session.nuid;
  } catch (error) {
    console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'unauthorizedAction', detail: { action: 'insertBulkDocuments', types: Array.from(new Set(documents.map(doc => doc.type))), error: error.message } } }));
  }

  if (typeof (validationFn) === 'undefined' || validationFn === null) {
    for (const doc of documents) {
      await validateArgumentsMulti(doc);
    }
  } else {
    for (const doc of documents) {
      await validationFn(doc);
    }
  }
  documents.forEach(doc => formatDocument(doc));

  const db = await connectToDatabase(dbName);
  const timestamp = new Date();
  documents.forEach(doc => {
    doc.app = 'SmartNotes';
    nuid && (doc.createdBy = nuid);
    nuid && (doc.updatedBy = nuid);
    doc.createdAt = timestamp;
    doc.updatedAt = timestamp;
  });

  return await db.collection(dbCollection).insertMany(documents);
}