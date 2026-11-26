import { MongoClient } from 'mongodb';
import { loadEnvLocal } from '../../../../utils/envLoader.js';

// Required environment variables (.env.local):
//   MONGO_UAT_URI  - MongoDB connection string for the UAT instance
//
// Run with:
// node scripts/migrations/ets\ pp\ to\ uat/mongo-db/check-uat-duplicates.js --type <type>
//
// Examples:
//   node scripts/migrations/ets\ pp\ to\ uat/mongo-db/check-uat-duplicates.js --type smartNote
//   node scripts/migrations/ets\ pp\ to\ uat/mongo-db/check-uat-duplicates.js --type persona
//   node scripts/migrations/ets\ pp\ to\ uat/mongo-db/check-uat-duplicates.js --type smartNote --db team-ets-db
//   node scripts/migrations/ets\ pp\ to\ uat/mongo-db/check-uat-duplicates.js --type smartNote --collection user_collection
//
// Options:
//   --type <type>             (required) The document type to check for duplicate NUIDs
//   --db <dbName>             (optional) Database name (default: aisvc_userdb)
//   --collection <name>       (optional) Collection name (default: user_collection)
//   --save                    (optional) Save full results to a JSON file

const MAX_RETRIES = 15;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 120000; // 2 minutes
const SLOW_REQUEST_THRESHOLD_MS = 30000; // 30 seconds

/**
 * Parse a named CLI argument value.
 */
function parseArg(argName, defaultValue = null) {
  const idx = process.argv.indexOf(`--${argName}`);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : defaultValue;
}

const DOC_TYPE = parseArg('type');
const DB_NAME = parseArg('db', 'team-ets-db');
const COLLECTION_NAME = parseArg('collection', 'user_collection');
const SAVE_TO_FILE = process.argv.includes('--save');

if (!DOC_TYPE) {
  console.error('⛔ Missing required argument: --type\n');
  console.error('Usage:');
  console.error('  node check-uat-duplicates.js --type <type> [--db <dbName>] [--collection <name>] [--save]\n');
  console.error('Examples:');
  console.error('  node check-uat-duplicates.js --type smartNote');
  console.error('  node check-uat-duplicates.js --type persona --db team-ets-db --save\n');
  process.exit(1);
}

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

/**
 * Connect to a MongoDB instance.
 */
async function connectToMongo(uri, dbName) {
  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
    maxIdleTimeMS: 30000,
  });
  await client.connect();
  return { client, db: client.db(dbName) };
}

/**
 * Use a MongoDB aggregation pipeline to find NUIDs that appear more than once
 * for the given document type.
 */
