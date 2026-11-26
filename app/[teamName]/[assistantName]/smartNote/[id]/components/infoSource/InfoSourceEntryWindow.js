'use client';

import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Box, IconButton, TextField, Typography } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useParams } from 'next/navigation';
import { useChatHistorys } from '@reducers/ChatHistoryContext';
import { useChats } from '@reducers/ChatContext';
import { useChatInteractionsDispatch } from '@reducers/ChatInteractionContext';
import { useSuggestedPromptsDispatch } from '@reducers/SuggestedPromptContext';
import { useSmartNote } from '@reducers/improved/SmartNoteContext';
import { useSources } from '@reducers/SourceContext';
import { useUserAssistants } from '@/reducers/UserAssistantContext';
import {
  createChatInteraction,
  getInfoSourceChatInteractionProgress,
  saveChatInteraction,
  submitToInfoSourceAssistant,
} from '@/app/clientServices/entryWindowService';
import { prepDocument } from '@/app/clientServices/insertDocument';
import { getSuggestedPrompts, updateUpdatedAt } from '@/app/clientServices/smartNoteService';

const INFO_SOURCE_POLL_INTERVAL_MS = 10000;
const MAX_INFO_SOURCE_POLL_ATTEMPTS = 24;

function getInitialInfoSourceProgressMessage() {
  return '## Intelligent Sales Agent Progress\n\n Starting ISA retrieval...\n\n---\n';
}

