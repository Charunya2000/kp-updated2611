'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material';

const POLL_INTERVAL_MS = 2500;
const MAX_ATTEMPTS = 120;
const DEFAULT_CALIBRATION_QUERIES = [
  'Prepare a CFO-ready briefing for a manufacturing prospect.',
  'What differentiators and proof points should we use for a hospital system renewal in the Southeast market?',
  'Create follow-up messaging priorities for at-risk employer groups in National accounts.'
].join('\n');

const CALIBRATION_PROFILES = [
  {
    id: 'balanced',
    label: 'Balanced',
    retrieval: {
      minScore: 0.2,
      topMultiplier: 8,
      minTop: 16,
      maxDocuments: 40,
      minDocsAfterFilter: 8,
      semanticMode: 'auto',
      marketBoost: 0.08,
      regionBoost: 0.1,
      queryTermBoost: 0.02
    }
  },
  {
    id: 'precision',
    label: 'Precision-Heavy',
    retrieval: {
      minScore: 0.28,
      topMultiplier: 10,
      minTop: 20,
      maxDocuments: 36,
      minDocsAfterFilter: 8,
      semanticMode: 'always',
      marketBoost: 0.1,
      regionBoost: 0.12,
      queryTermBoost: 0.03
    }
  },
  {
    id: 'recall',
    label: 'Recall-Heavy',
    retrieval: {
      minScore: 0.14,
      topMultiplier: 12,
      minTop: 24,
      maxDocuments: 50,
      minDocsAfterFilter: 12,
      semanticMode: 'auto',
      marketBoost: 0.06,
      regionBoost: 0.08,
      queryTermBoost: 0.015
    }
  }
];

