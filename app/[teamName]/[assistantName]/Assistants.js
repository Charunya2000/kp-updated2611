'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '@/app/contexts/OpenIdAuthContext';
import { useParams, useRouter } from 'next/navigation';
import { Box, Container, Grid2, Typography, Button, Divider, ToggleButton, ToggleButtonGroup, Select, MenuItem, Skeleton, CircularProgress, Tooltip, LinearProgress } from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import SmartNoteGrid from '../../components/SmartNoteGrid';
import InfoSourceSmartNoteGrid from '../../components/InfoSourceSmartNoteGrid';
import { useSmartNotes, useSmartNotesDispatch } from '@reducers/improved/SmartNotesContext';
import { useSmartNoteTemplates, useSmartNoteTemplatesDispatch } from '@reducers/improved/SmartNoteTemplatesContext';
import { patchSmartNoteTitle } from '@/app/clientServices/smartNotesService';
import { useUserAssistants, useUserAssistantsDispatch } from '@/reducers/UserAssistantContext';
import { useLeftNav } from '@reducers/LeftNavContext';
import { cloneSmartNoteTemplate, getSmartNoteTemplates, deleteSmartNoteTemplate, updateSmartNoteTemplate, getBackgroundJob } from '../../clientServices/smartNoteTemplateService';
import { createSmartNoteWithId, deleteSmartNote, getSmartNotes, getSmartNote, updateSmartNote } from '../../clientServices/smartNoteService';
import { getIndexConfigByAssistant } from '@/app/clientServices/aiSearchConfigService';
import { prepDocument } from '@/app/clientServices/insertDocument';
import { createDesignIndex } from '@clientServices/designIndexService';
import { useSmartNoteDispatch } from '@/reducers/improved/SmartNoteContext';
import { useDesignIndexsDispatch } from '@reducers/DesignIndexContext';
import { createSource } from '@clientServices/sourceService';
import { useSourcesDispatch } from '@reducers/SourceContext';
import useSnackbar from '../../hooks/useSnackbar';
import { useLocalStorage } from '@/app/hooks/useLocalStorage';
import SmartNoteTemplateGrid from '../../components/SmartNoteTemplateGrid';
import { InfoOutlined } from '@mui/icons-material';
import { smartNoteStatus } from '@/utils/constants';
import { updateJobStatus } from '@/app/clientServices/backgroundJobService';
import { getAssistantNews } from '@/app/clientServices/newsService';
import AssistantNewsModal from '@/app/components/AssistantNewsModal';
import { v4 } from 'uuid';

