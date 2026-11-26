/**
 * Azure AI Search Index Migration Script
 * 
 * Purpose: 
 * 1. Update the content_vector field to be retrievable in pre-prod ets-001 index
 * 2. Read all documents from pre-prod in batches of 50
 * 3. Upload each batch to UAT environment
 * 4. Restore content_vector to non-retrievable in pre-prod after migration
 * 
 * Required environment variables (.env.local):
 *   ppSearchEndpoint   - Azure AI Search endpoint for PP (pre-prod)
 *   ppSearchKey         - Azure AI Search API key for PP (pre-prod)
 *   uatSearchEndpoint  - Azure AI Search endpoint for UAT
 *   uatSearchKey        - Azure AI Search API key for UAT
 * 
 * Usage:
 *   Test mode (10 documents):
 *     node scripts/migrations/ai-search-indexes/ets-001/migrate-ets-index.js --test
 *   
 *   Full migration:
 *     node scripts/migrations/ai-search-indexes/ets-001/migrate-ets-index.js
 */

import { SearchIndexClient, SearchClient, AzureKeyCredential } from '@azure/search-documents';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
// import { setProcessEnvironment } from '../../../configActions.js';

// ES Module dirname workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const INDEX_NAME = 'ets-001';
const OUTPUT_DIR = path.resolve(__dirname);
const BATCH_SIZE = 50;
const DEDUP_FIELD = 'doc_id';
const MAX_RETRIES = 15;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 120000; // 2 minutes
const SLOW_REQUEST_THRESHOLD_MS = 30000; // 30 seconds

/**
 * Execute an async operation with exponential backoff retry logic.
 * Doubles the wait time on each retry, capped at MAX_BACKOFF_MS.
 * Logs a warning when any attempt takes longer than 30 seconds.
 * Handles Azure AI Search 429 (Too Many Requests) by respecting the Retry-After header.
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

      // Parse Azure AI Search Retry-After header if present (value in seconds)
      let retryAfterMs = 0;
      if (error.statusCode === 429) {
        const retryAfterSec = error.response?.headers?.get?.('retry-after')
          || error.response?.headers?.['retry-after'];
        if (retryAfterSec) {
          retryAfterMs = parseInt(retryAfterSec, 10) * 1000;
        }
      }

      const waitMs = Math.max(backoff, retryAfterMs);

      console.warn(`    ⏳ ${label} failed (attempt ${attempt}/${MAX_RETRIES}). ` +
        `${error.statusCode ? `Status: ${error.statusCode}. ` : ''}` +
        `Retrying in ${(waitMs / 1000).toFixed(1)}s...`);
      console.warn(`       Error: ${error.message}`);

      await new Promise(resolve => setTimeout(resolve, waitMs));
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
    }
  }
}

/**
 * Initialize the Azure Search Index Client
 */
