'use client';

import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Tooltip,
  Link
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ReactMarkdown from 'react-markdown';
import { getAllAssistants } from '@/app/clientServices/assistantService';
import { getAssistantNews, saveAssistantNews } from '@/app/clientServices/newsService';
import useSnackbar from '@/app/hooks/useSnackbar';

const NewsManagement = ({ teamName, allowedAssistants }) => {
  const theme = useTheme();
  const { SnackbarComponent, showSnackbar } = useSnackbar({ duration: 4000 });

  const [assistants, setAssistants] = useState([]);
  const [selectedAssistant, setSelectedAssistant] = useState('');
  const [news, setNews] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchAssistants() {
      try {
        const response = await getAllAssistants(teamName);
        const filtered = Array.isArray(response)
          ? response.filter(a => (!allowedAssistants || allowedAssistants.includes(a.name)) && !a.isHiddenFromSettings)
          : [];
        const sorted = filtered.slice().sort((a, b) => a.displayName.localeCompare(b.displayName));
        setAssistants(sorted);
        setSelectedAssistant(sorted[0]?.name || '');
      } catch (error) {
        setAssistants([]);
        setSelectedAssistant('');
      }
    }
    fetchAssistants();
  }, [teamName, allowedAssistants]);

  useEffect(() => {
    async function fetchNews() {
      if (!selectedAssistant) return;
      try {
        const current = await getAssistantNews(teamName, selectedAssistant);
        setNews(current?.news || '');
        setUpdatedAt(current?.updatedAt || null);
      } catch (error) {
        setNews('');
        setUpdatedAt(null);
      }
    }
    fetchNews();
  }, [teamName, selectedAssistant]);

  const handleAssistantChange = (assistantName) => {
    setSelectedAssistant(assistantName);
  };

  const handleClear = () => {
    setNews('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveAssistantNews(teamName, selectedAssistant, news);
      setUpdatedAt(saved?.updatedAt || new Date());
      showSnackbar('News saved successfully', 'success');
    } catch (error) {
      showSnackbar('An error occurred, please try again', 'error');
    } finally {
      setSaving(false);
    }
  };

  const selectedAssistantDisplayName = assistants.find(a => a.name === selectedAssistant)?.displayName || '';

  return (
    <Box
      sx={{
        pt: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <Box sx={{
        width: '100%',
        maxWidth: 'none',
        alignSelf: 'stretch',
        mb: 3,
        px: 0.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start'
      }}>
        <FormControl variant="outlined" size="small" sx={{ minWidth: 300 }}>
          <InputLabel sx={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Select Assistant</InputLabel>
          <Select
            value={selectedAssistant || ''}
            onChange={(e) => handleAssistantChange(e.target.value)}
            label="Select Assistant"
            sx={{
              fontSize: '0.95rem',
              height: 40,
              borderRadius: '8px',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.color.graphiteDeep,
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.color.contrastBlue,
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.color.midnight,
              }
            }}
          >
            {assistants.map((assistant) => (
              <MenuItem key={assistant.id} value={assistant.name}>
                {assistant.displayName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <SnackbarComponent />
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          position: 'relative',
        }}
      >
        <Tooltip
          arrow
          placement="top-end"
          title="News & Updates allow you to communicate with the users of your assistant. After you save News & Updates, users will automatically see this message next time they select this assistant from the left navigation."
          slotProps={{
            tooltip: {
              sx: {
                backgroundColor: '#064579',
                border: '1px solid #263238',
                borderRadius: '20px',
                fontSize: '0.875rem',
                fontWeight: 600,
                lineHeight: 1.35,
                maxWidth: 390,
                px: 1.5,
                py: 1,
              },
            },
            arrow: { sx: { color: '#064579' } },
          }}
        >
          <InfoOutlinedIcon
            aria-label="More information about News & Updates"
            sx={{
              position: 'absolute',
              top: -29,
              right: 28,
              fontSize: 22,
              color: 'text.secondary',
              cursor: 'help',
              zIndex: 2,
              '&:hover': {
                color: 'primary.main',
              },
            }}
          />
        </Tooltip>

        <Box
          sx={{
            height: '100%',
            width: 'calc(100% - 24px)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            border: `1px solid ${theme.palette.color.graphiteDeep}`,
            borderRadius: '8px',
            overflow: 'hidden',
            px: 0.5
          }}
        >
          <TextField
            value={news}
            onChange={(e) => setNews(e.target.value)}
            multiline
            fullWidth
            variant="standard"
            placeholder="Enter News & Updates content for this assistant using Markdown formatting..."
            InputProps={{ disableUnderline: true }}
            sx={{
              flex: 1,
              p: 2,
              overflowY: 'auto',
              fontSize: '1rem',
              '& .MuiInputBase-root': {
                alignItems: 'flex-start',
                height: '100%',
              },
              '& .MuiInputBase-input': {
                fontSize: '1rem',
              }
            }}
          />

          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1,
            borderTop: `1px solid ${theme.palette.color.graphiteDeep}`,
          }}>
            <Typography variant="body2" color="text.secondary">
              This text editor supports basic <Link href="https://www.markdownguide.org/cheat-sheet/#basic-syntax" target="_blank">Markdown</Link> formatting
            </Typography>
            {updatedAt && (
              <Typography variant="body2" color="text.secondary">
                Last updated: {new Date(updatedAt).toLocaleString()}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        width: 'calc(100% - 24px)',
        gap: 2,
        mt: 2,
        px: 0.5
      }}>
        <Button
          variant="action"
          onClick={() => setPreviewOpen(true)}
          sx={{ minWidth: 180, height: 40 }}
        >
          Preview
        </Button>
        <Button
          variant="secondary"
          onClick={handleClear}
          sx={{ minWidth: 180, height: 40, ml: 'auto' }}
        >
          Clear
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={saving || !selectedAssistant}
          sx={{
            minWidth: { xs: 188, md: 300 },
            width: { xs: 188, md: 300 },
            height: 40,
            flexShrink: 0,
          }}
        >
          Save News & Updates
        </Button>
      </Box>

      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          News & Updates
          <IconButton onClick={() => setPreviewOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <ReactMarkdown>{news}</ReactMarkdown>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default NewsManagement;
