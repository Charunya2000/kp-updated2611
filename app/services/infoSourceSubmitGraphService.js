import { Annotation, StateGraph, START, END } from './langgraphs/langgraph-light.js';
import { vectorize } from './vectorizeDataService';
import { searchInfoSourceIndex } from './infoSourceSearchVectorDataService';
import { selectSmartNote } from '@services/smartNoteService';
import { systemPromptNode } from '@/app/services/langgraphs/shared/nodes/addSystemPromptsNode.js';
import { personaNode } from '@/app/services/langgraphs/shared/nodes/addPersonaPromptsNode.js';
import { selectChatInteractions } from './chatInteractionService';
import { chatCompletion, chatCompletionMarkdown, chatCompletionPrompts } from './chatCompletionService2';
import { getDefaultChatCompletionConfig } from './chatCompletionConfigService';
import { INFO_SOURCE_SYSTEM_CONTEXT } from '@/app/prompts/infoSourceSystemContext';
import {
  KP_POLICY_INDEX_NAME,
  buildKpPolicyCitationKey,
  resolveKpPolicyMetadata
} from '@/app/utils/infoSourceCitationUtils';

const INFO_SOURCE_PAGES_INDEX = 'infosource_pages2_2026-03-25';
const KP_POLICY_INDEX = KP_POLICY_INDEX_NAME;
const IS_PAGES2_INDEX = true;

const INFO_SOURCE_INDEX_CONFIGS = [
  {
    indexName: 'infosource_assets_2026-03-25',
    nearestNeighbors: 14,
    selectFields: [
      'id',
      'unique_id',
      'document_title',
      'document_path',
      'document_owner',
      'market_owner',
      'market',
      'asset_status',
      'keywords',
      'category',
      'keywords_text',
      'category_text',
      'last_reviewed',
      'published_date',
      'file_size_bytes',
      'section_title'
    ]
  },
  {
    indexName: INFO_SOURCE_PAGES_INDEX,
    nearestNeighbors: 14,
    selectFields: IS_PAGES2_INDEX
      ? [
        'id',
        'unique_id',
        'title',
        'path',
        'content_owner',
        'market',
        'keywords',
        'category',
        'last_reviewed_updated',
        'content'
      ]
      : [
        'id',
        'unique_id',
        'path',
        'content_owner',
        'market',
        'keywords',
        'category',
        'keywords_text',
        'category_text',
        'last_reviewed_updated',
        'last_published',
        'line_of_business',
        'role',
        'function',
        'section_title'
      ]
  },
  {
    indexName: KP_POLICY_INDEX,
    nearestNeighbors: 14,
    contentVectorField: 'contentVector',
    semanticConfiguration: 'default-semantic',
    selectFields: [
      'id',
      'uniqueId',
      'fileId',
      'chunkId',
      'chunkOrdinal',
      'policyTitle',
      'leftNavSelection',
      'documentOwner',
      'publicationDate',
      'titleUrl',
      'evergreenLink',
      'status',
      'content',
      'sectionPath'
    ]
  }
];

const QUERY_STOP_WORDS = new Set([
  'about', 'after', 'against', 'also', 'been', 'being', 'between', 'could', 'does', 'from', 'have', 'into', 'just', 'like',
  'maybe', 'might', 'more', 'most', 'only', 'other', 'over', 'same', 'some', 'such', 'than', 'that', 'their', 'there',
  'these', 'they', 'this', 'those', 'through', 'under', 'very', 'what', 'when', 'where', 'which', 'while', 'with', 'your'
]);

const MIN_QUOTE_CHARS = 150;
const MAX_QUOTE_CHARS = 520;
const MAX_CITATIONS_PER_INDEX = Number.parseInt(process.env.INFOSEARCH_MAX_CITATIONS_PER_INDEX || '6', 10);
const MIN_CITATIONS_FLOOR = Number.parseInt(process.env.INFOSEARCH_MIN_CITATIONS_FLOOR || '2', 10);
const MAX_TOTAL_CITATIONS = Number.parseInt(process.env.INFOSEARCH_MAX_TOTAL_CITATIONS || '6', 10);
const INFO_SOURCE_DEBUG_RESULTS = String(process.env.INFOSEARCH_DEBUG_RESULTS || 'true').toLowerCase() === 'true';

