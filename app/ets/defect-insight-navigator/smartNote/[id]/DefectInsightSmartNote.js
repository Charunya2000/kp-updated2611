'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControlLabel,
  IconButton,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import { createSmartNoteWithId, getSmartNote, updateSmartNote } from '@/app/clientServices/smartNoteService';
import {
  runRcaAnalytics,
  summarizeRca,
} from '../../clientServices/jiraSearchService';

/* ─── personas ─── */
const PERSONAS = [
  {
    key: 'rca',
    label: 'RCA',
    actionLabel: 'Run RCA',
    helperLabel: 'Search + Summary',
    placeholder: 'Describe the defect, symptom, or failure pattern…',
    defaultPrompt: '',
  },
  {
    key: 'analytics',
    label: 'RCA Analytics',
    actionLabel: 'Run Analytics',
    helperLabel: 'Counts + Trends',
    placeholder: 'Ask an analytics question about defect patterns…',
    defaultPrompt: '',
  },
];

const DEFAULT_INTERACTIONS = [
  { id: 'welcome', role: 'assistant', title: 'Assistant', text: 'Describe your defect or ask an RCA question to get started.', chips: [] },
];

/* ─── static project list (qTest projects visible in ETS sidebar, sorted A-Z) ─── */
// jiraKey = '' until the JIRA project key is confirmed with the team; '' means the dropdown shows
// the project name only and the backend call will use whatever key is resolved later.
const PROJECT_OPTIONS = [
  { name: 'Admin',                       jiraKey: '' },
  { name: 'Clinical Library',            jiraKey: '' },
  { name: 'CTP-OneLink',                 jiraKey: '' },
  { name: 'Get Care Now',                jiraKey: '' },
  { name: 'KP Mobile',                   jiraKey: '' },
  { name: 'KPATHS',                      jiraKey: '' },
  { name: 'Pharmacy',                    jiraKey: '' },
  { name: 'Video Visits',                jiraKey: 'VVE' },
  { name: 'Vision Essential - eCommerce', jiraKey: '' },
];

/** Label shown in the dropdown: "Video Visits (VVE)" when key is known, bare name otherwise. */
function projectLabel(opt) {
  return opt.jiraKey ? `${opt.name} (${opt.jiraKey})` : opt.name;
}

/* ─── helpers ─── */
function fv(v) {
  if (v === null || v === undefined || v === '') return 'N/A';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
}

/** Parse "score=0.50; status=Closed; priority=High; ..." from supporting_details */
function parseSupportingDetails(str) {
  if (!str) return {};
  const grab = (key) => { const m = str.match(new RegExp(`${key}=([^;]+)`)); return m ? m[1].trim() : null; };
  return { score: grab('score'), status: grab('status'), priority: grab('priority') };
}

/** Break the dense rca paragraph into readable chunks at natural sentence boundaries */
function formatRcaText(text) {
  if (!text) return text;
  // New paragraph before each "KEY-### is a relevant comparison point" sentence
  return text
    .replace(/\.\s+([A-Z]+-\d+\s+is a relevant)/g, '.\n\n$1')
    .replace(/\.\s+(Taken together,)/g, '.\n\n$1');
}

function buildRcaSummaryText(search, summary) {
  if (!summary) return null;

  // Backend returned an error inside a 200 response — don't surface raw Python errors
  if (
    summary.status === 'error' ||
    (!summary.rca && !summary.similar_defects?.length && !summary.recommended_actions?.length && summary.message)
  ) return null;

  const parts = [];

  // Main RCA analysis — paragraph breaks added for readability
  if (summary.rca) {
    parts.push(`## Root Cause Analysis\n\n${formatRcaText(summary.rca)}`);
  }

  // Recommended actions as numbered list
  // (similar_defects and confidence omitted — shown in the cards below)
  if (summary.recommended_actions?.length) {
    const items = summary.recommended_actions.map((a, i) => `${i + 1}. ${a}`);
    parts.push(`---\n\n**Recommended Actions**\n\n${items.join('\n')}`);
  }

  if (parts.length) return parts.join('\n\n');

  // Fall back to any plain-text field the API might return
  const flat = summary.answer ?? summary.response ?? summary.summary ??
    summary.text ?? summary.content ?? summary.message ?? summary.result;
  if (flat) return String(flat);

  return null;
}

function formatUserFacingError(error, fallback) {
  const raw = error?.message ? String(error.message) : '';
  if (!raw) return fallback;

  const cleaned = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return fallback;
  return cleaned.length > 280 ? `${cleaned.slice(0, 277)}...` : cleaned;
}

