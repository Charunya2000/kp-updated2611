import { insertDocument } from '@/db/insertDocument';
import { validateBasicSingle } from '@services/validation';

export async function saveAdminText({ id, text, nuid }) {
    const document = {
        id,
        type: 'npscmatadmin',
        text,
        nuid,
        createdAt: new Date(),
    };
    return await insertDocument(document, validateBasicSingle, 'team-npscmat-db', 'user_collection');
}

import { connectToDatabase } from '@/db/connection';

export async function getAdminText(nuid) {
    const db = await connectToDatabase('team-npscmat-db');
    const collection = db.collection('user_collection');
    const result = await collection.find({ type: 'npscmatadmin', nuid }).toArray();
    return result;
}