function normalizeSnippetText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function sanitizePageFunctionalText(value = '') {
  let text = String(value || '');

  // Convert markdown-style links to visible label only.
  text = text.replace(/\[([^\]]{1,200})\]\((?:https?:\/\/|\/|\.\/|\.\.\/)[^)]+\)/gi, '$1');

  // Remove bracketed path artifacts from crawled content (e.g., KP Logo [/etc.clientlibs/...]).
  text = text.replace(/([A-Za-z][A-Za-z0-9\s&\-\/]{1,120})\s*\[\s*(?:https?:\/\/|\/)[^\]]+\]/gi, '$1');
  text = text.replace(/\[\s*\/(?:etc\.clientlibs|content|apps|libs)[^\]]*\]/gi, ' ');
  text = text.replace(/\/(?:etc\.clientlibs|content|apps|libs)\/[A-Za-z0-9_\-./]+/gi, ' ');

  // Remove mailto/email link artifacts often captured from page chrome.
  text = text.replace(/\[[^\]]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}[^\]]*\]/gi, ' ');
  text = text.replace(/\b(?:mailto:)?[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\?subject=[^\s]+/gi, ' ');

  // Strip common navigation/chrome labels that are not functional page content.
  text = text.replace(/\bInfoSource\s+Home\s+Page\b/gi, ' ');
  text = text.replace(/\bLearning\s*&\s*Events\s*Calendar\b/gi, ' ');
  text = text.replace(/\bMy\s+Account\b/gi, ' ');
  text = text.replace(/\bProfile\s*&\s*Preferences\b/gi, ' ');
  text = text.replace(/\bLogout\b/gi, ' ');
  text = text.replace(/\bcircle\s+human\b/gi, ' ');
  text = text.replace(/\bdown\s+arrow\b/gi, ' ');

  // Remove bookmark widget workflow text.
  text = text.replace(/\badd\s+bookmark\b/gi, ' ');
  text = text.replace(/\badded\s+bookmark\b/gi, ' ');
  text = text.replace(/\brename\s+bookmark\b/gi, ' ');
  text = text.replace(/\btitle\s+is\s+required\s+to\s+save\s+bookmark\b/gi, ' ');
  text = text.replace(/\bremove\s+undo\s+done\b/gi, ' ');
  text = text.replace(/\bcontent\s+owner\s*:\s*[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi, ' ');
  text = text.replace(/\bproducts\s*&\s*plans\b/gi, ' ');
  text = text.replace(/\bmy\s+bookmarks\b/gi, ' ');
  text = text.replace(/\byou\s+don'?t\s+have\s+any\s+bookmarks\b/gi, ' ');
  text = text.replace(/\berror\s+retrieving\s+bookmarks\b/gi, ' ');
  text = text.replace(/\btry\s+again\b/gi, ' ');
  text = text.replace(/\bif\s+the\s+error\s+persists,?\s+contact\b/gi, ' ');
  text = text.replace(/\bedit\s+page\b/gi, ' ');
  text = text.replace(/\blast\s+updated\/?reviewed\s*:\s*[0-9/\-]+\b/gi, ' ');
  text = text.replace(/\bthis\s+page'?s\s+annual\s+review\s+has\s+not\s+been\s+done\.?\b/gi, ' ');
  text = text.replace(/\bsome\s+information\s+may\s+be\s+outdated\s+or\s+inaccurate\.?\b/gi, ' ');

  // Drop common non-functional branding/navigation fragments when isolated.
  text = text.replace(/\bKP\s+Logo\b/gi, ' ');

  const utilityPatterns = [
    /\b(?:my account|profile|preferences|logout|bookmarks|bookmark|search|home page|products?\s*&\s*plans?|edit page)\b/i,
    /\b(?:error retrieving|try again|contact it|annual review|updated\/reviewed|down arrow|circle human)\b/i,
    /\b(?:ok|done|undo|remove|add)\b/i
  ];

  const filteredSentences = text
    .split(/(?<=[.!?])\s+|\s+\|\s+|\s{2,}|\n+/)
    .map((fragment) => fragment.trim())
    .filter(Boolean)
    .filter((fragment) => {
      const lowered = fragment.toLowerCase();
      const tokenCount = lowered.split(/\s+/).length;
      const utilityHitCount = utilityPatterns.reduce((count, pattern) => {
        return count + (pattern.test(lowered) ? 1 : 0);
      }, 0);

      if (utilityHitCount === 0) {
        return true;
      }

      // Remove short/medium utility fragments but keep longer mixed fragments that may contain real content.
      if (tokenCount <= 12) {
        return false;
      }

      if (utilityHitCount >= 2 && tokenCount <= 20) {
        return false;
      }

      return true;
    });

  text = filteredSentences.join(' ');

  return normalizeSnippetText(text);
}

function extractQueryTerms(...values) {
  const joined = values.filter(Boolean).join(' ').toLowerCase();
  const tokens = joined
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3)
    .filter((token) => !QUERY_STOP_WORDS.has(token));

  return [...new Set(tokens)].slice(0, 24);
}

function extractJsonArrayFromText(rawText = '') {
  const text = String(rawText || '').trim();
  if (!text) return null;

  const fencedMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
  const candidate = fencedMatch ? fencedMatch[1] : text;

  try {
    const parsed = JSON.parse(candidate);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    const start = candidate.indexOf('[');
    const end = candidate.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    try {
      const parsed = JSON.parse(candidate.slice(start, end + 1));
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

function createRelevantSnippet(sourceText, queryTerms, maxLength = 320) {
  const text = normalizeSnippetText(sourceText);
  if (!text) return null;

  if (text.length <= maxLength) {
    return text;
  }

  const lower = text.toLowerCase();
  let bestIndex = -1;

  for (const term of queryTerms) {
    const index = lower.indexOf(term.toLowerCase());
    if (index !== -1 && (bestIndex === -1 || index < bestIndex)) {
      bestIndex = index;
    }
  }

  if (bestIndex === -1) {
    return `${text.slice(0, maxLength).trimEnd()}...`;
  }

  const leftPad = Math.floor(maxLength * 0.3);
  const rightPad = maxLength - leftPad;
  const start = Math.max(0, bestIndex - leftPad);
  const end = Math.min(text.length, bestIndex + rightPad);
  const snippet = text.slice(start, end).trim();

  const prefix = start > 0 ? '...' : '';
  const suffix = end < text.length ? '...' : '';
  return `${prefix}${snippet}${suffix}`;
}

function buildCitationEvidenceText(document = {}, indexName = '', queryTerms = []) {
  const isPageIndex = indexName === INFO_SOURCE_PAGES_INDEX;
  const sectionTitle = isPageIndex
    ? sanitizePageFunctionalText(document.section_title || '')
    : normalizeSnippetText(document.section_title || '');
  const content = isPageIndex
    ? sanitizePageFunctionalText(document.content || '')
    : normalizeSnippetText(document.content || '');

  // Pages often contain long bodies. Anchor evidence to a focused snippet around query terms.
  if (isPageIndex) {
    const focused = createRelevantSnippet(content, queryTerms, 1400);
    return normalizeSnippetText(focused || sectionTitle || content || '');
  }

  return normalizeSnippetText(sectionTitle || createRelevantSnippet(content, queryTerms, 900) || content || '');
}

function buildRetrievalAssociationText(document = {}) {
  return [
    document.policyTitle,
    document.leftNavSelection,
    document.documentOwner,
    Array.isArray(document.sectionPath) ? document.sectionPath.join(' ') : null,
    document.document_title,
    document.title,
    document.path,
    document.section_title,
    document.content,
    document.keywords_text,
    document.category_text,
    Array.isArray(document.keywords) ? document.keywords.join(' ') : null,
    Array.isArray(document.category) ? document.category.join(' ') : null,
    document.document_owner,
    document.content_owner,
    document.market_owner,
    document.market,
    document.region,
    document.line_of_business,
    document.role,
    document.function,
    document.unique_id
  ].filter(Boolean).join(' ');
}

function countQueryTermMatches(value = '', queryTerms = []) {
  const normalized = String(value || '').toLowerCase();
  if (!normalized || queryTerms.length === 0) {
    return 0;
  }

  let matchCount = 0;
  for (const term of queryTerms) {
    if (!term) continue;
    if (normalized.includes(term.toLowerCase())) {
      matchCount += 1;
    }
  }

  return matchCount;
}

function buildDebugSearchHitPreview(result = {}, indexName = '') {
  const document = result?.document || {};
  const evidenceText = normalizeSnippetText(
    pickFirstDefined(document.section_title, document.content, document.keywords_text, document.category_text) || ''
  );
  return {
    indexName,
    id: document.id || null,
    unique_id: pickFirstDefined(document.unique_id, document.uniqueId) || null,
    title: pickFirstDefined(document.policyTitle, document.document_title, document.title, document.section_title) || null,
    path: pickFirstDefined(document.titleUrl, document.evergreenLink, document.document_path, document.path) || null,
    market: pickFirstDefined(document.leftNavSelection, document.market, document.region) || null,
    owner: pickFirstDefined(document.documentOwner, document.document_owner, document.content_owner, document.market_owner) || null,
    score: typeof result?.score === 'number' ? result.score : null,
    rerankerScore: typeof result?.rerankerScore === 'number' ? result.rerankerScore : null,
    contentPreview: evidenceText.slice(0, 280),
    fullEvidencePreview: evidenceText.slice(0, 2400)
  };
}

function splitIntoSentences(text = '') {
  return String(text || '')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function extractCitationClaimsByMarker(markdown = '', maxMarker = 0) {
  const claims = new Map();
  if (!markdown || maxMarker <= 0) {
    return claims;
  }

  const plain = stripCodeBlocks(String(markdown || ''));
  const sentences = splitIntoSentences(plain);

  for (const sentence of sentences) {
    const markers = [...sentence.matchAll(/\[(\d+)\]/g)]
      .map((match) => Number.parseInt(match[1], 10))
      .filter((marker) => Number.isInteger(marker) && marker >= 1 && marker <= maxMarker);

    if (!markers.length) {
      continue;
    }

    const cleaned = normalizeSnippetText(stripCitationMarkers(sentence));
    if (!cleaned) {
      continue;
    }

    markers.forEach((marker) => {
      const existing = claims.get(marker);
      if (!existing || cleaned.length > existing.length) {
        claims.set(marker, cleaned.slice(0, 320));
      }
    });
  }

  return claims;
}

function buildDeterministicCitationContent(citation, claimExcerpt, queryTerms = []) {
  const quotes = buildEvidenceQuoteSet(citation, queryTerms, 2);
  if (!quotes.length) {
    return claimExcerpt || citation?.relevanceSnippet || null;
  }

  const lead = claimExcerpt
    ? `Supports this response statement: ${claimExcerpt}`
    : 'Supports the cited response content';

  const quotedText = quotes.map((quote) => `"${quote}"`).join(' ');
  return `${lead} ${quotedText}`;
}

function scoreSentenceForTerms(sentence = '', queryTerms = []) {
  const normalized = String(sentence || '').toLowerCase();
  if (!normalized) return 0;

  let score = 0;
  for (const term of queryTerms) {
    if (!term) continue;
    if (normalized.includes(term.toLowerCase())) {
      score += 1;
    }
  }

  return score;
}

function buildFocusedEvidenceQuote(citation, queryTerms = []) {
  const evidence = normalizeSnippetText(citation?.rawEvidenceText || citation?.relevanceSnippet || '');
  if (!evidence) return '';

  if (evidence.length <= MAX_QUOTE_CHARS) {
    return evidence;
  }

  const sentences = splitIntoSentences(evidence);
  if (sentences.length === 0) {
    const fallbackSnippet = createRelevantSnippet(evidence, queryTerms, MAX_QUOTE_CHARS + 10) || evidence;
    const normalizedFallback = stripWrappingQuotes(normalizeSnippetText(fallbackSnippet));
    return normalizedFallback.length <= MAX_QUOTE_CHARS
      ? normalizedFallback
      : `${normalizedFallback.slice(0, MAX_QUOTE_CHARS).trimEnd()}...`;
  }

  const scored = sentences.map((sentence, index) => ({
    index,
    sentence,
    score: scoreSentenceForTerms(sentence, queryTerms)
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.sentence.length - a.sentence.length;
  });

  const best = scored[0] || { index: 0 };
  let left = best.index;
  let right = best.index;
  let quote = sentences.slice(left, right + 1).join(' ');

  while (quote.length < MIN_QUOTE_CHARS && (left > 0 || right < sentences.length - 1)) {
    const canExpandLeft = left > 0;
    const canExpandRight = right < sentences.length - 1;

    if (canExpandLeft && canExpandRight) {
      const leftScore = scoreSentenceForTerms(sentences[left - 1], queryTerms);
      const rightScore = scoreSentenceForTerms(sentences[right + 1], queryTerms);

      if (rightScore > leftScore) {
        right += 1;
      } else {
        left -= 1;
      }
    } else if (canExpandRight) {
      right += 1;
    } else if (canExpandLeft) {
      left -= 1;
    }

    quote = sentences.slice(left, right + 1).join(' ');
  }

  let normalizedQuote = stripWrappingQuotes(normalizeSnippetText(quote));
  if (normalizedQuote.length > MAX_QUOTE_CHARS) {
    normalizedQuote = `${normalizedQuote.slice(0, MAX_QUOTE_CHARS).trimEnd()}...`;
  }

  const prefix = left > 0 ? '... ' : '';
  const suffix = right < sentences.length - 1 ? ' ...' : '';
  return `${prefix}${normalizedQuote}${suffix}`.trim();
}

function buildFallbackCitationContent(citation, queryTerms = []) {
  const evidence = normalizeSnippetText(citation?.rawEvidenceText || citation?.relevanceSnippet || '');
  if (!evidence) {
    return null;
  }

  const quote = buildFocusedEvidenceQuote(citation, queryTerms);
  return quote ? `"${quote}"` : null;
}

function stripWrappingQuotes(value = '') {
  const text = String(value || '').trim();
  return text.replace(/^"+|"+$/g, '').trim();
}

function escapeRegExp(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripCitationIntroPhrase(value = '', source = '') {
  let text = normalizeSnippetText(value || '');
  if (!text) {
    return '';
  }

  const patterns = [
    source ? new RegExp(`^${escapeRegExp(source)}\s+provides relevant information for this question\.?(?:\s+|$)`, 'i') : null,
    /^This source provides relevant information for this question\.?(?:\s+|$)/i
  ].filter(Boolean);

  for (const pattern of patterns) {
    text = text.replace(pattern, '').trim();
  }

  return text.replace(/^[\s,:;.-]+/, '').trim();
}

function findQuotedSegments(value = '') {
  const text = String(value || '');
  const matches = [...text.matchAll(/"([^"]+)"/g)];
  return matches
    .map((match) => stripWrappingQuotes(match[1]))
    .filter(Boolean);
}

function buildEvidenceQuote(citation, queryTerms = []) {
  const evidence = normalizeSnippetText(citation?.rawEvidenceText || citation?.relevanceSnippet || '');
  if (!evidence) return '';

  if (evidence.length <= MAX_QUOTE_CHARS) {
    return evidence;
  }

  const localTerms = queryTerms.length > 0
    ? queryTerms
    : extractQueryTerms(citation?.source || '', citation?.associationText || '');
  const focused = createRelevantSnippet(evidence, localTerms, MAX_QUOTE_CHARS + 10) || evidence;
  const normalizedFocused = stripWrappingQuotes(normalizeSnippetText(focused));
  if (normalizedFocused.length <= MAX_QUOTE_CHARS) {
    return normalizedFocused;
  }

  return `${normalizedFocused.slice(0, MAX_QUOTE_CHARS).trimEnd()}...`;
}

function buildEvidenceQuoteSet(citation, queryTerms = [], maxQuotes = 2) {
  const evidence = normalizeSnippetText(citation?.rawEvidenceText || citation?.relevanceSnippet || '');
  if (!evidence) return [];

  const sentences = splitIntoSentences(evidence);
  if (sentences.length === 0) {
    const single = buildEvidenceQuote(citation, queryTerms);
    return single ? [single] : [];
  }

  const localTerms = queryTerms.length > 0
    ? queryTerms
    : extractQueryTerms(citation?.source || '', citation?.associationText || '');

  const scored = sentences
    .map((sentence) => {
      const normalized = normalizeSnippetText(sentence);
      return {
        sentence: normalized,
        score: scoreSentenceForTerms(normalized, localTerms),
        lengthScore: Math.min(1.5, normalized.length / 220)
      };
    })
    .filter((item) => item.sentence.length >= 42)
    .sort((left, right) => {
      const rightScore = right.score + right.lengthScore;
      const leftScore = left.score + left.lengthScore;
      return rightScore - leftScore;
    });

  const quotes = [];
  const seen = new Set();
  for (const item of scored) {
    const sentence = stripWrappingQuotes(item.sentence);
    const comparable = sentence.toLowerCase();
    if (!sentence || seen.has(comparable)) {
      continue;
    }

    const formatted = sentence.length > MAX_QUOTE_CHARS
      ? `${sentence.slice(0, MAX_QUOTE_CHARS).trimEnd()}...`
      : sentence;
    quotes.push(formatted);
    seen.add(comparable);

    if (quotes.length >= maxQuotes) {
      break;
    }
  }

  if (quotes.length === 0) {
    const single = buildEvidenceQuote(citation, queryTerms);
    return single ? [single] : [];
  }

  return quotes;
}

function sanitizeGeneratedCitationNarrative(value = '') {
  const text = normalizeSnippetText(value || '');
  if (!text) {
    return '';
  }

  return text
    .replace(/\b(and\s+){2,}/gi, 'and ')
    .replace(/\b([A-Za-z]+)\s+\1\b/gi, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function ensureSubstantialCitationContent(citation, generatedContent, queryTerms = []) {
  const generated = sanitizeGeneratedCitationNarrative(
    stripCitationIntroPhrase(generatedContent || '', citation?.source || '')
  );
  const fallback = buildFallbackCitationContent(citation, queryTerms);
  if (!generated) {
    const deterministic = buildDeterministicCitationContent(citation, '', queryTerms);
    return deterministic || fallback || citation?.relevanceSnippet || null;
  }

  const quotedSegments = findQuotedSegments(generated);
  const longestQuote = quotedSegments.sort((a, b) => b.length - a.length)[0] || '';
  if (longestQuote.length >= MIN_QUOTE_CHARS) {
    return generated;
  }

  const evidenceQuote = buildEvidenceQuote(citation, queryTerms);
  const evidenceQuotes = buildEvidenceQuoteSet(citation, queryTerms, 2);
  const withoutShortQuotes = stripCitationIntroPhrase(
    generated.replace(/"([^"]+)"/g, '').replace(/\s{2,}/g, ' ').trim(),
    citation?.source || ''
  );
  const baseSentence = withoutShortQuotes || '';

  if (evidenceQuotes.length > 0) {
    const quoteBundle = evidenceQuotes.map((quote) => `"${quote}"`).join(' ');
    return baseSentence ? `${baseSentence} ${quoteBundle}` : quoteBundle;
  }

  return baseSentence ? `${baseSentence} "${evidenceQuote}"` : `"${evidenceQuote}"`;
}

async function reportInfoSourceProgress(state, stage, details = '') {
  if (typeof state?.onProgress !== 'function') {
    return;
  }

  await state.onProgress({ stage, details });
}

const smartNotesNode = async (state) => {
  await reportInfoSourceProgress(state, 'Loading assistant context...');
  const query = { type: 'SmartNote', parentId: { $exists: true }, id: state.smartNoteId };
  const smartNote = await selectSmartNote(query, state.teamName);
  return {
    assistantName: smartNote?.selectedUserAssistant || state.assistantName,
    userSelectedPersona: smartNote?.persona || null
  };
};

const vectorizePromptNode = async (state) => {
  await reportInfoSourceProgress(state, 'Preparing retrieval query...');
  const retrievalQuery = state.retrievalQuery || state.chatInteraction.prompt;
  const promptEmbedding = await vectorize({ nuid: state.nuid, content: retrievalQuery });
  return { promptEmbedding };
};

function shouldExpandRetrievalQuery() {
  const mode = String(process.env.INFOSEARCH_QUERY_EXPANSION_MODE || 'on').toLowerCase();
  return mode !== 'off';
}

function normalizeExpandedQuery(value, fallbackPrompt) {
  const expanded = String(value || '').replace(/\s+/g, ' ').trim();
  if (!expanded) {
    return fallbackPrompt;
  }
  return expanded.slice(0, 900);
}

const expandSearchQueryNode = async (state) => {
  const prompt = state.chatInteraction?.prompt || '';
  if (!prompt) {
    return { retrievalQuery: '' };
  }

  if (!shouldExpandRetrievalQuery()) {
    return { retrievalQuery: prompt };
  }

  try {
    const messages = [
      {
        role: 'system',
        content: [
          'Rewrite the user question into a retrieval-focused search query for InfoSource.',
          'Preserve intent.',
          'Add likely related terms, synonyms, and sales/presentation terminology that could surface relevant documents.',
          'Return plain text only, no bullets, no labels, no quotes.'
        ].join(' ')
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    const expanded = await chatCompletion({
      messages,
      temperature: 0,
      max_tokens: 220,
      model: 'gpt-4o',
      assistantName: state.assistantName,
      teamName: state.teamName,
      nuid: state.nuid
    });

    const retrievalQuery = normalizeExpandedQuery(expanded, prompt);

    if (process.env.OPENID_DEBUG === 'true') {
      console.log(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'InfoSourceQueryExpansion',
          detail: {
            smartNoteId: state.smartNoteId,
            originalLength: prompt.length,
            expandedLength: retrievalQuery.length
          }
        }
      }));
    }

    return { retrievalQuery };
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'InfoSourceQueryExpansionFailed',
        detail: {
          smartNoteId: state.smartNoteId,
          error: error?.message || 'Unknown error'
        }
      }
    }));

    return { retrievalQuery: prompt };
  }
};

function getDocLastReviewedTimestamp(result) {
  const document = result?.document || {};
  const value = document.publicationDate || document.last_reviewed || document.last_reviewed_updated || document.last_published;
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function pickFirstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return null;
}

function buildReadableTitleFromPath(pathValue = '') {
  const raw = String(pathValue || '').trim();
  if (!raw) {
    return null;
  }

  const cleanPath = raw.split('?')[0].split('#')[0];
  const segments = cleanPath.split('/').filter(Boolean);
  if (!segments.length) {
    return null;
  }

  const slug = segments[segments.length - 1];
  if (!slug) {
    return null;
  }

  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getSearchScore(result) {
  const score = result?.score;
  return typeof score === 'number' ? score : 0;
}

function getRecencyBoost(result) {
  const ts = getDocLastReviewedTimestamp(result);
  if (!Number.isFinite(ts)) {
    return 0;
  }

  const daysOld = Math.max(0, (Date.now() - ts) / (1000 * 60 * 60 * 24));
  if (daysOld <= 180) {
    return 0.12;
  }
  if (daysOld <= 365) {
    return 0.08;
  }
  if (daysOld <= 730) {
    return 0.04;
  }
  return 0;
}

function sortResultsByRecency(results = []) {
  return [...results].sort((left, right) => {
    const rightWeighted = getSearchScore(right) + getRecencyBoost(right);
    const leftWeighted = getSearchScore(left) + getRecencyBoost(left);
    if (rightWeighted !== leftWeighted) {
      return rightWeighted - leftWeighted;
    }

    const rightTs = getDocLastReviewedTimestamp(right);
    const leftTs = getDocLastReviewedTimestamp(left);
    if (rightTs !== leftTs) {
      return rightTs - leftTs;
    }

    return getSearchScore(right) - getSearchScore(left);
  });
}

function normalizeStringList(values = []) {
  const list = Array.isArray(values) ? values : [];
  return [...new Set(
    list
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean)
  )];
}

function mergeUniqueStrings(...groups) {
  return [...new Set(groups.flat().filter(Boolean))];
}

function getDateRangeForBucket(bucket = 'any') {
  const now = new Date();

  if (bucket === 'thisMonth') {
    return {
      start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      end: null
    };
  }

  if (bucket === 'last3Months') {
    const start = new Date(now);
    start.setUTCMonth(start.getUTCMonth() - 3);
    return { start, end: null };
  }

  if (bucket === 'last6Months') {
    const start = new Date(now);
    start.setUTCMonth(start.getUTCMonth() - 6);
    return { start, end: null };
  }

  if (bucket === 'thisYear') {
    return {
      start: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)),
      end: null
    };
  }

  if (bucket === 'lastYear') {
    return {
      start: new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1)),
      end: new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
    };
  }

  return { start: null, end: null };
}

