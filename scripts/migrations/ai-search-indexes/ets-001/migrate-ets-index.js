/**
 * Azure AI Search Index Migration Script
 * 
 * Purpose: 
 * 1. Update the content_vector field to be retrievable in pre-prod ets-001 index
 * 2. Read all documents from pre-prod in batches of 50
 * 3. Upload each batch to UAT environment
 * 4. Restore content_vector to non-retrievable in pre-prod after migration
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
import { setProcessEnvironment } from '../../../configActions.js';

// ES Module dirname workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const INDEX_NAME = 'ets-001';
const OUTPUT_DIR = path.resolve(__dirname);
const BATCH_SIZE = 50;

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

    const index = await indexClient.getIndex(indexName);

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
    const index = await indexClient.getIndex(indexName);

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

    await indexClient.createOrUpdateIndex(index);
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
    const index = await indexClient.getIndex(indexName);

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

    await indexClient.createOrUpdateIndex(index);
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

    const allDocuments = [];
    let count = 0;

    // Search for all documents with select: * to get all fields including vectors
    const searchResults = await searchClient.search('*', {
      select: ['*'],
      top: maxDocuments || 1000000, // Large number if no limit
      includeTotalCount: true
    });

    console.log(`📊 Total documents available: ${searchResults.count}`);

    for await (const result of searchResults.results) {
      allDocuments.push(result.document);
      count++;

      if (maxDocuments && count >= maxDocuments) {
        console.log(`⚠️  Reached document limit of ${maxDocuments}`);
        break;
      }

      if (count % 100 === 0) {
        console.log(`   Read ${count} documents...`);
      }
    }

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
 * Upload a batch of documents to target index
 */
async function uploadBatch(searchClient, documents, batchNumber) {
  try {
    console.log(`📤 Uploading batch ${batchNumber} (${documents.length} documents)...`);

    const batch = documents.map(doc => ({
      '@search.action': 'upload',
      ...doc
    }));

    const result = await searchClient.uploadDocuments(batch);

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
      return { totalDocuments: 0, succeeded: 0, failed: 0 };
    }

    // In test mode, save documents to file instead of uploading
    if (testMode) {
      const allDocuments = batches.flat();
      const outputPath = path.join(OUTPUT_DIR, `test-documents-${new Date().toISOString().replace(/:/g, '-')}.json`);

      await fs.writeFile(outputPath, JSON.stringify(allDocuments, null, 2), 'utf8');

      console.log(`\n📄 Test documents saved to: ${outputPath}`);
      console.log(`📊 Total documents: ${allDocuments.length}`);
      console.log(`\n💡 Review the documents in the file above.`);
      console.log(`💡 If everything looks good, run without --test flag for full migration.\n`);

      console.log(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'migrateDocuments',
          detail: {
            totalDocuments: allDocuments.length,
            outputPath,
            testMode: true
          }
        }
      }));

      return {
        totalDocuments: allDocuments.length,
        succeeded: 0,
        failed: 0
      };
    }

    // Upload each batch to UAT (production mode only)
    let totalSucceeded = 0;
    let totalFailed = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const result = await uploadBatch(uatSearchClient, batch, i + 1);

      totalSucceeded += result.succeeded;
      totalFailed += result.failed;

      // Small delay between batches to avoid throttling
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Documents: ${totalSucceeded + totalFailed}`);
    console.log(`✅ Succeeded: ${totalSucceeded}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log('='.repeat(80));

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'migrateDocuments',
        detail: {
          totalDocuments: totalSucceeded + totalFailed,
          succeeded: totalSucceeded,
          failed: totalFailed,
          testMode
        }
      }
    }));

    return {
      totalDocuments: totalSucceeded + totalFailed,
      succeeded: totalSucceeded,
      failed: totalFailed
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
    await setProcessEnvironment();

    const envName = process.env['envName'];
    console.log(`📋 Environment: ${envName}`);
    console.log(`🔍 Index Name: ${INDEX_NAME}`);
    console.log(`🧪 Test Mode: ${testMode ? 'YES (10 documents)' : 'NO (full migration)'}\n`);

    // Validate environment
    if (envName !== 'pp') {
      console.warn(`⚠️  WARNING: Expected environment 'pp' (pre-prod), but got '${envName}'`);
      console.warn('⚠️  Make sure KPCONFIG_PROFILE=genai-port-client-pp in .env.local\n');
    }

    // Get PP (pre-prod) credentials from KP Config
    const ppSearchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
    const ppSearchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.api.key`];

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

    // Step 1: Make content_vector retrievable in PP
    console.log('='.repeat(80));
    console.log('STEP 1: Update PP Index Schema');
    console.log('='.repeat(80) + '\n');

    await makeContentVectorRetrievable(ppIndexClient, INDEX_NAME);

    // Step 2: Verify schema
    console.log('\n' + '='.repeat(80));
    console.log('STEP 2: Verify Schema');
    console.log('='.repeat(80) + '\n');

    const index = await getIndexSchema(ppIndexClient, INDEX_NAME);
    const vectorCheck = checkContentVectorRetrievable(index);

    if (!vectorCheck.retrievable) {
      throw new Error('content_vector field is still not retrievable after update!');
    }

    // Step 3: Migrate documents
    console.log('\n' + '='.repeat(80));
    console.log('STEP 3: Migrate Documents from PP to UAT');
    console.log('='.repeat(80) + '\n');

    // Initialize Search Clients
    const ppSearchClient = getSearchClient(ppSearchEndpoint, ppSearchAPIKey, INDEX_NAME);
    const uatSearchClient = getSearchClient(uatSearchEndpoint, uatSearchKey, INDEX_NAME);

    const migrationResult = await migrateDocuments(ppSearchClient, uatSearchClient, testMode);

    // Step 4: Make content_vector non-retrievable again
    console.log('\n' + '='.repeat(80));
    console.log('STEP 4: Restore PP Index Schema (Make content_vector Non-Retrievable)');
    console.log('='.repeat(80) + '\n');

    await makeContentVectorNonRetrievable(ppIndexClient, INDEX_NAME);

    // Final summary
    console.log('\n' + '='.repeat(80));
    console.log('✅ MIGRATION COMPLETE');
    console.log('='.repeat(80));
    console.log(`Documents Migrated: ${migrationResult.succeeded}`);
    console.log(`Failures: ${migrationResult.failed}`);
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
