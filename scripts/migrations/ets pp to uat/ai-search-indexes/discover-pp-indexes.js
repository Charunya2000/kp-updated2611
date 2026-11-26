/**
 * Azure AI Search - PP Index Discovery Script
 * 
 * Purpose:
 *   Discover all indexes in the PP (pre-prod) Azure AI Search instance,
 *   list those with more than 0 documents, and retrieve a sample document
 *   from each.
 * 
 * Required environment variables (.env.local):
 *   KPCONFIG_PROFILE  - KP Config profile (set automatically to 'genai-port-client-pp')
 *
 *   The following are loaded at runtime by KP Config (via setProcessEnvironment):
 *     host.<env>-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint   - PP Azure AI Search endpoint
 *     host.<env>-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.api.key - PP Azure AI Search API key
 * 
 * Usage:
 *   node "scripts/migrations/ets pp to uat/ai-search-indexes/discover-pp-indexes.js"
 * 
 *   Options:
 *     --save   Save the full results (index list + sample docs) to a JSON file
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

/**
 * Initialize the Azure Search Index Client for PP
 */
function getSearchIndexClient(searchEndpoint, searchAPIKey) {
  return new SearchIndexClient(
    searchEndpoint,
    new AzureKeyCredential(searchAPIKey)
  );
}

/**
 * Get a SearchClient for a specific index
 */
function getSearchClient(searchEndpoint, searchAPIKey, indexName) {
  return new SearchClient(
    searchEndpoint,
    indexName,
    new AzureKeyCredential(searchAPIKey)
  );
}

/**
 * List all indexes and return their names and document counts
 */
async function listAllIndexes(indexClient) {
  try {
    console.log('📋 Listing all indexes...\n');

    const indexes = [];

    for await (const index of indexClient.listIndexes()) {
      indexes.push({
        name: index.name,
        fields: index.fields.map(f => f.name)
      });
    }

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'listAllIndexes',
        detail: { totalIndexes: indexes.length }
      }
    }));

    return indexes;
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'listAllIndexes',
        detail: { error: error.message }
      }
    }));
    throw error;
  }
}

/**
 * Get the document count for a specific index
 */
async function getDocumentCount(searchClient, indexName) {
  try {
    const countResult = await searchClient.search('*', {
      top: 0,
      includeTotalCount: true
    });

    const count = countResult.count ?? 0;
    return count;
  } catch (error) {
    console.error(`   ⚠️  Error getting count for index "${indexName}": ${error.message}`);
    return -1;
  }
}

/**
 * Get a single sample document from an index (excludes vector fields for readability)
 */
async function getSampleDocument(searchClient, indexName, fields) {
  try {
    // Exclude vector fields from the sample for readability
    const nonVectorFields = fields.filter(f => !f.toLowerCase().includes('vector'));
    const selectFields = nonVectorFields.length > 0 ? nonVectorFields : undefined;

    const searchOptions = {
      top: 1,
      includeTotalCount: false
    };

    if (selectFields) {
      searchOptions.select = selectFields;
    }

    const searchResults = await searchClient.search('*', searchOptions);

    for await (const result of searchResults.results) {
      return result.document;
    }

    return null;
  } catch (error) {
    console.error(`   ⚠️  Error getting sample doc for index "${indexName}": ${error.message}`);
    return null;
  }
}

/**
 * Truncate long string values for display purposes
 */
function truncateForDisplay(obj, maxLength = 200) {
  if (!obj || typeof obj !== 'object') return obj;

  const truncated = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && value.length > maxLength) {
      truncated[key] = value.substring(0, maxLength) + `... [${value.length} chars total]`;
    } else if (Array.isArray(value)) {
      truncated[key] = `[Array with ${value.length} items]`;
    } else if (typeof value === 'object' && value !== null) {
      truncated[key] = truncateForDisplay(value, maxLength);
    } else {
      truncated[key] = value;
    }
  }
  return truncated;
}

/**
 * Main execution
 */