function normalizeInfoSourceFilters(rawFilters = null) {
  const fallback = {
    enabled: false,
    contentType: 'both',
    updatedBucket: 'any',
    useCitationSeed: false,
    titleTokens: [],
    owners: [],
    markets: [],
    keywords: []
  };

  if (!rawFilters || !rawFilters.enabled) {
    return fallback;
  }

  const contentType = ['both', 'asset', 'page'].includes(rawFilters.contentType)
    ? rawFilters.contentType
    : 'both';
  const updatedBucket = ['any', 'thisMonth', 'last3Months', 'last6Months', 'thisYear', 'lastYear'].includes(rawFilters.updatedBucket)
    ? rawFilters.updatedBucket
    : 'any';

  const useCitationSeed = Boolean(rawFilters.useCitationSeed && rawFilters.citationSeed);

  const citationSeed = useCitationSeed ? rawFilters.citationSeed : null;
  const citationTitleTokens = normalizeStringList(citationSeed?.titles || []);
  const citationOwners = normalizeStringList(citationSeed?.owners || []);
  const citationMarkets = normalizeStringList(citationSeed?.markets || []);
  const citationKeywords = normalizeStringList(citationSeed?.keywords || []);

  const titleText = String(rawFilters.title || '').trim().toLowerCase();
  const titleTokens = mergeUniqueStrings(
    titleText ? [titleText] : [],
    citationTitleTokens
  );

  const owners = mergeUniqueStrings(
    normalizeStringList(rawFilters.owners || []),
    citationOwners
  );
  const markets = mergeUniqueStrings(
    normalizeStringList(rawFilters.markets || []),
    citationMarkets
  );
  const keywords = mergeUniqueStrings(
    normalizeStringList(rawFilters.keywords || []),
    citationKeywords
  );

  return {
    enabled: true,
    contentType,
    updatedBucket,
    useCitationSeed,
    titleTokens,
    owners,
    markets,
    keywords
  };
}

