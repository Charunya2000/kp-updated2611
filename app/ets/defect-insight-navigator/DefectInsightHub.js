'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Container,
  Divider,
  MenuItem,
  Select,
  Skeleton,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Grid2,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import { v4 } from 'uuid';
import SmartNoteGrid from '@/app/components/SmartNoteGrid';
import {
  createSmartNoteWithId,
  deleteSmartNote,
  getSmartNotes,
  updateSmartNote,
} from '@/app/clientServices/smartNoteService';
import { patchSmartNoteTitle } from '@/app/clientServices/smartNotesService';

const TEAM = 'ets';
const ASSISTANT = 'defect-insight-navigator';

export default function DefectInsightHub() {
  const router = useRouter();
  const isSmartNoteCreated = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isNewButtonDisabled, setIsNewButtonDisabled] = useState(false);
  const [sortOrder, setSortOrder] = useState('updatedAt');
  const [activeTab, setActiveTab] = useState('active');
  const [smartNotes, setSmartNotes] = useState([]);

  const filteredSmartNotes = useMemo(() => {
    if (activeTab === 'archived') return smartNotes.filter((n) => n.isArchived === true);
    return smartNotes.filter((n) => !n.isArchived);
  }, [smartNotes, activeTab]);

  const fetchSmartNotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const notes = await getSmartNotes(TEAM, ASSISTANT);
      setSmartNotes(Array.isArray(notes) ? notes : []);
    } catch (err) {
      console.error('Error fetching smart notes:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSmartNotes();
  }, [fetchSmartNotes]);

  const handleCreateSmartNote = async () => {
    setIsNewButtonDisabled(true);
    try {
      const newId = v4();
      const created = await createSmartNoteWithId(TEAM, ASSISTANT, newId, 'Untitled Smart Note');
      isSmartNoteCreated.current = true;
      router.push(`/${TEAM}/${ASSISTANT}/smartNote/${created?.id || newId}`);
    } catch (error) {
      console.error('Error creating smart note:', error);
    } finally {
      setIsNewButtonDisabled(false);
    }
  };

  const handleCardClick = () => {};

  const handleDelete = async (smartNote) => {
    setSmartNotes((prev) => prev.filter((n) => n.id !== smartNote.id));
    await deleteSmartNote(TEAM, ASSISTANT, smartNote.id);
  };

  const handleEditTitle = async (smartNote, newTitle) => {
    const updates = await patchSmartNoteTitle(TEAM, ASSISTANT, smartNote, newTitle);
    setSmartNotes((prev) => prev.map((n) => (n.id === smartNote.id ? { ...n, ...updates } : n)));
  };

  const handleArchive = async (smartNote) => {
    const updates = await updateSmartNote(TEAM, ASSISTANT, smartNote.id, { isArchived: true });
    setSmartNotes((prev) => prev.map((n) => (n.id === smartNote.id ? { ...n, ...updates, isArchived: true } : n)));
  };

  const handleRestore = async (smartNote) => {
    const updates = await updateSmartNote(TEAM, ASSISTANT, smartNote.id, { isArchived: false });
    setSmartNotes((prev) => prev.map((n) => (n.id === smartNote.id ? { ...n, ...updates, isArchived: false } : n)));
  };

  return (
    <Container maxWidth={false} sx={{ marginLeft: '0%', height: '100%', overflowY: 'auto' }} disableGutters>
      <Box sx={{ width: '80%', marginX: '10%', height: '100%', display: 'flex', flexDirection: 'column' }}>

        <Box display='flex' flexDirection='row' width='100%'>
          <Typography fontWeight={500} fontSize='48pt' color='text.heading'>
            Defect Insight Navigator
          </Typography>
        </Box>
        <Box display='flex' flexDirection='row' maxWidth='100%' marginBottom='1em'>
          <Typography fontWeight={400} fontSize='14pt'>
            Create a smart note, then open it to run RCA or Analytics on your defects.
          </Typography>
        </Box>

        <Divider style={{ marginBottom: '1em' }} />

        {isLoading ? (
          <Box sx={{ mt: 4, height: '100%', display: 'flex', flexDirection: 'column', gap: 2, pb: 4 }}>
            <Skeleton variant='rounded' sx={{ width: '100%', height: '56px' }} />
            <Skeleton variant='rounded' sx={{ width: '100%', flexGrow: 1 }} />
            <Skeleton variant='rounded' sx={{ width: '100%', flexGrow: 1 }} />
          </Box>
        ) : (
          <>
            <Box sx={{ width: '100%', padding: 2 }}>
              <Grid2 container alignItems='center' justifyContent='space-between'>
                <Grid2>
                  <Button
                    disabled={isNewButtonDisabled}
                    variant='primary'
                    startIcon={<AddOutlinedIcon />}
                    onClick={handleCreateSmartNote}
                  >
                    Create new
                  </Button>
                </Grid2>
                <Grid2>
                  <Box display='flex' justifyContent='flex-end' alignItems='center' sx={{ width: '100%' }}>
                    <ToggleButtonGroup
                      value={activeTab}
                      exclusive
                      onChange={(_, v) => { if (v !== null) setActiveTab(v); }}
                      size='large'
                      sx={{
                        marginRight: 2,
                        height: '56px',
                        '& .MuiToggleButton-root': {
                          height: '56px',
                          border: '1px solid',
                          borderColor: 'toggleBtn.border.main',
                          '&:hover': { borderColor: 'toggleBtn.border.hover' },
                          '&.Mui-selected': { borderColor: 'toggleBtn.border.selected' },
                          '&.Mui-selected + .MuiToggleButton-root': { borderLeftColor: 'toggleBtn.border.selected' },
                        },
                      }}
                    >
                      <ToggleButton value='active' sx={{ borderRadius: '12px 0px 0px 12px' }}>Active</ToggleButton>
                      <ToggleButton value='archived' sx={{ borderRadius: '0px 12px 12px 0px' }}>Archived</ToggleButton>
                    </ToggleButtonGroup>
                    <Select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value)}
                      displayEmpty
                      size='medium'
                      inputProps={{ 'aria-label': 'Sort order' }}
                    >
                      <MenuItem value='updatedAt'>Most recent</MenuItem>
                      <MenuItem value='title'>Title</MenuItem>
                    </Select>
                  </Box>
                </Grid2>
              </Grid2>
            </Box>

            <Box sx={{ width: '100%', padding: 2, display: 'flex', flexGrow: 1, overflow: 'auto' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'auto', height: '100%', width: '100%' }}>
                {filteredSmartNotes.length > 0 ? (
                  <>
                    <Typography variant='h5' sx={{ marginBottom: '1em' }}>
                      {activeTab === 'archived' ? 'Archived Smart Notes' : 'My Smart Notes'}
                    </Typography>
                    <SmartNoteGrid
                      smartNotes={filteredSmartNotes}
                      sortOrder={sortOrder}
                      handleCardClick={handleCardClick}
                      handleDelete={handleDelete}
                      handleEditTitle={handleEditTitle}
                      handleArchive={handleArchive}
                      handleRestore={handleRestore}
                      isArchivedView={activeTab === 'archived'}
                      isDeleteSmartNoteEnabled
                    />
                  </>
                ) : (
                  <Box sx={{ py: 8, textAlign: 'center' }}>
                    <Typography variant='h6' fontWeight={700}>No smart notes yet</Typography>
                    <Typography variant='body2' color='text.secondary' sx={{ mt: 0.75 }}>
                      Create the first defect insight note to start a session.
                    </Typography>
                    <Button
                      variant='primary'
                      startIcon={<AddOutlinedIcon />}
                      onClick={handleCreateSmartNote}
                      sx={{ mt: 2 }}
                      disabled={isNewButtonDisabled}
                    >
                      Create new
                    </Button>
                  </Box>
                )}
              </Box>
            </Box>
          </>
        )}
      </Box>
    </Container>
  );
}
