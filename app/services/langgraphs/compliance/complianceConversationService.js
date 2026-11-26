'use server';

import { Annotation, StateGraph, START, END } from "../langgraph-light.js";
import { AzureOpenAI } from "openai";
import { SearchClient, AzureKeyCredential } from '@azure/search-documents';
import { loadConfigNode } from './nodes/loadConversationConfigNode.js';
import { parseUserIntentNode } from './nodes/userConversationIntentNode.js';
import { conversationSummarizeSearchResultsNode } from './nodes/conversationSummarizeSearchResultsNode.js';
import { conversationSearchNode } from './nodes/conversationSearchNode.js';
import { assistantResponseNode } from './nodes/assistantResponseNode.js';
import { formatResponseNode } from './nodes/formatConversationResponseNode.js';
import { vectorizePromptNode } from './nodes/vectorizePromptNode.js';
import { getCompletionsClient } from "@/app/services/chatCompletionService3.js";

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

// TODO: Put search index client in a separate source file.
let searchClients = {};

function getSearchClient(index) {
  if (!searchClients[index]) {
    const envName = process.env['envName'];
    const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
    const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.api.key`];
    searchClients[index] = new SearchClient(
      searchEndpoint,
      index,
      new AzureKeyCredential(searchAPIKey)
    );
  }
  return searchClients[index];
}

async function complianceConversationGraph(nuid, { geisingerConversation, sources, chatInteraction }) {

  // Define the state with all relevant attributes
  const StateAnnotation = Annotation.Root({
    geisingerConversation: Annotation,
    userPrompt: Annotation,
    sources: Annotation,
    configDocuments: Annotation,
    completionsClient: Annotation,
    embeddingsClient: Annotation,
    searchClient: Annotation,
    promptEmbedding: Annotation,
    intentSchema: Annotation,
    parsedIntent: Annotation,
    intentResponse: Annotation,
    searchResults: Annotation,
    topCognitiveResultId: Annotation,
    searchSummary: Annotation,
    conversationResponse: Annotation,
    suggestedPrompts: Annotation,
    formattedResponse: Annotation,
    errorMessage: Annotation
  });

  // Build the graph
  const graphBuilder = new StateGraph(StateAnnotation);

  graphBuilder
    .addNode("loadConfigNode", loadConfigNode)
    .addNode("vectorizePromptNode", vectorizePromptNode)
    .addNode("userConversationIntentNode", parseUserIntentNode)
    .addNode("conversationSearchNode", conversationSearchNode)
    .addNode("conversationSummarizeSearchResultsNode", conversationSummarizeSearchResultsNode)
    .addNode("assistantResponseNode", assistantResponseNode)
    .addNode("formatResponseNode", formatResponseNode);

  graphBuilder
    .addEdge(START, "loadConfigNode")
    .addEdge("loadConfigNode", "vectorizePromptNode")
    .addEdge("vectorizePromptNode", "userConversationIntentNode")
    .addEdge("userConversationIntentNode", "conversationSearchNode")
    .addEdge("conversationSearchNode", "conversationSummarizeSearchResultsNode")
    .addEdge("conversationSummarizeSearchResultsNode", "assistantResponseNode")
    .addEdge("assistantResponseNode", "formatResponseNode")
    .addEdge("formatResponseNode", END);

  const graph = graphBuilder.compile();

  try {
    // If completionsClient is not provided, get it
    const completionsClient = await getCompletionsClient();
    const embeddingsClient = getEmbeddingsClient();
    const searchClient = getSearchClient('geisinger-002');
    const initialState = {
      completionsClient,
      embeddingsClient,
      searchClient,
      geisingerConversation,
      userPrompt: chatInteraction.prompt,
      sources
    };

    // Invoke the graph
    const { formattedResponse, suggestedPrompts } = await graph.invoke(initialState);

    return {
      responseContent: formattedResponse,
      suggestedPrompts
    };
  } catch (error) {
    console.error('Error in complianceConversationGraph:', error);
    throw error;
  }
}

export { complianceConversationGraph };