function escapeOData(value = '') {
  return String(value || '').replace(/'/g, "''");
}

function buildOrEqualsClause(fieldName, values = []) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  const pieces = values.map((value) => `${fieldName} eq '${escapeOData(value)}'`);
  return pieces.length > 1 ? `(${pieces.join(' or ')})` : pieces[0];
}

function buildIndexQueryFilter(indexName, filters) {
  if (!filters?.enabled || indexName === KP_POLICY_INDEX) {
    return null;
  }

  const isAsset = indexName === 'infosource_assets_2026-03-25';
  const ownerField = isAsset ? 'document_owner' : 'content_owner';
  const marketField = 'market';
  const dateField = isAsset ? 'last_reviewed' : 'last_reviewed_updated';

  const clauses = [];
  const ownerClause = buildOrEqualsClause(ownerField, filters.owners);
  if (ownerClause) {
    clauses.push(ownerClause);
  }

  const marketClause = buildOrEqualsClause(marketField, filters.markets);
  if (marketClause) {
    clauses.push(marketClause);
  }

  const dateRange = getDateRangeForBucket(filters.updatedBucket);
  if (dateRange.start) {
    clauses.push(`${dateField} ge ${dateRange.start.toISOString()}`);
  }
  if (dateRange.end) {
    clauses.push(`${dateField} lt ${dateRange.end.toISOString()}`);
  }

  return clauses.length > 0 ? clauses.join(' and ') : null;
}

function getDocumentLastUpdated(document = {}, isAsset = false) {
  const value = isAsset
    ? pickFirstDefined(document.last_reviewed, document.published_date)
    : pickFirstDefined(document.last_reviewed_updated, document.last_published);
  const ts = new Date(value || '').getTime();
  return Number.isFinite(ts) ? ts : null;
}

function textContainsAny(haystack = '', needles = []) {
  const normalizedHaystack = String(haystack || '').toLowerCase();
  if (!normalizedHaystack || !Array.isArray(needles) || needles.length === 0) {
    return false;
  }
  return needles.some((needle) => normalizedHaystack.includes(needle));
}

