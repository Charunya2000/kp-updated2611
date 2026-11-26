'use client';

import {
    Box,
    Typography,
    Button,
    Stack,
    Alert,
    CircularProgress,
    Paper,
    Divider
} from "@mui/material";
import {
    Download as DownloadIcon,
    ChevronRight as ChevronRightIcon,
    CalendarToday as CalendarIcon
} from "@mui/icons-material";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

const DailySummaryReport = () => {
    const router = useRouter();
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleDownloadReport = async () => {
        if (!startDate && !endDate) {
            setError('Please select at least a Report Start Date or Report End Date.');
            return;
        }

        const today = new Date();
        if (startDate && startDate > today) {
            setError('Report Start Date cannot be in the future.');
            return;
        }
        if (endDate && endDate > today) {
            setError('Report End Date cannot be in the future.');
            return;
        }
        if (startDate && endDate && endDate < startDate) {
            setError('Report End Date cannot be before Report Start Date.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate.toISOString().split('T')[0]);
            if (endDate) params.append('endDate', endDate.toISOString().split('T')[0]);
            const response = await fetch(`/api/admin/medicare-companion/medicare-companion-audit/daily-report?${params.toString()}`);

            if (!response.ok) {
                const data = await response.json();
                const msg = data.message || data.error || '';
                setError(msg || 'Failed to generate report');
                return;
            }

            const contentType = response.headers.get('content-type') || '';

            if (contentType.includes('application/json')) {
                const data = await response.json();
                const msg = data.message || '';
                if (msg.toLowerCase().includes('no records found')) {
                    setError('No records found for this date.');
                    return;
                }
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const startStr = startDate ? startDate.toISOString().split('T')[0] : '';
                const endStr = endDate ? endDate.toISOString().split('T')[0] : '';
                a.download = `summary_report_${startStr || endStr}.json`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
            } else {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const disposition = response.headers.get('content-disposition') || '';
                const filenameMatch = disposition.match(/filename="?(.+?)"?$/);
                const startStr = startDate ? startDate.toISOString().split('T')[0] : '';
                const endStr = endDate ? endDate.toISOString().split('T')[0] : '';
                const filename = filenameMatch ? filenameMatch[1] : `summary_report_${startStr || endStr}.csv`;

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
                    name: 'downloadSummaryReport',
                    detail: { startDate: startDate?.toISOString().split('T')[0], endDate: endDate?.toISOString().split('T')[0] }
                }
            }));
            router.push('/medicare-companion/admin/medicare-companion-audit/activity-feed');
        } catch (err) {
            console.error('Error downloading report:', err);
            setError('An error occurred while downloading the report. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSkipToActivityFeed = () => {
        router.push('/medicare-companion/admin/medicare-companion-audit/activity-feed');
    };

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                p: 4,
                bgcolor: 'background.default',
            }}
        >
            <Box
                sx={{
                    maxWidth: 800,
                    width: '100%',
                }}
            >
                <Box sx={{ textAlign: 'center', mb: 4 }}>
                    <CalendarIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                    <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
                        Summary Report
                    </Typography>
                </Box>

                <Divider sx={{ mb: 4 }} />

                {error && (
                    <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
                        {error}
                    </Alert>
                )}

                <Stack spacing={3}>
                    <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Select a date range to generate the audit summary report:
                        </Typography>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <Stack spacing={2}>
                                <DatePicker
                                    label="Report Start Date"
                                    value={startDate}
                                    onChange={(newValue) => setStartDate(newValue)}
                                    slotProps={{
                                        textField: { size: 'medium', fullWidth: true },
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
                                    label="Report End Date"
                                    value={endDate}
                                    onChange={(newValue) => setEndDate(newValue)}
                                    slotProps={{
                                        textField: { size: 'medium', fullWidth: true },
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
                            </Stack>
                        </LocalizationProvider>
                    </Box>

                    <Button
                        variant="contained"
                        size="large"
                        onClick={handleDownloadReport}
                        disabled={loading || (!startDate && !endDate)}
                        startIcon={loading ? <CircularProgress size={20} /> : <DownloadIcon />}
                        fullWidth
                        sx={{ py: 1.5 }}
                    >
                        {loading ? 'Generating Report...' : 'Download Report'}
                    </Button>

                    <Divider>
                        <Typography variant="caption" color="text.secondary">
                            OR
                        </Typography>
                    </Divider>

                    <Button
                        variant="outlined"
                        size="large"
                        onClick={handleSkipToActivityFeed}
                        disabled={loading}
                        endIcon={<ChevronRightIcon />}
                        fullWidth
                        sx={{ py: 1.5 }}
                    >
                        Skip to User Activity Feed
                    </Button>
                </Stack>

                <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                        <strong>Note:</strong> The summary report provides an overview of all Medicare Companion activities for the selected date range.
                        Use the User Activity Feed for detailed case-specific interaction history.
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
};

export default DailySummaryReport;
