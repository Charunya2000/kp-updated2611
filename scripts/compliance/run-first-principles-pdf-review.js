import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFParser from 'pdf2json';
import {
  AzureKeyCredential,
  SearchClient,
  SearchIndexClient,
} from '@azure/search-documents';
import { buildFirstPrinciplesArtifacts } from '../../app/services/langgraphs/compliance/docConversation1stPriService.js';
import { serializeFirstPrinciplesArtifactsForSearch } from '../../app/services/langgraphs/compliance/docConversation1stPriIndexMapper.js';
import { writeFirstPrinciplesSearchDocuments } from '../../app/services/langgraphs/compliance/docConversation1stPriIndexWriter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const DEFAULT_CHUNK_INDEX_NAME = 'compliance-chunks-v1';
const DEFAULT_REQUIREMENT_INDEX_NAME = 'compliance-requirements-v1';

function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function sanitizeExtractedText(value = '') {
  const repaired = repairLikelySplitWords(String(value || '').normalize('NFKC'));

  return repaired
    // Restore missing boundary after possessive markers if extraction collapsed spacing.
    .replace(/'s(?=[A-Za-z])/g, "'s ")
    // Strip bidi/zero-width controls that commonly trigger ambiguous-char warnings.
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    // Normalize punctuation to stable ASCII equivalents.
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2022]/g, '-')
    .replace(/[\u00A0]/g, ' ')
    .replace(/[\u00A7]/g, 'Section')
    .replace(/\s+/g, ' ')
    .trim();
}

function repairLikelySplitWords(text = '') {
  const stopShortTokens = new Set([
    'a', 'an', 'as', 'at', 'be', 'by', 'do', 'he', 'if', 'in', 'is', 'it',
    'me', 'my', 'no', 'of', 'on', 'or', 'so', 'to', 'up', 'us', 'we'
  ]);

  const shouldSkipMerge = (shortToken, longToken) => {
    if (!shortToken || !longToken) return true;
    const shortLower = shortToken.toLowerCase();
    if (stopShortTokens.has(shortLower)) return true;
    // Avoid touching acronym phrases like "MCO s".
    if (/^[A-Z]{2,}$/.test(longToken)) return true;
    return false;
  };

  let output = String(text || '');

  // Run at most two passes to avoid aggressive cascading merges.
  for (let i = 0; i < 2; i += 1) {
    const before = output;

    // long + short split: "Secon d", "Comp laint", "en rollee"
    output = output.replace(/\b([A-Za-z]{3,})\s([A-Za-z]{1,2})\b/g, (full, left, right) => {
      if (shouldSkipMerge(right, left)) return full;
      return `${left}${right}`;
    });

    if (before === output) {
      break;
    }
  }

  return output;
}

function normalizePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function boolFromArgs(args = [], flag = '') {
  return args.includes(flag);
}

function parseArgs(argv = []) {
  const args = argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    return { help: true };
  }

  const getArg = (name, fallback = '') => {
    const idx = args.indexOf(name);
    return idx >= 0 ? String(args[idx + 1] || '').trim() : fallback;
  };

  const pdfPath = getArg('--pdf');
  const outputDir = getArg('--output-dir', 'scripts/compliance/output');
  const envName = getArg('--env');
  const conversationId = getArg('--conversation-id');
  const lob = getArg('--lob', 'UNKNOWN');
  const prepVersion = getArg('--prep-version', '1');

  const chunkIndexName = getArg('--chunk-index', DEFAULT_CHUNK_INDEX_NAME);
  const requirementIndexName = getArg('--requirement-index', DEFAULT_REQUIREMENT_INDEX_NAME);

  const endpointOverride = getArg('--endpoint');
  const uploadKeyOverride = getArg('--upload-key');
  const queryKeyOverride = getArg('--query-key');

  const uploadSearch = boolFromArgs(args, '--upload-search');
  const ensureIndexes = boolFromArgs(args, '--ensure-indexes');

  const maxLinesPerSection = normalizePositiveInt(getArg('--max-lines-per-section', '120'), 120);
  const headingRegex = getArg('--heading-regex', '^(?:Section\\s+)?(\\d{1,3}(?:\\.\\d{1,4}){1,4})\\b');

  return {
    help: false,
    pdfPath,
    outputDir,
    envName,
    conversationId,
    lob,
    prepVersion,
    chunkIndexName,
    requirementIndexName,
    endpointOverride,
    uploadKeyOverride,
    queryKeyOverride,
    uploadSearch,
    ensureIndexes,
    maxLinesPerSection,
    headingRegex,
  };
}

