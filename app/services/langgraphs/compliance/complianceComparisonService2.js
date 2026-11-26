import { Annotation, StateGraph, START, END } from '../langgraph-light.js';
import { AzureOpenAI } from 'openai';
import { SearchClient, AzureKeyCredential } from '@azure/search-documents';
import ExcelJS from 'exceljs-hardened';
import { connectToDatabase } from '@/db/connection';
import { writeFileBufferToBlobStorage, generateTemporaryDownloadLink } from '@/app/services/blobStorageService';
import { getCompletionsClient, deleteGeisingerComparisonByLobFileAFile } from '@/app/services/chatCompletionService2.js';
import {
  updateChatInteractionProgress,
  createProgressMarkdown,
  isChatInteractionCancelledError,
  updateChatInteractionStatus,
} from './helpers/progressTracking.js';
import { loadComparisonConfigV2 } from './helpers/loadComparisonConfigV2.js';
import { selectGeisingerConfigContextDocuments } from '@/app/services/geisingerConfigService';

// Helper to determine if the current job is a Comprehensive Comparison
function isComprehensiveComparisonJob(state, config) {
  // Check by explicit flag, mode, or keywords
  const mode = String(state?.comparisonMode || state?.requestedComparisonMode || '').toLowerCase();
  if (mode.includes('comprehensive')) return true;
  if (config?.mode?.comprehensiveKeywords) {
    const prompt = String(state?.userPrompt || '').toLowerCase();
    return config.mode.comprehensiveKeywords.some((kw) => prompt.includes(kw));
  }
  return false;
}

// Utility to strip markdown for spreadsheet output
function markdownToPlainText(markdown = '') {
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^\)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const SEARCH_INDEX_NAME = 'geisinger-002';
const GEISINGER_COLLECTION = 'user_collection';
const CURRENT_PREPARATION_VERSION = String(process.env.GEISINGER_PREPARATION_VERSION || '1').trim();

const HARD_CODED_COMPARISON_CONFIG = {
  mode: {
    comprehensiveKeywords: [
      'whole document',
      'entire document',
      'comprehensive comparison',
      'full comparison',
      'compare documents',
      'all differences',
      'complete comparison',
      'overall differences',
      'structural differences',
      'content differences',
    ],
  },
  retrieval: {
    searchFields: ['content', 'title', 'smart_file_name'],
    selectFields: ['id', 'smartnote_id', 'smart_file_name', 'title', 'content', 'page', 'createdAt'],
    topicMode: {
      keywordTop: 70,
      semanticTop: 70,
      maxVariants: 4,
      maxCandidatesAfterMerge: 220,
      evidencePerDocument: 16,
      evidenceSnippetMaxLength: 1600,
      listRescueEnabled: true,
      listRescueTop: 1200,
      listRescueMaxAdditions: 300,
      listRescueMinRoleCandidates: 2,
      listMinRoleEvidenceInFinal: 8,
      topicExpansionEnabled: true,
      topicExpansionMaxQueries: 4,
      topicExpansionQueriesForPositions: [
        'administrative positions',
        'key administrative positions',
        'key personnel positions',
        'positions must be reported',
      ],
      listDeterministicScanEnabled: true,
      listDeterministicScanEvidencePerDocument: 60,
    },
    comprehensiveMode: {
      maxSectionsPerDocument: 220,
      chunkFetchTop: 1200,
      minTitleLength: 2,
      minContentLength: 20,
    },
  },
  ranking: {
    scoreWeight: 1,
    exactSectionBoost: 3.5,
    titleTermBoost: 1.2,
    contentTermBoost: 0.4,
    exactPromptBoost: 2,
    listRoleSignalBoost: 6,
    listHeadingBoost: 4,
    listStructureBoost: 2,
    listOffTopicPenalty: 8,
    variantBoost: {
      exact: 0.8,
      normalized: 0.5,
      sectionOnly: 0.7,
      quotedClause: 0.3,
    },
  },
  alignment: {
    similarityThreshold: 0.55,
    autoMatchThreshold: 0.86,
    llmAdjudicationThreshold: 0.72,
    secondaryMatchThreshold: 0.88,
    maxTargetCandidatesPerSource: 4,
    fallbackSearch: {
      enabled: true,
      onlyWhenNoPrimaryCandidate: true,
      maxVariants: 2,
      keywordTop: 18,
      semanticTop: 18,
      maxCandidatesAfterMerge: 32,
      maxTargetCandidatesPerSource: 3,
      autoMatchThreshold: 0.9,
      llmAdjudicationThreshold: 0.6,
      maxSourceOnlyTopicsToProbe: 20,
    },
  },
  completion: {
    preferredModels: ['openai-5.1', 'gpt-4o'],
    temperature: 0.2,
    maxTokens: 1400,
    maxShortTokens: 800,
  },
  runtime: {
    display: {
      topicEvidenceLimit: 10,
      topicListDeltaMaxItems: 20,
    },
  },
};

function logComparisonEvent(name, detail = {}) {
  console.log(JSON.stringify({
    kpmsg_name: name,
    kpmsg_id: 'AI_PORTAL_NOTEBOOK',
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name,
      detail,
    }
  }));
}

async function writeTopicComparisonDebugArtifact(name, detail = {}) {
  const topicDebugEnabled = String(process.env.COMPLIANCE_COMPARISON_TOPIC_DEBUG || 'true').toLowerCase() !== 'false';
  if (!topicDebugEnabled) return;

  try {
    const [{ appendFile, mkdir }, pathModule] = await Promise.all([
      import('fs/promises'),
      import('path')
    ]);

    const relativePath = String(
      process.env.COMPLIANCE_COMPARISON_TOPIC_DEBUG_PATH || 'comparison-topic-debug.jsonl'
    ).trim();
    const outputPath = pathModule.resolve(process.cwd(), relativePath);
    await mkdir(pathModule.dirname(outputPath), { recursive: true });

    const payload = {
      timestamp: new Date().toISOString(),
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name,
        detail,
      },
      topicComparison: true,
    };

    await appendFile(outputPath, `${JSON.stringify(payload)}\n`, 'utf8');
  } catch (error) {
    logComparisonEvent('complianceComparisonTopicFileLogWriteFailed', {
      eventName: name,
      error: error?.message || String(error),
    });
  }
}

async function logTopicComparisonEvent(name, detail = {}) {
  logComparisonEvent(name, detail);
  await writeTopicComparisonDebugArtifact(name, detail);
}

function isTopicComparisonState(state = {}) {
  const requested = String(state?.requestedComparisonMode || '').trim().toLowerCase();
  const resolved = String(state?.comparisonMode || '').trim().toLowerCase();
  return requested === 'topic' || resolved === 'topic';
}

function parseProgressStageFromMarkdown(markdown = '') {
  const text = String(markdown || '');
  const match = text.match(/Processing:\s*([^\n\r]+)/i);
  return String(match?.[1] || '').trim();
}

function computeMessageHash(text = '') {
  // Lightweight deterministic hash to correlate repeated payloads across polling cycles.
  const source = String(text || '');
  let hash = 5381;
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) + hash) + source.charCodeAt(i);
    hash &= 0xffffffff;
  }
  return `h${(hash >>> 0).toString(16)}`;
}

async function readTopicComparisonProgressSnapshot(state) {
  const teamName = String(state?.teamName || '').trim();
  const chatInteractionId = String(state?.chatInteractionId || '').trim();
  if (!teamName || !chatInteractionId) return null;

  try {
    const db = await connectToDatabase(`team-${teamName}-db`);
    const strictQuery = {
      type: 'ChatInteraction',
      id: chatInteractionId,
      ...(state?.chatId ? { parentId: state.chatId } : {}),
    };

    let doc = await db.collection('user_collection').findOne(
      strictQuery,
      { projection: { id: 1, parentId: 1, isComplete: 1, response: 1, updatedAt: 1 } }
    );

    if (!doc && state?.chatId) {
      doc = await db.collection('user_collection').findOne(
        { type: 'ChatInteraction', id: chatInteractionId },
        { projection: { id: 1, parentId: 1, isComplete: 1, response: 1, updatedAt: 1 } }
      );
    }

    if (!doc) {
      return {
        found: false,
      };
    }

    const responseText = String(doc?.response || '');
    return {
      found: true,
      parentId: String(doc?.parentId || ''),
      isComplete: doc?.isComplete === true,
      responseLength: responseText.length,
      responseHash: computeMessageHash(responseText),
      responsePreview: truncateText(responseText.replace(/\s+/g, ' ').trim(), 180),
      updatedAt: doc?.updatedAt || null,
    };
  } catch (error) {
    return {
      found: false,
      readError: error?.message || String(error),
    };
  }
}

async function fetchComparisonConfigDocumentsV2() {
  const collectionNames = ['Document Comparison V2 Config', 'Document Comparison'];
  const all = [];
  const seen = new Set();
  let invalidDocumentCount = 0;

  for (const collectionName of collectionNames) {
    try {
      const { data } = await selectGeisingerConfigContextDocuments({
        type: 'GeisingerConfig',
        collectionName,
      });

      for (const doc of Array.isArray(data) ? data : []) {
        const documentText = String(doc?.documentText || '').trim();
        if (!documentText) {
          invalidDocumentCount += 1;
          continue;
        }

        const key = String(doc?.id || `${collectionName}:${doc?.title || ''}`).trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        all.push({ ...doc, documentText });
      }
    } catch (error) {
      logComparisonEvent('comparisonV2GeisingerConfigFetchFailed', {
        collectionName,
        error: error?.message || String(error),
      });
    }
  }

  if (invalidDocumentCount > 0) {
    logComparisonEvent('comparisonV2GeisingerConfigInvalidDocumentsSkipped', {
      invalidDocumentCount,
    });
  }

  return all;
}

async function writeComparisonDebugArtifact(payload = {}) {
  if (String(process.env.COMPLIANCE_COMPARISON_DEBUG || '').toLowerCase() !== 'true') {
    return;
  }

  try {
    const [{ appendFile, mkdir }, pathModule] = await Promise.all([
      import('fs/promises'),
      import('path')
    ]);

    const relativePath = String(process.env.COMPLIANCE_COMPARISON_DEBUG_PATH || 'comparison-debug.jsonl').trim();
    const outputPath = pathModule.resolve(process.cwd(), relativePath);
    await mkdir(pathModule.dirname(outputPath), { recursive: true });

    const line = `${JSON.stringify(payload)}\n`;
    await appendFile(outputPath, line, 'utf8');
  } catch (error) {
    logComparisonEvent('comparisonDebugArtifactWriteFailed', {
      error: error?.message || String(error),
    });
  }
}

function buildSectionDebugView(section = {}, includeFullContent = false) {
  const content = String(section?.content || '');
  return {
    id: section?.id || '',
    title: section?.title || '',
    normalizedTitle: section?.normalizedTitle || normalizeTopicTitle(section?.title || ''),
    fileName: section?.fileName || '',
    page: section?.page || null,
    contentLength: content.length,
    contentPreview: truncateText(content, 650),
    ...(includeFullContent ? { content } : {}),
  };
}

function normalizePreparationVersion(value) {
  if (value === null || value === undefined) return null;
  const version = String(value).trim();
  return version || null;
}

function isCurrentPreparationVersion(value) {
  const normalized = normalizePreparationVersion(value);
  if (!normalized) {
    return CURRENT_PREPARATION_VERSION === '1';
  }
  return normalized === CURRENT_PREPARATION_VERSION;
}

