'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Button, Divider, Menu, MenuItem, ListItemText } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import Conversation from './Conversation';
import EntryWindow from './EntryWindow.js';
import { useSmartNote } from '@reducers/improved/SmartNoteContext';
import { useChatHistorys } from '@reducers/ChatHistoryContext';
import { useChats } from '@reducers/ChatContext';
import { useChatInteractions, useChatInteractionsDispatch } from '@/reducers/ChatInteractionContext';
import { clearCurrentChat } from '@/app/clientServices/personaService';
import { useSuggestedPromptsDispatch } from '@reducers/SuggestedPromptContext';
import { useUserAssistants } from '@/reducers/UserAssistantContext.js';
import { createChat, getChats, getChatInteractions, getSuggestedPrompts } from '@/app/clientServices/smartNoteService';
import { Share } from '@mui/icons-material';
import ShareSmartNoteDialog from './ShareSmartNoteDialog';
import { useParams } from 'next/navigation';
import { prepDocument } from '@/app/clientServices/insertDocument';
import { useChatsDispatch } from '@reducers/ChatContext';
import { useWorkflow } from '@reducers/WorkflowContext';
import { getBackgroundJobById } from '@/app/clientServices/backgroundJobService';
import { saveChatInteraction, saveSuggestedPrompts } from '@/app/clientServices/entryWindowService';
import { jobStatus } from '@utils/constants';
import MedCompanionMrnInput from './MedCompanionMrnInput';

