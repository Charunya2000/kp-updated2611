'use client';

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Typography,
} from '@mui/material';
import { FileDownload } from '@mui/icons-material';
import { exportUserNuidsCsv } from '@/app/clientServices/dataExtractsService';

export default function DataExtracts() {
  const [nuidsExporting, setNuidsExporting] = useState(false);
  const [nuidsError, setNuidsError] = useState(null);
  const [nuidsSuccess, setNuidsSuccess] = useState(false);

  const handleExportUserNuids = async () => {
    setNuidsExporting(true);
    setNuidsError(null);
    setNuidsSuccess(false);

    try {
      await exportUserNuidsCsv();
      setNuidsSuccess(true);
    } catch (error) {
      setNuidsError(error.message || 'Export failed. Please try again.');
    } finally {
      setNuidsExporting(false);
    }
  };

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Alert severity="info">
        Use these tools to export data from the platform databases as CSV files for reporting or offline analysis.
      </Alert>

      {/* ── User NUIDs ── */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
          Export User NUIDs
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Exports a CSV with one column (<strong>NUID</strong>) containing every unique NUID found in the Application Database.
          Results are sorted alphabetically and deduplicated.
        </Typography>

        {nuidsError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setNuidsError(null)}>
            {nuidsError}
          </Alert>
        )}

        {nuidsSuccess && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNuidsSuccess(false)}>
            Export complete — your download should begin automatically.
          </Alert>
        )}

        <Button
          variant="primary"
          startIcon={nuidsExporting ? <CircularProgress size={16} color="inherit" /> : <FileDownload />}
          disabled={nuidsExporting}
          onClick={handleExportUserNuids}
        >
          {nuidsExporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </Paper>
    </Box>
  );
}
