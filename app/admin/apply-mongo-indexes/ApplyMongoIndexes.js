'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { applyMongoIndexes } from '@/app/clientServices/mongoIndexService';

const REQUIRED_FIELDS_TEXT = 'Each JSONL object must include: databaseName, collectionName, name, and key.';
const EXAMPLE_PLACEHOLDER = '{"databaseName":"team-bcs-db","collectionName":"NPS_SCORECARD","name":"S_NO_1","key":{"S_NO":1},"options":{}}';

export default function ApplyMongoIndexes() {
  const [indexData, setIndexData] = useState('');
  const [targetDatabaseName, setTargetDatabaseName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState(null);

  const hasInput = useMemo(() => indexData.trim().length > 0, [indexData]);

  const handleSubmit = async (dryRun) => {
    setSubmitError('');
    setResult(null);

    if (!hasInput) {
      setSubmitError('Index data is required. Paste JSONL content into the text area.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await applyMongoIndexes(indexData, dryRun, targetDatabaseName.trim());
      setResult(response);
    } catch (error) {
      setSubmitError(error.message || 'Failed to apply indexes.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Alert severity="info" sx={{ mb: 2 }}>
        Indexes are applied to existing collections without recreating them. New collections and their indexes
        are created together using Azure Cosmos DB for MongoDB. Provider restrictions and index conflicts may prevent some indexes from being applied.
      </Alert>
      <Box sx={{ maxWidth: 1100 }}>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Paste index data in JSONL format (one JSON object per line). {REQUIRED_FIELDS_TEXT}
        </Typography>

        <Paper variant="outlined" sx={{ p: 3 }}>
          {submitError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSubmitError('')}>
              {submitError}
            </Alert>
          )}

          {result && (
            <Alert
              severity={result.success ? 'success' : 'warning'}
              sx={{ mb: 2 }}
              onClose={() => setResult(null)}
            >
              {result.dryRun
                ? 'Dry run complete. Review validation results before applying.'
                : result.success
                  ? 'Indexes applied successfully.'
                  : 'Index application completed with validation or application errors.'}
            </Alert>
          )}

          <TextField
            label="Target Database (optional)"
            fullWidth
            value={targetDatabaseName}
            onChange={(event) => setTargetDatabaseName(event.target.value)}
            disabled={isSubmitting}
            helperText="Defaults to databaseName in each JSONL record."
            sx={{ mb: 3 }}
          />

          <TextField
            label="Index Data (JSONL)"
            multiline
            minRows={14}
            fullWidth
            value={indexData}
            onChange={(event) => setIndexData(event.target.value)}
            placeholder={EXAMPLE_PLACEHOLDER}
            disabled={isSubmitting}
            helperText={REQUIRED_FIELDS_TEXT}
            slotProps={{
              input: { sx: { fontFamily: 'monospace', fontSize: '0.875rem' } },
            }}
          />

          <Box sx={{ mt: 2, display: 'flex', gap: 1.5 }}>
            <Button
              variant="secondary"
              disabled={isSubmitting || !hasInput}
              onClick={() => handleSubmit(true)}
            >
              Validate (Dry Run)
            </Button>

            <Button
              variant="primary"
              disabled={isSubmitting || !hasInput}
              onClick={() => handleSubmit(false)}
              startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : null}
            >
              {isSubmitting ? 'Applying...' : 'Apply Indexes'}
            </Button>
          </Box>
        </Paper>

        {result && (
          <Paper variant="outlined" sx={{ mt: 3, p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Summary
            </Typography>

            <Typography variant="body2">Total lines: {result.summary?.totalLines ?? 0}</Typography>
            <Typography variant="body2">Valid indexes: {result.summary?.validIndexes ?? 0}</Typography>
            <Typography variant="body2">Invalid indexes: {result.summary?.invalidIndexes ?? 0}</Typography>
            <Typography variant="body2">Ready to apply: {result.summary?.readyToApply ?? 0}</Typography>
            <Typography variant="body2">Collections created: {result.summary?.createdCollectionsCount ?? 0}</Typography>
            <Typography variant="body2">Applied: {result.summary?.appliedCount ?? 0}</Typography>
            <Typography variant="body2">Failed: {result.summary?.failedCount ?? 0}</Typography>

            {Array.isArray(result.validationErrors) && result.validationErrors.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Validation Errors
                </Typography>
                <Box component="ul" sx={{ mt: 0, pl: 2.5 }}>
                  {result.validationErrors.map((item) => (
                    <li key={`validation-${item.line}-${item.error}`}>
                      <Typography variant="body2">{item.error}</Typography>
                    </li>
                  ))}
                </Box>
              </Box>
            )}

            {Array.isArray(result.results) && result.results.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Results
                </Typography>
                <Box component="ul" sx={{ mt: 0, pl: 2.5, maxHeight: 280, overflow: 'auto' }}>
                  {result.results.map((item) => (
                    <li key={`result-${item.line}-${item.name}-${item.status}`}>
                      <Typography variant="body2">
                        Line {item.line} [{item.status}] {item.databaseName}.{item.collectionName}.{item.name} - {item.message}
                      </Typography>
                    </li>
                  ))}
                </Box>
              </Box>
            )}
          </Paper>
        )}
      </Box>
    </Box>
  );
}
