import { NextResponse } from 'next/server';
import { validateApiKey, createUnauthorizedResponse } from '@/app/api/utils/apiKeyAuth';
import { selectSystemPrompt } from '@services/systemPromptService';
import { selectPersona } from '@services/personaService';
import { generateChatCompletion } from '@services/nexusos/completionsClient';

const teamName = 'customer-and-contracts';
const assistantName = 'free-text-to-json';

export async function POST(request) {
  try {
    const validKey = process.env['CAC_API_KEY'];
    if (!validateApiKey(request, validKey)) {
      return createUnauthorizedResponse();
    }

    const body = await request.json();
    const { systemPromptId, personaPromptId, prompt, sessionId, temperature = 0.4, maxTokens = 4000, modelName = 'gpt-4o-aisvc' } = body;

    if (!systemPromptId || !prompt || !sessionId) {
      return NextResponse.json({ error: `Missing required parameter. Your request must include systemPromptId, prompt, and sessionId` }, { status: 400 });
    }

    // load system prompt from database or configuration based on systemPromptId
    const query = {
      assistantName: assistantName,
      id: systemPromptId
    };
    const systemPrompt = await selectSystemPrompt(query, teamName);

    if (!systemPrompt) {
      return NextResponse.json({ error: `System prompt with id "${systemPromptId}" not found` }, { status: 404 });
    }


    let persona;
    if (personaPromptId) {
      const personaQuery = {
        assistantName: assistantName,
        id: personaPromptId,
        enabled: true
      };

      persona = await selectPersona(personaQuery, teamName);

      if (!persona) {
        return NextResponse.json({ error: `Persona with id "${personaPromptId}" not found or not enabled` }, { status: 404 });
      }
    }

    const message = [];

    message.push({ role: 'system', content: systemPrompt?.prompt });
    if (persona?.prompt) {
      message.push({ role: 'system', content: persona.prompt });
    }
    message.push({ role: 'user', content: prompt });

    // submit prompt to nexusOS with chatCompletionsService and get the response
    const completion = await generateChatCompletion({
      messages: message,
      model: modelName,
      temperature: temperature,
      max_tokens: maxTokens,
      user: `api_user_${teamName}`,
      event: `${assistantName}_completion_request`,
      sessionId: sessionId,
      teamName: teamName,
      assistantName: assistantName
    });

    const content = completion?.choices?.[0]?.message?.content;
    let aiResponse;
    try {
      aiResponse = JSON.parse(content);
    } catch {
      aiResponse = content;
    }
    return NextResponse.json({ aiResponse });
  } catch (error) {
    console.error('Error in CAC POST handler:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
