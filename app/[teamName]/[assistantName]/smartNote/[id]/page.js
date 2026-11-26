'use client';

import { useEffect, useState, useRef } from 'react';
import { Box, Container, Skeleton } from '@mui/material';
import Sources from './components/Sources';
import Assistant from './components/Assistant';
import Guide from './components/Guide';
import InfoSourceExperience from './components/infoSource/InfoSourceExperience';
import EdiWorkbenchExperience from './components/ediWorkbench/EdiWorkbenchExperience';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSmartNoteDispatch } from '@/reducers/improved/SmartNoteContext';
import { createSmartNoteWithId, getSmartNote } from '@/app/clientServices/smartNoteService';
import { getIndexConfigByAssistant } from '@/app/clientServices/aiSearchConfigService';
import { useUserAssistants, useUserAssistantsDispatch } from '@/reducers/UserAssistantContext';
import { prepDocument } from '@/app/clientServices/insertDocument';
import { createDesignIndex } from '@clientServices/designIndexService';
import { createSource } from '@clientServices/sourceService';
import { useSourcesDispatch } from '@reducers/SourceContext';
import { useDesignIndexsDispatch } from '@reducers/DesignIndexContext';
import { getUserAssistantsByNUID } from '@/app/services/userAssistantService';
import { v4 } from 'uuid';

const INFO_SOURCE_ASSISTANT_NAMES = new Set(['infosource', 'info-source-assistant']);
const EDI_WORKBENCH_ASSISTANT_NAMES = new Set(['edi-workbench', 'edi-companion-assistant', 'edi-assistant']);


