'use server';

import { AzureOpenAI } from "openai";
import { SearchClient, AzureKeyCredential } from '@azure/search-documents';
import { Annotation, StateGraph, START, END } from "../langgraph-light.js";
import { updateChatInteractionProgress } from './helpers/progressTracking.js';
import { loadComparisonConfigNode } from './nodes/loadComparisonConfigNode.js';
import { detectComparisonModeNode } from './nodes/detectComparisonModeNode.js';
import { vectorizeComparisonPromptNode } from './nodes/vectorizeComparisonPromptNode.js';
import { userComparisonIntentNode } from './nodes/userComparisonIntentNode.js';
import { comparisonSearchNode } from './nodes/comparisonSearchNode.js';
import { comparisonSummarizeSearchResultsNode } from './nodes/comparisonSummarizeSearchResultsNode.js';
import { comparisonAlignResultsNode } from './nodes/comparisonAlignResultsNode.js';
import { comparisonResponseNode } from './nodes/comparisonResponseNode.js';
import { formatComparisonResponseNode } from './nodes/formatComparisonResponseNode.js';
import { documentFormatComparisonResponseNode } from './nodes/documentFormatComparisonResponseNode.js';
import { extractFullDocumentNode } from './nodes/extractFullDocumentNode.js';
// import { documentComparisonNodeNew } from './nodes/documentComparisonNodeNew.js';
import { documentComparisonNodeNew2 as documentComparisonNodeNew } from './nodes/documentComparisonNodeNew2.js';
import { generateDifferencesSpreadsheetNode } from './nodes/generateDifferencesSpreadsheetNode.js';
import { uploadSpreadsheetToBlobNode } from './nodes/uploadSpreadsheetToBlobNode.js';
import { getCompletionsClient } from "@/app/services/chatCompletionService3.js";
// import { findGeisingerConversationsByInferredLobAndStatus } from '@/app/services/langgraphs/compliance/docConveresationService2.js';
import { findGeisingerConversationsByInferredLobAndStatus } from '@/app/services/langgraphs/compliance/docConversationService3.js';
import { llmDocumentAnalysisNode } from './nodes/llmDocumentAnalysisNode.js';



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

// Define the workflow state for comparison
const StateAnnotation = Annotation.Root({
  geisingerConversationA: Annotation,
  geisingerConversationB: Annotation,
  userPrompt: Annotation,
  comparisonMode: Annotation, // 'topic' or 'document'
  sources: Annotation,
  configDocuments: Annotation,
  completionsClient: Annotation,
  embeddingsClient: Annotation,
  searchClient: Annotation,
  promptEmbedding: Annotation,
  intentSchema: Annotation,
  parsedIntent: Annotation,
  intentResponse: Annotation,
  searchResultsA: Annotation,
  searchResultsB: Annotation,
  fullDocumentA: Annotation, // Complete document content for document mode
  fullDocumentB: Annotation, // Complete document content for document mode
  documentDifferences: Annotation, // Structured differences for spreadsheet
  spreadsheetBlobName: Annotation, // Blob storage path for Excel file
  downloadLink: Annotation, // Download URL for user
  alignedResults: Annotation,
  comparisonSummary: Annotation,
  comparisonResponse: Annotation,
  suggestedPrompts: Annotation,
  formattedResponse: Annotation,
  errorMessage: Annotation,
  spreadsheetPath: Annotation,
  spreadsheetFileName: Annotation,
  progressResponse: Annotation, // Markdown progress updates
  chatId: Annotation,
  chatInteractionId: Annotation, // ID of ChatInteraction being updated
  teamName: Annotation,
  assistantName: Annotation,
  smartNoteId: Annotation
});

// ===== PROGRESS TRACKING UTILITIES =====

/**
 * Create formatted progress markdown
 * @param {string} stage - Current stage description
 * @param {Object} details - Additional details (previousStages, etc.)
 * @returns {string} Formatted markdown progress
 */
