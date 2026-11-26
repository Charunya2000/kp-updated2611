'use server';

import { selectDocumentsExt, selectDocumentExt } from '@db/selectDocument';
import { upsertDocument } from '@db/updateDocument';
import { validateBasicMulti, validateBasicSingle } from './validation';
import { v4 as uuidv4 } from 'uuid';
import { getServerSession } from '@utils/getSession';
import { getQueryContent } from './kpifQueryService';

const documentType = 'KpifCompareResultConfig';
const TEAM_DB = 'team-membership-admin-db';

const QUERY_KEY_BY_INVOICE_TYPE = {
  ca: 'select_final_results_ca',
  moc: 'select_final_results_moc',
};

/**
 * Parse a SQL SELECT file and extract the output column aliases.
 */
function parseSqlColumns(sqlContent) {
  // Remove single-line comments
  const cleaned = sqlContent.replace(/--[^\n]*/g, '');

  // Extract between SELECT and FROM (FROM must be at the start of a line)
  const selectMatch = cleaned.match(/SELECT\s+([\s\S]+?)\s+^FROM\s/im);
  if (!selectMatch) return [];

  const selectClause = selectMatch[1];

  // Split by commas at top level (not inside parentheses)
  const expressions = [];
  let depth = 0;
  let current = '';

  for (const char of selectClause) {
    if (char === '(') depth++;
    else if (char === ')') depth--;

    if (char === ',' && depth === 0) {
      expressions.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) expressions.push(current.trim());

  return expressions
    .map((expr) => {
      // Match the last AS keyword + identifier (handles quoting)
      const aliasMatch = expr.match(/\bAS\s+"?(\w+)"?\s*$/i);
      if (aliasMatch) return aliasMatch[1];
      // Standalone column reference
      const standaloneMatch = expr.match(/\b(\w+)\s*$/);
      return standaloneMatch ? standaloneMatch[1] : null;
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
        name: 'getSqlColumnsForInvoiceType',
        detail: { invoiceType, error: 'Failed to load SQL query' },
      },
    }));
    return [];
  }
}

/**
 * Get the saved config (or null if none exists).
 */
export async function getKpifCompareResultConfig() {
  const query = { type: documentType };
  return await selectDocumentExt(query, validateBasicMulti, null, TEAM_DB);
}

/**
 * Save (upsert) the config document.
 */
export async function saveKpifCompareResultConfig(config) {
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
