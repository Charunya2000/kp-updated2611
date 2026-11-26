
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Box, Typography, Select, MenuItem, TextField, Chip, CircularProgress, Autocomplete, Button, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Paper, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Close';
import { styled } from '@mui/material/styles';
import { useGeisingerIntents, useGeisingerIntentsDispatch } from '@reducers/GeisingerIntentContext';
import { findConversationById, geisingerDocComparision, findExistingConversations, submitToComplianceComparison, cancelComplianceComparison, fetchComparisonJobs as fetchComparisonJobsApi, deleteGeisingerComparisons } from '@clientServices/complianceService';
import { useParams } from 'next/navigation';
import { useSmartNote } from '@reducers/improved/SmartNoteContext';
import { useChatHistorys, useChatHistorysDispatch } from '@reducers/ChatHistoryContext';
import { useChats, useChatsDispatch } from '@reducers/ChatContext';
import { useChatInteractions, useChatInteractionsDispatch } from '@reducers/ChatInteractionContext';
import { prepDocument } from '@clientServices/insertDocument';
import { selectCurrentChatHistory, createChatHistory, getChats, createChat, getChatInteraction, getChatInteractions } from '@clientServices/smartNoteService';
import { createChatInteraction, saveChatInteraction } from '@clientServices/entryWindowService';
import { useSources } from '@reducers/SourceContext';


const LOB_OPTIONS = ['CHIP', 'Marketplace', 'Medicare', 'Medicaid', 'Commercial', 'NCQA'];
const DOC_INTEL_OPTIONS = ['Conversation', 'Comparison'];
const ALL_FILES_BASE_LABEL = 'All Files in Selected LOB';

function getConversationFileName(option) {
  if (!option) return '';
  if (option.allFilesInLob) return option.fileAName || option.name || ALL_FILES_BASE_LABEL;
  return option.fileAName || option.fileName || option.name || 'Untitled';
}

function getConversationFilePath(option) {
  if (!option || option.allFilesInLob) return '';
  return option.relativeAUrl || option.relativeUrl || '';
}

function normalizeFileOptionLabel(option) {
  if (!option) return '';
  return getConversationFileName(option);
}

function isSameConversation(a, b) {
  if (!a || !b) return false;
  if (a.allFilesInLob || b.allFilesInLob) {
    return !!a.allFilesInLob && !!b.allFilesInLob;
  }
  return String(a.id || '') === String(b.id || '')
    || (
      String(a.relativeAUrl || a.relativeUrl || '') === String(b.relativeAUrl || b.relativeUrl || '')
      && String(a.fileAName || a.fileName || a.name || '') === String(b.fileAName || b.fileName || b.name || '')
    );
}

const StyledSelect = styled(Select)(({ theme }) => ({
  background: theme.palette.card?.body?.main || '#e6f0fb', // pale blue background
  borderRadius: 28,
  fontSize: '1.1rem',
  fontWeight: 500,
  color: theme.palette.primary.main || '#0078B3', // blue text to match button
  boxShadow: 'none',
  border: `2px solid ${theme.palette.primary.main || '#0078B3'}`,
  transition: 'border-color 0.2s, background 0.2s',
  '& .MuiSelect-select': {
    padding: '10px 16px',
    minHeight: '1.5em',
    display: 'flex',
    alignItems: 'center',
    background: 'transparent',
    color: theme.palette.primary.main || '#0078B3', // blue text inside select
  },
  '& fieldset': {
    border: 'none',
  },
  '&:hover, &.Mui-focused': {
    background: theme.palette.card?.body?.main || '#e6f0fb', // keep hover pale blue
    borderColor: theme.palette.primary.dark || '#003B71',
    color: theme.palette.primary.main || '#0078B3',
  },
  '& .MuiOutlinedInput-notchedOutline': {
    border: 'none',
  },
  '& .MuiMenu-paper': {
    background: theme.palette.card?.body?.main || '#e6f0fb',
    color: theme.palette.primary.main || '#0078B3', // blue text in dropdown
  },
  '& .MuiMenuItem-root': {
    color: theme.palette.primary.main || '#0078B3', // blue text for menu items
    '&:hover': {
      background: theme.palette.card?.body?.main || '#e6f0fb',
      color: theme.palette.primary.main || '#0078B3',
    },
  },
}));

