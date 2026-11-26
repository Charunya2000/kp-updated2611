'use client';

import React, { useState } from 'react';
import {
    Box,
    Container,
    Typography,
    Paper,
    TextField,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    CircularProgress,
    Alert
} from '@mui/material';

export default function CMPOCPage() {
    const teamName = 'kpit-ai-portal-members';
    const assistantName = 'cm-poc';

    const [rmsCarrier, setRmsCarrier] = useState('');
    const [rmsProgram, setRmsProgram] = useState('');
    const [rmsCmBaseBenefitId, setRmsCmBaseBenefitId] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [hasExecuted, setHasExecuted] = useState(false);

    const handleExecuteQuery = async () => {
        setLoading(true);
        setHasExecuted(true);

        try {
            const response = await fetch(`/api/${teamName}/${assistantName}/query-benefit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    rmsCarrier,
                    rmsProgram,
                    rmsCmBaseBenefitId
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || errorData.error || 'Failed to execute query');
            }

            const data = await response.json();
            setResults(data.results || []);
            setError(null);
        } catch (err) {
            setError(err.message);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            <Box>
                <Typography variant="h4" gutterBottom>
                    CM POC - Benefit Query
                </Typography>

                {/* Query Parameters */}
                <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Query Parameters
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                        <TextField
                            label="RMS Carrier"
                            value={rmsCarrier}
                            onChange={(e) => setRmsCarrier(e.target.value)}
                            size="small"
                            sx={{ minWidth: 200 }}
                        />
                        <TextField
                            label="RMS Program"
                            value={rmsProgram}
                            onChange={(e) => setRmsProgram(e.target.value)}
                            size="small"
                            sx={{ minWidth: 200 }}
                        />
                        <TextField
                            label="RMS CM Base Benefit ID"
                            value={rmsCmBaseBenefitId}
                            onChange={(e) => setRmsCmBaseBenefitId(e.target.value)}
                            size="small"
                            sx={{ minWidth: 250 }}
                        />
                    </Box>

                    <Button
                        variant="contained"
                        onClick={handleExecuteQuery}
                        disabled={loading}
                    >
                        {loading ? <CircularProgress size={24} /> : 'Execute Query'}
                    </Button>
                </Paper>

                {/* Error Display */}
                {error && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                        {error}
                    </Alert>
                )}

                {/* Results Table */}
                {results.length > 0 && (
                    <Paper elevation={2} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="h6" gutterBottom>
                            Results ({results.length} rows)
                        </Typography>

                        <TableContainer
                            sx={{
                                maxHeight: '45vh',
                                minHeight: 300,
                                overflow: 'auto',
                                mt: 2,
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 1
                            }}
                        >
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell
                                            sx={{
                                                fontWeight: 'bold',
                                                backgroundColor: 'grey.100',
                                                color: 'text.primary',
                                                borderBottom: '2px solid',
                                                borderColor: 'divider',
                                                minWidth: 100
                                            }}
                                        >
                                            Region Code
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                fontWeight: 'bold',
                                                backgroundColor: 'grey.100',
                                                color: 'text.primary',
                                                borderBottom: '2px solid',
                                                borderColor: 'divider',
                                                minWidth: 100
                                            }}
                                        >
                                            RMS Carrier
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                fontWeight: 'bold',
                                                backgroundColor: 'grey.100',
                                                color: 'text.primary',
                                                borderBottom: '2px solid',
                                                borderColor: 'divider',
                                                minWidth: 120
                                            }}
                                        >
                                            RMS Program
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                fontWeight: 'bold',
                                                backgroundColor: 'grey.100',
                                                color: 'text.primary',
                                                borderBottom: '2px solid',
                                                borderColor: 'divider',
                                                minWidth: 180
                                            }}
                                        >
                                            RMS CM Base Benefit ID
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                fontWeight: 'bold',
                                                backgroundColor: 'grey.100',
                                                color: 'text.primary',
                                                borderBottom: '2px solid',
                                                borderColor: 'divider',
                                                minWidth: 200
                                            }}
                                        >
                                            Short Description
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                fontWeight: 'bold',
                                                backgroundColor: 'grey.100',
                                                color: 'text.primary',
                                                borderBottom: '2px solid',
                                                borderColor: 'divider',
                                                minWidth: 300
                                            }}
                                        >
                                            Long Description
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                fontWeight: 'bold',
                                                backgroundColor: 'grey.100',
                                                color: 'text.primary',
                                                borderBottom: '2px solid',
                                                borderColor: 'divider',
                                                minWidth: 150
                                            }}
                                        >
                                            Effective Start Date
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                fontWeight: 'bold',
                                                backgroundColor: 'grey.100',
                                                color: 'text.primary',
                                                borderBottom: '2px solid',
                                                borderColor: 'divider',
                                                minWidth: 150
                                            }}
                                        >
                                            Effective End Date
                                        </TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {results.map((row, index) => (
                                        <TableRow
                                            key={index}
                                            sx={{
                                                '&:nth-of-type(odd)': { backgroundColor: 'action.hover' },
                                                '&:hover': { backgroundColor: 'action.selected' }
                                            }}
                                        >
                                            <TableCell sx={{ borderRight: '1px solid', borderColor: 'divider' }}>
                                                {row.REGION_CODE}
                                            </TableCell>
                                            <TableCell sx={{ borderRight: '1px solid', borderColor: 'divider' }}>
                                                {row.RMS_CARRIER}
                                            </TableCell>
                                            <TableCell sx={{ borderRight: '1px solid', borderColor: 'divider' }}>
                                                {row.RMS_PROGRAM}
                                            </TableCell>
                                            <TableCell sx={{ borderRight: '1px solid', borderColor: 'divider' }}>
                                                {row.RMS_CM_BASE_BENEFIT_ID}
                                            </TableCell>
                                            <TableCell sx={{ borderRight: '1px solid', borderColor: 'divider' }}>
                                                {row.RMS_BENEFIT_SHORT_DESCRIPTION}
                                            </TableCell>
                                            <TableCell
                                                sx={{
                                                    whiteSpace: 'normal',
                                                    wordBreak: 'break-word',
                                                    borderRight: '1px solid',
                                                    borderColor: 'divider'
                                                }}
                                            >
                                                {row.RMS_BENEFIT_LONG_DESCRIPTION}
                                            </TableCell>
                                            <TableCell sx={{ borderRight: '1px solid', borderColor: 'divider' }}>
                                                {row.EFFECTIVE_START_DATE}
                                            </TableCell>
                                            <TableCell>
                                                {row.EFFECTIVE_END_DATE}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                )}

                {!loading && results.length === 0 && !error && !hasExecuted && (
                    <Paper elevation={1} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="body1" color="text.secondary" align="center">
                            No query executed yet.
                        </Typography>
                    </Paper>
                )}

                {!loading && results.length === 0 && !error && hasExecuted && (
                    <Paper elevation={1} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="body1" color="text.secondary" align="center">
                            No results found for the given parameters.
                        </Typography>
                    </Paper>
                )}
            </Box>
        </Container>
    );
}
