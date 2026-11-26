import { selectDocumentExt } from '@db/selectDocument';
import { upsertDocument } from '@db/updateDocument';
import { validateBasicMulti } from './validation';
import { v4 as uuidv4 } from 'uuid';
import { getServerSession } from '@utils/getSession';
import { getQueryContent } from './medicareQueryService';

const documentType = 'MedicareCompareResultConfig';
const TEAM_DB = 'team-medicare-cmp-db';

const QUERY_KEY_BY_INVOICE_TYPE = {
  med: 'select_final_results_med',
};

/**
 * Parse a SQL SELECT file and extract the output column aliases.
 */
function parseSqlColumns(sqlContent) {
  // Strip SQL comments to avoid false matches while scanning keywords.
  const cleaned = sqlContent
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--[^\n]*/g, '');

  const isWordChar = (char) => /[A-Za-z0-9_$#]/.test(char || '');

  const events = [];
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  // Find top-level SELECT/FROM tokens (ignoring nested queries and string literals).
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    const next = cleaned[i + 1];

    if (inSingleQuote) {
      if (char === "'" && next === "'") {
        i++;
        continue;
      }
      if (char === "'") inSingleQuote = false;
      continue;
    }

    if (inDoubleQuote) {
      if (char === '"' && next === '"') {
        i++;
        continue;
      }
      if (char === '"') inDoubleQuote = false;
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      continue;
    }

    if (char === '(') {
      depth++;
      continue;
    }

    if (char === ')') {
      if (depth > 0) depth--;
      continue;
    }

    if (depth === 0) {
      const selectCandidate = cleaned.slice(i, i + 6);
      if (
        /^select$/i.test(selectCandidate)
        && !isWordChar(cleaned[i - 1])
        && !isWordChar(cleaned[i + 6])
      ) {
        events.push({ type: 'SELECT', index: i });
        i += 5;
        continue;
      }

      const fromCandidate = cleaned.slice(i, i + 4);
      if (
        /^from$/i.test(fromCandidate)
        && !isWordChar(cleaned[i - 1])
        && !isWordChar(cleaned[i + 4])
      ) {
        events.push({ type: 'FROM', index: i });
        i += 3;
      }
    }
  }

  let selectStart = -1;
  let fromStart = -1;

  // Keep the last valid top-level SELECT ... FROM pair.
  for (const event of events) {
    if (event.type === 'SELECT') {
      selectStart = event.index;
      fromStart = -1;
      continue;
    }

    if (event.type === 'FROM' && selectStart !== -1 && fromStart === -1) {
      fromStart = event.index;
    }
  }

  if (selectStart === -1 || fromStart === -1 || fromStart <= selectStart) {
    return [];
  }

  const selectClause = cleaned.slice(selectStart + 6, fromStart).trim();
  if (!selectClause) return [];

  // Split by commas at top level (not inside parentheses or string literals).
  const expressions = [];
  let current = '';
  depth = 0;
  inSingleQuote = false;
  inDoubleQuote = false;

  for (let i = 0; i < selectClause.length; i++) {
    const char = selectClause[i];
    const next = selectClause[i + 1];

    if (inSingleQuote) {
      current += char;
      if (char === "'" && next === "'") {
        current += next;
        i++;
        continue;
      }
      if (char === "'") inSingleQuote = false;
      continue;
    }

    if (inDoubleQuote) {
      current += char;
      if (char === '"' && next === '"') {
        current += next;
        i++;
        continue;
      }
      if (char === '"') inDoubleQuote = false;
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      current += char;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      current += char;
      continue;
    }

    if (char === '(') {
      depth++;
      current += char;
      continue;
    }

    if (char === ')') {
      if (depth > 0) depth--;
      current += char;
      continue;
    }

    if (char === ',' && depth === 0) {
      if (current.trim()) expressions.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) expressions.push(current.trim());

  return expressions
    .map((expr) => {
      // Explicit alias, with or without quoted identifiers.
      const explicitAlias = expr.match(/\bAS\s+(?:"([^"]+)"|([A-Za-z_][\w$#]*))\s*$/i);
      if (explicitAlias) return explicitAlias[1] || explicitAlias[2];

      // Implicit alias (e.g. "CASE ... END alias" or "column_name").
      const quotedAlias = expr.match(/"([^"]+)"\s*$/);
      if (quotedAlias) return quotedAlias[1];

      const bareAlias = expr.match(/([A-Za-z_][\w$#]*)\s*$/);
      return bareAlias ? bareAlias[1] : null;
    })
    .filter(Boolean);
}

/**
 * Read the SQL content for the given invoice type (DB-first, file-fallback)
 * and return the list of columns.
 */
export async function getSqlColumnsForInvoiceType(invoiceType) {
  const queryKey = QUERY_KEY_BY_INVOICE_TYPE[invoiceType];
  if (!queryKey) return [];

  try {
    const { content } = await getQueryContent(queryKey);
    if (!content) return [];
    return parseSqlColumns(content);
  } catch {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'getSqlColumnsForInvoiceType - medicare',
        detail: { invoiceType, error: 'Failed to load SQL query' },
      },
    }));
    return [];
  }
}

/**
 * Get the saved config (or null if none exists).
 */
export async function getMedicareCompareResultConfig() {
  const query = { type: documentType };
  return await selectDocumentExt(query, validateBasicMulti, null, TEAM_DB);
}

/**
 * Save (upsert) the config document.
 */
export async function saveMedicareCompareResultConfig(config) {
  const { nuid } = await getServerSession();
  const { _id, ...configWithoutId } = config;
  configWithoutId.type = documentType;
  configWithoutId.id = configWithoutId.id || uuidv4();
  configWithoutId.updatedBy = nuid;

  const query = { type: documentType };
  if (configWithoutId.id) {
    query.id = configWithoutId.id;
  }

  return await upsertDocument(configWithoutId, query, validateBasicMulti, TEAM_DB);
}
