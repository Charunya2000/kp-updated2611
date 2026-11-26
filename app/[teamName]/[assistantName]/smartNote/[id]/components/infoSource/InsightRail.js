'use client';

import { useMemo, useState } from 'react';
import { Box, Chip, Divider, IconButton, Typography, useTheme } from '@mui/material';
import LaunchIcon from '@mui/icons-material/Launch';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useChatInteractions } from '@reducers/ChatInteractionContext';
import { isKpPolicySource, resolveInfoSourceCitationLabel } from '@/app/utils/infoSourceCitationUtils';
import CitationContentRenderer from './CitationContentRenderer';

const buildLink = (value) => {
  if (!value) {
    return null;
  }
  if (value.startsWith('http')) {
    return value;
  }
  if (value.startsWith('/')) {
    return `https://infosource.kp.org${value}`;
  }
  return `https://${value}`;
};

const classifyCitationLink = (url) => {
  if (!url) {
    return { type: 'none', isPage: false, isAsset: false };
  }

  const safeUrl = String(url).toLowerCase();
  const pagePattern = /(\.html?|\.aspx?|\/pages\/|\/page\/|\/wiki\/)/;
  const assetPattern = /(\.pdf|\.docx?|\.xlsx?|\.pptx?|\.csv|\.txt|\.zip|\.png|\.jpe?g|\.gif|\.svg)(\?|#|$)/;

  if (assetPattern.test(safeUrl)) {
    return { type: 'asset', isPage: false, isAsset: true };
  }

  if (pagePattern.test(safeUrl)) {
    return { type: 'page', isPage: true, isAsset: false };
  }

  return { type: 'page', isPage: true, isAsset: false };
};

const normalizeKeywordList = (...candidates) => {
  const keywords = [];

  candidates.forEach((candidate) => {
    if (!candidate) {
      return;
    }

    if (Array.isArray(candidate)) {
      candidate.forEach((item) => {
        const normalized = String(item || '').trim();
        if (normalized) {
          keywords.push(normalized);
        }
      });
      return;
    }

    const text = String(candidate || '').trim();
    if (!text) {
      return;
    }

    // Support both ';' and ',' serialized keyword strings from index payloads.
    text.split(/;|,/).forEach((token) => {
      const normalized = token.trim();
      if (normalized) {
        keywords.push(normalized);
      }
    });
  });

  const seen = new Set();
  return keywords.filter((keyword) => {
    const key = keyword.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  }).slice(0, 16);
};

const normalizeCitations = (interaction) => {
  if (!interaction) {
    return [];
  }
  const raw = interaction.citations || interaction.responseCitations || interaction.citationList;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((item, index) => {
    const isKpPolicy = isKpPolicySource(item);
    const url = buildLink(
      item.url
      || item.link
      || item.path
      || item.document_path
      || item.documentPath
      || item.document?.titleUrl
      || item.document?.evergreenLink
      || item.document?.path
      || item.document?.document_path
    );
    const linkMeta = classifyCitationLink(url);

    return {
      id: item.id || `${interaction.id}-${index}`,
      citationType: isKpPolicy ? 'kp-policy' : item.citationType,
      isKpPolicy,
      source: item.sourceTitle
        || item.source
        || item.document?.policyTitle
        || item.documentTitle
        || item.title
        || item.document?.title
        || item.document?.document_title
        || 'Source unavailable',
      region: item.region || item.document?.leftNavSelection || item.market || item.document?.market || item.document?.region || 'N/A',
      owner: item.documentOwner
        || item.owner
        || item.document?.documentOwner
        || item.content_owner
        || item.document_owner
        || item.document?.content_owner
        || item.document?.document_owner
        || 'N/A',
      lastUpdated: item.lastUpdated
        || item.document?.publicationDate
        || item.last_reviewed
        || item.lastReviewed
        || item.last_reviewed_updated
        || item.document?.last_reviewed_updated
        || item.document?.last_reviewed
        || item.document?.last_published
        || 'N/A',
      sourceLabel: resolveInfoSourceCitationLabel(item),
      keywords: isKpPolicy
        ? []
        : normalizeKeywordList(
          item.keywords,
          item.keywords_text,
          item.document?.keywords,
          item.document?.keywords_text
        ),
      url,
      linkType: linkMeta.type,
      opensInNewTab: linkMeta.isPage,
      shouldDownload: linkMeta.isAsset,
      relevanceSnippet: item.citationContent
        || item.relevanceSnippet
        || item.snippet
        || item.contentSnippet
        || item.content
        || item.document?.content
        || null,
      expandedQuoteContent: item.rawEvidenceText
        || item.document?.section_title
        || item.document?.content
        || null,
    };
  });
};

const formatDate = (value) => {
  if (!value || value === 'N/A') {
    return 'N/A';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const InsightRail = ({ containerCollapsed, onContainerToggle }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const panelBackground = isDarkMode
    ? 'linear-gradient(180deg, #081427 0%, #0f1b2f 45%, #111826 100%)'
    : theme.palette.background.paper;
  const panelBorderColor = isDarkMode ? 'rgba(148,163,184,0.2)' : 'rgba(13,28,61,0.15)';
  const panelInnerBorderColor = isDarkMode ? 'rgba(148,163,184,0.2)' : 'rgba(13,28,61,0.16)';
  const headingColor = theme.palette.text?.heading || theme.palette.text.primary;
  const mutedTextColor = theme.palette.text?.muted || (isDarkMode ? 'rgba(226,232,240,0.85)' : 'rgba(13,28,61,0.72)');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedSnippets, setExpandedSnippets] = useState({});
  const collapsed = typeof containerCollapsed === 'boolean' ? containerCollapsed : isCollapsed;

  const interactionsContext = useChatInteractions();
  const chatInteractions = interactionsContext?.chatInteractions || [];
  const selectedChatInteraction = interactionsContext?.selectedChatInteraction;

  const latestInteraction = useMemo(() => {
    if (selectedChatInteraction) {
      return selectedChatInteraction;
    }
    return chatInteractions.length > 0 ? chatInteractions[chatInteractions.length - 1] : null;
  }, [chatInteractions, selectedChatInteraction]);

  const citations = useMemo(() => normalizeCitations(latestInteraction), [latestInteraction]);

  const toggleSnippet = (snippetKey) => {
    setExpandedSnippets((prev) => ({
      ...prev,
      [snippetKey]: !prev[snippetKey]
    }));
  };

  return (
    <Box
      id="info-source-insight-rail"
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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="overline" sx={{ letterSpacing: 4, color: mutedTextColor }}>
            Insight Rail
          </Typography>
          <Typography variant="h5" sx={{ color: headingColor, fontWeight: 600 }}>
            Citations
          </Typography>
        </Box>
        <Box sx={{
          minWidth: 56,
          height: 56,
          borderRadius: '50%',
          backgroundColor: isDarkMode ? 'rgba(248,250,252,0.1)' : 'rgba(13,28,61,0.06)',
          border: `1px solid ${panelInnerBorderColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.35rem',
          fontWeight: 600,
          color: theme.palette.text.primary
        }}>
          {citations.length}
        </Box>
        <IconButton size="small" onClick={() => { if (onContainerToggle) { onContainerToggle(); } else { setIsCollapsed((prev) => !prev); } }} sx={{ color: theme.palette.text.primary }}>
          {collapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
        </IconButton>
      </Box>

      {!collapsed && (
        <Box sx={{ mt: 3, flex: 1, minHeight: 0, overflowY: 'auto', pr: 0.5 }}>
          {citations.length === 0 ? (
            <Typography variant="body1" sx={{ color: mutedTextColor }}>
              Citations land here after the assistant finishes rendering a response. The rail expects source title, market/region,
              document owner, and last-reviewed date. Missing metadata automatically displays as N/A per the design brief.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {citations.map((citation, index) => (
                <Box key={citation.id}>
                  {(() => {
                    const snippetKey = `${citation.id}-${index}`;
                    const snippetExpanded = !!expandedSnippets[snippetKey];
                    const hasSnippet = Boolean(citation.relevanceSnippet);

                    return (
                      <>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                          <Box sx={{
                            width: 34,
                            height: 34,
                            borderRadius: '12px',
                            backgroundColor: isDarkMode ? 'rgba(248,250,252,0.15)' : 'rgba(13,28,61,0.1)',
                            color: theme.palette.text.primary,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 600
                          }}>
                            {index + 1}
                          </Box>
                          {citation.url ? (
                            <Typography
                              component="a"
                              href={citation.url}
                              target={citation.opensInNewTab ? '_blank' : undefined}
                              rel={citation.opensInNewTab ? 'noreferrer' : undefined}
                              onClick={(event) => {
                                if (citation.shouldDownload) {
                                  event.preventDefault();
                                  const width = Math.min(1200, Math.floor(window.screen.width * 0.82));
                                  const height = Math.min(860, Math.floor(window.screen.height * 0.82));
                                  const left = Math.max(40, Math.floor((window.screen.width - width) / 2));
                                  const top = Math.max(40, Math.floor((window.screen.height - height) / 2));
                                  window.open(
                                    citation.url,
                                    '_blank',
                                    `noopener,noreferrer,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
                                  );
                                  return;
                                }

                                if (!citation.opensInNewTab) {
                                  return;
                                }
                                event.preventDefault();
                                window.open(citation.url, '_blank', 'noopener,noreferrer');
                              }}
                              variant="subtitle1"
                              sx={{
                                color: headingColor,
                                fontWeight: 600,
                                textDecoration: 'none',
                                '&:hover': {
                                  textDecoration: 'underline',
                                },
                              }}
                            >
                              {citation.source}
                            </Typography>
                          ) : (
                            <Typography variant="subtitle1" sx={{ color: headingColor, fontWeight: 600 }}>
                              {citation.source}
                            </Typography>
                          )}
                          {citation.url && !citation.isKpPolicy && (
                            <Typography
                              component="a"
                              href={citation.url}
                              target={citation.opensInNewTab ? '_blank' : undefined}
                              rel={citation.opensInNewTab ? 'noreferrer' : undefined}
                              onClick={(event) => {
                                if (citation.shouldDownload) {
                                  event.preventDefault();
                                  const width = Math.min(1200, Math.floor(window.screen.width * 0.82));
                                  const height = Math.min(860, Math.floor(window.screen.height * 0.82));
                                  const left = Math.max(40, Math.floor((window.screen.width - width) / 2));
                                  const top = Math.max(40, Math.floor((window.screen.height - height) / 2));
                                  window.open(
                                    citation.url,
                                    '_blank',
                                    `noopener,noreferrer,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
                                  );
                                  return;
                                }

                                if (!citation.opensInNewTab) {
                                  return;
                                }
                                event.preventDefault();
                                window.open(citation.url, '_blank', 'noopener,noreferrer');
                              }}
                              variant="caption"
                              sx={{
                                px: 0.75,
                                py: 0.2,
                                borderRadius: '999px',
                                border: `1px solid ${panelInnerBorderColor}`,
                                color: mutedTextColor,
                                letterSpacing: 0.4,
                                textTransform: 'uppercase',
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                textDecoration: 'none',
                                '&:hover': {
                                  textDecoration: 'underline',
                                },
                              }}
                              title={citation.linkType === 'asset' ? 'Opens this citation asset in a separate window' : 'Opens this citation page in a new tab'}
                            >
                              {citation.linkType === 'asset' ? 'Asset' : 'Page'}
                            </Typography>
                          )}
                          {citation.url && citation.opensInNewTab && !citation.isKpPolicy && <LaunchIcon sx={{ fontSize: 14, color: mutedTextColor }} />}
                        </Box>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5, mt: 1.5 }}>
                          <Box>
                            <Typography variant="caption" sx={{ letterSpacing: 1, color: mutedTextColor }}>Region / Market</Typography>
                            <Typography variant="body2">{citation.region || 'N/A'}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" sx={{ letterSpacing: 1, color: mutedTextColor }}>Owner</Typography>
                            <Typography variant="body2">{citation.owner || 'N/A'}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" sx={{ letterSpacing: 1, color: mutedTextColor }}>Last Updated</Typography>
                            <Typography variant="body2">{formatDate(citation.lastUpdated)}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" sx={{ letterSpacing: 1, color: mutedTextColor }}>Source</Typography>
                            <Typography variant="body2">{citation.sourceLabel}</Typography>
                          </Box>
                        </Box>
                        {!citation.isKpPolicy && Array.isArray(citation.keywords) && citation.keywords.length > 0 && (
                          <Box sx={{ mt: 1.15 }}>
                            <Typography variant="caption" sx={{ letterSpacing: 0.9, color: mutedTextColor }}>
                              Keywords
                            </Typography>
                            <Box sx={{ mt: 0.7, display: 'flex', flexWrap: 'wrap', gap: 0.65 }}>
                              {citation.keywords.slice(0, 6).map((keyword) => (
                                <Chip
                                  key={`${citation.id}-${keyword}`}
                                  label={keyword}
                                  size="small"
                                  sx={{
                                    height: 24,
                                    borderRadius: '999px',
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    color: mutedTextColor,
                                    border: `1px solid ${panelInnerBorderColor}`,
                                    backgroundColor: isDarkMode ? 'rgba(148,163,184,0.14)' : 'rgba(13,28,61,0.055)',
                                    '& .MuiChip-label': { px: 1 }
                                  }}
                                />
                              ))}
                              {citation.keywords.length > 6 && (
                                <Chip
                                  label={`+${citation.keywords.length - 6} more`}
                                  size="small"
                                  variant="outlined"
                                  sx={{
                                    height: 24,
                                    borderRadius: '999px',
                                    fontSize: '0.7rem',
                                    color: mutedTextColor,
                                    borderColor: panelInnerBorderColor,
                                    '& .MuiChip-label': { px: 1 }
                                  }}
                                />
                              )}
                            </Box>
                          </Box>
                        )}
                        {hasSnippet && (
                          <Box
                            sx={{
                              mt: 1.35,
                              borderRadius: '14px',
                              border: `1px solid ${panelInnerBorderColor}`,
                              background: isDarkMode
                                ? 'linear-gradient(180deg, rgba(30,41,59,0.45), rgba(15,23,42,0.35))'
                                : 'linear-gradient(180deg, rgba(241,245,249,0.9), rgba(248,250,252,0.8))',
                              overflow: 'hidden'
                            }}
                          >
                            <Box
                              role="button"
                              tabIndex={0}
                              onClick={() => toggleSnippet(snippetKey)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  toggleSnippet(snippetKey);
                                }
                              }}
                              sx={{
                                px: 1.25,
                                py: 0.75,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 1,
                                cursor: 'pointer',
                                '&:hover': {
                                  backgroundColor: isDarkMode ? 'rgba(148,163,184,0.08)' : 'rgba(13,28,61,0.05)',
                                },
                              }}
                            >
                              <Typography variant="caption" sx={{ color: mutedTextColor, letterSpacing: 0.5, fontWeight: 700 }}>
                                Citation Content
                              </Typography>
                              <IconButton
                                size="small"
                                disableRipple
                                tabIndex={-1}
                                sx={{
                                  width: 26,
                                  height: 26,
                                  border: `1px solid ${panelInnerBorderColor}`,
                                  color: mutedTextColor,
                                  pointerEvents: 'none',
                                }}
                                title={snippetExpanded ? 'Collapse citation content' : 'Expand citation content'}
                              >
                                {snippetExpanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
                              </IconButton>
                            </Box>
                            {snippetExpanded && (
                              <Box sx={{ px: 1.25, pb: 1.15, pt: 0.25 }}>
                                <CitationContentRenderer
                                  content={citation.relevanceSnippet}
                                  expandedQuoteContent={citation.expandedQuoteContent}
                                  isDarkMode={isDarkMode}
                                  fontSize="0.87rem"
                                />
                              </Box>
                            )}
                          </Box>
                        )}
                      </>
                    );
                  })()}
                  {index !== citations.length - 1 && <Divider sx={{ mt: 2, borderColor: panelInnerBorderColor }} />}
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default InsightRail;
