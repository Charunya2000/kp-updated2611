// uploadSpreadsheetToBlobNode.js

import { writeFileBufferToBlobStorage, generateTemporaryDownloadLink } from '../../../blobStorageService.js';
import fs from 'fs';
import path from 'path';

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

    const BLOB_CONTAINER = 'compliance-ai';
    try {
      const blobServiceClient = BlobServiceClient.fromConnectionString(BLOB_STORAGE_CONNECTION_STRING);
      containerClientSingleton = blobServiceClient.getContainerClient(BLOB_CONTAINER);
    } catch (error) {
      console.error('❌ [getContainerClient] Failed to create blob storage client:', error.message);
      throw error;
    }
  }
  return containerClientSingleton;
}

export const uploadSpreadsheetToBlobNode = async (state) => {
  const { updateChatInteractionProgress } = await import('../helpers/progressTracking');

  let progressResponse = state.progressResponse || "## Comparison Progress\n\n";
  progressResponse += "⏳ Uploading spreadsheet to blob storage...\n\n---\n";

  // Update progress
  if (state.chatInteractionId) {
    await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
  }

  const { spreadsheetPath, spreadsheetFileName, geisingerConversationA, geisingerConversationB } = state;

  if (!spreadsheetPath || !spreadsheetFileName) {
    console.error(`❌ [uploadSpreadsheetToBlobNode] Missing spreadsheet path or filename`);
    console.error(`   spreadsheetPath: ${spreadsheetPath}`);
    console.error(`   spreadsheetFileName: ${spreadsheetFileName}`);
    progressResponse = progressResponse.replace("⏳", "❌");
    if (state.chatInteractionId) {
      await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
    }
    return {
      ...state,
      errorMessage: "Missing spreadsheet data for upload",
      progressResponse
    };
  }
  const startTime = Date.now();

  try {
    // Create blob path with organized folder structure
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const conversationAId = geisingerConversationA?.id || 'unknown';
    const conversationBId = geisingerConversationB?.id || 'unknown';
    const containerName = 'compliance-ai';
    const blobPath = `document-comparisons/${timestamp}/${conversationAId}-vs-${conversationBId}/${spreadsheetFileName}`;

    // Read file buffer
    const fileBuffer = fs.readFileSync(spreadsheetPath);
    const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    // Upload file buffer to blob storage
    const uploadSuccess = await writeFileBufferToBlobStorage(fileBuffer, containerName, blobPath, contentType);
    if (!uploadSuccess) {
      throw new Error('Blob upload failed');
    }

    // Generate a secure SAS download link (valid for 24 hours)
    const downloadUrl = await generateTemporaryDownloadLink(containerName, blobPath, 1440);

    // Clean up temporary file
    try {
      fs.unlinkSync(spreadsheetPath);
    } catch (cleanupError) {
      console.warn(`⚠️  [uploadSpreadsheetToBlobNode] Failed to clean up temp file: ${cleanupError.message}`);
    }

    const uploadTime = Date.now() - startTime;
    // Mark upload complete
    progressResponse = progressResponse.replace("⏳ Uploading", "✓ Uploading");
    if (state.chatInteractionId) {
      await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
    }

    return {
      ...state,
      spreadsheetBlobName: blobPath,
      downloadLink: downloadUrl,
      uploadMetadata: {
        uploadTime: uploadTime,
        fileSize: fileBuffer.length,
        timestamp: new Date().toISOString()
      },
      progressResponse
    };

  } catch (error) {
    console.error(`❌ [uploadSpreadsheetToBlobNode] Upload failed:`, error);
    progressResponse = progressResponse.replace("⏳", "❌");
    if (state.chatInteractionId) {
      await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
    }
    // Try to clean up temp file even on error
    try {
      if (fs.existsSync(spreadsheetPath)) {
        fs.unlinkSync(spreadsheetPath);
      }
    } catch (cleanupError) {
      console.warn(`⚠️  [uploadSpreadsheetToBlobNode] Failed to clean up temp file after error: ${cleanupError.message}`);
    }
    return {
      ...state,
      errorMessage: `Spreadsheet upload failed: ${error.message}`,
      downloadLink: null,
      progressResponse
    };
  }
};