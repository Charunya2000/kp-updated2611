import { MongoClient } from 'mongodb';
import { loadEnvLocal } from '../../../../utils/envLoader.js';

// Required environment variables (.env.local):
//   MONGO_PP_URI   - MongoDB connection string for the PP (pre-prod) instance
//   MONGO_UAT_URI  - MongoDB connection string for the UAT instance
//
// Run with:
// node scripts/migrations/ets\ pp\ to\ uat/mongo-db/migrate-pp-to-uat.js

const DATABASES = ['team-ets-db', 'aisvc_userdb'];
const COLLECTIONS = ['user_collection', 'statistics'];
const BATCH_SIZE = 100;
const MAX_RETRIES = 15;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 120000; // 2 minutes
const SLOW_REQUEST_THRESHOLD_MS = 30000; // 30 seconds

// Type-specific dedup overrides.
// Documents with a matching 'type' value will be deduplicated using the
// specified field INSTEAD of the collection-level dedupField.
// This prevents duplicates when the standard 'id' differs but a logical
// uniqueness constraint exists on another field.
//
// Format:  { '<type>': '<field to deduplicate on>' }
const TYPE_DEDUP_OVERRIDES = {
  'TeamMember': 'nuid',
  'UserDetail': 'nuid'
};

// Document types to skip entirely during migration.
// Documents whose 'type' field matches any entry in this list will never be
// migrated, regardless of dedup rules. Useful for environment-specific data
// (e.g. FeatureFlag) that should not be copied across environments.
const SKIP_TYPES = [
  'FeatureFlag',
  'Team',
  'DB Compare Query',
  'CacControlReport',
  'SearchIndexConfig',
  'TemplateDocument'
];

// Optional: pass --limit N to cap total migrated documents (useful for testing)
const MIGRATE_LIMIT = (() => {
  const idx = process.argv.indexOf('--limit');
  return idx !== -1 && process.argv[idx + 1] ? parseInt(process.argv[idx + 1], 10) : Infinity;
})();
let globalMigratedCount = 0;

/**
 * Execute an async operation with exponential backoff retry logic.
 * Doubles the wait time on each retry, capped at MAX_BACKOFF_MS.
 * Logs a warning when any attempt takes longer than 30 seconds.
 *
 * @param {Function} operation - Async function to execute.
 * @param {string} label - Descriptive label for logging.
 * @returns {Promise<*>} The result of the operation.
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

      // Parse Cosmos DB RetryAfterMs if present, use it as minimum wait time
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
 * Connect to a MongoDB instance using a connection string.
 * @param {string} uri - The MongoDB connection string.
 * @param {string} dbName - The database name to connect to.
 * @returns {Promise<{client: MongoClient, db: import('mongodb').Db}>}
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
 * Load existing values for each type-specific dedup field from the target collection.
 * Returns a Map<type, Set<string>> keyed by document type.
 *
 * @param {import('mongodb').Collection} targetCollection
 * @param {string} collectionName - For logging only.
 * @returns {Promise<Map<string, Set<string>>>}
 */
async function loadTypeDedupSets(targetCollection, collectionName) {
  const typeDedupSets = new Map();

  // Collect unique override fields so we only scan the target once per field
  const fieldToTypes = new Map();
  for (const [type, field] of Object.entries(TYPE_DEDUP_OVERRIDES)) {
    if (!fieldToTypes.has(field)) {
      fieldToTypes.set(field, []);
    }
    fieldToTypes.get(field).push(type);
  }

  for (const [type, field] of Object.entries(TYPE_DEDUP_OVERRIDES)) {
    console.log(`    Loading existing '${field}' values for type '${type}' from target...`);

    const ids = await withRetry(async () => {
      const set = new Set();
      const cursor = targetCollection.find(
        { type },
        { projection: { [field]: 1, _id: 0 } }
      );
      for await (const doc of cursor) {
        const val = doc[field];
        if (val !== undefined && val !== null) {
          set.add(String(val));
        }
      }
      return set;
    }, `load '${field}' values for type '${type}' (${collectionName})`);

    typeDedupSets.set(type, { field, existing: ids });
    console.log(`    Found ${ids.size} existing '${field}' values for type '${type}' in target.`);
  }

  return typeDedupSets;
}

/**
 * Migrate a single collection from source to target, skipping documents
 * whose dedupField value already exists in the target collection.
 * Documents whose type is listed in TYPE_DEDUP_OVERRIDES are additionally
 * checked against their type-specific field to prevent logical duplicates.
 * @param {import('mongodb').Db} sourceDb
 * @param {import('mongodb').Db} targetDb
 * @param {string} collectionName
 * @param {string} dedupField - The field to use for deduplication ('id' for user_collection, '_id' for statistics).
 */