function normalizeSearchText(text) {
  let searchText = String(text || '').trim();
  if (!searchText) return '*';

  searchText = searchText
    .replace(/\b(CFR)(?=\d{1,3}\.\d{1,3})/gi, '$1 ')
    .replace(/(\d{1,3}\.\d{1,3})(?=[A-Za-z])(?!\.)/g, '$1 ')
    .replace(/(\d{1,3}\.\d{1,3})(?=\()/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();

  return searchText || '*';
}

function extractSectionNumber(text) {
  const source = String(text || '');
  const match = source.match(/(?<!\d)(\d{1,3}\.\d{1,3})(?!\d)/);
  return match ? match[1] : '';
}

function buildQueryVariants(prompt, maxVariants) {
  const normalized = normalizeSearchText(prompt);
  const sectionNumber = extractSectionNumber(normalized);
  const variants = [{ label: 'exact', query: normalized }];

  if (normalized !== String(prompt || '').trim()) {
    variants.push({ label: 'normalized', query: normalized });
  }

  if (sectionNumber) {
    variants.push({ label: 'sectionOnly', query: sectionNumber });
  }

  const quoted = normalized.match(/"([^"]{3,})"/)?.[1];
  if (quoted) {
    variants.push({ label: 'quotedClause', query: quoted });
  }

  const deduped = [];
  const seen = new Set();
  for (const variant of variants) {
    const key = `${variant.label}::${variant.query.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(variant);
    if (deduped.length >= maxVariants) break;
  }

  return deduped;
}

function buildTopicExpansionVariants(userPrompt, config = {}) {
  const prompt = String(userPrompt || '').trim();
  const topicMode = config?.retrieval?.topicMode || {};
  if (!prompt || topicMode.topicExpansionEnabled === false) return [];

  const listIntent = isLikelyListDeltaPrompt(prompt);
  if (!listIntent) return [];

  const configured = Array.isArray(topicMode.topicExpansionQueriesForPositions)
    ? topicMode.topicExpansionQueriesForPositions
    : [];
  const fallback = [
    'administrative positions',
    'key administrative positions',
    'key personnel positions',
    'positions must be reported',
  ];

  const rawQueries = configured.length > 0 ? configured : fallback;
  const maxQueries = Math.max(1, Number(topicMode.topicExpansionMaxQueries || 4));

  return rawQueries
    .map((query, idx) => ({
      label: `topicExpansion${idx + 1}`,
      query: normalizeSearchText(query),
    }))
    .filter((item) => !!item.query)
    .slice(0, maxQueries);
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9.]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function getSearchScore(result) {
  if (typeof result?.score === 'number') return result.score;
  if (typeof result?.document?.['@search.score'] === 'number') return result.document['@search.score'];
  return 0;
}

function cosineSimilarity(a = [], b = []) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    const x = Number(a[i]) || 0;
    const y = Number(b[i]) || 0;
    dot += x * y;
    magA += x * x;
    magB += y * y;
  }

  if (!magA || !magB) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function truncateText(text, maxLength = 550) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength).trim()}...`;
}

function truncateTextPreserveLines(text, maxLength = 1600) {
  const clean = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!clean) return '';
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength).trim()}...`;
}

function computeTokenOverlapRatio(sourceText, targetText) {
  const sourceTokens = new Set(tokenize(sourceText));
  const targetTokens = new Set(tokenize(targetText));
  if (sourceTokens.size === 0 || targetTokens.size === 0) return 0;

  let overlapCount = 0;
  for (const token of sourceTokens) {
    if (targetTokens.has(token)) overlapCount += 1;
  }

  const denominator = Math.max(sourceTokens.size, targetTokens.size);
  return denominator > 0 ? overlapCount / denominator : 0;
}

function extractPolicySignals(text) {
  const content = String(text || '').toLowerCase();
  const signalMatchers = [
    { label: 'prior authorization controls', pattern: /prior\s*authorization|programmatic\s*change\s*form|department\s*approval/ },
    { label: 'access and appointment standards', pattern: /appointment|access\s*to\s*care|urgent|routine/ },
    { label: 'provider network and credentialing', pattern: /provider\s*network|credential|qualified\s*provider|termination/ },
    { label: 'reporting and audit obligations', pattern: /report|audit|submission|encounter|data\s*file/ },
    { label: 'pharmacy or formulary requirements', pattern: /formulary|pdl|pharmacy|drug\s*utilization/ },
    { label: 'member rights and grievances', pattern: /grievance|complaint|appeal|freedom\s*of\s*choice|mainstreaming/ },
  ];

  return signalMatchers
    .filter((matcher) => matcher.pattern.test(content))
    .map((matcher) => matcher.label);
}

function formatSignalList(signals) {
  if (!Array.isArray(signals) || signals.length === 0) return 'general policy language';
  if (signals.length === 1) return signals[0];
  if (signals.length === 2) return `${signals[0]} and ${signals[1]}`;
  return `${signals.slice(0, -1).join(', ')}, and ${signals[signals.length - 1]}`;
}

function assessMatchedTopicDifference(item) {
  const similarity = Number(item?.similarity || 0);
  const sourceContent = String(item?.source?.content || '');
  const targetContent = String(item?.target?.content || '');
  const overlapRatio = computeTokenOverlapRatio(sourceContent, targetContent);

  const sourceSignals = extractPolicySignals(sourceContent);
  const targetSignals = extractPolicySignals(targetContent);


  const sourceOnlySignals = sourceSignals.filter((signal) => !targetSignals.includes(signal));
  const targetOnlySignals = targetSignals.filter((signal) => !sourceSignals.includes(signal));

  let framing = '';
  if (similarity >= 0.9 && overlapRatio >= 0.65) {
    framing = 'Core intent is strongly aligned, with nuanced wording differences.';
  } else if (similarity >= 0.8 && overlapRatio >= 0.5) {
    framing = 'Intent is generally aligned, but specific scope or conditions differ.';
  } else {
    framing = 'Topic appears related, but language indicates potentially material policy differences.';
  }

  const commonSignalSummary = `Both sections address ${formatSignalList(sourceSignals.filter((signal) => targetSignals.includes(signal)))}.`;
  const sourceDeltaSummary = sourceOnlySignals.length > 0
    ? `Source adds emphasis on ${formatSignalList(sourceOnlySignals)}.`
    : '';
  const targetDeltaSummary = targetOnlySignals.length > 0
    ? `Target adds emphasis on ${formatSignalList(targetOnlySignals)}.`
    : '';

  const parts = [framing, commonSignalSummary, sourceDeltaSummary, targetDeltaSummary].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(' ');
  }

  return 'Matched topic identified, but the source and target sections need manual review for substantive language differences.';
}

async function buildComprehensiveSpreadsheetArtifact(state, result) {
  if (!result || !Array.isArray(result.matchedTopics)) return null;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GenAI Portal Document Comparison';
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 36 },
    { header: 'Value', key: 'value', width: 18 },
    { header: 'Detail', key: 'detail', width: 70 },
  ];

  const sourceName = state?.geisingerConversationA?.fileAName || 'Source Document';
  const targetName = state?.geisingerConversationB?.fileAName || 'Target Document';
  summarySheet.addRows([
    { metric: 'Source Document', value: sourceName, detail: 'First selected document in comparison.' },
    { metric: 'Target Document', value: targetName, detail: 'Second selected document in comparison.' },
    { metric: 'Source topic count', value: result?.counts?.sourceTopicCount || 0, detail: 'All source sections considered.' },
    { metric: 'Target topic count', value: result?.counts?.targetTopicCount || 0, detail: 'All target sections considered.' },
    { metric: 'Matching topics', value: result?.counts?.matchingTopics || 0, detail: 'Topics mapped source to target.' },
    { metric: 'Primary one-to-one matches', value: result?.counts?.primaryMatchingTopics || 0, detail: 'One-to-one source-to-target assignments.' },
    { metric: 'Secondary related matches', value: result?.counts?.secondaryMatchingTopics || 0, detail: 'Additional high-similarity source topics linked to existing targets.' },
    { metric: 'Unique matched target topics', value: result?.counts?.uniqueMatchedTargetTopics || 0, detail: 'Distinct target sections matched at least once.' },
    { metric: 'Fallback matches recovered', value: result?.counts?.fallbackRecoveredFromSourceOnly || 0, detail: 'Source-only topics recovered by fallback search.' },
    { metric: 'Fallback probes attempted', value: result?.counts?.fallbackSourceOnlyProbeAttempts || 0, detail: 'Source-only topics that triggered fallback retrieval.' },
    { metric: 'Source not in target', value: result?.counts?.sourceNotInTarget || 0, detail: 'Source-only topics.' },
    { metric: 'Target not in source', value: result?.counts?.targetNotInSource || 0, detail: 'Target-only topics.' },
  ]);

  // Add Comparison Results sheet with LLM Difference Analysis column
  const detailsSheet = workbook.addWorksheet('Comparison Results');
  detailsSheet.columns = [
    { header: 'Category', key: 'category', width: 22 },
    { header: 'Source Title', key: 'sourceTitle', width: 38 },
    { header: 'Source Page', key: 'sourcePage', width: 12 },
    { header: 'Source Summary', key: 'sourceSummary', width: 45 },
    { header: 'Target Title', key: 'targetTitle', width: 38 },
    { header: 'Target Page', key: 'targetPage', width: 12 },
    { header: 'Target Summary', key: 'targetSummary', width: 45 },
    { header: 'Similarity', key: 'similarity', width: 14 },
    { header: 'Match Type', key: 'matchType', width: 18 },
    { header: 'Difference Assessment', key: 'differenceAssessment', width: 60 },
    { header: 'Matching Rationale', key: 'matchingRationale', width: 60 },
    { header: 'LLM Difference Analysis', key: 'llmDiff', width: 60 },
  ];

  // Helper to get summary fields if present
  function getSummary(obj) {
    return obj?.summary || obj?.content || obj?.text || '';
  }

  // Map results to rows, including LLM diff
  const matchedRows = (result.matchedTopics || []).map((item) => ({
    category: 'Matched Topic',
    sourceTitle: item?.source?.title || '',
    sourcePage: item?.source?.page || '',
    sourceSummary: getSummary(item?.source),
    targetTitle: item?.target?.title || '',
    targetPage: item?.target?.page || '',
    targetSummary: getSummary(item?.target),
    similarity: Number(item?.similarity || 0).toFixed(3),
    matchType: item?.matchType || 'unknown',
    differenceAssessment: item?.differenceAssessment || assessMatchedTopicDifference(item),
    matchingRationale: item?.rationale || '',
    llmDiff: markdownToPlainText(item?.llmDiff || ''),
  }));

  const sourceOnlyRows = (result.sourceOnlyTopics || []).map((item) => ({
    category: 'Source Not In Target',
    sourceTitle: item?.title || '',
    sourcePage: item?.page || '',
    sourceSummary: getSummary(item),
    targetTitle: '',
    targetPage: '',
    targetSummary: '',
    similarity: '',
    matchType: '',
    differenceAssessment: 'No corresponding target topic identified.',
    matchingRationale: '',
    llmDiff: markdownToPlainText(item?.llmDiff || ''),
  }));

  const targetOnlyRows = (result.targetOnlyTopics || []).map((item) => ({
    category: 'Target Not In Source',
    sourceTitle: '',
    sourcePage: '',
    sourceSummary: '',
    targetTitle: item?.title || '',
    targetPage: item?.page || '',
    targetSummary: getSummary(item),
    similarity: '',
    matchType: '',
    differenceAssessment: 'No corresponding source topic identified.',
    matchingRationale: '',
    llmDiff: markdownToPlainText(item?.llmDiff || ''),
  }));

  detailsSheet.addRows([...matchedRows, ...sourceOnlyRows, ...targetOnlyRows]);

  // Apply header and cell styling, and color code by category
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F4E78' } };
  const headerFont = { bold: true, color: { argb: 'FFFFFF' } };
  detailsSheet.getRow(1).eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  detailsSheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 1) return;
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'top', wrapText: true };
    });
    // Color code by category
    const categoryCell = row.getCell('category');
    const category = categoryCell.value;
    if (category === 'Also in Target') {
      categoryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'C6EFCE' } };
    } else if (category === 'Only in Source') {
      categoryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC7CE' } };
    } else if (category === 'New in Target' || category === 'Target Not In Source') {
      categoryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEB9C' } };
    }
  });
  // Set column widths for readability
  detailsSheet.columns.forEach(col => {
    col.width = Math.max(col.width || 15, 15);
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sourceId = state?.geisingerConversationA?.id || 'source';
  const targetId = state?.geisingerConversationB?.id || 'target';
  const fileName = `comparison-v2-${timestamp}.xlsx`;
  const blobPath = `document-comparisons/${timestamp.slice(0, 10)}/${sourceId}-vs-${targetId}/${fileName}`;

  const fileBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const containerName = 'compliance-ai';
  const uploadSuccess = await writeFileBufferToBlobStorage(
    fileBuffer,
    containerName,
    blobPath,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );

  if (!uploadSuccess) {
    throw new Error('Spreadsheet upload failed.');
  }

  const downloadLink = await generateTemporaryDownloadLink(containerName, blobPath, 1440);
  return {
    spreadsheetBlobName: blobPath,
    spreadsheetFileName: fileName,
    downloadLink,
  };
}

function normalizeTopicTitle(title = '') {
  return String(title || '')
    .replace(/[§]/g, '')
    .replace(/[^a-zA-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeFileNameKey(value = '') {
  return String(value || '').trim().toLowerCase();
}

function buildComparisonDocumentUrl(relativeAUrl, page) {
  const relativeUrl = String(relativeAUrl || '').trim();
  if (!relativeUrl) return '';

  const domain = process.env.USE_VAULT === 'true' ? 'geisinger.sharepoint.com' : 'sp-cloud.kp.org';
  const baseUrl = `https://${domain}${relativeUrl}`;
  let url = encodeURI(baseUrl);
  url += '?target=_blank';

  const pageNumber = Number(page);
  if (Number.isFinite(pageNumber) && pageNumber > 0) {
    url += `#page=${pageNumber}`;
  }

  return url;
}

function buildSourceOrTargetDocumentLabel(doc, fallbackLabel) {
  const fileName = String(doc?.fileAName || doc?.fileName || fallbackLabel || 'Document').trim();
  const url = buildComparisonDocumentUrl(doc?.relativeAUrl, null);
  return url ? `[${fileName}](${url})` : fileName;
}

function buildComparisonCitationUrlMap(state) {
  const map = new Map();
  const sourceDoc = state?.geisingerConversationA || {};
  const targetDoc = state?.geisingerConversationB || {};

  const sourceName = normalizeFileNameKey(sourceDoc?.fileAName || sourceDoc?.fileName);
  const sourceUrl = buildComparisonDocumentUrl(sourceDoc?.relativeAUrl, null);
  if (sourceName && sourceUrl) {
    map.set(sourceName, sourceUrl);
  }

  const targetName = normalizeFileNameKey(targetDoc?.fileAName || targetDoc?.fileName);
  const targetUrl = buildComparisonDocumentUrl(targetDoc?.relativeAUrl, null);
  if (targetName && targetUrl) {
    map.set(targetName, targetUrl);
  }

  return map;
}

function linkifyComparisonInlineCitations(text, citationUrlMap) {
  const source = String(text || '');
  if (!source) return source;

  return source.replace(/\[([^\]\n]+?):\s*(\d+)\](?!\()/g, (match, fileName, pageText) => {
    const key = normalizeFileNameKey(fileName);
    const pageNumber = Number(pageText);
    const baseUrl = citationUrlMap?.get(key);

    if (!baseUrl || !Number.isFinite(pageNumber) || pageNumber <= 0) {
      return match;
    }

    return `[${String(fileName).trim()}:${pageNumber}](${baseUrl}#page=${pageNumber})`;
  });
}

function isComprehensiveComparisonPrompt(userPrompt, config) {
  const prompt = String(userPrompt || '').toLowerCase();
  if (!prompt) return false;
  return config.mode.comprehensiveKeywords.some((keyword) => prompt.includes(keyword));
}

function hasRoleSignalText(text = '') {
  return /(ceo|cfo|director|coordinator|manager|administrator|officer|liaison|supervisor|claims|enrollee|communications|medical|dental|case management|billing)/i
    .test(String(text || ''));
}

function hasListHeadingSignalText(text = '') {
  const normalized = String(text || '').toLowerCase();
  return /\badministrative positions?\b|\bkey administrative positions?\b|\bkey personnel\b|\bpositions must be\b/.test(normalized);
}

function hasListStructureSignalText(text = '') {
  const source = String(text || '');
  const lineCount = source.split(/\n+/).filter(Boolean).length;
  const semicolonCount = (source.match(/;/g) || []).length;
  return lineCount >= 3 || semicolonCount >= 2;
}

function hasRoleLikeCandidateDoc(doc = {}) {
  const combined = `${String(doc?.title || '')}\n${String(doc?.content || '')}`;
  return hasRoleSignalText(combined) || hasListHeadingSignalText(combined);
}

function computeTopicCandidateScore(candidate, userPrompt, config) {
  const ranking = config.ranking;
  const prompt = String(userPrompt || '').toLowerCase();
  const title = String(candidate?.doc?.title || '').toLowerCase();
  const content = String(candidate?.doc?.content || '').toLowerCase();
  const section = extractSectionNumber(prompt);

  const promptTerms = tokenize(prompt);
  const titleHits = promptTerms.filter((term) => title.includes(term)).length;
  const contentHits = promptTerms.filter((term) => content.includes(term)).length;

  let score = Number(candidate.rawScore || 0) * ranking.scoreWeight;
  score += titleHits * ranking.titleTermBoost;
  score += contentHits * ranking.contentTermBoost;

  if (prompt && content.includes(prompt)) {
    score += ranking.exactPromptBoost;
  }

  if (section && (title.includes(section) || content.includes(section))) {
    score += ranking.exactSectionBoost;
  }

  if (isLikelyListDeltaPrompt(prompt)) {
    const combined = `${title}\n${content}`;
    const roleSignal = hasRoleSignalText(combined);
    const headingSignal = hasListHeadingSignalText(combined);
    const structureSignal = hasListStructureSignalText(candidate?.doc?.content || '');

    if (roleSignal) {
      score += Number(ranking.listRoleSignalBoost || 0);
    }
    if (headingSignal) {
      score += Number(ranking.listHeadingBoost || 0);
    }
    if (structureSignal) {
      score += Number(ranking.listStructureBoost || 0);
    }

    if (!roleSignal && !headingSignal && !structureSignal) {
      score -= Number(ranking.listOffTopicPenalty || 0);
    }
  }

  score += ranking.variantBoost[candidate.queryVariant] || 0;
  return score;
}

