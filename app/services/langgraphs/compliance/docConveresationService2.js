// Required imports for file operations
// const path = require('path');
// const os = require('os');
// const fs = require('fs');
import { connectToDatabase } from '@/db/connection';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import { validateAndAcquireToken } from '@/app/services/sharepointGetAccessToken';
import { BlobServiceClient } from '@azure/storage-blob';
import { AzureOpenAI } from "openai";
import PDFParser from 'pdf2json';
import { SearchClient, AzureKeyCredential } from "@azure/search-documents";
import { selectGeisingerConfigContextDocuments } from '@/app/services/geisingerConfigService';
import { extractDocxStructure } from '@/app/services/langgraphs/compliance/docConversationWordSupportService';

// Singleton for container client
let containerClientSingleton = null;
function getContainerClient() {
  if (!containerClientSingleton) {
    const envName = process.env['envName'];
    const connectionStringKey = `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.blobstorage.endpoint`;
    const BLOB_STORAGE_CONNECTION_STRING = process.env[connectionStringKey];
    if (!BLOB_STORAGE_CONNECTION_STRING) {
      console.error('❌ [getContainerClient] Blob storage connection string is empty or undefined');
      throw new Error(`Blob storage connection string not found for key: ${connectionStringKey}`);
    }

    // Mask sensitive parts of connection string for logging
    const BLOB_CONTAINER = 'compliance-ai';
    try {
      const blobServiceClient = BlobServiceClient.fromConnectionString(BLOB_STORAGE_CONNECTION_STRING);
      containerClientSingleton = blobServiceClient.getContainerClient(BLOB_CONTAINER);
    } catch (error) {
      console.error('❌ [getContainerClient] Failed to create blob storage client:', error.message);
      console.error('🔍 [getContainerClient] Error details:', {
        name: error.name,
        code: error.code,
        statusCode: error.statusCode,
        stack: error.stack?.split('\n').slice(0, 5).join('\n')
      });
      throw error;
    }
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
async function getCompletionsClient() {
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

// Helper to clean heading text
function cleanHeading(text) {
  if (typeof text !== 'string') return text;

  // Strip leading and trailing double quotes
  let processed = text.trim().replace(/^"+|"+$/g, '');

  // If heading is ONLY digits and dots, append first 20 chars of content
  if (/^\d+(\.\d*)*$/.test(processed.trim())) {
    const trimmed = processed.trim();
    // Take first 20 chars (or less) from content
    const extra = trimmed.length < 20 ? '' : ' ' + trimmed.slice(0, 20);
    const updated = trimmed + extra;
    return updated;
  }
  // Otherwise, remove leading digits, dots, spaces only if alpha content remains
  let cleaned = processed;
  // Only remove leading digits/dots/spaces if there is alpha content after
  if (/^[\d.\s]+[a-zA-Z]/.test(processed)) {
    cleaned = processed.replace(/^[\d.\s]+/, '');
  }
  // Remove trailing non-alpha characters (except digits, keep e.g. "part 1")
  cleaned = cleaned.replace(/[^a-zA-Z0-9]+$/, '');
  // If nothing left after cleaning, fall back to original
  if (!cleaned.match(/[a-zA-Z]/)) {
    return processed.trim();
  }
  return cleaned.trim();
}

/**
 * Simplified: Sequentially processes consolidated chunks, creates full chunks for headings, appends body content, assigns hierarchy, and returns array of full chunks.
 * - Each heading chunk (matches a heuristic) starts a new full chunk.
 * - All following non-heading chunks are appended to the current full chunk's content until the next heading.
 * - Each full chunk has heading, headingType, level, page, xPos, yPos, children, parentId, root, content, id.
 * - Hierarchy is assigned among heading chunks based on level.
 * - Assumes rawData is already consolidated.
 */
function parsePdfWithHeuristicsSimplified(rawData, heuristics) {
  // Counter for default headings by type
  const headingCounters = {};

  if (!Array.isArray(rawData) || !Array.isArray(heuristics)) return [];

  // Known page header patterns to exclude
  const pageHeaderPatterns = ['Dept. of Health and Human Services', '45 CFR Subtitle A', 'Pt. 156'];

  // Helper to detect if a chunk is a page header (not just first heading on page)
  function isPageHeader(chunk) {
    if (!chunk || !chunk.content) return false;

    const content = chunk.content.trim();

    // Check if content matches known page header patterns
    if (pageHeaderPatterns.some(pattern => content === pattern || content.startsWith(pattern))) {
      return true;
    }

    // Check positional heuristics: page headers typically appear very high on page
    // and match common patterns (page numbers, status markers, etc.)
    const pageHeaderRegexes = [
      /^page\s+\d+/i,                    // "Page 123"
      /^\d+\s*-\s*\d+\s*$/,              // "1 - 5" (page ranges)
      /^confidential|proprietary|draft/i  // Document status
    ];

    if (chunk.yPos < 100 && pageHeaderRegexes.some(regex => regex.test(content))) {
      return true;
    }

    return false;
  }

  // Normalize fontName for comparison (case-insensitive, trim)
  const normalizeFontName = name => (name || '').toLowerCase().replace(/\s+/g, '');

  // Helper to match a chunk to a heuristic (returns heuristic or null)
  function matchHeuristic(chunk) {
    const validChunk = chunk && chunk.content.trim().length > 0;
    if (!validChunk) return null;
    const heuristic = heuristics.find(h =>
      normalizeFontName(h.fontName) === normalizeFontName(chunk.fontName) &&
      Number(h.fontWidth).toFixed(3) === Number(chunk.fontWidth).toFixed(3) &&
      Number(h.font_size_min) <= Number(chunk.fontSize) &&
      h.bold === chunk.bold &&
      h.italic === chunk.italic
    );
    return heuristic || null;
  }

  const fullChunks = [];
  let current = null;
  let bodyBuffer = [];
  let bodyMeta = [];

  for (let i = 0; i < rawData.length; i++) {
    const chunk = rawData[i];
    const heuristic = matchHeuristic(chunk);
    // Prevent headings that are only digits and dots (e.g., "1.2.3")
    const isDigitsDots = typeof chunk.content === 'string' && chunk.content.trim().match(/^\d+(\.\d+)*$/);
    if (heuristic && !isDigitsDots) {
      // Finalize previous full chunk
      if (current) {
        current.content = current.heading + (bodyBuffer.length ? ': ' + bodyBuffer.join(' ') : '');
        // Use first xPos/yPos from heading and first body chunk if present
        if (bodyMeta.length > 0) {
          current.xPos = current.xPos !== undefined ? current.xPos : bodyMeta[0].xPos;
          current.yPos = current.yPos !== undefined ? current.yPos : bodyMeta[0].yPos;
        }
        // Only add if not a detected page header
        if (!isPageHeader(current)) {
          fullChunks.push(current);
        }
      }
      // Start new full chunk
      let cleanedHeading = cleanHeading(chunk.content);

      if (/^\d+(\.\d*)*$/.test(cleanedHeading)) {
        cleanedHeading = cleanedHeading + ' ' + rawData[i + 1]?.content.trim().slice(0, 20) || '';
      }

      // If cleaned heading is empty, use default heading
      if (!cleanedHeading) {
        const type = heuristic.type || 'heading';
        if (!headingCounters[type]) headingCounters[type] = 0;
        cleanedHeading = `${type}_${headingCounters[type].toString().padStart(3, '0')}`;
        headingCounters[type]++;
      }
      current = {
        heading: cleanedHeading,
        headingType: heuristic.type,
        level: heuristic.level,
        page: chunk.page,
        xPos: chunk.xPos,
        yPos: chunk.yPos,
        children: [],
        parentId: null,
        root: false,
        id: uuidv4(),
      };
      bodyBuffer = [];
      bodyMeta = [];
    } else if (heuristic && isDigitsDots) {
      // treat as body, not heading
      if (current) {
        bodyBuffer.push(chunk.content);
        bodyMeta.push({ xPos: chunk.xPos, yPos: chunk.yPos });
      }
    } else if (current) {
      // Append non-heading chunk to current full chunk
      if (typeof chunk.content === 'string' && chunk.content.trim().length > 0) {
        bodyBuffer.push(chunk.content);
        bodyMeta.push({ xPos: chunk.xPos, yPos: chunk.yPos });
      }
    }
  }
  // Finalize last chunk
  if (current) {
    current.content = current.heading + (bodyBuffer.length ? ': ' + bodyBuffer.join(' ') : '');
    if (bodyMeta.length > 0) {
      current.xPos = current.xPos !== undefined ? current.xPos : bodyMeta[0].xPos;
      current.yPos = current.yPos !== undefined ? current.yPos : bodyMeta[0].yPos;
    }
    // Only add if not a detected page header
    if (!isPageHeader(current)) {
      fullChunks.push(current);
    }
  }

  // Assign hierarchy (parentId, children, root) among heading chunks based on level
  const lastHeadingByLevel = {};
  for (let i = 0; i < fullChunks.length; i++) {
    const item = fullChunks[i];
    if (item.level !== null && item.level !== undefined) {
      // Find parent at the next-highest lower level
      let parentId = null;
      for (let lvl = item.level - 1; lvl >= 0; lvl--) {
        if (lastHeadingByLevel[lvl]) {
          parentId = lastHeadingByLevel[lvl].id;
          break;
        }
      }
      item.parentId = parentId;
      item.root = !parentId;
      if (parentId) {
        const parent = fullChunks.find(c => c.id === parentId);
        if (parent) parent.children.push(item.id);
      }
      lastHeadingByLevel[item.level] = item;
    } else {
      item.root = true;
    }
  }

  // Log the total number of headings found
  return fullChunks;
}

/**
 * Combines contiguous text objects with matching font attributes into larger chunks
 * @param {Array} rawData - Array of text objects from PDF parsing
 * @returns {Array} - Array of consolidated chunks with matching attributes
 */
function consolidateTextByAttributes(rawData) {
  if (!Array.isArray(rawData) || rawData.length === 0) {
    return [];
  }

  const consolidatedChunks = [];
  let currentChunk = null;

  // Sort by page, then by yPos (top to bottom), then by xPos (left to right)
  const sortedData = [...rawData].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    if (Math.abs(a.yPos - b.yPos) > 2) return a.yPos - b.yPos; // 2 unit tolerance for same line
    return a.xPos - b.xPos;
  });

  for (const item of sortedData) {
    // Check if this item can be merged with the current chunk
    const canMerge = currentChunk &&
      currentChunk.page === item.page &&
      currentChunk.fontWidth === item.fontWidth &&
      currentChunk.fontName === item.fontName &&
      currentChunk.fontFaceId === item.fontFaceId &&
      currentChunk.fontSize === item.fontSize &&
      currentChunk.bold === item.bold &&
      currentChunk.italic === item.italic;

    if (canMerge) {
      // Merge with current chunk
      const separator = currentChunk.content.endsWith('-') ? '' : ' ';
      currentChunk.content += separator + item.content;
      currentChunk.lastXPos = item.xPos;
      currentChunk.lastYPos = item.yPos;
      // Update chunk boundaries
      currentChunk.minXPos = Math.min(currentChunk.minXPos, item.xPos);
      currentChunk.maxXPos = Math.max(currentChunk.maxXPos, item.xPos);
      currentChunk.minYPos = Math.min(currentChunk.minYPos, item.yPos);
      currentChunk.maxYPos = Math.max(currentChunk.maxYPos, item.yPos);
      currentChunk.textCount++;
    } else {
      // Start new chunk
      if (currentChunk) {
        consolidatedChunks.push(currentChunk);
      }

      currentChunk = {
        content: typeof item.content === 'string' ? item.content.trim() : item.content,
        fontFaceId: item.fontFaceId,
        fontWidth: item.fontWidth,
        fontName: item.fontName,
        bold: item.bold,
        italic: item.italic,
        fontSize: item.fontSize,
        yPos: item.yPos,
        xPos: item.xPos,
        lastYPos: item.yPos,
        lastXPos: item.xPos,
        minXPos: item.xPos,
        maxXPos: item.xPos,
        minYPos: item.yPos,
        maxYPos: item.yPos,
        page: item.page,
        textCount: 1,
        id: uuidv4()
      };
    }
  }

  // Don't forget the last chunk
  if (currentChunk) {
    consolidatedChunks.push(currentChunk);
  }



  return consolidatedChunks;
}

/**
 * Extracts structure from a PDF blob using pdf2json and Azure OpenAI GPT-4o
 * @param {string} blobName - Name of the PDF blob in Azure Blob Storage
 * @returns {Promise<{ heuristics: object, structure: object[] }>}
 */
async function extractPdfStructure(blobName) {

  try {
    // Use singleton container client
    const containerClient = getContainerClient();
    const blobClient = containerClient.getBlobClient(blobName);
    const downloadResponse = await blobClient.download();

    // Download PDF to temp file
    const path = require('path');
    const os = require('os');
    const fs = require('fs');
    const tempFilePath = path.join(os.tmpdir(), `${Date.now()}-${path.basename(blobName)}`);


    const writable = fs.createWriteStream(tempFilePath);
    await new Promise((resolve, reject) => {
      downloadResponse.readableStreamBody.pipe(writable);
      writable.on('finish', () => {

        resolve();
      });
      writable.on('error', (error) => {
        console.error('❌ [extractPdfStructure] Temp file write failed:', error.message);
        reject(error);
      });
    });

    const configQuery = {
      type: 'GeisingerConfig',
      collectionName: 'Doc Conversation Prepare', // Use a distinct collection name for comparison configs
    };


    const { data: configDocuments } = await selectGeisingerConfigContextDocuments(configQuery);



    const startsWithPageHeaders = ['Dept. of Health and Human Services', '45 CFR Subtitle A', 'Pt. 156'];

    // Step 1: Extract 5–10 pages with pdf2json
    const parser = new PDFParser();
    let sampleRawData = [];
    parser.on('pdfParser_dataReady', pdfData => {
      // You can slice any range of pages from the pdfData.Pages array.
      // For example, to get pages 39 to 41 (inclusive), use slice(38, 41) since the array is zero-based.
      sampleRawData = pdfData.Pages.slice(0, 10).flatMap((page, pageIndex) =>
        page.Texts
          .map(text => {
            const content = decodeURIComponent(text.R[0].T);
            // Ignore text objects where content starts with any pageHeader
            if (startsWithPageHeaders.some(header => content.startsWith(header))) {
              return null;
            }
            return {
              content,
              fontWidth: text.sw,
              fontFaceId: text.R[0].TS[0],
              fontName: PDFParser.fontFaceDict ? PDFParser.fontFaceDict[text.R[0].TS[0]] : undefined,
              bold: text.R[0].TS[2] === 1,
              italic: text.R[0].TS[3] === 1,
              fontSize: text.R[0].TS[1] || 10,
              yPos: text.y,
              xPos: text.x,
              page: pageIndex
            };
          })
          .filter(Boolean)
      );
    });
    parser.on('pdfParser_dataError', err => {
      throw new Error(`Parsing error: ${err.message}`);
    });

    // Parse the temp file
    parser.loadPDF(tempFilePath);
    await new Promise(resolve => parser.once('pdfParser_dataReady', resolve));

    // Clean up temp file
    fs.unlinkSync(tempFilePath);

    // Step 2: Infer heuristics with GPT-4o using official OpenAI SDK chat completion API
    const completionsClient = await getCompletionsClient();

    const configDoc = configDocuments.find(doc => doc.purpose === "GeneralConfig" && doc.title === "Doc Conversation Heuristic Prompt")?.documentText || null;

    const consolidatedSampleData = consolidateTextByAttributes(sampleRawData);

    // Filter out chunks where content is only digits (possibly with whitespace)
    const filteredSampleRawData = consolidatedSampleData.filter(
      chunk => !(typeof chunk.content === 'string' && chunk.content.trim().match(/^\d+$/))
    );
    // Identify the most common body text style by total content length
    const bodyStyleStats = {};
    filteredSampleRawData.forEach(chunk => {
      const key = `${chunk.fontName}|${chunk.fontSize}|${chunk.bold}|${chunk.italic}|${chunk.fontWidth}`;
      if (!bodyStyleStats[key]) {
        bodyStyleStats[key] = { totalLength: 0, count: 0, fontName: chunk.fontName, fontSize: chunk.fontSize, bold: chunk.bold, italic: chunk.italic, fontWidth: chunk.fontWidth };
      }
      bodyStyleStats[key].totalLength += (typeof chunk.content === 'string' ? chunk.content.length : 0);
      bodyStyleStats[key].count += 1;
    });
    // Find the style with the maximum total content length
    let mostCommonBodyStyle = null;
    let maxLength = 0;
    Object.values(bodyStyleStats).forEach(style => {
      if (style.totalLength > maxLength) {
        maxLength = style.totalLength;
        mostCommonBodyStyle = style;
      }
    });

    if (!mostCommonBodyStyle) {
      const smallestFontStyle = Object.values(bodyStyleStats).reduce((min, style) => {
        return min === null || style.fontSize < min.fontSize ? style : min;
      }, null);

      return { heuristics: [], structure: [], category: 'unknown', smallestFontStyle };
    }

    const filteredConsolidatedSampleData = filteredSampleRawData.filter(
      chunk => {
        const isBodyStyle = (
          chunk.fontName === mostCommonBodyStyle.fontName &&
          chunk.fontSize === mostCommonBodyStyle.fontSize &&
          chunk.bold === mostCommonBodyStyle.bold &&
          chunk.italic === mostCommonBodyStyle.italic &&
          chunk.fontWidth === mostCommonBodyStyle.fontWidth
        );
        const isSmallerFont = chunk.fontSize < mostCommonBodyStyle.fontSize;
        if (isBodyStyle) {
          // Exclude body style chunk
        }
        if (isSmallerFont) {
          // Exclude smaller font chunk
        }
        return !isBodyStyle && !isSmallerFont;
      }
    );

    // Build distinct font styles and include a sample content for each
    const seenStyles = new Map();

    for (const chunk of filteredConsolidatedSampleData) {
      const styleKey = `${chunk.fontName}|${chunk.fontSize}|${chunk.bold}|${chunk.fontWidth}`;
      if (!seenStyles.has(styleKey)) {
        seenStyles.set(styleKey, {
          fontName: chunk.fontName,
          fontSize: Number(chunk.fontSize),
          bold: chunk.bold === true || chunk.bold === 'true',
          italic: chunk.italic === true || chunk.italic === 'true',
          fontWidth: Number(chunk.fontWidth),
          contents: [typeof chunk.content === 'string' ? chunk.content.trim() : chunk.content]
        });
      } else {
        seenStyles.get(styleKey).contents.push(typeof chunk.content === 'string' ? chunk.content.trim() : chunk.content);
      }
    }

    const distinctFontStylesArr = Array.from(seenStyles.values());


    // Remove any distinctFontStyle where content matches /^§\d+\.\d+$/
    const filteredDistinctFontStyles = distinctFontStylesArr.filter(
      style => style.contents.every(
        content => !/^§\d+\.\d+$/.test((content || '').trim())
      )
    );



    const sampleDataString = JSON.stringify(filteredDistinctFontStyles);

    // Then replace the placeholder in the prompt
    const prompt = configDoc
      .replaceAll(/\$\{samplePdf\}/g, sampleDataString);



    const completionConfigDoc = configDocuments.find(doc => doc.purpose === "ChatCompletionConfig" && doc.title === "Doc Conversation Prepare Completion Config")?.documentText || null;

    // Properly escape the entire prompt for JSON embedding
    const escapedPrompt = JSON.stringify(prompt).slice(1, -1); // Remove surrounding quotes
    const completionConfig = completionConfigDoc
      .replaceAll(/\$\{prompt\}/g, escapedPrompt);


    let completionConfigObj;
    try {
      completionConfigObj = typeof completionConfig === 'string' ? JSON.parse(completionConfig) : completionConfig;
    } catch (e) {
      completionConfigObj = completionConfig;
    }

    const completion = await completionsClient.chat.completions.create(completionConfigObj);
    const responseContent = completion.choices[0].message.content;
    // Extract JSON block from markdown response and sanitize before parsing
    let heuristics;
    let heuristicsText = responseContent;
    // Improved regex: match ```json ... ```, fallback to ```...```, then to JSON array
    const jsonMatch = heuristicsText.match(/```json\s*([\s\S]*?)```/) ||
      heuristicsText.match(/```([\s\S]*?)```/) ||
      heuristicsText.match(/(\[[\s\S]*\])/);
    if (jsonMatch && jsonMatch[1]) {
      heuristicsText = jsonMatch[1];
    }


    // ...existing code...
    try {
      heuristics = JSON.parse(heuristicsText);
    } catch (e) {
      // Sanitize if initial parse fails
      let sanitized = heuristicsText;
      // Remove comments (// ...)
      sanitized = sanitized.replaceAll(/\/\/.*$/gm, '');
      // Remove trailing commas before } or ]
      sanitized = sanitized.replaceAll(/,\s*([}\]])/g, '$1');
      // Attempt to close any open quotes at the end of a line
      sanitized = sanitized.replaceAll(/"([^"\n]*)\n/g, '"$1"\n');
      // Remove lines with unterminated string values
      sanitized = sanitized.replaceAll(/"[^"]*$/gm, '');
      // Double-escape backslashes in regex values
      sanitized = sanitized.replaceAll(/("regex":\s*")([^"\n]*)(")/g, (m, p1, p2, p3) => p1 + p2.replaceAll(/\\/g, '\\\\') + p3);
      try {
        heuristics = JSON.parse(sanitized);
      } catch (e2) {
        throw e2;
      }
    }
    // Log all heuristics returned by the language model before filtering
    if (Array.isArray(heuristics)) {
      heuristics.forEach((h, idx) => {
      });
    }
    // After mostCommonBodyStyle is determined and heuristics are defined, filter heuristics
    let filteredHeuristics = [];
    if (Array.isArray(heuristics)) {
      filteredHeuristics = heuristics.filter(h => {
        // Exclude if matches main body style
        const matchesBodyStyle =
          h.fontName === mostCommonBodyStyle.fontName &&
          h.font_size_min === mostCommonBodyStyle.fontSize &&
          h.bold === mostCommonBodyStyle.bold &&
          h.italic === mostCommonBodyStyle.italic &&
          h.fontWidth === mostCommonBodyStyle.fontWidth;
        // Exclude if font size is less than main body font size
        const tooSmall = Number(h.font_size_min) < Number(mostCommonBodyStyle.fontSize);
        if (matchesBodyStyle || tooSmall) {
          return false;
        }
        return true;
      });
    } else {
      filteredHeuristics = heuristics;
    }
    const hardcodedHeuristics = filteredHeuristics;

    // Log all heuristics determined by the Language Model
    hardcodedHeuristics.forEach((h, index) => {
    });

    // Step 2b: Classify document complexity/category using GPT-4o
    let category = "unknown";

    // Step 3: Apply heuristics to sample data
    const structure = parsePdfWithHeuristicsSimplified(consolidatedSampleData, hardcodedHeuristics);

    return { heuristics: hardcodedHeuristics, structure, category };

  } catch (error) {
    console.error('❌ [extractPdfStructure] Error during PDF structure extraction:', error.message);
    console.error('🔍 [extractPdfStructure] Error details:', {
      name: error.name,
      code: error.code,
      stack: error.stack?.split('\n').slice(0, 5).join('\n')
    });
    throw error;
  }
}
// Parses the entire PDF and applies heuristics
async function extractPdfStructureWithHeuristics(blobName, heuristics) {


  try {
    // ...existing code...
    const containerClient = getContainerClient();
    const blobClient = containerClient.getBlobClient(blobName);
    const downloadResponse = await blobClient.download();

    // Download PDF to temp file
    const path = require('path');
    const os = require('os');
    const fs = require('fs');
    const tempFilePath = path.join(os.tmpdir(), `${Date.now()} -${path.basename(blobName)} `);
    const writable = fs.createWriteStream(tempFilePath);
    await new Promise((resolve, reject) => {
      downloadResponse.readableStreamBody.pipe(writable);
      writable.on('finish', () => {
        resolve();
      });
      writable.on('error', (error) => {
        console.error('❌ [extractPdfStructureWithHeuristics] Temp file write failed:', error.message);
        reject(error);
      });
    });

    // Parse all pages
    const parser = new PDFParser();
    let fullRawData = [];
    let totalPages = 0;
    parser.on('pdfParser_dataReady', pdfData => {
      totalPages = pdfData.Pages.length;
      fullRawData = pdfData.Pages.flatMap((page, pageIndex) =>
        page.Texts.map(text => ({
          content: decodeURIComponent(text.R[0].T),
          fontWidth: text.sw,
          fontFaceId: text.R[0].TS[0],
          fontName: PDFParser.fontFaceDict ? PDFParser.fontFaceDict[text.R[0].TS[0]] : undefined,
          bold: text.R[0].TS[2] === 1,
          italic: text.R[0].TS[3] === 1,
          fontSize: text.R[0].TS[1] || 10,
          yPos: text.y,
          xPos: text.x, // Capture x position
          page: pageIndex + 1
        }))
      );

    });
    parser.on('pdfParser_dataError', err => {
      throw new Error(`Parsing error: ${err.message} `);
    });

    // Parse the temp file
    parser.loadPDF(tempFilePath);
    await new Promise(resolve => parser.once('pdfParser_dataReady', resolve));

    // Clean up temp file
    fs.unlinkSync(tempFilePath);

    // Consolidate raw text chunks before applying heuristics

    const consolidatedChunks = consolidateTextByAttributes(fullRawData);

    // Apply heuristics to consolidated data
    const fullStructure = parsePdfWithHeuristicsSimplified(consolidatedChunks, heuristics);

    return { heuristics, structure: fullStructure, totalPages };

  } catch (error) {
    console.error('❌ [extractPdfStructureWithHeuristics] Error during full PDF extraction:', error.message);
    console.error('🔍 [extractPdfStructureWithHeuristics] Error details:', {
      name: error.name,
      code: error.code,
      stack: error.stack?.split('\n').slice(0, 5).join('\n')
    });
    throw error;
  }
}
//
// ...existing code...

