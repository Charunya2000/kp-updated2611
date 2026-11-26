import fetch from 'node-fetch';
import { htmlToText } from 'html-to-text';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { setProcessEnvironment } from '../scripts/configActions.js';
import { AzureOpenAI } from 'openai';
import { SearchClient, AzureKeyCredential } from '@azure/search-documents';
import crypto from 'crypto';

const TARGET_URL = 'https://confluence-aes.kp.org/spaces/KPMCBILL/pages/1579871037/Knowledge+base';
const DEFAULT_LOCAL_HTML_PATH = 'C:/Users/A257371/Downloads/Knowledge base - KPMC National Billing platform detail - AES Confluence.html';
const DEFAULT_OUTPUT_PATH = 'data/confluence-kpmcbill-knowledge-base.json';
const DEFAULT_INDEX_NAME = 'ormb-knowledgebase-002';
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-ada-002';
const MAX_EMBED_INPUT_CHARS = 16000;

const embeddingsClientCache = new Map();
const searchClientCache = new Map();
let runtimeBootstrapped = false;

function normalizeWhitespace(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function normalizeMultiline(value) {
  return (value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseArgs(argv) {
  const args = {
    localFile: null,
    output: DEFAULT_OUTPUT_PATH,
    url: TARGET_URL,
    pushSearch: false,
    indexName: DEFAULT_INDEX_NAME,
    embeddingModel: DEFAULT_EMBEDDING_MODEL,
    dryRun: false,
  };

  for (let index = 2; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--local-file') {
      args.localFile = argv[index + 1] || DEFAULT_LOCAL_HTML_PATH;
      index++;
    } else if (arg === '--output') {
      args.output = argv[index + 1] || DEFAULT_OUTPUT_PATH;
      index++;
    } else if (arg === '--url') {
      args.url = argv[index + 1] || TARGET_URL;
      index++;
    } else if (arg === '--push-search') {
      args.pushSearch = true;
    } else if (arg === '--index-name') {
      args.indexName = argv[index + 1] || DEFAULT_INDEX_NAME;
      index++;
    } else if (arg === '--embedding-model') {
      args.embeddingModel = argv[index + 1] || DEFAULT_EMBEDDING_MODEL;
      index++;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    }
  }

  return args;
}

function getConfluenceToken() {
  if (process.env.CONFLUENCE_API_TOKEN) {
    return process.env.CONFLUENCE_API_TOKEN;
  }

  const envName = process.env.envName;
  if (!envName) {
    throw new Error('Missing envName environment variable.');
  }

  const keyName = `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.confluence.api.key`;
  const token = process.env[keyName];

  if (!token) {
    throw new Error(`Missing Confluence API token environment variable: ${keyName}`);
  }

  return token;
}

async function bootstrapRuntimeEnvironment() {
  if (runtimeBootstrapped) {
    return;
  }

  await setProcessEnvironment();
  runtimeBootstrapped = true;
}

function getEnvVar(name, requiredMessage) {
  const value = String(process.env[name] || '').trim();
  if (!value && requiredMessage) {
    throw new Error(requiredMessage);
  }
  return value;
}

function getEmbeddingsClientStandalone({ embeddingModel = DEFAULT_EMBEDDING_MODEL } = {}) {
  const envName = getEnvVar('envName', 'Missing envName environment variable.');
  const embeddingsEndpoint = getEnvVar(
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.embeddingsEndpoint`,
    'Missing embeddings endpoint environment variable.'
  );
  const embeddingsApiKey = getEnvVar(
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.openai.api.key`,
    'Missing OpenAI API key environment variable.'
  );
  const deployment = String(embeddingModel || DEFAULT_EMBEDDING_MODEL).trim() || DEFAULT_EMBEDDING_MODEL;
  const apiVersion = '2023-05-15';
  const cacheKey = `${embeddingsEndpoint}::${deployment}::${apiVersion}`;

  if (!embeddingsClientCache.has(cacheKey)) {
    embeddingsClientCache.set(cacheKey, new AzureOpenAI({
      apiVersion,
      endpoint: embeddingsEndpoint,
      apiKey: embeddingsApiKey,
      deployment,
    }));
  }

  return embeddingsClientCache.get(cacheKey);
}

function getSearchClientStandalone(indexName = DEFAULT_INDEX_NAME) {
  const envName = getEnvVar('envName', 'Missing envName environment variable.');
  const searchEndpoint = getEnvVar(
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint.new.t3`,
    'Missing Azure Search endpoint environment variable.'
  );
  const searchApiKey = getEnvVar(
    `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.new.t3.api.key`,
    'Missing Azure Search API key environment variable.'
  );
  const normalizedIndexName = String(indexName || DEFAULT_INDEX_NAME).trim() || DEFAULT_INDEX_NAME;
  const cacheKey = `${searchEndpoint}::${normalizedIndexName}`;

  if (!searchClientCache.has(cacheKey)) {
    searchClientCache.set(cacheKey, new SearchClient(
      searchEndpoint,
      normalizedIndexName,
      new AzureKeyCredential(searchApiKey)
    ));
  }

  return searchClientCache.get(cacheKey);
}

function hasConfluenceEnvToken() {
  const envName = process.env.envName;
  if (!envName) {
    return false;
  }

  const keyName = `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.confluence.api.key`;
  return Boolean(process.env[keyName]);
}

async function ensureConfluenceEnvironment() {
  await bootstrapRuntimeEnvironment();

  if (process.env.CONFLUENCE_API_TOKEN || hasConfluenceEnvToken()) {
    return;
  }

  await setProcessEnvironment();

  if (!process.env.CONFLUENCE_API_TOKEN && !hasConfluenceEnvToken()) {
    throw new Error('Confluence environment initialization completed, but no token was found. Ensure KP config environment variables are set.');
  }
}

async function ensureSearchEnvironment() {
  await bootstrapRuntimeEnvironment();

  const envName = String(process.env.envName || '').trim();
  const hasSearchEnv = !!(envName &&
    process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`] &&
    process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.api.key`] &&
    process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.embeddingsEndpoint`] &&
    process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.openai.api.key`]);

  if (!hasSearchEnv) {
    await setProcessEnvironment();
  }
}

function extractPageIdFromUrl(url) {
  const parsed = new URL(url);
  const match = parsed.pathname.match(/\/pages\/(\d+)/i);
  if (!match) {
    throw new Error(`Could not parse Confluence page ID from URL: ${url}`);
  }
  return match[1];
}

async function fetchConfluenceHtmlByUrl(url) {
  const token = getConfluenceToken();
  const pageId = extractPageIdFromUrl(url);

  const response = await fetch(`https://confluence-aes.kp.org/rest/api/content/${pageId}?expand=body.storage,title`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Confluence page ${pageId}: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  return {
    sourceType: 'confluence-api',
    sourceUrl: url,
    pageId,
    title: payload?.title || 'Unknown Title',
    html: payload?.body?.storage?.value || '',
  };
}

