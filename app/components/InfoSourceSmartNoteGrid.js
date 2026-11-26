'use client';

import React, { useMemo, useState } from 'react';
import {
  Box,
  Grid2,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Button,
  Divider
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PropTypes from 'prop-types';
import { smartNoteStatus } from '@/utils/constants';
import Link from 'next/link';

const InfoSourceSmartNoteGrid = ({
  smartNotes,
  sortOrder,
  handleCardClick,
  handleDelete,
  handleEditTitle,
  handleEditSubtitle,
  handleArchive,
  handleRestore,
  isArchivedView,
  isDeleteSmartNoteEnabled
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedSmartNote, setSelectedSmartNote] = useState(null);
  const [isEditTitleDialogOpen, setIsEditTitleDialogOpen] = useState(false);
  const [isEditSubtitleDialogOpen, setIsEditSubtitleDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');

  const formatSubtitleForCard = (value = '', maxCharsPerLine = 70) => {
    const subtitle = String(value || '').trim();
    if (!subtitle) {
      return 'No subtitle';
    }

    const words = subtitle.split(/\s+/);
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (candidate.length <= maxCharsPerLine) {
        currentLine = candidate;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.join('\n');
  };

  const orderedSmartNotes = useMemo(() => {
    if (sortOrder === 'updatedAt') {
      return [...smartNotes].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }
    if (sortOrder === 'title') {
      return [...smartNotes].sort((a, b) => a.title.localeCompare(b.title));
    }
    return smartNotes;
  }, [smartNotes, sortOrder]);

  const handleMenuOpen = (event, smartNote) => {
    event.stopPropagation();
    setAnchorEl({ [smartNote.id]: event.currentTarget });
    setSelectedSmartNote(smartNote);
  };

  const handleMenuClose = (clearSelected) => {
    setAnchorEl(null);
    if (clearSelected) {
      setSelectedSmartNote(null);
    }
  };

  const handleEditTitleClick = (event, smartNote) => {
    event.stopPropagation();
    setSelectedSmartNote(smartNote);
    setNewTitle(smartNote.title || '');
    setIsEditTitleDialogOpen(true);
    handleMenuClose(false);
  };

  const handleEditSubtitleClick = (event, smartNote) => {
    event.stopPropagation();
    setSelectedSmartNote(smartNote);
    setNewSubtitle(smartNote.subtitle || '');
    setIsEditSubtitleDialogOpen(true);
    handleMenuClose(false);
  };

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
    handleMenuClose(false);
  };

  const handleConfirmDelete = () => {
    handleDelete(selectedSmartNote);
    setIsDeleteDialogOpen(false);
    setSelectedSmartNote(null);
  };

  const handleCancelDelete = () => {
    setIsDeleteDialogOpen(false);
    setSelectedSmartNote(null);
  };

  const handleEditTitleDialogClose = () => {
    setIsEditTitleDialogOpen(false);
    setSelectedSmartNote(null);
  };

  const handleEditSubtitleDialogClose = () => {
    setIsEditSubtitleDialogOpen(false);
    setSelectedSmartNote(null);
  };

  const handleEditTitleDialogSave = () => {
    handleEditTitle(selectedSmartNote, newTitle);
    setIsEditTitleDialogOpen(false);
    setSelectedSmartNote(null);
  };

  const handleEditSubtitleDialogSave = () => {
    handleEditSubtitle(selectedSmartNote, newSubtitle);
    setIsEditSubtitleDialogOpen(false);
    setSelectedSmartNote(null);
  };

  return (
    <Grid2 container spacing={2} alignItems="stretch">
      {orderedSmartNotes.map((smartNote) => (
        <Grid2 key={smartNote.id} sx={{ display: 'flex' }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              border: '1px solid',
              borderColor: 'color.dolphin',
              padding: 2,
              borderRadius: 4,
              backgroundColor: 'card.body.main',
              position: 'relative',
              minHeight: '220px',
              width: 'min(100%, 380px)',
              maxWidth: '380px'
            }}
          >
            <IconButton
              sx={{ position: 'absolute', top: 8, right: 2 }}
              onClick={(event) => {
                event.stopPropagation();
                handleMenuOpen(event, smartNote);
              }}
            >
              <MoreVertIcon />
            </IconButton>

            <Menu
              anchorEl={anchorEl && anchorEl[smartNote.id]}
              open={Boolean(anchorEl && anchorEl[smartNote.id])}
              onClose={() => handleMenuClose(true)}
            >
              <MenuItem onClick={(event) => handleEditTitleClick(event, smartNote)}>Edit Title</MenuItem>
              <MenuItem onClick={(event) => handleEditSubtitleClick(event, smartNote)}>Edit Subtitle</MenuItem>
              {isArchivedView ? (
                <MenuItem onClick={() => { handleRestore(selectedSmartNote); handleMenuClose(true); }}>Restore</MenuItem>
              ) : (
                <MenuItem disabled={selectedSmartNote?.status === smartNoteStatus.Cloning} onClick={() => { handleArchive(selectedSmartNote); handleMenuClose(true); }}>Archive</MenuItem>
              )}
              {isDeleteSmartNoteEnabled && (
                <MenuItem disabled={selectedSmartNote?.status === smartNoteStatus.Cloning} onClick={handleDeleteClick}>Delete</MenuItem>
              )}
            </Menu>

            <Typography variant="h6" sx={{ paddingRight: 4 }}>{smartNote.title}</Typography>
            <Typography
              sx={{
                mt: 1,
                maxWidth: '100%',
                whiteSpace: 'pre-line',
                overflowWrap: 'anywhere',
                wordBreak: 'break-word'
              }}
              variant="body1"
            >
              {formatSubtitleForCard(smartNote.subtitle)}
            </Typography>
            <Typography sx={{ mt: 1 }} variant="body1">Created: {smartNote.createdAt ? new Date(smartNote.createdAt).toLocaleString() : '-'}</Typography>
            <Typography variant="body1">Updated: {smartNote.updatedAt ? new Date(smartNote.updatedAt).toLocaleString() : '-'}</Typography>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 'auto', pt: 2 }}>
              {isArchivedView ? (
                <Button onClick={() => handleRestore(smartNote)} variant="action">
                  Restore
                </Button>
              ) : (
                <Link href={`/${smartNote.teamName}/${smartNote.assistantName}/smartNote/${smartNote.id}`} style={{ textDecoration: 'none' }}>
                  <Button
                    disabled={smartNote.disabled || smartNote.status === smartNoteStatus.Cloning}
                    onClick={() => handleCardClick(smartNote)}
                    variant="action"
                  >
                    {smartNote.status && smartNote.status === smartNoteStatus.Cloning ? 'Cloning...' : 'Edit smartnote'}
                  </Button>
                </Link>
              )}
            </Box>
          </Box>
        </Grid2>
      ))}

      <Dialog open={isEditTitleDialogOpen} onClose={handleEditTitleDialogClose}>
        <DialogTitle>Edit Title</DialogTitle>
        <Divider />
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Title"
            type="text"
            fullWidth
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditTitleDialogClose} variant="secondary">Cancel</Button>
          <Button onClick={handleEditTitleDialogSave} variant="primary">Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isEditSubtitleDialogOpen} onClose={handleEditSubtitleDialogClose} fullWidth maxWidth="sm">
        <DialogTitle>Edit Subtitle</DialogTitle>
        <Divider />
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Subtitle"
            type="text"
            fullWidth
            multiline
            minRows={4}
            maxRows={10}
            value={newSubtitle}
            onChange={(e) => setNewSubtitle(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditSubtitleDialogClose} variant="secondary">Cancel</Button>
          <Button onClick={handleEditSubtitleDialogSave} variant="primary">Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <Divider />
        <DialogContent>
          {selectedSmartNote?.templateId ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'red' }}>STOP!</Typography>
              <Typography>
                This smart note is being shared as a template. If you delete this smart note, you will also delete the template.
              </Typography>
              <Typography>Are you sure you want to delete both?</Typography>
            </Box>
          ) : (
            <Typography>Are you sure you want to delete this smart note?</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} variant="secondary">Cancel</Button>
          <Button onClick={handleConfirmDelete} variant="destructive">Delete</Button>
        </DialogActions>
      </Dialog>
    </Grid2>
  );
};

InfoSourceSmartNoteGrid.propTypes = {
  smartNotes: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      subtitle: PropTypes.string,
      parentId: PropTypes.string
    })
  ).isRequired,
  sortOrder: PropTypes.string.isRequired,
  handleCardClick: PropTypes.func.isRequired,
  handleDelete: PropTypes.func.isRequired,
  handleEditTitle: PropTypes.func.isRequired,
  handleEditSubtitle: PropTypes.func.isRequired,
  handleArchive: PropTypes.func.isRequired,
  handleRestore: PropTypes.func.isRequired,
  isArchivedView: PropTypes.bool,
  isDeleteSmartNoteEnabled: PropTypes.bool
};

export default InfoSourceSmartNoteGrid;
