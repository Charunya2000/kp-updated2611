'use client';

import { Box, Snackbar, Alert, Dialog, DialogTitle, DialogContent, Button, Stack, Typography, IconButton, Divider, Chip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import PropTypes from 'prop-types';
import { useRef, useState } from 'react';
import { useParams } from 'next/navigation.js';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import LaunchIcon from '@mui/icons-material/Launch';
import { ChatInteractionType } from '@reducers/SmartNoteTypes.js';
import { useSmartNote } from '@/reducers/improved/SmartNoteContext.js';
import { useChatInteractions, useChatInteractionsDispatch } from '@/reducers/ChatInteractionContext';
import { exportResponseToExcel } from '@/app/clientServices/savedResponseService.js';
import { isKpPolicySource, resolveInfoSourceCitationLabel } from '@/app/utils/infoSourceCitationUtils';
import InfoSourceMarkdown from './InfoSourceMarkdown';
import InfoSourceSuggestedPrompts from './InfoSourceSuggestedPrompts';
import InfoSourceResponseFooter from './InfoSourceResponseFooter';
import CitationContentRenderer from './CitationContentRenderer';

function normalizeKeywordList(...candidates) {
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
  }).slice(0, 20);
}

function normalizeCitation(citation = {}) {
  const isKpPolicy = isKpPolicySource(citation);
  const url = citation.url
    || citation.link
    || citation.path
    || citation.document_path
    || citation.documentPath
    || citation.document?.titleUrl
    || citation.document?.evergreenLink
    || citation.document?.path
    || citation.document?.document_path
    || null;
  const safeUrl = url ? String(url).toLowerCase() : '';
  const pagePattern = /(\.html?|\.aspx?|\/pages\/|\/page\/|\/wiki\/)/;
  const assetPattern = /(\.pdf|\.docx?|\.xlsx?|\.pptx?|\.csv|\.txt|\.zip|\.png|\.jpe?g|\.gif|\.svg)(\?|#|$)/;
  const isAsset = !!safeUrl && assetPattern.test(safeUrl);
  const isPage = !!safeUrl && !isAsset && pagePattern.test(safeUrl);

  return {
    citationType: isKpPolicy ? 'kp-policy' : citation.citationType,
    isKpPolicy,
    sourceTitle: citation.sourceTitle
      || citation.source
      || citation.document?.policyTitle
      || citation.documentTitle
      || citation.title
      || citation.document?.title
      || citation.document?.document_title
      || 'N/A',
    region: citation.region || citation.document?.leftNavSelection || citation.market || citation.document?.market || citation.document?.region || 'N/A',
    documentOwner: citation.documentOwner
      || citation.owner
      || citation.document?.documentOwner
      || citation.content_owner
      || citation.document_owner
      || citation.document?.content_owner
      || citation.document?.document_owner
      || 'N/A',
    lastUpdated: citation.lastUpdated
      || citation.document?.publicationDate
      || citation.last_reviewed
      || citation.lastReviewed
      || citation.last_reviewed_updated
      || citation.document?.last_reviewed_updated
      || citation.document?.last_reviewed
      || citation.document?.last_published
      || 'N/A',
    sourceLabel: resolveInfoSourceCitationLabel(citation),
    keywords: isKpPolicy
      ? []
      : normalizeKeywordList(
        citation.keywords,
        citation.keywords_text,
        citation.document?.keywords,
        citation.document?.keywords_text
      ),
    url,
    citationContent: citation.citationContent
      || citation.relevanceSnippet
      || citation.snippet
      || citation.contentSnippet
      || citation.content
      || citation.document?.content
      || null,
    expandedQuoteContent: citation.rawEvidenceText
      || citation.document?.section_title
      || citation.document?.content
      || null,
    traceRoute: citation.trace?.route || null,
    traceIndexName: citation.trace?.indexName || citation.indexName || null,
    traceCitationKey: citation.trace?.citationKey || citation.citationKey || null,
    traceSourceDocumentId: citation.trace?.sourceDocumentId || citation.id || null,
    traceSourceUniqueId: citation.trace?.sourceUniqueId || citation.document?.unique_id || null,
    linkType: isAsset ? 'asset' : 'page',
    opensInNewTab: isPage || (!isAsset && !!safeUrl),
    opensInWindow: isAsset
  };
}

function formatCitationDate(value) {
  if (!value || value === 'N/A') return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function stripCitationMarkersForCopy(value = '') {
  return String(value || '')
    .replace(/\s*\[(\d{1,3})\]/g, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeMarkdownForCopy(value = '') {
  let text = String(value || '');

  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1');
  text = text.replace(/```([\w-]*)\n([\s\S]*?)```/g, (_, _lang, code) => code);
  text = text.replace(/`([^`]+)`/g, '$1');
  text = text.replace(/^\s{0,3}#{1,6}\s*/gm, '');
  text = text.replace(/^\s*[-*+]\s+/gm, '- ');
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

function normalizeSuggestedPrompts(prompts = []) {
  if (!Array.isArray(prompts)) {
    return [];
  }

  return prompts
    .map((item) => (typeof item === 'string' ? item : item?.prompt))
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildCitationBadgeHtml(markerNumber = '') {
  const safeNumber = escapeHtml(String(markerNumber || '').trim());
  if (!safeNumber) {
    return '';
  }

  return `<span aria-label="Citation ${safeNumber}" style="display:inline-block;font-size:0.78em;font-weight:600;line-height:1.2;vertical-align:baseline;margin-left:6px;margin-right:2px;padding:1px 6px;border-radius:10px;background-color:#e0f2fe;border:1px solid #bae6fd;color:#075985;">${safeNumber}</span>`;
}

const InfoSourceResponse = ({ chatInteraction, isComplete }) => {
  const smartNote = useSmartNote();
  const chatInteractionDispatch = useChatInteractionsDispatch();
  const { selectedChatInteraction, chatInteractions } = useChatInteractions();
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'error' });
  const [selectedCitation, setSelectedCitation] = useState(null);
  const [isCitationContentExpanded, setIsCitationContentExpanded] = useState(false);
  const responseContentRef = useRef(null);
  const { teamName, assistantName } = useParams();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const isInsightRailSelection = selectedChatInteraction?.id === chatInteraction.id;

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleSelectForInsightRail = () => {
    chatInteractionDispatch({ type: 'SELECT_CHAT_INTERACTION', id: chatInteraction.id });
  };

  const writeClipboardPayload = async ({ html, plainText, successMessage }) => {
    if (window.ClipboardItem && navigator.clipboard?.write && html) {
      const item = new window.ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plainText || ''], { type: 'text/plain' })
      });
      await navigator.clipboard.write([item]);
      return;
    }

    await navigator.clipboard.writeText(plainText || '');
  };

  const buildResponseCopyPayload = (
    interaction = chatInteraction,
    { preserveCitationMarkers = false, useRenderedHtml = false } = {}
  ) => {
    const responseContainer = responseContentRef.current;
    const renderedHtml = useRenderedHtml ? (responseContainer?.innerHTML || '') : '';
    const rawResponseText = String(interaction?.response || '');
    const normalizedResponseText = normalizeMarkdownForCopy(rawResponseText);
    const plainTextFallback = preserveCitationMarkers
      ? normalizedResponseText
      : stripCitationMarkersForCopy(normalizedResponseText);

    if (!renderedHtml) {
      const fallbackHtmlText = preserveCitationMarkers
        ? normalizedResponseText
        : plainTextFallback;

      let fallbackHtmlBody = escapeHtml(fallbackHtmlText).replace(/\n/g, '<br/>');
      if (preserveCitationMarkers) {
        fallbackHtmlBody = fallbackHtmlBody.replace(/\[(\d{1,3})\]/g, (_, markerNumber) => (` ${buildCitationBadgeHtml(markerNumber)} `));
      }

      return {
        html: `<div style="font-family: Segoe UI, Arial, sans-serif; font-size: 11pt; line-height: 1.45; color: #111;">${fallbackHtmlBody}</div>`,
        plainText: plainTextFallback,
      };
    }

    const htmlDoc = document.createElement('div');
    htmlDoc.innerHTML = renderedHtml;
    htmlDoc.querySelectorAll('button').forEach((button) => {
      if (preserveCitationMarkers) {
        const markerText = String(button.textContent || '').trim();
        if (!markerText) {
          button.remove();
          return;
        }

        const markerNumber = markerText.match(/\d+/)?.[0] || markerText.replace(/^[\[]|[\]]$/g, '');
        const fragment = document.createDocumentFragment();
        fragment.appendChild(document.createTextNode(' '));
        const markerContainer = document.createElement('span');
        markerContainer.innerHTML = buildCitationBadgeHtml(markerNumber);
        if (markerContainer.firstChild) {
          fragment.appendChild(markerContainer.firstChild);
        }
        fragment.appendChild(document.createTextNode(' '));
        button.replaceWith(fragment);
        return;
      }
      button.remove();
    });

    const responseBody = document.createElement('div');
    responseBody.innerHTML = preserveCitationMarkers
      ? htmlDoc.innerHTML
      : stripCitationMarkersForCopy(htmlDoc.innerHTML);

    return {
      html: `
        <div style="font-family: Segoe UI, Arial, sans-serif; font-size: 11pt; line-height: 1.45; color: #111;">
          ${responseBody.innerHTML}
        </div>
      `,
      plainText: preserveCitationMarkers
        ? String(responseBody.innerText || rawResponseText || '').trim()
        : stripCitationMarkersForCopy(responseBody.innerText || rawResponseText || ''),
    };
  };

  const buildCitationsCopyPayload = (interaction = chatInteraction) => {
    const normalizedCitations = (Array.isArray(interaction?.citations) ? interaction.citations : [])
      .map((citation, index) => ({ ...normalizeCitation(citation), footnote: index + 1 }));

    if (!normalizedCitations.length) {
      return null;
    }

    const plainText = normalizedCitations.map((citation) => {
      const title = citation.sourceTitle || 'N/A';
      const detailLine = [
        `Page or Asset: ${citation.linkType === 'asset' ? 'Asset' : 'Page'}`,
        `Market: ${citation.region || 'N/A'}`,
        `Owner: ${citation.documentOwner || 'N/A'}`,
        `Last Updated Date: ${formatCitationDate(citation.lastUpdated)}`
      ].join(' | ');

      return `[${citation.footnote}] ${title}\n${detailLine}`;
    }).join('\n\n');

    const html = normalizedCitations.map((citation) => {
      const title = escapeHtml(citation.sourceTitle || 'N/A');
      const detailLine = escapeHtml([
        `Page or Asset: ${citation.linkType === 'asset' ? 'Asset' : 'Page'}`,
        `Market: ${citation.region || 'N/A'}`,
        `Owner: ${citation.documentOwner || 'N/A'}`,
        `Last Updated Date: ${formatCitationDate(citation.lastUpdated)}`
      ].join(' | '));
      const titleContent = citation.url
        ? `<a href="${escapeHtml(citation.url)}" style="color:#0f172a;text-decoration:underline;">${title}</a>`
        : title;

      return `
        <div style="margin:0 0 14px 0; font-family:Segoe UI, Arial, sans-serif; font-size:11pt; line-height:1.45; color:#111827;">
          <div>[${citation.footnote}] ${titleContent}</div>
          <div>${detailLine}</div>
        </div>
      `;
    }).join('');

    return { html, plainText };
  };

  const buildPromptCopyPayload = (interaction = chatInteraction) => {
    const rawPromptText = String(
      interaction?.prompt
      || interaction?.question
      || interaction?.query
      || ''
    );
    const promptText = normalizeMarkdownForCopy(rawPromptText);

    if (!promptText) {
      return null;
    }

    const html = `
      <div style="font-family: Segoe UI, Arial, sans-serif; font-size: 11pt; line-height: 1.45; color: #111827;">
        ${escapeHtml(promptText).replace(/\n/g, '<br/>')}
      </div>
    `;

    return { html, plainText: promptText };
  };

  const buildQuestionsCopyPayload = (interaction = chatInteraction) => {
    const questions = normalizeSuggestedPrompts(interaction?.suggestedPrompts);
    if (!questions.length) {
      return null;
    }

    const plainText = questions.map((question, index) => `${index + 1}. ${question}`).join('\n');
    const html = `
      <div style="font-family: Segoe UI, Arial, sans-serif; font-size: 11pt; line-height: 1.45; color: #111827;">
        <ol style="margin:0; padding-left:20px;">
          ${questions.map((question) => `<li style="margin:0 0 8px 0;">${escapeHtml(question)}</li>`).join('')}
        </ol>
      </div>
    `;

    return { html, plainText };
  };

  const handleCopyResponse = async () => {
    try {
      const promptPayload = buildPromptCopyPayload(chatInteraction);
      const payload = buildResponseCopyPayload(chatInteraction, { preserveCitationMarkers: false, useRenderedHtml: true });

      const html = promptPayload
        ? `
          <div style="font-family: Segoe UI, Arial, sans-serif; font-size: 11pt; line-height: 1.45; color: #111827;">
            <section style="margin:0 0 22px 0;">
              <div style="font-size:13pt;font-weight:700;margin:0 0 8px 0;color:#0b3a75;">Question</div>
              ${promptPayload.html}
            </section>
            <section style="margin:0;">
              <div style="font-size:13pt;font-weight:700;margin:0 0 8px 0;color:#0b3a75;">Response</div>
              ${payload.html}
            </section>
          </div>
        `
        : payload.html;

      const plainText = promptPayload
        ? `Question\n${promptPayload.plainText}\n\nResponse\n${payload.plainText}`
        : payload.plainText;

      await writeClipboardPayload({
        html,
        plainText,
        successMessage: 'Response copied to clipboard.'
      });

      setSnackbar({
        open: true,
        message: 'Response copied to clipboard.',
        severity: 'success'
      });
    } catch (error) {
      console.error('Failed to copy:', error);
      setSnackbar({
        open: true,
        message: `Failed to copy response: ${error.message}`,
        severity: 'error'
      });
    }
  };

  const handleCopyCitations = async () => {
    try {
      const payload = buildCitationsCopyPayload(chatInteraction);
      if (!payload) {
        await navigator.clipboard.writeText('No citations available.');
        setSnackbar({
          open: true,
          message: 'No citations available to copy.',
          severity: 'success'
        });
        return;
      }

      await writeClipboardPayload({
        html: payload.html,
        plainText: payload.plainText,
        successMessage: 'Citations copied to clipboard.'
      });

      setSnackbar({
        open: true,
        message: 'Citations copied to clipboard.',
        severity: 'success'
      });
    } catch (error) {
      console.error('Failed to copy citations:', error);
      setSnackbar({
        open: true,
        message: `Failed to copy citations: ${error.message}`,
        severity: 'error'
      });
    }
  };

  const handleCopyQuestions = async () => {
    try {
      const payload = buildQuestionsCopyPayload(chatInteraction);
      if (!payload) {
        await navigator.clipboard.writeText('No suggested questions available.');
        setSnackbar({
          open: true,
          message: 'No suggested questions available to copy.',
          severity: 'success'
        });
        return;
      }

      await writeClipboardPayload({
        html: payload.html,
        plainText: payload.plainText,
        successMessage: 'Questions copied to clipboard.'
      });

      setSnackbar({
        open: true,
        message: 'Questions copied to clipboard.',
        severity: 'success'
      });
    } catch (error) {
      console.error('Failed to copy questions:', error);
      setSnackbar({
        open: true,
        message: `Failed to copy questions: ${error.message}`,
        severity: 'error'
      });
    }
  };

  const handleCopyAll = async () => {
    try {
      const promptPayload = buildPromptCopyPayload(chatInteraction);
      const responsePayload = buildResponseCopyPayload(chatInteraction, { preserveCitationMarkers: true, useRenderedHtml: true });
      const citationsPayload = buildCitationsCopyPayload(chatInteraction);
      const questionsPayload = buildQuestionsCopyPayload(chatInteraction);

      const buildSectionHeaderHtml = (label) => (
        `<h2 style="font-family: Segoe UI, Arial, sans-serif; font-size:24pt; font-weight:700; color:#0b3a75; mso-style-priority:1; margin:0 0 16px 0; padding-bottom:6px; border-bottom:1px solid #dbe3ec; line-height:1.2;">${escapeHtml(label)}</h2>`
      );

      const htmlSections = [
        promptPayload ? `<section style="margin:0 0 40px 0;">${buildSectionHeaderHtml('Question')}${promptPayload.html}</section>` : '',
        `<section style="margin:0 0 40px 0;">${buildSectionHeaderHtml('Response')}${responsePayload.html}</section>`
      ].filter(Boolean);
      const plainTextSections = [
        promptPayload ? `Question\n${promptPayload.plainText}` : '',
        `Response\n${responsePayload.plainText}`
      ].filter(Boolean);

      if (citationsPayload) {
        htmlSections.push(`<section style="margin:0 0 40px 0;">${buildSectionHeaderHtml('Citations')}${citationsPayload.html}</section>`);
        plainTextSections.push(`Citations\n${citationsPayload.plainText}`);
      }

      if (questionsPayload) {
        htmlSections.push(`<section style="margin:0;">${buildSectionHeaderHtml('You might also ask')}${questionsPayload.html}</section>`);
        plainTextSections.push(`You might also ask\n${questionsPayload.plainText}`);
      }

      const html = `
        <div style="font-family: Segoe UI, Arial, sans-serif; font-size: 11pt; line-height: 1.45; color: #111827;">
          ${htmlSections.join('')}
        </div>
      `;

      const plainText = plainTextSections.join('\n\n');
      await writeClipboardPayload({ html, plainText, successMessage: 'All content copied to clipboard.' });

      setSnackbar({
        open: true,
        message: 'All content copied to clipboard.',
        severity: 'success'
      });
    } catch (error) {
      console.error('Failed to copy all content:', error);
      setSnackbar({
        open: true,
        message: `Failed to copy all content: ${error.message}`,
        severity: 'error'
      });
    }
  };

  const buildCopyAllSectionsForInteraction = (interaction, { conversationHeading = '' } = {}) => {
    const isCurrentInteraction = String(interaction?.id || '') === String(chatInteraction?.id || '');
    const promptPayload = buildPromptCopyPayload(interaction);
    const responsePayload = buildResponseCopyPayload(interaction, {
      preserveCitationMarkers: true,
      useRenderedHtml: isCurrentInteraction,
    });
    const citationsPayload = buildCitationsCopyPayload(interaction);
    const questionsPayload = buildQuestionsCopyPayload(interaction);

    const buildSectionHeaderHtml = (label) => (
      `<h2 style="font-family: Segoe UI, Arial, sans-serif; font-size:24pt; font-weight:700; color:#0b3a75; mso-style-priority:1; margin:0 0 16px 0; padding-bottom:6px; border-bottom:1px solid #dbe3ec; line-height:1.2;">${escapeHtml(label)}</h2>`
    );

    const htmlSections = [];
    const plainTextSections = [];

    if (conversationHeading) {
      htmlSections.push(`<h1 style="font-family: Segoe UI, Arial, sans-serif; font-size:26pt; font-weight:700; color:#0b3a75; margin:0 0 18px 0;">${escapeHtml(conversationHeading)}</h1>`);
    }

    if (promptPayload && String(promptPayload.plainText || '').trim()) {
      htmlSections.push(`<section style="margin:0 0 40px 0;">${buildSectionHeaderHtml('Question')}${promptPayload.html}</section>`);
      plainTextSections.push(`Question\n${promptPayload.plainText}`);
    }

    if (responsePayload && String(responsePayload.plainText || '').trim()) {
      htmlSections.push(`<section style="margin:0 0 40px 0;">${buildSectionHeaderHtml('Response')}${responsePayload.html}</section>`);
      plainTextSections.push(`Response\n${responsePayload.plainText}`);
    }

    if (citationsPayload) {
      htmlSections.push(`<section style="margin:0 0 40px 0;">${buildSectionHeaderHtml('Citations')}${citationsPayload.html}</section>`);
      plainTextSections.push(`Citations\n${citationsPayload.plainText}`);
    }

    if (questionsPayload) {
      htmlSections.push(`<section style="margin:0;">${buildSectionHeaderHtml('You might also ask')}${questionsPayload.html}</section>`);
      plainTextSections.push(`You might also ask\n${questionsPayload.plainText}`);
    }

    if (htmlSections.length === 0) {
      return null;
    }

    return {
      html: htmlSections.join(''),
      plainText: plainTextSections.join('\n\n')
    };
  };

  const buildConversationCopyPayload = () => {
    const fallbackInteractions = chatInteraction ? [chatInteraction] : [];
    const sourceInteractions = Array.isArray(chatInteractions) && chatInteractions.length > 0
      ? chatInteractions
      : fallbackInteractions;

    const normalized = sourceInteractions
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => String(item?.prompt || '').trim() || String(item?.response || '').trim())
      .sort((a, b) => {
        const aTime = new Date(a.item?.createdAt || 0).getTime();
        const bTime = new Date(b.item?.createdAt || 0).getTime();
        const aValid = Number.isFinite(aTime) && aTime > 0;
        const bValid = Number.isFinite(bTime) && bTime > 0;
        if (aValid && bValid) {
          return aTime - bTime;
        }
        if (aValid && !bValid) {
          return -1;
        }
        if (!aValid && bValid) {
          return 1;
        }
        return a.index - b.index;
      })
      .map(({ item }) => item);

    if (normalized.length === 0) {
      return null;
    }

    const htmlSections = normalized.map((entry, index) => {
      const interactionSections = buildCopyAllSectionsForInteraction(entry, { conversationHeading: `Interaction ${index + 1}` });
      if (!interactionSections) {
        return '';
      }

      return `
        <section style="margin:0 0 24px 0;">
          ${interactionSections.html}
        </section>
      `;
    }).filter(Boolean);

    if (htmlSections.length === 0) {
      return null;
    }

    const pageBreakHtml = `
      <div style="page-break-before:always; break-before:page; mso-page-break-before:always; height:0; line-height:0; font-size:0;">&nbsp;</div>
    `;

    const plainText = normalized.map((entry, index) => {
      const interactionSections = buildCopyAllSectionsForInteraction(entry, { conversationHeading: '' });
      if (!interactionSections) {
        return '';
      }
      return `Interaction ${index + 1}\n\n${interactionSections.plainText}`;
    }).join('\n\n\f\n\n');

    const html = `
      <div style="font-family: Segoe UI, Arial, sans-serif; font-size: 11pt; line-height: 1.45; color: #111827;">
        ${htmlSections.join(pageBreakHtml)}
      </div>
    `;

    return { html, plainText };
  };

  const handleCopyConversation = async () => {
    try {
      const payload = buildConversationCopyPayload();
      if (!payload) {
        await navigator.clipboard.writeText('No conversation content available.');
        setSnackbar({
          open: true,
          message: 'No conversation content available to copy.',
          severity: 'success'
        });
        return;
      }

      await writeClipboardPayload({
        html: payload.html,
        plainText: payload.plainText,
        successMessage: 'Conversation copied to clipboard.'
      });

      setSnackbar({
        open: true,
        message: 'Conversation copied to clipboard.',
        severity: 'success'
      });
    } catch (error) {
      console.error('Failed to copy conversation:', error);
      setSnackbar({
        open: true,
        message: `Failed to copy conversation: ${error.message}`,
        severity: 'error'
      });
    }
  };

  const copyOptions = [
    { key: 'response', label: 'Copy this response', disabled: false },
    { key: 'citations', label: 'Copy these citations', disabled: !Array.isArray(chatInteraction.citations) || chatInteraction.citations.length === 0 },
    { key: 'questions', label: 'Copy these questions', disabled: normalizeSuggestedPrompts(chatInteraction.suggestedPrompts).length === 0 },
    {
      key: 'all',
      label: 'Copy question, response, citations, & suggested questions',
      disabled: !String(chatInteraction.response || '').trim()
        && !String(chatInteraction.prompt || chatInteraction.question || chatInteraction.query || '').trim()
        && (!Array.isArray(chatInteraction.citations) || chatInteraction.citations.length === 0)
        && normalizeSuggestedPrompts(chatInteraction.suggestedPrompts).length === 0
    },
    {
      key: 'conversation',
      label: 'Copy whole chat',
      disabled: !(Array.isArray(chatInteractions) && chatInteractions.some((item) => String(item?.prompt || '').trim() || String(item?.response || '').trim()))
        && !(String(chatInteraction?.prompt || '').trim() || String(chatInteraction?.response || '').trim())
    },
  ];

  const handleCopyAction = (action) => {
    if (action === 'response') {
      handleCopyResponse();
      return;
    }

    if (action === 'citations') {
      handleCopyCitations();
      return;
    }

    if (action === 'questions') {
      handleCopyQuestions();
      return;
    }

    if (action === 'all') {
      handleCopyAll();
      return;
    }

    if (action === 'conversation') {
      handleCopyConversation();
    }
  };

  const handleExportToExcel = async () => {
    try {
      const blob = await exportResponseToExcel(teamName, assistantName, smartNote, chatInteraction);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${smartNote.title} Test Case.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      setSnackbar({
        open: true,
        message: `Failed to export to Excel: ${error.message}`,
        severity: 'error'
      });
    }
  };

  const handleCitationClick = (footnote) => {
    const list = Array.isArray(chatInteraction.citations) ? chatInteraction.citations : [];
    const citation = list[footnote - 1];
    if (!citation) {
      return;
    }
    setSelectedCitation({ ...normalizeCitation(citation), footnote });
    setIsCitationContentExpanded(false);
  };

  const handleOpenCitation = (citation, event) => {
    if (!citation?.url) return;

    if (citation.opensInWindow) {
      event?.preventDefault?.();
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

    event?.preventDefault?.();
    window.open(citation.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Box
      sx={{
        color: theme.palette.text.primary,
        display: 'flex',
        flexDirection: 'column',
        padding: 2.5,
        paddingBottom: 1,
        background: isDarkMode
          ? 'linear-gradient(180deg, #0b172b 0%, #0f1f38 52%, #11243f 100%)'
          : 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
        borderRadius: '20px 20px 20px 6px',
        fontSize: '13pt',
        fontWeight: '400',
        textAlign: 'left',
        border: '1px solid',
        borderColor: isDarkMode ? 'rgba(148,163,184,0.25)' : 'rgba(13,28,61,0.14)',
        boxShadow: isDarkMode ? '0 14px 30px rgba(2,6,23,0.45)' : '0 10px 24px rgba(13,28,61,0.11)',
        minWidth: '55%',
        maxWidth: '92%'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
        <Box sx={{ fontSize: '0.72rem', letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: 700, opacity: 0.82 }}>
          Intelligent Sales Agent
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            clickable
            onClick={handleSelectForInsightRail}
            label={isInsightRailSelection ? 'Insight Rail Active' : 'Show In Insight Rail'}
            size="small"
            sx={{
              height: 24,
              borderRadius: '999px',
              fontSize: '0.68rem',
              fontWeight: 700,
              letterSpacing: 0.2,
              border: '1px solid',
              borderColor: isInsightRailSelection
                ? (isDarkMode ? 'rgba(125,211,252,0.5)' : 'rgba(2,132,199,0.28)')
                : (isDarkMode ? 'rgba(148,163,184,0.32)' : 'rgba(13,28,61,0.16)'),
              color: isInsightRailSelection
                ? (isDarkMode ? 'rgb(186,230,253)' : 'rgb(3,105,161)')
                : (isDarkMode ? 'rgba(226,232,240,0.9)' : 'rgba(13,28,61,0.82)'),
              backgroundColor: isInsightRailSelection
                ? (isDarkMode ? 'rgba(14,116,144,0.18)' : 'rgba(224,242,254,0.85)')
                : (isDarkMode ? 'rgba(148,163,184,0.08)' : 'rgba(13,28,61,0.04)'),
              '& .MuiChip-label': { px: 1.1 },
            }}
          />
          <Box sx={{ fontSize: '0.72rem', opacity: 0.72 }}>
            {Array.isArray(chatInteraction.citations) ? `${chatInteraction.citations.length} citations` : '0 citations'}
          </Box>
        </Box>
      </Box>
      <Box ref={responseContentRef}>
        <InfoSourceMarkdown
          content={chatInteraction.response}
          isComplete={isComplete}
          onCitationClick={handleCitationClick}
        />
      </Box>
      {isComplete && (
        <InfoSourceResponseFooter
          onCopyAction={handleCopyAction}
          copyOptions={copyOptions}
          isExcelExportEnabled={chatInteraction.canCallConvertToExcelApi}
          handleExportToExcel={handleExportToExcel}
          timeStamp={chatInteraction.createdAt}
        />
      )}
      <InfoSourceSuggestedPrompts prompts={chatInteraction.suggestedPrompts} />
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity === 'error' ? 'error' : 'success'}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Dialog
        open={Boolean(selectedCitation)}
        onClose={() => setSelectedCitation(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '18px',
            overflow: 'hidden',
            border: '1px solid',
            borderColor: isDarkMode ? 'rgba(148,163,184,0.24)' : 'rgba(13,28,61,0.12)',
            background: isDarkMode
              ? 'linear-gradient(180deg, #0b172b 0%, #0f1f38 52%, #11243f 100%)'
              : 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)'
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid', borderColor: isDarkMode ? 'rgba(148,163,184,0.2)' : 'rgba(13,28,61,0.1)' }}>
          Citation Details{selectedCitation?.footnote ? ` [${selectedCitation.footnote}]` : ''}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              {selectedCitation?.url ? (
                <Typography
                  component="a"
                  href={selectedCitation.url}
                  onClick={(event) => handleOpenCitation(selectedCitation, event)}
                  sx={{
                    color: theme.palette.text.primary,
                    fontWeight: 700,
                    textDecoration: 'none',
                    '&:hover': { textDecoration: 'underline' }
                  }}
                >
                  {selectedCitation?.sourceTitle || 'N/A'}
                </Typography>
              ) : (
                <Typography sx={{ fontWeight: 700 }}>{selectedCitation?.sourceTitle || 'N/A'}</Typography>
              )}
              {selectedCitation?.url && !selectedCitation?.isKpPolicy && (
                <Typography
                  component="a"
                  href={selectedCitation.url}
                  onClick={(event) => handleOpenCitation(selectedCitation, event)}
                  variant="caption"
                  sx={{
                    px: 0.9,
                    py: 0.25,
                    borderRadius: '999px',
                    border: '1px solid',
                    borderColor: isDarkMode ? 'rgba(148,163,184,0.38)' : 'rgba(13,28,61,0.2)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                    cursor: 'pointer',
                    color: theme.palette.text.primary,
                    textDecoration: 'none',
                    '&:hover': { textDecoration: 'underline' }
                  }}
                  title={selectedCitation.linkType === 'asset' ? 'Opens this citation asset in a separate window' : 'Opens this citation page in a new tab'}
                >
                  {selectedCitation.linkType === 'asset' ? 'Asset' : 'Page'}
                </Typography>
              )}
              {selectedCitation?.url && selectedCitation?.opensInNewTab && !selectedCitation?.isKpPolicy && <LaunchIcon sx={{ fontSize: 14, opacity: 0.7 }} />}
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.25 }}>
              <Box>
                <Typography variant="caption" sx={{ opacity: 0.75 }}>Region / Market</Typography>
                <Typography variant="body2">{selectedCitation?.region || 'N/A'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ opacity: 0.75 }}>Owner</Typography>
                <Typography variant="body2">{selectedCitation?.documentOwner || 'N/A'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ opacity: 0.75 }}>Last Updated</Typography>
                <Typography variant="body2">{formatCitationDate(selectedCitation?.lastUpdated)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ opacity: 0.75 }}>Source</Typography>
                <Typography variant="body2">{selectedCitation?.sourceLabel}</Typography>
              </Box>
            </Box>

            {!selectedCitation?.isKpPolicy && Array.isArray(selectedCitation?.keywords) && selectedCitation.keywords.length > 0 && (
              <Box>
                <Typography variant="caption" sx={{ opacity: 0.75 }}>Keywords</Typography>
                <Box sx={{ mt: 0.7, display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                  {selectedCitation.keywords.map((keyword) => (
                    <Chip
                      key={`${selectedCitation.footnote || 'citation'}-${keyword}`}
                      label={keyword}
                      size="small"
                      sx={{
                        height: 25,
                        borderRadius: '999px',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        border: '1px solid',
                        borderColor: isDarkMode ? 'rgba(148,163,184,0.32)' : 'rgba(13,28,61,0.18)',
                        color: isDarkMode ? 'rgba(226,232,240,0.92)' : 'rgba(13,28,61,0.84)',
                        backgroundColor: isDarkMode ? 'rgba(148,163,184,0.14)' : 'rgba(13,28,61,0.055)',
                        '& .MuiChip-label': { px: 1 }
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {selectedCitation?.citationContent && (
              <Box
                sx={{
                  mt: 0.25,
                  borderRadius: '14px',
                  border: '1px solid',
                  borderColor: isDarkMode ? 'rgba(148,163,184,0.24)' : 'rgba(13,28,61,0.16)',
                  background: isDarkMode
                    ? 'linear-gradient(180deg, rgba(30,41,59,0.45), rgba(15,23,42,0.35))'
                    : 'linear-gradient(180deg, rgba(241,245,249,0.92), rgba(248,250,252,0.82))',
                  overflow: 'hidden'
                }}
              >
                <Box
                  role="button"
                  tabIndex={0}
                  onClick={() => setIsCitationContentExpanded((prev) => !prev)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setIsCitationContentExpanded((prev) => !prev);
                    }
                  }}
                  sx={{
                    px: 1.25,
                    py: 0.75,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: isDarkMode ? 'rgba(148,163,184,0.08)' : 'rgba(13,28,61,0.05)',
                    },
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.45, opacity: 0.86 }}>
                    Citation Content
                  </Typography>
                  <IconButton
                    size="small"
                    disableRipple
                    tabIndex={-1}
                    title={isCitationContentExpanded ? 'Collapse citation content' : 'Expand citation content'}
                    sx={{
                      width: 26,
                      height: 26,
                      border: '1px solid',
                      borderColor: isDarkMode ? 'rgba(148,163,184,0.34)' : 'rgba(13,28,61,0.2)',
                      pointerEvents: 'none'
                    }}
                  >
                    {isCitationContentExpanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
                  </IconButton>
                </Box>
                {isCitationContentExpanded && (
                  <Box sx={{ px: 1.25, pb: 1.2, pt: 0.2 }}>
                    <CitationContentRenderer
                      content={selectedCitation.citationContent}
                      expandedQuoteContent={selectedCitation.expandedQuoteContent}
                      isDarkMode={isDarkMode}
                      fontSize="0.9rem"
                    />
                  </Box>
                )}
              </Box>
            )}

          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

InfoSourceResponse.propTypes = {
  chatInteraction: PropTypes.arrayOf(ChatInteractionType).isRequired,
  isComplete: PropTypes.bool.isRequired
};

export default InfoSourceResponse;
