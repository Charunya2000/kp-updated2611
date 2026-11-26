import { Annotation, StateGraph, START, END } from "./langgraphs/langgraph-light.js";
import { scrapeWebsiteText } from './confluencePageContentService.js';
// import { setProcessEnvironment } from '../../scripts/configActions.js';
import { vectorize } from './vectorizeDataService.js';
import { insertVectorData } from './insertVectorDataService.js';
import { v4 as uuidv4 } from 'uuid';

// Define the state annotations
const StateAnnotation = Annotation.Root({
  url: Annotation,
  scrapedText: Annotation,
  chunks: Annotation,
  vectorizedChunks: Annotation,
  nuid: Annotation,
  smartNoteId: Annotation,
  fileName: Annotation,
});

// Define the nodes
const scrapeNode = async (state) => {
  // Extract space and title from the URL
  const url = new URL(state.url);
  const pathParts = url.pathname.split('/');
  const space = pathParts[2];
  const title = decodeURIComponent(pathParts.slice(3).join('/'));

  // Scrape the website text using the extracted space and title
  const scrapedText = await scrapeWebsiteText(space, title, state?.teamName, state?.assistantName);
  return { scrapedText };
};

const chunkNode = async (state) => {
  const chunkSize = 512;
  const lines = state.scrapedText.split(/\r?\n/).filter(line => line.trim().length > 0);
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
  // .addNode("configNode", configNode)
  .addNode("scrapeNode", scrapeNode)
  .addNode("chunkNode", chunkNode)
  .addNode("vectorizeNode", vectorizeNode)
  .addNode("insertNode", insertNode)
  // .addEdge(START, "configNode")
  // .addEdge("configNode", "scrapeNode")
  .addEdge(START, "scrapeNode")
  .addEdge("scrapeNode", "chunkNode")
  .addEdge("chunkNode", "vectorizeNode")
  .addEdge("vectorizeNode", "insertNode")
  .addEdge("insertNode", END)
  .compile();

// Function to process the scraped data
export async function processScrapedData({ url, nuid, smartNoteId, teamName, assistantName }) {
  const { responses } = await graph.invoke({
    url: url,
    nuid: nuid,
    smartNoteId: smartNoteId,
    teamName: teamName,
    assistantName: assistantName
  });
  return responses;
}

// Example usage
// (async () => {
//   const url = 'https://confluence-aes.kp.org/display/HPTSAI/HPTS+AI+Services+Architecture'; // Replace with the URL of the website you want to scrape
//   const nuid = "A257371";
//   const smartNoteId = "3149964c-9836-40f9-bc4d-737719388222";
//   await processScrapedData({ url, nuid, smartNoteId });
// })();
