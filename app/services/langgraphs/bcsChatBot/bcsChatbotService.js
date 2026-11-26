'use server';

import { Annotation, StateGraph, START, END } from "../langgraph-light.js";
import { vectorizePromptNode } from './nodes/vectorizePromptNode.js';
import { parseUserIntentNode } from './nodes/searchIntentNode.js';
import { searchIndexNode1 as searchIndexNode } from "./nodes/searchIndexNode.js";
import { getMetadataFromGitHubNode } from "./nodes/searchGitHubNode.js";
import { getProfilePromptNode } from "./nodes/getProfilePromptNode.js";
import { chatCompletionNode } from "./nodes/chatCompletionNode.js";
import { formatResponseNode } from "./nodes/formatResponseNode.js";
import { getCompletionsClient } from "@/app/services/chatCompletionService3.js";
import { systemPromptNode } from '@/app/services/langgraphs/shared/nodes/addSystemPromptsNode.js';

// Define the state with just the attributes we use, all typed as Annotation
const StateAnnotation = Annotation.Root({

  config: Annotation,
  teamName: Annotation,
  assistantName: Annotation,
  metadata: Annotation,

  // Input states
  userMessage: Annotation,
  userPrompt: Annotation,
  promptEmbedding: Annotation,
  completionsClient: Annotation,
  context: Annotation,

  // Search and metadata states
  searchPattern: Annotation,
  searchResults: Annotation,
  githubMetadata: Annotation,
  indexMetadata: Annotation,
  parsedSearchIntent: Annotation,

  // Profile and response states
  promptProfile: Annotation,
  chatResponse: Annotation,
  formattedResponse: Annotation,

  // Status flags
  searchSuccess: Annotation,
  promptSuccess: Annotation,
  chatSuccess: Annotation,
  formatSuccess: Annotation,

  // Event handler for streaming
  sendEvent: Annotation
});

// Build the graph with simplified state
const graphBuilder = new StateGraph(StateAnnotation);

// Add all nodes to the graph
graphBuilder
  .addNode("vectorizePromptNode", vectorizePromptNode)
  .addNode("parseUserIntentNode", parseUserIntentNode)
  .addNode("getMetadataFromGitHubNode", getMetadataFromGitHubNode)
  .addNode("searchIndexNode", searchIndexNode)
  .addNode("getProfilePromptNode", getProfilePromptNode)
  .addNode("chatCompletionNode", chatCompletionNode)
  .addNode("formatResponseNode", formatResponseNode);

// Define conditional routing based on searchPattern
const determineSearchNode = (state) => {
  if (!state.parsedSearchIntent?.searchType) {
    return "searchIndexNode"; // Default fallback
  }

  switch (state.parsedSearchIntent.searchType) {
    case 'METADATA_SEARCH':
      return state.parsedSearchIntent.searchConfiguration?.targetRepository ?
        "getMetadataFromGitHubNode" : "searchIndexNode";
    case 'INDEX_SEARCH':
      return "searchIndexNode";
    default:
      return "searchIndexNode";
  }
};

// Define the edges with conditions
graphBuilder
  // Initial vectorization and intent parsing
  .addEdge(START, "vectorizePromptNode")
  .addEdge("vectorizePromptNode", "parseUserIntentNode")

  // Conditional routing based on search intent
  .addConditionalEdges(
    "parseUserIntentNode",
    determineSearchNode
  )

  // Routes from search nodes to prompt profile
  .addEdge("getMetadataFromGitHubNode", "getProfilePromptNode")
  .addEdge("searchIndexNode", "getProfilePromptNode")

  // Final processing chain
  .addEdge("getProfilePromptNode", "chatCompletionNode")
  .addEdge("chatCompletionNode", "formatResponseNode")
  .addEdge("formatResponseNode", END);

// Compile the graph
const graph = graphBuilder.compile();

// Streaming chat bot function
export async function bcsChatBotGraphStream({ teamName, assistantName, userMessage, metadata = {} }) {
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        const completionsClient = await getCompletionsClient();
        // Initialize state with user message and metadata
        const initialState = {
          teamName,
          assistantName,
          userPrompt: userMessage,
          completionsClient,
          searchSuccess: false,
          promptSuccess: false,
          chatSuccess: false,
          formatSuccess: false,
          ...metadata,  // Additional configuration from the client
          // Add sendEvent handler that matches submitPromptService2.js format
          sendEvent: (event) => {
            if (event.type === 'data') {
              if (typeof event.data === 'string') {
                // Handle both regular content and JSON
                try {
                  // Check if it's JSON with suggestedPrompts
                  const parsed = JSON.parse(event.data);
                  if (parsed.suggestedPrompts) {
                    controller.enqueue(encoder.encode(event.data)); // Keep JSON structure
                  }
                } catch {
                  // Regular markdown content
                  controller.enqueue(encoder.encode(event.data));
                }
              }
            }
          }
        };

        // Invoke the graph
        await graph.invoke(initialState);

        // Close the stream when done
        controller.close();
      } catch (error) {
        console.error("Error in chatBotGraphStream:", error);
        // Send error message in a format compatible with the frontend
        const errorMessage = JSON.stringify({
          error: error.message,
          suggestedPrompts: [] // Empty prompts on error to maintain structure
        });
        controller.enqueue(encoder.encode(errorMessage));
        controller.error(error);
      }
    }
  });
}
