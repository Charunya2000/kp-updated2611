'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Button, IconButton, Typography, useTheme } from '@mui/material';
import PushPinIcon from '@mui/icons-material/PushPin';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { TextField } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close'; // Import the Close icon
import { useParams } from 'next/navigation';
import { getSharedDealCanvas, saveSharedDealCanvas } from '@/app/clientServices/dealCanvasService';

const INITIAL_LANES = [
  {
    id: 'pressure',
    title: 'Buyer Pressure Signals',
    description: 'Moments that create urgency with finance, HR, or broker partners.',
    accent: 'rgba(248,113,113,0.5)',
    cards: [
      { id: 'pressure-1', title: 'GLP-1 coverage scrutiny', body: 'Benefit leaders want a defensible POV on high-cost pharmacy trends.' },
      { id: 'pressure-2', title: 'Multi-site onboarding pain', body: 'Self-funded prospects need proof of consistent implementation playbooks.' }
    ]
  },
  {
    id: 'kp-advantage',
    title: 'KP Differentiators',
    description: 'Program proof points we can cite inside the deck.',
    accent: 'rgba(134,239,172,0.45)',
    cards: [
      { id: 'kp-adv-1', title: 'Whole-person navigation', body: 'Highlight integrated behavioral health concierge for at-risk employees.' }
    ]
  },
  {
    id: 'next-best',
    title: 'Next Best Motions',
    description: 'Owner + due dates for the pursuit team.',
    accent: 'rgba(125,211,252,0.45)',
    cards: [
      { id: 'next-best-1', title: 'Broker prep', body: 'Align with Marsh to confirm underwriting guardrails by Friday.' },
      { id: 'next-best-2', title: 'Executive sponsor loop-in', body: 'Schedule CIO touchpoint on AI safety narrative.' }
    ]
  }
];