async function findDuplicateNuids(collection, docType) {
  console.log(`\n🔍 Running aggregation to find duplicate NUIDs for type '${docType}'...`);

  const pipeline = [
    { $match: { type: docType } },
    {
      $group: {
        _id: '$nuid',
        count: { $sum: 1 },
        documentIds: { $push: '$id' },
        mongoIds: { $push: '$_id' },
        createdDates: { $push: '$createdAt' },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
  ];

  const duplicates = await withRetry(
    () => collection.aggregate(pipeline).toArray(),
    `aggregate duplicates (type: ${docType})`
  );

  return duplicates;
}

/**
 * Get the total document count for the given type.
 */
async function getTypeCount(collection, docType) {
  return withRetry(
    () => collection.countDocuments({ type: docType }),
    `countDocuments (type: ${docType})`
  );
}

/**
 * Get a count of distinct NUIDs for the given type.
 */
async function getDistinctNuidCount(collection, docType) {
  const result = await withRetry(
    () => collection.aggregate([
      { $match: { type: docType } },
      { $group: { _id: '$nuid' } },
      { $count: 'distinctCount' },
    ]).toArray(),
    `distinct nuid count (type: ${docType})`
  );
  return result.length > 0 ? result[0].distinctCount : 0;
}

/**
 * Main execution
 */
async function main() {
  console.log('='.repeat(60));
  console.log('🔍 UAT MongoDB Duplicate NUID Checker');
  console.log('='.repeat(60));
  console.log(`  Type:       ${DOC_TYPE}`);
  console.log(`  Database:   ${DB_NAME}`);
  console.log(`  Collection: ${COLLECTION_NAME}\n`);

  console.log('Loading environment variables from .env.local...');
  loadEnvLocal();

  const uatUri = process.env.MONGO_UAT_URI;
  if (!uatUri) {
    throw new Error('MONGO_UAT_URI is not set in .env.local');
  }

  const { client, db } = await connectToMongo(uatUri, DB_NAME);

  try {
    const collection = db.collection(COLLECTION_NAME);

    // Get overview counts
    const totalDocs = await getTypeCount(collection, DOC_TYPE);
    const distinctNuids = await getDistinctNuidCount(collection, DOC_TYPE);

    console.log(`\n📊 Overview for type '${DOC_TYPE}':`);
    console.log(`   Total documents:  ${totalDocs.toLocaleString()}`);
    console.log(`   Distinct NUIDs:   ${distinctNuids.toLocaleString()}`);

    if (totalDocs === 0) {
      console.log(`\n⚠️  No documents found with type '${DOC_TYPE}'. Nothing to check.`);
      return;
    }

    // Find duplicates
    const duplicates = await findDuplicateNuids(collection, DOC_TYPE);

    if (duplicates.length === 0) {
      console.log('\n✅ No duplicate NUIDs found! All NUIDs are unique for this type.\n');

      console.log(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'checkDuplicateNuids',
          detail: {
            type: DOC_TYPE,
            database: DB_NAME,
            collection: COLLECTION_NAME,
            totalDocuments: totalDocs,
            distinctNuids,
            duplicateNuids: 0,
            duplicateDocuments: 0,
          },
        },
      }));

      return;
    }

    // Calculate totals
    const totalDuplicateDocs = duplicates.reduce((sum, d) => sum + d.count, 0);
    const excessDocs = duplicates.reduce((sum, d) => sum + (d.count - 1), 0);

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('⚠️  DUPLICATES FOUND');
    console.log('='.repeat(60));
    console.log(`  NUIDs with duplicates:     ${duplicates.length.toLocaleString()}`);
    console.log(`  Total docs involved:       ${totalDuplicateDocs.toLocaleString()}`);
    console.log(`  Excess docs (to remove):   ${excessDocs.toLocaleString()}`);
    console.log('='.repeat(60));

    // Print details for each duplicate NUID
    console.log('\n📋 Duplicate Details:\n');
    console.log(`  ${'NUID'.padEnd(20)} ${'Count'.padStart(7)} ${'Document IDs'}`);
    console.log(`  ${'─'.repeat(20)} ${'─'.repeat(7)} ${'─'.repeat(50)}`);

    for (const dup of duplicates) {
      const nuid = dup._id || '(null)';
      const ids = dup.documentIds
        .map((id, i) => {
          const date = dup.createdDates[i]
            ? new Date(dup.createdDates[i]).toISOString().split('T')[0]
            : 'no-date';
          return `${id} (${date})`;
        })
        .join(', ');

      console.log(`  ${String(nuid).padEnd(20)} ${String(dup.count).padStart(7)} ${ids}`);
    }

    // Optionally save full results
    if (SAVE_TO_FILE) {
      const { default: fs } = await import('fs/promises');
      const { default: pathModule } = await import('path');
      const outputPath = pathModule.resolve(
        pathModule.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')),
        `uat-duplicates-${DOC_TYPE}-${new Date().toISOString().replace(/:/g, '-').split('.')[0]}.json`
      );

      const report = {
        checkedAt: new Date().toISOString(),
        database: DB_NAME,
        collection: COLLECTION_NAME,
        type: DOC_TYPE,
        totalDocuments: totalDocs,
        distinctNuids,
        duplicateNuids: duplicates.length,
        excessDocuments: excessDocs,
        duplicates: duplicates.map(d => ({
          nuid: d._id,
          count: d.count,
          documentIds: d.documentIds,
          mongoIds: d.mongoIds.map(String),
          createdDates: d.createdDates,
        })),
      };

      await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf8');
      console.log(`\n💾 Full report saved to: ${outputPath}`);
    } else {
      console.log(`\n💡 Tip: Run with --save to export full duplicate details to a JSON file`);
    }

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'checkDuplicateNuids',
        detail: {
          type: DOC_TYPE,
          database: DB_NAME,
          collection: COLLECTION_NAME,
          totalDocuments: totalDocs,
          distinctNuids,
          duplicateNuids: duplicates.length,
          excessDocuments: excessDocs,
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
    if (error.stack) {
      console.error(error.stack);
    }

    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'checkDuplicateNuids',
        detail: { error: error.message },
      },
    }));

    process.exit(1);
  });
