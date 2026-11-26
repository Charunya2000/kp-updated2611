'use client';

import {
    Drawer,
    TextField,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Box,
    Stack,
    Chip,
    OutlinedInput,
    Divider,
    IconButton,
    Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useState, useEffect } from 'react';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

const EXCHANGE_CODES = ['GEO', 'COL', 'KNW', 'MAS', 'CAL', 'HAW', 'WAS', 'NEV'];
const FILE_TYPES = ['834', 'AIR', 'IC834'];

const buildCoverageYears = () => {
    const base = ['1994', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026', '2027', '2031', '9999'];
    const nextYear = String(new Date().getFullYear() + 1);
    if (!base.includes(nextYear)) {
        // Insert next year before the special trailing years (2031, 9999)
        const insertIndex = base.indexOf('2031');
        if (insertIndex !== -1) {
            base.splice(insertIndex, 0, nextYear);
        } else {
            base.push(nextYear);
        }
    }
    return base;
};
const COVERAGE_YEARS = buildCoverageYears();

// Helper function to get date in YYYY-MM-DD format
const getFormattedDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Get default dates: end date = today, start date = today - 1 year
const getDefaultDates = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);
    return {
        startDate: getFormattedDate(startDate),
        endDate: getFormattedDate(endDate),
    };
};

