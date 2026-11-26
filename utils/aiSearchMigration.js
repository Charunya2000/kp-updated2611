/**
 * Azure AI Search Vector Index Migration Utility
 * 
 * Exports vector index data from one Azure AI Search instance
 * and imports it into another with identical index schema.
 * 
 * Usage:
 *   node utils/aiSearchMigration.js export <indexName> <outputFile>
 *   node utils/aiSearchMigration.js import <indexName> <inputFile>
 *   node utils/aiSearchMigration.js validate <indexName> <exportFile>
 * 
 * Environment Variables:
 *   SOURCE_SEARCH_ENDPOINT: Source Azure AI Search endpoint
 *   SOURCE_SEARCH_KEY: Source Azure AI Search admin key
 *   TARGET_SEARCH_ENDPOINT: Target Azure AI Search endpoint
 *   TARGET_SEARCH_KEY: Target Azure AI Search admin key
 */

import { SearchClient, SearchIndexClient, AzureKeyCredential } from '@azure/search-documents';
import fs from 'fs';
import path from 'path';

// Configuration
const config = {
  source: {
    endpoint: process.env.SOURCE_SEARCH_ENDPOINT,
    key: process.env.SOURCE_SEARCH_KEY,
  },
  target: {
    endpoint: process.env.TARGET_SEARCH_ENDPOINT,
    key: process.env.TARGET_SEARCH_KEY,
  },
};

// Logging utility with kpmsg format
function log(operation, level, message, detail = {}) {
  const logEntry = {
    kpmsg: {
      id: 'AI_SEARCH_MIGRATION',
      name: operation,
      level,
      timestamp: new Date().toISOString(),
      detail,
    },
  };

  if (level === 'error') {
    console.error(JSON.stringify(logEntry));
  } else {
    console.log(JSON.stringify(logEntry));
  }
}

/**
 * Validate configuration
 */
function validateConfig() {
  const required = [
    'SOURCE_SEARCH_ENDPOINT',
    'SOURCE_SEARCH_KEY',
    'TARGET_SEARCH_ENDPOINT',
    'TARGET_SEARCH_KEY',
  ];

  const missing = required.filter(env => !process.env[env]);

  if (missing.length > 0) {
    console.error('Missing required environment variables:');
    missing.forEach(env => console.error(`  - ${env}`));
    process.exit(1);
  }

  if (!config.source.endpoint || !config.source.key) {
    console.error('Source AI Search credentials not configured');
    process.exit(1);
  }

  if (!config.target.endpoint || !config.target.key) {
    console.error('Target AI Search credentials not configured');
    process.exit(1);
  }
}

/**
 * Create search client for source or target instance
 */
function createSearchClient(instance, indexName) {
  const endpoint = instance === 'source' ? config.source.endpoint : config.target.endpoint;
  const key = instance === 'source' ? config.source.key : config.target.key;
  const credential = new AzureKeyCredential(key);
  return new SearchClient(endpoint, indexName, credential);
}

/**
 * Create index client for source or target instance
 */
function createIndexClient(instance) {
  const endpoint = instance === 'source' ? config.source.endpoint : config.source.endpoint;
  const key = instance === 'source' ? config.source.key : config.source.key;
  const credential = new AzureKeyCredential(key);
  return new SearchIndexClient(endpoint, credential);
}

/**
 * Export documents from source index to JSON file
 */
