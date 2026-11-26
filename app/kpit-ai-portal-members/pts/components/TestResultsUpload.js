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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Grid,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LockIcon from '@mui/icons-material/Lock';
import { PTS_CONFIG } from '../ptsConfig';
import { useAuth } from '@/app/contexts/OpenIdAuthContext';




const LOADRUNNER_FILES = [...PTS_CONFIG.LOADRUNNER_FILES];
const DYNATRACE_FILES = PTS_CONFIG.DYNATRACE_FILES;

const removeSpaces = (filename) => {
  const parts = filename.split('.');
  const ext = parts.pop();
  const name = parts.join('.');
  return `${name.replace(/\s+/g, '_')}.${ext}`;
};

const TestResultsUpload = ({
  sessionId,
  sourceType,
  onSourceTypeChange,
  apiBaseUrl,
  uploadStatus,
  setUploadStatus,
  isOwner = true, // Default to true for backward compatibility
}) => {
  const { user } = useAuth();
  const [requiredFiles, setRequiredFiles] = useState([]);
  const [sasUrls, setSasUrls] = useState({});
  const [fileBuffers, setFileBuffers] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [azureFiles, setAzureFiles] = useState([]);

  // Restore Azure files from uploadStatus when session is loaded
  useEffect(() => {
    console.log('[TestResultsUpload/useEffect-uploadStatus] sourceType:', sourceType);
    console.log('[TestResultsUpload/useEffect-uploadStatus] uploadStatus keys:', Object.keys(uploadStatus || {}));

    if (sourceType === 'azure' && Object.keys(uploadStatus).length > 0) {
      const loadrunnerNormalized = LOADRUNNER_FILES.map(f => removeSpaces(f));
      const dynatraceNormalized = DYNATRACE_FILES.map(f => removeSpaces(f));

      const azureFileNames = Object.keys(uploadStatus).filter(key =>
        uploadStatus[key] === 'Uploaded' &&
        !loadrunnerNormalized.includes(key) &&
        !dynatraceNormalized.includes(key)
      );

      console.log('[TestResultsUpload/useEffect-uploadStatus] inferred Azure files from status:', azureFileNames);

      if (azureFileNames.length > 0 && azureFiles.length === 0) {
        const mockFiles = azureFileNames.map(name => ({ name }));
        setAzureFiles(mockFiles);
        console.log('[TestResultsUpload/useEffect-uploadStatus] Restored Azure files from session:', azureFileNames);
      }
    }
  }, [uploadStatus, sourceType, azureFiles.length]);

  // Initialize required files and fetch already uploaded files
  useEffect(() => {
    const initializeFiles = async () => {
      console.log('[TestResultsUpload/initializeFiles] START', {
        sessionId,
        sourceType,
      });

      if (sourceType === 'loadrunner') {
        setRequiredFiles(LOADRUNNER_FILES);
        console.log('[TestResultsUpload/initializeFiles] LoadRunner required files:', LOADRUNNER_FILES);
      } else if (sourceType === 'dynatrace') {
        setRequiredFiles(DYNATRACE_FILES);
        console.log('[TestResultsUpload/initializeFiles] Dynatrace required files:', DYNATRACE_FILES);
      } else if (sourceType === 'azure') {
        console.log('[TestResultsUpload/initializeFiles] Azure selected, requiredFiles controlled by backend/user');
      }

      if (!sessionId) {
        console.log('[TestResultsUpload/initializeFiles] No sessionId, skipping fetch of existing files');
        return;
      }

      try {
        const url = `/api/pts/check-session-files/${sessionId}?source_type=${sourceType}`;
        console.log('[TestResultsUpload/initializeFiles] Fetching already uploaded files from:', url);

        const response = await fetch(url).catch(err => {
          console.log('[TestResultsUpload/initializeFiles] Network error:', err.message);
          throw new Error(`Network error: ${err.message}`);
        });

        if (!response.ok) {
          console.log('[TestResultsUpload/initializeFiles] Failed to fetch uploaded files, status:', response.status);
          return;
        }

        const data = await response.json();
        console.log('[TestResultsUpload/initializeFiles] Backend response:', data);

        const filesToProcess =
          (data.data_files && data.data_files.found) ||
          data.files ||
          data.uploaded_files ||
          [];

        console.log('[TestResultsUpload/initializeFiles] Files to process:', filesToProcess);

        if (Array.isArray(filesToProcess) && filesToProcess.length > 0) {
          const newUploadStatus = {};
          filesToProcess.forEach((filename) => {
            const cleanName = removeSpaces(filename);
            newUploadStatus[cleanName] = 'Uploaded';
            console.log('[TestResultsUpload/initializeFiles] Marking as uploaded:', {
              original: filename,
              normalized: cleanName,
            });
          });

          setUploadStatus(prev => {
            const merged = { ...prev, ...newUploadStatus };
            console.log('[TestResultsUpload/initializeFiles] Merged uploadStatus:', merged);
            return merged;
          });

          if (sourceType === 'azure') {
            console.log('[TestResultsUpload/initializeFiles] Setting Azure requiredFiles from backend:', filesToProcess);
            setRequiredFiles(filesToProcess);
          }
        } else {
          console.log('[TestResultsUpload/initializeFiles] No files found in backend response');
          if (sourceType === 'azure') {
            setRequiredFiles([]);
          }
        }
      } catch (err) {
        console.log('[TestResultsUpload/initializeFiles] Error fetching uploaded files:', err);
      }
    };

    initializeFiles();
  }, [sessionId, sourceType, setUploadStatus]);

  const handleSourceTypeChange = (event) => {
    const newSourceType = event.target.value;
    console.log('[TestResultsUpload/handleSourceTypeChange] Changing sourceType:', {
      from: sourceType,
      to: newSourceType,
    });
    onSourceTypeChange(newSourceType);
    setSasUrls({});
    setFileBuffers({});
    setAzureFiles([]);
    setError('');
    setSuccess('');
  };

  const handleAzureFilesChange = (event) => {
    const files = Array.from(event.target.files || []);
    console.log('[TestResultsUpload/handleAzureFilesChange] Raw selected files:', files.map(f => f.name));

    setAzureFiles(files);

    const buffers = {};
    const fileNames = [];
    files.forEach(file => {
      const cleanName = removeSpaces(file.name);
      buffers[cleanName] = file;
      fileNames.push(cleanName);
      console.log('[TestResultsUpload/handleAzureFilesChange] Normalizing Azure filename:', {
        original: file.name,
        normalized: cleanName,
      });
    });
    setFileBuffers(buffers);

    setRequiredFiles(fileNames);
    console.log('[TestResultsUpload/handleAzureFilesChange] requiredFiles set to:', fileNames);
    console.log('[TestResultsUpload/handleAzureFilesChange] fileBuffers keys:', Object.keys(buffers));
  };

  const handleFetchUploadLinks = async () => {
    if (!sessionId) {
      setError('Please enter a session ID first');
      console.error('[TestResultsUpload/handleFetchUploadLinks] Missing sessionId');
      return;
    }

    if (!isOwner) {
      setError('You do not have permission to upload files to this session');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const requestBody = {
        run_id: sessionId,
        source_type: sourceType,
        createdByNUID: user?.nuid || user?.userId || '',
      };

      if (sourceType === 'azure' && azureFiles.length > 0) {
        const azureNames = azureFiles.map(f => removeSpaces(f.name));
        requestBody.azure_filenames = azureNames;
        console.log('[TestResultsUpload/handleFetchUploadLinks] Azure filenames in requestBody:', {
          raw: azureFiles.map(f => f.name),
          normalized: azureNames,
        });
      }

      const uploadEndpoint = '/api/pts/get-upload-urls';
      console.log('[TestResultsUpload/handleFetchUploadLinks] POSTing to:', uploadEndpoint, 'with body:', requestBody);

      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        console.error('[TestResultsUpload/handleFetchUploadLinks] Failed to fetch upload URLs, status:', response.status);
        throw new Error('Failed to fetch upload URLs');
      }

      const data = await response.json();
      console.log('[TestResultsUpload/handleFetchUploadLinks] Response JSON:', data);

      const urlMap = {};

      (data.sas_urls || []).forEach((item) => {
        const originalFilename = item.filename;
        const normalized = removeSpaces(originalFilename);
        urlMap[normalized] = item;
        console.log('[TestResultsUpload/handleFetchUploadLinks] SAS URL entry:', {
          originalFilename,
          normalized,
          sas_url: item.sas_url,
        });
      });

      setSasUrls(urlMap);
      console.log('[TestResultsUpload/handleFetchUploadLinks] sasUrls keys:', Object.keys(urlMap));
      console.log('[TestResultsUpload/handleFetchUploadLinks] requiredFiles at this point:', requiredFiles);

      setSuccess('Upload links fetched successfully! You can now select files to upload.');
    } catch (err) {
      console.error('[TestResultsUpload/handleFetchUploadLinks] Error:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (filename, event) => {
    const file = event.target.files && event.target.files[0];
    if (file) {
      const cleanName = removeSpaces(filename);
      console.log('[TestResultsUpload/handleFileSelect] File chosen for filename:', {
        displayName: filename,
        normalizedKey: cleanName,
        actualFileName: file.name,
      });
      setFileBuffers(prev => {
        const next = { ...prev, [cleanName]: file };
        console.log('[TestResultsUpload/handleFileSelect] fileBuffers keys after update:', Object.keys(next));
        return next;
      });
    } else {
      console.log('[TestResultsUpload/handleFileSelect] No file selected for filename:', filename);
    }
  };

  // Browser only talks to /api/pts/upload-file; backend talks to Blob
  const handleFileUpload = async (filename) => {
    const cleanName = removeSpaces(filename);
    const file = fileBuffers[cleanName];
    const sasUrl = sasUrls[cleanName] && sasUrls[cleanName].sas_url;

    console.log('[TestResultsUpload/handleFileUpload] Attempting upload:', {
      uiFilename: filename,
      normalizedKey: cleanName,
      hasFile: !!file,
      hasSasUrl: !!sasUrl,
      sasEntry: sasUrls[cleanName],
    });

    if (!file || !sasUrl) {
      setError('File or upload URL not available');
      console.error('[TestResultsUpload/handleFileUpload] Missing file or sasUrl for:', cleanName);
      return;
    }

    try {
      setUploadStatus(prev => {
        const next = { ...prev, [cleanName]: 'uploading' };
        console.log('[TestResultsUpload/handleFileUpload] uploadStatus -> uploading:', next);
        return next;
      });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('sas_url', sasUrl);

      console.log('[TestResultsUpload/handleFileUpload] POST /api/pts/upload-file with:', {
        normalizedKey: cleanName,
        fileName: file.name,
        sasUrlPreview: sasUrl.substring(0, 80) + '...',
      });

      const response = await fetch('/api/pts/upload-file', {
        method: 'POST',
        body: formData,
      });

      const text = await response.text();
      console.log('[TestResultsUpload/handleFileUpload] /api/pts/upload-file response:', {
        status: response.status,
        body: text,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      setUploadStatus(prev => {
        const next = { ...prev, [cleanName]: 'Uploaded' };
        console.log('[TestResultsUpload/handleFileUpload] uploadStatus -> Uploaded:', next);
        return next;
      });
      setSuccess(`File "${filename}" uploaded successfully!`);
    } catch (err) {
      console.error('[TestResultsUpload/handleFileUpload] Error uploading file:', {
        normalizedKey: cleanName,
        error: err,
      });
      setUploadStatus(prev => {
        const next = { ...prev, [cleanName]: `Error: ${err.message}` };
        console.log('[TestResultsUpload/handleFileUpload] uploadStatus -> Error:', next);
        return next;
      });
      setError(`Failed to upload "${filename}": ${err.message}`);
    }
  };

  const handleUploadAll = async () => {
    console.log('[TestResultsUpload/handleUploadAll] Starting bulk upload for requiredFiles:', requiredFiles);

    const filesToUpload = requiredFiles.filter(f => {
      const cleanName = removeSpaces(f);
      const shouldUpload = !!fileBuffers[cleanName] && uploadStatus[cleanName] !== 'Uploaded';
      console.log('[TestResultsUpload/handleUploadAll] Check file:', {
        uiFilename: f,
        normalizedKey: cleanName,
        hasFileBuffer: !!fileBuffers[cleanName],
        status: uploadStatus[cleanName],
        willUpload: shouldUpload,
      });
      return shouldUpload;
    });

    console.log('[TestResultsUpload/handleUploadAll] filesToUpload:', filesToUpload);

    for (const filename of filesToUpload) {
      // eslint-disable-next-line no-await-in-loop
      await handleFileUpload(filename);
    }

    console.log('[TestResultsUpload/handleUploadAll] Bulk upload finished');
  };

  const uploadedCount = requiredFiles.filter(
    f => uploadStatus[removeSpaces(f)] === 'Uploaded'
  ).length;

  const progressPercent =
    requiredFiles.length > 0 ? (uploadedCount / requiredFiles.length) * 100 : 0;

  const getUploadedCountForSource = (sourceFiles) =>
    sourceFiles.filter(f => uploadStatus[removeSpaces(f)] === 'Uploaded').length;

  const loadrunnerUploaded = getUploadedCountForSource(LOADRUNNER_FILES);
  const dynatraceUploaded = getUploadedCountForSource(DYNATRACE_FILES);

  const azureUploaded = Object.keys(uploadStatus).filter(key => {
    const isUploaded = uploadStatus[key] === 'Uploaded';
    const inLR = LOADRUNNER_FILES.map(f => removeSpaces(f)).includes(key);
    const inDT = DYNATRACE_FILES.map(f => removeSpaces(f)).includes(key);
    return isUploaded && !inLR && !inDT;
  }).length;

  console.log('[TestResultsUpload/render] Summary:', {
    sourceType,
    requiredFiles,
    uploadStatus,
    sasUrlKeys: Object.keys(sasUrls),
    fileBufferKeys: Object.keys(fileBuffers),
    loadrunnerUploaded,
    dynatraceUploaded,
    azureUploaded,
  });

  return (
    <Card sx={{ width: '100%', overflow: 'visible', opacity: isOwner ? 1 : 0.6, pointerEvents: isOwner ? 'auto' : 'none' }}>
      <CardHeader
        title="Upload Test Results"
        subtitle="Select data source and upload performance test files"
      />
      <Divider />
      <CardContent sx={{ p: 3, pb: 6 }}>
        {/* Read-only alert for non-owners */}
        {!isOwner && (
          <Alert severity="warning" sx={{ mb: 3, pointerEvents: 'auto' }} icon={<LockIcon />}>
            <strong>Read-Only Mode:</strong> This session is owned by another user. You cannot upload files.
          </Alert>
        )}

        {/* Source Type Selection */}
        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth sx={{ maxWidth: 300 }}>
            <InputLabel>Data Source</InputLabel>
            <Select
              value={sourceType}
              onChange={handleSourceTypeChange}
              label="Data Source"
              disabled={!isOwner}
            >
              <MenuItem value="loadrunner">LoadRunner</MenuItem>
              <MenuItem value="dynatrace">Dynatrace</MenuItem>
              <MenuItem value="azure">Azure Application Insights</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Fetch Upload Links - non-Azure */}
        {sourceType !== 'azure' && (
          <Box sx={{ mb: 3 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleFetchUploadLinks}
              disabled={loading || !isOwner}
              title={!isOwner ? 'Only the session owner can upload files' : ''}
            >
              {loading ? <CircularProgress size={24} /> : 'Fetch Upload Links'}
            </Button>
          </Box>
        )}

        {/* Azure File Uploader */}
        {sourceType === 'azure' && (
          <Box sx={{ mb: 3 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Click Select Azure File then Fetch link icon to upload file
            </Alert>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <Button
                variant="secondary"
                component="label"
                startIcon={<CloudUploadIcon />}
                disabled={!isOwner}
                title={!isOwner ? 'Only the session owner can upload files' : ''}
              >
                Select Azure Files (CSV/Excel)
                <input
                  hidden
                  accept=".csv,.xlsx,.xls"
                  type="file"
                  multiple
                  onChange={handleAzureFilesChange}
                  disabled={!isOwner}
                />
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleFetchUploadLinks}
                disabled={loading || azureFiles.length === 0 || !isOwner}
                title={!isOwner ? 'Only the session owner can upload files' : ''}
              >
                {loading ? <CircularProgress size={24} /> : 'Fetch Upload Links'}
              </Button>
            </Box>
            {azureFiles.length > 0 && (
              <Box sx={{ mt: 2 }}>
                {azureFiles.map((file) => (
                  <Chip key={file.name} label={file.name} sx={{ mr: 1, mt: 1 }} />
                ))}
              </Box>
            )}
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {/* Uploaded Files */}
        {requiredFiles.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Uploaded Files ({sourceType}):
            </Typography>
            {uploadedCount > 0 ? (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {requiredFiles
                  .filter((f) => uploadStatus[removeSpaces(f)] === 'Uploaded')
                  .map((f) => (
                    <Chip key={f} label={f} color="success" variant="outlined" />
                  ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">No files uploaded yet.</Typography>
            )}
          </Box>
        )}

        {/* File List */}
        {requiredFiles.length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
              {sourceType === 'azure' ? 'Uploaded Files' : 'Required Files'}
            </Typography>
            <Box
              sx={{
                border: '1px solid #e0e0e0',
                borderRadius: 1,
                pr: 1,
              }}
            >
              <List>
                {requiredFiles.map((filename) => {
                  const cleanName = removeSpaces(filename);
                  const status = uploadStatus[cleanName];
                  const hasFile = !!fileBuffers[cleanName];
                  const hasSasUrl = !!(sasUrls[cleanName] && sasUrls[cleanName].sas_url);

                  console.log('[TestResultsUpload/render/ListItem] Row state:', {
                    uiFilename: filename,
                    normalizedKey: cleanName,
                    status,
                    hasFile,
                    hasSasUrl,
                  });

                  return (
                    <ListItem key={filename} divider>
                      <ListItemIcon>
                        {status === 'Uploaded' ? (
                          <CheckCircleIcon color="success" />
                        ) : status === 'uploading' ? (
                          <CircularProgress size={24} />
                        ) : status && status.includes('Error') ? (
                          <ErrorIcon color="error" />
                        ) : (
                          <AccessTimeIcon color="action" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={filename}
                        secondary={
                          status === 'Uploaded'
                            ? 'Uploaded'
                            : status === 'uploading'
                              ? 'Uploading...'
                              : status && status.includes('Error')
                                ? status
                                : 'Ready to upload'
                        }
                      />
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {!hasSasUrl ? (
                          <Button
                            size="small"
                            variant="outlined"
                            disabled
                            sx={{ minWidth: 80 }}
                          >
                            Fetch Links First
                          </Button>
                        ) : status === 'Uploaded' ? (
                          <>
                            <Button
                              size="small"
                              variant="outlined"
                              component="label"
                              sx={{ minWidth: 80 }}
                              disabled={!isOwner}
                              title={!isOwner ? 'Only the session owner can upload files' : ''}
                            >
                              Choose
                              <input
                                hidden
                                type="file"
                                accept=".csv,.txt,.xlsx,.xls,.json"
                                onChange={(e) => handleFileSelect(filename, e)}
                                disabled={!isOwner}
                              />
                            </Button>
                            {hasFile && (
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => handleFileUpload(filename)}
                                disabled={status === 'uploading' || !isOwner}
                                startIcon={
                                  status === 'uploading' ? (
                                    <CircularProgress size={16} />
                                  ) : (
                                    <CloudUploadIcon />
                                  )
                                }
                                title={!isOwner ? 'Only the session owner can upload files' : ''}
                              >
                                {status === 'uploading' ? 'Uploading...' : 'Replace Upload'}
                              </Button>
                            )}
                          </>
                        ) : hasFile ? (
                          <>
                            <Button
                              size="small"
                              variant="outlined"
                              component="label"
                              sx={{ minWidth: 80 }}
                              disabled={!isOwner}
                              title={!isOwner ? 'Only the session owner can upload files' : ''}
                            >
                              Choose
                              <input
                                hidden
                                type="file"
                                accept=".csv,.txt,.xlsx,.xls,.json"
                                onChange={(e) => handleFileSelect(filename, e)}
                                disabled={!isOwner}
                              />
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => handleFileUpload(filename)}
                              disabled={status === 'uploading' || !isOwner}
                              startIcon={
                                status === 'uploading' ? (
                                  <CircularProgress size={16} />
                                ) : (
                                  <CloudUploadIcon />
                                )
                              }
                              title={!isOwner ? 'Only the session owner can upload files' : ''}
                            >
                              {status === 'uploading' ? 'Uploading...' : 'Upload'}
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="small"
                            variant="outlined"
                            component="label"
                            sx={{ minWidth: 80 }}
                            disabled={!isOwner}
                            title={!isOwner ? 'Only the session owner can upload files' : ''}
                          >
                            Choose
                            <input
                              hidden
                              type="file"
                              accept=".csv,.txt,.xlsx,.xls,.json"
                              onChange={(e) => handleFileSelect(filename, e)}
                              disabled={!isOwner}
                            />
                          </Button>
                        )}
                      </Box>
                    </ListItem>
                  );
                })}
              </List>
            </Box>

            <Button
              fullWidth
              variant="contained"
              color="success"
              size="large"
              onClick={handleUploadAll}
              sx={{ mt: 2, mb: 4 }}
              disabled={uploadedCount === requiredFiles.length || !isOwner}
              title={!isOwner ? 'Only the session owner can upload files' : ''}
            >
              Upload All Files
            </Button>
          </Box>
        )}

        {requiredFiles.length === 0 && Object.keys(sasUrls).length === 0 && (
          <Alert severity="info">
            {sourceType === 'azure'
              ? 'Select Azure files above, then click "Fetch Upload Links"'
              : 'Click "Fetch Upload Links" to get started'}
          </Alert>
        )}

        {requiredFiles.length === 0 && Object.keys(sasUrls).length > 0 && (
          <Alert severity="warning">
            No files found. Please check your source type selection.
          </Alert>
        )}
      </CardContent>
    </Card>

  );
};

export default TestResultsUpload;
