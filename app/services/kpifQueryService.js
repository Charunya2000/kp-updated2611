import { selectDocumentExt } from '@db/selectDocument';
import { upsertDocument } from '@db/updateDocument';
import { validateBasicMulti } from './validation';
import { v4 as uuidv4 } from 'uuid';
import { getServerSession } from '@utils/getSession';
import fs from 'fs';
import path from 'path';

const documentType = 'KpifQuery';
const TEAM_DB = 'team-membership-admin-db';

/**
 * Registry of supported queries with their file paths relative to the queries
 * directory and a human-readable label.
 */
export const QUERY_REGISTRY = {
  'noncon-ca-sproc': {
    label: 'XML DB Comparison Stored Procedure',
    filePath: 'stored-procedures/noncon-ca-sproc.sql',
  },
  'select_final_results_ca': {
    label: 'Final Results – CA',
    filePath: 'select_final_results_ca.sql',
  },
  'select_final_results_moc': {
    label: 'Final Results – MOC',
    filePath: 'select_final_results_moc.sql',
  },
  'select_final_results_ipb_count_ca': {
    label: 'IPB Count – CA',
    filePath: 'select_final_results_ipb_count_ca.sql',
  },
  'select_final_results_ipb_count_moc': {
    label: 'IPB Count – MOC',
    filePath: 'select_final_results_ipb_count_moc.sql',
  },
};

const QUERIES_DIR = path.join(
  process.cwd(),
  'app/membership-admin/kpif-compare/queries',
);

/**
 * Read the SQL content for a query key from the filesystem.
 */
function readQueryFromFile(queryKey) {
  const entry = QUERY_REGISTRY[queryKey];
  if (!entry) return null;

  const fullPath = path.join(QUERIES_DIR, entry.filePath);
  try {
    return fs.readFileSync(fullPath, 'utf8');
  } catch {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'readQueryFromFile',
        detail: { queryKey, error: `Failed to read SQL file: ${entry.filePath}` },
      },
    }));
    return null;
  }
}

/**
 * Read the SQL content for a query key from MongoDB.
 * Returns null if no document exists.
 */
async function readQueryFromDb(queryKey) {
  try {
    const query = { type: documentType, queryKey };
    const doc = await selectDocumentExt(query, validateBasicMulti, null, TEAM_DB);
    return doc?.content ?? null;
  } catch {
    return null;
  }
}

/**
 * Get the SQL content for a query key.
 * Tries MongoDB first, falls back to the file system.
 */
export async function getQueryContent(queryKey, source = 'db') {

  if (source === 'db') {
    const dbContent = await readQueryFromDb(queryKey);
    if (dbContent !== null) {
      return { content: dbContent, source: 'database' };
    }
  }

  // use file as fallback if there is no db, or it was not explicitly requested from db
  const fileContent = readQueryFromFile(queryKey);
  if (fileContent !== null) {
    return { content: fileContent, source: 'file' };
  }

  return { content: null, source: null };
}

/**
 * Save (upsert) the SQL content for a query key to MongoDB.
 */
export async function saveQueryContent(queryKey, content) {
  if (!QUERY_REGISTRY[queryKey]) {
    throw new Error(`Unknown query key: ${queryKey}`);
  }

  const { nuid } = await getServerSession();

  const document = {
    type: documentType,
    queryKey,
    content,
    id: uuidv4(),
    updatedBy: nuid,
  };

  const filter = { type: documentType, queryKey };
  return await upsertDocument(document, filter, validateBasicMulti, TEAM_DB);
}

/**
 * Read SQL content for a given query key with DB-first, file-fallback.
 * Returns the raw SQL string or null.
 * This is the function that should be used by all runtime consumers.
 */
export async function resolveQuery(queryKey) {
  const { content } = await getQueryContent(queryKey);
  return content;
}
