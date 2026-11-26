'use server';

import { parseOffice } from 'officeparser';
import { extractPdfText } from '@services/pdfTextExtraction';
import { SearchClient, AzureKeyCredential } from '@azure/search-documents';
import { v4 as uuidv4 } from 'uuid';
import { extractImageText } from '@services/extractImageText';
import { getServerSession } from "@/utils/getSession";
import axios from 'axios';
import FormData from 'form-data';
import { processExcelFile } from '@services/excelToTsvSimple.js';
import { vectorize } from './vectorizeDataService';
import { selectSourceBySourceId } from './sourceService';
import { getFeatureFlag } from './featureFlagService';
import { chatCompletion } from './chatCompletionService2';
import { recordImageProcessed } from './statisticsService';

const smartNoteIndexName = 'smartnote-file-002';
const envName = process.env['envName'];
const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.api.key`];


// Change to an object to cache clients by index name
let searchClients = {};

function getSearchClient(index) {
  index = index ?? smartNoteIndexName;

  // Check if we already have a client for this specific index
  if (!searchClients[index]) {
    // Create a new client for this index
    searchClients[index] = new SearchClient(
      searchEndpoint,
      index,
      new AzureKeyCredential(searchAPIKey)
    );
  }

  // Return the cached client for this index
  return searchClients[index];
}

// Function to chunk the document based on tokens
const chunkDocument = (text, fileType, chunkSize = 512) => {

  // For filetype XML, We will not chunk the document
  if (fileType && fileType.toLowerCase() === 'xml') {
    return [text];  // Return the entire text (document/xml) as a single chunk
  }

  // First handle line breaks consistently
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  const content = lines.join(' ');

  // Check if text contains a significant amount of Chinese characters
  const chineseCharCount = (content.match(/[\u4e00-\u9fff]/g) || []).length;
  const containsChineseText = chineseCharCount > content.length * 0.1; // 10% threshold

  // Different chunking strategies based on text type
  if (containsChineseText) {
    // For Chinese text, chunk by characters directly
    const chunks = [];
    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push(content.substring(i, i + chunkSize));
    }
    return chunks;
  } else {
    // Original approach for non-Chinese text (word-based)
    const words = content.split(/\s+/);
    const chunks = [];
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(' '));
    }
    return chunks;
  }
};

const getFileSuffix = (fileName) => {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
};


// IMAGE Extraction 
const extractTextFromImage = async (base64Image, fileName, teamName, assistantName) => {
  try {
    // Create the API request with image
    const response = await chatCompletion({
      messages: [
        {
          role: "system",
          content: "You are an image analysis assistant that extracts detailed textual information from images. Extract ALL text and describe visual elements like diagrams, charts, and UI components in detail. For flowcharts, describe the complete flow including all nodes and connections. For screenshots, detail every visible UI element and text. Preserve the original formatting and structure. Don't summarize or interpret - extract exactly what's visible."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Please extract all the content from this image file named "${fileName}". Include all text and describe all visual elements in complete detail.`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 4000,
      temperature: 0.7,
      teamName,
      assistantName,
    });

    // Extract and return the text content from the response
    return response;
  } catch (error) {
    console.error('[IMAGE DEBUG] Error in OpenAI image processing:', error);
    throw new Error(`Failed to process image with AI: ${error.message}`);
  }
};





