import { Annotation, StateGraph, START, END } from "./app/services/langgraphs/langgraph-light.js";
import { setProcessEnvironment } from './scripts/configActions.js';
import { deleteFromIndex } from './app/services/deleteFromVectorDataService.js';
import fs from 'fs';

const configNode = async (_) => {
  console.log(`-----configNode-----`);
  await setProcessEnvironment();
  return {}
};

const deleteFromIndexNode = async (state) => {
  console.log(`-----deleteFromIndexNode-----`);
  await deleteFromIndex({
    searchIndex: state.searchIndex,
    filter: state.filter
  });
  return {
    result: 'SUCCESS',
  }
};

const StateAnnotation = Annotation.Root({
  searchIndex: Annotation,
  filter: Annotation,
  result: Annotation
});

const graphBuilder = new StateGraph(StateAnnotation);

const graph = graphBuilder
  .addNode("configNode", configNode)
  .addNode("deleteFromIndexNode", deleteFromIndexNode)
  .addEdge(START, "configNode")
  .addEdge("configNode", "deleteFromIndexNode")
  .addEdge("deleteFromIndexNode", END)
  .compile();

const representation = await graph.getGraphAsync();
const image = await representation.drawMermaidPng();
const arrayBuffer = await image.arrayBuffer();
const buffer = new Uint8Array(arrayBuffer);
fs.writeFileSync('graph.png', buffer);

export async function searchWithDesignFile({ indexName, filter }) {
  const { result } = await graph.invoke({
    searchIndex: indexName,
    filter: filter,
  });
  console.log(`\nresponse: ${JSON.stringify(result)}`);
  return result;
}

const indexName = "smartnote-file-002";
const filter = `nuid eq 'A257371'`;

await searchWithDesignFile({ indexName, filter });