function printHelp() {
  console.log(`\nFirst-principles PDF review utility\n\nUsage:\n  node scripts/compliance/run-first-principles-pdf-review.js --pdf <path-to-pdf> [options]\n\nRequired:\n  --pdf <path>                      Local PDF path\n\nOptions:\n  --conversation-id <id>            Optional conversation id (default: generated)\n  --lob <lob>                       Optional LOB (default: UNKNOWN)\n  --prep-version <v>                Optional prep version (default: 1)\n  --output-dir <dir>                Output folder for review JSON files\n  --max-lines-per-section <n>       Safety split for oversized sections (default: 120)\n  --heading-regex <regex>           Heading regex with section number capture group\n\nAI Search options (optional):\n  --upload-search                   Upload docs to AI Search\n  --ensure-indexes                  Create or update first-principles indexes before upload\n  --env <envName>                   Uses KP env keys for .new.t3 instance\n  --endpoint <url>                  Explicit endpoint override\n  --upload-key <key>                Explicit admin/upload key override\n  --query-key <key>                 Explicit query key override\n  --chunk-index <name>              Chunk index (default: compliance-chunks-v1)\n  --requirement-index <name>        Requirement index (default: compliance-requirements-v1)\n\nKP env vars expected when --upload-search is used with --env:\n  host.<env>-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint.new.t3\n  host.<env>-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.new.t3.api.key\n  host.<env>-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.new.t3.api.key\n`);
}

function buildSearchConfig({ envName, endpointOverride, uploadKeyOverride, queryKeyOverride }) {
  const endpointKeyName = envName
    ? `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint.new.t3`
    : '';
  const uploadKeyName = envName
    ? `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.new.t3.api.key`
    : '';
  const queryKeyName = envName
    ? `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.new.t3.api.key`
    : '';

  const endpoint = normalizeString(endpointOverride || (endpointKeyName ? process.env[endpointKeyName] : ''));
  const uploadKey = normalizeString(uploadKeyOverride || (uploadKeyName ? process.env[uploadKeyName] : ''));
  const queryKey = normalizeString(queryKeyOverride || (queryKeyName ? process.env[queryKeyName] : uploadKey));

  return {
    endpoint,
    uploadKey,
    queryKey,
    endpointKeyName,
    uploadKeyName,
    queryKeyName,
  };
}

async function parsePdfToLines(pdfPath) {
  const parser = new PDFParser(null, 1);
  const pdfData = await new Promise((resolve, reject) => {
    parser.on('pdfParser_dataReady', (data) => resolve(data));
    parser.on('pdfParser_dataError', (err) => reject(err?.parserError || err));
    parser.loadPDF(pdfPath);
  });

  const lines = [];
  let currentIndex = 0;

  (pdfData?.Pages || []).forEach((page, pageIdx) => {
    const pageNumber = pageIdx + 1;
    const rowMap = new Map();

    (page?.Texts || []).forEach((textItem) => {
      const y = Number(textItem?.y || 0);
      const yBucket = Math.round(y * 2) / 2;
      const key = String(yBucket);
      const x = Number(textItem?.x || 0);

      const decoded = (textItem?.R || [])
        .map((r) => {
          try {
            return decodeURIComponent(String(r?.T || ''));
          } catch {
            return String(r?.T || '');
          }
        })
        .join(' ');

      const cleaned = sanitizeExtractedText(decoded);

      if (!cleaned) return;

      const existing = rowMap.get(key) || [];
      existing.push({ x, text: cleaned });
      rowMap.set(key, existing);
    });

    const orderedRows = Array.from(rowMap.entries())
      .map(([yKey, items]) => ({
        y: Number(yKey),
        text: items
          .sort((a, b) => a.x - b.x)
          .map((item) => item.text)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim(),
      }))
      .filter((row) => row.text)
      .sort((a, b) => a.y - b.y);

    orderedRows.forEach((row) => {
      const startIndex = currentIndex;
      const endIndex = startIndex + row.text.length;
      lines.push({
        page: pageNumber,
        y: row.y,
        text: row.text,
        startIndex,
        endIndex,
      });
      currentIndex = endIndex + 1;
    });
  });

  return {
    lines,
    pageCount: Array.isArray(pdfData?.Pages) ? pdfData.Pages.length : 0,
  };
}

