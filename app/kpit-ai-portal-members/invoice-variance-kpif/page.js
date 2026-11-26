'use client';

import React, { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Card,
  CardContent,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

export default function InvoiceVarianceKPIF() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
      setExtractedData(null);
    } else {
      setError('Please select a valid PDF file');
      setFile(null);
    }
  };

  const handleExtract = async () => {
    if (!file) {
      setError('Please select a PDF file first');
      return;
    }

    setLoading(true);
    setError(null);
    setExtractedData(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        '/api/kpit-ai-portal-members/invoice-variance-kpif/extract-pdf',
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to extract PDF');
      }

      const data = await response.json();
      setExtractedData(data);
    } catch (err) {
      setError(err.message || 'An error occurred while extracting the PDF');
      console.error('PDF extraction error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        maxWidth: 900,
        margin: '0 auto',
        padding: 3,
        borderRadius: 2,
        mt: 2
      }}
    >
      <Typography
        variant="h4"
        component="h1"
        sx={{ marginBottom: 3, fontWeight: 'bold' }}
      >
        Invoice Data Extraction
      </Typography>

      {/* Upload Section */}
      <Paper
        elevation={2}
        sx={{
          padding: 3,
          marginBottom: 3,
          textAlign: 'center',
        }}
      >
        <Typography variant="h6" sx={{ marginBottom: 2 }}>
          Upload a PDF Invoice
        </Typography>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            marginBottom: 2,
          }}
        >
          <Button
            variant="action"
            component="label"
            startIcon={<CloudUploadIcon />}
          >
            Choose PDF File
            <input
              hidden
              accept="application/pdf"
              type="file"
              onChange={handleFileChange}
            />
          </Button>

          {file && (
            <Typography variant="body2" sx={{ color: 'grey.600' }}>
              {file.name}
            </Typography>
          )}
        </Box>

        <Button
          variant="primary"
          onClick={handleExtract}
          disabled={!file || loading}
          sx={{ marginTop: 1 }}
        >
          {loading ? (
            <>
              <CircularProgress size={20} sx={{ marginRight: 1 }} />
              Extracting...
            </>
          ) : (
            'Extract Data'
          )}
        </Button>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ marginBottom: 3 }}>
          {error}
        </Alert>
      )}

      {/* Extracted Data Display */}
      {extractedData && (
        <Card elevation={3}>
          <CardContent>
            <Typography
              variant="h6"
              sx={{ marginBottom: 2, fontWeight: 'bold' }}
            >
              Extracted Data
            </Typography>
            <Box
              component="pre"
              sx={{
                backgroundColor: '#282c34',
                color: '#61dafb',
                padding: 2,
                borderRadius: 1,
                overflow: 'auto',
                fontSize: '12px',
                fontFamily: '"Courier New", monospace',
                maxHeight: 400,
              }}
            >
              {JSON.stringify(extractedData, null, 2)}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!extractedData && !error && !loading && (
        <Paper
          sx={{
            padding: 3,
            textAlign: 'center',
            borderRadius: 2,
            border: '1px dashed',
            borderColor: 'grey.400',
          }}
        >
          <Typography variant="body2" sx={{ color: 'grey.600' }}>
            Upload a PDF invoice and click "Extract Data" to see results
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