// Helper function to get site and drive IDs
async function getSiteAndDriveInfo(siteName, domain = 'geisinger.sharepoint.com') {
  const accessToken = await validateAndAcquireToken();
  const graphEndpoint = `https://graph.microsoft.com/v1.0/sites/${domain}:/sites/${siteName}`;

  const siteResponse = await fetch(graphEndpoint, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!siteResponse.ok) {
    throw new Error(`Failed to get site info: ${siteResponse.status} ${siteResponse.statusText}`);
  }

  const siteData = await siteResponse.json();
  const siteId = siteData.id;

  // Get default drive (Documents library)
  const driveResponse = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/drive`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!driveResponse.ok) {
    throw new Error(`Failed to get drive info: ${driveResponse.status} ${driveResponse.statusText}`);
  }

  const driveData = await driveResponse.json();
  return { siteId, driveId: driveData.id };
}


/**
 * Helper function to encode SharePoint paths for use in Graph API URLs
 * Encodes each path segment individually while preserving path separators
 * @param {string} path - The SharePoint path to encode
 * @returns {string} - The encoded path
 */
function encodeSharePointPath(path) {
  if (!path) return '';
  const encoded = path.split('/').map(segment => encodeURIComponent(segment)).join('/');

  return encoded;
}


// Updated function using Microsoft Graph API
async function streamSharePointFileToBlob({ siteName, fileId, destBlobName }) {
  const accessToken = await validateAndAcquireToken();

  // Get site and drive IDs
  const { driveId } = await getSiteAndDriveInfo(siteName);

  // Use fileId for direct file content endpoint
  const endpoint = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}/content`;


  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/octet-stream'
    }
  });

  if (!response.ok || !response.body) {
    console.error('❌ [streamSharePointFileToBlob] Failed to fetch file:', response.status, response.statusText);
    throw new Error(`Failed to fetch file from SharePoint via Graph API: ${response.status} ${response.statusText}`);
  }

  try {
    const containerClient = getContainerClient();
    const blockBlobClient = containerClient.getBlockBlobClient(destBlobName);
    await blockBlobClient.uploadStream(response.body);
  } catch (blobError) {
    console.error('❌ [streamSharePointFileToBlob] Blob upload failed:', blobError.message);
    console.error('🔍 [streamSharePointFileToBlob] Blob error details:', {
      name: blobError.name,
      code: blobError.code,
      statusCode: blobError.statusCode,
      requestId: blobError.details?.requestId,
      stack: blobError.stack?.split('\n').slice(0, 5).join('\n')
    });
    throw blobError;
  }

  return destBlobName;
}