async function exportIndex(indexName, outputFile, batchSize = 1000) {
  log('export', 'info', `Starting export from index: ${indexName}`, {
    outputFile,
    batchSize,
  });

  try {
    const searchClient = createSearchClient('source', indexName);
    const documents = [];
    let totalExported = 0;

    // Use search with filter=* to get all documents
    const searchResults = await searchClient.search('*', {
      top: batchSize,
      skip: 0,
      includeTotalCount: true,
    });

    const totalDocuments = searchResults.count;
    log('export', 'info', `Total documents in index: ${totalDocuments}`);

    // Iterate through all documents in batches
    for await (const result of searchResults.results) {
      documents.push(result.document);
      totalExported++;

      if (totalExported % batchSize === 0) {
        log('export', 'info', `Exported ${totalExported}/${totalDocuments} documents`);
      }
    }

    // Write to file
    const outputPath = path.resolve(outputFile);
    const exportData = {
      indexName,
      exportDate: new Date().toISOString(),
      documentCount: documents.length,
      documents,
    };

    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));

    log('export', 'info', `Export completed successfully`, {
      documentsExported: totalExported,
      outputFile: outputPath,
      fileSize: `${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`,
    });

    return { success: true, documentsExported: totalExported };
  } catch (error) {
    log('export', 'error', `Export failed: ${error.message}`, {
      indexName,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Import documents into target index from JSON file
 */
async function importIndex(indexName, inputFile, batchSize = 100) {
  log('import', 'info', `Starting import to index: ${indexName}`, {
    inputFile,
    batchSize,
  });

  try {
    const inputPath = path.resolve(inputFile);

    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    const fileContent = fs.readFileSync(inputPath, 'utf-8');
    const exportData = JSON.parse(fileContent);

    if (!exportData.documents || !Array.isArray(exportData.documents)) {
      throw new Error('Invalid export file format: missing documents array');
    }

    const documents = exportData.documents;
    const totalDocuments = documents.length;

    log('import', 'info', `Loaded ${totalDocuments} documents from export file`);

    const searchClient = createSearchClient('target', indexName);
    let totalImported = 0;
    let failedDocuments = [];

    // Upload documents in batches
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, Math.min(i + batchSize, documents.length));

      try {
        const result = await searchClient.uploadDocuments(batch);
        totalImported += result.results.length;

        // Track failed documents
        result.results.forEach((uploadResult, idx) => {
          if (!uploadResult.succeeded) {
            failedDocuments.push({
              documentId: batch[idx].id || idx,
              error: uploadResult.errorMessage,
            });
          }
        });

        log('import', 'info', `Imported batch ${Math.floor(i / batchSize) + 1}`, {
          batchSize: batch.length,
          successCount: result.results.filter(r => r.succeeded).length,
          totalProgress: `${Math.min(totalImported, totalDocuments)}/${totalDocuments}`,
        });
      } catch (batchError) {
        log('import', 'error', `Batch upload failed`, {
          batchNumber: Math.floor(i / batchSize) + 1,
          batchSize: batch.length,
          error: batchError.message,
        });
        throw batchError;
      }
    }

    const importResult = {
      success: failedDocuments.length === 0,
      totalImported,
      totalDocuments,
      failedCount: failedDocuments.length,
      failedDocuments: failedDocuments.length > 0 ? failedDocuments.slice(0, 10) : [],
    };

    log('import', 'info', `Import completed`, importResult);

    return importResult;
  } catch (error) {
    log('import', 'error', `Import failed: ${error.message}`, {
      indexName,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Validate exported data by comparing vector dimensions
 */
async function validateExport(indexName, exportFile) {
  log('validate', 'info', `Starting validation`, { indexName, exportFile });

  try {
    const exportPath = path.resolve(exportFile);

    if (!fs.existsSync(exportPath)) {
      throw new Error(`Export file not found: ${exportPath}`);
    }

    const fileContent = fs.readFileSync(exportPath, 'utf-8');
    const exportData = JSON.parse(fileContent);

    if (!exportData.documents || !Array.isArray(exportData.documents)) {
      throw new Error('Invalid export file format');
    }

    const documents = exportData.documents;

    // Get index schema from source
    const indexClient = createIndexClient('source');
    const index = await indexClient.getIndex(indexName);

    const vectorFields = index.fields.filter(f => f.type.includes('Collection(Edm.Single)'));

    if (vectorFields.length === 0) {
      log('validate', 'warn', `No vector fields found in index: ${indexName}`);
      return { success: true, vectorFields: 0 };
    }

    // Validate vector dimensions in exported documents
    const validationResults = {
      totalDocuments: documents.length,
      vectorFields: vectorFields.map(f => f.name),
      validationErrors: [],
    };

    for (let i = 0; i < Math.min(documents.length, 10); i++) {
      const doc = documents[i];
      vectorFields.forEach(field => {
        const vector = doc[field.name];
        if (!Array.isArray(vector)) {
          validationResults.validationErrors.push({
            documentIndex: i,
            field: field.name,
            issue: 'Vector is not an array',
          });
        } else if (vector.length !== field.dimensions) {
          validationResults.validationErrors.push({
            documentIndex: i,
            field: field.name,
            expectedDimensions: field.dimensions,
            actualDimensions: vector.length,
            issue: 'Vector dimension mismatch',
          });
        }
      });
    }

    validationResults.success = validationResults.validationErrors.length === 0;

    log('validate', 'info', `Validation completed`, validationResults);

    return validationResults;
  } catch (error) {
    log('validate', 'error', `Validation failed: ${error.message}`, {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Main CLI handler
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Azure AI Search Vector Index Migration Utility

Usage:
  node utils/aiSearchMigration.js export <indexName> <outputFile>
  node utils/aiSearchMigration.js import <indexName> <inputFile>
  node utils/aiSearchMigration.js validate <indexName> <exportFile>

Examples:
  node utils/aiSearchMigration.js export my-index ./export.json
  node utils/aiSearchMigration.js import my-index ./export.json
  node utils/aiSearchMigration.js validate my-index ./export.json

Environment Variables Required:
  SOURCE_SEARCH_ENDPOINT
  SOURCE_SEARCH_KEY
  TARGET_SEARCH_ENDPOINT
  TARGET_SEARCH_KEY
    `);
    process.exit(0);
  }

  validateConfig();

  const [command, indexName, filePath] = args;

  try {
    switch (command.toLowerCase()) {
      case 'export':
        if (!indexName || !filePath) {
          console.error('export requires indexName and outputFile');
          process.exit(1);
        }
        await exportIndex(indexName, filePath);
        break;

      case 'import':
        if (!indexName || !filePath) {
          console.error('import requires indexName and inputFile');
          process.exit(1);
        }
        await importIndex(indexName, filePath);
        break;

      case 'validate':
        if (!indexName || !filePath) {
          console.error('validate requires indexName and exportFile');
          process.exit(1);
        }
        await validateExport(indexName, filePath);
        break;

      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    process.exit(1);
  }
}

main();
