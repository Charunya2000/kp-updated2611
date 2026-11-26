'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  getGeisingerPreparationDocumentProgress,
  discoverGeisingerPreparationDocuments,
  getGeisingerPreparationStatus,
  startGeisingerPreparation,
  stopGeisingerPreparation,
} from '@/app/clientServices/geisingerPreparationService';
import {
  createGeisingerConfigContextDocument,
  getGeisingerConfigContextDocuments,
  updateGeisingerConfigContextDocumentById,
} from '@/app/clientServices/geisingerConfigService';
import { getAllSharePointSites } from '@/app/clientServices/sharePointService';
import { prepDocument } from '@/app/clientServices/insertDocument';

const DEFAULT_CONCURRENCY = 1;
const MIN_POLL_INTERVAL_MS = 10000;
const DEFAULT_POLL_INTERVAL_MS = MIN_POLL_INTERVAL_MS;
const DEFAULT_PREPARATION_UI_CONFIG = {
  defaults: {
    concurrency: DEFAULT_CONCURRENCY,
    discoveryRootFolder: 'Shared Documents/Regulatory and Contractual Documents',
    pollingIntervalMs: DEFAULT_POLL_INTERVAL_MS,
  },
  limits: {
    concurrencyInputMin: 1,
    concurrencyInputMax: 10,
  },
};

const PREP_ENGINE_OPTIONS = [
  { value: 'legacy', label: 'service3 (legacy prep)' },
  { value: 'first-principles', label: 'first-principles prep' },
];

const RUNTIME_CONFIG_QUERY = {
  type: 'GeisingerConfig',
  collectionName: 'Document Conversation',
  purpose: 'GeneralConfig',
  title: 'Document Conversation Config For Conversation Prepare',
};

const DEFAULT_RUNTIME_CONFIG_DOC = {
  title: 'Document Conversation Config For Conversation Prepare',
  collectionName: 'Document Conversation',
  purpose: 'GeneralConfig',
  inferredLob: 'All',
  documentText: '{"note":"runtime engine routing config"}',
  prepEngine: 'legacy',
  conversationEngine: 'service3',
  comparisonEngine: 'service3',
  firstPrinciplesSearchEndpointKey: 'searchEndpoint.new.t3',
  firstPrinciplesSearchQueryKey: 'aisearch.new.t3.api.key',
  firstPrinciplesSearchUploadKey: 'aiupload.new.t3.api.key',
  firstPrinciplesCompareJson: '{"enableNearDedup":true,"enableGapRescue":true}',
};

function normalizeString(value) {
  return String(value || '').trim();
}

function ensureRequiredFirstPrinciplesKeys(configDoc = {}) {
  const prepEngine = normalizeString(configDoc?.prepEngine || 'legacy');
  const conversationEngine = normalizeString(configDoc?.conversationEngine || 'service3');
  const comparisonEngine = normalizeString(configDoc?.comparisonEngine || 'service3');

  const usesFirstPrinciples = [prepEngine, conversationEngine, comparisonEngine].includes('first-principles');
  if (!usesFirstPrinciples) {
    return configDoc;
  }

  return {
    ...configDoc,
    firstPrinciplesSearchEndpointKey: normalizeString(configDoc?.firstPrinciplesSearchEndpointKey) || DEFAULT_RUNTIME_CONFIG_DOC.firstPrinciplesSearchEndpointKey,
    firstPrinciplesSearchQueryKey: normalizeString(configDoc?.firstPrinciplesSearchQueryKey) || DEFAULT_RUNTIME_CONFIG_DOC.firstPrinciplesSearchQueryKey,
    firstPrinciplesSearchUploadKey: normalizeString(configDoc?.firstPrinciplesSearchUploadKey) || DEFAULT_RUNTIME_CONFIG_DOC.firstPrinciplesSearchUploadKey,
  };
}

const DEFAULT_DOCUMENTS = [
  {
    lob: 'CHIP',
    preparationVersion: '1',
    status: 'Not Prepared',
    siteName: 'your-site-name',
    fileAName: 'example.pdf',
    relativeAUrl: '/Shared Documents/CHIP/example.pdf',
  },
];

