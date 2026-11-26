/**
 * Script to upload a file to Azure Blob Storage using the blobStorageService.
 * Usage: node scripts/blob-storage/uploadToBlob.js
 */

import { loadEnvLocal } from '../../utils/envLoader.js';
import { setProcessEnvironment } from '../configActions.js';
import { BlobServiceClient } from "@azure/storage-blob";
import { getContentType } from '../../utils/constants.js';
import fs from 'fs';


async function main() {
  // load environment variables
  loadEnvLocal();
  // run setProcessEnvironment
  await setProcessEnvironment();

  // Configure your upload here
  const config = {
    teamName: 'test-team',           // Team name
    assistantName: 'test-assistant',  // Assistant name
    smartNoteId: 'test-note-123',     // Smart note ID
    fileName: 'README.md',            // File name for the blob
    filePath: './README.md'           // Local file path to upload
  };

  // Validate file exists
  if (!fs.existsSync(config.filePath)) {
    console.error(`File not found: ${config.filePath}`);
    process.exit(1);
  }

  console.log('Uploading file to blob storage:', config);

  try {
    // Read file buffer
    const fileBuffer = fs.readFileSync(config.filePath);

    // Upload using blobStorageService
    const fileUrl = await uploadFileToBlob(
      config.teamName,
      config.assistantName,
      config.smartNoteId,
      config.fileName,
      fileBuffer
    );

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'uploadToBlob',
        detail: {
          teamName: config.teamName,
          assistantName: config.assistantName,
          smartNoteId: config.smartNoteId,
          fileName: config.fileName,
          fileUrl
        }
      }
    }));

    console.log('Success! File uploaded to:', fileUrl);
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'uploadToBlob',
        detail: {
          teamName: config.teamName,
          fileName: config.fileName,
          error: error.message
        }
      }
    }));
    console.error('Error uploading to blob storage:', error);
    process.exit(1);
  }
}

async function uploadFileToBlob(teamName, assistantName, smartNoteId, fileName, fileBuffer) {
  try {
    const envName = process.env.envName || 'dev';
    const azureStorageConnectionString = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.blobstorage.endpoint`];

    if (!azureStorageConnectionString) {
      throw new Error('Azure Storage connection string not configured');
    }

    const containerName = `uploadeddocuments-${teamName.toLowerCase()}`;
    const filePath = `${assistantName}/${smartNoteId}/${fileName}`;



    const blobServiceClient = BlobServiceClient.fromConnectionString(azureStorageConnectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    await containerClient.createIfNotExists();

    const blobClient = containerClient.getBlockBlobClient(filePath);

    await blobClient.upload(fileBuffer, fileBuffer.length, {
      blobHTTPHeaders: { blobContentType: getContentType(fileName) }
    });

    const fileUrl = blobClient.url;

    return fileUrl;
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'uploadFileToBlob',
        detail: {
          error: error?.message || 'Failed to upload document to blob storage'
        }
      }
    }));
    throw error;
  }
}

main();
