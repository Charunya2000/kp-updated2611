'use client';

import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import InsightsIcon from '@mui/icons-material/Insights';
import MapIcon from '@mui/icons-material/Map';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import GroupsIcon from '@mui/icons-material/Groups';
import PropTypes from 'prop-types';
import { useSmartNote } from '@reducers/improved/SmartNoteContext';
import { useUserAssistants } from '@/reducers/UserAssistantContext';
import { useSources } from '@reducers/SourceContext';

const StatPill = ({ label, value, icon, isDarkMode, headingColor, mutedTextColor }) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 1,
      paddingX: 1.25,
      paddingY: 0.9,
      borderRadius: '14px',
      border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(13,28,61,0.16)'}`,
      backgroundColor: isDarkMode ? 'rgba(8,17,40,0.65)' : 'rgba(13,28,61,0.04)',
      minHeight: 'unset'
    }}
  >
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: mutedTextColor, minWidth: 0 }}>
      {icon}
      <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.7, lineHeight: 1.2 }}>
        {label}
      </Typography>
    </Stack>
    <Typography
      variant="subtitle1"
      sx={{
        color: headingColor,
        fontFamily: "'Space Grotesk', 'DM Sans', 'Segoe UI', sans-serif",
        fontWeight: 600,
        ml: 'auto',
        whiteSpace: 'nowrap'
      }}
    >
      {value}
    </Typography>
  </Box>
);

StatPill.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  icon: PropTypes.node,
  isDarkMode: PropTypes.bool,
  headingColor: PropTypes.string,
  mutedTextColor: PropTypes.string
};

const formatDisplayDate = (value) => {
  if (!value) {
    return 'Not captured yet';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Not captured yet';
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const InfoSourceHero = ({ onOpenContextPanel }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const headingColor = theme.palette.text?.heading || theme.palette.text.primary;
  const mutedTextColor = theme.palette.text?.muted || (isDarkMode ? 'rgba(226,232,240,0.85)' : 'rgba(13,28,61,0.72)');

  const smartNote = useSmartNote();
  const { selectedUserAssistant } = useUserAssistants();
  const { sources } = useSources();

  const personaLabel = smartNote?.persona ? smartNote.persona : 'No persona selected';
  const selectedSources = Array.isArray(sources) ? sources.filter((source) => source.selected).length : 0;
  const updatedTimestamp = smartNote?.updatedAt || smartNote?.createdAt || null;

  return (
    <Box
      sx={{
        background: isDarkMode
          ? 'radial-gradient(circle at 15% 20%, #1c2c52 0%, #0a1429 40%, #020813 100%)'
          : theme.palette.background.paper,
        borderRadius: '24px',
        paddingX: { xs: 2, md: 3 },
        paddingY: { xs: 2, md: 2.5 },
        color: theme.palette.text.primary,
        border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(13,28,61,0.15)'}`,
        boxShadow: isDarkMode ? '0 45px 120px rgba(2,6,23,0.65)' : '0 16px 36px rgba(13,28,61,0.12)',
        fontFamily: '\'Space Grotesk\', \'DM Sans\', \'Segoe UI\', sans-serif'
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.75} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
        <Box sx={{ maxWidth: '720px' }}>
          <Typography variant="overline" sx={{ letterSpacing: 2.5, color: mutedTextColor }}>
            {selectedUserAssistant?.displayName || 'InfoSource Briefing Room'}
          </Typography>
          <Typography variant="h4" sx={{ color: headingColor, fontWeight: 600, mt: 0.4, lineHeight: 1.2 }}>
            Market-ready insights with audit-ready citations
          </Typography>
          <Typography variant="body2" sx={{ color: mutedTextColor, mt: 0.75, lineHeight: 1.45 }}>
            Blend competitive intelligence, deal signals, and structured citations pulled directly from InfoSource indexes.
            Every response is designed to be compliance friendly and seller ready.
          </Typography>
        </Box>
        <Stack spacing={1} direction={{ xs: 'column', sm: 'row' }} sx={{ width: { xs: '100%', md: 'auto' } }}>
          <Button
            variant="contained"
            color="secondary"
            onClick={onOpenContextPanel}
            size="small"
            sx={{
              textTransform: 'none',
              borderRadius: '999px',
              paddingX: 2,
              fontSize: '0.85rem',
              backgroundColor: theme.palette.secondary.main,
              color: theme.palette.secondary.contrastText || theme.palette.text.reverse,
              '&:hover': { backgroundColor: theme.palette.secondary.light }
            }}
          >
            Manage Context & Sources
          </Button>
          <Button
            component="a"
            href="#info-source-deal-canvas"
            size="small"
            sx={{
              textTransform: 'none',
              borderRadius: '999px',
              paddingX: 2,
              fontSize: '0.85rem',
              color: theme.palette.text.primary,
              border: `1px solid ${isDarkMode ? 'rgba(226,232,240,0.45)' : 'rgba(13,28,61,0.25)'}`
            }}
          >
            Jump to Deal Canvas
          </Button>
        </Stack>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 1, mt: 1.5 }}>
        <StatPill
          label="Active Persona"
          value={personaLabel}
          icon={<GroupsIcon fontSize="small" />}
          isDarkMode={isDarkMode}
          headingColor={headingColor}
          mutedTextColor={mutedTextColor}
        />
        <StatPill
          label="Selected Context Sources"
          value={`${selectedSources} linked`}
          icon={<InsightsIcon fontSize="small" />}
          isDarkMode={isDarkMode}
          headingColor={headingColor}
          mutedTextColor={mutedTextColor}
        />
        <StatPill
          label="Last Activity"
          value={formatDisplayDate(updatedTimestamp)}
          icon={<CalendarMonthIcon fontSize="small" />}
          isDarkMode={isDarkMode}
          headingColor={headingColor}
          mutedTextColor={mutedTextColor}
        />
      </Box>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.75} mt={1.25} flexWrap="wrap">
        <Chip
          icon={<MapIcon sx={{ color: theme.palette.text.primary }} />}
          label="Multi-market briefings enabled"
          size="small"
          sx={{
            backgroundColor: isDarkMode ? 'rgba(248,250,252,0.12)' : 'rgba(13,28,61,0.08)',
            color: theme.palette.text.primary
          }}
        />
        <Chip
          icon={<InsightsIcon sx={{ color: theme.palette.text.primary }} />}
          label="RAG responses restricted to InfoSource indexes"
          size="small"
          sx={{
            backgroundColor: isDarkMode ? 'rgba(248,250,252,0.12)' : 'rgba(13,28,61,0.08)',
            color: theme.palette.text.primary
          }}
        />
      </Stack>
    </Box>
  );
};

InfoSourceHero.propTypes = {
  onOpenContextPanel: PropTypes.func
};

export default InfoSourceHero;
