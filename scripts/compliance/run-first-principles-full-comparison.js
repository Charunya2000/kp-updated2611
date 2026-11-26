import fs from 'node:fs/promises';
import path from 'node:path';
import { AzureKeyCredential, SearchClient } from '@azure/search-documents';
import { setProcessEnvironment } from '../configActions.js';
import { runFirstPrinciplesPdfReview } from './run-first-principles-pdf-review.js';
import { compareWithFirstPrinciplesEngine } from '../../app/services/langgraphs/compliance/docConversation1stPriComparisonEngine.js';

function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function normalizePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function normalizeNonNegativeInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

function normalizeThreshold(value, fallback = 0.92) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed <= 0 || parsed >= 1) return fallback;
  return parsed;
}

function toPercent(numerator, denominator) {
  const n = Number(numerator || 0);
  const d = Number(denominator || 0);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return 0;
  return Number(((n / d) * 100).toFixed(2));
}

function boolFromArgs(args = [], flag = '') {
  return args.includes(flag);
}

function parseArgs(argv = []) {
  const args = argv.slice(2);

  const getArg = (name, fallback = '') => {
    const idx = args.indexOf(name);
    return idx >= 0 ? String(args[idx + 1] || '').trim() : fallback;
  };

  const pdfA = getArg('--pdf-a', 'CHIP Procedures Handbook Dec 2018.pdf');
  const pdfB = getArg('--pdf-b', 'Exhibit 10 CHIP Procedures Handbook Mar 2025.pdf');
  const envName = getArg('--env', 'dev');
  const outputDir = getArg('--output-dir', 'scripts/compliance/output');
  const query = getArg('--query', '*');
  const top = normalizePositiveInt(getArg('--top', '1000'), 1000);
  const sampleSize = normalizeNonNegativeInt(getArg('--sample-size', '5'), 5);
  const nearDedupThreshold = normalizeThreshold(getArg('--near-dedup-threshold', '0.92'), 0.92);
  const materialTop = normalizePositiveInt(getArg('--material-top', '300'), 300);
  const gapRescueThreshold = normalizeThreshold(getArg('--gap-rescue-threshold', '0.9'), 0.9);

  const conversationIdA = getArg('--conversation-id-a', `review-${path.basename(pdfA).replace(/\.[^.]+$/, '')}-${Date.now()}`);
  const conversationIdB = getArg('--conversation-id-b', `review-${path.basename(pdfB).replace(/\.[^.]+$/, '')}-${Date.now()}`);

  const chunkIndexName = getArg('--chunk-index', 'compliance-chunks-v1');
  const requirementIndexName = getArg('--requirement-index', 'compliance-requirements-v1');

  const ensureIndexes = boolFromArgs(args, '--ensure-indexes');
  const disableNearDedup = boolFromArgs(args, '--disable-near-dedup');
  const disableGapRescue = boolFromArgs(args, '--disable-gap-rescue');
  const writeFullResults = boolFromArgs(args, '--write-full-results');

  return {
    pdfA,
    pdfB,
    envName,
    outputDir,
    query,
    top,
    sampleSize,
    materialTop,
    gapRescueThreshold,
    conversationIdA,
    conversationIdB,
    chunkIndexName,
    requirementIndexName,
    ensureIndexes,
    nearDedupThreshold,
    disableNearDedup,
    disableGapRescue,
    writeFullResults,
  };
}

function kpmsg(name, detail = {}) {
  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name,
      detail,
    },
  }));
}

function resolveSearchConfig(envName) {
  const endpointKey = `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint.new.t3`;
  const queryKey = `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.new.t3.api.key`;

  const endpoint = normalizeString(process.env[endpointKey]);
  const key = normalizeString(process.env[queryKey]);

  if (!endpoint || !key) {
    throw new Error(`Missing search config for env '${envName}'. Checked: ${endpointKey}, ${queryKey}`);
  }

  return { endpoint, key };
}

