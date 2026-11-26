/**
 * MongoDB Collection Index Extraction Script
 *
 * Reads index definitions from a specified database/collection and writes
 * them to a JSONL file (one JSON document per line).
 *
 * Usage:
 *   node scripts/mongo/extract-mongo-indexes.js --database <databaseName> --collection <collectionName>
 *   node scripts/mongo/extract-mongo-indexes.js --database <databaseName> --collection <collectionName> --dry-run
 *   node scripts/mongo/extract-mongo-indexes.js --database <databaseName> --collection <collectionName> --output <filePath>
 *
 * Output:
 *   <databaseName>-<collectionName>-indexes-<timestamp>.jsonl
 *   (written next to this script unless --output is provided)
 */

import dotenv from 'dotenv';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { once } from 'events';
import { MongoClient } from 'mongodb';
import { setProcessEnvironment } from '../configActions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const BATCH_LOG_INTERVAL = 25;
const PREVIEW_LIMIT = 5;

function printUsage() {
  console.error('\nUsage:');
  console.error('  node scripts/extract-mongo-indexes.js --database <databaseName> --collection <collectionName> [--dry-run] [--output <filePath>]');
  console.error('\nOptions:');
  console.error('  --database <name>     (required) MongoDB database name');
  console.error('  --collection <name>   (required) MongoDB collection name');
  console.error('  --dry-run             (optional) Log first 5 indexes only; do not write a file');
  console.error('  --output <filePath>   (optional) Output file path for .jsonl');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const databaseFlagPos = args.indexOf('--database');
  const collectionFlagPos = args.indexOf('--collection');
  const outputFlagPos = args.indexOf('--output');

  const databaseName = databaseFlagPos >= 0 ? args[databaseFlagPos + 1] : null;
  const collectionName = collectionFlagPos >= 0 ? args[collectionFlagPos + 1] : null;
  const outputPathArg = outputFlagPos >= 0 ? args[outputFlagPos + 1] : null;

  if (!databaseName || !collectionName) {
    console.error('Missing required arguments: --database <databaseName> and --collection <collectionName>');
    printUsage();
    process.exit(1);
  }

  return {
    databaseName,
    collectionName,
    outputPathArg,
    dryRun
  };
}

function getMongoEndpoint() {
  const envName = process.env.envName;
  const mongoEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.mongodb.endpoint`];

  if (!envName || !mongoEndpoint) {
    throw new Error('Missing MongoDB configuration in environment variables.');
  }

  return { envName, mongoEndpoint };
}

async function ensureCollectionExists(db, collectionName) {
  const collections = await db.listCollections({ name: collectionName }, { nameOnly: true }).toArray();
  return collections.some((collection) => collection.name === collectionName);
}

function buildIndexExportRecord(databaseName, collectionName, indexSpec) {
  const { key, name, ns, v, ...options } = indexSpec;

  return {
    databaseName,
    collectionName,
    extractedAt: new Date().toISOString(),
    name,
    key,
    options,
    rawIndexSpec: indexSpec
  };
}

async function streamIndexesToJsonl(db, databaseName, collectionName, outputPath) {
  console.log('Streaming indexes from MongoDB collection to JSONL file...');

  const stream = fs.createWriteStream(outputPath, { encoding: 'utf8' });
  let indexCount = 0;

  const safeWrite = async (content) => {
    if (!stream.write(content)) {
      await once(stream, 'drain');
    }
  };

  try {
    const collection = db.collection(collectionName);
    const cursor = collection.listIndexes();

    for await (const indexSpec of cursor) {
      const indexRecord = buildIndexExportRecord(databaseName, collectionName, indexSpec);
      await safeWrite(`${JSON.stringify(indexRecord)}\n`);
      indexCount++;

      if (indexCount % BATCH_LOG_INTERVAL === 0) {
        console.log(`  Streamed ${indexCount} index(es) so far...`);
      }
    }

    stream.end();
    await once(stream, 'finish');

    console.log(`Finished streaming ${indexCount} index(es).`);

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'streamMongoIndexesToJsonl',
        detail: { databaseName, collectionName, outputPath, indexCount }
      }
    }));

    return indexCount;
  } catch (error) {
    stream.destroy();
    throw error;
  }
}

async function previewIndexes(db, databaseName, collectionName, limit = PREVIEW_LIMIT) {
  const collection = db.collection(collectionName);
  const cursor = collection.listIndexes();

  const preview = [];
  let totalIndexes = 0;

  for await (const indexSpec of cursor) {
    totalIndexes++;

    if (preview.length < limit) {
      preview.push(buildIndexExportRecord(databaseName, collectionName, indexSpec));
    }
  }

  return { preview, totalIndexes };
}

async function main() {
  const { databaseName, collectionName, outputPathArg, dryRun } = parseArgs();
  let client;

  console.log('\n' + '='.repeat(80));
  console.log('MongoDB Collection Index Extraction');
  console.log('='.repeat(80));

  try {
    await setProcessEnvironment();
    const { envName, mongoEndpoint } = getMongoEndpoint();

    console.log(`Environment : ${envName}`);
    console.log(`Database    : ${databaseName}`);
    console.log(`Collection  : ${collectionName}`);
    console.log(`Mode        : ${dryRun ? 'DRY RUN (first 5 indexes, no file written)' : 'FULL EXTRACTION'}`);

    client = await MongoClient.connect(mongoEndpoint);
    const db = client.db(databaseName);

    const collectionExists = await ensureCollectionExists(db, collectionName);
    if (!collectionExists) {
      throw new Error(`Collection not found: ${databaseName}.${collectionName}`);
    }

    if (dryRun) {
      const { preview, totalIndexes } = await previewIndexes(db, databaseName, collectionName, PREVIEW_LIMIT);

      console.log('\n' + '='.repeat(80));
      console.log(`DRY RUN - First ${Math.min(PREVIEW_LIMIT, preview.length)} Index(es)`);
      console.log('='.repeat(80));
      preview.forEach((indexRecord, i) => {
        console.log(`\n--- Index ${i + 1} ---`);
        console.log(JSON.stringify(indexRecord, null, 2));
      });
      console.log('\n' + '='.repeat(80));
      console.log(`Total indexes found: ${totalIndexes}`);
      console.log('No file written in dry-run mode.');
      console.log('Run without --dry-run to extract all indexes to a JSONL file.\n');

      console.log(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'extractMongoIndexesDryRun',
          detail: { databaseName, collectionName, totalIndexes, previewCount: preview.length }
        }
      }));

      return;
    }

    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const outputPath = outputPathArg
      ? path.resolve(process.cwd(), outputPathArg)
      : path.join(__dirname, `${databaseName}-${collectionName}-indexes-${timestamp}.jsonl`);

    console.log(`Output file : ${outputPath}\n`);

    await fsPromises.mkdir(path.dirname(outputPath), { recursive: true });

    const indexCount = await streamIndexesToJsonl(db, databaseName, collectionName, outputPath);
    const fileStats = await fsPromises.stat(outputPath);

    console.log(`\nOutput written to: ${outputPath}`);
    console.log(`Indexes: ${indexCount}`);
    console.log(`File size: ${(fileStats.size / 1024).toFixed(1)} KB`);

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'extractMongoIndexes',
        detail: {
          envName,
          databaseName,
          collectionName,
          outputPath,
          indexCount,
          sizeBytes: fileStats.size
        }
      }
    }));

    console.log('\nExtraction complete.\n');
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'extractMongoIndexesError',
        detail: {
          databaseName,
          collectionName,
          error: error.message,
          stack: error.stack
        }
      }
    }));
    console.error(`\nExtraction failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

main();
