import { MongoClient } from 'mongodb';
import { loadEnvLocal } from '../../../../utils/envLoader.js';

// Required environment variables (.env.local):
//   MONGO_PP_URI   - MongoDB connection string for the PP (pre-prod) instance
//   MONGO_UAT_URI  - MongoDB connection string for the UAT instance
//
// Dry-run preview: logs the first 5 documents that WOULD be migrated per collection.
// No writes are performed.

const DATABASES = ['team-ets-db', 'aisvc_userdb'];
const COLLECTIONS = ['user_collection', 'statistics'];
const PREVIEW_LIMIT = 5;

async function connectToMongo(uri, dbName) {
  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
    maxIdleTimeMS: 30000,
  });
  await client.connect();
  return { client, db: client.db(dbName) };
}

async function previewCollection(sourceDb, targetDb, collectionName) {
  const sourceCollection = sourceDb.collection(collectionName);
  const targetCollection = targetDb.collection(collectionName);

  const totalDocuments = await sourceCollection.countDocuments();
  console.log(`    Total documents in source: ${totalDocuments}`);

  if (totalDocuments === 0) {
    console.log(`    No documents found.`);
    return;
  }

  // Collect existing ids from target for dedup check
  console.log(`    Loading existing ids from target collection...`);
  const existingIds = new Set();
  const targetCursor = targetCollection.find({}, { projection: { id: 1, _id: 0 } });
  for await (const doc of targetCursor) {
    if (doc.id !== undefined && doc.id !== null) {
      existingIds.add(String(doc.id));
    }
  }
  console.log(`    Found ${existingIds.size} existing ids in target.`);

  // Walk source and collect first N eligible documents
  const preview = [];
  let skippedNoId = 0;
  let skippedDuplicate = 0;

  const cursor = sourceCollection.find({});
  for await (const doc of cursor) {
    if (doc.id === undefined || doc.id === null) {
      skippedNoId++;
      continue;
    }
    if (existingIds.has(String(doc.id))) {
      skippedDuplicate++;
      continue;
    }

    preview.push(doc);
    if (preview.length >= PREVIEW_LIMIT) break;
  }
  await cursor.close();

  const wouldMigrate = totalDocuments - skippedNoId - skippedDuplicate;

  console.log(`    Documents without id field (skipped):  ${skippedNoId}+`);
  console.log(`    Duplicates already in target (skipped): ${skippedDuplicate}+`);
  console.log(`    Estimated eligible for migration:       ~${wouldMigrate >= 0 ? wouldMigrate : 'unknown (scan stopped early)'}+`);
  console.log(`\n    --- First ${preview.length} documents that would be migrated ---`);

  preview.forEach((doc, i) => {
    console.log(`\n    [${i + 1}] id: ${doc.id}`);
    console.log(`        type: ${doc.type ?? '(none)'}`);
    console.log(`        _id:  ${doc._id}`);
    // Print a compact summary of top-level keys
    const keys = Object.keys(doc).filter(k => !['_id', 'id', 'type'].includes(k));
    console.log(`        other keys: ${keys.join(', ')}`);
  });
}

async function runDryRun() {
  console.log('🔍 DRY RUN — no data will be written.\n');
  console.log('Loading environment variables from .env.local...');
  loadEnvLocal();

  const ppUri = process.env.MONGO_PP_URI;
  const uatUri = process.env.MONGO_UAT_URI;

  if (!ppUri) throw new Error('MONGO_PP_URI is not set in .env.local');
  if (!uatUri) throw new Error('MONGO_UAT_URI is not set in .env.local');

  const clients = [];

  try {
    for (const dbName of DATABASES) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`DATABASE: ${dbName}`);
      console.log('='.repeat(60));

      const { client: sourceClient, db: sourceDb } = await connectToMongo(ppUri, dbName);
      const { client: targetClient, db: targetDb } = await connectToMongo(uatUri, dbName);
      clients.push(sourceClient, targetClient);

      for (const collectionName of COLLECTIONS) {
        console.log(`\n  Collection: ${collectionName}`);

        try {
          await previewCollection(sourceDb, targetDb, collectionName);
        } catch (error) {
          console.error(`    ❌ Error reading ${dbName}/${collectionName}:`, error.message);
        }
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('🔍 DRY RUN COMPLETE — no data was written.');
    console.log('='.repeat(60));

  } finally {
    console.log('\nClosing database connections...');
    for (const client of clients) {
      try { await client.close(); } catch (_) { /* ignore */ }
    }
  }
}

runDryRun()
  .then(() => { console.log('\nDone.'); process.exit(0); })
  .catch(error => { console.error('\nDry run failed:', error); process.exit(1); });
