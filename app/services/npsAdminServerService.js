import { insertDocument } from '@/db/insertDocument';
import { validateBasicSingle } from '@services/validation';

export async function saveNpsAdminText({ id, text, nuid }) {
  const document = {
    id,
    type: 'npsadmin',
    text,
    nuid,
    createdAt: new Date(),
  };
  return await insertDocument(document, validateBasicSingle, 'team-nps-db', 'user_collection');
}

import { connectToDatabase } from '@/db/connection';

export async function getNpsAdminText(nuid) {
  const db = await connectToDatabase('team-nps-db');
  const collection = db.collection('user_collection');
  const result = await collection.find({ type: 'npsadmin', nuid }).toArray();
  return result;
}
