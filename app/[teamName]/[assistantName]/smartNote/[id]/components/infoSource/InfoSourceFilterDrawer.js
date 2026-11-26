'use client';

import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material';

const DATE_BUCKET_OPTIONS = [
  { value: 'any', label: 'Any time' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'last3Months', label: 'Last 3 months' },
  { value: 'last6Months', label: 'Last 6 months' },
  { value: 'thisYear', label: 'This year' },
  { value: 'lastYear', label: 'Last year' }
];

const CONTENT_TYPE_OPTIONS = [
  { value: 'both', label: 'Assets and Pages' },
  { value: 'asset', label: 'Assets only' },
  { value: 'page', label: 'Pages only' }
];

function toCsv(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return '';
  }
  return values.join(', ');
}

function fromCsv(text) {
  return String(text || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function InfoSourceFilterDrawer({
  open,
  onClose,
  filters,
  onChange,
  onReset,
  hasCitationSeed
}) {
  const [titleInput, setTitleInput] = useState(filters.title || '');
  const [ownersInput, setOwnersInput] = useState(toCsv(filters.owners));
  const [marketsInput, setMarketsInput] = useState(toCsv(filters.markets));
  const [keywordsInput, setKeywordsInput] = useState(toCsv(filters.keywords));

  useEffect(() => {
    setTitleInput(filters.title || '');
    setOwnersInput(toCsv(filters.owners));
    setMarketsInput(toCsv(filters.markets));
    setKeywordsInput(toCsv(filters.keywords));
  }, [filters.title, filters.owners, filters.markets, filters.keywords]);

  const activeCount = [
    filters.title,
    filters.owners?.length,
    filters.markets?.length,
    filters.keywords?.length,
    filters.updatedBucket !== 'any',
    filters.contentType !== 'both',
    filters.useCitationSeed
  ].filter(Boolean).length;

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100vw', sm: 420 },
          p: 2,
          borderTopRightRadius: 14,
          borderBottomRightRadius: 14
        }
      }}
    >
      <Stack spacing={2} sx={{ height: '100%' }}>
        <Box>
          <Typography variant="h5">Citation Filters</Typography>
          <Typography variant="body2" color="text.secondary">
            Keep filters configured and toggle them on or off per question.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center">
          <FormControlLabel
            control={
              <Switch
                checked={!!filters.enabled}
                onChange={(event) => onChange({ enabled: event.target.checked })}
              />
            }
            label="Enable citation  filtering"
          />
          {activeCount > 0 && <Chip size="small" label={`${activeCount} active`} />}
        </Stack>

        <Divider />

        <TextField
          label="Content type"
          select
          SelectProps={{ native: true }}
          value={filters.contentType}
          onChange={(event) => onChange({ contentType: event.target.value })}
          fullWidth
          disabled={!filters.enabled}
        >
          {CONTENT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </TextField>

        <TextField
          label="Title contains"
          value={titleInput}
          onChange={(event) => {
            const nextValue = event.target.value;
            setTitleInput(nextValue);
            onChange({ title: nextValue });
          }}
          onBlur={() => onChange({ title: titleInput })}
          fullWidth
          disabled={!filters.enabled}
        />

        <TextField
          label="Owners (comma separated)"
          value={ownersInput}
          onChange={(event) => {
            const nextValue = event.target.value;
            setOwnersInput(nextValue);
            onChange({ owners: fromCsv(nextValue) });
          }}
          onBlur={() => onChange({ owners: fromCsv(ownersInput) })}
          fullWidth
          disabled={!filters.enabled}
        />

        <TextField
          label="Markets (comma separated)"
          value={marketsInput}
          onChange={(event) => {
            const nextValue = event.target.value;
            setMarketsInput(nextValue);
            onChange({ markets: fromCsv(nextValue) });
          }}
          onBlur={() => onChange({ markets: fromCsv(marketsInput) })}
          fullWidth
          disabled={!filters.enabled}
        />

        <TextField
          label="Keywords (comma separated)"
          value={keywordsInput}
          onChange={(event) => {
            const nextValue = event.target.value;
            setKeywordsInput(nextValue);
            onChange({ keywords: fromCsv(nextValue) });
          }}
          onBlur={() => onChange({ keywords: fromCsv(keywordsInput) })}
          fullWidth
          disabled={!filters.enabled}
        />

        <TextField
          label="Last updated"
          select
          SelectProps={{ native: true }}
          value={filters.updatedBucket}
          onChange={(event) => onChange({ updatedBucket: event.target.value })}
          fullWidth
          disabled={!filters.enabled}
        >
          {DATE_BUCKET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </TextField>

        <FormControlLabel
          control={
            <Switch
              checked={!!filters.useCitationSeed}
              onChange={(event) => onChange({ useCitationSeed: event.target.checked })}
              disabled={!filters.enabled || !hasCitationSeed}
            />
          }
          label="Use citations from last response"
        />

        {!hasCitationSeed && (
          <Typography variant="caption" color="text.secondary">
            Run a prompt first to seed filters from citations.
          </Typography>
        )}

        <Box sx={{ mt: 'auto', display: 'flex', gap: 1 }}>
          <Button variant="secondary" onClick={onReset}>Reset</Button>
          <Button variant="primary" onClick={onClose}>Done</Button>
        </Box>
      </Stack>
    </Drawer>
  );
}

InfoSourceFilterDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
  hasCitationSeed: PropTypes.bool,
  filters: PropTypes.shape({
    enabled: PropTypes.bool,
    contentType: PropTypes.string,
    title: PropTypes.string,
    owners: PropTypes.arrayOf(PropTypes.string),
    markets: PropTypes.arrayOf(PropTypes.string),
    keywords: PropTypes.arrayOf(PropTypes.string),
    updatedBucket: PropTypes.string,
    useCitationSeed: PropTypes.bool
  }).isRequired
};
