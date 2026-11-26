// Create a new GeisingerConfigContextDocument
export async function createGeisingerConfigContextDocument(teamName, document) {
  const response = await fetch(`/api/admin/${teamName}/geisingerConfig`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(document),
  });
  if (!response.ok) throw new Error(`Failed to create config: ${response.statusText}`);
  return response.json();
}

// Get a list of GeisingerConfigContextDocuments (optionally with query params)
export async function getGeisingerConfigContextDocuments(teamName, params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = `/api/admin/${teamName}/geisingerConfig${query ? `?${query}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch configs: ${response.statusText}`);
  return response.json();
}

// Get a single GeisingerConfigContextDocument by ID
export async function getGeisingerConfigContextDocumentById(teamName, geisingerConfigId) {
  const response = await fetch(`/api/admin/${teamName}/geisingerConfig/${geisingerConfigId}`);
  if (!response.ok) throw new Error(`Failed to fetch config: ${response.statusText}`);
  return response.json();
}

// Update a GeisingerConfigContextDocument by ID
export async function updateGeisingerConfigContextDocumentById(teamName, geisingerConfigId, document) {
  const response = await fetch(`/api/admin/${teamName}/geisingerConfig/${geisingerConfigId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(document),
  });
  if (!response.ok) throw new Error(`Failed to update config: ${response.statusText}`);
  return response.json();
}

// Delete a GeisingerConfigContextDocument by ID
export async function deleteGeisingerConfigContextDocumentById(teamName, geisingerConfigId) {
  const response = await fetch(`/api/admin/${teamName}/geisingerConfig/${geisingerConfigId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error(`Failed to delete config: ${response.statusText}`);
  return response.json();
}

// Export GeisingerConfig documents to blob storage; returns metadata + SAS download link
// params: { filename?, collectionName?, purpose?, inferredLob?, any other filters }
export async function exportGeisingerConfigDocuments(teamName, params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = `/api/admin/${teamName}/geisingerConfig/export${query ? `?${query}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to export configs: ${response.status} ${response.statusText}`);
  return response.json();
}

// Import / replace GeisingerConfig documents from JSON array
// items: array of document objects; replace=true (default) deletes existing first
export async function importGeisingerConfigDocuments(teamName, items, { replace = true } = {}) {
  const response = await fetch(`/api/admin/${teamName}/geisingerConfig/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, replace })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to import configs: ${response.status} ${response.statusText} - ${text}`);
  }
  return response.json();
}