// Utility: Stream SharePoint file to Blob
async function streamSharePointFileToBlobOrig({ siteName, folderName, fileName, destBlobName }) {
  const accessToken = await validateAndAcquireToken();
  const endpoint = `https://sp-cloud.kp.org/sites/${siteName}/_api/web/GetFolderByServerRelativeUrl('${folderName}')/Files('${fileName}')/$value`;
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
  const withFolderDestBlobName = folderName + '/' + destBlobName;
  const containerClient = getContainerClient();
  const blockBlobClient = containerClient.getBlockBlobClient(withFolderDestBlobName);
  await blockBlobClient.uploadStream(response.body);
  return withFolderDestBlobName;
}

// Utility: Save hierarchy to MongoDB
async function saveHierarchyToMongo({ hierarchy, meta, conversationId }) {
  const db = await connectToDatabase();
  const collection = db.collection('geisinger-docs');
  const domainDocs = hierarchy.map(node => {
    return {
      id: uuidv4(),
      type: 'HierarchyNode',
      conversationId,
      lob: meta.lob || null,
      relativeAUrl: meta.relativeAUrl,
      fileAName: meta.fileAName,
      hierarchyId: node.id,
      chunkId: node.id,
      title: node.title || node.heading,
      level: node.level,
      page: node.page,
      xPos: node.xPos,
      yPos: node.yPos,
      hierarchyLevel: node.level,
      children: node.children,
      parentId: node.parentId || null,
      root: node.root || false,
      indexLink: 'geisinger-002' || null,
      indexMeta: 'meta' || null,
      createdAt: new Date()
    };
  });
  const result = await collection.insertMany(domainDocs);
  return result;
}

