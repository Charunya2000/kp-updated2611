'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box,
  CircularProgress,
  Button,
  Stack,
  Alert,
  Card,
  CardContent,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Chip,
  Tooltip,
  FormGroup,
  FormControlLabel,
  Switch
} from '@mui/material';
import { DownloadOutlined } from '@mui/icons-material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { BarChart } from '@mui/x-charts/BarChart';
import { getAllAssistants } from '@/app/clientServices/assistantService';

const FEEDBACK_LABELS = {
  1: 'Approved',
  0: 'Disapproved',
  'null': 'No Feedback'
};

const ApprovalStatisticsView = ({ teamName }) => {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [statistics, setStatistics] = useState([]);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Filter states
  const [dateRange, setDateRange] = useState('All');
  const [selectedAssistant, setSelectedAssistant] = useState('all');
  const [selectedNuid, setSelectedNuid] = useState('all');
  const [nuidSearchText, setNuidSearchText] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState('');
  const [uniqueNuidsOnly, setUniqueNuidsOnly] = useState(false);

  // Data lists for dropdowns
  const [assistants, setAssistants] = useState([]);
  const [nuids, setNuids] = useState([]);
  const selectedAssistantObj = useMemo(
    () => assistants.find((assistant) => assistant.name === selectedAssistant),
    [assistants, selectedAssistant]
  );
  const hasFilterSelection = useMemo(() => (
    selectedAssistant !== 'all'
    || selectedNuid !== 'all'
    || selectedFeedback !== ''
    || dateRange !== 'All'
    || uniqueNuidsOnly
  ), [selectedAssistant, selectedNuid, selectedFeedback, dateRange, uniqueNuidsOnly]);

  // Fetch assistants
  useEffect(() => {
    const fetchAssistants = async () => {
      try {
        const response = await getAllAssistants(teamName);
        const sortedAssistants = Array.isArray(response)
          ? response.slice().sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
          : [];
        setAssistants(sortedAssistants);
      } catch (err) {
        console.error('Error fetching assistants:', err);
        setAssistants([]);
      }
    };
    fetchAssistants();
  }, [teamName]);

  // Fetch NUIDs when assistant changes
  useEffect(() => {
    const fetchNuids = async () => {
      try {
        const params = new URLSearchParams({ listNuids: 'true' });
        if (selectedAssistant !== 'all') {
          params.append('assistantName', selectedAssistant);
          const assistantDisplayName = selectedAssistantObj?.displayName;
          if (assistantDisplayName && assistantDisplayName !== selectedAssistant) {
            params.append('assistantDisplayName', assistantDisplayName);
          }
        }
        const response = await fetch(`/api/${teamName}/admin/approval-statistics?${params}`);
        if (response.ok) {
          const data = await response.json();
          const normalizedNuids = Array.isArray(data) ? data : [];
          setNuids(normalizedNuids);
          setSelectedNuid((prevSelectedNuid) => {
            if (prevSelectedNuid !== 'all' && !normalizedNuids.includes(prevSelectedNuid)) {
              return 'all';
            }
            return prevSelectedNuid;
          });
        }
      } catch (err) {
        console.error('Error fetching NUIDs:', err);
        setNuids([]);
        setSelectedNuid('all');
      }
    };
    fetchNuids();
  }, [teamName, selectedAssistant, selectedAssistantObj]);

  const filteredNuids = useMemo(() => {
    if (!nuidSearchText.trim()) {
      return nuids;
    }

    const search = nuidSearchText.toLowerCase();
    return nuids.filter((nuid) => nuid && nuid.toLowerCase().includes(search));
  }, [nuids, nuidSearchText]);

  const getDateRangeWindow = useCallback((range) => {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    if (range === 'This month') {
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      return { dateRangeStart: startDate.toISOString(), dateRangeEnd: endDate.toISOString() };
    }

    if (range === 'Last 2 months') {
      const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { dateRangeStart: startDate.toISOString(), dateRangeEnd: endDate.toISOString() };
    }

    if (range === 'Last 3 months') {
      const startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return { dateRangeStart: startDate.toISOString(), dateRangeEnd: endDate.toISOString() };
    }

    if (range === 'This year') {
      const startDate = new Date(now.getFullYear(), 0, 1);
      return { dateRangeStart: startDate.toISOString(), dateRangeEnd: endDate.toISOString() };
    }

    return { dateRangeStart: '', dateRangeEnd: '' };
  }, []);

  // Fetch statistics
  const fetchStatistics = useCallback(async () => {
    if (!hasFilterSelection) {
      setError(null);
      setStatistics([]);
      setLoading(false);
      setPage(0);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      const { dateRangeStart, dateRangeEnd } = getDateRangeWindow(dateRange);
      if (dateRangeStart) params.append('dateRangeStart', dateRangeStart);
      if (dateRangeEnd) params.append('dateRangeEnd', dateRangeEnd);
      if (selectedAssistant && selectedAssistant !== 'all') {
        params.append('assistantName', selectedAssistant);
        const assistantDisplayName = selectedAssistantObj?.displayName;
        if (assistantDisplayName && assistantDisplayName !== selectedAssistant) {
          params.append('assistantDisplayName', assistantDisplayName);
        }
      }
      if (selectedNuid && selectedNuid !== 'all') {
        params.append('nuid', selectedNuid);
      }
      if (selectedFeedback !== '') {
        params.append('feedbackStatus', selectedFeedback);
      }
      if (uniqueNuidsOnly) {
        params.append('uniqueNuidsOnly', 'true');
      }

      const response = await fetch(`/api/${teamName}/admin/approval-statistics?${params}`);
      if (!response.ok) throw new Error('Failed to fetch statistics');

      const data = await response.json();
      setStatistics(data || []);
      setPage(0);
    } catch (err) {
      setError(err.message);
      setStatistics([]);
    } finally {
      setLoading(false);
    }
  }, [teamName, hasFilterSelection, dateRange, getDateRangeWindow, selectedAssistant, selectedAssistantObj, selectedNuid, selectedFeedback, uniqueNuidsOnly]);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  // Prepare chart data
  const chartData = useMemo(() => {
    const grouped = {};
    statistics.forEach(stat => {
      const key = `${stat._id.date}`;
      if (!grouped[key]) {
        grouped[key] = { date: stat._id.date, approved: 0, disapproved: 0, noFeedback: 0, total: 0 };
      }
      const feedbackKey = stat._id.feedback === 1 ? 'approved' : stat._id.feedback === 0 ? 'disapproved' : 'noFeedback';
      grouped[key][feedbackKey] += stat.count;
      grouped[key].total += stat.count;
    });
    return Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [statistics]);

  // Handle export
  const handleExport = async () => {
    setExporting(true);
    try {
      const { dateRangeStart, dateRangeEnd } = getDateRangeWindow(dateRange);
      const filters = {
        assistantName: selectedAssistant !== 'all'
          ? (assistants.find((assistant) => assistant.name === selectedAssistant)?.displayName || selectedAssistant)
          : null,
        nuid: selectedNuid !== 'all' ? selectedNuid : null,
        dateRange,
        dateRangeStart,
        dateRangeEnd,
        feedbackStatus: selectedFeedback === ''
          ? undefined
          : selectedFeedback === 'null'
            ? 'null'
            : parseInt(selectedFeedback, 10)
      };

      const response = await fetch(`/api/${teamName}/admin/approval-statistics/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statistics, filters })
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `approval-statistics-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const displayStatistics = statistics.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box display="flex" flexDirection={{ xs: 'column', lg: 'row' }} gap={3} width="100%">
      <Box display="flex" flexDirection="column" sx={{ minWidth: { xs: '100%', lg: 320 } }}>
        <Box marginBottom={2}>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={uniqueNuidsOnly}
                  onChange={(e) => setUniqueNuidsOnly(e.target.checked)}
                />
              }
              label="Unique NUIDs"
            />
          </FormGroup>
        </Box>

        <Box marginBottom={2}>
          <FormControl variant="outlined" sx={{ minWidth: 300 }}>
            <InputLabel sx={{ fontSize: '1rem', fontWeight: 'bold' }}>Date Range</InputLabel>
            <Select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              label="Date Range"
              fullWidth
            >
              <MenuItem value="This month">This month</MenuItem>
              <MenuItem value="Last 2 months">Last 2 months</MenuItem>
              <MenuItem value="Last 3 months">Last 3 months</MenuItem>
              <MenuItem value="This year">This year</MenuItem>
              <MenuItem value="All">All Time</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Box marginBottom={2} display="flex" alignItems="center">
          <FormControl variant="outlined" sx={{ minWidth: 300 }}>
            <InputLabel sx={{ fontSize: '1rem', fontWeight: 'bold' }}>Select Assistant</InputLabel>
            <Select
              value={selectedAssistant}
              label="Select Assistant"
              onChange={(e) => setSelectedAssistant(e.target.value)}
              fullWidth
            >
              <MenuItem value="all">All Assistants</MenuItem>
              {assistants.map((assistant) => (
                <MenuItem key={assistant._id || assistant.id || assistant.name} value={assistant.name}>
                  {assistant.displayName || assistant.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Tooltip
            title='Selecting "All Assistants" includes historical data from before assistant tracking was implemented. Results may appear higher than expected.'
            placement="right"
            color="primary"
          >
            <InfoOutlinedIcon sx={{ ml: 1, mt: 0.5, cursor: 'pointer', alignSelf: 'flex-start' }} />
          </Tooltip>
        </Box>

        <Box marginBottom={2}>
          <FormControl variant="outlined" sx={{ minWidth: 300 }}>
            <InputLabel sx={{ fontSize: '1rem', fontWeight: 'bold' }}>Select NUID</InputLabel>
            <Select
              value={selectedNuid}
              label="Select NUID"
              onChange={(e) => setSelectedNuid(e.target.value)}
              fullWidth
              renderValue={(value) => value === 'all' ? 'All NUIDs' : value}
              MenuProps={{
                autoFocus: false,
                PaperProps: {
                  sx: { maxHeight: 320 }
                }
              }}
              onOpen={() => setNuidSearchText('')}
            >
              <MenuItem
                key="nuid-search"
                disableRipple
                onKeyDown={(e) => e.stopPropagation()}
                sx={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'background.paper' }}
              >
                <TextField
                  size="small"
                  placeholder="Search NUIDs..."
                  value={nuidSearchText}
                  onChange={(e) => setNuidSearchText(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  fullWidth
                  autoFocus
                />
              </MenuItem>
              <MenuItem value="all">All NUIDs</MenuItem>
              {filteredNuids.map((nuid) => (
                <MenuItem key={nuid} value={nuid}>{nuid}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box marginBottom={2}>
          <FormControl variant="outlined" sx={{ minWidth: 300 }}>
            <InputLabel shrink sx={{ fontSize: '1rem', fontWeight: 'bold' }}>Feedback Status</InputLabel>
            <Select
              value={selectedFeedback}
              label="Feedback Status"
              onChange={(e) => setSelectedFeedback(e.target.value)}
              displayEmpty
              renderValue={(value) => {
                if (value === '') {
                  return 'All Feedback';
                }
                return FEEDBACK_LABELS[value] || value;
              }}
              fullWidth
            >
              <MenuItem value="">All Feedback</MenuItem>
              <MenuItem value="1">Approved</MenuItem>
              <MenuItem value="0">Disapproved</MenuItem>
              <MenuItem value="null">No Feedback</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Stack direction="row" spacing={2}>
          <Button
            variant="secondary"
            onClick={handleExport}
            startIcon={<DownloadOutlined />}
            disabled={exporting || statistics.length === 0}
          >
            {exporting ? 'Exporting...' : 'Export to Excel'}
          </Button>
        </Stack>
      </Box>

      <Box flex={1}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && hasFilterSelection && statistics.length > 0 && (
          <>
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ mb: 2, fontWeight: 600 }}>
                  Approval Trend
                </Typography>
                <BarChart
                  height={300}
                  xAxis={[{
                    scaleType: 'band',
                    data: chartData.map(({ date }) => date),
                  }]}
                  series={[
                    {
                      data: chartData.map(({ approved }) => approved),
                      label: 'Approved',
                      color: '#00C49F',
                      stack: 'total',
                    },
                    {
                      data: chartData.map(({ disapproved }) => disapproved),
                      label: 'Disapproved',
                      color: '#FF8042',
                      stack: 'total',
                    },
                    {
                      data: chartData.map(({ noFeedback }) => noFeedback),
                      label: 'No Feedback',
                      color: '#FFBB28',
                      stack: 'total',
                    },
                  ]}
                  grid={{ horizontal: true }}
                  tooltip={{ trigger: 'axis' }}
                  slotProps={{
                    legend: {
                      position: { vertical: 'top', horizontal: 'right' },
                    },
                  }}
                  margin={{ top: 40, right: 20, bottom: 40, left: 50 }}
                  sx={{ width: '100%' }}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ mb: 2, fontWeight: 600 }}>
                  Raw Statistics ({statistics.length} records)
                </Typography>
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{
                        backgroundColor: 'listitem.active.background',
                        '& .MuiTableCell-root': {
                          color: 'listitem.active.text',
                        },
                      }}>
                        <TableCell sx={{ fontWeight: 600 }}>Assistant</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>NUID</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Feedback</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>Count</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>Avg Feedback</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {displayStatistics.map((stat, index) => (
                        <TableRow key={index} hover>
                          <TableCell>{stat._id.assistantName}</TableCell>
                          <TableCell>{stat._id.nuid}</TableCell>
                          <TableCell>
                            <Chip
                              label={FEEDBACK_LABELS[stat._id.feedback]}
                              size="small"
                              color={stat._id.feedback === 1 ? 'success' : stat._id.feedback === 0 ? 'error' : 'default'}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>{stat._id.date}</TableCell>
                          <TableCell align="right">{stat.count}</TableCell>
                          <TableCell align="right">
                            {Number.isFinite(stat.avgFeedback) ? stat.avgFeedback.toFixed(2) : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25, 50]}
                  component="div"
                  count={statistics.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={(event, newPage) => setPage(newPage)}
                  onRowsPerPageChange={(event) => {
                    setRowsPerPage(parseInt(event.target.value, 10));
                    setPage(0);
                  }}
                />
              </CardContent>
            </Card>
          </>
        )}

        {!loading && !hasFilterSelection && !error && (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={280}>
            <Typography variant="h6" textAlign="center">Please select approval statistic filters to display chart.</Typography>
          </Box>
        )}

        {!loading && hasFilterSelection && statistics.length === 0 && !error && (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={280}>
            <Typography variant="h6" textAlign="center">No data available for selected filters.</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ApprovalStatisticsView;
