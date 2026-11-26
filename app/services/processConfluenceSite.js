import { Annotation, StateGraph, START, END } from "./langgraphs/langgraph-light.js";
import { scrapeWebsiteText, scrapeWebsiteTextById } from './confluencePageSiteService.js';
import { vectorize } from './vectorizeDataService.js';
import { insertVectorData } from './insertConfluenceVectorDataService.js';
import { v4 as uuidv4 } from 'uuid';
import { filterPii } from './piiFilterService.js'; // Import the PII filter service

// Define the state annotations
const StateAnnotation = Annotation.Root({
  url: Annotation,
  nuid: Annotation,
  smartNoteId: Annotation,
  scrapedText: Annotation,
  filteredText: Annotation, // Add filteredText annotation
  chunks: Annotation,
  vectorizedChunks: Annotation,
  space: Annotation,
  title: Annotation,
  response: Annotation
});

// Define the nodes
const scrapeNode = async (state) => {
  const url = new URL(state.url);
  let space, title, scrapedText;

  // Pattern 1: /display/{space}/{title}
  if (url.pathname.includes('/display/')) {
    const pathParts = url.pathname.split('/');
    space = pathParts[2];
    title = decodeURIComponent(pathParts.slice(3).join('/'));
    const result = await scrapeWebsiteText(space, title);
    scrapedText = result?.strippedTextContent || result;
  }
  // Pattern 2: /pages/viewpage.action?pageId={id}
  else if (url.pathname.includes('/pages/viewpage.action')) {
    const pageId = url.searchParams.get('pageId');
    if (!pageId) {
      throw new Error('PageId not found in viewpage URL');
    }
    // Note: You'll need to import scrapeWebsiteTextById from confluencePageSiteService.js
    // For now, using the existing function with dummy values
    space = 'unknown';
    title = `pageId-${pageId}`;
    const result = await scrapeWebsiteTextById(pageId);
    scrapedText = result?.strippedTextContent || result;
  }
  // Pattern 3: Handle other potential patterns (e.g., /x/{pageId}/{title})
  else if (url.pathname.includes('/x/')) {
    const pathParts = url.pathname.split('/');
    const pageId = pathParts[2];
    space = 'unknown';
    title = `pageId-${pageId}`;
    const result = await scrapeWebsiteTextById(pageId);
    scrapedText = result?.strippedTextContent || result;
  }
  // Pattern 4: /spaces/{space}/pages/{pageId}/{title}
  else if (url.pathname.includes('/spaces/') && url.pathname.includes('/pages/')) {
    const pathParts = url.pathname.split('/');
    const spaceIndex = pathParts.indexOf('spaces');
    const pagesIndex = pathParts.indexOf('pages');

    if (spaceIndex !== -1 && pagesIndex !== -1 && spaceIndex < pagesIndex) {
      space = pathParts[spaceIndex + 1]; // Space key after 'spaces'
      const pageId = pathParts[pagesIndex + 1]; // Page ID after 'pages'
      title = pathParts[pagesIndex + 2] ? decodeURIComponent(pathParts.slice(pagesIndex + 2).join('/')) : `pageId-${pageId}`;

      // Use pageId-based scraping since we have the pageId
      const result = await scrapeWebsiteTextById(pageId);
      scrapedText = result?.strippedTextContent || result;

    } else {
      throw new Error(`Invalid spaces/pages URL structure: ${state.url}\n Expected /spaces/{space}/pages/{pageId}/{title}`);
    }
  }
  else {
    throw new Error(`Unsupported Confluence URL pattern: ${state.url}\n Expected patterns include /display/{space}/{title}, /pages/viewpage.action?pageId={id}, /x/{pageId}/{title}, or /spaces/{space}/pages/{pageId}/{title}`);
  }

  return { space, title, scrapedText };
};

const filterPiiNode = async (state) => {
  if (!state.scrapedText) return { filteredText: '' };
  const filteredText = await filterPii(state.scrapedText);
  return { filteredText };
};

const chunkNode = async (state) => {
  if (!state.filteredText) return { chunks: [] };
  const chunkSize = 512;
  const lines = state.filteredText.split(/\r?\n/).filter(line => line.trim().length > 0);
  const words = lines.join(' ').split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }
  return { chunks };
};

const vectorizeNode = async (state) => {
  if (!state.chunks || state.chunks.length === 0) return { vectorizedChunks: [] };
  const vectorizedChunks = [];
  for (const chunk of state.chunks) {
    const embedding = await vectorize({ nuid: state.nuid, content: chunk });
    vectorizedChunks.push({ content: chunk, embedding });
  }
  return { vectorizedChunks };
};

const insertNode = async (state) => {
  if (!state.vectorizedChunks || state.vectorizedChunks.length === 0) return { responses: [] };
  const { space, title } = state;
  const responses = [];

  for (const { content, embedding } of state.vectorizedChunks) {
    const document = {
      id: uuidv4(),
      nuid: state.nuid,
      smartNoteId: state.smartNoteId,
      smartType: 'ConfluenceURL',
      content: content,
      contentVector: embedding,
    };
    const response = await insertVectorData(document);
    responses.push(response);
  }
  const nextParent = `${space}/${title}`;
  return { nextParent, responses };
};

// Build the state graph
const graphBuilder = new StateGraph(StateAnnotation);

const graph = graphBuilder
  .addNode("scrapeNode", scrapeNode)
  .addNode("filterPiiNode", filterPiiNode) // Add the filterPiiNode
  .addNode("chunkNode", chunkNode)
  .addNode("vectorizeNode", vectorizeNode)
  .addNode("insertNode", insertNode)
  .addEdge(START, "scrapeNode")
  .addEdge("scrapeNode", "filterPiiNode", state => state.scrapedText !== undefined) // Add edge from scrapeNode to filterPiiNode
  .addEdge("filterPiiNode", "chunkNode", state => state.filteredText !== undefined) // Add edge from filterPiiNode to chunkNode
  .addEdge("chunkNode", "vectorizeNode", state => state.chunks && state.chunks.length > 0)
  .addEdge("vectorizeNode", "insertNode", state => state.vectorizedChunks && state.vectorizedChunks.length > 0)
  .addEdge("insertNode", END)
  .compile();

export async function processScrapedData({ url, nuid, smartNoteId }) {
  try {
    await graph.invoke({
      url: url,
      nuid: nuid,
      smartNoteId: smartNoteId
    });
  } catch (error) {
    throw new Error('Error processing Confluence scraped data:', error);
  }
}