// Utility: Get embeddings for chunks
async function getEmbeddingsForChunks(chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) return [];
  const client = getEmbeddingsClient();

  // Estimate tokens: rough approximation of 1 token per 4 characters
  const estimateTokens = (text) => {
    if (typeof text !== 'string') return 0;
    return Math.ceil(text.length / 4);
  };

  // Prepare input texts with proper truncation
  const MAX_CHUNK_CHARS = 7500; // More conservative limit (~1875 tokens per chunk)
  const MAX_BATCH_TOKENS = 7000; // Stay well under 8192 limit for safety

  const inputTexts = chunks.map((chunk) => {
    let content = chunk.content;
    if (typeof content !== 'string') {
      content = String(content || '');
    }
    if (content.length > MAX_CHUNK_CHARS) {
      content = content.slice(0, MAX_CHUNK_CHARS);
    }
    if (content.trim().length === 0) {
      return '[empty content]'; // Provide fallback content
    }
    return content;
  });

  // Use config for throttle
  const config = getGeisingerConfig();
  const throttleMs = config.embedding?.throttleMs || 250;
  let allEmbeddings = [];

  // Dynamic batching based on token count instead of item count
  let i = 0;
  let batchNumber = 0;
  while (i < inputTexts.length) {
    const batch = [];
    let batchTokenCount = 0;

    // Keep adding texts to batch until we'd exceed token limit
    while (i < inputTexts.length) {
      const textTokens = estimateTokens(inputTexts[i]);

      // If single text exceeds max batch tokens, still include it (but log warning)
      if (batch.length > 0 && batchTokenCount + textTokens > MAX_BATCH_TOKENS) {
        break;
      }

      if (textTokens > MAX_BATCH_TOKENS && batch.length === 0) {
        console.warn(`⚠️ [getEmbeddingsForChunks] Single chunk estimated at ${textTokens} tokens exceeds batch limit of ${MAX_BATCH_TOKENS}`);
      }

      batch.push(inputTexts[i]);
      batchTokenCount += textTokens;
      i++;
    }

    if (batch.length === 0) break;

    batchNumber++;
    try {
      const response = await client.embeddings.create({ input: batch });
      if (!response || !response.data) {
        throw new Error('No embeddings returned from API');
      }

      const batchEmbeddings = response.data.map(item => item.embedding);

      if (batchEmbeddings.length !== batch.length) {
        throw new Error(`Embedding batch size mismatch: sent ${batch.length}, received ${batchEmbeddings.length}`);
      }

      allEmbeddings.push(...batchEmbeddings);

      if (i < inputTexts.length) {
        await new Promise(resolve => setTimeout(resolve, throttleMs));
      }
    } catch (error) {
      console.error(`❌ [getEmbeddingsForChunks] Error processing batch ${batchNumber}:`, error.message);
      throw error;
    }
  }

  if (allEmbeddings.length !== chunks.length) {
    throw new Error(`Final embedding count mismatch: ${chunks.length} chunks vs ${allEmbeddings.length} embeddings`);
  }

  return allEmbeddings;
}

