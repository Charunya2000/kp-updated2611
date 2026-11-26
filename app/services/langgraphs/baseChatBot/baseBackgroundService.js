
import { Annotation, StateGraph, START, END, interrupt, Command } from "@langchain/langgraph";
import { checkpointer } from "./checkpointer.js";
import { sharedWorkflowState } from "./workflowState.js";
import { processAgentArchivalRequest } from "./nodes/agentArchivalNode.js";
/* STATE DEFINITION */
const BackgroundState = Annotation.Root({
  ...sharedWorkflowState
})

const backgroundGraphBuilder = new StateGraph(BackgroundState);

/** ADD NODES */
backgroundGraphBuilder
  .addNode("agentArchiveRequest", processAgentArchivalRequest)


/** EDGES */
backgroundGraphBuilder
  .addEdge(START, "agentArchiveRequest")
  .addEdge("agentArchiveRequest", END);

// Compile
// Compile the graph
export const backgroundGraph = backgroundGraphBuilder.compile({ checkpointer });


