import { getSCTasksByKeyword, SCTASK_SEARCHABLE_COLUMNS } from '@/app/services/langgraphs/prodSupport/tools/getSCTasksByKeyword';

export const GET_SCTASKS_BY_KEYWORD_TOOL_NAME = 'get_sctasks_by_keyword';

export const getSCTasksByKeywordToolDefinition = {
  name: GET_SCTASKS_BY_KEYWORD_TOOL_NAME,
  description: `Search the SM_DW dbo.SCTaskDetailHistory table for SCTasks owned by the KPMC Prod Sup Core assignment group. Use this tool when the user wants a focused list of tickets matching keywords. In most cases, match the keywords against the Description column. Never try to match keywords against the ScTaskIDSource column. This is a key column and should only be used for exact matches when the user references a specific ticket such as SCTASK12345678.`,
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      searchCriteria: {
        type: 'array',
        description: 'Each item targets one column with one or more keywords. The tool applies OR within a single item\'s keywords and AND across multiple items. In most cases, use the Description column.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            column: {
              type: 'string',
              enum: SCTASK_SEARCHABLE_COLUMNS,
              description: 'SM_DW column to search.'
            },
            keywords: {
              type: 'array',
              minItems: 1,
              items: { type: 'string' },
              description: 'Keywords to match against the selected column using SQL LIKE semantics.'
            }
          },
          required: ['column', 'keywords']
        },
        minItems: 1
      },
      scTaskExclusions: {
        type: 'array',
        description: 'SCTask IDs to exclude from the results. Use this to avoid returning the reference ticket when looking for similar tickets.',
        items: { type: 'string' },
        default: []
      },
      limit: {
        type: 'integer',
        description: 'Maximum number of records to return. Values above 10 are capped at 10.',
        minimum: 1,
        maximum: 10,
        default: 10
      }
    },
    required: ['searchCriteria']
  }
};

const normalizeToolArguments = (args = {}) => {
  const searchCriteria = Array.isArray(args.searchCriteria)
    ? args.searchCriteria
    : [];

  return {
    searchCriteria,
    columnKeywords: Array.isArray(args.columnKeywords) ? args.columnKeywords : [],
    scTaskExclusions: Array.isArray(args.scTaskExclusions) ? args.scTaskExclusions : [],
    limit: args.limit
  };
};

const buildInterpretedCriteria = ({ searchCriteria, columnKeywords, scTaskExclusions, limit }) => {
  const interpretedSearchCriteria = searchCriteria.length > 0
    ? searchCriteria
    : columnKeywords.flatMap((entry) => Object.entries(entry).map(([column, keywords]) => ({ column, keywords })));

  return {
    assignmentGroup: 'KPMC Prod Sup Core',
    searchCriteria: interpretedSearchCriteria,
    scTaskExclusions,
    requestedLimit: limit
  };
};

export async function callGetSCTasksByKeywordTool(args = {}) {
  const normalizedArgs = normalizeToolArguments(args);
  const interpretedInput = buildInterpretedCriteria(normalizedArgs);
  const records = await getSCTasksByKeyword(normalizedArgs);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          tool: GET_SCTASKS_BY_KEYWORD_TOOL_NAME,
          interpretedInput,
          resultCount: records.length,
          records
        }, null, 2)
      }
    ],
    structuredContent: {
      tool: GET_SCTASKS_BY_KEYWORD_TOOL_NAME,
      interpretedInput,
      resultCount: records.length,
      records
    }
  };
}