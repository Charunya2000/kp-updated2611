'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Typography,
  Grid,
  LinearProgress,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { PTS_CONFIG } from '../ptsConfig';
import { useAuth } from '@/app/contexts/OpenIdAuthContext';

const LOADRUNNER_FILES = PTS_CONFIG.LOADRUNNER_FILES;
const DYNATRACE_FILES = PTS_CONFIG.DYNATRACE_FILES;

const DataAnalysis = ({
  sessionId,
  sourceType,
  slaConfirmed,
  slaUploaded,
  uploadStatus,
  onAnalyzeStart,
  onAnalyzeComplete,
  onAnalyzeError,
  loading,
}) => {
  const { user } = useAuth();
  const currentUserNUID = user?.nuid || user?.userId || user?.id || '';
  const [analysisMessage, setAnalysisMessage] = useState('');
  const [loadrunnerUploaded, setLoadrunnerUploaded] = useState(0);
  const [dynatraceUploaded, setDynatraceUploaded] = useState(0);
  const [azureUploaded, setAzureUploaded] = useState(0);
  const [fetchingCounts, setFetchingCounts] = useState(false);

  const [progressState, setProgressState] = useState(null);
  const [resultState, setResultState] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const progressUrlRef = useRef(null);
  const pollTimeoutRef = useRef(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []);

  // Fetch actual file counts from backend API
  useEffect(() => {
    const fetchFileCounts = async () => {
      if (!sessionId) {
        setLoadrunnerUploaded(0);
        setDynatraceUploaded(0);
        setAzureUploaded(0);
        return;
      }

      setFetchingCounts(true);
      try {
        const loadrunnerUrl = `/api/pts/check-session-files/${sessionId}?source_type=loadrunner`;
        const dynatraceUrl = `/api/pts/check-session-files/${sessionId}?source_type=dynatrace`;
        const azureUrl = `/api/pts/check-session-files/${sessionId}?source_type=azure`;

        console.log('[DataAnalysis] File count URLs:', {
          loadrunnerUrl,
          dynatraceUrl,
          azureUrl,
        });

        const [loadrunnerRes, dynatraceRes, azureRes] = await Promise.all([
          fetch(loadrunnerUrl).catch(err => {
            console.log('[DataAnalysis] LoadRunner fetch failed:', err.message);
            return { ok: false, status: 'network_error', error: err };
          }),
          fetch(dynatraceUrl).catch(err => {
            console.log('[DataAnalysis] Dynatrace fetch failed:', err.message);
            return { ok: false, status: 'network_error', error: err };
          }),
          fetch(azureUrl).catch(err => {
            console.log('[DataAnalysis] Azure fetch failed:', err.message);
            return { ok: false, status: 'network_error', error: err };
          }),
        ]);

        let lrCount = 0;
        let dtCount = 0;
        let azCount = 0;

        if (loadrunnerRes.ok) {
          const data = await loadrunnerRes.json();
          const files = (data.data_files && data.data_files.found) || [];
          lrCount = files.length;
          setLoadrunnerUploaded(lrCount);
        }

        if (dynatraceRes.ok) {
          const data = await dynatraceRes.json();
          const files = (data.data_files && data.data_files.found) || [];
          dtCount = files.length;
          setDynatraceUploaded(dtCount);
        }

        if (azureRes.ok) {
          const data = await azureRes.json();
          const files = (data.data_files && data.data_files.found) || [];
          azCount = files.length;
          setAzureUploaded(azCount);
        }

        console.log('[DataAnalysis] File counts:', {
          loadrunner: lrCount,
          dynatrace: dtCount,
          azure: azCount,
        });
      } catch (err) {
        console.log('[DataAnalysis] Error fetching file counts:', err);
      } finally {
        setFetchingCounts(false);
      }
    };

    fetchFileCounts();
  }, [sessionId]);

  const getRequiredFileCount = () => {
    if (sourceType === 'loadrunner') return 6;
    if (sourceType === 'dynatrace') return 7;
    return 1;
  };

  const getUploadedFileCount = () =>
    loadrunnerUploaded + dynatraceUploaded + azureUploaded;

  const canAnalyze =
    !!sessionId && slaUploaded && slaConfirmed && getUploadedFileCount() >= 1;

  const pollProgress = async () => {
    if (!progressUrlRef.current) return;

    try {
      console.log('[DataAnalysis] Polling:', progressUrlRef.current);
      const res = await fetch(progressUrlRef.current);
      if (!res.ok) {
        throw new Error(`Progress poll failed with status ${res.status}`);
      }
      const data = await res.json();
      console.log('[DataAnalysis] Progress response:', data);

      if (data.status === 'in_progress') {
        setProgressState(data);
        pollTimeoutRef.current = setTimeout(pollProgress, 10000);
      } else {
        setIsPolling(false);
        setProgressState(data.progress || null);
        setResultState(data);

        if (data.status === 'failed') {
          let msg =
            data.progress?.error_message ||
            data.error ||
            'Analysis failed. Please check inputs.';

          // Keep only the first line (e.g. "The specified blob does not exist.")
          if (typeof msg === 'string') {
            msg = msg.split('\n')[0];
          }

          setAnalysisMessage('');
          if (onAnalyzeError) onAnalyzeError(msg);
        } else {
          setAnalysisMessage('Analysis complete!');
          if (onAnalyzeComplete) onAnalyzeComplete(data.analysis_result || {});
        }
      }
    } catch (err) {
      console.error('[DataAnalysis] Error polling progress:', err);
      setIsPolling(false);
      setAnalysisMessage('');
      if (onAnalyzeError) {
        onAnalyzeError(err.message || 'Error polling analysis progress');
      }
    }
  };





  const handleAnalyze = async () => {
    if (!canAnalyze) {
      if (onAnalyzeError) {
        onAnalyzeError('Please complete all required steps');
      }
      return;
    }

    try {
      if (onAnalyzeStart) onAnalyzeStart();
      setAnalysisMessage(''); // Clear message so only progress block is shown during polling
      setProgressState(null);
      setResultState(null);

      const analysisEndpoint = `/api/pts/run-session-workflow?session_id=${encodeURIComponent(
        sessionId
      )}`;
      console.log('[DataAnalysis] Start URL:', analysisEndpoint);

      const response = await fetch(analysisEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: sourceType,
          createdByNUID: currentUserNUID,
        }),
      });

      if (!response.ok) {
        throw new Error('Analysis failed to start');
      }

      const result = await response.json();
      console.log('[DataAnalysis] Start response:', result);

      const urlFromApi = result.progress_url || '';
      console.log('[DataAnalysis] Raw progress_url from API:', urlFromApi);

      // Prepend apiBaseUrl (BACKEND_URL) if provided and urlFromApi is relative
      if (urlFromApi.startsWith('http')) {
        progressUrlRef.current = urlFromApi;
      } else {
        // Remove trailing slash from apiBaseUrl if present
        const base = (typeof apiBaseUrl === 'string' ? apiBaseUrl.replace(/\/$/, '') : '');
        progressUrlRef.current = base + urlFromApi;
      }

      console.log('[DataAnalysis] Final polling URL:', progressUrlRef.current);

      setIsPolling(true);
      // analysisMessage already cleared above
      pollTimeoutRef.current = setTimeout(pollProgress, 2000);
    } catch (err) {
      console.error('[DataAnalysis] Error starting analysis:', err);
      if (onAnalyzeError) {
        onAnalyzeError(err.message || 'An error occurred during analysis');
      }
      setAnalysisMessage('');
      setIsPolling(false);
    }
  };

  const uploadedCount = getUploadedFileCount();
  const requiredCount = getRequiredFileCount();

  const rawPercent =
    (progressState && progressState.percent_complete) ??
    (progressState && progressState.progress_percent) ??
    0;
  const progressPercent = Number.isFinite(rawPercent)
    ? rawPercent
    : Number(rawPercent) || 0;

  return (
    <Card>
      <CardHeader
        title="Data Analysis"
        subtitle="Analyze performance test results"
      />
      <Divider />
      <CardContent>
        {/* Status Checklist */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
            Prerequisites
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {sessionId ? '✓' : '○'} Session ID: {sessionId || 'Not set'}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {slaUploaded ? '✓' : '○'} SLA File Uploaded:{' '}
              {slaUploaded ? 'Yes' : 'No'}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {slaConfirmed ? '✓' : '○'} SLA Confirmed:{' '}
              {slaConfirmed ? 'Yes' : 'No'}
            </Box>
          </Box>
        </Box>

        {/* Test Files Upload Summary */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
            Test Files Uploaded Summary{' '}
            {fetchingCounts && <CircularProgress size={16} sx={{ ml: 1 }} />}
          </Typography>
          <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary">
                  LoadRunner
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                  {fetchingCounts
                    ? '...'
                    : `${loadrunnerUploaded} / ${LOADRUNNER_FILES.length}`}
                  {!fetchingCounts &&
                    loadrunnerUploaded === LOADRUNNER_FILES.length &&
                    ' ✓'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary">
                  Dynatrace
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                  {fetchingCounts
                    ? '...'
                    : `${dynatraceUploaded} / ${DYNATRACE_FILES.length}`}
                  {!fetchingCounts &&
                    dynatraceUploaded === DYNATRACE_FILES.length &&
                    ' ✓'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary">
                  Azure Application Insights
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                  {fetchingCounts ? '...' : azureUploaded}
                  {!fetchingCounts && azureUploaded > 0 && ' ✓'}
                </Typography>
              </Grid>
            </Grid>
          </Box>
        </Box>

        {/* Warnings */}
        {!slaUploaded && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Please upload the SLA Limits file before analyzing
          </Alert>
        )}

        {!slaConfirmed && slaUploaded && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Please confirm SLA values before analyzing
          </Alert>
        )}

        {uploadedCount === 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Please upload at least one test result file
          </Alert>
        )}

        {/* Analyze button */}
        <Box sx={{ mb: 3 }}>
          <Button
            fullWidth
            variant="contained"
            color="primary"
            size="large"
            onClick={handleAnalyze}
            disabled={!canAnalyze || loading || isPolling}
            startIcon={
              loading || isPolling ? (
                <CircularProgress size={24} />
              ) : (
                <PlayArrowIcon />
              )
            }
          >
            {loading || isPolling ? 'Analyzing...' : 'Analyze Data'}
          </Button>
        </Box>

        {/* Progress bar + status */}
        {isPolling && progressState && (
          <Box sx={{ mb: 2, p: 2, bgcolor: '#e3f2fd', borderRadius: 2, border: '1px solid #90caf9', textAlign: 'center' }}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold', color: '#1976d2' }}>
              {progressState.current_stage ? progressState.current_stage : 'Processing...'}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={Math.min(Math.max(progressPercent, 0), 100)}
              sx={{ height: 10, borderRadius: 5 }}
            />
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1, fontWeight: 'bold' }}>
              {Math.round(progressPercent)}% complete
            </Typography>
          </Box>
        )}

        {/* Message */}
        {analysisMessage && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {analysisMessage}
          </Alert>
        )}

        {/* Final result preview */}
        {resultState && !isPolling && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
              Analysis Result
            </Typography>
            {resultState.summary && (
              <Typography variant="body2" sx={{ mb: 1 }}>
                {resultState.summary.slice(0, 400)}...
              </Typography>
            )}
            {Array.isArray(resultState.recommendation) &&
              resultState.recommendation.length > 0 && (
                <Box sx={{ mb: 1 }}>
                  <Typography variant="subtitle2">
                    Top Recommendations:
                  </Typography>
                  <ul>
                    {resultState.recommendation.slice(0, 3).map((rec, idx) => (
                      <li key={idx}>
                        <Typography variant="body2">{rec}</Typography>
                      </li>
                    ))}
                  </ul>
                </Box>
              )}
            {resultState.report_url && (
              <Typography variant="body2">
                Report:{' '}
                <a
                  href={resultState.report_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open HTML report
                </a>
              </Typography>
            )}
          </Box>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          💡 The analysis will process your test results, compare them against
          SLA limits, and generate a comprehensive performance report with
          recommendations.
        </Typography>
      </CardContent>
    </Card>
  );
};

export default DataAnalysis;
