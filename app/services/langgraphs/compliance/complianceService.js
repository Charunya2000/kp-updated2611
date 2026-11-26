'use server';

import { Annotation, StateGraph, START, END } from "../langgraph-light.js";
import { loadConfigNode } from './nodes/loadConfigNode.js';
import { vectorizePromptNode } from './nodes/vectorizePromptNode.js';
import { parseUserIntentNode } from './nodes/userIntentNode.js';
import { getCompletionsClient } from "@/app/services/chatCompletionService3.js";
import { formatResponseNode } from './nodes/formatResponseNode.js';
import { AzureOpenAI } from "openai";
import {
  buildLobReferenceMarkdown,
  buildUnsupportedLobMessage,
  inferLobFromText,
  isUnsupportedLobMessage,
  normalizeSupportedLob,
  resolveInteractionIntent,
  stripSharePointGuidance
} from './intentInference.js';

function buildLobStarterFallback(lob, userPrompt) {
  const prompt = String(userPrompt || '').trim();
  if (lob === 'Medicare') {
    return [
      `Your question appears Medicare-related. ${prompt ? `For "${prompt}", ` : ''}a practical first step is to review eligibility and enrollment timing (Initial Enrollment Period, Special Enrollment Period), then compare plan options and out-of-pocket protections (Part D, Medicare Advantage, and Extra Help if income-qualified).`,
      'If you want, I can break this down by eligibility age/status, likely cost drivers (premiums, deductibles, copays), and the most relevant Medicare policy requirements.'
    ].join('\n\n');
  }

  if (lob === 'Medicaid') {
    return [
      `Your question appears Medicaid-related. ${prompt ? `For "${prompt}", ` : ''}the first step is usually to validate income/eligibility criteria and state-specific benefit rules, then map available assistance pathways and appeal options where coverage is denied.`,
      'I can help you narrow this to eligibility pathways, covered services, and practical next steps for cost relief.'
    ].join('\n\n');
  }

  if (lob === 'CHIP') {
    return [
      `Your question appears CHIP-related. ${prompt ? `For "${prompt}", ` : ''}a strong starting point is to review child eligibility thresholds, premium obligations (if any), and covered pediatric benefit categories.`,
      'I can walk through enrollment, cost-sharing expectations, and policy provisions that drive member affordability.'
    ].join('\n\n');
  }

  return `I can help with ${lob} compliance questions. I can also provide a quick policy-oriented starter answer and then drill into specific eligibility, coverage, and cost drivers.`;
}

async function generateLobStarterResponse(completionsClient, lob, userPrompt) {
  try {
    const completion = await completionsClient.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.2,
      max_completion_tokens: 380,
      messages: [
        {
          role: 'system',
          content: [
            'You are a healthcare compliance assistant.',
            'Provide a brief, practical, professional starter answer based on general domain knowledge.',
            'Do not mention SharePoint, file uploads, or document links.',
            'Do not claim access to documents unless explicitly provided.',
            'Keep response to 2 short paragraphs with concrete next-step guidance.'
          ].join(' ')
        },
        {
          role: 'user',
          content: `Line of business: ${lob}. User question: ${String(userPrompt || '').trim()}`
        }
      ]
    });

    return String(completion?.choices?.[0]?.message?.content || '').trim();
  } catch {
    return '';
  }
}

// TODO: Put embeddings client in a separate source file.
let embeddingsClient = null;
function getEmbeddingsClient() {
  if (!embeddingsClient) {
    const envName = process.env['envName'];
    const embeddingsEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.embeddingsEndpoint`];
    const embeddingsAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.openai.api.key`];
    const embeddingsDeployment = "gpt-4o-aisvc";
    const embeddingsDeploymentAPIiVersion = "2023-05-15";
    embeddingsClient = new AzureOpenAI({
      apiVersion: embeddingsDeploymentAPIiVersion,
      endpoint: embeddingsEndpoint,
      apiKey: embeddingsAPIKey,
      deployment: embeddingsDeployment
    });
  }
  return embeddingsClient;
}

// Define the state with just the attributes we use, all typed as Annotation
const StateAnnotation = Annotation.Root({
  userPrompt: Annotation,
  sources: Annotation,
  configDocuments: Annotation,
  promptEmbedding: Annotation,
  completionsClient: Annotation,
  embeddingsClient: Annotation,
  intentSchema: Annotation,
  parsedIntent: Annotation,
  intentResponse: Annotation,
  suggestedPrompts: Annotation,
  formattedResponse: Annotation
});

// Build the graph with simplified state
const graphBuilder = new StateGraph(StateAnnotation);

// Add all nodes to the graph
graphBuilder
  .addNode("loadConfigNode", loadConfigNode)
  .addNode("vectorizePromptNode", vectorizePromptNode)
  .addNode("parseUserIntentNode", parseUserIntentNode)
  .addNode("formatResponseNode", formatResponseNode);

// Define the edges with conditions
graphBuilder
  .addEdge(START, "loadConfigNode")
  .addEdge("loadConfigNode", "vectorizePromptNode")
  .addEdge("vectorizePromptNode", "parseUserIntentNode")
  .addEdge("parseUserIntentNode", "formatResponseNode")
  .addEdge("formatResponseNode", END);

// Compile the graph
const graph = graphBuilder.compile();

// Streaming compliance
export async function complianceGraph(nuid, { sources, chatInteraction, lobIntent, interactionIntent }) {
  try {
    const completionsClient = await getCompletionsClient();
    // Initialize state with user message and metadata
    const initialState = {
      completionsClient,
      embeddingsClient: getEmbeddingsClient(),
      userPrompt: chatInteraction.prompt,
      sources
    };

    // Invoke the graph
    const { formattedResponse, parsedIntent, suggestedPrompts } = await graph.invoke(initialState);

    const userPrompt = chatInteraction?.prompt || '';
    const selectedLob = normalizeSupportedLob(lobIntent);
    const normalizedLob = selectedLob || normalizeSupportedLob(parsedIntent?.lob) || inferLobFromText(userPrompt);
    const sanitizedResponse = stripSharePointGuidance(formattedResponse);

    let responseContent = '';
    if (normalizedLob) {
      // If LOB was resolved, never keep the generic unsupported fallback message.
      if (!sanitizedResponse || isUnsupportedLobMessage(sanitizedResponse)) {
        const generatedStarter = await generateLobStarterResponse(completionsClient, normalizedLob, userPrompt);
        responseContent = stripSharePointGuidance(generatedStarter) || buildLobStarterFallback(normalizedLob, userPrompt);
      } else {
        responseContent = sanitizedResponse;
      }
    } else {
      responseContent = buildUnsupportedLobMessage();
    }

    if (normalizedLob) {
      const referenceLine = buildLobReferenceMarkdown(normalizedLob);
      const hasExactReference = referenceLine
        ? responseContent.includes(referenceLine)
        : false;
      if (referenceLine && !hasExactReference) {
        responseContent = `${responseContent}\n\n${referenceLine}`;
      }
    }

    const effectiveInteraction = normalizedLob
      ? resolveInteractionIntent({
        selectedInteraction: interactionIntent,
        parsedInteraction: parsedIntent?.interaction,
        userPrompt,
      })
      : null;

    const result = {
      responseContent,
      lob: normalizedLob || null,
      interaction: effectiveInteraction,
      suggestedPrompts
    };

    return result;
  } catch (error) {
    console.error('Error in complianceGraph:', error);
  }
}