function resultMatchesFilters(document = {}, indexName, filters) {
  if (!filters?.enabled || indexName === KP_POLICY_INDEX) {
    return true;
  }

  const isAsset = indexName === 'infosource_assets_2026-03-25';
  const titleValue = isAsset
    ? pickFirstDefined(document.document_title, document.document_path)
    : pickFirstDefined(document.title, document.path);
  const ownerValue = isAsset ? document.document_owner : document.content_owner;
  const marketValue = document.market;
  const keywords = Array.isArray(document.keywords)
    ? document.keywords.map((value) => String(value || '').toLowerCase())
    : [];

  if (filters.titleTokens.length > 0 && !textContainsAny(titleValue, filters.titleTokens)) {
    return false;
  }

  if (filters.owners.length > 0) {
    const ownerLower = String(ownerValue || '').toLowerCase();
    if (!filters.owners.includes(ownerLower)) {
      return false;
    }
  }

  if (filters.markets.length > 0) {
    const marketLower = String(marketValue || '').toLowerCase();
    if (!filters.markets.includes(marketLower)) {
      return false;
    }
  }

  if (filters.keywords.length > 0) {
    const keywordMatch = filters.keywords.every((keyword) => keywords.includes(keyword));
    if (!keywordMatch) {
      return false;
    }
  }

  const dateRange = getDateRangeForBucket(filters.updatedBucket);
  if (dateRange.start || dateRange.end) {
    const updatedTs = getDocumentLastUpdated(document, isAsset);
    if (!updatedTs) {
      return false;
    }

    if (dateRange.start && updatedTs < dateRange.start.getTime()) {
      return false;
    }

    if (dateRange.end && updatedTs >= dateRange.end.getTime()) {
      return false;
    }
  }

  return true;
}

function summarizeActiveFilters(filters) {
  if (!filters?.enabled) {
    return { enabled: false };
  }

  return {
    enabled: true,
    contentType: filters.contentType,
    updatedBucket: filters.updatedBucket,
    useCitationSeed: filters.useCitationSeed,
    titleCount: filters.titleTokens.length,
    ownerCount: filters.owners.length,
    marketCount: filters.markets.length,
    keywordCount: filters.keywords.length
  };
}

const retrieveInfoSourceNode = async (state) => {
  await reportInfoSourceProgress(state, 'Searching ISA sources...');
  const prompt = state.chatInteraction?.prompt || '';
  const retrievalQuery = state.retrievalQuery || prompt;
  const activeFilters = normalizeInfoSourceFilters(state.infoSourceFilters);

  const scopedIndexConfigs = INFO_SOURCE_INDEX_CONFIGS.filter((config) => {
    if (config.indexName === KP_POLICY_INDEX) {
      return true;
    }

    if (!activeFilters.enabled || activeFilters.contentType === 'both') {
      return true;
    }

    const isAssetIndex = config.indexName === 'infosource_assets_2026-03-25';
    return activeFilters.contentType === 'asset' ? isAssetIndex : !isAssetIndex;
  });

  const indexResults = await Promise.all(
    scopedIndexConfigs.map(async (indexConfig) => {
      const queryFilter = buildIndexQueryFilter(indexConfig.indexName, activeFilters);

      try {
        const rawResults = await searchInfoSourceIndex({
          searchIndex: indexConfig.indexName,
          selectFields: indexConfig.selectFields,
          searchEmbedding: state.promptEmbedding,
          nearestNeighbors: indexConfig.nearestNeighbors,
          queryText: retrievalQuery,
          filter: queryFilter,
          contentVectorField: indexConfig.contentVectorField || 'content_vector',
          semanticConfiguration: indexConfig.semanticConfiguration
        });

        const results = (Array.isArray(rawResults) ? rawResults : []).filter((result) => {
          const document = result?.document || {};
          return resultMatchesFilters(document, indexConfig.indexName, activeFilters);
        });

        return {
          indexName: indexConfig.indexName,
          results: Array.isArray(results) ? results : [],
          error: null,
          filter: queryFilter
        };
      } catch (error) {
        return {
          indexName: indexConfig.indexName,
          results: [],
          error: error?.message || 'Unknown retrieval error',
          filter: queryFilter
        };
      }
    })
  );

  const successfulIndexes = indexResults.filter((entry) => !entry.error).length;
  const failedIndexes = indexResults.length - successfulIndexes;
  const totalResults = indexResults.reduce((count, entry) => count + entry.results.length, 0);

  let dataSource = 'live';
  if (successfulIndexes === 0) {
    dataSource = 'retrieval-unavailable';
  } else if (totalResults === 0) {
    dataSource = 'live-empty';
  } else if (failedIndexes > 0) {
    dataSource = 'partial-live';
  }

  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'InfoSourceDedicatedGraphIndexTelemetry',
      detail: {
        smartNoteId: state.smartNoteId,
        promptLength: prompt.length,
        indexes: indexResults.map((entry) => ({
          indexName: entry.indexName,
          resultCount: entry.results.length,
          error: entry.error,
          filter: entry.filter
        })),
        dataSource,
        totalResults,
        activeFilters: summarizeActiveFilters(activeFilters)
      }
    }
  }));

  if (INFO_SOURCE_DEBUG_RESULTS) {
    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'InfoSourceSearchResultsDebug',
        detail: {
          smartNoteId: state.smartNoteId,
          prompt: prompt.slice(0, 350),
          retrievalQuery: String(retrievalQuery || '').slice(0, 600),
          indexes: indexResults.map((entry) => ({
            indexName: entry.indexName,
            error: entry.error,
            filter: entry.filter,
            resultCount: entry.results.length,
            topHits: (entry.results || []).slice(0, 8).map((result) => buildDebugSearchHitPreview(result, entry.indexName))
          }))
        }
      }
    }));
  }

  const contextMessages = [];
  const citations = [];
  const dedupe = new Set();
  const queryTerms = extractQueryTerms(prompt, retrievalQuery);

  indexResults.forEach((entry) => {
    const sortedResults = sortResultsByRecency(entry.results);

    const scoredResults = sortedResults.map((result) => {
      const document = result?.document || {};
      const associationText = buildRetrievalAssociationText(document);
      const termMatches = countQueryTermMatches(associationText, queryTerms);
      return {
        result,
        termMatches,
        weightedScore: getSearchScore(result) + getRecencyBoost(result)
      };
    });

    const matchedResults = scoredResults.filter((item) => item.termMatches > 0);
    const focusedResults = (matchedResults.length > 0 ? matchedResults : scoredResults)
      .sort((left, right) => {
        if (right.termMatches !== left.termMatches) {
          return right.termMatches - left.termMatches;
        }
        if (right.weightedScore !== left.weightedScore) {
          return right.weightedScore - left.weightedScore;
        }
        return 0;
      })
      .slice(0, Math.max(1, MAX_CITATIONS_PER_INDEX));

    focusedResults.forEach(({ result }) => {
      const document = result?.document || {};
      const isKpPolicy = entry.indexName === KP_POLICY_INDEX;
      const policyMetadata = isKpPolicy ? resolveKpPolicyMetadata(document) : null;
      const source = pickFirstDefined(
        policyMetadata?.sourceTitle,
        document.document_title,
        document.title,
        buildReadableTitleFromPath(document.path),
        document.path,
        document.section_title,
        'InfoSource document'
      );
      const url = isKpPolicy
        ? policyMetadata.url
        : pickFirstDefined(document.document_path, document.path);
      const sectionTitle = isKpPolicy
        ? policyMetadata.sectionTitle
        : pickFirstDefined(document.section_title);
      const snippetSourceText = pickFirstDefined(document.section_title, document.content, document.keywords_text, document.category_text) || null;
      const keywordText = !isKpPolicy && Array.isArray(document.keywords) ? document.keywords.slice(0, 6).join(', ') : null;
      const categoryText = Array.isArray(document.category) ? document.category.slice(0, 4).join(', ') : null;
      const owner = pickFirstDefined(policyMetadata?.documentOwner, document.document_owner, document.content_owner, document.owner);
      const market = pickFirstDefined(policyMetadata?.region, document.market, document.region);
      const status = pickFirstDefined(document.asset_status, document.status);
      const evidenceText = buildCitationEvidenceText(document, entry.indexName, queryTerms);
      const lastUpdated = pickFirstDefined(policyMetadata?.lastUpdated, document.last_reviewed, document.last_reviewed_updated, document.last_published);
      const relevanceSnippet = createRelevantSnippet(evidenceText || snippetSourceText, queryTerms);

      contextMessages.push({
        role: 'assistant',
        content: [
          `index: ${entry.indexName}`,
          `source: ${source}`,
          sectionTitle ? `section_title: ${sectionTitle}` : null,
          relevanceSnippet ? `evidence_snippet: ${relevanceSnippet}` : null,
          pickFirstDefined(document.uniqueId, document.unique_id) ? `unique_id: ${pickFirstDefined(document.uniqueId, document.unique_id)}` : null,
          keywordText ? `keywords: ${keywordText}` : null,
          categoryText ? `category: ${categoryText}` : null,
          market ? `market: ${market}` : null,
          owner ? `owner: ${owner}` : null,
          status ? `status: ${status}` : null,
          document.market_owner ? `market_owner: ${document.market_owner}` : null,
          document.line_of_business ? `line_of_business: ${document.line_of_business}` : null,
          document.role ? `role: ${document.role}` : null,
          document.function ? `function: ${document.function}` : null,
          lastUpdated ? `last_updated: ${lastUpdated}` : null,
          document.published_date ? `published_date: ${document.published_date}` : null,
          document.last_published ? `last_published: ${document.last_published}` : null,
          url ? `url: ${url}` : null
        ].filter(Boolean).join(', ')
      });

      const normalizedUrl = normalizeInfoSourceLink(url);
      const citationKey = isKpPolicy
        ? buildKpPolicyCitationKey(document, normalizedUrl)
        : `${entry.indexName}::${normalizedUrl || source}`;

      const citation = {
        id: document.id || `${entry.indexName}-${source}`,
        citationKey,
        indexName: entry.indexName,
        citationType: isKpPolicy
          ? policyMetadata.citationType
          : (entry.indexName === 'infosource_assets_2026-03-25' ? 'infosource-asset' : 'infosource-page'),
        source,
        sourceTitle: source,
        region: market,
        owner,
        documentOwner: owner,
        lastUpdated,
        sourceLabel: isKpPolicy ? policyMetadata.sourceLabel : null,
        keywords: isKpPolicy ? policyMetadata.keywords : (Array.isArray(document.keywords) ? document.keywords : []),
        url: normalizedUrl,
        searchScore: typeof result?.score === 'number' ? result.score : null,
        rerankerScore: typeof result?.rerankerScore === 'number' ? result.rerankerScore : null,
        relevanceSnippet,
        rawEvidenceText: evidenceText,
        associationText: [
          source,
          sectionTitle,
          keywordText,
          categoryText,
          market,
          document.document_owner,
          document.content_owner,
          document.market_owner,
          document.asset_status,
          document.line_of_business,
          document.role,
          document.function,
          document.uniqueId,
          document.unique_id
        ].filter(Boolean).join(' | '),
        trace: {
          route: 'submitInfoSourceAssistant',
          indexName: entry.indexName,
          citationKey,
          sourceDocumentId: document.id || null,
          sourceUniqueId: pickFirstDefined(document.uniqueId, document.unique_id) || null,
          sourcePath: url || null,
        },
        // Pass complete retrievable fields to the page for richer UX rendering.
        document
      };

      const key = citation.citationKey;
      if (!dedupe.has(key)) {
        dedupe.add(key);
        citations.push(citation);
      }
    });
  });

  return {
    infoSourceContextMessages: contextMessages,
    citations,
    retrievalDiagnostics: {
      dataSource,
      successfulIndexes,
      failedIndexes,
      totalResults,
      activeFilters: summarizeActiveFilters(activeFilters),
      searchResults: indexResults.map((entry) => ({
        indexName: entry.indexName,
        error: entry.error,
        filter: entry.filter,
        resultCount: entry.results.length,
        topHits: (entry.results || []).slice(0, 8).map((result) => buildDebugSearchHitPreview(result, entry.indexName))
      }))
    }
  };
};

