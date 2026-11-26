'use client';

import { Box, Snackbar, Alert } from '@mui/material';
import Markdown from './Markdown.js';
import ResponseFooter from './ResponseFooter.js';
import PropTypes from 'prop-types';
import { ChatInteractionType } from '@reducers/SmartNoteTypes.js';
import { useSavedResponsesDispatch, useSavedResponses } from '@reducers/SavedResponseContext';
import { useSmartNote } from '@/reducers/improved/SmartNoteContext.js';
import { useChatInteractionsDispatch } from '@reducers/ChatInteractionContext';
import { prepDocument } from '@/app/clientServices/insertDocument.js';
import { updateUpdatedAt } from '@/app/clientServices/smartNoteService.js';
import { useState } from 'react';
import { createSavedResponse, exportResponseToExcel } from '@/app/clientServices/savedResponseService.js';
import { submitChatInteractionFeedback } from '@/app/clientServices/entryWindowService.js';
import { useParams } from 'next/navigation.js';

const Response = ({ chatInteraction, isComplete }) => {
  const smartNote = useSmartNote();
  const savedResponseDispatch = useSavedResponsesDispatch();
  const { savedResponses } = useSavedResponses();
  const chatInteractionDispatch = useChatInteractionsDispatch();
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'error' });
  const {
    teamName,
    assistantName: assistantNameParam,
    id: smartNoteIdParam
  } = useParams();
  const assistantName = assistantNameParam || smartNote?.selectedUserAssistant;

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleSaveResponse = async () => {
    // prefer client-side context count, fallback to a persistent local counter to avoid duplicates
    const ctxCount = Array.isArray(savedResponses) ? savedResponses.length : 0;
    const nextIndex = ctxCount + 1;

    const title = `Saved Response ${nextIndex}`;
    const savedResponse = prepDocument({
      type: 'SavedResponse',
      responseMarkdown: chatInteraction.response,
      responseSaveDate: new Date().toLocaleString(),
      responseTitle: title,
      parentId: smartNote.id
    });

    const persistedSavedResponse = await createSavedResponse(teamName, assistantName, savedResponse);
    savedResponseDispatch({ type: 'CREATE_SAVED_RESPONSE', savedResponse: persistedSavedResponse });
    updateUpdatedAt(teamName, assistantName, smartNote.id);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(chatInteraction.response).then(() => {
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  const handleExportToExcel = async () => {
    try {
      const blob = await exportResponseToExcel(teamName, assistantName, smartNote, chatInteraction);

      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);

      // Create a temporary anchor element
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${smartNote.title} Test Case.xlsx`);

      // Append to the document, click it, and remove it
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Release the object URL
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error exporting to Excel:', error);
      setSnackbar({
        open: true,
        message: `Failed to export to Excel: ${error.message}`,
        severity: 'error'
      });
    }
  };

  const handleFeedback = async (value) => {
    const currentFeedback = chatInteraction.feedback === '0'
      ? 0
      : chatInteraction.feedback === '1'
        ? 1
        : chatInteraction.feedback;
    const newFeedback = currentFeedback === value ? null : value;
    const smartNoteId = smartNote?.id || chatInteraction?.smartNoteId || smartNoteIdParam;
    const chatInteractionId = chatInteraction?.id;

    if (!teamName || !assistantName || !smartNoteId || !chatInteractionId) {
      setSnackbar({
        open: true,
        message: 'Unable to submit feedback right now (missing interaction context).',
        severity: 'error'
      });
      return;
    }

    try {
      await submitChatInteractionFeedback(teamName, assistantName, smartNoteId, chatInteractionId, newFeedback);
      chatInteractionDispatch({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: { ...chatInteraction, feedback: newFeedback } });
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      setSnackbar({ open: true, message: 'Failed to save your feedback. Please try again.', severity: 'error' });
    }
  };

  return (
    <Box
      sx={{
        color: 'prompt.response.text',
        display: 'flex',
        flexDirection: 'column',
        padding: 2.5, // Use Material-UI spacing (8px * 2 = 16px)
        paddingBottom: 1, // Reduce bottom padding
        backgroundColor: 'prompt.response.background',
        borderRadius: '12px 12px 12px 0px', // Fully rounded corners
        fontSize: '13pt',
        fontWeight: '400',
        textAlign: 'left',
        boxShadow: 'none',
        '&:hover': {
          boxShadow: 'none',
        },
        minWidth: '60%', // Set minimum width to 60%
        maxWidth: '95%', // Set minimum width to 60%
      }}
    >
      <Markdown content={chatInteraction.response} isComplete={isComplete} />
      {isComplete && <ResponseFooter handleSaveResponse={handleSaveResponse} handleCopy={handleCopy} isExcelExportEnabled={chatInteraction.canCallConvertToExcelApi} handleExportToExcel={handleExportToExcel} timeStamp={chatInteraction.createdAt} feedback={chatInteraction.feedback ?? null} onFeedback={handleFeedback} />}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity === 'error' ? 'error' : 'success'}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Response;

Response.propTypes = {
  chatInteraction: PropTypes.arrayOf(ChatInteractionType).isRequired,
  isComplete: PropTypes.bool.isRequired
};