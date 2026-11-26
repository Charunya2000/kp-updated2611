'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import BatchEntryForm from './BatchEntryForm';
import JobStatusPanel from './JobStatusPanel';
import BatchHistory from './BatchHistory';
import { submitBatchEntry, getRunStatus, getActiveJobs, cancelJob } from './clientServices/batchEntryService';
import useSnackbar from '@/app/hooks/useSnackbar';

const TERMINAL_STATUSES = ['COMPLETE', 'ERROR', 'CANCELED'];
const POLL_BACKOFF_STEPS = [
  { attempts: 3, delayMs: 5000 },
  { attempts: 3, delayMs: 10000 },
  { attempts: 3, delayMs: 20000 },
  { attempts: 3, delayMs: 40000 },
];
const POLL_MAX_DELAY_MS = 60000;

function getPollDelayMs(pollAttemptNumber) {
  let remaining = pollAttemptNumber;

  for (const step of POLL_BACKOFF_STEPS) {
    if (remaining <= step.attempts) {
      return step.delayMs;
    }
    remaining -= step.attempts;
  }

  return POLL_MAX_DELAY_MS;
}

const MedicareCompare = ({ envName, canDeleteRunHistory = false }) => {
  const [submitting, setSubmitting] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [runHistoryRefreshKey, setRunHistoryRefreshKey] = useState(0);
  const { SnackbarComponent, showSnackbar } = useSnackbar();
  const pollRefs = useRef({});

  const stopPolling = useCallback((runId) => {
    if (pollRefs.current[runId]) {
      if (pollRefs.current[runId].timeoutId) {
        clearTimeout(pollRefs.current[runId].timeoutId);
      }
      delete pollRefs.current[runId];
    }
  }, []);

  const stopAllPolling = useCallback(() => {
    Object.keys(pollRefs.current).forEach((runId) => {
      if (pollRefs.current[runId]?.timeoutId) {
        clearTimeout(pollRefs.current[runId].timeoutId);
      }
    });
    pollRefs.current = {};
  }, []);

  const updateJobStatus = useCallback((runId, statusData) => {
    setJobs((prev) =>
      prev.map((j) => (j.runId === runId ? { ...j, runStatus: statusData } : j))
    );
  }, []);

  const startPolling = useCallback((job) => {
    stopPolling(job.runId);

    pollRefs.current[job.runId] = {
      timeoutId: null,
      attempts: 0,
    };

    const scheduleNextPoll = () => {
      const pollState = pollRefs.current[job.runId];
      if (!pollState) return;

      const nextAttempt = pollState.attempts + 1;
      const delayMs = getPollDelayMs(nextAttempt);

      pollState.timeoutId = setTimeout(() => {
        poll();
      }, delayMs);
    };

    const poll = async () => {
      const pollState = pollRefs.current[job.runId];
      if (!pollState) return;

      pollState.attempts += 1;

      try {
        const status = await getRunStatus({
          runId: job.runId,
          batchNumber: job.batchNumber,
          targetDatabase: job.targetDatabase,
        });

        if (status.error) {
          scheduleNextPoll();
          return; // Row not available yet, keep polling
        }

        updateJobStatus(job.runId, status);

        if (TERMINAL_STATUSES.includes(status.status)) {
          stopPolling(job.runId);
          setRunHistoryRefreshKey((prev) => prev + 1);

          if (status.status === 'COMPLETE') {
            showSnackbar(`Batch ${job.batchNumber} completed successfully.`, 'success');
          } else if (status.status === 'ERROR') {
            showSnackbar(status.errorMessage || `Batch ${job.batchNumber} failed.`, 'error');
          } else if (status.status === 'CANCELED') {
            showSnackbar(`Batch ${job.batchNumber} was canceled.`, 'warning');
          }
          return;
        }

        scheduleNextPoll();
      } catch (err) {
        // Silently continue polling on network errors
        scheduleNextPoll();
      }
    };

    poll();
  }, [stopPolling, updateJobStatus, showSnackbar]);

  useEffect(() => {
    let cancelled = false;

    const loadActiveJobs = async () => {
      try {
        const activeJobs = await getActiveJobs();
        if (cancelled || activeJobs.length === 0) return;

        setJobs((prev) => {
          const existingRunIds = new Set(prev.map((j) => j.runId));
          const newJobs = activeJobs.filter((j) => !existingRunIds.has(j.runId));
          return newJobs.length > 0 ? [...newJobs, ...prev] : prev;
        });

        activeJobs.forEach((job) => startPolling(job));
      } catch (err) {
        // Silently fail – user can still submit new jobs
      }
    };

    loadActiveJobs();

    return () => {
      cancelled = true;
      stopAllPolling();
    };
  }, [stopAllPolling, startPolling]);

  const handleBatchSubmit = async (formData) => {
    setSubmitting(true);

    try {
      const result = await submitBatchEntry(formData);

      if (result.error) {
        showSnackbar(result.error, 'error');
      } else {
        const newJob = { ...result, runStatus: null };
        setJobs((prev) => [newJob, ...prev]);
        showSnackbar(`Batch ${formData.batchNumber} submitted successfully.`, 'success');
        startPolling(result);
      }
    } catch (err) {
      showSnackbar('Failed to submit batch entry. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismissJob = (runId) => {
    stopPolling(runId);
    setJobs((prev) => prev.filter((j) => j.runId !== runId));
  };

  const handleCancelJob = async (job) => {
    try {
      const result = await cancelJob({
        runId: job.runId,
        batchNumber: job.batchNumber,
        targetDatabase: job.targetDatabase,
      });

      if (result.error) {
        showSnackbar(result.error, 'error');
      } else {
        stopPolling(job.runId);
        updateJobStatus(job.runId, {
          ...job.runStatus,
          status: 'CANCELED',
          errorMessage: 'Job canceled by user.',
        });
        setRunHistoryRefreshKey((prev) => prev + 1);
        showSnackbar(`Batch ${job.batchNumber} canceled.`, 'info');
      }
    } catch (err) {
      showSnackbar('Failed to cancel job. Please try again.', 'error');
    }
  };

  return (
    <Box sx={{
      width: '100%',
      height: '100%',
      overflow: 'auto',
      py: 2,
      px: 3,
      pb: 4
    }}>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Individual Medicare Compare
      </Typography>

      <BatchEntryForm
        onSubmit={handleBatchSubmit}
        submitting={submitting}
        envName={envName}
      />

      {jobs.map((job) => (
        <JobStatusPanel
          key={job.runId}
          job={job}
          onDismiss={handleDismissJob}
          onCancel={handleCancelJob}
        />
      ))}

      <BatchHistory
        refreshKey={runHistoryRefreshKey}
        envName={envName}
        canDeleteRunHistory={canDeleteRunHistory}
      />

      <SnackbarComponent />
    </Box>
  );
};

export default MedicareCompare;