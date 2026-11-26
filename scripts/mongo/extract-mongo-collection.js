/**
 * MongoDB Collection Extraction Script
 *
 * Reads every document from a specified database/collection and streams the
 * output to a JSONL or BSONL file (one JSON document per line).
 *
 * BSONL format uses MongoDB Extended JSON (v2) which preserves type information
 * (ObjectId, Date, NumberLong, etc.) without needing separate field type config.
 *
 * Usage:
 *   node scripts/mongo/extract-mongo-collection.js --database <databaseName> --collection <collectionName>
 *   node scripts/mongo/extract-mongo-collection.js --database <databaseName> --collection <collectionName> --format jsonl
 *   node scripts/mongo/extract-mongo-collection.js --database <databaseName> --collection <collectionName> --dry-run
 *   node scripts/mongo/extract-mongo-collection.js --database <databaseName> --collection <collectionName> --output <filePath>
 *
 * Formats:
 *   bsonl (default) - MongoDB Extended JSON v2 with type wrappers (e.g. {"$oid": "..."}, {"$date": "..."})
 *   jsonl           - Plain JSON (types like ObjectId/Date are serialized as strings)
 *
 * Output:
 *   <databaseName>-<collectionName>-extract-<timestamp>.bsonl  (or .jsonl with --format jsonl)
 *   (written next to this script unless --output is provided)
 */

import dotenv from 'dotenv';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { once } from 'events';
import { MongoClient } from 'mongodb';
import { EJSON } from 'bson';
import { setProcessEnvironment } from '../configActions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const BATCH_LOG_INTERVAL = 100;

function printUsage() {
  console.error('\nUsage:');
  console.error('  node scripts/mongo/extract-mongo-collection.js --database <databaseName> --collection <collectionName> [--format bsonl|jsonl] [--dry-run] [--output <filePath>]');
  console.error('\nOptions:');
  console.error('  --database <name>     (required) MongoDB database name');
  console.error('  --collection <name>   (required) MongoDB collection name');
  console.error('  --format <format>     (optional) Output format: bsonl (default) or jsonl');
  console.error('  --dry-run             (optional) Log first 5 documents only; do not write a file');
  console.error('  --output <filePath>   (optional) Output file path');
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
  const formatFlagPos = args.indexOf('--format');

  const databaseName = databaseFlagPos >= 0 ? args[databaseFlagPos + 1] : null;
  const collectionName = collectionFlagPos >= 0 ? args[collectionFlagPos + 1] : null;
  const outputPathArg = outputFlagPos >= 0 ? args[outputFlagPos + 1] : null;
  const format = formatFlagPos >= 0 ? args[formatFlagPos + 1] : 'bsonl';

  if (!databaseName || !collectionName) {
    console.error('❌ Missing required arguments: --database <databaseName> and --collection <collectionName>');
    printUsage();
    process.exit(1);
  }

  if (!['bsonl', 'jsonl'].includes(format)) {
    console.error(`❌ Invalid format: ${format}. Must be 'bsonl' or 'jsonl'.`);
    printUsage();
    process.exit(1);
  }

  return {
    databaseName,
    collectionName,
    outputPathArg,
    format,
    dryRun
  };
}

function getMongoEndpoint() {
  const envName = process.env['envName'];
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

async function streamCollectionToJsonl(db, collectionName, outputPath, format = 'bsonl') {
  console.log(`📥 Streaming documents from MongoDB collection to ${format.toUpperCase()} file...`);

  const stream = fs.createWriteStream(outputPath, { encoding: 'utf8' });
  let documentCount = 0;

  const safeWrite = async (content) => {
    if (!stream.write(content)) {
      await once(stream, 'drain');
    }
  };

  const serialize = format === 'bsonl'
    ? (doc) => EJSON.stringify(doc, { relaxed: false })
    : (doc) => JSON.stringify(doc);

  try {
    const collection = db.collection(collectionName);
    const totalCount = await collection.countDocuments();
    console.log(`📊 Total documents reported by collection: ${totalCount}`);

    const cursor = collection.find({});

    for await (const document of cursor) {
      await safeWrite(`${serialize(document)}\n`);
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
        name: 'streamMongoCollectionToJsonl',
        detail: { collectionName, outputPath, documentCount }
      }
    }));

    return documentCount;
  } catch (error) {
    stream.destroy();
    throw error;
  }
}

