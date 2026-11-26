'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  Stack
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  ArrowBack as ArrowBackIcon,
  Dashboard as DashboardIcon
} from '@mui/icons-material';
import { romApiService } from '../clientServices/romApiService';

const SessionModificationPage = ({ sessionId, onClose }) => {
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // FEATURE: Session Modification - Form State
  const [modifications, setModifications] = useState({
    overview: '',
    in_scope: '',
    out_scope: '',
    vendors: '',
    teams: '',
    detailed_rom: '',
    executive_summary: '',
    assumptions: '',
    risks: '',
    technical_details: '',
    general: ''
  });

  const [modificationResults, setModificationResults] = useState(null);

  // Load session data
  useEffect(() => {
    const loadSessionData = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('📊 Loading session data:', sessionId);
        const response = await romApiService.getFinalWorkflowState(sessionId);

        if (response.success && response.workflow_state) {
          setSessionData(response.workflow_state);
          console.log('✅ Session data loaded:', response.workflow_state);
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

  // Handle modification input changes
  const handleModificationChange = (field, value) => {
    setModifications(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Submit modifications
  const handleSubmitModifications = async () => {
    try {
      setSaving(true);
      setError(null);

      // Filter out empty modifications
      const activeModifications = Object.entries(modifications)
        .filter(([key, value]) => value.trim() !== '')
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {});

      if (Object.keys(activeModifications).length === 0) {
        setError('Please provide at least one modification');
        return;
      }

      console.log('📝 Submitting modifications:', activeModifications);

      const modificationRequest = {
        modifications: activeModifications,
        apply_changes: true
      };

      const response = await romApiService.modifyRomSession(sessionId, modificationRequest);

      if (response.success) {
        setModificationResults(response);
        setSuccess('ROM estimates modified successfully!');

        // Reload session data to show changes
        const updatedSession = await romApiService.getFinalWorkflowState(sessionId);
        if (updatedSession.success && updatedSession.workflow_state) {
          setSessionData(updatedSession.workflow_state);
        }

        console.log('✅ Modifications applied successfully:', response);
      } else {
        throw new Error(response.message || 'Failed to modify ROM estimates');
      }
    } catch (err) {
      console.error('❌ Failed to modify session:', err);
      setError('Failed to modify ROM estimates: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Clear all modifications
  const handleClearModifications = () => {
    setModifications({
      vendors: '',
      teams: '',
      detailed_rom: '',
      executive_summary: '',
      general: '',
      overview: '',
      in_scope: '',
      out_scope: '',
      constraints: '',
      assumptions: '',
      risks: ''
    });
    setModificationResults(null);
    setSuccess(null);
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

  if (error && !sessionData) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Button onClick={onClose} sx={{ mt: 2 }}>
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      {/* Header */}
      <Paper elevation={3} sx={{ p: 4, mb: 3, bgcolor: 'primary.50' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h3" component="h1" color="primary" gutterBottom>
              Modify ROM Session
            </Typography>
            <Typography variant="h6" color="text.secondary">
              {sessionData?.input_data?.project_title || 'Unknown Project'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Session ID: {sessionId}
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
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

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      {/* Modification Results */}
      {modificationResults && (
        <Paper elevation={2} sx={{ p: 3, mb: 3, bgcolor: 'success.50' }}>
          <Typography variant="h6" color="success.dark" gutterBottom>
            Modification Results
          </Typography>
          <Typography variant="body1" paragraph>
            {modificationResults.changes_summary}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Status: {modificationResults.updated_status}
          </Typography>
        </Paper>
      )}

      <Box sx={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', pr: 1 }}>
        <Stack spacing={4}>

          {/* Project Overview Section */}
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h5" color="primary" gutterBottom>
              1. Project Overview
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Current Overview:</Typography>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', maxHeight: 200, overflowY: 'auto' }}>
                  <Typography variant="body2">
                    {sessionData?.extracted_details?.overview || 'No overview available'}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Modification Instructions:</Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={6}
                  value={modifications.overview}
                  onChange={(e) => handleModificationChange('overview', e.target.value)}
                  placeholder="e.g., Make the overview more concise, focus on business benefits"
                  variant="outlined"
                />
              </Grid>
            </Grid>
          </Paper>

          {/* Project Scope Section */}
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h5" color="primary" gutterBottom>
              2. Project Scope
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Current Scope:</Typography>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', maxHeight: 250, overflowY: 'auto' }}>
                  {sessionData?.extracted_details?.scope && (
                    <>
                      <Typography variant="subtitle2" color="success.main" gutterBottom>In Scope:</Typography>
                      {sessionData.extracted_details.scope.in_scope?.map((item, index) => (
                        <Typography key={index} variant="body2" sx={{ ml: 1, mb: 0.5 }}>
                          • {item}
                        </Typography>
                      )) || <Typography variant="body2" color="text.secondary">Not specified</Typography>}

                      {sessionData.extracted_details.scope.out_of_scope?.length > 0 && (
                        <>
                          <Typography variant="subtitle2" color="warning.main" gutterBottom sx={{ mt: 2 }}>Out of Scope:</Typography>
                          {sessionData.extracted_details.scope.out_of_scope.map((item, index) => (
                            <Typography key={index} variant="body2" sx={{ ml: 1, mb: 0.5 }}>
                              • {item}
                            </Typography>
                          ))}
                        </>
                      )}
                    </>
                  ) || <Typography variant="body2" color="text.secondary">No scope information available</Typography>}
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Scope Modifications:</Typography>
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label="In-Scope Changes"
                    multiline
                    rows={3}
                    value={modifications.in_scope}
                    onChange={(e) => handleModificationChange('in_scope', e.target.value)}
                    placeholder="e.g., Add mobile app development, Include API integrations"
                  />
                  <TextField
                    fullWidth
                    label="Out-of-Scope Changes"
                    multiline
                    rows={3}
                    value={modifications.out_scope}
                    onChange={(e) => handleModificationChange('out_scope', e.target.value)}
                    placeholder="e.g., Remove third-party integrations, Exclude legacy system support"
                  />
                </Stack>
              </Grid>
            </Grid>
          </Paper>

          {/* Teams & Resources Section */}
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h5" color="primary" gutterBottom>
              3. Teams & Resources
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Current Teams & Resources:</Typography>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', maxHeight: 250, overflowY: 'auto' }}>
                  <Stack spacing={2}>
                    {sessionData?.extracted_details?.application_teams && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>Application Teams:</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {sessionData.extracted_details.application_teams.map((team, index) => (
                            <Chip key={index} label={team} size="small" color="secondary" />
                          ))}
                        </Box>
                      </Box>
                    )}

                    {sessionData?.extracted_details?.vendors && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>Vendors:</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {sessionData.extracted_details.vendors.map((vendor, index) => (
                            <Chip key={index} label={vendor} size="small" color="info" />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Stack>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Teams & Resources Modifications:</Typography>
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label="Teams Changes"
                    multiline
                    rows={2}
                    value={modifications.teams}
                    onChange={(e) => handleModificationChange('teams', e.target.value)}
                    placeholder="e.g., Remove NEDI team, Add DevOps team"
                  />
                  <TextField
                    fullWidth
                    label="Vendors Changes"
                    multiline
                    rows={2}
                    value={modifications.vendors}
                    onChange={(e) => handleModificationChange('vendors', e.target.value)}
                    placeholder="e.g., Remove Verizon, Add Microsoft as vendor"
                  />
                </Stack>
              </Grid>
            </Grid>
          </Paper>

          {/* Assumptions Section */}
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h5" color="primary" gutterBottom>
              4. Assumptions
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Current Assumptions:</Typography>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', maxHeight: 200, overflowY: 'auto' }}>
                  {sessionData?.extracted_details?.assumptions?.map((assumption, index) => (
                    <Typography key={index} variant="body2" paragraph>
                      • {assumption}
                    </Typography>
                  )) || <Typography variant="body2" color="text.secondary">No assumptions available</Typography>}
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Assumptions Modifications:</Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={6}
                  value={modifications.assumptions}
                  onChange={(e) => handleModificationChange('assumptions', e.target.value)}
                  placeholder="e.g., Add cloud migration assumption, Update timeline assumptions"
                  variant="outlined"
                />
              </Grid>
            </Grid>
          </Paper>

          {/* Issues and Risks Section */}
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h5" color="primary" gutterBottom>
              5. Issues and Risks
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Current Issues and Risks:</Typography>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', maxHeight: 200, overflowY: 'auto' }}>
                  {sessionData?.extracted_details?.issues_and_risks?.map((risk, index) => (
                    <Typography key={index} variant="body2" paragraph>
                      • {risk}
                    </Typography>
                  )) || <Typography variant="body2" color="text.secondary">No risks identified</Typography>}
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Risks Modifications:</Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={6}
                  value={modifications.risks}
                  onChange={(e) => handleModificationChange('risks', e.target.value)}
                  placeholder="e.g., Add cybersecurity risks, Remove outdated risks"
                  variant="outlined"
                />
              </Grid>
            </Grid>
          </Paper>

          {/* Technical Details Section */}
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h5" color="primary" gutterBottom>
              6. Technical Details
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Current Technical Details:</Typography>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Typography variant="subtitle2">Deployment Model:</Typography>
                      <Typography variant="body2">{sessionData?.extracted_details?.deployment_model || 'Not specified'}</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="subtitle2">Confidence Level:</Typography>
                      <Typography variant="body2">{sessionData?.extracted_details?.confidence_level || 'Not specified'}</Typography>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Technical Details Modifications:</Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  value={modifications.technical_details}
                  onChange={(e) => handleModificationChange('technical_details', e.target.value)}
                  placeholder="e.g., Change deployment model to cloud-native, Update confidence level"
                  variant="outlined"
                />
              </Grid>
            </Grid>
          </Paper>

          {/* Detailed ROM Section */}
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h5" color="primary" gutterBottom>
              7. Detailed ROM
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Current Detailed ROM:</Typography>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', maxHeight: 300, overflowY: 'auto' }}>
                  {sessionData?.detailed_rom?.items?.map((item, index) => (
                    <Box key={index} sx={{ mb: 2, p: 1, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                      <Typography variant="subtitle2">
                        {item.s_no}. {item.application_team}
                      </Typography>
                      <Typography variant="body2" color="success.main" sx={{ fontWeight: 'bold' }}>
                        Cost: {item.high_level_rom_k}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.estimating_assumptions}
                      </Typography>
                    </Box>
                  )) || <Typography variant="body2" color="text.secondary">No detailed ROM available</Typography>}
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Detailed ROM Modifications:</Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={8}
                  value={modifications.detailed_rom}
                  onChange={(e) => handleModificationChange('detailed_rom', e.target.value)}
                  placeholder="e.g., Remove line item 6, Update NEDI costs to $200K, Add new line item for API development"
                  variant="outlined"
                />
              </Grid>
            </Grid>
          </Paper>

          {/* Summary ROM & Executive Summary Section */}
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h5" color="primary" gutterBottom>
              8. Summary ROM & Executive Summary
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Current Summary:</Typography>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', maxHeight: 250, overflowY: 'auto' }}>
                  <Typography variant="subtitle2" gutterBottom>Total Cost:</Typography>
                  <Typography variant="body1" color="primary" sx={{ fontWeight: 'bold', mb: 2 }}>
                    {sessionData?.summary_rom?.rom_confidence_level || sessionData?.summary_rom?.total_cost || 'Not calculated'}
                  </Typography>
                  <Typography variant="subtitle2" gutterBottom>Executive Summary:</Typography>
                  <Typography variant="body2">
                    {sessionData?.summary_rom?.executive_summary || 'No executive summary available'}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Summary Modifications:</Typography>
                <TextField
                  fullWidth
                  label="Executive Summary Changes"
                  multiline
                  rows={6}
                  value={modifications.executive_summary}
                  onChange={(e) => handleModificationChange('executive_summary', e.target.value)}
                  placeholder="e.g., Make it more concise, focus on business value, add ROI information"
                  sx={{ mb: 2 }}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* General Modifications Section */}
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h5" color="primary" gutterBottom>
              9. General Modifications
            </Typography>
            <TextField
              fullWidth
              label="General Instructions"
              multiline
              rows={4}
              value={modifications.general}
              onChange={(e) => handleModificationChange('general', e.target.value)}
              placeholder="e.g., Format all costs with 2 decimal places and M/K notation, improve overall readability, add disclaimers"
              variant="outlined"
            />
          </Paper>

          {/* Action Buttons */}
          <Paper elevation={3} sx={{ p: 3, bgcolor: 'primary.50', position: 'sticky', bottom: 0, zIndex: 1 }}>
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button
                variant="contained"
                size="large"
                startIcon={<SaveIcon />}
                onClick={handleSubmitModifications}
                disabled={saving}
                sx={{ minWidth: 200 }}
              >
                {saving ? 'Applying Changes...' : 'Apply All Modifications'}
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={handleClearModifications}
                disabled={saving}
                sx={{ minWidth: 150 }}
              >
                Clear All
              </Button>
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </Box>
  );
};

export default SessionModificationPage;