const addChatHistoryNode = async (state) => {
  await reportInfoSourceProgress(state, 'Loading recent chat context...');
  let chatInteractions = await selectChatInteractions({
    type: 'ChatInteraction',
    parentId: state.chatInteraction.parentId
  }, state.teamName);

  chatInteractions = chatInteractions
    .filter((interaction) => interaction.isComplete)
    .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
    .slice(-10);

  const chatHistory = [];
  chatInteractions.forEach((interaction) => {
    chatHistory.push({ role: 'user', content: interaction.prompt });
    chatHistory.push({ role: 'assistant', content: interaction.response });
  });

  return { chatHistory };
};

const enrichPromptNode = async (state) => {
  await reportInfoSourceProgress(state, 'Building response context...');
  const context = (state.infoSourceContextMessages || []).map((message) => message.content).join('\n');
  const retrievalMode = state.retrievalDiagnostics?.dataSource || 'live';
  const citationGuide = (state.citations || []).map((citation, index) => {
    const marker = `[${index + 1}]`;
    const location = citation.region ? `region: ${citation.region}` : null;
    const owner = citation.owner ? `owner: ${citation.owner}` : null;
    const updated = citation.lastUpdated ? `last_updated: ${citation.lastUpdated}` : null;
    const url = citation.url ? `url: ${citation.url}` : null;
    return `${marker} source: ${citation.source}${[location, owner, updated, url].filter(Boolean).length ? ` (${[location, owner, updated, url].filter(Boolean).join(', ')})` : ''}`;
  }).join('\n');

  const enrichedPrompt = [
    'Use only the InfoSource context below when possible. If context is insufficient, explicitly state that.',
    'Citations are required for every factual claim from context. Use bracket references like [1], [2], [3] in the response body exactly.',
    'Use only citation numbers listed in the Citation Catalog. Do not invent citation numbers.',
    retrievalMode !== 'live' ? `Retrieval mode: ${retrievalMode}. Some InfoSource indexes may be unavailable or returned no results.` : null,
    '',
    'Citation Catalog:',
    citationGuide || 'No citations available for this query.',
    '',
    context || 'No InfoSource context was retrieved for this prompt.',
    '',
    `User question is: ${state.chatInteraction.prompt}`
  ].filter(Boolean).join('\n');

  return { enrichedPrompt };
};

function isOutOfScopeInfoSourceResponse(responseText = '') {
  const normalized = String(responseText || '').toLowerCase();
  if (!normalized) {
    return false;
  }

  return [
    'unrelated to kp and infosource',
    'appropriate kp staff',
    'hpais support team',
    'out of scope for infosource'
  ].some((marker) => normalized.includes(marker));
}