async function migrateCollection(sourceDb, targetDb, collectionName, dedupField = 'id') {
  const sourceCollection = sourceDb.collection(collectionName);
  const targetCollection = targetDb.collection(collectionName);

  const totalDocuments = await withRetry(
    () => sourceCollection.countDocuments(),
    `countDocuments (${collectionName})`
  );
  console.log(`    Total documents in source: ${totalDocuments}`);

  if (totalDocuments === 0) {
    console.log(`    No documents to migrate.`);
    return { totalDocuments: 0, migratedDocuments: 0, skippedDocuments: 0 };
  }

  // Collect all existing dedup keys from the target collection for fast lookup
  console.log(`    Loading existing '${dedupField}' values from target collection...`);
  const existingIds = await withRetry(async () => {
    const ids = new Set();
    const projection = { [dedupField]: 1, ...(dedupField !== '_id' ? { _id: 0 } : {}) };
    const cursor = targetCollection.find({}, { projection });
    for await (const doc of cursor) {
      const val = doc[dedupField];
      if (val !== undefined && val !== null) {
        ids.add(String(val));
      }
    }
    return ids;
  }, `load existing '${dedupField}' values (${collectionName})`);
  console.log(`    Found ${existingIds.size} existing '${dedupField}' values in target.`);

  // Load type-specific dedup sets for any types listed in TYPE_DEDUP_OVERRIDES
  const typeDedupSets = Object.keys(TYPE_DEDUP_OVERRIDES).length > 0
    ? await loadTypeDedupSets(targetCollection, collectionName)
    : new Map();

  let migratedDocuments = 0;
  let typeSkippedDocuments = 0;
  let skippedDocuments = 0;
  let processedDocuments = 0;
  let typeExcludedDocuments = 0;

  // Use _id cursor-based pagination (much cheaper than skip on Cosmos DB)
  // Each page query uses { _id: { $gt: lastId } } so RU cost stays constant
  let batch = [];
  let lastId = null;

  while (true) {
    // Build the query filter — first page gets all docs, subsequent pages resume after lastId
    const query = lastId ? { _id: { $gt: lastId } } : {};

    const docs = await withRetry(
      () => sourceCollection.find(query).sort({ _id: 1 }).limit(BATCH_SIZE).toArray(),
      `read source docs (${collectionName}, after ${lastId || 'start'})`
    );

    if (docs.length === 0) break;

    // Track the last _id for the next page
    lastId = docs[docs.length - 1]._id;

    for (const doc of docs) {
      processedDocuments++;

      // Skip documents whose type is in the SKIP_TYPES exclusion list
      if (doc.type && SKIP_TYPES.includes(doc.type)) {
        typeExcludedDocuments++;
        skippedDocuments++;
        continue;
      }

      // Skip documents without the dedup field
      const dedupVal = doc[dedupField];
      if (dedupVal === undefined || dedupVal === null) {
        skippedDocuments++;
        continue;
      }

      // Skip documents that already exist in the target
      if (existingIds.has(String(dedupVal))) {
        skippedDocuments++;
        continue;
      }

      // Type-specific dedup: check the override field for this document's type
      const typeOverride = doc.type ? typeDedupSets.get(doc.type) : null;
      if (typeOverride) {
        const altVal = doc[typeOverride.field];
        if (altVal !== undefined && altVal !== null && typeOverride.existing.has(String(altVal))) {
          typeSkippedDocuments++;
          skippedDocuments++;
          continue;
        }
        // Track the value so subsequent docs in the same batch are also caught
        if (altVal !== undefined && altVal !== null) {
          typeOverride.existing.add(String(altVal));
        }
      }

      batch.push(doc);

      // Check if we've hit the global migration limit
      if (globalMigratedCount + batch.length >= MIGRATE_LIMIT) {
        const remaining = MIGRATE_LIMIT - globalMigratedCount;
        batch = batch.slice(0, remaining);
        if (batch.length > 0) {
          await withRetry(
            () => targetCollection.insertMany(batch, { ordered: false }),
            `insertMany (limit-capped batch of ${batch.length})`
          );
          migratedDocuments += batch.length;
          globalMigratedCount += batch.length;
        }
        console.log(`    🛑 Reached --limit of ${MIGRATE_LIMIT} documents. Stopping.`);
        return { totalDocuments, migratedDocuments, skippedDocuments, typeSkippedDocuments };
      }
    }

    // Insert the batch collected from this page
    if (batch.length >= BATCH_SIZE) {
      const batchToInsert = [...batch];
      await withRetry(
        () => targetCollection.insertMany(batchToInsert, { ordered: false }),
        `insertMany (batch at doc ${processedDocuments})`
      );
      migratedDocuments += batchToInsert.length;
      globalMigratedCount += batchToInsert.length;
      batch = [];

      // Throttle to avoid overwhelming Cosmos DB
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (processedDocuments % (BATCH_SIZE * 5) === 0) {
      console.log(`    Progress: ${processedDocuments}/${totalDocuments} (${Math.round((processedDocuments / totalDocuments) * 100)}%)`);
    }
  }

  // Insert remaining documents
  if (batch.length > 0) {
    await withRetry(
      () => targetCollection.insertMany(batch, { ordered: false }),
      `insertMany (final batch of ${batch.length})`
    );
    migratedDocuments += batch.length;
    globalMigratedCount += batch.length;
  }

  if (typeExcludedDocuments > 0) {
    console.log(`    🚫 ${typeExcludedDocuments} documents excluded by SKIP_TYPES (${SKIP_TYPES.join(', ')})`);
  }
  if (typeSkippedDocuments > 0) {
    console.log(`    ℹ️  ${typeSkippedDocuments} documents skipped by type-specific dedup rules`);
  }

  return { totalDocuments, migratedDocuments, skippedDocuments, typeExcludedDocuments, typeSkippedDocuments };
}

/**
 * Run the full migration across all configured databases and collections.
 */
async function runMigration() {
  console.log('Loading environment variables from .env.local...');
  loadEnvLocal();

  const ppUri = process.env.MONGO_PP_URI;
  const uatUri = process.env.MONGO_UAT_URI;

  if (!ppUri) {
    throw new Error('MONGO_PP_URI is not set in .env.local');
  }
  if (!uatUri) {
    throw new Error('MONGO_UAT_URI is not set in .env.local');
  }

  const clients = [];

  const migrationResults = {
    totalDocuments: 0,
    migratedDocuments: 0,
    skippedDocuments: 0,
    typeExcludedDocuments: 0,
    typeSkippedDocuments: 0,
    errors: [],
  };

  try {
    for (const dbName of DATABASES) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`DATABASE: ${dbName}`);
      console.log('='.repeat(60));

      const { client: sourceClient, db: sourceDb } = await connectToMongo(ppUri, dbName);
      const { client: targetClient, db: targetDb } = await connectToMongo(uatUri, dbName);
      clients.push(sourceClient, targetClient);

      for (const collectionName of COLLECTIONS) {
        if (globalMigratedCount >= MIGRATE_LIMIT) {
          console.log(`\n  Skipping ${collectionName} — global limit reached.`);
          continue;
        }
        console.log(`\n  Collection: ${collectionName}`);

        try {
          const dedupField = collectionName === 'statistics' ? '_id' : 'id';
          const result = await migrateCollection(sourceDb, targetDb, collectionName, dedupField);

          migrationResults.totalDocuments += result.totalDocuments;
          migrationResults.migratedDocuments += result.migratedDocuments;
          migrationResults.skippedDocuments += result.skippedDocuments;
          migrationResults.typeExcludedDocuments += result.typeExcludedDocuments || 0;
          migrationResults.typeSkippedDocuments += result.typeSkippedDocuments || 0;

          const typeExclNote = result.typeExcludedDocuments ? ` (${result.typeExcludedDocuments} type-excluded)` : '';
          const typeSkipNote = result.typeSkippedDocuments ? ` (${result.typeSkippedDocuments} by type-dedup)` : '';
          console.log(`    ✅ Completed: ${result.migratedDocuments} migrated, ${result.skippedDocuments} skipped${typeExclNote}${typeSkipNote} out of ${result.totalDocuments}`);
        } catch (error) {
          console.error(`    ❌ Error migrating ${dbName}/${collectionName}:`, error.message);
          migrationResults.errors.push({
            database: dbName,
            collection: collectionName,
            error: error.message,
          });
        }
      }
    }

    // Print summary
    printMigrationSummary(migrationResults);

  } finally {
    console.log('\nClosing database connections...');
    for (const client of clients) {
      try {
        await client.close();
      } catch (_) { /* ignore close errors */ }
    }
  }
}

