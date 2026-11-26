import { compareWithFirstPrinciplesEngine } from '../../app/services/langgraphs/compliance/docConversation1stPriComparisonEngine.js';

function parseArgs(argv = []) {
  const args = argv.slice(2);

  const leftPos = args.indexOf('--left-conversation-id');
  const leftConversationId = leftPos >= 0 ? String(args[leftPos + 1] || '').trim() : 'fixture-conversation-a';

  const rightPos = args.indexOf('--right-conversation-id');
  const rightConversationId = rightPos >= 0 ? String(args[rightPos + 1] || '').trim() : 'fixture-conversation-b';

  const queryPos = args.indexOf('--query');
  const query = queryPos >= 0 ? String(args[queryPos + 1] || '').trim() : 'second level complaint requirements';

  const topPos = args.indexOf('--top');
  const top = topPos >= 0 ? Number(args[topPos + 1]) : 20;

  return {
    leftConversationId,
    rightConversationId,
    query,
    top: Number.isFinite(top) && top > 0 ? Math.floor(top) : 20,
  };
}

function extractConversationIdFromFilter(filter = '') {
  const match = String(filter || '').match(/conversation_id\s+eq\s+'([^']+)'/i);
  return match ? String(match[1]).trim() : '';
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
    getSearchClient() {
      return {
        async search(_queryText, options = {}) {
          const conversationId = extractConversationIdFromFilter(options.filter);
          const docs = getMockRequirementDocsByConversation(conversationId);
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
    async generateComparisonSummary(result) {
      const text = [
        `Compared ${result.summary.leftRequirementCount} vs ${result.summary.rightRequirementCount} requirements.`,
        `Matches=${result.summary.matchCount}, Partials=${result.summary.partialCount}, Conflicts=${result.summary.conflictCount}.`,
        `Gaps: left-only=${result.summary.gapLeftCount}, right-only=${result.summary.gapRightCount}.`,
      ].join(' ');

      return {
        text,
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
  const deps = createMockDeps();

  const result = await compareWithFirstPrinciplesEngine({
    leftConversationId: args.leftConversationId,
    rightConversationId: args.rightConversationId,
    queryText: args.query,
    options: {
      top: args.top,
      minPartialScore: 0.45,
      minMatchScore: 0.72,
      minConflictScore: 0.45,
    },
  }, deps);

  console.log('\nFirst-principles comparison dry-run summary');
  console.log(JSON.stringify({
    leftConversationId: result.leftConversationId,
    rightConversationId: result.rightConversationId,
    queryText: result.queryText,
    summary: result.summary,
    summaryMode: result.summaryMode,
    comparisonSummary: result.comparisonSummary,
    topMatches: result.matches.slice(0, 2),
    topConflicts: result.conflicts.slice(0, 2),
    topGapsLeft: result.gaps.left.slice(0, 2),
    topGapsRight: result.gaps.right.slice(0, 2),
  }, null, 2));
}

main().catch((error) => {
  console.error('First-principles comparison dry-run failed:', error?.message || String(error));
  process.exitCode = 1;
});
