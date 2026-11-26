'use client';

export const uploadETSDocumentsToIndex = async (files, projectId, projectName, tag) => {
  try {
    if (!files || files.length === 0) {
      throw new Error('No files provided for upload');
    }

    if (!projectId || !projectName) {
      throw new Error('Project ID and Project Name are required');
    }

    const formData = new FormData();
    formData.append('projectId', projectId);
    formData.append('projectName', projectName);
    formData.append('tag', tag);
    
    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await fetch('/api/admin/ets/index/documents/ets-uploads', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error uploading ETS documents to index:', error);
    throw new Error(`Failed to upload documents: ${error.message}`);
  }
};