function rankTopicCandidates(allCandidates = [], userPrompt, config) {
  const byId = new Map();
  for (const candidate of allCandidates) {
    const id = String(candidate?.doc?.id || '').trim();
    if (!id) continue;
    const score = computeTopicCandidateScore(candidate, userPrompt, config);
    const existing = byId.get(id);
    if (!existing || score > existing.finalScore) {
      byId.set(id, { ...candidate, finalScore: score });
    }
  }

  return Array.from(byId.values())
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, config.retrieval.topicMode.maxCandidatesAfterMerge);
}

function selectFinalTopicEvidenceCandidates(rankedCandidates = [], userPrompt, config = {}) {
  const evidenceLimit = Math.max(1, Number(config?.retrieval?.topicMode?.evidencePerDocument || 16));
  const listIntent = isLikelyListDeltaPrompt(userPrompt);
  if (!listIntent) {
    return rankedCandidates.slice(0, evidenceLimit);
  }

  const roleLike = rankedCandidates.filter((candidate) => hasRoleLikeCandidateDoc(candidate?.doc || {}));
  const other = rankedCandidates.filter((candidate) => !hasRoleLikeCandidateDoc(candidate?.doc || {}));
  const minRoleLike = Math.max(1, Number(config?.retrieval?.topicMode?.listMinRoleEvidenceInFinal || 8));

  if (roleLike.length === 0) {
    // Strict guard: avoid misleading generic comparisons when list-topic evidence is absent.
    return [];
  }

  const selected = [
    ...roleLike.slice(0, Math.min(minRoleLike, evidenceLimit)),
    ...other,
    ...roleLike.slice(Math.min(minRoleLike, evidenceLimit)),
  ];

  const deduped = [];
  const seenIds = new Set();
  for (const candidate of selected) {
    const id = String(candidate?.doc?.id || '').trim();
    if (!id || seenIds.has(id)) continue;
    seenIds.add(id);
    deduped.push(candidate);
    if (deduped.length >= evidenceLimit) break;
  }

  return deduped;
}

async function callCompletionWithFallback(completionsClient, config, messages, maxTokensOverride) {
  const models = Array.isArray(config.completion.preferredModels) && config.completion.preferredModels.length > 0
    ? config.completion.preferredModels
    : ['gpt-5.1'];

  const maxTokens = Number(maxTokensOverride || config.completion.maxTokens || 1200);
  let lastError = null;
  for (const model of models) {
    try {
      const completion = await completionsClient.chat.completions.create({
        model,
        temperature: config.completion.temperature,
        max_completion_tokens: maxTokens,
        messages,
      });

      return completion?.choices?.[0]?.message?.content || '';
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('No completion response returned from fallback models.');
}

function sleep(ms) {
  const delay = Math.max(0, Number(ms) || 0);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

function getHeaderValue(headers, key) {
  if (!headers || !key) return '';
  const lowerKey = String(key).toLowerCase();

  if (typeof headers.get === 'function') {
    return String(headers.get(key) || headers.get(lowerKey) || '').trim();
  }

  if (Array.isArray(headers)) {
    const match = headers.find((pair) => String(pair?.[0] || '').toLowerCase() === lowerKey);
    return String(match?.[1] || '').trim();
  }

  if (typeof headers === 'object') {
    for (const [k, v] of Object.entries(headers)) {
      if (String(k).toLowerCase() === lowerKey) {
        return String(v || '').trim();
      }
    }
  }

  return '';
}

function resolveRetryAfterMs(error) {
  const retryAfterRaw = getHeaderValue(error?.headers, 'retry-after');
  if (!retryAfterRaw) return 0;

  const seconds = Number(retryAfterRaw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.trunc(seconds * 1000);
  }

  const absoluteTimeMs = new Date(retryAfterRaw).getTime();
  if (Number.isFinite(absoluteTimeMs)) {
    return Math.max(0, absoluteTimeMs - Date.now());
  }

  return 0;
}

function isRateLimitError(error) {
  const status = Number(error?.status || error?.statusCode || 0);
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return status === 429
    || code === 'ratelimitreached'
    || message.includes('rate limit')
    || message.includes('too many requests');
}

async function createEmbeddingsBatch(embeddingsClient, inputTexts) {
  const cleaned = inputTexts
    .map((text) => truncateText(text, 1200))
    .filter((text) => !!text);

  if (cleaned.length === 0) return [];

  const maxAttempts = Math.max(1, Number(process.env.COMPLIANCE_COMPARISON_EMBED_RETRY_ATTEMPTS || 4));
  const baseDelayMs = Math.max(250, Number(process.env.COMPLIANCE_COMPARISON_EMBED_RETRY_BASE_MS || 1000));
  const maxDelayMs = Math.max(baseDelayMs, Number(process.env.COMPLIANCE_COMPARISON_EMBED_RETRY_MAX_MS || 65000));
  const maxInputsPerRequest = Math.max(1, Number(process.env.COMPLIANCE_COMPARISON_EMBED_BATCH_SIZE || 12));
  const interBatchDelayMs = Math.max(0, Number(process.env.COMPLIANCE_COMPARISON_EMBED_BATCH_DELAY_MS || 250));

  const batches = [];
  for (let i = 0; i < cleaned.length; i += maxInputsPerRequest) {
    batches.push(cleaned.slice(i, i + maxInputsPerRequest));
  }

  if (batches.length > 1) {
    logComparisonEvent('comparisonEmbeddingsBatchingEnabled', {
      totalInputs: cleaned.length,
      batchCount: batches.length,
      maxInputsPerRequest,
      interBatchDelayMs,
    });
  }

  const allEmbeddings = [];

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const batch = batches[batchIndex];
    let lastError = null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const { data } = await embeddingsClient.embeddings.create({
          input: batch,
          model: 'text-embedding-ada-002',
        });

        allEmbeddings.push(...data.map((item) => item.embedding));
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (!isRateLimitError(error) || attempt >= maxAttempts - 1) {
          throw error;
        }

        const retryAfterMs = resolveRetryAfterMs(error);
        const exponentialMs = Math.min(maxDelayMs, Math.trunc(baseDelayMs * Math.pow(2, attempt)));
        const jitterMs = Math.trunc(Math.random() * 300);
        const waitMs = Math.max(retryAfterMs, exponentialMs + jitterMs);

        logComparisonEvent('comparisonEmbeddingsRateLimitRetry', {
          batchIndex: batchIndex + 1,
          batchCount: batches.length,
          batchSize: batch.length,
          attempt: attempt + 1,
          maxAttempts,
          waitMs,
          retryAfterMs,
          status: Number(error?.status || error?.statusCode || 0) || null,
          code: String(error?.code || ''),
        });

        await sleep(waitMs);
      }
    }

    if (lastError) {
      throw lastError;
    }

    if (interBatchDelayMs > 0 && batchIndex < batches.length - 1) {
      await sleep(interBatchDelayMs);
    }
  }

  return allEmbeddings;
}

let embeddingsClient = null;
function getEmbeddingsClient() {
  if (!embeddingsClient) {
    const envName = process.env.envName;
    const embeddingsEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.embeddingsEndpoint`];
    const embeddingsAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.openai.api.key`];
    embeddingsClient = new AzureOpenAI({
      apiVersion: '2023-05-15',
      endpoint: embeddingsEndpoint,
      apiKey: embeddingsAPIKey,
      deployment: 'gpt-4o-aisvc',
    });
  }
  return embeddingsClient;
}

let searchClientSingleton = null;
function getSearchClient() {
  if (!searchClientSingleton) {
    const envName = process.env.envName;
    const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
    const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.api.key`];
    searchClientSingleton = new SearchClient(
      searchEndpoint,
      SEARCH_INDEX_NAME,
      new AzureKeyCredential(searchAPIKey)
    );
  }
  return searchClientSingleton;
}

async function fetchComparisonConversations(teamName, geisingerComparison) {
  const normalizedTeamName = String(teamName || '').trim();
  if (!normalizedTeamName) throw new Error('teamName is required.');

  const sourceId = String(geisingerComparison?.geisingerConversationAId || '').trim();
  const targetId = String(geisingerComparison?.geisingerConversationBId || '').trim();
  if (!sourceId || !targetId) {
    throw new Error('Both geisingerConversationAId and geisingerConversationBId are required.');
  }

  const db = await connectToDatabase(`team-${normalizedTeamName}-db`);
  const docs = await db.collection(GEISINGER_COLLECTION)
    .find({
      type: 'GeisingerConversation',
      id: { $in: [sourceId, targetId] },
      status: { $in: ['Complete', 'Prepared'] },
    })
    .toArray();

  const source = docs.find((doc) => String(doc?.id || '').trim() === sourceId);
  const target = docs.find((doc) => String(doc?.id || '').trim() === targetId);

  if (!source || !target) {
    throw new Error('Unable to load both selected GeisingerConversation records in ready status.');
  }

  if (!isCurrentPreparationVersion(source?.preparationVersion) || !isCurrentPreparationVersion(target?.preparationVersion)) {
    throw new Error('Selected documents are not at the current preparation version.');
  }

  return { source, target };
}

async function runTopicSearchForConversation({
  searchClient,
  promptEmbedding,
  userPrompt,
  conversationId,
  config,
}) {
  const queryVariants = buildQueryVariants(userPrompt, config.retrieval.topicMode.maxVariants);
  const expansionVariants = buildTopicExpansionVariants(userPrompt, config);
  const combinedVariants = [];
  const seenVariantKeys = new Set();

  for (const variant of [...queryVariants, ...expansionVariants]) {
    const key = `${String(variant?.label || '').toLowerCase()}::${String(variant?.query || '').toLowerCase()}`;
    if (!variant?.query || seenVariantKeys.has(key)) continue;
    seenVariantKeys.add(key);
    combinedVariants.push(variant);
  }
  const allCandidates = [];
  const filter = `smartnote_id eq '${String(conversationId || '').replace(/'/g, "''")}'`;

  for (const variant of combinedVariants) {
    const keywordResults = await searchClient.search(variant.query, {
      filter,
      select: config.retrieval.selectFields,
      searchFields: config.retrieval.searchFields,
      top: config.retrieval.topicMode.keywordTop,
    });

    for await (const result of keywordResults.results) {
      allCandidates.push({
        doc: result.document,
        source: 'keyword',
        queryVariant: variant.label,
        rawScore: getSearchScore(result),
      });
    }

    const semanticResults = await searchClient.search(variant.query, {
      filter,
      select: config.retrieval.selectFields,
      searchFields: config.retrieval.searchFields,
      top: config.retrieval.topicMode.semanticTop,
      embedding: promptEmbedding,
      vectorFields: ['content_vector'],
    });

    for await (const result of semanticResults.results) {
      allCandidates.push({
        doc: result.document,
        source: 'semantic',
        queryVariant: variant.label,
        rawScore: getSearchScore(result),
      });
    }
  }

  let ranked = rankTopicCandidates(allCandidates, userPrompt, config);

  const listRescueEnabled = config?.retrieval?.topicMode?.listRescueEnabled !== false;
  const listIntent = isLikelyListDeltaPrompt(userPrompt);
  const roleCandidates = ranked.filter((candidate) => hasRoleLikeCandidateDoc(candidate?.doc || {})).length;
  const minRoleCandidates = Math.max(1, Number(config?.retrieval?.topicMode?.listRescueMinRoleCandidates || 2));

  if (listIntent && listRescueEnabled) {
    const rescueTop = Math.max(20, Number(config?.retrieval?.topicMode?.listRescueTop || 260));
    logComparisonEvent('complianceComparisonTopicListRescueTriggered', {
      conversationId: String(conversationId || ''),
      roleCandidates,
      minRoleCandidates,
      rescueTop,
    });
    const rescueResults = await searchClient.search('*', {
      filter,
      select: config.retrieval.selectFields,
      searchFields: config.retrieval.searchFields,
      top: rescueTop,
      searchMode: 'all',
    });

    let added = 0;
    const maxRescueAdds = Math.max(10, Number(config?.retrieval?.topicMode?.listRescueMaxAdditions || 80));
    for await (const result of rescueResults.results) {
      if (added >= maxRescueAdds) break;
      const doc = result?.document || {};
      if (!hasRoleLikeCandidateDoc(doc)) continue;
      allCandidates.push({
        doc,
        source: 'list-rescue',
        queryVariant: 'listRescue',
        rawScore: getSearchScore(result),
      });
      added += 1;
    }

    ranked = rankTopicCandidates(allCandidates, userPrompt, config);
    logComparisonEvent('complianceComparisonTopicListRescueCompleted', {
      conversationId: String(conversationId || ''),
      added,
      rankedCountAfterRescue: ranked.length,
    });
  }

  return selectFinalTopicEvidenceCandidates(ranked, userPrompt, config);
}

function buildFallbackSearchPromptFromSection(section) {
  const title = String(section?.title || '').trim();
  const content = String(section?.content || '').replace(/\s+/g, ' ').trim();
  const sectionNumber = extractSectionNumber(`${title} ${content}`);
  const contentPreview = content
    .split(/[.!?]\s+/)
    .slice(0, 2)
    .join('. ')
    .trim();

  const parts = [title];
  if (sectionNumber && !title.includes(sectionNumber)) {
    parts.push(sectionNumber);
  }
  if (contentPreview) {
    parts.push(contentPreview);
  }

  const prompt = normalizeSearchText(parts.filter(Boolean).join(' '));
  return prompt || normalizeSearchText(title || content || '*');
}

async function runFallbackSearchForConversationSection({
  searchClient,
  promptEmbedding,
  searchPrompt,
  conversationId,
  config,
}) {
  const fallback = config?.alignment?.fallbackSearch || {};
  const queryVariants = buildQueryVariants(searchPrompt, Number(fallback.maxVariants || 4));
  const allCandidates = [];

  for (const variant of queryVariants) {
    const filter = `smartnote_id eq '${String(conversationId || '').replace(/'/g, "''")}'`;

    const keywordResults = await searchClient.search(variant.query, {
      filter,
      select: config.retrieval.selectFields,
      searchFields: config.retrieval.searchFields,
      top: Number(fallback.keywordTop || 35),
    });

    for await (const result of keywordResults.results) {
      allCandidates.push({
        doc: result.document,
        source: 'keyword',
        queryVariant: variant.label,
        rawScore: getSearchScore(result),
      });
    }

    const semanticResults = await searchClient.search(variant.query, {
      filter,
      select: config.retrieval.selectFields,
      searchFields: config.retrieval.searchFields,
      top: Number(fallback.semanticTop || 35),
      embedding: promptEmbedding,
      vectorFields: ['content_vector'],
    });

    for await (const result of semanticResults.results) {
      allCandidates.push({
        doc: result.document,
        source: 'semantic',
        queryVariant: variant.label,
        rawScore: getSearchScore(result),
      });
    }
  }

  const byId = new Map();
  for (const candidate of allCandidates) {
    const id = String(candidate?.doc?.id || '').trim();
    if (!id) continue;
    const score = computeTopicCandidateScore(candidate, searchPrompt, config);
    const existing = byId.get(id);
    if (!existing || score > existing.finalScore) {
      byId.set(id, { ...candidate, finalScore: score });
    }
  }

  return Array.from(byId.values())
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, Number(fallback.maxCandidatesAfterMerge || 70));
}