function createProgressMarkdown(stage, details = {}) {
  const timestamp = new Date().toLocaleTimeString();
  let md = `## Comparison Progress\n\n`;

  // Add all previous completed stages if provided
  if (details.previousStages && Array.isArray(details.previousStages)) {
    details.previousStages.forEach(s => {
      md += `✓ ${s}\n`;
    });
  }

  // Add current in-progress stage
  md += `⏳ ${stage}\n\n`;
  md += `---\n*Last update: ${timestamp}*`;

  return md;
}


// Build the graph
const graphBuilder = new StateGraph(StateAnnotation);

graphBuilder
  .addNode("loadComparisonConfigNode", loadComparisonConfigNode)
  .addNode("detectComparisonModeNode", detectComparisonModeNode)
  .addNode("vectorizeComparisonPromptNode", vectorizeComparisonPromptNode)
  .addNode("userComparisonIntentNode", userComparisonIntentNode)
  .addNode("comparisonSearchNode", comparisonSearchNode)
  .addNode("comparisonSummarizeSearchResultsNode", comparisonSummarizeSearchResultsNode)
  .addNode("comparisonAlignResultsNode", comparisonAlignResultsNode)
  .addNode("comparisonResponseNode", comparisonResponseNode)
  .addNode("formatComparisonResponseNode", formatComparisonResponseNode)
  .addNode("documentFormatComparisonResponseNode", documentFormatComparisonResponseNode)
  // Document mode nodes
  .addNode("extractFullDocumentNode", extractFullDocumentNode)
  .addNode("documentComparisonNode", documentComparisonNodeNew)
  .addNode("llmDocumentAnalysisNode", llmDocumentAnalysisNode)
  .addNode("generateDifferencesSpreadsheetNode", generateDifferencesSpreadsheetNode)
  .addNode("uploadSpreadsheetToBlobNode", uploadSpreadsheetToBlobNode);

// Define routing for final formatting
const routeToFinalFormatting = (state) => {
  const { comparisonMode } = state;

  if (comparisonMode === 'document') {
    return 'documentFormatComparisonResponseNode';
  } else {
    return 'formatComparisonResponseNode';
  }
};

// Define conditional routing function
const routeByComparisonMode = (state) => {
  const { comparisonMode } = state;

  if (comparisonMode === 'document') {
    return 'extractFullDocumentNode';
  } else {
    return 'vectorizeComparisonPromptNode';
  }
};

// Define routing after document comparison
const routeAfterDocumentComparison = (state) => {
  const { documentDifferences } = state;

  if (documentDifferences && !documentDifferences.error) {
    return 'generateDifferencesSpreadsheetNode';
  } else {
    return 'documentFormatComparisonResponseNode';
  }
}; graphBuilder
  .addEdge(START, "loadComparisonConfigNode")
  .addEdge("loadComparisonConfigNode", "detectComparisonModeNode")
  .addConditionalEdges("detectComparisonModeNode", routeByComparisonMode, {
    "vectorizeComparisonPromptNode": "vectorizeComparisonPromptNode",
    "extractFullDocumentNode": "extractFullDocumentNode"
  })
  // Topic-based comparison path (existing)
  .addEdge("vectorizeComparisonPromptNode", "userComparisonIntentNode")
  .addEdge("userComparisonIntentNode", "comparisonSearchNode")
  .addEdge("comparisonSearchNode", "comparisonSummarizeSearchResultsNode")
  .addEdge("comparisonSummarizeSearchResultsNode", "comparisonAlignResultsNode")
  .addEdge("comparisonAlignResultsNode", "comparisonResponseNode")
  .addConditionalEdges("comparisonResponseNode", routeToFinalFormatting, {
    "formatComparisonResponseNode": "formatComparisonResponseNode",
    "documentFormatComparisonResponseNode": "documentFormatComparisonResponseNode"
  })
  // Document-based comparison path (new)
  .addEdge("extractFullDocumentNode", "documentComparisonNode")
  .addConditionalEdges("documentComparisonNode", (state) => {
    const { documentDifferences } = state;
    if (documentDifferences && !documentDifferences.error) {
      return "llmDocumentAnalysisNode";
    } else {
      return "documentFormatComparisonResponseNode";
    }
  }, {
    "llmDocumentAnalysisNode": "llmDocumentAnalysisNode",
    "documentFormatComparisonResponseNode": "documentFormatComparisonResponseNode"
  })
  .addEdge("llmDocumentAnalysisNode", "generateDifferencesSpreadsheetNode")
  .addEdge("generateDifferencesSpreadsheetNode", "uploadSpreadsheetToBlobNode")
  .addEdge("uploadSpreadsheetToBlobNode", "documentFormatComparisonResponseNode")
  // Final edges to END
  .addEdge("formatComparisonResponseNode", END)
  .addEdge("documentFormatComparisonResponseNode", END);

