'use client';

export const submitToCompliance = async (teamName, assistantName, smartNote, sources, chatInteraction, intentHints = {}) => {

  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/submitAssistant/complianceai`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sources,
      chatInteraction,
      lobIntent: intentHints?.lobIntent || null,
      interactionIntent: intentHints?.interactionIntent || null,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit to Compliance API: ${response.statusText}`);
  }

  return response.json();
};

// Delete all GeisingerComparison objects by lob, geisingerConversationAId, and geisingerConversationBId
export const deleteGeisingerComparisons = async (teamName, assistantName, smartNoteId, lob, comparisonType, geisingerConversationAId, geisingerConversationBId) => {
  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/submitAssistant/complianceai/comparisonai/delete`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ lob, comparisonType, geisingerConversationAId, geisingerConversationBId }),
  });
  if (!response.ok) {
    throw new Error(`Failed to delete GeisingerComparison objects: ${response.statusText}`);
  }
  return response.json();
};

// Fetch comparison jobs for a smart note by LOB and status
export const fetchComparisonJobs = async (teamName, assistantName, smartNoteId, lob, status) => {
  const params = new URLSearchParams({ lob });
  if (status) params.set('status', status);
  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/submitAssistant/complianceai/comparisonai?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch comparison jobs: ${response.statusText}`);
  }
  const jobs = await response.json();
  // For each job, fetch the corresponding conversations to populate file names
  const jobsWithNames = await Promise.all((jobs || []).map(async (job) => {
    let fromDocName = '';
    let toDocName = '';
    try {
      if (job.geisingerConversationAId) {
        const convoA = await findConversationById(job.geisingerConversationAId, teamName);
        fromDocName = convoA?.fileAName || convoA?.fileName || convoA?.name || '';
      }
      if (job.geisingerConversationBId) {
        const convoB = await findConversationById(job.geisingerConversationBId, teamName);
        toDocName = convoB?.fileAName || convoB?.fileName || convoB?.name || '';
      }
    } catch (e) {
      // ignore errors, leave names blank
    }
    return { ...job, fromDocName, toDocName };
  }));
  console.log(`[fetchComparisonJobs]: ${jobsWithNames}`);
  return jobsWithNames;
};

export const submitToComplianceConversation = async (teamName, assistantName, geisingerConversation, smartNote, sources, chatInteraction) => {

  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/submitAssistant/complianceai/conversationai`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      teamName,
      assistantName,
      smartNoteId: smartNote?.id,
      geisingerConversation,
      sources,
      chatInteraction,
      chatId: chatInteraction?.parentId,
      chatInteractionId: chatInteraction?.id,
      prompt: chatInteraction?.prompt,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit to Compliance API: ${response.statusText}`);
  }

  return response.json();
};

export const submitToComplianceComparison = async (teamName, assistantName, geisingerComparison, smartNote, sources, chatInteraction, comparisonMode = null) => {

  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/submitAssistant/complianceai/comparisonai`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      teamName,
      assistantName,
      smartNoteId: smartNote.id,
      geisingerComparison,
      smartNote,
      sources,
      chatId: chatInteraction?.parentId,
      chatInteractionId: chatInteraction?.id,
      prompt: chatInteraction?.prompt,
      comparisonMode,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit to Compliance API: ${response.statusText}`);
  }

  return response.json();
};

export const cancelComplianceComparison = async (teamName, assistantName, smartNote, chatId, chatInteractionId) => {
  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/submitAssistant/complianceai/comparisonai/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      teamName,
      assistantName,
      smartNoteId: smartNote?.id,
      chatId,
      chatInteractionId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to cancel comparison: ${response.statusText}`);
  }

  return response.json();
};

export const geisingerDocComparision = async (geisingerComparison) => {
  const response = await fetch(`/api/docIntelligence/compareDocs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(geisingerComparison),
  });

  if (!response.ok) {
    throw new Error(`Failed to compare docs: ${response.statusText}`);
  }

  return response.json();
};

export const geisingerDocConversation = async (geisingerConversation) => {
  const response = await fetch(`/api/docIntelligence/converseDoc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(geisingerConversation),
  });

  if (!response.ok) {
    throw new Error(`Failed to compare docs: ${response.statusText}`);
  }

  return response.json();
};

export const findExistingConversations = async (arg1, arg2, arg3) => {
  const hasTeamName = typeof arg3 !== 'undefined';
  const teamName = hasTeamName ? arg1 : '';
  const inferredLob = hasTeamName ? arg2 : arg1;
  const status = hasTeamName ? arg3 : arg2;

  const params = new URLSearchParams({
    inferredLob: String(inferredLob || ''),
    status: String(status || ''),
  });

  if (teamName) {
    params.set('teamName', String(teamName));
  }

  const response = await fetch(`/api/docIntelligence/converseDoc?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch existing comparisons: ${response.statusText}`);
  }
  return response.json();
};

// app\api\docIntelligence\converseDoc\[conversationId]\route.js
export const findConversationById = async (conversationId, teamName = '') => {
  const response = await fetch(`/api/docIntelligence/converseDoc/${encodeURIComponent(conversationId)}?teamName=${encodeURIComponent(teamName || '')}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch conversation: ${response.statusText}`);
  }
  return response.json();
};

export const findExistingComparisons = async (inferredLob, status) => {
  const response = await fetch(`/api/docIntelligence/compareDocs?inferredLob=${encodeURIComponent(inferredLob || '')}&status=${encodeURIComponent(status || '')}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch existing comparisons: ${response.statusText}`);
  }
  return response.json();
};