function normalizeListItemKey(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLikelyListDeltaPrompt(prompt = '') {
  const text = String(prompt || '').toLowerCase();
  return [
    'position',
    'positions',
    'role',
    'roles',
    'title',
    'titles',
    'administrative',
    'key personnel',
    'staff',
    'who is',
    'who are',
    'list of',
  ].some((term) => text.includes(term));
}

function extractListItemsFromTopicEvidence(evidence = []) {
  const out = new Map();
  const rolePattern = /(ceo|cfo|director|coordinator|manager|administrator|officer|liaison|contact|supervisor|claims|enrollee|communications|medical|dental|case management|billing)/i;

  for (const item of evidence) {
    const content = String(item?.content || '');
    if (!content) continue;

    const rawParts = content
      .split(/\n+/)
      .flatMap((line) => line.split(/\s*;\s*/))
      .map((part) => String(part || '').trim())
      .filter(Boolean);

    for (const rawPart of rawParts) {
      const cleaned = rawPart
        .replace(/^[-*•]\s*/, '')
        .replace(/^\d+[.)]\s*/, '')
        .replace(/^\(?[a-z]\)\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleaned || cleaned.length < 3 || cleaned.length > 120) continue;
      if (!rolePattern.test(cleaned)) continue;

      const key = normalizeListItemKey(cleaned);
      if (!key) continue;

      if (!out.has(key)) {
        out.set(key, {
          item: cleaned,
          citations: new Set([String(item?.citation || '').trim()].filter(Boolean)),
        });
      } else {
        const existing = out.get(key);
        if (item?.citation) existing.citations.add(String(item.citation).trim());
      }
    }
  }

  return out;
}

function countRoleLikeEvidenceItems(evidence = []) {
  return (evidence || []).filter((item) => hasRoleLikeCandidateDoc({
    title: item?.title,
    content: item?.content,
  })).length;
}

function toTopicCandidateFromSection(section = {}) {
  return {
    doc: {
      id: section?.id || '',
      title: section?.title || '',
      content: section?.content || '',
      page: Number(section?.page) || null,
      smart_file_name: section?.fileName || '',
    },
    source: 'deterministic-list-scan',
    queryVariant: 'deterministicListScan',
    rawScore: 0,
    finalScore: 0,
  };
}

async function buildDeterministicListTopicEvidence({ state, config }) {
  const perDocumentLimit = Math.max(10, Number(config?.retrieval?.topicMode?.listDeterministicScanEvidencePerDocument || 60));

  const [sourceSections, targetSections] = await Promise.all([
    fetchAllDocumentSections(state.searchClient, state.geisingerConversationA.id, config),
    fetchAllDocumentSections(state.searchClient, state.geisingerConversationB.id, config),
  ]);

  const sourceRoleSections = sourceSections
    .filter((section) => hasRoleLikeCandidateDoc({ title: section?.title, content: section?.content }))
    .slice(0, perDocumentLimit);
  const targetRoleSections = targetSections
    .filter((section) => hasRoleLikeCandidateDoc({ title: section?.title, content: section?.content }))
    .slice(0, perDocumentLimit);

  return {
    sourceEvidence: buildTopicEvidencePayload(sourceRoleSections.map(toTopicCandidateFromSection), config),
    targetEvidence: buildTopicEvidencePayload(targetRoleSections.map(toTopicCandidateFromSection), config),
  };
}

function buildTopicListDeltaSummary(sourceEvidence = [], targetEvidence = [], userPrompt = '', config = {}) {
  const sourceItems = extractListItemsFromTopicEvidence(sourceEvidence);
  const targetItems = extractListItemsFromTopicEvidence(targetEvidence);

  const sourceKeys = new Set(sourceItems.keys());
  const targetKeys = new Set(targetItems.keys());
  const commonKeys = Array.from(sourceKeys).filter((key) => targetKeys.has(key));
  const sourceOnlyKeys = Array.from(sourceKeys).filter((key) => !targetKeys.has(key));
  const targetOnlyKeys = Array.from(targetKeys).filter((key) => !sourceKeys.has(key));

  const hasSignal = isLikelyListDeltaPrompt(userPrompt)
    || sourceOnlyKeys.length > 0
    || targetOnlyKeys.length > 0;

  if (!hasSignal) {
    return null;
  }

  const maxItems = Math.max(5, Number(config?.runtime?.display?.topicListDeltaMaxItems || 20));
  const toRenderable = (keys, map) => keys.slice(0, maxItems).map((key) => {
    const entry = map.get(key);
    const citations = Array.from(entry?.citations || []).slice(0, 2);
    return {
      item: String(entry?.item || ''),
      citations,
    };
  });

  return {
    sourceOnly: toRenderable(sourceOnlyKeys, sourceItems),
    targetOnly: toRenderable(targetOnlyKeys, targetItems),
    common: toRenderable(commonKeys, sourceItems),
    counts: {
      sourceOnly: sourceOnlyKeys.length,
      targetOnly: targetOnlyKeys.length,
      common: commonKeys.length,
    },
  };
}

function buildTopicEvidencePayload(candidates = [], config = {}) {
  const snippetMaxLength = Math.max(300, Number(config?.retrieval?.topicMode?.evidenceSnippetMaxLength || 1600));
  return candidates.map((candidate) => {
    const doc = candidate.doc || {};
    return {
      id: doc.id,
      title: doc.title || '',
      page: Number(doc.page) || null,
      fileName: doc.smart_file_name || '',
      citation: `[${doc.smart_file_name || 'Unknown'}:${Number(doc.page) || 'n/a'}]`,
      content: truncateTextPreserveLines(doc.content, snippetMaxLength),
      score: Number(candidate.finalScore || 0).toFixed(3),
    };
  });
}

function buildGlobalAutoMatches(candidateMapBySource, autoMatchThreshold) {
  const threshold = Number(autoMatchThreshold || 0);
  const edges = [];

  for (const [sourceIndex, candidates] of candidateMapBySource.entries()) {
    for (const candidate of (candidates || [])) {
      const similarity = Number(candidate?.similarity || 0);
      if (similarity < threshold) continue;
      edges.push({
        sourceIndex: Number(sourceIndex),
        targetIndex: Number(candidate?.targetIndex),
        similarity,
      });
    }
  }

  // Greedy by highest edge score across the whole graph to reduce local-collision artifacts.
  edges.sort((a, b) => b.similarity - a.similarity);

  const assignedSource = new Set();
  const assignedTarget = new Set();
  const assignments = [];

  for (const edge of edges) {
    if (assignedSource.has(edge.sourceIndex) || assignedTarget.has(edge.targetIndex)) continue;
    assignedSource.add(edge.sourceIndex);
    assignedTarget.add(edge.targetIndex);
    assignments.push(edge);
  }

  return {
    assignments,
    assignedSource,
    assignedTarget,
  };
}

function normalizeTopicLabel(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildTopicDifferencesFallback(sourceEvidence = [], targetEvidence = []) {
  const sourceTitles = sourceEvidence.map((item) => String(item?.title || '').trim()).filter(Boolean);
  const targetTitles = targetEvidence.map((item) => String(item?.title || '').trim()).filter(Boolean);

  const sourceKeyed = sourceTitles.map((title) => ({ raw: title, key: normalizeTopicLabel(title) })).filter((item) => item.key);
  const targetKeyed = targetTitles.map((title) => ({ raw: title, key: normalizeTopicLabel(title) })).filter((item) => item.key);

  const targetSet = new Set(targetKeyed.map((item) => item.key));
  const sourceSet = new Set(sourceKeyed.map((item) => item.key));

  const overlapCount = sourceKeyed.filter((item) => targetSet.has(item.key)).length;
  const overlapRatio = sourceKeyed.length > 0 ? overlapCount / sourceKeyed.length : 0;

  const sourceOnly = sourceKeyed.filter((item) => !targetSet.has(item.key)).map((item) => item.raw).slice(0, 3);
  const targetOnly = targetKeyed.filter((item) => !sourceSet.has(item.key)).map((item) => item.raw).slice(0, 3);

  const similarityLine = overlapRatio >= 0.5
    ? 'The two documents show moderate-to-strong thematic overlap for this topic, but section placement and wording differ.'
    : 'The two documents show limited direct thematic overlap for this topic based on retrieved evidence and appear to emphasize different sub-areas.';

  const sourceOnlyLine = sourceOnly.length > 0
    ? `Document A appears to uniquely emphasize: ${sourceOnly.join('; ')}.`
    : 'No strong Document A-only emphasis was detected in the retrieved evidence set.';

  const targetOnlyLine = targetOnly.length > 0
    ? `Document B appears to uniquely emphasize: ${targetOnly.join('; ')}.`
    : 'No strong Document B-only emphasis was detected in the retrieved evidence set.';

  return [
    '### Comparative Assessment',
    `- ${similarityLine}`,
    `- Source document perspective: ${sourceOnlyLine.replace(/^Document A appears to uniquely emphasize:\s*/i, '').replace(/^No strong Document A-only emphasis was detected in the retrieved evidence set\.?/i, 'No strong source-only emphasis detected.')}`,
    `- Target document perspective: ${targetOnlyLine.replace(/^Document B appears to uniquely emphasize:\s*/i, '').replace(/^No strong Document B-only emphasis was detected in the retrieved evidence set\.?/i, 'No strong target-only emphasis detected.')}`,
    '- If you need strict requirement-level deltas, refine the prompt with specific clauses or section names to improve evidence precision.',
  ].join('\n');
}

function ensureTopicDifferencesAssessment(analysis, sourceEvidence = [], targetEvidence = []) {
  const cleaned = String(analysis || '').trim();
  if (!cleaned) {
    return buildTopicDifferencesFallback(sourceEvidence, targetEvidence);
  }

  const hasAssessmentHeading = /(^|\n)#{1,6}\s*(Differences Assessment|Comparative Assessment)\b/i.test(cleaned);
  if (hasAssessmentHeading) {
    return cleaned;
  }

  return ['### Comparative Assessment', cleaned].join('\n\n');
}

async function buildTopicComparisonResult({ state, config }) {
  await logTopicComparisonEvent('complianceComparisonTopicModeStarted', {
    chatInteractionId: state?.chatInteractionId || null,
    chatId: state?.chatId || null,
    requestedComparisonMode: state?.requestedComparisonMode || null,
    userPromptLength: String(state?.userPrompt || '').length,
  });

  await updateProgressIfNeeded(state, createProgressMarkdown('Generating topic embedding for query...', '', 'Comparison'));
  const promptEmbedding = await createEmbeddingsBatch(state.embeddingsClient, [state.userPrompt]);
  const embedding = promptEmbedding[0] || [];

  await logTopicComparisonEvent('complianceComparisonTopicEmbeddingReady', {
    chatInteractionId: state?.chatInteractionId || null,
    embeddingDimensions: Array.isArray(embedding) ? embedding.length : 0,
  });

  await updateProgressIfNeeded(state, createProgressMarkdown('Searching topic evidence in source document...', '', 'Comparison'));

  const sourceCandidates = await runTopicSearchForConversation({
    searchClient: state.searchClient,
    promptEmbedding: embedding,
    userPrompt: state.userPrompt,
    conversationId: state.geisingerConversationA.id,
    config,
  });

  await logTopicComparisonEvent('complianceComparisonTopicSourceSearchComplete', {
    chatInteractionId: state?.chatInteractionId || null,
    sourceConversationId: state?.geisingerConversationA?.id || null,
    candidateCount: sourceCandidates.length,
  });

  await updateProgressIfNeeded(state, createProgressMarkdown('Searching topic evidence in target document...', '', 'Comparison'));

  const targetCandidates = await runTopicSearchForConversation({
    searchClient: state.searchClient,
    promptEmbedding: embedding,
    userPrompt: state.userPrompt,
    conversationId: state.geisingerConversationB.id,
    config,
  });

  await logTopicComparisonEvent('complianceComparisonTopicTargetSearchComplete', {
    chatInteractionId: state?.chatInteractionId || null,
    targetConversationId: state?.geisingerConversationB?.id || null,
    candidateCount: targetCandidates.length,
  });

  let sourceEvidence = buildTopicEvidencePayload(sourceCandidates, config);
  let targetEvidence = buildTopicEvidencePayload(targetCandidates, config);

  // Log source and target evidence content for diagnostics
  await logTopicComparisonEvent('complianceComparisonTopicEvidenceContent', {
    chatInteractionId: state?.chatInteractionId || null,
    sourceEvidencePreview: (sourceEvidence || []).map(e => ({
      id: e.id,
      title: e.title,
      page: e.page,
      content: (e.content || '').slice(0, 400)
    })),
    targetEvidencePreview: (targetEvidence || []).map(e => ({
      id: e.id,
      title: e.title,
      page: e.page,
      content: (e.content || '').slice(0, 400)
    })),
    sourceEvidenceCount: sourceEvidence.length,
    targetEvidenceCount: targetEvidence.length,
  });
  const listIntent = isLikelyListDeltaPrompt(state.userPrompt);

  if (listIntent) {
    const sourceRoleLikeCount = countRoleLikeEvidenceItems(sourceEvidence);
    const targetRoleLikeCount = countRoleLikeEvidenceItems(targetEvidence);
    const minRoleCandidates = Math.max(1, Number(config?.retrieval?.topicMode?.listRescueMinRoleCandidates || 2));
    const deterministicScanEnabled = config?.retrieval?.topicMode?.listDeterministicScanEnabled !== false;

    if (deterministicScanEnabled && (sourceRoleLikeCount < minRoleCandidates || targetRoleLikeCount < minRoleCandidates)) {
      await logTopicComparisonEvent('complianceComparisonTopicDeterministicScanTriggered', {
        chatInteractionId: state?.chatInteractionId || null,
        sourceRoleLikeCount,
        targetRoleLikeCount,
        minRoleCandidates,
      });

      const deterministic = await buildDeterministicListTopicEvidence({ state, config });
      if (deterministic.sourceEvidence.length > 0) {
        sourceEvidence = deterministic.sourceEvidence;
      }
      if (deterministic.targetEvidence.length > 0) {
        targetEvidence = deterministic.targetEvidence;
      }

      await logTopicComparisonEvent('complianceComparisonTopicDeterministicScanCompleted', {
        chatInteractionId: state?.chatInteractionId || null,
        sourceEvidenceCount: sourceEvidence.length,
        targetEvidenceCount: targetEvidence.length,
        sourceRoleLikeCount: countRoleLikeEvidenceItems(sourceEvidence),
        targetRoleLikeCount: countRoleLikeEvidenceItems(targetEvidence),
      });
    }
  }

  if (listIntent && (sourceEvidence.length === 0 || targetEvidence.length === 0)) {
    await logTopicComparisonEvent('complianceComparisonTopicInsufficientEvidence', {
      chatInteractionId: state?.chatInteractionId || null,
      sourceEvidenceCount: sourceEvidence.length,
      targetEvidenceCount: targetEvidence.length,
      reason: 'No role-list evidence retrieved for list-oriented topic prompt.',
    });

    const insufficientAnalysis = [
      '### Comparative Assessment',
      '- Insufficient topic-specific evidence was retrieved for the requested list-oriented topic.',
      '- The retrieved chunks were mostly generic process/form instructions rather than role/position lists.',
      '- Try re-running after preparation/index refresh, or ask with an explicit clause such as "Key Administrative Positions".',
    ].join('\n');

    return {
      mode: 'topic',
      sourceEvidence,
      targetEvidence,
      listDeltaSummary: {
        sourceOnly: [],
        targetOnly: [],
        common: [],
        counts: { sourceOnly: 0, targetOnly: 0, common: 0 },
      },
      analysis: insufficientAnalysis,
      counts: {
        sourceEvidenceCount: sourceEvidence.length,
        targetEvidenceCount: targetEvidence.length,
        sourceOnlyListItems: 0,
        targetOnlyListItems: 0,
        commonListItems: 0,
      },
    };
  }

  const listDeltaSummary = buildTopicListDeltaSummary(sourceEvidence, targetEvidence, state.userPrompt, config);

  if (listDeltaSummary) {
    await logTopicComparisonEvent('complianceComparisonTopicListDeltaDetected', {
      chatInteractionId: state?.chatInteractionId || null,
      counts: listDeltaSummary.counts,
    });
  }

  await updateProgressIfNeeded(state, createProgressMarkdown('Synthesizing topic comparison narrative...', '', 'Comparison'));

  const comparisonNarrative = await callCompletionWithFallback(
    state.completionsClient,
    config,
    [
      {
        role: 'system',
        content: 'You are a compliance analyst. Compare topic evidence from a Source document and a Target document. Emphasize comparative conclusions and cite [file:page].',
      },
      {
        role: 'user',
        content: [
          `User topic: ${state.userPrompt}`,
          'Source document evidence (first document selected in UI):',
          JSON.stringify(sourceEvidence, null, 2),
          'Target document evidence (second document selected in UI):',
          JSON.stringify(targetEvidence, null, 2),
          listDeltaSummary
            ? ['Potential list-item deltas detected from evidence:', JSON.stringify(listDeltaSummary, null, 2)].join('\n')
            : '',
          'Return concise markdown with explicit comparative framing:',
          '- Stay strictly on the requested topic. Ignore generic workflow text unless it explicitly addresses the topic.',
          '- If topic-specific evidence is weak, explicitly say insufficient topic-specific evidence.',
          '- Comparative Assessment',
          '- Added/Removed list items (for roles/positions/titles if present)',
          '- What is materially similar between source and target',
          '- What is materially different between source and target',
          '- Which side is stricter/more explicit where applicable',
          '- Any missing evidence warnings',
        ].join('\n\n'),
      },
    ],
    config.completion.maxShortTokens
  );

  await logTopicComparisonEvent('complianceComparisonTopicNarrativeGenerated', {
    chatInteractionId: state?.chatInteractionId || null,
    responseLength: String(comparisonNarrative || '').length,
    sourceEvidenceCount: sourceEvidence.length,
    targetEvidenceCount: targetEvidence.length,
  });

  const analysis = ensureTopicDifferencesAssessment(comparisonNarrative, sourceEvidence, targetEvidence);

  return {
    mode: 'topic',
    sourceEvidence,
    targetEvidence,
    listDeltaSummary,
    analysis,
    counts: {
      sourceEvidenceCount: sourceEvidence.length,
      targetEvidenceCount: targetEvidence.length,
      sourceOnlyListItems: listDeltaSummary?.counts?.sourceOnly || 0,
      targetOnlyListItems: listDeltaSummary?.counts?.targetOnly || 0,
      commonListItems: listDeltaSummary?.counts?.common || 0,
    },
  };
}

async function fetchAllDocumentSections(searchClient, conversationId, config) {
  const filter = `smartnote_id eq '${String(conversationId || '').replace(/'/g, "''")}'`;
  const results = [];

  const searchResponse = await searchClient.search('*', {
    filter,
    select: config.retrieval.selectFields,
    top: config.retrieval.comprehensiveMode.chunkFetchTop,
    searchMode: 'all',
  });

  for await (const result of searchResponse.results) {
    const doc = result.document || {};
    const title = String(doc.title || '').trim();
    const content = String(doc.content || '').trim();
    if (title.length < config.retrieval.comprehensiveMode.minTitleLength && content.length < config.retrieval.comprehensiveMode.minContentLength) {
      continue;
    }

    results.push({
      id: doc.id,
      title,
      normalizedTitle: normalizeTopicTitle(title),
      content,
      fileName: doc.smart_file_name || '',
      page: Number(doc.page) || null,
      smartnote_id: doc.smartnote_id || '',
    });
  }

  return results.slice(0, config.retrieval.comprehensiveMode.maxSectionsPerDocument);
}

async function adjudicateTopicMatch(completionsClient, config, sourceSection, targetSection, similarity) {
  const responseText = await callCompletionWithFallback(
    completionsClient,
    config,
    [
      {
        role: 'system',
        content: 'You determine if two policy/compliance topics are semantically the same despite section renumbering. Respond only as JSON.',
      },
      {
        role: 'user',
        content: [
          'Evaluate whether the source and target sections represent the same topic.',
          'Ignore numbering differences like 1.5 vs 2.7 and focus on semantic content.',
          `Similarity score hint: ${Number(similarity || 0).toFixed(3)}`,
          'Return JSON shape exactly:',
          '{"isMatch": true|false, "confidence": 0-1, "rationale": "..."}',
          'Source section:',
          JSON.stringify({ title: sourceSection.title, content: truncateText(sourceSection.content, 450) }),
          'Target section:',
          JSON.stringify({ title: targetSection.title, content: truncateText(targetSection.content, 450) }),
        ].join('\n\n'),
      },
    ],
    config.completion.maxShortTokens
  );

  const trimmed = String(responseText || '').trim();
  let parsed = null;

  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      parsed = JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    }
  }

  return {
    isMatch: !!parsed?.isMatch,
    confidence: Number(parsed?.confidence || 0),
    rationale: String(parsed?.rationale || '').trim(),
  };
}

