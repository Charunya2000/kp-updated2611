/**
 * Azure AI Search Index Extraction Script
 *
 * Reads all documents from a given Azure AI Search index and writes them to a
 * JSON file.  Uses the KP Config environment variables already loaded by
 * setProcessEnvironment() so no additional credential setup is required.
 *
 * Usage:
 *   Dry-run (logs first 5 documents, no file written):
 *     node scripts/ai-search/extract-ai-search-index.js --index <indexName> --dry-run
 *
 *   Full extraction (writes all documents to a JSON file):
 *     node scripts/ai-search/extract-ai-search-index.js --index <indexName> [--format json|jsonl]
 *
 * Output:
 *   <indexName>-extract-<timestamp>.json|jsonl  (written next to this script)
 *
 * Options:
 *   --index <name>   (required) Name of the Azure AI Search index to extract
 *   --dry-run        (optional) Log first 5 documents only; do not write a file
 *   --format <type>  (optional) Output format: json or jsonl (default: jsonl)
 */

import { SearchClient, SearchIndexClient, AzureKeyCredential } from '@azure/search-documents';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { fileURLToPath } from 'url';
import { once } from 'events';
import { setProcessEnvironment } from '../configActions.js';

// ES Module dirname workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const BATCH_LOG_INTERVAL = 100; // Log progress every N documents

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  const indexFlagPos = args.indexOf('--index');
  if (indexFlagPos === -1 || !args[indexFlagPos + 1]) {
    console.error('❌ Missing required argument: --index <indexName>');
    console.error('\nUsage:');
    console.error('  node scripts/ai-search/extract-ai-search-index.js --index <indexName> [--dry-run]');
    process.exit(1);
  }

  const formatFlagPos = args.indexOf('--format');
  const rawFormat = formatFlagPos >= 0 ? args[formatFlagPos + 1] : 'jsonl';
  const format = String(rawFormat || 'jsonl').toLowerCase();

  if (!['json', 'jsonl'].includes(format)) {
    console.error('❌ Invalid --format value. Supported values: json, jsonl');
    process.exit(1);
  }

  const indexName = args[indexFlagPos + 1];
  return { indexName, dryRun, format };
}

// ---------------------------------------------------------------------------
// Azure Search clients
// ---------------------------------------------------------------------------

function getSearchConfig() {
  const envName = process.env['envName'];
  // Standard Indexes
  const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
  const aiUploadAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.api.key`];
  const aiSearchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.api.key`];
  // T3 Indexes
  // const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint.new.t3`];
  // const aiUploadAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.new.t3.api.key`];
  // const aiSearchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.new.t3.api.key`];


  // Index schema operations require an admin-capable key.
  const indexManagementKey = aiUploadAPIKey || aiSearchAPIKey;
  // Document reads can use either key, but prefer aiupload to keep credentials consistent.
  const documentReadKey = aiUploadAPIKey || aiSearchAPIKey;

  if (!searchEndpoint || !indexManagementKey || !documentReadKey) {
    throw new Error(`Missing Azure Search configuration for environment: ${envName}`);
  }

  const indexKeySource = aiUploadAPIKey ? 'aiupload.api.key' : 'aisearch.api.key';
  const readKeySource = aiUploadAPIKey ? 'aiupload.api.key' : 'aisearch.api.key';

  return {
    envName,
    searchEndpoint,
    indexManagementKey,
    documentReadKey,
    indexKeySource,
    readKeySource
  };
}

function getSearchClient(indexName) {
  const { envName, searchEndpoint, documentReadKey, readKeySource } = getSearchConfig();

  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'getSearchClient',
      detail: { envName, searchEndpoint, indexName, keySource: readKeySource }
    }
  }));

  return new SearchClient(searchEndpoint, indexName, new AzureKeyCredential(documentReadKey));
}

function getSearchIndexClient() {
  const { searchEndpoint, indexManagementKey, indexKeySource } = getSearchConfig();

  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'getSearchIndexClient',
      detail: { searchEndpoint, keySource: indexKeySource }
    }
  }));

  return new SearchIndexClient(searchEndpoint, new AzureKeyCredential(indexManagementKey));
}

function getVectorFieldNames(indexDefinition) {
  if (!indexDefinition?.fields?.length) {
    return [];
  }

  return indexDefinition.fields
    .filter((field) => {
      const isVectorByDimensions = typeof field.vectorSearchDimensions === 'number';
      const isVectorByType = field.type === 'Collection(Edm.Single)';
      return isVectorByDimensions || isVectorByType;
    })
    .map((field) => field.name);
}

