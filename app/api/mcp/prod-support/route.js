import { NextResponse } from 'next/server';

import {
  callGetSCTasksByKeywordTool,
  GET_SCTASKS_BY_KEYWORD_TOOL_NAME,
  getSCTasksByKeywordToolDefinition
} from '@/app/services/langgraphs/prodSupport/tools/getSCTasksByKeywordMcpTool';
import {
  callGetSCTaskByIdTool,
  GET_SCTASK_BY_ID_TOOL_NAME,
  getSCTaskByIdToolDefinition
} from '@/app/services/langgraphs/prodSupport/tools/getSCTaskByIdMcpTool';

export const dynamic = 'force-dynamic';

const SERVER_INFO = {
  name: 'prod-support-mcp',
  version: '1.0.0'
};
const TOOL_DEFINITIONS = [getSCTaskByIdToolDefinition, getSCTasksByKeywordToolDefinition];
const TOOL_CALLERS = {
  [GET_SCTASK_BY_ID_TOOL_NAME]: callGetSCTaskByIdTool,
  [GET_SCTASKS_BY_KEYWORD_TOOL_NAME]: callGetSCTasksByKeywordTool
};

const jsonRpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });

const jsonRpcError = (id, code, message, data) => ({
  jsonrpc: '2.0',
  id: id ?? null,
  error: {
    code,
    message,
    ...(data !== undefined ? { data } : {})
  }
});

function validateSharedSecret(request) {
  const sharedSecret = process.env.MCP_SHARED_SECRET;

  if (!sharedSecret) {
    return null;
  }

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (token !== sharedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

async function handleJsonRpcRequest(body) {
  const id = body?.id;
  const method = body?.method;
  const params = body?.params || {};

  switch (method) {
    case 'initialize':
      return jsonRpcResult(id, {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: SERVER_INFO
      });
    case 'notifications/initialized':
      return id === undefined ? null : jsonRpcResult(id, {});
    case 'ping':
      return jsonRpcResult(id, {});
    case 'tools/list':
      return jsonRpcResult(id, {
        tools: TOOL_DEFINITIONS
      });
    case 'tools/call': {
      const toolName = params?.name;
      const toolCaller = TOOL_CALLERS[toolName];

      if (!toolCaller) {
        return jsonRpcError(id, -32601, `Unknown tool: ${params?.name || 'undefined'}`);
      }

      try {
        const result = await toolCaller(params.arguments || {});

        console.log(JSON.stringify({
          kpmsg: {
            id: 'AI_PORTAL_NOTEBOOK',
            name: 'callProdSupportMcpTool',
            detail: {
              toolName,
              resultCount: result?.structuredContent?.resultCount ?? 0
            }
          }
        }));

        return jsonRpcResult(id, result);
      } catch (error) {
        console.error(JSON.stringify({
          kpmsg: {
            id: 'AI_PORTAL_NOTEBOOK',
            name: 'callProdSupportMcpTool',
            detail: {
              toolName,
              error: error.message
            }
          }
        }));

        return jsonRpcError(id, -32602, error.message);
      }
    }
    default:
      return jsonRpcError(id, -32601, `Method not found: ${method || 'undefined'}`);
  }
}

export async function GET(request) {
  const unauthorizedResponse = validateSharedSecret(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  return NextResponse.json({
    server: SERVER_INFO,
    tools: Object.keys(TOOL_CALLERS),
    message: 'POST JSON-RPC requests to this endpoint to use the Prod Support MCP tool.'
  });
}

export async function POST(request) {
  const unauthorizedResponse = validateSharedSecret(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const body = await request.json();
    const responseBody = await handleJsonRpcRequest(body);

    if (responseBody === null) {
      return new NextResponse(null, { status: 202 });
    }

    return NextResponse.json(responseBody, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      jsonRpcError(null, -32700, 'Invalid JSON request body', error.message),
      { status: 400 }
    );
  }
}