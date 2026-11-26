import { BlobSASPermissions, BlobServiceClient, generateBlobSASQueryParameters, StorageSharedKeyCredential } from "@azure/storage-blob";
import fetch from "node-fetch";
// Use a relative import (not the "@/" alias) so this module resolves under Node's native
// ESM loader too. The EDI Workbench validation worker loads this file's import graph
// directly via Node (bypassing Turbopack/jsconfig path aliases), and "@/..." specifiers
// are not resolvable there.
import { getContentType } from '../../utils/constants.js';

let blockBlobClient = null;

/**
 * Downloads an image from a URL and uploads it to Azure Blob Storage with a SAS URL.
 * @param {string} imageUrl - The URL of the image to download.
 * @param {string} containerName - The name of the blob container.
 * @param {string} blobName - The name of the blob (file name in storage).
 * @returns {string} - The SAS URL of the uploaded blob.
 */
export async function downloadAndUploadImageWithSAS(imageUrl, containerName, blobName) {
  try {
    // Fetch the image from the URL
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from URL: ${imageUrl}`);
    }

    // Get the image buffer and content type
    const imageBuffer = await response.buffer();

    // Upload the image to Azure Blob Storage and generate a SAS URL
    return imageBuffer;
  } catch (error) {
    console.error("Error downloading and uploading image:", error);
    throw error;
  }
}

/**
 * Uploads a file to Azure Blob Storage and generates a SAS URL.
 * @param {Buffer} fileBuffer - The file buffer to upload.
 * @param {string} containerName - The name of the blob container.
 * @param {string} blobName - The name of the blob (file name in storage).
 * @returns {Promise<boolean>} result - An indicator that the upload was successful or not.
 */
export async function writeFileBufferToBlobStorage(fileBuffer, containerName, blobName, contentType) {
  try {
    blockBlobClient = await getBlockBlobClient(containerName, blobName);

    const uploadResult = await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
      blobHTTPHeaders: { blobContentType: contentType },
      timeoutInMs: 60000, // 60 second timeout
    });

    if (uploadResult._response.status !== 201) {
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error uploading file to blob:", error);
    // Reset the cached client on error to prevent reusing stale connection
    blockBlobClient = null;
    return false;
  }
}

/**
 * Generates a temporary public download link for a blob in Azure Blob Storage.
 * @param {string} containerName - The name of the blob container.
 * @param {string} blobName - The name of the blob (file name in storage).
 * @param {number} expiryMinutes - The number of minutes the link should be valid.
 * @param {string} [downloadFileName] - Optional filename for an attachment response.
 * @returns {Promise<string>} sasUrl - The temporary public download link (SAS URL).
 */
export async function readFileBufferFromBlobStorage(
  containerName,
  blobName
) {
  try {
      if (!containerName) {
          throw new Error(
              "containerName is required."
          );
      }

      if (!blobName) {
          throw new Error(
              "blobName is required."
          );
      }

      const envName =
          process.env.envName ||
          "dev";

      const connectionStringKey =
          `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.blobstorage.endpoint`;

      const azureStorageConnectionString =
          process.env[
              connectionStringKey
          ];

      if (!azureStorageConnectionString) {
          throw new Error(
              "Azure Storage connection string is not configured."
          );
      }

      const blobServiceClient =
          BlobServiceClient.fromConnectionString(
              azureStorageConnectionString
          );

      const containerClient =
          blobServiceClient.getContainerClient(
              containerName
          );

      const containerExists =
          await containerClient.exists();

      if (!containerExists) {
          throw new Error(
              `Blob container does not exist: ${containerName}`
          );
      }

      const blobClient =
          containerClient.getBlockBlobClient(
              blobName
          );

      const blobExists =
          await blobClient.exists();

      if (!blobExists) {
          throw new Error(
              `Blob does not exist: ${containerName}/${blobName}`
          );
      }

      const downloadResponse =
          await blobClient.download(
              0
          );

      if (
          !downloadResponse.readableStreamBody
      ) {
          throw new Error(
              "Azure Blob Storage returned an empty download stream."
          );
      }

      const chunks = [];

      for await (
          const chunk of
          downloadResponse.readableStreamBody
      ) {
          chunks.push(
              Buffer.isBuffer(chunk)
                  ? chunk
                  : Buffer.from(chunk)
          );
      }

      const fileBuffer =
          Buffer.concat(
              chunks
          );

      if (!fileBuffer.length) {
          throw new Error(
              `Downloaded Blob is empty: ${containerName}/${blobName}`
          );
      }

      console.log(
          "[BLOB STORAGE] Download completed:",
          {
              containerName,
              blobName,
              fileSize:
                  fileBuffer.length
          }
      );

      return fileBuffer;
  } catch (error) {
      console.error(
          "[BLOB STORAGE] Download failed:",
          {
              containerName,
              blobName,
              error:
                  error instanceof Error
                      ? error.message
                      : String(error)
          }
      );

      throw error;
  }
} 

export async function generateTemporaryDownloadLink(containerName, blobName, expiryMinutes, downloadFileName) {
  try {
    const envName = process.env.envName || 'dev';

    // Use explicit environment variables for accountName and accountKey
    const accountName = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.blobstorage.accountName`];
    const accountKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.blobstorage.accountKey`];

    if (!accountName || !accountKey) {
      throw new Error('Azure Storage account name or key not configured');
    }

    // Create blob client
    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
    const blobServiceClient = new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, sharedKeyCredential);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);

    // Define SAS token parameters
    const sasOptions = {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse("r"), // Read permission
      expiresOn: new Date(new Date().getTime() + expiryMinutes * 60 * 1000), // Expiry time
      ...(downloadFileName ? {
        contentDisposition: `attachment; filename="${downloadFileName}"`,
      } : {}),
    };

    // Generate the SAS token
    const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential).toString();

    // Combine the SAS token with the blob URL
    const sasUrl = `${blobClient.url}?${sasToken}`;

    return sasUrl;
  } catch (error) {
    console.error("Error generating SAS URL:", error);
    throw error;
  }
}

/**
 * Generates a temporary upload link for a blob in Azure Blob Storage.
 * @param {string} containerName - The name of the blob container.
 * @param {string} blobName - The name of the blob (file path in storage).
 * @param {number} expiryMinutes - The number of minutes the link should be valid.
 * @returns {Promise<string>} sasUrl - The temporary upload link (SAS URL).
 */
export async function generateTemporaryUploadLink(containerName, blobName, expiryMinutes = 15) {
  try {
    const envName = process.env.envName || 'dev';
    const accountName = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.blobstorage.accountName`];
    const accountKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.blobstorage.accountKey`];

    if (!accountName || !accountKey) {
      throw new Error('Azure Storage account name or key not configured');
    }

    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
    const blobServiceClient = new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, sharedKeyCredential);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    await containerClient.createIfNotExists();
    const blobClient = containerClient.getBlobClient(blobName);

    const sasOptions = {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse('cw'),
      expiresOn: new Date(Date.now() + (expiryMinutes * 60 * 1000)),
    };

    const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential).toString();
    return `${blobClient.url}?${sasToken}`;
  } catch (error) {
    console.error('Error generating upload SAS URL:', error);
    throw error;
  }
}

export async function getBlockBlobClient(containerName, blobName) {
  try {
    const envName = process.env.envName || 'dev';
    const azureStorageConnectionString = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.blobstorage.endpoint`];

    if (!azureStorageConnectionString) {
      throw new Error('Azure Storage connection string not configured');
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(azureStorageConnectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    await containerClient.createIfNotExists();
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    return blockBlobClient;
  } catch (error) {
    console.error("Error getting block blob client:", error);
    throw error;
  }
}