function stripCitationArtifactsFromMarkdown(responseText = '') {
  return String(responseText || '')
    .replace(/\[(\d+)\]/g, '')
    .replace(/\n\n(?:Source references|Additional supporting sources):[^\n]*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function reconcileMarkdownAndCitations(markdownResponse, citations = []) {
  const originalMarkdown = markdownResponse || '';
  if (!Array.isArray(citations) || citations.length === 0) {
    return {
      markdown: originalMarkdown,
      responseCitations: []
    };
  }

  const codeAwareParts = originalMarkdown.split(/(```[\s\S]*?```)/g);
  const referenced = [];
  const seen = new Set();

  codeAwareParts.forEach((part) => {
    if (part.startsWith('```')) {
      return;
    }

    const regex = /\[(\d+)\]/g;
    let match;
    while ((match = regex.exec(part)) !== null) {
      const parsed = Number.parseInt(match[1], 10);
      if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= citations.length && !seen.has(parsed)) {
        seen.add(parsed);
        referenced.push(parsed);
      }
    }
  });

  const maxAllowed = Math.min(MAX_TOTAL_CITATIONS, citations.length);
  const targetCount = Math.min(maxAllowed, Math.max(referenced.length, Math.min(MIN_CITATIONS_FLOOR, citations.length)));

  const responseForMatching = stripCitationMarkers(stripCodeBlocks(originalMarkdown)).toLowerCase();
  const rankedSupplemental = citations
    .map((citation, index) => ({ marker: index + 1, score: scoreCitationAssociation(citation, responseForMatching) }))
    .filter((item) => !seen.has(item.marker) && item.score > 0)
    .sort((left, right) => right.score - left.score);

  const supplemental = [];
  for (const candidate of rankedSupplemental) {
    supplemental.push(candidate.marker);
    if (referenced.length + supplemental.length >= targetCount) {
      break;
    }
  }

  if (referenced.length + supplemental.length < targetCount) {
    for (let marker = 1; marker <= citations.length; marker += 1) {
      if (seen.has(marker) || supplemental.includes(marker)) {
        continue;
      }
      supplemental.push(marker);
      if (referenced.length + supplemental.length >= targetCount) {
        break;
      }
    }
  }

  const finalMarkerOrder = [...referenced, ...supplemental];

  if (finalMarkerOrder.length === 0) {
    return {
      markdown: originalMarkdown,
      responseCitations: []
    };
  }

  const oldToNewMarkerMap = new Map();
  finalMarkerOrder.forEach((oldMarker, index) => {
    oldToNewMarkerMap.set(oldMarker, index + 1);
  });

  const remappedMarkdown = codeAwareParts.map((part) => {
    if (part.startsWith('```')) {
      return part;
    }

    return part.replace(/\[(\d+)\]/g, (fullMatch, markerValue) => {
      const parsed = Number.parseInt(markerValue, 10);
      if (Number.isNaN(parsed)) {
        return fullMatch;
      }
      if (!oldToNewMarkerMap.has(parsed)) {
        return fullMatch;
      }
      return `[${oldToNewMarkerMap.get(parsed)}]`;
    });
  }).join('');

  const supplementalNewMarkers = supplemental
    .map((oldMarker) => oldToNewMarkerMap.get(oldMarker))
    .filter(Boolean);

  let finalMarkdown = remappedMarkdown;
  if (referenced.length === 0) {
    finalMarkdown = finalMarkdown
      ? `${finalMarkdown}\n\nSource references: [1]`
      : 'Source references: [1]';
  } else if (supplementalNewMarkers.length > 0) {
    const markerList = supplementalNewMarkers.map((marker) => `[${marker}]`).join(', ');
    finalMarkdown = `${finalMarkdown}\n\nAdditional supporting sources: ${markerList}`;
  }

  const responseCitations = finalMarkerOrder.map((oldMarker) => citations[oldMarker - 1]).filter(Boolean);

  return {
    markdown: finalMarkdown,
    responseCitations
  };
}

function stripCodeBlocks(value = '') {
  return String(value || '').replace(/```[\s\S]*?```/g, ' ');
}

function stripCitationMarkers(value = '') {
  return String(value || '').replace(/\[(\d+)\]/g, ' ');
}

function tokenizeForAssociation(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4)
    .slice(0, 50);
}

function scoreCitationAssociation(citation, responseText) {
  if (!responseText) {
    return 0;
  }

  let score = 0;
  const source = String(citation?.source || '').toLowerCase();
  if (source && responseText.includes(source)) {
    score += 4;
  }

  const region = String(citation?.region || '').toLowerCase();
  if (region && region.length > 2 && responseText.includes(region)) {
    score += 1.5;
  }

  const associationTokens = tokenizeForAssociation(citation?.associationText || citation?.source || '');
  const uniqueTokens = [...new Set(associationTokens)].slice(0, 20);
  uniqueTokens.forEach((token) => {
    if (responseText.includes(token)) {
      score += 0.35;
    }
  });

  return score;
}

function streamTextInChunks(sendEvent, text) {
  if (!text) {
    return;
  }

  const chunkSize = 180;
  for (let index = 0; index < text.length; index += chunkSize) {
    sendEvent({ type: 'data', data: text.slice(index, index + chunkSize) });
  }
}

const chatCompletionMarkdownNode = async (state) => {
  await reportInfoSourceProgress(state, 'Drafting ISA response...');
  const chatCompletionConfig = await getDefaultChatCompletionConfig(state.teamName, state.assistantName);

  const messages = [
    ...(state.systemPrompt ? [{ role: 'system', content: state.systemPrompt }] : []),
    ...(state.personaPrompt ? [{ role: 'system', content: state.personaPrompt }] : []),
    {
      role: 'system',
      content: INFO_SOURCE_SYSTEM_CONTEXT
    },
    ...state.chatHistory,
    { role: 'user', content: state.enrichedPrompt }
  ];

  let streamedRawResponse = '';

  const markdownResponse = await chatCompletionMarkdown({
    messages,
    onToken: (content) => {
      streamedRawResponse += content || '';
    },
    teamName: state.teamName,
    assistantName: state.assistantName,
    chatCompletionConfig: {
      // Force deterministic behavior for InfoSource to reduce answer drift across paraphrased follow-ups.
      temperature: 0,
      max_tokens: chatCompletionConfig?.max_tokens,
      model: chatCompletionConfig?.model
    }
  });

  const finalMarkdown = markdownResponse || streamedRawResponse || '';
  const isOutOfScope = isOutOfScopeInfoSourceResponse(finalMarkdown);
  const reconciliation = isOutOfScope
    ? {
      markdown: stripCitationArtifactsFromMarkdown(finalMarkdown),
      responseCitations: []
    }
    : reconcileMarkdownAndCitations(finalMarkdown, state.citations || []);

  streamTextInChunks(state.sendEvent, reconciliation.markdown);

  return {
    markdownResponse: reconciliation.markdown,
    responseCitations: reconciliation.responseCitations
  };
};

const alignResponseCitationContentNode = async (state) => {
  await reportInfoSourceProgress(state, 'Aligning citation evidence to response...');

  const responseCitations = Array.isArray(state.responseCitations) ? state.responseCitations : [];
  const retrievalCitations = Array.isArray(state.citations) ? state.citations : [];
  const citationsForAlignment = responseCitations.length > 0
    ? responseCitations
    : retrievalCitations.slice(0, Math.min(MAX_TOTAL_CITATIONS, Math.max(MIN_CITATIONS_FLOOR, 2)));

  if (citationsForAlignment.length === 0) {
    return { responseCitations: [] };
  }

  const responseText = stripCitationMarkers(stripCodeBlocks(state.markdownResponse || ''));
  const claimsByMarker = extractCitationClaimsByMarker(state.markdownResponse || '', citationsForAlignment.length);
  const citationQueryTerms = extractQueryTerms(
    state.chatInteraction?.prompt || '',
    state.retrievalQuery || '',
    responseText
  );

  const citationInputs = citationsForAlignment
    .map((citation, index) => ({
      marker: index + 1,
      citationKey: citation.citationKey || citation.id,
      source: citation.source,
      claimExcerpt: claimsByMarker.get(index + 1) || '',
      evidenceText: normalizeSnippetText(citation.rawEvidenceText || citation.relevanceSnippet || '').slice(0, 3200)
    }))
    .filter((item) => item.evidenceText);

  if (citationInputs.length === 0) {
    return {
      responseCitations: citationsForAlignment.map((citation, index) => ({
        ...citation,
        citationContent: buildDeterministicCitationContent(
          citation,
          claimsByMarker.get(index + 1) || '',
          citationQueryTerms
        )
      }))
    };
  }

  try {
    const messages = [
      {
        role: 'system',
        content: [
          'You align citation details to an already-written response using provided evidence only.',
          'Return ONLY a JSON array.',
          'Each item must be: {"citationKey":"...","citationContent":"..."}.',
          'citationContent rules:',
          '1) Start with one short sentence that states what part of the response this evidence supports.',
          '2) Include 1-2 direct quotes from evidenceText in double quotes whenever available.',
          '3) Keep wording grounded in evidenceText only; do not invent facts.',
          '4) Prioritize quote spans that directly support claimExcerpt, not navigation/chrome text.',
          '5) Ignore page chrome and utility text such as menus, bookmarks, profile, logout, search controls, logos, and edit-page metadata.',
          '6) Prefer concrete, specific source language over abstract paraphrase.',
          '7) No markdown and no extra keys.'
        ].join(' ')
      },
      {
        role: 'user',
        content: JSON.stringify({
          question: state.chatInteraction?.prompt || '',
          response: responseText,
          citations: citationInputs
        })
      }
    ];

    const completion = await chatCompletion({
      messages,
      temperature: 0,
      max_tokens: 1600,
      model: 'gpt-4o',
      assistantName: state.assistantName,
      teamName: state.teamName,
      nuid: state.nuid
    });

    const parsed = extractJsonArrayFromText(completion);
    const contentByKey = new Map();

    if (Array.isArray(parsed)) {
      parsed.forEach((item) => {
        const key = String(item?.citationKey || '').trim();
        const content = normalizeSnippetText(item?.citationContent || '');
        if (key && content) {
          contentByKey.set(key, content);
        }
      });
    }

    return {
      responseCitations: citationsForAlignment.map((citation, index) => {
        const key = citation.citationKey || citation.id;
        const generated = contentByKey.get(key);
        return {
          ...citation,
          citationContent: ensureSubstantialCitationContent(
            citation,
            generated || buildDeterministicCitationContent(citation, claimsByMarker.get(index + 1) || '', citationQueryTerms),
            citationQueryTerms
          )
        };
      })
    };
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'InfoSourceCitationAlignmentFailed',
        detail: {
          smartNoteId: state.smartNoteId,
          error: error?.message || 'Unknown error'
        }
      }
    }));

    return {
      responseCitations: citationsForAlignment.map((citation, index) => ({
        ...citation,
        citationContent: buildDeterministicCitationContent(
          citation,
          claimsByMarker.get(index + 1) || '',
          citationQueryTerms
        )
      }))
    };
  }
};

