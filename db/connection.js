'use server';

import { MongoClient } from 'mongodb';

let cachedClient = null;

function isServerlessThroughputError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('throughput may not be defined')
    || message.includes('serverless offer is enabled');
}

export async function connectToDatabase(dbName = 'aisvc_userdb') {
  const envName = process.env['envName'];
  const mongoDBEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.mongodb.endpoint`]
  if (cachedClient) {
    return cachedClient.db(dbName);
  }
  const client = await MongoClient.connect(mongoDBEndpoint);
  cachedClient = client;
  return client.db(dbName);
}

export async function doesDatabaseExist(dbName = 'aisvc_userdb') {
  try {
    const envName = process.env['envName'];
    const mongoDBEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.mongodb.endpoint`];
    const client = cachedClient || await MongoClient.connect(mongoDBEndpoint);
    const databases = await client.db().admin().listDatabases();
    return databases.databases.some(db => db.name === dbName);
  } catch (error) {
    console.error("Error checking if database exists:", error);
    return false;
  }
}

export async function doesCollectionExist(dbName = 'aisvc_userdb', collectionName = 'user_collection') {
  try {
    const db = await connectToDatabase(dbName);
    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    return collections.some(collection => collection.name === collectionName);
  } catch (error) {
    console.error("Error checking if collection exists:", error);
    return false;
  }
}

export async function listDatabaseNames() {
  try {
    const envName = process.env['envName'];
    const mongoDBEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.mongodb.endpoint`];
    const client = cachedClient || await MongoClient.connect(mongoDBEndpoint);
    if (!cachedClient) cachedClient = client;
    const { databases } = await client.db().admin().listDatabases();
    return databases
      .map((d) => d.name)
      .filter((name) => !['admin', 'local', 'config'].includes(name))
      .sort();
  } catch (error) {
    console.error("Error listing databases:", error);
    return [];
  }
}

export async function listCollectionNames(dbName) {
  try {
    const db = await connectToDatabase(dbName);
    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    return collections.map((c) => c.name).sort();
  } catch (error) {
    console.error("Error listing collections:", error);
    return [];
  }
}

export async function createDbIfNotExists(databaseName) {
  const dbExists = await doesDatabaseExist(databaseName);
  if (!dbExists) {
    const envName = process.env['envName'];
    const mongoDBEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.mongodb.endpoint`];
    const client = await MongoClient.connect(mongoDBEndpoint);

    const db = await client.db(databaseName);

    const userCollection = await db.collection('user_collection');
    await userCollection.createIndex({ "$**": 1 });

    const statisticsCollection = await db.collection('statistics');
    await statisticsCollection.createIndex({ "$**": 1 });

    client.close();
    return true;
  }
  return false;
}

export async function createTeamDatabase(teamDbName, collections = ['user_collection', 'statistics'], maxThroughput = 1000) {
  try {
    const db = await connectToDatabase(teamDbName);

    // Try provisioning throughput for provisioned accounts.
    // Serverless accounts reject this command and should continue without it.
    try {
      await db.command({
        customAction: 'CreateDatabase',
        autoScaleSettings: {
          maxThroughput,
        },
      });
    } catch (error) {
      if (!isServerlessThroughputError(error)) {
        throw error;
      }
      console.log(`Skipping throughput provisioning for ${teamDbName} (serverless account).`);
    }

    // Create collections if they don't exist
    for (const collectionName of collections) {
      const collectionExists = await doesCollectionExist(teamDbName, collectionName);
      if (!collectionExists) {
        await db.createCollection(collectionName);
        await db.collection(collectionName).createIndex({ "$**": 1 })
      }
    }

    return {
      success: true,
      dbName: teamDbName
    };
  } catch (error) {
    console.error(`Error creating team database for ${teamDbName}:`, error);
    throw error;
  }
}

export async function updateDatabaseThroughput(teamDbName, maxThroughput = 1000) {
  try {
    const db = await connectToDatabase(teamDbName);
    try {
      await db.command({
        customAction: 'UpdateDatabase',
        autoScaleSettings: {
          maxThroughput,
        },
      });
    } catch (error) {
      if (!isServerlessThroughputError(error)) {
        throw error;
      }
      return {
        success: true,
        dbName: teamDbName,
        skippedThroughputUpdate: true,
      };
    }

    return {
      success: true,
      dbName: teamDbName
    };
  } catch (error) {
    console.error(`Error updating throughput for ${teamDbName}:`, error);
    throw error;
  }
}

export async function deleteTeamDatabase(teamDbName) {
  try {
    const db = await connectToDatabase(teamDbName);
    await db.dropDatabase();
    return {
      success: true,
      dbName: teamDbName,
    };
  } catch (error) {
    console.error(`Error deleting team database for ${teamDbName}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}