export default function AgentSkillsTestPage() {
  const [teamName, setTeamName] = useState('kpit-ai-portal-members');
  const [assistantName, setAssistantName] = useState('info-source-assistant');
  const [smartNoteId, setSmartNoteId] = useState('test-smartnote-id');
  const [query, setQuery] = useState('Prepare a CFO-ready briefing for a manufacturing prospect.');
  const [market, setMarket] = useState('National');
  const [industry, setIndustry] = useState('Manufacturing');
  const [useMemoryContext, setUseMemoryContext] = useState(true);

  const [jobId, setJobId] = useState('');
  const [status, setStatus] = useState('idle');
  const [normalizedStatus, setNormalizedStatus] = useState('unknown');
  const [isTerminal, setIsTerminal] = useState(false);
  const [resultPreview, setResultPreview] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationRuns, setVerificationRuns] = useState([]);
  const [calibrationQueries, setCalibrationQueries] = useState(DEFAULT_CALIBRATION_QUERIES);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationError, setCalibrationError] = useState('');
  const [calibrationResults, setCalibrationResults] = useState([]);
  const [exportMessage, setExportMessage] = useState('');

  const attemptsRef = useRef(0);
  const pollRef = useRef(null);
  const runContextRef = useRef({ requestedMemoryMode: true, startedAt: '' });

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => stopPolling(), []);

  const buildRoute = () => `/api/${teamName}/${assistantName}/smartNote/${smartNoteId}/agent-skills`;

  const startJob = async (memoryModeOverride, retrievalOverride = null, queryOverride = null) => {
    const requestedMemoryMode = typeof memoryModeOverride === 'boolean' ? memoryModeOverride : useMemoryContext;
    const activeQuery = typeof queryOverride === 'string' && queryOverride.trim().length > 0 ? queryOverride.trim() : query;

    stopPolling();
    attemptsRef.current = 0;
    runContextRef.current = {
      requestedMemoryMode,
      startedAt: new Date().toISOString()
    };
    setError('');
    setResultPreview('');
    setJobId('');
    setStatus('queued');
    setNormalizedStatus('queued');
    setIsTerminal(false);
    setIsSubmitting(true);

    try {
      const response = await fetch(buildRoute(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: activeQuery,
          userRole: 'Seller',
          market,
          region: market,
          industry,
          useMemoryContext: requestedMemoryMode,
          retrieval: retrievalOverride || undefined,
          mode: 'auto',
          limitPerBucket: 3
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to queue Agent Skills job');
      }

      setJobId(payload.jobId || '');
      setStatus(payload.status || 'queued');
      setNormalizedStatus(payload.normalizedStatus || 'queued');
      setIsTerminal(Boolean(payload.isTerminal));

      if (payload.jobId) {
        startPolling(payload.jobId);
      }
    } catch (requestError) {
      setError(requestError.message || 'Unexpected error while starting job');
      setStatus('error');
      setNormalizedStatus('error');
      setIsTerminal(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startPolling = (activeJobId) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      attemptsRef.current += 1;

      try {
        const response = await fetch(`${buildRoute()}?jobId=${encodeURIComponent(activeJobId)}`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to fetch job status');
        }

        setStatus(payload.status || 'processing');
        setNormalizedStatus(payload.normalizedStatus || 'processing');
        setIsTerminal(Boolean(payload.isTerminal));

        if (payload?.result?.buckets) {
          const bucketSummary = payload.result.buckets
            .map((bucket) => `${bucket.label}: ${(bucket.insights || []).length}`)
            .join(' | ');
          setResultPreview(bucketSummary);
        }

        if (payload.isTerminal) {
          stopPolling();

          const requestedMemoryMode = runContextRef.current?.requestedMemoryMode !== false;
          const resolvedMemoryMode = payload?.result?.options?.useMemoryContext !== false;
          const roleSnippet = (payload?.result?.roleResponse?.markdown || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 180);

          setVerificationRuns((previous) => {
            const next = [
              {
                timestamp: new Date().toISOString(),
                requestedMemoryMode,
                resolvedMemoryMode,
                normalizedStatus: payload.normalizedStatus || 'unknown',
                preview: bucketSummaryFromPayload(payload),
                roleSnippet
              },
              ...previous
            ];
            return next.slice(0, 8);
          });

          if (payload.normalizedStatus === 'error') {
            setError(payload?.lastError || 'Agent Skills job completed with error status');
          }
        }

        if (attemptsRef.current >= MAX_ATTEMPTS) {
          stopPolling();
          setError('Polling timed out on test page');
          setStatus('timeout');
          setNormalizedStatus('error');
          setIsTerminal(true);
        }
      } catch (pollError) {
        stopPolling();
        setError(pollError.message || 'Polling failed');
        setStatus('error');
        setNormalizedStatus('error');
        setIsTerminal(true);
      }
    }, POLL_INTERVAL_MS);
  };

  const calibrationSummary = useMemo(() => buildCalibrationSummary(calibrationResults), [calibrationResults]);

  const runCalibrationSuite = async () => {
    stopPolling();
    setCalibrationError('');
    setCalibrationResults([]);
    setIsCalibrating(true);

    const queries = calibrationQueries
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8);

    if (queries.length === 0) {
      setCalibrationError('Add at least one calibration query.');
      setIsCalibrating(false);
      return;
    }

    try {
      const runs = [];

      for (const profile of CALIBRATION_PROFILES) {
        for (const calibrationQuery of queries) {
          const job = await queueCalibrationJob({
            route: buildRoute(),
            query: calibrationQuery,
            market,
            industry,
            retrieval: profile.retrieval,
            useMemoryContext
          });

          const terminalPayload = await waitForTerminalCalibrationStatus({
            route: buildRoute(),
            jobId: job.jobId
          });

          runs.push(summarizeCalibrationRun({
            profile,
            query: calibrationQuery,
            payload: terminalPayload
          }));

          setCalibrationResults([...runs]);
        }
      }
    } catch (runError) {
      setCalibrationError(runError.message || 'Calibration suite failed.');
    } finally {
      setIsCalibrating(false);
    }
  };

  const exportCalibrationResults = () => {
    if (!calibrationResults.length) {
      return;
    }

    try {
      const queries = calibrationQueries
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 8);

      const exportPayload = {
        exportedAt: new Date().toISOString(),
        context: {
          teamName,
          assistantName,
          smartNoteId,
          market,
          industry,
          useMemoryContext
        },
        queries,
        profiles: CALIBRATION_PROFILES,
        recommendation: calibrationSummary,
        runs: calibrationResults
      };

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      anchor.href = url;
      anchor.download = `agent-skills-calibration-${timestamp}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      setExportMessage('Calibration results exported.');
      setTimeout(() => setExportMessage(''), 2500);
    } catch {
      setCalibrationError('Unable to export calibration results.');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>Agent Skills Route Test</Typography>
      <Typography variant="body2" sx={{ mb: 3 }}>
        In-app verifier for POST + polling behavior on the Agent Skills route.
      </Typography>

      <Paper sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField label="Team Name" value={teamName} onChange={(event) => setTeamName(event.target.value)} fullWidth />
            <TextField label="Assistant Name" value={assistantName} onChange={(event) => setAssistantName(event.target.value)} fullWidth />
          </Stack>

          <TextField label="Smart Note Id" value={smartNoteId} onChange={(event) => setSmartNoteId(event.target.value)} fullWidth />
          <TextField label="Query" value={query} onChange={(event) => setQuery(event.target.value)} fullWidth multiline minRows={2} />

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField label="Market" value={market} onChange={(event) => setMarket(event.target.value)} fullWidth />
            <TextField label="Industry" value={industry} onChange={(event) => setIndustry(event.target.value)} fullWidth />
          </Stack>

          <FormControlLabel
            control={(
              <Switch
                checked={useMemoryContext}
                onChange={(event) => setUseMemoryContext(event.target.checked)}
              />
            )}
            label="Use memory context for manual run"
          />

          <Stack direction="row" spacing={2} alignItems="center">
            <Button variant="contained" onClick={() => startJob()} disabled={isSubmitting}>Start Agent Skills Job</Button>
            <Button variant="outlined" onClick={() => startJob(true)} disabled={isSubmitting}>Run Memory On</Button>
            <Button variant="outlined" onClick={() => startJob(false)} disabled={isSubmitting}>Run Memory Off</Button>
            {isSubmitting && <CircularProgress size={20} />}
          </Stack>

          <Typography variant="body2">Job ID: {jobId || '—'}</Typography>
          <Typography variant="body2">Status: {status}</Typography>
          <Typography variant="body2">Normalized Status: {normalizedStatus}</Typography>
          <Typography variant="body2">Terminal: {isTerminal ? 'Yes' : 'No'}</Typography>
          <Typography variant="body2">Result Preview: {resultPreview || '—'}</Typography>

          {error && <Alert severity="error">{error}</Alert>}

          <Divider sx={{ my: 1 }} />

          <Typography variant="h6">Memory Verification Notes</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Run one job with Memory On and one with Memory Off using the same query, then compare bucket counts and role snippet differences below.
          </Typography>

          {verificationRuns.length === 0 && (
            <Typography variant="body2">No completed runs yet.</Typography>
          )}

          {verificationRuns.map((run, index) => (
            <Box key={`${run.timestamp}-${index}`} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.5 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {run.timestamp}
              </Typography>
              <Typography variant="body2">
                Requested Memory: {run.requestedMemoryMode ? 'On' : 'Off'} | Resolved Memory: {run.resolvedMemoryMode ? 'On' : 'Off'} | Status: {run.normalizedStatus}
              </Typography>
              <Typography variant="body2">Bucket Preview: {run.preview || '—'}</Typography>
              <Typography variant="body2">Role Snippet: {run.roleSnippet || '—'}</Typography>
            </Box>
          ))}

          <Divider sx={{ my: 1 }} />

          <Typography variant="h6">Retrieval Calibration Suite</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Runs preset retrieval profiles across multiple queries, then scores profile quality using bucket coverage and average insight score.
          </Typography>

          <TextField
            label="Calibration Queries (one per line)"
            value={calibrationQueries}
            onChange={(event) => setCalibrationQueries(event.target.value)}
            fullWidth
            multiline
            minRows={4}
          />

          <Stack direction="row" spacing={2} alignItems="center">
            <Button variant="contained" onClick={runCalibrationSuite} disabled={isCalibrating || isSubmitting}>
              Run Calibration Suite
            </Button>
            <Button variant="outlined" onClick={exportCalibrationResults} disabled={!calibrationResults.length || isCalibrating || isSubmitting}>
              Export Calibration JSON
            </Button>
            {(isCalibrating || isSubmitting) && <CircularProgress size={20} />}
          </Stack>

          {calibrationError && <Alert severity="error">{calibrationError}</Alert>}
          {exportMessage && <Alert severity="success">{exportMessage}</Alert>}

          {calibrationSummary && (
            <Alert severity="info">
              Recommended Profile: {calibrationSummary.bestProfileLabel} (score {calibrationSummary.bestScore.toFixed(3)} across {calibrationSummary.runCount} runs)
            </Alert>
          )}

          {calibrationResults.length === 0 && (
            <Typography variant="body2">No calibration runs completed yet.</Typography>
          )}

          {calibrationResults.map((result, index) => (
            <Box key={`${result.timestamp}-${result.profileId}-${index}`} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.5 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {result.timestamp}
              </Typography>
              <Typography variant="body2">
                Profile: {result.profileLabel} | Status: {result.normalizedStatus} | Coverage: {result.bucketCoverage}/4 | Avg Score: {result.avgInsightScore.toFixed(3)}
              </Typography>
              <Typography variant="body2">Query: {result.query}</Typography>
              <Typography variant="body2">Buckets: {result.bucketPreview || '—'}</Typography>
              <Typography variant="body2">Data Source: {result.dataSource || 'unknown'} | Documents: {result.totalDocuments}</Typography>
            </Box>
          ))}
        </Stack>
      </Paper>
    </Box>
  );
}

function bucketSummaryFromPayload(payload = {}) {
  const buckets = payload?.result?.buckets;
  if (!Array.isArray(buckets)) {
    return '';
  }

  return buckets
    .map((bucket) => `${bucket.label}: ${(bucket.insights || []).length}`)
    .join(' | ');
}

async function queueCalibrationJob({ route, query, market, industry, retrieval, useMemoryContext }) {
  const response = await fetch(route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      userRole: 'Seller',
      market,
      region: market,
      industry,
      useMemoryContext,
      retrieval,
      mode: 'auto',
      limitPerBucket: 3
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to queue calibration job');
  }

  if (!payload?.jobId) {
    throw new Error('Calibration job did not return a jobId');
  }

  return payload;
}

async function waitForTerminalCalibrationStatus({ route, jobId }) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    await delay(POLL_INTERVAL_MS);

    const response = await fetch(`${route}?jobId=${encodeURIComponent(jobId)}`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error || 'Failed during calibration polling');
    }

    if (payload?.isTerminal) {
      return payload;
    }
  }

  throw new Error('Calibration polling timed out');
}

function summarizeCalibrationRun({ profile, query, payload }) {
  const buckets = payload?.result?.buckets || [];
  const bucketCoverage = buckets.filter((bucket) => Array.isArray(bucket.insights) && bucket.insights.length > 0).length;
  const allInsights = buckets.flatMap((bucket) => bucket.insights || []);
  const scores = allInsights
    .map((insight) => insight?.metadata?.score)
    .filter((score) => Number.isFinite(score));
  const avgInsightScore = scores.length > 0
    ? scores.reduce((acc, score) => acc + score, 0) / scores.length
    : 0;

  return {
    timestamp: new Date().toISOString(),
    profileId: profile.id,
    profileLabel: profile.label,
    query,
    normalizedStatus: payload?.normalizedStatus || 'unknown',
    bucketCoverage,
    bucketPreview: bucketSummaryFromPayload(payload),
    avgInsightScore,
    totalDocuments: payload?.result?.diagnostics?.totalDocuments || 0,
    dataSource: payload?.result?.diagnostics?.dataSource || 'unknown'
  };
}

function buildCalibrationSummary(results = []) {
  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  const byProfile = new Map();
  results.forEach((result) => {
    const entry = byProfile.get(result.profileId) || {
      profileLabel: result.profileLabel,
      totalRuns: 0,
      weightedScore: 0
    };

    const runScore = (result.bucketCoverage / 4) * 0.7 + Math.min(result.avgInsightScore, 1) * 0.3;
    entry.totalRuns += 1;
    entry.weightedScore += runScore;
    byProfile.set(result.profileId, entry);
  });

  const ranked = [...byProfile.entries()]
    .map(([profileId, entry]) => ({
      profileId,
      profileLabel: entry.profileLabel,
      score: entry.totalRuns > 0 ? entry.weightedScore / entry.totalRuns : 0,
      totalRuns: entry.totalRuns
    }))
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) {
    return null;
  }

  return {
    bestProfileId: ranked[0].profileId,
    bestProfileLabel: ranked[0].profileLabel,
    bestScore: ranked[0].score,
    runCount: ranked[0].totalRuns
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
