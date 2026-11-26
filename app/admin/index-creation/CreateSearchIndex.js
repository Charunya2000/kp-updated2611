'use client';

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { createSearchIndex } from '@/app/clientServices/indexCreationService';

function validateIndexDefinition(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: 'Invalid JSON. Please check your input and try again.' };
  }

  if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
    return { error: 'Index definition must be a JSON object.' };
  }

  if (!parsed.name || typeof parsed.name !== 'string') {
    return { error: 'Index definition must include a "name" field (string).' };
  }

  if (!Array.isArray(parsed.fields) || parsed.fields.length === 0) {
    return { error: 'Index definition must include a "fields" array with at least one field.' };
  }

  for (let i = 0; i < parsed.fields.length; i++) {
    const field = parsed.fields[i];
    if (!field || typeof field !== 'object') {
      return { error: `fields[${i}] must be an object.` };
    }
    if (!field.name || typeof field.name !== 'string') {
      return { error: `fields[${i}] is missing a required "name" property (string).` };
    }
    if (!field.type || typeof field.type !== 'string') {
      return { error: `fields[${i}] ("${field.name}") is missing a required "type" property (string).` };
    }
  }

  return { parsed };
}

export default function CreateSearchIndex() {
  const [jsonInput, setJsonInput] = useState('');
  const [validationError, setValidationError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const handleCreate = async () => {
    setValidationError(null);
    setSubmitError(null);
    setSuccessMessage(null);

    const { error, parsed } = validateIndexDefinition(jsonInput);
    if (error) {
      setValidationError(error);
      return;
    }

    setSubmitting(true);
    try {
      const result = await createSearchIndex(parsed);
      setSuccessMessage(`Index "${result.indexName}" was created successfully.`);
      setJsonInput('');
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Alert severity="info" sx={{ mb: 2 }}>
        This tool expects that you will copy an index definition from a lower environment directly from the AI Search index in
        the Azure Portal. You can find this definition under the Edit JSON button.
      </Alert>
      <Box sx={{ maxWidth: 900 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Paste a JSON index definition below. The definition must include a{' '}
          <strong>name</strong> field and a <strong>fields</strong> array where
          each entry has a <strong>name</strong> and <strong>type</strong>.
        </Typography>

        <Paper variant="outlined" sx={{ p: 3 }}>
          {successMessage && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>
              {successMessage}
            </Alert>
          )}

          {submitError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSubmitError(null)}>
              {submitError}
            </Alert>
          )}

          <TextField
            label="Index Definition (JSON)"
            multiline
            minRows={12}
            fullWidth
            value={jsonInput}
            onChange={(e) => {
              setJsonInput(e.target.value);
              if (validationError) setValidationError(null);
            }}
            error={Boolean(validationError)}
            helperText={validationError ?? ' '}
            placeholder={'{\n  "name": "my-index-001",\n  "fields": [\n    { "name": "id", "type": "Edm.String", "key": true }\n  ]\n}'}
            disabled={submitting}
            sx={{ fontFamily: 'monospace' }}
            slotProps={{
              input: { sx: { fontFamily: 'monospace', fontSize: '0.875rem' } },
            }}
          />

          <Box sx={{ mt: 2 }}>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={submitting || !jsonInput.trim()}
              startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
            >
              {submitting ? 'Creating...' : 'Create Index'}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
