'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, Stack, Switch, TextField, Typography, useTheme } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useParams } from 'next/navigation';
import { fetchAgentSkillsJob, requestAgentSkillsJob } from '@/app/clientServices/agentSkillsService';
import { useChatInteractions } from '@reducers/ChatInteractionContext';
import Markdown from '../Markdown.js';

const JOB_STATUS = {
  QUEUED: 'Queued',
  PROCESSING: 'Processing',
  COMPLETE: 'Complete',
  ERROR: 'Error'
};
const MAX_POLL_ATTEMPTS = 120;

const BUCKET_ORDER = ['approach', 'impress', 'followUp', 'finetune'];

const buildCitationSignature = (citation = {}) => {
  const sourceTitle = (citation.sourceTitle || '').trim().toLowerCase();
  const url = (citation.url || '').trim().toLowerCase();
  const region = (citation.region || '').trim().toLowerCase();
  const owner = (citation.documentOwner || '').trim().toLowerCase();
  const lastUpdated = (citation.lastUpdated || '').trim().toLowerCase();
  return `${sourceTitle}::${url}::${region}::${owner}::${lastUpdated}`;
};

const compareValues = (left, right) => {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
};

const sortInsights = (insights = []) => {
  return [...insights].sort((left, right) => {
    const scoreDiff = (right?.metadata?.score ?? right?.score ?? 0) - (left?.metadata?.score ?? left?.score ?? 0);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    const sourceCompare = compareValues(
      (left?.citation?.sourceTitle || '').toLowerCase(),
      (right?.citation?.sourceTitle || '').toLowerCase()
    );
    if (sourceCompare !== 0) {
      return sourceCompare;
    }

    const summaryCompare = compareValues(
      (left?.summary || '').toLowerCase(),
      (right?.summary || '').toLowerCase()
    );
    if (summaryCompare !== 0) {
      return summaryCompare;
    }

    return compareValues(left?.id || '', right?.id || '');
  });
};