export async function downloadBlobText(containerName, blobName) {
  try {
    const blobClient = await getBlockBlobClient(containerName, blobName);
    const exists = await blobClient.exists();

    if (!exists) {
      throw new Error(`Blob not found: ${containerName}/${blobName}`);
    }

    const fileBuffer = await blobClient.downloadToBuffer();
    return fileBuffer.toString('utf-8');
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'downloadBlobText',
        detail: {
          containerName,
          blobName,
          error: error?.message || 'Failed to download blob text'
        }
      }
    }));
    throw error;
  }
}

export async function downloadBlobReadableStream(containerName, blobName) {
  try {
    const blobClient = await getBlockBlobClient(containerName, blobName);
    const exists = await blobClient.exists();

    if (!exists) {
      throw new Error(`Blob not found: ${containerName}/${blobName}`);
    }

    const response = await blobClient.download();
    if (!response?.readableStreamBody) {
      throw new Error(`Blob download stream unavailable for ${containerName}/${blobName}`);
    }

    return response.readableStreamBody;
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'downloadBlobReadableStream',
        detail: {
          containerName,
          blobName,
          error: error?.message || 'Failed to download blob stream'
        }
      }
    }));
    throw error;
  }
}

export async function uploadFileToBlob(teamName, assistantName, smartNoteId, fileName, fileBuffer) {
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
        name: 'UPLOAD- Document to Blob Storage',
        detail: {
          error: error?.message || 'Failed to upload document to blob storage'
        }
      }
    }));
    throw error;
  }
}

