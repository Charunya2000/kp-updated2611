'use client';

import { useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    FormControlLabel,
    MenuItem,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import { fetchWorkbookSheets, generateCasaData } from '@/app/clientServices/casaAssistantService';

const PENDING_MESSAGE = 'Hold on while I generate that file for you';
const SUCCESS_MESSAGE = 'The file has been generated, your download should automatically start soon';

export default function CasaAssistant() {
    const theme = useTheme();
    const fileInputRef = useRef(null);
    const [file, setFile] = useState(null);
    const [worksheets, setWorksheets] = useState([]);
    const [selectedWorksheet, setSelectedWorksheet] = useState('');
    const [universe, setUniverse] = useState('');
    const [maxRows, setMaxRows] = useState('');
    const [rowPerTestCase, setRowPerTestCase] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [status, setStatus] = useState(null);

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const selectFile = (selectedFile) => {
        if (!selectedFile) return;

        if (!selectedFile.name.toLowerCase().endsWith('.xlsx')) {
            setStatus({ severity: 'error', message: 'Only .xlsx files are supported' });
            return;
        }

        setFile(selectedFile);
        setWorksheets([]);
        setSelectedWorksheet('');
        setUniverse('');
        setStatus(null);

        fetchWorkbookSheets(selectedFile).then(setWorksheets);
    };

    const handleFileChange = (event) => {
        const selectedFile = event.target.files?.[0];
        event.target.value = '';
        selectFile(selectedFile);
    };

    const handleDragOver = (event) => {
        event.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => setIsDragging(false);

    const handleDrop = (event) => {
        event.preventDefault();
        setIsDragging(false);
        selectFile(event.dataTransfer.files?.[0]);
    };

    const handleRemoveFile = () => {
        setFile(null);
        setWorksheets([]);
        setSelectedWorksheet('');
        setUniverse('');
        setStatus(null);
    };

    const selectedWorksheetData = worksheets.find(worksheet => worksheet.name === selectedWorksheet);
    const universes = selectedWorksheetData?.universes || [];

    const handleGenerate = async () => {
        const trimmedUniverse = universe.trim();

        setIsGenerating(true);
        setStatus({ severity: 'info', message: PENDING_MESSAGE });

        try {
            const { blob, fileName } = await generateCasaData({
                file,
                maxRows: Number(maxRows),
                rowPerTestCase,
                tabName: selectedWorksheet,
                universe: trimmedUniverse,
            });

            setStatus({ severity: 'success', message: SUCCESS_MESSAGE });
            triggerDownload(blob, fileName);
        } catch (error) {
            setStatus({ severity: 'error', message: error.message });
        } finally {
            setIsGenerating(false);
        }
    };

    const isMaxRowsValid = Number.isInteger(Number(maxRows)) && Number(maxRows) > 0;
    const canGenerate = Boolean(file) && Boolean(selectedWorksheet) && (rowPerTestCase || isMaxRowsValid)
        && universe.trim().length > 0 && !isGenerating;

    return (
        <Box
            sx={{
                px: { xs: 1, sm: 4 },
                py: 3,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '90dvh',
                overflowY: 'auto',
            }}
        >
            <Box
                sx={{
                    width: '100%',
                    maxWidth: 700,
                    p: { xs: 2, sm: 4 },
                    border: `2px solid ${theme.palette.color.graphiteDeep}`,
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                }}
            >
                <Typography variant="h4" sx={{ fontWeight: 'bold', textAlign: 'center', mb: 3 }}>
                    CASA Assistant
                </Typography>

                <Box
                    onClick={handleUploadClick}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    sx={{
                        border: '2px dashed',
                        borderColor: isDragging ? 'primary.main' : 'grey.500',
                        backgroundColor: isDragging ? 'action.hover' : 'transparent',
                        borderRadius: '8px',
                        padding: 2,
                        mb: 3,
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                    }}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        hidden
                        accept=".xlsx"
                        onChange={handleFileChange}
                    />
                    <CloudUploadOutlinedIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
                    <Typography variant="subtitle1">Upload a CASA Source File</Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
                        Click or drag a file to upload
                    </Typography>
                    <Typography variant="caption" display="block" sx={{ mt: 1, fontSize: '0.75rem' }}>
                        Supported file type: .xlsx &nbsp;|&nbsp; One file only
                    </Typography>

                    {file && (
                        <Box
                            sx={{
                                mt: 2,
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                p: 1,
                                bgcolor: 'background.default',
                                borderRadius: 1,
                            }}
                        >
                            <Typography variant="body2">
                                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                            </Typography>
                            <Button
                                size="small"
                                color="error"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    handleRemoveFile();
                                }}
                            >
                                Remove
                            </Button>
                        </Box>
                    )}
                </Box>

                <Stack spacing={2} sx={{ mb: 3, mx: 'auto', width: '100%', maxWidth: 360 }}>
                    <FormControlLabel
                        control={(
                            <Checkbox
                                checked={rowPerTestCase}
                                onChange={(event) => setRowPerTestCase(event.target.checked)}
                            />
                        )}
                        label="Output enough rows to generate a row-per-test-case for each field"
                    />
                    <TextField
                        label="Max Rows"
                        type="number"
                        size="small"
                        value={maxRows}
                        disabled={rowPerTestCase}
                        onChange={(event) => setMaxRows(event.target.value)}
                        helperText="How many rows to generate"
                        slotProps={{ htmlInput: { min: 1, step: 1 } }}
                    />

                    <TextField
                        select
                        label="Excel Tab"
                        size="small"
                        value={selectedWorksheet}
                        onChange={(event) => {
                            setSelectedWorksheet(event.target.value);
                            setUniverse('');
                        }}
                        disabled={!worksheets.length}
                        helperText={worksheets.length
                            ? 'Select a worksheet from the Excel file'
                            : 'Upload an Excel file to choose a worksheet'}
                    >
                        {worksheets.map((worksheet) => (
                            <MenuItem key={worksheet.name} value={worksheet.name}>
                                {worksheet.name}
                            </MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        select
                        label="Universe"
                        size="small"
                        value={universe}
                        onChange={(event) => setUniverse(event.target.value)}
                        disabled={!universes.length}
                        helperText={universes.length
                            ? 'Select a universe from the chosen worksheet'
                            : 'Select a worksheet with a Universe column'}
                    >
                        {universes.map((universeName) => (
                            <MenuItem key={universeName} value={universeName}>
                                {universeName}
                            </MenuItem>
                        ))}
                    </TextField>
                </Stack>

                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 2 }}>
                    <Button
                        variant="primary"
                        size="large"
                        onClick={handleGenerate}
                        disabled={!canGenerate}
                        startIcon={isGenerating ? <CircularProgress size={16} color="inherit" /> : null}
                    >
                        Generate Data
                    </Button>
                </Box>

                {status && (
                    <Alert severity={status.severity} sx={{ mt: 2 }}>{status.message}</Alert>
                )}
            </Box>
        </Box>
    );
}

function triggerDownload(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