export default function GeisingerContext() {
  // State and logic for async comparison jobs table
  const [comparisonJobs, setComparisonJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const { teamName, assistantName } = useParams();
  const {
    lobIntent,
    interactionIntent,
    conversationDoc,
    compareFromDoc,
    compareToDoc,
    geisingerConversation,
    geisingerConversationInteraction,
    geisingerComparison,
  } = useGeisingerIntents();
  const smartNote = useSmartNote();
  const { sources } = useSources();
  const chatHistory = useChatHistorys();
  const chatHistorysDispatch = useChatHistorysDispatch();
  const { selectedChat } = useChats();
  const chatsDispatch = useChatsDispatch();
  const { selectedChatInteraction } = useChatInteractions();
  const chatInteractionsDispatch = useChatInteractionsDispatch();
  const geisingerIntentsDispatch = useGeisingerIntentsDispatch();
  const [context, setContext] = useState({
    'Line of Business': lobIntent ?? '',
    'Document Intelligence': interactionIntent ?? '',
    'Conversation Doc': conversationDoc?.name ?? '',
    'Conversation Doc URL': conversationDoc?.relativeUrl ?? '',
    'Compare From Doc': compareFromDoc?.name ?? '',
    'Compare From Doc URL': compareFromDoc?.relativeUrl ?? '',
    'Compare To Doc': compareToDoc?.name ?? '',
    'Compare To Doc URL': compareToDoc?.relativeUrl ?? '',
  });
  const [preparedConversationDocs, setPreparedConversationDocs] = useState([]);
  const [preparedDocsLoading, setPreparedDocsLoading] = useState(false);
  const [selectedConversationOption, setSelectedConversationOption] = useState(null);
  const [conversationInputValue, setConversationInputValue] = useState('');
  const [selectedCompareFromOption, setSelectedCompareFromOption] = useState(null);
  const [selectedCompareToOption, setSelectedCompareToOption] = useState(null);
  const [isComprehensiveSubmitting, setIsComprehensiveSubmitting] = useState(false);
  const [isCancellingComparison, setIsCancellingComparison] = useState(false);
  const [comprehensiveError, setComprehensiveError] = useState('');
  const [comparisonPollLogs, setComparisonPollLogs] = useState([]);
  const [comparisonPollingStatus, setComparisonPollingStatus] = useState('');
  const [deleteError, setDeleteError] = useState("");
  const [deletingJobId, setDeletingJobId] = useState(null);

  // Polling refs/state
  const pollIntervalRef = useRef(null);
  const pollAttemptsRef = useRef(0);
  const conversationInteractionPollIntervalRef = useRef(null);
  const conversationInteractionPollAttemptsRef = useRef(0);
  const [isPolling, setIsPolling] = useState(false);
  const MAX_POLL_ATTEMPTS = 240; // hard cap to prevent runaway intervals
  const MAX_COMPARISON_POLL_LOGS = 120;
  const MAX_COMPARISON_POLL_DURATION_MS = 8 * 60 * 1000;
  const MAX_COMPARISON_STALE_AGE_MS = 30 * 60 * 1000;
  const MAX_COMPARISON_STAGNANT_POLLS = 4;
  const MAX_COMPARISON_STAGNANT_WITHOUT_NEWER_POLLS = 12;
  const comparisonPollingStoppedByInteractionRef = useRef({});
  const comparisonPollStartedAtRef = useRef(null);
  const comparisonLastResponseSignatureRef = useRef('');
  const comparisonStagnantPollCountRef = useRef(0);
  const comparisonPollTargetInteractionIdRef = useRef(null);
  const comparisonPollTargetCreatedAtRef = useRef(null);


  const fetchComparisonJobs = async () => {
    if (!lobIntent || !teamName || !assistantName || !smartNote?.id) return;
    setJobsLoading(true);
    try {
      const jobs = await fetchComparisonJobsApi(teamName, assistantName, smartNote.id, lobIntent, 'All');
      setComparisonJobs(Array.isArray(jobs) ? jobs : []);
    } catch (e) {
      setComparisonJobs([]);
    } finally {
      setJobsLoading(false);
    }
  };

  useEffect(() => {
    if (lobIntent && interactionIntent === 'Comparison') {
      fetchComparisonJobs();
    } else {
      setComparisonJobs([]);
    }
  }, [lobIntent, interactionIntent]);

  const toDateMs = (value) => {
    if (!value) return NaN;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : NaN;
  };

  const formatDuration = (milliseconds) => {
    const totalSeconds = Math.max(0, Math.floor((Number(milliseconds) || 0) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };


  // Helper: fetch latest conversation status if we have a conversationDoc in Processing
  const pollConversationStatus = async () => {
    const active = geisingerConversation || conversationDoc;
    if (!active || active.status === 'Complete' || !active.id) {
      return false; // nothing to do
    }
    try {
      const data = await findConversationById(active.id, teamName);
      if (data && data.status && data.status !== active.status) {
        geisingerIntentsDispatch({ type: 'SET_GEISINGER_CONVERSATION', geisingerConversation: data });
        // Mirror status onto conversationDoc for UI fields if the doc pertains to same fileAName/relativeAUrl
        geisingerIntentsDispatch({
          type: 'SET_GEISINGER_CONVERSATION_DOC', conversationDoc: {
            name: conversationDoc?.name || data.fileAName || data.fileName || data.title || 'Conversation',
            relativeUrl: conversationDoc?.relativeUrl || data.relativeAUrl || data.relativeUrl,
            status: data.status,
            id: data.id
          }
        });
        if (data.status === 'Complete') {
          return true;
        }
        if (data.status === 'Error') {
          return true;
        }
      }
    } catch (e) {
    }
    return false; // continue polling
  };

  // Helper: keep chat interaction progress text updated during preparation
  const pollConversationInteraction = async () => {
    if (!geisingerConversationInteraction?.id) {
      return true; // nothing to poll
    }

    let effectiveChatHistory = chatHistory;
    let effectiveChat = selectedChat;
    if (!effectiveChatHistory || !effectiveChat) {
      const ensured = await ensureChatContext();
      effectiveChatHistory = ensured.chatHistory;
      effectiveChat = ensured.chat;
    }
    if (!effectiveChatHistory || !effectiveChat) {
      return false;
    }

    try {
      const updatedInteraction = await getChatInteraction(
        teamName,
        assistantName,
        effectiveChatHistory,
        effectiveChat,
        geisingerConversationInteraction
      );
      if (updatedInteraction) {
        chatInteractionsDispatch({
          type: 'UPDATE_CHAT_INTERACTION',
          chatInteraction: updatedInteraction
        });
        geisingerIntentsDispatch({
          type: 'SET_GEISINGER_CONVERSATION_INTERACTION',
          geisingerConversationInteraction: updatedInteraction
        });

        const responseText = updatedInteraction.response || '';
        const isInProgress = hasProgressMarker(responseText);
        const hasError = responseText.includes('❌');
        if (!isInProgress || hasError) {
          return true; // done polling
        }
      }
    } catch (e) {
    }
    return false;
  };

  // Establish / clear polling based on conversationDoc status
  useEffect(() => {
    const active = geisingerConversation || conversationDoc;
    const shouldPoll = interactionIntent === 'Conversation' && active && active.status === 'Processing';
    if (shouldPoll && !pollIntervalRef.current) {
      setIsPolling(true);
      pollAttemptsRef.current = 0;
      pollIntervalRef.current = setInterval(async () => {
        pollAttemptsRef.current += 1;
        const done = await pollConversationStatus();
        if (done || pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setIsPolling(false);
        }
      }, 10000);
    }
    if (!shouldPoll && pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
      setIsPolling(false);
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [interactionIntent, conversationDoc, geisingerConversation]);

  useEffect(() => {
    const shouldPollInteraction = interactionIntent === 'Conversation'
      && Boolean(geisingerConversationInteraction?.id)
      && hasProgressMarker(geisingerConversationInteraction?.response);

    if (shouldPollInteraction && !conversationInteractionPollIntervalRef.current) {
      conversationInteractionPollAttemptsRef.current = 0;
      conversationInteractionPollIntervalRef.current = setInterval(async () => {
        conversationInteractionPollAttemptsRef.current += 1;
        const done = await pollConversationInteraction();
        if (done || conversationInteractionPollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
          clearInterval(conversationInteractionPollIntervalRef.current);
          conversationInteractionPollIntervalRef.current = null;
        }
      }, 3000);
    } else if (!shouldPollInteraction && conversationInteractionPollIntervalRef.current) {
      clearInterval(conversationInteractionPollIntervalRef.current);
      conversationInteractionPollIntervalRef.current = null;
    }

    return () => {
      if (conversationInteractionPollIntervalRef.current) {
        clearInterval(conversationInteractionPollIntervalRef.current);
        conversationInteractionPollIntervalRef.current = null;
      }
    };
  }, [interactionIntent, geisingerConversationInteraction?.id]);

  // Helper: fetch latest comparison status by fetching full ChatInteraction
  const pollComparisonStatus = async () => {
    const targetInteractionId = comparisonPollTargetInteractionIdRef.current || selectedChatInteraction?.id || null;
    if (!targetInteractionId) {
      appendComparisonPollLog('skip_missing_interaction', {
        selectedChatInteractionId: selectedChatInteraction?.id || null,
        targetChatInteractionId: targetInteractionId,
      });
      return false; // nothing to do
    }

    const interactionId = targetInteractionId;
    if (comparisonPollingStoppedByInteractionRef.current[interactionId]) {
      appendComparisonPollLog('skip_polling_stopped', {
        chatInteractionId: interactionId,
        reason: comparisonPollingStoppedByInteractionRef.current[interactionId],
      });
      return true;
    }

    const createdAtMs = toDateMs(
      comparisonPollTargetCreatedAtRef.current
      || (selectedChatInteraction?.id === interactionId ? selectedChatInteraction?.createdAt : null)
    );
    if (Number.isFinite(createdAtMs)) {
      const interactionAgeMs = Date.now() - createdAtMs;
      if (interactionAgeMs > MAX_COMPARISON_STALE_AGE_MS) {
        markComparisonPollingStopped(
          interactionId,
          'Stopped polling stale comparison request. Please re-run comparison.',
          {
            interactionAgeMs,
            maxAllowedAgeMs: MAX_COMPARISON_STALE_AGE_MS,
          }
        );
        return true;
      }
    }

    let effectiveChatHistory = chatHistory;
    let effectiveChat = selectedChat;
    if (!effectiveChatHistory || !effectiveChat) {
      const ensured = await ensureChatContext();
      effectiveChatHistory = ensured.chatHistory;
      effectiveChat = ensured.chat;
    }
    if (!effectiveChatHistory || !effectiveChat) {
      appendComparisonPollLog('skip_missing_chat_context', {
        chatHistoryId: effectiveChatHistory?.id || null,
        chatId: effectiveChat?.id || null,
      });
      return false;
    }

    try {
      const requestDetails = {
        teamName,
        assistantName,
        chatHistoryId: effectiveChatHistory?.id || null,
        chatId: effectiveChat?.id || null,
        chatInteractionId: interactionId,
      };
      appendComparisonPollLog('request', requestDetails);

      const updatedInteraction = await getChatInteraction(
        teamName,
        assistantName,
        effectiveChatHistory,
        effectiveChat,
        { id: interactionId }
      );
      if (updatedInteraction) {
        comparisonPollTargetInteractionIdRef.current = updatedInteraction.id || interactionId;
        comparisonPollTargetCreatedAtRef.current = updatedInteraction?.createdAt || comparisonPollTargetCreatedAtRef.current;

        // Always update selected chat interaction with latest payload.
        chatInteractionsDispatch({
          type: 'UPDATE_CHAT_INTERACTION',
          chatInteraction: updatedInteraction
        });

        const responseSignature = JSON.stringify({
          id: updatedInteraction?.id || '',
          isComplete: updatedInteraction?.isComplete === true,
          response: String(updatedInteraction?.response || ''),
          updatedAt: String(updatedInteraction?.updatedAt || ''),
        });
        if (responseSignature === comparisonLastResponseSignatureRef.current) {
          comparisonStagnantPollCountRef.current += 1;
        } else {
          comparisonLastResponseSignatureRef.current = responseSignature;
          comparisonStagnantPollCountRef.current = 0;
        }

        appendComparisonPollLog('response', {
          request: requestDetails,
          response: {
            id: updatedInteraction?.id || null,
            isComplete: updatedInteraction?.isComplete === true,
            hasResponse: Boolean(updatedInteraction?.response),
            hasProgressMarker: hasProgressMarker(updatedInteraction?.response),
            responsePreview: String(updatedInteraction?.response || '').slice(0, 220),
            stagnantPollCount: comparisonStagnantPollCountRef.current,
          }
        });

        if (comparisonStagnantPollCountRef.current >= MAX_COMPARISON_STAGNANT_POLLS) {
          try {
            const interactionList = await getChatInteractions(teamName, assistantName, effectiveChatHistory, effectiveChat);
            const items = Array.isArray(interactionList) ? interactionList : [];
            const newest = items
              .slice()
              .sort((a, b) => (toDateMs(b?.updatedAt) || 0) - (toDateMs(a?.updatedAt) || 0))[0] || null;

            if (newest?.id && newest.id !== updatedInteraction.id) {
              comparisonPollTargetInteractionIdRef.current = newest.id;
              comparisonPollTargetCreatedAtRef.current = newest?.createdAt || null;
              chatInteractionsDispatch({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: newest });
              chatInteractionsDispatch({ type: 'SELECT_CHAT_INTERACTION', id: newest.id });
              comparisonLastResponseSignatureRef.current = '';
              comparisonStagnantPollCountRef.current = 0;
              appendComparisonPollLog('reconciled_to_newest_interaction', {
                previousChatInteractionId: updatedInteraction.id,
                nextChatInteractionId: newest.id,
                newestUpdatedAt: newest?.updatedAt || null,
              });
            } else {
              appendComparisonPollLog('stagnation_detected_no_newer_interaction', {
                chatInteractionId: updatedInteraction.id,
                stagnantPollCount: comparisonStagnantPollCountRef.current,
              });

              if (comparisonStagnantPollCountRef.current >= MAX_COMPARISON_STAGNANT_WITHOUT_NEWER_POLLS) {
                markComparisonPollingStopped(
                  updatedInteraction.id,
                  'Stopped polling due to no status change for an extended period. Please retry the comparison.',
                  {
                    stagnantPollCount: comparisonStagnantPollCountRef.current,
                    maxAllowedStagnantPolls: MAX_COMPARISON_STAGNANT_WITHOUT_NEWER_POLLS,
                  }
                );
                return true;
              }
            }
          } catch (reconcileError) {
            appendComparisonPollLog('reconcile_error', {
              message: reconcileError?.message || 'Unknown reconciliation error',
            });
          }
        }

        // Stop polling only on clear terminal states.
        if (isComparisonInteractionTerminal(updatedInteraction)) {
          appendComparisonPollLog('terminal_detected', {
            chatInteractionId: updatedInteraction?.id || null,
            isComplete: updatedInteraction?.isComplete === true,
          });
          return true; // done polling
        }
      }
    } catch (e) {
      appendComparisonPollLog('request_error', {
        message: e?.message || 'Unknown error',
      });
    }
    return false; // continue polling
  };

  // Polling refs/state for comparison
  const comparisonPollIntervalRef = useRef(null);
  const comparisonPollAttemptsRef = useRef(0);
  const comparisonPollInFlightRef = useRef(false);

  const runComparisonPollTick = async () => {
    if (comparisonPollInFlightRef.current) {
      return;
    }

    comparisonPollInFlightRef.current = true;
    try {
      const interactionId = comparisonPollTargetInteractionIdRef.current || selectedChatInteraction?.id || null;
      const startedAtMs = comparisonPollStartedAtRef.current;
      if (interactionId && Number.isFinite(startedAtMs) && (Date.now() - startedAtMs) > MAX_COMPARISON_POLL_DURATION_MS) {
        markComparisonPollingStopped(
          interactionId,
          'Stopped polling after timeout waiting for comparison completion.',
          {
            pollDurationMs: Date.now() - startedAtMs,
            maxAllowedDurationMs: MAX_COMPARISON_POLL_DURATION_MS,
          }
        );
        if (comparisonPollIntervalRef.current) {
          clearInterval(comparisonPollIntervalRef.current);
          comparisonPollIntervalRef.current = null;
        }
        return;
      }

      comparisonPollAttemptsRef.current += 1;
      const done = await pollComparisonStatus();
      if (done || comparisonPollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
        if (comparisonPollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
          appendComparisonPollLog('max_attempts_reached', {
            attempts: comparisonPollAttemptsRef.current,
          });
        }
        clearInterval(comparisonPollIntervalRef.current);
        comparisonPollIntervalRef.current = null;
      }
    } finally {
      comparisonPollInFlightRef.current = false;
    }
  };

  // Establish / clear polling based on comparison status
  useEffect(() => {
    // Poll when interactionIntent is Comparison and we have a chatInteractionId.
    // Start polling even before the first progress marker arrives to avoid missing early async updates.
    const selectedInteractionId = selectedChatInteraction?.id || null;
    const currentTargetId = comparisonPollTargetInteractionIdRef.current || null;
    const currentTargetStopped = currentTargetId
      ? Boolean(comparisonPollingStoppedByInteractionRef.current[currentTargetId])
      : false;

    // Adopt the selected interaction as polling target when:
    // 1) no target exists yet, or
    // 2) selected interaction changed and there is no active poll interval, or
    // 3) current target was force-stopped and selected interaction differs.
    const shouldInitializeTarget = !currentTargetId && !!selectedInteractionId;
    const shouldSwitchTarget = !!selectedInteractionId
      && selectedInteractionId !== currentTargetId
      && (!comparisonPollIntervalRef.current || currentTargetStopped);

    if (shouldInitializeTarget || shouldSwitchTarget) {
      comparisonPollTargetInteractionIdRef.current = selectedInteractionId;
      comparisonPollTargetCreatedAtRef.current = selectedChatInteraction?.createdAt || null;
      comparisonLastResponseSignatureRef.current = '';
      comparisonStagnantPollCountRef.current = 0;
      appendComparisonPollLog('polling_target_initialized', {
        chatInteractionId: selectedInteractionId,
        previousTargetChatInteractionId: currentTargetId,
        reason: shouldInitializeTarget ? 'initial' : (currentTargetStopped ? 'previous_target_stopped' : 'selected_changed_no_active_interval'),
      });
    }

    const activeTargetId = comparisonPollTargetInteractionIdRef.current;
    const isTargetTerminal = selectedChatInteraction?.id === activeTargetId
      ? isComparisonInteractionTerminal(selectedChatInteraction)
      : false;
    const shouldPoll = interactionIntent === 'Comparison'
      && !!activeTargetId
      && !comparisonPollingStoppedByInteractionRef.current[activeTargetId]
      && !isTargetTerminal;

    if (shouldPoll && !comparisonPollIntervalRef.current) {
      comparisonPollAttemptsRef.current = 0;
      comparisonPollStartedAtRef.current = Date.now();
      comparisonLastResponseSignatureRef.current = '';
      comparisonStagnantPollCountRef.current = 0;
      setComparisonPollingStatus('');
      appendComparisonPollLog('polling_started', {
        interactionIntent,
        chatInteractionId: activeTargetId || null,
        selectedChatInteractionId: selectedInteractionId,
      });
      // Fire one immediate poll to avoid waiting for the first interval tick.
      runComparisonPollTick();
      comparisonPollIntervalRef.current = setInterval(runComparisonPollTick, 5000); // Poll every 5 seconds for comparison status updates
    } else if (!shouldPoll && comparisonPollIntervalRef.current) {
      appendComparisonPollLog('polling_stopped_not_needed', {
        interactionIntent,
        chatInteractionId: activeTargetId || null,
        selectedChatInteractionId: selectedInteractionId,
      });
      clearInterval(comparisonPollIntervalRef.current);
      comparisonPollIntervalRef.current = null;
      comparisonPollInFlightRef.current = false;
      comparisonPollStartedAtRef.current = null;
      comparisonLastResponseSignatureRef.current = '';
      comparisonStagnantPollCountRef.current = 0;
      comparisonPollTargetInteractionIdRef.current = null;
      comparisonPollTargetCreatedAtRef.current = null;
    }

    return () => {
      if (comparisonPollIntervalRef.current) {
        appendComparisonPollLog('polling_stopped_cleanup', {
          interactionIntent,
          chatInteractionId: activeTargetId || null,
          selectedChatInteractionId: selectedInteractionId,
        });
        clearInterval(comparisonPollIntervalRef.current);
        comparisonPollIntervalRef.current = null;
      }
      comparisonPollInFlightRef.current = false;
      comparisonPollStartedAtRef.current = null;
      comparisonLastResponseSignatureRef.current = '';
      comparisonStagnantPollCountRef.current = 0;
    };
  }, [interactionIntent, selectedChatInteraction?.id, selectedChatInteraction?.isComplete]);

  useEffect(() => {
    if (interactionIntent !== 'Comparison') {
      setComparisonPollLogs([]);
      setComparisonPollingStatus('');
      comparisonPollingStoppedByInteractionRef.current = {};
      comparisonPollTargetInteractionIdRef.current = null;
      comparisonPollTargetCreatedAtRef.current = null;
    }
  }, [interactionIntent, selectedChatInteraction?.id]);

  // Ensure there is a chatHistory and current chat; mimics logic from Conversation.js
  const ensureChatContext = async () => {
    if (!smartNote) return { chatHistory: null, chat: null };
    let chHistory = chatHistory;
    if (!chHistory || !chHistory.id) {
      chHistory = await selectCurrentChatHistory(teamName, assistantName, smartNote);
      if (!chHistory || !chHistory.id) {
        // create new chat history
        chHistory = await createChatHistory(teamName, assistantName, prepDocument({ type: 'ChatHistory', smartNoteId: smartNote.id, parentId: smartNote.id, current: true }));
      }
      if (chHistory && chHistory.id) {
        chatHistorysDispatch({ type: 'SET_CHAT_HISTORY', chatHistory: chHistory });
      }
    }
    // Fetch chats for history
    let chatObj = selectedChat;
    if (!chatObj || !chatObj.id) {
      const chats = await getChats(teamName, assistantName, smartNote, chHistory);
      if (Array.isArray(chats) && chats.length) {
        // Select existing current or first
        chatObj = chats.find(c => c.current) || chats[0];
        chatsDispatch({ type: 'SET_CHATS', chats });
        chatsDispatch({ type: 'SELECT_CHAT', id: chatObj.id });
      } else {
        // create new chat
        chatObj = await createChat(teamName, assistantName, smartNote, prepDocument({ type: 'Chat', smartNoteId: smartNote.id, parentId: chHistory.id, current: true }));
        chatsDispatch({ type: 'SET_CHATS', chats: [chatObj] });
        chatsDispatch({ type: 'SELECT_CHAT', id: chatObj.id });
      }
    }
    return { chatHistory: chHistory, chat: chatObj };
  };

  const hasProgressMarker = (responseText) => {
    const text = String(responseText || '');
    return text.includes('⏳')
      || text.includes('🤖 AI processing')
      || /\[[^\]\r\n]{1,8}\]\s+Processing:/i.test(text);
  };

  const isLikelyTransientComparisonResponse = (responseText) => {
    const text = String(responseText || '').trim().toLowerCase();
    if (!text) return true;
    return text.includes('starting document comparison')
      || text.includes('starting comprehensive comparison')
      || text.includes('starting first-principles')
      || text.includes('loading source and target documents')
      || text.includes('detected topic mode')
      || text.includes('detected comprehensive mode')
      || text.includes('evaluating topic-level differences')
      || text.includes('evaluating full-document topic alignment')
      || text.includes('drafting comparison narrative')
      || text.includes('comparison progress');
  };

  const isComparisonInteractionTerminal = (interaction) => {
    if (!interaction) return false;
    if (interaction.isComplete === true) return true;

    const responseText = String(interaction.response || '');
    if (!responseText.trim()) return false;
    if (responseText.includes('❌')) return true;
    if (hasProgressMarker(responseText)) return false;
    if (isLikelyTransientComparisonResponse(responseText)) return false;
    return true;
  };

  const isFirstPrinciplesComparisonInteraction = (interaction) => {
    const engine = String(interaction?.diagnostics?.selectedComparisonEngine || '').trim().toLowerCase();
    if (engine === 'first-principles') return true;

    const responseText = String(interaction?.response || '').toLowerCase();
    if (!responseText) return false;

    return responseText.includes('first-principles')
      || responseText.includes('starting first-principles');
  };

  const markComparisonPollingStopped = (interactionId, reason, details = {}) => {
    if (!interactionId) return;
    comparisonPollingStoppedByInteractionRef.current[interactionId] = reason;
    setComparisonPollingStatus(reason);
    appendComparisonPollLog('polling_force_stopped', {
      chatInteractionId: interactionId,
      reason,
      ...details,
    });
  };

  const appendComparisonPollLog = (event, details = {}) => {
    const entry = {
      timestamp: new Date().toISOString(),
      event,
      details,
    };

    if (typeof window !== 'undefined' && window.localStorage?.getItem('comparisonPollingConsole') === 'true') {
      console.log(`[ComparisonPolling] ${JSON.stringify(entry)}`);
    }
    setComparisonPollLogs((prev) => {
      const next = [...prev, entry];
      return next.length > MAX_COMPARISON_POLL_LOGS
        ? next.slice(next.length - MAX_COMPARISON_POLL_LOGS)
        : next;
    });
  };


  // Sync local state with context when GeisingerIntent changes
  useEffect(() => {
    setContext(prev => ({
      ...prev,
      'Line of Business': lobIntent ?? '',
      'Document Intelligence': interactionIntent ?? '',
      'Conversation Doc': conversationDoc?.name ?? '',
      'Conversation Doc URL': conversationDoc?.relativeUrl ?? '',
      'Compare From Doc': compareFromDoc?.name ?? '',
      'Compare From Doc URL': compareFromDoc?.relativeUrl ?? '',
      'Compare To Doc': compareToDoc?.name ?? '',
      'Compare To Doc URL': compareToDoc?.relativeUrl ?? '',
    }));

  }, [lobIntent, interactionIntent, conversationDoc, compareFromDoc, compareToDoc]);

  useEffect(() => {
    let cancelled = false;

    async function loadPreparedConversations() {
      if (!lobIntent || (interactionIntent !== 'Conversation' && interactionIntent !== 'Comparison')) {
        setPreparedConversationDocs([]);
        setPreparedDocsLoading(false);
        return;
      }

      setPreparedDocsLoading(true);
      try {
        const docs = await findExistingConversations(teamName, lobIntent, 'Complete');
        if (cancelled) return;

        const normalized = Array.isArray(docs) ? docs : [];
        setPreparedConversationDocs(normalized);
      } catch (error) {
        if (!cancelled) {
          setPreparedConversationDocs([]);
        }
      } finally {
        if (!cancelled) {
          setPreparedDocsLoading(false);
        }
      }
    }

    loadPreparedConversations();

    return () => {
      cancelled = true;
    };
  }, [lobIntent, interactionIntent]);

  const allFilesOption = useMemo(() => {
    if (!lobIntent) return null;
    return {
      allFilesInLob: true,
      fileAName: `${ALL_FILES_BASE_LABEL} (${lobIntent})`,
      relativeAUrl: '',
      lob: lobIntent,
      status: 'Complete',
    };
  }, [lobIntent]);

  const conversationOptions = allFilesOption
    ? [allFilesOption, ...preparedConversationDocs]
    : preparedConversationDocs;

  const selectedConversationPath = getConversationFilePath(selectedConversationOption || conversationDoc);

  useEffect(() => {
    if (!interactionIntent) {
      setSelectedConversationOption(null);
      setSelectedCompareFromOption(null);
      setSelectedCompareToOption(null);
      return;
    }

    if (interactionIntent === 'Conversation') {
      if (geisingerConversation?.allFilesInLob && allFilesOption) {
        setSelectedConversationOption(allFilesOption);
        setConversationInputValue(getConversationFileName(allFilesOption));
      } else if (geisingerConversation?.id) {
        const match = preparedConversationDocs.find((doc) => doc.id === geisingerConversation.id);
        setSelectedConversationOption(match || null);
        setConversationInputValue(getConversationFileName(match));
      } else if (allFilesOption) {
        // Default to all files in selected LOB when conversation mode is chosen but no file is selected.
        setSelectedConversationOption(allFilesOption);
        setConversationInputValue(getConversationFileName(allFilesOption));
        geisingerIntentsDispatch({
          type: 'SET_GEISINGER_CONVERSATION_DOC',
          conversationDoc: {
            name: allFilesOption.fileAName,
            relativeUrl: '',
            allFilesInLob: true,
            status: 'Complete',
          }
        });
        geisingerIntentsDispatch({
          type: 'SET_GEISINGER_CONVERSATION',
          geisingerConversation: {
            lob: lobIntent,
            allFilesInLob: true,
            status: 'Complete',
          }
        });
      } else {
        setSelectedConversationOption(null);
        setConversationInputValue('');
      }
      return;
    }

    if (interactionIntent === 'Comparison') {
      const fromId = geisingerComparison?.geisingerConversationAId || null;
      const toId = geisingerComparison?.geisingerConversationBId || null;
      const from = fromId ? preparedConversationDocs.find((doc) => doc.id === fromId) : null;
      const to = toId ? preparedConversationDocs.find((doc) => doc.id === toId) : null;
      setSelectedCompareFromOption(from || null);
      setSelectedCompareToOption(to || null);
    }
  }, [interactionIntent, geisingerConversation, geisingerComparison, preparedConversationDocs, allFilesOption]);

  useEffect(() => {
    const updateComparison = async () => {
      if (interactionIntent !== 'Comparison') {
        geisingerIntentsDispatch({ type: 'SET_GEISINGER_COMPARISON', geisingerComparison: null });
        return;
      }

      if (!selectedCompareFromOption?.id || !selectedCompareToOption?.id) {
        geisingerIntentsDispatch({ type: 'SET_GEISINGER_COMPARISON', geisingerComparison: null });
        return;
      }

      if (selectedCompareFromOption.id === selectedCompareToOption.id) {
        geisingerIntentsDispatch({ type: 'SET_GEISINGER_COMPARISON', geisingerComparison: null });
        return;
      }

      const geisingerComparison = prepDocument({
        type: 'GeisingerComparison',
        lob: lobIntent,
        status: 'In Progress',
        geisingerConversationAId: selectedCompareFromOption.id,
        geisingerConversationBId: selectedCompareToOption.id
      });

      geisingerIntentsDispatch({
        type: 'SET_GEISINGER_COMPARISON',
        geisingerComparison: geisingerComparison
      });
    }
    updateComparison();
  }, [interactionIntent, lobIntent, selectedCompareFromOption, selectedCompareToOption]);

  const hasValidComparisonPair = useMemo(() => {
    console.log(`[hasValidComparisonPair] geisingerComparison: ${JSON.stringify(geisingerComparison)}`);
    const fromId = String(geisingerComparison?.geisingerConversationAId || '').trim();
    const toId = String(geisingerComparison?.geisingerConversationBId || '').trim();
    return !!fromId && !!toId && fromId !== toId;
  }, [geisingerComparison]);

  const canRunComprehensiveComparison = Boolean(
    lobIntent
    && interactionIntent === 'Comparison'
    && hasValidComparisonPair
  );

  // Delete handler for a comparison job
  const handleDeleteComparison = async (job) => {
    setDeleteError("");
    setDeletingJobId(job.id || job._id);
    try {
      await deleteGeisingerComparisons(
        teamName,
        assistantName,
        smartNote.id,
        job.lob,
        'comprehensive',
        job.geisingerConversationAId,
        job.geisingerConversationBId
      );
      await fetchComparisonJobs();
    } catch (e) {
      setDeleteError(e?.message || "Failed to delete comparison job.");
    } finally {
      setDeletingJobId(null);
    }
  };

  // Abort logic is not relevant for GeisingerComparison-only jobs (no chat interaction polling)
  const canAbortComparison = false;

  const handleComprehensiveComparison = async () => {
    setComprehensiveError('');

    if (!canRunComprehensiveComparison || !smartNote) {
      return;
    }

    setIsComprehensiveSubmitting(true);

    try {
      const ensuredContext = await ensureChatContext();
      const effectiveChatHistory = ensuredContext?.chatHistory;
      const effectiveChat = ensuredContext?.chat;

      if (!effectiveChatHistory || !effectiveChat) {
        throw new Error('Unable to start comprehensive comparison because chat context is unavailable.');
      }

      // const chatInteraction = prepDocument({
      //   type: 'ChatInteraction',
      //   parentId: effectiveChat.id,
      //   smartNoteId: smartNote.id,
      //   prompt: 'Run a comprehensive comparison of the selected documents.',
      //   response: null,
      //   isComplete: false,
      // });

      // chatInteractionsDispatch({ type: 'CREATE_CHAT_INTERACTION', chatInteraction });
      // const createdChatInteraction = await createChatInteraction(
      //   teamName,
      //   assistantName,
      //   smartNote,
      //   effectiveChatHistory,
      //   effectiveChat,
      //   chatInteraction
      // );

      // const activeInteraction = chatInteraction && chatInteraction.id
      //   ? { ...chatInteraction, ...chatInteraction }
      //   : chatInteraction;

      // Reconcile temporary local interaction with server-issued interaction id without changing reducer behavior.
      // if (createdChatInteraction?.id && createdChatInteraction.id !== chatInteraction.id) {
      //   chatInteractionsDispatch({ type: 'DELETE_CHAT_INTERACTION', id: chatInteraction.id });
      //   chatInteractionsDispatch({ type: 'CREATE_CHAT_INTERACTION', chatInteraction: activeInteraction });
      // }

      submitToComplianceComparison(
        teamName,
        assistantName,
        { ...geisingerComparison, comparisonType: "comprehensive" },
        smartNote,
        (sources || []).filter((source) => source?.selected),
        undefined,
        'comprehensive'
      );

      console.log(`geisingerComparison: ${JSON.stringify(geisingerComparison)}`);

      // const chatInteractionWithResponse = {
      //   ...activeInteraction,
      //   response: comparisonResponse?.responseContent || 'Starting comprehensive comparison...',
      //   isComplete: false,
      // };

      // chatInteractionsDispatch({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: chatInteractionWithResponse });
      // await saveChatInteraction(
      //   teamName,
      //   assistantName,
      //   smartNote,
      //   effectiveChatHistory,
      //   effectiveChat,
      //   chatInteractionWithResponse
      // );
    } catch (error) {
      setComprehensiveError(error?.message || 'Failed to submit comprehensive comparison.');
    } finally {
      setIsComprehensiveSubmitting(false);
    }
  };

  const handleAbortComparison = async () => {
    if (!smartNote || !canAbortComparison) {
      return;
    }

    const interactionId = comparisonPollTargetInteractionIdRef.current || selectedChatInteraction?.id || null;
    if (!interactionId) {
      return;
    }

    setIsCancellingComparison(true);
    try {
      const ensuredContext = await ensureChatContext();
      const effectiveChat = selectedChat || ensuredContext?.chat || null;
      const effectiveChatId = String(selectedChatInteraction?.parentId || effectiveChat?.id || '').trim();

      await cancelComplianceComparison(
        teamName,
        assistantName,
        smartNote,
        effectiveChatId,
        interactionId
      );

      const cancelledMessage = [
        '## Comparison Progress',
        '',
        'X Processing: Comparison cancelled by user.',
        '',
        '---',
      ].join('\n');

      const updatedInteraction = {
        ...(selectedChatInteraction || {}),
        id: interactionId,
        response: cancelledMessage,
        isComplete: true,
        cancellationRequested: true,
        cancellationRequestedAt: new Date().toISOString(),
      };

      chatInteractionsDispatch({
        type: 'UPDATE_CHAT_INTERACTION',
        chatInteraction: updatedInteraction,
      });

      if (comparisonPollIntervalRef.current) {
        clearInterval(comparisonPollIntervalRef.current);
        comparisonPollIntervalRef.current = null;
      }
      comparisonPollInFlightRef.current = false;
      comparisonPollStartedAtRef.current = null;
      comparisonLastResponseSignatureRef.current = '';
      comparisonStagnantPollCountRef.current = 0;

      markComparisonPollingStopped(
        interactionId,
        'Comparison cancelled by user.',
        { cancelledByUser: true }
      );
      setComparisonPollingStatus('Comparison cancelled by user.');
    } catch (error) {
      setComprehensiveError(error?.message || 'Failed to cancel comparison.');
    } finally {
      setIsCancellingComparison(false);
    }
  };

  const handleConversationDocSelected = (_, selected) => {
    setSelectedConversationOption(selected || null);
    setConversationInputValue(getConversationFileName(selected));

    if (!selected) {
      geisingerIntentsDispatch({ type: 'SET_GEISINGER_CONVERSATION_DOC', conversationDoc: null });
      geisingerIntentsDispatch({ type: 'SET_GEISINGER_CONVERSATION', geisingerConversation: null });
      geisingerIntentsDispatch({ type: 'SET_GEISINGER_CONVERSATION_INTERACTION', geisingerConversationInteraction: null });
      return;
    }

    if (selected.allFilesInLob) {
      const allFilesSelection = {
        name: selected.fileAName,
        relativeUrl: '',
        allFilesInLob: true,
        status: 'Complete',
      };

      geisingerIntentsDispatch({ type: 'SET_GEISINGER_CONVERSATION_DOC', conversationDoc: allFilesSelection });
      geisingerIntentsDispatch({
        type: 'SET_GEISINGER_CONVERSATION',
        geisingerConversation: {
          lob: lobIntent,
          allFilesInLob: true,
          status: 'Complete',
        }
      });
      geisingerIntentsDispatch({ type: 'SET_GEISINGER_CONVERSATION_INTERACTION', geisingerConversationInteraction: null });
      return;
    }

    geisingerIntentsDispatch({
      type: 'SET_GEISINGER_CONVERSATION_DOC',
      conversationDoc: {
        id: selected.id,
        name: selected.fileAName || selected.fileName || selected.title || 'Untitled',
        relativeUrl: selected.relativeAUrl || selected.relativeUrl || '',
        status: selected.status || 'Complete',
      }
    });
    geisingerIntentsDispatch({ type: 'SET_GEISINGER_CONVERSATION', geisingerConversation: selected });
    geisingerIntentsDispatch({ type: 'SET_GEISINGER_CONVERSATION_INTERACTION', geisingerConversationInteraction: null });
  };

  const handleCompareFromSelected = (_, selected) => {
    setSelectedCompareFromOption(selected || null);

    geisingerIntentsDispatch({
      type: 'SET_GEISINGER_COMPARE_FROM_DOC',
      compareFromDoc: selected ? {
        id: selected.id,
        name: selected.fileAName || selected.fileName || selected.title || 'Untitled',
        relativeUrl: selected.relativeAUrl || selected.relativeUrl || '',
        status: selected.status || 'Complete',
      } : null,
    });
  };

  const handleCompareToSelected = (_, selected) => {
    setSelectedCompareToOption(selected || null);

    geisingerIntentsDispatch({
      type: 'SET_GEISINGER_COMPARE_TO_DOC',
      compareToDoc: selected ? {
        id: selected.id,
        name: selected.fileAName || selected.fileName || selected.title || 'Untitled',
        relativeUrl: selected.relativeAUrl || selected.relativeUrl || '',
        status: selected.status || 'Complete',
      } : null,
    });
  };

  const handleChange = (key) => (event) => {
    const newValue = event.target.value ?? '';
    if (key === 'Line of Business') {
      geisingerIntentsDispatch({ type: 'SET_GEISINGER_LOB_INTENT', lobIntent: newValue });
      geisingerIntentsDispatch({ type: 'SET_GEISINGER_CONVERSATION_DOC', conversationDoc: null });
      geisingerIntentsDispatch({ type: 'SET_GEISINGER_CONVERSATION', geisingerConversation: null });
      geisingerIntentsDispatch({ type: 'SET_GEISINGER_CONVERSATION_INTERACTION', geisingerConversationInteraction: null });
      geisingerIntentsDispatch({ type: 'SET_GEISINGER_COMPARE_FROM_DOC', compareFromDoc: null });
      geisingerIntentsDispatch({ type: 'SET_GEISINGER_COMPARE_TO_DOC', compareToDoc: null });
      geisingerIntentsDispatch({ type: 'SET_GEISINGER_COMPARISON', geisingerComparison: null });
      setSelectedConversationOption(null);
      setSelectedCompareFromOption(null);
      setSelectedCompareToOption(null);
    }
    if (key === 'Document Intelligence') {
      geisingerIntentsDispatch({ type: 'SET_GEISINGER_INTERACTION_INTENT', interactionIntent: newValue });
      geisingerIntentsDispatch({ type: 'SET_GEISINGER_CONVERSATION_DOC', conversationDoc: null });
      geisingerIntentsDispatch({ type: 'SET_GEISINGER_CONVERSATION', geisingerConversation: null });
      geisingerIntentsDispatch({ type: 'SET_GEISINGER_CONVERSATION_INTERACTION', geisingerConversationInteraction: null });
      geisingerIntentsDispatch({ type: 'SET_GEISINGER_COMPARE_FROM_DOC', compareFromDoc: null });
      geisingerIntentsDispatch({ type: 'SET_GEISINGER_COMPARE_TO_DOC', compareToDoc: null });
      geisingerIntentsDispatch({ type: 'SET_GEISINGER_COMPARISON', geisingerComparison: null });
      setSelectedConversationOption(null);
      setSelectedCompareFromOption(null);
      setSelectedCompareToOption(null);
    }
    setContext((prev) => ({ ...prev, [key]: newValue }));
    // Dispatch to global context if setter is available
  };

  return (
    <Box
      sx={{
        width: '100%',
        p: 2,
        border: '1px solid',
        borderColor: 'color.dolphin',
        borderRadius: '12px',
        backgroundColor: 'card.body.deep',
      }}
    >
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', width: '100%' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', minWidth: 160 }}>
          Line of Business
        </Typography>
        <StyledSelect
          value={context['Line of Business'] ?? ''}
          onChange={handleChange('Line of Business')}
          sx={{ ml: 2, flexGrow: 1 }}
        >
          {LOB_OPTIONS.map((option) => (
            <MenuItem key={option} value={option}>{option}</MenuItem>
          ))}
        </StyledSelect>
      </Box>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', width: '100%' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', minWidth: 160 }}>
          Document Intelligence
        </Typography>
        <StyledSelect
          value={context['Document Intelligence'] ?? ''}
          onChange={handleChange('Document Intelligence')}
          sx={{ ml: 2, flexGrow: 1 }}
        >
          {DOC_INTEL_OPTIONS.map((option) => (
            <MenuItem key={option} value={option}>{option}</MenuItem>
          ))}
        </StyledSelect>
      </Box>
      {/* Conditionally render doc fields */}
      {interactionIntent === 'Conversation' && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', width: '100%' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', minWidth: 160 }}>
            Conversation Doc
          </Typography>
          <Box sx={{ ml: 2, flexGrow: 1, minWidth: 0 }}>
            <Autocomplete
              options={conversationOptions}
              loading={preparedDocsLoading}
              value={selectedConversationOption}
              sx={{ width: '100%', minWidth: 0 }}
              inputValue={conversationInputValue}
              isOptionEqualToValue={isSameConversation}
              getOptionLabel={normalizeFileOptionLabel}
              onInputChange={(_, newInputValue) => {
                setConversationInputValue(newInputValue);
              }}
              renderOption={(props, option) => {
                const fileName = getConversationFileName(option);
                const { key: optionKey, ...optionProps } = props;
                return (
                  <Box
                    key={optionKey}
                    component="li"
                    {...optionProps}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      py: 0.75,
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 700,
                        color: 'text.primary',
                        width: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {fileName}
                    </Typography>
                  </Box>
                );
              }}
              onChange={handleConversationDocSelected}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  placeholder="Type file name or path..."
                  helperText="Suggestions come from current-version prepared docs for the selected LOB"
                />
              )}
            />
            {!!selectedConversationPath && !selectedConversationOption?.allFilesInLob && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: 'block',
                  mt: 0.5,
                  fontFamily: 'Consolas, Monaco, monospace',
                  whiteSpace: 'normal',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                }}
                title={selectedConversationPath}
              >
                {selectedConversationPath}
              </Typography>
            )}
            {conversationDoc && (
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  label={(conversationDoc && conversationDoc.status) || (geisingerConversation && geisingerConversation.status) || 'Not Prepared'}
                  color={((conversationDoc && conversationDoc.status) === 'Complete' || (geisingerConversation && geisingerConversation.status) === 'Complete') ? 'success' : 'warning'}
                  size="small"
                />
                {isPolling && (conversationDoc && conversationDoc.status) !== 'Complete' && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CircularProgress size={12} />
                    <Typography variant="caption" color="text.secondary">
                      Updating...
                    </Typography>
                  </Box>
                )}
                {!isPolling && (conversationDoc && conversationDoc.status) !== 'Complete' && (geisingerConversation && geisingerConversation.status) !== 'Complete' && (
                  <Typography variant="caption" color="text.secondary">
                    Preparing status detected
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        </Box>
      )}
      {/* Show the table only when LOB is selected and Document Intelligence is 'Comparison' */}

      {/* Move the table below the enablement message */}
      <Box sx={{ mt: 1, mb: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, width: '100%' }}>
        <Button
          variant="primary"
          disabled={!canRunComprehensiveComparison}
          onClick={handleComprehensiveComparison}
        >
          {isComprehensiveSubmitting ? 'Starting Comparison...' : 'Compare Comprehensively'}
        </Button>
        <Button
          variant="destructive"
          disabled={!canAbortComparison}
          onClick={handleAbortComparison}
        >
          {isCancellingComparison ? 'Aborting...' : 'Abort Comparison'}
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            geisingerIntentsDispatch({ type: 'SET_GEISINGER_LOB_INTENT', lobIntent: null });
            geisingerIntentsDispatch({ type: 'SET_GEISINGER_INTERACTION_INTENT', interactionIntent: null });
            geisingerIntentsDispatch({ type: 'SET_GEISINGER_CONVERSATION_DOC', conversationDoc: null });
            geisingerIntentsDispatch({ type: 'SET_GEISINGER_CONVERSATION', geisingerConversation: null });
            geisingerIntentsDispatch({ type: 'SET_GEISINGER_CONVERSATION_INTERACTION', geisingerConversationInteraction: null });
            geisingerIntentsDispatch({ type: 'SET_GEISINGER_COMPARE_FROM_DOC', compareFromDoc: null });
            geisingerIntentsDispatch({ type: 'SET_GEISINGER_COMPARE_TO_DOC', compareToDoc: null });
            geisingerIntentsDispatch({ type: 'SET_GEISINGER_COMPARISON', geisingerComparison: null });
            setSelectedConversationOption(null);
            setSelectedCompareFromOption(null);
            setSelectedCompareToOption(null);
          }}
        >
          Clear Context
        </Button>
        <Typography variant="body2" sx={{ color: 'text.secondary', ml: 2 }}>
          Comprehensive comparison is enabled when LOB, Comparison, and both comparison docs are selected.
        </Typography>
      </Box>

      {interactionIntent === 'Comparison' && (
        <>
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', width: '100%' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', minWidth: 160 }}>
              Compare From Doc
            </Typography>
            <Box sx={{ ml: 2, flexGrow: 1 }}>
              <Autocomplete
                options={preparedConversationDocs}
                loading={preparedDocsLoading}
                value={selectedCompareFromOption}
                isOptionEqualToValue={isSameConversation}
                getOptionLabel={normalizeFileOptionLabel}
                onChange={handleCompareFromSelected}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Type file name or path..."
                    helperText="Select first prepared file"
                  />
                )}
              />
            </Box>
          </Box>
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', width: '100%' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', minWidth: 160 }}>
              Compare To Doc
            </Typography>
            <Box sx={{ ml: 2, flexGrow: 1 }}>
              <Autocomplete
                options={preparedConversationDocs.filter((doc) => !selectedCompareFromOption || doc.id !== selectedCompareFromOption.id)}
                loading={preparedDocsLoading}
                value={selectedCompareToOption}
                isOptionEqualToValue={isSameConversation}
                getOptionLabel={normalizeFileOptionLabel}
                onChange={handleCompareToSelected}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Type file name or path..."
                    helperText="Select second prepared file"
                  />
                )}
              />
            </Box>
          </Box>
        </>
      )}
      {!!comprehensiveError && (
        <Typography variant="body2" color="error" sx={{ mt: 1 }}>
          {comprehensiveError}
        </Typography>
      )}
      {/* Removed chat interaction polling status and debug UI for comprehensive comparison jobs */}
      {/* Comprehensive Comparison Jobs Table (now always below the enablement message) */}
      {lobIntent && interactionIntent === 'Comparison' && (
        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Comprehensive Comparison Jobs
            </Typography>
            <Button
              variant="action"
              onClick={fetchComparisonJobs}
              disabled={jobsLoading}
              sx={{ minWidth: 120 }}
            >
              {jobsLoading ? <CircularProgress size={18} /> : 'Refresh'}
            </Button>
          </Box>
          <Box sx={{ width: '100%', overflow: 'auto' }}>
            <Box sx={{ maxHeight: 420, overflowY: 'auto', borderRadius: 2, border: '1px solid #e0e0e0', boxShadow: 1 }}>
              <TableContainer component={Paper} sx={{ boxShadow: 'none', borderRadius: 0 }}>
                <Table size="small" sx={{ fontSize: '0.64rem' }} stickyHeader>
                  <TableHead>
                    <TableRow sx={{ fontSize: '0.64rem' }}>
                      <TableCell sx={{ fontSize: '0.64rem' }}>Compare From</TableCell>
                      <TableCell sx={{ fontSize: '0.64rem' }}>Compare To</TableCell>
                      <TableCell sx={{ fontSize: '0.64rem' }}>Status</TableCell>
                      <TableCell sx={{ fontSize: '0.64rem' }}>Workflow Stage</TableCell>
                      <TableCell sx={{ fontSize: '0.64rem' }}>Initiated</TableCell>
                      <TableCell sx={{ fontSize: '0.64rem' }}>Spreadsheet</TableCell>
                      <TableCell sx={{ fontSize: '0.64rem', textAlign: 'center' }}>Remove</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {comparisonJobs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ fontSize: '0.64rem' }}>
                          {jobsLoading ? 'Loading jobs...' : 'No jobs found.'}
                        </TableCell>
                      </TableRow>
                    )}
                    {comparisonJobs.map((job) => (
                      <TableRow key={job.id || job._id} sx={{ fontSize: '0.64rem' }}>
                        <TableCell sx={{ fontSize: '0.64rem' }}>{job.fromDocName || job.fromDoc || job.fileAName || 'N/A'}</TableCell>
                        <TableCell sx={{ fontSize: '0.64rem' }}>{job.toDocName || job.toDoc || job.fileBName || 'N/A'}</TableCell>
                        <TableCell sx={{ fontSize: '0.64rem' }}>{job.status || 'Unknown'}</TableCell>
                        <TableCell sx={{ fontSize: '0.64rem' }}>{job.statusInfo || '—'}</TableCell>
                        <TableCell sx={{ fontSize: '0.64rem' }}>{job.createdAt ? new Date(job.createdAt).toLocaleString() : ''}</TableCell>
                        <TableCell sx={{ fontSize: '0.64rem' }}>
                          {job.status === 'Complete' && job.downloadLink ? (
                            <a
                              href={job.downloadLink}
                              download
                              style={{
                                display: 'inline-block',
                                padding: '2px 12px',
                                borderRadius: 4,
                                background: '#1976d2',
                                color: '#fff',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                border: 'none',
                                cursor: 'pointer',
                                textDecoration: 'none',
                                minWidth: 64,
                                textAlign: 'center',
                                transition: 'background 0.2s',
                              }}
                              onMouseOver={e => e.currentTarget.style.background = '#115293'}
                              onMouseOut={e => e.currentTarget.style.background = '#1976d2'}
                            >
                              Download
                            </a>
                          ) : (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 12px',
                                borderRadius: 4,
                                background: '#e0e0e0',
                                color: '#888',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                border: 'none',
                                minWidth: 64,
                                textAlign: 'center',
                                opacity: 0.7,
                                cursor: 'not-allowed',
                              }}
                            >
                              Download
                            </span>
                          )}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.64rem', textAlign: 'center' }}>
                          <IconButton
                            size="small"
                            aria-label="delete-comparison"
                            sx={{ color: 'error.main' }}
                            onClick={() => handleDeleteComparison(job)}
                            disabled={deletingJobId === (job.id || job._id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                          {!!deleteError && (
                            <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                              {deleteError}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Box>
        </Box>
      )}
    </Box>);
}
