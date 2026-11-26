'use client';

export const callWorkflowEndpoint = async (teamName, assistantName, smartNoteId, path, query, files, sources) => {
  const formData = buildFormData(query, files, path, smartNoteId, sources);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 200000); // 200 seconds timeout

  const workflow = path.split('/')[0];

  try {
    const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/workflow/${workflow}`, {
      method: 'POST',
      body: formData,
      signal: controller.signal, // Attach the signal for timeout
    });

    if (!response.ok) {
      throw new Error(`Failed to call workflow endpoint: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId); // Clear the timeout
  }
};

const buildFormData = (query, files, path, smartNoteId, sources) => {
  const workflow = path.split('/')[0];

  switch (workflow) {
    case 'medicaid':
      return buildMedicaidFormData(query, files, path);
    case 'products':
      return buildKpifProductsFormdata(query, files, path, smartNoteId, sources);
    default:
      throw new Error(`Unsupported workflow: ${workflow}`);
  }
}

const buildMedicaidFormData = (query, files, path) => {
  const formData = new FormData();
  formData.append('query', JSON.stringify({ query, filter: 'latest' }));
  formData.append('path', path);

  files.forEach((file) => {
    formData.append('files', file.file, file.name);
  });

  return formData;
};

const buildKpifProductsFormdata = (query, files, path, smartNoteId, sources) => {
  const formData = new FormData();

  // Full path is expected to be like 'products/api/hipos/kpifrouter'
  // Remove 'products/' prefix from path if present
  const apiPath = path.startsWith('products/') ? path.slice('products/'.length) : path;
  formData.append('query', JSON.stringify({ query, filter: 'latest' }));
  formData.append('path', apiPath);
  formData.append('smartNoteId', smartNoteId);

  files.forEach((file) => {
    formData.append('files', file.file, file.name);
  });

  if (sources && sources.length > 0) {
    const actualSources = sources.map(source => { return { sourceId: source.sourceId, sourceType: source.sourceType, parentId: source.parentId } });
    formData.append('sources', JSON.stringify(actualSources));
  }

  return formData;
}