async function buildComprehensiveComparisonResult({ state, config }) {
  const geisingerComparison = state.geisingerComparison;
  // Set status: loading_documents
  if (!isComprehensiveComparisonJob(state, config)) {
    await updateChatInteractionStatus(state.teamName, state.chatId, state.chatInteractionId, 'loading_documents');
  } else {
    // Set statusInfo to 'loading_documents' at start of workflow
    if (geisingerComparison) {
      geisingerComparison.statusInfo = 'loading_documents';
      await updateGesingerComparisonById(state.teamName, geisingerComparison);
    }
  }
  const fallbackConfig = config?.alignment?.fallbackSearch || {};
  const sourceSections = await fetchAllDocumentSections(state.searchClient, state.geisingerConversationA.id, config);
  const targetSections = await fetchAllDocumentSections(state.searchClient, state.geisingerConversationB.id, config);

  // Set status: generating_embeddings
  if (!isComprehensiveComparisonJob(state, config)) {
    await updateChatInteractionStatus(state.teamName, state.chatId, state.chatInteractionId, 'generating_embeddings');
  } else {
    afterConfigContext(state);
  }
  const includeFullContent = String(process.env.COMPLIANCE_COMPARISON_DEBUG_INCLUDE_FULL_CONTENT || '').toLowerCase() === 'true';

  const sourceEmbeddings = await createEmbeddingsBatch(
    state.embeddingsClient,
    sourceSections.map((section) => `${section.title}\n${truncateText(section.content, 900)}`)
  );

  const targetEmbeddings = await createEmbeddingsBatch(
    state.embeddingsClient,
    targetSections.map((section) => `${section.title}\n${truncateText(section.content, 900)}`)
  );

  // Set status: matching_topics
  if (!isComprehensiveComparisonJob(state, config)) {
    await updateChatInteractionStatus(state.teamName, state.chatId, state.chatInteractionId, 'matching_topics');
  } else {
    afterMatching(state);
  }

  const candidateMapBySource = new Map();

  for (let i = 0; i < sourceSections.length; i++) {
    const source = sourceSections[i];
    const row = [];
    for (let j = 0; j < targetSections.length; j++) {
      const target = targetSections[j];
      const similarity = cosineSimilarity(sourceEmbeddings[i], targetEmbeddings[j]);
      if (similarity >= config.alignment.similarityThreshold) {
        row.push({ targetIndex: j, similarity });
      }
    }
    row.sort((a, b) => b.similarity - a.similarity);
    candidateMapBySource.set(i, row.slice(0, config.alignment.maxTargetCandidatesPerSource));
  }

  // Set status: adjudicating_matches
  if (!isComprehensiveComparisonJob(state, config)) {
    await updateChatInteractionStatus(state.teamName, state.chatId, state.chatInteractionId, 'adjudicating_matches');
  } else {
    afterAdjudication(state);
  }

  const sourceOrder = [...candidateMapBySource.entries()]
    .map(([sourceIndex, matches]) => ({
      sourceIndex,
      bestSimilarity: matches[0]?.similarity || 0,
    }))
    .sort((a, b) => b.bestSimilarity - a.bestSimilarity)
    .map((item) => item.sourceIndex);

  const sourceCandidateStats = new Map();
  for (const [sourceIndex, matches] of candidateMapBySource.entries()) {
    const bestSimilarity = Number(matches?.[0]?.similarity || 0);
    const hasLlmCandidate = (matches || []).some((item) => Number(item?.similarity || 0) >= Number(config.alignment.llmAdjudicationThreshold || 0));
    sourceCandidateStats.set(Number(sourceIndex), {
      candidateCount: Array.isArray(matches) ? matches.length : 0,
      bestSimilarity,
      hasLlmCandidate,
    });
  }

  const usedTargetIndices = new Set();
  const matchedTopics = [];
  let sourceOnlyTopics = [];
  const sourceIndexById = new Map(sourceSections.map((section, index) => [String(section?.id || ''), index]));
  let primaryMatchingTopics = 0;
  let secondaryMatchingTopics = 0;

  const globalAuto = buildGlobalAutoMatches(candidateMapBySource, config.alignment.autoMatchThreshold);
  for (const assignment of globalAuto.assignments) {
    const source = sourceSections[assignment.sourceIndex];
    const target = targetSections[assignment.targetIndex];
    if (!source || !target) continue;

    const resolvedMatch = {
      source,
      target,
      similarity: assignment.similarity,
      confidence: 1,
      rationale: 'Auto-matched via high embedding similarity (global edge assignment).',
      matchType: 'auto',
      matchStage: 'primary',
    };
    resolvedMatch.differenceAssessment = assessMatchedTopicDifference(resolvedMatch);
    matchedTopics.push(resolvedMatch);
    usedTargetIndices.add(assignment.targetIndex);
    primaryMatchingTopics += 1;
  }

  for (const sourceIndex of sourceOrder) {
    if (globalAuto.assignedSource.has(sourceIndex)) continue;

    const source = sourceSections[sourceIndex];
    const targetCandidates = candidateMapBySource.get(sourceIndex) || [];

    let resolvedMatch = null;

    for (const candidate of targetCandidates) {
      if (usedTargetIndices.has(candidate.targetIndex)) continue;

      const target = targetSections[candidate.targetIndex];
      const similarity = candidate.similarity;

      if (similarity >= config.alignment.llmAdjudicationThreshold) {
        const adjudication = await adjudicateTopicMatch(
          state.completionsClient,
          config,
          source,
          target,
          similarity
        );

        if (adjudication.isMatch) {
          resolvedMatch = {
            source,
            target,
            similarity,
            confidence: adjudication.confidence,
            rationale: adjudication.rationale,
            matchType: 'llm',
            matchStage: 'primary',
          };
          break;
        }
      }
    }

    if (resolvedMatch) {
      resolvedMatch.differenceAssessment = assessMatchedTopicDifference(resolvedMatch);
      matchedTopics.push(resolvedMatch);
      usedTargetIndices.add(targetSections.findIndex((item) => item.id === resolvedMatch.target.id));
      primaryMatchingTopics += 1;
    } else {
      sourceOnlyTopics.push(source);
    }
  }

  if (sourceOnlyTopics.length > 0) {
    const secondaryThreshold = Number(config?.alignment?.secondaryMatchThreshold || config?.alignment?.autoMatchThreshold || 0.88);
    const sourceOnlyAfterSecondary = [];

    for (const source of sourceOnlyTopics) {
      const sourceId = String(source?.id || '');
      const sourceIndex = sourceIndexById.get(sourceId);
      if (!Number.isInteger(sourceIndex)) {
        sourceOnlyAfterSecondary.push(source);
        continue;
      }

      const candidates = candidateMapBySource.get(sourceIndex) || [];
      const bestCandidate = candidates[0] || null;
      if (!bestCandidate || Number(bestCandidate.similarity || 0) < secondaryThreshold) {
        sourceOnlyAfterSecondary.push(source);
        continue;
      }

      const target = targetSections[bestCandidate.targetIndex];
      if (!target) {
        sourceOnlyAfterSecondary.push(source);
        continue;
      }

      const secondaryMatch = {
        source,
        target,
        similarity: Number(bestCandidate.similarity || 0),
        confidence: 0.9,
        rationale: 'Secondary related match via high similarity to an already-assigned target section.',
        matchType: 'secondary-related',
        matchStage: 'secondary',
      };
      secondaryMatch.differenceAssessment = assessMatchedTopicDifference(secondaryMatch);
      matchedTopics.push(secondaryMatch);
      secondaryMatchingTopics += 1;
    }

    sourceOnlyTopics = sourceOnlyAfterSecondary;
  }

  const sourceOnlyInitialCount = sourceOnlyTopics.length;
  const sourceOnlyFallbackEligible = sourceOnlyTopics.filter((source) => {
    const sourceId = String(source?.id || '');
    const sourceIndex = sourceIndexById.get(sourceId);
    if (!Number.isInteger(sourceIndex)) return true;
    const stats = sourceCandidateStats.get(sourceIndex) || { candidateCount: 0, hasLlmCandidate: false };
    if (!fallbackConfig.onlyWhenNoPrimaryCandidate) return true;
    return Number(stats.candidateCount || 0) === 0 || !stats.hasLlmCandidate;
  });

  let fallbackRecoveredFromSourceOnly = 0;
  let fallbackSourceOnlyProbeAttempts = 0;
  // Set status: fallback_search (if fallback enabled)
  if (fallbackConfig.enabled && sourceOnlyFallbackEligible.length > 0) {
    if (!isComprehensiveComparisonJob(state, config)) {
      await updateChatInteractionStatus(state.teamName, state.chatId, state.chatInteractionId, 'fallback_search');
    }
  }
  if (fallbackConfig.enabled && sourceOnlyFallbackEligible.length > 0) {
    const targetIndexById = new Map(targetSections.map((section, index) => [String(section?.id || ''), index]));
    const maxProbeCount = Math.min(
      sourceOnlyFallbackEligible.length,
      Number(fallbackConfig.maxSourceOnlyTopicsToProbe || sourceOnlyFallbackEligible.length)
    );

    const fallbackProbeSources = sourceOnlyFallbackEligible.slice(0, maxProbeCount);
    const fallbackPromptBySourceId = new Map();
    for (const source of fallbackProbeSources) {
      fallbackPromptBySourceId.set(String(source?.id || ''), buildFallbackSearchPromptFromSection(source));
    }

    const fallbackPromptEmbeddings = await createEmbeddingsBatch(
      state.embeddingsClient,
      fallbackProbeSources.map((source) => fallbackPromptBySourceId.get(String(source?.id || '')) || '')
    );

    const sourceByIdForProbe = new Map(fallbackProbeSources.map((source) => [String(source?.id || ''), source]));
    const embeddingBySourceId = new Map();
    for (let i = 0; i < fallbackProbeSources.length; i++) {
      embeddingBySourceId.set(String(fallbackProbeSources[i]?.id || ''), fallbackPromptEmbeddings[i] || []);
    }

    const sourceOnlyAfterFallback = [];
    for (const source of sourceOnlyTopics) {
      const sourceId = String(source?.id || '');
      const shouldProbe = sourceByIdForProbe.has(sourceId);
      if (!shouldProbe) {
        sourceOnlyAfterFallback.push(source);
        continue;
      }

      fallbackSourceOnlyProbeAttempts += 1;
      const sourceIndex = sourceIndexById.get(sourceId);
      const sourceEmbedding = Number.isInteger(sourceIndex) ? sourceEmbeddings[sourceIndex] : null;
      if (!sourceEmbedding) {
        sourceOnlyAfterFallback.push(source);
        continue;
      }

      const fallbackPrompt = fallbackPromptBySourceId.get(sourceId) || '';
      const fallbackPromptEmbedding = embeddingBySourceId.get(sourceId) || [];

      const fallbackCandidates = await runFallbackSearchForConversationSection({
        searchClient: state.searchClient,
        promptEmbedding: fallbackPromptEmbedding,
        searchPrompt: fallbackPrompt,
        conversationId: state.geisingerConversationB.id,
        config,
      });

      const rankedCandidates = fallbackCandidates
        .map((candidate) => {
          const targetId = String(candidate?.doc?.id || '');
          const targetIndex = targetIndexById.get(targetId);
          if (!Number.isInteger(targetIndex) || usedTargetIndices.has(targetIndex)) return null;

          const targetEmbedding = targetEmbeddings[targetIndex];
          const similarity = cosineSimilarity(sourceEmbedding, targetEmbedding);
          return {
            targetIndex,
            similarity,
            candidateScore: Number(candidate?.finalScore || 0),
          };
        })
        .filter(Boolean)
        .sort((a, b) => {
          const similarityDelta = b.similarity - a.similarity;
          if (Math.abs(similarityDelta) > 0.0001) return similarityDelta;
          return b.candidateScore - a.candidateScore;
        })
        .slice(0, Number(fallbackConfig.maxTargetCandidatesPerSource || 6));

      let resolvedFallbackMatch = null;
      for (const candidate of rankedCandidates) {
        const target = targetSections[candidate.targetIndex];
        if (!target) continue;

        if (candidate.similarity >= Number(fallbackConfig.autoMatchThreshold || 0.9)) {
          resolvedFallbackMatch = {
            source,
            target,
            similarity: candidate.similarity,
            confidence: 0.95,
            rationale: 'Matched via fallback retrieval and high semantic similarity.',
            matchType: 'fallback-search',
            matchStage: 'fallback',
          };
          break;
        }

        if (candidate.similarity >= Number(fallbackConfig.llmAdjudicationThreshold || 0.6)) {
          const adjudication = await adjudicateTopicMatch(
            state.completionsClient,
            config,
            source,
            target,
            candidate.similarity
          );

          if (adjudication.isMatch) {
            resolvedFallbackMatch = {
              source,
              target,
              similarity: candidate.similarity,
              confidence: adjudication.confidence,
              rationale: adjudication.rationale || 'Matched via fallback retrieval and LLM adjudication.',
              matchType: 'fallback-search',
              matchStage: 'fallback',
            };
            break;
          }
        }
      }

      if (resolvedFallbackMatch) {
        resolvedFallbackMatch.differenceAssessment = assessMatchedTopicDifference(resolvedFallbackMatch);
        matchedTopics.push(resolvedFallbackMatch);

        const matchedTargetIndex = targetSections.findIndex((item) => item.id === resolvedFallbackMatch.target.id);
        if (matchedTargetIndex >= 0) {
          usedTargetIndices.add(matchedTargetIndex);
        }

        fallbackRecoveredFromSourceOnly += 1;
      } else {
        sourceOnlyAfterFallback.push(source);
      }
    }

    sourceOnlyTopics = sourceOnlyAfterFallback;
  }

  const targetOnlyTopics = targetSections.filter((_, index) => !usedTargetIndices.has(index));

  const counts = {
    sourceTopicCount: sourceSections.length,
    targetTopicCount: targetSections.length,
    matchingTopics: matchedTopics.length,
    uniqueMatchedTargetTopics: usedTargetIndices.size,
    primaryMatchingTopics,
    secondaryMatchingTopics,
    sourceNotInTarget: sourceOnlyTopics.length,
    targetNotInSource: targetOnlyTopics.length,
    fallbackRecoveredFromSourceOnly,
    fallbackSourceOnlyProbeAttempts,
  };

  logComparisonEvent('complianceComparisonGraphV2FallbackRecoverySummary', {
    sourceOnlyInitial: sourceOnlyInitialCount,
    fallbackSourceOnlyProbeAttempts,
    fallbackRecoveredFromSourceOnly,
    sourceOnlyFinal: sourceOnlyTopics.length,
  });

  const validation = {
    sourceBalanced: counts.matchingTopics + counts.sourceNotInTarget === counts.sourceTopicCount,
    targetBalanced: counts.uniqueMatchedTargetTopics + counts.targetNotInSource === counts.targetTopicCount,
  };

  const analysis = await callCompletionWithFallback(
    state.completionsClient,
    config,
    [
      {
        role: 'system',
        content: 'You are a compliance analyst. Summarize comprehensive source-vs-target comparison findings with clear comparative conclusions and practical implications.',
      },
      {
        role: 'user',
        content: [
          `User prompt: ${state.userPrompt}`,
          'Counts:',
          JSON.stringify(counts, null, 2),
          'Matched topics (first 20):',
          JSON.stringify(matchedTopics.slice(0, 20).map((item) => ({
            sourceTitle: item.source.title,
            targetTitle: item.target.title,
            similarity: Number(item.similarity || 0).toFixed(3),
            rationale: item.rationale,
          })), null, 2),
          'Source-only topics (first 20):',
          JSON.stringify(sourceOnlyTopics.slice(0, 20).map((item) => ({ title: item.title, page: item.page, fileName: item.fileName })), null, 2),
          'Target-only topics (first 20):',
          JSON.stringify(targetOnlyTopics.slice(0, 20).map((item) => ({ title: item.title, page: item.page, fileName: item.fileName })), null, 2),
          'Return markdown with explicit source-vs-target framing:',
          '- Comparative assessment',
          '- Executive summary',
          '- Material changes to monitor',
          '- Risks if source-only topics are required',
          '- Practical next steps',
          '- Keep citations in [file:page] form where possible',
        ].join('\n\n'),
      },
    ],
    config.completion.maxTokens
  );

  const candidateSnapshot = sourceSections.map((source, sourceIndex) => {
    const candidates = (candidateMapBySource.get(sourceIndex) || []).map((candidate) => {
      const target = targetSections[candidate.targetIndex] || {};
      return {
        targetIndex: candidate.targetIndex,
        similarity: Number(candidate?.similarity || 0),
        targetId: target?.id || '',
        targetTitle: target?.title || '',
        targetPage: target?.page || null,
        targetFileName: target?.fileName || '',
        usedByAnotherMatch: usedTargetIndices.has(candidate.targetIndex)
      };
    });

    return {
      sourceIndex,
      sourceId: source?.id || '',
      sourceTitle: source?.title || '',
      sourcePage: source?.page || null,
      sourceFileName: source?.fileName || '',
      candidateCount: candidates.length,
      candidates
    };
  });

  await writeComparisonDebugArtifact({
    timestamp: new Date().toISOString(),
    comparisonMode: 'comprehensive-v2',
    userPrompt: state?.userPrompt || '',
    preparationVersion: CURRENT_PREPARATION_VERSION,
    debugConfig: {
      similarityThreshold: config?.alignment?.similarityThreshold,
      autoMatchThreshold: config?.alignment?.autoMatchThreshold,
      llmAdjudicationThreshold: config?.alignment?.llmAdjudicationThreshold,
      maxTargetCandidatesPerSource: config?.alignment?.maxTargetCandidatesPerSource,
      includeFullContent
    },
    sourcePreparation: state?.geisingerConversationA || {},
    targetPreparation: state?.geisingerConversationB || {},
    extractedTopics: {
      source: sourceSections.map((section) => buildSectionDebugView(section, includeFullContent)),
      target: targetSections.map((section) => buildSectionDebugView(section, includeFullContent)),
    },
    candidateMapBySource: candidateSnapshot,
    comparisonResults: {
      counts,
      validation,
      matchedTopics: matchedTopics.map((item) => ({
        similarity: Number(item?.similarity || 0),
        confidence: Number(item?.confidence || 0),
        matchType: item?.matchType || '',
        rationale: item?.rationale || '',
        differenceAssessment: item?.differenceAssessment || '',
        source: buildSectionDebugView(item?.source || {}, includeFullContent),
        target: buildSectionDebugView(item?.target || {}, includeFullContent),
      })),
      sourceOnlyTopics: sourceOnlyTopics.map((item) => buildSectionDebugView(item, includeFullContent)),
      targetOnlyTopics: targetOnlyTopics.map((item) => buildSectionDebugView(item, includeFullContent)),
      analysis,
    }
  });


  // Set status: analyzing_differences
  if (!isComprehensiveComparisonJob(state, config)) {
    await updateChatInteractionStatus(state.teamName, state.chatId, state.chatInteractionId, 'analyzing_differences');
  } else {
    await afterAnalysis(state);
  }

  // --- LLM-powered difference analysis for all rows ---
  async function analyzeWithLLM(sourceContent, targetContent) {
    if (!sourceContent || !targetContent) return '';
    try {
      const { callCompletionWithFallback, buildSectionDiffPrompt } = await import('./nodes/llmUtils.js');
      const prompt = buildSectionDiffPrompt(sourceContent, targetContent);
      const messages = [
        { role: 'system', content: 'You are a compliance expert. Compare two regulatory text sections for substantive differences.' },
        { role: 'user', content: prompt }
      ];
      return await callCompletionWithFallback(state.completionsClient, config, messages, config.completion.maxTokens);
    } catch (e) {
      return `Error analyzing difference: ${e.message}`;
    }
  }

  // Analyze matched topics
  for (const item of matchedTopics) {
    if (item.source?.content && item.target?.content) {
      item.llmDiff = await analyzeWithLLM(item.source.content, item.target.content);
    } else {
      item.llmDiff = '';
    }
  }
  // Analyze source-only topics (compare to empty target)
  for (const item of sourceOnlyTopics) {
    if (item.content) {
      item.llmDiff = await analyzeWithLLM(item.content, '');
    } else {
      item.llmDiff = '';
    }
  }
  // Analyze target-only topics (compare to empty source)
  for (const item of targetOnlyTopics) {
    if (item.content) {
      item.llmDiff = await analyzeWithLLM('', item.content);
    } else {
      item.llmDiff = '';
    }
  }

  let spreadsheetArtifact = null;
  try {
    // Set status: generating_spreadsheet
    if (!isComprehensiveComparisonJob(state, config)) {
      await updateChatInteractionStatus(state.teamName, state.chatId, state.chatInteractionId, 'generating_spreadsheet');
    } else {
      await afterSpreadsheet(state);
    }
    await updateProgressIfNeeded(
      state,
      createProgressMarkdown('Generating comprehensive comparison spreadsheet...', '', 'Comparison')
    );

    spreadsheetArtifact = await buildComprehensiveSpreadsheetArtifact(state, {
      matchedTopics,
      sourceOnlyTopics,
      targetOnlyTopics,
      counts,
    });

    await updateProgressIfNeeded(
      state,
      createProgressMarkdown('Spreadsheet ready and attached to results.', '', 'Comparison')
    );
  } catch (error) {
    logComparisonEvent('complianceComparisonGraphV2SpreadsheetFailed', {
      error: error?.message || String(error),
    });
    // Set status: error
    if (!isComprehensiveComparisonJob(state, config)) {
      await updateChatInteractionStatus(state.teamName, state.chatId, state.chatInteractionId, 'error');
    }
  }

  // Set status: formatting_narrative
  if (!isComprehensiveComparisonJob(state, config)) {
    await updateChatInteractionStatus(state.teamName, state.chatId, state.chatInteractionId, 'formatting_narrative');
  } else {
    await afterFormatting(state);
  }
  return {
    mode: 'comprehensive',
    sourceSections,
    targetSections,
    matchedTopics,
    sourceOnlyTopics,
    targetOnlyTopics,
    counts,
    validation,
    analysis,
    spreadsheetBlobName: spreadsheetArtifact?.spreadsheetBlobName || '',
    spreadsheetFileName: spreadsheetArtifact?.spreadsheetFileName || '',
    downloadLink: spreadsheetArtifact?.downloadLink || '',
  };
}

