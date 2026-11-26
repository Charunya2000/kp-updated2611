'use client';

export const getBlobContainers = async () => {
  try {
    const result = await fetch('/api/admin/blob/containers', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await result.json();
    return data.containers;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const getBlobFiles = async (containerName) => {
  try {
    const result = await fetch(`/api/admin/blob/${encodeURIComponent(containerName)}/files`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await result.json();
    return data.files;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const uploadBlobFile = async (containerName, file) => {
  const formData = new FormData();
  formData.append('file', file);

  const result = await fetch(`/api/admin/blob/${encodeURIComponent(containerName)}/upload`, {
    method: 'POST',
    body: formData,
  });

  const data = await result.json();

  if (!result.ok) {
    throw new Error(data.error || 'Failed to upload file.');
  }

  return data;
};

export const deleteBlobFile = async (containerName, blobName) => {
  const result = await fetch(`/api/admin/blob/${encodeURIComponent(containerName)}/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blobName }),
  });

  const data = await result.json();

  if (!result.ok) {
    throw new Error(data.error || 'Failed to delete file.');
  }

  return data;
};