function createComparisonDeps({ endpoint, key }) {
  const clients = new Map();

  return {
    getSearchClient(indexName) {
      if (!clients.has(indexName)) {
        clients.set(indexName, new SearchClient(endpoint, indexName, new AzureKeyCredential(key)));
      }
      return clients.get(indexName);
    },
    logEvent(name, detail) {
      kpmsg(name, detail);
    },
  };
}

function normalizeForDedup(value = '') {
  return normalizeString(value)
    .toLowerCase()
    .replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\s+\d{4}\b/g, ' ')
    .replace(/\b\d{1,4}\s+\d{1,4}\b/g, ' ')
    .replace(/^\s*(?:section\s+)?\d+(?:\.\d+)*(?:\.|\))?\s+/g, ' ')
    .replace(/\b([a-z])\s+([a-z])\b/g, '$1$2')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function dedupeBy(items = [], buildKey) {
  const seen = new Set();
  const output = [];

  for (const item of Array.isArray(items) ? items : []) {
    const key = normalizeString(buildKey(item));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }

  return output;
}

function toTokenSet(value = '') {
  const normalized = normalizeForDedup(value);
  const tokens = normalized.split(' ').filter((token) => token.length > 2);
  return new Set(tokens);
}

function jaccardSimilarity(setA, setB) {
  if (!setA.size || !setB.size) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }

  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function dedupeNear(items = [], getText, threshold = 0.92) {
  const output = [];
  const retainedTokenSets = [];

  for (const item of Array.isArray(items) ? items : []) {
    const text = normalizeString(getText(item));
    if (!text) {
      output.push(item);
      retainedTokenSets.push(new Set());
      continue;
    }

    const currentTokens = toTokenSet(text);
    if (!currentTokens.size) {
      output.push(item);
      retainedTokenSets.push(new Set());
      continue;
    }

    let isDuplicate = false;
    for (const candidateTokens of retainedTokenSets) {
      if (!candidateTokens.size) continue;
      if (jaccardSimilarity(currentTokens, candidateTokens) >= threshold) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      output.push(item);
      retainedTokenSets.push(currentTokens);
    }
  }

  return output;
}

function getSectionAnchor(sectionNumber = '') {
  const value = normalizeString(sectionNumber);
  if (!value) return '';
  const parts = value.split('.').filter(Boolean);
  return parts.slice(0, Math.min(2, parts.length)).join('.');
}

function normalizedTokenArray(value = '') {
  return normalizeForDedup(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

function containmentScore(setA, setB) {
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const minSize = Math.min(setA.size, setB.size);
  return minSize > 0 ? intersection / minSize : 0;
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (text.includes('"') || text.includes(',') || text.includes('\n') || text.includes('\r')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows = [], headers = []) {
  const lines = [];
  lines.push(headers.map(csvEscape).join(','));
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row?.[header] ?? '')).join(','));
  }
  return `${lines.join('\n')}\n`;
}

