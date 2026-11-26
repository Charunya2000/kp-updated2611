'use client';

import { useCallback, useEffect, useState } from 'react';
import { Box, Typography, IconButton, CircularProgress } from '@mui/material';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import ResponseList from '../../../../[assistantName]/smartNote/[id]/components/ResponseList';
import PromptLibrary from '../../../../[assistantName]/smartNote/[id]/components/PromptLibrary';
import Case360MrnInput from './Case360MrnInput';
import EpdsFilterDisplay from './EpdsFilterDisplay';
import { useUserAssistants } from '@/reducers/UserAssistantContext';
import { getAllPrompts } from '@/app/clientServices/promptLibraryService';

const Case360Guide = ({
  onPromptSelected,
  chatInputRef,
  width = 'mid',
  promptsData = [],
  onSaveResponsesToSources,
  getWidth,
  promptsLoading = false,
  promptError = null,
  smartNote,
  teamName,
  assistantName = 'case-360-assistant',
  mrnInput = '',
  setMrnInput,
  onEpdsEnabledChange,
  onEpdsFiltersChange,
  epdsEnabled = false,
  isEpdsFeatureEnabled = false,
  envName,
}) => {
  const [activeTab, setActiveTab] = useState(1); // 0 = Desktop, 1 = Case360, null = Menu
  const [hasPromptLibrary, setHasPromptLibrary] = useState(false);
  const [promptsState, setPromptsState] = useState(promptsData);
  const [promptsLoadingState, setPromptsLoadingState] = useState(promptsLoading);
  const [promptErrorState, setPromptErrorState] = useState(promptError);
  const [isEpdsEnabled, setIsEpdsEnabled] = useState(false);

  const { selectedUserAssistant } = useUserAssistants();

  const handleEpdsEnabledChange = useCallback((enabled, filters = null) => {
    setIsEpdsEnabled(prev => (prev === enabled ? prev : enabled));
    if (onEpdsEnabledChange) {
      onEpdsEnabledChange(enabled);
    }
    if (onEpdsFiltersChange) {
      onEpdsFiltersChange(filters || null);
    }
  }, [onEpdsEnabledChange, onEpdsFiltersChange]);

  useEffect(() => {
    setIsEpdsEnabled(Boolean(epdsEnabled));
  }, [epdsEnabled]);


  const getPanelWidth = () => {
    if (width === 'min') return '20%';
    if (width === 'mid') return '35%';
    if (width === 'max') return '100%';
    return '60%';
  };

  const handleBackToMenu = () => {
    setActiveTab(null);
  };

  const isEpdsPrompt = (prompt) => {
    const category = String(prompt?.category || '').trim().toLowerCase();
    const name = String(prompt?.name || '').trim().toLowerCase();
    const details = String(prompt?.details || '').trim().toLowerCase();
    return category === 'epds' || category.includes('epds') || name.includes('epds') || details.includes('epds');
  };

  const isEligibilityPrompt = (prompt) => {
    const category = String(prompt?.category || '').trim().toLowerCase();
    const name = String(prompt?.name || '').trim().toLowerCase();
    const details = String(prompt?.details || '').trim().toLowerCase();
    return category.includes('eligibility')
      || name.includes('eligibility')
      || details.includes('eligibility')
      || category.includes('mrn')
      || name.includes('mrn')
      || details.includes('mrn')
      || name.includes('medical record')
      || details.includes('medical record');
  };

  const getPromptPriority = (prompt) => {
    if (isEligibilityPrompt(prompt)) {
      return 1;
    }
    if (isEpdsPrompt(prompt)) {
      return 2;
    }
    return 3;
  };

  useEffect(() => {
    let cancelled = false;

    const fetchPrompts = async () => {
      if (!teamName || !assistantName) {
        return;
      }

      setPromptsLoadingState(true);
      setPromptErrorState(null);

      try {
        const promptResponses = await Promise.all([
          getAllPrompts(teamName, assistantName),
        ]);

        if (cancelled) return;

        const fetchedPrompts = Array.isArray(promptResponses?.[0])
          ? promptResponses[0].filter(Boolean)
          : [];

        const enabledPrompts = Array.isArray(fetchedPrompts)
          ? fetchedPrompts.filter((prompt) => prompt?.enabled)
          : [];

        setHasPromptLibrary(enabledPrompts.length > 0);
        setPromptsState(enabledPrompts);
      } catch (error) {
        if (cancelled) return;

        setPromptErrorState('Failed to load prompts');
        setHasPromptLibrary(false);
        setPromptsState([]);
      } finally {
        if (!cancelled) {
          setPromptsLoadingState(false);
        }
      }
    };

    fetchPrompts();

    return () => {
      cancelled = true;
    };
  }, [teamName, assistantName, smartNote?.persona, selectedUserAssistant?.name]);

  // Desktop tab content (Saved Responses only for Case360)
  const renderCase360DesktopContent = () => {
    return (
      <Box sx={{ padding: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h6" sx={{ marginBottom: 2, flexShrink: 0 }}>Saved Responses</Typography>
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <ResponseList onSaveResponsesToSources={onSaveResponsesToSources} teamName={teamName} assistantName={assistantName} />
        </Box>
      </Box>
    );
  };

  // Case360 tab content (MRN Input + EPDS Filter + Prompt Library)
  const renderCase360Content = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* MRN Input Section - No Scroll */}
      <Box sx={{
        padding: 2,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        borderBottom: 1,
        borderColor: 'divider',
      }}>
        <Case360MrnInput chatInputRef={chatInputRef} smartNote={smartNote} teamName={teamName} assistantName={assistantName} mrnInput={mrnInput} onMrnChange={setMrnInput} envName={envName} />
      </Box>

      {/* EPDS Filter Section Header */}
      {isEpdsFeatureEnabled ? (
        <Box sx={{
          padding: 0,
          flexShrink: 0,
        }}>
          <EpdsFilterDisplay
            smartNote={smartNote}
            smartNoteId={smartNote?.id}
            teamName={teamName}
            sessionId={smartNote?.sessionId}
            assistantName={assistantName}
            smartNoteCreateDt={smartNote?.createdAt}
            chatInputRef={chatInputRef}
            onEnabledChange={handleEpdsEnabledChange}
            enabled={isEpdsEnabled}
            featureEnabled={isEpdsFeatureEnabled}
          />
        </Box>
      ) : null}

      {/* Prompt Library Section */}
      <Box sx={{
        padding: 2,
        display: 'flex',
        flexGrow: 1,
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {(() => {
          const hasMrnInput = Boolean(mrnInput?.trim());
          let visiblePrompts = promptsState;

          if (hasMrnInput && isEpdsEnabled) {
            visiblePrompts = promptsState
              .filter((prompt) => isEligibilityPrompt(prompt) || isEpdsPrompt(prompt))
              .sort((a, b) => getPromptPriority(a) - getPromptPriority(b));
          } else if (hasMrnInput) {
            visiblePrompts = promptsState.filter(isEligibilityPrompt);
          } else if (isEpdsEnabled) {
            visiblePrompts = promptsState.filter(isEpdsPrompt);
          }

          const hasVisiblePrompts = visiblePrompts.length > 0;

          return (
            <>
              <Typography variant="h6" sx={{ marginBottom: 1, flexShrink: 0 }}>Prompt Library</Typography>
              <Typography variant="subtitle1" sx={{ marginBottom: 2, flexShrink: 0 }}>Select a prompt to use in the chat window</Typography>
              <Box sx={{ flex: '1 1 0', overflow: 'auto', position: 'relative' }}>
                {promptsLoadingState ? (
                  <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                    <CircularProgress size={28} />
                    <Typography sx={{ ml: 2 }}>Loading prompts...</Typography>
                  </Box>
                ) : promptErrorState ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', px: 2 }}>
                    <Typography variant="h6" color="error" sx={{ mb: 1 }}>Error Loading Prompts</Typography>
                    <Typography variant="body2" color="text.secondary">{promptErrorState}</Typography>
                  </Box>
                ) : !hasPromptLibrary || !hasVisiblePrompts ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', px: 2 }}>
                    <LibraryBooksIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
                      No Prompts Available
                    </Typography>
                    <Typography variant="body2" color="text.disabled" sx={{ lineHeight: 1.5 }}>
                      No prompts are available for the selected persona{smartNote?.persona ? ` (${smartNote.persona})` : ''}. Please contact your team administrator to add prompts.
                    </Typography>
                  </Box>
                ) : (
                  <PromptLibrary
                    onPromptSelected={onPromptSelected}
                    prompts={visiblePrompts}
                    isCase360={true}
                    mrnInput={mrnInput}
                    epdsEnabled={isEpdsEnabled}
                  />
                )}
              </Box>
            </>
          );
        })()}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: getPanelWidth(), height: '100%', overflow: 'hidden', border: '1px solid', borderColor: 'color.dolphin', borderRadius: '15px', transition: 'width 0.3s', backgroundColor: 'card.body.deep' }}>

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
                  Access saved responses
                </Typography>
              </Box>

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
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>Eligibility and Prompt Library</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                  Access eligibility input and prompt library
                </Typography>
              </Box>
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
                    Eligibility and Prompt Library
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
              renderCase360DesktopContent()
            ) : (
              renderCase360Content()
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default Case360Guide;