function getNodeText(node) {
  if (!node) {
    return '';
  }

  if (node.type === 'text') {
    return node.data || '';
  }

  const children = Array.isArray(node.children) ? node.children : [];
  return children.map(getNodeText).join('');
}

function getHeadingLevel(name) {
  const match = /^h([1-6])$/i.exec(name || '');
  return match ? Number(match[1]) : null;
}

function findNodesByName(node, names, acc = []) {
  if (!node) {
    return acc;
  }

  if (node.name && names.has(node.name.toLowerCase())) {
    acc.push(node);
  }

  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) {
    findNodesByName(child, names, acc);
  }

  return acc;
}

function extractTableText(tableNode) {
  const rows = findNodesByName(tableNode, new Set(['tr']));
  if (rows.length === 0) {
    return normalizeMultiline(getNodeText(tableNode));
  }

  const rowLines = [];
  for (const row of rows) {
    const cells = findNodesByName(row, new Set(['th', 'td']));
    const cellValues = cells
      .map(cell => normalizeWhitespace(getNodeText(cell)))
      .filter(Boolean);

    if (cellValues.length > 0) {
      rowLines.push(cellValues.join(' | '));
    }
  }

  return normalizeMultiline(rowLines.join('\n'));
}

function isSqlStatement(text) {
  const sql = normalizeMultiline(text);
  if (!sql) {
    return false;
  }

  return /\b(SELECT|INSERT|UPDATE|DELETE|MERGE|WITH|FROM|JOIN|WHERE|GROUP\s+BY|ORDER\s+BY|FETCH\s+FIRST)\b/i.test(sql);
}