function printMigrationSummary(results) {
  console.log('\n' + '='.repeat(60));
  console.log('MIGRATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Databases migrated:     ${DATABASES.join(', ')}`);
  console.log(`Collections migrated:   ${COLLECTIONS.join(', ')}`);
  console.log(`Total documents:        ${results.totalDocuments.toLocaleString()}`);
  console.log(`Documents migrated:     ${results.migratedDocuments.toLocaleString()}`);
  console.log(`Documents skipped:      ${results.skippedDocuments.toLocaleString()}`);
  if (results.typeExcludedDocuments > 0) {
    console.log(`  ↳ type-excluded:      ${results.typeExcludedDocuments.toLocaleString()}`);
  }
  if (results.typeSkippedDocuments > 0) {
    console.log(`  ↳ by type-dedup:      ${results.typeSkippedDocuments.toLocaleString()}`);
  }
  if (SKIP_TYPES.length > 0) {
    console.log(`Excluded types:         ${SKIP_TYPES.join(', ')}`);
  }
  if (Object.keys(TYPE_DEDUP_OVERRIDES).length > 0) {
    console.log(`Type dedup rules:       ${Object.entries(TYPE_DEDUP_OVERRIDES).map(([t, f]) => `${t}→${f}`).join(', ')}`);
  }

  if (results.totalDocuments > 0) {
    console.log(`Migration rate:         ${((results.migratedDocuments / results.totalDocuments) * 100).toFixed(2)}%`);
  }

  if (results.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    results.errors.forEach(err => {
      console.log(`  - ${err.database}/${err.collection}: ${err.error}`);
    });
  } else {
    console.log('\n✅ Migration completed successfully with no errors!');
  }
  console.log('='.repeat(60));
}

// Run the migration
runMigration()
  .then(() => {
    console.log('\nDone.');
    process.exit(0);
  })
  .catch(error => {
    console.error('\nMigration failed:', error);
    process.exit(1);
  });
