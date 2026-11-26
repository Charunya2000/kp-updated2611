'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Drawer, Typography, useMediaQuery, useTheme, IconButton } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TuneIcon from '@mui/icons-material/Tune';
import PropTypes from 'prop-types';
import InfoSourceAssistant from './InfoSourceAssistant';
import Sources from '../Sources';
import InfoSourceHero from './InfoSourceHero';
import InsightRail from './InsightRail';
import DealCanvasPanel from './DealCanvasPanel';
import AgentSkillsPanel from './AgentSkillsPanel';
import WhatIRememberPanel from './WhatIRememberPanel';
import InfoSourceFilterDrawer from './InfoSourceFilterDrawer';
import { useChatInteractions } from '@reducers/ChatInteractionContext';
import { useSmartNote } from '@/reducers/improved/SmartNoteContext';
import { prepDocument } from '@/app/clientServices/insertDocument';
import {
  createInfoSourceFilterSettings,
  getInfoSourceFilterSettings,
  updateInfoSourceFilterSettings,
} from '@/app/clientServices/infoSourceFilterSettingsService';
import { useParams } from 'next/navigation';

const DEMO_DISABLE_AGENT_SKILLS_PANEL = true;
const DEMO_DISABLE_WHAT_I_REMEMBER_PANEL = true;
const DEMO_DISABLE_DEAL_CANVAS_PANEL = true;
const DEMO_HIDE_INFO_SOURCE_HERO = true;

const DEFAULT_INFO_SOURCE_FILTERS = {
  enabled: false,
  contentType: 'both',
  title: '',
  owners: [],
  markets: [],
  keywords: [],
  updatedBucket: 'any',
  useCitationSeed: false
};

function normalizeFilterValues(values = []) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  )];
}

function normalizeStoredInfoSourceFilters(filters = null) {
  return {
    enabled: Boolean(filters?.enabled),
    contentType: ['both', 'asset', 'page'].includes(filters?.contentType) ? filters.contentType : 'both',
    title: String(filters?.title || ''),
    owners: normalizeFilterValues(filters?.owners),
    markets: normalizeFilterValues(filters?.markets),
    keywords: normalizeFilterValues(filters?.keywords),
    updatedBucket: ['any', 'thisMonth', 'last3Months', 'last6Months', 'thisYear', 'lastYear'].includes(filters?.updatedBucket)
      ? filters.updatedBucket
      : 'any',
    useCitationSeed: Boolean(filters?.useCitationSeed)
  };
}

function buildCitationSeed(citations = []) {
  const safeCitations = Array.isArray(citations) ? citations : [];

  const titles = normalizeFilterValues(safeCitations.map((item) => (
    item?.source
    || item?.sourceTitle
    || item?.documentTitle
    || item?.title
    || item?.document?.title
    || item?.document?.document_title
    || item?.document?.path
    || item?.path
  )));

  const owners = normalizeFilterValues(safeCitations.map((item) => (
    item?.owner
    || item?.documentOwner
    || item?.document_owner
    || item?.content_owner
    || item?.document?.document_owner
    || item?.document?.content_owner
  )));

  const markets = normalizeFilterValues(safeCitations.map((item) => (
    item?.region
    || item?.market
    || item?.document?.market
  )));

  const keywords = normalizeFilterValues(safeCitations.flatMap((item) => {
    if (Array.isArray(item?.keywords)) {
      return item.keywords;
    }

    if (Array.isArray(item?.document?.keywords)) {
      return item.document.keywords;
    }

    return String(item?.keywords_text || item?.document?.keywords_text || '')
      .split(/,|;/)
      .map((keyword) => keyword.trim());
  }));

  return {
    titles,
    owners,
    markets,
    keywords
  };
}

