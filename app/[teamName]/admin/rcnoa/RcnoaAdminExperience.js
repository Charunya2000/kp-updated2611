'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  CloudDownload,
  DeleteOutline,
  EditOutlined,
  ExpandLess,
  ExpandMore,
  PlayArrow,
  Refresh,
  Replay,
  Save,
  Science,
  Settings,
  SpaceDashboard,
  Troubleshoot,
  UploadFile,
} from '@mui/icons-material';
import RcnoaDiagnostic from './RcnoaDiagnostic';
import {
  createMockRcnoaRun,
  deleteRcnoaRun,
  downloadRcnoaArtifact,
  generateRcnoa834,
  getRcnoaAdminState,
  getRcnoaRun,
  processNextAdhocRcnoaRun,
  retryRcnoaRun,
  saveRcnoaBusinessConfiguration,
  saveRcnoaQueryConfiguration,
  saveRcnoaRunNote,
  saveRcnoaSchedule,
  upload834ForDelivery,
  uploadAndStartRcnoaRun,
  uploadRcnaForPriorLookup,
} from '@/app/clientServices/rcnoaService';

const ACTIVE_STATUSES = new Set(['AWAITING_UPLOAD', 'QUEUED', 'PROCESSING']);
const SKIPPED_834_ARTIFACT_TYPE = 'skipped-834-records';

function artifactButtonLabel(artifact) {
  return artifact.artifactType === SKIPPED_834_ARTIFACT_TYPE
    ? 'Download Records skipped from 834 file'
    : artifact.artifactType;
}

function skipped834Note(run) {
  const outputs = (run.artifacts || []).filter((artifact) => artifact.direction === 'output');
  const hasSkippedFile = outputs.some((artifact) => artifact.artifactType === SKIPPED_834_ARTIFACT_TYPE);
  const has834File = outputs.some((artifact) => artifact.artifactType === '834');
  if (hasSkippedFile) {
    const count = run.counts?.members834Skipped;
    return {
      severity: 'warning',
      text: `${count ? `${count} qualified RCNA record(s) were` : 'Qualified RCNA records were'} skipped from the 834 file because required data was missing.${has834File ? '' : ' No 834 file was generated because all qualified records were skipped.'} Use "Download Records skipped from 834 file" to review them.`,
    };
  }
  if (has834File) return { severity: 'info', text: 'No qualified RCNA records were skipped.' };
  return null;
}
const DELETABLE_STATUSES = new Set(['AWAITING_UPLOAD', 'AWAITING_RCNA_REVIEW', 'COMPLETE', 'PARTIAL', 'ERROR', 'CANCELED', 'SKIPPED']);
const DAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];
const TEST_RCNA_CODES = [
  'MM', 'DM501', 'AE500', 'AE501', 'AC500', 'CE500', 'AC501', 'CE501', 'KICKO', 'AE999',
];

const TEST_ENVELOPE = {
  senderQualifier: 'ZZ',
  senderId: 'TEST_SENDER',
  receiverQualifier: 'ZZ',
  receiverId: 'TEST_RECEIVER',
  usageIndicator: 'T',
  acknowledgmentRequested: '0',
  interchangeControlNumber: '1',
  applicationSenderCode: 'TEST_SENDER',
  applicationReceiverCode: 'TEST_RECEIVER',
  groupControlNumber: '1',
  transactionControlNumber: '1',
  transactionReference: 'RCNOA-TEST-1',
  groupNumber: 'TEST_GROUP',
  subgroupNumber: '',
  regionCode: '',
  sponsor: { name: 'TEST SPONSOR', idQualifier: 'FI', id: '000000000' },
  payer: { name: 'TEST PAYER', idQualifier: 'FI', id: '000000000' },
};

const TEST_INTENT = {
  bgnAction: '2',
  maintenanceType: '001',
  maintenanceReason: 'AI',
  benefitStatus: 'A',
  coverageLevel: 'FAM',
};

function testBusinessConfiguration(configuration) {
  return {
    ...configuration,
    n12Code: 'AE999',
    envelope: JSON.stringify(TEST_ENVELOPE, null, 2),
    intentByCode: JSON.stringify(Object.fromEntries(
      TEST_RCNA_CODES.map((code) => [code, TEST_INTENT]),
    ), null, 2),
    relationshipMap: JSON.stringify({ S: '18', '01': '01', '19': '19' }, null, 2),
    addressLine3Mode: 'reject',
    mappingApproved: false,
    skip834Creation: false,
  };
}

function statusColor(status) {
  if (status === 'COMPLETE') return 'success';
  if (status === 'AWAITING_RCNA_REVIEW' || status === 'PARTIAL' || status === 'SKIPPED') return 'warning';
  if (status === 'ERROR' || status === 'CANCELED') return 'error';
  if (status === 'PROCESSING') return 'info';
  return 'default';
}

function dateTime(value) {
  return value ? new Date(value).toLocaleString() : '-';
}