function normalizeInventoryDocument(item = {}) {
  return {
    lob: String(item?.lob || 'Unknown').trim() || 'Unknown',
    preparationVersion: String(item?.preparationVersion || '1').trim() || '1',
    status: String(item?.status || 'Not Prepared').trim() || 'Not Prepared',
    siteName: String(item?.siteName || '').trim(),
    fileAName: String(item?.fileAName || '').trim(),
    relativeAUrl: String(item?.relativeAUrl || '').trim(),
    fileId: item?.fileId ? String(item.fileId).trim() : undefined,
  };
}

function chipColorForStatus(status) {
  if (status === 'Prepared') return 'success';
  if (status === 'Preparing') return 'info';
  if (status === 'Errored') return 'error';
  return 'default';
}

function getProgressPercent(summary) {
  const total = Number(summary?.total || 0);
  if (total === 0) return 0;
  const completeLike = Number(summary?.prepared || 0) + Number(summary?.errored || 0);
  return Math.round((completeLike / total) * 100);
}

function getDocumentSelectionKey(item = {}) {
  const siteName = String(item?.siteName || '').trim().toLowerCase();
  const lob = String(item?.lob || '').trim().toLowerCase();
  const fileAName = String(item?.fileAName || '').trim().toLowerCase();
  const relativeAUrl = String(item?.relativeAUrl || '').trim().toLowerCase();
  const fileId = String(item?.fileId || '').trim().toLowerCase();
  return `${siteName}::${lob}::${fileAName}::${relativeAUrl}::${fileId}`;
}

function getInventoryMatchKey(item = {}) {
  const lob = String(item?.lob || '').trim().toLowerCase();
  const fileAName = String(item?.fileAName || '').trim().toLowerCase();
  const relativeAUrl = String(item?.relativeAUrl || '').trim().toLowerCase();
  return `${lob}::${fileAName}::${relativeAUrl}`;
}

function isNoPreparationJobError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('preparation job not found');
}

function isAuthenticationError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === 'AUTH_REQUIRED'
    || message.includes('session expired')
    || message.includes('not authenticated')
    || message.includes('unauthorized');
}

function getSafePollingIntervalMs(rawValue) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_POLL_INTERVAL_MS;
  }
  return Math.max(Math.floor(parsed), MIN_POLL_INTERVAL_MS);
}