const InfoSourceExperience = ({ chatInputRef }) => {
  const smartNote = useSmartNote();
  const { teamName, assistantName } = useParams();
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [infoSourceFilters, setInfoSourceFilters] = useState(DEFAULT_INFO_SOURCE_FILTERS);
  const saveTimeoutRef = useRef(null);
  const hydratedSmartNoteIdRef = useRef(null);
  const filterSettingsRef = useRef(null);
  const lastSavedFiltersRef = useRef(JSON.stringify(DEFAULT_INFO_SOURCE_FILTERS));
  const theme = useTheme();
  const isLgDown = useMediaQuery(theme.breakpoints.down('lg'));
  const { chatInteractions, selectedChatInteraction } = useChatInteractions();
  const [collapsedPanels, setCollapsedPanels] = useState({
    agentSkills: true,
    whatIRemember: true,
    insightRail: false,
    dealCanvas: true
  });

  const togglePanel = (key) => {
    setCollapsedPanels((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const latestInteraction = selectedChatInteraction || (Array.isArray(chatInteractions) && chatInteractions.length > 0
    ? chatInteractions[chatInteractions.length - 1]
    : null);

  const citationSeed = useMemo(
    () => buildCitationSeed(latestInteraction?.citations),
    [latestInteraction?.citations]
  );

  const hasCitationSeed = citationSeed.titles.length > 0
    || citationSeed.owners.length > 0
    || citationSeed.markets.length > 0
    || citationSeed.keywords.length > 0;

  const activeFilterCount = [
    infoSourceFilters.title,
    infoSourceFilters.owners.length > 0,
    infoSourceFilters.markets.length > 0,
    infoSourceFilters.keywords.length > 0,
    infoSourceFilters.updatedBucket !== 'any',
    infoSourceFilters.contentType !== 'both',
    infoSourceFilters.useCitationSeed
  ].filter(Boolean).length;

  const requestFilters = useMemo(() => ({
    ...infoSourceFilters,
    owners: normalizeFilterValues(infoSourceFilters.owners),
    markets: normalizeFilterValues(infoSourceFilters.markets),
    keywords: normalizeFilterValues(infoSourceFilters.keywords),
    citationSeed: infoSourceFilters.useCitationSeed ? citationSeed : null
  }), [infoSourceFilters, citationSeed]);

  useEffect(() => {
    if (!smartNote?.id) {
      return;
    }

    let cancelled = false;

    const loadFilterSettings = async () => {
      try {
        const documents = await getInfoSourceFilterSettings(teamName, assistantName, smartNote.id);
        if (cancelled) {
          return;
        }

        const currentDocument = Array.isArray(documents) && documents.length > 0
          ? documents[0]
          : null;
        filterSettingsRef.current = currentDocument;

        const nextFilters = normalizeStoredInfoSourceFilters(currentDocument?.filters);
        hydratedSmartNoteIdRef.current = smartNote.id;
        lastSavedFiltersRef.current = JSON.stringify(nextFilters);
        setInfoSourceFilters(nextFilters);
      } catch (error) {
        console.error('Failed to load InfoSource filter settings:', error);
        if (!cancelled) {
          filterSettingsRef.current = null;
          hydratedSmartNoteIdRef.current = smartNote.id;
          lastSavedFiltersRef.current = JSON.stringify(DEFAULT_INFO_SOURCE_FILTERS);
          setInfoSourceFilters(DEFAULT_INFO_SOURCE_FILTERS);
        }
      }
    };

    loadFilterSettings();

    return () => {
      cancelled = true;
    };
  }, [assistantName, smartNote?.id, teamName]);

  useEffect(() => {
    if (!smartNote?.id || hydratedSmartNoteIdRef.current !== smartNote.id) {
      return;
    }

    const normalizedFilters = normalizeStoredInfoSourceFilters(infoSourceFilters);
    const serialized = JSON.stringify(normalizedFilters);

    if (serialized === lastSavedFiltersRef.current) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        let persistedDocument = filterSettingsRef.current;

        if (persistedDocument?.id) {
          persistedDocument = await updateInfoSourceFilterSettings(teamName, assistantName, smartNote.id, {
            ...persistedDocument,
            filters: normalizedFilters,
          });
        } else {
          persistedDocument = await createInfoSourceFilterSettings(
            teamName,
            assistantName,
            smartNote.id,
            prepDocument({
              type: 'InfoSourceFilterSettings',
              smartNoteId: smartNote.id,
              parentId: smartNote.id,
              filters: normalizedFilters,
            })
          );
        }

        filterSettingsRef.current = persistedDocument;
        lastSavedFiltersRef.current = JSON.stringify(normalizedFilters);
      } catch (error) {
        console.error('Failed to persist InfoSource filters:', error);
      }
    }, 400);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [assistantName, infoSourceFilters, smartNote, teamName]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const patchFilters = (patch) => {
    setInfoSourceFilters((previous) => ({
      ...previous,
      ...patch
    }));
  };

  const latestCitationCount = Array.isArray(latestInteraction?.citations) ? latestInteraction.citations.length : 0;
  const infoSourceHeaderMeta = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <Box sx={{ px: 1, py: 0.5, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary">Citations: {latestCitationCount}</Typography>
      </Box>
      <Button
        variant="action"
        size="small"
        startIcon={<TuneIcon sx={{ fontSize: 16 }} />}
        onClick={() => setIsFilterOpen(true)}
      >
        Citation Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
      </Button>
    </Box>
  );

  return (
    <>
      <Box sx={{
        display: 'flex',
        flexGrow: 1,
        flexDirection: 'column',
        gap: 1.5,
        height: '100%',
        minHeight: 0,
        width: '100%',
        overflow: 'hidden'
      }}>
        {!DEMO_HIDE_INFO_SOURCE_HERO && (
          <InfoSourceHero onOpenContextPanel={() => setIsContextOpen(true)} />
        )}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', xl: 'row' },
            gap: isLgDown ? 2 : 1.5,
            flexGrow: 1,
            minHeight: 0
          }}
        >
          <Box sx={{ flexBasis: { xs: '100%', xl: '65%' }, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0, display: 'flex' }}>
            <InfoSourceAssistant
              chatInputRef={chatInputRef}
              infoSourceFilters={requestFilters}
              width="max"
              title="Intelligent Sales Agent"
              headerMeta={infoSourceHeaderMeta}
              showHeader={true}
            />
          </Box>
          <Box
            sx={{
              flexBasis: { xs: '100%', xl: '35%' },
              flexGrow: 0,
              flexShrink: 0,
              minWidth: 0,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              overflow: 'hidden'
            }}
          >
            {!DEMO_DISABLE_AGENT_SKILLS_PANEL && (
              <Box sx={{ minHeight: 0, flex: collapsedPanels.agentSkills ? '0 0 auto' : '1 1 0', overflow: 'hidden' }}>
                {collapsedPanels.agentSkills ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, height: 56, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle2">Agent Skills</Typography>
                    <Box sx={{ ml: 'auto' }}>
                      <IconButton size="small" onClick={() => togglePanel('agentSkills')}>
                        <ExpandMoreIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                ) : (
                  <AgentSkillsPanel containerCollapsed={collapsedPanels.agentSkills} onContainerToggle={() => togglePanel('agentSkills')} />
                )}
              </Box>
            )}

            {!DEMO_DISABLE_WHAT_I_REMEMBER_PANEL && (
              <Box sx={{ minHeight: 0, flex: collapsedPanels.whatIRemember ? '0 0 auto' : '1 1 0', overflow: 'hidden' }}>
                {collapsedPanels.whatIRemember ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, height: 56, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle2">What I Remember</Typography>
                    <Box sx={{ ml: 'auto' }}>
                      <IconButton size="small" onClick={() => togglePanel('whatIRemember')}>
                        <ExpandMoreIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                ) : (
                  <WhatIRememberPanel containerCollapsed={collapsedPanels.whatIRemember} onContainerToggle={() => togglePanel('whatIRemember')} />
                )}
              </Box>
            )}

            <Box sx={{ minHeight: 0, flex: collapsedPanels.insightRail ? '0 0 auto' : '1 1 0', overflow: 'hidden' }}>
              {collapsedPanels.insightRail ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, height: 56, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="subtitle2">Insight Rail</Typography>
                  <Box sx={{ ml: 'auto' }}>
                    <IconButton size="small" onClick={() => togglePanel('insightRail')}>
                      <ExpandMoreIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              ) : (
                <InsightRail containerCollapsed={collapsedPanels.insightRail} onContainerToggle={() => togglePanel('insightRail')} />
              )}
            </Box>

            {!DEMO_DISABLE_DEAL_CANVAS_PANEL && (
              <Box sx={{ minHeight: 0, flex: collapsedPanels.dealCanvas ? '0 0 auto' : '1 1 0', overflow: 'hidden' }}>
                {collapsedPanels.dealCanvas ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, height: 56, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle2">Deal Canvas</Typography>
                    <Box sx={{ ml: 'auto' }}>
                      <IconButton size="small" onClick={() => togglePanel('dealCanvas')}>
                        <ExpandMoreIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                ) : (
                  <DealCanvasPanel containerCollapsed={collapsedPanels.dealCanvas} onContainerToggle={() => togglePanel('dealCanvas')} />
                )}
              </Box>
            )}
          </Box>
        </Box>
      </Box>
      <Drawer
        anchor="left"
        open={isContextOpen}
        onClose={() => setIsContextOpen(false)}
        PaperProps={{ sx: { backgroundColor: 'transparent', boxShadow: 'none' } }}
      >
        <Box sx={{ width: { xs: '100vw', sm: 420 }, height: '100%', padding: 2 }}>
          <Sources width="max" />
        </Box>
      </Drawer>
      <InfoSourceFilterDrawer
        open={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onChange={patchFilters}
        onReset={() => setInfoSourceFilters(DEFAULT_INFO_SOURCE_FILTERS)}
        hasCitationSeed={hasCitationSeed}
        filters={infoSourceFilters}
      />
    </>
  );
};

InfoSourceExperience.propTypes = {
  chatInputRef: PropTypes.shape({ current: PropTypes.any })
};

export default InfoSourceExperience;