async function makeVectorFieldsRetrievable(indexClient, indexName) {
  console.log('🔄 Ensuring vector fields are retrievable...');

  const indexDefinition = await indexClient.getIndex(indexName);
  const vectorFieldNames = getVectorFieldNames(indexDefinition);

  if (vectorFieldNames.length === 0) {
    console.warn('⚠️  No vector fields found in index definition.');
    return { vectorFieldNames: [], updated: false };
  }

  let updated = false;
  for (const field of indexDefinition.fields) {
    if (vectorFieldNames.includes(field.name) && field.hidden !== false) {
      field.hidden = false;
      updated = true;
    }
  }

  if (updated) {
    await indexClient.createOrUpdateIndex(indexDefinition);
    console.log(`✅ Updated ${vectorFieldNames.length} vector field(s) to retrievable.`);
    console.log('⏳ Waiting 10 seconds for index update propagation...');
    await new Promise(resolve => setTimeout(resolve, 10000));
  } else {
    console.log('✅ Vector fields are already retrievable.');
  }

  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'makeVectorFieldsRetrievable',
      detail: { indexName, vectorFieldNames, updated }
    }
  }));

  return { vectorFieldNames, updated };
}

async function makeVectorFieldsNonRetrievable(indexClient, indexName, vectorFieldNames) {
  if (!vectorFieldNames?.length) {
    return;
  }

  console.log('🔄 Restoring vector fields to non-retrievable...');
  const indexDefinition = await indexClient.getIndex(indexName);

  let updated = false;
  for (const field of indexDefinition.fields) {
    if (vectorFieldNames.includes(field.name) && field.hidden !== true) {
      field.hidden = true;
      updated = true;
    }
  }

  if (updated) {
    await indexClient.createOrUpdateIndex(indexDefinition);
    console.log(`✅ Restored ${vectorFieldNames.length} vector field(s) to non-retrievable.`);
    console.log('⏳ Waiting 10 seconds for index update propagation...');
    await new Promise(resolve => setTimeout(resolve, 10000));
  } else {
    console.log('✅ Vector fields were already non-retrievable.');
  }

  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'makeVectorFieldsNonRetrievable',
      detail: { indexName, vectorFieldNames, updated }
    }
  }));
}

// ---------------------------------------------------------------------------
// Document extraction
// ---------------------------------------------------------------------------

/**
 * Reads every document from the index using a wildcard search.
 * @param {SearchClient} searchClient
 * @param {number|null} limit  Maximum number of documents to read (null = all)
 * @returns {Promise<Array<object>>}
 */
async function extractDocuments(searchClient, limit = null) {
  console.log(`📥 Reading documents from index${limit ? ` (limit: ${limit})` : ' (all)'}...`);

  const allDocuments = [];

  const searchResults = await searchClient.search('*', {
    select: ['*'],
    includeTotalCount: true
  });

  console.log(`📊 Total documents reported by index: ${searchResults.count ?? 'unknown'}`);

  for await (const result of searchResults.results) {
    allDocuments.push(result.document);

    if (limit !== null && allDocuments.length >= limit) {
      break;
    }

    if (allDocuments.length % BATCH_LOG_INTERVAL === 0) {
      console.log(`   Read ${allDocuments.length} documents so far...`);
    }
  }

  console.log(`✅ Finished reading — ${allDocuments.length} document(s) collected`);

  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'extractDocuments',
      detail: { totalCollected: allDocuments.length, limit }
    }
  }));

  return allDocuments;
}

/**
 * Streams all documents from the index directly to a JSON file.
 * Writes a valid JSON array without holding the full dataset in memory.
 * @param {SearchClient} searchClient
 * @param {string} outputPath
 * @returns {Promise<number>} Number of documents written
 */
async function streamDocumentsToFile(searchClient, outputPath) {
  console.log('📥 Streaming documents from index to output file...');

  let documentCount = 0;
  const stream = fs.createWriteStream(outputPath, { encoding: 'utf8' });

  const safeWrite = async (content) => {
    if (!stream.write(content)) {
      await once(stream, 'drain');
    }
  };

  try {
    await safeWrite('[\n');

    const searchResults = await searchClient.search('*', {
      select: ['*'],
      includeTotalCount: true
    });

    console.log(`📊 Total documents reported by index: ${searchResults.count ?? 'unknown'}`);

    for await (const result of searchResults.results) {
      const serializedDocument = JSON.stringify(result.document);

      if (documentCount > 0) {
        await safeWrite(',\n');
      }

      await safeWrite(serializedDocument);
      documentCount++;

      if (documentCount % BATCH_LOG_INTERVAL === 0) {
        console.log(`   Streamed ${documentCount} documents so far...`);
      }
    }

    await safeWrite('\n]\n');
    stream.end();
    await once(stream, 'finish');

    console.log(`✅ Finished streaming — ${documentCount} document(s) written`);

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'streamDocumentsToFile',
        detail: { outputPath, documentCount }
      }
    }));

    return documentCount;
  } catch (error) {
    stream.destroy();
    throw error;
  }
}

/**
 * Streams all documents from the index directly to a JSONL file.
 * @param {SearchClient} searchClient
 * @param {string} outputPath
 * @returns {Promise<number>} Number of documents written
 */
