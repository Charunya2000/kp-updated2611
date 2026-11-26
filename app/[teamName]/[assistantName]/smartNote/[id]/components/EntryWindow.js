'use client';

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Box, TextField, Typography, IconButton, Button, Tooltip, Checkbox, FormControlLabel } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'; // Submit icon
import { useChatHistorys, useChatHistorysDispatch } from '@reducers/ChatHistoryContext';
import { useChats, useChatsDispatch } from '@reducers/ChatContext';
import { useChatInteractions, useChatInteractionsDispatch } from '@reducers/ChatInteractionContext';
import { useSuggestedPrompts, useSuggestedPromptsDispatch } from '@reducers/SuggestedPromptContext';
import { useSmartNote } from '@reducers/improved/SmartNoteContext';
import { useSources } from '@reducers/SourceContext';
import PropTypes from 'prop-types';
import { submitToOpenAI, createChatInteraction, saveChatInteraction, saveSuggestedPrompts } from '@/app/clientServices/entryWindowService';
import { submitToCompliance, submitToComplianceConversation, submitToComplianceComparison } from '@/app/clientServices/complianceService';
import { prepDocument } from '@/app/clientServices/insertDocument';
import { getSuggestedPrompts, getChatInteraction, updateUpdatedAt, selectCurrentChatHistory, createChatHistory, getChats, createChat } from '@/app/clientServices/smartNoteService';
import { useWorkflow } from '@reducers/WorkflowContext';
import { generateTestCases2 } from '@/app/clientServices/testCaseService2';
import { callWorkflowEndpoint } from '@clientServices/conversationService';
import { callCase360Endpoint, callMedicareCompanionEndpoint } from '@/app/clientServices/orchestrationAssistantsConversationService';
import { useUserAssistants } from '@/reducers/UserAssistantContext';
import { useTheme } from '@mui/material/styles';
import { useParams } from 'next/navigation';
import { useGeisingerIntents, useGeisingerIntentsDispatch } from '@reducers/GeisingerIntentContext';


