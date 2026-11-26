import {
  resolveFirstPrinciplesRuntimeConfigV1,
  resolveEnvValueByRef,
} from '@/app/services/langgraphs/compliance/helpers/loadFirstPrinciplesRuntimeConfigV1';

const DEFAULT_CONVERSATION_ENGINE = 'service3';
const DEFAULT_COMPARISON_ENGINE = 'service3';
const SUPPORTED_RUNTIME_ENGINES = new Set(['service3', 'first-principles']);
const FORCE_CONVERSATION_ENGINE_ENV = 'COMPLIANCE_FORCE_CONVERSATION_ENGINE';
const FORCE_COMPARISON_ENGINE_ENV = 'COMPLIANCE_FORCE_COMPARISON_ENGINE';
const LEGACY_KEY_REFS = {
  endpoint: 'searchEndpoint',
  query: 'aisearch.api.key',
  upload: 'aiupload.api.key',
};

function logRoutingEvent(name, detail = {}) {
  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name,
      detail,
    }
  }));
}

function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function isTruthyEnv(name, fallback = false) {
  const raw = normalizeString(process.env[name]);
  if (!raw) return fallback;
  const normalized = raw.toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
}

function shouldIncludeEngineMetadata({ summaryMode = '', retrievalFallbackUsed = false, includeDebugMetadata = false } = {}) {
  if (includeDebugMetadata) return true;
  if (isTruthyEnv('GEISINGER_FIRST_PRI_SHOW_ENGINE_METADATA', false)) return true;
  if (normalizeString(summaryMode).toLowerCase() === 'fallback') return true;
  if (retrievalFallbackUsed) return true;
  return false;
}

function normalizeLob(value) {
  const lob = normalizeString(value);
  if (!lob) return '';
  return lob.toLowerCase() === 'aca' ? 'marketplace' : lob.toLowerCase();
}

function isUseVaultEnabled() {
  return normalizeString(process.env.USE_VAULT).toLowerCase() === 'true';
}

function resolveKeyRefFamily(keyRef) {
  const normalizedRef = normalizeString(keyRef);
  return normalizedRef.includes('.new.t3') ? 'first-principles' : 'legacy';
}

function resolveResolvedFamily(refs = []) {
  const families = Array.from(new Set(refs.map((ref) => resolveKeyRefFamily(ref))));
  if (families.length === 1) {
    return families[0];
  }
  return 'mixed';
}

function shouldAllowFirstPrinciplesForScope(rolloutScope, { teamName, inferredLob }) {
  if (!rolloutScope || typeof rolloutScope !== 'object') return true;

  const teamAllowlist = Array.isArray(rolloutScope.teamAllowlist)
    ? rolloutScope.teamAllowlist.map((item) => normalizeString(item).toLowerCase()).filter(Boolean)
    : [];

  const lobAllowlist = Array.isArray(rolloutScope.lobAllowlist)
    ? rolloutScope.lobAllowlist.map((item) => normalizeLob(item)).filter(Boolean)
    : [];

  const normalizedTeam = normalizeString(teamName).toLowerCase();
  const normalizedLob = normalizeLob(inferredLob);

  if (teamAllowlist.length > 0 && !teamAllowlist.includes(normalizedTeam)) {
    return false;
  }

  if (lobAllowlist.length > 0 && !lobAllowlist.includes(normalizedLob)) {
    return false;
  }

  return true;
}

