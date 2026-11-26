'use client';


export const callCase360Endpoint = async (teamName, assistantName, smartNoteId, path, query, createdAt, chatInteractionId, dataEnv = null, epdsFilters = null) => {

  const body = {
    query,
    path,
    teamName,
    assistantName,
    smart_note_id: smartNoteId,
    createdAt,
    chatInteractionId,
    dataEnv,
    epdsFilters,
  }

  try {
    const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/submitCase360Assistant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to call Case360 endpoint: ${response.statusText}`);
    }

    const orchestrationBaseUrl = response.headers.get('x-orchestration-base-url');
    if (orchestrationBaseUrl) {
      console.info('[Case360] submitCase360Assistant ->', orchestrationBaseUrl);
    }

    const payload = await response.json();
    return {
      ...payload,
      orchestrationBaseUrl,
    };
  } catch (error) {
    throw error;
  }
};

export const callMedicareCompanionEndpoint = async (teamName, assistantName, smartNoteId, prompt, mrnInput, chatInteractionId) => {

  const body = {
    prompt,
    teamName,
    assistantName,
    smartNoteId,
    mrn: mrnInput,
    chatInteractionId,
  }

  try {
    const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/submitAssistant/medicare-companion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to call Medicare Companion endpoint: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};
