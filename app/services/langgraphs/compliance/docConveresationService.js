import fs from 'fs';
import path from 'path';
const { parsePdfWithPdfParse } = require('./pdfParseService');

import { BlobServiceClient } from '@azure/storage-blob';
import os from 'os';
import { validateAndAcquireToken } from '@/app/services/sharepointGetAccessToken';
import fetch from 'node-fetch';
import { SearchClient, AzureKeyCredential } from "@azure/search-documents";
import { connectToDatabase } from '@/db/connection';
import fileIndex from './fileIndex.json';
import { v4 as uuidv4 } from 'uuid';

// Singleton for container client
let containerClientSingleton = null;
function getContainerClient() {
  if (!containerClientSingleton) {
    const envName = process.env['envName'];
    const BLOB_STORAGE_CONNECTION_STRING = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.blobstorage.endpoint`];
    const BLOB_CONTAINER = 'compliance-ai';
    const blobServiceClient = BlobServiceClient.fromConnectionString(BLOB_STORAGE_CONNECTION_STRING);
    containerClientSingleton = blobServiceClient.getContainerClient(BLOB_CONTAINER);
  }
  return containerClientSingleton;
}

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

let completionsClient = null;
export async function getCompletionsClient() {
  if (!completionsClient) {
    const envName = process.env['envName'];
    const completionsEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.completionsEndpoint`];
    const completionsAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.openai.api.key`];
    const completionsDeployment = (envName === 'pp') ? 'gpt-4o' : 'gpt-4o-aisvc';
    const completionsDeploymentAPIiVersion = "2024-08-01-preview";
    completionsClient = new AzureOpenAI({
      apiVersion: completionsDeploymentAPIiVersion,
      endpoint: completionsEndpoint,
      apiKey: completionsAPIKey,
      deployment: completionsDeployment
    });
  }
  return completionsClient;
}

let searchClients = {};

function getSearchClient(searchIndex) {
  if (!searchClients[searchIndex]) {
    const envName = process.env['envName'];
    const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
    const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.api.key`];
    searchClients[searchIndex] = new SearchClient(
      searchEndpoint,
      searchIndex,
      new AzureKeyCredential(searchAPIKey)
    )
  }
  return searchClients[searchIndex];
}

let updateClients = {};