function normalizeRequestedEngine(rawValue, fallback, fieldName) {
  const normalized = normalizeString(rawValue, fallback);
  if (!SUPPORTED_RUNTIME_ENGINES.has(normalized)) {
    const error = new Error(`${fieldName} must be one of: 'service3', 'first-principles'`);
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

function readForcedEngineFromEnv(envName) {
  const raw = normalizeString(process.env[envName]);
  if (!raw) return '';

  const normalized = raw.toLowerCase();
  if (!SUPPORTED_RUNTIME_ENGINES.has(normalized)) {
    logRoutingEvent('complianceRuntimeInvalidForcedEngine', {
      envName,
      rawValue: raw,
      allowedValues: Array.from(SUPPORTED_RUNTIME_ENGINES),
    });
    return '';
  }

  return normalized;
}

function assertRefBelongsToExpectedFamily(keyRef, expectedFamily, fieldName) {
  const normalizedRef = normalizeString(keyRef);
  const isNewT3 = normalizedRef.includes('.new.t3');

  if (expectedFamily === 'first-principles' && !isNewT3) {
    const error = new Error(`${fieldName} must reference the first-principles key family (.new.t3).`);
    error.statusCode = 500;
    throw error;
  }

  if (expectedFamily === 'legacy' && isNewT3) {
    const error = new Error(`${fieldName} must reference the legacy key family (non-.new.t3).`);
    error.statusCode = 500;
    throw error;
  }
}

function enforceLegacyRuntimeKeys() {
  const searchEndpoint = resolveEnvValueByRef(LEGACY_KEY_REFS.endpoint);
  const searchApiKey = resolveEnvValueByRef(LEGACY_KEY_REFS.query);
  const searchUploadKey = resolveEnvValueByRef(LEGACY_KEY_REFS.upload);

  if (!searchEndpoint || !searchApiKey || !searchUploadKey) {
    const error = new Error('Legacy runtime keys are missing. Required refs: searchEndpoint, aisearch.api.key, aiupload.api.key.');
    error.statusCode = 500;
    throw error;
  }

  return {
    endpointKeyRef: LEGACY_KEY_REFS.endpoint,
    queryKeyRef: LEGACY_KEY_REFS.query,
    uploadKeyRef: LEGACY_KEY_REFS.upload,
    searchEndpoint,
    searchApiKey,
    searchUploadKey,
  };
}

function enforceFirstPrinciplesRuntimeKeys(firstPrinciplesConfig = {}) {
  const endpointKeyRef = normalizeString(firstPrinciplesConfig?.searchEndpointKeyRef);
  const queryKeyRef = normalizeString(firstPrinciplesConfig?.searchQueryKeyRef);
  const uploadKeyRef = normalizeString(firstPrinciplesConfig?.searchUploadKeyRef);

  if (!endpointKeyRef || !queryKeyRef || !uploadKeyRef) {
    const error = new Error('First-principles runtime key references are missing from runtime defaults.');
    error.statusCode = 500;
    throw error;
  }

  const useVaultEnabled = isUseVaultEnabled();
  const expectedFamily = useVaultEnabled ? 'legacy' : 'first-principles';

  assertRefBelongsToExpectedFamily(endpointKeyRef, expectedFamily, 'firstPrinciplesSearchEndpointKey');
  assertRefBelongsToExpectedFamily(queryKeyRef, expectedFamily, 'firstPrinciplesSearchQueryKey');
  assertRefBelongsToExpectedFamily(uploadKeyRef, expectedFamily, 'firstPrinciplesSearchUploadKey');

  const searchEndpoint = resolveEnvValueByRef(endpointKeyRef);
  const searchApiKey = resolveEnvValueByRef(queryKeyRef);
  const searchUploadKey = resolveEnvValueByRef(uploadKeyRef);

  if (!searchEndpoint || !searchApiKey || !searchUploadKey) {
    const error = new Error('First-principles runtime keys are configured but environment values are missing.');
    error.statusCode = 500;
    throw error;
  }

  return {
    endpointKeyRef,
    queryKeyRef,
    uploadKeyRef,
    searchEndpoint,
    searchApiKey,
    searchUploadKey,
    chunkIndexName: normalizeString(firstPrinciplesConfig?.chunkIndexName, 'compliance-chunks-v1'),
    requirementIndexName: normalizeString(firstPrinciplesConfig?.requirementIndexName, 'compliance-requirements-v1'),
    keyResolution: {
      useVaultEnabled,
      expectedFamily,
      resolvedFamily: resolveResolvedFamily([endpointKeyRef, queryKeyRef, uploadKeyRef]),
      mapsToService3KeyFamily: expectedFamily === 'legacy',
      endpointKeyRef,
      queryKeyRef,
      uploadKeyRef,
    },
  };
}

export async function resolveComplianceRuntimeEngines({ teamName = '', inferredLob = '' } = {}) {
  const runtimeSnapshot = await resolveFirstPrinciplesRuntimeConfigV1({ inferredLob });
  const configDoc = runtimeSnapshot.configDoc;
  const runtimeConfig = runtimeSnapshot.config;
  const configSources = runtimeSnapshot.sources;

  const selectedConversationEngine = normalizeRequestedEngine(
    runtimeConfig?.engines?.conversationEngine,
    DEFAULT_CONVERSATION_ENGINE,
    'conversationEngine'
  );

  const selectedComparisonEngine = normalizeRequestedEngine(
    runtimeConfig?.engines?.comparisonEngine,
    DEFAULT_COMPARISON_ENGINE,
    'comparisonEngine'
  );

  const forcedConversationEngine = readForcedEngineFromEnv(FORCE_CONVERSATION_ENGINE_ENV);
  const forcedComparisonEngine = readForcedEngineFromEnv(FORCE_COMPARISON_ENGINE_ENV);

  const scopeAllowed = shouldAllowFirstPrinciplesForScope(runtimeConfig?.rolloutScope, { teamName, inferredLob });

  const effectiveConversationEngine =
    forcedConversationEngine
      ? forcedConversationEngine
      : (selectedConversationEngine === 'first-principles' && !scopeAllowed
        ? DEFAULT_CONVERSATION_ENGINE
        : selectedConversationEngine);

  const effectiveComparisonEngine =
    forcedComparisonEngine
      ? forcedComparisonEngine
      : (selectedComparisonEngine === 'first-principles' && !scopeAllowed
        ? DEFAULT_COMPARISON_ENGINE
        : selectedComparisonEngine);

  const usesLegacyRuntime =
    effectiveConversationEngine === 'service3' || effectiveComparisonEngine === 'service3';
  const usesFirstPrinciplesRuntime =
    effectiveConversationEngine === 'first-principles' || effectiveComparisonEngine === 'first-principles';

  const legacyRuntime = usesLegacyRuntime
    ? enforceLegacyRuntimeKeys()
    : null;

  const firstPrinciplesRuntime =
    usesFirstPrinciplesRuntime
      ? enforceFirstPrinciplesRuntimeKeys(runtimeConfig?.firstPrinciples || {})
      : null;

  logRoutingEvent('complianceRuntimeEnginesResolved', {
    configDocId: normalizeString(configDoc?.id) || null,
    inferredLob: normalizeString(inferredLob) || null,
    teamName: normalizeString(teamName) || null,
    selectedConversationEngine,
    selectedComparisonEngine,
    forcedConversationEngine: forcedConversationEngine || null,
    forcedComparisonEngine: forcedComparisonEngine || null,
    effectiveConversationEngine,
    effectiveComparisonEngine,
    legacyKeyFamilyActive: usesLegacyRuntime,
    firstPrinciplesKeyFamilyActive: usesFirstPrinciplesRuntime,
    firstPrinciplesKeyResolution: firstPrinciplesRuntime?.keyResolution || null,
    fallbackTriggered: !scopeAllowed && (selectedConversationEngine === 'first-principles' || selectedComparisonEngine === 'first-principles'),
    configSources,
  });

  return {
    configDoc,
    configSources,
    runtimeConfig,
    selectedConversationEngine,
    selectedComparisonEngine,
    forcedConversationEngine,
    forcedComparisonEngine,
    effectiveConversationEngine,
    effectiveComparisonEngine,
    legacyRuntime,
    firstPrinciplesRuntime,
    firstPrinciplesKeyResolution: firstPrinciplesRuntime?.keyResolution || null,
  };
}

export function buildConversationFirstPrinciplesResponse(engineOutput = {}, selectedEngine = 'first-principles', options = {}) {
  const payload = engineOutput?.responsePayload || {};
  const geisingerConversation = options?.geisingerConversation || {};
  const userPrompt = normalizeString(options?.userPrompt);
  const relativeAUrl = normalizeString(geisingerConversation?.relativeAUrl);
  const fileAName = normalizeString(
    geisingerConversation?.fileAName
    || geisingerConversation?.smart_file_name
    || payload?.citations?.[0]?.file_name
    || 'Selected Document'
  );

  const domain = normalizeString(process.env.USE_VAULT).toLowerCase() === 'true'
    ? 'geisinger.sharepoint.com'
    : 'sp-cloud.kp.org';
  const documentUrl = relativeAUrl ? encodeURI(`https://${domain}${relativeAUrl}`) : '';

  function buildCitationLink(page) {
    const pageNumber = Number(page);
    if (!documentUrl || !Number.isFinite(pageNumber) || pageNumber <= 0) return '';
    return `${documentUrl}?target=_blank#page=${pageNumber}`;
  }

  function linkifyCitationToken(text, fallbackPage = null) {
    const source = normalizeString(text);
    if (!source) return source;

    const tokenRegex = /\[([^\]\n:]+?):\s*(\d+)([^\]]*)\]/g;
    let replaced = false;
    const transformed = source.replace(tokenRegex, (match, fileName, pageText, suffix) => {
      const pageNumber = Number(pageText);
      const href = buildCitationLink(pageNumber);
      if (!href) return match;
      replaced = true;
      const label = `${String(fileName || '').trim()}:${pageNumber}${String(suffix || '')}`;
      return `[${label}](${href})`;
    });

    if (replaced) return transformed;

    const fallbackHref = buildCitationLink(fallbackPage);
    return fallbackHref ? `[${source}](${fallbackHref})` : source;
  }

  const citations = Array.isArray(payload.citations) ? payload.citations : [];
  const citationLines = citations
    .slice(0, 12)
    .map((item) => `- ${linkifyCitationToken(item?.citation, item?.page_start)}`);

  const answerBody = linkifyCitationToken(payload.answerText || engineOutput?.answerText || 'No answer was generated.');
  const documentDisplay = documentUrl ? `[${fileAName}](${documentUrl}?target=_blank)` : fileAName;
  const summaryMode = payload?.summaryMode || engineOutput?.metrics?.generationMode || 'fallback';
  const includeEngineMetadata = shouldIncludeEngineMetadata({
    summaryMode,
    retrievalFallbackUsed: !!(payload?.metrics?.retrievalFallbackUsed || engineOutput?.metrics?.retrievalFallbackUsed),
    includeDebugMetadata: !!options?.includeDebugMetadata,
  });

  const contentLines = [
    '## Document Overview',
    '',
    `**Document:** ${documentDisplay}`,
    '',
    '---',
    '',
    '**Your Question:**',
    userPrompt ? `_${userPrompt}_` : '_No question provided._',
    '',
    '---',
    '',
    '**What I found:**',
    '',
    answerBody,
    '',
    '### Citations',
    citationLines.length > 0 ? citationLines.join('\n') : '- No citations available.',
  ];

  if (includeEngineMetadata) {
    contentLines.push(
      '',
      '### Engine Metadata',
      `- Selected engine: ${selectedEngine}`,
      `- Requirement index: ${payload?.indexUsage?.requirementIndexName || engineOutput?.indexUsage?.requirementIndexName || 'compliance-requirements-v1'}`,
      `- Chunk index: ${payload?.indexUsage?.chunkIndexName || engineOutput?.indexUsage?.chunkIndexName || 'compliance-chunks-v1'}`,
      `- Summary mode: ${summaryMode}`
    );
  }

  const content = contentLines.join('\n');

  return {
    responseContent: content,
    suggestedPrompts: [
      'What exact requirement text supports this answer?',
      'Which sections show the strongest evidence?',
      'What is missing from the current evidence set?',
    ],
    diagnostics: {
      selectedConversationEngine: selectedEngine,
      metrics: payload?.metrics || engineOutput?.metrics || {},
    },
    usedDocuments: [],
  };
}

