'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Typography,
  Chip,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import LockIcon from '@mui/icons-material/Lock';
import PersonIcon from '@mui/icons-material/Person';
import RefreshIcon from '@mui/icons-material/Refresh';
import { PTS_CONFIG } from '../ptsConfig';
import { useAuth } from '@/app/contexts/OpenIdAuthContext';
import {
  saveSession,
  updateSession,
  isSessionOwner,
  touchSession,
  getAllSessions,
  deleteSession,
} from '../clientServices/sessionRegistryService';

const LOADRUNNER_FILES = PTS_CONFIG.LOADRUNNER_FILES;
const DYNATRACE_FILES = PTS_CONFIG.DYNATRACE_FILES;

const SessionInformation = ({ sessionId, onSessionChange, sourceType = 'loadrunner', apiBaseUrl, onSessionLoaded, uploadStatus = {}, slaFileNames = [], onClearSession, onOwnershipChange, }) => {
  const { user, loading } = useAuth(); // Add loading state

  // Get current user NUID - check multiple possible properties
  // Wait for authentication to complete before using NUID
  const currentUserNUID = loading ? null : (user?.nuid || user?.userId || user?.id);
  const currentUserName = loading ? null : (user?.name || user?.displayName || user?.userName || 'Development User');

  // All useState hooks must be declared before any other logic
  const [localSessionId, setLocalSessionId] = useState(sessionId);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [existingFiles, setExistingFiles] = useState([]);
  const [isOwner, setIsOwner] = useState(false);
  const [sessionOwnerName, setSessionOwnerName] = useState('');
  const [availableSessions, setAvailableSessions] = useState([]);
  const [dateFilters, setDateFilters] = useState({
    startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Past 3 days
    endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Tomorrow to include today's sessions
  });
  const [filterApplied, setFilterApplied] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState('custom');

  // Log component initialization with detailed user context
  console.log('🚀 [SESSION INFO] SessionInformation component loaded');
  console.log('📊 [SYSTEM CHECK] Authentication state check');
  console.log('🔍 [COMPONENT AUTH] useAuth() returns:', { user, loading });
  console.log('👤 [SESSION INFO] Current user context:', {
    user: user,
    loading: loading,
    hasUserObject: !!user,
    userKeys: user ? Object.keys(user) : [],
    currentUserNUID: currentUserNUID,
    currentUserName: currentUserName,
    nuidSource: user?.nuid ? 'user.nuid' : user?.userId ? 'user.userId' : user?.id ? 'user.id' : 'not available',
    timestamp: new Date().toISOString(),
    authContextStatus: loading ? 'LOADING' : user === null ? 'NULL_USER' : user === undefined ? 'UNDEFINED_USER' : 'USER_EXISTS',
    authState: loading ? 'Authentication still loading...' : user ? 'Authentication complete' : 'Not authenticated',
    nuidAvailable: !!currentUserNUID
  });

  // Additional authentication debugging
  console.log('🔍 [AUTH INVESTIGATION] Checking authentication context:');
  console.log('🔍 [AUTH INVESTIGATION] useAuth() returned:', { user: typeof user, loading: loading });
  console.log('🔍 [AUTH INVESTIGATION] Is authentication provider available?', !!useAuth);
  console.log('🔍 [AUTH INVESTIGATION] Component render time:', new Date().toISOString());

  if (loading) {
    console.log('⏳ [AUTH STATUS] Authentication is currently loading - waiting for completion');
  } else if (!user) {
    console.log('❌ [AUTH STATUS] Authentication completed but no user data available - authentication may have failed');
  } else if (!currentUserNUID) {
    console.log('⚠️ [AUTH STATUS] User exists but NUID not available - check user object structure');
  } else {
    console.log('✅ [AUTH STATUS] Authentication successful with valid NUID:', currentUserNUID);
  }

  // Track authentication completion specifically
  useEffect(() => {
    if (!loading && user) {
      console.log('🎉 [AUTH SUCCESS] Authentication completed! User is now available:');
      console.log('🎉 [AUTH SUCCESS] Final user object:', user);
      console.log('🎉 [AUTH SUCCESS] Final currentUserNUID:', currentUserNUID);
      console.log('🎉 [AUTH SUCCESS] User properties:', Object.keys(user));
      console.log('🎉 [AUTH SUCCESS] User values:', Object.entries(user).reduce((acc, [key, value]) => {
        acc[key] = typeof value === 'object' ? '[object]' : value;
        return acc;
      }, {}));
      console.log('🎉 [AUTH SUCCESS] NUID source:', user?.nuid ? 'user.nuid' : user?.userId ? 'user.userId' : user?.id ? 'user.id' : 'none available');
      console.log('✅ [AUTH SUCCESS] Authentication flow complete - user NUID is now:', currentUserNUID);
    } else if (!loading && !user) {
      console.log('❌ [AUTH FAILED] Authentication completed but user is still null!');
      console.log('❌ [AUTH FAILED] This indicates an authentication failure');
      console.log('❌ [AUTH FAILED] Check authentication configuration and API endpoints');
    } else if (loading) {
      console.log('⏳ [AUTH PROGRESS] Authentication still in progress...', { loading, hasUser: !!user });
    }
  }, [loading, user, currentUserNUID]);

  // Add authentication timeout monitoring
  useEffect(() => {
    if (loading) {
      console.log('⏰ [AUTH TIMEOUT] Setting up authentication timeout monitoring...');
      const timeoutId = setTimeout(() => {
        if (loading && !user) {
          console.warn('🚨 [AUTH TIMEOUT] Authentication has been loading for 10+ seconds!');
          console.warn('🚨 [AUTH TIMEOUT] This suggests the authentication provider may be stuck');
          console.warn('🚨 [AUTH TIMEOUT] Current state:', { loading, user, currentUserNUID });
          console.warn('🚨 [AUTH TIMEOUT] Check authentication API endpoints and network requests');
          console.warn('🚨 [AUTH TIMEOUT] Consider refreshing the page if authentication doesn\'t complete');
        }
      }, 10000); // 10 second timeout

      return () => clearTimeout(timeoutId);
    }
  }, [loading, user, currentUserNUID]);

  // Log user context status for debugging
  useEffect(() => {
    console.log('🔍 [AUTH DEBUG] useEffect triggered - investigating user context');
    console.log('🔍 [AUTH DEBUG] Raw user from useAuth():', user);
    console.log('🔍 [AUTH DEBUG] typeof user:', typeof user);
    console.log('🔍 [AUTH DEBUG] user === null:', user === null);
    console.log('🔍 [AUTH DEBUG] user === undefined:', user === undefined);
    console.log('💡 [AUTH DEBUG] System elsewhere has Y768745, checking alternative access methods...');

    // Try to access user info from different potential sources
    if (typeof window !== 'undefined') {
      console.log('🌐 [AUTH DEBUG] Checking window object for user data...');
      console.log('🌐 [AUTH DEBUG] window.location:', window.location?.href);
      // Check if user data might be in localStorage or sessionStorage
      try {
        const localStorageUser = localStorage.getItem('user') || localStorage.getItem('auth-user') || localStorage.getItem('currentUser');
        console.log('💾 [AUTH DEBUG] localStorage user data:', localStorageUser);
        const sessionStorageUser = sessionStorage.getItem('user') || sessionStorage.getItem('auth-user');
        console.log('🗂️ [AUTH DEBUG] sessionStorage user data:', sessionStorageUser);
      } catch (e) {
        console.log('⚠️ [AUTH DEBUG] Could not access storage:', e.message);
      }
    }

    if (user) {
      console.log('✅ [AUTH] User authenticated:', {
        nuid: currentUserNUID,
        name: currentUserName,
        userObjectProperties: Object.keys(user),
        userValues: Object.entries(user).reduce((acc, [key, value]) => {
          acc[key] = typeof value === 'object' ? '[object]' : value;
          return acc;
        }, {})
      });
    } else {
      console.warn('⚠️ [AUTH] User context is null - investigating authentication state');
      console.log('🔍 [AUTH DEBUG] useAuth hook result:', { user });
      console.log('🔍 [AUTH DEBUG] Authentication context may not be initialized');
      console.log('🔍 [AUTH DEBUG] Check if OpenIdAuthContext provider is properly wrapping this component');
      console.log('🔍 [AUTH DEBUG] Check if authentication is still in progress');
    }
  }, [user, currentUserNUID, currentUserName]);

  const [loadedSlaFileNames, setLoadedSlaFileNames] = useState([]);
  const [existingFilesBySource, setExistingFilesBySource] = useState({
    loadrunner: [],
    dynatrace: [],
    azure: [],
    sla: [] // Add SLA files to the same structure
  });
  const [reportUrl, setReportUrl] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteOptions, setDeleteOptions] = useState({
    loadrunner: true,
    dynatrace: true,
    azure: true,
    sla: true,
  });
  const [deleteResult, setDeleteResult] = useState(null);
  const isInitialMount = useRef(true); // Track initial mount to prevent auto-load

  // Auto-load session when sessionId prop changes (e.g., from localStorage)
  useEffect(() => {
    if (sessionId && sessionId !== localSessionId) {
      console.log('🔄 SessionId prop changed, auto-loading:', sessionId);
      setLocalSessionId(sessionId);
      // Auto-load the session
      setTimeout(() => {
        handleLoadSessionInternal(sessionId);
      }, 100);
    }
  }, [sessionId]);

  // Refetch sessions when date filters change
  useEffect(() => {
    console.log('📅 Date filters changed, clearing sessions list to force refresh on next open');
    setAvailableSessions([]); // Clear sessions to force refresh when dropdown opens
  }, [dateFilters]);

  // Load available sessions from registry - REMOVED to prevent auto-loading
  // Sessions will be loaded when user opens the dropdown instead
  // useEffect(() => {
  //   loadAvailableSessions();
  // }, [sessionId]);

  const loadAvailableSessions = async () => {
    // Clear the session info page when refresh is clicked
    setSessionInfo(null);
    setLocalSessionId('');
    setError('');
    setExistingFiles([]);
    setIsOwner(false);
    setSessionOwnerName('');
    setLoadedSlaFileNames([]);
    setExistingFilesBySource({
      loadrunner: [],
      dynatrace: [],
      azure: [],
      sla: []
    });
    setReportUrl(null);
    setDeleteResult(null);

    console.log('🔄 Refreshing sessions with current date filters:', dateFilters);
    await fetchSessionsList();
  };

  // Fetch sessions without clearing current session data (for dropdown)
  const fetchSessionsList = async (customFilters = null) => {

    try {
      // Use custom filters or default date filters
      const filters = customFilters || {
        startDate: dateFilters.startDate + 'T00:00:00.000Z',
        endDate: dateFilters.endDate + 'T23:59:59.999Z'
      };

      console.log('📅 [DATE DEBUG] Date filter details:', {
        dateFilters,
        customFilters,
        finalFilters: filters,
        startDateParsed: filters.startDate ? new Date(filters.startDate).toISOString() : null,
        endDateParsed: filters.endDate ? new Date(filters.endDate).toISOString() : null
      });

      // Build query parameters for date filtering
      const queryParams = new URLSearchParams();
      if (filters.startDate) {
        queryParams.set('startDate', filters.startDate);
      }
      if (filters.endDate) {
        queryParams.set('endDate', filters.endDate);
      }

      // Fetch sessions from backend API with date filters
      const endpoint = `/api/pts/sessions?${queryParams.toString()}`;
      console.log('🔍 Fetching sessions from backend:', endpoint);
      console.log('📅 Using date filters:', filters);

      const response = await fetch(endpoint);
      console.log('📬 Backend response status:', response.status, response.statusText);

      if (response.ok) {
        const backendSessions = await response.json();
        console.log('📥 Received sessions from backend:', backendSessions);
        console.log('📊 Backend sessions count:', backendSessions.length);

        if (!Array.isArray(backendSessions)) {
          console.log('❌ Backend returned non-array:', typeof backendSessions);
          throw new Error('Invalid response format from backend');
        }

        // Get sessions from localStorage
        const localSessions = getAllSessions();
        console.log('💾 Sessions from localStorage:', localSessions.length);

        // Apply date filtering to localStorage sessions if filters are active
        let filteredLocalSessions = localSessions;
        if (filters.startDate || filters.endDate) {
          const filterStartDate = filters.startDate ? new Date(filters.startDate) : null;
          const filterEndDate = filters.endDate ? new Date(filters.endDate) : null;

          console.log('📅 [LOCAL FILTER] Applying date filters to localStorage sessions:', {
            startDate: filters.startDate,
            endDate: filters.endDate,
            totalLocal: localSessions.length
          });

          filteredLocalSessions = localSessions.filter(session => {
            const sessionDateStr = session.updated_at || session.lastAccessed || session.createdAt;
            if (!sessionDateStr) {
              console.log('⚠️ [LOCAL FILTER] No date for local session:', session.sessionId);
              return false;
            }

            const sessionDate = new Date(sessionDateStr);
            if (isNaN(sessionDate.getTime())) {
              console.log('⚠️ [LOCAL FILTER] Invalid date for local session:', session.sessionId, sessionDateStr);
              return false;
            }

            if (filterStartDate && sessionDate < filterStartDate) {
              return false;
            }
            if (filterEndDate && sessionDate > filterEndDate) {
              return false;
            }

            return true;
          });

          console.log('📊 [LOCAL FILTER] Local filtering result:', {
            original: localSessions.length,
            filtered: filteredLocalSessions.length
          });
        }

        // When filters are applied, use only backend sessions (which are already filtered)
        // Don't merge with localStorage to ensure filter accuracy
        if (filters.startDate || filters.endDate) {
          console.log('🔍 [FILTERED MODE] Using only backend sessions (already filtered by API)');

          // Convert backend sessions to standardized format
          const filteredSessionsList = backendSessions.map(backendSession => ({
            sessionId: backendSession.session_id,
            createdByNUID: backendSession.createdByNUID,
            createdByName: 'Unknown',
            createdAt: backendSession.created_at,
            lastAccessed: backendSession.updated_at,
            status: backendSession.status || 'unknown',
            hasFiles: false,
            hasSLA: false,
            fileCount: 0,
            sources: []
          })).sort((a, b) => {
            // First, prioritize user's own sessions
            const aIsOwner = a.createdByNUID && a.createdByNUID.toUpperCase() === currentUserNUID.toUpperCase();
            const bIsOwner = b.createdByNUID && b.createdByNUID.toUpperCase() === currentUserNUID.toUpperCase();

            // If ownership is different, owner's sessions come first
            if (aIsOwner !== bIsOwner) {
              return aIsOwner ? -1 : 1;
            }

            // If ownership is the same, sort by lastAccessed/updated_at (most recent first)
            const dateA = new Date(a.lastAccessed || a.createdAt || 0);
            const dateB = new Date(b.lastAccessed || b.createdAt || 0);
            return dateB - dateA; // Most recent first
          });

          console.log('✅ Filtered sessions (backend only):', filteredSessionsList.length);
          console.log('📋 Available sessions for dropdown:', filteredSessionsList);
          setAvailableSessions(filteredSessionsList);
        } else {
          // No filters applied - merge backend and localStorage sessions
          const sessionMap = new Map();

          // Add filtered localStorage sessions first
          filteredLocalSessions.forEach(session => {
            sessionMap.set(session.sessionId, {
              sessionId: session.sessionId,
              createdByNUID: session.createdByNUID,
              createdByName: session.createdByName,
              createdAt: session.createdAt,
              lastAccessed: session.lastAccessed,
              status: session.status,
              hasFiles: session.hasFiles,
              hasSLA: session.hasSLA,
              fileCount: session.fileCount,
              sources: session.sources || []
            });
          });

          // Merge backend sessions (backend createdByNUID takes absolute precedence and should never be changed)
          backendSessions.forEach(backendSession => {
            const existing = sessionMap.get(backendSession.session_id);
            const merged = {
              sessionId: backendSession.session_id,
              createdByNUID: backendSession.createdByNUID, // Backend createdByNUID is authoritative and immutable
              createdByName: existing?.createdByName || 'Unknown',
              createdAt: backendSession.created_at || existing?.createdAt,
              lastAccessed: backendSession.updated_at || existing?.lastAccessed,
              status: backendSession.status || existing?.status || 'unknown',
              hasFiles: existing?.hasFiles || false,
              hasSLA: existing?.hasSLA || false,
              fileCount: existing?.fileCount || 0,
              sources: existing?.sources || []
            };
            sessionMap.set(backendSession.session_id, merged);

            // Save to localStorage to keep registry in sync
            saveSession(merged);
          });

          // Convert map to array and sort by ownership first, then by lastAccessed/updated_at
          const mergedSessions = Array.from(sessionMap.values()).sort((a, b) => {
            // First, prioritize user's own sessions
            const aIsOwner = a.createdByNUID && a.createdByNUID.toUpperCase() === currentUserNUID.toUpperCase();
            const bIsOwner = b.createdByNUID && b.createdByNUID.toUpperCase() === currentUserNUID.toUpperCase();

            // If ownership is different, owner's sessions come first
            if (aIsOwner !== bIsOwner) {
              return aIsOwner ? -1 : 1;
            }

            // If ownership is the same, sort by lastAccessed/updated_at (most recent first)
            const dateA = new Date(a.lastAccessed || a.createdAt || 0);
            const dateB = new Date(b.lastAccessed || b.createdAt || 0);
            return dateB - dateA; // Most recent first
          });

          console.log('✅ Merged sessions:', mergedSessions.length);
          console.log('📋 Available sessions for dropdown:', mergedSessions);
          setAvailableSessions(mergedSessions);
        }
      } else {
        const errorText = await response.text().catch(() => 'No error text');
        console.warn('⚠️ Backend sessions API returned:', response.status, errorText);
        // Fallback to localStorage only
        const localSessions = getAllSessions();
        console.log('💾 Fallback to localStorage sessions:', localSessions.length);

        // Apply date filtering to fallback sessions too
        let filteredFallbackSessions = localSessions;
        if (filters.startDate || filters.endDate) {
          const filterStartDate = filters.startDate ? new Date(filters.startDate) : null;
          const filterEndDate = filters.endDate ? new Date(filters.endDate) : null;

          filteredFallbackSessions = localSessions.filter(session => {
            const sessionDateStr = session.updated_at || session.lastAccessed || session.createdAt;
            if (!sessionDateStr) return false;

            const sessionDate = new Date(sessionDateStr);
            if (isNaN(sessionDate.getTime())) return false;

            if (filterStartDate && sessionDate < filterStartDate) return false;
            if (filterEndDate && sessionDate > filterEndDate) return false;

            return true;
          });

          console.log('📅 Fallback sessions after date filtering:', {
            original: localSessions.length,
            filtered: filteredFallbackSessions.length
          });
        }

        setAvailableSessions(filteredFallbackSessions);
      }
    } catch (error) {
      console.log('❌ Error loading available sessions:', error);
      console.log('❌ Error stack:', error.stack);
      // Fallback to localStorage only
      try {
        const localSessions = getAllSessions();
        console.log('💾 Fallback to localStorage sessions:', localSessions.length);

        // Apply date filtering to error fallback sessions too
        let filteredErrorFallbackSessions = localSessions;
        if (filters.startDate || filters.endDate) {
          const filterStartDate = filters.startDate ? new Date(filters.startDate) : null;
          const filterEndDate = filters.endDate ? new Date(filters.endDate) : null;

          filteredErrorFallbackSessions = localSessions.filter(session => {
            const sessionDateStr = session.updated_at || session.lastAccessed || session.createdAt;
            if (!sessionDateStr) return false;

            const sessionDate = new Date(sessionDateStr);
            if (isNaN(sessionDate.getTime())) return false;

            if (filterStartDate && sessionDate < filterStartDate) return false;
            if (filterEndDate && sessionDate > filterEndDate) return false;

            return true;
          });

          console.log('📅 Error fallback sessions after date filtering:', {
            original: localSessions.length,
            filtered: filteredErrorFallbackSessions.length
          });
        }

        setAvailableSessions(filteredErrorFallbackSessions);
      } catch (localError) {
        console.log('❌ Error loading localStorage sessions:', localError);
        setAvailableSessions([]);
      }
    }
  };

  // Use provided apiBaseUrl or default from config
  const baseUrl = apiBaseUrl || PTS_CONFIG.API.BASE_URL;

  const handleSessionIdChange = (event) => {
    setLocalSessionId(event.target.value);
  };

  const checkSessionFilesForSource = async (sessionIdToCheck, source) => {
    try {
      const endpoint = `/api/pts/check-session-files/${sessionIdToCheck}?source_type=${source}`;

      console.log(`🔍 [PTS] Checking ${source} session files...`);
      console.log('📍 API URL:', endpoint);

      const response = await fetch(endpoint);

      if (!response.ok) {
        console.warn(`⚠️ Check session response not OK for ${source}:`, response.status);
        return { source, found: [] };
      }

      const data = await response.json();
      const foundFiles = data.data_files?.found || [];
      console.log(`📁 Found ${source} files:`, foundFiles);
      console.log(`📄 SLA file data for ${source}:`, data.sla_file);
      console.log(`📝 SLA filename(s) for ${source}:`, data.sla_file?.filename || data.sla_file?.filenames);

      // Capture ownership info from backend
      const createdByNUID = data.createdByNUID || null;
      const createdAt = data.createdAt || null;
      console.log(`👤 Session owner for ${source}:`, createdByNUID);

      // Handle both single filename and multiple filenames
      let slaFileNames = [];
      if (data.sla_file?.filenames && Array.isArray(data.sla_file.filenames)) {
        // Backend returns multiple files
        slaFileNames = data.sla_file.filenames.map(name => {
          return name.includes('/') ? name.split('/').pop() : name;
        });
      } else if (data.sla_file?.filename) {
        // Backend returns single file
        let slaFileName = data.sla_file.filename;
        if (slaFileName.includes('/')) {
          slaFileName = slaFileName.split('/').pop();
        }
        slaFileNames = [slaFileName];
      }
      console.log(`📋 Extracted SLA filename(s) for ${source}:`, slaFileNames);

      return {
        source,
        found: foundFiles,
        slaExists: data.sla_file?.exists || false,
        slaFileNames: slaFileNames,
        createdByNUID,
        createdAt
      };
    } catch (err) {
      console.log(`❌ Error checking ${source} session files:`, err);
      return { source, found: [] };
    }
  };

  const checkSessionFiles = async (sessionIdToCheck) => {
    try {
      setIsLoading(true);
      setError('');

      console.log('🔍 [PTS] Checking session files for all sources...');
      console.log('📦 Session ID:', sessionIdToCheck);

      // Check all four source types concurrently (including SLA)
      const [loadrunnerResult, dynatraceResult, azureResult, slaResult] = await Promise.all([
        checkSessionFilesForSource(sessionIdToCheck, 'loadrunner'),
        checkSessionFilesForSource(sessionIdToCheck, 'dynatrace'),
        checkSessionFilesForSource(sessionIdToCheck, 'azure'),
        checkSessionFilesForSource(sessionIdToCheck, 'sla')
      ]);

      // Update state with results from all sources
      const filesBySource = {
        loadrunner: loadrunnerResult.found,
        dynatrace: dynatraceResult.found,
        azure: azureResult.found,
        sla: slaResult.found.length > 0 ? slaResult.found : [
          ...(loadrunnerResult.slaFileNames || []),
          ...(dynatraceResult.slaFileNames || []),
          ...(azureResult.slaFileNames || []),
          ...(slaResult.slaFileNames || [])
        ]
      };

      setExistingFilesBySource(filesBySource);

      // Combine all files for backward compatibility
      const allFiles = [
        ...loadrunnerResult.found,
        ...dynatraceResult.found,
        ...azureResult.found
      ];
      setExistingFiles(allFiles);

      console.log('📊 Files by source:', filesBySource);
      console.log('📁 Total files found:', allFiles.length);
      console.log('📄 SLA files found:', filesBySource.sla);

      // Get ownership info from any source that has it
      const ownerInfo = loadrunnerResult.createdByNUID
        ? { createdByNUID: loadrunnerResult.createdByNUID, createdAt: loadrunnerResult.createdAt }
        : dynatraceResult.createdByNUID
          ? { createdByNUID: dynatraceResult.createdByNUID, createdAt: dynatraceResult.createdAt }
          : azureResult.createdByNUID
            ? { createdByNUID: azureResult.createdByNUID, createdAt: azureResult.createdAt }
            : { createdByNUID: null, createdAt: null };

      console.log('🔍 [OWNERSHIP] Owner info from backend:', ownerInfo);
      console.log('🔍 [OWNERSHIP] Current user NUID:', currentUserNUID);

      // Save session to registry - DO NOT default to currentUserNUID if owner is unknown
      if (allFiles.length > 0 || filesBySource.sla.length > 0) {
        const sessionData = {
          sessionId: sessionIdToCheck,
          createdByNUID: ownerInfo.createdByNUID, // Don't use fallback here
          createdByName: currentUserName,
          createdAt: ownerInfo.createdAt || new Date().toISOString(),
          status: 'active',
          hasFiles: allFiles.length > 0,
          hasSLA: filesBySource.sla.length > 0,
          fileCount: allFiles.length,
          sources: [
            ...(loadrunnerResult.found.length > 0 ? ['loadrunner'] : []),
            ...(dynatraceResult.found.length > 0 ? ['dynatrace'] : []),
            ...(azureResult.found.length > 0 ? ['azure'] : [])
          ]
        };

        saveSession(sessionData);
        console.log('💾 Saved session to registry:', sessionData);
      }

      return {
        loadrunner: loadrunnerResult,
        dynatrace: dynatraceResult,
        azure: azureResult,
        sla: slaResult,
        allFiles,
        ownerInfo
      };
    } catch (err) {
      console.log('❌ Error checking session files:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSessionReport = async (sessionIdToCheck) => {
    try {
      console.log('🔍 [PTS] Checking for existing report...');
      const reportEndpoint = `/api/pts/session/${sessionIdToCheck}`;

      const response = await fetch(reportEndpoint);

      if (response.ok) {
        const data = await response.json();
        if (data.report_url && data.report_url.trim()) {
          setReportUrl(data.report_url);
          console.log('✅ Found existing report:', data.report_url);
        } else {
          console.log('ℹ️ No report URL found for this session');
        }
      } else {
        console.log('ℹ️ No existing report data found');
      }
    } catch (err) {
      console.warn('⚠️ Error checking for report:', err);
      // Don't set error state, just log - missing report is not an error
    }
  };

  const handleLoadSession = async () => {
    if (!localSessionId.trim()) {
      setError('Please enter a session ID');
      return;
    }

    // Ensure authentication is complete before loading session
    if (loading) {
      setError('Please wait for authentication to complete');
      return;
    }

    if (!currentUserNUID) {
      setError('Authentication required. Please ensure you are logged in.');
      return;
    }

    await handleLoadSessionInternal(localSessionId.trim());
  };

  const handleLoadSessionInternal = async (sessionIdToLoad) => {
    console.log('🔄 [PTS] Loading session:', sessionIdToLoad);

    setError('');
    setSessionInfo(null);
    setIsOwner(false);
    setSessionOwnerName('');
    setReportUrl(null); // Reset report URL
    onSessionChange('');

    if (loading || !currentUserNUID) {
      setError(loading ? 'Please wait for authentication to complete' : 'Authentication required. Please ensure you are logged in.');
      return;
    }

    setIsLoading(true);

    // First, get ALL sessions to check if this session already exists
    let backendOwnerNUID = null;
    let sessionExists = false;

    try {
      const sessionsResponse = await fetch('/api/pts/sessions');
      if (sessionsResponse.ok) {
        const sessions = await sessionsResponse.json();
        console.log('🔍 [SESSION CHECK] Got sessions list:', sessions.length, 'sessions');

        // Check if our session is in the list
        const matchingSession = sessions.find(s => s.session_id === sessionIdToLoad);
        if (matchingSession) {
          backendOwnerNUID = matchingSession.createdByNUID;
          sessionExists = true;
          console.log('✅ [SESSION CHECK] Session exists in backend:', {
            sessionId: sessionIdToLoad,
            owner: backendOwnerNUID,
            status: matchingSession.status
          });
        } else {
          console.log('❌ [SESSION CHECK] Session NOT found in backend sessions list');
        }
      } else {
        throw new Error(`Unable to check existing sessions (HTTP ${sessionsResponse.status}). Please try again.`);
      }
    } catch (err) {
      console.warn('⚠️ [SESSION CHECK] Error fetching sessions list:', err);
      setError(err.message || 'Unable to check existing sessions. Please try again.');
      setIsLoading(false);
      return;
    }

    // If session doesn't exist in the list, create it
    if (!sessionExists) {
      try {
        // Detailed authentication check before session creation
        console.log('🔍 [SESSION CREATION AUTH] Pre-creation authentication check:');
        console.log('🔍 [SESSION CREATION AUTH] user object:', user);
        console.log('🔍 [SESSION CREATION AUTH] user is null:', user === null);
        console.log('🔍 [SESSION CREATION AUTH] user is undefined:', user === undefined);
        console.log('🔍 [SESSION CREATION AUTH] currentUserNUID:', currentUserNUID);
        console.log('🔍 [SESSION CREATION AUTH] Will use NUID:', currentUserNUID);

        // Ensure we have a valid NUID before creating session
        if (!currentUserNUID) {
          console.log('❌ [SESSION CREATION] No NUID available for session creation!');
          console.log('❌ [SESSION CREATION] currentUserNUID:', currentUserNUID);
          console.log('❌ [SESSION CREATION] user context:', user);
          console.log('❌ [SESSION CREATION] loading state:', loading);
          console.log('❌ [SESSION CREATION] Cannot create session without valid user NUID');

          // Don't attempt session creation without NUID
          setError('Authentication required. Please ensure you are logged in.');
          return;
        } else {
          console.log('✅ [SESSION CREATION] Using NUID:', currentUserNUID, 'for session creation');
        }

        const createEndpoint = `/api/pts/session/${encodeURIComponent(sessionIdToLoad)}?createdByNUID=${encodeURIComponent(currentUserNUID)}`;
        console.log('✨ [SESSION CREATION] Creating new session:', createEndpoint);
        console.log('🔑 [SESSION CREATION] User NUID being passed to API:', currentUserNUID);
        console.log('📋 [SESSION CREATION] Complete user details:', {
          user: user,
          userObjectExists: !!user,
          userProperties: user ? Object.keys(user) : [],
          currentUserNUID: currentUserNUID,
          currentUserName: currentUserName,
          sessionId: sessionIdToLoad,
          apiEndpoint: createEndpoint,
          nuidSource: user?.nuid ? 'user.nuid' : user?.userId ? 'user.userId' : user?.id ? 'user.id' : 'none',
          timestamp: new Date().toISOString()
        });

        const createResponse = await fetch(createEndpoint, {
          method: 'GET'
        });

        if (createResponse.ok) {
          const createResult = await createResponse.json();
          console.log('🎉 [SESSION CREATION] Session created successfully:', createResult);
          backendOwnerNUID = createResult.createdByNUID || null;
          sessionExists = true;

          // Save the newly created session to localStorage immediately
          const newSessionData = {
            sessionId: sessionIdToLoad,
            createdByNUID: backendOwnerNUID,
            createdByName: currentUserName,
            createdAt: new Date().toISOString(),
            status: 'active',
            hasFiles: false,
            hasSLA: false,
            fileCount: 0,
            sources: []
          };
          saveSession(newSessionData);
          console.log('💾 [SESSION CREATION] Saved new session to localStorage:', newSessionData);
        } else {
          const errorData = await createResponse.json().catch(() => ({}));
          const detail = [errorData.detail, errorData.message, errorData.details, errorData.error]
            .find(value => typeof value === 'string' && value.trim());
          throw new Error(`Failed to create session (HTTP ${createResponse.status}).${detail ? ` ${detail}` : ' Please try again.'}`);
        }
      } catch (err) {
        console.log('❌ [SESSION CREATION] Error creating session:', err);
        console.log('❌ [SESSION CREATION] Current user context:', { currentUserNUID, currentUserName, user });
        setError(err.message || 'Failed to create session. Please try again.');
        setIsLoading(false);
        return;
      }
    } else {
      // Session exists, just retrieve it without changing ownership
      console.log('ℹ️ [SESSION LOAD] Session exists, loading existing session data without creating new one');
    }

    // Check for existing files in backend
    const existingSession = await checkSessionFiles(sessionIdToLoad);

    const allFoundFiles = existingSession?.allFiles || [];
    const slaExists = existingSession?.loadrunner?.slaExists ||
      existingSession?.dynatrace?.slaExists ||
      existingSession?.azure?.slaExists ||
      existingSession?.sla?.slaExists || false;

    // Collect all SLA filenames from all sources, including dedicated SLA endpoint
    const allSlaFileNames = [
      ...(existingSession?.loadrunner?.slaFileNames || []),
      ...(existingSession?.dynatrace?.slaFileNames || []),
      ...(existingSession?.azure?.slaFileNames || []),
      ...(existingSession?.sla?.slaFileNames || []),
      ...(existingSession?.sla?.found || []) // Also include files from sla source_type
    ];

    // Determine ownership - prioritize backend sessions API, then check-session-files API
    const ownerNUID = backendOwnerNUID || existingSession?.ownerInfo?.createdByNUID;

    console.log('🔐 [OWNERSHIP CHECK]', {
      sessionId: sessionIdToLoad,
      backendOwnerNUID,
      fileCheckOwnerNUID: existingSession?.ownerInfo?.createdByNUID,
      finalOwnerNUID: ownerNUID,
      currentUserNUID,
      ownerExists: !!ownerNUID,
      canCheckOwnership: !!currentUserNUID
    });

    // If ownerNUID exists and we have currentUserNUID, check ownership; otherwise assume not owner for safety
    const isCurrentUserOwner = (ownerNUID && currentUserNUID)
      ? (ownerNUID.trim().toUpperCase() === currentUserNUID.trim().toUpperCase())
      : false; // Default to false if we can't verify ownership

    onSessionChange(sessionIdToLoad);
    setIsOwner(isCurrentUserOwner);
    setSessionOwnerName(ownerNUID || 'Unknown');

    console.log('👤 [OWNERSHIP RESULT]:', {
      sessionId: sessionIdToLoad,
      ownerNUID,
      currentUserNUID,
      isOwner: isCurrentUserOwner,
      reason: !currentUserNUID ? 'No current user NUID' :
        !ownerNUID ? 'No owner NUID found' :
          'NUID comparison completed'
    });

    // Notify parent component of ownership status
    if (onOwnershipChange) {
      onOwnershipChange(isCurrentUserOwner, ownerNUID);
    } setSessionInfo({
      id: sessionIdToLoad,
      createdAt: existingSession?.ownerInfo?.createdAt || new Date().toISOString(),
      status: 'active',
      hasExistingData: allFoundFiles.length > 0,
      hasSLA: slaExists,
      isOwner: isCurrentUserOwner,
      ownerNUID
    });

    // Store the loaded SLA filenames
    setLoadedSlaFileNames(allSlaFileNames);

    // Touch session to update last accessed time
    touchSession(sessionIdToLoad);

    // Check if there's an existing report for this session
    await fetchSessionReport(sessionIdToLoad);

    console.log('✨ Session loaded successfully:', {
      id: sessionIdToLoad,
      hasExistingData: allFoundFiles.length > 0,
      foundFiles: allFoundFiles,
      slaExists: slaExists,
      slaFileNames: allSlaFileNames,
      bySource: existingSession
    });

    // Notify parent component about existing session data
    if (onSessionLoaded && (allFoundFiles.length > 0 || slaExists)) {
      onSessionLoaded({
        hasDataFiles: allFoundFiles.length > 0,
        dataFiles: allFoundFiles,
        hasSLA: slaExists,
        slaFileNames: allSlaFileNames,
      });
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleLoadSession();
    }
  };

  const handleDateRangeChange = async (range) => {
    setSelectedDateRange(range);
    const now = new Date();
    let startDate, endDate;

    switch (range) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'yesterday':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
        break;
      case 'last7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'last1month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'last3months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'last6months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'lastyear':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        return; // Don't change dates for custom selection
      default:
        return;
    }

    // Update the date filters
    const newFilters = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };

    setDateFilters(newFilters);

    // Apply filters immediately
    setAvailableSessions([]);
    console.log(`📅 [${range.toUpperCase()}] Applying ${range} filter and refreshing sessions`);
    await fetchSessionsList({
      startDate: newFilters.startDate + 'T00:00:00.000Z',
      endDate: newFilters.endDate + 'T23:59:59.999Z'
    });
  };

  return (
    <Card>
      <CardHeader
        title="Session Information"
        subtitle="Create or load a performance testing session"
      />
      <Divider />
      <CardContent sx={{ p: 3, pb: 4 }}>
        <Grid container spacing={1.5} alignItems="center">
          {/* Date Filter Controls */}
          <Grid item xs={12} sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="subtitle2" sx={{ minWidth: 'fit-content' }}>
                Filter sessions by date:
              </Typography>
              <FormControl size="small" sx={{ minWidth: '180px' }}>
                <InputLabel>Date Range</InputLabel>
                <Select
                  value={selectedDateRange}
                  onChange={(e) => handleDateRangeChange(e.target.value)}
                  label="Date Range"
                >
                  <MenuItem value="today">Today</MenuItem>
                  <MenuItem value="yesterday">Yesterday</MenuItem>
                  <MenuItem value="last7days">Last 7 days</MenuItem>
                  <MenuItem value="last1month">Last 1 month</MenuItem>
                  <MenuItem value="last3months">Last 3 months</MenuItem>
                  <MenuItem value="last6months">Last 6 months</MenuItem>
                  <MenuItem value="lastyear">Last year</MenuItem>
                  <MenuItem value="custom">Custom</MenuItem>
                </Select>
              </FormControl>
              <TextField
                type="date"
                label="Start Date"
                size="small"
                value={dateFilters.startDate}
                onChange={(e) => {
                  setDateFilters(prev => ({ ...prev, startDate: e.target.value }));
                  setSelectedDateRange('custom');
                }}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: '140px' }}
              />
              <TextField
                type="date"
                label="End Date"
                size="small"
                value={dateFilters.endDate}
                onChange={(e) => {
                  setDateFilters(prev => ({ ...prev, endDate: e.target.value }));
                  setSelectedDateRange('custom');
                }}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: '140px' }}
              />
              <Button
                variant="contained"
                size="small"
                color="primary"
                onClick={async () => {
                  console.log('🧪 [APPLY FILTERS] Manual refresh with current filters');
                  console.log('🧪 [APPLY FILTERS] Current date filters:', dateFilters);

                  // Clear sessions to force a fresh fetch with new filters
                  setAvailableSessions([]);
                  setFilterApplied(true);

                  // Fetch with current filters
                  await fetchSessionsList();

                  console.log('✅ [APPLY FILTERS] Filters applied successfully');
                }}
                sx={{ minWidth: 'fit-content' }}
              >
                Apply Filter
              </Button>
            </Box>
          </Grid>

          <Grid item xs={12} sm={5} md={4}>
            <Autocomplete
              key={`autocomplete-${dateFilters.startDate}-${dateFilters.endDate}-${availableSessions.length}`}
              freeSolo
              forcePopupIcon={true}
              options={availableSessions}
              getOptionLabel={(option) => {
                if (typeof option === 'string') return option;
                return option.sessionId || '';
              }}
              inputValue={localSessionId}
              onOpen={async () => {
                console.log('🔓 Autocomplete opened. Loading available sessions with current date filters...');
                console.log('📅 Current date filters:', dateFilters);
                // Always fetch to ensure current date filters are applied
                await fetchSessionsList();
                console.log('📋 Available sessions after filtering:', availableSessions.length);
              }}
              onChange={(event, newValue) => {
                const sessionId = typeof newValue === 'string' ? newValue : newValue?.sessionId || '';
                setLocalSessionId(sessionId);
              }}
              onInputChange={(event, newInputValue) => {
                setLocalSessionId(newInputValue);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Session ID"
                  placeholder="Select or type"
                  helperText={filterApplied ? `Select from list (${availableSessions.length} available)` : `Select from list (${availableSessions.length} available) or enter new ID`}
                  variant="outlined"
                  size="small"
                  disabled={isLoading}
                  onKeyPress={handleKeyPress}
                />
              )}
              renderOption={(props, option) => {
                const isMySession = option.createdByNUID &&
                  currentUserNUID &&
                  option.createdByNUID.toUpperCase() === currentUserNUID.toUpperCase();
                const hasFiles = option.hasFiles || option.fileCount > 0;
                const hasSLA = option.hasSLA;

                console.log('🎨 Rendering option:', {
                  sessionId: option.sessionId,
                  createdByNUID: option.createdByNUID,
                  currentUserNUID,
                  isMySession
                });

                return (
                  <li {...props} key={option.sessionId}>
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1, justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ flexGrow: 1, fontWeight: isMySession ? 600 : 400 }}>
                        {option.sessionId}
                      </Typography>
                      {isMySession ? (
                        <Chip
                          icon={<PersonIcon />}
                          label="Owner"
                          size="small"
                          color="success"
                          sx={{ fontSize: '0.7rem', height: '20px' }}
                        />
                      ) : (
                        <Chip
                          icon={<LockIcon />}
                          label="Read-Only"
                          size="small"
                          color="warning"
                          sx={{ fontSize: '0.7rem', height: '20px' }}
                        />
                      )}
                    </Box>
                  </li>
                );
              }}
              disabled={loading}
              fullWidth
            />
          </Grid>

          <Grid item xs={12} sm={2.4} md={2}>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              size="small"
              onClick={handleLoadSession}
              startIcon={isLoading ? <CircularProgress size={16} /> : <CloudUploadIcon />}
              disabled={loading || isLoading || !currentUserNUID}
            >
              Load
            </Button>
          </Grid>

          <Grid item xs={12} sm={2.3} md={2}>
            <Button
              fullWidth
              variant="outlined"
              color="primary"
              size="small"
              onClick={loadAvailableSessions}
              startIcon={<RefreshIcon />}
              title="Refresh session list from backend"
            >
              Refresh
            </Button>
          </Grid>

          <Grid item xs={12} sm={2.3} md={2}>
            <Button
              fullWidth
              variant="outlined"
              color="error"
              size="small"
              disabled={!localSessionId.trim() || !isOwner}
              onClick={() => setDeleteDialogOpen(true)}
              title={!isOwner ? 'Only the session owner can delete data' : !localSessionId.trim() ? 'Select a session first' : 'Delete session data'}
            >
              Delete
            </Button>
          </Grid>
        </Grid>


        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {loading && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <CircularProgress size={16} sx={{ mr: 1 }} />
            Authenticating user...
          </Alert>
        )}

        {isLoading && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Checking session and existing files...
          </Alert>
        )}
        {deleteResult && (
          <Alert
            severity="success"
            sx={{ mt: 2 }}
            onClose={() => setDeleteResult(null)}
          >
            {deleteResult.message || 'Session data cleared.'}

            {Array.isArray(deleteResult.deleted_blobs) &&
              deleteResult.deleted_blobs.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 'bold', display: 'block' }}
                  >
                    Files removed:
                  </Typography>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {deleteResult.deleted_blobs.slice(0, 6).map((name) => {
                      // show only the filename, not the full path
                      const fileName = name.split('/').pop();
                      return (
                        <li key={name}>
                          <Typography variant="caption">{fileName}</Typography>
                        </li>
                      );
                    })}
                    {deleteResult.deleted_blobs.length > 6 && (
                      <li>
                        <Typography variant="caption">
                          … and {deleteResult.deleted_blobs.length - 6} more
                        </Typography>
                      </li>
                    )}
                  </ul>
                </Box>
              )}
          </Alert>
        )}


        {sessionInfo && (
          <Box sx={{ mt: 3 }}>
            <Alert severity="success">
              ✓ Session loaded: <strong>{sessionInfo.id}</strong>
              {!isOwner && (
                <Chip
                  icon={<LockIcon />}
                  label={sessionInfo.ownerNUID ? 'Read-Only (Not Owner)' : 'Read-Only (Ownership Unavailable)'}
                  size="small"
                  color="warning"
                  sx={{ ml: 2 }}
                />
              )}
              {isOwner && (
                <Chip
                  icon={<PersonIcon />}
                  label="Owner"
                  size="small"
                  color="success"
                  sx={{ ml: 2 }}
                />
              )}
            </Alert>
            <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label={`Status: ${sessionInfo.status}`}
                color="success"
                variant="outlined"
              />
            </Box>

            {/* Report Link - Show if available */}
            {reportUrl && reportUrl.trim() && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Performance Report Available!
                <Button
                  variant="primary"
                  size="large"
                  startIcon={<FileDownloadIcon />}
                  href={reportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    ml: 2,
                    color: 'white !important',
                    '& .MuiButton-startIcon': {
                      color: 'white',
                    },
                  }}
                >
                  Download Report
                </Button>
              </Alert>
            )}

            {/* Existing Files - Always show after session is loaded */}
            <Box
              sx={{
                mt: 3,
                p: 2,
                bgcolor: '#f0f9ff',
                borderRadius: 2,
                border: '1px solid #3b82f6',
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 'bold',
                  mb: 2,
                  color: '#1e40af',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                Existing Files
              </Typography>

              {/* LoadRunner Files */}
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 'bold',
                    color: '#1e40af',
                    display: 'block',
                    mb: 1,
                  }}
                >
                  LoadRunner ({existingFilesBySource.loadrunner.length} / {LOADRUNNER_FILES.length})
                </Typography>
                {existingFilesBySource.loadrunner.length > 0 ? (
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {existingFilesBySource.loadrunner.map((file, idx) => (
                      <Chip
                        key={idx}
                        label={file}
                        size="small"
                        sx={{ bgcolor: 'white', border: '1px solid #3b82f6' }}
                      />
                    ))}
                  </Box>
                ) : (
                  <Typography variant="caption" sx={{ color: '#666', fontStyle: 'italic' }}>
                    No LoadRunner files found in backend
                  </Typography>
                )}
              </Box>

              {/* Dynatrace Files */}
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 'bold',
                    color: '#1e40af',
                    display: 'block',
                    mb: 1,
                  }}
                >
                  Dynatrace ({existingFilesBySource.dynatrace.length} / {DYNATRACE_FILES.length})
                </Typography>
                {existingFilesBySource.dynatrace.length > 0 ? (
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {existingFilesBySource.dynatrace.map((file, idx) => (
                      <Chip
                        key={idx}
                        label={file}
                        size="small"
                        sx={{ bgcolor: 'white', border: '1px solid #3b82f6' }}
                      />
                    ))}
                  </Box>
                ) : (
                  <Typography variant="caption" sx={{ color: '#666', fontStyle: 'italic' }}>
                    No Dynatrace files found in backend
                  </Typography>
                )}
              </Box>

              {/* Azure Files */}
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 'bold',
                    color: '#1e40af',
                    display: 'block',
                    mb: 1,
                  }}
                >
                  Azure ({existingFilesBySource.azure.length})
                </Typography>
                {existingFilesBySource.azure.length > 0 ? (
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {existingFilesBySource.azure.map((file, idx) => (
                      <Chip
                        key={idx}
                        label={file}
                        size="small"
                        sx={{ bgcolor: 'white', border: '1px solid #3b82f6' }}
                      />
                    ))}
                  </Box>
                ) : (
                  <Typography variant="caption" sx={{ color: '#666', fontStyle: 'italic' }}>
                    No Azure files found in backend
                  </Typography>
                )}
              </Box>

              {/* SLA File */}
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 'bold',
                    color: '#1e40af',
                    display: 'block',
                    mb: 1,
                  }}
                >
                  SLA Configuration{' '}
                  {(existingFilesBySource.sla?.length > 0 || slaFileNames.length > 0) &&
                    `(${existingFilesBySource.sla?.length || slaFileNames.length})`}
                </Typography>
                {existingFilesBySource.sla?.length > 0 || slaFileNames.length > 0 ? (
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {(existingFilesBySource.sla?.length > 0
                      ? existingFilesBySource.sla
                      : slaFileNames
                    ).map((file, idx) => (
                      <Chip
                        key={idx}
                        label={file}
                        size="small"
                        sx={{ bgcolor: 'white', border: '1px solid #3b82f6' }}
                      />
                    ))}
                  </Box>
                ) : (
                  <Typography variant="caption" sx={{ color: '#666', fontStyle: 'italic' }}>
                    No SLA configuration found in backend
                  </Typography>
                )}
              </Box>
            </Box>

            {sessionInfo && (
              <Alert severity="success" sx={{ mt: 2 }}>
                {sessionInfo.hasExistingData
                  ? '✓ All files already uploaded! Go to Data Analysis tab and click "Run Analysis" button.'
                  : '✓ Ready to analyze! Go to SLA Configuration tab to upload SLA limits, then proceed to Data Analysis tab.'}
              </Alert>
            )}
          </Box>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Tip: You can use existing session IDs to load previously saved test data and SLA configurations.
        </Typography>
      </CardContent>

      {/* Delete dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Delete Session Data</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Select which data to delete for session <strong>{localSessionId || '(none)'}</strong>.
          </DialogContentText>          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={
                    deleteOptions.loadrunner &&
                    deleteOptions.dynatrace &&
                    deleteOptions.azure &&
                    deleteOptions.sla &&
                    deleteOptions.analysis
                  }
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setDeleteOptions({
                      loadrunner: checked,
                      dynatrace: checked,
                      azure: checked,
                      sla: checked,
                    });
                  }}
                />
              }
              label="All"
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={deleteOptions.loadrunner}
                  onChange={(e) =>
                    setDeleteOptions((prev) => ({ ...prev, loadrunner: e.target.checked }))
                  }
                />
              }
              label="LoadRunner data"
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={deleteOptions.dynatrace}
                  onChange={(e) =>
                    setDeleteOptions((prev) => ({ ...prev, dynatrace: e.target.checked }))
                  }
                />
              }
              label="Dynatrace data"
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={deleteOptions.azure}
                  onChange={(e) =>
                    setDeleteOptions((prev) => ({ ...prev, azure: e.target.checked }))
                  }
                />
              }
              label="Azure data"
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={deleteOptions.sla}
                  onChange={(e) =>
                    setDeleteOptions((prev) => ({ ...prev, sla: e.target.checked }))
                  }
                />
              }
              label="SLA configuration/files"
            />
          </FormGroup>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={!sessionId}
            onClick={async () => {
              const sources = [];
              if (deleteOptions.loadrunner) sources.push('loadrunner');
              if (deleteOptions.dynatrace) sources.push('dynatrace');
              if (deleteOptions.azure) sources.push('azure');

              try {
                if (onClearSession) {
                  const result = await onClearSession({
                    sources: sources.length ? sources : null,
                    deleteSla: deleteOptions.sla,
                  });

                  setDeleteResult(result || null);

                  // Check if all data is being deleted
                  const isDeleteAll = deleteOptions.loadrunner &&
                    deleteOptions.dynatrace &&
                    deleteOptions.azure &&
                    deleteOptions.sla;

                  // If all data is deleted, remove session from localStorage
                  if (isDeleteAll && sessionId) {
                    deleteSession(sessionId);
                    console.log('🗑️ [SESSION REGISTRY] Deleted session from localStorage:', sessionId);
                  }

                  // Optionally refresh existing files after delete
                  if (sessionId) {
                    await checkSessionFiles(sessionId);
                  }
                }
              } catch (e) {
                // error is already handled in parent setError
              }

              setDeleteDialogOpen(false);
            }}
          >
            Delete Selected
          </Button>

        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default SessionInformation;