async function streamDocumentsToJsonLinesFile(searchClient, outputPath) {
  console.log('📥 Streaming documents from index to JSONL output file...');

  let documentCount = 0;
  const stream = fs.createWriteStream(outputPath, { encoding: 'utf8' });

  const safeWrite = async (content) => {
    if (!stream.write(content)) {
      await once(stream, 'drain');
    }
  };

  try {
    const searchResults = await searchClient.search('*', {
      select: ['*'],
      includeTotalCount: true
    });

    console.log(`📊 Total documents reported by index: ${searchResults.count ?? 'unknown'}`);

    for await (const result of searchResults.results) {
      await safeWrite(`${JSON.stringify(result.document)}\n`);
      documentCount++;

      if (documentCount % BATCH_LOG_INTERVAL === 0) {
        console.log(`   Streamed ${documentCount} documents so far...`);
      }
    }

    stream.end();
    await once(stream, 'finish');

    console.log(`✅ Finished streaming — ${documentCount} document(s) written`);

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'streamDocumentsToJsonLinesFile',
        detail: { outputPath, documentCount }
      }
    }));

    return documentCount;
  } catch (error) {
    stream.destroy();
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

async function writeOutputFile(indexName, documents) {
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const fileName = `${indexName}-extract-${timestamp}.json`;
  const outputPath = path.join(__dirname, fileName);

  const json = JSON.stringify(documents, null, 2);
  await fsPromises.writeFile(outputPath, json, 'utf8');

  console.log(`\n💾 Output written to: ${outputPath}`);
  console.log(`📦 Documents: ${documents.length}`);
  console.log(`📏 File size: ${(Buffer.byteLength(json, 'utf8') / 1024).toFixed(1)} KB`);

  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'writeOutputFile',
      detail: { outputPath, documentCount: documents.length, sizeBytes: Buffer.byteLength(json, 'utf8') }
    }
  }));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { indexName, dryRun, format } = parseArgs();
  let indexClient;
  let vectorFieldNames = [];
  let retrievableSetupComplete = false;

  console.log('\n' + '='.repeat(80));
  console.log('🔍 Azure AI Search Index Extraction');
  console.log('='.repeat(80));

  try {
    await setProcessEnvironment();

    const envName = process.env['envName'];
    console.log(`📋 Environment : ${envName}`);
    console.log(`🗂️  Index       : ${indexName}`);
    console.log(`🧾 Format      : ${format}`);
    console.log(`🧪 Mode        : ${dryRun ? 'DRY RUN (first 5 documents, no file written)' : 'FULL EXTRACTION'}\n`);

    indexClient = getSearchIndexClient();
    const retrievableResult = await makeVectorFieldsRetrievable(indexClient, indexName);
    vectorFieldNames = retrievableResult.vectorFieldNames;
    retrievableSetupComplete = true;

    const searchClient = getSearchClient(indexName);

    if (dryRun) {
      // -----------------------------------------------------------------------
      // Dry-run: read up to 5 docs, log to console only
      // -----------------------------------------------------------------------
      const documents = await extractDocuments(searchClient, 5);

      console.log('\n' + '='.repeat(80));
      console.log('📄 DRY RUN — First 5 Documents');
      console.log('='.repeat(80));
      documents.forEach((doc, i) => {
        console.log(`\n--- Document ${i + 1} ---`);
        console.log(JSON.stringify(doc, null, 2));
      });
      console.log('\n' + '='.repeat(80));
      console.log('💡 No file written in dry-run mode.');
      console.log('💡 Run without --dry-run to extract all documents to a JSON file.\n');
    } else {
      // -----------------------------------------------------------------------
      // Full extraction: stream all docs directly to file
      // -----------------------------------------------------------------------
      const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
      const fileExtension = format === 'jsonl' ? 'jsonl' : 'json';
      const fileName = `${indexName}-extract-${timestamp}.${fileExtension}`;
      const outputPath = path.join(__dirname, fileName);

      const documentCount = format === 'jsonl'
        ? await streamDocumentsToJsonLinesFile(searchClient, outputPath)
        : await streamDocumentsToFile(searchClient, outputPath);

      if (documentCount === 0) {
        console.warn('\n⚠️  No documents found in index — output file contains an empty array.');
      }

      const fileStats = await fsPromises.stat(outputPath);
      console.log(`\n💾 Output written to: ${outputPath}`);
      console.log(`📦 Documents: ${documentCount}`);
      console.log(`📏 File size: ${(fileStats.size / 1024).toFixed(1)} KB`);

      console.log(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'writeOutputFileStreamed',
          detail: { outputPath, documentCount, sizeBytes: fileStats.size }
        }
      }));

      console.log('\n✅ Extraction complete.\n');
    }
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'extractAISearchIndex',
        detail: { indexName, error: error.message, stack: error.stack }
      }
    }));
    console.error(`\n❌ Extraction failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (indexClient && retrievableSetupComplete && vectorFieldNames.length > 0) {
      try {
        await makeVectorFieldsNonRetrievable(indexClient, indexName, vectorFieldNames);
      } catch (restoreError) {
        console.error(JSON.stringify({
          kpmsg: {
            id: 'AI_PORTAL_NOTEBOOK',
            name: 'restoreVectorFieldsAfterExtraction',
            detail: { indexName, vectorFieldNames, error: restoreError.message }
          }
        }));
        console.error(`⚠️  Failed to restore vector fields to non-retrievable: ${restoreError.message}`);
      }
    }
  }
}

main();
