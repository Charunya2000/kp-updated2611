'use client';

// Temporary hack until every assistant has it's own graph
const assistantRouteMap = {
  'document-management-shared-service': `submitAssistant/documentmanagementsharedservice`,
  'confluence-ormb-knowledge-base': `submitAssistant/ormbconfluenceknowledgebase`,
  'ormb-confluence-knowledgebase': `submitAssistant/ormbconfluenceknowledgebase`,
  'ormb-confluence-knowledge-base': `submitAssistant/ormbconfluenceknowledgebase`
}

async function streamAssistantResponse(response, onToken, onComplete, onCitations, onRetrieval) {
  if (!response.ok) {
    throw new Error(`Failed to submit to assistant: ${response.statusText}`);
  }

  // Always use the reader to process the response
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let done = false;
  let responseContent = '';

  try {
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;

      if (value) {
        const chunk = decoder.decode(value, { stream: true });

        // Accumulate the response content
        responseContent += chunk;

        // Process the accumulated response content
        processResponseContent(responseContent, onToken, onComplete, onCitations, onRetrieval, (remainingContent) => {
          responseContent = remainingContent; // Update the responseContent with unprocessed content
        });
      }
    }
  } catch (error) {
    console.error('Error reading stream:', error);
    processResponseContent(responseContent, onToken, onComplete, onCitations, onRetrieval, () => {
      responseContent = "I was unable to process that request. Please try again.\n\nIf this issue persists, contact your system administrator.";
    });
  }

  // Final processing for any remaining content (e.g., in AKS where everything is buffered)
  if (responseContent) {
    processResponseContent(responseContent, onToken, onComplete, onCitations, onRetrieval, () => {
      responseContent = ''; // Clear the responseContent after final processing
    });
  }
}

export const submitToOpenAI = async (teamName, assistantName, smartNote, sources, chatInteraction, selectedUserAssistant, onToken, onComplete, onCitations, onRetrieval) => {
  // Determine the correct endpoint based on the selected user assistant
  const lastSegment = assistantRouteMap[selectedUserAssistant?.name] || 'submitAssistant';

  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/${lastSegment}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sources, chatInteraction }),
  });

  // Long running assistants (e.g. the DBA persona) answer with a background job id instead of a stream
  if (response.ok && response.headers.get('Content-Type')?.includes('application/json')) {
    return await response.json();
  }

  return streamAssistantResponse(response, onToken, onComplete, onCitations, onRetrieval);
};

