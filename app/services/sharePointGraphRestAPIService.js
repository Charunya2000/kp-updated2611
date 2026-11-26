'use server'

import { validateAndAcquireToken } from "./sharepointGetAccessToken.js";
import { Client } from '@microsoft/microsoft-graph-client';

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

/**
 * Helper function to get site ID from site name
 * @param {string} siteName - The site name (e.g., 'genAIPortalTestSite')
 * @param {string} domain - The SharePoint domain (e.g., 'geisinger.sharepoint.com')
 * @returns {Promise<string>} - The site ID
 */
async function getSiteIdFromName(siteName, domain = 'geisinger.sharepoint.com') {
  try {
    const accessToken = await validateAndAcquireToken();
    const graphClient = createGraphClient(accessToken);

    // Construct the site URL format for Graph API
    const siteUrl = `${domain}:/sites/${siteName}`;
    const endpoint = `/sites/${siteUrl}`;

    const siteInfo = await graphClient.api(endpoint).get();
    return siteInfo.id;
  } catch (error) {
    console.error(`Error getting site ID for ${siteName}:`, error);
    throw error;
  }
}

/**
 * Public helper function to get site information including ID from site name
 * @param {string} siteName - The site name (e.g., 'genAIPortalTestSite')
 * @param {string} domain - The SharePoint domain (e.g., 'geisinger.sharepoint.com')
 * @returns {Promise<Object>} - The complete site information
 */
export async function getSiteInfo(siteName, domain = 'geisinger.sharepoint.com') {
  try {
    const accessToken = await validateAndAcquireToken();
    const graphClient = createGraphClient(accessToken);

    // Construct the site URL format for Graph API
    const siteUrl = `${domain}:/sites/${siteName}`;
    const endpoint = `/sites/${siteUrl}`;

    const siteInfo = await graphClient.api(endpoint).get();

    return {
      id: siteInfo.id,
      name: siteInfo.name || siteInfo.displayName,
      description: siteInfo.description,
      webUrl: siteInfo.webUrl,
      createdDateTime: siteInfo.createdDateTime,
      lastModifiedDateTime: siteInfo.lastModifiedDateTime
    };
  } catch (error) {
    console.error(`Error getting site info for ${siteName}:`, error);
    throw error;
  }
}

/**
 * Creates a Microsoft Graph client with the provided access token
 */
function createGraphClient(accessToken) {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    }
  });
}

function normalizeServerRelativeUrl(url) {
  let resultUrl = null;
  if (url) {
    try {
      // Remove protocol and domain, keep only the path
      // Use regex to extract the path without re-parsing as a URL (avoids re-encoding)
      const match = url.match(/^https?:\/\/[^/]+(\/.*)$/);
      if (match && match[1]) {
        resultUrl = match[1];
      } else {
        // fallback: if url is already a path, just use it
        resultUrl = url;
      }
    } catch (urlError) {
      console.warn('⚠️ [normalizeServerRelativeUrl] Could not parse URL:', urlError);
      // fallback: try regex
      const match = url.match(/^https?:\/\/[^/]+(\/.*)$/);
      if (match && match[1]) {
        resultUrl = match[1];
      }
    }
  }
  return resultUrl;
}