// Utility: Batch index chunks in Cognitive Search
async function batchIndexChunksInCognitiveSearch(chunks, embeddings, cognitiveSearchConfig) {
  // Validate inputs before processing
  if (!chunks || chunks.length === 0) {
    return { indexed: 0, skipped: true };
  }

  if (!embeddings || embeddings.length !== chunks.length) {
    const errorMsg = `Embeddings count (${embeddings?.length || 0}) does not match chunks count (${chunks.length})`;
    throw new Error(errorMsg);
  }

  // Use config for index name and fields
  const config = getGeisingerConfig();
  const indexName = cognitiveSearchConfig?.indexName || config.azure?.searchIndex || 'geisinger-002';
  const client = getUpdateClient(indexName);
  const conversationId = cognitiveSearchConfig?.conversationId || '';
  const defaultFields = config.indexing?.defaultFields || [
    "id", "nuid", "smartnote_id", "smart_file_type", "smart_file_name",
    "page", "title", "level", "parentId", "root", "children",
    "content", "content_vector", "createdAt"
  ];

  // Build all documents first
  const allDocs = chunks.map((chunk, i) => {
    let doc = {};
    defaultFields.forEach(field => {
      if (field === "id") doc.id = chunk.id;
      else if (field === "content_vector") doc.content_vector = embeddings[i];
      else if (field === "smartnote_id") doc.smartnote_id = conversationId;
      else if (field === "smart_file_name") doc.smart_file_name = cognitiveSearchConfig?.fileName || chunk.heading;
      else if (field === "smart_file_type") doc.smart_file_type = cognitiveSearchConfig?.fileType || 'pdf';
      else if (field === "title") doc.title = chunk.heading;
      else if (field === "level") doc.level = chunk.level;
      else if (field === "page") doc.page = chunk.page;
      else if (field === "parentId") doc.parentId = chunk.parentId || null;
      else if (field === "root") doc.root = chunk.root || false;
      else if (field === "children") doc.children = chunk.children || [];
      else if (field === "content") doc.content = chunk.content;
      else if (field === "createdAt") doc.createdAt = new Date();
      else if (field === "nuid") doc.nuid = cognitiveSearchConfig?.nuid || '';
      // Add more field mappings as needed
    });
    return doc;
  });

  // Final validation before API call
  if (!allDocs || allDocs.length === 0) {
    return { indexed: 0, skipped: true };
  }

  // Azure Cognitive Search batch upload limits
  // Recommended: 1000 docs or 16MB per batch, whichever is smaller
  const BATCH_SIZE = 100; // Conservative batch size to avoid 413 errors
  const MAX_BATCH_SIZE_MB = 10; // Conservative size limit in MB

  let totalIndexed = 0;
  const totalBatches = Math.ceil(allDocs.length / BATCH_SIZE);

  for (let i = 0; i < allDocs.length; i += BATCH_SIZE) {
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const batchEnd = Math.min(i + BATCH_SIZE, allDocs.length);
    const batchDocs = allDocs.slice(i, batchEnd);

    // Estimate batch size in MB (rough calculation)
    const batchSizeEstimate = JSON.stringify(batchDocs).length / (1024 * 1024);

    try {
      await client.uploadDocuments(batchDocs);
      totalIndexed += batchDocs.length;

      // Add throttling between batches to avoid rate limiting
      if (batchNumber < totalBatches) {
        const throttleMs = 100; // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, throttleMs));
      }

    } catch (error) {
      // For 413 errors, try with smaller batch size
      if (error.statusCode === 413 && batchDocs.length > 10) {
        const smallerBatchSize = Math.max(10, Math.floor(batchDocs.length / 2));

        for (let j = 0; j < batchDocs.length; j += smallerBatchSize) {
          const subBatchEnd = Math.min(j + smallerBatchSize, batchDocs.length);
          const subBatch = batchDocs.slice(j, subBatchEnd);

          try {
            await client.uploadDocuments(subBatch);
            totalIndexed += subBatch.length;

            // Small delay between sub-batches
            if (j + smallerBatchSize < batchDocs.length) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          } catch (subError) {
            throw subError;
          }
        }
      } else {
        throw error;
      }
    }
  }

  return { indexed: totalIndexed, skipped: false };
}

