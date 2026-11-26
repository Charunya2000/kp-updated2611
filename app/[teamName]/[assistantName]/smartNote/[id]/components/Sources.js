'use client';

import { useState, useEffect } from 'react';
import { Box, Typography, Divider, Button, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SourceList from './SourceList';
import AddSourceDialog from './AddSourceDialog';
import { useSmartNote, useSmartNoteDispatch } from '@reducers/improved/SmartNoteContext';
import { useUserAssistants } from '@/reducers/UserAssistantContext';
import { saveSmartNote } from '@clientServices/smartNoteService';
import { useDesignIndexs } from '@reducers/DesignIndexContext';
import { useSources, useSourcesDispatch } from '@reducers/SourceContext';
import { saveSource } from '@clientServices/sourceService';
import { clearCurrentChat } from '@/app/clientServices/personaService';
import { useSuggestedPromptsDispatch } from '@reducers/SuggestedPromptContext';
import { useChatInteractionsDispatch } from '@reducers/ChatInteractionContext';
import { useChatHistorys } from '@reducers/ChatHistoryContext';
import { useChats } from '@reducers/ChatContext';
import { useParams } from 'next/navigation';
import { getAllPersonas } from '@/app/clientServices/personaService';
import { useWorkflow, useWorkflowDispatch } from '@reducers/WorkflowContext';

// Special Assistants that should show personas when DB has no personas for them
const SPECIAL_ASSISTANTS_TO_SHOW_PERSONAS = [
  'bcschatbot',
  // 'document-management-shared-service',
  'scheduletopay'
];

const HIDE_CONTEXT_COLUMN_ASSISTANTS = [
  'case-360-assistant',
  'medicare-companion'
];

// default personas to show when special assistant has no DB personas
const PERSONAS_FOR_SPECIAL_ASSISTANTS = {
  scheduletopay: [
    { id: 'scheduletopay-Architecture', name: 'Architecture', enabled: true },
    { id: 'scheduletopay-DBA', name: 'DBA', enabled: true },
    { id: 'scheduletopay-Testing', name: 'Testing', enabled: true },
    { id: 'scheduletopay-ChangeRequest', name: 'Change Request', enabled: true }
  ],
  bcschatbot: [
    { id: 'bcschatbot-DevelopmentIteration', name: 'Development Iteration', enabled: true }
  ],
  // 'document-management-shared-service': [
  //   {
  //     id: 'docmgmt-DocumentManager',
  //     name: 'Document Manager',
  //     enabled: true
  //   }
  // ],
};

const Sources = ({ width = 'mid' }) => {
  const [open, setOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const smartNote = useSmartNote();
  const { selectedUserAssistant } = useUserAssistants();
  const smartNoteDispatch = useSmartNoteDispatch();
  const { designIndexs } = useDesignIndexs();
  const { sources } = useSources();
  const sourcesDispatch = useSourcesDispatch();
  const suggestedPromptsDispatch = useSuggestedPromptsDispatch();
  const chatInteractionDispath = useChatInteractionsDispatch();
  const chatHistory = useChatHistorys();
  const { selectedChat } = useChats();
  const { teamName, assistantName } = useParams();

  // hide entire Context panel for the case-360-assistant
  const currentAssistantName = selectedUserAssistant?.name || assistantName;
  if (HIDE_CONTEXT_COLUMN_ASSISTANTS.includes(currentAssistantName)) {
    return null;
  }

  const [personas, setPersonas] = useState([]);
  const [showPersonasSection, setShowPersonasSection] = useState(false);
  // read workflow selection so we can hide personas if a workflow is active
  const { selectedWorkflow } = useWorkflow();
  const workflowDispatch = useWorkflowDispatch();

  useEffect(() => {
    let mounted = true;

    const fetchPersonas = async () => {
      const asstName = selectedUserAssistant?.name || assistantName;

      let res;
      try {
        res = await getAllPersonas(teamName, asstName);
      } catch (err) {
        // on fetch error: log and bail out (do not change UI state)
        console.error('Failed to fetch personas', err);
        return;
      }

      if (!mounted) return;

      const list = Array.isArray(res) ? res : [];

      // only show enabled personas from DB
      const visibleFromDb = list.filter(p => !!p.enabled);

      if (visibleFromDb.length > 0) {
        setPersonas(visibleFromDb);
        setShowPersonasSection(true);
        return;
      }

      // no DB personas -> if assistant is in special list, show default personas
      if (SPECIAL_ASSISTANTS_TO_SHOW_PERSONAS.includes(asstName)) {
        const defaults = PERSONAS_FOR_SPECIAL_ASSISTANTS[asstName] || [];
        setPersonas(defaults);
        setShowPersonasSection(true);
        return;
      }

      // otherwise hide section
      setPersonas([]);
      setShowPersonasSection(false);
    };

    if (teamName) fetchPersonas();
    return () => { mounted = false; };
  }, [selectedUserAssistant, assistantName, teamName]);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleRefresh = async () => {
    try {
      if (selectedChat) {
        clearCurrentChat(teamName, assistantName, smartNote, chatHistory, selectedChat);
      }
      suggestedPromptsDispatch({ type: 'RESET_SUGGESTED_PROMPTS' });
      chatInteractionDispath({ type: 'RESET_CHAT_INTERACTIONS' });
    } catch (error) {
      console.error('Failed to delete chat interactions:', error);
    }
  };

  const handlePersonaClick = async (newPersona) => {
    // Prevent action if workflow is selected
    if (selectedWorkflow) {
      return;
    }

    // Toggle persona selection
    if (smartNote.persona === newPersona) {
      smartNote.persona = null;
    } else {
      smartNote.persona = newPersona;
    }

    smartNoteDispatch({ type: 'UPDATE_SMART_NOTE', smartNote: smartNote });
    saveSmartNote(teamName, assistantName, smartNote);

    // when user selects a persona, clear any active workflow so workflow UI hides
    try {
      workflowDispatch?.({ type: 'SET_WORKFLOW', workflow: null });
    } catch (e) {
      // noop if reducer doesn't handle this action
    }

    // If selected persona is "Change Request" and currently selected, handle special index logic
    if (newPersona === 'Change Request' && smartNote.persona === newPersona) {
      const designIndex = designIndexs.find(index => index.indexName === 'kpmc-doc-001');
      if (designIndex) {
        const kpmcIndexSource = sources.find(source => source.sourceId === designIndex.id);
        if (kpmcIndexSource) {
          const updatedSource = { ...kpmcIndexSource, selected: false };
          await saveSource(teamName, assistantName, updatedSource);
          sourcesDispatch({ type: 'UPDATE_OR_CREATE_SOURCE', source: updatedSource });
        }
      }
    }

    handleRefresh();
  };

  const getWidth = () => {
    if (width === 'min') return '20%';
    if (width === 'mid') return '35%';
    if (width === 'max') return '100%';
    return '60%';
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: getWidth(), height: '100%', backgroundColor: 'card.body.deep', borderRadius: '15px', border: '1px solid', borderColor: 'color.dolphin', overflow: 'hidden', transition: 'width 0.3s' }}>
      <Box sx={{ display: 'flex', flex: '0 0 auto', width: '100%', height: '4em', justifyContent: 'space-between', alignItems: 'center', p: 2, overflow: 'hidden' }}>
        {!isCollapsed && <Typography variant="h5">Context</Typography>}
      </Box>
      {!isCollapsed && <Divider sx={{ width: '100%' }} />}
      {!isCollapsed && (
        <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, height: '100%', overflow: 'hidden' }}>
          {showPersonasSection && (
            <>
              <Box sx={{ display: 'flex', flexDirection: 'column', flex: '0 1 auto', minHeight: 0, padding: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, marginBottom: 2 }}>
                  <Typography variant="h6">Smart Personas</Typography>
                  <Tooltip title="Personas can modify the assistants instructions, but will disable workflows" arrow>
                    <InfoOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary', cursor: 'pointer' }} />
                  </Tooltip>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, overflow: 'auto' }}>
                  {personas.map((p) => {
                    const label = p.name || '';
                    return (
                      <Button
                        key={p.id || label}
                        onClick={() => handlePersonaClick(label)}
                        variant={label && label === smartNote.persona ? 'primary' : 'secondary'}
                        sx={{ paddingY: 0.5, minWidth: 'auto' }}
                        disabled={!!selectedWorkflow}
                      >
                        {label}
                      </Button>
                    );
                  })}
                </Box>
              </Box>
              <Divider sx={{ width: '90%', alignSelf: 'center' }} />
            </>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, padding: 2, overflow: 'hidden' }}>
            <Typography variant="h6" sx={{ marginBottom: 2 }}>Sources</Typography>
            <Button
              variant="action"
              startIcon={<AddIcon />}
              onClick={handleClickOpen}
              sx={{
                marginY: 2,
                width: '100%'
              }}
            >
              Add source
            </Button>
            <SourceList />
            <AddSourceDialog open={open} handleClose={handleClose} />
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default Sources;