function applyGapContainmentRescue(deduped = {}, options = {}) {
  const threshold = normalizeThreshold(options.threshold, 0.9);

  const buildAlignedIndex = (items = [], side = 'left') => {
    const entries = [];
    const tokenToEntryIndexes = new Map();

    for (const item of items) {
      const sideDoc = item?.[side] || {};
      const text = normalizeString(sideDoc?.text);
      if (!text) continue;

      const tokens = normalizedTokenArray(text);
      if (!tokens.length) continue;

      const tokenSet = new Set(tokens);
      const entry = {
        sectionAnchor: getSectionAnchor(sideDoc?.sectionNumber),
        category: normalizeString(sideDoc?.category),
        tokenSet,
      };
      const entryIndex = entries.push(entry) - 1;

      for (const token of tokenSet) {
        if (!tokenToEntryIndexes.has(token)) {
          tokenToEntryIndexes.set(token, []);
        }
        tokenToEntryIndexes.get(token).push(entryIndex);
      }
    }

    return { entries, tokenToEntryIndexes };
  };

  const alignedAll = [
    ...(deduped.matches || []),
    ...(deduped.partials || []),
    ...(deduped.conflicts || []),
  ];

  const leftAlignedIndex = buildAlignedIndex(alignedAll, 'left');
  const rightAlignedIndex = buildAlignedIndex(alignedAll, 'right');

  const rescueSide = (gaps = [], index = {}) => {
    const kept = [];
    const rescued = [];

    for (const gap of gaps) {
      const gapText = normalizeString(gap?.text);
      const gapTokens = normalizedTokenArray(gapText);
      const gapTokenSet = new Set(gapTokens);
      if (!gapTokenSet.size) {
        kept.push(gap);
        continue;
      }

      const candidateIndexes = new Set();
      for (const token of gapTokens.slice(0, 10)) {
        const indexes = index.tokenToEntryIndexes?.get(token) || [];
        for (const idx of indexes) candidateIndexes.add(idx);
      }

      const gapAnchor = getSectionAnchor(gap?.sectionNumber);
      const gapCategory = normalizeString(gap?.category);
      let rescuedByContainment = false;

      for (const idx of candidateIndexes) {
        const candidate = index.entries?.[idx];
        if (!candidate) continue;

        const sectionCompatible = gapAnchor && candidate.sectionAnchor
          ? gapAnchor === candidate.sectionAnchor
          : true;
        const categoryCompatible = gapCategory && candidate.category
          ? gapCategory === candidate.category
          : true;

        if (!sectionCompatible && !categoryCompatible) continue;

        const score = containmentScore(gapTokenSet, candidate.tokenSet);
        if (score >= threshold) {
          rescuedByContainment = true;
          rescued.push({ ...gap, rescueContainmentScore: Number(score.toFixed(4)) });
          break;
        }
      }

      if (!rescuedByContainment) {
        kept.push(gap);
      }
    }

    return { kept, rescued };
  };

  const leftRescue = rescueSide(deduped?.gaps?.left || [], leftAlignedIndex);
  const rightRescue = rescueSide(deduped?.gaps?.right || [], rightAlignedIndex);

  return {
    summary: {
      ...deduped.summary,
      gapLeftCount: leftRescue.kept.length,
      gapRightCount: rightRescue.kept.length,
    },
    matches: deduped.matches || [],
    partials: deduped.partials || [],
    conflicts: deduped.conflicts || [],
    gaps: {
      left: leftRescue.kept,
      right: rightRescue.kept,
    },
    rescueStats: {
      enabled: true,
      threshold,
      rescuedLeftCount: leftRescue.rescued.length,
      rescuedRightCount: rightRescue.rescued.length,
      rescuedLeftSamples: leftRescue.rescued.slice(0, 10),
      rescuedRightSamples: rightRescue.rescued.slice(0, 10),
    },
  };
}

function classifyChangeType({ classification = '', left = {}, right = {} } = {}) {
  if (classification === 'conflict') return 'potentially_material_conflict';
  if (!left?.text || !right?.text) return 'process_or_scope_change';

  const leftModality = normalizeString(left.modality);
  const rightModality = normalizeString(right.modality);
  if (leftModality && rightModality && leftModality !== rightModality) {
    return 'process_or_scope_change';
  }

  if (classification === 'partial') return 'clarification_change';
  return 'no_substantive_change';
}

