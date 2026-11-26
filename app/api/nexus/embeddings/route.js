import { vectorize } from '@/app/services/nexusos/embeddingClient';
import { NextResponse } from 'next/server';
import { createUnauthorizedResponse, validateApiKey } from '../../utils/apiKeyAuth';
import { recordEmbeddingCreatedViaAPI } from '@/app/services/statisticsService';

/* 
request body: 
{ 
  nuid: string,
  teamName: string,
  assistantName: string,
  content: string
  model?: string
  sessionId?: string
  event?: string
}
*/


export async function POST(request) {
  try {
    const validKey = process.env['STATISTICS_LOGGING_API_KEY'];
    if (!validateApiKey(request, validKey)) {
      return createUnauthorizedResponse();
    }

    //nuid, content, model
    const body = await request.json();

    // Validate prompt
    if (!body.content || !body.nuid || !body.teamName || !body.assistantName) {
      const missingProperties = [];

      if (!body.content) {
        missingProperties.push('content');
      }
      if (!body.nuid) {
        missingProperties.push('nuid');
      }
      if (!body.teamName) {
        missingProperties.push('teamName');
      }
      if (!body.assistantName) {
        missingProperties.push('assistantName');
      }

      return NextResponse.json({ error: 'Invalid Request', message: `Missing required fields: ${missingProperties.join(', ')}` }, { status: 400 });
    }

    const requiredParams = {
      content: body.content,
      nuid: body.nuid
    };

    const optionalPrams = {
      sessionId: body.sessionId,
      event: body.event,
      model: body.model || 'text-embedding-ada-002-APP-7232', // nexus os only supports this model for now
    };

    // call completions client
    const embeddingResponse = await vectorize({ ...requiredParams, ...optionalPrams });

    recordEmbeddingCreatedViaAPI(
      body.nuid,
      new Date(),
      body.teamName,
      body.assistantName
    );

    console.log(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'POST: /nexus/embeddings', detail: { nuid: body.nuid, teamName: body.teamName, assistantName: body.assistantName } } }));

    return NextResponse.json({ embedding: embeddingResponse });
  } catch (error) {
    console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'POST: /nexus/embeddings', detail: { error: error.message } } }));
    return NextResponse.json({ error: 'Failed to create embedding' }, { status: 500 });
  }
}