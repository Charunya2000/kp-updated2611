'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import SendIcon from '@mui/icons-material/Send';
import { checkRunHistoryBatchExists, getActiveJobs } from './clientServices/batchEntryService';
import {
  getDefaultKpifTargetDatabase,
  getKpifTargetDatabaseOptions,
} from './config/targetDatabases';

const BatchEntryForm = ({ onSubmit, submitting = false, envName }) => {
  const databaseOptions = getKpifTargetDatabaseOptions(envName);
  const [targetDatabase, setTargetDatabase] = useState(getDefaultKpifTargetDatabase(envName));
  const [batchNumber, setBatchNumber] = useState('');
  const [processedOn, setProcessedOn] = useState(null);
  const [checkingHistory, setCheckingHistory] = useState(false);
  const [checkingActive, setCheckingActive] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [runningDialogOpen, setRunningDialogOpen] = useState(false);
  const [runningJob, setRunningJob] = useState(null);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState(null);
  const [error, setError] = useState(null);

  const closeConfirmDialog = () => {
    if (confirmSubmitting) return;
    setConfirmDialogOpen(false);
    setPendingSubmission(null);
  };

  const closeRunningDialog = () => {
    setRunningDialogOpen(false);
    setRunningJob(null);
  };

  const handleConfirmRun = async () => {
    if (!pendingSubmission) return;

    setConfirmSubmitting(true);
    try {
      await onSubmit(pendingSubmission);
      setConfirmDialogOpen(false);
      setPendingSubmission(null);
    } catch (err) {
      setError(err.message || 'Failed to submit batch entry. Please try again.');
    } finally {
      setConfirmSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!batchNumber.trim()) {
      setError('Batch Number is required.');
      return;
    }

    if (!processedOn) {
      setError('Processed On date is required.');
      return;
    }

    const formatDate = (date) => {
      try {
        return date.toLocaleDateString('en-CA'); // YYYY-MM-DD format
      } catch {
        return null;
      }
    };

    const normalizedBatchNumber = batchNumber.trim();
    const submissionPayload = {
      targetDatabase,
      batchNumber: normalizedBatchNumber,
      processedOn: formatDate(processedOn),
      refresh: true,
    };

    setCheckingActive(true);
    try {
      const activeJobs = await getActiveJobs();
      const activeMatch = (activeJobs || []).find((job) => {
        return String(job?.batchNumber || '').trim() === normalizedBatchNumber
          && String(job?.targetDatabase || '').toLowerCase() === String(targetDatabase || '').toLowerCase();
      });

      if (activeMatch) {
        setRunningJob(activeMatch);
        setRunningDialogOpen(true);
        return;
      }

      setCheckingHistory(true);
      const { exists } = await checkRunHistoryBatchExists({
        targetDatabase,
        batchNumber: normalizedBatchNumber,
      });

      if (exists) {
        setPendingSubmission(submissionPayload);
        setConfirmDialogOpen(true);
        return;
      }

      await onSubmit(submissionPayload);
    } catch (err) {
      setError(err.message || 'Failed to validate run history. Please try again.');
    } finally {
      setCheckingActive(false);
      setCheckingHistory(false);
    }
  };

  const isBusy = submitting || checkingActive || checkingHistory || confirmSubmitting;

  return (
    <Paper elevation={2} sx={{ p: 4, maxWidth: 520, mx: 'auto', mt: 2 }}>
      <Typography variant="h6" sx={{ mb: 3 }}>
        Submit Batch Entry
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Target Database */}
        <FormControl fullWidth>
          <InputLabel id="target-database-label">Target Database</InputLabel>
          <Select
            labelId="target-database-label"
            id="target-database"
            value={targetDatabase}
            label="Target Database"
            onChange={(e) => setTargetDatabase(e.target.value)}
            disabled={isBusy}
          >
            {databaseOptions.map((db) => (
              <MenuItem key={db.value} value={db.value}>
                {db.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Batch Number */}
        <TextField
          label="Batch Number"
          variant="outlined"
          fullWidth
          value={batchNumber}
          onChange={(e) => setBatchNumber(e.target.value)}
          disabled={isBusy}
          required
          placeholder="e.g. 3274"
        />

        {/* Processed On Date */}
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label="Processed On"
            value={processedOn}
            onChange={(newValue) => setProcessedOn(newValue)}
            format="yyyy-MM-dd"
            disabled={isBusy}
            slotProps={{ textField: { fullWidth: true, required: true } }}
          />
        </LocalizationProvider>

        {/* Submit Button */}
        <Button
          type="submit"
          variant="primary"
          disabled={isBusy || !batchNumber.trim() || !processedOn}
          endIcon={isBusy ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
          sx={{ mt: 1 }}
        >
          {checkingActive
            ? 'Checking active runs…'
            : (checkingHistory ? 'Checking history…' : (submitting ? 'Submitting…' : 'Run Batch Compare'))}
        </Button>
      </Box>

      <Dialog
        open={confirmDialogOpen}
        onClose={closeConfirmDialog}
        aria-labelledby="overwrite-confirmation-dialog-title"
        aria-describedby="overwrite-confirmation-dialog-description"
      >
        <DialogTitle id="overwrite-confirmation-dialog-title">Batch already exists</DialogTitle>
        <DialogContent>
          <DialogContentText id="overwrite-confirmation-dialog-description">
            Batch {pendingSubmission?.batchNumber} already exists in run history for {(pendingSubmission?.targetDatabase || '').toUpperCase()}. This process will overwrite previous comparison data. Do you want to run the batch anyway?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeConfirmDialog} disabled={confirmSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmRun}
            color="warning"
            variant="contained"
            disabled={confirmSubmitting}
            autoFocus
          >
            {confirmSubmitting ? 'Submitting…' : 'Run Anyway'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={runningDialogOpen}
        onClose={closeRunningDialog}
        aria-labelledby="running-batch-dialog-title"
        aria-describedby="running-batch-dialog-description"
      >
        <DialogTitle id="running-batch-dialog-title">Batch already running</DialogTitle>
        <DialogContent>
          <DialogContentText id="running-batch-dialog-description">
            This batch is currently being processed in this environment. You must cancel the existing run, or wait until it completes to execute the batch again.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRunningDialog} autoFocus>
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default BatchEntryForm;
