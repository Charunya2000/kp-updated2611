'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Alert,
  CircularProgress,
  Stack
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Download as DownloadIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { romApiService } from '../clientServices/romApiService';
import FinalResultsDisplay from './FinalResultsDisplay';

const SessionDisplayPage = ({ sessionId, onClose }) => {
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load session data
  useEffect(() => {
    const loadSessionData = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('👁️ Loading session data for display:', sessionId);
        const response = await romApiService.getFinalWorkflowState(sessionId);

        if (response.success && response.workflow_state) {
          setSessionData(response.workflow_state);
          console.log('✅ Session data loaded for display:', response.workflow_state);
        } else {
          throw new Error('Failed to load session data');
        }
      } catch (err) {
        console.error('❌ Failed to load session data:', err);
        setError('Failed to load session data: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    if (sessionId) {
      loadSessionData();
    }
  }, [sessionId]);

  // Download session results
  const handleDownload = async () => {
    try {
      console.log('📥 Downloading session results:', sessionId);

      if (!sessionData) {
        throw new Error('No session data available for download');
      }

      // Create comprehensive ROM results package
      const romResults = {
        summary_rom: sessionData.summary_rom,
        detailed_rom: sessionData.detailed_rom,
        extracted_details: sessionData.extracted_details,
        project_info: {
          project_id: sessionData.project_id,
          session_id: sessionId,
          project_title: sessionData.input_data?.project_title,
          generated_at: new Date().toISOString(),
          status: sessionData.status
        }
      };

      // Download Complete ROM Results Package
      const completeResultsBlob = new Blob([JSON.stringify(romResults, null, 2)], {
        type: 'application/json'
      });
      const completeResultsUrl = URL.createObjectURL(completeResultsBlob);
      const completeResultsLink = document.createElement('a');
      completeResultsLink.href = completeResultsUrl;
      completeResultsLink.download = `ROM_Session_${sessionId}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(completeResultsLink);
      completeResultsLink.click();
      document.body.removeChild(completeResultsLink);
      URL.revokeObjectURL(completeResultsUrl);

      console.log('✅ Session results downloaded');

    } catch (error) {
      console.error('❌ Download failed:', error);
      setError('Failed to download results: ' + error.message);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading session data...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Button onClick={onClose} sx={{ mt: 2 }}>
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  if (!sessionData) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">No session data found</Alert>
        <Button onClick={onClose} sx={{ mt: 2 }}>
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Paper elevation={3} sx={{ p: 4, mb: 3, bgcolor: 'primary.50' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h3" component="h1" color="primary" gutterBottom>
              ROM Session Details
            </Typography>
            <Typography variant="h6" color="text.secondary">
              {sessionData.input_data?.project_title || 'Unknown Project'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Session ID: {sessionId}
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleDownload}
            >
              Download Results
            </Button>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={onClose}
            >
              Back to Dashboard
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Session Results Display */}
      <FinalResultsDisplay
        workflowData={sessionData}
        onDownload={handleDownload}
        onStartNew={onClose}
        onGoToDashboard={onClose}
      />
    </Box>
  );
};

export default SessionDisplayPage;