const AgentSkillsPanel = ({ containerCollapsed, onContainerToggle }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const panelBorderColor = isDarkMode ? 'rgba(148,163,184,0.2)' : 'rgba(13,28,61,0.15)';
  const panelInnerBorderColor = isDarkMode ? 'rgba(148,163,184,0.2)' : 'rgba(13,28,61,0.16)';
  const mutedTextColor = theme.palette.text?.muted || (isDarkMode ? 'rgba(226,232,240,0.8)' : 'rgba(13,28,61,0.7)');
  const headingColor = theme.palette.text?.heading || theme.palette.text.primary;
  const panelBackground = isDarkMode
    ? 'linear-gradient(180deg, #081427 0%, #0f1b2f 45%, #111826 100%)'
    : theme.palette.background.paper;

  const { teamName, assistantName, id: smartNoteId } = useParams();
  const interactionsContext = useChatInteractions();
  const chatInteractions = interactionsContext?.chatInteractions || [];
  const selectedChatInteraction = interactionsContext?.selectedChatInteraction;

  const [query, setQuery] = useState('Prepare a CFO-ready briefing for a manufacturing prospect.');
  const [userRole, setUserRole] = useState('Seller');
  const [market, setMarket] = useState('National');
  const [industry, setIndustry] = useState('Manufacturing');
  const [usePinnedMemory, setUsePinnedMemory] = useState(true);
  const [hasCustomQuery, setHasCustomQuery] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [selectedCitation, setSelectedCitation] = useState(null);
  const [viewMode, setViewMode] = useState('role');
  const [copiedRoleMarkdown, setCopiedRoleMarkdown] = useState(false);
  const [copiedRolePlainText, setCopiedRolePlainText] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const collapsed = typeof containerCollapsed === 'boolean' ? containerCollapsed : isCollapsed;

  const pollIntervalRef = useRef(null);
  const pollAttemptsRef = useRef(0);

  const preparedBuckets = useMemo(() => {
    if (!result?.buckets || !Array.isArray(result.buckets)) {
      return [];
    }

    return [...result.buckets]
      .sort((left, right) => {
        const leftIndex = BUCKET_ORDER.indexOf(left.id);
        const rightIndex = BUCKET_ORDER.indexOf(right.id);
        return leftIndex - rightIndex;
      })
      .map((bucket) => ({
        ...bucket,
        insights: sortInsights(Array.isArray(bucket.insights) ? bucket.insights : [])
      }));
  }, [result]);

  const roleMarkdown = useMemo(() => {
    if (!result?.roleResponse?.markdown) {
      return '';
    }

    return result.roleResponse.markdown;
  }, [result]);

  const memoryModeLabel = useMemo(() => {
    const enabled = result?.options?.useMemoryContext !== false;
    return enabled ? 'Memory: On' : 'Memory: Off';
  }, [result]);

  const dataSourceLabel = useMemo(() => {
    const value = result?.diagnostics?.dataSource;
    return value ? `Data Source: ${value}` : 'Data Source: unknown';
  }, [result]);

  const dataSourceBadgeColor = useMemo(() => {
    const value = result?.diagnostics?.dataSource;
    if (value === 'live' || value === 'live-unfiltered') {
      return '#86efac';
    }
    if (value === 'mock' || value === 'mock-fallback') {
      return '#fda4af';
    }
    return mutedTextColor;
  }, [mutedTextColor, result]);

  const citationMap = useMemo(() => {
    const insightToFootnote = {};
    const signatureToFootnote = new Map();
    let nextFootnote = 1;

    preparedBuckets.forEach((bucket) => {
      (bucket.insights || []).forEach((insight) => {
        const signature = buildCitationSignature(insight.citation);
        if (!signatureToFootnote.has(signature)) {
          signatureToFootnote.set(signature, nextFootnote);
          nextFootnote += 1;
        }
        insightToFootnote[insight.id] = signatureToFootnote.get(signature);
      });
    });

    return insightToFootnote;
  }, [preparedBuckets]);

  const latestPrompt = useMemo(() => {
    if (selectedChatInteraction?.prompt && selectedChatInteraction.prompt.trim().length > 0) {
      return selectedChatInteraction.prompt.trim();
    }

    for (let index = chatInteractions.length - 1; index >= 0; index -= 1) {
      const candidatePrompt = chatInteractions[index]?.prompt;
      if (candidatePrompt && candidatePrompt.trim().length > 0) {
        return candidatePrompt.trim();
      }
    }

    return '';
  }, [chatInteractions, selectedChatInteraction]);

  useEffect(() => {
    if (!latestPrompt || hasCustomQuery) {
      return;
    }
    setQuery(latestPrompt);
  }, [hasCustomQuery, latestPrompt]);

  useEffect(() => {
    if (!jobId || !teamName || !assistantName || !smartNoteId) {
      return undefined;
    }

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    pollAttemptsRef.current = 0;

    pollIntervalRef.current = setInterval(async () => {
      try {
        pollAttemptsRef.current += 1;
        const job = await fetchAgentSkillsJob(teamName, assistantName, smartNoteId, jobId);
        const nextStatus = job?.normalizedStatus || (job?.status || '').toLowerCase() || null;
        setStatus(nextStatus);

        if (job?.isTerminal || nextStatus === 'complete') {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          if (nextStatus === 'complete') {
            setResult(job?.result || null);
          } else {
            setError(job?.lastError || 'Unable to generate agent skills response.');
          }
          setIsLoading(false);
          return;
        }

        if (nextStatus === 'error') {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setError(job?.lastError || 'Unable to generate agent skills response.');
          setIsLoading(false);
          return;
        }

        if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setError('Agent skills polling timed out. Please try again.');
          setIsLoading(false);
        }
      } catch (pollError) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        setError(pollError.message || 'Polling failed.');
        setIsLoading(false);
      }
    }, 2500);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [assistantName, jobId, smartNoteId, teamName]);

  const handleGenerate = async () => {
    setError(null);
    setIsLoading(true);
    setResult(null);
    setViewMode('role');
    setStatus('queued');

    try {
      const response = await requestAgentSkillsJob(teamName, assistantName, smartNoteId, {
        query,
        userRole,
        region: market,
        market,
        industry,
        useMemoryContext: usePinnedMemory,
        mode: 'auto',
        limitPerBucket: 3
      });

      if (!response?.jobId) {
        throw new Error('Agent skills job did not return a job ID.');
      }

      setJobId(response.jobId);
      setStatus(response.normalizedStatus || (response.status || '').toLowerCase() || 'queued');
    } catch (requestError) {
      setError(requestError.message || 'Unable to queue agent skills request.');
      setIsLoading(false);
    }
  };

  const handleUseLatestPrompt = () => {
    if (!latestPrompt) {
      return;
    }
    setQuery(latestPrompt);
    setHasCustomQuery(false);
  };

  const handleCopyRoleMarkdown = async () => {
    if (!roleMarkdown) {
      return;
    }

    try {
      const markdownWithContext = buildMarkdownExport({
        markdown: roleMarkdown,
        role: result?.roleResponse?.role || userRole,
        memoryModeLabel,
        generatedAt: new Date().toISOString()
      });
      await navigator.clipboard.writeText(markdownWithContext);
      setCopiedRoleMarkdown(true);
      setTimeout(() => setCopiedRoleMarkdown(false), 2000);
    } catch {
      setError('Unable to copy markdown to clipboard.');
    }
  };

  const handleCopyRolePlainText = async () => {
    if (!roleMarkdown) {
      return;
    }

    try {
      const markdownWithContext = buildMarkdownExport({
        markdown: roleMarkdown,
        role: result?.roleResponse?.role || userRole,
        memoryModeLabel,
        generatedAt: new Date().toISOString()
      });
      const plainText = markdownToPlainText(markdownWithContext);
      await navigator.clipboard.writeText(plainText);
      setCopiedRolePlainText(true);
      setTimeout(() => setCopiedRolePlainText(false), 2000);
    } catch {
      setError('Unable to copy plain text to clipboard.');
    }
  };

  return (
    <Box
      id="info-source-agent-skills"
      sx={{
        background: panelBackground,
        color: theme.palette.text.primary,
        borderRadius: '24px',
        paddingX: 3,
        paddingTop: 2.5,
        paddingBottom: 3.5,
        border: `1px solid ${panelBorderColor}`,
        boxShadow: isDarkMode ? '0 25px 60px rgba(2,6,23,0.55)' : '0 12px 28px rgba(13,28,61,0.12)',
        fontFamily: '\'Space Grotesk\', \'DM Sans\', \'Segoe UI\', sans-serif',
        minHeight: 0,
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Stack spacing={2} sx={{ height: '100%', minHeight: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
          <Box>
            <Typography variant="overline" sx={{ letterSpacing: 4, color: mutedTextColor }}>
              Agent Skills
            </Typography>
            <Typography variant="h5" sx={{ color: headingColor, fontWeight: 600 }}>
              Generate grounded sales guidance
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => { if (onContainerToggle) { onContainerToggle(); } else { setIsCollapsed((prev) => !prev); } }} sx={{ color: theme.palette.text.primary }}>
            {collapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
          </IconButton>
        </Stack>

        {!collapsed && (
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 0.5, pt: 0.75 }}>
            <Stack spacing={2}>

              <TextField
                size="small"
                label="Request"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setHasCustomQuery(true);
                }}
                fullWidth
                multiline
                minRows={2}
                InputLabelProps={{ shrink: true }}
              />

              <Stack direction="row" spacing={1.5} alignItems="center">
                <Button
                  variant="text"
                  onClick={handleUseLatestPrompt}
                  disabled={!latestPrompt}
                  sx={{ textTransform: 'none', paddingX: 0 }}
                >
                  Use latest chat prompt
                </Button>
                {latestPrompt && (
                  <Typography variant="caption" sx={{ color: mutedTextColor }}>
                    Synced from conversation context
                  </Typography>
                )}
              </Stack>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                <TextField
                  select
                  size="small"
                  label="Role"
                  value={userRole}
                  onChange={(event) => setUserRole(event.target.value)}
                  sx={{ minWidth: 140 }}
                >
                  <MenuItem value="Seller">Seller</MenuItem>
                  <MenuItem value="Marketer">Marketer</MenuItem>
                </TextField>

                <TextField
                  size="small"
                  label="Market (used as region)"
                  value={market}
                  onChange={(event) => setMarket(event.target.value)}
                  fullWidth
                />

                <TextField
                  size="small"
                  label="Industry"
                  value={industry}
                  onChange={(event) => setIndustry(event.target.value)}
                  fullWidth
                />
              </Stack>

              <FormControlLabel
                control={(
                  <Switch
                    checked={usePinnedMemory}
                    onChange={(event) => setUsePinnedMemory(event.target.checked)}
                    size="small"
                  />
                )}
                label="Use pinned memory for this run"
              />

              <Stack direction="row" spacing={1.5} alignItems="center">
                <Button
                  variant="outlined"
                  onClick={handleGenerate}
                  startIcon={<AutoAwesomeIcon />}
                  disabled={isLoading || !teamName || !assistantName || !smartNoteId}
                  sx={{
                    textTransform: 'none',
                    borderRadius: '999px',
                    color: theme.palette.text.primary,
                    borderColor: theme.palette.primary.main
                  }}
                >
                  Generate agent skills
                </Button>
                {isLoading && <CircularProgress size={20} />}
                {status && <Typography variant="caption">Status: {status}</Typography>}
              </Stack>

              {!isLoading && !error && result && (
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant={viewMode === 'role' ? 'contained' : 'outlined'}
                    onClick={() => setViewMode('role')}
                    sx={{ textTransform: 'none', borderRadius: '999px' }}
                  >
                    Role output
                  </Button>
                  <Button
                    size="small"
                    variant={viewMode === 'buckets' ? 'contained' : 'outlined'}
                    onClick={() => setViewMode('buckets')}
                    sx={{ textTransform: 'none', borderRadius: '999px' }}
                  >
                    Buckets + citations
                  </Button>
                </Stack>
              )}

              {error && <Alert severity="error">{error}</Alert>}

              {!error && viewMode === 'role' && roleMarkdown && (
                <Box sx={{ border: `1px solid ${panelInnerBorderColor}`, borderRadius: '14px', padding: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Typography variant="subtitle2" sx={{ color: headingColor, fontWeight: 600 }}>
                        Role-tailored output ({result?.roleResponse?.role || userRole})
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: dataSourceBadgeColor,
                          border: '1px solid rgba(148,163,184,0.35)',
                          borderRadius: '999px',
                          paddingX: 1,
                          paddingY: 0.25
                        }}
                      >
                        {dataSourceLabel}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: memoryModeLabel === 'Memory: On' ? '#86efac' : '#fda4af',
                          border: '1px solid rgba(148,163,184,0.35)',
                          borderRadius: '999px',
                          paddingX: 1,
                          paddingY: 0.25
                        }}
                      >
                        {memoryModeLabel}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        startIcon={copiedRoleMarkdown ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                        onClick={handleCopyRoleMarkdown}
                        sx={{ textTransform: 'none', borderRadius: '999px' }}
                      >
                        {copiedRoleMarkdown ? 'Copied' : 'Copy markdown'}
                      </Button>
                      <Button
                        size="small"
                        startIcon={copiedRolePlainText ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                        onClick={handleCopyRolePlainText}
                        sx={{ textTransform: 'none', borderRadius: '999px' }}
                      >
                        {copiedRolePlainText ? 'Copied' : 'Copy plain text'}
                      </Button>
                    </Stack>
                  </Stack>
                  <Markdown content={roleMarkdown} isComplete />
                </Box>
              )}

              {!error && viewMode === 'buckets' && preparedBuckets.length > 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {preparedBuckets.map((bucket) => (
                    <Box key={bucket.id} sx={{ border: `1px solid ${panelInnerBorderColor}`, borderRadius: '14px', padding: 1.5 }}>
                      <Typography variant="subtitle2" sx={{ color: headingColor, fontWeight: 600 }}>
                        {bucket.label}
                      </Typography>
                      {(bucket.insights || []).map((insight) => (
                        <Typography key={insight.id} variant="body2" sx={{ mt: 0.75, color: theme.palette.text.primary }}>
                          {insight.summary}{' '}
                          <Button
                            size="small"
                            onClick={() => setSelectedCitation({ ...insight.citation, footnote: citationMap[insight.id] })}
                            sx={{ minWidth: 24, paddingX: 0.75, textTransform: 'none' }}
                          >
                            [{citationMap[insight.id]}]
                          </Button>
                        </Typography>
                      ))}
                    </Box>
                  ))}
                </Box>
              )}
            </Stack>
          </Box>
        )}
      </Stack>

      <Dialog open={Boolean(selectedCitation)} onClose={() => setSelectedCitation(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Citation details{selectedCitation?.footnote ? ` [${selectedCitation.footnote}]` : ''}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <Typography variant="body2"><strong>Source:</strong> {selectedCitation?.sourceTitle || 'N/A'}</Typography>
            <Typography variant="body2"><strong>Region:</strong> {selectedCitation?.region || 'N/A'}</Typography>
            <Typography variant="body2"><strong>Document Owner:</strong> {selectedCitation?.documentOwner || 'N/A'}</Typography>
            <Typography variant="body2"><strong>Last Updated:</strong> {selectedCitation?.lastUpdated || 'N/A'}</Typography>
            {selectedCitation?.url && (
              <Button
                component="a"
                href={selectedCitation.url}
                target="_blank"
                rel="noreferrer"
                startIcon={<OpenInNewIcon />}
                sx={{ width: 'fit-content', textTransform: 'none' }}
              >
                Open Source
              </Button>
            )}
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

function markdownToPlainText(markdown = '') {
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^\)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildMarkdownExport({ markdown = '', role = '', memoryModeLabel = '', generatedAt = '' }) {
  const roleLabel = role || 'Unknown';
  const memoryLabel = memoryModeLabel || 'Memory: On';
  const generatedAtLabel = generatedAt || new Date().toISOString();

  return [
    '### Run context',
    `- Role: ${roleLabel}`,
    `- ${memoryLabel}`,
    `- Generated at: ${generatedAtLabel}`,
    '',
    markdown
  ].join('\n');
}

export default AgentSkillsPanel;