export async function getFolderByServerRelativeUrl(siteName, folderPath, domain = 'geisinger.sharepoint.com', driveId = null) {

  try {
    const accessToken = await validateAndAcquireToken();

    const graphClient = createGraphClient(accessToken);

    // First, get the site ID from the site name
    const siteId = await getSiteIdFromName(siteName, domain);

    // If no drive ID provided, intelligently determine the drive
    let targetDriveId = driveId;
    let cleanPath = folderPath;

    if (!targetDriveId) {

      // Parse the folder path to detect if it includes a library name
      if (folderPath && folderPath !== 'root' && folderPath !== '/') {
        const pathParts = folderPath.split('/').filter(part => part.length > 0);

        if (pathParts.length > 0) {
          let potentialLibraryName = pathParts[0];
          if (potentialLibraryName == "Shared Documents") {
            potentialLibraryName = "Documents";
          }

          // Try to find a drive with this name
          try {
            const allDrives = await graphClient.api(`/sites/${siteId}/drives`).get();
            const matchingDrive = allDrives.value.find(drive =>
              drive.name.toLowerCase() === potentialLibraryName.toLowerCase()
            );

            if (matchingDrive) {
              // Found a matching library, use it and adjust the path
              targetDriveId = matchingDrive.id;
              cleanPath = pathParts.slice(1).join('/'); // Remove library name from path
            } else {
            }
          } catch (driveError) {
            console.error('❌ [getFolderByServerRelativeUrl] Error searching drives:', driveError);
          }
        }
      } else {
      }

      // If still no drive found, use the default drive
      if (!targetDriveId) {
        const defaultDriveResponse = await graphClient.api(`/sites/${siteId}/drive`).get();
        targetDriveId = defaultDriveResponse.id;
        cleanPath = folderPath; // Use original path for default drive
      }
    } else {
    }

    // Get the folder metadata to capture its ServerRelativeUrl
    let folderServerRelativeUrl = null;
    let folderMetadata = null;

    if (cleanPath === 'root' || cleanPath === '/' || !cleanPath) {
      // Get root folder metadata
      try {
        folderMetadata = await graphClient.api(`/sites/${siteId}/drives/${targetDriveId}/root`).get();
      } catch (error) {
        console.warn('⚠️ [getFolderByServerRelativeUrl] Could not get root folder metadata:', error);
      }
    } else {
      // Get specific folder metadata
      const finalPath = cleanPath.startsWith('/') ? cleanPath.substring(1) : cleanPath;
      const encodedFinalPath = encodeSharePointPath(finalPath);
      try {
        folderMetadata = await graphClient.api(`/sites/${siteId}/drives/${targetDriveId}/root:/${encodedFinalPath}`).get();
      } catch (error) {
        console.warn('⚠️ [getFolderByServerRelativeUrl] Could not get folder metadata:', error);
      }
    }

    // Extract ServerRelativeUrl from folder metadata
    if (folderMetadata) {
      folderServerRelativeUrl = folderMetadata.webUrl;
    } else {
      // Fallback: construct the URL manually
      const baseUrl = `https://${domain}/sites/${siteName}`;
      folderServerRelativeUrl = cleanPath === 'root' || !cleanPath ?
        `${baseUrl}/Shared Documents` :
        `${baseUrl}/Shared Documents/${cleanPath}`;
    }

    if (folderServerRelativeUrl) {
      try {
        folderServerRelativeUrl = decodeURIComponent(folderServerRelativeUrl);
      } catch (decodeError) {
        console.warn('⚠️ [getFolderByServerRelativeUrl] Could not decode ServerRelativeUrl:', decodeError);
      }
    }
    folderServerRelativeUrl = normalizeServerRelativeUrl(folderServerRelativeUrl);

    // Construct endpoint for children
    let endpoint;

    if (cleanPath === 'root' || cleanPath === '/' || !cleanPath) {
      // Get root folder contents
      endpoint = `/sites/${siteId}/drives/${targetDriveId}/root/children`;
    } else {
      // Get specific folder contents
      const finalPath = cleanPath.startsWith('/') ? cleanPath.substring(1) : cleanPath;
      const encodedFinalPath = encodeSharePointPath(finalPath);
      endpoint = `/sites/${siteId}/drives/${targetDriveId}/root:/${encodedFinalPath}:/children`;
    }
    const response = await graphClient.api(endpoint).get();

    // Transform response to match original format structure
    const folders = response.value.filter(item => item.folder).map(folder => {
      // Decode URI
      let decodedWebUrl;
      try {
        decodedWebUrl = decodeURIComponent(folder.webUrl);
      } catch (e) {
        console.warn('[Folder] Could not decode webUrl:', e);
        decodedWebUrl = folder.webUrl;
      }
      // Normalize
      const normalizedUrl = normalizeServerRelativeUrl(decodedWebUrl);

      return {
        Id: folder.id,
        UniqueId: folder.id,
        Name: folder.name,
        ServerRelativeUrl: normalizedUrl,
        TimeCreated: folder.createdDateTime,
        TimeLastModified: folder.lastModifiedDateTime
      };
    });

    const files = response.value.filter(item => item.file).map(file => {
      // Decode URI
      let decodedWebUrl;
      try {
        decodedWebUrl = decodeURIComponent(file.webUrl);
      } catch (e) {
        console.warn('[File] Could not decode webUrl:', e);
        decodedWebUrl = file.webUrl;
      }
      // Normalize
      const normalizedUrl = normalizeServerRelativeUrl(decodedWebUrl);

      return {
        Id: file.id,
        UniqueId: file.id,
        Name: file.name,
        ServerRelativeUrl: normalizedUrl,
        TimeCreated: file.createdDateTime,
        TimeLastModified: file.lastModifiedDateTime,
        Length: file.size,
        MimeType: file.file?.mimeType
      };
    });

    const result = {
      d: {
        ServerRelativeUrl: folderServerRelativeUrl, // The URL of the folder being queried
        Folders: { results: folders },
        Files: { results: files }
      }
    };

    return result;

  } catch (error) {
    console.error('❌ [getFolderByServerRelativeUrl] Error occurred:', error);
    console.error('🔍 [getFolderByServerRelativeUrl] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      statusCode: error.statusCode
    });

    // Log the input parameters again for debugging context
    console.error('📋 [getFolderByServerRelativeUrl] Error context - Input parameters:', {
      siteName,
      folderPath,
      domain,
      driveId
    });

    throw error;
  }
}

