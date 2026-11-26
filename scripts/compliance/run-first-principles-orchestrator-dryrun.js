import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { orchestrateFirstPrinciplesSearchPreparation } from '../../app/services/langgraphs/compliance/docConversation1stPriOrchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv = []) {
  const args = argv.slice(2);

  const inputPos = args.indexOf('--input');
  const inputPath = inputPos >= 0 ? args[inputPos + 1] : '';

  const batchSizePos = args.indexOf('--batch-size');
  const batchSize = batchSizePos >= 0 ? Number(args[batchSizePos + 1]) : 100;

  const strictValidation = !args.includes('--no-strict-validation');
  const silent = args.includes('--silent');

  return {
    inputPath: String(inputPath || '').trim(),
    batchSize: Number.isFinite(batchSize) && batchSize > 0 ? Math.floor(batchSize) : 100,
    strictValidation,
    silent,
  };
}

function buildDefaultFixture() {
  return {
    conversation: {
      id: 'fixture-conversation-001',
      fileAName: 'CHIP Procedures Handbook Dec 2018.pdf',
      lob: 'CHIP',
      preparationVersion: '1',
    },
    sections: [
      {
        heading: '7.2. Complaint Requirements',
        startPage: 88,
        startIndex: 1000,
        endIndex: 3000,
        content: 'The MCO must maintain complaint procedures and must notify the enrollee of decisions.',
        subsections: [
          {
            heading: '7.2.2. Second Level Complaint Process',
            startPage: 91,
            startIndex: 2000,
            endIndex: 2600,
            content: 'The MCO must permit a second level complaint and must complete review within forty five (45) calendar days.',
            subsections: [],
          },
        ],
      },
    ],
  };
}

async function loadInputFixture(inputPath) {
  if (!inputPath) return buildDefaultFixture();

  const resolvedPath = path.isAbsolute(inputPath)
    ? inputPath
    : path.resolve(__dirname, inputPath);

  const raw = await fs.readFile(resolvedPath, 'utf8');
  const parsed = JSON.parse(raw);

  return {
    conversation: parsed?.conversation || {},
    sections: Array.isArray(parsed?.sections) ? parsed.sections : [],
  };
}

function createMockClient(indexName) {
  const writtenIds = [];

  return {
    async uploadDocuments(documents = []) {
      const ids = (Array.isArray(documents) ? documents : [])
        .map((doc) => String(doc?.id || '').trim())
        .filter(Boolean);
      writtenIds.push(...ids);
      return {
        statusCode: 200,
        indexName,
        uploadedCount: ids.length,
      };
    },
    getWrittenIds() {
      return [...writtenIds];
    },
  };
}

function createMockDeps({ silent = false } = {}) {
  const clients = new Map();

  return {
    getUpdateClient(indexName) {
      if (!clients.has(indexName)) {
        clients.set(indexName, createMockClient(indexName));
      }
      return clients.get(indexName);
    },
    logEvent(name, detail) {
      if (silent) return;
      console.log(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name,
          detail,
        }
      }));
    },
    getClientWriteCounts() {
      const result = {};
      for (const [indexName, client] of clients.entries()) {
        result[indexName] = client.getWrittenIds().length;
      }
      return result;
    },
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const fixture = await loadInputFixture(args.inputPath);
  const deps = createMockDeps({ silent: args.silent });

  const summary = await orchestrateFirstPrinciplesSearchPreparation({
    conversation: fixture.conversation,
    sections: fixture.sections,
    options: {
      batchSize: args.batchSize,
      strictValidation: args.strictValidation,
      emitLogs: !args.silent,
      chunkIndexName: 'compliance-chunks-v1',
      requirementIndexName: 'compliance-requirements-v1',
    },
  }, deps);

  console.log('\nFirst-principles dry-run summary');
  console.log(JSON.stringify({
    conversationId: summary?.conversationId,
    fileName: summary?.fileName,
    artifactMetrics: summary?.artifactMetrics,
    serializationValidation: summary?.serializationValidation,
    writeCountsByIndex: deps.getClientWriteCounts(),
    durationMs: summary?.durationMs,
  }, null, 2));
}

main().catch((error) => {
  console.error('First-principles dry-run failed:', error?.message || String(error));
  process.exitCode = 1;
});
