import sql from 'mssql';

import { getSNOWRecords } from '@/app/services/smdwSqlDatabaseService';

const DEFAULT_LIMIT = 10;
export const DEFAULT_ASSIGNMENT_GROUP = 'KPMC Prod Sup Core';
export const SCTASK_SELECT_FIELDS = [
  'ScTaskIDSource',
  'State',
  'AssignmentGroup',
  'AssignedToName',
  'OpenedAt',
  'RequestedForName',
  'OpenedByName',
  'Priority',
  'Description'
];
export const SCTASK_SEARCHABLE_COLUMNS = [
  'ScTaskIDSource',
  'State',
  'AssignmentGroup',
  'AssignedToName',
  'OpenedAt',
  'RequestedForName',
  'OpenedByName',
  'Priority',
  'Description'
];
const ALLOWED_SEARCH_COLUMNS = new Set(SCTASK_SEARCHABLE_COLUMNS);

const normalizeSearchCriteria = (searchCriteria) => {
  if (!Array.isArray(searchCriteria)) {
    return [];
  }

  return searchCriteria
    .map((criterion) => {
      if (!criterion || typeof criterion !== 'object' || Array.isArray(criterion)) {
        throw new Error('Each searchCriteria entry must be an object with column and keywords.');
      }

      return {
        [criterion.column]: criterion.keywords
      };
    })
    .filter((criterion) => Object.keys(criterion)[0]);
};

const normalizeColumnKeywords = (columnKeywords, searchCriteria) => {
  const sourceCriteria = Array.isArray(columnKeywords) && columnKeywords.length > 0
    ? columnKeywords
    : normalizeSearchCriteria(searchCriteria);

  if (!Array.isArray(sourceCriteria)) {
    throw new Error('columnKeywords must be an array of { column: [keywords] } objects.');
  }

  return sourceCriteria.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('Each columnKeywords entry must be an object.');
    }

    return Object.entries(entry).reduce((groups, [column, keywords]) => {
      if (!ALLOWED_SEARCH_COLUMNS.has(column)) {
        throw new Error(`Unsupported search column: ${column}`);
      }

      const normalizedKeywords = (Array.isArray(keywords) ? keywords : [keywords])
        .map((keyword) => String(keyword ?? '').trim())
        .filter(Boolean);

      if (normalizedKeywords.length > 0) {
        groups.push({ column, keywords: normalizedKeywords });
      }

      return groups;
    }, []);
  });
};

const buildKeywordWhereClauses = (keywordGroups, parameters) => {
  return keywordGroups.map(({ column, keywords }, groupIndex) => {
    const keywordClauses = keywords.map((keyword, keywordIndex) => {
      const parameterName = `keyword_${groupIndex}_${keywordIndex}`;
      parameters.push({ name: parameterName, type: sql.NVarChar, value: `%${keyword}%` });
      return `${column} LIKE @${parameterName}`;
    });

    return `(${keywordClauses.join(' OR ')})`;
  });
};

const buildExclusionClause = (scTaskExclusions, parameters) => {
  const normalizedExclusions = (Array.isArray(scTaskExclusions) ? scTaskExclusions : [])
    .map((scTaskId) => String(scTaskId ?? '').trim())
    .filter(Boolean);

  if (normalizedExclusions.length === 0) {
    return null;
  }

  const exclusionParameters = normalizedExclusions.map((scTaskId, index) => {
    const parameterName = `excludedTask_${index}`;
    parameters.push({ name: parameterName, type: sql.NVarChar, value: scTaskId });
    return `@${parameterName}`;
  });

  return `ScTaskIDSource NOT IN (${exclusionParameters.join(', ')})`;
};

export async function getSCTasksByKeyword({ columnKeywords = [], searchCriteria = [], scTaskExclusions = [], limit = DEFAULT_LIMIT } = {}) {
  const keywordGroups = normalizeColumnKeywords(columnKeywords, searchCriteria);

  if (keywordGroups.length === 0) {
    throw new Error('At least one keyword group is required.');
  }

  const normalizedLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, DEFAULT_LIMIT) : DEFAULT_LIMIT;
  const parameters = [
    { name: 'assignmentGroup', type: sql.NVarChar, value: DEFAULT_ASSIGNMENT_GROUP },
    { name: 'limit', type: sql.Int, value: normalizedLimit }
  ];
  const whereClauses = [
    'AssignmentGroup = @assignmentGroup',
    ...buildKeywordWhereClauses(keywordGroups, parameters)
  ];
  const exclusionClause = buildExclusionClause(scTaskExclusions, parameters);

  if (exclusionClause) {
    whereClauses.push(exclusionClause);
  }

  const query = `
		SELECT TOP (@limit)
      ${SCTASK_SELECT_FIELDS.join(', ')}
		FROM dbo.SCTaskDetailHistory
		WHERE ${whereClauses.join('\n      AND ')}
		ORDER BY OpenedAt DESC;
	`;

  return getSNOWRecords({
    query,
    parameters
  });
}