async function extractDocuments(db, collectionName, limit = null) {
  console.log(`📥 Reading documents from collection${limit ? ` (limit: ${limit})` : ' (all)'}...`);

  const collection = db.collection(collectionName);
  const totalCount = await collection.countDocuments();
  console.log(`📊 Total documents reported by collection: ${totalCount}`);

  const cursor = collection.find({});
  const allDocuments = [];

  for await (const document of cursor) {
    allDocuments.push(document);

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
      name: 'extractMongoDocuments',
      detail: { collectionName, totalCollected: allDocuments.length, limit }
    }
  }));

  return allDocuments;
}

async function main() {
  const { databaseName, collectionName, outputPathArg, format, dryRun } = parseArgs();
  let client;

  console.log('\n' + '='.repeat(80));
  console.log('🔍 MongoDB Collection Extraction');
  console.log('='.repeat(80));

  try {
    await setProcessEnvironment();
    const { envName, mongoEndpoint } = getMongoEndpoint();

    console.log(`📋 Environment : ${envName}`);
    console.log(`🗄️  Database    : ${databaseName}`);
    console.log(`📚 Collection  : ${collectionName}`);
    console.log(`📦 Format      : ${format.toUpperCase()}`);
    console.log(`🧪 Mode        : ${dryRun ? 'DRY RUN (first 5 documents, no file written)' : 'FULL EXTRACTION'}`);

    client = await MongoClient.connect(mongoEndpoint);
    const db = client.db(databaseName);

    const collectionExists = await ensureCollectionExists(db, collectionName);
    if (!collectionExists) {
      throw new Error(`Collection not found: ${databaseName}.${collectionName}`);
    }

    if (dryRun) {
      const documents = await extractDocuments(db, collectionName, 5);

      console.log('\n' + '='.repeat(80));
      console.log('📄 DRY RUN - First 5 Documents');
      console.log('='.repeat(80));
      documents.forEach((doc, i) => {
        console.log(`\n--- Document ${i + 1} ---`);
        console.log(JSON.stringify(doc, null, 2));
      });
      console.log('\n' + '='.repeat(80));
      console.log('💡 No file written in dry-run mode.');
      console.log('💡 Run without --dry-run to extract all documents to a JSONL file.\n');

      return;
    }

    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const outputPath = outputPathArg
      ? path.resolve(process.cwd(), outputPathArg)
      : path.join(__dirname, `${databaseName}-${collectionName}-extract-${timestamp}.${format}`);

    console.log(`💾 Output file : ${outputPath}\n`);

    await fsPromises.mkdir(path.dirname(outputPath), { recursive: true });

    const documentCount = await streamCollectionToJsonl(db, collectionName, outputPath, format);
    const fileStats = await fsPromises.stat(outputPath);

    console.log(`\n💾 Output written to: ${outputPath}`);
    console.log(`📦 Documents: ${documentCount}`);
    console.log(`📏 File size: ${(fileStats.size / 1024).toFixed(1)} KB`);

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'extractMongoCollection',
        detail: {
          envName,
          databaseName,
          collectionName,
          outputPath,
          documentCount,
          sizeBytes: fileStats.size
        }
      }
    }));

    console.log('\n✅ Extraction complete.\n');
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'extractMongoCollectionError',
        detail: {
          databaseName,
          collectionName,
          error: error.message,
          stack: error.stack
        }
      }
    }));
    console.error(`\n❌ Extraction failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

main();