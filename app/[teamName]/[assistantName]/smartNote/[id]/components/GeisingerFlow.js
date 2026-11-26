import React, { useState, useEffect } from 'react';
import { Accordion, AccordionSummary, AccordionDetails, List, ListItem, ListItemText, CircularProgress } from '@mui/material';
import ExpandMoreIconMui from '@mui/icons-material/ExpandMore';
import PropTypes from 'prop-types';
import { Box, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SharePointDialog from './SharePointDialog2';
import { geisingerDocComparision, geisingerDocConversation, findExistingConversations, findExistingComparisons } from '@/app/clientServices/complianceService';
import { prepDocument } from '@/app/clientServices/insertDocument';
import { useGeisingerIntents, useGeisingerIntentsDispatch } from '@/reducers/GeisingerIntentContext';
import { useChats } from '@reducers/ChatContext.js';
import { useSmartNote } from '@/reducers/improved/SmartNoteContext';
import { useChatInteractions, useChatInteractionsDispatch } from '@reducers/ChatInteractionContext.js';
import { createChatInteraction } from '@clientServices/entryWindowService';
import { useChatHistorys, useChatHistorysDispatch } from '@reducers/ChatHistoryContext';
import { useParams } from 'next/navigation.js';

const GeisingerFlow = ({ setOpenGeisingerDocIntelligence }) => {
  const ALL_FILES_SELECTION_NAME = 'All Files in Selected LOB';
  const buildAllFilesSelection = () => ({
    name: `${ALL_FILES_SELECTION_NAME}${lobIntent ? ` (${lobIntent})` : ''}`,
    relativeUrl: '',
    allFilesInLob: true
  });

  // Utility functions for looking up conversation docs by id
  const getConversationDocById = (id) => {
    if (!id) return null;
    return existingConversationDocs.find(doc => doc.id === id);
  };

  const [collapsed, setCollapsed] = useState(false);
  const [openSharePointDialog, setOpenSharePointDialog] = useState(false);
  const [initiateButtonEnabled, setInitiateButtonEnabled] = useState(false);
  const [filesToProcess, setFilesToProcess] = useState([]);
  const [existingConversationDocs, setExistingConversationDocs] = useState([]);
  const [existingComparisonDocs, setExistingComparisonDocs] = useState([]);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [conversationCollapsed, setConversationCollapsed] = useState(true);
  const [comparisonCollapsed, setComparisonCollapsed] = useState(true);
  const [selectedSite, setSelectedSite] = useState('');
  const [selectedLibrary, setSelectedLibrary] = useState('');
  const [showDuplicateMessage, setShowDuplicateMessage] = useState(false);
  const [selectedConversationDocIdxs, setSelectedConversationDocIdxs] = useState([]);
  const [allFilesSelected, setAllFilesSelected] = useState(false);
  const { selectedChat } = useChats();
  const smartNote = useSmartNote();
  const { selectedChatInteraction } = useChatInteractions();
  const chatInteractionsDispatch = useChatInteractionsDispatch();
  const chatHistory = useChatHistorys();
  const { teamName, assistantName } = useParams();

  // Handler for selecting an existing conversation doc (multi-select for comparison)
  const handleSelectExistingConversationDoc = (doc, idx) => {
    if (doc?.allFilesInLob) {
      const allFilesSelection = buildAllFilesSelection();
      setAllFilesSelected(true);
      setSelectedConversationDocIdxs([]);
      setSelectedSite('');
      setSelectedLibrary('');
      setFilesToProcess([allFilesSelection]);
      setInitiateButtonEnabled(true);
      geisingerIntentsDispatch({
        type: 'SET_GEISINGER_CONVERSATION_DOC',
        conversationDoc: {
          ...allFilesSelection,
          status: 'Complete'
        }
      });
      geisingerIntentsDispatch({
        type: 'SET_GEISINGER_CONVERSATION',
        geisingerConversation: {
          lob: lobIntent,
          allFilesInLob: true,
          status: 'Complete'
        }
      });
      return;
    }

    if (interactionIntent === 'Comparison') {
      let updatedIdxs = [...selectedConversationDocIdxs];
      let updatedFiles = [...filesToProcess];
      setAllFilesSelected(false);
      // Toggle selection
      const alreadySelected = updatedIdxs.includes(idx);
      if (alreadySelected) {
        updatedIdxs = updatedIdxs.filter(i => i !== idx);
        updatedFiles = updatedFiles.filter(f => f.relativeUrl !== (doc.relativeAUrl || doc.relativeUrl));
      } else {
        if (updatedIdxs.length < 2) {
          updatedIdxs.push(idx);
          updatedFiles.push({ name: doc.fileAName || doc.fileName, relativeUrl: doc.relativeAUrl || doc.relativeUrl });
        }
      }
      setSelectedConversationDocIdxs(updatedIdxs);
      setFilesToProcess(updatedFiles);
      setInitiateButtonEnabled(updatedFiles.length === 2);
      // Only dispatch when two docs are selected
      if (updatedFiles.length === 2) {
        geisingerIntentsDispatch({ type: 'SET_GEISINGER_COMPARE_FROM_DOC', compareFromDoc: updatedFiles[0] });
        geisingerIntentsDispatch({ type: 'SET_GEISINGER_COMPARE_TO_DOC', compareToDoc: updatedFiles[1] });
        setSelectedSite(doc.siteName);
        setSelectedLibrary(doc.libraryName);
      }
    } else {
      // Conversation mode: single select
      setAllFilesSelected(false);
      setSelectedConversationDocIdxs([idx]);
      setSelectedSite(doc.siteName);
      setSelectedLibrary(doc.libraryName);
      setFilesToProcess([{ name: doc.fileAName, relativeUrl: doc.relativeAUrl }]);
      setInitiateButtonEnabled(true);
      geisingerIntentsDispatch({ type: 'SET_GEISINGER_CONVERSATION_DOC', conversationDoc: { name: doc.fileAName, relativeUrl: doc.relativeAUrl } });
      geisingerIntentsDispatch({ type: 'SET_GEISINGER_CONVERSATION', geisingerConversation: doc });
    }
  };

  const geisingerIntentsObject = useGeisingerIntents();
  const { lobIntent, interactionIntent } = geisingerIntentsObject;
  const geisingerIntentsDispatch = useGeisingerIntentsDispatch();

  useEffect(() => {
    async function fetchExistingDocs() {
      setLoadingConversation(true);
      setLoadingComparison(true);
      try {
        // Always fetch prepared conversation docs
        const conversationData = await findExistingConversations(teamName, lobIntent, 'Complete');

        setExistingConversationDocs(Array.isArray(conversationData) ? conversationData : []);
        setAllFilesSelected(false);

        // Fetch comparison docs only in comparison mode
        if (interactionIntent === 'Comparison') {
          const data = await findExistingComparisons(lobIntent, 'Complete');
          setExistingComparisonDocs(Array.isArray(data) ? data : []);
        }
      } catch {
        setExistingConversationDocs([]);
        setExistingComparisonDocs([]);
      }
      setLoadingConversation(false);
      setLoadingComparison(false);
    }
    fetchExistingDocs();
  }, [lobIntent, interactionIntent]);

  const handleSelectedFiles = (site, library, selectedFiles) => {
    setAllFilesSelected(false);
    setSelectedSite(site);
    setSelectedLibrary(library);
    setFilesToProcess(selectedFiles);
    setInitiateButtonEnabled(selectedFiles.length > 0);
    let duplicate = false;
    if (selectedFiles.length > 0 && interactionIntent === 'Conversation') {
      const selectedNames = selectedFiles.map(f => f.name);
      duplicate = existingConversationDocs.some(doc => selectedNames.includes(doc.fileAName || doc.fileName));
    }
    setShowDuplicateMessage(duplicate);
    if (selectedFiles.length > 0) {
      if (interactionIntent === 'Conversation' && selectedFiles.length === 1) {
        geisingerIntentsDispatch({ type: 'SET_GEISINGER_CONVERSATION_DOC', conversationDoc: selectedFiles[0] });
      } else if (interactionIntent === 'Comparison' && selectedFiles.length === 2) {
        geisingerIntentsDispatch({ type: 'SET_GEISINGER_COMPARE_FROM_DOC', compareFromDoc: selectedFiles[0] });
        geisingerIntentsDispatch({ type: 'SET_GEISINGER_COMPARE_TO_DOC', compareToDoc: selectedFiles[1] });
      }
    }
  };

  /**
   * Create formatted progress markdown
   * @param {string} stage - Current stage description
   * @param {Object} details - Additional details (previousStages, etc.)
   * @returns {string} Formatted markdown progress
   */
  function createProgressMarkdown(stage, details = {}) {
    const timestamp = new Date().toLocaleTimeString();
    let md = `## Conversation Preparation Progress\n\n`;

    // Add all previous completed stages if provided
    if (details.previousStages && Array.isArray(details.previousStages)) {
      details.previousStages.forEach(s => {
        md += `✓ ${s}\n`;
      });
    }

    // Add current in-progress stage
    md += `⏳ ${stage}\n\n`;
    md += `---\n*Last update: ${timestamp}*`;

    return md;
  }

  // Conversation polling now handled centrally in GeisingerContext

  const handlePreparation = async () => {

    console.log('[GeisingerFlow] handlePreparation invoked', {
      interactionIntent,
      filesToProcessCount: filesToProcess.length,
      lobIntent
    });

    if (!lobIntent || lobIntent === '') {
      // TODO: Show validation message to user telling them the Line of business must be selected.
      return;
    }

    if (interactionIntent === 'Comparison' && filesToProcess.length === 2) {

      const geisingerComparison = prepDocument({
        type: 'GeisingerComparison',
        lob: lobIntent,
        status: 'Processing',
        geisingerConversationAId: existingConversationDocs[selectedConversationDocIdxs[0]].id,
        geisingerConversationBId: existingConversationDocs[selectedConversationDocIdxs[1]].id
      });
      await geisingerDocComparision(geisingerComparison);
      geisingerIntentsDispatch({ type: 'SET_GEISINGER_COMPARISON', geisingerComparison });

    } else if (interactionIntent === 'Conversation' && filesToProcess.length === 1) {
      if (filesToProcess[0]?.allFilesInLob) {
        const allFilesSelection = buildAllFilesSelection();
        geisingerIntentsDispatch({
          type: 'SET_GEISINGER_CONVERSATION_DOC',
          conversationDoc: {
            ...allFilesSelection,
            status: 'Complete'
          }
        });
        geisingerIntentsDispatch({
          type: 'SET_GEISINGER_CONVERSATION',
          geisingerConversation: {
            lob: lobIntent,
            allFilesInLob: true,
            status: 'Complete'
          }
        });
        geisingerIntentsDispatch({
          type: 'SET_GEISINGER_CONVERSATION_INTERACTION',
          geisingerConversationInteraction: null
        });
        setOpenGeisingerDocIntelligence(false);
        return;
      }

      const initialProgressMarkdown = createProgressMarkdown(
        "Starting document preparation process...",
        { previousStages: [] },
        "Preparation"
      );

      const conversationChatInteraction = prepDocument({
        type: 'ChatInteraction',
        parentId: selectedChat.id,
        smartNoteId: smartNote.id,
        prompt: `Initiate document intelligence conversation for ${filesToProcess[0].name}`,
        response: initialProgressMarkdown,
        isComplete: false
      });
      console.log('[GeisingerFlow] prepared local chat interaction', conversationChatInteraction);

      // Create a provisional conversation doc with status 'Processing' and dispatch immediately.
      const geisingerConversation = prepDocument({
        type: 'GeisingerConversation',
        siteName: selectedSite,
        libraryName: selectedLibrary,
        lob: lobIntent,
        status: 'Processing',
        fileId: filesToProcess[0].fileId,
        fileAName: filesToProcess[0].name,
        relativeAUrl: filesToProcess[0].relativeUrl,
        teamName: teamName,
        assistantName: assistantName,
        chatId: selectedChat.id,
        chatInteractionId: conversationChatInteraction?.id || null
      });

      const newChatInteraction = await createChatInteraction(teamName, assistantName, smartNote, chatHistory, selectedChat, conversationChatInteraction);
      console.log('[GeisingerFlow] server chat interaction created', newChatInteraction);

      const mergedChatInteraction = newChatInteraction
        ? {
          ...newChatInteraction,
          response: newChatInteraction.response ?? conversationChatInteraction.response
        }
        : conversationChatInteraction;

      geisingerIntentsDispatch({
        type: 'SET_GEISINGER_CONVERSATION_INTERACTION',
        geisingerConversationInteraction: mergedChatInteraction
      });
      chatInteractionsDispatch({ type: 'CREATE_CHAT_INTERACTION', chatInteraction: mergedChatInteraction });

      // Ensure we also set conversationDoc for legacy fields & poll target
      geisingerIntentsDispatch({
        type: 'SET_GEISINGER_CONVERSATION_DOC', conversationDoc: {
          name: geisingerConversation.fileAName,
          relativeUrl: geisingerConversation.relativeAUrl,
          status: geisingerConversation.status,
          id: geisingerConversation.id
        }
      });
      geisingerIntentsDispatch({ type: 'SET_GEISINGER_CONVERSATION', geisingerConversation });
      // Fire-and-forget request so UI can close instantly; backend will eventually mark as Complete.

      geisingerDocConversation(geisingerConversation)
        .then(() => {
          console.log('[GeisingerFlow] geisingerDocConversation request resolved');
          // No immediate action here; polling in context will pick up completion.
        })
        .catch(err => {
          console.error('geisingerDocConversation start failed:', err);
        });
    }
    setOpenGeisingerDocIntelligence(false);
  };
  return (
    <div>
      <Box sx={{ backgroundColor: 'card.body.dark', px: 2, py: 2, borderRadius: '12px', mb: 2, boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)', width: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            Document Intelligence - {interactionIntent}
          </Typography>
          <IconButton onClick={() => setCollapsed(!collapsed)} size="small">
            {collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
          </IconButton>
        </Box>
        {!collapsed && (
          <>
            {(interactionIntent === 'Conversation' || interactionIntent === 'Comparison') && (
              <Accordion expanded={!conversationCollapsed} onChange={() => setConversationCollapsed(!conversationCollapsed)} sx={{ mb: 2, backgroundColor: 'card.body.dark', borderRadius: '8px', boxShadow: '0px 1px 2px rgba(0,0,0,0.05)' }}>
                <AccordionSummary expandIcon={<ExpandMoreIconMui />} sx={{ backgroundColor: 'card.body.dark', borderRadius: '8px' }}>
                  <Typography variant="h6" sx={{ fontWeight: 'regular' }}>Existing prepared conversational documents</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ backgroundColor: 'card.body.dark', borderRadius: '8px' }}>
                  {loadingConversation ? (
                    <CircularProgress size={24} />
                  ) : (
                    <List>
                      {interactionIntent === 'Conversation' && (
                        <ListItem
                          divider
                          sx={{
                            bgcolor: allFilesSelected ? '#e3f2fd' : '#f5f5f5',
                            borderRadius: '6px',
                            mb: 1,
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                            '&:hover': { bgcolor: '#bbdefb' },
                            border: allFilesSelected ? '2px solid #1976d2' : '1px solid #e0e0e0'
                          }}
                          onClick={() => handleSelectExistingConversationDoc({ allFilesInLob: true })}
                        >
                          <ListItemText
                            primary={buildAllFilesSelection().name}
                            secondary={`Scope: ${lobIntent || 'No LOB selected'} | Status: Ready`}
                          />
                          {allFilesSelected && (
                            <Typography variant="caption" sx={{ color: '#1976d2', fontWeight: 'bold', ml: 2 }}>
                              Selected
                            </Typography>
                          )}
                        </ListItem>
                      )}
                      {existingConversationDocs.length === 0 ? (
                        <ListItem><ListItemText primary="No conversational docs found." /></ListItem>
                      ) : (
                        existingConversationDocs.map((doc, idx) => {
                          const isSelected = selectedConversationDocIdxs.includes(idx);
                          return (
                            <ListItem
                              key={idx}
                              divider
                              sx={{
                                bgcolor: isSelected ? '#e3f2fd' : '#f5f5f5',
                                borderRadius: '6px',
                                mb: 1,
                                cursor: 'pointer',
                                transition: 'background 0.2s',
                                '&:hover': { bgcolor: '#bbdefb' },
                                border: isSelected ? '2px solid #1976d2' : '1px solid #e0e0e0'
                              }}
                              onClick={() => handleSelectExistingConversationDoc(doc, idx)}
                            >
                              <ListItemText
                                primary={doc.fileAName || doc.fileName || doc.title || doc.id || 'Untitled'}
                                secondary={`Site: ${doc.siteName || ''} | Status: ${doc.status || ''} | File: ${doc.fileName || doc.fileAName || ''} | URL: ${doc.relativeUrl || doc.relativeAUrl || ''}`}
                              />
                              {interactionIntent === 'Comparison' && isSelected && (
                                <Typography variant="caption" sx={{ color: '#1976d2', fontWeight: 'bold', ml: 2 }}>
                                  Selected
                                </Typography>
                              )}
                            </ListItem>
                          );
                        })
                      )}
                    </List>
                  )}
                </AccordionDetails>
              </Accordion>
            )}

            {/* Collapsible list of existing comparison docs */}
            {interactionIntent === 'Comparison' && <Accordion expanded={!comparisonCollapsed} onChange={() => setComparisonCollapsed(!comparisonCollapsed)} sx={{ mb: 2, backgroundColor: 'card.body.dark', borderRadius: '8px', boxShadow: '0px 1px 2px rgba(0,0,0,0.05)' }}>
              <AccordionSummary expandIcon={<ExpandMoreIconMui />} sx={{ backgroundColor: 'card.body.dark', borderRadius: '8px' }}>
                <Typography variant="h6" sx={{ fontWeight: 'regular' }}>Existing prepared comparison documents</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ backgroundColor: 'card.body.dark', borderRadius: '8px' }}>
                {loadingComparison ? (
                  <CircularProgress size={24} />
                ) : (
                  <List>
                    {existingComparisonDocs.length === 0 ? (
                      <ListItem><ListItemText primary="No comparison docs found." /></ListItem>
                    ) : (
                      existingComparisonDocs.map((doc, idx) => {
                        const convoA = getConversationDocById(doc.geisingerConversationAId);
                        const convoB = getConversationDocById(doc.geisingerConversationBId);
                        const fileAName = convoA ? (convoA.fileAName || convoA.fileName || convoA.title || convoA.id || 'Untitled') : 'Unknown';
                        const fileBName = convoB ? (convoB.fileAName || convoB.fileName || convoB.title || convoB.id || 'Untitled') : 'Unknown';
                        const relativeAUrl = convoA ? (convoA.relativeAUrl || convoA.relativeUrl || '') : '';
                        const relativeBUrl = convoB ? (convoB.relativeAUrl || convoB.relativeUrl || '') : '';
                        const siteA = convoA ? (convoA.siteName || '') : '';
                        const siteB = convoB ? (convoB.siteName || '') : '';
                        // Highlight selected comparison doc
                        const isSelected = geisingerIntentsObject.geisingerComparison && geisingerIntentsObject.geisingerComparison.id === doc.id;
                        return (
                          <ListItem key={idx} divider sx={{
                            bgcolor: isSelected ? '#e3f2fd' : '#f5f5f5',
                            borderRadius: '6px',
                            mb: 1,
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                            '&:hover': { bgcolor: '#bbdefb' },
                            border: isSelected ? '2px solid #1976d2' : '1px solid #e0e0e0'
                          }}
                            onClick={() => {
                              // Set the comparison object
                              geisingerIntentsDispatch({ type: 'SET_GEISINGER_COMPARISON', geisingerComparison: doc });

                              // Also populate the individual comparison docs for the context display
                              if (convoA) {
                                geisingerIntentsDispatch({
                                  type: 'SET_GEISINGER_COMPARE_FROM_DOC',
                                  compareFromDoc: {
                                    name: convoA.fileAName || convoA.fileName || convoA.title || 'Untitled',
                                    relativeUrl: convoA.relativeAUrl || convoA.relativeUrl || ''
                                  }
                                });
                              }

                              if (convoB) {
                                geisingerIntentsDispatch({
                                  type: 'SET_GEISINGER_COMPARE_TO_DOC',
                                  compareToDoc: {
                                    name: convoB.fileAName || convoB.fileName || convoB.title || 'Untitled',
                                    relativeUrl: convoB.relativeAUrl || convoB.relativeUrl || ''
                                  }
                                });
                              }
                            }}
                          >
                            <ListItemText
                              primary={`A: ${fileAName} | B: ${fileBName}`}
                              secondary={`SiteA: ${siteA} | SiteB: ${siteB} | Status: ${doc.status || ''} | FileA: ${fileAName} | URLA: ${relativeAUrl} | FileB: ${fileBName} | URLB: ${relativeBUrl}`}
                            />
                            {isSelected && (
                              <Typography variant="caption" sx={{ color: '#1976d2', fontWeight: 'bold', ml: 2 }}>
                                Selected
                              </Typography>
                            )}
                            {!isSelected && (
                              <Typography variant="caption" sx={{ color: '#1976d2', fontWeight: 'bold', ml: 2 }}>
                                Select
                              </Typography>
                            )}
                          </ListItem>
                        );
                      })
                    )}
                  </List>
                )}
              </AccordionDetails>
            </Accordion>}

            {/* Directions and files will be handled from context, no upload UI here */}
            <Box sx={{ mt: 2 }}>
              {filesToProcess.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  {(() => {
                    let fileLabel;
                    if (interactionIntent === 'Conversation') {
                      fileLabel = 'Conversation File:';
                    } else if (interactionIntent === 'Comparison') {
                      fileLabel = 'Comparison Files:';
                    } else {
                      fileLabel = 'Selected Files:';
                    }
                    return (
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                        {fileLabel}
                      </Typography>
                    );
                  })()}
                  {filesToProcess.map((file, idx) => (
                    <Box key={idx} sx={{ display: 'flex', alignItems: 'center', mb: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 0.5, wordBreak: 'break-all' }}>
                          {file.name}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>
                          {file.relativeUrl}
                        </Typography>
                      </Box>
                      <IconButton aria-label="remove file" size="small" onClick={() => {
                        const updatedFiles = filesToProcess.filter((_, i) => i !== idx);
                        setFilesToProcess(updatedFiles);
                        setInitiateButtonEnabled(updatedFiles.length > 0);
                      }}>
                        <CloseIcon sx={{ fontSize: 20, color: '#d32f2f' }} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
              <button
                onClick={() => setOpenGeisingerDocIntelligence(false)}
                style={{
                  background: '#fff',
                  color: '#1976d2',
                  border: '1px solid #1976d2',
                  borderRadius: '6px',
                  padding: '6px 16px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Cancel
              </button>
              {showDuplicateMessage && (
                <span style={{ color: '#b71c1c', fontWeight: 'bold', marginLeft: '12px' }}>
                  File already prepared, will be reprocessed.
                </span>
              )}
              <Box sx={{ flexGrow: 1 }} />
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {interactionIntent === 'Conversation' && (
                  <button
                    onClick={() => setOpenSharePointDialog(true)}
                    style={{
                      background: '#1976d2',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 16px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      marginRight: '8px'
                    }}
                  >
                    Select files for analysis
                  </button>
                )}
                {interactionIntent === 'Comparison' && (
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 'bold', mr: 2 }}>
                    Select two prepared conversation docs above for comparison.
                  </Typography>
                )}
                <button
                  onClick={handlePreparation}
                  style={{
                    background: initiateButtonEnabled ? '#1976d2' : '#90caf9',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 16px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                  disabled={!initiateButtonEnabled}
                >
                  Initiate processing
                </button>
              </Box>
            </Box>
            {/* Directions and files will be handled from context, no upload UI here */}
          </>
        )}
      </Box>
      {interactionIntent === 'Conversation' && (
        <SharePointDialog open={openSharePointDialog} onClose={() => setOpenSharePointDialog(false)} processSelectedFiles={handleSelectedFiles} />
      )}
    </div>
  );
};
GeisingerFlow.propTypes = {
  setOpenGeisingerDocIntelligence: PropTypes.func.isRequired,
  href: PropTypes.string.isRequired
};

export default GeisingerFlow;