function parseSectionNumber(heading = '', regex) {
  const match = String(heading || '').match(regex);
  if (!match) return '';
  return normalizeString(match[1] || match[0]);
}

function isLikelyPolicySectionNumber(value = '') {
  const normalized = normalizeString(value);
  if (!/^\d{1,3}(?:\.\d{1,4}){1,8}$/.test(normalized)) return false;
  const first = Number(normalized.split('.')[0]);
  if (!Number.isFinite(first)) return false;
  // Policy/handbook sections are typically low cardinality; this excludes many numeric references.
  return first > 0 && first <= 40;
}

function buildSectionsFromFullText(lines = [], { headingRegex }) {
  const sourceLines = Array.isArray(lines)
    ? lines.map((line) => ({
      page: Number(line?.page || 0) || null,
      text: sanitizeExtractedText(line?.text || ''),
    })).filter((line) => line.text)
    : [];

  if (sourceLines.length === 0) {
    return [];
  }

  const fullText = sourceLines.map((line) => line.text).join('\n');
  const lineStarts = [];
  let cursor = 0;
  for (const line of sourceLines) {
    lineStarts.push(cursor);
    cursor += line.text.length + 1;
  }

  const toPage = (charIndex) => {
    for (let i = lineStarts.length - 1; i >= 0; i -= 1) {
      if (lineStarts[i] <= charIndex) {
        return sourceLines[i].page;
      }
    }
    return sourceLines[0]?.page || 1;
  };

  const candidates = [];

  const strictRegex = new RegExp(headingRegex, 'gim');
  let strictMatch = strictRegex.exec(fullText);
  while (strictMatch) {
    const sectionNumber = normalizeString(strictMatch[1] || strictMatch[0]);
    if (isLikelyPolicySectionNumber(sectionNumber)) {
      candidates.push({
        index: strictMatch.index,
        sectionNumber,
        heading: sanitizeExtractedText(strictMatch[0] || sectionNumber),
      });
    }
    strictMatch = strictRegex.exec(fullText);
  }

  // Fallback: broad section-anchor capture from dense text when strict heading extraction is sparse.
  if (candidates.length < 10) {
    const broadRegex = /(?<![\d,$])(\d{1,3}(?:\.\d{1,4}){1,8})(?!\d)\s*(?:[:.-]\s*)?([A-Za-z][^\n]{0,120})?/g;
    let broadMatch = broadRegex.exec(fullText);
    while (broadMatch) {
      const sectionNumber = normalizeString(broadMatch[1]);
      if (isLikelyPolicySectionNumber(sectionNumber)) {
        const headingTail = sanitizeExtractedText(broadMatch[2] || '');
        candidates.push({
          index: broadMatch.index,
          sectionNumber,
          heading: sanitizeExtractedText(`${sectionNumber}${headingTail ? ` ${headingTail}` : ''}`),
        });
      }
      broadMatch = broadRegex.exec(fullText);
    }
  }

  const deduped = [];
  const seen = new Set();
  for (const candidate of candidates.sort((a, b) => a.index - b.index)) {
    const key = `${candidate.sectionNumber}@${candidate.index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(candidate);
  }

  if (deduped.length === 0) {
    return [];
  }

  const sections = [];
  for (let i = 0; i < deduped.length; i += 1) {
    const current = deduped[i];
    const next = deduped[i + 1];
    const start = current.index;
    const end = next ? next.index - 1 : fullText.length - 1;
    const rawBlock = fullText.slice(start, Math.max(start, end + 1));
    const content = sanitizeExtractedText(rawBlock);
    if (!content) continue;

    sections.push({
      heading: current.heading || current.sectionNumber,
      startPage: toPage(start),
      startIndex: start,
      endIndex: Math.max(start, end),
      content,
      subsections: [],
    });
  }

  return sections;
}

function detectOcrSpacingArtifacts(text = '', limit = 25) {
  const input = String(text || '');
  const pattern = /\b([A-Za-z]{1,16})\s+([A-Za-z]{1,16})\b/g;

  const ignoreLeftSingles = new Set(['a', 'A', 'i', 'I']);
  const ignoreRightShort = new Set([
    'a', 'A', 'an', 'An', 'as', 'As', 'at', 'At', 'be', 'Be', 'by', 'By',
    'do', 'Do', 'he', 'He', 'if', 'If', 'in', 'In', 'is', 'Is', 'it', 'It',
    'me', 'Me', 'my', 'My', 'no', 'No', 'of', 'Of', 'on', 'On', 'or', 'Or',
    'so', 'So', 'to', 'To', 'up', 'Up', 'us', 'Us', 'we', 'We'
  ]);

  const matches = [];
  let total = 0;
  let match = pattern.exec(input);

  while (match) {
    const left = match[1] || '';
    const right = match[2] || '';

    const singlePrefixSplit = left.length === 1 && right.length >= 2 && !ignoreLeftSingles.has(left);
    const shortSuffixSplit = left.length >= 4 && right.length <= 2 && !ignoreRightShort.has(right);

    if (singlePrefixSplit || shortSuffixSplit) {
      total += 1;
      if (matches.length < limit) {
        matches.push(`${left} ${right}`);
      }
    }

    match = pattern.exec(input);
  }

  return {
    count: total,
    samples: matches,
  };
}

function buildSectionsFromLines(lines = [], { headingRegex, maxLinesPerSection }) {
  const regex = new RegExp(headingRegex, 'i');
  const sections = [];

  let active = null;

  const closeActive = (fallbackEnd) => {
    if (!active) return;
    active.endIndex = Number.isFinite(active.endIndex) ? active.endIndex : fallbackEnd;
    active.content = active.buffer.join('\n').trim();
    delete active.buffer;
    sections.push(active);
    active = null;
  };

  for (const line of Array.isArray(lines) ? lines : []) {
    const lineText = normalizeString(line?.text);
    if (!lineText) continue;

    const sectionNumber = parseSectionNumber(lineText, regex);
    const looksLikeHeading = Boolean(sectionNumber);

    if (looksLikeHeading) {
      closeActive((Number(line?.startIndex) || 0) - 1);
      active = {
        heading: lineText,
        sectionNumber,
        startPage: Number(line?.page || 0) || null,
        startIndex: Number(line?.startIndex || 0) || 0,
        endIndex: Number(line?.endIndex || 0) || 0,
        buffer: [],
        lineCount: 0,
      };
      continue;
    }

    if (!active) {
      active = {
        heading: 'Document Body',
        sectionNumber: '',
        startPage: Number(line?.page || 0) || null,
        startIndex: Number(line?.startIndex || 0) || 0,
        endIndex: Number(line?.endIndex || 0) || 0,
        buffer: [],
        lineCount: 0,
      };
    }

    active.buffer.push(lineText);
    active.lineCount += 1;
    active.endIndex = Number(line?.endIndex || active.endIndex || 0) || active.endIndex || 0;

    if (active.lineCount >= maxLinesPerSection) {
      closeActive(active.endIndex);
    }
  }

  if (active) {
    closeActive(active.endIndex);
  }

  if (sections.length === 0) {
    const fallbackSections = buildSectionsFromFullText(lines, { headingRegex });
    if (fallbackSections.length > 0) {
      return fallbackSections;
    }

    return [{
      heading: 'Document Body',
      sectionNumber: '',
      startPage: 1,
      startIndex: 0,
      endIndex: 0,
      content: '',
      subsections: [],
    }];
  }

  // If line-based heading detection appears too sparse, rebuild from full text anchors.
  if (sections.length < 10) {
    const fallbackSections = buildSectionsFromFullText(lines, { headingRegex });
    if (fallbackSections.length > sections.length) {
      return fallbackSections;
    }
  }

  // Build hierarchical nesting by section number depth where possible.
  const roots = [];
  const stack = [];

  for (const flat of sections) {
    const level = flat.sectionNumber ? flat.sectionNumber.split('.').length : 1;
    const node = {
      heading: flat.heading,
      startPage: flat.startPage,
      startIndex: flat.startIndex,
      endIndex: flat.endIndex,
      content: flat.content,
      subsections: [],
    };

    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].node.subsections.push(node);
    }

    stack.push({ level, node });
  }

  return roots;
}

function createSearchDeps({ endpoint, uploadKey, chunkIndexName, requirementIndexName }) {
  const clients = new Map();

  return {
    getUpdateClient(indexName) {
      if (!clients.has(indexName)) {
        clients.set(indexName, new SearchClient(endpoint, indexName, new AzureKeyCredential(uploadKey)));
      }
      return clients.get(indexName);
    },
    chunkIndexName,
    requirementIndexName,
  };
}

function normalizeSemanticField(field) {
  if (!field || typeof field !== 'object') {
    return field;
  }

  const { fieldName, ...rest } = field;
  return fieldName !== undefined
    ? { ...rest, name: fieldName }
    : field;
}

function normalizeSemanticSearch(semanticDefinition) {
  if (!semanticDefinition || typeof semanticDefinition !== 'object') {
    return semanticDefinition;
  }

  const {
    defaultConfiguration,
    defaultConfigurationName,
    configurations,
    ...rest
  } = semanticDefinition;

  return {
    ...rest,
    ...(defaultConfigurationName !== undefined && { defaultConfigurationName }),
    ...(defaultConfiguration !== undefined && { defaultConfigurationName: defaultConfiguration }),
    ...(Array.isArray(configurations) && {
      configurations: configurations.map((configuration) => {
        if (!configuration || typeof configuration !== 'object') {
          return configuration;
        }

        const { prioritizedFields, flightingOptIn, ...configurationRest } = configuration;

        if (!prioritizedFields || typeof prioritizedFields !== 'object') {
          return configurationRest;
        }

        const {
          titleField,
          contentFields,
          keywordsFields,
          prioritizedContentFields,
          prioritizedKeywordsFields,
          ...prioritizedFieldsRest
        } = prioritizedFields;

        return {
          ...configurationRest,
          prioritizedFields: {
            ...prioritizedFieldsRest,
            ...(titleField !== undefined && { titleField: normalizeSemanticField(titleField) }),
            ...(Array.isArray(contentFields) && {
              contentFields: contentFields.map(normalizeSemanticField),
            }),
            ...(Array.isArray(prioritizedContentFields) && {
              contentFields: prioritizedContentFields.map(normalizeSemanticField),
            }),
            ...(Array.isArray(keywordsFields) && {
              keywordsFields: keywordsFields.map(normalizeSemanticField),
            }),
            ...(Array.isArray(prioritizedKeywordsFields) && {
              keywordsFields: prioritizedKeywordsFields.map(normalizeSemanticField),
            }),
          },
        };
      }),
    }),
  };
}

function normalizeIndexDefinitionForSdk(indexDefinition = {}) {
  const cleanDefinition = Object.fromEntries(
    Object.entries(indexDefinition || {}).filter(([key]) => !key.startsWith('@odata.'))
  );

  if (Array.isArray(cleanDefinition.vectorSearch?.profiles)) {
    cleanDefinition.vectorSearch = {
      ...cleanDefinition.vectorSearch,
      profiles: cleanDefinition.vectorSearch.profiles.map((profile) => {
        const { algorithm, ...rest } = profile || {};
        return algorithm !== undefined
          ? { ...rest, algorithmConfigurationName: algorithm }
          : rest;
      }),
    };
  }

  if (cleanDefinition.similarity?.['@odata.type']) {
    const { '@odata.type': odataType, ...similarityRest } = cleanDefinition.similarity;
    cleanDefinition.similarity = { ...similarityRest, odatatype: odataType };
  }

  if (cleanDefinition.semanticSearch || cleanDefinition.semantic) {
    cleanDefinition.semanticSearch = normalizeSemanticSearch(
      cleanDefinition.semanticSearch || cleanDefinition.semantic
    );
    delete cleanDefinition.semantic;
  }

  if (Array.isArray(cleanDefinition.fields)) {
    cleanDefinition.fields = cleanDefinition.fields.map((field) => {
      const {
        dimensions,
        vectorSearchProfile,
        analyzer,
        searchAnalyzer,
        indexAnalyzer,
        ...rest
      } = field || {};

      return {
        ...rest,
        ...(dimensions !== undefined && { vectorSearchDimensions: dimensions }),
        ...(vectorSearchProfile !== undefined && { vectorSearchProfileName: vectorSearchProfile }),
        ...(analyzer !== undefined && { analyzerName: analyzer }),
        ...(searchAnalyzer !== undefined && { searchAnalyzerName: searchAnalyzer }),
        ...(indexAnalyzer !== undefined && { indexAnalyzerName: indexAnalyzer }),
      };
    });
  }

  return cleanDefinition;
}

async function ensureFirstPrinciplesIndexes({ endpoint, uploadKey }) {
  const indexClient = new SearchIndexClient(endpoint, new AzureKeyCredential(uploadKey));
  const chunkIndexPath = path.join(repoRoot, 'compliance_chunks_v1.index.json');
  const requirementIndexPath = path.join(repoRoot, 'compliance_requirements_v1.index.json');

  const [chunkRaw, requirementRaw] = await Promise.all([
    fs.readFile(chunkIndexPath, 'utf8'),
    fs.readFile(requirementIndexPath, 'utf8'),
  ]);

  const chunkIndex = normalizeIndexDefinitionForSdk(JSON.parse(chunkRaw));
  const requirementIndex = normalizeIndexDefinitionForSdk(JSON.parse(requirementRaw));

  await indexClient.createOrUpdateIndex(chunkIndex);
  await indexClient.createOrUpdateIndex(requirementIndex);

  return {
    createdOrUpdated: [chunkIndex?.name, requirementIndex?.name].filter(Boolean),
  };
}

async function sampleIndexDocuments({ endpoint, queryKey, chunkIndexName, requirementIndexName, conversationId, top = 5 }) {
  const filter = `conversation_id eq '${String(conversationId || '').replace(/'/g, "''")}'`;

  const queryIndex = async (indexName, selectFields = []) => {
    const client = new SearchClient(endpoint, indexName, new AzureKeyCredential(queryKey));

    const runQuery = async (includeSelect) => {
      const options = {
        filter,
        top,
      };

      if (includeSelect && Array.isArray(selectFields) && selectFields.length > 0) {
        options.select = selectFields;
      }

      return client.search('*', options);
    };

    let response;
    try {
      response = await runQuery(true);
    } catch (error) {
      const message = String(error?.message || '');
      // Some indexes differ slightly in retrievable fields; retry without $select.
      if (!message.toLowerCase().includes('invalid expression')) {
        throw error;
      }
      response = await runQuery(false);
    }

    const docs = [];
    for await (const row of response.results) {
      docs.push(row?.document || {});
      if (docs.length >= top) break;
    }

    return docs;
  };

  const [chunkDocs, requirementDocs] = await Promise.all([
    queryIndex(chunkIndexName, ['id', 'conversation_id', 'file_name', 'section_number', 'heading', 'page_start', 'char_start']),
    queryIndex(requirementIndexName, ['id', 'conversation_id', 'file_name', 'section_number', 'heading', 'requirement_key', 'category', 'page_start', 'char_start']),
  ]);

  return {
    filter,
    chunkDocs,
    requirementDocs,
  };
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function kpmsg(name, detail = {}) {
  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name,
      detail,
    }
  }));
}