/**
 * Deletes a file from Azure Blob Storage.
 * @param {string} teamName - The team name.
 * @param {string} assistantName - The assistant name.
 * @param {string} smartNoteId - The smart note ID.
 * @param {string} fileName - The name of the file to delete.
 * @returns {Promise<boolean>} - True if deletion was successful, false otherwise.
 */
export async function deleteFileFromBlob(teamName, assistantName, smartNoteId, fileName) {
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
    const blobClient = containerClient.getBlockBlobClient(filePath);

    // Check if blob exists before attempting deletion
    const exists = await blobClient.exists();
    if (!exists) {
      console.log(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'DELETE - Document from Blob Storage',
          detail: {
            containerName,
            filePath,
            message: 'Blob does not exist, skipping deletion'
          }
        }
      }));
      return true; // Return true since the desired state (file not existing) is achieved
    }

    // Delete the blob
    await blobClient.delete();

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'DELETE - Document from Blob Storage',
        detail: {
          containerName,
          filePath,
          message: 'Successfully deleted blob'
        }
      }
    }));

    return true;
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'DELETE - Document from Blob Storage',
        detail: {
          teamName,
          assistantName,
          smartNoteId,
          fileName,
          error: error?.message || 'Failed to delete document from blob storage'
        }
      }
    }));
    // Don't throw error to prevent failure of entire delete operation
    // Log the error and return false to indicate blob deletion failed
    return false;
  }
}

/**
 * Lists all containers in Azure Blob Storage.
 * @returns {Promise<string[]>} - Array of container names.
 */
export async function listContainers() {
  try {
    const envName = process.env.envName || 'dev';
    const azureStorageConnectionString = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.blobstorage.endpoint`];

    if (!azureStorageConnectionString) {
      throw new Error('Azure Storage connection string not configured');
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(azureStorageConnectionString);
    const containerNames = [];

    for await (const container of blobServiceClient.listContainers()) {
      containerNames.push(container.name);
    }

    return containerNames;
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'listContainers',
        detail: { error: error?.message || 'Failed to list blob containers' }
      }
    }));
    throw error;
  }
}

/**
 * Lists all blobs within a specific container.
 * @param {string} containerName - The name of the container.
 * @param {string} [prefix] - Optional blob name prefix.
 * @returns {Promise<string[]>} - Array of blob names.
 */
export async function listBlobsInContainer(containerName, prefix) {
  try {
    const envName = process.env.envName || 'dev';
    const azureStorageConnectionString = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.blobstorage.endpoint`];

    if (!azureStorageConnectionString) {
      throw new Error('Azure Storage connection string not configured');
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(azureStorageConnectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobNames = [];

    if (!(await containerClient.exists())) {
      return blobNames;
    }

    for await (const blob of containerClient.listBlobsFlat(prefix ? { prefix } : undefined)) {
      blobNames.push(blob.name);
    }

    return blobNames;
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'listBlobsInContainer',
        detail: { containerName, error: error?.message || 'Failed to list blobs in container' }
      }
    }));
    throw error;
  }
}

/**
 * Deletes a blob from a specified container in Azure Blob Storage.
 * @param {string} containerName - The name of the container.
 * @param {string} blobName - The name of the blob to delete.
 * @returns {Promise<void>}
 */
