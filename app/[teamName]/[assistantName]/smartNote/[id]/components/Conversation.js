'use client';

import { Box, Typography, Collapse } from '@mui/material';
import { useDropzone } from 'react-dropzone';
import ChatInteraction from './ChatInteraction.js';
import Prelude from './Prelude.js';
import QTestWorkflow from './QTestWorkflow.js';
import QTestWorkflow2 from './QTestWorkflow2.js';
import { SmartWorkflowSectionConversation } from './SmartWorkflowSection';
import { useSmartNote } from '@/reducers/improved/SmartNoteContext';
import { useChatHistorysDispatch } from '@/reducers/ChatHistoryContext.js';
import { useChatsDispatch } from '@reducers/ChatContext.js';
import { useChatInteractions, useChatInteractionsDispatch } from '@reducers/ChatInteractionContext.js';
import { useSuggestedPromptsDispatch } from '@reducers/SuggestedPromptContext.js';
import { Suspense, useEffect, useRef, useCallback, useState } from 'react';
import LoadingAnimation from './LoadingAnimation.js';
import PropTypes from 'prop-types';
import { useWorkflow, useWorkflowDispatch } from '@reducers/WorkflowContext';
import { selectCurrentChatHistory, createChatHistory, getChats, createChat, getChatInteractions, getSuggestedPrompts } from '@clientServices/smartNoteService';
import { prepDocument } from '@clientServices/insertDocument';
import { useParams } from 'next/navigation.js';
import DmssWorkflow from './DmssWorkflow.js';
import useSnackbar from '@/app/hooks/useSnackbar.js';
import { useGeisingerIntentsDispatch } from '@/reducers/GeisingerIntentContext';


