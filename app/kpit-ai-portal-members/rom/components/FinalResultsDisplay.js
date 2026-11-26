'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Divider,
  Stack,
  IconButton,
  Collapse,
  TextField,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Download as DownloadIcon,
  Dashboard as DashboardIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  KeyboardArrowDown as ArrowDownIcon,
  KeyboardArrowUp as ArrowUpIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { formatROMValue, parseK, formatUSDFromK, formatUSD } from '../utils/formatters';
import excelUtils from '../../../services/excelUtilsService';

const { createWorkbook, arrayToWorksheet, getWorkbookBuffer } = excelUtils;
const FinalResultsDisplay = ({
  workflowData,
  onDownload,
  onStartNew,
  onGoToDashboard
}) => {
  const router = useRouter();
  const [showExtractedDetails, setShowExtractedDetails] = useState(false);

  // Edit state management
  const [editingSection, setEditingSection] = useState(null); // 'summary', 'detailed', 'extracted'
  const [originalData, setOriginalData] = useState({
    summary_rom: workflowData?.summary_rom,
    detailed_rom: workflowData?.detailed_rom,
    extracted_details: workflowData?.extracted_details
  });
  const [draftData, setDraftData] = useState({
    summary_rom: workflowData?.summary_rom,
    detailed_rom: workflowData?.detailed_rom,
    extracted_details: workflowData?.extracted_details
  });
  const [isSaving, setIsSaving] = useState({});
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);

  // Calculate initial total from detailed ROM items
  // Backend returns full amounts (95000) not K values (95)
  const calculateTotalFromItems = (items) => {
    if (!items || items.length === 0) return null;
    const total = items.reduce((sum, item) => {
      const value = parseK(item.high_level_rom_k);
      // If value > 10000, it's already a full amount, otherwise it's a K value
      return sum + (value > 10000 ? value : value * 1000);
    }, 0);
    return total;
  };

  const initialTotal = calculateTotalFromItems(workflowData?.detailed_rom?.items);
  const [recalculatedTotal, setRecalculatedTotal] = useState(null);

  const summaryRom = editingSection === 'summary' ? draftData.summary_rom : originalData.summary_rom;
  const detailedRom = editingSection === 'detailed' ? draftData.detailed_rom : originalData.detailed_rom;
  const extractedDetails = editingSection === 'extracted' ? draftData.extracted_details : originalData.extracted_details;

  // Calculate current total from whatever data is being displayed (draft or original)
  const currentTotal = editingSection === 'detailed'
    ? calculateTotalFromItems(draftData.detailed_rom.items)
    : (recalculatedTotal || initialTotal);
  const projectTitle = workflowData?.input_data?.project_title || 'Unknown Project';
  const sessionId = workflowData?.session_id;

  const splitSummaryAndLineage = (summaryRomObj) => {
    if (!summaryRomObj) {
      return { summaryText: '', lineageText: '' };
    }

    // NEW: Check for dedicated estimate_lineage field first (newer ROMs)
    if (summaryRomObj.estimate_lineage) {
      return {
        summaryText: summaryRomObj.executive_summary?.trim() || '',
        lineageText: summaryRomObj.estimate_lineage.trim(),
      };
    }

    // FALLBACK: For older ROMs, try splitting executive_summary at marker
    const text = summaryRomObj.executive_summary;
    if (!text || typeof text !== 'string') {
      return { summaryText: '', lineageText: '' };
    }

    const marker = '### Estimate Lineage';
    const markerIndex = text.indexOf(marker);

    if (markerIndex === -1) {
      return { summaryText: text.trim(), lineageText: '' };
    }

    return {
      summaryText: text.slice(0, markerIndex).trim(),
      lineageText: text.slice(markerIndex).trim(),
    };
  };

  const { summaryText, lineageText } = splitSummaryAndLineage(summaryRom);

  // API call for PUT /rom-edit/{session_id}
  const callRomEditAPI = async (payload) => {
    const response = await fetch(`/api/rom/rom-edit/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      mode: 'cors',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  };

  // Section edit handlers
  const startEditingSection = (section) => {
    setEditingSection(section);
    setSaveError(null);
    setSaveSuccess(null);
    // Initialize draft from original
    setDraftData({
      summary_rom: { ...originalData.summary_rom },
      detailed_rom: { ...originalData.detailed_rom, items: [...(originalData.detailed_rom?.items || [])] },
      extracted_details: { ...originalData.extracted_details }
    });
  };

  const cancelEditing = (section) => {
    setEditingSection(null);
    setSaveError(null);
    // Reset draft to original
    setDraftData({
      summary_rom: { ...originalData.summary_rom },
      detailed_rom: { ...originalData.detailed_rom },
      extracted_details: { ...originalData.extracted_details }
    });
  };

  const saveSectionEdits = async (section) => {
    try {
      setIsSaving({ ...isSaving, [section]: true });
      setSaveError(null);
      setSaveSuccess(null);

      let payload = {};
      if (section === 'summary') {
        payload.summary_rom = {
          name: draftData.summary_rom.name,
          executive_summary: draftData.summary_rom.executive_summary
        };
      } else if (section === 'detailed') {
        payload.detailed_rom = {
          items: draftData.detailed_rom.items
        };
      } else if (section === 'extracted') {
        payload.extracted_details = draftData.extracted_details;
      }

      const response = await callRomEditAPI(payload);

      // Update original data with saved data
      setOriginalData({
        ...originalData,
        [section === 'summary' ? 'summary_rom' : section === 'detailed' ? 'detailed_rom' : 'extracted_details']:
          section === 'summary' ? draftData.summary_rom :
            section === 'detailed' ? draftData.detailed_rom :
              draftData.extracted_details
      });

      // Update recalculated total if returned
      // Backend can return either K values (501) or full amounts (501000)
      // Use >10000 threshold to detect which format
      if (response.recalculated_total_cost) {
        const value = parseK(response.recalculated_total_cost);
        const fullAmount = value > 10000 ? value : value * 1000;
        setRecalculatedTotal(fullAmount);
        setOriginalData(prev => ({
          ...prev,
          summary_rom: {
            ...prev.summary_rom,
            total_cost: fullAmount,
            rom_confidence_level: fullAmount
          }
        }));
      }

      setEditingSection(null);
      setSaveSuccess(`${section.charAt(0).toUpperCase() + section.slice(1)} section saved successfully!`);
      setTimeout(() => setSaveSuccess(null), 5000);
    } catch (error) {
      console.error('Save failed:', error);
      setSaveError(error.message || 'Failed to save changes. Please try again.');
    } finally {
      setIsSaving({ ...isSaving, [section]: false });
    }
  };

  const saveAllAndReturn = async () => {
    try {
      setIsSaving({ all: true });
      setSaveError(null);

      const payload = {
        summary_rom: {
          name: originalData.summary_rom.name,
          executive_summary: originalData.summary_rom.executive_summary
        },
        detailed_rom: {
          items: originalData.detailed_rom.items
        },
        extracted_details: originalData.extracted_details
      };

      await callRomEditAPI(payload);

      // Reset saving state before navigation
      setIsSaving({ all: false });

      // Navigate to dashboard
      console.log('✅ Save successful, navigating to dashboard...');

      // Use window.location for more reliable navigation
      window.location.href = '/kpit-ai-portal-members/rom';
    } catch (error) {
      console.error('❌ Save all failed:', error);
      setSaveError(error.message || 'Failed to save all changes. Please try again.');
      setIsSaving({ all: false });
    }
  };

  const downloadXLSX = async () => {
    try {
      // Create a new workbook
      const workbook = createWorkbook();

      // Sheet 1: Summary ROM
      const displayedTotal = recalculatedTotal
        ? formatUSD(recalculatedTotal)
        : initialTotal
          ? formatUSD(initialTotal)
          : formatUSD(summaryRom.rom_confidence_level || summaryRom.total_cost);

      const summaryData = [
        ['Summary ROM'],
        [''],
        ['Project Name:', summaryRom.name || 'Not specified'],
        ['Total Cost:', displayedTotal],
        [''],
        ['Executive Summary:'],
        [summaryRom.executive_summary || 'Not provided']
      ];

      const summarySheet = arrayToWorksheet(workbook, summaryData, 'Summary ROM');
      summarySheet.columns = [
        { width: 20 },
        { width: 80 }
      ];
      // Sheet 2: Detailed ROM Breakdown
      const detailedData = [
        ['Detailed ROM Breakdown'],
        [''],
        ['S.No', 'Application Team', 'ROM Cost', 'Estimating Assumptions']
      ];

      if (detailedRom?.items) {
        detailedRom.items.forEach(item => {
          const value = parseK(item.high_level_rom_k);
          // Use threshold check: if value > 10000, it's a full amount, otherwise K value
          const formattedCost = value > 10000 ? formatUSD(value) : formatUSDFromK(value);
          detailedData.push([
            item.s_no,
            item.application_team,
            formattedCost,
            item.estimating_assumptions
          ]);
        });
      }

      detailedData.push(['']);
      detailedData.push(['Total Cost:', '', displayedTotal]);

      const detailedSheet = arrayToWorksheet(workbook, detailedData, 'Detailed ROM Breakdown');
      detailedSheet.columns = [
        { width: 8 },
        { width: 40 },
        { width: 15 },
        { width: 80 }
      ];

      // Sheet 3: Extracted Project Details
      const extractedData = [
        ['Extracted Project Details'],
        [''],
        ['Overview'],
        [extractedDetails?.overview || 'Not provided'],
        [''],
        ['Project Information'],
        ['Initiative:', extractedDetails?.overview_details?.initiative || 'N/A'],
        ['Intake:', extractedDetails?.overview_details?.intake || 'N/A'],
        ['Narrative:', extractedDetails?.overview_details?.narrative || 'N/A'],
        [''],
        ['Scope'],
        ['In Scope:'],
      ];

      if (extractedDetails?.scope?.in_scope) {
        extractedDetails.scope.in_scope.forEach(item => {
          extractedData.push(['• ' + item]);
        });
      }

      extractedData.push(['']);
      extractedData.push(['Out of Scope:']);

      if (extractedDetails?.scope?.out_of_scope) {
        extractedDetails.scope.out_of_scope.forEach(item => {
          extractedData.push(['• ' + item]);
        });
      }

      extractedData.push(['']);
      extractedData.push(['Assumptions']);
      if (extractedDetails?.assumptions) {
        extractedDetails.assumptions.forEach(item => {
          extractedData.push(['• ' + item]);
        });
      }

      extractedData.push(['']);
      extractedData.push(['Issues and Risks']);
      if (extractedDetails?.issues_and_risks) {
        extractedDetails.issues_and_risks.forEach(item => {
          extractedData.push(['• ' + item]);
        });
      }

      extractedData.push(['']);
      extractedData.push(['Markets:', (extractedDetails?.markets || []).join(', ')]);
      extractedData.push(['Application Teams:', (extractedDetails?.application_teams || []).join(', ')]);
      extractedData.push(['Deployment Model:', extractedDetails?.deployment_model || 'N/A']);
      extractedData.push(['Confidence Level:', extractedDetails?.confidence_level || 'N/A']);

      const extractedSheet = arrayToWorksheet(workbook, extractedData, 'Extracted Project Details');
      extractedSheet.columns = [
        { width: 100 }
      ];

      // Generate and download the file
      const filename = `ROM_Results_${projectTitle.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Get buffer and trigger browser download
      const buffer = await getWorkbookBuffer(workbook);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      console.log('✅ Downloaded XLSX file:', filename);
    } catch (error) {
      console.error('❌ XLSX download failed:', error);
      setSaveError('Failed to download XLSX file: ' + error.message);
    }
  };

  // Update field helpers
  const updateSummaryField = (field, value) => {
    setDraftData({
      ...draftData,
      summary_rom: { ...draftData.summary_rom, [field]: value }
    });
  };

  const updateDetailedRomItem = (index, field, value) => {
    const newItems = [...draftData.detailed_rom.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setDraftData({
      ...draftData,
      detailed_rom: { ...draftData.detailed_rom, items: newItems }
    });
  };

  const addDetailedRomRow = () => {
    const newItems = [...draftData.detailed_rom.items];
    newItems.push({
      s_no: String(newItems.length + 1),
      application_team: '',
      high_level_rom_k: '0',
      estimating_assumptions: ''
    });
    setDraftData({
      ...draftData,
      detailed_rom: { ...draftData.detailed_rom, items: newItems }
    });
  };

  const deleteDetailedRomRow = (index) => {
    const newItems = draftData.detailed_rom.items.filter((_, i) => i !== index);
    // Renumber s_no
    newItems.forEach((item, i) => {
      item.s_no = String(i + 1);
    });
    setDraftData({
      ...draftData,
      detailed_rom: { ...draftData.detailed_rom, items: newItems }
    });
  };

  const updateExtractedField = (path, value) => {
    const pathParts = path.split('.');
    const newExtractedDetails = { ...draftData.extracted_details };
    let current = newExtractedDetails;

    for (let i = 0; i < pathParts.length - 1; i++) {
      if (!current[pathParts[i]]) current[pathParts[i]] = {};
      current = current[pathParts[i]];
    }

    current[pathParts[pathParts.length - 1]] = value;
    setDraftData({
      ...draftData,
      extracted_details: newExtractedDetails
    });
  };

  // Helper component for editing chip arrays
  const EditableChipArray = ({ values = [], path, label, color = 'primary' }) => {
    const [newValue, setNewValue] = useState('');

    const addChip = () => {
      if (newValue.trim() && !values.includes(newValue.trim())) {
        updateExtractedField(path, [...values, newValue.trim()]);
        setNewValue('');
      }
    };

    const removeChip = (index) => {
      updateExtractedField(path, values.filter((_, i) => i !== index));
    };

    if (editingSection !== 'extracted') {
      return (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {values.map((value, index) => (
            <Chip key={index} label={value} size="small" color={color} variant={color === 'outlined' ? 'outlined' : 'filled'} />
          )) || <Typography variant="body2" color="text.secondary">Not specified</Typography>}
        </Box>
      );
    }

    return (
      <Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
          {values.map((value, index) => (
            <Chip
              key={index}
              label={value}
              size="small"
              color={color}
              variant={color === 'outlined' ? 'outlined' : 'filled'}
              onDelete={() => removeChip(index)}
            />
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            placeholder={`Add ${label}...`}
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addChip()}
          />
          <Button size="small" onClick={addChip} startIcon={<AddIcon />}>Add</Button>
        </Box>
      </Box>
    );
  };

  // Helper component for editing list items (scope, assumptions, risks)
  const EditableListItems = ({ items = [], path, icon, iconColor }) => {
    const [newItem, setNewItem] = useState('');

    const addItem = () => {
      if (newItem.trim()) {
        updateExtractedField(path, [...items, newItem.trim()]);
        setNewItem('');
      }
    };

    const removeItem = (index) => {
      updateExtractedField(path, items.filter((_, i) => i !== index));
    };

    if (editingSection !== 'extracted') {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {items.map((item, index) => (
            <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start' }}>
              {icon && React.createElement(icon, { sx: { fontSize: 16, color: iconColor, mr: 1, mt: 0.2 } })}
              <Typography variant="body2">{item}</Typography>
            </Box>
          ))}
          {items.length === 0 && <Typography variant="body2" color="text.secondary">Not specified</Typography>}
        </Box>
      );
    }

    return (
      <Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
          {items.map((item, index) => (
            <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              {icon && React.createElement(icon, { sx: { fontSize: 16, color: iconColor, mr: 1, mt: 0.2 } })}
              <Typography variant="body2" sx={{ flex: 1 }}>{item}</Typography>
              <IconButton size="small" color="error" onClick={() => removeItem(index)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Add item..."
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addItem()}
          />
          <Button size="small" onClick={addItem} startIcon={<AddIcon />}>Add</Button>
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      {/* Success/Error Alerts */}
      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaveSuccess(null)}>
          {saveSuccess}
        </Alert>
      )}
      {saveError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError(null)}>
          {saveError}
        </Alert>
      )}

      {/* Header with Actions */}
      <Paper elevation={3} sx={{ p: 4, mb: 3, bgcolor: 'primary.50' }}>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 3
        }}>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h3" component="h1" color="primary" gutterBottom>
              ROM Estimation Complete
            </Typography>
            <Typography variant="h5" color="text.secondary">
              {projectTitle}
            </Typography>
          </Box>
          <Box sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            alignItems: 'center'
          }}>
            <Button
              variant="contained"
              color="success"
              size="large"
              startIcon={isSaving.all ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
              onClick={saveAllAndReturn}
              disabled={isSaving.all || editingSection !== null}
              sx={{ minWidth: 200 }}
            >
              Save All & Return
            </Button>
            <Button
              variant="contained"
              size="large"
              startIcon={<DownloadIcon />}
              onClick={downloadXLSX}
              sx={{ minWidth: 180 }}
            >
              Download XLSX
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<DownloadIcon />}
              onClick={onDownload}
              sx={{ minWidth: 180 }}
            >
              Download JSON
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<DashboardIcon />}
              onClick={onGoToDashboard}
              sx={{ minWidth: 150 }}
            >
              Go to Dashboard
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<RefreshIcon />}
              onClick={onStartNew}
              sx={{ minWidth: 130 }}
            >
              New Estimate
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Summary ROM Table */}
      {summaryRom && (
        <Paper elevation={2} sx={{ mb: 3 }}>
          <Box sx={{ p: 3, bgcolor: 'success.50', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h5" color="success.dark" gutterBottom>
                Summary ROM
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Executive summary and key metrics
              </Typography>
            </Box>
            {editingSection === 'summary' ? (
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={isSaving.summary ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                  onClick={() => saveSectionEdits('summary')}
                  disabled={isSaving.summary}
                >
                  Save
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<CancelIcon />}
                  onClick={() => cancelEditing('summary')}
                  disabled={isSaving.summary}
                >
                  Cancel
                </Button>
              </Stack>
            ) : (
              <IconButton
                onClick={() => startEditingSection('summary')}
                disabled={editingSection !== null}
                color="primary"
              >
                <EditIcon />
              </IconButton>
            )}
          </Box>
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Project Name:
                </Typography>
                {editingSection === 'summary' ? (
                  <TextField
                    fullWidth
                    value={draftData.summary_rom.name || ''}
                    onChange={(e) => updateSummaryField('name', e.target.value)}
                    size="small"
                    sx={{ mb: 2 }}
                  />
                ) : (
                  <Typography variant="h6" paragraph>
                    {summaryRom.name || 'Not specified'}
                  </Typography>
                )}

                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Total Cost:
                </Typography>
                <Typography variant="h4" color="primary" sx={{ fontWeight: 'bold' }}>
                  {currentTotal
                    ? formatUSD(currentTotal)
                    : formatUSD(summaryRom.rom_confidence_level || summaryRom.total_cost)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  (Auto-calculated from Detailed ROM)
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Executive Summary:
                </Typography>
                {editingSection === 'summary' ? (
                  <TextField
                    fullWidth
                    multiline
                    rows={6}
                    value={draftData.summary_rom.executive_summary || ''}
                    onChange={(e) => updateSummaryField('executive_summary', e.target.value)}
                    size="small"
                  />
                ) : (
                  <>
                    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => (
                            <Typography variant="body2" sx={{ lineHeight: 1.6, mb: 1 }}>
                              {children}
                            </Typography>
                          ),
                          li: ({ children }) => (
                            <Typography component="li" variant="body2" sx={{ lineHeight: 1.6 }}>
                              {children}
                            </Typography>
                          ),
                          h3: ({ children }) => (
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                              {children}
                            </Typography>
                          ),
                          strong: ({ children }) => (
                            <Typography component="span" sx={{ fontWeight: 600 }}>
                              {children}
                            </Typography>
                          ),
                        }}
                      >
                        {summaryText || 'No executive summary available'}
                      </ReactMarkdown>
                    </Paper>

                    {lineageText ? (
                      <Accordion sx={{ mt: 1 }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="subtitle2" color="text.secondary">
                            Estimate lineage and explanation
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => (
                                <Typography variant="body2" sx={{ lineHeight: 1.6, mb: 1 }}>
                                  {children}
                                </Typography>
                              ),
                              li: ({ children }) => (
                                <Typography component="li" variant="body2" sx={{ lineHeight: 1.6 }}>
                                  {children}
                                </Typography>
                              ),
                              h3: ({ children }) => (
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                                  {children}
                                </Typography>
                              ),
                              strong: ({ children }) => (
                                <Typography component="span" sx={{ fontWeight: 600 }}>
                                  {children}
                                </Typography>
                              ),
                            }}
                          >
                            {lineageText}
                          </ReactMarkdown>
                        </AccordionDetails>
                      </Accordion>
                    ) : null}
                  </>
                )}
              </Grid>
            </Grid>
          </CardContent>
        </Paper>
      )}

      {/* Detailed ROM Table */}
      {detailedRom && (
        <Paper elevation={2} sx={{ mb: 3 }}>
          <Box sx={{ p: 3, bgcolor: 'info.50', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h5" color="info.dark" gutterBottom>
                Detailed ROM Breakdown
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Cost breakdown by application team
              </Typography>
            </Box>
            {editingSection === 'detailed' ? (
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={isSaving.detailed ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                  onClick={() => saveSectionEdits('detailed')}
                  disabled={isSaving.detailed}
                >
                  Save
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<CancelIcon />}
                  onClick={() => cancelEditing('detailed')}
                  disabled={isSaving.detailed}
                >
                  Cancel
                </Button>
              </Stack>
            ) : (
              <IconButton
                onClick={() => startEditingSection('detailed')}
                disabled={editingSection !== null}
                color="primary"
              >
                <EditIcon />
              </IconButton>
            )}
          </Box>
          <CardContent>
            {editingSection === 'detailed' && (
              <Box sx={{ mb: 2 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={addDetailedRomRow}
                >
                  Add Row
                </Button>
              </Box>
            )}

            {/* Cost Breakdown Table */}
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>S.No</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Application Team</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>
                      {editingSection === 'detailed' ? "ROM Cost (000's)" : 'ROM Cost'}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Estimating Assumptions</TableCell>
                    {editingSection === 'detailed' && (
                      <TableCell sx={{ fontWeight: 'bold', width: 80 }}>Actions</TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {detailedRom.items?.map((item, index) => (
                    <TableRow key={index} hover>
                      <TableCell>{item.s_no}</TableCell>
                      <TableCell>
                        {editingSection === 'detailed' ? (
                          <TextField
                            fullWidth
                            value={draftData.detailed_rom.items[index]?.application_team || ''}
                            onChange={(e) => updateDetailedRomItem(index, 'application_team', e.target.value)}
                            size="small"
                          />
                        ) : (
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                            {item.application_team}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        {editingSection === 'detailed' ? (
                          <TextField
                            fullWidth
                            value={parseK(draftData.detailed_rom.items[index]?.high_level_rom_k)}
                            onChange={(e) => updateDetailedRomItem(index, 'high_level_rom_k', e.target.value)}
                            size="small"
                            placeholder="300"
                          />
                        ) : (
                          <Typography variant="h6" color="success.main" sx={{ fontWeight: 'bold' }}>
                            {(() => {
                              const value = parseK(item.high_level_rom_k);
                              // If value > 10000, it's already a full amount
                              return value > 10000 ? formatUSD(value) : formatUSDFromK(value);
                            })()}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingSection === 'detailed' ? (
                          <TextField
                            fullWidth
                            multiline
                            rows={2}
                            value={draftData.detailed_rom.items[index]?.estimating_assumptions || ''}
                            onChange={(e) => updateDetailedRomItem(index, 'estimating_assumptions', e.target.value)}
                            size="small"
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {item.estimating_assumptions}
                          </Typography>
                        )}
                      </TableCell>
                      {editingSection === 'detailed' && (
                        <TableCell>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => deleteDetailedRomRow(index)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      )}
                    </TableRow>
                  )) || (
                      <TableRow>
                        <TableCell colSpan={editingSection === 'detailed' ? 5 : 4} sx={{ textAlign: 'center', py: 4 }}>
                          <Typography color="text.secondary">
                            No detailed ROM items available
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Paper>
      )}

      {/* Extracted Details - Collapsible */}
      {extractedDetails && (
        <Paper elevation={2} sx={{ mb: 3 }}>
          <Box
            sx={{
              p: 3,
              bgcolor: 'warning.50',
              borderBottom: showExtractedDetails ? '1px solid' : 'none',
              borderColor: 'divider',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <Box
              sx={{ flex: 1, cursor: 'pointer' }}
              onClick={() => setShowExtractedDetails(!showExtractedDetails)}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h5" color="warning.dark" gutterBottom>
                    Extracted Project Details
                  </Typography>
                  <Typography variant="subtitle1" color="text.secondary">
                    Complete project analysis and breakdown
                  </Typography>
                </Box>
                <IconButton color="warning">
                  {showExtractedDetails ? <ArrowUpIcon /> : <ArrowDownIcon />}
                </IconButton>
              </Stack>
            </Box>
            {showExtractedDetails && (
              editingSection === 'extracted' ? (
                <Stack direction="row" spacing={1} sx={{ ml: 2 }}>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={isSaving.extracted ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                    onClick={() => saveSectionEdits('extracted')}
                    disabled={isSaving.extracted}
                  >
                    Save
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<CancelIcon />}
                    onClick={() => cancelEditing('extracted')}
                    disabled={isSaving.extracted}
                  >
                    Cancel
                  </Button>
                </Stack>
              ) : (
                <IconButton
                  onClick={() => startEditingSection('extracted')}
                  disabled={editingSection !== null}
                  color="primary"
                  sx={{ ml: 2 }}
                >
                  <EditIcon />
                </IconButton>
              )
            )}
          </Box>

          <Collapse in={showExtractedDetails}>
            <CardContent>
              <Grid container spacing={3}>
                {/* Project Overview */}
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" color="primary" gutterBottom>
                        Project Overview
                      </Typography>
                      {editingSection === 'extracted' ? (
                        <>
                          <TextField
                            fullWidth
                            multiline
                            rows={3}
                            label="Overview"
                            value={draftData.extracted_details.overview || ''}
                            onChange={(e) => updateExtractedField('overview', e.target.value)}
                            size="small"
                            sx={{ mb: 2 }}
                          />

                          {draftData.extracted_details.overview_details && (
                            <>
                              <TextField
                                fullWidth
                                multiline
                                rows={2}
                                label="Initiative"
                                value={draftData.extracted_details.overview_details?.initiative || ''}
                                onChange={(e) => updateExtractedField('overview_details.initiative', e.target.value)}
                                size="small"
                                sx={{ mb: 2 }}
                              />
                              <TextField
                                fullWidth
                                multiline
                                rows={2}
                                label="Narrative"
                                value={draftData.extracted_details.overview_details?.narrative || ''}
                                onChange={(e) => updateExtractedField('overview_details.narrative', e.target.value)}
                                size="small"
                              />
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <Typography variant="body1" paragraph>
                            {extractedDetails.overview}
                          </Typography>

                          {extractedDetails.overview_details && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                Initiative:
                              </Typography>
                              <Typography variant="body2" paragraph>
                                {extractedDetails.overview_details.initiative}
                              </Typography>

                              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                Narrative:
                              </Typography>
                              <Typography variant="body2">
                                {extractedDetails.overview_details.narrative}
                              </Typography>
                            </Box>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                {/* Scope */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" color="primary" gutterBottom>
                        Project Scope
                      </Typography>

                      <Typography variant="subtitle2" color="success.main" gutterBottom sx={{ mt: 2 }}>
                        In Scope:
                      </Typography>
                      <Box sx={{ mb: 2 }}>
                        <EditableListItems
                          items={editingSection === 'extracted' ? draftData.extracted_details.scope?.in_scope || [] : extractedDetails.scope?.in_scope || []}
                          path="scope.in_scope"
                          icon={CheckIcon}
                          iconColor="success.main"
                        />
                      </Box>

                      <Typography variant="subtitle2" color="warning.main" gutterBottom>
                        Out of Scope:
                      </Typography>
                      <Box>
                        <EditableListItems
                          items={editingSection === 'extracted' ? draftData.extracted_details.scope?.out_of_scope || [] : extractedDetails.scope?.out_of_scope || []}
                          path="scope.out_of_scope"
                          icon={WarningIcon}
                          iconColor="warning.main"
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Teams and Resources */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" color="primary" gutterBottom>
                        Teams & Resources
                      </Typography>

                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Application Teams:
                        </Typography>
                        <EditableChipArray
                          values={editingSection === 'extracted' ? draftData.extracted_details.application_teams || [] : extractedDetails.application_teams || []}
                          path="application_teams"
                          label="Application Team"
                          color="secondary"
                        />
                      </Box>

                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Vendors:
                        </Typography>
                        <EditableChipArray
                          values={editingSection === 'extracted' ? draftData.extracted_details.vendors || [] : extractedDetails.vendors || []}
                          path="vendors"
                          label="Vendor"
                          color="info"
                        />
                      </Box>

                      <Box>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Markets:
                        </Typography>
                        <EditableChipArray
                          values={editingSection === 'extracted' ? draftData.extracted_details.markets || [] : extractedDetails.markets || []}
                          path="markets"
                          label="Market"
                          color="outlined"
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Assumptions */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" color="primary" gutterBottom>
                        Key Assumptions
                      </Typography>
                      <EditableListItems
                        items={editingSection === 'extracted' ? draftData.extracted_details.assumptions || [] : extractedDetails.assumptions || []}
                        path="assumptions"
                        icon={InfoIcon}
                        iconColor="info.main"
                      />
                    </CardContent>
                  </Card>
                </Grid>

                {/* Risks */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" color="primary" gutterBottom>
                        Issues and Risks
                      </Typography>
                      <EditableListItems
                        items={editingSection === 'extracted' ? draftData.extracted_details.issues_and_risks || [] : extractedDetails.issues_and_risks || []}
                        path="issues_and_risks"
                        icon={WarningIcon}
                        iconColor="warning.main"
                      />
                    </CardContent>
                  </Card>
                </Grid>

                {/* Technical Details */}
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" color="primary" gutterBottom>
                        Technical Details
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Deployment Model:
                          </Typography>
                          {editingSection === 'extracted' ? (
                            <TextField
                              fullWidth
                              value={draftData.extracted_details.deployment_model || ''}
                              onChange={(e) => updateExtractedField('deployment_model', e.target.value)}
                              size="small"
                            />
                          ) : (
                            <Typography variant="body2">
                              {extractedDetails.deployment_model || 'Not specified'}
                            </Typography>
                          )}
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Confidence Level:
                          </Typography>
                          {editingSection === 'extracted' ? (
                            <TextField
                              fullWidth
                              value={draftData.extracted_details.confidence_level || ''}
                              onChange={(e) => updateExtractedField('confidence_level', e.target.value)}
                              size="small"
                            />
                          ) : (
                            <Typography variant="body2">
                              {extractedDetails.confidence_level || 'Not specified'}
                            </Typography>
                          )}
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </CardContent>
          </Collapse>
        </Paper>
      )}

      {/* Disclaimer */}
      <Typography
        variant="caption"
        color="text.disabled"
        sx={{ display: 'block', textAlign: 'center', mt: 4, px: 2, lineHeight: 1.6 }}
      >
        This ROM estimate is AI‑generated based on historical data and patterns. It is approximate and must be validated before use in planning or budgeting decisions.
      </Typography>
    </Box>
  );
};

export default FinalResultsDisplay;