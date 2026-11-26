import fetch from 'node-fetch';
import { getBlockBlobClient } from '@/app/services/blobStorageService';
import { validateAndAcquireToken } from '@/app/services/sharepointGetAccessToken';

function normalizeString(value) {
  return String(value || '').trim();
}

function shouldUseGraphVaultPath() {
  return String(process.env.USE_VAULT || '').toLowerCase() === 'true';
}

async function getSiteAndDriveInfo(siteName, domain = 'geisinger.sharepoint.com') {
  const accessToken = await validateAndAcquireToken();
  const graphEndpoint = `https://graph.microsoft.com/v1.0/sites/${domain}:/sites/${siteName}`;

  const siteResponse = await fetch(graphEndpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!siteResponse.ok) {
    throw new Error(`Failed to get site info: ${siteResponse.status} ${siteResponse.statusText}`);
  }
  const siteData = await siteResponse.json();
  const siteId = siteData.id;

  const driveResponse = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/drive`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!driveResponse.ok) {
    throw new Error(`Failed to get drive info: ${driveResponse.status} ${driveResponse.statusText}`);
  }
  const driveData = await driveResponse.json();

  return { siteId, driveId: driveData.id };
}

async function streamFromGraphByFileId({ siteName, fileId, destBlobName, containerName }) {
  const accessToken = await validateAndAcquireToken();
  const { driveId } = await getSiteAndDriveInfo(siteName);
  const endpoint = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}/content`;

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/octet-stream',
    },
  });

  if (!response.ok || !response.body) {
    throw new Error(`Failed to fetch file from SharePoint via Graph API: ${response.status} ${response.statusText}`);
  }

  const blockBlobClient = await getBlockBlobClient(containerName, destBlobName);
  await blockBlobClient.uploadStream(response.body);
  return destBlobName;
}

async function streamFromSharePointRestByFolder({ siteName, folderName, fileName, destBlobName, containerName }) {
  const accessToken = await validateAndAcquireToken();
  const endpoint = `https://sp-cloud.kp.org/sites/${siteName}/_api/web/GetFolderByServerRelativeUrl('${folderName}')/Files('${fileName}')/$value`;

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/octet-stream',
    },
  });

  if (!response.ok || !response.body) {
    throw new Error(`Failed to fetch file from SharePoint: ${response.status} ${response.statusText}`);
  }

  const blobName = `${folderName}/${destBlobName}`;
  const blockBlobClient = await getBlockBlobClient(containerName, blobName);
  await blockBlobClient.uploadStream(response.body);
  return blobName;
}

export function extractFolderNameFromRelativeUrl(relativeAUrl) {
  const value = normalizeString(relativeAUrl);
  const folderMatch = value.match(/^\/sites\/[^\/]+\/(.+)\/([^\/]+)$/);
  if (!folderMatch || folderMatch.length < 3) {
    const error = new Error(`Unable to parse folderName from relativeAUrl: ${value}`);
    error.statusCode = 400;
    throw error;
  }
  return folderMatch[1];
}

export async function streamSharePointFileForPreparation({
  siteName,
  fileAName,
  fileId,
  relativeAUrl,
  destBlobName,
  containerName = 'compliance-ai',
} = {}) {
  const normalizedSiteName = normalizeString(siteName);
  const normalizedFileName = normalizeString(fileAName);
  const normalizedDestBlobName = normalizeString(destBlobName) || normalizedFileName;
  const normalizedFileId = normalizeString(fileId);

  if (!normalizedSiteName || !normalizedFileName) {
    throw new Error('siteName and fileAName are required for SharePoint acquisition.');
  }

  const folderName = extractFolderNameFromRelativeUrl(relativeAUrl);

  if (shouldUseGraphVaultPath() && normalizedFileId) {
    const blobName = await streamFromGraphByFileId({
      siteName: normalizedSiteName,
      fileId: normalizedFileId,
      destBlobName: normalizedDestBlobName,
      containerName,
    });

    return {
      blobName,
      folderName,
      acquisitionPath: 'graph',
    };
  }

  const blobName = await streamFromSharePointRestByFolder({
    siteName: normalizedSiteName,
    folderName,
    fileName: normalizedFileName,
    destBlobName: normalizedDestBlobName,
    containerName,
  });

  return {
    blobName,
    folderName,
    acquisitionPath: 'rest',
  };
}