function getUpdateClient(indexName) {
  if (!updateClients[indexName]) {
    const envName = process.env['envName'];
    const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
    const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.api.key`];
    updateClients[indexName] = new SearchClient(
      searchEndpoint,
      indexName,
      new AzureKeyCredential(searchAPIKey)
    )
  }
  return updateClients[indexName];
}


export async function getEmbeddingsForChunks(chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) return [];
  const client = getEmbeddingsClient();
  // Azure OpenAI Embeddings API expects an array of input strings
  const inputTexts = chunks.map(chunk => chunk.text);
  // Batch request embeddings
  const response = await client.embeddings.create({ input: inputTexts });
  // Response format: { data: [ { embedding: [...] }, ... ] }
  if (!response || !response.data) throw new Error('No embeddings returned');
  // Return array of embedding vectors
  return response.data.map(item => item.embedding);
}

/**
 * Downloads a blob from Azure Blob Storage to a temporary file
 * @param {string} blobName
 * @returns {Promise<string>} Path to the downloaded temp file
 */
export async function downloadBlobToTempFile(blobName) {
  const blobClient = getContainerClient().getBlobClient(blobName);
  const downloadResponse = await blobClient.download();
  const tempFilePath = path.join(os.tmpdir(), `${Date.now()}-${blobName}`);
  const writable = fs.createWriteStream(tempFilePath);
  await new Promise((resolve, reject) => {
    downloadResponse.readableStreamBody.pipe(writable);
    writable.on('finish', resolve);
    writable.on('error', reject);
  });
  return tempFilePath;
}

/**
 * Extracts text and hierarchy from a PDF file in blob storage
 * @param {Object} options
 * @param {string} options.containerName - Blob container name
 * @param {string} options.blobName - Blob name (file)
 * @param {string} options.connectionString - Azure Blob Storage connection string
 * @returns {Promise<{chunks: Array, hierarchy: Object}>}
 */
export async function parsePdfWithHierarchyFromBlob({ blobName }) {
  // Download PDF from blob storage to temp file
  const tempFilePath = await downloadBlobToTempFile(blobName);
  const data = new Uint8Array(fs.readFileSync(tempFilePath));
  const { text, metadata } = await parsePdfWithPdfParse(data);
  // Use text and metadata for further processing
  const numPages = pdf.numPages;
  let chunks = [];
  let hierarchy = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    let pageText = content.items.map(item => item.str).join(' ');

    // Simple heading detection (regex, can be improved)
    const headingRegex = /^(\d+(\.\d+)*\s+)?[A-Z][A-Za-z0-9\s\-]+$/gm;
    let headings = [...pageText.matchAll(headingRegex)].map(match => ({
      title: match[0],
      page: pageNum,
      index: match.index
    }));

    // Chunk by headings (naive, can be improved)
    if (headings.length > 0) {
      for (let i = 0; i < headings.length; i++) {
        const start = headings[i].index;
        const end = i < headings.length - 1 ? headings[i + 1].index : pageText.length;
        const chunkText = pageText.substring(start, end).trim();
        chunks.push({
          text: chunkText,
          title: headings[i].title,
          page: pageNum,
          hierarchyLevel: headings[i].title.split('.').length // crude level detection
        });
        hierarchy.push({
          id: `${pageNum}-${i}`,
          title: headings[i].title,
          level: headings[i].title.split('.').length,
          page: pageNum,
          children: [] // to be populated
        });
      }
    } else {
      // Fallback: treat whole page as one chunk
      chunks.push({
        text: pageText,
        title: `Page ${pageNum}`,
        page: pageNum,
        hierarchyLevel: 0
      });
      hierarchy.push({
        id: `${pageNum}-0`,
        title: `Page ${pageNum}`,
        level: 0,
        page: pageNum,
        children: []
      });
    }
  }


  // Build parent-child relationships in hierarchy
  // Assumes hierarchy is ordered by appearance
  let rootNodeIds = [];
  for (let i = 0; i < hierarchy.length; i++) {
    const current = hierarchy[i];
    // Find parent: last node before current with lower level
    let foundParent = false;
    for (let j = i - 1; j >= 0; j--) {
      if (hierarchy[j].level < current.level) {
        if (!hierarchy[j].children) hierarchy[j].children = [];
        current.parentId = hierarchy[j].id;
        current.root = false;
        hierarchy[j].children.push(current.id);
        foundParent = true;
        break;
      }
    }
    // Optionally, attach rootNodeIds to the hierarchy result
    if (!foundParent) {
      current.root = true;
      rootNodeIds.push(current.id);
    }
  }

  // Assign UUIDs to each chunk and hierarchy node for linking
  for (let i = 0; i < chunks.length; i++) {
    const uuid = uuidv4();
    chunks[i].id = uuid;
    if (hierarchy[i]) hierarchy[i].id = uuid;
  }

  // Generate embeddings for each chunk
  const embeddings = await getEmbeddingsForChunks(chunks);

  // TODO: Index in Azure Cognitive Search
  // TODO: Save hierarchy and metadata in MongoDB

  return { chunks, hierarchy, rootNodeIds, embeddings };
}

export async function findGeisingerConversationsByInferredLobAndStatus(inferredLob, status) {
  // Placeholder for actual DB lookup
  const connection = await connectToDatabase();
  const geisingerConversations = await connection.collection('geisinger-docs').find({ type: 'GeisingerConversation', inferredLob, status }).toArray();
  return geisingerConversations;
}

/**
 * Streams a file from SharePoint to Azure Blob Storage using SharePoint REST API
 * @param {Object} options
 * @param {string} options.siteName
 * @param {string} options.folderName
 * @param {string} options.fileName
 * @param {string} options.blobContainer
 * @param {string} options.blobConnectionString
 * @param {string} options.destBlobName
 * @returns {Promise<void>}
 */
export async function streamSharePointFileToBlob({
  siteName,
  folderName,
  fileName,
  destBlobName
}) {

  // Step 1: Get access token
  const accessToken = await validateAndAcquireToken();

  // Step 2: Build SharePoint file download endpoint
  const endpoint = `https://sp-cloud.kp.org/sites/${siteName}/_api/web/GetFolderByServerRelativeUrl('${folderName}')/Files('${fileName}')/$value`;

  // Step 3: Fetch file as a stream
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/octet-stream'
    }
  });

  if (!response.ok || !response.body) {
    throw new Error(`Failed to fetch file from SharePoint: ${response.status} ${response.statusText}`);
  }

  // Step 4: Stream to Azure Blob Storage

  const containerClient = getContainerClient();
  const blockBlobClient = containerClient.getBlockBlobClient(destBlobName);

  // Pipe the SharePoint file stream directly to Azure Blob
  await blockBlobClient.uploadStream(response.body);
}

/**
 * Batch indexes chunks and embeddings in Azure Cognitive Search
 * @param {Array} chunks
 * @param {Array} embeddings
 * @param {Object} cognitiveSearchConfig
 * @returns {Promise<void>}
 */
