'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { Box, Typography, IconButton, Divider, CircularProgress, Tooltip } from '@mui/material';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AddNoteDialog from './AddNoteDialog';
import NoteList from './NoteList';
import ResponseList from './ResponseList';
import GeisingerContext from './GeisingerContext';
import SmartWorkflowSection from './SmartWorkflowSection';
import PromptLibrary from './PromptLibrary';
import { addNotesToSource } from '@clientServices/savedNoteService';
import { addResponsesToSource } from '@clientServices/savedResponseService';
import { createSources } from '@clientServices/sourceService';
import { useSourcesDispatch } from '@reducers/SourceContext';
import { useSmartNote } from '@reducers/improved/SmartNoteContext';
import { prepDocument } from '@clientServices/insertDocument';
import { useUserAssistants } from '@/reducers/UserAssistantContext';
import { updateUpdatedAt } from '@/app/clientServices/smartNoteService';
import MedicareCompanionGuide from './MedicareCompanionGuide';
import { getAllPrompts } from '@/app/clientServices/promptLibraryService';
import { useParams } from 'next/navigation';

const Guide = ({ onPromptSelected, chatInputRef, width = 'mid' }) => {
  const { selectedUserAssistant } = useUserAssistants();


  const MEDICARE_COMPANION_ASSISTANTS = [
    'medicare-companion',
  ];

  const MEDICAID_AI_ASSISTANTS = [
    'medicaid-ai-assistant',
  ];

  const isMedicareCompanionSelected = selectedUserAssistant && MEDICARE_COMPANION_ASSISTANTS.includes(selectedUserAssistant.name);
  const MedicaidshowSmartWorkflow = selectedUserAssistant && MEDICAID_AI_ASSISTANTS.includes(selectedUserAssistant.name);

  const [activeTab, setActiveTab] = useState(0); // 0 = Desktop, 1 = Prompt Library, null = Menu
  const [hasPromptLibrary, setHasPromptLibrary] = useState(false);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [promptError, setPromptError] = useState(null);
  const [promptsData, setPromptsData] = useState([]);
  const sourcesDispatch = useSourcesDispatch();
  const smartNote = useSmartNote();
  const { teamName, assistantName } = useParams();

  // Fetch prompt library availability
  useEffect(() => {
    let cancelled = false;

    const fetchPrompts = async () => {
      // Only fetch prompts if we're on Prompt Library tab or in menu view (to check availability) or Case360/MedicareCompanion assistant
      if (!teamName || !assistantName || (!isMedicareCompanionSelected && activeTab !== null && activeTab !== 1)) {
        return;
      }

      setPromptsLoading(true);
      setPromptError(null);

      try {
        const res = await getAllPrompts(teamName, assistantName);
        if (cancelled) return;

        const enabledPrompts = Array.isArray(res) ? res.filter(p => p?.enabled) : [];

        let filteredPrompts;

        // When no persona is selected, show all prompts (both enabled and persona-specific)

        if (!smartNote?.persona) {
          filteredPrompts = enabledPrompts;
        } else {
          // When a persona is selected, filter prompts
          filteredPrompts = enabledPrompts.filter(prompt => {
            // Include prompts with empty associatedPersonas
            if (!prompt.associatedPersonas || !Array.isArray(prompt.associatedPersonas) || prompt.associatedPersonas.length === 0) {
              return true;
            }
            // Include prompts that contain the selected persona
            return prompt.associatedPersonas.includes(smartNote.persona);
          });
        }

        setHasPromptLibrary(filteredPrompts.length > 0);
        setPromptsData(filteredPrompts);
      } catch (error) {
        if (cancelled) return;
        setPromptError('Failed to load prompts');
        setHasPromptLibrary(false);
        setPromptsData([]);
      } finally {
        if (!cancelled) setPromptsLoading(false);
      }
    };

    fetchPrompts();

    return () => {
      cancelled = true;
    };
  }, [teamName, assistantName, activeTab, smartNote?.persona, isMedicareCompanionSelected]);

  const getWidth = () => {
    if (width === 'min') return '20%';
    if (width === 'mid') return '35%';
    if (width === 'max') return '100%';
    return '60%';
  };

  const handleBackToMenu = () => {
    setActiveTab(null);
  };

  const sourceFromSavedNote = (savedNote) => {
    return prepDocument({ type: 'Source', smartNoteId: smartNote.id, parentId: smartNote.id, sourceId: savedNote.id, selected: true, sourceType: 'SavedNote' });
  };

  const sourceFromSaveResponse = (savedResponse) => {
    return prepDocument({ type: 'Source', smartNoteId: smartNote.id, parentId: smartNote.id, sourceId: savedResponse.id, selected: true, sourceType: 'SavedResponse' });
  };

  const onSaveNotesToSources = useCallback(async (savedNotes) => {
    const selectedSavedNotes = savedNotes.filter(savedNote => savedNote.selected);
    const newSources = selectedSavedNotes.map(selectedSavedNote => sourceFromSavedNote(selectedSavedNote));
    newSources.map(newSource => sourcesDispatch({ type: 'UPDATE_OR_CREATE_SOURCE', source: newSource }));
    // Add sources and update SmartNote (no await, let it fire and forget)
    createSources(teamName, assistantName, newSources);
    addNotesToSource(teamName, assistantName, selectedSavedNotes);
    updateUpdatedAt(teamName, assistantName, smartNote.id);
  }, [teamName, assistantName, sourcesDispatch, smartNote]);

  const onSaveResponsesToSources = useCallback(async (savedResponses) => {
    const selectedSavedResponses = savedResponses.filter(savedResponse => savedResponse.selected);
    const newSources = selectedSavedResponses.map(selectedSavedResponse => sourceFromSaveResponse(selectedSavedResponse));
    newSources.map(newSource => sourcesDispatch({ type: 'UPDATE_OR_CREATE_SOURCE', source: newSource }));
    createSources(teamName, assistantName, newSources);
    addResponsesToSource(teamName, assistantName, selectedSavedResponses);
    updateUpdatedAt(teamName, assistantName, smartNote.id);
  }, [teamName, assistantName, sourcesDispatch, smartNote]);

  // Desktop tab content
  const renderDesktopContent = () => {
    return (
      <Box sx={{ height: '100%', overflow: 'auto' }}>
        <Box sx={{ padding: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, marginBottom: 2 }}>
            <Typography variant="h6">Smart Workflow</Typography>
            <Tooltip title="Workflows run custom steps, and are not affected by assistant configurations, or personas" arrow>
              <InfoOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary', cursor: 'pointer' }} />
            </Tooltip>
          </Box>
          <Box sx={{ ...(smartNote?.persona && { opacity: 0.5 }), position: 'relative' }}>
            {smartNote?.persona && (
              <Box sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 1,
                cursor: 'not-allowed'
              }} />
            )}
            <SmartWorkflowSection selectedUserAssistant={selectedUserAssistant} />
          </Box>
        </Box>
        <Divider sx={{ width: '90%', mx: 'auto' }} />
        <Box sx={{ padding: 2, minHeight: '200px', display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h6" sx={{ marginBottom: 2 }}>User Notes</Typography>
          <AddNoteDialog />
          <Suspense fallback={<div>Loading...</div>}>
            <NoteList onSaveNotesToSources={onSaveNotesToSources} />
          </Suspense>
        </Box>
        <Divider sx={{ width: '90%', mx: 'auto' }} />
        <Box sx={{ padding: 2, minHeight: '200px', display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h6" sx={{ marginBottom: 2 }}>Saved Responses</Typography>
          <ResponseList onSaveResponsesToSources={onSaveResponsesToSources} />
        </Box>
      </Box>
    );
  };

  // Prompt Library tab content
  const renderPromptLibraryContent = () => {
    return (
      <Box sx={{
        padding: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {promptError ? (
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '200px'
            }}>
              <Typography variant="h6" color="error" sx={{ mb: 1 }}>
                Error Loading Prompts
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {promptError}
              </Typography>
            </Box>
          ) : !smartNote?.persona ? (
            <PromptLibrary
              onPromptSelected={onPromptSelected}
              prompts={promptsData}
            />
          ) : !hasPromptLibrary ? (
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '200px'
            }}>
              <LibraryBooksIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
                No Prompts Available
              </Typography>
              <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', lineHeight: 1.5 }}>
                No prompts are available for the selected persona ({smartNote.persona}). Please contact your team administrator to add prompts.
              </Typography>
            </Box>
          ) : (
            <PromptLibrary
              onPromptSelected={onPromptSelected}
              prompts={promptsData}
            />
          )}
        </Box>
      </Box>
    );
  };

  const renderGesingerContext = () => {
    return (
      <Box sx={{ padding: 2, minHeight: '200px', display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h6" sx={{ marginBottom: 2 }}>Compliance AI Context</Typography>
        <GeisingerContext />
      </Box>
    )
  }


  // Render specialized Medicare Companion UI
  if (isMedicareCompanionSelected) {
    return (
      <MedicareCompanionGuide
        onPromptSelected={onPromptSelected}
        chatInputRef={chatInputRef}
        width={width}
        promptsData={promptsData}
        onSaveResponsesToSources={onSaveResponsesToSources}
        getWidth={getWidth}
        promptsLoading={promptsLoading}
        promptError={promptError}
        smartNote={smartNote}
        teamName={teamName}
        assistantName={assistantName}
      />
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: getWidth(), height: '100%', overflow: 'hidden', border: '1px solid', borderColor: 'color.dolphin', borderRadius: '15px', transition: 'width 0.3s', backgroundColor: 'card.body.deep' }}>

      {activeTab === null ? (
        // Tab Selection View
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%'
        }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', backgroundColor: 'primary.50' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <MenuOpenIcon sx={{ mr: 1, color: 'primary.main', fontSize: 32 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Menu</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Select a section to continue
            </Typography>
          </Box>

          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box
                sx={{
                  p: 3,
                  border: '2px solid',
                  borderColor: 'divider',
                  borderRadius: 3,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                    borderColor: 'primary.main',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                    transform: 'translateY(-2px)'
                  },
                  transition: 'all 0.3s ease'
                }}
                onClick={() => setActiveTab(0)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <DesktopWindowsIcon sx={{ fontSize: 32, color: 'primary.main', mr: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>Desktop</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                  Access smart workflow, user notes, and saved responses
                </Typography>
              </Box>

              {hasPromptLibrary && (
                <Box
                  sx={{
                    p: 3,
                    border: '2px solid',
                    borderColor: 'divider',
                    borderRadius: 3,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                      borderColor: 'primary.main',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                      transform: 'translateY(-2px)'
                    },
                    transition: 'all 0.3s ease'
                  }}
                  onClick={() => setActiveTab(1)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <LibraryBooksIcon sx={{ fontSize: 32, color: 'secondary.main', mr: 2 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>Prompt Library</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                    Browse and select from available prompts
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      ) : (
        // Content View with Navigation
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Enhanced Navigation Bar */}
          <Box sx={{
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            {activeTab === 0 ? (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography
                    variant="h5"
                    color="text.primary"
                    sx={{
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    Desktop
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={handleBackToMenu}
                  sx={{
                    color: 'text.secondary',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                      color: 'primary.main'
                    }
                  }}
                >
                  <MenuIcon />
                </IconButton>
              </>
            ) : (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography
                    variant="h5"
                    color="text.primary"
                    sx={{
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    Prompt Library
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={handleBackToMenu}
                  sx={{
                    color: 'text.secondary',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                      color: 'primary.main'
                    }
                  }}
                >
                  <MenuIcon />
                </IconButton>
              </>
            )}
          </Box>

          {/* Content Area */}
          <Box sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column'
          }}>
            {activeTab === 0 ? (
              selectedUserAssistant && selectedUserAssistant.name === 'complianceai2' ? (
                renderGesingerContext()
              ) : (
                renderDesktopContent()
              )) : (
              promptsLoading ? (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CircularProgress size={28} />
                  <Typography sx={{ ml: 2 }}>
                    Loading prompts...
                  </Typography>
                </Box>
              ) : (
                renderPromptLibraryContent()
              )
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default Guide;