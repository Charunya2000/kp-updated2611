import { Annotation, StateGraph, START, END } from "./app/services/langgraphs/langgraph-light.js";
import { setProcessEnvironment } from './scripts/configActions.js';
import { vectorize } from './app/services/vectorizeDataService.js';
import { searchIndex } from './app/services/searchVectorDataService.js';
import { chatCompletionOne } from './app/services/chatCompletionsService.js';
import fs from 'fs';

const configNode = async (_) => {
  console.log(`-----configNode-----`);
  await setProcessEnvironment();
  return {}
};

const embeddingNode = async (state) => {
  console.log(`-----embeddingNode-----`);
  const embeddings = await vectorize({ nuid: state.nuid, content: state.prompt });
  return {
    promptEmbedding: embeddings
  };
};

const aiSearchNode = async (state) => {
  console.log(`-----aiSearchNode-----`);
  const searchResults = await searchIndex({
    searchIndex: state.searchIndex,
    selectFields: state.selectFields,
    searchEmbedding: state.promptEmbedding,
    nearestNeighbors: state.nearestNeighbors,
    filter: state.filter
  });
  const additionalContextMessages = searchResults.map(
    message => {
      return { role: 'user', content: `Design file: ${state.fileName} and content: ${message.document.content}.` }
    });
  return {
    contextMessages: [...state.contextMessages, ...additionalContextMessages, { role: 'user', content: state.prompt }],
  }
};

const completionNode = async (state) => {
  console.log(`-----completionNode-----`);
  const result = await chatCompletionOne({ messages: state.contextMessages });
  return {
    result: result
  }
};

const StateAnnotation = Annotation.Root({
  prompt: Annotation,
  fileName: Annotation,
  searchIndex: Annotation,
  selectFields: Annotation,
  nearestNeighbors: Annotation,
  filter: Annotation,
  contextMessages: Annotation,
  promptEmbedding: Annotation,
  messages: Annotation,
  result: Annotation
});

const graphBuilder = new StateGraph(StateAnnotation);

const graph = graphBuilder
  .addNode("configNode", configNode)
  .addNode("embeddingNode", embeddingNode)
  .addNode("aiSearchNode", aiSearchNode)
  .addNode("completionNode", completionNode)
  .addEdge(START, "configNode")
  .addEdge("configNode", "embeddingNode")
  .addEdge("embeddingNode", "aiSearchNode")
  .addEdge("aiSearchNode", "completionNode")
  .addEdge("completionNode", END)
  .compile();

const representation = await graph.getGraphAsync();
const image = await representation.drawMermaidPng();
const arrayBuffer = await image.arrayBuffer();
const buffer = new Uint8Array(arrayBuffer);
fs.writeFileSync('graph.png', buffer);

export async function searchWithDesignFile({ indexName, selectFields, nearestNeighbors, filter, fileName, prompt }) {
  const { result: { response, suggestedPrompts } } = await graph.invoke({
    prompt: prompt,
    fileName: fileName,
    searchIndex: indexName,
    selectFields: selectFields,
    nearestNeighbors: nearestNeighbors,
    filter: filter,
    contextMessages: [
      {
        role: "system",
        content: "You are an expert in Agile product management."
      },
      {
        role: "system",
        content: "Your response content, UTF-8 encoding, should include 2 parts: a response in 'markdown' between a pair of strings: '<wiki>', and followed by 3 suggested prompts, not 'wiki markup', but plain text, without numbering them, based on your response, on 3 separate lines."
      }
    ]
  });
  console.log(`\nresponse: ${JSON.stringify(response)}`);
  console.log(`\nsuggestedPrompts: ${JSON.stringify(suggestedPrompts)}`);
  return { response, suggestedPrompts };
}

const nuid = "A257371";
const smartnote_id = "3149964c-9836-40f9-bc4d-7377193882fe";
const indexName = "smartnote-file-001";
const selectFields = ["nuid", "smart_file_name", "smartnote_id", "content"];
const nearestNeighbors = 2;
const fileName = "KPMC_SS_Financial Activity _APSD_V1.2 (2).docx";
const filter = `nuid eq '${nuid}' and smartnote_id eq '${smartnote_id}' and smart_file_name eq '${fileName}'`;
const prompt = "What happens after the user navigates back to the bill group page?";

await searchWithDesignFile({ indexName, selectFields, nearestNeighbors, filter, fileName, prompt });