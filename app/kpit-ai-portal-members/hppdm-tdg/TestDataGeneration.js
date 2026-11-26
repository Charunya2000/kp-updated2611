'use client';

import { Box, Button, TextField, Typography, Radio, RadioGroup, FormControlLabel, Paper, Tabs, Tab, Table, TableBody, TableCell, TableHead, TableRow, Chip, IconButton, Select, MenuItem, FormControl, InputLabel, LinearProgress } from "@mui/material";
import { useTheme } from '@mui/material/styles'; // Add this import
import { useAuth } from '@/app/contexts/OpenIdAuthContext';
import Status from "./Status";
import { useEffect, useState, useRef } from "react";
import { checkJobStatus, generateTestData, getAllTestDataGenJobs, saveTestDataGenJob, updateTestDataGenJob } from "../../clientServices/testDataGenerationApiService";
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import useSnackbar from '../../hooks/useSnackbar';

const pollingInterval = 15000; // 15 seconds
const MAX_FILE_SIZE = 150 * 1024 * 1024; // 150 MB
const backendBaseUrl = (process.env.ORCHESTRATION_APP_URL || '').replace(/\/+$/, '');

const buildBackendUrl = (path) => {
  if (!path) return backendBaseUrl || '';
  if (path.startsWith('http')) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!backendBaseUrl) return normalizedPath;
  return `${backendBaseUrl}${normalizedPath}`;
};

// Regions for format-320
const REGIONS_320 = ["MAS", "CO", "NV", "HI"];