/* ─── ChatBubbleOutline-style interaction card (mirrors Conversation.js) ─── */
function ChatInteractionCard({ role, title, text, chips = [], onCopy }) {
  const isUser = role === 'user';
  const copyLabel = isUser ? 'Copy Prompt' : 'Copy Response';

  const handleCopy = () => {
    navigator.clipboard?.writeText(text || '').catch(() => {});
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1.5 }}>
      <Box sx={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', gap: 1, alignItems: 'flex-start' }}>
        <Box
          sx={{
            maxWidth: '88%',
            px: 2,
            py: 1.5,
            borderRadius: isUser ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
            backgroundColor: isUser ? 'primary.50' : 'background.paper',
            border: '1px solid',
            borderColor: isUser ? 'primary.light' : 'color.dolphin',
          }}
        >
          <Stack direction='row' justifyContent='space-between' alignItems='flex-start' spacing={1} mb={0.5}>
            <Stack direction='row' spacing={0.75} alignItems='center' flexWrap='wrap' useFlexGap>
              <Typography variant='subtitle2' fontWeight={700} color={isUser ? 'primary.dark' : 'text.primary'}>
                {title}
              </Typography>
              {chips.filter((c) => !/^query_id:/i.test(c) && !/^confidence:/i.test(c)).map((c) => (
                <Chip key={c} label={c} size='small' variant='outlined' sx={{ fontSize: '0.68rem', height: 20 }} />
              ))}
            </Stack>
          </Stack>
          <Box sx={{ '& p': { mt: 0, mb: 1, lineHeight: 1.7 }, '& h1,& h2,& h3,& h4': { mt: 1.5, mb: 0.5 }, '& ul,& ol': { pl: 2.5, mt: 0, mb: 1 }, '& li': { mb: 0.25 }, '& pre': { overflowX: 'auto', backgroundColor: 'action.hover', p: 1.5, borderRadius: 1 }, '& code': { fontFamily: 'monospace', fontSize: '0.85em', backgroundColor: 'action.hover', px: 0.5, borderRadius: 0.5 }, fontSize: '0.875rem', lineHeight: 1.7 }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{typeof text === 'string' ? text : ''}</ReactMarkdown>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
            <Button
              variant='text'
              size='small'
              startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
              onClick={handleCopy}
            >
              {copyLabel}
            </Button>
          </Box>
        </Box>
      </Box>
      {/* similar defects inline under an RCA assistant bubble */}
      {role === 'assistant-results' && text}
    </Box>
  );
}

/* ─── similar defect card ─── */
function SimilarDefectCard({ result }) {
  const det = parseSupportingDetails(result?.supporting_details);
  return (
    <Box sx={{ border: '1px solid', borderColor: 'color.dolphin', borderRadius: 2, p: 1.5, mb: 1, backgroundColor: 'background.paper' }}>
      <Stack direction='row' spacing={0.5} flexWrap='wrap' useFlexGap mb={0.75}>
        <Chip label={result?.key || '—'} color='primary' size='small' />
        {det.priority && <Chip label={det.priority} size='small' variant='outlined' />}
        {det.status && <Chip label={det.status} size='small' variant='outlined' />}
      </Stack>
      <Typography variant='subtitle2' fontWeight={700}>{result?.summary || 'No summary'}</Typography>
    </Box>
  );
}

/* ─── column card wrapper (mirrors Column.js style) ─── */
// footer = pinned content rendered below the scrollable area (e.g. composer)
function ColumnCard({ label, children, footer, actions, sx = {} }) {
  return (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'background.paper',
      border: '1px solid',
      borderColor: 'color.dolphin',
      borderRadius: '15px',
      overflow: 'hidden',
      ...sx,
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '4em', px: 2, flexShrink: 0 }}>
        <Typography variant='h5'>{label}</Typography>
        {actions}
      </Box>
      <Divider />
      {/* scrollable body */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
        {children}
      </Box>
      {/* pinned footer (composer, etc.) */}
      {footer && (
        <Box sx={{ flexShrink: 0, borderTop: '1px solid', borderColor: 'color.dolphin' }}>
          {footer}
        </Box>
      )}
    </Box>
  );
}