const graph = graphBuilder.compile();

// ===== ASYNC PROCESSING HELPER =====

/**
 * Execute graph asynchronously without blocking caller
 * Updates ChatInteraction.response with progress as nodes complete
 */
async function executeComparisonGraphAsync(initialState) {
  const { teamName, chatId, chatInteractionId } = initialState;

  try {
    // Invoke the graph (runs to completion)
    const { formattedResponse } = await graph.invoke(initialState);

    // Final update with complete response
    await updateChatInteractionProgress(teamName, chatId, chatInteractionId, formattedResponse);

  } catch (error) {
    console.error(`[complianceComparisonService] Async execution error:`, error);
    const errorResponse = `## Comparison Error\n\n❌ We could not complete the comparison due to a temporary processing issue.\n\nPlease retry in about a minute.\n\n---\n*Failed at ${new Date().toLocaleTimeString()}*`;
    await updateChatInteractionProgress(teamName, chatId, chatInteractionId, errorResponse);
  }
}

// Main function
export async function complianceComparisonGraph(nuid, teamName, assistantName, smartNoteId, chatInteractionId, geisingerComparison, sources, chatId, prompt) {

  // Use provided chatInteractionId from request body or parameter
  const geisingerConversations = await findGeisingerConversationsByInferredLobAndStatus(
    geisingerComparison.lob,
    'Complete',
    { teamName }
  );
  const geisingerConversationA = geisingerConversations.find(conv => conv.id === geisingerComparison.geisingerConversationAId);
  const geisingerConversationB = geisingerConversations.find(conv => conv.id === geisingerComparison.geisingerConversationBId);
  try {
    // Create initial progress response
    const initialProgressMarkdown = createProgressMarkdown(
      "Starting document comparison...",
      { previousStages: [] }
    );

    // Update ChatInteraction immediately with initial progress
    await updateChatInteractionProgress(teamName, chatId, chatInteractionId, initialProgressMarkdown);

    // Get clients
    const completionsClient = await getCompletionsClient();
    const embeddingsClient = getEmbeddingsClient();
    const searchClient = getSearchClient('geisinger-002');

    // Build initial state with progress tracking
    const initialState = {
      completionsClient,
      embeddingsClient,
      searchClient,
      geisingerComparison,
      geisingerConversationA,
      geisingerConversationB,
      userPrompt: prompt,
      sources,
      progressResponse: initialProgressMarkdown, // Start progress tracking
      chatId,
      chatInteractionId, // Pass ID through graph for progress updates
      teamName,
      assistantName,
      smartNoteId
    };

    // Launch graph execution asynchronously (fire and forget)
    // Don't await this - return immediately to user
    executeComparisonGraphAsync(initialState).catch(error => {
      console.error('[complianceComparisonService] Unhandled async error:', error);
    });

    // Return immediately with initial progress response
    return {
      responseContent: initialProgressMarkdown,
      suggestedPrompts: []
    };
  } catch (error) {
    console.error('[complianceComparisonService] Error in complianceComparisonGraph:', error);

    // Return error response
    const errorResponse = `## Comparison Error\n\n❌ Failed to start comparison due to a temporary processing issue.\n\nPlease retry in about a minute.\n\n---\n*Error at ${new Date().toLocaleTimeString()}*`;
    await updateChatInteractionProgress(teamName, chatId, chatInteractionId, errorResponse);

    return {
      responseContent: errorResponse,
      suggestedPrompts: []
    };
  }
}