function buildSectionNumberQualityStats({ chunkDocuments = [], requirementDocuments = [] }) {
  const expectedSectionPattern = /^\d{1,3}(?:\.\d{1,4}){0,6}$/;

  const compute = (docs = []) => {
    const total = Array.isArray(docs) ? docs.length : 0;
    let withSection = 0;
    let emptySection = 0;
    let malformedSection = 0;
    const uniqueSections = new Set();

    for (const doc of docs) {
      const value = normalizeString(doc?.section_number);
      if (!value) {
        emptySection += 1;
        continue;
      }

      withSection += 1;
      uniqueSections.add(value);
      if (!expectedSectionPattern.test(value)) {
        malformedSection += 1;
      }
    }

    const emptyPercent = total > 0
      ? Number(((emptySection / total) * 100).toFixed(2))
      : 0;

    return {
      total,
      withSection,
      emptySection,
      emptyPercent,
      malformedSection,
      uniqueSectionCount: uniqueSections.size,
    };
  };

  return {
    requirements: compute(requirementDocuments),
    chunks: compute(chunkDocuments),
  };
}

export async function runFirstPrinciplesPdfReview(argv = process.argv) {
  const runStartedAt = Date.now();
  const timingMs = {};
  const captureTiming = (name, startedAt) => {
    timingMs[name] = Date.now() - startedAt;
  };

  const args = parseArgs(argv);

  if (args.help) {
    printHelp();
    return;
  }

  const pdfPathInput = normalizeString(args.pdfPath);
  if (!pdfPathInput) {
    throw new Error('Missing required --pdf argument.');
  }

  const pdfAbsolutePath = path.isAbsolute(pdfPathInput)
    ? pdfPathInput
    : path.resolve(process.cwd(), pdfPathInput);

  const pdfFileName = path.basename(pdfAbsolutePath);
  const pdfFileStem = pdfFileName.replace(/\.[^.]+$/, '');
  const conversationId = normalizeString(args.conversationId, `review-${pdfFileStem}-${Date.now()}`);

  const outputDir = path.isAbsolute(args.outputDir)
    ? args.outputDir
    : path.resolve(process.cwd(), args.outputDir);

  const ensureOutputDirStartedAt = Date.now();
  await fs.mkdir(outputDir, { recursive: true });
  captureTiming('ensureOutputDir', ensureOutputDirStartedAt);

  kpmsg('firstPriPdfReviewStarted', {
    pdfPath: pdfAbsolutePath,
    conversationId,
    uploadSearch: args.uploadSearch,
    envName: args.envName || null,
  });

  const parsePdfStartedAt = Date.now();
  const parsed = await parsePdfToLines(pdfAbsolutePath);
  captureTiming('parsePdf', parsePdfStartedAt);

  const detectOcrArtifactsStartedAt = Date.now();
  const spacingArtifacts = detectOcrSpacingArtifacts(
    parsed.lines.map((line) => normalizeString(line?.text)).join(' ')
  );
  captureTiming('detectOcrArtifacts', detectOcrArtifactsStartedAt);

  const buildSectionsStartedAt = Date.now();
  const sections = buildSectionsFromLines(parsed.lines, {
    headingRegex: args.headingRegex,
    maxLinesPerSection: args.maxLinesPerSection,
  });
  captureTiming('buildSections', buildSectionsStartedAt);

  const buildArtifactsStartedAt = Date.now();
  const artifacts = buildFirstPrinciplesArtifacts({
    sections,
    conversationId,
    fileAName: pdfFileName,
  });
  captureTiming('buildArtifacts', buildArtifactsStartedAt);

  const serializeArtifactsStartedAt = Date.now();
  const serialized = serializeFirstPrinciplesArtifactsForSearch({
    chunkArtifacts: artifacts.chunkArtifacts,
    requirementArtifacts: artifacts.requirementArtifacts,
    options: {
      conversationId,
      docId: conversationId,
      fileName: pdfFileName,
      lob: args.lob,
      prepVersion: args.prepVersion,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });
  captureTiming('serializeArtifacts', serializeArtifactsStartedAt);

  const filePrefix = `${conversationId}`;
  const sectionsPath = path.join(outputDir, `${filePrefix}.sections.json`);
  const artifactsPath = path.join(outputDir, `${filePrefix}.artifacts.json`);
  const searchDocsPath = path.join(outputDir, `${filePrefix}.search-documents.json`);
  const summaryPath = path.join(outputDir, `${filePrefix}.summary.json`);

  const writeOutputFilesStartedAt = Date.now();
  await Promise.all([
    writeJson(sectionsPath, {
      conversationId,
      pdfFileName,
      pageCount: parsed.pageCount,
      lineCount: parsed.lines.length,
      sections,
    }),
    writeJson(artifactsPath, {
      conversationId,
      pdfFileName,
      metrics: artifacts.metrics,
      chunkArtifacts: artifacts.chunkArtifacts,
      requirementArtifacts: artifacts.requirementArtifacts,
    }),
    writeJson(searchDocsPath, {
      conversationId,
      validation: serialized.validation,
      chunkDocuments: serialized.chunkDocuments,
      requirementDocuments: serialized.requirementDocuments,
    }),
  ]);
  captureTiming('writeOutputFiles', writeOutputFilesStartedAt);

  let uploadSummary = null;
  let indexSample = null;
  let createdIndexes = null;

  const sectionNumberQuality = buildSectionNumberQualityStats({
    chunkDocuments: serialized.chunkDocuments,
    requirementDocuments: serialized.requirementDocuments,
  });

  if (args.uploadSearch) {
    const searchConfig = buildSearchConfig({
      envName: args.envName,
      endpointOverride: args.endpointOverride,
      uploadKeyOverride: args.uploadKeyOverride,
      queryKeyOverride: args.queryKeyOverride,
    });

    if (!searchConfig.endpoint || !searchConfig.uploadKey) {
      throw new Error([
        'Missing AI Search endpoint/upload key.',
        args.envName
          ? `Checked env vars: ${searchConfig.endpointKeyName}, ${searchConfig.uploadKeyName}`
          : 'Provide --env for KP key lookup or pass --endpoint and --upload-key explicitly.',
      ].join(' '));
    }

    if (args.ensureIndexes) {
      const ensureIndexesStartedAt = Date.now();
      createdIndexes = await ensureFirstPrinciplesIndexes({
        endpoint: searchConfig.endpoint,
        uploadKey: searchConfig.uploadKey,
      });
      captureTiming('ensureIndexes', ensureIndexesStartedAt);
    }

    const deps = createSearchDeps({
      endpoint: searchConfig.endpoint,
      uploadKey: searchConfig.uploadKey,
      chunkIndexName: args.chunkIndexName,
      requirementIndexName: args.requirementIndexName,
    });

    const uploadSearchDocsStartedAt = Date.now();
    uploadSummary = await writeFirstPrinciplesSearchDocuments({
      chunkDocuments: serialized.chunkDocuments,
      requirementDocuments: serialized.requirementDocuments,
      conversationId,
      options: {
        chunkIndexName: args.chunkIndexName,
        requirementIndexName: args.requirementIndexName,
        strictValidation: true,
        emitLogs: true,
      },
    }, deps);
    captureTiming('uploadSearchDocuments', uploadSearchDocsStartedAt);

    const sampleIndexesStartedAt = Date.now();
    indexSample = await sampleIndexDocuments({
      endpoint: searchConfig.endpoint,
      queryKey: searchConfig.queryKey || searchConfig.uploadKey,
      chunkIndexName: args.chunkIndexName,
      requirementIndexName: args.requirementIndexName,
      conversationId,
      top: 5,
    });
    captureTiming('sampleIndexes', sampleIndexesStartedAt);
  }

  timingMs.total = Date.now() - runStartedAt;

  const summary = {
    conversationId,
    pdfPath: pdfAbsolutePath,
    pdfFileName,
    outputDir,
    pageCount: parsed.pageCount,
    lineCount: parsed.lines.length,
    ocrSpacingArtifacts: spacingArtifacts,
    sectionCount: Array.isArray(sections) ? sections.length : 0,
    chunkCount: artifacts.chunkArtifacts.length,
    requirementCount: artifacts.requirementArtifacts.length,
    metrics: artifacts.metrics,
    timingMs,
    validation: serialized.validation,
    sectionNumberQuality,
    files: {
      sectionsPath,
      artifactsPath,
      searchDocsPath,
    },
    upload: uploadSummary,
    createdIndexes,
    indexSample,
  };

  await writeJson(summaryPath, summary);

  kpmsg('firstPriPdfReviewCompleted', {
    conversationId,
    sectionCount: summary.sectionCount,
    chunkCount: summary.chunkCount,
    requirementCount: summary.requirementCount,
    uploadEnabled: Boolean(args.uploadSearch),
    outputDir,
    totalDurationMs: timingMs.total,
  });

  console.log('\nFirst-principles PDF review summary');
  console.log(JSON.stringify(summary, null, 2));
}

const isDirectExecution = (() => {
  if (!process.argv[1]) return false;
  return path.resolve(process.argv[1]) === __filename;
})();

if (isDirectExecution) {
  runFirstPrinciplesPdfReview(process.argv).catch((error) => {
    console.error('First-principles PDF review failed:', error?.message || String(error));
    process.exitCode = 1;
  });
}
