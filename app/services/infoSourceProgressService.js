import {
  createChatInteraction,
  selectChatInteraction,
  updateChatInteraction,
} from '@services/chatInteractionService';
import {
  createSuggestedPrompt,
  deleteSuggestedPromptsByQuery,
} from '@services/suggestedPromptService';

export function createInfoSourceProgressMarkdown(stage, details = '') {
  let markdown = '## ISA Progress\n\n';
  markdown += `${stage}`;
  if (details) {
    markdown += ` - ${details}`;
  }
  markdown += '\n\n---\n';
  return markdown;
}

async function updateInfoSourceChatInteractionDocument({
  teamName,
  nuid,
  smartNoteId,
  chatId,
  chatInteractionId,
  prompt,
  patch,
}) {
  if (!teamName || !nuid || !chatId || !chatInteractionId) {
    return;
  }
  const now = new Date();

  const existingInteraction = await selectChatInteraction(
    {
      type: 'ChatInteraction',
      parentId: chatId,
      id: chatInteractionId,
    },
    teamName
  );

  if (existingInteraction) {
    await updateChatInteraction(
      {
        ...existingInteraction,
        ...patch,
        smartNoteId: existingInteraction.smartNoteId || smartNoteId,
        prompt: existingInteraction.prompt || prompt || '',
        updatedAt: now,
      },
      teamName
    );
    return;
  }

  await createChatInteraction(
    {
      id: chatInteractionId,
      type: 'ChatInteraction',
      app: 'SmartNotes',
      parentId: chatId,
      smartNoteId,
      prompt: prompt || '',
      ...patch,
      createdAt: now,
      updatedAt: now,
    },
    teamName
  );
}

export async function persistInfoSourceProgress({
  teamName,
  nuid,
  smartNoteId,
  chatId,
  chatInteractionId,
  prompt,
  stage,
  details = '',
}) {
  const response = createInfoSourceProgressMarkdown(stage, details);
  await updateInfoSourceChatInteractionDocument({
    teamName,
    nuid,
    smartNoteId,
    chatId,
    chatInteractionId,
    prompt,
    patch: {
      response,
      isComplete: false,
      processingStatus: 'running',
      errorMessage: null,
    },
  });
  return response;
}

export async function completeInfoSourceProgress({
  teamName,
  nuid,
  smartNoteId,
  chatId,
  chatInteractionId,
  prompt,
  response,
  citations = [],
  retrieval = null,
}) {
  await updateInfoSourceChatInteractionDocument({
    teamName,
    nuid,
    smartNoteId,
    chatId,
    chatInteractionId,
    prompt,
    patch: {
      response,
      citations,
      retrieval,
      isComplete: true,
      processingStatus: 'completed',
      errorMessage: null,
    },
  });
}

export async function failInfoSourceProgress({
  teamName,
  nuid,
  smartNoteId,
  chatId,
  chatInteractionId,
  prompt,
  error,
}) {
  const message = error?.message || 'Unknown error';
  const response = createInfoSourceProgressMarkdown('InfoSource processing failed.', message);
  await updateInfoSourceChatInteractionDocument({
    teamName,
    nuid,
    smartNoteId,
    chatId,
    chatInteractionId,
    prompt,
    patch: {
      response,
      citations: [],
      retrieval: { dataSource: 'graph-error' },
      isComplete: true,
      processingStatus: 'failed',
      errorMessage: message,
    },
  });
}

export async function persistInfoSourceSuggestedPrompts({
  teamName,
  nuid,
  smartNoteId,
  chatInteractionId,
  suggestedPrompts = [],
}) {
  if (!teamName || !nuid || !chatInteractionId) {
    return [];
  }

  const prompts = Array.isArray(suggestedPrompts)
    ? suggestedPrompts.map((prompt) => String(prompt || '').trim()).filter(Boolean)
    : [];

  await deleteSuggestedPromptsByQuery({
    type: 'SuggestedPrompt',
    parentId: chatInteractionId,
  }, teamName);

  if (!prompts.length) {
    return [];
  }

  const now = new Date();
  const documents = await Promise.all(prompts.map((prompt) => createSuggestedPrompt({
    id: crypto.randomUUID(),
    type: 'SuggestedPrompt',
    app: 'SmartNotes',
    parentId: chatInteractionId,
    smartNoteId,
    prompt,
    createdAt: now,
    updatedAt: now,
  }, teamName)));

  return documents;
}