import { insertDocument } from '@/db/insertDocument';
import { validateBasicSingle } from '@services/validation';

export async function saveBcsAdminText({ id, text, nuid }) {
  const document = {
    id,
    type: 'bcsadmin',
    text,
    nuid,
    createdAt: new Date(),
  };
  return await insertDocument(document, validateBasicSingle, 'team-bcs-db', 'user_collection');
}

import { connectToDatabase } from '@/db/connection';

export async function getBcsAdminText(nuid) {
  const db = await connectToDatabase('team-bcs-db');
  const collection = db.collection('user_collection');
  const result = await collection.find({ type: 'bcsadmin', nuid }).toArray();
  return result;
}
