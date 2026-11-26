'use client';

import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { IconButton, Tooltip, Box } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import MermaidRenderer from './MermaidRenderer'; // Import the MermaidRenderer component
import mermaid from 'mermaid';

// Code block component with copy functionality
const CodeBlock = ({ node, className, children, ...props }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const code = String(children).replace(/\n$/, '');
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  // Inline code typically doesn't have a language class
  const isInline = !className || !className.startsWith('language-');

  // Inline code
  if (isInline) {
    return <code className={className} {...props}>{children}</code>;
  }

  // Code block with copy button
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
            '@media (max-width: 600px)': {
              right: 8,
              left: 'auto',
            },
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

const Markdown = ({ content, isComplete }) => {
  useEffect(() => {
    if (isComplete) {
      mermaid.initialize({ startOnLoad: true });
      mermaid.contentLoaded();
    }
  }, [isComplete]);

  const trimPotentialMermaidContent = (content) => {
    const mermaidStartIndex = content.lastIndexOf('```mermaid');
    if (mermaidStartIndex !== -1 && !content.slice(mermaidStartIndex).includes('```')) {
      return content.slice(0, mermaidStartIndex);
    }
    return content;
  };

  const renderContent = (content) => {
    const trimmedContent = trimPotentialMermaidContent(content);
    const parts = trimmedContent.split(/(```mermaid[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```mermaid')) {
        const mermaidContent = part.replace(/```mermaid|```/g, '').trim();
        return (
          <MermaidRenderer key={index} content={mermaidContent} isComplete={isComplete} />
        );
      } else {
        return (
          <ReactMarkdown
            key={index}
            className='reduced-line-spacing overflow-auto'
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
              code: CodeBlock
            }}
          >
            {part}
          </ReactMarkdown>
        );
      }
    });
  };

  return (
    <Box sx={(theme) => ({
      overflow: 'auto',
      '& h1, & h2, & h3, & h4, & h5, & h6': {
        borderBottom: '1px solid',
        borderColor: 'divider',
        pb: 1,
        mb: 2,
      },
      '& table': {
        borderSpacing: 0,
        borderCollapse: 'collapse',
        borderColor: 'divider',
        display: 'block',
        width: 'max-content',
        maxWidth: '100%',
        overflow: 'auto',
        boxSizing: 'border-box'
      },
      '& tbody, & td, & tfoot, & th, & thead, & tr': {
        borderColor: 'divider',
        borderStyle: 'solid',
        borderWidth: '1px',
        boxSizing: 'border-box'
      },
      // Zebra striping: make header and every other data row use background color
      '& th': {
        backgroundColor: theme.palette.mode === 'dark' ? '#1A1A1A' : '#ffffff',
        textAlign: 'center'
      },
      '& tbody tr:nth-of-type(odd)': {
        backgroundColor: theme.palette.mode === 'dark' ? '#1A1A1A' : '#ffffff',
      },
      '& tbody tr:nth-of-type(even)': {
        backgroundColor: theme.palette.mode === 'dark' ? '#0F0F0F' : 'inherit',
      },
      '& th, & td': {
        padding: '8px 12px'
      },
      '& td': {
        textAlign: 'left'
      }
    })}>
      {renderContent(content)}
    </Box>
  );
};

export default Markdown;

Markdown.propTypes = {
  content: PropTypes.string.isRequired,
  isComplete: PropTypes.bool.isRequired,
};