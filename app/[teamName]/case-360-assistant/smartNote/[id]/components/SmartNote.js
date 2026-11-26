'use client';

import { useEffect, useState, useRef } from 'react';
import { Box, Container, Skeleton } from '@mui/material';
import Assistant from '@/app/[teamName]/[assistantName]/smartNote/[id]/components/Assistant';
import Case360Guide from './Case360Guide';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSmartNote, useSmartNoteDispatch } from '@/reducers/improved/SmartNoteContext';
import { createSmartNoteWithId, getSmartNote } from '@/app/clientServices/smartNoteService';
import { getIndexConfigByAssistant } from '@/app/clientServices/aiSearchConfigService';
import { useUserAssistants, useUserAssistantsDispatch } from '@/reducers/UserAssistantContext';
import { prepDocument } from '@/app/clientServices/insertDocument';
import { createDesignIndex } from '@clientServices/designIndexService';
import { createSource } from '@clientServices/sourceService';
import { useSourcesDispatch } from '@reducers/SourceContext';
import { useDesignIndexsDispatch } from '@reducers/DesignIndexContext';
import { getUserAssistantsByNUID } from '@/app/services/userAssistantService';


const SmartNote = ({ envName, isPriorChatEnabled, isEpdsFeatureEnabled = false }) => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const smartNoteDispatch = useSmartNoteDispatch();
  const smartNote = useSmartNote();
  const [loading, setLoading] = useState(true);
  const chatInputRef = useRef(null);
  const [mrnInput, setMrnInput] = useState('');
  const [isEpdsEnabled, setIsEpdsEnabled] = useState(Boolean(isEpdsFeatureEnabled));
  const [epdsFilters, setEpdsFilters] = useState(null);
  const isSmartNoteCreated = useRef(false);
  const { selectedUserAssistant, userAssistants } = useUserAssistants();
  const userAssistantsDispatch = useUserAssistantsDispatch();
  const sourcesDispatch = useSourcesDispatch();
  const designIndexsDispatch = useDesignIndexsDispatch();
  const { teamName, assistantName = 'case-360-assistant', id: smartNoteId } = useParams();

  useEffect(() => {
    const fetchData = async () => {
      try {
        let pathSmartNote = await getSmartNote(teamName, assistantName, smartNoteId);

        // Dev/demo entry: create a SmartNote on direct URL open when the ID is missing.
        if (!pathSmartNote && !isSmartNoteCreated.current) {
          isSmartNoteCreated.current = true;
          const createdSmartNoteTitle = 'Untitled Smart Note';
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
  }, [pathname, searchParams, router, smartNoteDispatch, designIndexsDispatch, sourcesDispatch, smartNoteId]);

  const handlePromptSelected = (prompt) => {
    if (chatInputRef.current) {
      chatInputRef.current.focus();
      chatInputRef.current.value = prompt.prompt;
      chatInputRef.current.dataset.case360PromptCategory = String(prompt.section || '').toLowerCase();

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

      <Box sx={{ display: 'flex', flexGrow: 1, width: '100%', height: '100%', gap: 1.5, overflow: 'hidden' }}>
        <Assistant
          chatInputRef={chatInputRef}
          mrnInput={mrnInput}
          epdsEnabled={teamName === 'kpif-ma' && isEpdsFeatureEnabled && isEpdsEnabled}
          epdsFilters={teamName === 'kpif-ma' && isEpdsFeatureEnabled ? epdsFilters : null}
          onEpdsEnabledChange={teamName === 'kpif-ma' && isEpdsFeatureEnabled ? setIsEpdsEnabled : undefined}
          isEpdsFeatureEnabled={teamName === 'kpif-ma' && isEpdsFeatureEnabled}
          teamName={teamName}
          assistantName={assistantName}
          isPriorChatEnabled={isPriorChatEnabled}
        />
        <Case360Guide
          onPromptSelected={handlePromptSelected}
          chatInputRef={chatInputRef}
          smartNote={smartNote}
          teamName={teamName}
          assistantName={assistantName}
          mrnInput={mrnInput}
          setMrnInput={setMrnInput}
          onEpdsEnabledChange={teamName === 'kpif-ma' && isEpdsFeatureEnabled ? setIsEpdsEnabled : undefined}
          onEpdsFiltersChange={teamName === 'kpif-ma' && isEpdsFeatureEnabled ? setEpdsFilters : undefined}
          epdsEnabled={teamName === 'kpif-ma' && isEpdsFeatureEnabled && isEpdsEnabled}
          isEpdsFeatureEnabled={teamName === 'kpif-ma' && isEpdsFeatureEnabled}
          envName={envName}
        />
      </Box>

    </Container>
  );
};

export default SmartNote;