function getSearchIndexClient() {
  const envName = process.env['envName'];
  const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
  const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.api.key`];

  if (!searchEndpoint || !searchAPIKey) {
    throw new Error(`Missing Azure Search configuration for environment: ${envName}`);
  }

  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'getSearchIndexClient',
      detail: { envName, searchEndpoint }
    }
  }));

  return new SearchIndexClient(
    searchEndpoint,
    new AzureKeyCredential(searchAPIKey)
  );
}

/**
 * Retrieve the index schema
 */
async function getIndexSchema(indexClient, indexName) {
  try {
    console.log(`📥 Retrieving schema for index: ${indexName}...`);

    const index = await withRetry(
      () => indexClient.getIndex(indexName),
      `getIndex (${indexName})`
    );

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'getIndexSchema',
        detail: {
          indexName,
          fieldCount: index.fields.length,
          retrievedAt: new Date().toISOString()
        }
      }
    }));

    return index;
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'getIndexSchema',
        detail: { indexName, error: error.message }
      }
    }));
    throw error;
  }
}

/**
 * Check if content_vector field is retrievable (not hidden)
 */
function checkContentVectorRetrievable(index) {
  const contentVectorField = index.fields.find(f => f.name === 'content_vector');

  if (!contentVectorField) {
    console.warn('⚠️  WARNING: content_vector field not found in index schema!');
    return {
      exists: false,
      retrievable: false
    };
  }

  // In the @azure/search-documents SDK, hidden: false means retrievable
  const isRetrievable = contentVectorField.hidden === false;

  if (isRetrievable) {
    console.log('✅ content_vector field is RETRIEVABLE (hidden=false)');
  } else {
    console.warn('❌ content_vector field is NOT RETRIEVABLE (hidden=true) - data will be lost during migration!');
  }

  return {
    exists: true,
    retrievable: isRetrievable,
    field: contentVectorField
  };
}

/**
 * Save schema to file
 */
async function saveSchemaToFile(index, outputPath) {
  try {
    const schemaJson = JSON.stringify(index, null, 2);
    await fs.writeFile(outputPath, schemaJson, 'utf8');

    console.log(`💾 Schema saved to: ${outputPath}`);

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'saveSchemaToFile',
        detail: { outputPath, size: schemaJson.length }
      }
    }));
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'saveSchemaToFile',
        detail: { outputPath, error: error.message }
      }
    }));
    throw error;
  }
}

/**
 * Update field to be retrievable (by setting hidden to false)
 */
async function makeContentVectorRetrievable(indexClient, indexName) {
  try {
    console.log(`🔄 Checking content_vector retrievable status...`);
    const index = await withRetry(
      () => indexClient.getIndex(indexName),
      `getIndex for retrievable check (${indexName})`
    );

    const contentVectorField = index.fields.find(f => f.name === 'content_vector');

    if (!contentVectorField) {
      console.warn('⚠️  content_vector field not found in index');
      return false;
    }

    // Check if already retrievable (hidden === false means retrievable)
    if (contentVectorField.hidden === false) {
      console.log('✅ content_vector is already retrievable (hidden=false)');
      return true;
    }

    // Update the field - in @azure/search-documents SDK, set hidden to false to make it retrievable
    console.log('📝 Updating content_vector to be retrievable (setting hidden=false)...');
    contentVectorField.hidden = false;

    await withRetry(
      () => indexClient.createOrUpdateIndex(index),
      `createOrUpdateIndex - make retrievable (${indexName})`
    );
    console.log('✅ content_vector is now retrievable');

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'makeContentVectorRetrievable',
        detail: { indexName, updated: true }
      }
    }));

    // Wait for index to update
    console.log('⏳ Waiting 10 seconds for index to update...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    return true;
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'makeContentVectorRetrievable',
        detail: { indexName, error: error.message }
      }
    }));
    throw error;
  }
}

/**
 * Update field to be non-retrievable (by setting hidden to true)
 */
async function makeContentVectorNonRetrievable(indexClient, indexName) {
  try {
    console.log(`🔄 Setting content_vector to non-retrievable...`);
    const index = await withRetry(
      () => indexClient.getIndex(indexName),
      `getIndex for non-retrievable update (${indexName})`
    );

    const contentVectorField = index.fields.find(f => f.name === 'content_vector');

    if (!contentVectorField) {
      console.warn('⚠️  content_vector field not found in index');
      return false;
    }

    // Check if already non-retrievable (hidden === true means not retrievable)
    if (contentVectorField.hidden === true) {
      console.log('✅ content_vector is already non-retrievable (hidden=true)');
      return true;
    }

    // Update the field - in @azure/search-documents SDK, set hidden to true to make it non-retrievable
    console.log('📝 Updating content_vector to be non-retrievable (setting hidden=true)...');
    contentVectorField.hidden = true;

    await withRetry(
      () => indexClient.createOrUpdateIndex(index),
      `createOrUpdateIndex - make non-retrievable (${indexName})`
    );
    console.log('✅ content_vector is now non-retrievable');

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'makeContentVectorNonRetrievable',
        detail: { indexName, updated: true }
      }
    }));

    // Wait for index to update
    console.log('⏳ Waiting 10 seconds for index to update...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    return true;
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'makeContentVectorNonRetrievable',
        detail: { indexName, error: error.message }
      }
    }));
    throw error;
  }
}

/**
 * Get SearchClient for a specific environment
 */
function getSearchClient(endpoint, apiKey, indexName) {
  return new SearchClient(
    endpoint,
    indexName,
    new AzureKeyCredential(apiKey)
  );
}

/**
 * Read all documents from an index in batches
 */
async function readDocumentsInBatches(searchClient, batchSize, maxDocuments = null) {
  try {
    console.log(`📥 Reading documents from index (batch size: ${batchSize})...`);

    // Search + iteration wrapped in retry since both the initial search call
    // and pagination requests can trigger 429 (Too Many Requests).
    // If a 429 occurs mid-pagination, the entire search restarts from scratch.
    const allDocuments = await withRetry(async () => {
      const docs = [];
      let count = 0;

      const searchResults = await searchClient.search('*', {
        select: ['*'],
        top: maxDocuments || 1000000, // Large number if no limit
        includeTotalCount: true
      });

      console.log(`📊 Total documents available: ${searchResults.count}`);

      for await (const result of searchResults.results) {
        docs.push(result.document);
        count++;

        if (maxDocuments && count >= maxDocuments) {
          console.log(`⚠️  Reached document limit of ${maxDocuments}`);
          break;
        }

        if (count % 100 === 0) {
          console.log(`   Read ${count} documents...`);
        }
      }

      return docs;
    }, 'search and read all documents');

    console.log(`✅ Read ${allDocuments.length} total documents`);

    // Split into batches
    const batches = [];
    for (let i = 0; i < allDocuments.length; i += batchSize) {
      batches.push(allDocuments.slice(i, i + batchSize));
    }

    console.log(`📦 Split into ${batches.length} batches`);

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'readDocumentsInBatches',
        detail: {
          totalDocuments: allDocuments.length,
          batchCount: batches.length,
          batchSize
        }
      }
    }));

    return batches;
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'readDocumentsInBatches',
        detail: { error: error.message }
      }
    }));
    throw error;
  }
}

/**
 * Load all existing doc_id values from the target (UAT) index into a Set for deduplication.
 * Only fetches the DEDUP_FIELD to minimise bandwidth and RU consumption.
 */
async function loadExistingDocIds(searchClient) {
  console.log(`📥 Loading existing '${DEDUP_FIELD}' values from UAT index for deduplication...`);

  const existingIds = await withRetry(async () => {
    const ids = new Set();

    const searchResults = await searchClient.search('*', {
      select: [DEDUP_FIELD],
      top: 1000000,
      includeTotalCount: true
    });

    console.log(`📊 Total documents in UAT index: ${searchResults.count}`);

    for await (const result of searchResults.results) {
      const val = result.document[DEDUP_FIELD];
      if (val !== undefined && val !== null) {
        ids.add(String(val));
      }
    }

    return ids;
  }, `load existing '${DEDUP_FIELD}' values from UAT`);

  console.log(`✅ Found ${existingIds.size} existing '${DEDUP_FIELD}' values in UAT`);

  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'loadExistingDocIds',
      detail: { existingCount: existingIds.size }
    }
  }));

  return existingIds;
}

/**
 * Upload a batch of documents to target index
 */
async function uploadBatch(searchClient, documents, batchNumber) {
  try {
    console.log(`📤 Uploading batch ${batchNumber} (${documents.length} documents)...`);

    const batch = documents.map(doc => ({
      '@search.action': 'upload',
      ...doc
    }));

    const result = await withRetry(
      () => searchClient.uploadDocuments(batch),
      `uploadDocuments (batch ${batchNumber}, ${documents.length} docs)`
    );

    const succeeded = result.results.filter(r => r.succeeded).length;
    const failed = result.results.filter(r => !r.succeeded).length;

    if (failed > 0) {
      console.warn(`⚠️  Batch ${batchNumber}: ${succeeded} succeeded, ${failed} failed`);
      result.results.filter(r => !r.succeeded).forEach(r => {
        console.error(`   Failed document: ${r.key} - ${r.errorMessage}`);
      });
    } else {
      console.log(`✅ Batch ${batchNumber}: All ${succeeded} documents uploaded successfully`);
    }

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'uploadBatch',
        detail: {
          batchNumber,
          total: documents.length,
          succeeded,
          failed
        }
      }
    }));

    return { succeeded, failed };
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'uploadBatch',
        detail: { batchNumber, error: error.message }
      }
    }));
    throw error;
  }
}

/**
 * Migrate documents from PP to UAT
 */
async function migrateDocuments(ppSearchClient, uatSearchClient, testMode = false) {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 Starting Document Migration');
    console.log('='.repeat(80));

    const maxDocuments = testMode ? 10 : null;
    if (testMode) {
      console.log('⚠️  TEST MODE: Will read 10 documents and save to file (no upload)\n');
    }

    // Read documents from PP
    const batches = await readDocumentsInBatches(ppSearchClient, BATCH_SIZE, maxDocuments);

    if (batches.length === 0) {
      console.log('⚠️  No documents to migrate');
      return { totalDocuments: 0, succeeded: 0, failed: 0, skipped: 0 };
    }

    // Deduplication: load existing doc_ids from UAT and filter out duplicates
    const existingIds = await loadExistingDocIds(uatSearchClient);

    const allSourceDocs = batches.flat();
    const newDocuments = allSourceDocs.filter(doc => {
      const val = doc[DEDUP_FIELD];
      if (val === undefined || val === null) return true; // include docs without dedup field (shouldn't happen)
      return !existingIds.has(String(val));
    });

    const skippedCount = allSourceDocs.length - newDocuments.length;
    console.log(`\n📊 Deduplication: ${allSourceDocs.length} source docs, ${skippedCount} already in UAT, ${newDocuments.length} new`);

    if (newDocuments.length === 0) {
      console.log('✅ All documents already exist in UAT. Nothing to migrate.');
      return { totalDocuments: allSourceDocs.length, succeeded: 0, failed: 0, skipped: skippedCount };
    }

    // Re-batch the filtered (new-only) documents
    const dedupedBatches = [];
    for (let i = 0; i < newDocuments.length; i += BATCH_SIZE) {
      dedupedBatches.push(newDocuments.slice(i, i + BATCH_SIZE));
    }

    // In test mode, save documents to file instead of uploading
    if (testMode) {
      const allDocuments = dedupedBatches.flat();
      const outputPath = path.join(OUTPUT_DIR, `test-documents-${new Date().toISOString().replace(/:/g, '-')}.json`);

      await fs.writeFile(outputPath, JSON.stringify(allDocuments, null, 2), 'utf8');

      console.log(`\n📄 Test documents saved to: ${outputPath}`);
      console.log(`📊 Total new documents (after dedup): ${allDocuments.length}`);
      console.log(`📊 Skipped (already in UAT): ${skippedCount}`);
      console.log(`\n💡 Review the documents in the file above.`);
      console.log(`💡 If everything looks good, run without --test flag for full migration.\n`);

      console.log(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'migrateDocuments',
          detail: {
            totalDocuments: allSourceDocs.length,
            newDocuments: allDocuments.length,
            skipped: skippedCount,
            outputPath,
            testMode: true
          }
        }
      }));

      return {
        totalDocuments: allSourceDocs.length,
        succeeded: 0,
        failed: 0,
        skipped: skippedCount
      };
    }

    // Upload each deduplicated batch to UAT (production mode only)
    let totalSucceeded = 0;
    let totalFailed = 0;

    for (let i = 0; i < dedupedBatches.length; i++) {
      const batch = dedupedBatches[i];
      const result = await uploadBatch(uatSearchClient, batch, i + 1);

      totalSucceeded += result.succeeded;
      totalFailed += result.failed;

      // Small delay between batches to avoid throttling
      if (i < dedupedBatches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Source Documents: ${allSourceDocs.length}`);
    console.log(`⏭️  Skipped (already in UAT): ${skippedCount}`);
    console.log(`✅ Succeeded: ${totalSucceeded}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log('='.repeat(80));

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'migrateDocuments',
        detail: {
          totalSourceDocuments: allSourceDocs.length,
          newDocuments: newDocuments.length,
          skipped: skippedCount,
          succeeded: totalSucceeded,
          failed: totalFailed,
          testMode
        }
      }
    }));

    return {
      totalDocuments: allSourceDocs.length,
      succeeded: totalSucceeded,
      failed: totalFailed,
      skipped: skippedCount
    };
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'migrateDocuments',
        detail: { error: error.message }
      }
    }));
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  const testMode = process.argv.includes('--test');

  console.log('🚀 Starting Azure AI Search Index Migration...\n');

  try {
    // Load configuration from KP Config
    // await setProcessEnvironment();
    // const envName = process.env['envName'];
    // console.log(`📋 Environment: ${envName}`);

    console.log(`🔍 Index Name: ${INDEX_NAME}`);
    console.log(`🧪 Test Mode: ${testMode ? 'YES (10 documents)' : 'NO (full migration)'}\n`);

    // Validate environment
    // if (envName !== 'pp') {
    //   console.warn(`⚠️  WARNING: Expected environment 'pp' (pre-prod), but got '${envName}'`);
    //   console.warn('⚠️  Make sure KPCONFIG_PROFILE=genai-port-client-pp in .env.local\n');
    // }

    // Get PP (pre-prod) credentials from KP Config
    const ppSearchEndpoint = process.env.ppSearchEndpoint;
    const ppSearchAPIKey = process.env.ppSearchKey;

    // Get UAT credentials from .env.local
    const uatSearchEndpoint = process.env.uatSearchEndpoint;
    const uatSearchKey = process.env.uatSearchKey;

    if (!ppSearchEndpoint || !ppSearchAPIKey) {
      throw new Error('Missing PP (pre-prod) search credentials from KP Config');
    }

    if (!uatSearchEndpoint || !uatSearchKey) {
      throw new Error('Missing UAT search credentials from .env.local (uatSearchEndpoint, uatSearchKey)');
    }

    console.log('🔑 Credentials loaded:');
    console.log(`   PP Endpoint: ${ppSearchEndpoint}`);
    console.log(`   UAT Endpoint: ${uatSearchEndpoint}\n`);

    // Initialize Index Client for PP
    const ppIndexClient = new SearchIndexClient(
      ppSearchEndpoint,
      new AzureKeyCredential(ppSearchAPIKey)
    );

    // Step 1: Validate that the dedup field exists in the PP index
    console.log('='.repeat(80));
    console.log('STEP 1: Validate Dedup Field');
    console.log('='.repeat(80) + '\n');

    const schemaForValidation = await getIndexSchema(ppIndexClient, INDEX_NAME);
    const dedupFieldExists = schemaForValidation.fields.some(f => f.name === DEDUP_FIELD);

    if (!dedupFieldExists) {
      const availableFields = schemaForValidation.fields.map(f => f.name).join(', ');
      console.error(`\n⛔ MIGRATION ABORTED: Dedup field '${DEDUP_FIELD}' not found in index '${INDEX_NAME}'.`);
      console.error(`   Available fields: ${availableFields}`);
      console.error(`   Update the DEDUP_FIELD constant to match a valid field in this index.\n`);

      console.error(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'validateDedupField',
          detail: {
            indexName: INDEX_NAME,
            dedupField: DEDUP_FIELD,
            availableFields,
            error: `Dedup field '${DEDUP_FIELD}' not found in index`
          }
        }
      }));

      process.exit(1);
    }

    console.log(`✅ Dedup field '${DEDUP_FIELD}' exists in index '${INDEX_NAME}'\n`);

    // Step 2: Make content_vector retrievable in PP
    console.log('='.repeat(80));
    console.log('STEP 2: Update PP Index Schema');
    console.log('='.repeat(80) + '\n');

    await makeContentVectorRetrievable(ppIndexClient, INDEX_NAME);

    // Step 3: Verify schema
    console.log('\n' + '='.repeat(80));
    console.log('STEP 3: Verify Schema');
    console.log('='.repeat(80) + '\n');

    const index = await getIndexSchema(ppIndexClient, INDEX_NAME);
    const vectorCheck = checkContentVectorRetrievable(index);

    if (!vectorCheck.retrievable) {
      throw new Error('content_vector field is still not retrievable after update!');
    }

    // Step 4: Migrate documents
    console.log('\n' + '='.repeat(80));
    console.log('STEP 4: Migrate Documents from PP to UAT');
    console.log('='.repeat(80) + '\n');

    // Initialize Search Clients
    const ppSearchClient = getSearchClient(ppSearchEndpoint, ppSearchAPIKey, INDEX_NAME);
    const uatSearchClient = getSearchClient(uatSearchEndpoint, uatSearchKey, INDEX_NAME);

    const migrationResult = await migrateDocuments(ppSearchClient, uatSearchClient, testMode);

    // Step 5: Make content_vector non-retrievable again
    console.log('\n' + '='.repeat(80));
    console.log('STEP 5: Restore PP Index Schema (Make content_vector Non-Retrievable)');
    console.log('='.repeat(80) + '\n');

    await makeContentVectorNonRetrievable(ppIndexClient, INDEX_NAME);

    // Final summary
    console.log('\n' + '='.repeat(80));
    console.log('✅ MIGRATION COMPLETE');
    console.log('='.repeat(80));
    console.log(`Total Source Documents: ${migrationResult.totalDocuments}`);
    console.log(`Skipped (duplicates):   ${migrationResult.skipped}`);
    console.log(`Documents Migrated:     ${migrationResult.succeeded}`);
    console.log(`Failures:               ${migrationResult.failed}`);
    console.log('='.repeat(80));


  } catch (error) {
    console.error('\n❌ Error during migration:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'main',
        detail: { error: error.message, stack: error.stack }
      }
    }));

    process.exit(1);
  }
}

// Execute if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export { getIndexSchema, checkContentVectorRetrievable, makeContentVectorRetrievable, makeContentVectorNonRetrievable, readDocumentsInBatches, uploadBatch, migrateDocuments };
