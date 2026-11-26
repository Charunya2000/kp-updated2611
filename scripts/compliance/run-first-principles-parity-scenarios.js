import fs from 'node:fs';
import path from 'node:path';
import { answerWithFirstPrinciplesConversationEngine } from '../../app/services/langgraphs/compliance/docConversation1stPriConversationEngine.js';
import { compareWithFirstPrinciplesEngine } from '../../app/services/langgraphs/compliance/docConversation1stPriComparisonEngine.js';

function parseArgs(argv = []) {
  const args = argv.slice(2);
  const fixturePos = args.indexOf('--fixture');
  const fixturePath = fixturePos >= 0
    ? String(args[fixturePos + 1] || '').trim()
    : 'scripts/compliance/fixtures/first-pri-parity-scenarios.json';

  return {
    fixturePath,
  };
}

function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function extractConversationIdFromFilter(filter = '') {
  const match = String(filter || '').match(/conversation_id\s+eq\s+'([^']+)'/i);
  return match ? String(match[1]).trim() : '';
}

function createConversationMockSearchClient(indexName, conversationId) {
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

function getMockRequirementDocsByConversation(conversationId) {
  const docs = {
    'fixture-conversation-a': [
      {
        id: 'a-req-1',
        requirement_key: 'a-1',
        conversation_id: 'fixture-conversation-a',
        file_name: 'Policy-A.pdf',
        heading: '7.2.2. Second Level Complaint Process',
        section_number: '7.2.2',
        requirement_text: 'The MCO must permit an enrollee to file a second level complaint.',
        normalized_actor: 'mco',
        normalized_action: 'permit',
        normalized_object: 'enrollee file second level complaint',
        category: 'review-governance',
        modality: 'must',
        page_start: 91,
        page_end: 91,
        char_start: 2100,
        char_end: 2300,
        source_chunk_id: 'a-chunk-1',
      },
      {
        id: 'a-req-2',
        requirement_key: 'a-2',
        conversation_id: 'fixture-conversation-a',
        file_name: 'Policy-A.pdf',
        heading: '7.2.2. Second Level Complaint Process',
        section_number: '7.2.2',
        requirement_text: 'The MCO must send written notice of decision within forty five calendar days.',
        normalized_actor: 'mco',
        normalized_action: 'send',
        normalized_object: 'written notice of decision',
        category: 'timeline',
        modality: 'must',
        page_start: 93,
        page_end: 93,
        char_start: 2400,
        char_end: 2550,
        source_chunk_id: 'a-chunk-1',
      },
      {
        id: 'a-req-3',
        requirement_key: 'a-3',
        conversation_id: 'fixture-conversation-a',
        file_name: 'Policy-A.pdf',
        heading: '7.2.4. Records',
        section_number: '7.2.4',
        requirement_text: 'The MCO must retain second level complaint records for six years.',
        normalized_actor: 'mco',
        normalized_action: 'retain',
        normalized_object: 'complaint records six years',
        category: 'recordkeeping',
        modality: 'must',
        page_start: 95,
        page_end: 95,
        char_start: 3000,
        char_end: 3180,
        source_chunk_id: 'a-chunk-3',
      },
    ],
    'fixture-conversation-b': [
      {
        id: 'b-req-1',
        requirement_key: 'b-1',
        conversation_id: 'fixture-conversation-b',
        file_name: 'Policy-B.pdf',
        heading: '7.2.2. Secondary Complaint Procedure',
        section_number: '7.2.2',
        requirement_text: 'The MCO must allow members to file a second level complaint.',
        normalized_actor: 'mco',
        normalized_action: 'allow',
        normalized_object: 'members file second level complaint',
        category: 'review-governance',
        modality: 'must',
        page_start: 88,
        page_end: 88,
        char_start: 1200,
        char_end: 1420,
        source_chunk_id: 'b-chunk-1',
      },
      {
        id: 'b-req-2',
        requirement_key: 'b-2',
        conversation_id: 'fixture-conversation-b',
        file_name: 'Policy-B.pdf',
        heading: '7.2.2. Secondary Complaint Procedure',
        section_number: '7.2.2',
        requirement_text: 'The MCO must not issue a written decision before sixty calendar days.',
        normalized_actor: 'mco',
        normalized_action: 'issue',
        normalized_object: 'written decision before sixty calendar days',
        category: 'timeline',
        modality: 'must_not',
        page_start: 89,
        page_end: 89,
        char_start: 1600,
        char_end: 1820,
        source_chunk_id: 'b-chunk-1',
      },
      {
        id: 'b-req-3',
        requirement_key: 'b-3',
        conversation_id: 'fixture-conversation-b',
        file_name: 'Policy-B.pdf',
        heading: '7.2.6. Escalation',
        section_number: '7.2.6',
        requirement_text: 'The MCO must submit unresolved complaints to the state reviewer within ten days.',
        normalized_actor: 'mco',
        normalized_action: 'submit',
        normalized_object: 'unresolved complaints to state reviewer',
        category: 'notification',
        modality: 'must',
        page_start: 97,
        page_end: 97,
        char_start: 3500,
        char_end: 3710,
        source_chunk_id: 'b-chunk-4',
      },
    ],
  };

  return docs[conversationId] || [];
}

function createMockDeps() {
  return {
    getSearchClient(indexName) {
      return {
        async search(_queryText, options = {}) {
          const filterConversationId = extractConversationIdFromFilter(options.filter);
          if (filterConversationId === 'fixture-conversation-001') {
            return createConversationMockSearchClient(indexName, filterConversationId).search(_queryText, options);
          }

          const docs = getMockRequirementDocsByConversation(filterConversationId);
          return {
            results: (async function* generate() {
              for (const document of docs) {
                yield { document };
              }
            })(),
          };
        },
      };
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
      };
    },
    async generateComparisonSummary(result) {
      return {
        text: `Matches=${result.summary.matchCount}; Gaps=${result.summary.gapLeftCount + result.summary.gapRightCount}`,
      };
    },
  };
}

