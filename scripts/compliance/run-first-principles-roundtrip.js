import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { orchestrateFirstPrinciplesSearchPreparation } from '../../app/services/langgraphs/compliance/docConversation1stPriOrchestrator.js';
import {
  deleteFirstPrinciplesArtifactsByConversationId,
  listFirstPrinciplesArtifactsByConversationId,
} from '../../app/services/langgraphs/compliance/docConversation1stPriCleanupService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv = []) {
  const args = argv.slice(2);

  const inputPos = args.indexOf('--input');
  const inputPath = inputPos >= 0 ? String(args[inputPos + 1] || '').trim() : '';

  const idPos = args.indexOf('--conversation-id');
  const conversationIdOverride = idPos >= 0 ? String(args[idPos + 1] || '').trim() : '';

  const silent = args.includes('--silent');

  return {
    inputPath,
    conversationIdOverride,
    silent,
  };
}

function buildDefaultFixture() {
  return {
    conversation: {
      id: 'fixture-conversation-roundtrip-001',
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
          }
        ],
      }
    ],
  };
}

async function loadFixture(inputPath) {
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

function parseConversationFilter(filter = '') {
  const match = String(filter || '').match(/conversation_id\s+eq\s+'((?:[^']|'{2})+)'/i);
  if (!match || !match[1]) return '';
  return match[1].replace(/''/g, "'");
}

function createInMemoryIndexStore() {
  const store = new Map();

  function ensureIndex(indexName) {
    if (!store.has(indexName)) {
      store.set(indexName, new Map());
    }
    return store.get(indexName);
  }

  function getSearchClient(indexName) {
    const index = ensureIndex(indexName);

    return {
      async search(_query, options = {}) {
        const filterConversationId = parseConversationFilter(options?.filter || '');
        const allDocs = Array.from(index.values());
        const filteredDocs = filterConversationId
          ? allDocs.filter((doc) => String(doc?.conversation_id || '') === filterConversationId)
          : allDocs;

        const skip = Number.isFinite(Number(options?.skip)) ? Number(options.skip) : 0;
        const top = Number.isFinite(Number(options?.top)) ? Number(options.top) : filteredDocs.length;
        const selected = Array.isArray(options?.select) ? options.select : [];

        const pagedDocs = filteredDocs.slice(skip, skip + top).map((doc) => {
          if (selected.length === 0) return doc;
          const projected = {};
          for (const field of selected) {
            projected[field] = doc[field];
          }
          return projected;
        });

        return {
          results: (async function* generate() {
            for (const document of pagedDocs) {
              yield { document };
            }
          })(),
        };
      },
    };
  }

  function getUpdateClient(indexName) {
    const index = ensureIndex(indexName);

    return {
      async uploadDocuments(documents = []) {
        for (const document of Array.isArray(documents) ? documents : []) {
          const id = String(document?.id || '').trim();
          if (!id) continue;
          index.set(id, { ...document });
        }
        return { statusCode: 200 };
      },
      async deleteDocuments(documents = []) {
        for (const document of Array.isArray(documents) ? documents : []) {
          const id = String(document?.id || '').trim();
          if (!id) continue;
          index.delete(id);
        }
        return { statusCode: 200 };
      },
    };
  }

  function snapshotCounts() {
    const counts = {};
    for (const [indexName, docs] of store.entries()) {
      counts[indexName] = docs.size;
    }
    return counts;
  }

  return {
    getSearchClient,
    getUpdateClient,
    snapshotCounts,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const fixture = await loadFixture(args.inputPath);

  if (args.conversationIdOverride) {
    fixture.conversation = {
      ...fixture.conversation,
      id: args.conversationIdOverride,
    };
  }

  const conversationId = String(fixture?.conversation?.id || '').trim();
  if (!conversationId) {
    throw new Error('Fixture conversation.id is required.');
  }

  const inMemory = createInMemoryIndexStore();
  const deps = {
    getSearchClient: inMemory.getSearchClient,
    getUpdateClient: inMemory.getUpdateClient,
    logEvent(name, detail) {
      if (args.silent) return;
      console.log(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name,
          detail,
        }
      }));
    },
  };

  const preCleanup = await deleteFirstPrinciplesArtifactsByConversationId({
    conversationId,
    options: {
      dryRun: false,
      chunkIndexName: 'compliance-chunks-v1',
      requirementIndexName: 'compliance-requirements-v1',
    },
  }, deps);

  const writeSummary = await orchestrateFirstPrinciplesSearchPreparation({
    conversation: fixture.conversation,
    sections: fixture.sections,
    options: {
      chunkIndexName: 'compliance-chunks-v1',
      requirementIndexName: 'compliance-requirements-v1',
      strictValidation: true,
      emitLogs: !args.silent,
    },
  }, deps);

  const postWriteListing = await listFirstPrinciplesArtifactsByConversationId({
    conversationId,
    options: {
      chunkIndexName: 'compliance-chunks-v1',
      requirementIndexName: 'compliance-requirements-v1',
    },
  }, deps);

  const postWriteCounts = {
    chunks: postWriteListing.chunkIds.length,
    requirements: postWriteListing.requirementIds.length,
  };

  const finalCleanup = await deleteFirstPrinciplesArtifactsByConversationId({
    conversationId,
    options: {
      dryRun: false,
      chunkIndexName: 'compliance-chunks-v1',
      requirementIndexName: 'compliance-requirements-v1',
    },
  }, deps);

  const postCleanupListing = await listFirstPrinciplesArtifactsByConversationId({
    conversationId,
    options: {
      chunkIndexName: 'compliance-chunks-v1',
      requirementIndexName: 'compliance-requirements-v1',
    },
  }, deps);

  const postCleanupCounts = {
    chunks: postCleanupListing.chunkIds.length,
    requirements: postCleanupListing.requirementIds.length,
  };

  console.log('\nFirst-principles round-trip summary');
  console.log(JSON.stringify({
    conversationId,
    preCleanup,
    writeSummary: {
      artifactMetrics: writeSummary?.artifactMetrics,
      serializationValidation: writeSummary?.serializationValidation,
      writeSummary: writeSummary?.writeSummary,
      durationMs: writeSummary?.durationMs,
    },
    postWriteCounts,
    finalCleanup,
    postCleanupCounts,
    inMemoryIndexCounts: inMemory.snapshotCounts(),
  }, null, 2));
}

main().catch((error) => {
  console.error('First-principles round-trip script failed:', error?.message || String(error));
  process.exitCode = 1;
});
