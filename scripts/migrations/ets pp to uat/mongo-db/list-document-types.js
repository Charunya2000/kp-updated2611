import { MongoClient } from 'mongodb';
import { loadEnvLocal } from '../../../../utils/envLoader.js';

// Required environment variables (.env.local):
//   MONGO_PP_URI   - MongoDB connection string for PP  (used when --env pp, the default)
//   MONGO_UAT_URI  - MongoDB connection string for UAT (used when --env uat)
//
// Run with:
// node scripts/migrations/ets\ pp\ to\ uat/mongo-db/list-document-types.js
//
// Options:
//   --env <pp|uat>            (optional) Which environment to query (default: uat)
//   --db <dbName>             (optional) Database name (default: aisvc_userdb)
//   --collection <name>       (optional) Collection name (default: user_collection)

const MAX_RETRIES = 15;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 120000; // 2 minutes
const SLOW_REQUEST_THRESHOLD_MS = 30000; // 30 seconds

function parseArg(argName, defaultValue = null) {
  const idx = process.argv.indexOf(`--${argName}`);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : defaultValue;
}

const ENV = 'pp';
const DB_NAME = parseArg('db', 'aisvc_userdb');
const COLLECTION_NAME = parseArg('collection', 'user_collection');

/**
 * Execute an async operation with exponential backoff retry logic.
 */
async function withRetry(operation, label = 'operation') {
  let attempt = 0;
  let backoff = INITIAL_BACKOFF_MS;

  while (true) {
    try {
      attempt++;
      const start = Date.now();
      const result = await operation();
      const elapsed = Date.now() - start;

      if (elapsed > SLOW_REQUEST_THRESHOLD_MS) {
        console.warn(`    ⚠️  Slow request: ${label} took ${(elapsed / 1000).toFixed(1)}s (attempt ${attempt})`);
      }

      return result;
    } catch (error) {
      if (attempt >= MAX_RETRIES) {
        console.error(`    ❌ ${label} failed after ${MAX_RETRIES} attempts. Last error: ${error.message}`);
        throw error;
      }

      const retryAfterMatch = error.message.match(/RetryAfterMs=(\d+)/);
      const cosmosRetryMs = retryAfterMatch ? parseInt(retryAfterMatch[1], 10) : 0;
      const waitMs = Math.max(backoff, cosmosRetryMs);

      console.warn(`    ⏳ ${label} failed (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${(waitMs / 1000).toFixed(1)}s...`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
    }
  }
}

async function connectToMongo(uri, dbName) {
  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
    maxIdleTimeMS: 30000,
  });
  await client.connect();
  return { client, db: client.db(dbName) };
}

async function main() {
  console.log('='.repeat(60));
  console.log('📋 Document Type Summary');
  console.log('='.repeat(60));
  console.log(`  Environment: ${ENV.toUpperCase()}`);
  console.log(`  Database:    ${DB_NAME}`);
  console.log(`  Collection:  ${COLLECTION_NAME}\n`);

  console.log('Loading environment variables from .env.local...');
  loadEnvLocal();

  const uriEnvVar = ENV === 'pp' ? 'MONGO_PP_URI' : 'MONGO_UAT_URI';
  const uri = process.env[uriEnvVar];
  if (!uri) {
    throw new Error(`${uriEnvVar} is not set in .env.local`);
  }

  const { client, db } = await connectToMongo(uri, DB_NAME);

  try {
    const collection = db.collection(COLLECTION_NAME);

    // Get total document count
    const totalDocs = await withRetry(
      () => collection.countDocuments(),
      'countDocuments (total)'
    );

    // Aggregate unique types with counts, sorted by count descending
    const typeCounts = await withRetry(
      () => collection.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).toArray(),
      'aggregate type counts'
    );

    if (typeCounts.length === 0) {
      console.log('⚠️  No documents found in the collection.\n');
      return;
    }

    // Calculate column widths for the table
    const maxTypeLen = Math.max('Type'.length, ...typeCounts.map(t => String(t._id ?? '(null)').length));
    const maxCountLen = Math.max('Count'.length, ...typeCounts.map(t => String(t.count.toLocaleString()).length));

    // Print the table
    console.log(`\n  ${'Type'.padEnd(maxTypeLen)}   ${'Count'.padStart(maxCountLen)}`);
    console.log(`  ${'─'.repeat(maxTypeLen)}   ${'─'.repeat(maxCountLen)}`);

    for (const row of typeCounts) {
      const type = String(row._id ?? '(null)');
      const count = row.count.toLocaleString();
      console.log(`  ${type.padEnd(maxTypeLen)}   ${count.padStart(maxCountLen)}`);
    }

    console.log(`  ${'─'.repeat(maxTypeLen)}   ${'─'.repeat(maxCountLen)}`);
    console.log(`  ${'TOTAL'.padEnd(maxTypeLen)}   ${totalDocs.toLocaleString().padStart(maxCountLen)}`);
    console.log(`\n  Unique types: ${typeCounts.length}`);

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'listDocumentTypes',
        detail: {
          environment: ENV,
          database: DB_NAME,
          collection: COLLECTION_NAME,
          totalDocuments: totalDocs,
          uniqueTypes: typeCounts.length,
        },
      },
    }));

  } finally {
    await client.close();
  }
}

main()
  .then(() => {
    console.log('\nDone.');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error.message);
    if (error.stack) console.error(error.stack);

    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'listDocumentTypes',
        detail: { error: error.message },
      },
    }));

    process.exit(1);
  });
