import { getSCTaskById } from '@/app/services/langgraphs/prodSupport/tools/getSCTaskById';

export const GET_SCTASK_BY_ID_TOOL_NAME = 'get_sctask_by_id';

export const getSCTaskByIdToolDefinition = {
  name: GET_SCTASK_BY_ID_TOOL_NAME,
  description: 'Look up a single SCTask in SM_DW for the KPMC Prod Sup Core assignment group by exact SCTask ID. Use this when the user references a specific ticket such as SCTASK12345678.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      scTaskId: {
        type: 'string',
        description: 'Exact SCTask identifier to retrieve, such as SCTASK12345678.'
      }
    },
    required: ['scTaskId']
  }
};

export async function callGetSCTaskByIdTool(args = {}) {
  const scTaskId = String(args.scTaskId ?? '').trim();

  if (!scTaskId) {
    throw new Error('scTaskId is required.');
  }

  const record = await getSCTaskById({ scTaskId });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          tool: GET_SCTASK_BY_ID_TOOL_NAME,
          scTaskId,
          found: Boolean(record),
          record
        }, null, 2)
      }
    ],
    structuredContent: {
      tool: GET_SCTASK_BY_ID_TOOL_NAME,
      scTaskId,
      found: Boolean(record),
      resultCount: record ? 1 : 0,
      record
    }
  };
}