// Utility: Delete all data for a previously processed GeisingerConversation
async function deleteExistingGeisingerConversationData({ fileAName, relativeAUrl }) {
  const db = await connectToDatabase();
  // Set a longer timeout for large delete operations
  const collection = db.collection('geisinger-docs');
  const queryOptions = { maxTimeMS: 600000 }; // 10 minutes
  // Find all GeisingerConversation docs for this file
  const conversations = await collection.find({ type: 'GeisingerConversation', fileAName, relativeAUrl }, queryOptions).toArray();
  for (const convo of conversations) {
    const conversationId = convo.id;
    // Delete hierarchy nodes
    await collection.deleteMany({ type: 'HierarchyNode', conversationId }, queryOptions);
    // Delete GeisingerConversation doc
    await collection.deleteMany({ type: 'GeisingerConversation', id: conversationId }, queryOptions);
    // Delete Cognitive Search index docs
    // Use correct Azure Search SDK pattern
    const indexName = 'geisinger-002';
    const searchClient = getSearchClient(indexName);
    const updateClient = getUpdateClient(indexName);
    // Query for docs with smartnote_id == conversationId
    const searchResults = await searchClient.search('*', {
      filter: `smartnote_id eq '${conversationId}'`,
      select: ['id'],
      top: 1000
    });
    const documentIds = [];
    for await (const result of searchResults.results) {
      documentIds.push({ id: result.document.id });
    }
    if (documentIds.length > 0) {
      await updateClient.deleteDocuments(documentIds);
    }
  }
}

