'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, IconButton, MenuItem, Stack, TextField, Typography, useTheme } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useParams } from 'next/navigation';
import { useChatInteractions } from '@reducers/ChatInteractionContext';
import {
  createMemoryItem,
  deleteMemoryItem,
  extractMemoryCandidates,
  listMemoryItems,
  updateMemoryItem
} from '@/app/clientServices/memoryService';

const EMPTY_FORM = {
  key: '',
  value: '',
  memoryType: 'fact',
  scope: 'smartnote'
};

const WhatIRememberPanel = ({ containerCollapsed, onContainerToggle }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const panelBorderColor = isDarkMode ? 'rgba(148,163,184,0.2)' : 'rgba(13,28,61,0.15)';
  const panelInnerBorderColor = isDarkMode ? 'rgba(148,163,184,0.2)' : 'rgba(13,28,61,0.16)';
  const mutedTextColor = theme.palette.text?.muted || (isDarkMode ? 'rgba(226,232,240,0.8)' : 'rgba(13,28,61,0.7)');
  const headingColor = theme.palette.text?.heading || theme.palette.text.primary;
  const panelBackground = isDarkMode
    ? 'linear-gradient(180deg, #081427 0%, #0f1b2f 45%, #111826 100%)'
    : theme.palette.background.paper;

  const { teamName, assistantName, id: smartNoteId } = useParams();
  const { chatInteractions = [], selectedChatInteraction } = useChatInteractions() || {};

  const [items, setItems] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const collapsed = typeof containerCollapsed === 'boolean' ? containerCollapsed : isCollapsed;

  const latestInteraction = useMemo(() => {
    if (selectedChatInteraction?.id) {
      return selectedChatInteraction;
    }
    return chatInteractions.length > 0 ? chatInteractions[chatInteractions.length - 1] : null;
  }, [chatInteractions, selectedChatInteraction]);

  useEffect(() => {
    loadMemories();
  }, [assistantName, smartNoteId, teamName]);

  const loadMemories = async () => {
    if (!teamName || !assistantName || !smartNoteId) {
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const memories = await listMemoryItems(teamName, assistantName, smartNoteId);
      setItems(Array.isArray(memories) ? memories : []);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load memory items.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateMemory = async () => {
    setError('');
    setSuccess('');

    if (!form.key.trim() || !form.value.trim()) {
      setError('Key and value are required.');
      return;
    }

    try {
      await createMemoryItem(teamName, assistantName, smartNoteId, {
        ...form,
        source: 'manual',
        confidence: 1,
        sensitivity: 'medium'
      });
      setForm(EMPTY_FORM);
      setSuccess('Memory saved.');
      await loadMemories();
    } catch (createError) {
      setError(createError.message || 'Unable to save memory item.');
    }
  };

  const handleDeleteMemory = async (memoryId) => {
    setError('');
    setSuccess('');

    try {
      await deleteMemoryItem(teamName, assistantName, smartNoteId, memoryId);
      setSuccess('Memory deleted.');
      setItems((prev) => prev.filter((item) => item.id !== memoryId));
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete memory item.');
    }
  };

  const handleTogglePin = async (item) => {
    setError('');
    setSuccess('');

    try {
      await updateMemoryItem(teamName, assistantName, smartNoteId, item.id, { pinned: !item.pinned });
      setItems((prev) => prev.map((current) => (
        current.id === item.id ? { ...current, pinned: !current.pinned } : current
      )));
    } catch (toggleError) {
      setError(toggleError.message || 'Unable to update memory item.');
    }
  };

  const handleExtractCandidates = async () => {
    if (!latestInteraction?.prompt && !latestInteraction?.response) {
      setError('No interaction content available to extract memory from.');
      return;
    }

    setIsExtracting(true);
    setError('');
    setSuccess('');

    try {
      const extracted = await extractMemoryCandidates(teamName, assistantName, smartNoteId, {
        prompt: latestInteraction?.prompt || '',
        response: latestInteraction?.response || '',
        source: 'extraction',
        sourceInteractionId: latestInteraction?.id || null,
        persist: false,
        maxItems: 8
      });
      setCandidates(extracted?.candidates || []);
      if (!extracted?.candidates?.length) {
        setSuccess('No memory candidates found for the latest interaction.');
      }
    } catch (extractError) {
      setError(extractError.message || 'Unable to extract memory candidates.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleApproveCandidate = async (candidate) => {
    try {
      await createMemoryItem(teamName, assistantName, smartNoteId, {
        ...candidate,
        source: 'extraction',
        sourceInteractionId: latestInteraction?.id || null
      });
      setCandidates((prev) => prev.filter((entry) => entry.key !== candidate.key || entry.value !== candidate.value));
      setSuccess('Candidate added to memory.');
      await loadMemories();
    } catch (approveError) {
      setError(approveError.message || 'Unable to persist memory candidate.');
    }
  };

  return (
    <Box
      id="info-source-what-i-remember"
      sx={{
        background: panelBackground,
        color: theme.palette.text.primary,
        borderRadius: '24px',
        paddingX: 3,
        paddingTop: 2.5,
        paddingBottom: 3.5,
        border: `1px solid ${panelBorderColor}`,
        boxShadow: isDarkMode ? '0 25px 60px rgba(2,6,23,0.55)' : '0 12px 28px rgba(13,28,61,0.12)',
        fontFamily: '\'Space Grotesk\', \'DM Sans\', \'Segoe UI\', sans-serif',
        minHeight: 0,
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Stack spacing={2} sx={{ height: '100%', minHeight: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="overline" sx={{ letterSpacing: 4, color: mutedTextColor }}>
              What I Remember
            </Typography>
            <Typography variant="h6" sx={{ color: headingColor, fontWeight: 600 }}>
              SmartNote memory
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <IconButton onClick={loadMemories} size="small" sx={{ color: theme.palette.text.primary }}>
              <RefreshIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => { if (onContainerToggle) { onContainerToggle(); } else { setIsCollapsed((prev) => !prev); } }} sx={{ color: theme.palette.text.primary }}>
              {collapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
            </IconButton>
          </Stack>
        </Stack>

        {!collapsed && (
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 0.5, pt: 0.75 }}>
            <Stack spacing={2}>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                <TextField
                  size="small"
                  label="Key"
                  value={form.key}
                  onChange={(event) => setForm((prev) => ({ ...prev, key: event.target.value }))}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="Type"
                  select
                  value={form.memoryType}
                  onChange={(event) => setForm((prev) => ({ ...prev, memoryType: event.target.value }))}
                  sx={{ minWidth: 120 }}
                >
                  <MenuItem value="fact">fact</MenuItem>
                  <MenuItem value="preference">preference</MenuItem>
                  <MenuItem value="constraint">constraint</MenuItem>
                  <MenuItem value="action">action</MenuItem>
                </TextField>
              </Stack>

              <TextField
                size="small"
                label="Value"
                value={form.value}
                onChange={(event) => setForm((prev) => ({ ...prev, value: event.target.value }))}
                fullWidth
                multiline
                minRows={2}
              />

              <Stack direction="row" spacing={1.5} alignItems="center">
                <Button onClick={handleCreateMemory} variant="outlined" sx={{ textTransform: 'none', borderRadius: '999px' }}>
                  Save memory
                </Button>
                <Button
                  onClick={handleExtractCandidates}
                  variant="outlined"
                  startIcon={<AutoFixHighIcon fontSize="small" />}
                  disabled={isExtracting}
                  sx={{ textTransform: 'none', borderRadius: '999px' }}
                >
                  Extract from latest interaction
                </Button>
                {(isLoading || isExtracting) && <CircularProgress size={18} />}
              </Stack>

              {error && <Alert severity="error">{error}</Alert>}
              {success && <Alert severity="success">{success}</Alert>}

              {candidates.length > 0 && (
                <Box sx={{ border: `1px solid ${panelInnerBorderColor}`, borderRadius: '14px', padding: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ color: headingColor, fontWeight: 600, mb: 1 }}>
                    Candidate memories
                  </Typography>
                  <Stack spacing={1}>
                    {candidates.map((candidate) => (
                      <Box key={`${candidate.key}-${candidate.value}`} sx={{ border: `1px solid ${panelInnerBorderColor}`, borderRadius: '10px', p: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                          <Chip label={candidate.memoryType} size="small" />
                          <Button size="small" onClick={() => handleApproveCandidate(candidate)} sx={{ textTransform: 'none' }}>
                            Approve
                          </Button>
                        </Stack>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>{candidate.value}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}

              <Box sx={{ border: `1px solid ${panelInnerBorderColor}`, borderRadius: '14px', padding: 1.5, maxHeight: 260, overflowY: 'auto' }}>
                <Typography variant="subtitle2" sx={{ color: headingColor, fontWeight: 600, mb: 1 }}>
                  Saved memory items ({items.length})
                </Typography>

                {items.length === 0 ? (
                  <Typography variant="body2" sx={{ color: mutedTextColor }}>
                    No memory captured yet for this SmartNote.
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {items.map((item) => (
                      <Box key={item.id} sx={{ border: `1px solid ${panelInnerBorderColor}`, borderRadius: '10px', p: 1 }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip label={item.memoryType} size="small" />
                            <Typography variant="caption" sx={{ color: mutedTextColor }}>{item.key}</Typography>
                          </Stack>
                          <Stack direction="row" spacing={0.5}>
                            <IconButton size="small" onClick={() => handleTogglePin(item)} sx={{ color: theme.palette.text.primary }}>
                              {item.pinned ? <PushPinIcon fontSize="small" /> : <PushPinOutlinedIcon fontSize="small" />}
                            </IconButton>
                            <IconButton size="small" onClick={() => handleDeleteMemory(item.id)} sx={{ color: '#fda4af' }}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </Stack>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>{item.value}</Typography>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            </Stack>
          </Box>
        )}
      </Stack>
    </Box>
  );
};

export default WhatIRememberPanel;
