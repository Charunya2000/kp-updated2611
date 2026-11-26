import { NextResponse } from 'next/server';
import oracledb from 'oracledb';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';
import { getOracleConnection } from '@/app/services/oracleService';
import { DATABASE_TO_ACCOUNT } from '@/app/medicare-cmp/invoice-compare/config/targetDatabasesServer';
import { TARGET_DATABASES } from '@/app/medicare-cmp/invoice-compare/config/targetDatabases';
import { QUERY_REGISTRY } from '@/app/services/medicareQueryService';

export const POST = withTeamPermissionGuard(PERMISSIONS.MEDICARE_QUERY_CONFIG_MANAGE)(postHandler);

/** Maximum rows returned for SELECT-style queries. */
const MAX_PREVIEW_ROWS = 200;

/**
 * Validate that the SQL is one of the two allowed forms:
 *  1. A SELECT … FROM COMPARE_OWNER.* query
 *  2. CREATE OR REPLACE PROCEDURE COMPARE_OWNER.MEDICARE_CMP_RUN_BATCH 
 *
 * Returns null if valid, or an error message string if rejected.
 */
function validateSqlAllowlist(sql) {
  const stripped = sql.replace(/^--[^\n]*\n?/gm, '').trim();

  // Allow the one permitted stored procedure
  if (/^CREATE\s+(OR\s+REPLACE\s+)?PROCEDURE\s+COMPARE_OWNER\.MEDICARE_CMP_RUN_BATCH\b/i.test(stripped)) {
    return null;
  }

  // Block any other DDL / DML (CREATE, DROP, ALTER, INSERT, UPDATE, DELETE, MERGE, TRUNCATE, GRANT, etc.)
  // But allow CTEs (WITH ... AS ...) that precede SELECT statements.
  if (/^(CREATE|DROP|ALTER|INSERT|UPDATE|DELETE|MERGE|TRUNCATE|GRANT|REVOKE|EXEC|EXECUTE|BEGIN|DECLARE)\b/i.test(stripped)) {
    return 'Only SELECT queries from COMPARE_OWNER tables or CREATE OR REPLACE PROCEDURE COMPARE_OWNER.MEDICARE_CMP_RUN_BATCH are allowed.';
  }

  // Must be a SELECT statement, optionally preceded by CTEs (WITH clause).
  // Pattern: optional WITH ... AS ... followed by SELECT
  if (!/^(\s*WITH\s+.+?\s+AS\s*\([\s\S]*?\)\s*)*SELECT\b/i.test(stripped)) {
    return 'Only SELECT queries (with or without CTEs) from COMPARE_OWNER tables or CREATE OR REPLACE PROCEDURE COMPARE_OWNER.MEDICARE_CMP_RUN_BATCH  are allowed.';
  }

  // Extract CTE names from WITH clause so we can distinguish them from actual tables.
  const cteNames = new Set();
  const ctePattern = /(?:WITH|,)\s+(\w+)\s+AS\s*\(/gi;
  let cteMatch;
  while ((cteMatch = ctePattern.exec(stripped)) !== null) {
    cteNames.add(cteMatch[1].toUpperCase());
  }

  // Every FROM / JOIN table reference must be in the COMPARE_OWNER schema.
  // Extract all object references after FROM and JOIN keywords.
  // Strip string literals and single-line comments first.
  const noStrings = stripped.replace(/'[^']*'/g, "''");
  const tableRefPattern = /\b(?:FROM|JOIN)\s+([A-Z0-9_]+(?:\.[A-Z0-9_]+)?)/gi;
  let match;
  while ((match = tableRefPattern.exec(noStrings)) !== null) {
    const ref = match[1].toUpperCase();
    // Skip CTE result names (they are allowed)
    if (cteNames.has(ref)) {
      continue;
    }
    // Must be schema-qualified as COMPARE_OWNER.<table>
    if (!ref.startsWith('COMPARE_OWNER.')) {
      return `All tables must be in the COMPARE_OWNER schema. Found: ${match[1]}`;
    }
  }

  return null;
}

/**
 * Detect whether the SQL text is a PL/SQL DDL block (CREATE OR REPLACE
 * PROCEDURE / FUNCTION / PACKAGE / TRIGGER) vs. a plain SELECT query.
 */
function isPlSqlDdl(sql) {
  const trimmed = sql.replace(/^--[^\n]*\n?/gm, '').trim();
  return /^CREATE\s+(OR\s+REPLACE\s+)?(PROCEDURE|FUNCTION|PACKAGE|TRIGGER)\b/i.test(trimmed);
}

/**
 * Extract the schema-qualified object name and type from a CREATE OR REPLACE
 * statement so we can query USER_ERRORS / ALL_ERRORS for compilation results.
 *
 * Returns { owner, name, type } or null.
 */
function parseDdlObjectInfo(sql) {
  const trimmed = sql.replace(/^--[^\n]*\n?/gm, '').trim();
  const m = trimmed.match(
    /^CREATE\s+(?:OR\s+REPLACE\s+)?(PROCEDURE|FUNCTION|PACKAGE(?:\s+BODY)?|TRIGGER)\s+(?:(\w+)\.)?(\w+)/i,
  );
  if (!m) return null;
  return {
    type: m[1].toUpperCase().replace(/\s+/g, ' '),
    owner: m[2] ? m[2].toUpperCase() : null,
    name: m[3].toUpperCase(),
  };
}

/**
 * Compile a PL/SQL object and return the compiler output (errors or success).
 */
async function compilePlSql(connection, sql) {
  const objectInfo = parseDdlObjectInfo(sql);

  // Execute the DDL – this compiles the object.
  await connection.execute(sql);

  if (!objectInfo) {
    return { success: true, message: 'Statement executed successfully.' };
  }

  // Check ALL_ERRORS for the compiled object.
  const errQuery = objectInfo.owner
    ? `SELECT LINE, POSITION, TEXT FROM ALL_ERRORS WHERE OWNER = :owner AND NAME = :name AND TYPE = :type ORDER BY SEQUENCE`
    : `SELECT LINE, POSITION, TEXT FROM USER_ERRORS WHERE NAME = :name AND TYPE = :type ORDER BY SEQUENCE`;
  const binds = objectInfo.owner
    ? { owner: objectInfo.owner, name: objectInfo.name, type: objectInfo.type }
    : { name: objectInfo.name, type: objectInfo.type };

  const errResult = await connection.execute(errQuery, binds, {
    outFormat: oracledb.OUT_FORMAT_OBJECT,
    maxRows: 500,
  });

  if (errResult.rows && errResult.rows.length > 0) {
    const lines = errResult.rows.map(
      (r) => `${String(r.LINE)}/${String(r.POSITION).padStart(1)}    ${r.TEXT?.trim()}`,
    );
    return {
      success: false,
      message: [
        'LINE/COL  ERROR',
        '--------- -------------------------------------------------------------',
        ...lines,
        `Errors: check compiler log`,
      ].join('\n'),
    };
  }

  const label = `${objectInfo.type} ${objectInfo.owner ? objectInfo.owner + '.' : ''}${objectInfo.name}`;
  return { success: true, message: `${label} compiled` };
}

/**
 * Execute a SELECT query and return a limited preview of the result rows.
 * User-supplied bindParams override the defaults (NULL).
 */
async function executeSelect(connection, sql, userBinds = {}) {
  // Detect bind variables in the SQL (e.g.  :runId, :batchNbr, :BATCH_NUMBER)
  const bindMatches = [...new Set(sql.match(/:\w+/g) || [])];
  const binds = {};
  for (const b of bindMatches) {
    const name = b.slice(1);
    // Use the user-supplied value when provided (even if it's the string "0").
    // Coerce numeric-looking strings to numbers so Oracle bind types match.
    if (name in userBinds && userBinds[name] !== '') {
      const raw = userBinds[name];
      binds[name] = /^\d+$/.test(raw) ? Number(raw) : raw;
    } else {
      binds[name] = null;
    }
  }

  const result = await connection.execute(sql, binds, {
    outFormat: oracledb.OUT_FORMAT_OBJECT,
    maxRows: MAX_PREVIEW_ROWS + 1,
  });

  const truncated = result.rows.length > MAX_PREVIEW_ROWS;
  const rows = truncated ? result.rows.slice(0, MAX_PREVIEW_ROWS) : result.rows;
  const columns = result.metaData?.map((m) => m.name) || [];

  return {
    success: true,
    message: truncated
      ? `Query executed successfully. Showing first ${MAX_PREVIEW_ROWS} of ${MAX_PREVIEW_ROWS}+ rows.`
      : `Query executed successfully. ${rows.length} row(s) returned.`,
    columns,
    rows,
  };
}

async function postHandler(req) {
  let connection;
  try {
    const body = await req.json();
    const { sql, targetDatabase, queryKey, bindParams } = body;

    if (!queryKey || !QUERY_REGISTRY[queryKey]) {
      return NextResponse.json(
        { error: `Invalid queryKey. Must be one of: ${Object.keys(QUERY_REGISTRY).join(', ')}` },
        { status: 400 },
      );
    }

    if (typeof sql !== 'string' || sql.trim().length === 0) {
      return NextResponse.json(
        { error: 'sql is required and must be a non-empty string.' },
        { status: 400 },
      );
    }

    if (!TARGET_DATABASES.includes(targetDatabase)) {
      return NextResponse.json(
        { error: `targetDatabase must be one of: ${TARGET_DATABASES.join(', ')}` },
        { status: 400 },
      );
    }

    const validationError = validateSqlAllowlist(sql);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const account = DATABASE_TO_ACCOUNT[targetDatabase];
    connection = await getOracleConnection(account);
    if (!connection) {
      return NextResponse.json(
        { error: 'Unable to connect to the Oracle database.' },
        { status: 503 },
      );
    }

    let result;
    if (isPlSqlDdl(sql)) {
      result = await compilePlSql(connection, sql);
    } else {
      result = await executeSelect(connection, sql, bindParams);
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    // Surface the Oracle error message directly — this is the SQL Developer
    // experience the user expects.
    const oraMessage = error.message || String(error);

    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'POST: MedicareQueryTest',
        detail: { error: oraMessage },
      },
    }));

    return NextResponse.json(
      { success: false, message: oraMessage },
      { status: 200 },
    );
  } finally {
    if (connection) {
      try { await connection.close(); } catch { /* ignore */ }
    }
  }
}