function buildTopicModeMarkdown(result, state) {
  const topicEvidenceLimit = Math.max(1, Number(state?.comparisonConfigV2?.runtime?.display?.topicEvidenceLimit || 10));
  const sourceLines = (result.sourceEvidence || []).slice(0, topicEvidenceLimit).map((item) => `- ${item.citation} ${item.title}`);
  const targetLines = (result.targetEvidence || []).slice(0, topicEvidenceLimit).map((item) => `- ${item.citation} ${item.title}`);
  const sourceOnlyLines = (result?.listDeltaSummary?.sourceOnly || []).map((item) => `- ${item.item}${item.citations?.[0] ? ` (${item.citations[0]})` : ''}`);
  const targetOnlyLines = (result?.listDeltaSummary?.targetOnly || []).map((item) => `- ${item.item}${item.citations?.[0] ? ` (${item.citations[0]})` : ''}`);
  const commonListLines = (result?.listDeltaSummary?.common || []).map((item) => `- ${item.item}${item.citations?.[0] ? ` (${item.citations[0]})` : ''}`);
  const sourceLabel = buildSourceOrTargetDocumentLabel(state.geisingerConversationA, 'Source Document');
  const targetLabel = buildSourceOrTargetDocumentLabel(state.geisingerConversationB, 'Target Document');

  return [
    '## Topic Comparison',
    '',
    `**Question:** _${state.userPrompt}_`,
    '',
    `**Source Document:** ${sourceLabel}`,
    `**Target Document:** ${targetLabel}`,
    '',
    `**Evidence Counts:** Source=${result.counts.sourceEvidenceCount}, Target=${result.counts.targetEvidenceCount}`,
    '',
    '### Comparison Analysis',
    '',
    ensureTopicDifferencesAssessment(result.analysis, result.sourceEvidence, result.targetEvidence),
    '',
    '### Alignment Summary',
    `- Source evidence snippets considered: ${result.counts.sourceEvidenceCount}`,
    `- Target evidence snippets considered: ${result.counts.targetEvidenceCount}`,
    `- Source-only list items detected: ${result.counts.sourceOnlyListItems || 0}`,
    `- Target-only list items detected: ${result.counts.targetOnlyListItems || 0}`,
    `- Comparative assessment included: ${result.analysis ? 'Yes' : 'Fallback used'}`,
    '',
    '### List Delta (Detected Items)',
    '#### Source Only',
    sourceOnlyLines.length ? sourceOnlyLines.join('\n') : '- None detected.',
    '',
    '#### Target Only',
    targetOnlyLines.length ? targetOnlyLines.join('\n') : '- None detected.',
    '',
    '#### Common Items',
    commonListLines.length ? commonListLines.join('\n') : '- None detected.',
    '',
    '### Evidence From Source Document',
    sourceLines.length ? sourceLines.join('\n') : '- No evidence retrieved.',
    '',
    '### Evidence From Target Document',
    targetLines.length ? targetLines.join('\n') : '- No evidence retrieved.',
  ].join('\n');
}