function duration(run) {
  if (!run.startedAt) return '-';
  const end = run.finishedAt ? new Date(run.finishedAt) : new Date();
  const seconds = Math.max(0, Math.round((end - new Date(run.startedAt)) / 1000));
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

const STAGE_LABELS = {
  AWAITING_UPLOAD: 'Awaiting upload',
  QUEUED: 'Queued',
  LOADING_CONFIGURATION: 'Loading configuration',
  LOADING_INPUT: 'Loading input',
  LOADING_LOOKUPS: 'Loading lookups',
  TRANSFORMING: 'Transforming',
  STAGING_RCNA: 'Staging RCNA',
  STAGING_ERROR_REPORT: 'Staging error report',
  SAVING_PRIOR_RCNA: 'Saving prior RCNA',
  IMPORTING_RCNA: 'Importing RCNA',
  FINALIZING: 'Finalizing',
};

const PROGRESS_BAR_SEGMENTS = 10;

function currentReconciliationCycle() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}${values.month}`;
}

function filledBar(percent) {
  const filledSegments = Math.max(
    0,
    Math.min(PROGRESS_BAR_SEGMENTS, Math.round((percent / 100) * PROGRESS_BAR_SEGMENTS)),
  );
  return `${'▰'.repeat(filledSegments)}${'▱'.repeat(PROGRESS_BAR_SEGMENTS - filledSegments)}`;
}

function indeterminateBar(run) {
  const seed = Number(String(run.updatedAt || run.createdAt || '').replace(/\D/g, '').slice(-2)) || 0;
  const activeIndex = seed % PROGRESS_BAR_SEGMENTS;
  return Array.from({ length: PROGRESS_BAR_SEGMENTS }, (_, index) => (
    index >= activeIndex && index < activeIndex + 3 ? '▰' : '▱'
  )).join('');
}

function runProgress(run) {
  if (run.status !== 'PROCESSING' || run.currentStage !== 'TRANSFORMING') return null;
  if (run.counts?.received > 0) {
    const percent = Math.min(
      100,
      Math.round((run.counts.processed / run.counts.received) * 100),
    );
    return {
      determinate: true,
      percent,
      bar: filledBar(percent),
      label: `${percent}% \u2014 ${run.counts.processed} / ${run.counts.received} rows processed`,
    };
  }
  return null;
}

function editableBusinessConfiguration(configuration) {
  if (!configuration) return null;
  return {
    ...configuration,
    envelope: JSON.stringify(configuration.envelope || {}, null, 2),
    intentByCode: JSON.stringify(configuration.intentByCode || {}, null, 2),
    relationshipMap: JSON.stringify(configuration.relationshipMap || {}, null, 2),
    priorRcnaMatchKeySecret: '',
  };
}

export default function RcnoaAdminExperience({ teamName }) {
  const fileInputRef = useRef(null);
  const rcnaInputRef = useRef(null);
  const x834InputRef = useRef(null);
  const [state, setState] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [businessConfiguration, setBusinessConfiguration] = useState(null);
  const [queryConfiguration, setQueryConfiguration] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [adhocSource, setAdhocSource] = useState('upload');
  const [rcnaReconciliationCycle, setRcnaReconciliationCycle] = useState(currentReconciliationCycle);
  const [selectedFixtureId, setSelectedFixtureId] = useState('');
  const [expandedRunId, setExpandedRunId] = useState('');
  const [runDetails, setRunDetails] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingConfiguration, setIsSavingConfiguration] = useState(false);
  const [isSavingQueries, setIsSavingQueries] = useState(false);
  const [isProcessingAdhoc, setIsProcessingAdhoc] = useState(false);
  const [activeFileOperation, setActiveFileOperation] = useState('');
  const [deleteRunId, setDeleteRunId] = useState('');
  const [isDeletingRun, setIsDeletingRun] = useState(false);
  const [noteRunId, setNoteRunId] = useState('');
  const [runNote, setRunNote] = useState('');
  const [isSavingRunNote, setIsSavingRunNote] = useState(false);
  const [uploadStage, setUploadStage] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refresh = async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const result = await getRcnoaAdminState(teamName, {
        page: page + 1,
        pageSize,
        status: statusFilter,
        mode: modeFilter,
      });
      setState(result);
      setSchedule((current) => current || result.schedule);
      setBusinessConfiguration((current) => (
        current || editableBusinessConfiguration(result.businessConfiguration)
      ));
      setQueryConfiguration((current) => current || result.queryConfiguration);
      setSelectedFixtureId((current) => current || result.mockFixtures?.[0]?.id || '');
      setError('');
    } catch (refreshError) {
      setError(refreshError.message);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    refresh(true);
  }, [teamName, page, pageSize, statusFilter, modeFilter]);

  const hasActiveRun = (state?.runs?.items || []).some((run) => run.status === 'PROCESSING');

  useEffect(() => {
    const intervalMs = hasActiveRun ? 5000 : 10000;
    const interval = window.setInterval(() => refresh(false), intervalMs);
    return () => window.clearInterval(interval);
  }, [hasActiveRun, teamName, page, pageSize, statusFilter, modeFilter]);

  const handleSaveSchedule = async () => {
    setIsSaving(true);
    try {
      const result = await saveRcnoaSchedule(teamName, schedule);
      setSchedule(result.schedule);
      setMessage('Schedule saved.');
      setError('');
      await refresh(false);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveQueries = async () => {
    setIsSavingQueries(true);
    try {
      const result = await saveRcnoaQueryConfiguration(teamName, queryConfiguration);
      setQueryConfiguration(result.queryConfiguration);
      setMessage('Oracle queries saved. New runs will use this version.');
      setError('');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSavingQueries(false);
    }
  };

  const handleSaveConfiguration = async () => {
    setIsSavingConfiguration(true);
    try {
      const result = await saveRcnoaBusinessConfiguration(teamName, businessConfiguration);
      setBusinessConfiguration(editableBusinessConfiguration(result.businessConfiguration));
      setMessage('Business configuration saved. New runs will use this version.');
      setError('');
      await refresh(false);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSavingConfiguration(false);
    }
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      setError('RCNO files cannot exceed 100 MB.');
      return;
    }
    setUploadStage('reserving');
    try {
      await uploadAndStartRcnoaRun(teamName, file, setUploadStage);
      setMessage('RCNO file queued for processing.');
      setError('');
      await refresh(false);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploadStage('');
    }
  };

  const handleProcessNext = async () => {
    setIsProcessingAdhoc(true);
    try {
      const lookupSource = adhocSource === 'mock' ? 'mock' : 'live';
      const result = await processNextAdhocRcnoaRun(teamName, lookupSource);
      if (!result.run) {
        setMessage(`No queued ${lookupSource} ad hoc run is available.`);
      } else {
        setMessage(`Run ${result.run.id} finished with status ${result.run.status}.`);
      }
      setError('');
      await refresh(false);
    } catch (processError) {
      setError(processError.message);
    } finally {
      setIsProcessingAdhoc(false);
    }
  };

  const handleOperationUpload = async (event, operation) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      setError('RCNOA files cannot exceed 100 MB.');
      return;
    }
    setActiveFileOperation(operation);
    try {
      const result = operation === 'rcna'
        ? await uploadRcnaForPriorLookup(teamName, file, rcnaReconciliationCycle)
        : await upload834ForDelivery(teamName, file);
      setMessage(operation === 'rcna'
        ? `RCNA imported for cycle ${rcnaReconciliationCycle} in run ${result.run.id}.`
        : `834 delivered to outbound SFTP for run ${result.run.id}.`);
      setError('');
      await refresh(false);
    } catch (operationError) {
      setError(operationError.message);
    } finally {
      setActiveFileOperation('');
    }
  };

  const handleGenerate834 = async (runId) => {
    setActiveFileOperation(runId);
    try {
      await generateRcnoa834(teamName, runId);
      setExpandedRunId('');
      setRunDetails((current) => {
        const next = { ...current };
        delete next[runId];
        return next;
      });
      setMessage(`834 generated for run ${runId}.`);
      setError('');
      await refresh(false);
    } catch (generationError) {
      setError(generationError.message);
    } finally {
      setActiveFileOperation('');
    }
  };

  const openRunNote = (run) => {
    setNoteRunId(run.id);
    setRunNote(run.note || '');
  };

  const handleSaveRunNote = async () => {
    setIsSavingRunNote(true);
    try {
      await saveRcnoaRunNote(teamName, noteRunId, runNote);
      setNoteRunId('');
      setRunNote('');
      setMessage('Run note saved.');
      setError('');
      await refresh(false);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSavingRunNote(false);
    }
  };

  const handleQueueMockFixture = async () => {
    if (!selectedFixtureId) return;
    setUploadStage('mock');
    try {
      const result = await createMockRcnoaRun(teamName, selectedFixtureId);
      setMessage(`Predefined test ${result.run.mockFixtureId} queued.`);
      setError('');
      await refresh(false);
    } catch (mockError) {
      setError(mockError.message);
    } finally {
      setUploadStage('');
    }
  };

  const toggleRun = async (runId) => {
    if (expandedRunId === runId) {
      setExpandedRunId('');
      return;
    }
    setExpandedRunId(runId);
    try {
      const detail = await getRcnoaRun(teamName, runId);
      setRunDetails((current) => ({
        ...current,
        [runId]: {
          run: detail.run,
          failures: detail.run.failures || { page: 1, pageSize: 25, total: 0, items: [] },
        },
      }));
    } catch (detailError) {
      setError(detailError.message);
    }
  };

  const handleRetry = async (runId) => {
    try {
      await retryRcnoaRun(teamName, runId);
      setMessage('Retry queued.');
      await refresh(false);
    } catch (retryError) {
      setError(retryError.message);
    }
  };

  const handleDeleteRun = async () => {
    if (!deleteRunId) return;
    setIsDeletingRun(true);
    try {
      await deleteRcnoaRun(teamName, deleteRunId);
      setExpandedRunId((current) => current === deleteRunId ? '' : current);
      setRunDetails((current) => {
        const next = { ...current };
        delete next[deleteRunId];
        return next;
      });
      setDeleteRunId('');
      setMessage('Run and its stored artifacts deleted.');
      setError('');
      await refresh(false);
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setIsDeletingRun(false);
    }
  };

  if (isLoading && !state) {
    return <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;
  }

  const runs = state?.runs?.items || [];
  const latest = runs[0];
  const readiness = state?.readiness;
  const blockers = [...(readiness?.missing || []), ...(readiness?.invalid || []), ...(readiness?.pendingContracts || [])];
  const scheduledReadiness = state?.scheduledReadiness;
  const scheduledBlockers = [
    ...(scheduledReadiness?.missing || []),
    ...(scheduledReadiness?.invalid || []),
    ...(scheduledReadiness?.pendingContracts || []),
  ];
  const mockReadiness = state?.mockReadiness;
  const mockBlockers = [
    ...(mockReadiness?.missing || []),
    ...(mockReadiness?.invalid || []),
    ...(mockReadiness?.pendingContracts || []),
  ];
  const selectedAdhocReadiness = adhocSource === 'mock' ? mockReadiness : readiness;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1600, mx: 'auto' }}>
      <Stack spacing={2.5}>
        {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
        {message && <Alert severity="success" onClose={() => setMessage('')}>{message}</Alert>}
        {adhocSource === 'upload' && readiness && !readiness.ready && (
          <Alert severity="warning">
            Ad hoc processing is blocked: {blockers.join(', ') || 'configuration is incomplete'}
          </Alert>
        )}
        {adhocSource === 'mock' && mockReadiness && !mockReadiness.ready && (
          <Alert severity="warning">
            Mock processing is blocked: {mockBlockers.join(', ') || 'configuration is incomplete'}
          </Alert>
        )}
        {schedule?.enabled && scheduledReadiness && !scheduledReadiness.ready && (
          <Alert severity="warning">
            Scheduled processing is blocked: {scheduledBlockers.join(', ') || 'configuration is incomplete'}
          </Alert>
        )}

        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={(event, value) => setActiveTab(value)}
            aria-label="RCNOA administration views"
            sx={(theme) => ({
              '& .MuiTab-root.Mui-selected': {
                color: `${theme.palette.primary.main} !important`,
              },
            })}
          >
            <Tab icon={<SpaceDashboard />} iconPosition="start" label="Operations" />
            <Tab icon={<Settings />} iconPosition="start" label="Configuration" />
            <Tab icon={<Troubleshoot />} iconPosition="start" label="Diagnostic" />
          </Tabs>
        </Box>

        <Box component="section" hidden={activeTab !== 2} sx={{ display: activeTab === 2 ? 'block' : 'none' }}>
          <RcnoaDiagnostic
            teamName={teamName}
            ignoreFirstRcnoColumn={businessConfiguration?.ignoreFirstRcnoColumn}
            ignoreLastRcnoColumn={businessConfiguration?.ignoreLastRcnoColumn}
          />
        </Box>

        <Box component="section" hidden={activeTab !== 0} sx={{ display: activeTab === 0 ? 'grid' : 'none', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 2 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', pb: 2 }}>
            <Typography variant="h5" sx={{ mb: 1 }}>Operations</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Chip label={`Latest: ${latest?.status || 'No runs'}`} color={statusColor(latest?.status)} />
              <Chip label={`Processed: ${latest?.counts?.processed || 0}`} variant="outlined" />
              <Chip label={`Failed: ${latest?.counts?.failed || 0}`} variant="outlined" />
              <Chip label={`Next: ${dateTime(schedule?.nextScheduledAt)}`} variant="outlined" />
            </Stack>
            {latest && ACTIVE_STATUSES.has(latest.status) && <LinearProgress sx={{ mt: 2 }} />}
          </Box>
          <Stack spacing={1} alignItems={{ lg: 'flex-end' }}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={adhocSource}
              onChange={(event, value) => value && setAdhocSource(value)}
              aria-label="Ad hoc input source"
            >
              <ToggleButton value="upload"><UploadFile sx={{ mr: 0.75 }} fontSize="small" />Upload file</ToggleButton>
              <ToggleButton value="mock" disabled={!state?.mockFixturesEnabled}><Science sx={{ mr: 0.75 }} fontSize="small" />Predefined mock</ToggleButton>
            </ToggleButtonGroup>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
            <input ref={fileInputRef} type="file" accept=".rcno,.txt,text/plain" hidden onChange={handleFile} />
              {adhocSource === 'upload' ? (
                <Button variant="primary" startIcon={<UploadFile />} onClick={() => fileInputRef.current?.click()} disabled={Boolean(uploadStage)}>
                  {uploadStage ? 'Uploading' : 'Upload RCNO'}
                </Button>
              ) : (
                <>
                  <FormControl size="small" sx={{ minWidth: { xs: 260, sm: 360 } }}>
                    <InputLabel>Predefined test file</InputLabel>
                    <Select
                      label="Predefined test file"
                      value={selectedFixtureId}
                      onChange={(event) => setSelectedFixtureId(event.target.value)}
                    >
                      {(state?.mockFixtures || []).map((fixture) => (
                        <MenuItem key={fixture.id} value={fixture.id}>
                          {fixture.label} ({fixture.rowCount > 1
                            ? `${fixture.rowCount} rows${fixture.rcnaOnly ? ', RCNA only' : ''}`
                            : fixture.expectedCode})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    variant="primary"
                    startIcon={<Science />}
                    onClick={handleQueueMockFixture}
                    disabled={Boolean(uploadStage) || !selectedFixtureId || !mockReadiness?.ready}
                  >
                    {uploadStage === 'mock' ? 'Queuing' : 'Queue test'}
                  </Button>
                </>
              )}
            <Button
              variant="positive"
              startIcon={isProcessingAdhoc ? <CircularProgress size={18} color="inherit" /> : <PlayArrow />}
              onClick={handleProcessNext}
              disabled={isProcessingAdhoc || !selectedAdhocReadiness?.ready}
            >
              {isProcessingAdhoc ? 'Processing' : 'Process queued'}
            </Button>
            <Tooltip title="Refresh runs"><IconButton onClick={() => refresh(true)}><Refresh /></IconButton></Tooltip>
            </Stack>
          </Stack>
        </Box>

        <Box component="section" hidden={activeTab !== 0} sx={{ display: activeTab === 0 ? 'block' : 'none', borderBottom: 1, borderColor: 'divider', pb: 3 }}>
          <Typography variant="h5" sx={{ mb: 0.5 }}>Manual file actions</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Import a reviewed RCNA into cycle-scoped prior history, or send an existing 834 file to the outbound SFTP folder.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              label="Reconciliation cycle"
              value={rcnaReconciliationCycle}
              onChange={(event) => setRcnaReconciliationCycle(event.target.value)}
              inputProps={{ inputMode: 'numeric', pattern: '\\d{6}', maxLength: 6 }}
              helperText="YYYYMM for B200 prior-decision lookup"
              error={!/^\d{4}(0[1-9]|1[0-2])$/.test(rcnaReconciliationCycle)}
              size="small"
            />
            <input ref={rcnaInputRef} type="file" accept=".rcna,.txt,text/plain" hidden onChange={(event) => handleOperationUpload(event, 'rcna')} />
            <Button
              variant="secondary"
              startIcon={activeFileOperation === 'rcna' ? <CircularProgress size={18} color="inherit" /> : <UploadFile />}
              onClick={() => rcnaInputRef.current?.click()}
              disabled={Boolean(activeFileOperation) || !/^\d{4}(0[1-9]|1[0-2])$/.test(rcnaReconciliationCycle)}
            >
              {activeFileOperation === 'rcna' ? 'Importing RCNA' : 'Import RCNA into prior history'}
            </Button>
            <input ref={x834InputRef} type="file" accept=".834,.x12,.edi,.txt,text/plain,application/edi-x12" hidden onChange={(event) => handleOperationUpload(event, '834')} />
            <Button
              variant="primary"
              startIcon={activeFileOperation === '834' ? <CircularProgress size={18} color="inherit" /> : <UploadFile />}
              onClick={() => x834InputRef.current?.click()}
              disabled={Boolean(activeFileOperation)}
            >
              {activeFileOperation === '834' ? 'Sending 834' : 'Upload 834 to outbound SFTP'}
            </Button>
          </Stack>
        </Box>

        <Box component="section" hidden={activeTab !== 0} sx={{ display: activeTab === 0 ? 'block' : 'none', borderBottom: 1, borderColor: 'divider', pb: 3 }}>
          <Typography variant="h5" sx={{ mb: 2 }}>Schedule</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            <FormControlLabel control={<Checkbox checked={Boolean(schedule?.enabled)} onChange={(event) => setSchedule({ ...schedule, enabled: event.target.checked })} />} label="Enabled" />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Frequency</InputLabel>
              <Select label="Frequency" value={schedule?.frequency?.unit || 'daily'} onChange={(event) => setSchedule({ ...schedule, frequency: { ...schedule.frequency, unit: event.target.value } })}>
                <MenuItem value="daily">Daily</MenuItem>
                <MenuItem value="weekdays">Selected weekdays</MenuItem>
                <MenuItem value="monthly">Day of month</MenuItem>
              </Select>
            </FormControl>
            <TextField size="small" type="time" label="Start time" value={schedule?.startTime || '08:30'} onChange={(event) => setSchedule({ ...schedule, startTime: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField size="small" label="Time zone" value="Pacific Time" disabled />
            <Button variant="positive" startIcon={<Save />} onClick={handleSaveSchedule} disabled={isSaving}>{isSaving ? 'Saving' : 'Save'}</Button>
          </Stack>
          {schedule?.frequency?.unit === 'weekdays' && (
            <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap' }}>
              {DAYS.map((day) => (
                <FormControlLabel key={day.value} label={day.label} control={<Checkbox size="small" checked={(schedule.frequency.daysOfWeek || []).includes(day.value)} onChange={(event) => {
                  const current = schedule.frequency.daysOfWeek || [];
                  const daysOfWeek = event.target.checked ? [...current, day.value] : current.filter((value) => value !== day.value);
                  setSchedule({ ...schedule, frequency: { ...schedule.frequency, daysOfWeek } });
                }} />} />
              ))}
            </Stack>
          )}
          {schedule?.frequency?.unit === 'monthly' && (
            <TextField
              size="small"
              type="number"
              label="Day of month"
              value={schedule.frequency.dayOfMonth || 1}
              onChange={(event) => setSchedule({
                ...schedule,
                frequency: { ...schedule.frequency, dayOfMonth: Number(event.target.value) },
              })}
              helperText="For shorter months, runs on the last day."
              slotProps={{ htmlInput: { min: 1, max: 31, step: 1 } }}
              sx={{ mt: 1, width: 220 }}
            />
          )}
        </Box>

        <Box component="section" hidden={activeTab !== 1} sx={{ display: activeTab === 1 ? 'block' : 'none', borderBottom: 1, borderColor: 'divider', pb: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h5">Business and transformation</Typography>
              <Typography variant="body2" color="text.secondary">
                These values are stored in MongoDB and apply to new processing runs.
              </Typography>
            </Box>
            <Chip size="small" variant="outlined" label={`Version ${businessConfiguration?.version || 1}`} />
            {state?.mockFixturesEnabled && (
              <Button
                variant="action"
                startIcon={<Science />}
                onClick={() => setBusinessConfiguration(testBusinessConfiguration(businessConfiguration))}
                disabled={isSavingConfiguration || !businessConfiguration}
              >
                Load test template
              </Button>
            )}
            <Button
              variant="positive"
              startIcon={<Save />}
              onClick={handleSaveConfiguration}
              disabled={isSavingConfiguration || !businessConfiguration}
            >
              {isSavingConfiguration ? 'Saving' : 'Save configuration'}
            </Button>
          </Stack>

          <Stack spacing={2.5}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(180px, 1fr) minmax(240px, 1fr)' }, gap: 2 }}>
              <TextField
                label="N12 code"
                value={businessConfiguration?.n12Code || 'AE999'}
                onChange={(event) => setBusinessConfiguration({ ...businessConfiguration, n12Code: event.target.value })}
                helperText="Approved default: AE999"
                size="small"
              />
              <FormControl size="small">
                <InputLabel>Address line 3 handling</InputLabel>
                <Select
                  label="Address line 3 handling"
                  value={businessConfiguration?.addressLine3Mode || ''}
                  onChange={(event) => setBusinessConfiguration({ ...businessConfiguration, addressLine3Mode: event.target.value })}
                >
                  <MenuItem value=""><em>Decision required</em></MenuItem>
                  <MenuItem value="reject">Omit line 3 from the 834</MenuItem>
                  <MenuItem value="append-to-line2">Append line 3 to line 2</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <TextField
              label="Prior RCNA match-key secret"
              type="password"
              value={businessConfiguration?.priorRcnaMatchKeySecret || ''}
              onChange={(event) => setBusinessConfiguration({ ...businessConfiguration, priorRcnaMatchKeySecret: event.target.value })}
              helperText={businessConfiguration?.priorRcnaMatchKeySecretConfigured
                ? 'A secret is configured. Leave blank to retain it; enter at least 32 characters to replace it.'
                : 'No secret is configured. Enter a strong value of at least 32 characters.'}
              autoComplete="new-password"
              fullWidth
            />

            <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 0.5 }}>Prior RCNA decisions</Typography>
              <FormControlLabel
                control={<Checkbox checked={businessConfiguration?.reusePriorRcnaDecisions !== false} onChange={(event) => setBusinessConfiguration({ ...businessConfiguration, reusePriorRcnaDecisions: event.target.checked })} />}
                label="Reuse prior RCNA decisions"
              />
              <Typography variant="body2" color="text.secondary">
                When enabled, identical recurring RCNO rows use Rule B200 and increment Aging Months.
              </Typography>
            </Box>

            <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 0.5 }}>RCNO input layout</Typography>
              <FormControlLabel
                control={<Checkbox checked={Boolean(businessConfiguration?.ignoreFirstRcnoColumn)} onChange={(event) => setBusinessConfiguration({ ...businessConfiguration, ignoreFirstRcnoColumn: event.target.checked })} />}
                label="Ignore first RCNO column"
              />
              <FormControlLabel
                control={<Checkbox checked={Boolean(businessConfiguration?.ignoreLastRcnoColumn)} onChange={(event) => setBusinessConfiguration({ ...businessConfiguration, ignoreLastRcnoColumn: event.target.checked })} />}
                label="Ignore last RCNO column"
              />
              <Typography variant="body2" color="text.secondary">
                Each enabled option requires one additional input column. Selected edge columns are discarded before processing.
              </Typography>
            </Box>

            <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 0.5 }}>Processing timeouts</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Timeout changes apply to new work and connection attempts.
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(180px, 1fr))' }, gap: 2 }}>
                <TextField
                  label="Processing inactivity"
                  type="number"
                  value={businessConfiguration?.processingInactivityMinutes ?? 30}
                  onChange={(event) => setBusinessConfiguration({ ...businessConfiguration, processingInactivityMinutes: Number(event.target.value) })}
                  helperText="Minutes without a heartbeat (5-480)"
                  size="small"
                  slotProps={{ htmlInput: { min: 5, max: 480, step: 1 } }}
                />
                <TextField
                  label="Oracle call timeout"
                  type="number"
                  value={businessConfiguration?.oracleCallTimeoutSeconds ?? 240}
                  onChange={(event) => setBusinessConfiguration({ ...businessConfiguration, oracleCallTimeoutSeconds: Number(event.target.value) })}
                  helperText="Seconds per database call (30-1800)"
                  size="small"
                  slotProps={{ htmlInput: { min: 30, max: 1800, step: 1 } }}
                />
                <TextField
                  label="SFTP connection timeout"
                  type="number"
                  value={businessConfiguration?.sftpConnectionTimeoutSeconds ?? 30}
                  onChange={(event) => setBusinessConfiguration({ ...businessConfiguration, sftpConnectionTimeoutSeconds: Number(event.target.value) })}
                  helperText="Seconds per connection attempt (5-300)"
                  size="small"
                  slotProps={{ htmlInput: { min: 5, max: 300, step: 1 } }}
                />
              </Box>
            </Box>

            <TextField
              label="834 envelope JSON"
              value={businessConfiguration?.envelope || ''}
              onChange={(event) => setBusinessConfiguration({ ...businessConfiguration, envelope: event.target.value })}
              multiline
              minRows={12}
              fullWidth
              slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 13 } } }}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 2 }}>
              <TextField
                label="834 intent by RCNA code JSON"
                value={businessConfiguration?.intentByCode || ''}
                onChange={(event) => setBusinessConfiguration({ ...businessConfiguration, intentByCode: event.target.value })}
                multiline
                minRows={12}
                fullWidth
                slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 13 } } }}
              />
              <TextField
                label="834 relationship map JSON"
                value={businessConfiguration?.relationshipMap || ''}
                onChange={(event) => setBusinessConfiguration({ ...businessConfiguration, relationshipMap: event.target.value })}
                multiline
                minRows={12}
                fullWidth
                slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 13 } } }}
              />
            </Box>

            <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 0.5 }}>834 output</Typography>
              <FormControlLabel
                control={<Checkbox checked={Boolean(businessConfiguration?.skip834Creation)} onChange={(event) => setBusinessConfiguration({ ...businessConfiguration, skip834Creation: event.target.checked })} />}
                label="Disable 834 generation"
              />
              <Typography variant="body2" color="text.secondary">
                RCNO processing always stops after RCNA generation. This setting also prevents manual 834 generation.
              </Typography>
            </Box>

            <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 0.5 }}>834 activation approval</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Enable this gate only after the envelope, intent, relationship, and address mappings are approved.
              </Typography>
              <FormControlLabel
                control={<Checkbox checked={Boolean(businessConfiguration?.mappingApproved)} onChange={(event) => setBusinessConfiguration({ ...businessConfiguration, mappingApproved: event.target.checked })} />}
                label="834 mapping approved"
                disabled={Boolean(businessConfiguration?.skip834Creation)}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              Last saved {dateTime(businessConfiguration?.updatedAt)} by {businessConfiguration?.updatedBy || 'system'}.
            </Typography>
          </Stack>
        </Box>

        <Box component="section" hidden={activeTab !== 1} sx={{ display: activeTab === 1 ? 'block' : 'none', borderBottom: 1, borderColor: 'divider', pb: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
            <Typography variant="h5" sx={{ flexGrow: 1 }}>Oracle lookup queries</Typography>
            <Chip size="small" variant="outlined" label={`Version ${queryConfiguration?.version || 1}`} />
            <Button
              variant="positive"
              startIcon={<Save />}
              onClick={handleSaveQueries}
              disabled={isSavingQueries || !queryConfiguration}
            >
              {isSavingQueries ? 'Saving' : 'Save queries'}
            </Button>
          </Stack>
          <Stack spacing={2}>
            <TextField
              label="MDW SSNs per query"
              type="number"
              value={queryConfiguration?.mdwSsnBatchSize ?? 300}
              onChange={(event) => setQueryConfiguration({ ...queryConfiguration, mdwSsnBatchSize: Number(event.target.value) })}
              helperText="Maximum unique SSNs sent in each MDW query (1-5000)."
              size="small"
              slotProps={{ htmlInput: { min: 1, max: 5000, step: 1 } }}
              sx={{ maxWidth: 320 }}
            />
            <TextField
              label="EPDS prior 30 days of 834 SQL"
              value={queryConfiguration?.epdsQuery || ''}
              onChange={(event) => setQueryConfiguration({ ...queryConfiguration, epdsQuery: event.target.value })}
              multiline
              minRows={12}
              fullWidth
              slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 13 } } }}
            />
            <TextField
              label="MDW membership and enrollment SQL"
              value={queryConfiguration?.mdwQuery || ''}
              onChange={(event) => setQueryConfiguration({ ...queryConfiguration, mdwQuery: event.target.value })}
              multiline
              minRows={12}
              fullWidth
              slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 13 } } }}
            />
            <Typography variant="caption" color="text.secondary">
              Uses the :businessDate bind; MDW also uses :ssnsJson. Last saved {dateTime(queryConfiguration?.updatedAt)} by {queryConfiguration?.updatedBy || 'system'}.
            </Typography>
          </Stack>
        </Box>

        <Box component="section" hidden={activeTab !== 0} sx={{ display: activeTab === 0 ? 'block' : 'none' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems={{ sm: 'center' }}>
            <Typography variant="h5" sx={{ flexGrow: 1 }}>Run history</Typography>
            <FormControl size="small" sx={{ minWidth: 140 }}><InputLabel>Mode</InputLabel><Select label="Mode" value={modeFilter} onChange={(event) => { setModeFilter(event.target.value); setPage(0); }}><MenuItem value="">All</MenuItem><MenuItem value="scheduled">Scheduled</MenuItem><MenuItem value="adhoc">Ad hoc</MenuItem></Select></FormControl>
            <FormControl size="small" sx={{ minWidth: 190 }}><InputLabel>Status</InputLabel><Select label="Status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }}><MenuItem value="">All</MenuItem>{['AWAITING_UPLOAD', 'AWAITING_RCNA_REVIEW', 'QUEUED', 'PROCESSING', 'COMPLETE', 'PARTIAL', 'ERROR', 'SKIPPED'].map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}</Select></FormControl>
          </Stack>
          <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Table size="small">
              <TableHead><TableRow><TableCell padding="checkbox" /><TableCell>Run</TableCell><TableCell>Mode</TableCell><TableCell>Status</TableCell><TableCell>Started</TableCell><TableCell>Duration</TableCell><TableCell align="right">Processed</TableCell><TableCell align="right">Failed</TableCell><TableCell>Note</TableCell><TableCell align="center">Actions</TableCell></TableRow></TableHead>
              <TableBody>
                {!runs.length && <TableRow><TableCell colSpan={10} align="center" sx={{ py: 5 }}>No runs found</TableCell></TableRow>}
                {runs.map((run) => {
                  const detail = runDetails[run.id];
                  return (
                    <Fragment key={run.id}>
                      <TableRow hover>
                        <TableCell padding="checkbox"><Tooltip title="Run details"><IconButton size="small" onClick={() => toggleRun(run.id)}>{expandedRunId === run.id ? <ExpandLess /> : <ExpandMore />}</IconButton></Tooltip></TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{run.id}</TableCell><TableCell>{run.mode}<Chip size="small" label={run.operation || 'RCNO_TO_RCNA'} variant="outlined" sx={{ ml: 0.75 }} />{run.lookupSource === 'mock' && <Chip size="small" label="mock" color="info" sx={{ ml: 0.75 }} />}</TableCell><TableCell><Chip size="small" label={run.status} color={statusColor(run.status)} /></TableCell><TableCell>{dateTime(run.startedAt || run.createdAt)}</TableCell><TableCell>{duration(run)}</TableCell><TableCell align="right">{run.status === 'PROCESSING' && run.counts?.received > 0 ? `${run.counts?.processed || 0} of ${run.counts?.received} (${Math.round((run.counts?.processed / run.counts?.received) * 100)}%)` : (run.counts?.processed || 0)}</TableCell><TableCell align="right">{run.counts?.failed || 0}</TableCell><TableCell sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.note || '-'}</TableCell>
                        <TableCell align="center">
                          <Tooltip title="Edit run note">
                            <IconButton size="small" aria-label={`Edit note for run ${run.id}`} onClick={() => openRunNote(run)}>
                              <EditOutlined />
                            </IconButton>
                          </Tooltip>
                          {DELETABLE_STATUSES.has(run.status) && (
                            <Tooltip title="Delete run history">
                              <IconButton size="small" color="error" aria-label={`Delete run ${run.id}`} onClick={() => setDeleteRunId(run.id)}>
                                <DeleteOutline />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow><TableCell colSpan={10} sx={{ p: 0, border: expandedRunId === run.id ? undefined : 0 }}><Collapse in={expandedRunId === run.id} unmountOnExit><Box sx={{ p: 2, bgcolor: 'action.hover' }}>
                        {!detail ? <CircularProgress size={22} /> : <Stack spacing={1.5}>
                          <Typography variant="subtitle2">Stage: {detail.run.currentStage}</Typography>
                          {detail.run.lookupSource === 'mock' && (
                            <Typography variant="body2">
                              Predefined test: {detail.run.mockFixtureId} (version {detail.run.mockFixtureVersion})
                            </Typography>
                          )}
                          {detail.run.errorSummary && <Alert severity="error">{detail.run.errorSummary}</Alert>}
                          {(() => {
                            const note = skipped834Note(detail.run);
                            return note ? <Alert severity={note.severity}>{note.text}</Alert> : null;
                          })()}
                          <Stack direction="row" spacing={1} flexWrap="wrap">
                            {(detail.run.artifacts || []).filter((artifact) => artifact.direction === 'output').map((artifact) => <Button key={artifact.id} size="small" variant="action" startIcon={<CloudDownload />} onClick={() => downloadRcnoaArtifact(teamName, run.id, artifact.id)}>{artifactButtonLabel(artifact)}</Button>)}
                            {detail.run.status === 'AWAITING_RCNA_REVIEW' && (
                              <Button
                                size="small"
                                variant="positive"
                                startIcon={activeFileOperation === run.id ? <CircularProgress size={16} color="inherit" /> : <PlayArrow />}
                                onClick={() => handleGenerate834(run.id)}
                                disabled={Boolean(activeFileOperation) || Boolean(businessConfiguration?.skip834Creation) || !businessConfiguration?.mappingApproved}
                              >
                                {activeFileOperation === run.id ? 'Generating 834' : 'Generate 834'}
                              </Button>
                            )}
                            {['ERROR', 'PARTIAL'].includes(detail.run.status) && <Button size="small" variant="secondary" startIcon={<Replay />} onClick={() => handleRetry(run.id)}>Retry</Button>}
                          </Stack>
                          <Table size="small"><TableHead><TableRow><TableCell>Row</TableCell><TableCell>Code</TableCell><TableCell>Reason</TableCell></TableRow></TableHead><TableBody>{!(detail.failures.items || []).length && <TableRow><TableCell colSpan={3}>No row failures</TableCell></TableRow>}{(detail.failures.items || []).map((item) => <TableRow key={item.id}><TableCell>{item.sourceRowNumber}</TableCell><TableCell>{item.errorCode}</TableCell><TableCell sx={{ overflowWrap: 'anywhere' }}>{item.message}</TableCell></TableRow>)}</TableBody></Table>
                        </Stack>}
                      </Box></Collapse></TableCell></TableRow>
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={state?.runs?.total || 0} page={page} rowsPerPage={pageSize} onPageChange={(event, value) => setPage(value)} onRowsPerPageChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={[10, 25, 50]} />
        </Box>
      </Stack>
      <Dialog open={Boolean(noteRunId)} onClose={() => !isSavingRunNote && setNoteRunId('')} fullWidth maxWidth="sm">
        <DialogTitle>Edit run note</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            margin="dense"
            label="Note"
            value={runNote}
            onChange={(event) => setRunNote(event.target.value.slice(0, 120))}
            helperText={`${runNote.length}/120`}
            slotProps={{ htmlInput: { maxLength: 120 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setNoteRunId('')} disabled={isSavingRunNote}>Cancel</Button>
          <Button variant="primary" onClick={handleSaveRunNote} disabled={isSavingRunNote} startIcon={isSavingRunNote ? <CircularProgress size={16} color="inherit" /> : <Save />}>
            {isSavingRunNote ? 'Saving' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(deleteRunId)} onClose={() => !isDeletingRun && setDeleteRunId('')}>
        <DialogTitle>Delete prior run?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This permanently deletes the run history, row failures, and stored artifacts for {deleteRunId}. Prior RCNA matching records used by future runs are retained.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setDeleteRunId('')} disabled={isDeletingRun}>Cancel</Button>
          <Button variant="destructive" onClick={handleDeleteRun} disabled={isDeletingRun} startIcon={isDeletingRun ? <CircularProgress size={16} /> : <DeleteOutline />}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}