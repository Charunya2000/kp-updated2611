'use client';
import { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, IconButton, CircularProgress, Tooltip } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

const integrations = [
  { id: 'orchestration', label: 'Orchestration API' },
  { id: 'nexusos-completions', label: 'NexusOS completions', group: 'NexusOS' },
  { id: 'nexusos-responses', label: 'NexusOS responses', group: 'NexusOS' },
  { id: 'nexusos-embeddings', label: 'NexusOS embeddings', group: 'NexusOS' },
  { id: 'jira', label: 'JIRA' },
  { id: 'confluence', label: 'Confluence' },
  { id: 'sharepoint', label: 'SharePoint' },
  { id: 'datahub', label: 'DataHub' },
  { id: 'azure-blob-storage', label: 'Azure Blob Storage' },
  { id: 'azure-ai-search', label: 'Azure AI Search' },
];

const StatusIcon = ({ status }) => {
  if (status === 'loading') return <CircularProgress size={24} aria-label="Checking integration" />;
  if (status === 'ok') return <CheckCircleIcon sx={{ color: '#4caf50', fontSize: 24 }} />;
  return (
    <Tooltip title={status === 'not_configured' ? 'Not configured' : status === 'timeout' ? 'Timed out' : 'Error'}>
      <ErrorIcon sx={{ color: '#f44336', fontSize: 24 }} />
    </Tooltip>
  );
};

export default function IntegrationsHealth() {
  const [results, setResults] = useState(() => integrations.map(item => ({ ...item, status: 'loading' })));
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    const controller = new AbortController();
    integrations.forEach(async ({ id }) => {
      let result;
      try {
        const response = await fetch(`/api/admin/integrations-health/${id}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        result = await response.json();
      } catch (error) {
        result = { status: 'error', error: error.message || 'Failed to fetch' };
      }
      if (!controller.signal.aborted) {
        setResults(previous => previous.map(item => item.id === id ? { ...item, ...result } : item));
      }
    });
    return () => controller.abort();
  }, []);

  const toggleExpand = (label) => {
    setExpanded(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const nexusosChildren = results.filter(item => item.group === 'NexusOS');
  const nexusosStatus = nexusosChildren.some(item => item.status === 'loading')
    ? 'loading'
    : nexusosChildren.every(item => item.status === 'ok') ? 'ok' : 'error';
  const displayResults = [
    results[0],
    { label: 'NexusOS', status: nexusosStatus, children: nexusosChildren },
    ...results.filter(item => !item.group && item.id !== 'orchestration'),
  ];

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>Integrations Health</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {displayResults.map((item) => (
          <Card key={item.label} sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {item.children ? (
                  <IconButton size="small" aria-label={`Toggle ${item.label}`} aria-expanded={!!expanded[item.label]} onClick={() => toggleExpand(item.label)} sx={{ p: 0.5 }}>
                    {expanded[item.label] ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                  </IconButton>
                ) : (
                  <IconButton size="small" sx={{ p: 0.5 }} disabled>
                    <ChevronRightIcon sx={{ opacity: 0 }} />
                  </IconButton>
                )}
                <Typography sx={{ flex: 1, fontWeight: 500, fontSize: '1.05rem' }}>{item.label}</Typography>
                <StatusIcon status={item.status} />
              </Box>
              {(item.error || item.statusCode) && (
                <Typography variant="body2" sx={{ mt: 1, ml: 4, color: 'text.secondary', overflowWrap: 'anywhere' }}>
                  {item.error || `HTTP ${item.statusCode}`}
                </Typography>
              )}
              {item.children && expanded[item.label] && (
                <Box sx={{ mt: 2, ml: 4, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {item.children.map((child) => (
                    <Box key={child.label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Typography sx={{ flex: 1, fontSize: '0.95rem', color: 'text.secondary' }}>{child.label}</Typography>
                      <StatusIcon status={child.status} />
                      {(child.error || child.statusCode) && (
                        <Typography variant="body2" sx={{ color: 'text.secondary', ml: 1 }}>
                          {child.statusCode ? `HTTP ${child.statusCode}` : child.error}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
}