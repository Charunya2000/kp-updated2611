import { Annotation, StateGraph, START, END } from "./langgraphs/langgraph-light.js";
import { vectorize } from './vectorizeDataService.js';
import { insertVectorData } from './insertVectorDataService.js';
import { v4 as uuidv4 } from 'uuid';

// Define the state annotations
const StateAnnotation = Annotation.Root({
  content: Annotation,
  chunks: Annotation,
  vectorizedChunks: Annotation,
  nuid: Annotation,
  smartNoteId: Annotation,
});

// Define the nodes
const chunkNode = async (state) => {
  const chunkSize = 512;
  const lines = state.content.split(/\r?\n/).filter(line => line.trim().length > 0);
  const words = lines.join(' ').split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }
  return { chunks };
};

const vectorizeNode = async (state) => {
  const vectorizedChunks = [];
  for (const chunk of state.chunks) {
    const embedding = await vectorize({ nuid: state.nuid, content: chunk });
    vectorizedChunks.push({ chunk, embedding });
  }
  return { vectorizedChunks };
};

const insertNode = async (state) => {
  const responses = [];
  for (const { chunk, embedding } of state.vectorizedChunks) {
    const document = {
      id: uuidv4(),
      nuid: state.nuid,
      smartNoteId: state.smartNoteId,
      smartNoteType: 'WebsiteURL',
      variant: 'QTestURL',
      content: chunk,
      contentVector: embedding,
    };
    const response = await insertVectorData(document);
    responses.push(response);
  }
  return { responses };
};

// Build the state graph
const graphBuilder = new StateGraph(StateAnnotation);

const graph = graphBuilder
  .addNode("chunkNode", chunkNode)
  .addNode("vectorizeNode", vectorizeNode)
  .addNode("insertNode", insertNode)
  .addEdge(START, "chunkNode")
  .addEdge("chunkNode", "vectorizeNode")
  .addEdge("vectorizeNode", "insertNode")
  .addEdge("insertNode", END)
  .compile();

// Function to process qTest data
export async function processQTestData({ content, nuid, smartNoteId }) {
  const { responses } = await graph.invoke({
    content: content,
    nuid: nuid,
    smartNoteId: smartNoteId
  });
  return responses;
}