// Function to vectorize and index the document
export const vectorizeAndIndexDocument = async (document, teamName, assistantName) => {
  let response = [];
  const { nuid } = await getServerSession();
  const fileType = getFileSuffix(document.fileName);
  const imageStats = { png: 0, jpg: 0, jpeg: 0, webp: 0, heic: 0, tiff: 0 };

  // Set index based on document type - do this once at the beginning
  let index = smartNoteIndexName; // Default to smartNoteIndexName
  if (document.type === 'SharePointFile') {
    index = `sharepoint-uploads`;
  }

  // Handle Excel files separately - they have their own processing
  if (fileType.toLowerCase() === 'xlsx' || fileType.toLowerCase() === 'xlsm') {
    try {
      // Use processExcelFile for xlsx files and return directly
      return await processExcelFile(Buffer.from(document.fileContent), document, nuid, fileType);
    } catch (error) {
      console.error('Error processing Excel file:', error);
      // Fall back to standard processing if Excel handling fails
      // No return here, continue with normal processing
    }
  }

  // Handle other file types
  let text;
  if (fileType.toLowerCase() === 'txt') {
    text = document.fileContent;
  }
  else if (fileType.toLowerCase() === 'xml') {
    // Handle XML files as text (no parsing needed)
    text = typeof document.fileContent === 'string'
      ? document.fileContent
      : Buffer.from(document.fileContent).toString('utf-8');
  }
  else if (fileType.toLowerCase() === 'pdf') {
    const featureFlag = await getFeatureFlag('pdf-images');
    if (featureFlag && featureFlag.enabled) {
      try {
        // Use extractImageText to get both text and embedded images
        const pdfResult = await extractImageText(Buffer.from(document.fileContent), document.fileName, { includeImageDescriptions: true }, teamName, assistantName);
        text = pdfResult.enrichedText; // Use enriched text with embedded image descriptions
        console.log(`Processed PDF with embedded images`);
      } catch (error) {
        console.error('Error extracting text from PDF:', error);
        // Fall back to standard PDF extraction if the new method fails
        try {
          const pdfData = await extractPdfText(Buffer.from(document.fileContent));
          text = pdfData.text;
          console.log('Using fallback PDF extraction method');
        } catch (fallbackError) {
          console.error('Both PDF extraction methods failed:', fallbackError);
          throw new Error('Failed to process PDF file');
        }
      }
    } else {
      try {
        const pdfData = await extractPdfText(Buffer.from(document.fileContent));
        text = pdfData.text;
        console.log('Using standard PDF extraction method');
      } catch (error) {
        console.error('Standard PDF extraction failed:', error);
        throw new Error('Failed to process PDF file');
      }
    }
  } else if (['png', 'jpg', 'jpeg', 'webp', 'heic', 'tiff'].includes(fileType.toLowerCase())) {
    try {
      // Track image type statistics for storing in DB 
      const normalizedType = fileType.toLowerCase();
      if (imageStats[normalizedType] !== undefined) {
        imageStats[normalizedType]++;
      }
      if (imageStats[normalizedType].length > 0) {
        let params = {
          imageType: 'direct',
          fileFormat: normalizedType,
          count: imageStats[normalizedType],
        }
        recordImageProcessed(nuid, null, teamName, assistantName, params);
      }
      // console.log(`[IMAGE DEBUG] Processing image file: ${document.fileName}`);
      // Convert image to base64
      const base64Image = Buffer.from(document.fileContent).toString('base64');
      // console.log(`[IMAGE DEBUG] Converted image to base64, length: ${base64Image.length}`);

      // Process with GPT-4o
      // console.log(`[IMAGE DEBUG] Sending image to OpenAI for text extraction...`);
      text = await extractTextFromImage(base64Image, document.fileName, teamName, assistantName);
      // const previewLength = 300;
      // console.log(`[IMAGE DEBUG] Text extracted from image (first ${previewLength} chars):`);

    } catch (error) {
      console.error('Error processing image:', error);
      throw new Error('Failed to process image file');
    }
  } else if (fileType.toLowerCase() === 'docx') {
    try {
      // Use extractImageText for DOCX to extract both text and embedded images
      const docResult = await extractImageText(Buffer.from(document.fileContent), document.fileName, { includeImageDescriptions: true }, teamName, assistantName);
      text = docResult.enrichedText;
      console.log(`Processed ${fileType} with ${docResult.metadata.imageCount} embedded images`);
    } catch (error) {
      console.error(`Error extracting text from ${fileType}:`, error);
      // Fall back to standard Office extraction
      text = (await parseOffice(document.fileContent)).toText();
      console.log('Using fallback Office extraction method');
    }
  } else {
    // For other Office formats
    text = (await parseOffice(document.fileContent)).toText();
  }



  // Ensure text is a string before chunking
  if (typeof text !== 'string') {
    console.error('Error: extracted text is not a string', typeof text);
    text = String(text || ''); // Convert to string or use empty string if null/undefined
  }

  const chunks = chunkDocument(text, fileType);

  // Collect all documents first
  const allDocuments = [];
  for (const chunk of chunks) {
    // Retry logic for 429 errors during vectorization
    let attempt = 0;
    const maxAttempts = 5;
    let lastError;
    let contentVector;
    while (attempt < maxAttempts) {
      try {
        contentVector = await vectorize({ nuid, content: chunk });
        break;
      } catch (vectorizeError) {
        if (vectorizeError.cause && vectorizeError.cause.statusCode === 429) {
          attempt++;
          lastError = vectorizeError;
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(res => setTimeout(res, delay));
        } else {
          console.error('Error vectorizing chunk:', vectorizeError);
          throw vectorizeError;
        }
      }
    }
    if (attempt === maxAttempts) {
      console.error('Max retries reached for vectorize due to 429 errors:', lastError);
      throw lastError;
    }
    if (document.type === 'SharePointFile') {
      const siteName = document.relativeUrl.split('/')[2];
      allDocuments.push({
        '@search.action': 'upload',
        id: uuidv4(),
        nuid: nuid,
        smartnote_id: document.parentId,
        site_name: siteName.toLowerCase(),
        file_type: fileType,
        file_name: document.fileName,
        file_category: 'User',
        relative_url: document.relativeUrl,
        content: chunk,
        content_vector: contentVector
      });
    } else if (document.type === 'UploadedDocument') {
      allDocuments.push({
        '@search.action': 'upload',
        id: uuidv4(),
        nuid: nuid,
        smartnote_id: document.parentId,
        smart_file_type: fileType,
        smart_file_name: document.fileName,
        smart_file_category: 'User',
        content: chunk,
        content_vector: contentVector
      });
    }
  }

  // Upload in batches of 50
  for (let i = 0; i < allDocuments.length; i += 50) {
    const batch = allDocuments.slice(i, i + 50);
    let attempt = 0;
    const maxAttempts = 5;
    let lastError;
    while (attempt < maxAttempts) {
      try {
        response.push(await getSearchClient(index).uploadDocuments(batch));
        break;
      } catch (err) {
        if (err.statusCode === 429 || err.code === 429 || (err.response && err.response.status === 429)) {
          attempt++;
          lastError = err;
          const delay = Math.pow(2, attempt) * 250;
          await new Promise(res => setTimeout(res, delay));
        } else {
          throw err;
        }
      }
    }
    if (attempt === maxAttempts) {
      console.error('Max retries reached for uploadDocuments due to 429 errors:', lastError);
      throw lastError;
    }
  }
  return response;
};

