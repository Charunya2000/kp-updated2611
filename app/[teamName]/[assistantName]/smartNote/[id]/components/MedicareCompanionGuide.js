'use client';

import { useState } from 'react';
import { Box, Typography, IconButton, CircularProgress } from '@mui/material';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import ResponseList from './ResponseList';
import PromptLibrary from './PromptLibrary';

const MedicareCompanionGuide = ({
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
  assistantName,
}) => {
  const [activeTab, setActiveTab] = useState(0); // 0 = Prompt Library, 1 = Saved Responses, null = Menu

  const handleBackToMenu = () => {
    setActiveTab(null);
  };

  // Prompt Library tab content
  const renderPromptLibraryContent = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <Box sx={{
        padding: 2, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        <Typography variant="h6" sx={{ marginBottom: 1, flexShrink: 0 }}>Prompt Library</Typography>
        <Typography variant="subtitle1" sx={{ marginBottom: 2, flexShrink: 0 }}>Select a prompt to use in the chat window</Typography>
        <Box sx={{ flex: '1 1 0', overflow: 'auto', position: 'relative' }}>
          {promptsLoading ? (
            <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress size={28} />
              <Typography sx={{ ml: 2 }}>Loading prompts...</Typography>
            </Box>
          ) : promptError ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', px: 2 }}>
              <Typography variant="h6" color="error" sx={{ mb: 1 }}>Error Loading Prompts</Typography>
              <Typography variant="body2" color="text.secondary">{promptError}</Typography>
            </Box>
          ) : (
            <PromptLibrary
              onPromptSelected={onPromptSelected}
              prompts={promptsData}
            />
          )}
        </Box>
      </Box>
    </Box>
  );

  // Saved Responses tab content
  const renderSavedResponsesContent = () => {
    return (
      <Box sx={{ padding: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h6" sx={{ marginBottom: 2, flexShrink: 0 }}>Saved Responses</Typography>
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <ResponseList onSaveResponsesToSources={onSaveResponsesToSources} />
        </Box>
      </Box>
    );
  };

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
                  <LibraryBooksIcon sx={{ fontSize: 32, color: 'primary.main', mr: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>Prompt Library</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                  Access prompt library
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
                  <BookmarkIcon sx={{ fontSize: 32, color: 'secondary.main', mr: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>Saved Responses</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                  Access saved responses
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      ) : (
        // Content View with Navigation
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Navigation Bar */}
          <Box sx={{
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography
                variant="h5"
                color="text.primary"
                sx={{
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                {activeTab === 0 ? 'Prompt Library' : 'Saved Responses'}
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
              <ArrowBackIcon />
            </IconButton>
          </Box>

          {/* Content Area */}
          <Box sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column'
          }}>
            {activeTab === 0 ? (
              renderPromptLibraryContent()
            ) : (
              renderSavedResponsesContent()
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default MedicareCompanionGuide;