const Conversation = ({ isLoading, isComplete, isWorkflowExpanded, toggleWorkflowBox, children, assistantName: assistantNameProp }) => {
  const smartNote = useSmartNote();
  const chatHistorysDispatch = useChatHistorysDispatch();
  const chatsDispatch = useChatsDispatch();
  const { chatInteractions, selectedChatInteraction } = useChatInteractions();
  const chatInteractionsDispatch = useChatInteractionsDispatch();
  const suggestedPromptsDispatch = useSuggestedPromptsDispatch();
  const conversationEndRef = useRef(null);
  const { selectedWorkflow } = useWorkflow();
  const [markdownHref, setMarkdownHref] = useState(null);
  const workflowDispatch = useWorkflowDispatch();
  const geisingerIntentsDispatch = useGeisingerIntentsDispatch();
  const { SnackbarComponent, showSnackbar } = useSnackbar();

  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [workflowDescription, setWorkflowDescription] = useState('');

  const { teamName, assistantName: paramsAssistantName, id } = useParams();
  const assistantName = assistantNameProp || paramsAssistantName;

  const scrollToBottom = () => {
    !selectedWorkflow && conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  };

  const dmssWorkFlow = selectedWorkflow && selectedWorkflow.name === 'Test Case Generation'

  useEffect(() => {
    scrollToBottom();
  }, [chatInteractions, isLoading]);

  useEffect(() => {
    if (smartNote) {
      const fetchData = async () => {
        if (!selectedChatInteraction || !chatInteractions || chatInteractions.length === 0) {
          let chatHistory = await selectCurrentChatHistory(teamName, assistantName, smartNote);
          if (chatHistory?.error) {
            showSnackbar(`Error loading chat history: ${chatHistory.error}`, 'error', 3000);
          }
          if (!chatHistory) {
            chatHistory = await createChatHistory(teamName, assistantName, prepDocument({ type: 'ChatHistory', smartNoteId: smartNote.id, parentId: smartNote.id, current: true }));
          }
          chatHistorysDispatch({ type: 'SET_CHAT_HISTORY', chatHistory: chatHistory });
          let chats = await getChats(teamName, assistantName, smartNote, chatHistory);
          let chat;
          if (!chats.length || !chats.find(chat => chat.current)) {
            chat = await createChat(teamName, assistantName, smartNote, prepDocument({ type: 'Chat', smartNoteId: smartNote.id, parentId: chatHistory.id, current: true }));
            chats = [chat];
          } else {
            chat = chats.find(chat => chat.current);
          }
          chatsDispatch({ type: 'SET_CHATS', chats: chats });
          chatsDispatch({ type: 'SELECT_CHAT', id: chat.id });
          let chatInteractions = await getChatInteractions(teamName, assistantName, chatHistory, chat);
          if (chatInteractions.length) {
            chatInteractionsDispatch({ type: 'SET_CHAT_INTERACTIONS', chatInteractions: chatInteractions });
            const chatInteraction = chatInteractions[chatInteractions.length - 1];
            chatInteractionsDispatch({ type: 'SELECT_CHAT_INTERACTION', id: chatInteraction.id });
            const suggestedPrompts = await getSuggestedPrompts(teamName, assistantName, smartNote, chatHistory, chat, chatInteraction);
            suggestedPromptsDispatch({ type: 'SET_SUGGESTED_PROMPTS', suggestedPrompts: suggestedPrompts });
          }
        } else {
          chatInteractionsDispatch({ type: 'SET_CHAT_INTERACTIONS', chatInteractions: chatInteractions });
          chatInteractionsDispatch({ type: 'SELECT_CHAT_INTERACTION', id: chatInteractions[chatInteractions.length - 1].id });
        }
      }
      fetchData();
    }

    return () => {
      chatInteractionsDispatch({ type: 'RESET_CHAT_INTERACTIONS' });
      suggestedPromptsDispatch({ type: 'RESET_SUGGESTED_PROMPTS' });
    }
  }, [smartNote, id]);



  function handleMarkdownLinkClick(event, href) {
    event.preventDefault();
    setMarkdownHref(href);
    if (selectedUserRole.name === 'complianceAI2') {
      let documentTypeLabel;
      if (href.endsWith('#conversational')) {
        documentTypeLabel = 'Conversation';
      } else if (href.endsWith('#comparison')) {
        documentTypeLabel = 'Comparison';
      }
      if (documentTypeLabel) {
        geisingerIntentsDispatch({ type: 'SET_GEISINGER_INTERACTION_INTENT', interactionIntent: documentTypeLabel });
      }
    }
  }

  function conversationContent() {
    if (selectedWorkflow) {
      if (selectedWorkflow.name === 'QTest Import Workflow') {
        return <QTestWorkflow2 />
      } else if (dmssWorkFlow) {
        return <DmssWorkflow
          isWorkflowExpanded={isWorkflowExpanded}
          toggleWorkflowBox={toggleWorkflowBox}
          selectedWorkflow={selectedWorkflow}
        />
      } else {
        return (
          <SmartWorkflowSectionConversation
            toggleWorkflowBox={toggleWorkflowBox}
            selectedWorkflow={selectedWorkflow}
            isWorkflowExpanded={isWorkflowExpanded}
          />
        )
      }
    } else {
      return null;
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Render QTestWorkflow use in 'scheduletopay' assistant */}
      {conversationContent()}

      {/* Chat Interactions Scrollable Area */}
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
        {!selectedWorkflow && (children || <Prelude />)}
        <Suspense fallback={<div>Loading...</div>}>
          {chatInteractions.map((chatInteraction) => (
            (chatInteraction.prompt || chatInteraction.response) && (
              <ChatInteraction
                variant="h6"
                key={chatInteraction.id}
                chatInteraction={chatInteraction}
                isComplete={isComplete}
                handleMarkdownLinkClick={handleMarkdownLinkClick}
              />
            )
          ))}
          {isLoading && <LoadingAnimation sx={{ display: 'flex', alignSelf: 'flex-start' }} />}
          <div ref={conversationEndRef} style={{ marginBottom: '50px' }} />
        </Suspense>
      </Box>
      <SnackbarComponent />
    </Box>
  );
};

Conversation.propTypes = {
  isLoading: PropTypes.bool.isRequired,
  isComplete: PropTypes.bool.isRequired,
  isWorkflowExpanded: PropTypes.bool.isRequired, // Add prop type for isWorkflowExpanded
  toggleWorkflowBox: PropTypes.func.isRequired, // Add prop type for toggleWorkflowBox
};

export default Conversation;