const SmartNote = () => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const smartNoteDispatch = useSmartNoteDispatch();
  const [loading, setLoading] = useState(true);
  const chatInputRef = useRef(null);
  const [mrnInput, setMrnInput] = useState('');
  const isSmartNoteCreated = useRef(false);
  const { selectedUserAssistant, userAssistants } = useUserAssistants();
  const userAssistantsDispatch = useUserAssistantsDispatch();
  const sourcesDispatch = useSourcesDispatch();
  const designIndexsDispatch = useDesignIndexsDispatch();
  const { teamName, assistantName, id: smartNoteId } = useParams();
  const currentAssistantName = selectedUserAssistant?.name || assistantName;
  const normalizedAssistantName = String(currentAssistantName || '').trim().toLowerCase();
  const isInfoSourceExperience = INFO_SOURCE_ASSISTANT_NAMES.has(normalizedAssistantName);
  const isEdiWorkbenchExperience = EDI_WORKBENCH_ASSISTANT_NAMES.has(normalizedAssistantName);
  const isDemoMode = searchParams.get('demoMode') === '1';
  const isPriorChatEnabled = true; // Enables users to select previous chats from the same smartnote

  useEffect(() => {
    const fetchData = async () => {
      try {
        let pathSmartNote = await getSmartNote(teamName, assistantName, smartNoteId);

        // Dev/demo entry: create a SmartNote on direct URL open when the ID is missing.
        if (!pathSmartNote && isDemoMode && !isSmartNoteCreated.current) {
          isSmartNoteCreated.current = true;
          const createdSmartNoteTitle = isDemoMode ? 'InfoSource Demo' : 'Untitled Smart Note';
          const createdSmartNote = await createSmartNoteWithId(teamName, assistantName, smartNoteId, createdSmartNoteTitle);

          if (createdSmartNote?.id) {
            try {
              const assignedIndexes = await getIndexConfigByAssistant(teamName, assistantName);
              const enabledIndexes = Array.isArray(assignedIndexes)
                ? assignedIndexes.filter(index => index.enabled === true)
                : [];

              await Promise.all(enabledIndexes.map(async (index) => {
                const designIndex = prepDocument({
                  type: 'DesignIndex',
                  smartNoteId: createdSmartNote.id,
                  title: index.displayName,
                  indexName: index.indexName,
                  parentId: createdSmartNote.id,
                  enabled: index.enabled,
                  searchIndexConfigId: index.id
                });

                await createDesignIndex(teamName, assistantName, designIndex);
                designIndexsDispatch({ type: 'CREATE_DESIGN_INDEX', designIndex });

                const designIndexSourceDocument = prepDocument({
                  type: 'Source',
                  smartNoteId: createdSmartNote.id,
                  sourceType: 'DesignIndex',
                  sourceId: designIndex.id,
                  parentId: createdSmartNote.id,
                  selected: designIndex.enabled,
                  enabled: designIndex.enabled,
                  searchIndexConfigId: designIndex.searchIndexConfigId
                });

                await createSource(teamName, assistantName, designIndexSourceDocument);
                sourcesDispatch({ type: 'CREATE_SOURCE', source: designIndexSourceDocument });
              }));
            } catch (error) {
              console.error('Error setting up default indexes for auto-created SmartNote:', error);
            }

            pathSmartNote = createdSmartNote;
          }
        }

        if (pathSmartNote) {
          if (isDemoMode) {
            const nextParams = new URLSearchParams(searchParams.toString());
            nextParams.delete('demoMode');
            const nextQuery = nextParams.toString();
            router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ''}`);
          }

          if (!selectedUserAssistant) {
            let assistants = userAssistants || [];

            if (!assistants || assistants.length <= 0) {
              try {
                const result = await getUserAssistantsByNUID();
                assistants = result.assistants || [];
                userAssistantsDispatch({ type: 'SET_USER_ASSISTANTS', userAssistants: assistants });
              } catch (error) {
                console.error('Error fetching assistants:', error);
              }
            }

            const assistant = assistants.find(assistant => assistant.name === pathSmartNote.selectedUserAssistant);
            if (assistant) {
              userAssistantsDispatch({ type: 'SET_SELECTED_USER_ASSISTANT', selectedUserAssistant: assistant });
            } else {
              console.error('The assistant associated with this smart note is no longger accessible.');
            }
          }

          smartNoteDispatch({ type: 'SET_SMART_NOTE', smartNote: pathSmartNote });
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    // Cleanup: clear selected smart note when leaving this page
    return () => {
      smartNoteDispatch({ type: 'RESET_SMART_NOTE' });
    };
  }, [pathname, searchParams, isDemoMode, router, smartNoteDispatch, designIndexsDispatch, sourcesDispatch, smartNoteId]);

  const handlePromptSelected = (prompt) => {
    if (chatInputRef.current) {
      chatInputRef.current.focus();
      chatInputRef.current.value = prompt.prompt;

      if (prompt.highlight) {
        const start = chatInputRef.current.value.indexOf(prompt.highlight);
        if (start !== -1) {
          chatInputRef.current.setSelectionRange(start, start + prompt.highlight.length);
        }
      }
    }
  }

  if (loading) {
    return (
      <Container maxWidth="false" sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, width: '100%', height: '100%', overflow: 'hidden', padding: 1.5, backgroundColor: 'listitem.header' }} disableGutters>
        <Box sx={{ display: 'flex', flexGrow: 1, width: '100%', height: '100%', gap: 1.5, overflow: 'hidden' }}>
          <Skeleton variant="rounded" width="100%" height="100%" sx={{ borderRadius: '15px' }} />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="false" sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, height: '100%', overflow: 'hidden', padding: 1.5, backgroundColor: 'listitem.header' }} disableGutters>
      {isInfoSourceExperience ? (
        <InfoSourceExperience chatInputRef={chatInputRef} />
      ) : isEdiWorkbenchExperience ? (
        <EdiWorkbenchExperience />
      ) : (
        <Box sx={{ display: 'flex', flexGrow: 1, width: '100%', height: '100%', gap: 1.5, overflow: 'hidden' }}>
          {!(selectedUserAssistant && selectedUserAssistant.name === 'complianceai2') && <Sources />}
          <Assistant chatInputRef={chatInputRef} mrnInput={mrnInput} setMrnInput={setMrnInput} isPriorChatEnabled={isPriorChatEnabled} />
          <Guide chatInputRef={chatInputRef} onPromptSelected={handlePromptSelected} mrnInput={mrnInput} setMrnInput={setMrnInput} />
        </Box>
      )}
    </Container>
  );
};

export default SmartNote;