// Function to vectorize and index the document
export const vectorizeAndIndexETSDocument = async (document, index = 'ets-001') => {
  let response = [];
  const { nuid } = await getServerSession();
  const fileType = getFileSuffix(document.fileName);


  // Handle Excel files separately - they have their own processing
  if (fileType.toLowerCase() === 'xlsx' || fileType.toLowerCase() === 'xlsm') {
    try {
      return await processExcelFile(Buffer.from(document.fileContent), document, nuid, fileType);
    } catch (error) {
      console.error('Error processing Excel file:', error);
    }
  }

  // Handle other file types
  let text;
  if (fileType.toLowerCase() === 'txt') {
    text = document.fileContent;
  } else if (fileType.toLowerCase() === 'pdf') {
    const featureFlag = await getFeatureFlag('pdf-images');
    if (featureFlag && featureFlag.enabled) {
      try {
        // Use extractImageText to get both text and embedded images
        const pdfResult = await extractImageText(Buffer.from(document.fileContent), document.fileName, { includeImageDescriptions: true }, 'ets', 'admin-indexer');
        text = pdfResult.enrichedText; // Use enriched text with embedded image descriptions
        console.log(`Processed PDF with embedded images`);
      } catch (error) {
        console.error('Error extracting text from PDF:', error);
        // Fall back to standard PDF extraction if the new method fails
        try {
          const pdfData = await extractPdfText(Buffer.from(document.fileContent));
          text = pdfData.text;
          console.log('Using fallback PDF extraction method');
        } catch (fallbackError) {
          console.error('Both PDF extraction methods failed:', fallbackError);
          throw new Error('Failed to process PDF file');
        }
      }
    } else {
      try {
        const pdfData = await extractPdfText(Buffer.from(document.fileContent));
        text = pdfData.text;
        console.log('Using standard PDF extraction method');
      } catch (error) {
        console.error('Standard PDF extraction failed:', error);
        throw new Error('Failed to process PDF file');
      }
    }
  } else if (['png', 'jpg', 'jpeg', 'webp', 'heic', 'tiff'].includes(fileType.toLowerCase())) {
    try {

      const base64Image = Buffer.from(document.fileContent).toString('base64');
      text = await extractTextFromImage(base64Image, document.fileName, 'ets', 'admin-indexer');

    } catch (error) {
      console.error('Error processing image:', error);
      throw new Error('Failed to process image file');
    }
  } else if (fileType.toLowerCase() === 'docx') {
    try {
      // Use extractImageText for DOCX to extract both text and embedded images
      const docResult = await extractImageText(Buffer.from(document.fileContent), document.fileName, { includeImageDescriptions: true }, 'ets', 'admin-indexer');
      text = docResult.enrichedText;
      console.log(`Processed ${fileType} with ${docResult.metadata.imageCount} embedded images`);
    } catch (error) {
      console.error(`Error extracting text from ${fileType}:`, error);
      // Fall back to standard Office extraction
      text = (await parseOffice(document.fileContent)).toText();
      console.log('Using fallback Office extraction method');
    }
  } else {
    // For other Office formats
    text = (await parseOffice(document.fileContent)).toText();
  }


  // Ensure text is a string before chunking
  if (typeof text !== 'string') {
    console.error('Error: extracted text is not a string', typeof text);
    text = String(text || ''); // Convert to string or use empty string if null/undefined
  }

  const chunks = chunkDocument(text);

  // Collect all documents first
  const allDocuments = [];
  for (const chunk of chunks) {
    // Retry logic for 429 errors during vectorization
    let attempt = 0;
    const maxAttempts = 5;
    let lastError;
    let contentVector;
    while (attempt < maxAttempts) {
      try {
        contentVector = await vectorize({ nuid, content: chunk });
        break;
      } catch (vectorizeError) {
        if (vectorizeError.cause && vectorizeError.cause.statusCode === 429) {
          attempt++;
          lastError = vectorizeError;
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(res => setTimeout(res, delay));
        } else {
          console.error('Error vectorizing chunk:', vectorizeError);
          throw vectorizeError;
        }
      }
    }
    if (attempt === maxAttempts) {
      console.error('Max retries reached for vectorize due to 429 errors:', lastError);
      throw lastError;
    }
    allDocuments.push({
      '@search.action': 'upload',
      doc_id: uuidv4(),
      doc_name: document.fileName,
      doc_type: fileType,
      page_num: null, // set to null for now
      project_id: document.projectId,
      project_name: document.projectName,
      tag: document.tag,
      content: chunk,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      content_vector: contentVector
    });
  }

  for (let i = 0; i < allDocuments.length; i += 50) {
    const batch = allDocuments.slice(i, i + 50);
    let attempt = 0;
    const maxAttempts = 5;
    let lastError;
    while (attempt < maxAttempts) {
      try {
        response.push(await getSearchClient(index).uploadDocuments(batch));
        break;
      } catch (err) {
        if (err.statusCode === 429 || err.code === 429 || (err.response && err.response.status === 429)) {
          attempt++;
          lastError = err;
          const delay = Math.pow(2, attempt) * 250;
          await new Promise(res => setTimeout(res, delay));
        } else {
          throw err;
        }
      }
    }
    if (attempt === maxAttempts) {
      console.error('Max retries reached for uploadDocuments due to 429 errors:', lastError);
      throw lastError;
    }
  }
  return response;
};

