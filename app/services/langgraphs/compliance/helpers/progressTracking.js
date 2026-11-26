/**
 * Update the status field on a ChatInteraction document.
 * @param {string} teamName
 * @param {string} chatId
 * @param {string} chatInteractionId
 * @param {string} status - New status string
 */
export async function updateChatInteractionStatus(teamName, chatId, chatInteractionId, status) {
  if (!teamName || !chatInteractionId) return;
  const teamDb = await connectToDatabase(`team-${teamName}-db`);
  await teamDb.collection('user_collection').updateOne(
    {
      type: 'ChatInteraction',
      id: chatInteractionId,
      ...(chatId ? { parentId: chatId } : {}),
    },
    {
      $set: { status, updatedAt: new Date() },
    }
  );
}
/**
 * Progress Tracking Helper
 * Provides utilities for tracking and updating comparison progress
 * Server-side functions for updating progress during graph execution
 */

import { updateChatInteraction, selectChatInteraction } from '@services/chatInteractionService';
import { connectToDatabase } from '@/db/connection';

const JOB_TYPE_PREFIX = 'BackgroundJob';
const GEISINGER_PREPARATION_JOB_TYPE = 'GeisingerDocumentPreparation';
const PROGRESS_FRAMES = ['[=  ]', '[== ]', '[===]', '[ ==]', '[  =]', '[   ]'];
let progressFrameIndex = 0;

export class ChatInteractionCancelledError extends Error {
  constructor(message = 'Comparison cancelled by user') {
    super(message);
    this.name = 'ChatInteractionCancelledError';
    this.code = 'CHAT_INTERACTION_CANCELLED';
  }
}

export function isChatInteractionCancelledError(error) {
  return Boolean(
    error
    && (
      error.code === 'CHAT_INTERACTION_CANCELLED'
      || error.name === 'ChatInteractionCancelledError'
    )
  );
}

function getNextProgressFrame() {
  const frame = PROGRESS_FRAMES[progressFrameIndex % PROGRESS_FRAMES.length];
  progressFrameIndex += 1;
  return frame;
}

async function readChatInteractionCancellationState(teamName, chatId, chatInteractionId) {
  if (!teamName || !chatInteractionId) {
    return { cancellationRequested: false };
  }

  const teamDb = await connectToDatabase(`team-${teamName}-db`);
  const strictQuery = {
    type: 'ChatInteraction',
    id: chatInteractionId,
    ...(chatId ? { parentId: chatId } : {}),
  };

  let doc = await teamDb.collection('user_collection').findOne(
    strictQuery,
    { projection: { cancellationRequested: 1, cancellationRequestedAt: 1, isComplete: 1, response: 1 } }
  );

  if (!doc && chatId) {
    doc = await teamDb.collection('user_collection').findOne(
      { type: 'ChatInteraction', id: chatInteractionId },
      { projection: { cancellationRequested: 1, cancellationRequestedAt: 1, isComplete: 1, response: 1 } }
    );
  }

  return {
    cancellationRequested: Boolean(doc?.cancellationRequested === true),
    cancellationRequestedAt: doc?.cancellationRequestedAt || null,
    isComplete: doc?.isComplete === true,
    response: String(doc?.response || ''),
  };
}

export async function assertChatInteractionNotCancelled(teamName, chatId, chatInteractionId) {
  if (!chatInteractionId) return;

  const state = await readChatInteractionCancellationState(teamName, chatId, chatInteractionId);
  if (state.cancellationRequested) {
    throw new ChatInteractionCancelledError('Comparison cancelled by user');
  }
}

async function updateGeisingerJobProgress(teamName, chatId, chatInteractionId, markdown) {
  if (!teamName || !chatInteractionId) return false;

  const teamDb = await connectToDatabase(`team-${teamName}-db`);
  const now = new Date();

  const result = await teamDb.collection('user_collection').updateMany(
    {
      type: JOB_TYPE_PREFIX,
      jobType: GEISINGER_PREPARATION_JOB_TYPE,
      'items.chatInteractionId': chatInteractionId,
    },
    {
      $set: {
        [`progressByChatInteractionId.${chatInteractionId}`]: {
          markdown,
          chatId: chatId || null,
          chatInteractionId,
          updatedAt: now.toISOString(),
        },
        lastUpdatedAt: now.toISOString(),
        updatedAt: now,
      },
    }
  );

  return Number(result?.matchedCount || 0) > 0;
}