/**
 * Builds a topic-based comparison markdown with LLM-powered difference assessment between source and target evidence.
 * @param {object} result - The comparison result object containing sourceEvidence, targetEvidence, etc.
 * @param {object} state - The state/config object, must include completionsClient and userPrompt.
 * @returns {Promise<string>} Markdown string with LLM assessment and evidence details.
 */
async function buildTopicModeMarkdown2(result, state) {
  const topicEvidenceLimit = Math.max(1, Number(state?.comparisonConfigV2?.runtime?.display?.topicEvidenceLimit || 10));
  const sourceEvidence = (result.sourceEvidence || []).slice(0, topicEvidenceLimit);
  const targetEvidence = (result.targetEvidence || []).slice(0, topicEvidenceLimit);
  const sourceLines = sourceEvidence.map((item) => `- ${item.citation} ${item.title}`);
  const targetLines = targetEvidence.map((item) => `- ${item.citation} ${item.title}`);
  const sourceLabel = buildSourceOrTargetDocumentLabel(state.geisingerConversationA, 'Source Document');
  const targetLabel = buildSourceOrTargetDocumentLabel(state.geisingerConversationB, 'Target Document');

  // Prepare LLM prompt for difference assessment
  const llmPrompt = [
    `User prompt: ${state.userPrompt}`,
    '',
    `Source Evidence (${sourceEvidence.length}):`,
    ...sourceEvidence.map((e, i) => `${i + 1}. ${e.content || e.title || ''}`),
    '',
    `Target Evidence (${targetEvidence.length}):`,
    ...targetEvidence.map((e, i) => `${i + 1}. ${e.content || e.title || ''}`),
    '',
    'Compare the source and target evidence above. Provide a concise assessment of the key differences, similarities, and any material compliance risks or gaps. Use bullet points for differences and similarities. Highlight any evidence that is present in one but not the other. Frame your answer for a compliance analyst.',
    '',
    'Return only markdown.'
  ].join('\n');

  let llmAssessment = '';
  try {
    const messages = [
      { role: 'system', content: 'You are a compliance analyst. Compare source and target evidence for compliance differences.' },
      { role: 'user', content: llmPrompt }
    ];
    llmAssessment = await callCompletionWithFallback(
      state.completionsClient,
      state.comparisonConfigV2 || {},
      messages,
      5000
    );
  } catch (err) {
    llmAssessment = `**LLM assessment unavailable:** ${err?.message || err}`;
  }

  return [
    '## Topic Comparison (Intelligent-Assessmenet)',
    '',
    `**Question:** _${state.userPrompt}_`,
    '',
    `**Source Document:** ${sourceLabel}`,
    `**Target Document:** ${targetLabel}`,
    '',
    '### Assistant Assessment of Differences',
    llmAssessment,
    '',
    '### Evidence From Source Document',
    sourceLines.length ? sourceLines.join('\n') : '- No evidence retrieved.',
    '',
    '### Evidence From Target Document',
    targetLines.length ? targetLines.join('\n') : '- No evidence retrieved.',
  ].join('\n');
}

function getComparisonMarkdownListLimit(config) {
  const raw = Number(config?.runtime?.display?.markdownListLimit || 30);
  if (!Number.isFinite(raw) || raw <= 0) return 30;
  return Math.floor(raw);
}

function formatListHeadingWithLimit(baseHeading, renderedCount, totalCount) {
  if (!Number.isFinite(totalCount) || totalCount <= renderedCount) return baseHeading;
  return `${baseHeading} (showing first ${renderedCount} of ${totalCount})`;
}

function buildComprehensiveModeMarkdown(result, state) {
  const listLimit = getComparisonMarkdownListLimit(state?.comparisonConfigV2);

  const matchedLines = result.matchedTopics.slice(0, listLimit).map((item) => {
    const sourceCitation = `[${item.source.fileName || 'Source'}:${item.source.page || 'n/a'}]`;
    const targetCitation = `[${item.target.fileName || 'Target'}:${item.target.page || 'n/a'}]`;
    const differenceAssessment = String(item?.differenceAssessment || '').trim();
    const matchType = String(item?.matchType || 'unknown').trim();
    const stage = String(item?.matchStage || '').trim();
    const typeLine = ` | Match type: ${matchType}${stage ? ` (${stage})` : ''}`;
    const assessmentLine = differenceAssessment ? ` | Difference assessment: ${differenceAssessment}` : '';
    return `- ${sourceCitation} ${item.source.title}  ->  ${targetCitation} ${item.target.title}${typeLine}${assessmentLine}`;
  });

  const sourceOnlyLines = result.sourceOnlyTopics.slice(0, listLimit).map((item) => {
    const citation = `[${item.fileName || 'Source'}:${item.page || 'n/a'}]`;
    return `- ${citation} ${item.title}`;
  });

  const targetOnlyLines = result.targetOnlyTopics.slice(0, listLimit).map((item) => {
    const citation = `[${item.fileName || 'Target'}:${item.page || 'n/a'}]`;
    return `- ${citation} ${item.title}`;
  });

  const validationBadge = (result.validation.sourceBalanced && result.validation.targetBalanced)
    ? 'PASS'
    : 'FAIL';

  const sourceLabel = buildSourceOrTargetDocumentLabel(state.geisingerConversationA, 'Source Document');
  const targetLabel = buildSourceOrTargetDocumentLabel(state.geisingerConversationB, 'Target Document');

  return [
    '## Comprehensive Document Comparison',
    '',
    `**Question:** _${state.userPrompt}_`,
    '',
    `**Source Document:** ${sourceLabel}`,
    `**Target Document:** ${targetLabel}`,
    '',
    '### Count Summary',
    `- Source topics total: ${result.counts.sourceTopicCount}`,
    `- Target topics total: ${result.counts.targetTopicCount}`,
    `- Matching topics: ${result.counts.matchingTopics}`,
    `- Primary one-to-one matches: ${result.counts.primaryMatchingTopics || 0}`,
    `- Secondary related matches: ${result.counts.secondaryMatchingTopics || 0}`,
    `- Fallback matches recovered: ${result.counts.fallbackRecoveredFromSourceOnly || 0}`,
    `- Fallback probes attempted: ${result.counts.fallbackSourceOnlyProbeAttempts || 0}`,
    `- Source not in target: ${result.counts.sourceNotInTarget}`,
    `- Target not in source: ${result.counts.targetNotInSource}`,
    `- Unique matched target topics: ${result.counts.uniqueMatchedTargetTopics || 0}`,
    `- Count validation: ${validationBadge}`,
    '',
    '### Comparison Analysis',
    '',
    result.analysis,
    '',
    '### Alignment Summary',
    `- Source total topics accounted for: ${result.validation.sourceBalanced ? 'Yes' : 'No'}`,
    `- Target total topics accounted for: ${result.validation.targetBalanced ? 'Yes' : 'No'}`,
    `- Matched topic pairs: ${result.counts.matchingTopics}`,
    '',
    `### ${formatListHeadingWithLimit('Matching Topics', matchedLines.length, result.counts.matchingTopics)}`,
    matchedLines.length ? matchedLines.join('\n') : '- No matched topics.',
    '',
    `### ${formatListHeadingWithLimit('Source Not In Target', sourceOnlyLines.length, result.counts.sourceNotInTarget)}`,
    sourceOnlyLines.length ? sourceOnlyLines.join('\n') : '- None.',
    '',
    `### ${formatListHeadingWithLimit('Target Not In Source', targetOnlyLines.length, result.counts.targetNotInSource)}`,
    targetOnlyLines.length ? targetOnlyLines.join('\n') : '- None.',
    '',
    '### Detailed Spreadsheet',
    result.downloadLink
      ? `- [Download comprehensive comparison spreadsheet](${result.downloadLink})`
      : '- Spreadsheet unavailable for this run.',
  ].join('\n');
}

async function updateProgressIfNeeded(state, message) {
  if (!state.chatInteractionId) {
    if (isTopicComparisonState(state)) {
      await logTopicComparisonEvent('complianceComparisonTopicProgressSkippedNoInteractionId', {
        mode: state?.comparisonMode || null,
        requestedComparisonMode: state?.requestedComparisonMode || null,
      });
    }
    return;
  }

  const topicMode = isTopicComparisonState(state);
  const normalizedMessage = String(message || '');
  const stage = parseProgressStageFromMarkdown(normalizedMessage);
  const messageHash = computeMessageHash(normalizedMessage);

  if (topicMode) {
    await logTopicComparisonEvent('complianceComparisonTopicProgressUpdateAttempt', {
      chatInteractionId: state.chatInteractionId,
      chatId: state.chatId || null,
      teamName: state.teamName || null,
      mode: state?.comparisonMode || null,
      requestedComparisonMode: state?.requestedComparisonMode || null,
      stage: stage || null,
      messageLength: normalizedMessage.length,
      messageHash,
      messagePreview: truncateText(normalizedMessage.replace(/\s+/g, ' ').trim(), 180),
      timestamp: new Date().toISOString(),
    });
  }

  try {
    await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, normalizedMessage);
  } catch (error) {
    if (topicMode) {
      await logTopicComparisonEvent('complianceComparisonTopicProgressUpdateFailed', {
        chatInteractionId: state.chatInteractionId,
        stage: stage || null,
        messageHash,
        error: error?.message || String(error),
      });
    }
    throw error;
  }

  if (topicMode) {
    const snapshot = await readTopicComparisonProgressSnapshot(state);
    await logTopicComparisonEvent('complianceComparisonTopicProgressUpdatePersisted', {
      chatInteractionId: state.chatInteractionId,
      stage: stage || null,
      attemptedMessageHash: messageHash,
      persisted: snapshot,
    });
  }
}

function startComparisonProgressHeartbeat(state, intervalMs = 8000) {
  if (!state?.chatInteractionId) return () => { };

  const heartbeatStages = [
    'Reviewing source and target document structure...',
    'Retrieving policy evidence for comparison...',
    'Aligning similar requirements and themes...',
    'Assessing key differences and overlaps...',
    'Preparing business-ready comparison summary...',
  ];
  let heartbeatIndex = 0;
  let inFlight = false;
  const timer = setInterval(async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      const stage = heartbeatStages[heartbeatIndex % heartbeatStages.length];
      heartbeatIndex += 1;
      const heartbeat = createProgressMarkdown(
        stage,
        '',
        'Comparison'
      );
      await updateProgressIfNeeded(state, heartbeat);
    } catch (error) {
      if (isChatInteractionCancelledError(error)) {
        clearInterval(timer);
        return;
      }
      logComparisonEvent('complianceComparisonGraphV2HeartbeatError', {
        chatInteractionId: state.chatInteractionId,
        error: error?.message || String(error),
      });
    } finally {
      inFlight = false;
    }
  }, intervalMs);

  return () => {
    clearInterval(timer);
  };
}

const loadConfigNodeV2 = async (state) => {
  console.log(`[loadConfigNodeV2]: started`);
  try {
    const geisingerConfigEnabled = String(process.env.COMPLIANCE_COMPARISON_GEISINGER_CONFIG_ENABLED || 'true').toLowerCase() !== 'false';
    const geisingerConfigDocuments = geisingerConfigEnabled
      ? await fetchComparisonConfigDocumentsV2()
      : [];

    const { config, metadata } = await loadComparisonConfigV2({
      geisingerConfigDocuments,
    });

    logComparisonEvent('comparisonV2ConfigResolved', {
      fileConfigCount: Object.keys(metadata?.fileSources || {}).length,
      geisingerDocumentCount: metadata?.geisingerOverlay?.documentCount || 0,
      geisingerAppliedCount: Array.isArray(metadata?.geisingerOverlay?.applied) ? metadata.geisingerOverlay.applied.length : 0,
      geisingerParseErrorCount: Array.isArray(metadata?.geisingerOverlay?.parseErrors) ? metadata.geisingerOverlay.parseErrors.length : 0,
      envOverridesApplied: metadata?.envOverridesApplied || {},
    });

    return {
      ...state,
      comparisonConfigV2: config,
      comparisonConfigMetadataV2: metadata,
    };
  } catch (error) {
    logComparisonEvent('comparisonV2ConfigLoadFailed', {
      error: error?.message || String(error),
    });

    return {
      ...state,
      comparisonConfigV2: HARD_CODED_COMPARISON_CONFIG,
    };
  }
};