export default function EpdsFilterModal({ open, onClose, onSubmit, onClear, initialData }) {
    const [formData, setFormData] = useState(() => {
        const defaultDates = getDefaultDates();
        return {
            exchangeSubscriberId: '',
            policyId: '',
            exchange: '',
            coverageYear: [String(new Date().getFullYear())],
            startFileReceiveDate: defaultDates.startDate,
            endFileReceiveDate: defaultDates.endDate,
            fileTypes: ['834'],
            queryText: '',
            filter: 'latest',
        };
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (open) {
            const defaultDates = getDefaultDates();
            if (initialData && initialData.criteria) {
                setFormData(prevState => ({
                    ...prevState,
                    ...initialData.criteria,
                    startFileReceiveDate: initialData.criteria.startFileReceiveDate || defaultDates.startDate,
                    endFileReceiveDate: initialData.criteria.endFileReceiveDate || defaultDates.endDate,
                }));
            } else {
                // Reset to default dates when opening drawer without initial data
                setFormData(prev => ({
                    ...prev,
                    startFileReceiveDate: defaultDates.startDate,
                    endFileReceiveDate: defaultDates.endDate,
                }));
            }
        }
    }, [initialData, open]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleExchangeChange = (e) => {
        setFormData(prev => ({
            ...prev,
            exchange: e.target.value,
        }));
    };

    const handleCoverageYearChange = (e) => {
        const { value } = e.target;
        setFormData(prev => ({
            ...prev,
            coverageYear: Array.isArray(value) ? value : [value],
        }));
    };

    const handleFileTypesChange = (e) => {
        const { value } = e.target;
        setFormData(prev => ({
            ...prev,
            fileTypes: Array.isArray(value) ? value : [value],
        }));
    };

    const handleCoverageYearDelete = (yearToDelete) => {
        setFormData(prev => ({
            ...prev,
            coverageYear: prev.coverageYear.filter(year => year !== yearToDelete),
        }));
    };

    const handleFileTypeDelete = (typeToDelete) => {
        setFormData(prev => ({
            ...prev,
            fileTypes: prev.fileTypes.filter(type => type !== typeToDelete),
        }));
    };

    const handleStartDateChange = (newValue) => {
        const startDate = newValue ? getFormattedDate(newValue) : '';
        setFormData(prev => {
            const nextEndDate = prev.endFileReceiveDate && prev.endFileReceiveDate < startDate
                ? startDate
                : prev.endFileReceiveDate;

            return {
                ...prev,
                startFileReceiveDate: startDate,
                endFileReceiveDate: nextEndDate,
            };
        });
    };

    const handleEndDateChange = (newValue) => {
        const endDate = newValue ? getFormattedDate(newValue) : '';
        setFormData(prev => ({
            ...prev,
            endFileReceiveDate: endDate,
        }));
    };

    const handleSubmit = async () => {
        try {
            setError(null);
            setLoading(true);

            // Validate required fields
            if (!formData.exchange) {
                setError('Please fill in required field: Exchange');
                return;
            }

            if (!formData.startFileReceiveDate || !formData.endFileReceiveDate) {
                setError('Please select both start and end dates');
                return;
            }

            const hasSubscriptionId = Boolean(formData.exchangeSubscriberId?.trim());
            const hasPolicyId = Boolean(formData.policyId?.trim());
            if (!hasSubscriptionId && !hasPolicyId) {
                setError('Either Subscription ID or Policy ID is required');
                return;
            }

            await onSubmit(formData);
            onClose();
        } catch (err) {
            setError(err.message || 'An error occurred while submitting the filter');
        } finally {
            setLoading(false);
        }
    };

    const handleClear = async () => {
        try {
            setError(null);
            setLoading(true);
            if (onClear) {
                await onClear();
            }

            const defaultDates = getDefaultDates();
            setFormData({
                exchangeSubscriberId: '',
                policyId: '',
                exchange: '',
                coverageYear: [],
                startFileReceiveDate: defaultDates.startDate,
                endFileReceiveDate: defaultDates.endDate,
                fileTypes: ['834'],
                queryText: '',
                filter: 'latest',
            });
        } catch (err) {
            setError(err.message || 'An error occurred while clearing the filter');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            sx={{
                '& .MuiDrawer-paper': {
                    width: 400,
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                }
            }}
        >
            {/* Header */}
            <Box sx={{
                p: 2,
                borderBottom: 1,
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
            }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>EPDS Filters</Typography>
                <IconButton
                    onClick={onClose}
                    size="small"
                    disabled={loading}
                >
                    <CloseIcon />
                </IconButton>
            </Box>

            {/* Content */}
            <Box sx={{
                flex: 1,
                overflow: 'auto',
                p: 2,
            }}>
                {error && (
                    <Box
                        sx={{
                            mb: 2,
                            p: 1.5,
                            bgcolor: '#ffebee',
                            color: '#c62828',
                            borderRadius: 1,
                            fontSize: '0.875rem',
                        }}
                    >
                        {error}
                    </Box>
                )}

                <Stack spacing={2.5}>
                    {/* Exchange */}
                    <FormControl fullWidth size="small">
                        <InputLabel>Exchange</InputLabel>
                        <Select
                            name="exchange"
                            value={formData.exchange}
                            onChange={handleExchangeChange}
                            label="Exchange"
                        >
                            {EXCHANGE_CODES.map(code => (
                                <MenuItem key={code} value={code}>
                                    {code}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* File Receive Dates - Stacked Vertically */}
                    <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            File Received dates
                        </Typography>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <Stack direction="column" spacing={1}>
                                <DatePicker
                                    label="File received start date"
                                    value={formData.startFileReceiveDate ? new Date(formData.startFileReceiveDate + 'T00:00:00') : null}
                                    onChange={handleStartDateChange}
                                    format="yyyy-MM-dd"
                                    maxDate={formData.endFileReceiveDate ? new Date(formData.endFileReceiveDate + 'T00:00:00') : undefined}
                                    slotProps={{
                                        textField: {
                                            size: 'small',
                                            fullWidth: true,
                                        }
                                    }}
                                />
                                <DatePicker
                                    label="File received end date"
                                    value={formData.endFileReceiveDate ? new Date(formData.endFileReceiveDate + 'T00:00:00') : null}
                                    onChange={handleEndDateChange}
                                    format="yyyy-MM-dd"
                                    minDate={formData.startFileReceiveDate ? new Date(formData.startFileReceiveDate + 'T00:00:00') : undefined}
                                    disabled={!formData.startFileReceiveDate}
                                    slotProps={{
                                        textField: {
                                            size: 'small',
                                            fullWidth: true,
                                            helperText: !formData.startFileReceiveDate ? 'Select start date first' : '',
                                        }
                                    }}
                                />
                            </Stack>
                        </LocalizationProvider>
                    </Box>

                    {/* Coverage Year */}
                    <FormControl fullWidth size="small">
                        <InputLabel>Coverage year</InputLabel>
                        <Select
                            multiple
                            name="coverageYear"
                            value={formData.coverageYear}
                            onChange={handleCoverageYearChange}
                            input={<OutlinedInput label="Coverage year" />}
                            renderValue={(selected) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {selected.map((value) => (
                                        <Chip key={value} label={value} size="small" />
                                    ))}
                                </Box>
                            )}
                        >
                            {COVERAGE_YEARS.map(year => (
                                <MenuItem key={year} value={year}>
                                    {year}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* File Types */}
                    <FormControl fullWidth size="small">
                        <InputLabel>File types</InputLabel>
                        <Select
                            multiple
                            name="fileTypes"
                            value={formData.fileTypes}
                            onChange={handleFileTypesChange}
                            input={<OutlinedInput label="File types" />}
                            renderValue={(selected) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {selected.map((value) => (
                                        <Chip key={value} label={value} size="small" />
                                    ))}
                                </Box>
                            )}
                        >
                            {FILE_TYPES.map(type => (
                                <MenuItem key={type} value={type}>
                                    {type}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Policy ID */}
                    <TextField
                        label="Policy ID"
                        name="policyId"
                        value={formData.policyId}
                        onChange={handleInputChange}
                        fullWidth
                        size="small"
                    />

                    {/* Subscriber exchange ID */}
                    <TextField
                        label="Subscriber exchange ID"
                        name="exchangeSubscriberId"
                        value={formData.exchangeSubscriberId}
                        onChange={handleInputChange}
                        fullWidth
                        size="small"
                    />

                    {/* Placeholder text */}
                    <Typography variant="caption" color="textSecondary">
                        Placeholder for any any instructions can go here
                    </Typography>
                </Stack>
            </Box>

            {/* Footer with Buttons */}
            <Box sx={{
                p: 2,
                borderTop: 1,
                borderColor: 'divider',
                display: 'flex',
                gap: 1,
                justifyContent: 'flex-end',
                flexShrink: 0,
            }}>
                <Button
                    variant="action"
                    onClick={handleClear}
                    disabled={loading}
                >
                    Reset
                </Button>
                <Button
                    variant="primary"
                    onClick={handleSubmit}
                    disabled={loading}
                >
                    {loading ? 'Submitting...' : 'Submit'}
                </Button>
            </Box>
        </Drawer>
    );
}