const EntryWindow = ({ setIsLoading, setIsComplete, toggleWorkflowBox, chatInputRef, infoSourceFilters = null, onBackgroundJobStarted = null, mrnInput = '', epdsEnabled = false, epdsFilters = null, assistantName: assistantNameProp, onEpdsEnabledChange, isEpdsFeatureEnabled = false }) => {
  const smartNote = useSmartNote();
  const chatHistory = useChatHistorys();
  const chatHistoryDispatch = useChatHistorysDispatch();
  const { selectedChat } = useChats();
  const chatsDispatch = useChatsDispatch();
  const { selectedChatInteraction } = useChatInteractions();
  const chatInteractionDispath = useChatInteractionsDispatch();
  const { suggestedPrompts } = useSuggestedPrompts();
  const suggestedPromptsDispatch = useSuggestedPromptsDispatch();
  const geisingerIntentsDispatch = useGeisingerIntentsDispatch();
  const { lobIntent, interactionIntent, geisingerConversation, geisingerComparison } = useGeisingerIntents();
  const { sources } = useSources();
  const scrollContainerRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const { selectedWorkflow, files } = useWorkflow();
  const { selectedUserAssistant } = useUserAssistants();
  const theme = useTheme();
  const { teamName: paramsTeamName, assistantName: paramsAssistantName } = useParams();
  const teamName = paramsTeamName || selectedUserAssistant?.teamName || smartNote?.teamName;
  const assistantName = assistantNameProp || paramsAssistantName || selectedUserAssistant?.name || smartNote?.assistantName || smartNote?.selectedUserAssistant;

  const MEMBERSHIP_ASSISTANTS = [
    'case-360-assistant',
  ];

  const ORCHESTRATION_APP_ASSISTANTS = [
    'medicare-companion',
  ];

  const ORCHESTRATION_APP_ENDPOINTS = {
    'Case360 Assistant General Chat': {
      path: 'api/case360/route',
    },
    'Case360 Assistant EPDS Chat': {
      path: 'api/case360/epds/route',
    }
  };

  const buildSubmitErrorMessage = (error) => {
    const detail = error?.message ? String(error.message) : '';
    return detail
      ? `I was unable to process that request. ${detail}`
      : 'I was unable to process that request. Please try again later.';
  };

  const persistFailedInteraction = async (conversationContext, chatInteraction, error) => {
    if (!conversationContext?.activeChat || !conversationContext?.activeChatHistory || !chatInteraction) {
      return;
    }

    const failedInteraction = {
      ...chatInteraction,
      response: buildSubmitErrorMessage(error),
      isComplete: true,
    };

    chatInteractionDispath({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: failedInteraction });
    await saveChatInteraction(
      teamName,
      assistantName,
      smartNote,
      conversationContext.activeChatHistory,
      conversationContext.activeChat,
      failedInteraction
    );
  };

  const ensureConversationContext = async () => {
    if (!smartNote) {
      return null;
    }

    let activeChatHistory = chatHistory;
    if (!activeChatHistory) {
      activeChatHistory = await selectCurrentChatHistory(teamName, assistantName, smartNote);
      if (!activeChatHistory || activeChatHistory.error) {
        activeChatHistory = await createChatHistory(
          teamName,
          assistantName,
          prepDocument({ type: 'ChatHistory', smartNoteId: smartNote.id, parentId: smartNote.id, current: true })
        );
      }
      chatHistoryDispatch({ type: 'SET_CHAT_HISTORY', chatHistory: activeChatHistory });
    }

    let activeChat = selectedChat;
    if (!activeChat) {
      const chats = await getChats(teamName, assistantName, smartNote, activeChatHistory);
      activeChat = chats.find((chat) => chat.current) || chats[0];

      if (!activeChat) {
        activeChat = await createChat(
          teamName,
          assistantName,
          smartNote,
          prepDocument({ type: 'Chat', smartNoteId: smartNote.id, parentId: activeChatHistory.id, current: true })
        );
      }

      chatsDispatch({ type: 'SET_CHATS', chats: chats.length ? chats : [activeChat] });
      chatsDispatch({ type: 'SELECT_CHAT', id: activeChat.id });
    }

    return { activeChat, activeChatHistory };
  };

  const checkForScroll = () => {
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current || {};
    setShowLeftArrow(scrollLeft > 0);
    setShowRightArrow(scrollLeft + clientWidth < scrollWidth);
  };

  // Memoize the key parameters for suggested prompts to prevent unnecessary API calls
  const suggestedPromptsParams = useMemo(() => ({
    teamName,
    assistantName,
    smartNoteId: smartNote?.id,
    selectedChatId: selectedChat?.id,
    selectedChatInteractionId: selectedChatInteraction?.id,
  }), [teamName, assistantName, smartNote?.id, selectedChat?.id, selectedChatInteraction?.id]);

  // Resize listener effect
  useEffect(() => {
    const handleResize = () => checkForScroll();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Suggested prompts effect - only refetches when memoized params change, not during streaming
  useEffect(() => {
    if (selectedChatInteraction && smartNote) {
      const fetchData = async () => {
        const suggestedPrompts = await getSuggestedPrompts(teamName, assistantName, smartNote, chatHistory, selectedChat, selectedChatInteraction);
        suggestedPromptsDispatch({ type: 'SET_SUGGESTED_PROMPTS', suggestedPrompts: suggestedPrompts });
        checkForScroll();
      }
      fetchData();
    }
  }, [suggestedPromptsParams, suggestedPromptsDispatch]);

  const handleScrollLeft = () => {
    // scroll by 1/3 of the container's width to the left
    // minus width of the arrow
    const scrollAmount = scrollContainerRef.current.scrollWidth / 3 - 48;
    scrollContainerRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  };

  const handleScrollRight = () => {
    const scrollAmount = scrollContainerRef.current.scrollWidth / 3 - 48;
    scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  const callAssistantWithInputAndFunctionWithoutStream = async (input, submitFunction, conversationContext) => {
    const { activeChat, activeChatHistory } = conversationContext;

    const currentValue = input;
    const chatInteraction = prepDocument({
      type: 'ChatInteraction',
      parentId: activeChat.id,
      smartNoteId: smartNote.id,
      prompt: currentValue,
      response: null,
      isComplete: false
    });
    chatInteractionDispath({ type: 'CREATE_CHAT_INTERACTION', chatInteraction: chatInteraction });
    let createdChatInteraction;
    try {
      createdChatInteraction = await createChatInteraction(teamName, assistantName, smartNote, activeChatHistory, activeChat, chatInteraction);
    } catch (error) {
      await persistFailedInteraction(conversationContext, chatInteraction, error);
      throw error;
    }

    const activeChatInteraction = createdChatInteraction && createdChatInteraction.id
      ? { ...chatInteraction, ...createdChatInteraction }
      : chatInteraction;

    // Keep client reducer state aligned with the persisted interaction id.
    if (createdChatInteraction?.id && createdChatInteraction.id !== chatInteraction.id) {
      chatInteractionDispath({ type: 'DELETE_CHAT_INTERACTION', id: chatInteraction.id });
      chatInteractionDispath({ type: 'CREATE_CHAT_INTERACTION', chatInteraction: activeChatInteraction });
    }

    let response;
    try {
      response = await submitFunction(teamName, assistantName, smartNote, sources, activeChatInteraction);
    } catch (error) {
      await persistFailedInteraction(conversationContext, activeChatInteraction, error);
      throw error;
    }
    const { responseContent, suggestedPrompts, diagnostics } = response;
    const initialResponseText = String(responseContent || '');
    const isProgressStyleInitialResponse = (() => {
      const lower = initialResponseText.trim().toLowerCase();
      if (!lower) return false;
      return lower.includes('## comparison progress')
        || lower.includes('## conversation progress')
        || lower.includes('starting document comparison')
        || lower.includes('starting comprehensive comparison')
        || lower.includes('running conversation retrieval and analysis')
        || lower.includes('running first-principles conversation retrieval and analysis')
        || initialResponseText.includes('⏳')
        || /\[[^\]\r\n]{1,8}\]\s+Processing:/i.test(initialResponseText);
    })();
    const chatInteractionWithResponse = { ...activeChatInteraction, response: responseContent };
    const isAsyncProgress = diagnostics?.mode === 'async-progress' || isProgressStyleInitialResponse;
    chatInteractionWithResponse.isComplete = !isAsyncProgress;
    chatInteractionDispath({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: chatInteractionWithResponse });
    await saveChatInteraction(teamName, assistantName, smartNote, activeChatHistory, activeChat, chatInteractionWithResponse);

    if (suggestedPrompts && Array.isArray(suggestedPrompts)) {
      const sugPrmtDocs = suggestedPrompts.map((sp) => {
        return prepDocument({
          type: 'SuggestedPrompt',
          parentId: chatInteractionWithResponse.id,
          smartNoteId: smartNote.id,
          prompt: sp
        });
      });
      suggestedPromptsDispatch({
        type: 'SET_SUGGESTED_PROMPTS', suggestedPrompts: sugPrmtDocs
      });
      await saveSuggestedPrompts(teamName, assistantName, smartNote, activeChatHistory, activeChat, activeChatInteraction, sugPrmtDocs);
    }

    if (isAsyncProgress) {
      const maxPollAttempts = 240;
      const pollIntervalMs = 2000;
      const isLikelyTransientComparisonResponse = (text) => {
        const value = String(text || '').trim().toLowerCase();
        if (!value) return true;

        return value.includes('starting document comparison')
          || value.includes('starting comprehensive comparison')
          || value.includes('starting first-principles')
          || value.includes('loading source and target documents')
          || value.includes('detected topic mode')
          || value.includes('detected comprehensive mode')
          || value.includes('evaluating topic-level differences')
          || value.includes('evaluating full-document topic alignment')
          || value.includes('drafting comparison narrative')
          || value.includes('comparison progress');
      };

      const isProgressMessage = (text) => {
        const value = String(text || '');
        return value.includes('⏳')
          || value.includes('🤖 AI processing')
          || /\[[^\]\r\n]{1,8}\]\s+Processing:/i.test(value)
          || value.includes('## Conversation Progress')
          || value.includes('## Comparison Progress')
          || isLikelyTransientComparisonResponse(value);
      };

      for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

        let refreshedInteraction = null;
        try {
          refreshedInteraction = await getChatInteraction(teamName, assistantName, activeChatHistory, activeChat, activeChatInteraction);
        } catch (e) {
          continue;
        }

        if (!refreshedInteraction || !refreshedInteraction.id) {
          continue;
        }

        const refreshedResponse = String(refreshedInteraction.response || '');
        const done = refreshedInteraction.isComplete === true
          || (refreshedResponse && !isProgressMessage(refreshedResponse));

        chatInteractionDispath({
          type: 'UPDATE_CHAT_INTERACTION',
          chatInteraction: {
            ...refreshedInteraction,
            isComplete: done,
          }
        });

        if (done) {
          break;
        }
      }
    }

    checkForScroll();
    setIsComplete(true);
    setIsLoading(false);
    return response;
  }

  const startBackgroundJob = async (backgroundJobId, chatInteraction) => {
    const chatInteractionWithBgJob = {
      ...chatInteraction,
      backgroundJobId,
      response: 'Hold on while I process your query...',
      isComplete: false,
    };
    chatInteractionDispath({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: chatInteractionWithBgJob });
    await saveChatInteraction(teamName, assistantName, smartNote, chatHistory, selectedChat, chatInteractionWithBgJob);

    if (onBackgroundJobStarted) {
      onBackgroundJobStarted(backgroundJobId, chatInteractionWithBgJob);
    }
  };

  const callAssistantWithInputAndFunction = async (input, submitFunction, conversationContext) => {
    const { activeChat, activeChatHistory } = conversationContext;
    const currentValue = input;
    const chatInteraction = prepDocument({
      type: 'ChatInteraction',
      parentId: activeChat.id,
      smartNoteId: smartNote.id,
      prompt: currentValue,
      response: null,
      isComplete: false
    });
    chatInteractionDispath({ type: 'CREATE_CHAT_INTERACTION', chatInteraction: chatInteraction });
    try {
      await createChatInteraction(teamName, assistantName, smartNote, activeChatHistory, activeChat, chatInteraction);
    } catch (error) {
      await persistFailedInteraction(conversationContext, chatInteraction, error);
      throw error;
    }
    let responseContent = '';
    let suggestedPrompts = [];
    let responseCitations = [];
    let retrievalMetadata = null;
    let chatInteractionWithResponse = { ...chatInteraction, response: responseContent, citations: responseCitations, retrieval: retrievalMetadata };
    const onToken = (chunk) => {
      responseContent += chunk;
      // Update the chat interaction with the streamed response
      chatInteractionWithResponse = { ...chatInteractionWithResponse, response: responseContent };
      chatInteractionDispath({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: chatInteractionWithResponse });
    }
    const onComplete = async (newSuggestedPrompts) => {
      suggestedPrompts = newSuggestedPrompts;
      if (suggestedPrompts && Array.isArray(suggestedPrompts)) {
        const sugPrmtDocs = suggestedPrompts.map((sp) => {
          return prepDocument({
            type: 'SuggestedPrompt',
            parentId: chatInteractionWithResponse.id,
            smartNoteId: smartNote.id,
            prompt: sp
          });
        });
        chatInteractionWithResponse = { ...chatInteractionWithResponse, suggestedPrompts: sugPrmtDocs };
        chatInteractionDispath({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: chatInteractionWithResponse });
        suggestedPromptsDispatch({
          type: 'SET_SUGGESTED_PROMPTS', suggestedPrompts: sugPrmtDocs
        });
        await saveSuggestedPrompts(teamName, assistantName, smartNote, activeChatHistory, activeChat, chatInteraction, sugPrmtDocs);
        checkForScroll();
      }
    }
    const onCitations = (newCitations) => {
      responseCitations = Array.isArray(newCitations) ? newCitations : [];
      chatInteractionWithResponse = { ...chatInteractionWithResponse, citations: responseCitations };
      chatInteractionDispath({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: chatInteractionWithResponse });
    };
    const onRetrieval = (newRetrieval) => {
      retrievalMetadata = newRetrieval || null;
      chatInteractionWithResponse = { ...chatInteractionWithResponse, retrieval: retrievalMetadata };
      chatInteractionDispath({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: chatInteractionWithResponse });
    };
    try {
      const response = await submitFunction(teamName, assistantName, smartNote, sources, chatInteraction, selectedUserAssistant, onToken, onComplete, onCitations, onRetrieval);

      // Long running assistants return a background job id and are tracked by polling instead
      if (response?.backgroundJobId) {
        await startBackgroundJob(response.backgroundJobId, chatInteraction);
        return;
      }
    } catch (error) {
      await persistFailedInteraction(conversationContext, chatInteractionWithResponse, error);
      throw error;
    }


    chatInteractionWithResponse.isComplete = true;
    chatInteractionDispath({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: chatInteractionWithResponse });
    await saveChatInteraction(teamName, assistantName, smartNote, activeChatHistory, activeChat, chatInteractionWithResponse);

    setIsComplete(true);
    setIsLoading(false);
  }

  const partialConversationFunction = async (teamName, assistantName, smartNote, sources, chatInteraction) => {
    return await submitToComplianceConversation(teamName, assistantName, geisingerConversation, smartNote, sources, chatInteraction);
  }

  const partialComparisonFunction = async (teamName, assistantName, smartNote, sources, chatInteraction) => {
    return await submitToComplianceComparison(teamName, assistantName, geisingerComparison, smartNote, sources, chatInteraction, 'topic');
  }

  const intentHintFunction = async (teamName, assistantName, smartNote, sources, chatInteraction) => {
    return await submitToCompliance(teamName, assistantName, smartNote, sources, chatInteraction, {
      lobIntent,
      interactionIntent,
    });
  }

  const callAssistantWithInputSwitch = async (input, conversationContext) => {
    if (selectedUserAssistant.name === 'complianceai2' && !interactionIntent) {
      const complianceResponse = await callAssistantWithInputAndFunctionWithoutStream(input, intentHintFunction, conversationContext);
      const { lob, interaction } = complianceResponse;
      if (lob) {
        geisingerIntentsDispatch({ type: 'SET_GEISINGER_LOB_INTENT', lobIntent: lob, interactionIntent: interaction });
      }
      if (interaction) {
        geisingerIntentsDispatch({ type: 'SET_GEISINGER_INTERACTION_INTENT', interactionIntent: interaction });
      }
    } else if (selectedUserAssistant.name === 'complianceai2' && interactionIntent === 'Conversation' && geisingerConversation) {
      await callAssistantWithInputAndFunctionWithoutStream(input, partialConversationFunction, conversationContext);
    } else if (selectedUserAssistant.name === 'complianceai2' && interactionIntent === 'Comparison' && geisingerComparison) {
      await callAssistantWithInputAndFunctionWithoutStream(input, partialComparisonFunction, conversationContext);
    } else if (selectedUserAssistant.name === 'complianceai2') {
      const complianceResponse = await callAssistantWithInputAndFunctionWithoutStream(input, intentHintFunction, conversationContext);
      const { lob, interaction } = complianceResponse;
      if (lob) {
        geisingerIntentsDispatch({ type: 'SET_GEISINGER_LOB_INTENT', lobIntent: lob, interactionIntent: interaction });
      }
      if (interaction) {
        geisingerIntentsDispatch({ type: 'SET_GEISINGER_INTERACTION_INTENT', interactionIntent: interaction });
      }
    } else {
      await callAssistantWithInputAndFunction(input, submitToOpenAI, conversationContext);
    }
  }
  const callAssistantWithInput = async (input, conversationContext) => {
    const { activeChat, activeChatHistory } = conversationContext;
    const currentValue = input;
    const chatInteraction = prepDocument({
      type: 'ChatInteraction',
      parentId: activeChat.id,
      smartNoteId: smartNote.id,
      prompt: currentValue,
      response: null,
      isComplete: false
    });
    chatInteractionDispath({ type: 'CREATE_CHAT_INTERACTION', chatInteraction: chatInteraction });
    try {
      await createChatInteraction(teamName, assistantName, smartNote, activeChatHistory, activeChat, chatInteraction);
    } catch (error) {
      await persistFailedInteraction(conversationContext, chatInteraction, error);
      throw error;
    }

    let responseContent = '';
    let suggestedPrompts = [];
    let responseCitations = [];
    let retrievalMetadata = null;
    let chatInteractionWithResponse = { ...chatInteraction, response: responseContent, citations: responseCitations, retrieval: retrievalMetadata };

    try {
      const response = await submitToOpenAI(teamName, assistantName, smartNote, sources, chatInteraction, selectedUserAssistant, (chunk) => {
        responseContent += chunk;
        // Update the chat interaction with the streamed response
        chatInteractionWithResponse = { ...chatInteractionWithResponse, response: responseContent };
        chatInteractionDispath({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: chatInteractionWithResponse });
      }, async (newSuggestedPrompts) => {
        suggestedPrompts = newSuggestedPrompts;
        if (suggestedPrompts && Array.isArray(suggestedPrompts)) {
          const sugPrmtDocs = suggestedPrompts.map((sp) => {
            return prepDocument({
              type: 'SuggestedPrompt',
              parentId: chatInteractionWithResponse.id,
              smartNoteId: smartNote.id,
              prompt: sp
            });
          });
          chatInteractionWithResponse = { ...chatInteractionWithResponse, suggestedPrompts: sugPrmtDocs };
          chatInteractionDispath({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: chatInteractionWithResponse });
          suggestedPromptsDispatch({
            type: 'SET_SUGGESTED_PROMPTS', suggestedPrompts: sugPrmtDocs
          });
          await saveSuggestedPrompts(teamName, assistantName, smartNote, activeChatHistory, activeChat, chatInteraction, sugPrmtDocs);
          checkForScroll();
        }
      }, (newCitations) => {
        responseCitations = Array.isArray(newCitations) ? newCitations : [];
        chatInteractionWithResponse = { ...chatInteractionWithResponse, citations: responseCitations };
        chatInteractionDispath({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: chatInteractionWithResponse });
      }, (newRetrieval) => {
        retrievalMetadata = newRetrieval || null;
        chatInteractionWithResponse = { ...chatInteractionWithResponse, retrieval: retrievalMetadata };
        chatInteractionDispath({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: chatInteractionWithResponse });
      });

      // Long running assistants return a background job id and are tracked by polling instead
      if (response?.backgroundJobId) {
        await startBackgroundJob(response.backgroundJobId, chatInteraction);
        return;
      }
    } catch (error) {
      await persistFailedInteraction(conversationContext, chatInteractionWithResponse, error);
      throw error;
    }


    chatInteractionWithResponse.isComplete = true;
    chatInteractionDispath({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: chatInteractionWithResponse });

    // DMSS Users should be able to convert the Markdow response to an Excel format
    if (selectedUserAssistant.name === 'document-management-shared-service' && responseContent.startsWith('|')) {
      chatInteractionWithResponse.canCallConvertToExcelApi = true;
    }
    await saveChatInteraction(teamName, assistantName, smartNote, activeChatHistory, activeChat, chatInteractionWithResponse);

    // Set isComplete to true after the full response has been received and processed
    setIsComplete(true);
    setIsLoading(false);
  };

  const callCase360AssistantWithInput = async (input, conversationContext) => {
    const { activeChat, activeChatHistory } = conversationContext;
    const effectiveEpdsEnabled = Boolean(epdsEnabled);
    const promptCategory = String(chatInputRef?.current?.dataset?.case360PromptCategory || '').toLowerCase();
    const isMrnPrompt = promptCategory === 'mrn';
    const datasetEpdsFilters = (() => {
      try {
        const rawFilters = chatInputRef?.current?.dataset?.epdsFilters;
        return rawFilters ? JSON.parse(rawFilters) : null;
      } catch {
        return null;
      }
    })();
    const effectiveEpdsFilters = epdsFilters || datasetEpdsFilters;
    const shouldUseEpdsFlow = !isMrnPrompt && effectiveEpdsEnabled;

    // Prepare the chat interaction document before calling the endpoint
    const chatInteraction = prepDocument({
      type: 'ChatInteraction',
      parentId: activeChat.id,
      smartNoteId: smartNote.id,
      prompt: input,
      response: null,
      isComplete: false,

    });
    try {
      // Show the user's message immediately in the chat
      chatInteractionDispath({ type: 'CREATE_CHAT_INTERACTION', chatInteraction });
      await createChatInteraction(teamName, assistantName, smartNote, activeChatHistory, activeChat, chatInteraction);

      const case360Path = shouldUseEpdsFlow
        ? ORCHESTRATION_APP_ENDPOINTS['Case360 Assistant EPDS Chat'].path
        : ORCHESTRATION_APP_ENDPOINTS['Case360 Assistant General Chat'].path;

      // Call the Case360 endpoint - returns backgroundJobId immediately (fire and forget)
      const response = await callCase360Endpoint(
        teamName,
        assistantName,
        smartNote.id,
        case360Path,
        input,
        new Date(smartNote.createdAt).toLocaleDateString('en-CA'),
        chatInteraction.id,
        chatInputRef?.current?.dataset?.case360DataEnv === 'perf' ? 'perf' : null,
        shouldUseEpdsFlow ? effectiveEpdsFilters : null
      );

      // Store the backgroundJobId on the chat interaction and show thinking message immediately
      const chatInteractionWithBgJob = {
        ...chatInteraction,
        backgroundJobId: response.backgroundJobId,
        response: 'Let me gather that data for you. Please hold on for a moment...',
      };
      chatInteractionDispath({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: chatInteractionWithBgJob });
      await saveChatInteraction(teamName, assistantName, smartNote, activeChatHistory, activeChat, chatInteractionWithBgJob);

      // Notify Assistant to start polling for the background job
      if (onBackgroundJobStarted) {
        onBackgroundJobStarted(response.backgroundJobId, chatInteractionWithBgJob);
      }

    } catch (error) {
      console.error('Error calling Case360 endpoint:', error.message);
      const chatInteractionWithResponse = {
        ...chatInteraction,
        response: 'An unexpected error occurred while processing your request. Please try again later, or reach out to your admin if the issue persists.',
        isComplete: true,
      };

      chatInteractionDispath({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: chatInteractionWithResponse });
      await saveChatInteraction(teamName, assistantName, smartNote, activeChatHistory, activeChat, chatInteractionWithResponse);
      setIsLoading(false);
      setIsComplete(true);
    }
  };

  const routeOrchestrationCall = async (input, mrnInput, chatInteractionId) => {
    if (selectedUserAssistant.name === 'medicare-companion') {
      return await callMedicareCompanionEndpoint(
        teamName,
        assistantName,
        smartNote.id,
        input,
        mrnInput,
        chatInteractionId
      );
    }

    throw new Error('No valid orchestration endpoint found for the selected assistant.');
  };

  const callOrchestrationAssistantWithInput = async (input, conversationContext) => {
    const { activeChat, activeChatHistory } = conversationContext;
    // Prepare the chat interaction document before calling the endpoint
    const chatInteraction = prepDocument({
      type: 'ChatInteraction',
      parentId: activeChat.id,
      smartNoteId: smartNote.id,
      prompt: input,
      response: null,
      isComplete: false,
    });
    try {
      // Show the user's message immediately in the chat
      chatInteractionDispath({ type: 'CREATE_CHAT_INTERACTION', chatInteraction });
      await createChatInteraction(teamName, assistantName, smartNote, activeChatHistory, activeChat, chatInteraction);

      // Call Medicare Companion endpoint - returns backgroundJobId immediately (fire and forget)
      const response = await routeOrchestrationCall(input, mrnInput, chatInteraction.id);

      // Store the backgroundJobId on the chat interaction and show thinking message immediately
      const chatInteractionWithBgJob = {
        ...chatInteraction,
        backgroundJobId: response.backgroundJobId,
        response: 'Let me gather that data for you. Please hold on for a moment...',
      };
      chatInteractionDispath({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: chatInteractionWithBgJob });
      await saveChatInteraction(teamName, assistantName, smartNote, activeChatHistory, activeChat, chatInteractionWithBgJob);

      // Notify Assistant to start polling for the background job
      if (onBackgroundJobStarted) {
        onBackgroundJobStarted(response.backgroundJobId, chatInteractionWithBgJob);
      }

    } catch (error) {
      console.error('Error calling orchestration endpoint:', error.message);
      const chatInteractionWithResponse = {
        ...chatInteraction,
        response: 'An unexpected error occurred while processing your request. Please try again later, or reach out to your admin if the issue persists.',
        isComplete: true,
      };

      chatInteractionDispath({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: chatInteractionWithResponse });
      await saveChatInteraction(teamName, assistantName, smartNote, activeChatHistory, activeChat, chatInteractionWithResponse);
      setIsLoading(false);
      setIsComplete(true);
    }
  };

  const submitWorkflow = async (input, conversationContext) => {
    const { activeChat, activeChatHistory } = conversationContext;
    try {
      const chatInteraction = prepDocument({
        type: 'ChatInteraction',
        parentId: activeChat.id,
        smartNoteId: smartNote.id,
        prompt: input,
        response: null,
        isComplete: false,
      });
      chatInteractionDispath({ type: 'CREATE_CHAT_INTERACTION', chatInteraction });
      await createChatInteraction(teamName, assistantName, smartNote, activeChatHistory, activeChat, chatInteraction);

      let response;
      if (selectedWorkflow && selectedWorkflow.name === 'QTest Import Workflow') {
        response = await generateTestCases2(teamName, assistantName, smartNote.id, input);
      } else {
        response = await callWorkflowEndpoint(
          teamName,
          assistantName,
          smartNote.id,
          selectedWorkflow.path,
          input,
          files,
          sources.filter(s => s.selected)
        );
      }

      const chatInteractionWithResponse = {
        ...chatInteraction,
        response: response.response || response.message || '',
        isComplete: true,
      };

      chatInteractionDispath({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: chatInteractionWithResponse });
      await saveChatInteraction(teamName, assistantName, smartNote, activeChatHistory, activeChat, chatInteractionWithResponse);
    } catch (error) {
      console.error('Error calling workflow endpoint:', error.message);
    } finally {
      setIsLoading(false);
      setIsComplete(true);
    }
  };

  const callAssistant = async (conversationContext) => {
    const prompt = chatInputRef.current.value;
    chatInputRef.current.value = '';
    if (selectedWorkflow) {
      await submitWorkflow(prompt, conversationContext);
      // check selectedAssistant to be assistants in MEMBERSHIP_ASSISTANTS and switch to call Case360 specific function
    } else if (selectedUserAssistant && MEMBERSHIP_ASSISTANTS.includes(selectedUserAssistant.name)) {
      await callCase360AssistantWithInput(prompt, conversationContext);
    } else if (selectedUserAssistant && ORCHESTRATION_APP_ASSISTANTS.includes(selectedUserAssistant.name)) {
      await callOrchestrationAssistantWithInput(prompt, conversationContext);
    } else {
      await callAssistantWithInputSwitch(prompt, conversationContext);
    }
  };

  const submitToAssistant = async (e) => {
    e.preventDefault();
    if (!chatInputRef.current?.value?.trim()) {
      return;
    }

    try {
      const conversationContext = await ensureConversationContext();
      if (!conversationContext?.activeChat || !conversationContext?.activeChatHistory) {
        throw new Error('Conversation context is unavailable.');
      }

      setShowLeftArrow(false);
      setShowRightArrow(false);
      setIsLoading(true);
      setIsComplete(false); // Reset isComplete to false before starting a new request

      // Branch for QTest Import Workflow
      if (selectedWorkflow && selectedWorkflow.name === 'QTest Import Workflow') {
        // Prepare the chat interaction document before calling the endpoint
        const chatInteraction = prepDocument({
          type: 'ChatInteraction',
          parentId: conversationContext.activeChat.id,
          smartNoteId: smartNote.id,
          prompt: chatInputRef.current.value,
          response: null,
          isComplete: false,
        });
        chatInteractionDispath({ type: 'CREATE_CHAT_INTERACTION', chatInteraction });
        await createChatInteraction(teamName, assistantName, smartNote, conversationContext.activeChatHistory, conversationContext.activeChat, chatInteraction);
        let response;
        try {
          response = await generateTestCases2(teamName, assistantName, smartNote.id, chatInputRef.current.value);
          const chatInteractionWithResponse = {
            ...chatInteraction,
            response: response.response || response.message || '',
            isComplete: true,
          };
          chatInteractionDispath({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: chatInteractionWithResponse });
          await saveChatInteraction(teamName, assistantName, smartNote, conversationContext.activeChatHistory, conversationContext.activeChat, chatInteractionWithResponse);
        } catch (error) {
          console.error('Error generating QTest Import Workflow test cases:', error.message);

          const chatInteractionWithResponse = {
            ...chatInteraction,
            response: 'An unexpected error occurred while processing your request. Please try again later, or reach out to your admin if the issue persists.',
            isComplete: true,
          };

          chatInteractionDispath({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: chatInteractionWithResponse });
          await saveChatInteraction(teamName, assistantName, smartNote, conversationContext.activeChatHistory, conversationContext.activeChat, chatInteractionWithResponse);
        } finally {
          setIsLoading(false);
          setIsComplete(true);
          toggleWorkflowBox();
        }

        chatInputRef.current.value = '';
        return;
      }

      await callAssistant(conversationContext);
      if (selectedWorkflow) {
        toggleWorkflowBox(); // Collapse the Workflow box
      }
      updateUpdatedAt(teamName, assistantName, smartNote.id);
    } catch (error) {
      console.error('Error submitting prompt:', error);
      setIsLoading(false);
      setIsComplete(true);
    }
  };

  const handleSuggestedPromptClick = async (e, prompt) => {
    e.preventDefault();
    setShowLeftArrow(false);
    setShowRightArrow(false);
    setIsLoading(true);
    setIsComplete(false); // Reset isComplete to false before starting a new request
    try {
      const conversationContext = await ensureConversationContext();
      if (conversationContext?.activeChat && conversationContext?.activeChatHistory) {
        await callAssistantWithInput(prompt, conversationContext);
      } else {
        setIsLoading(false);
        setIsComplete(true);
      }
    } catch (error) {
      console.error('Error submitting suggested prompt:', error);
      setIsLoading(false);
      setIsComplete(true);
    }
  };

  const isCase360 = selectedUserAssistant && MEMBERSHIP_ASSISTANTS.includes(selectedUserAssistant.name);
  const case360MrnMissing = isCase360 && !mrnInput.trim() && !epdsEnabled;
  const isDisabled = (selectedWorkflow && selectedWorkflow.name === 'Test Case Generation') || case360MrnMissing;
  const showEpdsEnabledBanner = isCase360 && isEpdsFeatureEnabled && Boolean(epdsFilters) && epdsEnabled;

  const handleEpdsBannerEnabledChange = (e) => {
    const enabled = e.target.checked;

    if (chatInputRef?.current) {
      chatInputRef.current.dataset.epdsEnabled = enabled ? 'true' : 'false';

      if (!enabled) {
        delete chatInputRef.current.dataset.epdsFilters;
        delete chatInputRef.current.dataset.case360PromptCategory;
      } else if (epdsFilters) {
        chatInputRef.current.dataset.epdsFilters = JSON.stringify(epdsFilters);
      }
    }

    if (onEpdsEnabledChange) {
      onEpdsEnabledChange(enabled);
    }
  };

  return (
    <>
      {showEpdsEnabledBanner ? (
        <Box
          sx={{
            marginX: 2,
            marginBottom: 0.75,
            px: 2,
            py: 0.75,
            borderRadius: 0.75,
            border: '1px solid',
            borderColor: 'primary.dark',
            backgroundColor: 'card.body.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Typography variant="subtitle1" sx={{ color: 'text.primary', fontWeight: 500 }}>
            EPDS Filters are turned on. Responses will be sourced from the EPDS system
          </Typography>

          <FormControlLabel
            control={
              <Checkbox
                checked={epdsEnabled}
                onChange={handleEpdsBannerEnabledChange}
                size="small"
              />
            }
            label={<Typography sx={{ fontSize: '0.95rem', fontWeight: 600, lineHeight: 1 }}>Enabled</Typography>}
            sx={{ m: 0, '& .MuiFormControlLabel-label': { mt: '1px' } }}
          />
        </Box>
      ) : null}

      <Box sx={{ borderRadius: '24px', padding: 2, border: '1px solid', borderColor: 'color.dolphin', marginX: 2, marginBottom: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box component="form"
            onSubmit={submitToAssistant}
            sx={{ display: 'flex', alignItems: 'center', gap: 2, padding: 1 }}>
            <TextField
              disabled={isDisabled || case360MrnMissing}
              multiline
              maxRows={10}
              inputRef={chatInputRef}
              placeholder={case360MrnMissing ? 'Please enter a Medical Record Number in the right panel to use the chat.' : 'Start typing...'}
              variant="outlined"
              fullWidth
              defaultValue=""
              onChange={(e) => {
                if (chatInputRef.current) {
                  chatInputRef.current.value = e.target.value;

                  // Manual typing should not keep a previous MRN-specific routing marker.
                  if (chatInputRef.current.dataset.case360PromptCategory === 'mrn') {
                    delete chatInputRef.current.dataset.case360PromptCategory;
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  // Submit the form
                  submitToAssistant(e);
                }
              }}
              sx={{
                '& .MuiInputLabel-root': {
                  fontSize: '20px', // Larger font size for the label
                },
                '& .MuiInputBase-input': {
                  fontSize: '20px', // Larger font size for the input text
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
            <Typography variant="body1" sx={{ display: 'flex', flexShrink: 0, fontSize: '13pt', fontWeight: '400' }}>
              {sources ? sources.filter(source => source.selected).length : 0} sources
            </Typography>
            <IconButton disabled={isDisabled} type="submit" sx={{ backgroundColor: 'color.contrastBlue', color: 'white', borderRadius: '50%', width: '60px', height: '60px', '&:hover': { backgroundColor: 'primary.dark' } }}>
              <ArrowForwardIcon sx={{ fontSize: '1.5em' }} />
            </IconButton>
          </Box>
          <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            {showLeftArrow && (
              <Box sx={{ position: 'absolute', top: 4, left: 0, zIndex: 1, height: '100%', width: '48px', background: theme.palette.gradient.ltr }}>
                <IconButton
                  onClick={handleScrollLeft}
                  sx={{
                    border: '1px solid',
                    borderColor: 'color.dolphin',
                    backgroundColor: 'background.default',
                    color: 'primary.main',
                    width: '48px',
                    height: '48px',
                    '&:hover': {
                      backgroundColor: 'background.default',
                      border: 'none'
                    }
                  }}
                >
                  <ChevronLeftIcon sx={{ fontSize: '2em' }} />
                </IconButton>
              </Box>
            )}
            <Box
              ref={scrollContainerRef}
              onScroll={checkForScroll}
              sx={{ display: 'flex', overflowX: 'auto', whiteSpace: 'nowrap', gap: 2, '&::-webkit-scrollbar': { display: 'none' }, flexGrow: 1, p: 1 }}
            >
              {Array.isArray(suggestedPrompts) && suggestedPrompts.map((suggestedPrompt) => (
                <Tooltip
                  slotProps={{
                    tooltip: {
                      sx: {
                        maxWidth: 400,
                        fontSize: '11pt',
                      },
                    },
                  }}
                  key={suggestedPrompt.id}
                  title={suggestedPrompt.prompt}
                  placement="top"
                  arrow>
                  <Button
                    variant="action"
                    onClick={(e) => handleSuggestedPromptClick(e, suggestedPrompt.prompt)}
                    sx={{
                      borderRadius: '24px 24px 0 24px',
                      minWidth: '400px'
                    }}
                  >
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'block',
                        width: '100%',
                      }}
                    >
                      {suggestedPrompt.prompt}
                    </span>
                  </Button>
                </Tooltip>
              ))}
            </Box>
            {showRightArrow && (
              <Box sx={{ position: 'absolute', top: 4, right: 0, zIndex: 1, height: '100%', width: '48px', background: theme.palette.gradient.rtl }}>
                <IconButton
                  onClick={handleScrollRight}
                  sx={{
                    border: '1px solid',
                    borderColor: 'color.dolphin',
                    backgroundColor: 'background.default',
                    color: 'primary.main',
                    width: '48px',
                    height: '48px',
                    '&:hover': {
                      backgroundColor: 'background.default',
                      border: 'none'
                    }
                  }}
                >
                  <ChevronRightIcon sx={{ fontSize: '2em' }} />
                </IconButton>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </>
  );
};

export default EntryWindow;

EntryWindow.propTypes = {
  setIsLoading: PropTypes.func.isRequired,
  setIsComplete: PropTypes.func.isRequired,
  toggleWorkflowBox: PropTypes.func.isRequired,
  infoSourceFilters: PropTypes.object,
  onBackgroundJobStarted: PropTypes.func,
};