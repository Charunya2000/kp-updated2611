'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import { getValidatedIncidents, uploadIncidentsToIndex, getJobStatus } from './clientServices/searchIndexDataUploadService';
import { getFieldsNamesForIndex } from '@/app/clientServices/aiSearchIndexService';
import useSnackbar from '@/app/hooks/useSnackbar';
import FieldsList from './FieldsList';
import { jobStatus as jobStatusEnum } from '@/utils/constants';

const hiddenFields = ['id', 'content'];

const UpdateIncident = () => {
  const [selectedFile, setSelectedFile] = useState();
  const [isValid, setIsValid] = useState(null);
  const [missingProperties, setMissingProperties] = useState([]);
  const [validationMessage, setValidationMessage] = useState('');
  const [validationFields, setValidationFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const { SnackbarComponent, showSnackbar } = useSnackbar();
  const [isProcessing, setIsProcessing] = useState(false);
  const [pollingJobId, setPollingJobId] = useState(null);
  const fileInputRef = useRef();
  const pollingTimeoutRef = useRef();

  useEffect(() => {
    getFieldsList();
  }, []);

  // Cleanup polling timeout on unmount
  useEffect(() => {
    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Polling function with exponential backoff
   * - Starts with 5 second intervals
   * - Increases interval by 2x after every 5 attempts
   * - Maximum interval of 60 seconds
   * - Continues until job is completed, failed, or cancelled
   */
  const pollForJobCompletion = async (jobId, initialInterval = 5000, maxInterval = 60000) => {
    let currentInterval = initialInterval;
    let attemptCount = 0;

    const poll = async () => {
      try {
        const job = await getJobStatus(jobId);

        if (job.status === jobStatusEnum.COMPLETE) {
          setIsProcessing(false);
          setPollingJobId(null);
          showSnackbar('Incident data upload completed successfully!', 'success', 4000);
          setValidationMessage('Incident data upload completed successfully.');
          return;
        }

        if (job.status === jobStatusEnum.ERROR) {
          setIsProcessing(false);
          setPollingJobId(null);
          showSnackbar(`Upload failed: ${job.error || 'Unknown error'}`, 'error', 6000);
          setValidationMessage(`Upload failed: ${job.error || 'Unknown error'}`);
          setIsValid(false);
          return;
        }

        if (job.status === jobStatusEnum.CANCELED) {
          setIsProcessing(false);
          setPollingJobId(null);
          showSnackbar('Upload was cancelled', 'warning', 4000);
          setValidationMessage('Upload was cancelled.');
          return;
        }

        if (job.status === jobStatusEnum.INDEXING) {
          // get the current progress
          setValidationMessage(`Indexing incidents... (${job.current || 0} of ${job.total || '?'})`);
        }

        if (job.status === jobStatusEnum.PROCESSING) {
          setValidationMessage(`Generating content vectors... (${job.current || 0} of ${job.total || '?'})`);
        }

        // Job is still in progress (pending, running, etc.)
        attemptCount++;

        // Increase interval by 2x after every 5 attempts, up to maxInterval
        if (attemptCount % 5 === 0) {
          currentInterval = Math.min(currentInterval * 2, maxInterval);
        }

        // Schedule next poll
        pollingTimeoutRef.current = setTimeout(poll, currentInterval);

      } catch (error) {
        console.error('Error polling job status:', error);

        // On error, retry with exponential backoff
        attemptCount++;
        if (attemptCount % 5 === 0) {
          currentInterval = Math.min(currentInterval * 2, maxInterval);
        }

        // Continue polling even on error, in case it's a temporary network issue
        pollingTimeoutRef.current = setTimeout(poll, currentInterval);
      }
    };

    // Start polling
    poll();
  };

  const getFieldsList = async () => {
    setLoadingFields(true);
    const fields = await getFieldsNamesForIndex('bcs-incident-001');
    const filteredFields = fields
      .map(field => ({ name: field, selected: true }))
      .filter(field => !hiddenFields.includes(field.name));
    setValidationFields(filteredFields);
    setLoadingFields(false);
  }

  const handleFileChange = (event) => {
    setIsValid(null);
    setMissingProperties([]);
    setValidationMessage('');
    setSelectedFile(event.target.files[0]);
  }

  const handleUpload = async () => {
    try {
      // validate
      setIsProcessing(true);
      const requiredFields = validationFields.filter(field => field.selected).map(field => field.name);
      const { isValid, missingProperties, message, incidents } = await getValidatedIncidents(selectedFile, requiredFields);
      if (!isValid) {
        setIsValid(false);
        setMissingProperties((prev) => [...prev, ...missingProperties]);
        setValidationMessage(message);
        setIsProcessing(false);
        return;
      }

      setIsValid(true);
      setMissingProperties([]);
      setValidationMessage('');

      // If validation passed, upload the incidents to the index
      const uploadResult = await uploadIncidentsToIndex(incidents);

      setSelectedFile(null);
      setValidationMessage('Incident data upload has started. Polling on job id: ' + (uploadResult.job?.id || 'ERROR'));

      // Show success message
      showSnackbar('Incident data upload has started!', 'success');

      // Start polling for job completion if id is returned
      if (uploadResult && uploadResult.job?.id) {
        setPollingJobId(uploadResult.job?.id);
        pollForJobCompletion(uploadResult.job?.id);
      } else {
        // Fallback: if no id, assume synchronous completion
        setIsProcessing(false);
        showSnackbar('Incident data uploaded successfully!', 'success', 4000);
        setValidationMessage('Incident data uploaded successfully.');
      }
    } catch (error) {
      setIsProcessing(false);
      showSnackbar(`Error uploading incident data: ${error.message}`, 'error', 6000);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = null;
      }
    }
  }

  const handleFieldToggle = (fieldIndex) => {
    setValidationFields((prevFields) =>
      prevFields.map((field, index) =>
        index === fieldIndex ? { ...field, selected: !field.selected } : field
      )
    );
  };

  const handleClearErrors = () => {
    setIsValid(null);
    setMissingProperties([]);
    setValidationMessage('');
    setIsProcessing(false);

    // Cancel any ongoing polling
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    setPollingJobId(null);
  }

  const handleCancelUpload = () => {
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    setPollingJobId(null);
    setIsProcessing(false);
    showSnackbar('Upload monitoring cancelled', 'info', 3000);
    setValidationMessage('Upload monitoring cancelled. The upload may still be running in the background.');
  }

  const handleManualRefresh = async () => {
    if (!pollingJobId) return;

    try {
      showSnackbar('Refreshing status...', 'info', 1500);
      const job = await getJobStatus(pollingJobId);

      if (job.status === jobStatusEnum.COMPLETE) {
        setIsProcessing(false);
        setPollingJobId(null);
        showSnackbar('Incident data upload completed successfully!', 'success', 4000);
        setValidationMessage('Incident data upload completed successfully.');
        return;
      }

      if (job.status === jobStatusEnum.ERROR) {
        setIsProcessing(false);
        setPollingJobId(null);
        showSnackbar(`Upload failed: ${job.error || 'Unknown error'}`, 'error', 6000);
        setValidationMessage(`Upload failed: ${job.error || 'Unknown error'}`);
        setIsValid(false);
        return;
      }

      if (job.status === jobStatusEnum.CANCELED) {
        setIsProcessing(false);
        setPollingJobId(null);
        showSnackbar('Upload was cancelled', 'warning', 4000);
        setValidationMessage('Upload was cancelled.');
        return;
      }

      if (job.status === jobStatusEnum.INDEXING) {
        setValidationMessage(`Indexing incidents... (${job.current || 0} of ${job.total || '?'})`);
        showSnackbar('Status updated', 'success', 2000);
      } else {
        showSnackbar('Status checked - still processing', 'info', 2000);
      }

      if (job.status === jobStatusEnum.PROCESSING) {
        setValidationMessage(`Generating content vectors... (${job.current || 0} of ${job.total || '?'})`);
        showSnackbar('Status updated', 'success', 2000);
      } else {
        showSnackbar('Status checked - still processing', 'info', 2000);
      }
    } catch (error) {
      showSnackbar(`Error checking status: ${error.message}`, 'error', 4000);
    }
  }

  return (
    <Box sx={{
      height: '100%',
      gap: 1,
      p: 2,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <Box sx={{ display: 'flex', gap: 2, overflow: 'hidden', flex: 1 }}>
        <Box sx={{
          width: '50%',
          border: '1px solid',
          borderColor: 'color.slate',
          borderRadius: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          p: 2
        }}>
          <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 800, py: 2 }}>
            Select the fields you want to validate against to ensure your data has all the required fields.
          </Typography>
          <FieldsList fields={validationFields} isLoading={loadingFields} onFieldToggle={handleFieldToggle} />
        </Box>
        <Box sx={{
          width: '50%',
          border: '1px solid',
          borderColor: 'color.slate',
          borderRadius: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          p: 2
        }}>
          <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 800, py: 2 }}>
            To add incident data, select an incident data file. Then click Upload to run the validation and update the index. If validation fails, the index will not be updated.
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button disabled={isProcessing} variant="outlined" component="label" sx={{ width: 'fit-content' }}>
              Select Incident Data File
              <input type="file" hidden ref={fileInputRef} onChange={handleFileChange} accept="application/json" />
            </Button>
            <Box>
              <Typography variant="body1" color="text.secondary">
                {selectedFile ? `Selected file: ${selectedFile.name}` : 'No file selected'}
              </Typography>
            </Box>
          </Box>
          {
            selectedFile && !isProcessing && (
              <Box sx={{ mt: 8, alignSelf: 'flex-end' }}>
                <Button disabled={isProcessing} variant="primary" onClick={handleUpload}>
                  Upload Incident Data
                </Button>
              </Box>
            )
          }
          {
            isProcessing && pollingJobId && (
              <Box sx={{ mt: 8, alignSelf: 'flex-end', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button variant="outlined" onClick={handleCancelUpload} sx={{ width: 'fit-content', alignSelf: 'flex-end' }}>
                  Cancel Monitoring
                </Button>
                <Typography variant="body2" sx={{ alignSelf: 'center', color: 'text.secondary' }}>
                  Canceling monitoring will stop status updates, but the upload may still be running in the background.
                </Typography>
              </Box>
            )
          }
          {
            isValid === false && (
              <Alert severity="error" onClose={handleClearErrors} sx={{ mt: 4 }}>
                {
                  validationMessage && (
                    <Typography variant="body1">
                      {validationMessage}
                    </Typography>
                  )
                }
                {
                  missingProperties.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body1" sx={{ mb: 2 }}>
                        Missing Properties:
                      </Typography>
                      <TableContainer component={Box} sx={{ maxHeight: 600, overflow: 'auto' }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ backgroundColor: '#180f0f' }}><strong>Index</strong></TableCell>
                              <TableCell sx={{ backgroundColor: '#180f0f' }}><strong>Missing Properties</strong></TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {missingProperties.map((item, idx) => (
                              <TableRow key={idx} hover>
                                <TableCell sx={{ backgroundColor: '#180f0f' }}>{item.index}</TableCell>
                                <TableCell sx={{ backgroundColor: '#180f0f' }}>{item.fields.join(', ')}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )
                }
              </Alert>
            )
          }
          {
            isValid === true && (
              <Box sx={{ mt: 4 }}>
                <Alert severity={isProcessing ? "info" : "success"} onClose={handleClearErrors}>
                  <Typography variant="body1">
                    {validationMessage || `Incident data validated successfully. Upload in progress.`}
                  </Typography>
                  {isProcessing && pollingJobId && (
                    <Typography variant="body2" sx={{ mt: 1, fontSize: '0.875rem', opacity: 0.8 }}>
                      Job ID: {pollingJobId} - Monitoring upload progress...
                    </Typography>
                  )}
                </Alert>
                {isProcessing && pollingJobId && (
                  <Box sx={{ mt: 2, display: 'flex' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleManualRefresh}
                      sx={{
                        fontSize: '0.875rem',
                        textTransform: 'none',
                        ml: 'auto'
                      }}
                    >
                      Refresh Status
                    </Button>
                  </Box>
                )}
              </Box>
            )
          }
        </Box>
      </Box>
      <SnackbarComponent />
    </Box>
  );
}

export default UpdateIncident;