export async function batchIndexChunksInCognitiveSearch(chunks, embeddings, cognitiveSearchConfig) {
  // Prepare documents for Azure Cognitive Search
  const indexName = cognitiveSearchConfig?.indexName || 'smartnote-file-002';
  const client = getUpdateClient(indexName);
  const batchDocs = chunks.map((chunk, i) => ({
    id: chunk.id,
    nuid: cognitiveSearchConfig?.nuid || '',
    smartnote_id: cognitiveSearchConfig?.smartnote_id || '',
    smart_file_type: cognitiveSearchConfig?.fileType || 'pdf',
    smart_file_name: cognitiveSearchConfig?.fileName || chunk.title,
    smart_file_category: cognitiveSearchConfig?.fileCategory || '',
    content: chunk.text,
    content_vector: embeddings[i]
  }));
  // Upload batch to Azure Cognitive Search
  await client.uploadDocuments(batchDocs);
}

/**
 * Batch saves hierarchy and metadata to MongoDB
 * @param {Object} options
 * @param {Array} options.hierarchy
 * @param {Object} options.meta
 * @param {string} options.mongoUri
 * @returns {Promise<void>}
 */
const saveHierarchyToMongo = async ({ hierarchy, meta }) => {
  // Connect to MongoDB
  const db = await connectToDatabase();
  const collection = db.collection('geisinger-docs');

  // Domain document structure
  const domainDocs = hierarchy.map(node => {
    // Find index info from fileIndex.json (by fileAName or other key)
    const indexInfo = fileIndex[meta.fileAName] || {};
    return {
      type: 'HierarchyNode',
      conversationId,
      lob: meta.lob || null,
      relativeAUrl: meta.relativeAUrl,
      fileAName: meta.fileAName,
      hierarchyId: node.id, // UUID used for linking
      chunkId: node.id, // chunk.id and hierarchy.id are the same UUID
      title: node.title,
      level: node.level,
      page: node.page,
      hierarchyLevel: node.level, // Add hierarchyLevel for clarity
      children: node.children,
      parentId: node.parentId || null,
      root: node.root || false,
      indexLink: indexInfo.indexName || null,
      indexMeta: indexInfo || null,
      createdAt: new Date()
    };
  });

  // Insert documents in batch
  const result = await collection.insertMany(domainDocs);
  return result;
}

export async function prepareSharePointPdfsForConversation(geisingerConversation) {
  const { siteName, fileAName, relativeAUrl } = geisingerConversation;

  // Save geisingerConversation to MongoDB 'geisinger-docs' collection
  const db = await connectToDatabase();
  // Ensure a unique id for status update
  const conversationId = geisingerConversation.id || uuidv4();
  await db.collection('geisinger-docs').insertOne({
    ...geisingerConversation,
    id: conversationId,
    type: 'GeisingerConversation',
    createdAt: new Date()
  });

  // Extract folderName from relativeAUrl
  // Example: "/sites/genAIPortalTestSite/Shared Documents/Regulatory and Contractual Documents/Marketplace/CFR-2023-title45-vol2-part156.pdf"
  // siteName: "genAIPortalTestSite"
  // folderName: "Shared Documents/Regulatory and Contractual Documents/Marketplace"
  // fileAName: "CFR-2023-title45-vol2-part156.pdf"
  const folderMatch = relativeAUrl.match(/^\/sites\/[^\/]+\/(.+)\/([^\/]+)$/);
  let folderName = '';
  if (folderMatch && folderMatch.length >= 3) {
    folderName = folderMatch[1];
  } else {
    throw new Error(`Unable to parse folderName from relativeAUrl: ${relativeAUrl}`);
  }
  // Step 1: Copy SharePoint file to Azure Blob Storage (streaming)
  await streamSharePointFileToBlob({ siteName, folderName, fileName: fileAName, destBlobName: fileAName });



  // Step 2: Parse PDF to extract text and hierarchy (stream parse from Blob Storage)
  const tempFilePath = await downloadBlobToTempFile(fileAName);
  const { chunks, hierarchy } = await parsePdfWithHierarchyFromBlob({
    blobName: fileAName
  });

  // Step 3: Create embeddings and index in Azure Cognitive Search (batch)
  const embeddings = await getEmbeddingsForChunks(chunks);
  await batchIndexChunksInCognitiveSearch(chunks, embeddings);

  // Step 4: Store metadata and hierarchy in MongoDB (batch)
  await saveHierarchyToMongo({ hierarchy, meta: { siteName, fileAName, relativeAUrl }, conversationId });

  // Clean up temp file
  fs.unlinkSync(tempFilePath);

  await db.collection('geisinger-docs').updateOne(
    { type: 'GeisingerConversation', id: conversationId },
    { $set: { status: 'Complete' } }
  );

  // Return summary
  return {
    file: fileAName,
    chunkCount: chunks.length,
    hierarchyCount: hierarchy.length,
    embeddingsCount: embeddings.length,
    geisingerConversationId: conversationId,
    status: geisingerConversation.status
  };
}

