'use client';

import React, { useState, useEffect } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Chip,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RefreshIcon from '@mui/icons-material/Refresh';
import LockIcon from '@mui/icons-material/Lock';
import { useAuth } from '@/app/contexts/OpenIdAuthContext';

const SLAFileUpload = ({
  sessionId,
  apiBaseUrl,
  onUpload,
  onConfirm,
  slaData,
  slaUploaded,
  slaConfirmed,
  uploadedFileNames = [], // Array of uploaded file names
  isOwner = true, // Default to true for backward compatibility
}) => {
  const { user } = useAuth();
  const currentUserNUID = user?.nuid || user?.userId || user?.id || '';
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tableData, setTableData] = useState([]);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [adjustmentText, setAdjustmentText] = useState('');
  const [adjustmentLoading, setAdjustmentLoading] = useState(false);

  // Log uploaded filenames for debugging
  useEffect(() => {
    console.log('🏷️ [SLAFileUpload] uploadedFileNames prop:', uploadedFileNames);
    console.log('🏷️ [SLAFileUpload] slaUploaded:', slaUploaded);
  }, [uploadedFileNames, slaUploaded]);

  // Convert SLA data to table format
  useEffect(() => {
    if (slaData && Object.keys(slaData).length > 0) {
      const responseTimeSla = slaData.response_time_sla || {};
      const transactionSuccessRateSla = slaData.transaction_success_rate_sla || slaData.success_rate_sla || {};
      const tpsData = slaData.tps || {};
      const urlData = slaData.url || {}; // Assuming URL data is part of slaData
      const allTxns = new Set([
        ...Object.keys(responseTimeSla),
        ...Object.keys(transactionSuccessRateSla),
        ...Object.keys(tpsData),
      ]);

      const rows = Array.from(allTxns)
        .sort()
        .map((txn) => ({
          transactionName: txn,
          url: urlData[txn] || 'N/A', // Add URL field
          expectedTPS: tpsData[txn] || 'N/A',
          transactionSuccessRateSLA: transactionSuccessRateSla[txn] || 'N/A',
          responseSLA: responseTimeSla[txn] || 'N/A',
        }));

      setTableData(rows);
    }
  }, [slaData]);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
      setSuccess('');

      // Show warning if replacing existing SLA
      if (slaUploaded && slaConfirmed) {
        console.log('User is replacing confirmed SLA data');
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    if (!sessionId) {
      setError('Please enter a session ID first');
      return;
    }

    if (!isOwner) {
      setError('You do not have permission to upload files to this session');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Step 1: Get upload URL
      const endpoint = '/api/pts/get-upload-urls';

      const urlResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          run_id: sessionId,
          source_type: 'sla',
          sla_filename: `SLA_Limits.${file.name.split('.').pop()}`,
          createdByNUID: user?.nuid || user?.userId || '',
        }),
      });

      if (!urlResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const urlData = await urlResponse.json();
      const sasUrls = urlData.sas_urls || [];

      if (sasUrls.length === 0) {
        throw new Error('No upload URL available');
      }

      const sasUrl = sasUrls[0].sas_url;

      // Step 2: Upload file via proxy to avoid CORS
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sas_url', sasUrl);

      const uploadResponse = await fetch('/api/pts/upload-file', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status ${uploadResponse.status}`);
      }

      setSuccess('SLA file uploaded successfully!');

      // Step 3: Load SLA data from blob storage
      const loadEndpoint = `/api/pts/load-sla/${sessionId}`;

      const loadResponse = await fetch(loadEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          createdByNUID: user?.nuid || user?.userId || '',
        }),
      });

      if (loadResponse.ok) {
        const loadData = await loadResponse.json();
        const slaDataDict = loadData.sla_data || {};
        const standardizedFilename = `SLA_Limits.${file.name.split('.').pop()}`;
        onUpload(true, slaDataDict, standardizedFilename); // Pass standardized filename to parent
        setFile(null);
      } else {
        const errorData = await loadResponse.json().catch(() => ({}));
        console.error('Failed to load SLA data:', errorData);
        throw new Error(errorData.error || 'Failed to load SLA data');
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustment = async () => {
    if (!adjustmentText.trim()) {
      setError('Please enter an adjustment request');
      return;
    }

    try {
      setAdjustmentLoading(true);
      setError('');

      const adjustEndpoint = `/api/pts/adjust-sla/${sessionId}`;

      const response = await fetch(adjustEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjustment_text: adjustmentText,
          createdByNUID: currentUserNUID,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to apply adjustments');
      }

      const result = await response.json();

      if (result.sla_updated) {
        // Update the UI with new SLA data
        onUpload(true, result.sla_data);

        // Automatically confirm the adjusted SLA values
        const confirmEndpoint = `/api/pts/update-sla-data/${sessionId}`;
        const confirmResponse = await fetch(confirmEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sla_data: result.sla_data,
            confirmed: true,
            createdByNUID: currentUserNUID,
          }),
        }); if (confirmResponse.ok) {
          onConfirm(result.sla_data);
          setAdjustmentText('');
          setAdjustmentOpen(false);
          setSuccess('SLA values adjusted and confirmed successfully!');
        } else {
          throw new Error('Failed to confirm adjusted SLA values');
        }
      } else {
        setError(result.message || 'Could not apply adjustments');
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setAdjustmentLoading(false);
    }
  };

  const handleConfirm = async () => {
    try {
      setLoading(true);
      setError('');

      const confirmEndpoint = `/api/pts/update-sla-data/${sessionId}`;

      const response = await fetch(confirmEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sla_data: slaData,
          confirmed: true,
          createdByNUID: currentUserNUID,
        }),
      }); if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to confirm SLA data:', errorData);
        throw new Error(errorData.error || 'Failed to confirm SLA data');
      }

      const result = await response.json();
      onConfirm(slaData);
      setSuccess('SLA values confirmed!');
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Compact view flag: when SLA is uploaded and there are more than 10 rows
  const compactView = slaUploaded && tableData.length > 10;

  return (
    <Card sx={{ width: '100%', overflow: 'visible', opacity: isOwner ? 1 : 0.6, pointerEvents: isOwner ? 'auto' : 'none' }}>
      <CardHeader
        title="SLA Configuration (Mandatory)"
        subtitle="Upload and configure Service Level Agreement limits"
      />
      <Divider />
      <CardContent sx={{ p: 3, pb: 3 }}>
        {/* Read-only alert for non-owners */}
        {!isOwner && (
          <Alert severity="warning" sx={{ mb: 3, pointerEvents: 'auto' }} icon={<LockIcon />}>
            <strong>Read-Only Mode:</strong> This session is owned by another user. You cannot upload or modify SLA configuration.
          </Alert>
        )}
        {/* Upload Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
            Required Format
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Excel or CSV file with columns: <code>Transaction Name</code>, <code>URLs</code>, <code>Transaction per second</code>, <code>Transaction Success Rate SLA</code>, <code>Response time SLA (95th percentile)</code>
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              component="label"
              startIcon={<CloudUploadIcon />}
              disabled={loading || !isOwner}
            >
              {slaUploaded ? 'Replace File' : 'Choose File'}
              <input
                hidden
                accept=".xlsx,.xls,.csv"
                type="file"
                onChange={handleFileChange}
              />
            </Button>

            {file && (
              <Chip
                label={`${file.name} (${(file.size / 1024).toFixed(2)} KB)`}
                onDelete={() => setFile(null)}
                color="primary"
              />
            )}

            <Button
              variant="contained"
              color="primary"
              onClick={handleUpload}
              disabled={!file || loading || !isOwner}
            >
              {loading ? <CircularProgress size={24} /> : (slaUploaded ? 'Upload New File' : 'Upload')}
            </Button>
          </Box>

          {slaUploaded && file && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Uploading a new file will replace the existing SLA configuration. You will need to confirm the new values.
            </Alert>
          )}

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}
        </Box>

        {/* Uploaded Files Display */}
        {slaUploaded && uploadedFileNames.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Box sx={(theme) => ({ border: `1px solid ${theme.palette.divider}`, borderRadius: 1, p: 2 })}>
              {[...new Set(uploadedFileNames)].map((filename, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircleIcon color="success" fontSize="small" />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    SLA File is uploaded as {filename}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* SLA Data Display */}
        {slaUploaded && tableData.length > 0 && (
          <Box>
            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
              Current SLA Configuration ({tableData.length} transactions)
            </Typography>

            {/* Confirm Button - Always visible */}
            <Box sx={{
              mb: 3,
              display: 'flex',
              gap: 2,
              justifyContent: 'center'
            }}>
              <Button
                variant="contained"
                color={slaConfirmed ? "success" : "primary"}
                size="large"
                fullWidth
                onClick={handleConfirm}
                disabled={loading || slaConfirmed}
                startIcon={<CheckCircleIcon />}
                sx={{ maxWidth: 400, py: 1.5 }}
              >
                {loading ? <CircularProgress size={24} /> : slaConfirmed ? '✓ SLA Values Confirmed' : 'Confirm SLA Values'}
              </Button>
            </Box>

            {/* Adjustment Interface */}
            <Box sx={{ mb: 3, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
              <Typography variant="subtitle3" sx={{ mb: 1, fontWeight: 'bold' }}>
                Need to adjust any values?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Examples: "Set Expected TPS for VVE_01 to 10" or "Change Response Time SLA for VVE_03 to 3 seconds"
              </Typography>
              <Button
                variant="contained"
                size="small"
                onClick={() => setAdjustmentOpen(true)}
              >
                Adjust SLA Values
              </Button>
            </Box>

            {/* Table - compact with internal scrolling when large */}
            <TableContainer
              component={Box}
              sx={(theme) => ({
                mb: 4,
                maxHeight: compactView ? '480px' : 'auto',
                overflowY: compactView ? 'auto' : 'visible',
                // Place scrollbar on the left when compacting (keeps content LTR)
                direction: compactView ? 'rtl' : 'ltr',
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1,
              })}
            >
              <Table stickyHeader size={compactView ? 'small' : 'medium'} sx={{ direction: 'ltr' }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'primary.main' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', bgcolor: 'primary.main', minWidth: 250 }}>
                      Transaction Name
                    </TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', bgcolor: 'primary.main', minWidth: 250 }}>
                      URL
                    </TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', bgcolor: 'primary.main', minWidth: 150 }} align="right">
                      Expected TPS
                    </TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', bgcolor: 'primary.main', minWidth: 220 }} align="right">
                      Transaction Success Rate SLA
                    </TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', bgcolor: 'primary.main', minWidth: 200 }} align="right">
                      Response Time SLA (sec)
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tableData.map((row, index) => (
                    <TableRow key={index} hover sx={compactView ? { height: 36 } : undefined}>
                      <TableCell sx={{ minWidth: 250, py: compactView ? 0.5 : 1 }}>{row.transactionName}</TableCell>
                      <TableCell sx={{ minWidth: 250, py: compactView ? 0.5 : 1 }}>
                        {row.url !== 'N/A' ? (
                          <a href={row.url} target="_blank" rel="noopener noreferrer">
                            {row.url}
                          </a>
                        ) : (
                          'N/A'
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ minWidth: 150, py: compactView ? 0.5 : 1 }}>{row.expectedTPS}</TableCell>
                      <TableCell align="right" sx={{ minWidth: 220, py: compactView ? 0.5 : 1 }}>{row.transactionSuccessRateSLA}</TableCell>
                      <TableCell align="right" sx={{ minWidth: 200, py: compactView ? 0.5 : 1 }}>{row.responseSLA}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {slaConfirmed && (
              <Box sx={{ mt: 2, mb: 6 }}>
                <Button
                  variant="contained"
                  color="success"
                  fullWidth
                  startIcon={<CheckCircleIcon />}
                  sx={{
                    py: 1.5,
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    cursor: 'default',
                    '&:hover': {
                      backgroundColor: 'success.main',
                    }
                  }}
                >
                  SLA Values Confirmed
                </Button>
              </Box>
            )}
          </Box>
        )}
      </CardContent>

      {/* Adjustment Dialog */}
      <Dialog open={adjustmentOpen} onClose={() => setAdjustmentOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Adjust SLA Values</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Enter your adjustment request"
              placeholder="e.g., 'Set Expected TPS for VVE_01 to 10' or 'Change all Clinical Directory SLAs to 3 seconds'"
              value={adjustmentText}
              onChange={(e) => setAdjustmentText(e.target.value)}
              variant="outlined"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdjustmentOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAdjustment}
            variant="contained"
            disabled={!adjustmentText.trim() || adjustmentLoading}
          >
            {adjustmentLoading ? <CircularProgress size={24} /> : 'Apply Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default SLAFileUpload;