function computeMaterialityScore({ classification = '', left = {}, right = {} } = {}) {
  let score = 0;
  const reasons = [];

  if (classification === 'conflict') {
    score += 90;
    reasons.push('classification_conflict');
  } else if (classification === 'partial') {
    score += 60;
    reasons.push('classification_partial');
  } else if (classification === 'gap') {
    score += 70;
    reasons.push('classification_gap');
  } else {
    score += 20;
  }

  const leftModality = normalizeString(left?.modality);
  const rightModality = normalizeString(right?.modality);
  if (leftModality && rightModality && leftModality !== rightModality) {
    score += 14;
    reasons.push('modality_shift');
  }

  const leftCategory = normalizeString(left?.category);
  const rightCategory = normalizeString(right?.category);
  if (leftCategory && rightCategory && leftCategory !== rightCategory) {
    score += 8;
    reasons.push('category_shift');
  }

  const timelineRegex = /\b\d+\b|\bday\b|\bdays\b|\bcalendar\b|\bhour\b|\bmonth\b|\byear\b/i;
  const leftText = normalizeString(left?.text);
  const rightText = normalizeString(right?.text);
  const leftTimeline = timelineRegex.test(leftText);
  const rightTimeline = timelineRegex.test(rightText);
  if (leftTimeline !== rightTimeline) {
    score += 10;
    reasons.push('timeline_presence_shift');
  }

  if (classification === 'gap') {
    if (leftModality || rightModality) {
      score += 8;
      reasons.push('obligation_language_present');
    }
  }

  return {
    score: Math.min(100, score),
    reasons,
  };
}

function buildMaterialDeltas(comparison = {}, options = {}) {
  const top = normalizePositiveInt(options.top, 300);
  const rows = [];

  for (const item of comparison.conflicts || []) {
    const materiality = computeMaterialityScore({ classification: 'conflict', left: item.left, right: item.right });
    rows.push({
      type: 'aligned',
      classification: 'conflict',
      changeType: classifyChangeType({ classification: 'conflict', left: item.left, right: item.right }),
      materialityScore: materiality.score,
      reasonCodes: materiality.reasons.join('|'),
      leftSection: normalizeString(item?.left?.sectionNumber),
      rightSection: normalizeString(item?.right?.sectionNumber),
      leftCitation: normalizeString(item?.left?.citation),
      rightCitation: normalizeString(item?.right?.citation),
      leftText: normalizeString(item?.left?.text),
      rightText: normalizeString(item?.right?.text),
    });
  }

  for (const item of comparison.partials || []) {
    const materiality = computeMaterialityScore({ classification: 'partial', left: item.left, right: item.right });
    rows.push({
      type: 'aligned',
      classification: 'partial',
      changeType: classifyChangeType({ classification: 'partial', left: item.left, right: item.right }),
      materialityScore: materiality.score,
      reasonCodes: materiality.reasons.join('|'),
      leftSection: normalizeString(item?.left?.sectionNumber),
      rightSection: normalizeString(item?.right?.sectionNumber),
      leftCitation: normalizeString(item?.left?.citation),
      rightCitation: normalizeString(item?.right?.citation),
      leftText: normalizeString(item?.left?.text),
      rightText: normalizeString(item?.right?.text),
    });
  }

  for (const item of comparison?.gaps?.left || []) {
    const materiality = computeMaterialityScore({ classification: 'gap', left: item, right: {} });
    rows.push({
      type: 'gap',
      classification: 'gap-left',
      changeType: 'process_or_scope_change',
      materialityScore: materiality.score,
      reasonCodes: materiality.reasons.join('|'),
      leftSection: normalizeString(item?.sectionNumber),
      rightSection: '',
      leftCitation: normalizeString(item?.citation),
      rightCitation: '',
      leftText: normalizeString(item?.text),
      rightText: '',
    });
  }

  for (const item of comparison?.gaps?.right || []) {
    const materiality = computeMaterialityScore({ classification: 'gap', left: {}, right: item });
    rows.push({
      type: 'gap',
      classification: 'gap-right',
      changeType: 'process_or_scope_change',
      materialityScore: materiality.score,
      reasonCodes: materiality.reasons.join('|'),
      leftSection: '',
      rightSection: normalizeString(item?.sectionNumber),
      leftCitation: '',
      rightCitation: normalizeString(item?.citation),
      leftText: '',
      rightText: normalizeString(item?.text),
    });
  }

  rows.sort((a, b) => {
    if (b.materialityScore !== a.materialityScore) {
      return b.materialityScore - a.materialityScore;
    }
    return (a.classification || '').localeCompare(b.classification || '');
  });

  const ranked = rows.slice(0, top).map((row, idx) => ({ rank: idx + 1, ...row }));

  return {
    summary: {
      generatedCount: rows.length,
      shortlistedCount: ranked.length,
      top,
    },
    rows: ranked,
  };
}

