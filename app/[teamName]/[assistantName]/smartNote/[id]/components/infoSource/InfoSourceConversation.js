'use client';

import { Suspense, useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import PropTypes from 'prop-types';
import { useSmartNote } from '@/reducers/improved/SmartNoteContext';
import { useChatHistorys, useChatHistorysDispatch } from '@/reducers/ChatHistoryContext.js';
import { useChats, useChatsDispatch } from '@reducers/ChatContext.js';
import { useChatInteractionsDispatch, useChatInteractions } from '@reducers/ChatInteractionContext.js';
import { useSuggestedPromptsDispatch } from '@reducers/SuggestedPromptContext.js';
import { selectCurrentChatHistory, createChatHistory, getChats, createChat, getChatInteractions, getSuggestedPrompts } from '@clientServices/smartNoteService';
import { prepDocument } from '@clientServices/insertDocument';
import { useParams } from 'next/navigation.js';
import InfoSourceChatInteraction from './InfoSourceChatInteraction';

const InfoSourceConversation = ({ isLoading, isComplete }) => {
  const smartNote = useSmartNote();
  const chatHistory = useChatHistorys();
  const chatHistorysDispatch = useChatHistorysDispatch();
  const { selectedChat } = useChats();
  const chatsDispatch = useChatsDispatch();
  const { chatInteractions } = useChatInteractions();
  const chatInteractionsDispatch = useChatInteractionsDispatch();
  const suggestedPromptsDispatch = useSuggestedPromptsDispatch();
  const conversationEndRef = useRef(null);

  const { teamName, assistantName, id } = useParams();

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatInteractions, isLoading]);

  useEffect(() => {
    if (smartNote) {
      const fetchData = async () => {
        let nextChatHistory = await selectCurrentChatHistory(teamName, assistantName, smartNote);
        if (!nextChatHistory) {
          nextChatHistory = await createChatHistory(teamName, assistantName, prepDocument({ type: 'ChatHistory', smartNoteId: smartNote.id, parentId: smartNote.id, current: true }));
        }

        chatHistorysDispatch({ type: 'SET_CHAT_HISTORY', chatHistory: nextChatHistory });

        let chats = await getChats(teamName, assistantName, smartNote, nextChatHistory);
        let nextSelectedChat = chats.find((chatItem) => chatItem.current);

        if (!chats.length || !nextSelectedChat) {
          const chat = await createChat(teamName, assistantName, smartNote, prepDocument({ type: 'Chat', smartNoteId: smartNote.id, parentId: nextChatHistory.id, current: true }));
          chats = chats.length ? [...chats, chat] : [chat];
          nextSelectedChat = chat;
        }

        chatsDispatch({ type: 'SET_CHATS', chats: chats });
        chatsDispatch({ type: 'SELECT_CHAT', id: nextSelectedChat.id });
      };

      fetchData().catch((error) => {
        console.error('InfoSourceConversationInitFailed', error);
      });
    }

    return () => {
      chatInteractionsDispatch({ type: 'RESET_CHAT_INTERACTIONS' });
      suggestedPromptsDispatch({ type: 'RESET_SUGGESTED_PROMPTS' });
    };
  }, [smartNote, id]);

  useEffect(() => {
    const loadSelectedChatInteractions = async () => {
      if (!smartNote || !chatHistory || !selectedChat) {
        return;
      }

      const nextInteractions = await getChatInteractions(teamName, assistantName, chatHistory, selectedChat);
      if (!nextInteractions.length) {
        chatInteractionsDispatch({ type: 'SET_CHAT_INTERACTIONS', chatInteractions: [] });
        suggestedPromptsDispatch({ type: 'SET_SUGGESTED_PROMPTS', suggestedPrompts: [] });
        return;
      }

      const interactionsWithPrompts = await Promise.all(nextInteractions.map(async (interaction) => {
        try {
          const prompts = await getSuggestedPrompts(teamName, assistantName, smartNote, chatHistory, selectedChat, interaction);
          return {
            ...interaction,
            suggestedPrompts: Array.isArray(prompts) ? prompts : []
          };
        } catch (error) {
          return {
            ...interaction,
            suggestedPrompts: []
          };
        }
      }));

      chatInteractionsDispatch({ type: 'SET_CHAT_INTERACTIONS', chatInteractions: interactionsWithPrompts });
      const latestInteraction = interactionsWithPrompts[interactionsWithPrompts.length - 1];
      chatInteractionsDispatch({ type: 'SELECT_CHAT_INTERACTION', id: latestInteraction.id });
      suggestedPromptsDispatch({ type: 'SET_SUGGESTED_PROMPTS', suggestedPrompts: latestInteraction.suggestedPrompts || [] });
    };

    loadSelectedChatInteractions().catch((error) => {
      console.error('InfoSourceConversationLoadByChatFailed', error);
    });
  }, [smartNote, chatHistory, selectedChat?.id, id]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          padding: 2,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          margin: 0,
          boxSizing: 'border-box',
          '&::-webkit-scrollbar': { width: '12px' },
          '&::-webkit-scrollbar-thumb': { backgroundColor: '#b0c4de', borderRadius: '6px' },
        }}
      >
        <Suspense fallback={<div>Loading...</div>}>
          {chatInteractions.map((chatInteraction) => (
            (chatInteraction.prompt || chatInteraction.response) && (
              <InfoSourceChatInteraction
                key={chatInteraction.id}
                chatInteraction={chatInteraction}
                isComplete={isComplete}
              />
            )
          ))}
          <div ref={conversationEndRef} style={{ marginBottom: '50px' }} />
        </Suspense>
      </Box>
    </Box>
  );
};

InfoSourceConversation.propTypes = {
  isLoading: PropTypes.bool.isRequired,
  isComplete: PropTypes.bool.isRequired,
};

export default InfoSourceConversation;
