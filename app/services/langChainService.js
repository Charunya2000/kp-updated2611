// 'use server';

// import { createSearchIndexTool } from "@services/searchVectorDataToolService";
// import { chatCompletionOne } from "@services/chatCompletionsService";
// import { START, StateGraph, Annotation, END } from "@langchain/langgraph";
// import { ToolNode } from "@langchain/langgraph/prebuilt";
// import { AIMessage } from "@langchain/core/messages";

// export async function testLangChain() {
//   const agentTools = [createSearchIndexTool()];
//   async function agent(state) {
//     console.log("---CALL AGENT---");

//     const response = await chatCompletionOne(state);
//     return {
//       messages: [response],
//     };
//   }

//   const GraphState = Annotation.Root({
//     messages: Annotation({
//       reducer: (x, y) => x.concat(y),
//       default: () => [],
//     })
//   });

//   const toolNode = new ToolNode(agentTools);

//   const workflow = new StateGraph(GraphState)
//     .addNode("azureAISearch", toolNode)
//     .addNode("openAIChatCompletions", agent);

//   workflow.addEdge(START, "azureAISearch");
//   workflow.addEdge("azureAISearch", "openAIChatCompletions");
//   workflow.addEdge("openAIChatCompletions", END);
//   const app = workflow.compile();

//   const inputs = {
//     messages: [
//       new AIMessage(
//         "Give me a typical epic template.",
//       ),
//     ],
//   };

//   let finalState;
//   for await (const output of await app.stream(inputs)) {
//     for (const [key, value] of Object.entries(output)) {
//       const lastMsg = output[key].messages[output[key].messages.length - 1];
//       console.log(`Output from node: '${key}'`);
//       console.dir({
//         type: lastMsg._getType(),
//         content: lastMsg.content,
//         tool_calls: lastMsg.tool_calls,
//       }, { depth: null });
//       console.log("---\n");
//       finalState = value;
//     }
//   }
//   console.log(JSON.stringify(finalState, null, 2));
// };

