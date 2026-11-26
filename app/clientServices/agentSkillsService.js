'use client';

const buildAgentSkillsUrl = (teamName, assistantName, smartNoteId, params = null) => {
  const base = `/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/agent-skills`;
  if (!params) {
    return base;
  }
  const search = new URLSearchParams(params);
  return `${base}?${search.toString()}`;
};

export async function requestAgentSkillsJob(teamName, assistantName, smartNoteId, payload = {}) {
  const response = await fetch(buildAgentSkillsUrl(teamName, assistantName, smartNoteId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorPayload = await safeParseJSON(response);
    throw new Error(errorPayload?.error || 'Unable to start agent skills job');
  }

  return response.json();
}

export async function fetchAgentSkillsJob(teamName, assistantName, smartNoteId, jobId) {
  const response = await fetch(buildAgentSkillsUrl(teamName, assistantName, smartNoteId, { jobId }));
  if (!response.ok) {
    const errorPayload = await safeParseJSON(response);
    throw new Error(errorPayload?.error || 'Unable to fetch agent skills job');
  }
  return response.json();
}

async function safeParseJSON(response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}
