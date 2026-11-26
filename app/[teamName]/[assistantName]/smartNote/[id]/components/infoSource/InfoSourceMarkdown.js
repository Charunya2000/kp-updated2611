'use client';

import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { IconButton, Tooltip, Box, Button } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import MermaidRenderer from '../MermaidRenderer';
import mermaid from 'mermaid';

const CodeBlock = ({ className, children, ...props }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const code = String(children).replace(/\n$/, '');
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  const isInline = !className || !className.startsWith('language-');

  if (isInline) {
    return <code className={className} {...props}>{children}</code>;
  }

  return (
    <Box sx={{ position: 'relative' }}>
      <Box style={{ margin: 0, overflowX: 'auto' }}>
        <code {...props} className={className}>{children}</code>
        <Box
          sx={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            zIndex: 1,
            pb: 1,
          }}
        >
          <Tooltip title={copied ? 'Copied!' : 'Copy code'}>
            <IconButton
              size="small"
              onClick={handleCopy}
              sx={{
                opacity: 0.8,
                backgroundColor: 'transparent',
                '&:hover': {
                  bgcolor: 'action.hover',
                  opacity: 1,
                },
              }}
            >
              {copied ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
};

function trimPotentialMermaidContent(content) {
  const mermaidStartIndex = content.lastIndexOf('```mermaid');
  if (mermaidStartIndex !== -1 && !content.slice(mermaidStartIndex).includes('```')) {
    return content.slice(0, mermaidStartIndex);
  }
  return content;
}

function restoreCollapsedMarkdownBlocks(content = '') {
  const genericFailure = 'Your request could not be processed. Please try again.';
  const response = content.endsWith(genericFailure) && content.length > genericFailure.length
    ? content.slice(0, -genericFailure.length).trimEnd()
    : content;

  return response
    .split(/(```[\s\S]*?```)/g)
    .map((part) => {
      if (part.startsWith('```') || !/[^\r\n]\s+#{1,6}\s/.test(part)) {
        return part;
      }

      return part
        .replace(/[^\S\r\n]+(?=#{1,6}[^\S\r\n]+)/g, '\n\n')
        .replace(/[^\S\r\n]+-[^\S\r\n]+/g, '\n- ');
    })
    .join('');
}

function replaceCitationFootnotes(content = '') {
  const parts = content.split(/(```[\s\S]*?```)/g);

  return parts
    .map((part) => {
      if (part.startsWith('```')) {
        return part;
      }
      return part.replace(/\[(\d{1,3})\]/g, '<citation-chip footnote="$1"></citation-chip>');
    })
    .join('');
}

const InfoSourceMarkdown = ({ content, isComplete, onCitationClick }) => {
  useEffect(() => {
    if (isComplete) {
      mermaid.initialize({ startOnLoad: true });
      mermaid.contentLoaded();
    }
  }, [isComplete]);

  const renderContent = (value) => {
    const trimmedContent = trimPotentialMermaidContent(restoreCollapsedMarkdownBlocks(value || ''));
    const citationFormattedContent = replaceCitationFootnotes(trimmedContent);
    const parts = citationFormattedContent.split(/(```mermaid[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```mermaid')) {
        const mermaidContent = part.replace(/```mermaid|```/g, '').trim();
        return (
          <MermaidRenderer key={index} content={mermaidContent} isComplete={isComplete} />
        );
      }

      return (
        <ReactMarkdown
          key={index}
          className="reduced-line-spacing overflow-auto"
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            code: CodeBlock,
            'citation-chip': ({ node }) => {
              const footnote = Number(node?.properties?.footnote || 0);

              if (!footnote) {
                return null;
              }

              return (
                <Button
                  size="small"
                  onClick={() => onCitationClick?.(footnote)}
                  sx={{
                    minWidth: 24,
                    px: 0.8,
                    py: 0,
                    lineHeight: 1.2,
                    ml: 0.5,
                    textTransform: 'none',
                    borderRadius: '999px',
                    border: '1px solid',
                    borderColor: 'rgba(56,189,248,0.55)',
                    backgroundColor: 'rgba(186,230,253,0.35)',
                    color: 'text.primary',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    '&:hover': {
                      backgroundColor: 'rgba(125,211,252,0.45)'
                    }
                  }}
                >
                  {footnote}
                </Button>
              );
            }
          }}
        >
          {part}
        </ReactMarkdown>
      );
    });
  };

  return <div>{renderContent(content)}</div>;
};

InfoSourceMarkdown.propTypes = {
  content: PropTypes.string.isRequired,
  isComplete: PropTypes.bool.isRequired,
  onCitationClick: PropTypes.func,
};

export default InfoSourceMarkdown;