/* ─── main component ─── */
export default function DefectInsightSmartNote() {
  const router = useRouter();
  const { id: smartNoteId } = useParams();
  const chatEndRef = useRef(null);

  /* smart note */
  const [noteLoading, setNoteLoading] = useState(true);
  const [noteError, setNoteError] = useState('');
  const [smartNote, setSmartNote] = useState(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [hasHydratedConversation, setHasHydratedConversation] = useState(false);

  /* params */
  const [selectedPersona, setSelectedPersona] = useState('rca');
  const [selectedProject, setSelectedProject] = useState(
    () => PROJECT_OPTIONS.find((o) => o.jiraKey === 'VVE') || PROJECT_OPTIONS[0] || null
  );
  const [projectId, setProjectId] = useState('VVE');
  const [defectIssueId, setDefectIssueId] = useState('');
  const [includeExplanation, setIncludeExplanation] = useState(true);
  const [prompt, setPrompt] = useState(PERSONAS[0].defaultPrompt);

  /* conversation */
  const [interactions, setInteractions] = useState(DEFAULT_INTERACTIONS);
  const [running, setRunning] = useState(false);
  const [searchData, setSearchData] = useState(null);

  const activePersona = PERSONAS.find((p) => p.key === selectedPersona) || PERSONAS[0];

  /* load / create smart note */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let note = await getSmartNote('ets', 'defect-insight-navigator', smartNoteId);
        if (!note) {
          note = await createSmartNoteWithId('ets', 'defect-insight-navigator', smartNoteId, 'Untitled Smart Note');
        }
        if (!cancelled) {
          setSmartNote(note);

          const saved = note?.defectInsightState;
          if (saved) {
            const persona = PERSONAS.some((p) => p.key === saved.selectedPersona) ? saved.selectedPersona : 'rca';
            const restoredProject = PROJECT_OPTIONS.find((o) => o.name === saved.selectedProjectName)
              || PROJECT_OPTIONS.find((o) => o.jiraKey === saved.projectId)
              || PROJECT_OPTIONS.find((o) => o.jiraKey === 'VVE')
              || PROJECT_OPTIONS[0]
              || null;

            setSelectedPersona(persona);
            setSelectedProject(restoredProject);
            setProjectId(restoredProject?.jiraKey || '');
            setDefectIssueId(saved.defectIssueId || '');
            setIncludeExplanation(saved.includeExplanation !== false);
            setInteractions(Array.isArray(saved.interactions) && saved.interactions.length ? saved.interactions : DEFAULT_INTERACTIONS);
            setSearchData(saved.searchData || null);
          }
          setHasHydratedConversation(true);
        }
      } catch (err) {
        if (!cancelled) setNoteError(err?.message || 'Unable to load smart note.');
      } finally {
        if (!cancelled) setNoteLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [smartNoteId]);

  /* sync default prompt when persona changes */
  useEffect(() => { setPrompt(activePersona.defaultPrompt); }, [activePersona.key]);

  useEffect(() => {
    if (!hasHydratedConversation || !smartNoteId || noteLoading) return;

    updateSmartNote('ets', 'defect-insight-navigator', smartNoteId, {
      defectInsightState: {
        selectedPersona,
        selectedProjectName: selectedProject?.name || '',
        projectId,
        defectIssueId,
        includeExplanation,
        interactions,
        searchData,
      },
    }).catch(() => {});
  }, [
    hasHydratedConversation,
    smartNoteId,
    noteLoading,
    selectedPersona,
    selectedProject,
    projectId,
    defectIssueId,
    includeExplanation,
    interactions,
    searchData,
  ]);

  /* scroll to bottom */
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [interactions, searchData]);

  const handlePersonaSelect = (key) => {
    setSelectedPersona(key);
    setInteractions((prev) => [prev[0]]);
    setSearchData(null);
    setDefectIssueId('');
    const defaultProject = PROJECT_OPTIONS.find((o) => o.jiraKey === 'VVE') || PROJECT_OPTIONS[0];
    setSelectedProject(defaultProject);
    setProjectId(defaultProject?.jiraKey || '');
  };

  const appendAssistantMessage = (title, text) => {
    setInteractions((prev) => [
      ...prev,
      { id: `a-${Date.now()}`, role: 'assistant', title, text, chips: [] },
    ]);
  };

  const handleRefresh = () => {
    setInteractions(DEFAULT_INTERACTIONS);
    setSearchData(null);
    setPrompt(activePersona.defaultPrompt || '');
  };

  const handleSaveTitle = async () => {
    const newTitle = titleDraft.trim() || 'Untitled Smart Note';
    setIsEditingTitle(false);
    if (newTitle === (smartNote?.title || 'Untitled Smart Note')) return;
    setSmartNote((prev) => ({ ...prev, title: newTitle }));
    try {
      await updateSmartNote('ets', 'defect-insight-navigator', smartNoteId, { title: newTitle });
    } catch { /* local state already reflects the change */ }
  };


  const handleSend = async () => {
    const text = prompt.trim();
    const pid = (projectId || '').trim();
    if (!text) {
      appendAssistantMessage('Assistant', 'Prompt is required.');
      return;
    }
    if (activePersona.key === 'rca' && !defectIssueId.trim()) {
      appendAssistantMessage('Assistant', 'Defect Issue ID is required for the RCA persona.');
      return;
    }

    setRunning(true);
    setSearchData(null);
    setPrompt('');

    setInteractions((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', title: activePersona.label, text, chips: [projectLabel(selectedProject || { name: 'Project', jiraKey: '' }), activePersona.helperLabel] },
    ]);

    try {
      if (activePersona.key === 'rca') {
        // Call rca-summary directly — mirrors the Postman flow exactly.
        // Calling /rca first corrupts backend session state, causing
        // "NoneType has no attribute 'results'" in the rca-summary handler.
        const sum = await summarizeRca({
          project_id: pid,
          original_prompt: text,
          include_explanation: includeExplanation,
          ...(defectIssueId.trim() ? { defect_issue_id: defectIssueId.trim() } : {}),
        });
        setSearchData(sum);

        setInteractions((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`, role: 'assistant', title: 'RCA Summary',
            text: buildRcaSummaryText(null, sum) ?? 'The RCA summary could not be generated for this query. Please try again, or contact your administrator if the issue persists.',
            chips: [],
          },
        ]);
      } else {
        const ar = await runRcaAnalytics({ project_id: pid, query: text, sort_by: 'count', limit: 50, date_range_days: 30 });
        setInteractions((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`, role: 'assistant', title: 'RCA Analytics',
            text: ar?.answer || ar?.message || 'No analytics answer was returned. Please try again, or contact your administrator if the issue persists.',
            chips: [],
          },
        ]);
      }
    } catch (e) {
      const message = formatUserFacingError(e, 'Something went wrong while processing your request. Please try again, or contact your administrator if the issue persists.');
      appendAssistantMessage('Assistant', message);
    } finally {
      setRunning(false);
    }
  };

  /* ── skeleton (matches SmartNote loading state) ── */
  if (noteLoading) {
    return (
      <Container maxWidth={false} sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, width: '100%', height: '100%', overflow: 'hidden', padding: 1.5, backgroundColor: 'listitem.header' }} disableGutters>
        <Box sx={{ display: 'flex', flexGrow: 1, width: '100%', height: '100%', gap: 1.5, overflow: 'hidden' }}>
          <Skeleton variant='rounded' width='28%' height='100%' sx={{ borderRadius: '15px' }} />
          <Skeleton variant='rounded' sx={{ flexGrow: 1, height: '100%', borderRadius: '15px' }} />
        </Box>
      </Container>
    );
  }

  if (noteError) {
    return (
      <Container maxWidth={false} sx={{ p: 3 }} disableGutters>
        <Alert severity='error'>{noteError}</Alert>
      </Container>
    );
  }

  const noteTitle = smartNote?.title || 'Untitled Smart Note';

  /* ── two-column layout (mirrors Sources + Assistant columns from SmartNote) ── */
  return (
    <Container
      maxWidth={false}
      sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, height: '100%', overflow: 'hidden', padding: 1.5, backgroundColor: 'listitem.header' }}
      disableGutters
    >
      <Box sx={{ display: 'flex', flexGrow: 1, width: '100%', height: '100%', gap: 1.5, overflow: 'hidden' }}>

        {/* ── LEFT: Context (mirrors Sources column) ── */}
        <ColumnCard label='Context' sx={{ width: '28%', flexShrink: 0 }}>
          {isEditingTitle ? (
            <TextField
              size='small'
              fullWidth
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleSaveTitle(); }
                if (e.key === 'Escape') setIsEditingTitle(false);
              }}
              sx={{ mb: 0.5 }}
            />
          ) : (
            <Stack direction='row' alignItems='center' spacing={0.5} sx={{ mb: 0.5 }}>
              <Typography variant='subtitle2' color='text.secondary' sx={{ flex: 1, wordBreak: 'break-word' }}>
                {noteTitle}
              </Typography>
              <Tooltip title='Rename'>
                <IconButton size='small' onClick={() => { setTitleDraft(noteTitle); setIsEditingTitle(true); }}>
                  <EditIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          )}
          <Divider sx={{ mb: 1.5 }} />

          {/* personas */}
          <Typography variant='subtitle1' fontWeight={700} sx={{ mb: 1 }}>Smart Personas</Typography>
          <Stack spacing={0.75} sx={{ mb: 2 }}>
            {PERSONAS.map((p) => (
              <Button
                key={p.key}
                fullWidth
                variant={selectedPersona === p.key ? 'primary' : 'secondary'}
                onClick={() => handlePersonaSelect(p.key)}
                sx={{ justifyContent: 'flex-start', px: 1.5 }}
              >
                {p.label}
              </Button>
            ))}
          </Stack>

          <Divider sx={{ mb: 1.5 }} />

          {/* parameters */}
          <Stack spacing={1.5}>
            <Autocomplete
              size='small'
              options={PROJECT_OPTIONS}
              value={selectedProject}
              onChange={(_, newValue) => {
                setSelectedProject(newValue);
                setProjectId(newValue?.jiraKey || '');
              }}
              getOptionLabel={(o) => projectLabel(o)}
              isOptionEqualToValue={(o, v) => o.name === v.name}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label='Project'
                  placeholder='Select a project…'
                />
              )}
            />
            <TextField
              fullWidth
              size='small'
              label={activePersona.key === 'rca' ? 'Defect Issue ID *' : 'Defect Issue ID (optional)'}
              required={activePersona.key === 'rca'}
              value={defectIssueId}
              onChange={(e) => setDefectIssueId(e.target.value)}
            />
            <FormControlLabel
              control={<Switch checked={includeExplanation} size='small' onChange={(e) => setIncludeExplanation(e.target.checked)} />}
              label={<Typography variant='body2'>Include explanation</Typography>}
            />
          </Stack>
        </ColumnCard>

        {/* ── CENTER: Assistant fills remaining space ── */}
        <ColumnCard
          label='Assistant'
          sx={{ flexGrow: 1 }}
          actions={
            <Stack direction='row' spacing={0.5}>
              <Button
                variant='action'
                size='small'
                startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
                onClick={handleRefresh}
              >
                Refresh
              </Button>
            </Stack>
          }
          footer={
            <Box sx={{ p: 1.5 }}>
              <Box
                component='form'
                onSubmit={(e) => { e.preventDefault(); if (!running) handleSend(); }}
              >
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  placeholder={activePersona.placeholder}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!running) handleSend();
                    }
                  }}
                  sx={{ mb: 1 }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  <Stack direction='row' spacing={0.75} alignItems='center'>
                    <Chip
                      icon={<ChatBubbleOutlineIcon fontSize='small' />}
                      label={activePersona.label}
                      size='small'
                    />
                    <Chip label={activePersona.helperLabel} variant='outlined' size='small' />
                    <Typography variant='caption' color='text.disabled'>Shift+Enter for newline</Typography>
                  </Stack>
                  <Button
                    type='submit'
                    variant='primary'
                    endIcon={running ? <CircularProgress size={16} color='inherit' /> : <ArrowForwardIcon />}
                    disabled={running || !prompt.trim() || (activePersona.key === 'rca' && !defectIssueId.trim())}
                  >
                    {activePersona.actionLabel}
                  </Button>
                </Box>
              </Box>
            </Box>
          }
        >
          {/* conversation thread — fills available height and scrolls */}
          {interactions.map((item) => (
            <ChatInteractionCard key={item.id} role={item.role} title={item.title} text={item.text} chips={item.chips} />
          ))}

          {running && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <CircularProgress size={16} />
              <Typography variant='body2' color='text.secondary'>Running {activePersona.label}…</Typography>
            </Box>
          )}

          {/* similar defects rendered after the last assistant bubble */}
          {searchData?.similar_defects?.length > 0 && activePersona.key === 'rca' && (
            <Box sx={{ mb: 1 }}>
              <Typography variant='subtitle2' fontWeight={700} sx={{ mb: 0.75, pl: 0.5 }}>
                Similar Defects ({searchData.similar_defects.length})
              </Typography>
              {searchData.similar_defects.map((r) => (
                <SimilarDefectCard
                  key={r.key}
                  result={r}
                />
              ))}
            </Box>
          )}

          <div ref={chatEndRef} />
        </ColumnCard>

      </Box>
    </Container>
  );
}