async function main() {
  const saveToFile = process.argv.includes('--save');

  console.log('='.repeat(80));
  console.log('🔍 Azure AI Search - PP Index Discovery');
  console.log('='.repeat(80) + '\n');

  try {
    // Ensure PP
    process.env.KPCONFIG_PROFILE = 'genai-port-client-pp';

    // Load configuration from KP Config
    await setProcessEnvironment();

    const envName = 'pp'; // We are specifically targeting PP environment for this discovery
    console.log(`📋 Environment: ${envName}`);

    if (envName !== 'pp') {
      console.warn(`⚠️  WARNING: Expected environment 'pp' (pre-prod), but got '${envName}'`);
      console.warn('⚠️  Make sure KPCONFIG_PROFILE=genai-port-client-pp in .env.local\n');
    }

    // Get PP credentials
    const ppSearchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
    const ppSearchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.api.key`];

    if (!ppSearchEndpoint || !ppSearchAPIKey) {
      throw new Error(`Missing Azure Search configuration for environment: ${envName}`);
    }

    console.log(`🔑 Search Endpoint: ${ppSearchEndpoint}\n`);

    // Initialize Index Client
    const indexClient = getSearchIndexClient(ppSearchEndpoint, ppSearchAPIKey);

    // Step 1: List all indexes
    const allIndexes = await listAllIndexes(indexClient);
    console.log(`📊 Found ${allIndexes.length} total indexes\n`);

    // Step 2: Get document counts and filter for non-empty indexes
    console.log('='.repeat(80));
    console.log('📊 Checking document counts...');
    console.log('='.repeat(80) + '\n');

    const indexResults = [];

    for (const index of allIndexes) {
      const searchClient = getSearchClient(ppSearchEndpoint, ppSearchAPIKey, index.name);
      const docCount = await getDocumentCount(searchClient, index.name);

      const status = docCount > 0 ? '✅' : '⬜';
      console.log(`   ${status} ${index.name.padEnd(40)} ${docCount} documents`);

      indexResults.push({
        name: index.name,
        documentCount: docCount,
        fieldCount: index.fields.length,
        fields: index.fields
      });
    }

    // Filter to non-empty indexes
    const nonEmptyIndexes = indexResults.filter(i => i.documentCount > 0);

    console.log(`\n📊 ${nonEmptyIndexes.length} indexes with documents (out of ${allIndexes.length} total)\n`);

    // Step 3: Get sample document from each non-empty index
    console.log('='.repeat(80));
    console.log('📄 Retrieving sample documents from non-empty indexes...');
    console.log('='.repeat(80) + '\n');

    const fullResults = [];

    for (const index of nonEmptyIndexes) {
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`📌 Index: ${index.name}`);
      console.log(`   Documents: ${index.documentCount}`);
      console.log(`   Fields (${index.fieldCount}): ${index.fields.join(', ')}`);

      const searchClient = getSearchClient(ppSearchEndpoint, ppSearchAPIKey, index.name);
      const sampleDoc = await getSampleDocument(searchClient, index.name, index.fields);

      if (sampleDoc) {
        console.log(`   Sample Document (truncated):`);
        const truncated = truncateForDisplay(sampleDoc);
        console.log(JSON.stringify(truncated, null, 4).split('\n').map(l => `   ${l}`).join('\n'));
      } else {
        console.log('   ⚠️  Could not retrieve sample document');
      }

      fullResults.push({
        indexName: index.name,
        documentCount: index.documentCount,
        fieldCount: index.fieldCount,
        fields: index.fields,
        sampleDocument: sampleDoc
      });
    }

    // Summary
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('📊 SUMMARY - Non-Empty PP Indexes');
    console.log('='.repeat(80));
    console.log(`${'Index Name'.padEnd(45)} ${'Docs'.padStart(10)} ${'Fields'.padStart(8)}`);
    console.log('─'.repeat(65));

    for (const result of fullResults) {
      console.log(`${result.indexName.padEnd(45)} ${String(result.documentCount).padStart(10)} ${String(result.fieldCount).padStart(8)}`);
    }

    console.log('─'.repeat(65));
    console.log(`Total: ${fullResults.length} non-empty indexes`);
    console.log('='.repeat(80));

    // Optionally save to file
    if (saveToFile) {
      const outputPath = path.join(__dirname, `pp-index-discovery-${new Date().toISOString().replace(/:/g, '-').split('.')[0]}.json`);

      await fs.writeFile(outputPath, JSON.stringify({
        discoveredAt: new Date().toISOString(),
        environment: envName,
        searchEndpoint: ppSearchEndpoint,
        totalIndexes: allIndexes.length,
        nonEmptyIndexes: fullResults.length,
        indexes: fullResults
      }, null, 2), 'utf8');

      console.log(`\n💾 Full results saved to: ${outputPath}`);
    } else {
      console.log(`\n💡 Tip: Run with --save to save full results (including complete sample documents) to a JSON file`);
    }

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'discoverPPIndexes',
        detail: {
          environment: envName,
          totalIndexes: allIndexes.length,
          nonEmptyIndexes: fullResults.length,
          indexNames: fullResults.map(r => r.indexName)
        }
      }
    }));

  } catch (error) {
    console.error('\n❌ Error during discovery:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'discoverPPIndexes',
        detail: { error: error.message, stack: error.stack }
      }
    }));

    process.exit(1);
  }
}

// Execute
main();