// Accepts optional isComplete boolean
async function updateProgressDirectly(teamName, chatId, chatInteractionId, markdown, isComplete) {
  if (!teamName || !chatInteractionId) return;

  const updatedJob = await updateGeisingerJobProgress(teamName, chatId, chatInteractionId, markdown);
  if (updatedJob) {
    return;
  }

  const setFields = {
    response: markdown,
    updatedAt: new Date(),
  };
  if (typeof isComplete === 'boolean') {
    setFields.isComplete = isComplete;
  }

  const teamDb = await connectToDatabase(`team-${teamName}-db`);
  const updateResult = await teamDb.collection('user_collection').updateOne(
    {
      type: 'ChatInteraction',
      id: chatInteractionId,
      ...(chatId ? { parentId: chatId } : {}),
    },
    {
      $set: setFields,
    }
  );

  if (Number(updateResult?.matchedCount || 0) > 0) {
    return;
  }

  // Fallback by id only to avoid missing updates when parentId mapping drifts.
  const fallbackResult = await teamDb.collection('user_collection').updateOne(
    {
      type: 'ChatInteraction',
      id: chatInteractionId,
    },
    {
      $set: setFields,
    }
  );

  if (Number(fallbackResult?.matchedCount || 0) > 0) {
    return;
  }

  // If still not found, log a warning
  console.warn(`[progressTracking] updateProgressDirectly could not find ChatInteraction: ${chatInteractionId}`);
}

/**
 * Update ChatInteraction progress in MongoDB
 * Retrieves the current ChatInteraction, updates response field, and saves back
 * @param {string} chatId - ID of the parent Chat
 * @param {string} chatInteractionId - ID of ChatInteraction to update
 * @param {string} markdown - Progress markdown to set as response
 */
export async function updateChatInteractionProgress(teamName, chatId, chatInteractionId, markdown) {
  if (!chatInteractionId) {
    console.warn('[progressTracking] No chatInteractionId provided for progress update');
    return;
  }

  try {
    await assertChatInteractionNotCancelled(teamName, chatId, chatInteractionId);

    // Fetch current ChatInteraction to preserve other fields
    const strictQuery = { type: 'ChatInteraction', parentId: chatId, id: chatInteractionId };
    let chatInteraction = await selectChatInteraction(strictQuery, teamName);

    if (!chatInteraction) {
      const fallbackQuery = { type: 'ChatInteraction', id: chatInteractionId };
      chatInteraction = await selectChatInteraction(fallbackQuery, teamName);
    }

    if (!chatInteraction) {
      console.warn(`[progressTracking] ChatInteraction not found via session query, using direct update: ${chatInteractionId}`);
      await updateProgressDirectly(teamName, chatId, chatInteractionId, markdown, /*isComplete*/ undefined);
      return;
    }

    // If the progress message indicates completion, set isComplete true
    let isComplete = false;
    if (typeof markdown === 'string') {
      const normalized = markdown.toLowerCase();
      if (normalized.includes('comparison complete') || normalized.includes('comparison completed.') || normalized.includes('spreadsheet ready')) {
        isComplete = true;
      }
    }

    // Update response field and isComplete if needed
    chatInteraction.response = markdown;
    if (isComplete) chatInteraction.isComplete = true;

    // Save updated ChatInteraction
    await updateChatInteraction(chatInteraction, teamName);
  } catch (error) {
    if (isChatInteractionCancelledError(error)) {
      throw error;
    }

    console.warn('[progressTracking] Session-based update failed, using direct update:', error.stack);
    try {
      await assertChatInteractionNotCancelled(teamName, chatId, chatInteractionId);
      // Pass isComplete if detected
      let isComplete = false;
      if (typeof markdown === 'string') {
        const normalized = markdown.toLowerCase();
        if (normalized.includes('comparison complete') || normalized.includes('comparison completed.') || normalized.includes('spreadsheet ready')) {
          isComplete = true;
        }
      }
      await updateProgressDirectly(teamName, chatId, chatInteractionId, markdown, isComplete);
    } catch (directUpdateError) {
      if (isChatInteractionCancelledError(directUpdateError)) {
        throw directUpdateError;
      }
      console.error('[progressTracking] Progress update error:', directUpdateError.message);
    }
  }
}

/**
 * Create formatted progress markdown
 * @param {string} stage - Current stage name
 * @param {string} details - Optional details
 * @returns {string} Formatted markdown
 */
function inferProgressTypeFromStage(stage) {
  const normalizedStage = String(stage || '').toLowerCase();
  if (!normalizedStage) return 'Comparison';

  const preparationMarkers = [
    'starting document processing',
    'deleting previous data',
    'creating conversation record',
    'copying sharepoint file',
    'segmenting pdf',
    'extracting section content from pdf',
    'extracting docx structure',
    'no content extracted',
    'generating embeddings',
    'indexing in azure ai search',
    'processing batch'
  ];

  return preparationMarkers.some(marker => normalizedStage.includes(marker))
    ? 'Preparation'
    : 'Comparison';
}

export function createProgressMarkdown(stage, details = '', progressType) {
  const hasExplicitProgressType = typeof progressType === 'string' && progressType.trim().length > 0;
  const resolvedProgressType = hasExplicitProgressType
    ? progressType.trim()
    : inferProgressTypeFromStage(stage);

  let markdown = `## ${resolvedProgressType} Progress\n\n`;
  markdown += `${getNextProgressFrame()} Processing: ${stage}`;
  if (details) {
    markdown += ` - ${details} `;
  }
  markdown += "\n\n---\n";
  return markdown;
}
