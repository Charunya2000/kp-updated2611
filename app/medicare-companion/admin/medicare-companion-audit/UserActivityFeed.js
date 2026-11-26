'use client';

import {
    Box,
    Typography,
    CircularProgress,
    Alert,
    TextField,
    Button,
    Stack,
    Divider,
    IconButton,
    Tooltip
} from "@mui/material";
import {
    Search as SearchIcon,
    Description as ReportIcon,
    Clear as ClearIcon,
    Refresh as RefreshIcon,
    ArrowBack as ArrowBackIcon
} from "@mui/icons-material";
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useAuth } from '@/app/contexts/OpenIdAuthContext';
import Markdown from '@/app/[teamName]/[assistantName]/smartNote/[id]/components/Markdown.js';

const ActivityFeed = () => {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [searchPerformed, setSearchPerformed] = useState(false);
    const [formattedHistory, setFormattedHistory] = useState('');
    const [lastUpdated, setLastUpdated] = useState('');
    const [error, setError] = useState('');

    // Search form state
    const [mrn, setMrn] = useState('');
    const [nuid, setNuid] = useState('');
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);

    const chatEndRef = useRef(null);

    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [formattedHistory]);

    const handleSearch = async () => {
        if (!mrn.trim() || !nuid.trim()) {
            setError('Please enter valid NUID and MRN');
            return;
        }

        const today = new Date();
        if (startDate && startDate > today) {
            setError('Start Date cannot be in the future.');
            return;
        }
        if (endDate && endDate > today) {
            setError('End Date cannot be in the future.');
            return;
        }
        if (startDate && endDate && endDate < startDate) {
            setError('End Date cannot be before Start Date.');
            return;
        }

        setError('');
        setLoading(true);
        setSearchPerformed(true);

        try {
            const params = new URLSearchParams();
            if (mrn.trim()) params.append('mrn', mrn.trim());
            if (nuid.trim()) params.append('nuid', nuid.trim().toUpperCase());
            if (startDate) params.append('startDate', startDate.toISOString().split('T')[0]);
            if (endDate) params.append('endDate', endDate.toISOString().split('T')[0]);

            const response = await fetch(`/api/admin/medicare-companion/medicare-companion-audit/formatted?${params.toString()}`);
            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Failed to fetch activity data');
                setFormattedHistory('');
            } else {
                const history = data.formatted_history || '';
                if (typeof history === 'string') {
                    const responseContent = history
                        .split('\n')
                        .map(line => line.trimStart())
                        .join('\n')
                        .replace(/(\n)(\*Disclaimer:)/gm, '\n\n$2')
                        .trim();
                    setFormattedHistory(responseContent);
                    const lastUpdatedMatch = history.match(/\*\*Last Updated:\*\*\s*([^\n]+)/);
                    if (lastUpdatedMatch) {
                        const revised = new Date(lastUpdatedMatch[1].trim());
                        setLastUpdated(revised.toLocaleString('en-US', {
                            month: '2-digit', day: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit', second: '2-digit',
                        }));
                    }
                } else {
                    setFormattedHistory('');
                }
            }
        } catch (err) {
            console.error('Error searching activity:', err);
            setError('An error occurred while searching. Please try again.');
            setFormattedHistory('');
        } finally {
            setLoading(false);
        }
    };

    const handleClear = () => {
        setMrn('');
        setNuid('');
        setStartDate(null);
        setEndDate(null);
        setFormattedHistory('');
        setLastUpdated('');
        setSearchPerformed(false);
        setError('');
    };

    const handleRefresh = () => {
        setFormattedHistory('');
        setLastUpdated('');
        setError('');
    };

    const handleGenerateReport = async () => {
        if (!mrn.trim() || !nuid.trim()) {
            setError('Please enter valid NUID and MRN');
            return;
        }

        const today = new Date();
        if (startDate && startDate > today) {
            setError('Start Date cannot be in the future.');
            return;
        }
        if (endDate && endDate > today) {
            setError('End Date cannot be in the future.');
            return;
        }
        if (startDate && endDate && endDate < startDate) {
            setError('End Date cannot be before Start Date.');
            return;
        }

        setExporting(true);
        setError('');

        try {
            const params = new URLSearchParams();
            if (mrn.trim()) params.append('mrn', mrn.trim());
            if (nuid.trim()) params.append('nuid', nuid.trim().toUpperCase());
            if (startDate) params.append('startDate', startDate.toISOString().split('T')[0]);
            if (endDate) params.append('endDate', endDate.toISOString().split('T')[0]);

            const response = await fetch(`/api/admin/medicare-companion/medicare-companion-audit/export?${params.toString()}`);

            if (!response.ok) {
                const data = await response.json();
                setError(data.error || 'Failed to generate report');
                return;
            }

            const contentType = response.headers.get('content-type') || '';

            if (contentType.includes('application/json')) {
                const data = await response.json();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `chat_history_report_${mrn || nuid || 'export'}.json`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
            } else {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const disposition = response.headers.get('content-disposition') || '';
                const filenameMatch = disposition.match(/filename="?(.+?)"?$/);
                const filename = filenameMatch ? filenameMatch[1] : `chat_history_report_${mrn || nuid || 'export'}.csv`;

                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
            }

            console.log(JSON.stringify({
                kpmsg: {
                    id: 'AI_PORTAL_NOTEBOOK',
                    name: 'generateReport',
                    detail: { mrn, nuid, startDate, endDate }
                }
            }));
        } catch (err) {
            console.error('Error generating report:', err);
            setError('An error occurred while generating the report. Please try again.');
        } finally {
            setExporting(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSearch();
        }
    };

    return (
        <Box
            sx={{
                display: 'flex',
                height: '100%',
                overflow: 'hidden',
                gap: 2,
                p: 2,
            }}
        >
            {/* Left Panel — Chat History */}
            <Box
                sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                }}
            >
                {/* Chat history header */}
                <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            Chat History
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                        <Tooltip title="Return to Daily Report">
                            <span>
                                <IconButton
                                    onClick={() => router.push('/medicare-companion/admin/medicare-companion-audit')}
                                    disabled={loading}
                                    size="medium"
                                    sx={{
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        '&:hover': {
                                            borderColor: 'primary.main'
                                        }
                                    }}
                                >
                                    <ArrowBackIcon fontSize="medium" />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="Clear Results">
                            <span>
                                <IconButton
                                    onClick={handleRefresh}
                                    disabled={loading}
                                    size="medium"
                                    sx={{
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        '&:hover': {
                                            borderColor: 'primary.main'
                                        }
                                    }}
                                >
                                    {loading ? <CircularProgress size={24} /> : <RefreshIcon fontSize="medium" />}
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Stack>
                </Box>

                {/* Chat history content */}
                <Box
                    sx={{
                        flex: 1,
                        overflowY: 'auto',
                        p: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        '&::-webkit-scrollbar': { width: '8px' },
                        '&::-webkit-scrollbar-thumb': {
                            backgroundColor: 'action.disabled',
                            borderRadius: '4px',
                        },
                    }}
                >
                    {!searchPerformed && (
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flex: 1,
                                gap: 1,
                            }}
                        >
                            <SearchIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                            <Typography variant="body1" color="text.secondary" align="center">
                                Enter search criteria to view chat history
                            </Typography>
                            <Typography variant="body2" color="text.secondary" align="center">
                                Both Regional MRN and NUID are required to search for case interactions
                            </Typography>
                        </Box>
                    )}

                    {searchPerformed && !formattedHistory && !loading && (
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flex: 1,
                                gap: 2,
                            }}
                        >
                            <SearchIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                            <Typography variant="body1" color="text.secondary" align="center">
                                No chat history found for the given filters
                            </Typography>
                        </Box>
                    )}

                    {loading && (
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flex: 1,
                                gap: 2,
                            }}
                        >
                            <CircularProgress />
                            <Typography variant="body2" color="text.secondary">
                                Searching activity records...
                            </Typography>
                        </Box>
                    )}

                    {!loading && formattedHistory && (
                        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            {/* Grey NUID/MRN Info Header */}
                            <Box
                                sx={{
                                    bgcolor: 'action.hover',
                                    p: 1.5,
                                    borderRadius: 1,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    mb: 1
                                }}
                            >
                                <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ gap: 1 }}>
                                    <Typography variant="caption" color="text.secondary">
                                        <strong>NUID:</strong> {nuid}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        <strong>MRN:</strong> {mrn}
                                    </Typography>
                                </Stack>
                            </Box>

                            {/* Response rendered via Markdown */}
                            <Box
                                sx={{
                                    color: 'prompt.response.text',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    padding: 2.5,
                                    paddingBottom: 1,
                                    backgroundColor: 'prompt.response.background',
                                    borderRadius: '12px 12px 12px 0px',
                                    fontSize: '13pt',
                                    fontWeight: '400',
                                    textAlign: 'left',
                                    boxShadow: 'none',
                                    '&:hover': {
                                        boxShadow: 'none',
                                    },
                                    maxWidth: '95%',
                                }}
                            >
                                <Markdown content={formattedHistory} isComplete={true} />
                                {lastUpdated && (
                                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, textAlign: 'right', display: 'block' }}>
                                        <strong>Last Updated:</strong> {lastUpdated}
                                    </Typography>
                                )}
                            </Box>

                        </Box>
                    )}
                    <div ref={chatEndRef} />
                </Box>
            </Box>

            {/* Right Panel — Search & Report */}
            <Box
                sx={{
                    width: 340,
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    overflowY: 'auto',
                }}
            >
                {/* Search Criteria */}
                <Box
                    sx={{
                        p: 3,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                    }}
                >
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                        Search Criteria
                    </Typography>

                    <Stack spacing={2.5}>
                        {error && (
                            <Alert severity="error" onClose={() => setError('')}>
                                {error}
                            </Alert>
                        )}
                        <TextField
                            label="Regional MRN"
                            placeholder="Enter MRN"
                            value={mrn}
                            onChange={(e) => setMrn(e.target.value)}
                            onKeyDown={handleKeyDown}
                            size="small"
                            fullWidth
                            required
                            slotProps={{
                                input: {
                                    endAdornment: mrn && (
                                        <IconButton size="small" onClick={() => setMrn('')}>
                                            <ClearIcon fontSize="small" />
                                        </IconButton>
                                    ),
                                },
                            }}
                        />

                        <TextField
                            label="NUID"
                            placeholder="e.g. N123456"
                            value={nuid}
                            onChange={(e) => setNuid(e.target.value.toUpperCase())}
                            onKeyDown={handleKeyDown}
                            size="small"
                            fullWidth
                            required
                            slotProps={{
                                input: {
                                    endAdornment: nuid && (
                                        <IconButton size="small" onClick={() => setNuid('')}>
                                            <ClearIcon fontSize="small" />
                                        </IconButton>
                                    ),
                                },
                            }}
                        />

                        <Divider>
                            <Typography variant="caption" color="text.secondary">
                                Date Range (optional)
                            </Typography>
                        </Divider>

                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <DatePicker
                                label="Start Date"
                                value={startDate}
                                onChange={(newValue) => setStartDate(newValue)}
                                slotProps={{
                                    textField: { size: 'small', fullWidth: true },
                                    desktopPaper: {
                                        sx: {
                                            '& .MuiDateCalendar-root': { width: 260, height: 'auto' },
                                            '& .MuiPickersDay-root, & .MuiDayCalendar-weekDayLabel': { width: 30, height: 30, fontSize: '0.75rem' },
                                            '& .MuiPickersCalendarHeader-root': { paddingLeft: 1.5, paddingRight: 1 },
                                            '& .MuiDayCalendar-slideTransition': { minHeight: 200 },
                                        }
                                    }
                                }}
                            />

                            <DatePicker
                                label="End Date"
                                value={endDate}
                                onChange={(newValue) => setEndDate(newValue)}
                                slotProps={{
                                    textField: { size: 'small', fullWidth: true },
                                    desktopPaper: {
                                        sx: {
                                            '& .MuiDateCalendar-root': { width: 260, height: 'auto' },
                                            '& .MuiPickersDay-root, & .MuiDayCalendar-weekDayLabel': { width: 30, height: 30, fontSize: '0.75rem' },
                                            '& .MuiPickersCalendarHeader-root': { paddingLeft: 1.5, paddingRight: 1 },
                                            '& .MuiDayCalendar-slideTransition': { minHeight: 200 },
                                        }
                                    }
                                }}
                            />
                        </LocalizationProvider>

                        <Button
                            variant="contained"
                            onClick={handleSearch}
                            disabled={loading || !mrn.trim() || !nuid.trim()}
                            startIcon={loading ? <CircularProgress size={16} /> : <SearchIcon />}
                            fullWidth
                        >
                            Search
                        </Button>
                    </Stack>
                </Box>

                {/* Generate Report */}
                <Box
                    sx={{
                        p: 3,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                    }}
                >
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                        Report
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Generate a downloadable audit report from the current search results.
                    </Typography>
                    <Button
                        variant="contained"
                        onClick={handleGenerateReport}
                        disabled={exporting || loading || !mrn.trim() || !nuid.trim()}
                        startIcon={exporting ? <CircularProgress size={16} /> : <ReportIcon />}
                        fullWidth
                        color="secondary"
                    >
                        {exporting ? 'Generating...' : 'Generate Report'}
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

export default ActivityFeed;