export function buildComparisonFirstPrinciplesResponse(
  engineOutput = {},
  selectedEngine = 'first-principles',
  options = {}
) {
  function compactText(value = '') {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function truncateText(value = '', maxLength = 320) {
    const text = compactText(value);
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1).trim()}...`;
  }

  function normalizeFocusTerm(raw = '') {
    const value = compactText(raw);
    if (!value || value === '*') return '';

    const quoted = value.match(/["']([^"']+)["']/);
    if (quoted?.[1]) {
      return compactText(quoted[1]);
    }

    return value
      .replace(/^(what\s+does|define|meaning\s+of|what\s+is\s+the\s+definition\s+of)\s+/i, '')
      .replace(/\s+(mean|means)\??$/i, '')
      .trim();
  }

  function escapeRegex(value = '') {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function extractDefinitionQuote(text = '', focusTerm = '', maxLength = 220) {
    const body = compactText(text);
    const term = compactText(focusTerm);
    if (!body || !term) return '';

    const escaped = escapeRegex(term);
    const definitionRegex = new RegExp(`\\b${escaped}\\b[^.\\n]{0,180}(means|shall\\s+mean|is\\s+defined\\s+as|refers\\s+to)[^.\\n]{0,220}`, 'i');
    const definitionMatch = body.match(definitionRegex);
    if (definitionMatch?.[0]) {
      return truncateText(definitionMatch[0], maxLength);
    }

    const glossaryDashRegex = new RegExp(`(?:["'])?\\b${escaped}\\b(?:["'])?\\s*[-:]\\s*[^.\\n]{0,240}`, 'i');
    const glossaryDashMatch = body.match(glossaryDashRegex);
    if (glossaryDashMatch?.[0]) {
      return truncateText(glossaryDashMatch[0], maxLength);
    }

    const termRegex = new RegExp(`\\b${escaped}\\b`, 'i');
    const termMatch = termRegex.exec(body);
    if (!termMatch || typeof termMatch.index !== 'number') return '';

    const start = Math.max(0, termMatch.index - 80);
    const end = Math.min(body.length, termMatch.index + term.length + 140);
    const snippet = body.slice(start, end).trim();
    const prefix = start > 0 ? '...' : '';
    const suffix = end < body.length ? '...' : '';
    return truncateText(`${prefix}${snippet}${suffix}`, maxLength);
  }

  function pickDisplayText(item = {}, side = 'left', maxLength = 320) {
    const sideDoc = item?.[side] || {};
    const citation = compactText(sideDoc?.citation);
    const text = truncateText(sideDoc?.text, maxLength);

    if (citation && text) {
      return `${citation} - ${text}`;
    }

    if (citation) return citation;
    if (text) return text;
    return side === 'left' ? 'Left requirement' : 'Right requirement';
  }

  function buildPairLine(item = {}, maxLength = 220) {
    const left = pickDisplayText(item, 'left', maxLength);
    const right = pickDisplayText(item, 'right', maxLength);
    const score = Number(item?.score || 0).toFixed(3);
    return `- (${score}) ${left} <> ${right}`;
  }

  function buildGapLine(item = {}, maxLength = 360, focusTerm = '') {
    const citation = compactText(item?.citation);
    const text = truncateText(item?.text, maxLength);
    const quote = extractDefinitionQuote(item?.text, focusTerm, 240);
    const quoteSegment = quote ? ` | Quote: "${quote}"` : '';
    if (citation && text) return `- ${citation} - ${text}${quoteSegment}`;
    if (citation) return `- ${citation}`;
    if (text) return `- ${text}${quoteSegment}`;
    return '- Gap item (no citation/text available).';
  }

  const payload = engineOutput?.responsePayload || {};
  const comparisonMode = String(options?.comparisonMode || payload?.comparisonMode || 'topic').trim().toLowerCase() === 'comprehensive'
    ? 'comprehensive'
    : 'topic';
  const requestedTopic = compactText(options?.queryText || payload?.queryText || engineOutput?.queryText || '');
  const focusTerm = normalizeFocusTerm(requestedTopic);
  const summary = payload.summary || engineOutput?.summary || {};
  const summaryMode = payload?.summaryMode || engineOutput?.summaryMode || 'fallback';
  const includeEngineMetadata = shouldIncludeEngineMetadata({
    summaryMode,
    includeDebugMetadata: !!options?.includeDebugMetadata,
  });
  const matches = Array.isArray(payload.matches) ? payload.matches : [];
  const partials = Array.isArray(payload.partials) ? payload.partials : [];
  const conflicts = Array.isArray(payload.conflicts) ? payload.conflicts : [];
  const gapsLeft = Array.isArray(payload?.gaps?.left) ? payload.gaps.left : [];
  const gapsRight = Array.isArray(payload?.gaps?.right) ? payload.gaps.right : [];
  const spreadsheetArtifact = options?.spreadsheetArtifact || null;
  const spreadsheetLink = String(spreadsheetArtifact?.downloadLink || '').trim();
  const headlineSummary = truncateText(compactText(
    payload.comparisonSummary
    || engineOutput?.comparisonSummary
    || 'No summary was generated for this comparison.'
  ), 480);

  const matchLines = matches.slice(0, 5).map((item) => buildPairLine(item));
  const partialLines = partials.slice(0, 5).map((item) => buildPairLine(item));
  const conflictLines = conflicts.slice(0, 5).map((item) => buildPairLine(item));
  const leftGapLines = gapsLeft.slice(0, 3).map((item) => buildGapLine(item, 360, focusTerm));
  const rightGapLines = gapsRight.slice(0, 3).map((item) => buildGapLine(item, 360, focusTerm));

  const totalGaps = Number(summary.gapLeftCount || 0) + Number(summary.gapRightCount || 0);
  const alignmentRate = Number(summary.leftRequirementCount || 0) > 0
    ? ((Number(summary.alignedCount || 0) / Number(summary.leftRequirementCount || 0)) * 100).toFixed(1)
    : '0.0';

  const contentLines = [
    '## First-Principles Topic Comparison',
    '',
    comparisonMode === 'topic' && requestedTopic && requestedTopic !== '*'
      ? `**Requested topic:** ${requestedTopic}`
      : '',
    headlineSummary,
    '',
    '### Quick Read',
    `- Alignment rate (left): ${alignmentRate}%`,
    `- Total unmatched gaps: ${totalGaps}`,
    `- Interpretation mode: ${summaryMode}`,
    '',
    '### Count Summary',
    `- Comparison mode: ${comparisonMode}`,
    `- Left requirements: ${summary.leftRequirementCount || 0}`,
    `- Right requirements: ${summary.rightRequirementCount || 0}`,
    `- Matches: ${summary.matchCount || 0}`,
    `- Partials: ${summary.partialCount || 0}`,
    `- Conflicts: ${summary.conflictCount || 0}`,
    `- Left-only gaps: ${summary.gapLeftCount || 0}`,
    `- Right-only gaps: ${summary.gapRightCount || 0}`,
    '',
    '### Match Highlights',
    matchLines.length > 0 ? matchLines.join('\n') : '- No direct matches identified.',
    '',
    '### Partial Highlights',
    partialLines.length > 0 ? partialLines.join('\n') : '- No partial alignments identified.',
    '',
    '### Conflict Highlights',
    conflictLines.length > 0 ? conflictLines.join('\n') : '- No conflicts identified.',
    '',
    '### Gap Highlights (Left Only)',
    leftGapLines.length > 0
      ? leftGapLines.join('\n')
      : '- No left-only gap highlights.',
    Number(summary.gapLeftCount || 0) > leftGapLines.length
      ? `- ... plus ${Number(summary.gapLeftCount || 0) - leftGapLines.length} more left-only gap(s).`
      : '',
    '',
    '### Gap Highlights (Right Only)',
    rightGapLines.length > 0
      ? rightGapLines.join('\n')
      : '- No right-only gap highlights.',
    Number(summary.gapRightCount || 0) > rightGapLines.length
      ? `- ... plus ${Number(summary.gapRightCount || 0) - rightGapLines.length} more right-only gap(s).`
      : '',
    '',
    '### Full Comparison Artifact',
    comparisonMode === 'comprehensive'
      ? (spreadsheetLink
        ? `- Full detail spreadsheet: [Download](${spreadsheetLink})`
        : '- Spreadsheet artifact is not available for this run.')
      : '- Topic mode does not generate the comprehensive spreadsheet artifact.',
  ].filter(Boolean);

  if (includeEngineMetadata) {
    contentLines.push(
      '',
      '### Engine Metadata',
      `- Selected engine: ${selectedEngine}`,
      `- Requirement index: ${payload?.requirementIndexName || engineOutput?.requirementIndexName || 'compliance-requirements-v1'}`,
      `- Summary mode: ${summaryMode}`
    );
  }

  const content = contentLines.join('\n');

  return {
    responseContent: content,
    suggestedPrompts: [
      'Show only material conflicts with citations.',
      'Which left-only gaps are highest risk?',
      'Summarize partial matches requiring policy review.',
    ],
    diagnostics: {
      selectedComparisonEngine: selectedEngine,
      comparisonMode,
      summary,
      spreadsheetArtifactAvailable: Boolean(spreadsheetLink),
    },
    spreadsheetBlobName: spreadsheetArtifact?.spreadsheetBlobName || '',
    spreadsheetFileName: spreadsheetArtifact?.spreadsheetFileName || '',
    downloadLink: spreadsheetLink,
  };
}