export default function Assistants() {
  const smartNoteDispatch = useSmartNoteDispatch();
  const sourcesDispatch = useSourcesDispatch();
  const designIndexsDispatch = useDesignIndexsDispatch();
  const router = useRouter();
  const params = useParams();
  const [sortOrder, setSortOrder] = useState('updatedAt');
  const smartNotes = useSmartNotes();
  const smartNotesDispatch = useSmartNotesDispatch();
  const smartNoteTemplates = useSmartNoteTemplates();
  const smartNoteTemplatesDispatch = useSmartNoteTemplatesDispatch();
  const userAssistantsDispatch = useUserAssistantsDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const isSmartNoteCreated = useRef(false);
  const { user } = useAuth();
  const { selectedUserAssistant, userAssistants, userTeams, selectedTeam } = useUserAssistants();
  const { setIsLeftNavVisible } = useLeftNav();
  const { SnackbarComponent, showSnackbar } = useSnackbar();
  const [isTemplateCloningInProgress, setIsTemplateCloningInProgress] = useState(false);
  const pollingTimeoutRef = useRef(null);
  const [isNewButtonDisabled, setIsNewButtonDisabled] = useState(false);
  const [enabledIndexes, setEnabledIndexes] = useState([]);
  const [smartNoteBeingCloned, setSmartNoteBeingCloned] = useState(null);
  const [backgroundJob, setBackgroundJob] = useState(null);
  const [activeTab, setActiveTab] = useState('active');
  const [assistantNews, setAssistantNews] = useState(null);
  const [isNewsModalOpen, setIsNewsModalOpen] = useState(false);
  const { addLocalStorageItem, getLocalStorageItem } = useLocalStorage();

  const { teamName, assistantName } = params;
  const isInfoSourceAssistant = assistantName === 'info-source-assistant';

  useEffect(() => {
    let isCurrent = true;

    async function loadAssistantNews() {
      if (!teamName || !assistantName) return;

      const news = await getAssistantNews(teamName, assistantName);
      if (!isCurrent) return;

      setAssistantNews(news);
      if (!news?.news?.trim()) return;

      const newsVersion = `${news.id || assistantName}:${news.updatedAt || ''}`;
      const seenKey = `assistant-news-seen:${teamName}:${assistantName}`;
      if (getLocalStorageItem(seenKey) !== newsVersion) {
        addLocalStorageItem(seenKey, newsVersion);
        setIsNewsModalOpen(true);
      }
    }

    loadAssistantNews();
    return () => {
      isCurrent = false;
    };
  }, [teamName, assistantName, addLocalStorageItem, getLocalStorageItem]);

  const handleNewsButtonClick = () => {
    setIsNewsModalOpen(true);
  };

  // Create stable dependencies to prevent unnecessary re-renders
  const sessionDep = useMemo(() => user?.email, [user?.email]);
  const userAssistantsDep = useMemo(() =>
    userAssistants?.map(ua => ua.name).sort().join(','),
    [userAssistants]
  );

  const filteredSmartNotes = useMemo(() => {
    if (activeTab === 'archived') {
      return smartNotes.filter(note => note.isArchived === true);
    }
    return smartNotes.filter(note => !note.isArchived);
  }, [smartNotes, activeTab]);

  const pollForClonedSmartNote = async (clonedSmartNote) => {
    const maxAttempts = 60; // Poll for up to 5 minutes (60 attempts * 5 seconds)
    const basePollInterval = 5000; // 5 seconds base interval
    const maxPollInterval = 60000; // 1 minute maximum interval
    const intervalIncreaseEvery = 5; // Increase interval every 5 attempts
    let attempts = 0;

    // Clear any existing polling timeout
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }

    // Calculate polling interval based on attempts
    const calculatePollInterval = (attemptCount) => {
      const multiplier = Math.floor(attemptCount / intervalIncreaseEvery);
      const calculatedInterval = basePollInterval * Math.pow(2, multiplier); // Exponential backoff: 5s, 10s, 20s, 40s, 60s
      return Math.min(calculatedInterval, maxPollInterval);
    };

    const poll = async () => {
      attempts++;

      try {
        // Fetch the latest smart notes to check the status
        const notes = await getSmartNotes(teamName, assistantName);
        const backgroundJob = await getBackgroundJob(teamName, clonedSmartNote.id);
        if (backgroundJob) {
          setBackgroundJob(backgroundJob);
        }
        const updatedSmartNote = notes.find(note => note.id === clonedSmartNote.id);

        if (updatedSmartNote) {
          if (updatedSmartNote.status === smartNoteStatus.Ready) {
            // Cloning is complete, update the UI
            smartNotesDispatch({ type: 'SET_SMART_NOTES', smartNotes: notes });
            setIsTemplateCloningInProgress(false);
            setBackgroundJob(null);
            showSnackbar(`Template cloned successfully as "${updatedSmartNote.title}"`, "success");
            pollingTimeoutRef.current = null; // Clear the ref
            return; // Stop polling
          } else if (updatedSmartNote.status === smartNoteStatus.Error) {
            // Cloning failed
            setIsTemplateCloningInProgress(false);
            setBackgroundJob(null);
            showSnackbar("Template cloning failed. Please try again.", "error");
            pollingTimeoutRef.current = null; // Clear the ref
            return; // Stop polling
          }
        } else {
          // Smart note not found, possibly deleted
          setIsTemplateCloningInProgress(false);
          setBackgroundJob(null);
          pollingTimeoutRef.current = null; // Clear the ref
          return; // Stop polling
        }

        // Continue polling if not ready and haven't exceeded max attempts
        if (attempts < maxAttempts) {
          const currentInterval = calculatePollInterval(attempts);
          pollingTimeoutRef.current = setTimeout(poll, currentInterval);
        } else {
          // Max attempts reached, show timeout error
          setIsTemplateCloningInProgress(false);
          showSnackbar("Template cloning is taking longer than expected. Please refresh the page to check if it completed.", "warning");
          pollingTimeoutRef.current = null; // Clear the ref
        }
      } catch (error) {
        console.error('Error polling for cloned smart note:', error);

        // Continue polling on error unless max attempts reached
        if (attempts < maxAttempts) {
          const currentInterval = calculatePollInterval(attempts);
          pollingTimeoutRef.current = setTimeout(poll, currentInterval);
        } else {
          setIsTemplateCloningInProgress(false);
          showSnackbar("Error checking template cloning status. Please refresh the page.", "error");
          pollingTimeoutRef.current = null; // Clear the ref
        }
      }
    };

    // Start polling
    const initialInterval = calculatePollInterval(0);
    pollingTimeoutRef.current = setTimeout(poll, initialInterval);
  };

  useEffect(() => {
    setIsLeftNavVisible(true);
    fetchSmartNotes();

  }, [sessionDep, userAssistantsDep, teamName, assistantName]);

  // Cleanup polling timeout on unmount
  useEffect(() => {
    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
    };
  }, []);

  const fetchSmartNotes = useCallback(async () => {
    setIsLoading(true);

    const assistantObj = userAssistants.find(r => r.name === assistantName && r.teamName === teamName);
    if (!assistantObj) {
      return;
    }
    userAssistantsDispatch({ type: 'SET_SELECTED_USER_ASSISTANT', selectedUserAssistant: assistantObj });

    try {
      const [notes, templates, assignedIndexes] = await Promise.all([
        getSmartNotes(teamName, assistantName),
        getSmartNoteTemplates(teamName, assistantName),
        getIndexConfigByAssistant(teamName, assistantName)
      ]);

      // Filter and cache enabled indexes
      const enabledIndexesList = Array.isArray(assignedIndexes)
        ? assignedIndexes.filter(index => index.enabled === true)
        : [];
      setEnabledIndexes(enabledIndexesList);


      // Check if there's a smart note currently cloning

      const cloningSmartNote = notes.find(note => note.status === smartNoteStatus.Cloning);
      setSmartNoteBeingCloned(cloningSmartNote);
      if (cloningSmartNote) {
        setIsTemplateCloningInProgress(true);
        setSmartNoteBeingCloned(cloningSmartNote.id);
        showSnackbar("Continuing to monitor template cloning in progress...", "info");
        const backgroundJob = await getBackgroundJob(teamName, cloningSmartNote.id);
        if (backgroundJob) {
          setBackgroundJob(backgroundJob);
        }
        pollForClonedSmartNote(cloningSmartNote, assistantName, teamName);
      }

      smartNotesDispatch({ type: 'SET_SMART_NOTES', smartNotes: notes });
      smartNoteTemplatesDispatch({ type: 'SET_SMART_NOTE_TEMPLATES', smartNoteTemplates: templates });
    } catch (err) {
      console.error('Error fetching smart notes or templates', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [teamName, assistantName, userAssistants, userAssistantsDispatch, smartNotesDispatch, smartNoteTemplatesDispatch, showSnackbar]);

  const handleChange = (e) => {
    setSortOrder(e.target.value);
  }

  const handleCreateSmartNote = async (e) => {
    setIsLeftNavVisible(false);
    setIsNewButtonDisabled(true);

    try {
      const newId = v4();
      const createSmartNote = await createSmartNoteWithId(teamName, assistantName, newId);
      smartNoteDispatch({ type: 'SET_SMART_NOTE', smartNote: createSmartNote });
      isSmartNoteCreated.current = true;

      await Promise.all(enabledIndexes.map(async (index) => {
        const designIndex = prepDocument({
          type: 'DesignIndex',
          smartNoteId: createSmartNote.id,
          title: index.displayName,
          indexName: index.indexName,
          parentId: createSmartNote.id,
          enabled: index.enabled,
          searchIndexConfigId: index.id
        });

        await createDesignIndex(teamName, assistantName, designIndex);
        designIndexsDispatch({ type: 'CREATE_DESIGN_INDEX', designIndex: designIndex });
        const designIndexSourceDocument = prepDocument({
          type: 'Source',
          smartNoteId: createSmartNote.id,
          sourceType: 'DesignIndex',
          sourceId: designIndex.id,
          parentId: createSmartNote.id,
          selected: designIndex.enabled,  // submitPromtService2 look at this to use the index config and pull AISearch
          enabled: designIndex.enabled,
          searchIndexConfigId: designIndex.searchIndexConfigId
        });

        await createSource(teamName, assistantName, designIndexSourceDocument);
        sourcesDispatch({ type: 'CREATE_SOURCE', source: designIndexSourceDocument });
      }));

      router.push(`/${teamName}/${assistantName}/smartNote/${newId}`);
    } catch (error) {
      console.error(error);
      showSnackbar("Error creating new Smart Note. Please try again.", "error");
    }

    setIsNewButtonDisabled(false);
    setIsLeftNavVisible(true);
  }

  const handleCardClick = (smartNote) => {
    setIsLeftNavVisible(false);
  };

  const handleTemplateClicked = async (template) => {
    setIsTemplateCloningInProgress(true);
    try {
      const response = await cloneSmartNoteTemplate(teamName, assistantName, template);
      if (response.status === 409) {
        showSnackbar(`You have already cloned this template as "${response.title}". Please delete that Smart Note before cloning again.`, "error");
        setIsTemplateCloningInProgress(false);
        setSmartNoteBeingCloned(null);
      } else if (response.error) {
        showSnackbar("Error cloning template", "error");
        setIsTemplateCloningInProgress(false);
        setSmartNoteBeingCloned(null);
      } else {
        // Clone initiated successfully, start polling for completion
        const cloningSmartNote = response.smartNote;
        if (cloningSmartNote) {
          setIsTemplateCloningInProgress(true);
          setSmartNoteBeingCloned(cloningSmartNote);
          const backgroundJob = await getBackgroundJob(teamName, cloningSmartNote.id);
          if (backgroundJob) {
            setBackgroundJob(backgroundJob);
          }
          pollForClonedSmartNote(cloningSmartNote, assistantName, teamName);

          smartNotesDispatch({ type: 'SET_SMART_NOTES', smartNotes: [...smartNotes.filter(note => note.id !== cloningSmartNote.id), cloningSmartNote] });
        }

      }
    } catch (error) {
      showSnackbar(error.message, "error");
      setIsTemplateCloningInProgress(false);
    }
  }

  const handleTemplateDelete = async (template) => {
    const currentTemplates = smartNoteTemplates;

    smartNoteTemplatesDispatch({ type: 'DELETE_SMART_NOTE_TEMPLATE', id: template.id });

    try {
      const success = await deleteSmartNoteTemplate(teamName, assistantName, template.id);
      if (!success) {
        smartNoteTemplatesDispatch({ type: 'SET_SMART_NOTE_TEMPLATES', smartNoteTemplates: currentTemplates });
        throw new Error('Failed to delete template');
      }
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  }

  const handleEditTemplateTitle = async (template, newTitle) => {
    // update template title
    await updateSmartNoteTemplate(teamName, assistantName, template.id, { title: newTitle });
    smartNoteTemplatesDispatch({ type: 'EDIT_SMART_NOTE_TEMPLATE_TITLE', id: template.id, newTitle });

    // update smart note title
    const smartNote = smartNotes.find(s => s.id === template.smartNoteId);
    if (smartNote) {
      await patchSmartNoteTitle(teamName, assistantName, smartNote, newTitle);
      smartNotesDispatch({ type: 'EDIT_SMART_NOTE_TITLE', id: smartNote.id, newTitle });
    } else {
      await updateSmartNote(teamName, assistantName, template.smartNoteId, { title: newTitle });
    }
  }

  const handleDelete = async (smartNote) => {
    // Optimistically update the UI
    smartNotesDispatch({ type: 'DELETE_SMART_NOTE', id: smartNote.id });
    setIsTemplateCloningInProgress(false);
    setSmartNoteBeingCloned(null);
    setBackgroundJob(null);
    // if this smartNote has a template, delete it
    if (smartNote.templateId) {
      smartNoteTemplatesDispatch({ type: 'DELETE_SMART_NOTE_TEMPLATE', id: smartNote.templateId });
    }

    await deleteSmartNote(teamName, assistantName, smartNote.id);
  };

  const handleArchive = async (smartNote) => {
    const updates = await updateSmartNote(teamName, assistantName, smartNote.id, { isArchived: true });
    smartNotesDispatch({ type: 'UPDATE_SMART_NOTE', smartNote: { ...smartNote, ...updates, isArchived: true } });
  };

  const handleRestore = async (smartNote) => {
    const updates = await updateSmartNote(teamName, assistantName, smartNote.id, { isArchived: false });
    smartNotesDispatch({ type: 'UPDATE_SMART_NOTE', smartNote: { ...smartNote, ...updates, isArchived: false } });
  };

  const handleEditTitle = async (smartNote, newTitle) => {
    const updates = await patchSmartNoteTitle(teamName, assistantName, smartNote, newTitle);
    smartNotesDispatch({ type: 'UPDATE_SMART_NOTE', smartNote: { ...smartNote, ...updates } });

    // Also update template title if present
    if (smartNote.templateId) {
      updateSmartNoteTemplate(teamName, assistantName, smartNote.templateId, { title: newTitle });
      smartNoteTemplatesDispatch({ type: 'EDIT_SMART_NOTE_TEMPLATE_TITLE', id: smartNote.templateId, newTitle });
    }
  };

  const handleEditSubtitle = async (smartNote, newSubtitle) => {
    const updates = await updateSmartNote(teamName, assistantName, smartNote.id, { subtitle: newSubtitle });
    smartNotesDispatch({ type: 'UPDATE_SMART_NOTE', smartNote: { ...smartNote, ...updates } });
  };

  return (
    <Container maxWidth="false" sx={{ marginLeft: '0%', height: '100%' }} disableGutters={true}>
      <Box sx={{ width: '80%', marginX: '10%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box display={'flex'} flexDirection={'row'} width={'100%'} >
          <Typography fontWeight={500} fontSize={'48pt'} color={'text.heading'}>{`Welcome to ${selectedUserAssistant ? selectedUserAssistant.displayName : 'KP AI SmartNotes'}`}</Typography>
        </Box>
        <Box display={'flex'} flexDirection={'row'} maxWidth="100%" marginBottom={'1em'}>
          <Typography fontWeight={400} fontSize={'14pt'}>{selectedUserAssistant?.description}</Typography>
        </Box>
        <Divider style={{ marginBottom: '1em' }} />
        {
          isLoading ? (
            <Box sx={{ mt: 4, height: '100%', display: 'flex', flexDirection: 'column', gap: 2, pb: 4 }}>
              <Skeleton variant="rounded" sx={{ width: '100%', height: '56px' }} />
              <Skeleton variant="rounded" sx={{ width: '100%', flexGrow: 1 }} />
              <Skeleton variant="rounded" sx={{ width: '100%', flexGrow: 1 }} />
            </Box>
          ) : (
            <>
              <Box sx={{ width: '100%', padding: 2 }}>
                <Grid2 container alignItems="center" justifyContent="space-between">
                  <Grid2>
                    <Button disabled={isNewButtonDisabled} className="createNew" variant="primary" startIcon={<AddOutlinedIcon />} onClick={handleCreateSmartNote}>
                      Create new
                    </Button>
                  </Grid2>
                  <Grid2>
                    <Box display="flex" flexDirection="column" alignItems="flex-end" sx={{ width: '100%', gap: 1 }}>
                      <Button
                        variant="action"
                        size="small"
                        onClick={handleNewsButtonClick}
                        sx={{ borderRadius: '16px', minHeight: '32px', paddingX: 2, textTransform: 'none' }}
                      >
                        News & Updates
                      </Button>
                      <Box display="flex" justifyContent="flex-end" alignItems="center">
                        <ToggleButtonGroup
                          value={activeTab}
                          exclusive
                          onChange={(e, newValue) => { if (newValue !== null) setActiveTab(newValue); }}
                          size="large"
                          sx={{
                            marginRight: 2,
                            height: '56px',
                            '& .MuiToggleButton-root': {
                              height: '56px',
                              border: '1px solid',
                              borderColor: 'toggleBtn.border.main',
                              '&:hover': {
                                borderColor: 'toggleBtn.border.hover',
                              },
                              '&.Mui-selected': {
                                borderColor: 'toggleBtn.border.selected',
                              },
                              '&.Mui-selected + .MuiToggleButton-root': {
                                borderLeftColor: 'toggleBtn.border.selected',
                              }
                            },
                          }}
                        >
                          <ToggleButton className='listDetail' value="active" sx={{ borderRadius: '12px 0px 0px 12px' }}>Active</ToggleButton>
                          <ToggleButton className='listDetail' value="archived" sx={{ borderRadius: '0px 12px 12px 0px' }}>Archived</ToggleButton>
                        </ToggleButtonGroup>
                        <Select className='listDetail'
                          value={sortOrder}
                          onChange={handleChange}
                          displayEmpty
                          size='medium'
                          inputProps={{ 'aria-label': 'Without label' }}
                        >
                          <MenuItem className='listDetail' value={'updatedAt'}>Most recent</MenuItem>
                          <MenuItem className='listDetail' value={'title'}>Title</MenuItem>
                        </Select>
                      </Box>
                    </Box>
                  </Grid2>
                </Grid2>
              </Box>
              <Box sx={{ width: '100%', padding: 2, display: 'flex', flexGrow: 1, overflow: 'auto' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'auto', height: '100%', width: '100%' }}>
                  {
                    filteredSmartNotes.length > 0 && (
                      <>
                        <Typography variant="h5" sx={{ marginBottom: '1em' }}>{activeTab === 'archived' ? 'Archived Smart Notes' : 'My Smart Notes'}</Typography>
                        {isInfoSourceAssistant ? (
                          <InfoSourceSmartNoteGrid
                            smartNotes={filteredSmartNotes}
                            sortOrder={sortOrder}
                            handleCardClick={handleCardClick}
                            handleDelete={handleDelete}
                            handleEditTitle={handleEditTitle}
                            handleEditSubtitle={handleEditSubtitle}
                            handleArchive={handleArchive}
                            handleRestore={handleRestore}
                            isArchivedView={activeTab === 'archived'}
                            isDeleteSmartNoteEnabled={selectedUserAssistant?.isDeleteSmartNoteEnabled ?? true}
                          />
                        ) : (
                          <SmartNoteGrid
                            smartNotes={filteredSmartNotes}
                            sortOrder={sortOrder}
                            handleCardClick={handleCardClick}
                            handleDelete={handleDelete}
                            handleEditTitle={handleEditTitle}
                            handleArchive={handleArchive}
                            handleRestore={handleRestore}
                            isArchivedView={activeTab === 'archived'}
                            isDeleteSmartNoteEnabled={selectedUserAssistant?.isDeleteSmartNoteEnabled ?? true}
                          />
                        )}
                      </>
                    )
                  }
                  {
                    activeTab !== 'archived' && smartNoteTemplates.length > 0 && (
                      <>
                        <Divider style={{ margin: '1em 0' }} />
                        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, marginBottom: '1em' }}>
                          <Typography variant="h5">Smart Note Templates</Typography>
                          <Tooltip title={"Templates allow you to clone an existing Smart Note with a curated knowledge base. Smart Note's cloned from a template do not stay in sync with the template. If the owner updates their template, you will have to clone it again."} placement="top" arrow>
                            <InfoOutlined sx={{ color: 'info.dark', cursor: 'pointer', alignSelf: 'top' }} />
                          </Tooltip>
                        </Box>
                        {
                          isTemplateCloningInProgress ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: 'grey.100', borderRadius: '12px', padding: '2em' }}>
                              <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                <CircularProgress size={60} />
                              </Box>
                              <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                  Cloning template...
                                </Typography>
                                <Typography variant="body1">
                                  Please be patient. This may take a few minutes depending on the size of the sources in the shared Smart Note.
                                </Typography>
                                <Typography variant="body1">
                                  Smart Notes with uploaded document sources are expected to take longer to clone.
                                </Typography>
                                {
                                  backgroundJob && backgroundJob.error && (
                                    <Box sx={{ marginTop: 2 }}>
                                      <Typography variant="body2" color="error">
                                        An error occurred during the cloning process, please cancel and try again. If this issue persists, please notify your team admin.
                                      </Typography>
                                    </Box>
                                  )
                                }
                                {
                                  backgroundJob && !backgroundJob.error && (
                                    <Box sx={{ marginTop: 2 }}>
                                      <Typography variant="body2">
                                        Clone Progress {backgroundJob.indexesCloned}/{backgroundJob.indexesTotal} indexes processed.
                                      </Typography>
                                      <Box sx={{ mt: 0.5 }}>
                                        <LinearProgress
                                          variant="determinate"
                                          value={(() => {
                                            const total = Number(backgroundJob.indexesTotal) || 0;
                                            const done = Number(backgroundJob.indexesCloned) || 0;
                                            if (total <= 0) return 0;
                                            const pct = Math.min(100, Math.max(0, (done / total) * 100));
                                            return isNaN(pct) ? 0 : pct;
                                          })()}
                                          sx={{ height: 8, borderRadius: 4 }}
                                        />
                                      </Box>
                                      <Typography variant="body2" sx={{ mt: 1 }}>
                                        Index Progress {backgroundJob.indexDocumentsCloned}/{backgroundJob.indexDocumentsTotal} documents cloned in current index.
                                      </Typography>
                                      <Box sx={{ mt: 0.5 }}>
                                        <LinearProgress
                                          variant="determinate"
                                          value={(() => {
                                            const total = Number(backgroundJob.indexDocumentsTotal) || 0;
                                            const done = Number(backgroundJob.indexDocumentsCloned) || 0;
                                            if (total <= 0) return 0;
                                            const pct = Math.min(100, Math.max(0, (done / total) * 100));
                                            return isNaN(pct) ? 0 : pct;
                                          })()}
                                          sx={{ height: 8, borderRadius: 4 }}
                                        />
                                      </Box>
                                      <Typography variant="body2">
                                        Elapsed Time: {Math.floor((Date.now() - new Date(backgroundJob.createdAt).getTime()) / 60000)} minutes
                                      </Typography>
                                    </Box>
                                  )
                                }
                                <Box sx={{ marginTop: 2 }}>
                                  {isTemplateCloningInProgress && smartNoteBeingCloned && (
                                    <Button
                                      onClick={async () => {
                                        if (isTemplateCloningInProgress && smartNoteBeingCloned) {
                                          const cloningSmartNote = smartNotes.find(note => note.status === smartNoteStatus.Cloning);
                                          if (cloningSmartNote) {
                                            await handleDelete(cloningSmartNote);
                                            setIsTemplateCloningInProgress(false);
                                            setSmartNoteBeingCloned(null);
                                          }
                                        }
                                      }}
                                      variant="primary"
                                    >
                                      Cancel
                                    </Button>)}
                                </Box>
                              </Box>
                            </Box>) :
                            <SmartNoteTemplateGrid
                              templates={smartNoteTemplates}
                              sortOrder={sortOrder}
                              handleCardClick={handleTemplateClicked}
                              handleDelete={handleTemplateDelete}
                              handleEditTitle={handleEditTemplateTitle} />
                        }
                      </>
                    )
                  }
                </Box>
              </Box>
              <AssistantNewsModal
                open={isNewsModalOpen}
                onClose={() => setIsNewsModalOpen(false)}
                news={assistantNews?.news || ''}
                assistantDisplayName={selectedUserAssistant?.displayName}
                updatedAt={assistantNews?.updatedAt}
              />
            </>
          )}
        <SnackbarComponent />
      </Box>
    </Container >
  );
}