export async function deleteBlobFromContainer(containerName, blobName) {
  const envName = process.env.envName || 'dev';
  const azureStorageConnectionString = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.blobstorage.endpoint`];

  if (!azureStorageConnectionString) {
    throw new Error('Azure Storage connection string not configured');
  }

  const blobServiceClient = BlobServiceClient.fromConnectionString(azureStorageConnectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blobClient = containerClient.getBlockBlobClient(blobName);

  const exists = await blobClient.exists();
  if (!exists) {
    throw new Error(`Blob not found: ${containerName}/${blobName}`);
  }

  await blobClient.delete();

  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'deleteBlobFromContainer',
      detail: { containerName, blobName, message: 'Successfully deleted blob' }
    }
  }));
}

/**
 * Uploads a blob to a specified container in Azure Blob Storage.
 * @param {string} containerName - The name of the container.
 * @param {string} blobName - The name of the blob (file name in storage).
 * @param {Buffer} buffer - The file buffer to upload.
 * @param {string} contentType - The MIME type of the file.
 * @returns {Promise<boolean>} - Whether the upload succeeded.
 */
export async function uploadBlobToContainer(containerName, blobName, buffer, contentType) {
  try {
    const envName = process.env.envName || 'dev';
    const azureStorageConnectionString = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.blobstorage.endpoint`];

    if (!azureStorageConnectionString) {
      throw new Error('Azure Storage connection string not configured');
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(azureStorageConnectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // Create the container if it does not exist.
    await containerClient.createIfNotExists();

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const uploadResult = await blockBlobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: { blobContentType: contentType },
    });

    if (uploadResult._response.status !== 201) {
      return false;
    }

    return true;
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'uploadBlobToContainer',
        detail: { containerName, blobName, error: error?.message || 'Failed to upload blob' }
      }
    }));
    throw error;
  }
}

/**
 * Deletes all files for a SmartNote from Azure Blob Storage.
 * @param {string} teamName - The team name.
 * @param {string} assistantName - The assistant name.
 * @param {string} smartNoteId - The smart note ID.
 * @returns {Promise<{success: boolean, deletedCount: number, errors: Array}>} - Result of deletion operation.
 */
export async function deleteSmartNoteFilesFromBlob(teamName, assistantName, smartNoteId) {
  try {
    const envName = process.env.envName || 'dev';
    const connectionStringKey = `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.blobstorage.endpoint`;
    const azureStorageConnectionString = process.env[connectionStringKey];

    if (!azureStorageConnectionString) {
      console.error(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'deleteSmartNoteFilesFromBlob - No Connection String',
          detail: {
            teamName,
            assistantName,
            smartNoteId,
            connectionStringKey
          }
        }
      }));
      return { success: false, deletedCount: 0, errors: ['Connection string not configured'] };
    }

    const containerName = `uploadeddocuments-${teamName.toLowerCase()}`;
    const prefix = `${assistantName}/${smartNoteId}/`;

    const blobServiceClient = BlobServiceClient.fromConnectionString(azureStorageConnectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // Check if container exists
    const containerExists = await containerClient.exists();
    if (!containerExists) {
      return { success: true, deletedCount: 0, errors: [] };
    }

    // List all blobs with the prefix
    const blobs = [];
    for await (const blob of containerClient.listBlobsFlat({ prefix })) {
      blobs.push(blob.name);
    }

    if (blobs.length === 0) {
      return { success: true, deletedCount: 0, errors: [] };
    }

    // Delete all blobs in parallel for better performance
    let deletedCount = 0;
    const errors = [];

    const deletionPromises = blobs.map(async (blobName) => {
      try {
        const blobClient = containerClient.getBlockBlobClient(blobName);
        await blobClient.delete();
        return { success: true, blobName };
      } catch (error) {
        console.error(JSON.stringify({
          kpmsg: {
            id: 'AI_PORTAL_NOTEBOOK',
            name: 'deleteSmartNoteFilesFromBlob - Individual Blob Error',
            detail: {
              blobName,
              error: error.message
            }
          }
        }));
        return { success: false, blobName, error: error.message };
      }
    });

    const results = await Promise.all(deletionPromises);

    results.forEach(result => {
      if (result.success) {
        deletedCount++;
      } else {
        errors.push({ blob: result.blobName, error: result.error });
      }
    });

    return { success: errors.length === 0, deletedCount, errors };
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'deleteSmartNoteFilesFromBlob - Error',
        detail: {
          teamName,
          assistantName,
          smartNoteId,
          error: error?.message || 'Failed to delete SmartNote files from blob storage',
          stack: error?.stack
        }
      }
    }));
    return { success: false, deletedCount: 0, errors: [error.message] };
  }
}

