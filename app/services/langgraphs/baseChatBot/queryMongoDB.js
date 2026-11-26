import { connectToDatabase } from '@/db/connection';

export async function findRecords(databaseName, collectionName, query, method, sort, limit) {
    try {
        const db = await connectToDatabase(databaseName);
        const collection = db.collection(collectionName);

        const response = await collection.find(query).sort(sort).limit(limit).toArray();
        return response

    } catch (error) {
        console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: `${method}`, detail: { error: error.message } } }));
        return []
    }
}


export async function countRecords(databaseName, collectionName, filter, method) {
    try {
        const db = await connectToDatabase(databaseName);
        const collection = db.collection(collectionName);

        const response = await collection.countDocuments(filter);
        return response

    } catch (error) {
        console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: `${method}`, detail: { error: error.message } } }));
        return []
    }
}


export async function findSingleRecord(databaseName, collectionName, query, method) {
    try {

        const db = await connectToDatabase(databaseName);
        const collection = db.collection(collectionName);

        const response = await collection.findOne(query);
        return response

    } catch (error) {
        console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: `${method}`, detail: { error: error.message } } }));
        return []
    }

}

export async function updateSingleRecord(databaseName, collectionName, filter, query, method) {

    try {
        const db = await connectToDatabase(databaseName);
        const collection = db.collection(collectionName);


        const response = await collection.updateOne(filter, query, { upsert: true });
        return response

    } catch (error) {
        console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: `${method}`, detail: { error: error.message } } }));
        return []
    }


}
