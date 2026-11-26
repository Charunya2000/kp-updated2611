'use client'

import { downloadFile } from "@/app/services/sharePointRestAPIService";

export const getDocumentLibraries = async (teamName, assistantName, site) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/sharepoint/library?site=${site}`);

  return await result.json();
}

export const getFolderContents = async (teamName, assistantName, site, folder) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/sharepoint/folder?site=${site}&folder=${folder}`)

  return await result.json();
}

export const uploadDocumentToIndex = async (teamName, assistantName, sharePointFile) => {
  // download file from SharePoint
  const parts = sharePointFile.relativeUrl.split('/');
  const site = parts[2];
  const folderName = parts.slice(3, parts.length - 1).join('/');
  const fileName = parts[parts.length - 1];

  const { fileData } = await downloadFile(site, folderName, fileName);
  const file = new File([fileData], fileName);

  // index the file
  const formData = new FormData();
  formData.append('fileName', sharePointFile.fileName);
  formData.append('file', file);
  formData.append('type', sharePointFile.type);
  formData.append('parentId', sharePointFile.parentId);
  formData.append('id', sharePointFile.id);
  formData.append('createdAt', sharePointFile.createdAt);
  formData.append('updatedAt', sharePointFile.updatedAt);
  formData.append('relativeUrl', sharePointFile.relativeUrl);
  formData.append('site', site);

  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${sharePointFile.parentId}/context/uploadedDocument`, {
    method: 'POST',
    body: formData,
  });
  return response.json();
}

export const deleteSharePointFile = async (teamName, assistantName, sharePointFile) => {
  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${sharePointFile.parentId}/sharePointFile/${sharePointFile.id}`, {
    method: 'DELETE',
    body: JSON.stringify(sharePointFile),
  });
  return response.json();
};

export const updateSharePointFile = async (teamName, assistantName, sharePointFile) => {
  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${sharePointFile.parentId}/sharePointFile/${sharePointFile.id}`, {
    method: 'PUT',
    body: JSON.stringify(sharePointFile),
  });
  return response.json();
};

export const getSharePointFiles = async (teamName, assistantName, smartNote) => {
  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/sharePointFile`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return response.json();
};

export const createSharePointFile = async (teamName, assistantName, sharePointFile) => {
  let insertedSharePointFile = null;
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${sharePointFile.parentId}/sharePointFile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sharePointFile),
    });
    insertedSharePointFile = await result.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
  return insertedSharePointFile;
};

export const getAccessibleSharePointSites = async (teamName, assistantName) => {
  let sites = [];
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/sharepoint/sites`, {
      headers: {
        'Accept': 'application/json',
      }
    });

    sites = await result.json();
  } catch (error) {
    console.error(error);
  }

  return sites;
}

export const getAllSharePointSites = async (teamName) => {
  let sites = [];
  try {
    const result = await fetch(`/api/admin/${teamName}/sharepoint/sites`, {
      headers: {
        'Accept': 'application/json',
      }
    });

    sites = await result.json();
  } catch (error) {
    console.error(error);
  }

  return sites;
}

export const addSharePointSite = async (teamName, site) => {
  let success = { success: false };
  try {
    const result = await fetch(`/api/admin/${teamName}/sharepoint/sites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(site),
    });

    success = await result.json();
  } catch (error) {
    console.error(error);
  }
  return success
}

export const updateSharePointSite = async (teamName, site) => {
  let success = { success: false };
  try {
    const result = await fetch(`/api/admin/${teamName}/sharepoint/sites`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(site),
    });

    success = await result.json();
  } catch (error) {
    console.error(error);
  }
  return success
}

export const deleteSharePointSite = async (teamName, site) => {
  let success = { success: false };
  try {
    const result = await fetch(`/api/admin/${teamName}/sharepoint/sites`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(site),
    });

    success = await result.json();
  } catch (error) {
    console.error(error);
  }
  return success
}