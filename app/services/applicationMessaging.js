'use server';

import { selectDocumentExt, selectDocumentsExt } from '@/db/selectDocument';
import { validateBasicMulti, validateBasicSingle, validateDocumentDelete } from './validation';
import { prepDocument } from '../clientServices/insertDocument';
import { insertDocument } from '@/db/insertDocument';
import { updateDocument } from '@/db/updateDocument';
import { deleteDocument } from '@/db/deleteDocument';
import { connectToDatabase } from '@/db/connection';

/**
 * Get all application messages
 */
export async function getAllMessages() {
  try {
    console.log('getAllMessages: Starting to fetch messages from database');

    const query = { type: 'ApplicationMessage' };
    const documents = await selectDocumentsExt(
      query, validateBasicMulti);
    return documents;
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'getAllMessages',
        detail: {
          error: error.message
        }
      }
    }));
    return [];
  }
}

/**
 * Get a single message by ID
 */
export async function getMessageById(id) {
  try {
    return await selectDocumentExt(
      { type: 'ApplicationMessage', id },
      validateBasicSingle
    );
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'getMessageById',
        detail: {
          error: error.message
        }
      }
    }));
    return null;
  }
}

/**
 * Get all active messages (for displaying to users)
 * Filters by isEnabled=true and date range if specified
 */
export async function getActiveMessages() {
  try {
    const allMessages = await selectDocumentsExt(
      { type: 'ApplicationMessage', isEnabled: true },
      validateBasicMulti
    );

    // Filter by date range
    const now = new Date();
    return allMessages.filter(message => {
      if (message.startDate && new Date(message.startDate) > now) {
        return false;
      }
      if (message.endDate && new Date(message.endDate) < now) {
        return false;
      }
      return true;
    });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'getActiveMessages',
        detail: {
          error: error.message
        }
      }
    }));
    return [];
  }
}

/**
 * Create a new application message
 */
export async function createMessage(messageData) {
  try {
    const { text, messageType, isEnabled, startDate, endDate, status } = messageData;

    const newMessage = prepDocument({
      type: 'ApplicationMessage',
      text,
      messageType: messageType || 'INFO',
      isEnabled: isEnabled ?? true,
      startDate: startDate || null,
      endDate: endDate || null,
      status: status || 'Active'
    });

    return await insertDocument(newMessage, validateBasicMulti);
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'createMessage',
        detail: {
          error: error.message
        }
      }
    }));
    return { error: error.message };
  }
}

/**
 * Update an existing message
 */
export async function updateMessage(id, messageData) {
  try {
    const { text, messageType, isEnabled, startDate, endDate, status } = messageData;

    const updatedMessage = {
      type: 'ApplicationMessage',
      text,
      messageType: messageType || 'INFO',
      isEnabled: isEnabled ?? true,
      startDate: startDate || null,
      endDate: endDate || null,
      status: status || 'Active'
    };

    const updateQuery = {
      type: 'ApplicationMessage',
      id: id
    };

    return await updateDocument(updatedMessage, updateQuery, validateBasicMulti);
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'updateMessage',
        detail: {
          error: error.message
        }
      }
    }));
    return { error: error.message };
  }
}

/**
 * Delete a message
 */
export async function deleteMessage(id) {
  try {
    const query = {
      type: 'ApplicationMessage',
      id: id
    };

    return await deleteDocument(query, validateDocumentDelete);
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'deleteMessage',
        detail: {
          error: error.message
        }
      }
    }));
    return { error: error.message };
  }
}

/**
 * Toggle message enabled status
 */
export async function toggleMessageStatus(id, isEnabled) {
  try {
    const message = await getMessageById(id);
    if (!message) {
      return { error: 'Message not found' };
    }

    const updatedMessage = {
      type: 'ApplicationMessage',
      isEnabled: isEnabled
    };

    const updateQuery = {
      type: 'ApplicationMessage',
      id: id
    };

    return await updateDocument(updatedMessage, updateQuery, validateBasicMulti);
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'toggleMessageStatus',
        detail: {
          error: error.message
        }
      }
    }));
    return { error: error.message };
  }
}
