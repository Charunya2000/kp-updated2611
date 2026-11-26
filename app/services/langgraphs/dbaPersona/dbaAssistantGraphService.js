'use server';

import { Annotation, StateGraph, START, END } from "../langgraph-light.js";

import { parseUserIntentNode } from '@/app/services/langgraphs/nodes/parseUserIntentNode.js';
import { vectorizePromptNode } from '@/app/services/langgraphs/nodes/vectorizePromptNode.js';
import { vectorizePromptNode } from "@/app/services/langgraphs/nodes/vectorizePromptNode.js";
import { createSearchStrategyNode } from "@/app/services/langgraphs/nodes/createSearchStrategyNode.js";
import { analyzeDbResultsNode } from "../nodes/analyzeDbResultsNode.js";
import { searchMissingInfoNode } from "../nodes/searchMissingInfoNode.js";
import { executeSearchStrategiesNode } from "../nodes/executeSearchStrategiesNode.js";
import { combineDbInfoNode } from "../nodes/combineDbInfoNode.js";
import { planQueryNode } from "../nodes/planQueryNode.js";
import { generateSqlNode } from "../nodes/generateSqlNode.js";
import { evaluateQueryNode } from "../nodes/evaluateQueryNode.js";
import { refineQueryNode } from "../nodes/refineQueryNode.js";
import { formatResponseNode } from "../nodes/formatResponseNode.js";

// State annotation
const StateAnnotation = Annotation.Root({
  nuid: Annotation,
  userPrompt: Annotation,
  smartNoteId: Annotation,
  sources: Annotation,
  teamName: Annotation,
  assistantName: Annotation,
  systemMessage: Annotation,
  assistant: Annotation,
  persona: Annotation,
  promptEmbedding: Annotation,
  searchResults: Annotation,
  actualSources: Annotation,
  filteredSearchResults: Annotation,
  filteredMessages: Annotation,
  filteredDesignReferenceSearchResults: Annotation,
  filteredSavedResponseSearchResults: Annotation,
  filteredDesignIndexSearchResults: Annotation,
  confluenceSearchResults: Annotation,
  filteredUploadedDocumentSearchResults: Annotation,
  filteredSharePointFilesearchResults: Annotation,
  filteredWebsiteURLsSearchResults: Annotation,
  enrichedPrompt: Annotation,



  searchContext: Annotation,
  parsedIntent: Annotation,
  promptEmbedding: Annotation,
  searchStrategies: Annotation,
  dbSearchResults: Annotation,
  discoveredTables: Annotation,
  sufficientDbInfo: Annotation,
  analysisResult: Annotation,
  missingInfo: Annotation,
  additionalDbResults: Annotation,
  dbContextMessages: Annotation,
  tableRelationships: Annotation,
  queryPlan: Annotation,
  sqlResponse: Annotation,
  queryEvaluation: Annotation,
  qualityScore: Annotation,
  needsRefinement: Annotation,
  refinedSqlResponse: Annotation,
  formattedResponse: Annotation,
  sendEvent: Annotation // Add this for streaming support
});

// Build the graph with conditional edges
const graphBuilder = new StateGraph(StateAnnotation);

// Add all nodes
graphBuilder
  .addNode("systemMessagesNode", systemMessagesNode)
  .addNode("vectorizePromptNode", vectorizePromptNode)
  .addNode("parseUserIntentNode", parseUserIntentNode)
  .addNode("createSearchStrategyNode", createSearchStrategyNode)
  .addNode("executeSearchStrategiesNode", executeSearchStrategiesNode)
  .addNode("analyzeDbResultsNode", analyzeDbResultsNode)
  .addNode("searchMissingInfoNode", searchMissingInfoNode)
  .addNode("combineDbInfoNode", combineDbInfoNode)
  .addNode("planQueryNode", planQueryNode)
  .addNode("generateSqlNode", generateSqlNode)
  .addNode("evaluateQueryNode", evaluateQueryNode)
  .addNode("refineQueryNode", refineQueryNode)
  .addNode("formatResponseNode", formatResponseNode);

// Define the edges with conditions
graphBuilder
  .addEdge(START, "searchContextNode")
  .addEdge("searchContextNode", "parseUserIntentNode")
  .addEdge("parseUserIntentNode", "vectorizePromptNode")
  .addEdge("vectorizePromptNode", "createSearchStrategyNode")
  .addEdge("createSearchStrategyNode", "executeSearchStrategiesNode")
  .addEdge("executeSearchStrategiesNode", "analyzeDbResultsNode")
  .addEdge("analyzeDbResultsNode", "searchMissingInfoNode")
  .addEdge("searchMissingInfoNode", "combineDbInfoNode")
  .addEdge("combineDbInfoNode", "planQueryNode")
  .addEdge("planQueryNode", "generateSqlNode")
  .addEdge("generateSqlNode", "evaluateQueryNode")
  .addEdge("evaluateQueryNode", "refineQueryNode")
  .addEdge("refineQueryNode", "formatResponseNode")
  .addEdge("formatResponseNode", END);

// Compile the graph
const graph = graphBuilder.compile();

// Entry point - ensure markdown formatting is preserved
export async function dbaAssistantGraph({ nuid, userPrompt, teamName }) {
  try {
    // If called directly, return the response as a string
    const result = await graph.invoke({
      nuid,
      userPrompt,
      teamName
    });

    // Return the formatted response, ensuring markdown is preserved
    const response = result.formattedResponse || result.refinedSqlResponse || result.sqlResponse;

    // Include suggested prompts in the response
    return {
      answer: response,
      suggestedPrompts: result.suggestedPrompts || []
    };
  } catch (error) {
    console.error("Error in dbaAssistantGraph:", error);
    return {
      answer: "I encountered an error while generating your SQL query. Please try again or rephrase your request.",
      suggestedPrompts: []
    };
  }
}

// New streaming version of the function
export async function dbaAssistantGraphStream(nuid, smartNoteId, sources, chatInteraction, teamName) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        // Invoke the graph with streaming capability
        await graph.invoke({
          nuid,
          userPrompt: chatInteraction.prompt,
          smartNoteId,
          sources,
          teamName,
          sendEvent: (event) => {
            if (event.type === 'data') {
              // Enqueue each data event (e.g., markdown response tokens)
              controller.enqueue(encoder.encode(event.data));
            }
          }
        });
      } catch (error) {
        console.error("Error in dbaAssistantGraphStream:", error);
        controller.enqueue(encoder.encode("I encountered an error while generating your SQL query. Please try again or rephrase your request."));
      } finally {
        // Close the stream
        controller.close();
      }
    }
  });

  return stream;
}