export const vectorizeWithExternalService = async (document, file, teamName, assistantName) => {
  switch (assistantName) {
    case 'document-management-shared-service':
      return await vectorizeForDmss(document, file, teamName);
    case 'products':
    case 'kpif':
      return await vectorizeWithHipos(document, file);
    default:
      throw new Error(`No external vectorization service available for: ${assistantName}`);
  }
}

const vectorizeForDmss = async (document, file, teamName) => {
  let targetUrl = `${process.env.ORCHESTRATION_APP_URL}/api/dmss/indexer`;
  const { nuid } = await getServerSession();
  const formData = new FormData();
  formData.append('query', JSON.stringify({ smartnote_id: document.parentId, nuid: nuid, filter: 'latest' }));

  if (file.arrayBuffer) {
    const buffer = Buffer.from(await file.arrayBuffer());

    // Query the DB for the related source
    const source = await selectSourceBySourceId(document.id, document.parentId, teamName);

    // depending on the source type, append the correct formData
    switch (source.category) {
      case 'Letter':
        formData.append('letters', buffer, file.name);
        break;
      case 'Test Case Template':
        formData.append('test_case_templates', buffer, file.name);
        break;
      case 'Assignment Sheet':
        formData.append('assignment_sheets', buffer, file.name);
        break;
      case 'Uploaded Note':
        formData.append('uploaded_notes', buffer, file.name);
        break;
      default:
        throw new Error(`Unsupported source category: ${source.category || 'null'}`);
    }
  }

  const response = await axios.post(targetUrl,
    formData,
    {
      headers: {
        ...formData.getHeaders(), // Include headers generated by FormData
      },
    }
  );

  return response.data;
}
export const vectorizeWithHipos = async (document, file) => {
  let targetUrl = `${process.env.ORCHESTRATION_APP_URL}/api/hipos/file-process`
  const { nuid } = await getServerSession();
  const formData = new FormData();
  formData.append('query', JSON.stringify({ smartnote_id: document.parentId, nuid: nuid, filter: 'latest' }));

  if (file.arrayBuffer) {
    const buffer = Buffer.from(await file.arrayBuffer());

    formData.append('files', buffer, file.name);
  }

  const response = await axios.post(targetUrl,
    formData,
    {
      headers: {
        ...formData.getHeaders(), // Include headers generated by FormData
      },
    }
  );

  return response.data;
}