export const submitToInfoSourceAssistant = async (teamName, assistantName, smartNote, sources, chatInteraction, selectedUserAssistant, onToken, onComplete, onCitations, onRetrieval, infoSourceFilters = null) => {
  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/submitInfoSourceAssistant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sources, chatInteraction, infoSourceFilters }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to submit to InfoSource assistant: ${response.statusText}`);
  }

  return await response.json();
};

export const getInfoSourceChatInteractionProgress = async (teamName, assistantName, smartNote, chatHistory, chat, chatInteraction) => {
  const response = await fetch(
    `/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/chatHistory/${chatHistory.id}/chat/${chat.id}/chatInteraction/${chatInteraction.id}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to poll InfoSource progress: ${response.statusText}`);
  }

  return await response.json();
};

export const runDmssWorkflow = async (teamName, assistantName, smartNoteId, formData, sources, chatInteraction, onToken, onComplete) => {
  try {
    const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/submitAssistant/documentmanagementsharedservice/workflow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ formData, sources, chatInteraction }),
    });

    if (!response.ok) {
      throw new Error(`Failed to submit DMSS Workflow: ${response.statusText}`);
    }

    // Always use the reader to process the response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let responseContent = '';

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;

      if (value) {
        const chunk = decoder.decode(value, { stream: true });

        // Accumulate the response content
        responseContent += chunk;

        // Process the accumulated response content
        processResponseContent(responseContent, onToken, onComplete, null, null, (remainingContent) => {
          responseContent = remainingContent; // Update the responseContent with unprocessed content
        });
      }
    }

    // Final processing for any remaining content (e.g., in AKS where everything is buffered)
    if (responseContent) {
      processResponseContent(responseContent, onToken, onComplete, null, null, () => {
        responseContent = ''; // Clear the responseContent after final processing
      });
    }
  } catch (error) {
    console.error('Error submitting DMSS workflow:', error);
    throw error;
  }
}

/**
 * Processes the response content to separate response text and suggestedPrompts.
 * @param {string} responseContent - The accumulated response content.
 * @param {function} onToken - Callback for response text.
 * @param {function} onComplete - Callback for suggestedPrompts.
 * @param {function} onCitations - Callback for structured citations payloads.
 * @param {function} onRetrieval - Callback for retrieval diagnostics payloads.
 * @param {function} updateRemainingContent - Callback to update the remaining unprocessed content.
 */
const processResponseContent = (responseContent, onToken, onComplete, onCitations, onRetrieval, updateRemainingContent) => {
  try {
    if (!responseContent) {
      updateRemainingContent('');
      return;
    }

    const match = responseContent.match(/({"suggestedPrompts"[\s\S]*})\s*$/);

    if (match) {
      const parsedPayload = JSON.parse(match[1]);
      const remainingContent = responseContent.slice(0, match.index);

      if (remainingContent) {
        onToken(remainingContent);
      }

      if (parsedPayload?.citations && typeof onCitations === 'function') {
        onCitations(parsedPayload.citations);
      }

      if (parsedPayload?.retrieval && typeof onRetrieval === 'function') {
        onRetrieval(parsedPayload.retrieval);
      }

      if (parsedPayload?.suggestedPrompts && typeof onComplete === 'function') {
        onComplete(parsedPayload.suggestedPrompts);
      }

      updateRemainingContent('');
      return;
    }

    if (responseContent.includes('"suggestedPrompts"')) {
      updateRemainingContent(responseContent);
      return;
    }

    onToken(responseContent);
    updateRemainingContent('');
  } catch (error) {
    console.error('Error processing response content:', error);
    updateRemainingContent(responseContent);
  }
};

export const getSuggestedPrompts = async (teamName, assistantName, smartNoteId, chatInteractionId) => {
  const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/chatInteraction/${chatInteractionId}/suggestedPrompts`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch suggested prompts: ${response.statusText}`);
  }

  return await response.json();
};

export const createChatInteraction = async (teamName, assistantName, smartNote, chatHistory, chat, chatInteraction) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/chatHistory/${chatHistory.id}/chat/${chat.id}/chatInteraction`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(chatInteraction),
  });
  return await result.json();
};

export const saveChatInteraction = async (teamName, assistantName, smartNote, chatHistory, chat, chatInteraction) => {
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/chatHistory/${chatHistory.id}/chat/${chat.id}/chatInteraction/${chatInteraction.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(chatInteraction),
  });
  return await result.json();
};

export const saveSuggestedPrompts = async (teamName, assistantName, smartNote, chatHistory, chat, chatInteraction, suggestedPrompts) => {
  const savedPrompts = await Promise.all(suggestedPrompts.map(async suggestedPrompt => {
    try {
      let result;
      try {
        result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/chatHistory/${chatHistory.id}/chat/${chat.id}/chatInteraction/${chatInteraction.id}/suggestedPrompt`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(suggestedPrompt),
        });

        if (!result.ok) {
          throw new Error(`Failed to save suggested prompt: ${result.statusText}`);
        }
      } catch (fetchError) {
        console.error(`Fetch error: ${fetchError.message}`);
        return { error: fetchError.message };
      }

      const ret = await result.json();
      return ret;
    } catch (error) {
      console.error(`Error saving suggested prompt: ${error.message}`);
      return { error: error.message };
    }
  }));

  return savedPrompts;
};

export const submitChatInteractionFeedback = async (teamName, assistantName, smartNoteId, chatInteractionId, feedback) => {
  const result = await fetch(
    `/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/chatInteraction/${chatInteractionId}/feedback`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback }),
    }
  );

  if (!result.ok) {
    const data = await result.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to submit feedback');
  }

  return await result.json();
};