const DealCanvasPanel = ({ containerCollapsed, onContainerToggle }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const panelBackground = isDarkMode
    ? 'linear-gradient(135deg, #05121f 0%, #092135 55%, #0c2c3d 100%)'
    : theme.palette.background.paper;
  const panelBorderColor = isDarkMode ? 'rgba(148,163,184,0.2)' : 'rgba(13,28,61,0.15)';
  const panelInnerBorderColor = isDarkMode ? 'rgba(148,163,184,0.2)' : 'rgba(13,28,61,0.16)';
  const headingColor = theme.palette.text?.heading || theme.palette.text.primary;
  const mutedTextColor = theme.palette.text?.muted || (isDarkMode ? 'rgba(191,219,254,0.8)' : 'rgba(13,28,61,0.72)');

  const [lanes, setLanes] = useState(INITIAL_LANES);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveState, setSaveState] = useState('idle');
  const [isInitialized, setIsInitialized] = useState(false);
  const saveTimerRef = useRef(null);
  const pollTimerRef = useRef(null);
  const skipNextSaveRef = useRef(false);
  const lastKnownUpdatedAtRef = useRef(null);
  const latestLanesRef = useRef(INITIAL_LANES);
  const { teamName, assistantName, id: smartNoteId } = useParams();
  const isCollapsed = typeof containerCollapsed === 'boolean' ? containerCollapsed : false;

  const applyRemoteCanvas = (canvas) => {
    if (!canvas || !Array.isArray(canvas.lanes)) {
      return;
    }

    skipNextSaveRef.current = true;
    latestLanesRef.current = canvas.lanes;
    setLanes(canvas.lanes);
    lastKnownUpdatedAtRef.current = canvas.updatedAt || null;
  };

  const loadCanvas = async (silent = false) => {
    if (!teamName || !assistantName || !smartNoteId) {
      return;
    }

    try {
      const canvas = await getSharedDealCanvas(teamName, assistantName, smartNoteId);
      if (canvas?.lanes && Array.isArray(canvas.lanes)) {
        if (silent) {
          const incomingUpdatedAt = canvas.updatedAt || null;
          const hasRemoteUpdate = incomingUpdatedAt && incomingUpdatedAt !== lastKnownUpdatedAtRef.current;
          if (hasRemoteUpdate && saveState !== 'saving') {
            applyRemoteCanvas(canvas);
            setSaveState('saved');
            setSaveMessage('Deal Canvas refreshed with updates from another user.');
          }
        } else {
          applyRemoteCanvas(canvas);
        }
      }
    } catch (error) {
      if (!silent) {
        setSaveState('error');
        setSaveMessage('Unable to load shared Deal Canvas. Using local defaults.');
      }
    } finally {
      if (!silent) {
        setIsInitialized(true);
      }
    }
  };

  const persistCanvas = async () => {
    if (!teamName || !assistantName || !smartNoteId) {
      return;
    }

    try {
      setSaveState('saving');
      setSaveMessage('Saving shared Deal Canvas...');
      const result = await saveSharedDealCanvas(teamName, assistantName, smartNoteId, {
        lanes: latestLanesRef.current,
        expectedUpdatedAt: lastKnownUpdatedAtRef.current
      });

      if (result?.conflict) {
        if (result.canvas?.lanes && Array.isArray(result.canvas.lanes)) {
          applyRemoteCanvas(result.canvas);
        }
        setSaveState('conflict');
        setSaveMessage(result?.error || 'Deal Canvas changed in another session. Your latest edits were not saved; please try again.');
        return;
      }

      if (result?.canvas?.updatedAt) {
        lastKnownUpdatedAtRef.current = result.canvas.updatedAt;
      }
      setSaveState('saved');
      setSaveMessage('All changes saved to shared Deal Canvas.');
    } catch (error) {
      setSaveState('error');
      setSaveMessage('Unable to save Deal Canvas changes.');
    }
  };

  useEffect(() => {
    loadCanvas(false);

    pollTimerRef.current = setInterval(() => {
      loadCanvas(true);
    }, 15000);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [teamName, assistantName, smartNoteId]);

  useEffect(() => {
    latestLanesRef.current = lanes;

    if (!isInitialized) {
      return;
    }

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      persistCanvas();
    }, 800);
  }, [lanes, isInitialized]);

  const handleAddCard = (laneId) => {
    setLanes((prev) => prev.map((lane) => {
      if (lane.id !== laneId) {
        return lane;
      }
      const nextIndex = lane.cards.length + 1;
      return {
        ...lane,
        cards: [
          ...lane.cards,
          {
            id: `${lane.id}-${nextIndex}`,
            title: 'New placeholder insight',
            body: 'Replace this copy with the next approved talking point.'
          }
        ]
      };
    }));
  };

  const handleEditCard = (laneId, cardId, updatedCard) => {
    setLanes((prev) => prev.map((lane) => {
      if (lane.id !== laneId) return lane;
      return {
        ...lane,
        cards: lane.cards.map((card) =>
          card.id === cardId ? { ...card, ...updatedCard } : card
        )
      };
    }));
  };

  const handleDeleteCard = (laneId, cardId) => {
    console.log(`Deleting card with ID: ${cardId} from lane: ${laneId}`); // Debugging log
    setLanes((prev) => prev.map((lane) => {
      if (lane.id !== laneId) return lane;
      return {
        ...lane,
        cards: lane.cards.filter((card) => card.id !== cardId)
      };
    }));
  };

  return (
    <Box
      id="info-source-deal-canvas"
      sx={{
        background: panelBackground,
        borderRadius: '24px',
        paddingX: 3,
        paddingTop: 2.5,
        paddingBottom: 3.5,
        color: theme.palette.text.primary,
        border: `1px solid ${panelBorderColor}`,
        boxShadow: isDarkMode ? '0 30px 70px rgba(2,6,23,0.75)' : '0 12px 28px rgba(13,28,61,0.12)',
        fontFamily: '\'Space Grotesk\', \'DM Sans\', \'Segoe UI\', sans-serif',
        minHeight: 0,
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="overline" sx={{ letterSpacing: 4, color: mutedTextColor }}>
            Deal Canvas
          </Typography>
          <Typography variant="h5" sx={{ color: headingColor, fontWeight: 600 }}>
            Shared board for campaign narratives
          </Typography>
          <Typography variant="body2" sx={{ color: mutedTextColor, mt: 0.5 }}>
            Shared across InfoSource users. Autosaves with optimistic locking.
          </Typography>
          {!!saveMessage && (
            <Typography variant="caption" sx={{ mt: 0.75, color: saveState === 'error' || saveState === 'conflict' ? theme.palette.error.main : mutedTextColor }}>
              {saveMessage}
            </Typography>
          )}
          {!saveMessage && (
            <Typography variant="caption" sx={{ mt: 0.75, color: mutedTextColor }}>
              {saveState === 'saving' ? 'Saving...' : 'Ready'}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => handleAddCard('next-best')}
            sx={{
              borderColor: theme.palette.primary.main,
              color: theme.palette.text.primary,
              textTransform: 'none',
              borderRadius: '999px'
            }}
          >
            Add next-step card
          </Button>
          <IconButton size="small" onClick={onContainerToggle} sx={{ color: theme.palette.text.primary }}>
            {isCollapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
          </IconButton>
        </Box>
      </Box>

      {!isCollapsed && (
        <Box sx={{ mt: 3, flex: 1, minHeight: 0, overflowY: 'auto', pr: 0.5 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 2.5 }}>
            {lanes.map((lane) => (
              <Box
                key={lane.id}
                sx={{
                  backgroundColor: isDarkMode ? 'rgba(15,23,42,0.65)' : 'rgba(13,28,61,0.04)',
                  borderRadius: '20px',
                  padding: 2,
                  border: `1px solid ${panelInnerBorderColor}`
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <PushPinIcon sx={{ color: lane.accent }} />
                  <Typography variant="subtitle1" sx={{ color: headingColor, fontWeight: 600 }}>{lane.title}</Typography>
                </Box>
                <Typography variant="body2" sx={{ color: mutedTextColor, mb: 1.5 }}>
                  {lane.description}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {lane.cards.map((card) => (
                    <Box
                      key={card.id}
                      sx={{
                        backgroundColor: isDarkMode ? 'rgba(15,23,42,0.85)' : theme.palette.background.default,
                        borderRadius: '16px',
                        padding: 1.5,
                        border: `1px solid ${panelInnerBorderColor}`,
                        position: 'relative'
                      }}
                      onClick={(event) => {
                        if (event.target.tagName !== 'BUTTON' && event.target.tagName !== 'svg') {
                          // Trigger edit only if the click is not on the delete icon
                          console.log(`Card clicked for editing: ${card.id}`);
                        }
                      }}
                    >
                      <IconButton
                        size="small"
                        onClick={(event) => {
                          event.stopPropagation(); // Prevent event from propagating to the card container
                          console.log(`Delete icon clicked for card ID: ${card.id}`);
                          handleDeleteCard(lane.id, card.id);
                        }}
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          color: 'red', // Set the color to red for the 'X'
                          zIndex: 1, // Ensure the button is above other elements
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: isDarkMode ? 'rgba(255,0,0,0.2)' : 'rgba(255,0,0,0.1)'
                          }
                        }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                      <TextField
                        variant="standard"
                        value={card.title}
                        onChange={(e) => handleEditCard(lane.id, card.id, { title: e.target.value })}
                        InputProps={{
                          disableUnderline: true,
                          style: { fontWeight: 600, color: headingColor, fontSize: '1rem' }
                        }}
                        sx={{ mb: 1, width: '90%' }}
                      />
                      <TextField
                        variant="standard"
                        fullWidth
                        multiline
                        value={card.body}
                        onChange={(e) => handleEditCard(lane.id, card.id, { body: e.target.value })}
                        InputProps={{
                          disableUnderline: true,
                          style: { color: theme.palette.text.primary, fontSize: '0.875rem' }
                        }}
                        sx={{ mt: 0.75 }}
                      />
                    </Box>
                  ))}
                </Box>
                <Button
                  size="small"
                  startIcon={<AddIcon fontSize="inherit" />}
                  onClick={() => handleAddCard(lane.id)}
                  sx={{ textTransform: 'none', mt: 1.5, color: theme.palette.primary.main }}
                >
                  Add insight
                </Button>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default DealCanvasPanel;
