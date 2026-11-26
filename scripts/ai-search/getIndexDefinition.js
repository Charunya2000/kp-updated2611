/**
 * Azure AI Search Index Definition Script
 *
 * Retrieves the JSON definition of an Azure AI Search index (the same content
 * shown in the Azure Portal "Edit JSON" tab) and writes it to a JSON file.
 * Uses the KP Config environment variables loaded by setProcessEnvironment().
 *
 * Usage:
 *   node scripts/ai-search/getIndexDefinition.js --index <indexName> [--dry-run] [--api-version <version>]
 *
 * Output:
 *   <indexName>-definition-<timestamp>.json  (written next to this script)
 *
 * Options:
 *   --index <name>          (required) Name of the Azure AI Search index
 *   --dry-run               (optional) Print the definition to the console; do not write a file
 *   --api-version <version> (optional) Search REST API version (default: 2024-07-01)
 */

import dotenv from 'dotenv';
import path from 'path';
import fsPromises from 'fs/promises';
import { fileURLToPath } from 'url';
import { setProcessEnvironment } from '../configActions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const DEFAULT_API_VERSION = '2024-07-01';

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
    console.error('  node scripts/ai-search/getIndexDefinition.js --index <indexName> [--dry-run] [--api-version <version>]');
    process.exit(1);
  }

  const apiVersionFlagPos = args.indexOf('--api-version');
  const apiVersion = apiVersionFlagPos >= 0 && args[apiVersionFlagPos + 1]
    ? args[apiVersionFlagPos + 1]
    : DEFAULT_API_VERSION;

  return { indexName: args[indexFlagPos + 1], dryRun, apiVersion };
}

// ---------------------------------------------------------------------------
// Azure Search configuration
// ---------------------------------------------------------------------------

function getSearchConfig() {
  const envName = process.env['envName'];
  // Standard Indexes
  const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
  const aiUploadAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.api.key`];
  // T3 Indexes
  // const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint.new.t3`];
  // const aiUploadAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.new.t3.api.key`];

  // Reading an index definition requires an admin key; query keys are rejected.
  if (!searchEndpoint || !aiUploadAPIKey) {
    throw new Error(`Missing Azure Search configuration for environment: ${envName}`);
  }

  return { envName, searchEndpoint, adminKey: aiUploadAPIKey };
}

// ---------------------------------------------------------------------------
// Index definition retrieval
// ---------------------------------------------------------------------------

/**
 * Calls the Search REST API directly so the output matches the portal's raw JSON
 * (the SDK's getIndex returns a remapped model with different property names).
 */
async function getIndexDefinition(indexName, apiVersion) {
  const { envName, searchEndpoint, adminKey } = getSearchConfig();

  const url = new URL(`/indexes('${encodeURIComponent(indexName)}')`, searchEndpoint);
  url.searchParams.set('api-version', apiVersion);

  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'getIndexDefinition',
      detail: { envName, searchEndpoint, indexName, apiVersion }
    }
  }));

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'api-key': adminKey,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed (${response.status} ${response.statusText}): ${body}`);
  }

  return response.json();
}

function pruneEmptyValues(value) {
  if (Array.isArray(value)) {
    return value.map(pruneEmptyValues);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== null && !(Array.isArray(v) && v.length === 0))
        .map(([k, v]) => [k, pruneEmptyValues(v)])
    );
  }

  return value;
}

/**
 * Removes server-assigned metadata (@odata.context, @odata.etag) plus null/empty
 * values so the output can be pasted into another environment's create-index JSON.
 * Nested @odata.type discriminators (e.g. similarity) are kept because they are required.
 */
function toMigrationDefinition(definition) {
  const withoutMetadata = Object.fromEntries(
    Object.entries(definition).filter(([key]) => !key.startsWith('@odata.'))
  );

  return pruneEmptyValues(withoutMetadata);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { indexName, dryRun, apiVersion } = parseArgs();

  console.log('\n' + '='.repeat(80));
  console.log('🔍 Azure AI Search Index Definition');
  console.log('='.repeat(80));

  try {
    await setProcessEnvironment();

    console.log(`📋 Environment : ${process.env['envName']}`);
    console.log(`🗂️  Index       : ${indexName}`);
    console.log(`🔢 API version : ${apiVersion}`);
    console.log(`🧪 Mode        : ${dryRun ? 'DRY RUN (console only, no file written)' : 'WRITE FILE'}\n`);

    const definition = toMigrationDefinition(await getIndexDefinition(indexName, apiVersion));
    const json = JSON.stringify(definition, null, 2);

    if (dryRun) {
      console.log(json);
      console.log('\n💡 No file written in dry-run mode.\n');
      return;
    }

    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const outputPath = path.join(__dirname, `${indexName}-definition-${timestamp}.json`);
    await fsPromises.writeFile(outputPath, json, 'utf8');

    console.log(`💾 Output written to: ${outputPath}`);
    console.log(`📑 Fields: ${definition.fields?.length ?? 0}`);

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'writeIndexDefinition',
        detail: { indexName, outputPath, fieldCount: definition.fields?.length ?? 0 }
      }
    }));

    console.log('\n✅ Index definition extracted.\n');
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'getIndexDefinition',
        detail: { indexName, error: error.message }
      }
    }));
    console.error(`\n❌ Failed to get index definition: ${error.message}`);
    process.exitCode = 1;
  }
}

main();
