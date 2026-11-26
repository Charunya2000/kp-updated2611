'use client';

import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function sanitizeDisplayedCitationText(value = '') {
  let text = String(value || '');

  text = text.replace(/\[([^\]]{1,200})\]\((?:https?:\/\/|\/|\.\/|\.\.\/)[^)]+\)/gi, '$1');
  text = text.replace(/([A-Za-z][A-Za-z0-9\s&\-\/]{1,120})\s*\[\s*(?:https?:\/\/|\/)[^\]]+\]/gi, '$1');
  text = text.replace(/\[\s*\/(?:etc\.clientlibs|content|apps|libs)[^\]]*\]/gi, ' ');
  text = text.replace(/\/(?:etc\.clientlibs|content|apps|libs)\/[A-Za-z0-9_\-./]+/gi, ' ');
  text = text.replace(/\[[^\]]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}[^\]]*\]/gi, ' ');
  text = text.replace(/\b(?:mailto:)?[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\?subject=[^\s]+/gi, ' ');

  text = text.replace(/\bInfoSource\s+Home\s+Page\b/gi, ' ');
  text = text.replace(/\bLearning\s*&\s*Events\s*Calendar\b/gi, ' ');
  text = text.replace(/\bMy\s+Account\b/gi, ' ');
  text = text.replace(/\bProfile\s*&\s*Preferences\b/gi, ' ');
  text = text.replace(/\bLogout\b/gi, ' ');
  text = text.replace(/\bcircle\s+human\b/gi, ' ');
  text = text.replace(/\bdown\s+arrow\b/gi, ' ');
  text = text.replace(/\badd\s+bookmark\b/gi, ' ');
  text = text.replace(/\badded\s+bookmark\b/gi, ' ');
  text = text.replace(/\brename\s+bookmark\b/gi, ' ');
  text = text.replace(/\btitle\s+is\s+required\s+to\s+save\s+bookmark\b/gi, ' ');
  text = text.replace(/\bremove\s+undo\s+done\b/gi, ' ');
  text = text.replace(/\bproducts\s*&\s*plans\b/gi, ' ');
  text = text.replace(/\bmy\s+bookmarks\b/gi, ' ');
  text = text.replace(/\byou\s+don'?t\s+have\s+any\s+bookmarks\b/gi, ' ');
  text = text.replace(/\berror\s+retrieving\s+bookmarks\b/gi, ' ');
  text = text.replace(/\btry\s+again\b/gi, ' ');
  text = text.replace(/\bif\s+the\s+error\s+persists,?\s+contact\b/gi, ' ');
  text = text.replace(/\bedit\s+page\b/gi, ' ');
  text = text.replace(/\blast\s+updated\/?reviewed\s*:\s*[0-9/\-]+\b/gi, ' ');
  text = text.replace(/\bthis\s+page'?s\s+annual\s+review\s+has\s+not\s+been\s+done\.?\b/gi, ' ');
  text = text.replace(/\bsome\s+information\s+may\s+be\s+outdated\s+or\s+inaccurate\.?\b/gi, ' ');
  text = text.replace(/\bKP\s+Logo\b/gi, ' ');

  return text.replace(/\s+/g, ' ').trim();
}

function splitIntoSentences(value = '') {
  return String(value || '')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function isUtilitySentence(value = '') {
  const text = String(value || '').toLowerCase();
  if (!text) {
    return true;
  }

  const utilityPatterns = [
    /\b(?:my account|profile|preferences|logout|bookmarks?|search|home page|products?\s*&\s*plans?)\b/,
    /\b(?:error retrieving|try again|contact it|annual review|updated\/reviewed|down arrow|circle human|edit page)\b/,
    /\b(?:ok|done|undo|remove|add bookmark|rename bookmark)\b/,
    /\b(?:logo|clientlibs|mailto|@kp\.org)\b/
  ];

  const hits = utilityPatterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
  const tokenCount = text.split(/\s+/).length;
  if (hits === 0) {
    return false;
  }

  if (tokenCount <= 12) {
    return true;
  }

  return hits >= 2 && tokenCount <= 20;
}

function extractSupportingQuotes(content = '', expandedQuoteContent = '') {
  const baseComparable = normalizeComparableText(content);
  const fullText = sanitizeDisplayedCitationText(expandedQuoteContent);
  if (!fullText) {
    return [];
  }

  const sentences = splitIntoSentences(fullText)
    .filter((sentence) => sentence.length >= 42)
    .filter((sentence) => !isUtilitySentence(sentence));

  const supporting = [];
  const seen = new Set();

  for (const sentence of sentences) {
    const comparable = normalizeComparableText(sentence);
    if (!comparable || seen.has(comparable)) {
      continue;
    }

    // Skip near-duplicates of the existing citation content text.
    if (baseComparable && (baseComparable.includes(comparable) || comparable.includes(baseComparable))) {
      continue;
    }

    seen.add(comparable);
    supporting.push(sentence);

    if (supporting.length >= 3) {
      break;
    }
  }

  return supporting;
}

function splitCitationContent(content = '') {
  const text = sanitizeDisplayedCitationText(content);
  if (!text) {
    return [];
  }

  const segments = [];
  const quotePattern = /["“]([^"”]{36,})["”]/g;
  let lastIndex = 0;
  let match = quotePattern.exec(text);

  while (match) {
    const [fullMatch, quote] = match;
    const startIndex = match.index;

    if (startIndex > lastIndex) {
      const before = text.slice(lastIndex, startIndex).trim();
      if (before) {
        segments.push({ type: 'text', value: before });
      }
    }

    segments.push({ type: 'quote', value: quote.trim() });
    lastIndex = startIndex + fullMatch.length;
    match = quotePattern.exec(text);
  }

  if (lastIndex < text.length) {
    const after = text.slice(lastIndex).trim();
    if (after) {
      segments.push({ type: 'text', value: after });
    }
  }

  if (segments.length === 0) {
    return [{ type: 'text', value: text }];
  }

  return segments;
}

function normalizeComparableText(value = '') {
  return String(value || '')
    .replace(/["“”]/g, '')
    .replace(/\.\.\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function hasCollapsedQuoteMarker(value = '') {
  return /\.\.\./.test(String(value || ''));
}

function normalizeCitationMarkdown(value = '') {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  // Some model outputs collapse list bullets into one line; recover markdown list structure.
  if (!/\n\s*[-*]\s+/.test(text)) {
    const inlineBulletCount = (text.match(/\s[-*]\s+/g) || []).length;
    if (inlineBulletCount >= 2) {
      return text.replace(/\s[-*]\s+/g, '\n- ');
    }
  }

  return text;
}

export default function CitationContentRenderer({
  content,
  expandedQuoteContent,
  isDarkMode,
  fontSize = '0.9rem'
}) {
  const segments = useMemo(() => splitCitationContent(content), [content]);
  const supportingQuotes = useMemo(
    () => extractSupportingQuotes(content, expandedQuoteContent),
    [content, expandedQuoteContent]
  );
  const quoteBackground = isDarkMode ? 'rgba(148, 163, 184, 0.09)' : 'rgba(148, 163, 184, 0.12)';
  const quoteBorder = isDarkMode ? 'rgba(148, 163, 184, 0.18)' : 'rgba(148, 163, 184, 0.2)';
  const quoteText = isDarkMode ? 'rgba(226, 232, 240, 0.9)' : 'rgba(51, 65, 85, 0.88)';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.05 }}>
      {segments.map((segment, index) => {
        if (segment.type === 'quote') {
          return (
            <Box
              key={`quote-${index}`}
              sx={{
                px: 1.25,
                py: 1,
                borderRadius: '12px',
                backgroundColor: quoteBackground,
                border: '1px solid',
                borderColor: quoteBorder,
                boxShadow: isDarkMode ? 'inset 0 1px 0 rgba(255,255,255,0.015)' : 'inset 0 1px 0 rgba(255,255,255,0.45)',
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  lineHeight: 1.65,
                  fontSize,
                  fontStyle: 'italic',
                  color: quoteText,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {segment.value}
              </Typography>
            </Box>
          );
        }

        return (
          <Box
            key={`text-${index}`}
            sx={{
              lineHeight: 1.6,
              fontSize,
              '& p': {
                m: 0,
                mb: 0.6,
                lineHeight: 1.6,
                fontSize,
              },
              '& p:last-of-type': {
                mb: 0,
              },
              '& ul, & ol': {
                mt: 0.35,
                mb: 0.65,
                pl: 2.2,
              },
              '& li': {
                lineHeight: 1.55,
                mb: 0.35,
              },
            }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <Typography component="p" variant="body2">{children}</Typography>,
                li: ({ children }) => <Typography component="li" variant="body2">{children}</Typography>,
              }}
            >
              {normalizeCitationMarkdown(segment.value)}
            </ReactMarkdown>
          </Box>
        );
      })}

      {supportingQuotes.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.95, pt: 0.35 }}>
          <Typography variant="caption" sx={{ opacity: 0.72, fontWeight: 700, letterSpacing: 0.3 }}>
            Additional Supporting Excerpts
          </Typography>
          {supportingQuotes.map((quote, index) => (
            <Box
              key={`supporting-quote-${index}`}
              sx={{
                px: 1.25,
                py: 1,
                borderRadius: '12px',
                backgroundColor: quoteBackground,
                border: '1px solid',
                borderColor: quoteBorder,
                boxShadow: isDarkMode ? 'inset 0 1px 0 rgba(255,255,255,0.015)' : 'inset 0 1px 0 rgba(255,255,255,0.45)',
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  lineHeight: 1.62,
                  fontSize,
                  fontStyle: 'italic',
                  color: quoteText,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {quote}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

CitationContentRenderer.propTypes = {
  content: PropTypes.string,
  expandedQuoteContent: PropTypes.string,
  fontSize: PropTypes.string,
  isDarkMode: PropTypes.bool.isRequired,
};