export default function TestDataGeneration() {
  const theme = useTheme(); // Add this line
  const { user } = useAuth();

  const { SnackbarComponent, showSnackbar } = useSnackbar({
    anchorOrigin: { vertical: 'top', horizontal: 'center' },
    marginTop: '130px', // Adjust this to position it correctly relative to your layout
    sx: {
      marginLeft: '80px', // Shift right by 80px
      '& .MuiBox-root': {
        backgroundColor: theme.palette.mode === 'dark' ? '#0D1C3D' : '#FFFFFF !important',
      }
    },
  });

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [JiraID, setJiraID] = useState('');
  const [recordScope, setRecordScope] = useState('All');
  const [sourceType, setSourceType] = useState('SQL');
  const [fileUpload, setFileUpload] = useState(null);
  const [sharepointUrl, setSharepointUrl] = useState('');
  const [tab, setTab] = useState(0);
  const [jobs, setJobs] = useState([]);
  const [searchJobId, setSearchJobId] = useState('');
  const [sortField, setSortField] = useState('updatedAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [activeJobs, setActiveJobs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const teamName = "kpit-ai-portal-members";
  const assistantName = "hppdm-tdg";
  const [dbName, setDbName] = useState('EPDM_UATPDM');
  const statusRef = useRef(status);
  const activeJobsRef = useRef([]);
  const manualRefreshRef = useRef(false); // Add a ref to prevent auto-refresh during manual refresh

  // File input refs
  const fileUploadInputRef = useRef(null);
  const ff320FileUploadInputRef = useRef(null);

  const DB_OPTIONS = ['EPDM_UATPDM', 'EPDM_SITPDM', 'EPDM_SITPDS'];

  // --- NEW state for File → 320 panel ---
  const [ff320File, setFf320File] = useState(null);
  const [ff320Region, setFf320Region] = useState("MAS");
  const [ff320JobId, setFf320JobId] = useState(null);
  const [ff320Status, setFf320Status] = useState("Idle");
  const [ff320Message, setFf320Message] = useState("");
  const [ff320RowCount, setFf320RowCount] = useState(null);
  const [ff320DownloadUrl, setFf320DownloadUrl] = useState(null);
  const [ff320Loading, setFf320Loading] = useState(false);
  const [ff320Polling, setFf320Polling] = useState(false);

  // File format conversion history
  const [ff320Jobs, setFf320Jobs] = useState([]);
  const [ff320JobsLoading, setFf320JobsLoading] = useState(false);
  const [ff320Tab, setFf320Tab] = useState(0); // 0 = Upload, 1 = History

  useEffect(() => {
    statusRef.current = status;
    activeJobsRef.current = activeJobs;
  }, [status, activeJobs]);

  // Fetch Jobs when Check Status tab is selected
  useEffect(() => {
    if (tab === 1) {
      if (!manualRefreshRef.current) {
        fetchJobs(false); // Auto-refresh, no notification
      }
    } else if (tab === 2) {
      fetchFf320Jobs(); // Auto-fetch file format jobs
    }
  }, [tab]);

  // Polling effect for multiple active jobs
  useEffect(() => {
    if (activeJobs.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const currentActiveJobs = activeJobsRef.current;
        const updatedJobs = [];
        const completedJobIds = []; // Track both completed and failed jobs to remove

        for (const activeJob of currentActiveJobs) {
          try {
            const response = await checkJobStatus(teamName, assistantName, activeJob.jobID);
            const updatedStatus = response.response;

            // Check if job is still in progress (initiating/processing)
            if (updatedStatus.status &&
              updatedStatus.status.toLowerCase() !== 'completed' &&
              updatedStatus.status.toLowerCase() !== 'failed') {

              // add to end of array
              updatedJobs.push({
                ...activeJob,
                status: updatedStatus.status,
                lastUpdated: new Date().toISOString()
              });

              // Update to DB
              await updateTestDataGenJob(teamName, assistantName, {
                id: activeJob.dbId,
                jobID: activeJob.jobID,
                jobStatus: updatedStatus.status,
                updatedAt: new Date().toISOString(),
                type: 'TestDataGenJob',
              });

              // Update current status display if this is the most recent job
              if (activeJob.jobID === statusRef.current?.job_id) {
                setStatus(updatedStatus);
              }

            } else if (updatedStatus.status &&
              (updatedStatus.status.toLowerCase() === 'completed' ||
                updatedStatus.status.toLowerCase() === 'failed')) {

              // Job completed or failed - add to completed job list for removal
              completedJobIds.push(activeJob.jobID);

              await updateTestDataGenJob(teamName, assistantName, {
                id: activeJob.dbId,
                jobID: activeJob.jobID,
                jobStatus: updatedStatus.status,
                downloadURL: updatedStatus.status.toLowerCase() === 'completed' && updatedStatus.file_path
                  ? buildBackendUrl(updatedStatus.file_path)
                  : null, // No URL for failed jobs
                updatedAt: new Date().toISOString(),
                type: 'TestDataGenJob',
              });

              // Update current status display if this is the most recent job
              if (activeJob.jobID === statusRef.current?.job_id) {
                setStatus(updatedStatus);
              }

              console.log(`Job ${activeJob.jobID} ${updatedStatus.status.toLowerCase()}.`);
            }
          } catch (error) {
            console.error(`Error checking status for job ${activeJob.jobID}:`, error);
          }
        }

        // Update active jobs list (remove completed and failed ones)
        const stillActiveJobs = updatedJobs.filter(job =>
          !completedJobIds.includes(job.jobID)
        );

        // Only update if there's a change to prevent unnecessary re-renders
        if (stillActiveJobs.length !== currentActiveJobs.length ||
          completedJobIds.length > 0) {
          setActiveJobs(stillActiveJobs);
        }

      } catch (error) {
        console.error("Error in polling interval:", error);
      }
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [activeJobs.length, tab]);

  // --- NEW polling effect for File→320 job ---
  useEffect(() => {
    if (!ff320JobId || !ff320Polling) return;

    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const resp = await fetch(`/api/v3/hppdm/format/status/${encodeURIComponent(ff320JobId)}`);
        if (!resp.ok) return;
        const data = await resp.json();

        if (cancelled) return;

        setFf320Status(data.status);
        setFf320Message(data.message || "");
        setFf320RowCount(data.row_count ?? null);

        if (data.status === "Completed") {
          setFf320Polling(false);
          clearInterval(interval);

          const filePath = data.file_path || data.output_file;
          let downloadUrl = "";
          if (filePath) {
            if (filePath.startsWith("http")) {
              downloadUrl = filePath;
            } else if (filePath.startsWith("/api/v3/hppdm/format/download/")) {
              const fileId = filePath.split("/").pop();
              downloadUrl = `/api/v3/hppdm/format/download/${fileId}`;
            } else if (filePath.startsWith("/format/download/")) {
              downloadUrl = `/api/v3/hppdm${filePath}`;
            } else if (filePath.startsWith("/")) {
              downloadUrl = `/api/v3/hppdm${filePath}`;
            } else {
              downloadUrl = `/api/v3/hppdm/format/download/${filePath}`;
            }
            setFf320DownloadUrl(downloadUrl);
          }

          // Update the job in localStorage with completion details
          updateFf320Job(ff320JobId, {
            status: "Completed",
            downloadUrl: downloadUrl,
            rowCount: data.row_count,
            updatedAt: new Date().toISOString(),
          });
        } else if (data.status === "Failed") {
          setFf320Polling(false);
          clearInterval(interval);

          // Update the job in localStorage with failed status
          updateFf320Job(ff320JobId, {
            status: "Failed",
            message: data.message || "Conversion failed",
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error("Status polling error (320)", err);
      }
    }, 5000); // 5 seconds like your script

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [ff320JobId, ff320Polling]);

  const handleGenerateTestDataClicked = async () => {
    setStatus(null);
    setLoading(true);

    try {
      // Must have all parameters of requestData to send
      let requestData = {
        issue: JiraID,
        file: null,
        source_type: sourceType,
        record_scope: recordScope,
        db_name: sourceType === 'SQL' ? dbName : null,
        sharepointlink: null
      };

      if (sourceType === 'file' && fileUpload) {
        requestData.file = fileUpload;
      } else if (sourceType === 'link' && sharepointUrl) {
        requestData.sharepointlink = sharepointUrl;
      }

      const data = await generateTestData(teamName, assistantName, requestData);

      if (data.response && data.response.job_id) {
        try {
          // Create a new job document in the database
          const jobDoc = {
            jobID: data.response.job_id,
            issueKey: JiraID,
            jobStatus: data.response.status,
            type: 'TestDataGenJob',
            updatedAt: new Date().toISOString(),
          };

          const savedJob = await saveTestDataGenJob(teamName, assistantName, jobDoc);

          // Add to active jobs list for background polling
          const newActiveJob = {
            jobID: data.response.job_id,
            dbId: savedJob.id,
            jiraID: JiraID,
            status: data.response.status,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          };

          setActiveJobs(prev => [...prev, newActiveJob]);

          // Refresh jobs list to show the new job immediately
          await fetchJobs(false);

        } catch (error) {
          console.error("Error saving job to database:", error);
        }
      }

      setStatus(data.response);
    } catch (error) {
      console.error("Error generating test data:", error);
      setStatus({ error: "Failed to generate test data" });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > MAX_FILE_SIZE) {
        alert("Please upload a file smaller than 150 MB.");
        e.target.value = ""; // Reset the input
        setFileUpload(null);
        return;
      }
      setFileUpload(file);
    }
  };

  const handleSourceTypeChange = (e) => {
    setSourceType(e.target.value);
    setStatus(null);
    setLoading(false);
    setFileUpload(null);
    setSharepointUrl('');
    if (e.target.value === 'SQL' && !dbName) {
      setDbName('EPDM_UATPDM');
    }
  };

  const handleRecordScopeChange = (e) => {
    setRecordScope(e.target.value);
    setStatus(null);
    setLoading(false);
  };

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
  };

  const fetchJobs = async (showRefreshComplete = false) => {
    setRefreshing(true);
    try {
      const fetchedJobs = await getAllTestDataGenJobs(teamName, assistantName);

      // Handle edge cases - ensure fetchedJobs is a valid array
      if (!fetchedJobs || !Array.isArray(fetchedJobs)) {
        console.warn('Invalid data returned from getAllTestDataGenJobs:', fetchedJobs);
        setJobs([]);
        return;
      }

      // Check if array is empty
      if (fetchedJobs.length === 0) {
        console.warn('No jobs found for the last 24 hours');
        setJobs([]);

        return;
      }

      // Map database fields to UI expected format
      const mappedJobs = fetchedJobs.map(job => {
        // Handle cases where job might be null or undefined
        if (!job) {
          console.warn('Found null/undefined job in fetchedJobs');
          return null;
        }

        return {
          id: job.id,
          jiraID: job.issueKey,
          status: job.jobStatus,
          downloadURL: job.downloadURL,
          updatedAt: job.updatedAt,
        };
      }).filter(job => job !== null); // Remove any null jobs

      setJobs(mappedJobs);

    } catch (error) {
      console.error("Error fetching jobs:", error);
      setJobs([]);
    } finally {
      // Only show snackbar notification - remove duplicate logic
      if (showRefreshComplete) {
        showSnackbar('Refresh complete', 'success'); // Keep only this
      }

      // Disable refresh icon for 1.25 seconds after user clicks refresh
      if (!showRefreshComplete) {
        setRefreshing(false);
      } else {
        setTimeout(() => {
          setRefreshing(false);
          manualRefreshRef.current = false; // Reset the flag
        }, 1270);
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';

    try {
      const date = new Date(dateString);

      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting date:', error, 'for dateString:', dateString);
      return 'Invalid Date';
    }
  };

  // Fetch file format 320 conversion jobs
  const fetchFf320Jobs = async () => {
    setFf320JobsLoading(true);
    try {
      // Query all active file format jobs from localStorage or backend
      // For now, we'll create a simple in-memory storage for demo
      const stored = localStorage.getItem('ff320_jobs');
      const jobs = stored ? JSON.parse(stored) : [];

      // Sort by createdAt descending (most recent first)
      jobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setFf320Jobs(jobs);
    } catch (error) {
      console.error('Error fetching file format jobs:', error);
      setFf320Jobs([]);
    } finally {
      setFf320JobsLoading(false);
    }
  };

  // Save file format job to local storage
  const saveFf320Job = (jobData) => {
    try {
      const stored = localStorage.getItem('ff320_jobs');
      const jobs = stored ? JSON.parse(stored) : [];

      // Add user information to the job
      const enhancedJobData = {
        ...jobData,
        submittedBy: user?.email || (user?.firstName + ' ' + user?.lastName) || 'Unknown User',
        userId: user?.id || user?.nuid || 'N/A',
      };

      jobs.push(enhancedJobData);
      localStorage.setItem('ff320_jobs', JSON.stringify(jobs));
      setFf320Jobs(jobs);
    } catch (error) {
      console.error('Error saving file format job:', error);
    }
  };

  // Update file format job in local storage (for status updates)
  const updateFf320Job = (jobId, updates) => {
    try {
      const stored = localStorage.getItem('ff320_jobs');
      const jobs = stored ? JSON.parse(stored) : [];

      const updatedJobs = jobs.map(job =>
        job.jobId === jobId ? { ...job, ...updates } : job
      );

      localStorage.setItem('ff320_jobs', JSON.stringify(updatedJobs));
      setFf320Jobs(updatedJobs);
    } catch (error) {
      console.error('Error updating file format job:', error);
    }
  };  // Filter jobs for search bar
  const filteredJobs = jobs.filter(job =>
    job.jiraID.toLowerCase().includes(searchJobId.trim().toLowerCase())
  );

  // Sort jobs based on sortField and sortDirection
  const sortedJobs = [...filteredJobs].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];

    // Handle null/undefined values
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return 1;
    if (bValue == null) return -1;

    // Special handling for date sorting
    if (sortField === 'updatedAt') {
      aValue = new Date(aValue || 0).getTime();
      bValue = new Date(bValue || 0).getTime();

      // Handle invalid dates
      if (isNaN(aValue) && isNaN(bValue)) return 0;
      if (isNaN(aValue)) return 1;
      if (isNaN(bValue)) return -1;
    }

    if (aValue === bValue) return 0;

    const comparison = aValue < bValue ? -1 : 1;
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const handleSort = (field) => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDirection(newDirection);
  };

  useEffect(() => {
    if (tab !== 0 && tab !== 1 && tab !== 2) {
      setTab(0);
    }
  }, [tab]);

  // --- handlers for File→320 panel ---
  const handleFf320FileChange = (e) => {
    if (!e.target.files || !e.target.files[0]) return;
    const selected = e.target.files[0];
    setFf320File(selected);
    setFf320Status("Idle");
    setFf320Message("");
    setFf320RowCount(null);
    setFf320DownloadUrl(null);
  };

  const handleFf320Drop = (e) => {
    e.preventDefault();
    if (!e.dataTransfer.files || !e.dataTransfer.files[0]) return;
    const selected = e.dataTransfer.files[0];
    setFf320File(selected);
    setFf320Status("Idle");
    setFf320Message("");
    setFf320RowCount(null);
    setFf320DownloadUrl(null);
  };

  const handleFf320DragOver = (e) => {
    e.preventDefault();
  };

  const handleFf320Start = async () => {
    if (!ff320File) return;
    setFf320Loading(true);
    setFf320Status("Requesting upload URL");
    setFf320Message("");
    setFf320RowCount(null);
    setFf320DownloadUrl(null);

    try {
      // 1. Get upload URL from your backend
      const resp = await fetch("/api/v3/hppdm/format/get-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: ff320File.name,
          issue_key: `UI-${ff320Region}`,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        setFf320Status("Error");
        setFf320Message(`Failed to get upload URL: ${resp.status} ${text}`);
        setFf320Loading(false);
        return;
      }

      const data = await resp.json();
      console.log('Upload URL response:', data);
      const newJobId = data.job_id;
      const sasUrl = data.sas_url;

      setFf320JobId(newJobId);
      setFf320Status("Uploading file");

      // 2. Upload file to SAS URL via proxy
      const formData = new FormData();
      formData.append('file', ff320File);
      formData.append('sasUrl', sasUrl);

      console.log('Uploading via proxy to:', sasUrl);

      const uploadResp = await fetch("/api/v3/hppdm/format/upload", {
        method: "POST",
        body: formData,
      });

      console.log('Proxy upload response status:', uploadResp.status);

      if (!uploadResp.ok) {
        const uploadError = await uploadResp.json();
        console.error('Upload error:', uploadError);
        setFf320Status("Error");
        setFf320Message(`Upload failed: ${uploadError.error}`);
        setFf320Loading(false);
        return;
      }

      // 3. Confirm upload
      setFf320Status("Confirming upload");
      console.log('Confirming upload for job:', newJobId);

      const confirmResp = await fetch("/api/v3/hppdm/format/confirm-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: newJobId }),
      });

      console.log('Confirm upload response status:', confirmResp.status);

      if (!confirmResp.ok) {
        const text = await confirmResp.text();
        console.error('Confirm upload error:', text);
        setFf320Status("Error");
        setFf320Message(`Confirm upload failed: ${confirmResp.status} ${text}`);
        setFf320Loading(false);
        return;
      }

      console.log('Upload confirmed successfully');

      // 4. Trigger conversion (region → mapping selection)
      setFf320Status("Starting conversion");
      const mappingBlobName = `HPPDM_TESTDATA/${ff320Region}_320format_mapping.csv`;

      console.log('Triggering conversion with mapping:', mappingBlobName);

      const convertResp = await fetch("/api/v3/hppdm/format/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: newJobId,
          source_separator: "auto",
          source_encoding: "auto",
          mapping_blob_name: mappingBlobName,
        }),
      });

      console.log('Convert response status:', convertResp.status);

      if (!convertResp.ok) {
        const text = await convertResp.text();
        console.error('Convert error:', text);
        setFf320Status("Error");
        setFf320Message(`Conversion trigger failed: ${convertResp.status} ${text}`);
        setFf320Loading(false);
        return;
      }

      const convertData = await convertResp.json();
      console.log('Convert response data:', convertData);
      setFf320Message(convertData.message || "Conversion started");
      setFf320Status(convertData.status || "Processing");

      // Save this job to localStorage
      saveFf320Job({
        jobId: newJobId,
        fileName: ff320File.name,
        region: ff320Region,
        status: convertData.status || "Processing",
        message: convertData.message || "Conversion started",
        rowCount: null,
        downloadUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // 5. Start polling for status
      setFf320Polling(true);
    } catch (err) {
      console.error('Full error:', err);
      console.error('Error message:', err?.message);
      console.error('Error stack:', err?.stack);
      setFf320Status("Error");
      setFf320Message(`Error: ${err?.message || "Unexpected error"}`);
    } finally {
      setFf320Loading(false);
    }
  };

  return (
    <Box
      sx={{
        px: { xs: 1, sm: 4 },
        py: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minHeight: '100vh',
        height: '100vh',
        overflow: 'auto',
      }}
    >
      {/* Add the SnackbarComponent */}
      <SnackbarComponent />

      {/* NEW: File format change to 320 panel with tabs - matching HPPDM Test Data Generation style */}
      <Box sx={{ width: '100%', maxWidth: 700, mb: 4 }}>
        {/* Section Heading */}
        <Typography
          variant="h5"
          sx={{
            fontWeight: 'bold',
            mb: 2,
            textAlign: 'left',
          }}
        >
          Convert trigger files to 320 columns format
        </Typography>

        {/* Tabs for Upload and Check Status */}
        <Box sx={{
          width: 'fit-content',
          mb: 0,
        }}>
          <Box sx={{
            minHeight: 50,
            height: 50,
            width: 'fit-content',
            borderRadius: 0,
            boxShadow: 1,
            border: `0.5px solid ${theme.palette.color.graphiteDeep}`,
            borderTop: 'none',
            overflow: 'visible',
            display: 'flex',
            alignItems: 'flex-start',
          }}>
            <Button
              onClick={() => setFf320Tab(0)}
              sx={{
                fontWeight: ff320Tab === 0 ? 'bold' : 500,
                textTransform: 'none',
                fontSize: '1.1rem',
                px: 3,
                py: 1,
                borderRadius: 0,
                background: ff320Tab === 0 ? theme.palette.color.midnight : 'transparent',
                color: ff320Tab === 0 ? '#fff' : theme.palette.text.primary,
                transition: 'all 0.2s ease',
                border: `1px solid ${theme.palette.color.graphiteDeep}`,
                borderRight: `1px solid ${theme.palette.color.graphiteDeep}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.typography.fontFamily,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 'fit-content',
                position: 'relative',
                '&.Mui-selected': {
                  borderColor: theme.palette.color.midnight,
                  borderWidth: '1px',
                  zIndex: 2,
                },
                '&:hover': {
                  backgroundColor: ff320Tab === 0 ? theme.palette.color.midnight : 'rgba(0, 0, 0, 0.04)',
                  borderColor: ff320Tab === 0 ? theme.palette.color.midnight : theme.palette.color.contrastBlue,
                  color: ff320Tab === 0 ? '#fff' : theme.palette.text.primary,
                },
              }}
            >
              Upload & Convert
            </Button>
            <Button
              onClick={() => setFf320Tab(1)}
              sx={{
                fontWeight: ff320Tab === 1 ? 'bold' : 500,
                textTransform: 'none',
                fontSize: '1.1rem',
                px: 3,
                py: 1,
                borderRadius: 0,
                background: ff320Tab === 1 ? theme.palette.color.midnight : 'transparent',
                color: ff320Tab === 1 ? '#fff' : theme.palette.text.primary,
                transition: 'all 0.2s ease',
                border: `1px solid ${theme.palette.color.graphiteDeep}`,
                borderRight: `1px solid ${theme.palette.color.graphiteDeep}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.typography.fontFamily,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 'fit-content',
                position: 'relative',
                '&.Mui-selected': {
                  borderColor: theme.palette.color.midnight,
                  borderWidth: '1px',
                  zIndex: 2,
                },
                '&:hover': {
                  backgroundColor: ff320Tab === 1 ? theme.palette.color.midnight : 'rgba(0, 0, 0, 0.04)',
                  borderColor: ff320Tab === 1 ? theme.palette.color.midnight : theme.palette.color.contrastBlue,
                  color: ff320Tab === 1 ? '#fff' : theme.palette.text.primary,
                },
              }}
            >
              Check Status
            </Button>
          </Box>
        </Box>

        {/* Paper content area */}
        <Paper elevation={3} sx={{
          p: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          backgroundColor: 'card.body.deep',
          overflow: 'hidden',
          border: `2px solid ${theme.palette.color.graphiteDeep}`,
          borderTop: 'none',
        }}>
          {/* Upload Tab */}
          {ff320Tab === 0 && (
            <>
              {/* Upload box */}
              <Box
                onDrop={handleFf320Drop}
                onDragOver={handleFf320DragOver}
                sx={{
                  border: '2px dashed',
                  borderColor: 'grey.500',
                  borderRadius: 2,
                  p: 3,
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  ff320FileUploadInputRef.current?.click();
                }}
              >
                <input
                  ref={ff320FileUploadInputRef}
                  type="file"
                  hidden
                  onChange={handleFf320FileChange}
                />
                <CloudUploadOutlinedIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="subtitle1">
                  Drag and drop a file here, or click to select
                </Typography>
                {ff320File && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Selected: {ff320File.name}
                  </Typography>
                )}
              </Box>

              {/* Region dropdown */}
              <FormControl size="small" sx={{ maxWidth: 200 }}>
                <InputLabel id="ff320-region-label">Region</InputLabel>
                <Select
                  labelId="ff320-region-label"
                  id="ff320-region-select"
                  value={ff320Region}
                  label="Region"
                  onChange={(e) => setFf320Region(e.target.value)}
                >
                  {REGIONS_320.map((r) => (
                    <MenuItem key={r} value={r}>
                      {r}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Start button */}
              <Box sx={{ mt: 1 }}>
                <Button
                  variant="contained"
                  sx={{
                    backgroundColor: theme.palette.color.midnight,
                    color: '#fff',
                    '&:hover': {
                      backgroundColor: theme.palette.color.midnight,
                      opacity: 0.9,
                    }
                  }}
                  onClick={handleFf320Start}
                  disabled={!ff320File || ff320Loading}
                >
                  {ff320Loading ? "Working..." : "Trigger file"}
                </Button>
              </Box>

              {/* Progress / status area */}
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2">Job status</Typography>
                <Typography variant="body2">
                  {ff320Status}
                  {ff320Message ? ` – ${ff320Message}` : ""}
                </Typography>

                {ff320Polling && (
                  <Box sx={{ mt: 1 }}>
                    <LinearProgress />
                  </Box>
                )}

                {ff320RowCount !== null && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Rows processed: {ff320RowCount}
                  </Typography>
                )}

                {ff320DownloadUrl && (
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="secondary"
                      sx={{
                        borderColor: theme.palette.color.midnight,
                        color: theme.palette.color.midnight,
                        '&:hover': {
                          borderColor: theme.palette.color.midnight,
                          backgroundColor: `${theme.palette.color.midnight}10`
                        }
                      }}
                      onClick={() => window.open(ff320DownloadUrl, "_blank")}
                    >
                      Download converted file
                    </Button>
                  </Box>
                )}
              </Box>
            </>
          )}

          {/* Check Status Tab */}
          {ff320Tab === 1 && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 1 }}>
                <Button
                  startIcon={<RefreshIcon />}
                  variant="contained"
                  sx={{
                    backgroundColor: theme.palette.color.midnight,
                    color: '#fff',
                    '&:hover': {
                      backgroundColor: theme.palette.color.midnight,
                      opacity: 0.9,
                    }
                  }}
                  onClick={() => fetchFf320Jobs()}
                  disabled={ff320JobsLoading}
                  size="small"
                >
                  {ff320JobsLoading ? 'Loading...' : 'Refresh'}
                </Button>
              </Box>

              {ff320Jobs.length === 0 ? (
                <Typography variant="body1" sx={{ color: 'text.secondary', textAlign: 'center', py: 3 }}>
                  No conversion history yet
                </Typography>
              ) : (
                <Box sx={{ overflowX: 'auto' }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: 'action.hover' }}>
                        <TableCell sx={{ fontWeight: 'bold' }}>File Name</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Region</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Upload Date & Time</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Download</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {ff320Jobs.map((job, idx) => (
                        <TableRow key={idx} sx={{ '&:hover': { backgroundColor: 'action.hover' } }}>
                          <TableCell sx={{ fontSize: '0.875rem' }}>{job.fileName}</TableCell>
                          <TableCell sx={{ fontSize: '0.875rem' }}>{job.region}</TableCell>
                          <TableCell sx={{ fontSize: '0.875rem' }}>{formatDate(job.createdAt)}</TableCell>
                          <TableCell>
                            <Chip
                              label={job.status}
                              color={
                                job.status.toLowerCase() === 'completed'
                                  ? 'success'
                                  : job.status.toLowerCase() === 'failed'
                                    ? 'error'
                                    : job.status.toLowerCase() === 'processing'
                                      ? 'warning'
                                      : 'default'
                              }
                              size="small"
                              variant="filled"
                              sx={{ fontWeight: 'bold' }}
                            />
                          </TableCell>
                          <TableCell>
                            {job.status.toLowerCase() === 'completed' && job.downloadUrl ? (
                              <Button
                                size="small"
                                variant="contained"
                                sx={{
                                  backgroundColor: theme.palette.color.midnight,
                                  color: '#fff',
                                  '&:hover': {
                                    backgroundColor: theme.palette.color.midnight,
                                    opacity: 0.9,
                                  }
                                }}
                                onClick={() => window.open(job.downloadUrl, '_blank')}
                              >
                                Download
                              </Button>
                            ) : job.status.toLowerCase() === 'processing' ? (
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Processing...</Typography>
                            ) : (
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>-</Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </>
          )}
        </Paper>
      </Box>

      {/* Container for both tabs and paper to ensure proper alignment */}
      <Box sx={{ width: '100%', maxWidth: 700, alignSelf: 'center' }}>
        {/* Tabs: left-aligned on top of the Paper */}
        <Box sx={{
          width: 'fit-content', // Changed from fixed 290px
          mb: 0,
        }}>
          <Tabs
            value={tab}
            onChange={handleTabChange}
            textColor="primary"
            indicatorColor="primary"
            TabIndicatorProps={{
              sx: {
                height: 4,
                borderRadius: 2,
                bottom: 0
              }
            }}
            sx={{
              minHeight: 50,
              height: 50,
              width: 'fit-content',
              borderRadius: 0,
              boxShadow: 1,
              border: `0.5px solid ${theme.palette.color.graphiteDeep}`,
              borderTop: 'none',
              overflow: 'visible',
              alignItems: 'flex-start',
              '& .MuiTabs-flexContainer': {
                position: 'relative',
                height: '100%',
                width: 'fit-content',
              },
              '& .MuiTabs-scroller': {
                width: 'fit-content',
                '& .MuiTabs-flexContainer': {
                  display: 'flex',
                  justifyContent: 'flex-start',
                  width: 'fit-content',
                }
              }
            }}
          >
            <Tab
              label="Generate"
              sx={{
                fontWeight: tab === 0 ? 'bold' : 500,
                textTransform: 'none',
                fontSize: '1.1rem',
                width: 150,
                height: 50,
                px: 3,
                py: 0,
                borderRadius: 0,
                background: tab === 0 ? theme.palette.color.midnight : 'transparent',
                transition: 'color 0.2s, font-weight 0.2s, background 0.2s, border-color 0.2s',
                border: `1px solid ${theme.palette.color.graphiteDeep}`,
                borderRight: `1px solid ${theme.palette.color.graphiteDeep}`, // Keep consistent
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.typography.fontFamily,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 'fit-content',
                position: 'relative',
                '&.Mui-selected': {
                  borderColor: theme.palette.color.midnight,
                  borderWidth: '2px',
                  borderBottom: 'none', // Remove bottom border when selected
                  zIndex: 2,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                },
                '&:hover': {
                  backgroundColor: tab === 0
                    ? theme.palette.color.midnight
                    : 'rgba(0, 0, 0, 0.04)',
                  borderColor: tab === 0
                    ? theme.palette.color.midnight
                    : theme.palette.color.contrastBlue,
                  zIndex: 1,
                },
                '&:not(.Mui-selected)': {
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)',
                }
              }}
            />
            <Tab
              label="Check Status"
              sx={{
                fontWeight: tab === 1 ? 'bold' : 500,
                textTransform: 'none',
                fontSize: '1.1rem',
                width: 150,
                height: 50,
                px: 3,
                py: 0,
                borderRadius: 0,
                background: tab === 1 ? theme.palette.color.midnight : 'transparent',
                transition: 'color 0.2s, font-weight 0.2s, background 0.2s, border-color 0.2s',
                border: `1px solid ${theme.palette.color.graphiteDeep}`,
                borderRight: `1px solid ${theme.palette.color.graphiteDeep}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.typography.fontFamily,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 'fit-content',
                position: 'relative',
                '&.Mui-selected': {
                  borderColor: theme.palette.color.midnight,
                  borderWidth: '2px',
                  borderBottom: 'none', // Remove bottom border when selected
                  zIndex: 2,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                },
                '&:hover': {
                  backgroundColor: tab === 1
                    ? theme.palette.color.midnight
                    : 'rgba(0, 0, 0, 0.04)',
                  borderColor: tab === 1
                    ? theme.palette.color.midnight
                    : theme.palette.color.contrastBlue,
                  zIndex: 1,
                },
                '&:not(.Mui-selected)': {
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)',
                }
              }}
            />
          </Tabs>
        </Box>

        {/* Separator line after tabs */}
        <Box
          sx={{
            width: '100%',
            height: '1px',
            backgroundColor: theme.palette.color.graphiteDeep,
            mt: 0,
            mb: 0
          }}
        />

        {/* Container to match AdminTabs content box styling */}
        <Box
          sx={{
            width: '100%',
            p: { xs: 2, sm: 4 },
            borderRadius: '0 0 8px 8px',
            mt: 0,
            height: tab === 1 ? '90%' : 'auto',
            display: 'flex',
            flexDirection: 'column',
            pb: 6,
            minHeight: tab === 1 ? 500 : 'unset',
            position: 'relative',
            border: `2px solid ${theme.palette.color.graphiteDeep}`,
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            backgroundColor: 'card.body.deep',
            overflow: 'hidden',
            backgroundColor: '#inherit'
          }}
        >
          {/* Content with normal padding */}
          <Box sx={{ pt: 2, }}>
            {tab === 0 && (
              <>
                <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 3, textAlign: 'center' }}>
                  HPPDM Test Data Generation Assistant
                </Typography>
                {/* Jira ID stays at the top */}
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                  <TextField
                    label={<span style={{ fontWeight: 'bold' }}>Jira ID</span>}
                    variant="outlined"
                    placeholder="Jira ID"
                    value={JiraID}
                    onChange={(e) => setJiraID(e.target.value)}
                    fullWidth
                    size="medium"
                  />
                </Box>
                {/* Record Scope */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Record Scope
                  </Typography>
                  <RadioGroup
                    name="record-scope"
                    value={recordScope}
                    onChange={handleRecordScopeChange}
                    sx={{ flexDirection: 'row' }}
                  >
                    <FormControlLabel value="All" control={<Radio color="primary" />} label={<Typography sx={{ fontWeight: 'bold' }}>All</Typography>} />
                    <FormControlLabel value="Changed" control={<Radio color="primary" />} label={<Typography sx={{ fontWeight: 'bold' }}>Changed</Typography>} />
                  </RadioGroup>
                </Box>
                {/* Source Type */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Source Type
                  </Typography>
                  <RadioGroup
                    name="source-type"
                    value={sourceType}
                    onChange={handleSourceTypeChange}
                    sx={{ flexDirection: 'row' }}
                  >
                    <FormControlLabel
                      value="SQL"
                      control={<Radio color="primary" />}
                      label={<Typography sx={{ fontWeight: 'bold' }}>EPDM Database</Typography>}
                    />
                    <FormControlLabel
                      value="file"
                      control={<Radio color="primary" />}
                      label={<Typography sx={{ fontWeight: 'bold' }}>File</Typography>}
                    />
                    <FormControlLabel
                      value="link"
                      control={<Radio color="primary" />}
                      label={<Typography sx={{ fontWeight: 'bold' }}>Sharepoint File URL</Typography>}
                    />
                  </RadioGroup>
                  {sourceType === 'SQL' && (
                    <FormControl size="small" sx={{ mt: 1, minWidth: 240 }}>
                      <InputLabel
                        id="db-name-label"
                      >
                        Database
                      </InputLabel>
                      <Select
                        labelId="db-name-label"
                        id="db-name-select"
                        value={dbName}
                        label="Database"
                        onChange={(e) => setDbName(e.target.value)}
                      >
                        {DB_OPTIONS.map(opt => (
                          <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                </Box>
                {/* Conditional Inputs */}
                {sourceType === 'file' && (
                  <Box
                    sx={{
                      border: '2px dashed',
                      borderColor: 'grey.500',
                      borderRadius: '8px',
                      padding: 2,
                      textAlign: 'center',
                      marginTop: 1,
                      marginBottom: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      cursor: 'pointer',
                      width: '100%',
                      maxWidth: '100%',
                      minWidth: 0,
                      boxSizing: 'border-box'
                    }}
                    onClick={(e) => {
                      // Prevent click if clicking the Remove button or its children
                      if (e.target.closest('.remove-file-btn')) return;
                      fileUploadInputRef.current?.click();
                    }}
                  >
                    <input
                      ref={fileUploadInputRef}
                      type="file"
                      hidden
                      onChange={handleFileChange}
                    />
                    <CloudUploadOutlinedIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
                    <Typography variant="subtitle1">Upload sources</Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
                      Click or Drag a file to upload
                    </Typography>
                    <Typography variant="caption" display="block" sx={{ marginTop: 1, fontSize: '0.75rem' }}>
                      Supported file types: .txt<br />
                      <span style={{ color: 'red', fontWeight: 500 }}>
                        File size must be less than 150 MB.
                      </span>
                    </Typography>
                    {fileUpload && (
                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                        <Typography variant="body2">{fileUpload.name} ({(fileUpload.size / 1024 / 1024).toFixed(2)} MB)</Typography>
                        <Button
                          size="small"
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFileUpload(null);
                          }}
                          className="remove-file-btn"
                          sx={{ ml: 2 }}
                        >
                          Remove
                        </Button>
                      </Box>
                    )}
                  </Box>
                )}
                {sourceType === 'link' && (
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                    <TextField
                      label={<span style={{ fontWeight: 'bold' }}>Sharepoint File URL</span>}
                      variant="outlined"
                      value={sharepointUrl}
                      onChange={(e) => setSharepointUrl(e.target.value)}
                      placeholder="Enter Sharepoint URL"
                      fullWidth
                      sx={{
                        minWidth: 300,
                        maxWidth: 650,
                        '& input': {
                          overflowX: 'auto'
                        }
                      }}
                      InputProps={{
                        style: { whiteSpace: 'nowrap' }
                      }}
                    />
                  </Box>
                )}
                {/* Left-aligned Generate Test Data button */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
                  <Button
                    onClick={handleGenerateTestDataClicked}
                    variant="primary"
                    size='large'
                    disabled={
                      loading ||
                      !JiraID ||
                      (sourceType === 'file' && !fileUpload) ||
                      (sourceType === 'link' && !sharepointUrl) ||
                      (sourceType === 'SQL' && !dbName)
                    }
                  >
                    Generate Test Data
                  </Button>
                </Box>
                {/* Only show status/message after clicking Generate */}
                {loading && (
                  <Typography
                    variant="body1"
                    sx={{ mt: 3, mb: 3, textAlign: 'center', fontWeight: 'bold' }}
                  >
                    Your data will begin generating soon...
                  </Typography>
                )}
                {status && (
                  <Box sx={{ mt: 0, mb: 6 }}>
                    <Status status={status} />
                  </Box>
                )}
              </>
            )}
            {tab === 1 && (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', mb: 2, position: 'relative' }}>
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 'bold',
                      textAlign: 'left',
                      flex: 1,
                    }}
                  >
                    Jobs
                  </Typography>
                  {/* Updated refresh button with proper disabled state and visual feedback */}
                  <Button
                    variant="text"
                    size="large"
                    onClick={() => {
                      manualRefreshRef.current = true; // Set flag to prevent auto-refresh conflict
                      fetchJobs(true); // Show refresh complete when manually triggered
                    }}
                    disabled={refreshing}
                    sx={{
                      position: 'absolute',
                      right: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      minWidth: 0,
                      p: 1,
                      opacity: refreshing ? 0.5 : 1,
                      cursor: refreshing ? 'not-allowed' : 'pointer',
                      pointerEvents: refreshing ? 'none' : 'auto',
                      transition: 'opacity 0.3s ease',
                      '&:disabled': {
                        opacity: 0.5,
                        cursor: 'not-allowed',
                        pointerEvents: 'none',
                      },
                    }}
                    aria-label="Refresh jobs"
                  >
                    <RefreshIcon
                      sx={{
                        fontSize: 40,
                        color: theme.palette.mode === 'light' ? '#003B71' : undefined, // Only set color in light mode
                        transition: 'color 0.3s ease',
                        '@keyframes spin': {
                          '0%': {
                            transform: 'rotate(0deg)',
                          },
                          '100%': {
                            transform: 'rotate(360deg)',
                          },
                        },
                      }}
                    />
                  </Button>
                </Box>
                <Typography
                  variant="body1"
                  sx={{
                    mb: 2,
                    textAlign: 'left',
                    color: 'text.secondary',
                  }}
                >
                  Your jobs over the last 24 hours will show up below
                </Typography>
                {/* Search bar */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <TextField
                    label="Search by Jira ID"
                    variant="outlined"
                    size="small"
                    value={searchJobId}
                    onChange={e => setSearchJobId(e.target.value)}
                    sx={{ width: 250 }}
                    InputProps={{
                      startAdornment: (
                        <SearchIcon sx={{ color: 'action.active', mr: 1, my: 0.5 }} />
                      ),
                    }}
                  />
                </Box>
                {/* Jobs Table - Enhanced scrollable container */}
                <Paper
                  elevation={2}
                  sx={{
                    p: 0,
                    mb: 2,
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    maxHeight: 400,
                    overflow: 'hidden',
                  }}
                >
                  <Box sx={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    maxHeight: '100%',
                  }}>
                    <Table stickyHeader>
                      <TableHead>
                        <TableRow sx={{ backgroundColor: 'table.head.background', fontWeight: 'bold', color: 'table.head.text' }}>
                          <TableCell
                            sx={{
                              fontWeight: 'bold',
                              fontSize: '1rem',
                              cursor: 'pointer',
                              userSelect: 'none',
                              zIndex: 1,
                              width: '120px',
                              minWidth: '120px',
                              maxWidth: '120px',
                              paddingRight: '8px',
                              backgroundColor: 'inherit'
                            }}
                            onClick={() => handleSort('jiraID')}
                          >
                            Jira ID
                            <Box component="span" sx={{ ml: 0.5, display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle' }}>
                              <ArrowDropUpIcon
                                fontSize="small"
                                sx={{
                                  color: sortField === 'jiraID' && sortDirection === 'asc' ? '#0074AD' : 'grey.400',
                                  m: 0, p: 0, lineHeight: 1,
                                }}
                              />
                              <ArrowDropDownIcon
                                fontSize="small"
                                sx={{
                                  color: sortField === 'jiraID' && sortDirection === 'desc' ? '#0074AD' : 'grey.400',
                                  m: 0, p: 0, lineHeight: 1,
                                  mt: '-8px'
                                }}
                              />
                            </Box>
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 'bold',
                              fontSize: '1rem',
                              cursor: 'pointer',
                              userSelect: 'none',
                              zIndex: 1,
                              width: '140px',
                              minWidth: '140px',
                              maxWidth: '140px',
                              paddingLeft: '8px',
                              backgroundColor: 'inherit'
                            }}
                          >
                            Status
                            <Box component="span" sx={{ ml: 0.5, display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle' }}>
                              <ArrowDropUpIcon
                                fontSize="small"
                                sx={{
                                  color: sortField === 'status' && sortDirection === 'asc' ? '#0074AD' : 'grey.400',
                                  m: 0, p: 0, lineHeight: 1,
                                }}
                              />
                              <ArrowDropDownIcon
                                fontSize="small"
                                sx={{
                                  color: sortField === 'status' && sortDirection === 'desc' ? '#0074AD' : 'grey.400',
                                  m: 0, p: 0, lineHeight: 1,
                                  mt: '-8px'
                                }}
                              />
                            </Box>
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 'bold',
                              fontSize: '1rem',
                              cursor: 'pointer',
                              userSelect: 'none',
                              zIndex: 1,
                              backgroundColor: 'inherit'
                            }}
                            onClick={() => handleSort('updatedAt')}
                          >
                            Last Updated
                            <Box component="span" sx={{ ml: 0.5, display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle' }}>
                              <ArrowDropUpIcon
                                fontSize="small"
                                sx={{
                                  color: sortField === 'updatedAt' && sortDirection === 'asc' ? '#0074AD' : 'grey.400',
                                  m: 0, p: 0, lineHeight: 1,
                                }}
                              />
                              <ArrowDropDownIcon
                                fontSize="small"
                                sx={{
                                  color: sortField === 'updatedAt' && sortDirection === 'desc' ? '#0074AD' : 'grey.400',
                                  m: 0, p: 0, lineHeight: 1,
                                  mt: '-8px'
                                }}
                              />
                            </Box>
                          </TableCell>
                          <TableCell sx={{
                            fontWeight: 'bold',
                            fontSize: '1rem',
                            zIndex: 1,
                            backgroundColor: 'inherit'
                          }}>
                            Actions
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sortedJobs.length === 0 ? (
                          <TableRow sx={{ backgroundColor: 'table.row.background' }}>
                            <TableCell colSpan={4} align="center" sx={{
                              color: 'grey.500', py: 4,
                              backgroundColor: 'inherit'
                            }}>
                              <Typography variant="body2" color="text.secondary">
                                <span role="img" aria-label="No jobs">📄</span> No jobs to display
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          sortedJobs.map((job) => (
                            <TableRow key={job.id} hover>
                              <TableCell sx={{
                                fontWeight: 500,
                                width: '190px',
                                minWidth: '190px',
                                maxWidth: '190px',
                                paddingRight: '8px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                backgroundColor: 'inherit'
                              }}>
                                {job.jiraID}
                              </TableCell>
                              <TableCell sx={{
                                width: '140px',
                                minWidth: '140px',
                                maxWidth: '140px',
                                paddingLeft: '8px',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                backgroundColor: 'inherit'
                              }}>
                                <Chip
                                  label={job.status}
                                  color={
                                    job.status.toLowerCase() === 'completed'
                                      ? 'success'
                                      : job.status.toLowerCase() === 'failed'
                                        ? 'error'
                                        : job.status.toLowerCase() === 'processing'
                                          ? 'warning'
                                          : 'default'
                                  }
                                  size="small"
                                  variant="filled"
                                  sx={{
                                    fontWeight: 'bold',
                                    letterSpacing: 1,
                                    textTransform: 'uppercase',
                                  }}
                                />
                              </TableCell>
                              <TableCell sx={{
                                fontSize: '0.875rem', color: 'text.secondary',
                                backgroundColor: 'inherit'
                              }}>
                                {formatDate(job.updatedAt)}
                              </TableCell>
                              <TableCell>
                                {job.status.toLowerCase() === 'completed' && job.downloadURL ? (
                                  <Button
                                    size="small"
                                    variant="primary"
                                    sx={{
                                      fontWeight: 'bold', textTransform: 'none',
                                      backgroundColor: 'inherit'
                                    }}
                                    onClick={() => {
                                      window.open(job.downloadURL, '_blank');
                                    }}
                                  >
                                    Download
                                  </Button>
                                ) : null}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </Box>
                </Paper>
              </>
            )}

            {tab === 2 && (
              <>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 3 }}>
                  File Format 320 Conversion Status
                </Typography>

                {/* Refresh button */}
                <Box sx={{ mb: 2 }}>
                  <Button
                    startIcon={<RefreshIcon />}
                    variant="primary"
                    onClick={() => fetchFf320Jobs()}
                    disabled={ff320JobsLoading}
                    sx={{ fontWeight: 'bold', textTransform: 'none' }}
                  >
                    {ff320JobsLoading ? 'Loading...' : 'Refresh Status'}
                  </Button>
                </Box>

                {/* File Format Jobs Table */}
                {ff320Jobs.length === 0 ? (
                  <Typography variant="body1" sx={{ color: 'text.secondary', textAlign: 'center', py: 3 }}>
                    No file conversion jobs found
                  </Typography>
                ) : (
                  <Paper elevation={2} sx={{ overflow: 'auto' }}>
                    <Table>
                      <TableHead>
                        <TableRow sx={{ backgroundColor: 'action.hover' }}>
                          <TableCell sx={{ fontWeight: 'bold' }}>File Name</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Region</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Row Count</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Created</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {ff320Jobs.map((job, idx) => (
                          <TableRow key={idx} sx={{ '&:hover': { backgroundColor: 'action.hover' } }}>
                            <TableCell sx={{ fontSize: '0.875rem' }}>{job.fileName}</TableCell>
                            <TableCell sx={{ fontSize: '0.875rem' }}>{job.region}</TableCell>
                            <TableCell>
                              <Chip
                                label={job.status}
                                color={
                                  job.status.toLowerCase() === 'completed'
                                    ? 'success'
                                    : job.status.toLowerCase() === 'failed'
                                      ? 'error'
                                      : job.status.toLowerCase() === 'processing'
                                        ? 'warning'
                                        : 'default'
                                }
                                size="small"
                                variant="filled"
                                sx={{ fontWeight: 'bold' }}
                              />
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.875rem' }}>{job.rowCount || '-'}</TableCell>
                            <TableCell sx={{ fontSize: '0.875rem' }}>{formatDate(job.createdAt)}</TableCell>
                            <TableCell>
                              {job.status.toLowerCase() === 'completed' && job.downloadUrl ? (
                                <Button
                                  size="small"
                                  variant="primary"
                                  sx={{ fontWeight: 'bold', textTransform: 'none' }}
                                  onClick={() => window.open(job.downloadUrl, '_blank')}
                                >
                                  Download
                                </Button>
                              ) : job.status.toLowerCase() === 'processing' ? (
                                <LinearProgress sx={{ width: 100 }} />
                              ) : (
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>-</Typography>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Paper>
                )}
              </>
            )}
          </Box>
        </Box>
      </Box>
    </Box >
  );
}
