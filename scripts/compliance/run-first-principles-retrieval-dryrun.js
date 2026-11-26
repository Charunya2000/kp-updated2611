import {
  retrieveChunkArtifacts,
  retrieveRequirementArtifacts,
  fuseHybridRetrievalResults,
  reconstructCitationsFromResults,
} from '../../app/services/langgraphs/compliance/docConversation1stPriRetrievalService.js';

function parseArgs(argv = []) {
  const args = argv.slice(2);

  const conversationPos = args.indexOf('--conversation-id');
  const conversationId = conversationPos >= 0 ? String(args[conversationPos + 1] || '').trim() : 'fixture-conversation-001';

  const queryPos = args.indexOf('--query');
  const query = queryPos >= 0 ? String(args[queryPos + 1] || '').trim() : 'Second Level Complaint Process';

  const topPos = args.indexOf('--top');
  const top = topPos >= 0 ? Number(args[topPos + 1]) : 10;

  return {
    conversationId,
    query,
    top: Number.isFinite(top) && top > 0 ? Math.floor(top) : 10,
  };
}

function createMockSearchClient(indexName, conversationId) {
  const chunkDocs = [
    {
      id: 'chunk-001',
      conversation_id: conversationId,
      file_name: 'CHIP Procedures Handbook Dec 2018.pdf',
      heading: '7.2.2. Second Level Complaint Process',
      section_number: '7.2.2',
      content: 'The MCO must permit a second level complaint and complete review within forty five (45) calendar days.',
      page_start: 91,
      page_end: 92,
      char_start: 2000,
      char_end: 2600,
      '@search.score': 11.2,
    },
    {
      id: 'chunk-002',
      conversation_id: conversationId,
      file_name: 'CHIP Procedures Handbook Dec 2018.pdf',
      heading: '7.2.3. External Complaint Process',
      section_number: '7.2.3',
      content: 'The MCO must transmit complaint review records to the requesting department.',
      page_start: 93,
      page_end: 93,
      char_start: 2601,
      char_end: 3000,
      '@search.score': 9.8,
    },
  ];

  const reqDocs = [
    {
      id: 'req-001',
      requirement_key: 'chunk-001:1',
      conversation_id: conversationId,
      file_name: 'CHIP Procedures Handbook Dec 2018.pdf',
      heading: '7.2.2. Second Level Complaint Process',
      section_number: '7.2.2',
      requirement_text: 'The MCO must permit an enrollee to file a second level complaint.',
      category: 'review-governance',
      modality: 'must',
      page_start: 91,
      page_end: 91,
      char_start: 2100,
      char_end: 2300,
      source_chunk_id: 'chunk-001',
      '@search.score': 12.1,
    },
    {
      id: 'req-002',
      requirement_key: 'chunk-001:2',
      conversation_id: conversationId,
      file_name: 'CHIP Procedures Handbook Dec 2018.pdf',
      heading: '7.2.2. Second Level Complaint Process',
      section_number: '7.2.2',
      requirement_text: 'The MCO must send written notice of decision within forty five (45) calendar days.',
      category: 'timeline',
      modality: 'must',
      page_start: 93,
      page_end: 93,
      char_start: 2400,
      char_end: 2550,
      source_chunk_id: 'chunk-001',
      '@search.score': 11.5,
    },
  ];

  const docs = indexName === 'compliance-requirements-v1' ? reqDocs : chunkDocs;

  return {
    async search() {
      return {
        results: (async function* generate() {
          for (const document of docs) {
            yield { document };
          }
        })(),
      };
    },
  };
}

function createMockDeps(conversationId) {
  return {
    getSearchClient(indexName) {
      return createMockSearchClient(indexName, conversationId);
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
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const deps = createMockDeps(args.conversationId);

  const requirement = await retrieveRequirementArtifacts({
    conversationId: args.conversationId,
    query: {
      searchText: args.query,
      top: args.top,
    },
  }, deps);

  const chunks = await retrieveChunkArtifacts({
    conversationId: args.conversationId,
    query: {
      searchText: args.query,
      top: args.top,
    },
  }, deps);

  const fused = fuseHybridRetrievalResults({
    requirementResults: requirement.results,
    chunkResults: chunks.results,
    options: {
      rrfK: 60,
      requirementWeight: 1.2,
      chunkWeight: 1.0,
    },
  });

  const citations = reconstructCitationsFromResults(fused, {
    includeOffsets: true,
    includeSection: true,
  });

  console.log('\nFirst-principles retrieval dry-run summary');
  console.log(JSON.stringify({
    conversationId: args.conversationId,
    query: args.query,
    requirementResultCount: requirement.results.length,
    chunkResultCount: chunks.results.length,
    fusedResultCount: fused.length,
    topCitations: citations.slice(0, 5),
  }, null, 2));
}

main().catch((error) => {
  console.error('First-principles retrieval dry-run failed:', error?.message || String(error));
  process.exitCode = 1;
});
