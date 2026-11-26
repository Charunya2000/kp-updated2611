
'use client';

import { prepDocument } from '@clientServices/insertDocument';

export const getSmartNote = async (teamName, assistantName, smartNoteId) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  const response = await result.json();
  return response;
};

export const getSmartNotes = async (teamName, assistantName) => {
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNotes/selectedUserAssistant`, {
      cache: 'no-store',
    });

    if (!result.ok) {
      const payload = await result.json().catch(() => ({}));
      console.warn('Error fetching smart notes:', payload.error || result.statusText || 'Network response was not ok');
      return [];
    }

    const json = await result.json();
    return json;
  } catch (error) {
    console.error('Error fetching smart notes:', error);
    return [];
  }
};

export const getSmartNoteCounts = async (teamName, assistantName, smartNoteId) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/source/count`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!result.ok) {
    throw new Error('Failed to get smart note counts');
  }
  const response = await result.json();
  return response;
}


export const createSmartNoteWithId = async (teamName, assistantName, smartNoteId, title = 'Untitled Smart Note') => {

  let response = null;
  try {
    const smartNote = prepDocument({
      type: 'SmartNote',
      selectedUserAssistant: assistantName,
      title,
      subtitle: 'No subtitle',
      prelude: '',
      parentId: null,
      smartNoteId: smartNoteId,
      id: smartNoteId
    }, smartNoteId);

    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(smartNote),
    });
    response = await result.json();

  } catch (error) {
    console.error(error);
  }

  return response;
};

export const updateSmartNote = async (teamName, assistantName, smartNoteId, updates) => {
  //look up the smart note by ID
  const smartNote = await getSmartNote(teamName, assistantName, smartNoteId);
  if (!smartNote) {
    throw new Error(`Smart note with ID ${smartNoteId} not found`);
  }
  // Merge updates into the smart note
  const updatedSmartNote = { ...smartNote, ...updates };
  // Save the updated smart note
  return await saveSmartNote(teamName, assistantName, updatedSmartNote);
}

export const deleteSmartNote = async (teamName, assistantName, smartNoteId) => {
  try {
    const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
  } catch (error) {
    console.error('Error deleting smart note:', error);
  }
}

export const saveSmartNote = async (teamName, assistantName, smartNote) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(smartNote),
  });
  const response = await result.json();
  return response;
};

export const getSources = async (teamName, assistantName, smartNote) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/source`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  return await result.json();
};

export const getDesignReferences = async (teamName, assistantName, smartNote) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/designReference`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  return await result.json();
};

export const getDesignIndexes = async (teamName, assistantName, smartNote) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/designIndex`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  return await result.json();
};

export const getJiraIssues = async (teamName, assistantName, smartNote) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/jiraIssue`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  return await result.json();
};

export const getSavedNotes = async (teamName, assistantName, smartNote) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/savedNote`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  return await result.json();
};

export const getSavedResponses = async (teamName, assistantName, smartNote) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/savedResponse`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  return await result.json();
};

export const getUploadedDocuments = async (teamName, assistantName, smartNote) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/uploadedDocument`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  return await result.json();
};

export const selectCurrentChatHistory = async (teamName, assistantName, smartNote) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/chatHistory/currentChatHistory`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  return await result.json();
};

export const createChatHistory = async (teamName, assistantName, chatHistory) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${chatHistory.id}/chatHistory`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(chatHistory)
  });
  return await result.json();
};

export const getChats = async (teamName, assistantName, smartNote, chatHistory) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/chatHistory/${chatHistory.id}/chat`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  return await result.json();
};

export const getCurrentChat = async (teamName, assistantName, smartNote, chatHistory) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/chatHistory/${chatHistory.id}/chat/currentChat`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  return await result.json();
};

export const createChat = async (teamName, assistantName, smartNote, chat) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/chatHistory/${chat.parentId}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(chat)
  });
  return await result.json();
};

export const getChatInteractions = async (teamName, assistantName, chatHistory, chat) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${chatHistory.parentId}/chatHistory/${chatHistory.id}/chat/${chat.id}/chatInteraction`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  return await result.json();
};

export const getChatInteraction = async (teamName, assistantName, chatHistory, chat, chatInteraction) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${chatHistory.parentId}/chatHistory/${chatHistory.id}/chat/${chat.id}/chatInteraction/${chatInteraction.id}`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  return await result.json();
};

export const getSuggestedPrompts = async (teamName, assistantName, smartNote, chatHistory, chat, chatInteraction) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/chatHistory/${chatHistory.id}/chat/${chat.id}/chatInteraction/${chatInteraction.id}/suggestedPrompt`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });
  return await result.json();
};

// Updates the updatedAt timestamp for a SmartNote and returns the updated SmartNote
export const updateUpdatedAt = async (teamName, assistantName, smartNoteId) => {
  // Call the update API to set updatedAt to now
  try {
    const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/update`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: null // intentionally null since we are only updating the timestamp
    });
    if (!response.ok) {
      throw new Error('Failed to update SmartNote timestamp');
    }
    // Return the updated SmartNote directly from the API response
    return await response.json();
  } catch (err) {
    console.error('Failed to update timestamp:', err);
    return null;
  }
};


// Fetches SmartNote and sets uploadedDocumentCount for correct UI display
export const getSmartNoteWithUploadedDocumentCount = async (teamName, assistantName, smartNoteId) => {
  const smartNote = await getSmartNote(teamName, assistantName, smartNoteId);
  if (smartNote && smartNote.id) {
    const uploadedDocuments = await getUploadedDocuments(teamName, assistantName, smartNote);
    smartNote.uploadedDocumentCount = Array.isArray(uploadedDocuments) ? uploadedDocuments.length : 0;
  }
  return smartNote;
};