function buildDedupedComparison(comparison = {}, options = {}) {
  const enableNearDedup = options.enableNearDedup !== false;
  const nearDedupThreshold = normalizeThreshold(options.nearDedupThreshold, 0.92);

  const exactMatches = dedupeBy(comparison.matches, (item) => [
    normalizeForDedup(item?.left?.text),
    normalizeString(item?.left?.sectionNumber),
    normalizeForDedup(item?.right?.text),
    normalizeString(item?.right?.sectionNumber),
  ].join('|'));

  const exactPartials = dedupeBy(comparison.partials, (item) => [
    normalizeForDedup(item?.left?.text),
    normalizeString(item?.left?.sectionNumber),
    normalizeForDedup(item?.right?.text),
    normalizeString(item?.right?.sectionNumber),
  ].join('|'));

  const exactConflicts = dedupeBy(comparison.conflicts, (item) => [
    normalizeForDedup(item?.left?.text),
    normalizeString(item?.left?.sectionNumber),
    normalizeForDedup(item?.right?.text),
    normalizeString(item?.right?.sectionNumber),
  ].join('|'));

  const exactGapsLeft = dedupeBy(comparison?.gaps?.left, (item) => [
    normalizeForDedup(item?.text),
    normalizeString(item?.sectionNumber),
    normalizeString(item?.side),
  ].join('|'));

  const exactGapsRight = dedupeBy(comparison?.gaps?.right, (item) => [
    normalizeForDedup(item?.text),
    normalizeString(item?.sectionNumber),
    normalizeString(item?.side),
  ].join('|'));

  const matches = enableNearDedup
    ? dedupeNear(exactMatches, (item) => `${normalizeString(item?.left?.text)} || ${normalizeString(item?.right?.text)}`, nearDedupThreshold)
    : exactMatches;
  const partials = enableNearDedup
    ? dedupeNear(exactPartials, (item) => `${normalizeString(item?.left?.text)} || ${normalizeString(item?.right?.text)}`, nearDedupThreshold)
    : exactPartials;
  const conflicts = enableNearDedup
    ? dedupeNear(exactConflicts, (item) => `${normalizeString(item?.left?.text)} || ${normalizeString(item?.right?.text)}`, nearDedupThreshold)
    : exactConflicts;
  const gapsLeft = enableNearDedup
    ? dedupeNear(exactGapsLeft, (item) => normalizeString(item?.text), nearDedupThreshold)
    : exactGapsLeft;
  const gapsRight = enableNearDedup
    ? dedupeNear(exactGapsRight, (item) => normalizeString(item?.text), nearDedupThreshold)
    : exactGapsRight;

  const exactStats = {
    matchesRemoved: Math.max(0, Number(comparison?.matches?.length || 0) - exactMatches.length),
    partialsRemoved: Math.max(0, Number(comparison?.partials?.length || 0) - exactPartials.length),
    conflictsRemoved: Math.max(0, Number(comparison?.conflicts?.length || 0) - exactConflicts.length),
    gapsLeftRemoved: Math.max(0, Number(comparison?.gaps?.left?.length || 0) - exactGapsLeft.length),
    gapsRightRemoved: Math.max(0, Number(comparison?.gaps?.right?.length || 0) - exactGapsRight.length),
  };

  const nearStats = {
    matchesRemoved: Math.max(0, exactMatches.length - matches.length),
    partialsRemoved: Math.max(0, exactPartials.length - partials.length),
    conflictsRemoved: Math.max(0, exactConflicts.length - conflicts.length),
    gapsLeftRemoved: Math.max(0, exactGapsLeft.length - gapsLeft.length),
    gapsRightRemoved: Math.max(0, exactGapsRight.length - gapsRight.length),
  };

  return {
    summary: {
      leftRequirementCount: Number(comparison?.summary?.leftRequirementCount || 0),
      rightRequirementCount: Number(comparison?.summary?.rightRequirementCount || 0),
      alignedCount: matches.length + partials.length + conflicts.length,
      matchCount: matches.length,
      partialCount: partials.length,
      conflictCount: conflicts.length,
      gapLeftCount: gapsLeft.length,
      gapRightCount: gapsRight.length,
      durationMs: Number(comparison?.summary?.durationMs || 0),
    },
    matches,
    partials,
    conflicts,
    gaps: {
      left: gapsLeft,
      right: gapsRight,
    },
    dedupStats: {
      matchesRemoved: Math.max(0, Number(comparison?.matches?.length || 0) - matches.length),
      partialsRemoved: Math.max(0, Number(comparison?.partials?.length || 0) - partials.length),
      conflictsRemoved: Math.max(0, Number(comparison?.conflicts?.length || 0) - conflicts.length),
      gapsLeftRemoved: Math.max(0, Number(comparison?.gaps?.left?.length || 0) - gapsLeft.length),
      gapsRightRemoved: Math.max(0, Number(comparison?.gaps?.right?.length || 0) - gapsRight.length),
      exact: exactStats,
      near: nearStats,
      nearDedupEnabled: enableNearDedup,
      nearDedupThreshold,
    },
  };
}