function createExtractorState() {
  return {
    sections: [],
    headingStack: [],
    currentSection: null,
    lastParagraph: '',
    sqlDedup: new Set(),
  };
}

function ensureSection(state) {
  if (state.currentSection) {
    return state.currentSection;
  }

  const section = {
    sectionTitle: 'Document Root',
    sectionPath: ['Document Root'],
    tables: [],
    sqlStatements: [],
    textCandidates: [],
  };
  state.sections.push(section);
  state.currentSection = section;
  return section;
}

function startSection(state, headingText, headingTag) {
  const text = normalizeWhitespace(headingText);
  if (!text) {
    return;
  }

  const level = getHeadingLevel(headingTag) || 6;
  state.headingStack = state.headingStack.filter(item => item.level < level);
  state.headingStack.push({ level, text });

  const section = {
    sectionTitle: text,
    sectionPath: state.headingStack.map(item => item.text),
    tables: [],
    sqlStatements: [],
    textCandidates: [],
  };

  state.sections.push(section);
  state.currentSection = section;
}

function addParagraph(state, paragraphText) {
  const text = normalizeWhitespace(paragraphText);
  if (!text) {
    return;
  }

  const section = ensureSection(state);
  section.textCandidates.push(text);
  state.lastParagraph = text;
}

function addTable(state, tableText) {
  const text = normalizeMultiline(tableText);
  if (!text) {
    return;
  }

  const section = ensureSection(state);
  section.tables.push({
    tableDescription: state.lastParagraph || '',
    tableContent: text,
  });

  state.lastParagraph = '';
}

function addSql(state, sqlText) {
  const text = normalizeMultiline(sqlText);
  if (!isSqlStatement(text)) {
    return;
  }

  const signature = text.toLowerCase();
  if (state.sqlDedup.has(signature)) {
    return;
  }
  state.sqlDedup.add(signature);

  const section = ensureSection(state);
  section.sqlStatements.push({
    sqlSectionTitle: section.sectionTitle,
    sqlDescription: state.lastParagraph || '',
    sqlStatement: text,
  });

  state.lastParagraph = '';
}

function buildStructuredFromHtml(html) {
  const state = createExtractorState();

  htmlToText(html, {
    wordwrap: false,
    preserveNewlines: true,
    baseElements: {
      selectors: ['#main-content', '#content'],
      returnDomByDefault: true,
    },
    selectors: [
      { selector: 'script', format: 'skip' },
      { selector: 'style', format: 'skip' },
      { selector: 'img', format: 'skip' },
      { selector: 'h1', format: 'captureHeading' },
      { selector: 'h2', format: 'captureHeading' },
      { selector: 'h3', format: 'captureHeading' },
      { selector: 'h4', format: 'captureHeading' },
      { selector: 'h5', format: 'captureHeading' },
      { selector: 'h6', format: 'captureHeading' },
      { selector: 'p', format: 'captureParagraph' },
      { selector: 'li', format: 'captureParagraph' },
      { selector: 'table', format: 'captureTable' },
      { selector: 'pre', format: 'captureSql' },
      { selector: 'code', format: 'captureSql' },
    ],
    formatters: {
      captureHeading: (elem) => {
        startSection(state, getNodeText(elem), elem.name);
      },
      captureParagraph: (elem) => {
        addParagraph(state, getNodeText(elem));
      },
      captureTable: (elem) => {
        addTable(state, extractTableText(elem));
      },
      captureSql: (elem) => {
        addSql(state, getNodeText(elem));
      },
    },
  });

  const sections = state.sections
    .map((section) => {
      const dedupedText = [];
      const seen = new Set();

      for (const paragraph of section.textCandidates) {
        const normalized = normalizeWhitespace(paragraph);
        if (!normalized || seen.has(normalized)) {
          continue;
        }
        seen.add(normalized);
        dedupedText.push(normalized);
      }

      const hasTables = section.tables.length > 0;
      const hasSql = section.sqlStatements.length > 0;

      return {
        sectionTitle: section.sectionTitle,
        sectionPath: section.sectionPath,
        tables: section.tables,
        sqlStatements: section.sqlStatements,
        text: hasTables || hasSql ? [] : dedupedText,
      };
    })
    .filter(section => section.tables.length > 0 || section.sqlStatements.length > 0 || section.text.length > 0);

  return {
    sectionTitles: sections.map(section => section.sectionTitle),
    sections,
  };
}