const InfoSourceEntryWindow = ({ setIsLoading, setIsComplete, chatInputRef, infoSourceFilters = null }) => {
  const smartNote = useSmartNote();
  const chatHistory = useChatHistorys();
  const { selectedChat } = useChats();
  const chatInteractionDispatch = useChatInteractionsDispatch();
  const suggestedPromptsDispatch = useSuggestedPromptsDispatch();
  const { sources } = useSources();
  const { selectedUserAssistant } = useUserAssistants();
  const infoSourcePollingTimeoutRef = useRef(null);
  const latestInfoSourcePollIdRef = useRef(null);
  const submitSuggestedPromptRef = useRef(null);
  const { teamName, assistantName } = useParams();

  const clearInfoSourcePolling = () => {
    if (infoSourcePollingTimeoutRef.current) {
      clearTimeout(infoSourcePollingTimeoutRef.current);
      infoSourcePollingTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearInfoSourcePolling();
      latestInfoSourcePollIdRef.current = null;
    };
  }, []);

  useEffect(() => {
    clearInfoSourcePolling();
    latestInfoSourcePollIdRef.current = null;
  }, [selectedChat?.id]);

  const pollInfoSourceCompletion = async (chat, chatInteraction) => {
    const pollId = chatInteraction.id;
    let pollAttemptCount = 0;
    latestInfoSourcePollIdRef.current = pollId;

    const poll = async () => {
      if (latestInfoSourcePollIdRef.current !== pollId) {
        return;
      }

      pollAttemptCount += 1;

      try {
        const updatedInteraction = await getInfoSourceChatInteractionProgress(
          teamName,
          assistantName,
          smartNote,
          chatHistory,
          chat,
          chatInteraction
        );

        if (latestInfoSourcePollIdRef.current !== pollId) {
          return;
        }

        let nextInteraction = {
          ...chatInteraction,
          ...updatedInteraction,
          citations: Array.isArray(updatedInteraction?.citations) ? updatedInteraction.citations : [],
          retrieval: updatedInteraction?.retrieval || null,
        };

        chatInteractionDispatch({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: nextInteraction });

        const isFinished = Boolean(nextInteraction?.isComplete)
          || ['completed', 'failed'].includes(nextInteraction?.processingStatus);

        if (isFinished) {
          clearInfoSourcePolling();

          let suggestedPromptDocs = [];
          if (nextInteraction?.processingStatus !== 'failed') {
            try {
              suggestedPromptDocs = await getSuggestedPrompts(teamName, assistantName, smartNote, chatHistory, chat, nextInteraction);
            } catch (error) {
              console.error('Failed to load InfoSource suggested prompts after completion:', error);
            }
          }

          nextInteraction = {
            ...nextInteraction,
            suggestedPrompts: Array.isArray(suggestedPromptDocs) ? suggestedPromptDocs : []
          };

          chatInteractionDispatch({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: nextInteraction });
          suggestedPromptsDispatch({
            type: 'SET_SUGGESTED_PROMPTS',
            suggestedPrompts: Array.isArray(suggestedPromptDocs) ? suggestedPromptDocs : []
          });

          setIsLoading(false);
          setIsComplete(true);
          return;
        }
      } catch (error) {
        console.error('Error polling InfoSource progress:', error);
      }

      if (pollAttemptCount >= MAX_INFO_SOURCE_POLL_ATTEMPTS) {
        clearInfoSourcePolling();

        const timedOutInteraction = {
          ...chatInteraction,
          response: 'InfoSource retrieval timed out while waiting for progress updates. Please try again.',
          citations: [],
          retrieval: { dataSource: 'poll-timeout' },
          isComplete: true,
          processingStatus: 'failed'
        };

        chatInteractionDispatch({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: timedOutInteraction });
        suggestedPromptsDispatch({ type: 'SET_SUGGESTED_PROMPTS', suggestedPrompts: [] });
        await saveChatInteraction(teamName, assistantName, smartNote, chatHistory, chat, timedOutInteraction);
        setIsLoading(false);
        setIsComplete(true);
        return;
      }

      infoSourcePollingTimeoutRef.current = setTimeout(poll, INFO_SOURCE_POLL_INTERVAL_MS);
    };

    await poll();
  };

  const callInfoSourceAssistantWithInput = async (input) => {
    clearInfoSourcePolling();

    const chatInteraction = prepDocument({
      type: 'ChatInteraction',
      parentId: selectedChat.id,
      smartNoteId: smartNote.id,
      prompt: input,
      response: null,
      isComplete: false,
      processingStatus: 'queued'
    });

    chatInteractionDispatch({ type: 'CREATE_CHAT_INTERACTION', chatInteraction });
    await createChatInteraction(teamName, assistantName, smartNote, chatHistory, selectedChat, chatInteraction);

    let chatInteractionWithProgress = {
      ...chatInteraction,
      response: null,
      citations: [],
      retrieval: null,
      processingStatus: 'queued'
    };

    try {
      const submission = await submitToInfoSourceAssistant(
        teamName,
        assistantName,
        smartNote,
        sources,
        chatInteraction,
        selectedUserAssistant,
        null,
        null,
        null,
        null,
        infoSourceFilters
      );

      if (submission?.mode === 'direct') {
        const suggestedPrompts = Array.isArray(submission?.suggestedPrompts) ? submission.suggestedPrompts : [];
        const completedInteraction = {
          ...chatInteractionWithProgress,
          response: submission?.markdownResponse || 'Unable to complete InfoSource retrieval for this request. Please try again.',
          citations: Array.isArray(submission?.responseCitations) ? submission.responseCitations : [],
          retrieval: submission?.retrievalDiagnostics || null,
          suggestedPrompts,
          isComplete: true,
          processingStatus: submission?.status || 'completed'
        };

        chatInteractionDispatch({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: completedInteraction });
        suggestedPromptsDispatch({ type: 'SET_SUGGESTED_PROMPTS', suggestedPrompts });
        setIsLoading(false);
        setIsComplete(true);
        return;
      }

      chatInteractionWithProgress = {
        ...chatInteractionWithProgress,
        response: getInitialInfoSourceProgressMessage(),
        processingStatus: submission?.status || 'running'
      };

      chatInteractionDispatch({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: chatInteractionWithProgress });
      await saveChatInteraction(teamName, assistantName, smartNote, chatHistory, selectedChat, chatInteractionWithProgress);
      await pollInfoSourceCompletion(selectedChat, chatInteractionWithProgress);
    } catch (error) {
      clearInfoSourcePolling();
      console.error('Error submitting to InfoSource assistant:', error);

      const failedInteraction = {
        ...chatInteractionWithProgress,
        response: 'Unable to complete InfoSource retrieval for this request. Please try again.',
        citations: [],
        retrieval: { dataSource: 'graph-error' },
        isComplete: true,
        processingStatus: 'failed'
      };

      chatInteractionDispatch({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: failedInteraction });
      suggestedPromptsDispatch({ type: 'SET_SUGGESTED_PROMPTS', suggestedPrompts: [] });
      await saveChatInteraction(teamName, assistantName, smartNote, chatHistory, selectedChat, failedInteraction);
      setIsLoading(false);
      setIsComplete(true);
    }
  };

  submitSuggestedPromptRef.current = async (prompt) => {
    if (!prompt || !selectedChat) {
      return;
    }

    setIsLoading(true);
    setIsComplete(false);
    await callInfoSourceAssistantWithInput(prompt);
  };

  useEffect(() => {
    const handleInfoSourceSuggestedPrompt = (event) => {
      const prompt = event?.detail?.prompt;
      submitSuggestedPromptRef.current?.(prompt);
    };

    window.addEventListener('infosource-suggested-prompt', handleInfoSourceSuggestedPrompt);
    return () => {
      window.removeEventListener('infosource-suggested-prompt', handleInfoSourceSuggestedPrompt);
    };
  }, []);

  const submitToAssistant = async (event) => {
    event.preventDefault();
    if (!chatInputRef.current.value || !selectedChat) {
      return;
    }

    const prompt = chatInputRef.current.value;
    chatInputRef.current.value = '';
    setIsLoading(true);
    setIsComplete(false);

    callInfoSourceAssistantWithInput(prompt);
    updateUpdatedAt(teamName, assistantName, smartNote.id);
  };

  return (
    <Box sx={{ borderRadius: '24px', padding: 2, border: '1px solid', borderColor: 'divider', marginX: 2, marginBottom: 2 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box
          component="form"
          onSubmit={submitToAssistant}
          sx={{ display: 'flex', alignItems: 'center', gap: 2, padding: 1 }}
        >
          <TextField
            multiline
            maxRows={10}
            inputRef={chatInputRef}
            placeholder="Ask ISA..."
            variant="outlined"
            fullWidth
            defaultValue=""
            onChange={(event) => {
              if (chatInputRef.current) {
                chatInputRef.current.value = event.target.value;
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submitToAssistant(event);
              }
            }}
            sx={{
              '& .MuiInputLabel-root': {
                fontSize: '20px',
              },
              '& .MuiInputBase-input': {
                fontSize: '20px',
              },
              '& .MuiOutlinedInput-root': {
                borderRadius: '24px',
                background: 'inherit',
              },
              '& .MuiOutlinedInput-notchedOutline': {
                border: 'none',
              },
            }}
          />
          <IconButton
            disabled={!selectedChat}
            type="submit"
            sx={{ backgroundColor: 'color.contrastBlue', color: 'white', borderRadius: '50%', width: '60px', height: '60px', '&:hover': { backgroundColor: 'primary.dark' } }}
          >
            <ArrowForwardIcon sx={{ fontSize: '1.5em' }} />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};

InfoSourceEntryWindow.propTypes = {
  setIsLoading: PropTypes.func.isRequired,
  setIsComplete: PropTypes.func.isRequired,
  chatInputRef: PropTypes.shape({ current: PropTypes.any }).isRequired,
  infoSourceFilters: PropTypes.object,
};

export default InfoSourceEntryWindow;