import { answerWithFirstPrinciplesConversationEngine } from '../../app/services/langgraphs/compliance/docConversation1stPriConversationEngine.js';

function parseArgs(argv = []) {
  const args = argv.slice(2);

  const conversationPos = args.indexOf('--conversation-id');
  const conversationId = conversationPos >= 0 ? String(args[conversationPos + 1] || '').trim() : 'fixture-conversation-001';

  const queryPos = args.indexOf('--query');
  const query = queryPos >= 0 ? String(args[queryPos + 1] || '').trim() : 'What is required in second level complaint process?';

  return {
    conversationId,
    query,
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
    async generateAnswer({ originalQuestion, evidence = [], citations = [] }) {
      const top = evidence.slice(0, 2).map((item) => item?.document?.requirement_text || item?.document?.content).filter(Boolean);
      const citationText = citations.slice(0, 2).map((item) => item.citation).join(' ');
      return {
        answerText: [
          `Question: ${originalQuestion}`,
          `Grounded summary: ${top.join(' ')}`,
          citationText ? `Citations: ${citationText}` : '',
        ].filter(Boolean).join('\n'),
        modelInfo: {
          provider: 'mock',
          model: 'dryrun-v1',
        },
      };
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

  const result = await answerWithFirstPrinciplesConversationEngine({
    conversationId: args.conversationId,
    userPrompt: args.query,
    options: {
      maxRequirements: 8,
      maxChunks: 8,
      maxEvidence: 6,
      requirementWeight: 1.2,
      chunkWeight: 1.0,
      rrfK: 60,
    },
  }, deps);

  console.log('\nFirst-principles conversation dry-run summary');
  console.log(JSON.stringify({
    conversationId: result.conversationId,
    query: args.query,
    answerPreview: result.answerText,
    metrics: result.metrics,
    indexUsage: result.indexUsage,
    topCitations: result.citations.slice(0, 5),
  }, null, 2));
}

main().catch((error) => {
  console.error('First-principles conversation dry-run failed:', error?.message || String(error));
  process.exitCode = 1;
});
