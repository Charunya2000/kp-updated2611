'use client';

import { useEffect, useState } from 'react';
import { Box, Typography, Paper, Chip, IconButton, Collapse, CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import BlockIcon from '@mui/icons-material/Block';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { medicareCompareStatus } from '@/utils/constants';
import { parseOracleLocalTimestamp } from './utils/timestampUtils';

const TERMINAL_STATUSES = [medicareCompareStatus.COMPLETE, medicareCompareStatus.ERROR, medicareCompareStatus.CANCELED];
const STEP_DEFINITIONS = [
  { id: 1, key: medicareCompareStatus.START, label: 'Start' },
  { id: 2, key: medicareCompareStatus.SOURCE_COMPLETE, label: 'Source XML' },
  { id: 3, key: medicareCompareStatus.DATAHUB_TARGET_COMPLETE, label: 'Target ORMB' },
  { id: 4, key: medicareCompareStatus.RESULTS_COMPLETE, label: 'Results' }
];



const toTimestamp = (value) => {
  if (!value) return null;
  return parseOracleLocalTimestamp(value);
};

const formatRuntime = (runStatus, isTerminal, nowMs, runtimeAnchorMs) => {
  const elapsedSeconds = Number(runStatus?.elapsedSeconds);
  if (Number.isFinite(elapsedSeconds) && elapsedSeconds >= 0) {
    const liveSeconds = isTerminal
      ? Math.floor(elapsedSeconds)
      : Math.floor(elapsedSeconds) + Math.max(0, Math.floor((nowMs - runtimeAnchorMs) / 1000));

    const hours = Math.floor(liveSeconds / 3600);
    const minutes = Math.floor((liveSeconds % 3600) / 60);
    const seconds = liveSeconds % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  const startMs = toTimestamp(runStatus?.startTs);
  if (!startMs) return '—';

  const endMs = toTimestamp(runStatus?.endTs)
    ?? (isTerminal ? (toTimestamp(runStatus?.lastUpdateTs) ?? nowMs) : nowMs);

  if (endMs < startMs) return '—';

  const totalSeconds = Math.floor((endMs - startMs) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const getStepIndexFromStatus = (runStatus) => {
  if (!runStatus) return 1;

  const status = (runStatus.status || '').toUpperCase();
  const currentStep = (runStatus.currentStep || '').toUpperCase();
  const nextStep = (runStatus.nextStep || '').toUpperCase();
  const statusText = `${status} ${currentStep} ${nextStep}`;

  const contains = (value) => statusText.includes((value || '').toUpperCase());

  if (status === medicareCompareStatus.COMPLETE || contains(medicareCompareStatus.RESULTS_COMPLETE)) return 4;
  if (contains(medicareCompareStatus.DATAHUB_TARGET_COMPLETE)) return 3;
  if (contains(medicareCompareStatus.SOURCE_COMPLETE)) return 2;
  if (status === medicareCompareStatus.ERROR) return 1;
  return 1;
};

const StepProgress = ({ currentStepIndex, statusLabel }) => {
  const isError = statusLabel === medicareCompareStatus.ERROR;
  const isCanceled = statusLabel === medicareCompareStatus.CANCELED;

  return (
    <Box sx={{ mt: 1, mb: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
        {STEP_DEFINITIONS.map((step, index) => {
          const isCompleted = step.id < currentStepIndex;
          const isCurrent = step.id === currentStepIndex;
          const isActive = isCompleted || isCurrent;
          const showError = isError && isCurrent;
          const showCanceled = isCanceled && isCurrent;

          return (
            <Box key={step.id} sx={{ display: 'contents' }}>
              {/* Step column: circle + label */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    color: isActive ? 'common.white' : 'text.secondary',
                    bgcolor: showError ? 'error.main' : showCanceled ? 'warning.main' : isActive ? 'primary.main' : 'grey.300',
                    border: '1px solid',
                    borderColor: showError ? 'error.main' : showCanceled ? 'warning.main' : isActive ? 'primary.main' : 'grey.400',
                  }}
                >
                  {step.id}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, whiteSpace: 'nowrap' }}>
                  {step.label}
                </Typography>
              </Box>

              {/* Connecting line between steps */}
              {index < STEP_DEFINITIONS.length - 1 && (
                <Box
                  sx={{
                    height: 4,
                    flexGrow: 1,
                    minWidth: 12,
                    mx: 1,
                    mt: '12px',
                    borderRadius: 999,
                    bgcolor: step.id <= currentStepIndex ? 'primary.main' : 'grey.300',
                  }}
                />
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

const JobStatusPanel = ({ job, onDismiss, onCancel }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [runtimeAnchorMs, setRuntimeAnchorMs] = useState(() => Date.now());
  const { runStatus } = job;
  const isTerminal = runStatus && TERMINAL_STATUSES.includes(runStatus.status);
  const statusLabel = runStatus?.status || medicareCompareStatus.START;
  const currentStepIndex = getStepIndexFromStatus(runStatus);
  const runtimeLabel = formatRuntime(runStatus, isTerminal, nowMs, runtimeAnchorMs);

  useEffect(() => {
    setRuntimeAnchorMs(Date.now());
  }, [runStatus?.elapsedSeconds, runStatus?.lastUpdateTs, runStatus?.status]);

  useEffect(() => {
    if (!runStatus || isTerminal) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(intervalId);
  }, [runStatus, isTerminal]);

  return (
    <Collapse in>
      <Paper variant="outlined" sx={{ mt: 2, p: 2, position: 'relative' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: isCollapsed ? 0 : 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Batch {job.batchNumber}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ({job.targetDatabase})
            </Typography>
            <Chip
              label={statusLabel}
              size="small"
              color={
                statusLabel === 'COMPLETE' ? 'success'
                  : statusLabel === 'ERROR' ? 'error'
                    : statusLabel === 'CANCELED' ? 'warning'
                      : 'info'
              }
            />
            <Typography variant="body2" color="text.secondary">
              Run time: {runtimeLabel}
            </Typography>
            {!isTerminal && (
              <CircularProgress size={16} thickness={5} />
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {!isTerminal && (
              <IconButton
                size="small"
                onClick={() => setConfirmOpen(true)}
                disabled={cancelling}
                aria-label="Cancel job"
                sx={{ color: 'error.main' }}
              >
                <BlockIcon fontSize="small" />
              </IconButton>
            )}
            <IconButton
              size="small"
              onClick={() => setIsCollapsed((prev) => !prev)}
              aria-label={isCollapsed ? 'Expand job details' : 'Collapse job details'}
            >
              {isCollapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
            </IconButton>
            {isTerminal && (
              <IconButton size="small" onClick={() => onDismiss(job.runId)} aria-label="Dismiss">
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        </Box>

        {!isCollapsed && runStatus && (
          <StepProgress currentStepIndex={currentStepIndex} statusLabel={statusLabel} />
        )}

        {!isCollapsed && runStatus && runStatus.errorMessage && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="body2" color="error">
              Error: {runStatus.errorMessage}
            </Typography>
          </Box>
        )}
      </Paper>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Cancel Job</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to stop this job? Any in-progress inserts will be rolled back and the job can not be resumed.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>No</Button>
          <Button
            variant="destructive"
            onClick={async () => {
              setConfirmOpen(false);
              setCancelling(true);
              try {
                await onCancel(job);
              } finally {
                setCancelling(false);
              }
            }}
          >
            Yes, Cancel Job
          </Button>
        </DialogActions>
      </Dialog>
    </Collapse>
  );
};

export default JobStatusPanel;