const chatCompletionPromptsNode = async (state) => {
  await reportInfoSourceProgress(state, 'Generating suggested follow-up prompts...');
  if (isOutOfScopeInfoSourceResponse(state.markdownResponse)) {
    const payload = {
      suggestedPrompts: '',
      citations: [],
      retrieval: state.retrievalDiagnostics || null
    };

    state.sendEvent({ type: 'data', data: JSON.stringify(payload) });
    return { suggestedPrompts: '' };
  }

  const promptMessages = [
    {
      role: 'system',
      content: [
        'Generate suggested follow-up prompts for the InfoSource assistant only.',
        'Allowed scope: InfoSource business content, document lookup, benefits, policy, sales, market, product, and plan guidance.',
        'Do not suggest prompts that ask for technical support, coding, infrastructure, system design, debugging, admin tasks, cybersecurity, penetration testing, secrets, authentication bypass, or policy evasion.',
        'Do not suggest prompts that are out of context for InfoSource.',
        'If the user prompt appears out of context for InfoSource based on the response, return an empty string (no suggestions).',
        'Return exactly 3 prompts, plain text only, separated by ~!~, and do not number them.'
      ].join(' ')
    },
    {
      role: 'user',
      content: `Based on this response, provide 3 safe in-scope follow-up prompts: ${state.markdownResponse}`
    }
  ];

  const suggestedPrompts = await chatCompletionPrompts({
    messages: promptMessages,
    teamName: state.teamName,
    assistantName: state.assistantName
  });

  const payload = {
    suggestedPrompts,
    citations: state.responseCitations || [],
    retrieval: state.retrievalDiagnostics || null
  };

  state.sendEvent({ type: 'data', data: JSON.stringify(payload) });
  return { suggestedPrompts };
};

const StateAnnotation = Annotation.Root({
  nuid: Annotation,
  smartNoteId: Annotation,
  teamName: Annotation,
  assistantName: Annotation,
  sources: Annotation,
  infoSourceFilters: Annotation,
  chatInteraction: Annotation,
  userSelectedPersona: Annotation,
  systemPrompt: Annotation,
  personaPrompt: Annotation,
  promptEmbedding: Annotation,
  retrievalQuery: Annotation,
  infoSourceContextMessages: Annotation,
  citations: Annotation,
  retrievalDiagnostics: Annotation,
  responseCitations: Annotation,
  chatHistory: Annotation,
  enrichedPrompt: Annotation,
  markdownResponse: Annotation,
  suggestedPrompts: Annotation,
  sendEvent: Annotation,
  onProgress: Annotation
});

const infoSourceSubmissionGraph = new StateGraph(StateAnnotation)
  .addNode('smartNotesNode', smartNotesNode)
  .addNode('systemPromptNode', systemPromptNode)
  .addNode('personaNode', personaNode)
  .addNode('expandSearchQueryNode', expandSearchQueryNode)
  .addNode('vectorizePromptNode', vectorizePromptNode)
  .addNode('retrieveInfoSourceNode', retrieveInfoSourceNode)
  .addNode('addChatHistoryNode', addChatHistoryNode)
  .addNode('enrichPromptNode', enrichPromptNode)
  .addNode('chatCompletionMarkdownNode', chatCompletionMarkdownNode)
  .addNode('alignResponseCitationContentNode', alignResponseCitationContentNode)
  .addNode('chatCompletionPromptsNode', chatCompletionPromptsNode)
  .addEdge(START, 'smartNotesNode')
  .addEdge('smartNotesNode', 'systemPromptNode')
  .addEdge('systemPromptNode', 'personaNode')
  .addEdge('personaNode', 'expandSearchQueryNode')
  .addEdge('expandSearchQueryNode', 'vectorizePromptNode')
  .addEdge('vectorizePromptNode', 'retrieveInfoSourceNode')
  .addEdge('retrieveInfoSourceNode', 'addChatHistoryNode')
  .addEdge('addChatHistoryNode', 'enrichPromptNode')
  .addEdge('enrichPromptNode', 'chatCompletionMarkdownNode')
  .addEdge('chatCompletionMarkdownNode', 'alignResponseCitationContentNode')
  .addEdge('alignResponseCitationContentNode', 'chatCompletionPromptsNode')
  .addEdge('chatCompletionPromptsNode', END)
  .compile();

function normalizeInfoSourceLink(value) {
  if (!value) {
    return null;
  }
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  if (value.startsWith('/')) {
    return `https://infosource.kp.org${value}`;
  }
  return `https://infosource.kp.org/${value}`;
}

export async function runInfoSourceSubmission({
  nuid,
  smartNoteId,
  sources,
  infoSourceFilters,
  chatInteraction,
  teamName,
  assistantName,
  sendEvent = () => { },
  onProgress,
}) {
  const result = await infoSourceSubmissionGraph.invoke({
    nuid,
    smartNoteId,
    sources,
    infoSourceFilters,
    chatInteraction,
    teamName,
    assistantName,
    sendEvent,
    onProgress,
  });

  const responseCitations = Array.isArray(result?.responseCitations) ? result.responseCitations : [];
  const retrievalCitations = Array.isArray(result?.citations) ? result.citations : [];
  const citations = responseCitations.length > 0
    ? responseCitations
    : retrievalCitations.slice(0, Math.min(MAX_TOTAL_CITATIONS, Math.max(MIN_CITATIONS_FLOOR, 2)));
  const responseHasCitationMarkers = /\[(\d+)\]/.test(String(result?.markdownResponse || ''));
  const fallbackMarkerList = citations.map((_, index) => `[${index + 1}]`).join(', ');
  const markdownResponse = (!responseHasCitationMarkers && citations.length > 0)
    ? `${result?.markdownResponse || ''}\n\nSource references: ${fallbackMarkerList}`
    : (result?.markdownResponse || '');

  return {
    markdownResponse,
    suggestedPrompts: Array.isArray(result?.suggestedPrompts) ? result.suggestedPrompts : [],
    responseCitations: citations,
    retrievalDiagnostics: result?.retrievalDiagnostics || null,
  };
}

export async function infoSourceSubmitGraphStream({ nuid, smartNoteId, sources, infoSourceFilters, chatInteraction, teamName, assistantName }) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        await runInfoSourceSubmission({
          nuid,
          smartNoteId,
          sources,
          infoSourceFilters,
          chatInteraction,
          teamName,
          assistantName,
          sendEvent: (event) => {
            if (event.type === 'data') {
              controller.enqueue(encoder.encode(event.data));
            }
          }
        });
      } catch (error) {
        console.error(JSON.stringify({
          kpmsg: {
            id: 'AI_PORTAL_NOTEBOOK',
            name: 'InfoSourceDedicatedGraphFailed',
            detail: {
              smartNoteId,
              teamName,
              assistantName,
              error: error?.message || 'Unknown error'
            }
          }
        }));

        controller.enqueue(encoder.encode('Unable to complete InfoSource retrieval for this request. Please try again.'));
        controller.enqueue(encoder.encode(JSON.stringify({
          suggestedPrompts: [],
          citations: [],
          retrieval: { dataSource: 'graph-error' }
        })));
      }

      controller.close();
    }
  });

  return stream;
}