async function ingestPdf({
  pdfPath,
  conversationId,
  outputDir,
  envName,
  chunkIndexName,
  requirementIndexName,
  ensureIndexes,
}) {
  const argv = [
    'node',
    'scripts/compliance/run-first-principles-pdf-review.js',
    '--pdf',
    pdfPath,
    '--conversation-id',
    conversationId,
    '--output-dir',
    outputDir,
    '--upload-search',
    '--env',
    envName,
    '--chunk-index',
    chunkIndexName,
    '--requirement-index',
    requirementIndexName,
  ];

  if (ensureIndexes) {
    argv.push('--ensure-indexes');
  }

  await runFirstPrinciplesPdfReview(argv);
}

async function main() {
  console.log('Starting first-principles full comparison...');
  const startedAt = Date.now();
  const args = parseArgs(process.argv);

  kpmsg('firstPriFullComparisonStarted', {
    pdfA: args.pdfA,
    pdfB: args.pdfB,
    envName: args.envName,
    conversationIdA: args.conversationIdA,
    conversationIdB: args.conversationIdB,
    query: args.query,
    top: args.top,
    sampleSize: args.sampleSize,
    materialTop: args.materialTop,
    nearDedupThreshold: args.nearDedupThreshold,
    gapRescueThreshold: args.gapRescueThreshold,
    nearDedupEnabled: !args.disableNearDedup,
    gapRescueEnabled: !args.disableGapRescue,
    writeFullResults: args.writeFullResults,
  });

  await setProcessEnvironment();

  await ingestPdf({
    pdfPath: args.pdfA,
    conversationId: args.conversationIdA,
    outputDir: args.outputDir,
    envName: args.envName,
    chunkIndexName: args.chunkIndexName,
    requirementIndexName: args.requirementIndexName,
    ensureIndexes: args.ensureIndexes,
  });

  await ingestPdf({
    pdfPath: args.pdfB,
    conversationId: args.conversationIdB,
    outputDir: args.outputDir,
    envName: args.envName,
    chunkIndexName: args.chunkIndexName,
    requirementIndexName: args.requirementIndexName,
    ensureIndexes: false,
  });

  const searchConfig = resolveSearchConfig(args.envName);
  const deps = createComparisonDeps(searchConfig);

  const comparison = await compareWithFirstPrinciplesEngine({
    leftConversationId: args.conversationIdA,
    rightConversationId: args.conversationIdB,
    queryText: args.query,
    options: {
      top: args.top,
      minPartialScore: 0.45,
      minMatchScore: 0.72,
      minConflictScore: 0.45,
      requirementIndexName: args.requirementIndexName,
    },
  }, deps);

  const deduped = buildDedupedComparison(comparison, {
    nearDedupThreshold: args.nearDedupThreshold,
    enableNearDedup: !args.disableNearDedup,
  });

  const postProcessed = args.disableGapRescue
    ? {
      ...deduped,
      rescueStats: {
        enabled: false,
        threshold: args.gapRescueThreshold,
        rescuedLeftCount: 0,
        rescuedRightCount: 0,
        rescuedLeftSamples: [],
        rescuedRightSamples: [],
      },
    }
    : applyGapContainmentRescue(deduped, { threshold: args.gapRescueThreshold });

  const materialDeltas = buildMaterialDeltas(postProcessed, { top: args.materialTop });

  const dedupComparisonSummary = [
    `Deduped comparison: ${postProcessed.summary.leftRequirementCount} vs ${postProcessed.summary.rightRequirementCount} requirements (near dedup ${!args.disableNearDedup ? 'on' : 'off'}${!args.disableNearDedup ? ` @ ${args.nearDedupThreshold}` : ''}).`,
    `Matches: ${postProcessed.summary.matchCount}, partials: ${postProcessed.summary.partialCount}, conflicts: ${postProcessed.summary.conflictCount}.`,
    `Gaps: left-only=${postProcessed.summary.gapLeftCount}, right-only=${postProcessed.summary.gapRightCount}${args.disableGapRescue ? '' : ` (containment rescue @ ${args.gapRescueThreshold})`}.`,
  ].join('\n');

  const complianceMetrics = {
    leftAlignmentRatePct: toPercent(postProcessed.summary.alignedCount, postProcessed.summary.leftRequirementCount),
    rightAlignmentRatePct: toPercent(postProcessed.summary.alignedCount, postProcessed.summary.rightRequirementCount),
    leftGapRatePct: toPercent(postProcessed.summary.gapLeftCount, postProcessed.summary.leftRequirementCount),
    rightGapRatePct: toPercent(postProcessed.summary.gapRightCount, postProcessed.summary.rightRequirementCount),
    conflictRateWithinAlignedPct: toPercent(postProcessed.summary.conflictCount, postProcessed.summary.alignedCount),
    matchRateWithinAlignedPct: toPercent(postProcessed.summary.matchCount, postProcessed.summary.alignedCount),
    partialRateWithinAlignedPct: toPercent(postProcessed.summary.partialCount, postProcessed.summary.alignedCount),
  };

  const output = {
    conversationIds: {
      left: args.conversationIdA,
      right: args.conversationIdB,
    },
    pdfs: {
      left: args.pdfA,
      right: args.pdfB,
    },
    query: args.query,
    top: args.top,
    sampleSize: args.sampleSize,
    nearDedupThreshold: args.nearDedupThreshold,
    nearDedupEnabled: !args.disableNearDedup,
    gapRescueThreshold: args.gapRescueThreshold,
    gapRescueEnabled: !args.disableGapRescue,
    materialTop: args.materialTop,
    summary: comparison.summary,
    dedupedSummary: postProcessed.summary,
    comparisonSummary: comparison.comparisonSummary,
    dedupComparisonSummary,
    summaryMode: comparison.summaryMode,
    dedupStats: deduped.dedupStats,
    gapRescueStats: postProcessed.rescueStats,
    complianceMetrics,
    materialDeltasSummary: materialDeltas.summary,
    topMatches: postProcessed.matches.slice(0, args.sampleSize),
    topPartials: postProcessed.partials.slice(0, args.sampleSize),
    topConflicts: postProcessed.conflicts.slice(0, args.sampleSize),
    topGapsLeft: postProcessed.gaps.left.slice(0, args.sampleSize),
    topGapsRight: postProcessed.gaps.right.slice(0, args.sampleSize),
    topMaterialDeltas: materialDeltas.rows.slice(0, args.sampleSize),
    durationMs: Date.now() - startedAt,
  };

  const outputDirAbsolute = path.isAbsolute(args.outputDir)
    ? args.outputDir
    : path.resolve(process.cwd(), args.outputDir);
  await fs.mkdir(outputDirAbsolute, { recursive: true });

  const safeLeftId = normalizeString(args.conversationIdA).replace(/[^A-Za-z0-9._-]/g, '_');
  const safeRightId = normalizeString(args.conversationIdB).replace(/[^A-Za-z0-9._-]/g, '_');
  const comparisonSummaryPath = path.join(
    outputDirAbsolute,
    `full-comparison-${safeLeftId}-vs-${safeRightId}.summary.json`
  );

  await fs.writeFile(comparisonSummaryPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  const materialDeltasJsonPath = path.join(
    outputDirAbsolute,
    `full-comparison-${safeLeftId}-vs-${safeRightId}.material-deltas.json`
  );
  await fs.writeFile(materialDeltasJsonPath, `${JSON.stringify({
    conversationIds: output.conversationIds,
    pdfs: output.pdfs,
    query: output.query,
    top: output.top,
    materialDeltasSummary: materialDeltas.summary,
    complianceMetrics,
    rows: materialDeltas.rows,
  }, null, 2)}\n`, 'utf8');

  const materialDeltasCsvPath = path.join(
    outputDirAbsolute,
    `full-comparison-${safeLeftId}-vs-${safeRightId}.material-deltas.csv`
  );

  await fs.writeFile(
    materialDeltasCsvPath,
    toCsv(materialDeltas.rows, [
      'rank',
      'type',
      'classification',
      'changeType',
      'materialityScore',
      'reasonCodes',
      'leftSection',
      'rightSection',
      'leftCitation',
      'rightCitation',
      'leftText',
      'rightText',
    ]),
    'utf8'
  );

  let fullResultsPath = '';
  if (args.writeFullResults) {
    fullResultsPath = path.join(
      outputDirAbsolute,
      `full-comparison-${safeLeftId}-vs-${safeRightId}.full-results.json`
    );

    const fullResultsOutput = {
      conversationIds: output.conversationIds,
      pdfs: output.pdfs,
      query: output.query,
      top: output.top,
      nearDedupThreshold: output.nearDedupThreshold,
      nearDedupEnabled: output.nearDedupEnabled,
      gapRescueThreshold: output.gapRescueThreshold,
      gapRescueEnabled: output.gapRescueEnabled,
      summary: output.summary,
      dedupedSummary: output.dedupedSummary,
      dedupStats: output.dedupStats,
      gapRescueStats: output.gapRescueStats,
      complianceMetrics: output.complianceMetrics,
      materialDeltasSummary: output.materialDeltasSummary,
      matches: postProcessed.matches,
      partials: postProcessed.partials,
      conflicts: postProcessed.conflicts,
      gapsLeft: postProcessed.gaps.left,
      gapsRight: postProcessed.gaps.right,
      materialDeltas: materialDeltas.rows,
      durationMs: output.durationMs,
    };

    await fs.writeFile(fullResultsPath, `${JSON.stringify(fullResultsOutput, null, 2)}\n`, 'utf8');
    output.fullResultsPath = fullResultsPath;
  }

  kpmsg('firstPriFullComparisonCompleted', {
    leftConversationId: args.conversationIdA,
    rightConversationId: args.conversationIdB,
    durationMs: output.durationMs,
    comparisonSummaryPath,
    fullResultsPath,
    materialDeltasJsonPath,
    materialDeltasCsvPath,
    ...comparison.summary,
  });

  console.log('\nFirst-principles full comparison summary');
  console.log(JSON.stringify(output, null, 2));
  console.log(`\nSaved summary to: ${comparisonSummaryPath}`);
  console.log(`Saved material deltas JSON to: ${materialDeltasJsonPath}`);
  console.log(`Saved material deltas CSV to: ${materialDeltasCsvPath}`);
  if (fullResultsPath) {
    console.log(`Saved full results to: ${fullResultsPath}`);
  }
}

main().catch((error) => {
  console.error('First-principles full comparison failed:', error?.message || String(error));
  process.exitCode = 1;
});
