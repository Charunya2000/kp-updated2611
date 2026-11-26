'use server'

import { getBlockBlobClient } from "./blobStorageService";
import { validateAndAcquireToken } from "./sharepointGetAccessToken";

export async function getFolderByServerRelativeUrl(site, folderRelativeUrl) {
  const endpoint = `https://sp-cloud.kp.org/sites/${site}/_api/web/GetFolderByServerRelativeUrl('${folderRelativeUrl}')?$expand=Folders,Files`;

  const accessToken = await validateAndAcquireToken();

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json;odata=verbose',
      'Accept': 'application/json;odata=verbose',
      'Authorization': `Bearer ${accessToken}`,
    }
  });

  return await response.json();
}

export async function getDocumentLibraries(site) {
  const endpoint = `https://sp-cloud.kp.org/sites/${site}/_api/web/lists?$select=Title,DocumentTemplateUrl,EntityTypeName&$filter=BaseTemplate eq 101`;

  const accessToken = await validateAndAcquireToken();

  let documentLibraries = [];
  try {

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json;odata=verbose',
        'Accept': 'application/json;odata=verbose',
        'Authorization': `Bearer ${accessToken}`,
      }
    });

    const json = await response.json();

    // remove non useful libs
    const excludedLibs = ['FormServerTemplates', 'SiteAssets', 'Style_x0020_Library'];
    documentLibraries = json.d.results
      .filter(lib => !excludedLibs.includes(lib.EntityTypeName))
      .map(lib => {
        return lib.DocumentTemplateUrl.split('/')[3];
      }
      );
  } catch (error) {
    console.error(error);
  }

  return documentLibraries;
}

/**
 * Streams a file from SharePoint to Azure Blob Storage using SharePoint REST API
 * @param {Object} spOptions
 * @param {string} spOptions.siteName
 * @param {string} options.folderName
 * @param {string} spOptions.fileName
 * @param {Object} blobOptions
 * @param {string} blobOptions.containerName
 * @param {string} blobOptions.destBlobName
 * @returns {Promise<void>}
 */
export async function streamSharePointFileToBlob(
  { siteName, folderName, fileName },
  { containerName, destBlobName }) {

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
  const blockBlobClient = getBlockBlobClient(containerName, destBlobName);

  // Pipe the SharePoint file stream directly to Azure Blob
  await blockBlobClient.uploadStream(response.body);
}

export async function downloadFile(site, folderName, fileName) {
  const endpoint = `https://sp-cloud.kp.org/sites/${site}/_api/web/GetFolderByServerRelativeUrl('${folderName}')/Files('${fileName}')/$value`;

  const accessToken = await validateAndAcquireToken();

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/octet-stream'
      }
    });

    const fileData = await response.blob();

    const contentType = response.headers.get('Content-Type');
    const contentLength = fileData.size.toString();

    return { fileData, contentType, contentLength };
  } catch (error) {
    console.error(error);
  }
}