export default function GeisingerPreparationPage() {
  const { teamName } = useParams();
  const pollingRef = useRef(null);

  const [concurrency, setConcurrency] = useState(DEFAULT_CONCURRENCY);
  const [reprocessPrepared, setReprocessPrepared] = useState(false);
  const [inventoryDocuments, setInventoryDocuments] = useState(
    DEFAULT_DOCUMENTS.map((item) => normalizeInventoryDocument(item))
  );

  const [job, setJob] = useState(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isStoppingAndResetting, setIsStoppingAndResetting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [availableSites, setAvailableSites] = useState([]);
  const [targetJobId, setTargetJobId] = useState('');
  const [discoverySiteName, setDiscoverySiteName] = useState('');
  const [discoveryRootFolder, setDiscoveryRootFolder] = useState('Shared Documents');
  const [discoveryLobFolders, setDiscoveryLobFolders] = useState('');
  const [discoveryFileName, setDiscoveryFileName] = useState('');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isLoadingDocProgress, setIsLoadingDocProgress] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [selectedDocumentKey, setSelectedDocumentKey] = useState('');
  const [selectedDocumentProgress, setSelectedDocumentProgress] = useState('');
  const [preparationUiConfig, setPreparationUiConfig] = useState(DEFAULT_PREPARATION_UI_CONFIG);
  const [prepEngineSelection, setPrepEngineSelection] = useState('legacy');
  const [runtimeConfigDocId, setRuntimeConfigDocId] = useState('');
  const [runtimeConfigDraftDoc, setRuntimeConfigDraftDoc] = useState(null);
  const [isLoadingPrepEngineConfig, setIsLoadingPrepEngineConfig] = useState(false);
  const [isSavingPrepEngineConfig, setIsSavingPrepEngineConfig] = useState(false);

  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const groupedItems = useMemo(() => {
    const map = {};
    const items = Array.isArray(job?.items) ? job.items : [];

    for (const item of items) {
      const lob = item?.lob || 'Unknown';
      if (!map[lob]) {
        map[lob] = [];
      }
      map[lob].push(item);
    }

    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [job]);

  const refreshSelectedDocumentProgress = async (item, activeJobId, showSpinner = false) => {
    if (!teamName || !activeJobId || !item?.relativeAUrl || !item?.fileAName) {
      return;
    }

    if (typeof item?.progressMarkdown === 'string' && item.progressMarkdown.trim()) {
      setSelectedDocumentProgress(item.progressMarkdown);
      return;
    }

    try {
      if (showSpinner) setIsLoadingDocProgress(true);
      const detail = await getGeisingerPreparationDocumentProgress(teamName, {
        jobId: activeJobId,
        relativeAUrl: item.relativeAUrl,
        fileAName: item.fileAName,
      });

      setSelectedDocumentProgress(detail?.progressMarkdown || 'No chat progress updates found for this document.');
    } catch (progressError) {
      setSelectedDocumentProgress(progressError?.message || 'Failed to load document progress updates.');
    } finally {
      if (showSpinner) setIsLoadingDocProgress(false);
    }
  };

  const refreshStatus = async (jobId = null, showSpinner = false) => {
    if (!teamName) return;
    if (showSpinner) setIsLoadingStatus(true);

    const normalizedTargetJobId = String(targetJobId || '').trim();
    const effectiveJobId = jobId || normalizedTargetJobId || job?.jobId || null;

    try {
      setError('');
      const latest = await getGeisingerPreparationStatus(teamName, effectiveJobId);
      setJob(latest || null);

      const latestItems = Array.isArray(latest?.items) ? latest.items : [];
      if (latestItems.length) {
        const itemByKey = new Map(
          latestItems.map((item) => [getInventoryMatchKey(item), item])
        );

        setInventoryDocuments((prev) => {
          if (!Array.isArray(prev) || !prev.length) return prev;

          return prev.map((doc) => {
            const match = itemByKey.get(getInventoryMatchKey(doc));
            if (!match) return doc;

            return normalizeInventoryDocument({
              ...doc,
              lob: match?.lob || doc?.lob,
              preparationVersion: match?.preparationVersion || doc?.preparationVersion,
              status: match?.status || doc?.status,
              siteName: match?.siteName || doc?.siteName,
              fileAName: match?.fileAName || doc?.fileAName,
              relativeAUrl: match?.relativeAUrl || doc?.relativeAUrl,
              fileId: match?.fileId || doc?.fileId,
            });
          });
        });
      }

      if (latest?.jobId && selectedDocumentKey) {
        const refreshedSelected = (latest.items || []).find((item) => (
          getDocumentSelectionKey(item) === selectedDocumentKey
        ));
        if (refreshedSelected) {
          setSelectedDocument(refreshedSelected);
          if (typeof refreshedSelected.progressMarkdown === 'string' && refreshedSelected.progressMarkdown.trim()) {
            setSelectedDocumentProgress(refreshedSelected.progressMarkdown);
          }
        } else if (selectedDocument?.relativeAUrl && selectedDocument?.fileAName) {
          // Fallback for older jobs/items missing fields used in the full composite key.
          const fallbackSelected = (latest.items || []).find((item) => (
            String(item?.relativeAUrl || '') === String(selectedDocument.relativeAUrl || '') &&
            String(item?.fileAName || '') === String(selectedDocument.fileAName || '')
          ));
          if (fallbackSelected) {
            setSelectedDocument(fallbackSelected);
            setSelectedDocumentKey(getDocumentSelectionKey(fallbackSelected));
          }
        }
        if (!refreshedSelected?.progressMarkdown) {
          await refreshSelectedDocumentProgress(refreshedSelected || selectedDocument, latest.jobId, false);
        }
      }
      setInfoMessage('');
    } catch (fetchError) {
      if (isAuthenticationError(fetchError)) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setIsPolling(false);
        setError('Session expired. Please sign in again.');
        setInfoMessage('Polling stopped because your session expired.');
        return;
      }

      if (isNoPreparationJobError(fetchError)) {
        setJob(null);
        setError('');
        if (!jobId && !normalizedTargetJobId && !job?.jobId) {
          setInfoMessage('No preparation job exists yet. Discover documents and start a new job.');
        }
      } else {
        setError(fetchError?.message || 'Failed to fetch preparation status');
      }
    } finally {
      if (showSpinner) setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    const loadPreparationConfig = async () => {
      if (!teamName) return;

      try {
        const response = await fetch(`/api/admin/${teamName}/compliance/preparation-v1-config`, {
          method: 'GET',
          cache: 'no-store',
        });
        if (!response.ok) return;

        const snapshot = await response.json();
        const ui = snapshot?.config?.ui;
        if (!ui || typeof ui !== 'object') return;

        const defaults = ui.defaults || {};
        const limits = ui.limits || {};

        const nextConfig = {
          defaults: {
            concurrency: Number(defaults?.concurrency || DEFAULT_CONCURRENCY),
            discoveryRootFolder: String(defaults?.discoveryRootFolder || 'Shared Documents').trim() || 'Shared Documents',
            pollingIntervalMs: getSafePollingIntervalMs(defaults?.pollingIntervalMs),
          },
          limits: {
            concurrencyInputMin: Number(limits?.concurrencyInputMin || 1),
            concurrencyInputMax: Number(limits?.concurrencyInputMax || 10),
          },
        };

        setPreparationUiConfig(nextConfig);
        setConcurrency(nextConfig.defaults.concurrency);
        setDiscoveryRootFolder(nextConfig.defaults.discoveryRootFolder);
      } catch (_) {
        // Keep fallback defaults if config snapshot cannot be loaded.
      }
    };

    loadPreparationConfig();
  }, [teamName]);

  useEffect(() => {
    const loadPrepEngineSelection = async () => {
      if (!teamName) return;

      try {
        setIsLoadingPrepEngineConfig(true);
        const docs = await getGeisingerConfigContextDocuments(teamName, RUNTIME_CONFIG_QUERY);
        const runtimeDoc = Array.isArray(docs) && docs.length > 0 ? docs[0] : null;
        if (!runtimeDoc) {
          setRuntimeConfigDocId('');
          setRuntimeConfigDraftDoc({ ...DEFAULT_RUNTIME_CONFIG_DOC });
          setPrepEngineSelection(DEFAULT_RUNTIME_CONFIG_DOC.prepEngine);
          return;
        }

        setRuntimeConfigDocId(String(runtimeDoc?.id || '').trim());
        setRuntimeConfigDraftDoc(runtimeDoc);
        setPrepEngineSelection(
          String(runtimeDoc?.prepEngine || DEFAULT_RUNTIME_CONFIG_DOC.prepEngine).trim() || DEFAULT_RUNTIME_CONFIG_DOC.prepEngine
        );
      } catch (runtimeConfigError) {
        setError(runtimeConfigError?.message || 'Failed to load prep engine selection from Geisinger config.');
      } finally {
        setIsLoadingPrepEngineConfig(false);
      }
    };

    loadPrepEngineSelection();
  }, [teamName]);

  useEffect(() => {
    refreshStatus(null, true);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [teamName]);

  useEffect(() => {
    const loadSites = async () => {
      if (!teamName) return;

      try {
        const sites = await getAllSharePointSites(teamName);
        const siteNames = (Array.isArray(sites) ? sites : []).map((site) => String(site?.name || '').trim()).filter(Boolean);
        setAvailableSites(siteNames);
        if (!discoverySiteName && siteNames.length) {
          setDiscoverySiteName(siteNames[0]);
        }
      } catch (siteError) {
        setError(siteError?.message || 'Failed to load SharePoint sites');
      }
    };

    loadSites();
  }, [teamName]);

  const handleStartPolling = () => {
    if (isPolling) return;

    setError('');
    setInfoMessage('Polling started.');
    setIsPolling(true);

    refreshStatus(null, false);
    const pollingIntervalMs = getSafePollingIntervalMs(preparationUiConfig?.defaults?.pollingIntervalMs);
    pollingRef.current = setInterval(() => {
      refreshStatus(null, false);
    }, pollingIntervalMs);
  };

  const handleStopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsPolling(false);
    setInfoMessage('Polling stopped.');
  };

  const handleStartBackgroundProcessing = async () => {
    if (!teamName) return;

    const parsedDocs = Array.isArray(inventoryDocuments)
      ? inventoryDocuments
        .map((item) => normalizeInventoryDocument(item))
        .filter((item) => item.siteName && item.fileAName && item.relativeAUrl)
      : [];

    if (!parsedDocs.length) {
      setError('No inventory documents available to start processing. Discover documents or load from a job first.');
      return;
    }

    try {
      setIsStarting(true);
      setError('');
      setInfoMessage('');

      const startedJob = await startGeisingerPreparation(teamName, {
        documents: parsedDocs,
        concurrency,
        reprocessPrepared,
      });

      setTargetJobId(startedJob.jobId || '');
      setJob(startedJob);
      setInfoMessage(`Background processing started (job: ${startedJob.jobId}).`);
      await refreshStatus(startedJob.jobId, false);
    } catch (startError) {
      setError(startError?.message || 'Failed to start background processing.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleSavePrepEngineSelection = async () => {
    if (!teamName) return;

    try {
      setIsSavingPrepEngineConfig(true);
      setError('');

      if (runtimeConfigDocId) {
        const mergedRaw = {
          ...(runtimeConfigDraftDoc || {}),
          prepEngine: prepEngineSelection,
        };
        const merged = ensureRequiredFirstPrinciplesKeys(mergedRaw);

        await updateGeisingerConfigContextDocumentById(teamName, runtimeConfigDocId, merged);
        setRuntimeConfigDraftDoc(merged);
      } else {
        const seedDocRaw = {
          ...DEFAULT_RUNTIME_CONFIG_DOC,
          prepEngine: prepEngineSelection,
        };
        const seedDoc = ensureRequiredFirstPrinciplesKeys(seedDocRaw);
        const createPayload = prepDocument({
          type: 'GeisingerConfig',
          ...seedDoc,
        });

        const createResult = await createGeisingerConfigContextDocument(teamName, createPayload);
        const createdId = String(createResult?.id || createPayload?.id || '').trim();
        setRuntimeConfigDocId(createdId);
        setRuntimeConfigDraftDoc({ ...createPayload, id: createdId || createPayload?.id });
      }

      setInfoMessage(`Prep engine selection saved: ${prepEngineSelection}.`);
    } catch (saveError) {
      setError(saveError?.message || 'Failed to save prep engine selection.');
    } finally {
      setIsSavingPrepEngineConfig(false);
    }
  };

  const handleStopBackgroundProcessing = async () => {
    const requestedJobId = String(targetJobId || '').trim() || job?.jobId;
    if (!teamName || !requestedJobId) {
      setError('No active preparation job is loaded.');
      return;
    }

    try {
      setIsStopping(true);
      setError('');
      const stoppedJob = await stopGeisingerPreparation(teamName, requestedJobId);
      setTargetJobId(stoppedJob?.jobId || requestedJobId);
      setJob(stoppedJob);
      setInfoMessage(`Stop requested for job ${stoppedJob.jobId}.`);
      await refreshStatus(stoppedJob.jobId, false);
    } catch (stopError) {
      setError(stopError?.message || 'Failed to stop background processing.');
    } finally {
      setIsStopping(false);
    }
  };

  const handleStopAndResetBackgroundProcessing = async () => {
    const requestedJobId = String(targetJobId || '').trim() || job?.jobId;
    if (!teamName || !requestedJobId) {
      setError('No active preparation job is loaded.');
      return;
    }

    try {
      setIsStoppingAndResetting(true);
      setError('');
      setInfoMessage('');

      const resetJob = await stopGeisingerPreparation(teamName, requestedJobId, {
        resetToNotPrepared: true,
      });

      setTargetJobId(resetJob?.jobId || requestedJobId);
      setJob(resetJob);
      setSelectedDocument(null);
      setSelectedDocumentProgress('');
      setInfoMessage(`Stop + reset requested for job ${resetJob.jobId}. All items set to Not Prepared.`);
      await refreshStatus(resetJob.jobId, false);
    } catch (stopError) {
      setError(stopError?.message || 'Failed to stop and reset background processing.');
    } finally {
      setIsStoppingAndResetting(false);
    }
  };

  const handleLoadInventoryFromJob = () => {
    const items = Array.isArray(job?.items) ? job.items : [];
    if (!items.length) {
      setError('No job items available to load into inventory.');
      return;
    }

    const inventory = items.map((item) => normalizeInventoryDocument({
      lob: item.lob,
      preparationVersion: item.preparationVersion,
      status: item.status,
      siteName: item.siteName,
      fileAName: item.fileAName,
      relativeAUrl: item.relativeAUrl,
      fileId: item.fileId || undefined,
    }));

    setInventoryDocuments(inventory);
    setInfoMessage('Loaded inventory list from current job items.');
  };

  const handleDiscoverDocuments = async () => {
    if (!teamName) return;

    try {
      setIsDiscovering(true);
      setError('');
      setInfoMessage('');

      const discovered = await discoverGeisingerPreparationDocuments(teamName, {
        siteName: discoverySiteName,
        rootFolder: discoveryRootFolder,
        lobFolders: discoveryLobFolders,
        fileName: discoveryFileName,
      });

      const documents = Array.isArray(discovered?.documents) ? discovered.documents : [];
      setInventoryDocuments(
        documents.map((item) => normalizeInventoryDocument({
          ...item,
          status: item?.status || 'Not Prepared',
        }))
      );

      if (!discoverySiteName && discovered?.siteName) {
        setDiscoverySiteName(discovered.siteName);
      }

      if (Array.isArray(discovered?.availableSites) && discovered.availableSites.length) {
        setAvailableSites(discovered.availableSites);
      }

      setInfoMessage(`Discovered ${documents.length} preparable documents from SharePoint.`);
    } catch (discoverError) {
      setError(discoverError?.message || 'Failed to discover SharePoint documents.');
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleSelectDocument = async (item) => {
    setSelectedDocument(item);
    setSelectedDocumentKey(getDocumentSelectionKey(item));
    setSelectedDocumentProgress('');

    if (!job?.jobId) {
      return;
    }

    await refreshSelectedDocumentProgress(item, job.jobId, true);
  };

  const progressPercent = getProgressPercent(job?.summary);

  return (
    <Paper sx={{ p: 4, maxWidth: '95%', margin: '32px auto' }}>
      <Typography variant="h4" sx={{ mb: 1, fontWeight: 'bold' }}>
        Geisinger Document Preparation
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Start background preparation, then use user-triggered polling to monitor progress.
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          Preparation Engine Selection
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          This selection is persisted in Admin Geisinger config and controls which prep path runs: `service3` legacy prep or `first-principles` prep.
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
          <FormControl sx={{ minWidth: 320 }} disabled={isLoadingPrepEngineConfig || isSavingPrepEngineConfig}>
            <InputLabel id="prep-engine-select-label">Prep Engine</InputLabel>
            <Select
              labelId="prep-engine-select-label"
              value={prepEngineSelection}
              label="Prep Engine"
              onChange={(event) => setPrepEngineSelection(String(event.target.value || 'legacy'))}
            >
              {PREP_ENGINE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="contained"
            onClick={handleSavePrepEngineSelection}
            disabled={isLoadingPrepEngineConfig || isSavingPrepEngineConfig}
          >
            {isSavingPrepEngineConfig ? 'Saving...' : 'Save Prep Engine'}
          </Button>

          <Chip
            size="small"
            color="default"
            label={`Config doc: ${runtimeConfigDocId || 'not created yet'}`}
          />
        </Stack>
      </Paper>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {infoMessage ? <Alert severity="info" sx={{ mb: 2 }}>{infoMessage}</Alert> : null}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <FormControl sx={{ minWidth: 280 }}>
          <InputLabel id="discovery-site-label">Discovery Site</InputLabel>
          <Select
            labelId="discovery-site-label"
            value={discoverySiteName}
            label="Discovery Site"
            onChange={(event) => setDiscoverySiteName(event.target.value)}
          >
            {availableSites.map((site) => (
              <MenuItem key={site} value={site}>{site}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Discovery Root Folder"
          value={discoveryRootFolder}
          onChange={(event) => setDiscoveryRootFolder(event.target.value)}
          sx={{ minWidth: 280 }}
        />

        <TextField
          label="LOB Folders (comma-separated, optional)"
          value={discoveryLobFolders}
          onChange={(event) => setDiscoveryLobFolders(event.target.value)}
          sx={{ minWidth: 320 }}
        />

        <TextField
          label="Specific Filename (optional)"
          value={discoveryFileName}
          onChange={(event) => setDiscoveryFileName(event.target.value)}
          helperText="Use only when exactly one LOB folder is entered"
          sx={{ minWidth: 320 }}
        />

        <Button
          variant="contained"
          color="secondary"
          onClick={handleDiscoverDocuments}
          disabled={isDiscovering || !discoverySiteName}
        >
          {isDiscovering ? 'Discovering...' : 'Discover Documents'}
        </Button>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2, flexWrap: 'wrap' }}>
        <TextField
          label="Target Job ID (optional)"
          value={targetJobId}
          onChange={(event) => setTargetJobId(event.target.value)}
          helperText="If set, refresh/stop actions use this job id"
          sx={{ minWidth: 320 }}
        />

        <TextField
          label="Concurrent Processing Count"
          type="number"
          value={concurrency}
          onChange={(event) => {
            const value = Number.parseInt(event.target.value, 10);
            const min = Number(preparationUiConfig?.limits?.concurrencyInputMin || 1);
            const max = Number(preparationUiConfig?.limits?.concurrencyInputMax || 10);
            const normalized = Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : Number(preparationUiConfig?.defaults?.concurrency || DEFAULT_CONCURRENCY);
            setConcurrency(normalized);
          }}
          inputProps={{ min: Number(preparationUiConfig?.limits?.concurrencyInputMin || 1), max: Number(preparationUiConfig?.limits?.concurrencyInputMax || 10) }}
          sx={{ width: 280 }}
        />

        <FormControlLabel
          control={(
            <Checkbox
              checked={reprocessPrepared}
              onChange={(event) => setReprocessPrepared(event.target.checked)}
            />
          )}
          label="Reprocess already prepared"
        />

        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            alignItems: 'center',
          }}
        >
          <Button
            variant="contained"
            onClick={handleStartBackgroundProcessing}
            disabled={isStarting}
          >
            {isStarting ? 'Starting...' : 'Start Background Processing'}
          </Button>

          <Button
            variant="outlined"
            onClick={handleStartPolling}
            disabled={isPolling}
          >
            Start Polling
          </Button>

          <Button
            variant="outlined"
            color="warning"
            onClick={handleStopPolling}
            disabled={!isPolling}
          >
            Stop Polling
          </Button>

          <Button
            variant="outlined"
            color="error"
            onClick={handleStopBackgroundProcessing}
            disabled={isStopping || isStoppingAndResetting || (!job?.jobId && !targetJobId.trim())}
          >
            {isStopping ? 'Stopping...' : 'Stop Background Processing'}
          </Button>

          <Button
            variant="outlined"
            color="error"
            onClick={handleStopAndResetBackgroundProcessing}
            disabled={isStopping || isStoppingAndResetting || (!job?.jobId && !targetJobId.trim())}
          >
            {isStoppingAndResetting ? 'Stopping + Resetting...' : 'Stop + Reset to Not Prepared'}
          </Button>

          <Button
            variant="text"
            onClick={() => refreshStatus(null, true)}
            disabled={isLoadingStatus}
          >
            {isLoadingStatus ? 'Refreshing...' : 'Refresh Once'}
          </Button>

          <Button
            variant="text"
            onClick={handleLoadInventoryFromJob}
            disabled={!job?.items?.length}
          >
            Load Inventory From Job
          </Button>
        </Box>
      </Stack>

      <Paper variant="outlined" sx={{ mb: 3, overflow: 'hidden' }}>
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Document Inventory
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Simple file list used for preparation: LOB, version, status, site, file, and path.
          </Typography>
        </Box>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>LOB</TableCell>
              <TableCell>Version</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Site</TableCell>
              <TableCell>File</TableCell>
              <TableCell>Path</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {inventoryDocuments.length ? inventoryDocuments.map((item) => (
              <TableRow key={getDocumentSelectionKey(item)}>
                <TableCell>{item.lob || 'Unknown'}</TableCell>
                <TableCell>{item.preparationVersion || '1'}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={item.status || 'Not Prepared'}
                    color={chipColorForStatus(item.status)}
                  />
                </TableCell>
                <TableCell>{item.siteName || '-'}</TableCell>
                <TableCell>{item.fileAName || '-'}</TableCell>
                <TableCell sx={{ wordBreak: 'break-all' }}>{item.relativeAUrl || '-'}</TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary">
                    No inventory loaded. Use Discover Documents or Load Inventory From Job.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Divider sx={{ mb: 2 }} />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <Chip label={`Job: ${job?.jobId || 'None'}`} />
        <Chip label={`Status: ${job?.status || 'Unknown'}`} color={job?.status === 'processing' ? 'info' : 'default'} />
        <Chip label={`Prepared: ${job?.summary?.prepared || 0}`} color="success" />
        <Chip label={`Preparing: ${job?.summary?.preparing || 0}`} color="info" />
        <Chip label={`Not Prepared: ${job?.summary?.notPrepared || 0}`} />
        <Chip label={`Errored: ${job?.summary?.errored || 0}`} color="error" />
      </Stack>

      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Overall Progress: {progressPercent}%
        </Typography>
        <LinearProgress variant="determinate" value={progressPercent} />
      </Box>

      {isLoadingStatus ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : null}

      {!isLoadingStatus && groupedItems.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No document status available. Start a job or refresh status.
        </Typography>
      ) : null}

      {groupedItems.map(([lob, items]) => (
        <Box key={lob} sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            {lob}
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Document</TableCell>
                <TableCell>Path</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Error</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow
                  key={`${item.relativeAUrl}-${item.fileAName}`}
                  hover
                  selected={
                    getDocumentSelectionKey(selectedDocument) === getDocumentSelectionKey(item)
                  }
                  onClick={() => handleSelectDocument(item)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>{item.fileAName}</TableCell>
                  <TableCell sx={{ wordBreak: 'break-all' }}>{item.relativeAUrl}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={item.status || 'Not Prepared'}
                      color={chipColorForStatus(item.status)}
                    />
                  </TableCell>
                  <TableCell sx={{ maxWidth: 380, wordBreak: 'break-word' }}>
                    {item.lastError || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      ))}

      {selectedDocument ? (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Document Progress Updates
          </Typography>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            {selectedDocument.fileAName}
          </Typography>
          <Paper variant="outlined" sx={{ p: 2, maxHeight: 360, overflow: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
            {isLoadingDocProgress ? 'Loading progress updates...' : (selectedDocumentProgress || 'No progress selected.')}
          </Paper>
        </Box>
      ) : null}
    </Paper>
  );
}