export async function getDocumentLibraries(siteName, domain = 'geisinger.sharepoint.com') {
  let documentLibraries = [];
  try {
    const accessToken = await validateAndAcquireToken();
    const graphClient = createGraphClient(accessToken);

    // First, get the site ID from the site name
    const siteId = await getSiteIdFromName(siteName, domain);

    // Get all drives (document libraries) for the site
    const endpoint = `/sites/${siteId}/drives`;
    const response = await graphClient.api(endpoint).get();
    // Filter out system libraries and extract names
    const excludedLibs = ['FormServerTemplates', 'SiteAssets', 'Style Library', 'Site Assets'];

    documentLibraries = response.value
      .filter(drive => {
        const driveName = drive.name;
        return !excludedLibs.some(excluded =>
          driveName.toLowerCase().includes(excluded.toLowerCase())
        );
      })
      .map(drive => (drive.name));

  } catch (error) {
    console.error('Error getting document libraries:', error);
  }

  return documentLibraries;
}

export async function downloadFile(siteId, driveId, fileId) {
  try {
    const accessToken = await validateAndAcquireToken();
    const graphClient = createGraphClient(accessToken);

    // Get file metadata first
    const fileMetadata = await graphClient.api(`/sites/${siteId}/drives/${driveId}/items/${fileId}`).get();

    // Get file content
    const endpoint = `/sites/${siteId}/drives/${driveId}/items/${fileId}/content`;

    // Use fetch for binary content as Graph client might not handle blobs well
    const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/octet-stream'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const fileData = await response.blob();

    const contentType = fileMetadata.file?.mimeType || response.headers.get('Content-Type') || 'application/octet-stream';
    const contentLength = fileData.size.toString();

    return {
      fileData,
      contentType,
      contentLength,
      fileName: fileMetadata.name,
      fileSize: fileMetadata.size
    };
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
}

/**
 * Download file by path instead of ID
 * @param {string} siteId - SharePoint site ID
 * @param {string} driveId - SharePoint drive ID
 * @param {string} filePath - Path to the file (e.g., '/folder/subfolder/file.pdf')
 */
export async function downloadFileByPath(siteId, driveId, filePath) {
  try {
    const accessToken = await validateAndAcquireToken();
    const graphClient = createGraphClient(accessToken);

    // Clean the file path
    const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;

    // URL encode each path segment to handle special characters while preserving path separators
    const encodedPath = encodeSharePointPath(cleanPath);

    // Get file metadata first
    const fileMetadata = await graphClient.api(`/sites/${siteId}/drives/${driveId}/root:/${encodedPath}`).get();

    // Download using the file ID
    return await downloadFile(siteId, driveId, fileMetadata.id);

  } catch (error) {
    console.error('Error downloading file by path:', error);
    throw error;
  }
}