function buildSectionPathText(sectionPath) {
  if (!Array.isArray(sectionPath)) {
    return '';
  }
  return sectionPath.map((part) => normalizeWhitespace(part)).filter(Boolean).join(' > ');
}

function computeDocumentHash(payload) {
  const raw = JSON.stringify(payload);
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function buildContentForEmbedding({ sectionTitle, sectionPathText, contentDescription, content }) {
  const merged = [
    sectionTitle || '',
    sectionPathText || '',
    contentDescription || '',
    content || '',
  ].filter(Boolean).join('\n\n');

  return merged.length > MAX_EMBED_INPUT_CHARS
    ? merged.slice(0, MAX_EMBED_INPUT_CHARS)
    : merged;
}

function flattenExtractedForSearch({ source, extracted }) {
  const rows = [];
  const sections = Array.isArray(extracted?.sections) ? extracted.sections : [];

  sections.forEach((section, sectionIndex) => {
    const sectionTitle = String(section?.sectionTitle || '').trim();
    const sectionPath = Array.isArray(section?.sectionPath) ? section.sectionPath : [];
    const sectionPathText = buildSectionPathText(sectionPath);

    const base = {
      sourceType: source?.sourceType || 'unknown',
      sourceUrl: source?.sourceUrl || '',
      pageId: String(source?.pageId || ''),
      pageTitle: String(source?.title || ''),
      sectionTitle,
      sectionPath,
      sectionPathText,
      sectionOrdinal: sectionIndex,
      extractedAt: source?.extractedAt || new Date().toISOString(),
    };

    const tables = Array.isArray(section?.tables) ? section.tables : [];
    tables.forEach((table, contentOrdinal) => {
      const contentDescription = normalizeWhitespace(table?.tableDescription || '');
      const content = normalizeMultiline(table?.tableContent || '');
      if (!content) return;

      const id = `table-${base.pageId || 'no-page'}-${sectionIndex}-${contentOrdinal}`;
      const doc = {
        id,
        ...base,
        contentOrdinal,
        contentType: 'table',
        sqlSectionTitle: '',
        contentDescription,
        content,
        isSql: false,
        hasTable: true,
      };
      doc.documentHash = computeDocumentHash(doc);
      rows.push(doc);
    });

    const sqlStatements = Array.isArray(section?.sqlStatements) ? section.sqlStatements : [];
    sqlStatements.forEach((sql, contentOrdinal) => {
      const contentDescription = normalizeWhitespace(sql?.sqlDescription || '');
      const content = normalizeMultiline(sql?.sqlStatement || '');
      if (!content) return;

      const id = `sql-${base.pageId || 'no-page'}-${sectionIndex}-${contentOrdinal}`;
      const doc = {
        id,
        ...base,
        contentOrdinal,
        contentType: 'sql',
        sqlSectionTitle: normalizeWhitespace(sql?.sqlSectionTitle || sectionTitle),
        contentDescription,
        content,
        isSql: true,
        hasTable: false,
      };
      doc.documentHash = computeDocumentHash(doc);
      rows.push(doc);
    });

    const textBlocks = Array.isArray(section?.text) ? section.text : [];
    textBlocks.forEach((text, contentOrdinal) => {
      const content = normalizeWhitespace(text || '');
      if (!content) return;

      const id = `text-${base.pageId || 'no-page'}-${sectionIndex}-${contentOrdinal}`;
      const doc = {
        id,
        ...base,
        contentOrdinal,
        contentType: 'text',
        sqlSectionTitle: '',
        contentDescription: '',
        content,
        isSql: false,
        hasTable: false,
      };
      doc.documentHash = computeDocumentHash(doc);
      rows.push(doc);
    });
  });

  return rows;
}

async function createEmbeddingForContent(embeddingsClient, model, content) {
  const { data } = await embeddingsClient.embeddings.create({
    input: content,
    model,
  });

  return data?.[0]?.embedding || [];
}

async function enrichDocumentsWithEmbeddings(documents, { embeddingsClient, embeddingModel }) {
  const enriched = [];
  for (const doc of documents) {
    const embedInput = buildContentForEmbedding(doc);
    const contentVector = await createEmbeddingForContent(embeddingsClient, embeddingModel, embedInput);
    enriched.push({ ...doc, contentVector });
  }
  return enriched;
}

function chunkArray(items, chunkSize) {
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

async function uploadDocumentsToSearchIndex(searchClient, documents, { chunkSize = 100 } = {}) {
  const chunks = chunkArray(documents, chunkSize);
  let uploaded = 0;
  const failures = [];

  for (const chunk of chunks) {
    const result = await searchClient.uploadDocuments(chunk);
    result.results.forEach((item, index) => {
      if (item.succeeded) {
        uploaded += 1;
      } else {
        failures.push({ key: chunk[index]?.id || null, errorMessage: item.errorMessage || 'Unknown error' });
      }
    });
  }

  return { uploaded, failures };
}

async function loadSourceHtml(args) {
  if (args.localFile) {
    const html = await readFile(args.localFile, 'utf-8');
    return {
      sourceType: 'local-file',
      sourceUrl: args.localFile,
      pageId: null,
      title: 'Knowledge base (local snapshot)',
      html,
    };
  }

  await ensureConfluenceEnvironment();

  return fetchConfluenceHtmlByUrl(args.url);
}

async function run() {
  await bootstrapRuntimeEnvironment();

  const args = parseArgs(process.argv);
  const source = await loadSourceHtml(args);
  const extracted = buildStructuredFromHtml(source.html);

  const output = {
    source: {
      sourceType: source.sourceType,
      sourceUrl: source.sourceUrl,
      pageId: source.pageId,
      title: source.title,
      extractedAt: new Date().toISOString(),
    },
    categories: {
      sectionTitles: extracted.sectionTitles,
      sections: extracted.sections,
    },
  };

  const outputPath = path.resolve(process.cwd(), args.output);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`Wrote JSON output to ${outputPath}`);
  console.log(`Sections captured: ${extracted.sections.length}`);

  if (!args.pushSearch) {
    return;
  }

  await ensureSearchEnvironment();
  const embeddingsClient = getEmbeddingsClientStandalone({ embeddingModel: args.embeddingModel });
  const searchClient = getSearchClientStandalone(args.indexName);

  const flattenedDocuments = flattenExtractedForSearch({ source: output.source, extracted });
  console.log(`Flattened content units: ${flattenedDocuments.length}`);

  if (args.dryRun) {
    console.log('Dry run enabled. Skipping embeddings and Azure Search upload.');
    return;
  }

  const documentsWithEmbeddings = await enrichDocumentsWithEmbeddings(flattenedDocuments, {
    embeddingsClient,
    embeddingModel: args.embeddingModel,
  });

  const uploadResult = await uploadDocumentsToSearchIndex(searchClient, documentsWithEmbeddings);
  console.log(`Uploaded documents: ${uploadResult.uploaded}`);
  if (uploadResult.failures.length > 0) {
    console.log(`Upload failures: ${uploadResult.failures.length}`);
    console.log(JSON.stringify(uploadResult.failures.slice(0, 20), null, 2));
  }
}

run().catch((error) => {
  console.error('Extraction failed:', error);
  process.exit(1);
});
