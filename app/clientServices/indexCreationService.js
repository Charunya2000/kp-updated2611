'use client';

async function parseResponse(response, defaultMessage) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || defaultMessage);
  }

  return payload;
}

export async function createSearchIndex(indexDefinition) {
  const response = await fetch('/api/admin/index-creation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ indexDefinition }),
  });

  return parseResponse(response, 'Failed to create search index.');
}