const initializeComparisonContextNodeV2 = async (state) => {
  console.log(`[initializeComparisonContextNodeV2]: started`);
  const contextProgress = createProgressMarkdown('Loading source and target documents...', '', 'Comparison');
  await updateProgressIfNeeded(state, contextProgress);

  const { source, target } = await fetchComparisonConversations(state.teamName, state.geisingerComparison);
  return {
    ...state,
    geisingerConversationA: source,
    geisingerConversationB: target,
  };
};

const detectModeNodeV2 = async (state) => {
  console.log(`[detectModeNodeV2]: started`);
  const requestedMode = String(state.requestedComparisonMode || '').trim().toLowerCase();
  const comparisonMode = (requestedMode === 'comprehensive' || requestedMode === 'topic')
    ? requestedMode
    : (isComprehensiveComparisonPrompt(state.userPrompt, state.comparisonConfigV2) ? 'comprehensive' : 'topic');

  const modeProgress = createProgressMarkdown(
    `Detected ${comparisonMode} mode. Gathering evidence...`,
    '',
    'Comparison'
  );
  await updateProgressIfNeeded(state, modeProgress);

  return {
    ...state,
    comparisonMode,
  };
};

const executeComparisonNodeV2 = async (state) => {
  console.log(`[executeComparisonNodeV2]: started`);
  const executionStage = state.comparisonMode === 'comprehensive'
    ? 'Evaluating full-document topic alignment and differences...'
    : 'Evaluating topic-level differences and overlap...';
  const progress = createProgressMarkdown(executionStage, '', 'Comparison');
  await updateProgressIfNeeded(state, progress);

  let comparisonResult;
  if (state.comparisonMode === 'comprehensive') {
    comparisonResult = await buildComprehensiveComparisonResult({ state, config: state.comparisonConfigV2 });
  } else {
    comparisonResult = await buildTopicComparisonResult({ state, config: state.comparisonConfigV2 });
  }

  logComparisonEvent('complianceComparisonGraphV2ComparisonComputed', {
    mode: state.comparisonMode,
    counts: comparisonResult?.counts || null,
    matchedTopics: Array.isArray(comparisonResult?.matchedTopics) ? comparisonResult.matchedTopics.length : null,
  });

  return {
    ...state,
    comparisonResult,
  };
};

const formatResponseNodeV2 = async (state) => {
  console.log(`[formatResponseNodeV2]: started`);
  const { comparisonMode, comparisonResult } = state;

  const formattingProgress = createProgressMarkdown('Drafting comparison narrative and recommendations...', '', 'Comparison');
  await updateProgressIfNeeded(state, formattingProgress);

  const formattedResponseRaw = comparisonMode === 'comprehensive'
    ? buildComprehensiveModeMarkdown(comparisonResult, state)
    : await buildTopicModeMarkdown2(comparisonResult, state);

  const citationUrlMap = buildComparisonCitationUrlMap(state);
  const formattedResponse = linkifyComparisonInlineCitations(formattedResponseRaw, citationUrlMap);

  const progress = createProgressMarkdown('Comparison complete', '', 'Comparison');
  await updateProgressIfNeeded(state, progress);

  return {
    ...state,
    formattedResponse,
    suggestedPrompts: [
      'Show me the highest-risk differences first.',
      'Which source-only topics are likely compliance blockers?',
      'Can you provide exact quoted text for the top three differences?',
    ],
  };
};

const StateAnnotation = Annotation.Root({
  nuid: Annotation,
  teamName: Annotation,
  assistantName: Annotation,
  smartNoteId: Annotation,
  chatId: Annotation,
  chatInteractionId: Annotation,
  geisingerComparison: Annotation,
  sources: Annotation,
  userPrompt: Annotation,
  completionsClient: Annotation,
  embeddingsClient: Annotation,
  searchClient: Annotation,
  comparisonConfigV2: Annotation,
  comparisonConfigMetadataV2: Annotation,
  comparisonMode: Annotation,
  requestedComparisonMode: Annotation,
  geisingerConversationA: Annotation,
  geisingerConversationB: Annotation,
  comparisonResult: Annotation,
  formattedResponse: Annotation,
  suggestedPrompts: Annotation,
});

const graph = new StateGraph(StateAnnotation)
  .addNode('loadConfigNodeV2', loadConfigNodeV2)
  .addNode('initializeComparisonContextNodeV2', initializeComparisonContextNodeV2)
  .addNode('detectModeNodeV2', detectModeNodeV2)
  .addNode('executeComparisonNodeV2', executeComparisonNodeV2)
  .addNode('formatResponseNodeV2', formatResponseNodeV2)
  .addEdge(START, 'loadConfigNodeV2')
  .addEdge('loadConfigNodeV2', 'initializeComparisonContextNodeV2')
  .addEdge('initializeComparisonContextNodeV2', 'detectModeNodeV2')
  .addEdge('detectModeNodeV2', 'executeComparisonNodeV2')
  .addEdge('executeComparisonNodeV2', 'formatResponseNodeV2')
  .addEdge('formatResponseNodeV2', END)
  .compile();

/**
* Updates the status of a GeisingerComparison document to 'Complete' by its id.
* @param {string} teamName - The name of the team.
* @param {object} geisingerComparison - The GeisingerComparison document. 
* @returns {Promise<object>} The result of the update operation.
*/
export async function updateGesingerComparisonById(teamName, geisingerComparison) {
  if (!geisingerComparison.id) throw new Error('id is required');
  const db = await connectToDatabase(`team-${teamName}-db`);
  const result = await db.collection('user_collection').updateOne(
    { type: 'GeisingerComparison', id: geisingerComparison.id },
    { $set: geisingerComparison }
  );
  return result;
}

/**
* Creates a new GeisingerComparison document.
* @param {string} teamName - The name of the team.
* @param {string} lob - The line of business.
* @param {string} status - The status of the comparison.
* @returns {Promise<object>} The result of the insert operation.
*/
export async function createGeisingerComparison(teamName, geisingerComparison) {
  // Set initial statusInfo for workflow
  if (!geisingerComparison.statusInfo) {
    geisingerComparison.statusInfo = 'review'; // Initial stage
  }
  const db = await connectToDatabase(`team-${teamName}-db`);
  const result = await db.collection('user_collection').insertOne(geisingerComparison);
  return result;
}

/**
* Deletes GeisingerComparison documents by LOB, fileAId, and fileBId.
* @param {string} teamName - The name of the team.
* @param {string} lob - The line of business.
* @param {string} fileAId - The ID of the first file.
* @param {string} fileBId - The ID of the second file.
* @returns {Promise<object>} The result of the delete operation.
*/
export async function deleteGeisingerComparisonByLobFileAFileB(teamName, lob, comparisonType, fileAId, fileBId) {
  const db = await connectToDatabase(`team-${teamName}-db`);
  const result = await db.collection('user_collection').deleteMany({
    type: 'GeisingerComparison',
    comparisonType,
    lob,
    geisingerConversationAId: fileAId,
    geisingerConversationBId: fileBId,
  });

  return result;
}

// After config and context loaded, set to 'generating_embeddings'
const afterConfigContext = async (state) => {
  if (state.geisingerComparison) {
    state.geisingerComparison.statusInfo = 'generating_embeddings';
    await updateGesingerComparisonById(state.teamName, state.geisingerComparison);
  }
  return state;
};

// After topic/section matching, set to 'matching_topics'
const afterMatching = async (state) => {
  if (state.geisingerComparison) {
    state.geisingerComparison.statusInfo = 'matching_topics';
    await updateGesingerComparisonById(state.teamName, state.geisingerComparison);
  }
  return state;
};

// After adjudication, set to 'adjudicating_matches'
const afterAdjudication = async (state) => {
  if (state.geisingerComparison) {
    state.geisingerComparison.statusInfo = 'adjudicating_matches';
    await updateGesingerComparisonById(state.teamName, state.geisingerComparison);
  }
  return state;
};

// After difference analysis, set to 'analyzing_differences'
const afterAnalysis = async (state) => {
  if (state.geisingerComparison) {
    state.geisingerComparison.statusInfo = 'analyzing_differences';
    await updateGesingerComparisonById(state.teamName, state.geisingerComparison);
  }
  return state;
};

// After spreadsheet generation, set to 'generating_spreadsheet'
const afterSpreadsheet = async (state) => {
  if (state.geisingerComparison) {
    state.geisingerComparison.statusInfo = 'generating_spreadsheet';
    await updateGesingerComparisonById(state.teamName, state.geisingerComparison);
  }
  return state;
};

// After narrative formatting, set to 'formatting_narrative'
const afterFormatting = async (state) => {
  if (state.geisingerComparison) {
    state.geisingerComparison.statusInfo = 'formatting_narrative';
    await updateGesingerComparisonById(state.teamName, state.geisingerComparison);
  }
  return state;
};

// After completion, set to 'complete'
const afterComplete = async (state, result) => {
  if (state.geisingerComparison) {
    state.geisingerComparison.downloadLink = result?.comparisonResult?.downloadLink || '';
    state.geisingerComparison.status = 'Complete';
    state.geisingerComparison.statusInfo = 'complete';
    state.geisingerComparison.updatedAt = new Date();
    await updateGesingerComparisonById(result?.teamName, state.geisingerComparison);
  }
  return state;
};

async function executeComparisonGraphAsync(initialState) {
  const stopHeartbeat = startComparisonProgressHeartbeat(initialState);
  const geisingerComparison = initialState?.geisingerComparison;
  if (geisingerComparison) {
    // Set statusInfo to 'review' at creation
    geisingerComparison.statusInfo = 'review';
    deleteGeisingerComparisonByLobFileAFileB(
      initialState.teamName,
      geisingerComparison.lob,
      geisingerComparison.comparisonType,
      geisingerComparison.geisingerConversationAId,
      geisingerComparison.geisingerConversationBId
    ).catch((error) => {
      logComparisonEvent('complianceComparisonGraphV2PreComparisonCleanupFailed', {
        teamName: initialState.teamName,
        lob: geisingerComparison.lob,
        fileAId: geisingerComparison.geisingerConversationAId,
        fileBId: geisingerComparison.geisingerConversationBId,
        error: error?.message || String(error),
      });
    });

    createGeisingerComparison(initialState.teamName, geisingerComparison).catch((error) => {
      logComparisonEvent('complianceComparisonGraphV2GeisingerComparisonCreateFailed', {
        teamName: initialState.teamName,
        geisingerComparisonId: geisingerComparison.id,
        error: error?.message || String(error),
      });
    });
  }
  try {
    // Set statusInfo to 'loading_documents' at start of workflow
    if (geisingerComparison) {
      geisingerComparison.statusInfo = 'loading_documents';
      await updateGesingerComparisonById(initialState.teamName, geisingerComparison);
    }

    // Main workflow
    let state = initialState;
    // loading_documents already set
    state = await graph.invoke(state); // This runs the workflow
    await afterComplete(state, state); // complete

    if (isTopicComparisonState(state || initialState)) {
      await logTopicComparisonEvent('complianceComparisonTopicFinalResponseWriteStarted', {
        chatInteractionId: state?.chatInteractionId || initialState?.chatInteractionId || null,
        formattedResponseLength: String(state?.formattedResponse || '').length,
        mode: state?.comparisonMode || initialState?.comparisonMode || null,
      });
    }
    // Write the full final response to the ChatInteraction.response field
    if (state?.formattedResponse) {
      await updateProgressIfNeeded(state, state.formattedResponse);
    } else {
      await updateProgressIfNeeded(state, 'Comparison completed.');
    }
    if (isTopicComparisonState(state || initialState)) {
      const finalSnapshot = await readTopicComparisonProgressSnapshot(state || initialState);
      await logTopicComparisonEvent('complianceComparisonTopicFinalResponseWriteCompleted', {
        chatInteractionId: state?.chatInteractionId || initialState?.chatInteractionId || null,
        persisted: finalSnapshot,
      });
    }
  } catch (error) {

    if (geisingerComparison) {
      geisingerComparison.status = 'Error';
      geisingerComparison.statusInfo = 'Error';
      geisingerComparison.updatedAt = new Date();
      await updateGesingerComparisonById(result?.teamName, geisingerComparison);
    }

    if (isChatInteractionCancelledError(error)) {
      logComparisonEvent('complianceComparisonGraphV2Cancelled', {
        chatInteractionId: initialState?.chatInteractionId || null,
      });
      return;
    }

    const fallback = [
      '## Comparison Error',
      '',
      '❌ We could not complete the comparison due to a temporary processing issue.',
      '',
      'Please retry in about a minute. If this keeps happening, contact support with the timestamp of this request.',
    ].join('\n');
    await updateProgressIfNeeded(initialState, fallback);
    logComparisonEvent('complianceComparisonGraphV2AsyncError', { error: error.message });
  } finally {
    stopHeartbeat();
  }
}

export async function getComparisonConfigSnapshotV2() {
  const geisingerConfigEnabled = String(process.env.COMPLIANCE_COMPARISON_GEISINGER_CONFIG_ENABLED || 'true').toLowerCase() !== 'false';
  const geisingerConfigDocuments = geisingerConfigEnabled
    ? await fetchComparisonConfigDocumentsV2()
    : [];

  const { config, metadata } = await loadComparisonConfigV2({
    geisingerConfigDocuments,
  });

  return {
    config,
    metadata: {
      ...metadata,
      fileSources: Object.fromEntries(
        Object.entries(metadata?.fileSources || {}).map(([key, value]) => [key, String(value || '').split(/[/\\]/).pop() || ''])
      ),
    },
  };
}

export async function complianceComparisonGraphV2(nuid, teamName, assistantName, smartNoteId, chatInteractionId, geisingerComparison, sources, chatId, prompt, comparisonMode) {
  const completionsClient = getCompletionsClient();
  const embeddings = getEmbeddingsClient();
  const search = getSearchClient();

  const initialProgress = createProgressMarkdown('Starting document comparison...', '', 'Comparison');

  const initialState = {
    nuid,
    teamName,
    assistantName,
    smartNoteId,
    chatId,
    chatInteractionId,
    geisingerComparison,
    sources: sources || [],
    userPrompt: String(prompt || '').trim(),
    completionsClient,
    embeddingsClient: embeddings,
    searchClient: search,
    requestedComparisonMode: String(comparisonMode || '').trim().toLowerCase(),
  };

  await updateProgressIfNeeded(initialState, initialProgress);

  executeComparisonGraphAsync(initialState).catch((error) => {
    logComparisonEvent('complianceComparisonGraphV2FireAndForgetError', { error: error.message });
  });

  return {
    responseContent: initialProgress,
    suggestedPrompts: [],
  };
}

export { HARD_CODED_COMPARISON_CONFIG };
