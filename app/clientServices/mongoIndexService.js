'use client';

async function parseResponse(response, defaultMessage) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 400 && payload.success === false && payload.summary
      && Array.isArray(payload.validationErrors) && Array.isArray(payload.results)) {
      return payload;
    }
    throw new Error(payload.error || defaultMessage);
  }

  return payload;
}

export async function applyMongoIndexes(indexData, dryRun = false, targetDatabaseName = '') {
  const response = await fetch('/api/admin/mongo-indexes/apply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ indexData, dryRun, targetDatabaseName }),
  });

  return parseResponse(response, 'Failed to apply Mongo indexes.');
}
