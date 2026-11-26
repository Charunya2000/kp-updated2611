import { NextResponse } from 'next/server';
import { createUnauthorizedResponse, validateApiKey } from '../../utils/apiKeyAuth';
import { chatCompletionFromAPI } from '@/app/services/chatCompletionService2';

/* 
request body: 
{ 
  messages: array of { role: 'user' | 'assistant' | 'system', content: string },
  nuid: string,
  teamName: string,
  assistantName: string,
  event?: string (optional, for statistics correlation),
  sessionId?: string (optional, for statistics correlation),
  model?: string, (optional, defaults to gpt-4o-aisvc (gpt5.1 is the actual model), only supports this model)
  temperature?: number, (optional, defaults to 0.7)
  max_tokens?: number, (optional, defaults to 4000)
}
*/

const supportedModels = ['gpt-4o-aisvc'];

function formatCreatedDate(created) {
  if (!created) {
    return null;
  }

  // Azure returns unix epoch seconds for "created".
  if (typeof created === 'number') {
    return new Date(created * 1000).toISOString();
  }

  return created;
}

function normalizeCompletion(completion, context = {}) {
  if (!completion || typeof completion !== 'object') {
    return completion;
  }

  const firstChoiceMessage = completion.choices?.[0]?.message;
  const finalResult = completion.final_result ?? firstChoiceMessage?.content ?? null;
  const prompt = completion.prompt ?? context.messages ?? [];

  return {
    ...completion,
    final_result: finalResult,
    role: completion.role ?? firstChoiceMessage?.role ?? 'assistant',
    prompt,
    user_id: completion.user_id ?? context.nuid ?? null,
    app_id: completion.app_id ?? context.appId ?? null,
    agent_id: completion.agent_id ?? context.agentId ?? null,
    session_id: completion.session_id ?? context.sessionId ?? null,
    created_date: completion.created_date ?? formatCreatedDate(completion.created),
    event: completion.event ?? context.event ?? null
  };
}

export async function POST(request) {
  let clientName = "HPAIS";

  try {
    const validKey = process.env['STATISTICS_LOGGING_API_KEY'];
    if (!validateApiKey(request, validKey)) {
      return createUnauthorizedResponse();
    }

    const body = await request.json();

    // Validate prompt
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0 || !body.nuid || !body.teamName || !body.assistantName) {
      const missingProperties = [];

      if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
        missingProperties.push('messages');
      }
      if (!body.nuid) {
        missingProperties.push('nuid');
      }
      if (!body.teamName) {
        missingProperties.push('teamName');
      }
      if (!body.assistantName) {
        missingProperties.push('assistantName')
      }

      return NextResponse.json({ error: 'Invalid Request', message: `Missing required fields: ${missingProperties.join(', ')}` }, { status: 400 });
    }

    if (body.model && !supportedModels.includes(body.model)) {
      return NextResponse.json({ error: 'Invalid Request', message: `Invalid field: 'model'. Must be one of: [${supportedModels.join(', ')}]` }, { status: 400 });
    }

    const requiredParams = {
      messages: body.messages,
      model: 'gpt-4o-aisvc', // nexus os only supports this model for now
      temperature: body.temperature || 0.7,
      max_tokens: body.max_tokens || 4000,
      nuid: body.nuid,
      teamName: body.teamName,
      assistantName: body.assistantName
    };

    const optionalParams = {};
    body.event ? (optionalParams.event = body.event) : null;
    body.sessionId ? (optionalParams.sessionId = body.sessionId) : null;

    // call completions client
    const completion = await chatCompletionFromAPI({
      ...requiredParams,
      ...optionalParams
    });

    const normalizedCompletion = normalizeCompletion(completion, {
      messages: body.messages,
      nuid: body.nuid,
      sessionId: body.sessionId,
      agentId: `${body.teamName}:${body.assistantName}`,
      appId: 'APP7232',
      event: body.event
    });

    const { messages, ...logData } = body;
    console.log(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'POST: /nexus/completions', detail: { logData } } }));

    return NextResponse.json({ completion: normalizedCompletion });
  } catch (error) {
    console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'POST: /nexus/completions', detail: { error: error.message, client: clientName } } }));
    return NextResponse.json({ error: 'Failed to create chat completion' }, { status: 500 });
  }
}