const Assistant = ({ chatInputRef, width = 'max', mrnInput = '', epdsEnabled = false, epdsFilters = null, assistantName: assistantNameProp, setMrnInput, isPriorChatEnabled, onEpdsEnabledChange, isEpdsFeatureEnabled = false }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const smartNote = useSmartNote();
  const chatHistory = useChatHistorys();
  const chatsDispatch = useChatsDispatch();
  const { chatInteractions } = useChatInteractions();
  const chatInteractionDispath = useChatInteractionsDispatch();
  const suggestedPromptsDispatch = useSuggestedPromptsDispatch();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [chatMenuAnchorEl, setChatMenuAnchorEl] = useState(null);
  const [chatPromptTitles, setChatPromptTitles] = useState({});
  const { chats, selectedChat } = useChats();
  const [isWorkflowExpanded, setIsWorkflowExpanded] = useState(true);
  const { selectedUserAssistant } = useUserAssistants();
  const { teamName, assistantName: paramsAssistantName, id: smartNoteId } = useParams();
  const assistantName = assistantNameProp || paramsAssistantName;
  const { selectedWorkflow } = useWorkflow();
  const pollingIntervalRef = useRef(null);
  const pollRunIdRef = useRef(0);
  const isChatMenuOpen = Boolean(chatMenuAnchorEl);

  // Hide Share UI for Case360 roles
  const CASE360_ROLES = ['case-360-assistant', 'medicare-companion'];
  const isCase360RoleSelected = selectedUserAssistant && CASE360_ROLES.includes(selectedUserAssistant.name);
  const isMedicareCompanionRoleSelected = selectedUserAssistant && selectedUserAssistant.name === 'medicare-companion';

  const FAST_POLL_INTERVAL_MS = 5000;
  const FAST_POLL_ATTEMPTS = 12;
  const MEDIUM_POLL_INTERVAL_MS = 10000;
  const MEDIUM_POLL_ATTEMPTS = 12;
  const SLOW_POLL_INTERVAL_MS = 20000;
  const MAX_POLL_ATTEMPTS = 30;

  const sortedChats = Array.isArray(chats)
    ? [...chats].sort((a, b) => new Date(b?.updatedAt || b?.createdAt || 0) - new Date(a?.updatedAt || a?.createdAt || 0))
    : [];

  useEffect(() => {
    const loadChatPromptTitles = async () => {
      if (!smartNote?.id || !chatHistory?.id || !sortedChats.length) {
        setChatPromptTitles({});
        return;
      }

      try {
        const entries = await Promise.all(sortedChats.map(async (chat) => {
          const interactions = await getChatInteractions(teamName, assistantName, chatHistory, chat);
          const firstPrompt = Array.isArray(interactions)
            ? interactions.find((interaction) => typeof interaction?.prompt === 'string' && interaction.prompt.trim())?.prompt
            : '';
          return [chat.id, firstPrompt || ''];
        }));

        setChatPromptTitles(Object.fromEntries(entries));
      } catch (error) {
        console.error('Failed to load chat prompt titles:', error);
      }
    };

    loadChatPromptTitles();
  }, [smartNote?.id, chatHistory?.id, teamName, assistantName, chats]);

  const stopPolling = useCallback(() => {
    pollRunIdRef.current += 1;
    if (pollingIntervalRef.current) {
      clearTimeout(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const startBackgroundJobPolling = useCallback((backgroundJobId, chatInteraction) => {
    stopPolling();
    setIsLoading(true);
    setIsComplete(false);

    const runId = pollRunIdRef.current;
    const getDelayMs = (attempt) => {
      if (attempt <= FAST_POLL_ATTEMPTS) {
        return FAST_POLL_INTERVAL_MS;
      }
      if (attempt <= FAST_POLL_ATTEMPTS + MEDIUM_POLL_ATTEMPTS) {
        return MEDIUM_POLL_INTERVAL_MS;
      }
      return SLOW_POLL_INTERVAL_MS;
    };

    let attempts = 0;

    const poll = async () => {
      attempts++;

      try {
        const job = await getBackgroundJobById(teamName, backgroundJobId);

        // Polling was stopped or restarted while the request was in flight
        if (pollRunIdRef.current !== runId) {
          return;
        }

        if (job) {
          // Extract the last message from the background job
          const messages = job.messages || [];
          const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

          if (lastMessage) {
            const updatedInteraction = {
              ...chatInteraction,
              response: lastMessage.content,
              isComplete: false,
            };
            chatInteractionDispath({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: updatedInteraction });
          }

          // Check if the job is done
          if (job.status === jobStatus.COMPLETE || job.status === jobStatus.ERROR) {
            stopPolling();

            const finalResponse = job.status === jobStatus.ERROR
              ? (lastMessage?.content || 'An error occurred while processing your request. Please try again later.')
              : (lastMessage?.content || '');

            const finalInteraction = {
              ...chatInteraction,
              response: finalResponse,
              isComplete: true,
              backgroundJobId: backgroundJobId,
            };

            const jobSuggestedPrompts = job.result?.suggestedPrompts;
            if (Array.isArray(jobSuggestedPrompts) && jobSuggestedPrompts.length) {
              const sugPrmtDocs = jobSuggestedPrompts.map((sp) => prepDocument({
                type: 'SuggestedPrompt',
                parentId: chatInteraction.id,
                smartNoteId: smartNote.id,
                prompt: sp
              }));
              finalInteraction.suggestedPrompts = sugPrmtDocs;
              suggestedPromptsDispatch({ type: 'SET_SUGGESTED_PROMPTS', suggestedPrompts: sugPrmtDocs });
              await saveSuggestedPrompts(teamName, assistantName, smartNote, chatHistory, selectedChat, chatInteraction, sugPrmtDocs);
            }

            chatInteractionDispath({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: finalInteraction });
            setIsLoading(false);
            setIsComplete(true);
            await saveChatInteraction(teamName, assistantName, smartNote, chatHistory, selectedChat, finalInteraction);
            return;
          }
        }
      } catch (error) {
        console.error('Error polling background job:', error.message);
      }

      // Next poll is scheduled only after this one finishes, so polls never overlap
      if (pollRunIdRef.current === runId) {
        if (attempts >= MAX_POLL_ATTEMPTS) {
          stopPolling();
          const timeoutInteraction = {
            ...chatInteraction,
            response: 'The request is taking longer than expected. Please try again later.',
            isComplete: true,
          };
          chatInteractionDispath({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: timeoutInteraction });
          setIsLoading(false);
          setIsComplete(true);
          await saveChatInteraction(teamName, assistantName, smartNote, chatHistory, selectedChat, timeoutInteraction);
          return;
        }
        pollingIntervalRef.current = setTimeout(poll, getDelayMs(attempts + 1));
      }
    };

    pollingIntervalRef.current = setTimeout(poll, getDelayMs(1));
  }, [teamName, assistantName, smartNote, chatHistory, selectedChat, chatInteractionDispath, suggestedPromptsDispatch, stopPolling]);

  // On load: check for incomplete chat interactions with a backgroundJobId and resume polling
  useEffect(() => {
    if (!chatInteractions || !chatInteractions.length) {
      return;
    }

    const incompleteInteraction = chatInteractions.find(
      (ci) => ci.isComplete === false && ci.backgroundJobId
    );

    if (incompleteInteraction) {
      startBackgroundJobPolling(incompleteInteraction.backgroundJobId, incompleteInteraction);
    }
  }, [chatInteractions?.length, startBackgroundJobPolling]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const handleBackgroundJobStarted = useCallback((backgroundJobId, chatInteraction) => {
    startBackgroundJobPolling(backgroundJobId, chatInteraction);
  }, [startBackgroundJobPolling]);

  const getWidth = () => {
    if (width === 'min') return '30%';
    if (width === 'mid') return '45%';
    if (width === 'max') return '100%';
    return '60%';
  };

  const handleRefresh = async () => {
    try {
      await clearCurrentChat(teamName, assistantName, smartNote, chatHistory, selectedChat);
      suggestedPromptsDispatch({ type: 'RESET_SUGGESTED_PROMPTS' });
      chatInteractionDispath({ type: 'RESET_CHAT_INTERACTIONS' });

      const chat = await createChat(teamName, assistantName, smartNote, prepDocument({ type: 'Chat', smartNoteId: smartNote.id, parentId: chatHistory.id, current: true }));
      const nextChats = await getChats(teamName, assistantName, smartNote, chatHistory);
      chatsDispatch({ type: 'SET_CHATS', chats: nextChats?.length ? nextChats : [chat] });
      chatsDispatch({ type: 'SELECT_CHAT', id: chat.id });
    } catch (error) {
      console.error('Failed to delete chat interactions:', error);
    }
  };

  const shorten = (text, maxLength = 56) => {
    if (!text) {
      return '';
    }
    const normalized = String(text).replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }
    return `${normalized.slice(0, maxLength - 3)}...`;
  };

  const formatChatLabel = (chat, index) => {
    const promptTitle = shorten(chatPromptTitles[chat?.id]);
    if (promptTitle) {
      return promptTitle;
    }

    const ts = chat?.updatedAt || chat?.createdAt;
    if (!ts) {
      return `Chat ${sortedChats.length - index}`;
    }
    return new Date(ts).toLocaleString();
  };

  const formatChatFootnote = (chat) => {
    const ts = chat?.updatedAt || chat?.createdAt;
    return ts ? new Date(ts).toLocaleString() : 'No timestamp';
  };

  const setChatCurrentFlag = async (chat, isCurrent) => {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/chatHistory/${chatHistory.id}/chat/${chat.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...chat, current: isCurrent })
    });
    return await result.json();
  };

  const handleSelectPriorChat = async (chat) => {
    setChatMenuAnchorEl(null);
    if (!chat?.id || selectedChat?.id === chat.id) {
      return;
    }

    try {
      if (selectedChat?.id) {
        await clearCurrentChat(teamName, assistantName, smartNote, chatHistory, selectedChat);
      }

      await setChatCurrentFlag(chat, true);

      const nextChats = sortedChats.map((chatItem) => ({
        ...chatItem,
        current: chatItem.id === chat.id
      }));

      chatsDispatch({ type: 'SET_CHATS', chats: nextChats });
      chatsDispatch({ type: 'SELECT_CHAT', id: chat.id });

      const nextInteractions = await getChatInteractions(teamName, assistantName, chatHistory, chat);
      if (Array.isArray(nextInteractions) && nextInteractions.length > 0) {
        chatInteractionDispath({ type: 'SET_CHAT_INTERACTIONS', chatInteractions: nextInteractions });
        const lastInteraction = nextInteractions[nextInteractions.length - 1];
        chatInteractionDispath({ type: 'SELECT_CHAT_INTERACTION', id: lastInteraction.id });

        const nextSuggestedPrompts = await getSuggestedPrompts(teamName, assistantName, smartNote, chatHistory, chat, lastInteraction);
        suggestedPromptsDispatch({ type: 'SET_SUGGESTED_PROMPTS', suggestedPrompts: nextSuggestedPrompts || [] });
      } else {
        chatInteractionDispath({ type: 'RESET_CHAT_INTERACTIONS' });
        suggestedPromptsDispatch({ type: 'RESET_SUGGESTED_PROMPTS' });
      }
    } catch (error) {
      console.error('Failed to switch prior chat:', error);
    }
  };

  const toggleWorkflowBox = () => {
    setIsWorkflowExpanded((prev) => !prev);
  };

  function handleShareClicked() {
    setShareDialogOpen(true);
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        width: getWidth(),
        height: '100%',
        minHeight: '100%',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'color.dolphin',
        borderRadius: '15px',
        backgroundColor: 'card.body.deep',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          width: '100%',
          height: '4em',
          alignItems: 'center',
          gap: 1,
          p: 2,
        }}
      >
        <Typography variant="h5">Assistant</Typography>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          {!isCase360RoleSelected && (
            <Button
              variant="action"
              startIcon={<Share style={{ fontSize: '16px' }} />}
              onClick={handleShareClicked}
            >
              Share
            </Button>
          )}
          {isPriorChatEnabled && (
            <Button
              variant="action"
              startIcon={<HistoryOutlinedIcon style={{ fontSize: '16px' }} />}
              onClick={(event) => setChatMenuAnchorEl(event.currentTarget)}
              disabled={!sortedChats.length}
            >
              Prior Chats
            </Button>
          )}
          <Button
            variant="action"
            startIcon={<ChatBubbleOutlineIcon style={{ fontSize: '16px' }} />}
            onClick={handleRefresh}
          >
            New Chat
          </Button>
        </Box>
      </Box>
      <Menu
        anchorEl={chatMenuAnchorEl}
        open={isChatMenuOpen}
        onClose={() => setChatMenuAnchorEl(null)}
        keepMounted
        slotProps={{
          paper: {
            sx: {
              maxHeight: '50%',
              overflowY: 'auto',
            },
          },
        }}
      >
        {sortedChats.map((chat, index) => (
          <MenuItem
            key={chat.id ?? `chat-${index}`}
            selected={chat.id === selectedChat?.id}
            onClick={() => handleSelectPriorChat(chat)}
          >
            <ListItemText
              primary={formatChatLabel(chat, index)}
              secondary={`${formatChatFootnote(chat)}${chat.id === selectedChat?.id ? '  |  Current chat' : ''}`}
              secondaryTypographyProps={{ sx: { fontSize: '0.72rem', opacity: 0.75 } }}
            />
          </MenuItem>
        ))}
      </Menu>
      <Divider sx={{ width: '100%' }} />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            flexGrow: 1,
            overflowY: 'auto', // Ensure only the chat interactions scroll
            padding: 2,
          }}
        >
          <Conversation
            isLoading={isLoading}
            isComplete={isComplete}
            isWorkflowExpanded={isWorkflowExpanded}
            toggleWorkflowBox={toggleWorkflowBox}
            assistantName={assistantName}
          />
        </Box>
        {!(selectedWorkflow && selectedWorkflow.name === 'QTest Import Workflow') && <Box
          sx={{
            flexShrink: 0,
          }}
        >
          {isMedicareCompanionRoleSelected && <MedCompanionMrnInput mrnInput={mrnInput} setMrnInput={setMrnInput} />}
          <EntryWindow
            setIsLoading={setIsLoading}
            setIsComplete={setIsComplete}
            toggleWorkflowBox={toggleWorkflowBox}
            chatInputRef={chatInputRef}
            onBackgroundJobStarted={handleBackgroundJobStarted}
            assistantName={assistantName}
            mrnInput={mrnInput}
            epdsEnabled={epdsEnabled}
            epdsFilters={epdsFilters}
            onEpdsEnabledChange={onEpdsEnabledChange}
            isEpdsFeatureEnabled={isEpdsFeatureEnabled}
          />
        </Box>}
      </Box>
      {!isCase360RoleSelected && (
        <ShareSmartNoteDialog
          open={shareDialogOpen}
          onClose={() => setShareDialogOpen(false)}
          smartNoteId={smartNote?.id}
        />
      )}
    </Box>
  );
};

Assistant.defaultProps = {
  width: 'mid',
};

export default Assistant;