'use client';

import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Divider, Menu, MenuItem, ListItemText, IconButton, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useParams } from 'next/navigation';
import { useSmartNote } from '@reducers/improved/SmartNoteContext';
import { useChatHistorys } from '@reducers/ChatHistoryContext';
import { useChats, useChatsDispatch } from '@reducers/ChatContext';
import { useChatInteractionsDispatch } from '@/reducers/ChatInteractionContext';
import { useSuggestedPromptsDispatch } from '@reducers/SuggestedPromptContext';
import { useWorkflow } from '@reducers/WorkflowContext';
import { clearCurrentChat } from '@/app/clientServices/personaService';
import { createChat, getChats, getChatInteractions } from '@/app/clientServices/smartNoteService';
import { prepDocument } from '@/app/clientServices/insertDocument';
import InfoSourceEntryWindow from './InfoSourceEntryWindow';
import InfoSourceConversation from './InfoSourceConversation';

const InfoSourceAssistant = ({ chatInputRef, infoSourceFilters = null, width = 'max', title = 'Intelligent Sales Agent', subtitle = null, headerMeta = null, showHeader = true }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const smartNote = useSmartNote();
  const chatHistory = useChatHistorys();
  const chatsDispatch = useChatsDispatch();
  const chatInteractionDispatch = useChatInteractionsDispatch();
  const suggestedPromptsDispatch = useSuggestedPromptsDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isDeletingChatId, setIsDeletingChatId] = useState(null);
  const [chatMenuAnchorEl, setChatMenuAnchorEl] = useState(null);
  const [chatPromptTitles, setChatPromptTitles] = useState({});
  const { chats, selectedChat } = useChats();
  const { teamName, assistantName } = useParams();
  const { selectedWorkflow } = useWorkflow();

  const isChatMenuOpen = Boolean(chatMenuAnchorEl);

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
        console.error('Failed to load InfoSource chat prompt titles:', error);
      }
    };

    loadChatPromptTitles();
  }, [smartNote?.id, chatHistory?.id, teamName, assistantName, chats]);

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

  const deleteChatInteractionById = async (chat, interaction) => {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/chatHistory/${chatHistory.id}/chat/${chat.id}/chatInteraction/${interaction.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...interaction,
        type: 'ChatInteraction'
      })
    });
    return await result.json();
  };

  const deleteChatById = async (chat) => {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/chatHistory/${chatHistory.id}/chat/${chat.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...chat,
        type: 'Chat'
      })
    });
    return await result.json();
  };

  // Make assistant width fluid so parent controls column sizing
  const getWidth = () => '100%';

  const handleRefresh = async () => {
    try {
      await clearCurrentChat(teamName, assistantName, smartNote, chatHistory, selectedChat);
      suggestedPromptsDispatch({ type: 'SET_SUGGESTED_PROMPTS', suggestedPrompts: [] });
      chatInteractionDispatch({ type: 'RESET_CHAT_INTERACTIONS' });

      const chat = await createChat(teamName, assistantName, smartNote, prepDocument({ type: 'Chat', smartNoteId: smartNote.id, parentId: chatHistory.id, current: true }));
      const nextChats = await getChats(teamName, assistantName, smartNote, chatHistory);
      chatsDispatch({ type: 'SET_CHATS', chats: nextChats?.length ? nextChats : [chat] });
      chatsDispatch({ type: 'SELECT_CHAT', id: chat.id });
    } catch (error) {
      console.error('Failed to clear InfoSource chat interactions:', error);
    }
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
      suggestedPromptsDispatch({ type: 'RESET_SUGGESTED_PROMPTS' });
      chatInteractionDispatch({ type: 'RESET_CHAT_INTERACTIONS' });
    } catch (error) {
      console.error('Failed to switch InfoSource chat:', error);
    }
  };

  const handleDeletePriorChat = async (event, chat) => {
    event.stopPropagation();

    if (!chat?.id || chat.id === selectedChat?.id || isDeletingChatId || !smartNote?.id || !chatHistory?.id) {
      return;
    }

    try {
      setIsDeletingChatId(chat.id);

      const interactions = await getChatInteractions(teamName, assistantName, chatHistory, chat);
      if (Array.isArray(interactions) && interactions.length) {
        await Promise.all(interactions.map((interaction) => deleteChatInteractionById(chat, interaction)));
      }

      await deleteChatById(chat);

      const remainingChats = sortedChats.filter((chatItem) => chatItem.id !== chat.id);
      const wasCurrent = chat.id === selectedChat?.id;

      if (!wasCurrent) {
        chatsDispatch({ type: 'SET_CHATS', chats: remainingChats });
        return;
      }

      suggestedPromptsDispatch({ type: 'RESET_SUGGESTED_PROMPTS' });
      chatInteractionDispatch({ type: 'RESET_CHAT_INTERACTIONS' });

      if (remainingChats.length) {
        const replacement = remainingChats[0];
        await setChatCurrentFlag(replacement, true);

        const nextChats = remainingChats.map((chatItem) => ({
          ...chatItem,
          current: chatItem.id === replacement.id
        }));

        chatsDispatch({ type: 'SET_CHATS', chats: nextChats });
        chatsDispatch({ type: 'SELECT_CHAT', id: replacement.id });
      } else {
        const newChat = await createChat(teamName, assistantName, smartNote, prepDocument({ type: 'Chat', smartNoteId: smartNote.id, parentId: chatHistory.id, current: true }));
        chatsDispatch({ type: 'SET_CHATS', chats: [newChat] });
        chatsDispatch({ type: 'SELECT_CHAT', id: newChat.id });
      }
    } catch (error) {
      console.error('Failed to delete InfoSource prior chat:', error);
    } finally {
      setIsDeletingChatId(null);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        minWidth: 0,
        maxWidth: '100%',
        height: '100%',
        minHeight: '100%',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: isDarkMode ? 'color.dolphin' : 'rgba(13,28,61,0.18)',
        borderRadius: '15px',
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.primary,
      }}
    >
      {showHeader && (
        <>
          <Box
            sx={{
              display: 'flex',
              width: '100%',
              height: '4em',
              alignItems: 'center',
              gap: 1,
              p: 1.5,
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h5">{title}</Typography>
              {subtitle && (
                <Typography variant="caption" color="text.secondary">
                  {subtitle}
                </Typography>
              )}
            </Box>
            {headerMeta && (
              <Box sx={{ ml: 1, display: 'flex', alignItems: 'center' }}>
                {headerMeta}
              </Box>
            )}
            <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
              <Button
                variant="action"
                startIcon={<HistoryOutlinedIcon style={{ fontSize: '16px' }} />}
                onClick={(event) => setChatMenuAnchorEl(event.currentTarget)}
                disabled={!sortedChats.length}
              >
                Prior Chats
              </Button>
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
          >
            {sortedChats.map((chat, index) => (
              (() => {
                const isCurrent = chat.id === selectedChat?.id;
                return (
                  <MenuItem
                    key={chat.id}
                    selected={isCurrent}
                    onClick={() => handleSelectPriorChat(chat)}
                    sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}
                  >
                    <ListItemText
                      primary={formatChatLabel(chat, index)}
                      secondary={`${formatChatFootnote(chat)}${isCurrent ? '  |  Current chat' : ''}`}
                      secondaryTypographyProps={{ sx: { fontSize: '0.72rem', opacity: 0.75 } }}
                    />
                    {!isCurrent && (
                      <Tooltip title="Delete prior chat">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={(event) => handleDeletePriorChat(event, chat)}
                            disabled={isDeletingChatId === chat.id}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                  </MenuItem>
                );
              })()
            ))}
          </Menu>
          <Divider sx={{ width: '100%' }} />
        </>
      )}
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
            overflowY: 'auto',
            padding: 1.5,
          }}
        >
          <InfoSourceConversation
            isLoading={isLoading}
            isComplete={isComplete}
          />
        </Box>
        {!(selectedWorkflow && selectedWorkflow.name === 'QTest Import Workflow') && (
          <Box sx={{ flexShrink: 0 }}>
            <InfoSourceEntryWindow
              setIsLoading={setIsLoading}
              setIsComplete={setIsComplete}
              infoSourceFilters={infoSourceFilters}
              chatInputRef={chatInputRef}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};

InfoSourceAssistant.defaultProps = {
  width: 'mid',
};

export default InfoSourceAssistant;
