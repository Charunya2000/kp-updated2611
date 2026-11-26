import { deleteFirstPrinciplesArtifactsByConversationId } from '../../app/services/langgraphs/compliance/docConversation1stPriCleanupService.js';

function parseArgs(argv = []) {
  const args = argv.slice(2);

  const idPos = args.indexOf('--conversation-id');
  const conversationId = idPos >= 0 ? String(args[idPos + 1] || '').trim() : '';

  const dryRun = args.includes('--dry-run');
  const execute = args.includes('--execute');

  const pageSizePos = args.indexOf('--page-size');
  const pageSize = pageSizePos >= 0 ? Number(args[pageSizePos + 1]) : 1000;

  const batchPos = args.indexOf('--delete-batch-size');
  const deleteBatchSize = batchPos >= 0 ? Number(args[batchPos + 1]) : 500;

  if (!conversationId) {
    throw new Error('Missing required argument: --conversation-id <id>');
  }

  if (!dryRun && !execute) {
    throw new Error('Specify one mode: --dry-run or --execute');
  }

  if (dryRun && execute) {
    throw new Error('Use either --dry-run or --execute, not both');
  }

  return {
    conversationId,
    dryRun,
    execute,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 1000,
    deleteBatchSize: Number.isFinite(deleteBatchSize) && deleteBatchSize > 0 ? Math.floor(deleteBatchSize) : 500,
  };
}

function createMockSearchClient(indexName, conversationId) {
  const fixtureIds = {
    'compliance-chunks-v1': [
      `chunk-${conversationId}-001`,
      `chunk-${conversationId}-002`,
    ],
    'compliance-requirements-v1': [
      `req-${conversationId}-001`,
      `req-${conversationId}-002`,
      `req-${conversationId}-003`,
    ],
  };

  const ids = fixtureIds[indexName] || [];

  return {
    async search() {
      return {
        results: (async function* generateResults() {
          for (const id of ids) {
            yield { document: { id } };
          }
        })(),
      };
    },
  };
}

function createMockUpdateClient(indexName, recorder) {
  return {
    async deleteDocuments(docs = []) {
      recorder[indexName] = recorder[indexName] || [];
      recorder[indexName].push(...docs.map((doc) => doc.id));
      return { statusCode: 200, deleted: docs.length };
    },
  };
}

function createMockDeps(conversationId) {
  const deleteRecorder = {};

  return {
    getSearchClient(indexName) {
      return createMockSearchClient(indexName, conversationId);
    },
    getUpdateClient(indexName) {
      return createMockUpdateClient(indexName, deleteRecorder);
    },
    logEvent(name, detail) {
      console.log(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name,
          detail,
        }
      }));
    },
    getDeleteRecorder() {
      return deleteRecorder;
    },
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const deps = createMockDeps(args.conversationId);

  const summary = await deleteFirstPrinciplesArtifactsByConversationId({
    conversationId: args.conversationId,
    options: {
      dryRun: args.dryRun,
      pageSize: args.pageSize,
      deleteBatchSize: args.deleteBatchSize,
      chunkIndexName: 'compliance-chunks-v1',
      requirementIndexName: 'compliance-requirements-v1',
    },
  }, deps);

  console.log('\nFirst-principles cleanup summary');
  console.log(JSON.stringify({
    ...summary,
    mockDeleteRecorder: deps.getDeleteRecorder(),
  }, null, 2));
}

main().catch((error) => {
  console.error('First-principles cleanup script failed:', error?.message || String(error));
  process.exitCode = 1;
});