let geisingerConfigSingleton = null;
async function getGeisingerConfig(reset = false) {
  if (reset) geisingerConfigSingleton = null;
  if (geisingerConfigSingleton) return geisingerConfigSingleton;
  const query = { type: 'GeisingerConfig', collectionName: 'Document Conversation', purpose: 'GeneralConfig', title: 'Document Conversation Config For Conversation Prepare' };
  const { data: docs } = await selectGeisingerConfigContextDocuments(query);
  const firstDoc = Array.isArray(docs) ? docs[0] : null;
  const text = String(firstDoc?.documentText || '').trim();

  if (!text) {
    console.warn(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'getGeisingerConfigMissingDocumentLegacy',
        detail: { query },
      }
    }));
    geisingerConfigSingleton = {};
    return geisingerConfigSingleton;
  }

  let config = {};
  try {
    const jsonSchemaMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonSchemaMatch && jsonSchemaMatch[1]) {
      config = JSON.parse(jsonSchemaMatch[1]);
    }
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'getGeisingerConfigParseErrorLegacy',
        detail: {
          query,
          error: error?.message || String(error),
        },
      }
    }));
    config = {};
  }

  geisingerConfigSingleton = config;
  return geisingerConfigSingleton;
}

// Main orchestration function
export async function prepareSharePointPdfsForConversation(geisingerConversation) {
  const startTime = Date.now();
  try {
    getGeisingerConfig(true);

    // Pre-processing: delete any previous data for this file
    await deleteExistingGeisingerConversationData({ fileAName: geisingerConversation.fileAName, relativeAUrl: geisingerConversation.relativeAUrl });

    const { siteName, fileAName, fileId, relativeAUrl, lob, status } = geisingerConversation;
    const db = await connectToDatabase();

    const conversationId = geisingerConversation.id || uuidv4();

    await db.collection('geisinger-docs').insertOne({
      ...geisingerConversation,
      id: conversationId,
      createdAt: new Date()
    });

    // Extract folderName from relativeAUrl
    const folderMatch = relativeAUrl.match(/^\/sites\/[^\/]+\/(.+)\/([^\/]+)$/);
    let folderName = '';
    if (folderMatch && folderMatch.length >= 3) {
      folderName = folderMatch[1];
    } else {
      console.error(`❌ [prepareSharePointPdfsForConversation] Failed to parse folderName from relativeAUrl: ${relativeAUrl}`);
      throw new Error(`Unable to parse folderName from relativeAUrl: ${relativeAUrl}`);
    }

    // Step 1: Copy SharePoint file to Azure Blob Storage
    let withFolderDestBlobName = '';
    if (process.env.USE_VAULT === 'true') {
      withFolderDestBlobName = await streamSharePointFileToBlob({ siteName, folderName, fileName: fileAName, fileId, destBlobName: fileAName });
    } else {
      withFolderDestBlobName = await streamSharePointFileToBlobOrig({ siteName, folderName, fileName: fileAName, destBlobName: fileAName });
    }

    // const withFolderDestBlobName = "Shared Documents/Regulatory and Contractual Documents/Marketplace/CFR-2023-title45-vol2-part156.pdf"

    // Detect file type
    const lowerName = fileAName.toLowerCase();
    const isDocx = lowerName.endsWith('.docx');
    const isPdf = lowerName.endsWith('.pdf');

    let heuristics = null;
    let category = null;
    let fullStructure = [];

    if (isPdf) {
      // Step 2: Parse PDF and extract heuristics from sample
      const extracted = await extractPdfStructure(withFolderDestBlobName);
      heuristics = extracted.heuristics;
      category = extracted.category;

      // Step 3: Parse full PDF and apply heuristics
      const fullExtract = await extractPdfStructureWithHeuristics(withFolderDestBlobName, heuristics);
      fullStructure = fullExtract.structure;
    } else if (isDocx) {
      // DOCX path: extract normalized structure (no heuristics)
      const { structure } = await extractDocxStructure(withFolderDestBlobName);
      fullStructure = structure || [];
    } else {
      console.error(`❌ [prepareSharePointPdfsForConversation] Unsupported file type: ${fileAName}`);
      throw new Error(`Unsupported file type: ${fileAName}`);
    }

    // Validate that structure extraction succeeded
    if (!fullStructure || fullStructure.length === 0) {
      await db.collection('geisinger-docs').updateOne(
        { type: 'GeisingerConversation', id: conversationId },
        { $set: { status: 'Complete - No Content' } }
      );

      return {
        file: fileAName,
        chunkCount: 0,
        embeddingsCount: 0,
        geisingerConversationId: conversationId,
        status: 'Complete - No Content'
      };
    }

    // Step 4: Generate embeddings and index in Cognitive Search
    fullStructure.forEach(item => { item.id = uuidv4(); });

    const embeddings = await getEmbeddingsForChunks(fullStructure);

    await batchIndexChunksInCognitiveSearch(fullStructure, embeddings, { fileName: fileAName, conversationId, fileCategory: category, fileType: isDocx ? 'docx' : 'pdf' });

    // Step 5: Store metadata and hierarchy in MongoDB
    await saveHierarchyToMongo({ hierarchy: fullStructure, meta: { siteName, fileAName, relativeAUrl, lob }, conversationId });

    // // Update status
    await db.collection('geisinger-docs').updateOne(
      { type: 'GeisingerConversation', id: conversationId },
      { $set: { status: 'Complete' } }
    );
    // Return summary
    const totalTime = Date.now() - startTime;
    return {
      file: fileAName,
      chunkCount: fullStructure.length,
      embeddingsCount: embeddings.length,
      geisingerConversationId: conversationId,
      status
    };
  } catch (err) {
    const totalTime = Date.now() - startTime;
    // Attempt safe status update
    try {
      const db = await connectToDatabase();
      const conversationId = geisingerConversation?.id;
      if (conversationId) {
        await db.collection('geisinger-docs').updateOne(
          { type: 'GeisingerConversation', id: conversationId },
          { $set: { status: 'Error', errorMessage: err.message, errorTime: new Date() } }
        );
      }
    } catch (updateErr) {
      // Silent fail on update error
    }

    throw err;
  }
}