function evaluateConversationScenario(scenario, result) {
  const failures = [];
  const expect = scenario.expect || {};

  if (Number(result?.metrics?.requirementResultCount || 0) < Number(expect.minRequirementResults || 0)) {
    failures.push(`requirementResultCount expected >= ${expect.minRequirementResults}`);
  }

  if (Number(result?.metrics?.fusedEvidenceCount || 0) < Number(expect.minFusedEvidence || 0)) {
    failures.push(`fusedEvidenceCount expected >= ${expect.minFusedEvidence}`);
  }

  if (expect.mustIncludeSection) {
    const sectionFound = (result?.citations || []).some((citation) =>
      normalizeString(citation?.section_number) === normalizeString(expect.mustIncludeSection)
    );
    if (!sectionFound) {
      failures.push(`missing required section citation ${expect.mustIncludeSection}`);
    }
  }

  if (expect.mustIncludeCitationText) {
    const citationFound = (result?.citations || []).some((citation) =>
      normalizeString(citation?.citation).includes(normalizeString(expect.mustIncludeCitationText))
    );
    if (!citationFound) {
      failures.push(`missing citation text '${expect.mustIncludeCitationText}'`);
    }
  }

  return {
    pass: failures.length === 0,
    failures,
  };
}

function evaluateComparisonScenario(scenario, result) {
  const failures = [];
  const expect = scenario.expect || {};

  if (Number(result?.summary?.alignedCount || 0) < Number(expect.minAligned || 0)) {
    failures.push(`alignedCount expected >= ${expect.minAligned}`);
  }

  const gapsTotal = Number(result?.summary?.gapLeftCount || 0) + Number(result?.summary?.gapRightCount || 0);
  if (gapsTotal < Number(expect.minGapsTotal || 0)) {
    failures.push(`gaps total expected >= ${expect.minGapsTotal}`);
  }

  const summaryText = normalizeString(result?.comparisonSummary);
  for (const term of Array.isArray(expect.requireSummaryTerms) ? expect.requireSummaryTerms : []) {
    if (!summaryText.includes(String(term))) {
      failures.push(`comparisonSummary missing '${term}'`);
    }
  }

  return {
    pass: failures.length === 0,
    failures,
  };
}

async function runConversationScenario(scenario, deps) {
  const result = await answerWithFirstPrinciplesConversationEngine({
    conversationId: scenario.conversationId,
    userPrompt: scenario.query,
    options: {
      maxRequirements: 8,
      maxChunks: 8,
      maxEvidence: 6,
      requirementWeight: 1.2,
      chunkWeight: 1.0,
      rrfK: 60,
    },
  }, deps);

  const evaluation = evaluateConversationScenario(scenario, result);

  return {
    id: scenario.id,
    name: scenario.name,
    type: 'conversation',
    pass: evaluation.pass,
    failures: evaluation.failures,
    observed: {
      requirementResultCount: result?.metrics?.requirementResultCount || 0,
      fusedEvidenceCount: result?.metrics?.fusedEvidenceCount || 0,
      topCitations: (result?.citations || []).slice(0, 2),
    },
  };
}

async function runComparisonScenario(scenario, deps) {
  const result = await compareWithFirstPrinciplesEngine({
    leftConversationId: scenario.leftConversationId,
    rightConversationId: scenario.rightConversationId,
    queryText: scenario.query,
    options: {
      top: 20,
      minPartialScore: 0.45,
      minMatchScore: 0.72,
      minConflictScore: 0.45,
    },
  }, deps);

  const evaluation = evaluateComparisonScenario(scenario, result);

  return {
    id: scenario.id,
    name: scenario.name,
    type: 'comparison',
    pass: evaluation.pass,
    failures: evaluation.failures,
    observed: {
      summary: result?.summary || {},
      comparisonSummary: result?.comparisonSummary || '',
    },
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const fixtureAbsolute = path.resolve(process.cwd(), args.fixturePath);
  const fixture = JSON.parse(fs.readFileSync(fixtureAbsolute, 'utf8'));
  const deps = createMockDeps();

  const outputs = [];

  for (const scenario of Array.isArray(fixture?.conversation) ? fixture.conversation : []) {
    outputs.push(await runConversationScenario(scenario, deps));
  }

  for (const scenario of Array.isArray(fixture?.comparison) ? fixture.comparison : []) {
    outputs.push(await runComparisonScenario(scenario, deps));
  }

  const passed = outputs.filter((item) => item.pass).length;
  const failed = outputs.length - passed;

  console.log('\nFirst-principles parity scenarios summary');
  console.log(JSON.stringify({
    fixturePath: args.fixturePath,
    total: outputs.length,
    passed,
    failed,
    results: outputs,
  }, null, 2));

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('First-principles parity scenario run failed:', error?.message || String(error));
  process.exitCode = 1;
});
