import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Typography, Checkbox, IconButton, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from '@mui/material';
import AddToSourcesFooter from './AddToSourcesFooter';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useSavedNotes, useSavedNotesDispatch } from '@/reducers/SavedNoteContext';
import { useSourcesDispatch } from '@/reducers/SourceContext';
import { useSmartNote } from '@/reducers/improved/SmartNoteContext';
import { getSavedNotes, deleteSavedNote, updateSavedNote, deleteNoteFromSource } from '@clientServices/savedNoteService';
import { getSourceBySourceId, deleteSource } from '@clientServices/sourceService';
import { useParams } from 'next/navigation';

const NoteList = ({ onSaveNotesToSources }) => {
  const smartNote = useSmartNote();
  const { savedNotes } = useSavedNotes();
  const savedNotesDispatch = useSavedNotesDispatch();
  const sourcesDispatch = useSourcesDispatch();
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);
  const [hoveredNote, setHoveredNote] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState('');
  const [newName, setNewName] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editNote, setEditNote] = useState({ noteTitle: '', noteContent: '' });
  const [localNotes, setLocalNotes] = useState([]); // Add local state backup
  const { teamName, assistantName } = useParams();

  // Update local notes when context changes
  useEffect(() => {
    if (savedNotes && savedNotes.length > 0) {
      setLocalNotes(savedNotes);
    }
  }, [savedNotes]);

  // Use local notes as fallback
  const displayNotes = savedNotes && savedNotes.length > 0 ? savedNotes : localNotes;

  useEffect(() => {
    let cancelled = false;
    
    const fetchData = async () => {
      // Only fetch if we have the required parameters
      if (!teamName || !assistantName || !smartNote?.id) {
        return;
      }

      // Only fetch if we don't have any saved notes yet
      if (displayNotes && displayNotes.length > 0) {
        return; // Skip fetching, we already have data
      }

      try {
        const foundSavedNotes = await getSavedNotes(teamName, assistantName, smartNote);
        
        if (!cancelled && foundSavedNotes) {
          savedNotesDispatch({ type: 'SET_SAVED_NOTES', savedNotes: foundSavedNotes });
          setLocalNotes(foundSavedNotes); 
        }
      } catch (error) {
        console.error('Error fetching saved notes:', error);
      }
    };
    
    fetchData();
    
    return () => {
      cancelled = true;
    };
  }, [teamName, assistantName, smartNote?.id]);

  const handleCheckboxChange = (savedNote) => {
    const updatedSavedNote = { ...savedNote, selected: !savedNote.selected };
    savedNotesDispatch({ type: 'UPDATE_SAVED_NOTE', savedNote: updatedSavedNote });
    
    setLocalNotes(prevNotes => 
      prevNotes.map(note => 
        note.id === updatedSavedNote.id ? updatedSavedNote : note
      )
    );
  };

  const handleMouseEnter = (savedNoteId) => {
    setHoveredNote(savedNoteId);
  };

  const handleMenuOpen = (event, savedNote) => {
    event.stopPropagation(); // Prevent event propagation
    setAnchorEl(event.currentTarget);
    setSelectedNote(savedNote);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleMenuAbandon = () => {
    setAnchorEl(null);
    setSelectedNote(null);
  };

  const handleDeleteClick = () => {
    setDialogType('Delete');
    setDialogOpen(true);
    handleMenuClose();
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setDialogType('');
    setNewName('');
    setSelectedNote(null);
  };

  const handleRename = () => {
    const updatedSavedNote = { ...selectedNote, name: newName };
    savedNotesDispatch({ type: 'UPDATE_SAVED_NOTE', savedNote: updatedSavedNote });
    handleDialogClose();
  };

  const handleDelete = async () => {
    const relatedSource = await getSourceBySourceId(teamName, assistantName, smartNote, selectedNote.id);
    if (relatedSource) {
      deleteSource(teamName, assistantName, relatedSource);
      deleteNoteFromSource(teamName, assistantName, selectedNote);
      sourcesDispatch({ type: 'DELETE_SOURCE', id: relatedSource.id });
    }
    await deleteSavedNote(teamName, assistantName, selectedNote);
    savedNotesDispatch({ type: 'DELETE_SAVED_NOTE', id: selectedNote.id });
    
    setLocalNotes(prevNotes => 
      prevNotes.filter(note => note.id !== selectedNote.id)
    );
    
    handleDialogClose();
  };

  const handleListItemClick = (savedNote) => {
    setEditNote(savedNote);
    setEditDialogOpen(true);
  };

  const handleEditDialogClose = () => {
    setEditDialogOpen(false);
    setSelectedNote(null);
  };

  const handleEditSave = async () => {
    const updatedSavedNote = { ...editNote, title: editNote.noteTitle, content: editNote.noteContent };
    await updateSavedNote(teamName, assistantName, updatedSavedNote);
    savedNotesDispatch({ type: 'UPDATE_SAVED_NOTE', savedNote: updatedSavedNote });
    
    setLocalNotes(prevNotes => 
      prevNotes.map(note => 
        note.id === updatedSavedNote.id ? updatedSavedNote : note
      )
    );
    
    setEditDialogOpen(false);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditNote(prevNote => ({
      ...prevNote,
      [name]: value,
    }));
  };

  return (
    <Box>
      <Box sx={{ flexGrow: 1, overflowY: 'auto', padding: 0 }}>
        {displayNotes && displayNotes.length > 0 && (
          displayNotes.map((savedNote) => (
          <Box
            key={savedNote.id}
            onMouseEnter={() => handleMouseEnter(savedNote.id)}
            onMouseLeave={() => setHoveredNote(null)}
            sx={{ display: 'flex', flexGrow: 0, justifyContent: 'space-between', alignItems: 'center', padding: 0, cursor: 'pointer' }}
          >
            <Box
              sx={{ display: 'flex', flexGrow: 0, overflow: 'hidden', alignItems: 'center' }}
              onClick={() => handleListItemClick(savedNote)}>
              <Box sx={{ display: 'flex', flexGrow: 0, overflow: 'hidden', alignItems: 'center' }}>
                <IconButton
                  onClick={(event) => handleMenuOpen(event, savedNote)}
                  onMouseDown={(event) => event.stopPropagation()}
                  sx={{
                    transition: 'opacity 0.3s',
                  }}
                >
                  {hoveredNote === savedNote.id ? (
                    <MoreVertIcon sx={{ fontSize: '24px' }} />
                  ) : (
                    <DescriptionOutlinedIcon sx={{ fontSize: '24px' }} />
                  )}
                </IconButton>
                <Typography sx={{
                  cursor: 'pointer',
                  ml: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>{savedNote.noteTitle}</Typography>
              </Box>
            </Box>
            <Checkbox
              onChange={() => handleCheckboxChange(savedNote)}
              checked={!!savedNote.selected}
            />
          </Box>
        ))
        )}
      </Box>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuAbandon}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={handleDeleteClick}>Delete</MenuItem>
      </Menu>
      <Dialog open={dialogOpen} onClose={handleDialogClose}>
        <DialogTitle>{dialogType === 'Edit' ? 'Edit Note' : 'Delete Note'}</DialogTitle>
        <DialogContent>
          {dialogType === 'Edit' ? (
            <TextField
              autoFocus
              margin="dense"
              label="New Name"
              type="text"
              fullWidth
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          ) : (
            <Typography>Are you sure you want to delete this note?</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} variant="secondary">Cancel</Button>
          {dialogType === 'Edit' ? (
            <Button onClick={handleRename} variant="primary">Edit</Button>
          ) : (
            <Button onClick={handleDelete} variant="destructive">Delete</Button>
          )}
        </DialogActions>
      </Dialog>
      <Dialog
        maxWidth="md"
        fullWidth
        open={editDialogOpen}
        onClose={handleEditDialogClose}
        sx={{
          '& .MuiPaper-root': {
            borderRadius: '20px', // More rounded border
          },
        }}>
        <DialogTitle>Edit Note</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            name="noteTitle"
            label="Title"
            type="text"
            fullWidth
            variant="outlined"
            value={editNote.noteTitle}
            onChange={handleEditChange}
          />
          <TextField
            margin="dense"
            name="noteContent"
            label="Content"
            type="text"
            fullWidth
            variant="outlined"
            multiline
            rows={4}
            value={editNote.noteContent}
            onChange={handleEditChange}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditDialogClose} variant="secondary">Cancel</Button>
          <Button onClick={handleEditSave} variant="primary">Save</Button>
        </DialogActions>
      </Dialog>
      <AddToSourcesFooter saveToSources={() => onSaveNotesToSources(displayNotes)} />
    </Box>
  );
};

NoteList.propTypes = {
  onSaveNotesToSources: PropTypes.func.isRequired,
};

export default NoteList;
