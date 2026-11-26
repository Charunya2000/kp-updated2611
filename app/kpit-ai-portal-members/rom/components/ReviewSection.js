'use client';

import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  Grid,
  Card,
  CardContent,
  Divider,
  Chip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Autocomplete,
  FormControlLabel,
  Switch,
  Collapse
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Edit as EditIcon,
  RateReview as ReviewIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { formatROMValue, parseK, formatUSDFromK, formatUSD } from '../utils/formatters';

const ReviewSection = ({ reviewData, reviewType, onSubmit, isLoading, currentStatus }) => {
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState({});  
  const [sectionFeedbacks, setSectionFeedbacks] = useState({});
  const [editDialogs, setEditDialogs] = useState({});
  
  // Initialize edited data when component mounts or reviewData changes
  useEffect(() => {
    if (reviewData) {
      setEditedData(JSON.parse(JSON.stringify(reviewData))); // Deep copy
    }
  }, [reviewData]);

  const handleApprove = () => {
    onSubmit({ approved: true, feedback: 'looks great proceed' });
    setFeedback('');
    setShowFeedback(false);
    setSectionFeedbacks({});
  };

  const handleRequestChanges = () => {
    // Use only general feedback for cleaner UI
    if (!feedback.trim()) {
      alert('Please provide feedback for the revision request.');
      return;
    }
    
    onSubmit({ approved: false, feedback: feedback.trim() });
    setFeedback('');
    setShowFeedback(false);
  };

  // DISABLED: Simplified to only use general feedback
  const compileFeedback = () => {
    return feedback.trim();
    
    // Commented out section-specific feedback compilation
    /*
    let compiledFeedback = [];
    
    // Add general feedback if provided
    if (feedback.trim()) {
      compiledFeedback.push(`General Feedback: ${feedback.trim()}`);
    }
    
    // Add section-specific feedbacks
    Object.entries(sectionFeedbacks).forEach(([section, sectionFeedback]) => {
      if (sectionFeedback.trim()) {
        const sectionTitle = getSectionTitle(section);
        compiledFeedback.push(`${sectionTitle}: ${sectionFeedback.trim()}`);
      }
    });
    
    return compiledFeedback.join('\n\n');
    */
  };

  const getSectionTitle = (section) => {
    const titles = {
      overview: 'Project Overview',
      scope: 'Project Scope',
      teams: 'Teams & Resources',
      assumptions: 'Key Assumptions',
      risks: 'Issues and Risks',
      technical: 'Technical Details',
      totalCost: 'Total Project Cost',
      costBreakdown: 'Cost Breakdown',
      projectDetails: 'Project Details',
      teamsInvolved: 'Teams Involved'
    };
    return titles[section] || section;
  };

  const addSectionFeedback = (section, feedbackText) => {
    setSectionFeedbacks(prev => ({
      ...prev,
      [section]: feedbackText
    }));
  };

  const openEditDialog = (section) => {
    setEditDialogs(prev => ({ ...prev, [section]: true }));
  };

  const closeEditDialog = (section) => {
    setEditDialogs(prev => ({ ...prev, [section]: false }));
  };

  const handleArrayEdit = (path, newArray) => {
    setEditedData(prev => {
      const updated = { ...prev };
      const pathParts = path.split('.');
      let current = updated;
      
      for (let i = 0; i < pathParts.length - 1; i++) {
        if (!current[pathParts[i]]) current[pathParts[i]] = {};
        current = current[pathParts[i]];
      }
      
      current[pathParts[pathParts.length - 1]] = newArray;
      return updated;
    });
  };

  const handleTextEdit = (path, newValue) => {
    setEditedData(prev => {
      const updated = { ...prev };
      const pathParts = path.split('.');
      let current = updated;
      
      for (let i = 0; i < pathParts.length - 1; i++) {
        if (!current[pathParts[i]]) current[pathParts[i]] = {};
        current = current[pathParts[i]];
      }
      
      current[pathParts[pathParts.length - 1]] = newValue;
      return updated;
    });
  };

  // Editable components - DISABLED for cleaner UI
  const EditableText = ({ value, path, multiline = false, rows = 1 }) => {
    const [editing, setEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value || '');

    const handleSave = () => {
      handleTextEdit(path, tempValue);
      setEditing(false);
    };

    const handleCancel = () => {
      setTempValue(value || '');
      setEditing(false);
    };

    // DISABLED: Just show the text without edit capability for cleaner UI
    return (
      <Typography variant="body1" paragraph>
        {value || 'Not specified'}
      </Typography>
    );

    // Commented out editing functionality - can be re-enabled later
    /*
    if (editing) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <TextField
            fullWidth
            multiline={multiline}
            rows={rows}
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            size="small"
          />
          <IconButton size="small" onClick={handleSave} color="primary">
            <SaveIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={handleCancel}>
            <CancelIcon fontSize="small" />
          </IconButton>
        </Box>
      );
    }

    return (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minHeight: 24 }}>
        <Typography variant="body1" sx={{ flex: 1 }}>
          {value || 'Not specified'}
        </Typography>
        <IconButton size="small" onClick={() => setEditing(true)}>
          <EditIcon fontSize="small" />
        </IconButton>
      </Box>
    );
    */
  };

  const EditableChipArray = ({ values, path, suggestions = [] }) => {
    const [editing, setEditing] = useState(false);
    const [tempValues, setTempValues] = useState(values || []);
    const [newValue, setNewValue] = useState('');

    const handleSave = () => {
      handleArrayEdit(path, tempValues);
      setEditing(false);
    };

    const handleCancel = () => {
      setTempValues(values || []);
      setEditing(false);
    };

    const addValue = () => {
      if (newValue.trim() && !tempValues.includes(newValue.trim())) {
        setTempValues([...tempValues, newValue.trim()]);
        setNewValue('');
      }
    };

    const removeValue = (index) => {
      setTempValues(tempValues.filter((_, i) => i !== index));
    };

    // DISABLED: Just show the chips without edit capability for cleaner UI
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {(values || []).map((value, index) => (
          <Chip key={index} label={value} size="small" color="primary" />
        )) || <Typography variant="body2">Not specified</Typography>}
      </Box>
    );

    // Commented out editing functionality - can be re-enabled later
    /*
    if (editing) {
      return (
        <Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
            {tempValues.map((value, index) => (
              <Chip
                key={index}
                label={value}
                onDelete={() => removeValue(index)}
                size="small"
                color="primary"
              />
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              size="small"
              placeholder="Add new item..."
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addValue()}
            />
            <Button size="small" onClick={addValue}>Add</Button>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" variant="contained" onClick={handleSave}>Save</Button>
            <Button size="small" onClick={handleCancel}>Cancel</Button>
          </Box>
        </Box>
      );
    }

    return (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, flex: 1 }}>
          {(values || []).map((value, index) => (
            <Chip key={index} label={value} size="small" color="primary" />
          )) || <Typography variant="body2">Not specified</Typography>}
        </Box>
        <IconButton size="small" onClick={() => setEditing(true)}>
          <EditIcon fontSize="small" />
        </IconButton>
      </Box>
    );
    */
  };

  // DISABLED: Section feedback for cleaner UI - only general feedback now
  const SectionFeedback = ({ section, title }) => {
    // Component disabled - return null to not render anything
    return null;

    // Commented out section feedback functionality - can be re-enabled later
    /*
    const [feedbackText, setFeedbackText] = useState(sectionFeedbacks[section] || '');
    const [showFeedbackBox, setShowFeedbackBox] = useState(false);

    const handleSaveFeedback = () => {
      addSectionFeedback(section, feedbackText);
      setShowFeedbackBox(false);
    };

    return (
      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle2" color="primary">
            {title} Feedback
          </Typography>
          <Button
            size="small"
            onClick={() => setShowFeedbackBox(!showFeedbackBox)}
            startIcon={<AddIcon />}
          >
            Add Feedback
          </Button>
        </Box>
        
        <Collapse in={showFeedbackBox}>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              multiline
              rows={3}
              placeholder={`Provide feedback for ${title}...`}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              sx={{ mb: 2 }}
            />
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button size="small" onClick={() => setShowFeedbackBox(false)}>
                Cancel
              </Button>
              <Button 
                size="small" 
                variant="contained" 
                onClick={handleSaveFeedback}
                disabled={!feedbackText.trim()}
              >
                Save Feedback
              </Button>
            </Stack>
          </Box>
        </Collapse>
        
        {sectionFeedbacks[section] && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">{sectionFeedbacks[section]}</Typography>
          </Alert>
        )}
      </Box>
    );
    */
  };

  const renderDetailsReview = () => {
    const details = editedData.extracted_details || reviewData.extracted_details;
    
    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
          Extracted Project Details
        </Typography>

        {reviewData.extraction_quality && !reviewData.extraction_quality.is_sufficient && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              {reviewData.extraction_quality.message}
            </Typography>
            {reviewData.extraction_quality.guidance && (
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                {reviewData.extraction_quality.guidance}
              </Typography>
            )}
          </Alert>
        )}

        {/* Show backend warning_message (e.g. fallback extraction notice) */}
        {reviewData.warning_message && (
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              {reviewData.warning_message}
            </Typography>
          </Alert>
        )}
        
        <Grid container spacing={3}>
          {/* Overview */}
          <Grid item xs={12}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
                  Project Overview
                </Typography>
                <EditableText 
                  value={details.overview} 
                  path="extracted_details.overview" 
                  multiline 
                  rows={3} 
                />
                
                {details.overview_details && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Initiative:
                    </Typography>
                    <EditableText 
                      value={details.overview_details?.initiative} 
                      path="extracted_details.overview_details.initiative" 
                      multiline 
                      rows={2} 
                    />
                    
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
                      Narrative:
                    </Typography>
                    <EditableText 
                      value={details.overview_details?.narrative} 
                      path="extracted_details.overview_details.narrative" 
                      multiline 
                      rows={3} 
                    />
                  </Box>
                )}
              </CardContent>
              <SectionFeedback section="overview" title="Project Overview" />
            </Card>
          </Grid>

          {/* Scope */}
          <Grid item xs={12} md={6}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
                  Project Scope
                </Typography>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" color="success.main" gutterBottom>
                    In Scope:
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {details.scope?.in_scope?.map((item, index) => (
                      <Typography key={index} variant="body2" sx={{ display: 'flex', alignItems: 'flex-start' }}>
                        <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main', mr: 1, mt: 0.3 }} />
                        {item}
                      </Typography>
                    )) || <Typography color="text.secondary">Not specified</Typography>}
                  </Box>
                </Box>
                
                {details.scope?.out_of_scope?.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" color="warning.main" gutterBottom>
                      Out of Scope:
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {details.scope.out_of_scope.map((item, index) => (
                        <Typography key={index} variant="body2" sx={{ display: 'flex', alignItems: 'flex-start' }}>
                          <span style={{ color: '#f57c00', marginRight: 8 }}>×</span>
                          {item}
                        </Typography>
                      ))}
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Teams and Resources */}
          <Grid item xs={12} md={6}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
                  Teams & Resources
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Application Teams:
                  </Typography>
                  <EditableChipArray 
                    values={details.application_teams} 
                    path="extracted_details.application_teams" 
                  />
                </Box>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Vendors:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {details.vendors?.map((vendor, index) => (
                      <Chip key={index} label={vendor} size="small" color="info" />
                    )) || <Typography variant="body2">Not specified</Typography>}
                  </Box>
                </Box>
                
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Markets:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {details.markets?.map((market, index) => (
                      <Chip key={index} label={market} size="small" variant="outlined" />
                    )) || <Typography variant="body2">Not specified</Typography>}
                  </Box>
                </Box>
              </CardContent>
              <SectionFeedback section="teams" title="Teams & Resources" />
            </Card>
          </Grid>

          {/* Assumptions */}
          <Grid item xs={12} md={6}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
                  Key Assumptions
                </Typography>
                <EditableChipArray 
                  values={details.assumptions} 
                  path="extracted_details.assumptions" 
                />
              </CardContent>
              <SectionFeedback section="assumptions" title="Key Assumptions" />
            </Card>
          </Grid>

          {/* Risks */}
          <Grid item xs={12} md={6}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
                  Issues and Risks
                </Typography>
                <EditableChipArray 
                  values={details.issues_and_risks} 
                  path="extracted_details.issues_and_risks" 
                />
              </CardContent>
              <SectionFeedback section="risks" title="Issues and Risks" />
            </Card>
          </Grid>

          {/* Technical Details */}
          <Grid item xs={12}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
                  Technical Details
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Deployment Model:
                    </Typography>
                    <EditableText 
                      value={details.deployment_model} 
                      path="extracted_details.deployment_model" 
                    />
                  </Grid>
                  {/* Confidence Level removed - already defined at project beginning */}
                </Grid>
              </CardContent>
              <SectionFeedback section="technical" title="Technical Details" />
            </Card>
          </Grid>
        </Grid>
      </Box>
    );
  };

  const renderDetailedRomReview = () => {
    const rom = editedData.detailed_rom || reviewData.detailed_rom;
    
    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
          Detailed ROM Estimate
        </Typography>
        
        <Grid container spacing={3}>
          {/* Total Cost Summary - REMOVED as it's already shown in Summary ROM above */}

          {/* Cost Breakdown by Team */}
          <Grid item xs={12}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
                  Cost Breakdown by Application Team
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {rom.items?.map((item, index) => (
                    <Card key={index} variant="outlined" sx={{ p: 2 }}>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={3}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                            {item.application_team}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <Typography variant="h6" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                            {(() => {
                              const value = parseK(item.high_level_rom_k);
                              // If value is > 10000, it's already a full amount, otherwise it's K
                              return value > 10000 ? formatUSD(value) : formatUSDFromK(value);
                            })()}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="text.secondary">
                            <strong>Assumptions:</strong> {item.estimating_assumptions}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Card>
                  )) || <Typography color="text.secondary">No cost breakdown available</Typography>}

                  {/* ── Total estimate row ── */}
                  {rom.items?.length > 0 && (() => {
                    // Normalise every line item to K, then sum
                    const totalK = rom.items.reduce((sum, item) => {
                      const v = parseK(item.high_level_rom_k);
                      return sum + (v > 10000 ? v / 1000 : v);
                    }, 0);
                    const label = totalK >= 1000
                      ? `$${(totalK / 1000).toFixed(2).replace(/\.?0+$/, '')}M`
                      : `$${Math.round(totalK)}K`;
                    return (
                      <Box sx={{
                        mt: 1,
                        p: 2,
                        borderTop: '2px solid',
                        borderColor: 'primary.main',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        bgcolor: 'primary.50',
                        borderRadius: 1,
                      }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                          Total ROM Estimate
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                          {label}
                        </Typography>
                      </Box>
                    );
                  })()}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Project Details Summary */}
          {reviewData.extracted_details && (
            <Grid item xs={12}>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
                    Project Context
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Project Title:
                      </Typography>
                      <Typography variant="body2" paragraph>
                        {reviewData.project_title || 'Not specified'}
                      </Typography>
                      
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Confidence Level:
                      </Typography>
                      <Typography variant="body2">
                        {reviewData.extracted_details.confidence_level || 'Not specified'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Deployment Model:
                      </Typography>
                      <Typography variant="body2" paragraph>
                        {reviewData.extracted_details.deployment_model || 'Not specified'}
                      </Typography>
                      
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Markets:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {reviewData.extracted_details.markets?.map((market, index) => (
                          <Chip key={index} label={market} size="small" variant="outlined" />
                        )) || <Typography variant="body2">Not specified</Typography>}
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Teams Involved */}
          {reviewData.extracted_details && (
            <Grid item xs={12}>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
                    Teams Involved in Estimate
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Application Teams:
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {reviewData.extracted_details.application_teams?.map((team, index) => (
                          <Typography key={index} variant="body2">• {team}</Typography>
                        )) || <Typography variant="body2">Not specified</Typography>}
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Vendors:
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {reviewData.extracted_details.vendors?.map((vendor, index) => (
                          <Typography key={index} variant="body2">• {vendor}</Typography>
                        )) || <Typography variant="body2">Not specified</Typography>}
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </Box>
    );
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      {/* Fixed Header */}
      <Paper elevation={3} sx={{ p: 4, mb: 3, position: 'sticky', top: 0, zIndex: 100 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <ReviewIcon sx={{ mr: 2, fontSize: 32, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
              Review {reviewType === 'details' ? 'Extracted Details' : 'ROM Estimate'}
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Please review the {reviewType === 'details' ? 'extracted project details' : 'generated ROM estimate'} and provide your approval or feedback
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Main Content */}
      <Box sx={{ px: 3, pb: showFeedback ? 32 : 20 }}>
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
          {/* Render content based on review type */}
          {reviewType === 'details' ? renderDetailsReview() : renderDetailedRomReview()}

          <Divider sx={{ my: 4 }} />

          {/* Help Text */}
          <Alert severity="info" sx={{ mb: 4 }}>
            <Typography variant="body2">
              <strong>Approve:</strong> The information looks correct and you're ready to proceed to the next step.
              <br />
              <strong>Request Changes:</strong> Something needs to be modified or clarified before proceeding.
            </Typography>
          </Alert>
        </Box>
      </Box>

      {/* Action Buttons - Fixed at Bottom with proper spacing */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          p: 2,
          zIndex: 1000,
          boxShadow: '0 -2px 12px rgba(0,0,0,0.08)'
        }}
      >
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
          <Stack direction="row" spacing={3} justifyContent="center">
            <Button
              variant="contained"
              color="success"
              size="large"
              onClick={handleApprove}
              disabled={isLoading}
              sx={{
                minWidth: 200,
                py: 2.5,
                px: 4,
                fontSize: '1.1rem',
                fontWeight: 'bold',
                borderRadius: 2,
                textTransform: 'none',
                boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)',
                '&:hover': {
                  boxShadow: '0 6px 20px rgba(76, 175, 80, 0.4)',
                  transform: 'translateY(-2px)'
                },
                '&:disabled': {
                  backgroundColor: 'grey.300'
                },
                transition: 'all 0.3s ease'
              }}
            >
              {currentStatus === 'final_summary_generated' ? 'Download Results' : 'Approve & Continue'}
            </Button>
            
            {currentStatus !== 'final_summary_generated' && (
              <Button
                variant="outlined"
                color="warning"
                size="large"
                onClick={() => setShowFeedback(!showFeedback)}
                disabled={isLoading}
                sx={{
                  minWidth: 200,
                  py: 2.5,
                  px: 4,
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  borderRadius: 2,
                  textTransform: 'none',
                  borderWidth: 2,
                  color: 'warning.main',
                  borderColor: 'warning.main',
                  '&:hover': {
                    borderWidth: 2,
                    backgroundColor: 'warning.50',
                    borderColor: 'warning.dark',
                    transform: 'translateY(-2px)'
                  },
                  '&:disabled': {
                    borderColor: 'grey.300',
                    color: 'grey.400'
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                Request Changes
              </Button>
            )}
          </Stack>

          {/* Feedback Section - Compact and User-Friendly */}
          {showFeedback && (
            <Collapse in={showFeedback}>
              <Box sx={{ 
                mt: 3, 
                p: 3, 
                bgcolor: 'warning.50', 
                borderRadius: 2, 
                border: '1px solid', 
                borderColor: 'warning.200',
                maxHeight: '400px',
                overflow: 'auto'
              }}>
                <Typography variant="h6" sx={{ mb: 2, color: 'warning.dark', fontWeight: 'bold' }}>
                  🔄 Request Changes
                </Typography>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Please describe what needs to be changed or corrected:
                </Typography>

                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Your Feedback"
                  placeholder="Please describe what needs to be changed or corrected..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  variant="outlined"
                  size="small"
                  sx={{ 
                    mb: 2,
                    '& .MuiOutlinedInput-root': { 
                      backgroundColor: 'white' 
                    }
                  }}
                />
                
                <Stack direction="row" spacing={2} justifyContent="flex-end">
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setShowFeedback(false);
                      setFeedback('');
                    }}
                    disabled={isLoading}
                    sx={{ 
                      textTransform: 'none',
                      borderRadius: 1.5
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    color="warning"
                    size="small"
                    onClick={handleRequestChanges}
                    disabled={isLoading || !feedback.trim()}
                    sx={{ 
                      fontWeight: 'bold',
                      textTransform: 'none',
                      borderRadius: 1.5,
                      px: 3
                    }}
                  >
                    Submit Feedback
                  </Button>
                </Stack>
              </Box>
            </Collapse>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default ReviewSection;