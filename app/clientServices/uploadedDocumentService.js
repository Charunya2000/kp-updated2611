'use client';

export const uploadToIndexAndBlob = async (teamName, assistantName, uploadedDocument) => {
  const formData = new FormData();
  formData.append('fileName', uploadedDocument.fileName);
  formData.append('file', uploadedDocument.file);
  formData.append('type', uploadedDocument.type);
  formData.append('parentId', uploadedDocument.parentId);
  formData.append('id', uploadedDocument.id);
  formData.append('createdAt', uploadedDocument.createdAt);
  formData.append('updatedAt', uploadedDocument.updatedAt);
  formData.append('assistantName', assistantName);
  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${uploadedDocument.parentId}/context/uploadedDocument`, {
    method: 'POST',
    body: formData,
  });
  return response.json();
};

export const deleteUploadedDocument = async (teamName, assistantName, uploadedDocument) => {
  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${uploadedDocument.parentId}/uploadedDocument/${uploadedDocument.id}`, {
    method: 'DELETE',
    body: JSON.stringify(uploadedDocument),
  });
  return response.json();
};

export const updateUploadedDocument = async (teamName, assistantName, uploadedDocument) => {
  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${uploadedDocument.parentId}/uploadedDocument/${uploadedDocument.id}`, {
    method: 'PUT',
    body: JSON.stringify(uploadedDocument),
  });
  return response.json();
};

export const getUploadedDocuments = async (teamName, assistantName, smartNote) => {
  // Add a cache-busting query parameter to avoid browser caching
  const timestamp = new Date().getTime();
  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/uploadedDocument?t=${timestamp}&force=true`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Force-Refresh': 'true' // Add additional header to ensure no caching
    },
  });

  if (!response.ok) {
    console.error(`[${new Date().toISOString()}] Error fetching documents: ${response.status} ${response.statusText}`);
    throw new Error(`Failed to fetch documents: ${response.status}`);
  }

  return response.json();
};


// Add this function to your existing file

export const downloadUploadedDocument = async (teamName, assistantName, smartNoteID, uploadedDocumentId) => {
  try {
    const response = await fetch(
      `/api/${teamName}/${assistantName}/smartNote/${smartNoteID}/uploadedDocument/${uploadedDocumentId}/download`
    );

    if (!response.ok) {
      let errorDetails;
      try {
        errorDetails = await response.json();
      } catch (e) {
        errorDetails = { error: `HTTP ${response.status}: ${response.statusText}` };
      }
      console.error('Download API error:', response.status, errorDetails);
      throw new Error(errorDetails.error || errorDetails.details || 'Download failed');
    }

    // ✅ Get blob directly from response
    const blob = await response.blob();
    return blob;

  } catch (error) {
    console.error('Download error:', error);
    throw error;
  }
};