export async function findGeisingerConversationsByInferredLobAndStatus(inferredLob, status) {
  // Placeholder for actual DB lookup
  const connection = await connectToDatabase();
  const geisingerConversations = await connection.collection('geisinger-docs').find({ type: 'GeisingerConversation', lob: inferredLob, status }).toArray();
  return geisingerConversations;
}

export async function findGeisingerConversationById(conversationId) {
  // Placeholder for actual DB lookup
  const connection = await connectToDatabase();
  const geisingerConversation = await connection.collection('geisinger-docs').findOne({ type: 'GeisingerConversation', id: conversationId });
  return geisingerConversation;
}

export async function prepareSharePointPdfsForComparison(geisingerComparison) {

  // console.log(`[prepareSharePointPdfsForComparison] called with geisingerComparison: ${JSON.stringify(geisingerComparison)}`);
  const db = await connectToDatabase();
  await db.collection('geisinger-docs').deleteMany({ type: 'GeisingerComparison', lob: geisingerComparison.lob });
  const comparisonId = geisingerComparison.id || uuidv4();
  await db.collection('geisinger-docs').insertOne({
    ...geisingerComparison,
    id: comparisonId,
    status: 'Complete',
    createdAt: new Date()
  });
  return { geisingerComparison };
}

export async function findGeisingerComparisonsByInferredLobAndStatus(inferredLob, status) {
  const connection = await connectToDatabase();
  const geisingerComparisons = await connection.collection('geisinger-docs').find({ type: 'GeisingerComparison', lob: inferredLob, status }).toArray();

  return geisingerComparisons;
}
