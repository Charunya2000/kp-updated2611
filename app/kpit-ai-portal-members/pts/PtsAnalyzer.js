'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Tabs,
  Tab,
  Card,
  CardContent,
  Typography,
  Alert,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import SessionInformation from './components/SessionInformation';
import SLAFileUpload from './components/SLAFileUpload';
import TestResultsUpload from './components/TestResultsUpload';
import DataAnalysis from './components/DataAnalysis';
import PerformanceReport from './components/PerformanceReport';
import ChatInterface from './components/ChatInterface';
import { PTS_CONFIG } from './ptsConfig';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || PTS_CONFIG.API.BASE_URL

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`pts-tabpanel-${index}`}
      aria-labelledby={`pts-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2, px: 2 }}>{children}</Box>}
    </div>
  );
}

const PtsAnalyzer = () => {
  const [tabValue, setTabValue] = useState(0);
  const [sessionId, setSessionId] = useState('');
  const [slaUploaded, setSlaUploaded] = useState(false);
  const [slaConfirmed, setSlaConfirmed] = useState(false);
  const [slaFileNames, setSlaFileNames] = useState([]); // Store array of uploaded filenames
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisError, setAnalysisError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sourceType, setSourceType] = useState('loadrunner');
  const [uploadStatus, setUploadStatus] = useState({});
  const [slaData, setSlaData] = useState({});
  const [isSessionOwner, setIsSessionOwner] = useState(true);
  const [sessionOwnerNUID, setSessionOwnerNUID] = useState('');


  // Load sessionId from localStorage on mount - DISABLED to keep page clean
  useEffect(() => {
    // Commenting out auto-restore to prevent auto-loading sessions
    // const savedSessionId = localStorage.getItem('pts_session_id');
    // if (savedSessionId) {
    //   console.log('🔄 Restoring session from localStorage:', savedSessionId);
    //   setSessionId(savedSessionId);
    // }
    console.log('🆕 PTS page loaded clean - no auto-restore from localStorage');
  }, []);

  // Save sessionId to localStorage whenever it changes
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('pts_session_id', sessionId);
      console.log('💾 Saved session to localStorage:', sessionId);
    }
  }, [sessionId]);

  // Log configuration on component mount
  useEffect(() => {
    console.log('[PTS] Analyzer Component Mounted');
    console.log('API Base URL:', API_BASE_URL);
    console.log('Environment:', process.env.NODE_ENV);
    console.log('PTS Configuration:', PTS_CONFIG);
    console.log('ℹOpen browser console to see detailed debug logs');
  }, []);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    console.log('Tab changed to:', newValue);
  };

  const handleSessionChange = (newSessionId) => {
    console.log('Session changed:', newSessionId);
    setSessionId(newSessionId);

    // Clear all state for new session
    setSlaUploaded(false);
    setSlaConfirmed(false);
    setSlaData({});
    setSlaFileNames([]);
    setUploadStatus({});
    setIsSessionOwner(false);
    setSessionOwnerNUID('');
    console.log('Cleared all state for new session');
  };

  const handleOwnershipChange = (isOwner, ownerNUID) => {
    console.log('🔐 [PTS] Session ownership changed:', { isOwner, ownerNUID });
    console.log('🔐 [PTS] Tabs will be', isOwner ? 'ENABLED' : 'DISABLED');
    setIsSessionOwner(isOwner);
    setSessionOwnerNUID(ownerNUID || '');
  };

  const handleSessionLoaded = (sessionData) => {
    console.log('📂 [PTS] Existing session loaded:', sessionData);

    // If session has existing SLA, mark it as uploaded and confirmed
    if (sessionData.hasSLA) {
      console.log('SLA already exists for this session');
      setSlaUploaded(true);
      setSlaConfirmed(true);

      // Restore SLA filenames if available
      if (sessionData.slaFileNames && sessionData.slaFileNames.length > 0) {
        setSlaFileNames(sessionData.slaFileNames);
        console.log('Restored SLA filenames:', sessionData.slaFileNames);
      }
    }

    // If session has existing data files, mark them as uploaded
    if (sessionData.hasDataFiles && sessionData.dataFiles) {
      console.log('✅ Data files already exist for this session:', sessionData.dataFiles);
      const status = {};
      sessionData.dataFiles.forEach(file => {
        status[file] = 'Uploaded'; // Match the capitalization in DataAnalysis.js
      });
      setUploadStatus(status);
      console.log('📊 Upload status set:', status);
    }

    // Stay on Session Info tab to show the report - don't auto-navigate
    console.log('ℹ️ Session loaded - staying on Session Info tab');
  };

  const handleSlaUpload = (success, data, filename) => {
    console.log('📤 SLA upload:', { success, dataKeys: Object.keys(data), filename });
    if (success) {
      setSlaUploaded(true);
      setSlaData(data);
      // Add the new filename to the array
      setSlaFileNames(prev => {
        const newFilename = filename || 'SLA_Limits';
        return prev.includes(newFilename) ? prev : [...prev, newFilename];
      });
      setSlaConfirmed(false); // Require confirmation

      // Add SLA file to upload status so it shows in the UI
      setUploadStatus(prevStatus => ({
        ...prevStatus,
        'SLA_Limits': 'Uploaded'
      }));
      console.log('✅ SLA file marked as uploaded in uploadStatus');
    }
  };

  const handleSlaConfirm = (confirmedData) => {
    console.log('✅ SLA confirmed');
    setSlaData(confirmedData);
    setSlaConfirmed(true);
  };

  const handleSourceTypeChange = (newSourceType) => {
    console.log('🔄 Source type changed:', newSourceType);
    setSourceType(newSourceType);
    setUploadStatus({}); // Clear upload status when source type changes
  };

  const handleAnalyzeStart = () => {
    console.log('▶️ Analysis started');
    setLoading(true);
    setError('');
    setAnalysisError('');
    setAnalysisResult(null);
  };

  const handleAnalyzeComplete = (result) => {
    console.log('✨ Analysis completed');
    setAnalysisResult(result);
    setAnalysisError('');
    setLoading(false);
    setTabValue(4); // Move to report tab
  };

  const handleAnalyzeError = (errorMsg) => {
    setAnalysisError(errorMsg);  // store error for Report tab
    setLoading(false);
    setError(errorMsg);          // optional top-level banner
  };

  const handleClearSession = async (options = {}) => {
    if (!sessionId) return null;

    const {
      sources = null,
      deleteSla = true,
      deleteAnalysis = true,
    } = options;

    try {
      const response = await fetch(`/api/pts/session/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources,
          delete_sla: deleteSla,
          delete_analysis: deleteAnalysis,
        }),
      });

      const data = await response.json().catch(() => ({}));
      console.log('Clear session response:', response.status, data);

      if (!response.ok) {
        const msg = data.detail || data.message || `Failed with status ${response.status}`;
        throw new Error(msg);
      }

      // Reset local UI state as before...
      setSessionId('');
      localStorage.removeItem('pts_session_id');
      setSlaUploaded(false);
      setSlaConfirmed(false);
      setSlaData({});
      setSlaFileNames([]);
      setUploadStatus({});
      setAnalysisResult(null);
      setAnalysisError('');
      setError('');
      setLoading(false);
      setTabValue(0);

      return data; // <-- return backend response so child can show details
    } catch (err) {
      console.error('Failed to clear session:', err);
      setError(err.message || 'Failed to clear session');
      throw err;
    }
  };



  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto'
      }}
    >
      <Container
        maxWidth="xl"
        disableGutters
        sx={{
          p: 2,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'visible',
          minHeight: '100%',
          height: 'auto'
        }}
      >
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
            Performance Testing (PTS)
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Upload test data from LoadRunner, Dynatrace, or Azure, define SLA limits, and analyze performance metrics
          </Typography>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="PTS workflow tabs"
            sx={{
              '& .MuiTabs-indicator': {
                backgroundColor: '#003B71',
              },
              '& .MuiTab-root': {
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 500,
                minWidth: 'auto',
                px: 2,
                color: '#666666 !important',
              },
              '& .MuiTab-root.Mui-selected': {
                color: '#003B71 !important',
                fontWeight: '600 !important',
              }
            }}
          >
            <Tab label="Session Info" id="pts-tab-0" aria-controls="pts-tabpanel-0" />
            <Tab
              label="SLA Configuration"
              id="pts-tab-1"
              aria-controls="pts-tabpanel-1"
              disabled={!isSessionOwner}
              sx={!isSessionOwner ? { opacity: 0.5 } : {}}
            />
            <Tab
              label="Upload Results"
              id="pts-tab-2"
              aria-controls="pts-tabpanel-2"
              disabled={!isSessionOwner}
              sx={!isSessionOwner ? { opacity: 0.5 } : {}}
            />
            <Tab label="Analyze" id="pts-tab-3" aria-controls="pts-tabpanel-3" />
            <Tab label="Report" id="pts-tab-4" aria-controls="pts-tabpanel-4" />
            <Tab label="Chat" id="pts-tab-5" aria-controls="pts-tabpanel-5" />
          </Tabs>
        </Box>

        {/* Read-Only Session Message */}
        {!isSessionOwner && sessionId && (
          <Alert severity="info" sx={{ mx: 2, mt: 2 }} icon={<LockIcon />}>
            <strong>Read-Only Session:</strong> {sessionOwnerNUID
              ? 'SLA Configuration and Upload Results tabs are disabled because you are not the owner of this session.'
              : 'Session ownership could not be verified. SLA Configuration and Upload Results tabs are disabled. Please reload the session or contact support.'}
          </Alert>
        )}

        {/* Tab Content */}
        <Box sx={{ px: 2, pb: 2 }}>
          <TabPanel value={tabValue} index={0}>
            <SessionInformation
              sessionId={sessionId}
              onSessionChange={handleSessionChange}
              onSessionLoaded={handleSessionLoaded}
              onOwnershipChange={handleOwnershipChange}
              sourceType={sourceType}
              apiBaseUrl={API_BASE_URL}
              uploadStatus={uploadStatus}
              slaFileNames={slaFileNames}
              onClearSession={handleClearSession}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <SLAFileUpload
              sessionId={sessionId}
              apiBaseUrl={API_BASE_URL}
              onUpload={handleSlaUpload}
              onConfirm={handleSlaConfirm}
              slaData={slaData}
              slaUploaded={slaUploaded}
              slaConfirmed={slaConfirmed}
              uploadedFileNames={slaFileNames}
              isOwner={isSessionOwner}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <TestResultsUpload
              sessionId={sessionId}
              sourceType={sourceType}
              onSourceTypeChange={handleSourceTypeChange}
              apiBaseUrl={API_BASE_URL}
              uploadStatus={uploadStatus}
              setUploadStatus={setUploadStatus}
              isOwner={isSessionOwner}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            <DataAnalysis
              sessionId={sessionId}
              sourceType={sourceType}
              slaConfirmed={slaConfirmed}
              slaUploaded={slaUploaded}
              uploadStatus={uploadStatus}
              apiBaseUrl={API_BASE_URL}
              onAnalyzeStart={handleAnalyzeStart}
              onAnalyzeComplete={handleAnalyzeComplete}
              onAnalyzeError={handleAnalyzeError}
              loading={loading}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={4}>
            <PerformanceReport
              analysisResult={analysisResult}
              sessionId={sessionId}
              apiBaseUrl={API_BASE_URL}
              analysisError={analysisError}
            />
          </TabPanel>


          <TabPanel value={tabValue} index={5}>
            <ChatInterface
              sessionId={sessionId}
              sourceType={sourceType}
              apiBaseUrl={API_BASE_URL}
            />
          </TabPanel>
        </Box>
      </Container>
    </Box>
  );
};

export default PtsAnalyzer;
