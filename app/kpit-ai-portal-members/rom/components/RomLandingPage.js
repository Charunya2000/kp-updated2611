'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Grid,
  TextField,
  InputAdornment,
  IconButton,
  CircularProgress,
  Alert,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Add as AddIcon,
  History as HistoryIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Visibility as DisplayIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { romApiService } from '../clientServices/romApiService';

// FEATURE: Recent Estimates Table - Helper Functions
// Utility function to format date strings properly
const formatDate = (dateString) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Date formatting error:', error);
    return 'Invalid Date';
  }
};

// Utility function to truncate session ID for display
const formatSessionId = (sessionId) => {
  return sessionId ? `${sessionId.substring(0, 8)}...` : 'N/A';
};

// Component for ROM Estimator landing page
const RomLandingPage = ({ onStartNewEstimate }) => {
  // FEATURE: Recent Estimates Table - State Management
  const [recentSessions, setRecentSessions] = useState([]);
  const [filteredSessions, setFilteredSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(false);

  // FEATURE: Session Management - Context Menu State
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);

  // FEATURE: Recent Estimates Table - API Integration
  // Function to fetch recent sessions from the backend API
  const fetchRecentSessions = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      console.log('🔄 ROM Landing Page: Fetching recent sessions...');
      const sessions = await romApiService.getRecentSessions();

      // Sort by updated_at (most recent first) - limit to 15 by default
      const sortedSessions = sessions
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
        .slice(0, 30);

      console.log('✅ ROM Landing Page: Sessions loaded:', sortedSessions.length);
      setRecentSessions(sortedSessions);
      setFilteredSessions(sortedSessions);
    } catch (err) {
      console.error('❌ ROM Landing Page: Failed to fetch recent sessions:', err);
      setError('Failed to load recent estimates. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // FEATURE: Recent Estimates Table - Search Functionality
  // Function to filter sessions based on project title search
  const handleSearch = (searchValue) => {
    setSearchTerm(searchValue);
    if (!searchValue.trim()) {
      setFilteredSessions(recentSessions);
    } else {
      const filtered = recentSessions.filter(session =>
        session.project_title.toLowerCase().includes(searchValue.toLowerCase())
      );
      setFilteredSessions(filtered);
      console.log(`🔍 ROM Landing Page: Search filtered ${filtered.length} results for "${searchValue}"`);
    }
  };

  // FEATURE: Recent Estimates Table - Clear Search
  const handleClearSearch = () => {
    setSearchTerm('');
    setFilteredSessions(recentSessions);
    console.log('🔄 ROM Landing Page: Search cleared');
  };

  // FEATURE: Session Management - Context Menu Handlers
  const handleContextMenu = (event, session) => {
    event.preventDefault();
    setSelectedSession(session);
    setContextMenu(
      contextMenu === null
        ? {
          mouseX: event.clientX + 2,
          mouseY: event.clientY - 6,
        }
        : null,
    );
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
    setSelectedSession(null);
  };

  // FEATURE: Session Management - Delete Session
  const handleDeleteSession = async () => {
    if (!selectedSession) return;

    try {
      console.log('🗑️ ROM Landing Page: Deleting session:', selectedSession.session_id);
      await romApiService.deleteSession(selectedSession.session_id);

      // Refresh the sessions list
      await fetchRecentSessions(true);

      console.log('✅ ROM Landing Page: Session deleted successfully');
      // You could add a success notification here
    } catch (error) {
      console.error('❌ ROM Landing Page: Failed to delete session:', error);
      setError('Failed to delete session: ' + error.message);
    } finally {
      handleCloseContextMenu();
    }
  };

  // FEATURE: Session Management - Modify Session
  const handleModifySession = () => {
    if (!selectedSession) return;

    console.log('✏️ ROM Landing Page: Modify session:', selectedSession.session_id);
    // Open modify page in new tab/window
    const modifyUrl = `/kpit-ai-portal-members/rom/modify/${selectedSession.session_id}`;
    console.log('🔗 Opening modify URL:', modifyUrl);
    window.open(modifyUrl, '_blank');
    handleCloseContextMenu();
  };

  // FEATURE: Session Management - Display Session
  const handleDisplaySession = () => {
    if (!selectedSession) return;

    console.log('👁️ ROM Landing Page: Display session:', selectedSession.session_id);
    // Open display page in new tab/window
    const displayUrl = `/kpit-ai-portal-members/rom/display/${selectedSession.session_id}`;
    console.log('🔗 Opening display URL:', displayUrl);
    window.open(displayUrl, '_blank');
    handleCloseContextMenu();
  };

  // FEATURE: Recent Estimates Table - Row Click Handler
  const handleRowClick = (sessionId) => {
    console.log('🔗 ROM Landing Page: Navigate to session:', sessionId);
    // For now, just display the session
    const session = filteredSessions.find(s => s.session_id === sessionId);
    if (session) {
      const displayUrl = `/kpit-ai-portal-members/rom/display/${sessionId}`;
      console.log('🔗 Opening display URL from row click:', displayUrl);
      window.open(displayUrl, '_blank');
    }
  };

  // FEATURE: Recent Estimates Table - Load Data on Mount
  // Load recent sessions when component mounts
  useEffect(() => {
    console.log('🚀 ROM Landing Page: Component mounted, loading recent sessions');
    fetchRecentSessions();
  }, []);

  return (
    <Box sx={{ width: '100%' }}>
      {/* Hero Section */}
      <Paper
        elevation={3}
        sx={{
          p: 6,
          mb: 4,
          textAlign: 'center',
          borderRadius: 2,
          background: 'linear-gradient(120deg, #e0f7fa 0%, #bbdefb 100%)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
          ROM Estimator
        </Typography>
        <Typography variant="h6" sx={{ mb: 4, maxWidth: 800, mx: 'auto' }}>
          Generate comprehensive Rough Order of Magnitude estimates
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button
            variant="contained"
            size="large"
            onClick={onStartNewEstimate}
            startIcon={<AddIcon />}
            sx={{
              py: 1.5,
              px: 4,
              fontSize: '1.1rem',
              boxShadow: 3,
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: 6
              },
              transition: 'all 0.3s ease'
            }}
          >
            Create New Estimate
          </Button>

        </Box>
      </Paper>

      <Grid container spacing={4}>
        {/* FEATURE: Recent Estimates Section - Enhanced with API Integration */}
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 3, mb: 4, borderRadius: 2 }}>
            {/* Header Section with Title and Refresh Button */}
            <Box sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 3
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <HistoryIcon sx={{ mr: 2, color: 'primary.main', fontSize: 28 }} />
                <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold' }}>
                  Recent Estimates
                </Typography>
                {/* Results Count Chip */}
                {filteredSessions.length < recentSessions.length && (
                  <Chip
                    label={`${filteredSessions.length} of ${recentSessions.length}`}
                    size="small"
                    sx={{ ml: 2 }}
                  />
                )}
              </Box>

              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                {/* View All Toggle Button */}
                {recentSessions.length > 15 && (
                  <Button
                    size="small"
                    variant={showAllSessions ? 'contained' : 'outlined'}
                    onClick={() => setShowAllSessions(!showAllSessions)}
                    sx={{ textTransform: 'none' }}
                  >
                    {showAllSessions ? 'Show Less' : 'View All'}
                  </Button>
                )}

                {/* Refresh Button */}
                <IconButton
                  onClick={() => fetchRecentSessions(true)}
                  disabled={refreshing}
                  size="small"
                  title="Refresh recent estimates"
                  sx={{
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': { bgcolor: 'primary.dark' },
                    '&:disabled': { bgcolor: 'grey.300' }
                  }}
                >
                  {refreshing ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <RefreshIcon />
                  )}
                </IconButton>
              </Box>
            </Box>

            {/* Search Bar */}
            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search by project title..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: searchTerm && (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="clear search"
                        onClick={handleClearSearch}
                        edge="end"
                        size="small"
                        title="Clear search"
                      >
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{ maxWidth: 400 }}
              />
            </Box>

            {/* Error Display */}
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            {/* Loading State */}
            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
                <Typography variant="body2" sx={{ ml: 2, alignSelf: 'center' }}>
                  Loading recent estimates...
                </Typography>
              </Box>
            )}

            {/* Recent Estimates Table */}
            {!loading && (
              <TableContainer sx={{ maxHeight: showAllSessions ? 600 : 'auto', overflow: showAllSessions ? 'auto' : 'visible' }}>
                <Table sx={{ minWidth: 650 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Project Title</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Updated At</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: 50 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredSessions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                          <Typography variant="body2" color="text.secondary">
                            {searchTerm ? 'No projects found matching your search.' : 'No recent estimates found.'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      (showAllSessions ? filteredSessions : filteredSessions.slice(0, 15)).map((session) => (
                        <TableRow
                          key={session.session_id}
                          onClick={() => handleRowClick(session.session_id)}
                          onContextMenu={(event) => handleContextMenu(event, session)}
                          sx={{
                            '&:hover': {
                              bgcolor: 'action.hover',
                              cursor: 'pointer'
                            },
                            transition: 'background-color 0.2s ease'
                          }}
                        >
                          <TableCell sx={{ fontWeight: 500 }}>
                            {session.project_title || 'Untitled Project'}
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>
                            {formatDate(session.updated_at)}
                          </TableCell>
                          <TableCell sx={{ width: 50, textAlign: 'center' }}>
                            <IconButton
                              size="small"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleContextMenu(event, session);
                              }}
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>

        {/* No sidebar content - removed ROM Statistics and Quick Links */}
      </Grid>

      {/* FEATURE: Session Management - Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleDisplaySession}>
          <ListItemIcon>
            <DisplayIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Display</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDeleteSession} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default RomLandingPage;