'use client';

async function parseResponse(response, defaultMessage) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || defaultMessage);
  }

  return payload;
}

export async function checkAiSearchIndex(indexName) {
  const response = await fetch('/api/admin/data-loads/ai-search-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ indexName }),
  });

  return parseResponse(response, 'Failed to check AI Search index.');
}

export async function checkMongoCollection(dbName, collectionName) {
  const response = await fetch('/api/admin/data-loads/mongoDB-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dbName, collectionName }),
  });

  return parseResponse(response, 'Failed to check Mongo collection.');
}

export async function createMongoCollection(dbName, collectionName) {
  const response = await fetch('/api/admin/data-loads/mongoDB-create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dbName, collectionName }),
  });

  return parseResponse(response, 'Failed to create Mongo collection.');
}

export async function startAiSearchUpload({ containerName, blobName, indexName, overwrite }) {
  const response = await fetch('/api/admin/data-loads/ai-search-upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ containerName, blobName, indexName, overwrite: !!overwrite }),
  });

  return parseResponse(response, 'Failed to start AI Search upload.');
}

export async function startMongoUpload({ containerName, blobName, dbName, collectionName, overwrite }) {
  const response = await fetch('/api/admin/data-loads/mongoDB-upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      containerName,
      blobName,
      dbName,
      collectionName,
      overwrite: !!overwrite,
    }),
  });

  return parseResponse(response, 'Failed to start Mongo upload.');
}

export async function getAiSearchUploadJob(jobId) {
  const response = await fetch(`/api/admin/data-loads/job/${encodeURIComponent(jobId)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return parseResponse(response, 'Failed to fetch AI Search upload status.');
}

export async function updateAiSearchUploadJob(jobId, jobUpdate) {
  const response = await fetch(`/api/admin/data-loads/job/${encodeURIComponent(jobId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(jobUpdate),
  });

  return parseResponse(response, 'Failed to update AI Search upload job.');
}

export async function getAllDataLoadJobs() {
  const response = await fetch('/api/admin/data-loads/jobs', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return parseResponse(response, 'Failed to fetch data load jobs.');
}

export async function getAllAiSearchUploadJobs() {
  return getAllDataLoadJobs();
}

export async function getMongoDatabases() {
  const response = await fetch('/api/admin/data-loads/mongoDB-check', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  return parseResponse(response, 'Failed to fetch databases.');
}

export async function getMongoCollections(dbName) {
  const response = await fetch(`/api/admin/data-loads/mongoDB-check?dbName=${encodeURIComponent(dbName)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  return parseResponse(response, 'Failed to fetch collections.');
}