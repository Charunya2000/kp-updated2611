import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import mermaidAPI from 'mermaid';
import { ErrorOutlined, OpenInNew, ContentCopy, Check } from '@mui/icons-material';
import { useTheme, IconButton, Tooltip } from '@mui/material';

const MermaidRenderer = ({ content, isComplete }) => {
  const [renderedContent, setRenderedContent] = useState(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const theme = useTheme();

  // Open the currently rendered SVG in a new tab so users can zoom/pan
  const handleOpenInNewTab = () => {
    if (!renderedContent) return;

    // Try to open a blank tab and write a small HTML document so we can control styling
    try {
      const bg = theme.palette?.background?.default ?? (theme.palette.mode === 'dark' ? '#121212' : '#ffffff');
      const fg = theme.palette?.text?.primary ?? (theme.palette.mode === 'dark' ? '#ffffff' : '#000000');

      const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Diagram</title>
    <style>
      :root { --bg: ${bg}; --fg: ${fg}; }
      html,body { height: 100%; margin: 0; background: var(--bg); color: var(--fg); font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial; }
      .container { height: 100vh; display: flex; align-items: center; justify-content: center; overflow: auto; padding: 16px; box-sizing: border-box; }
      .container > svg { display: block; /* avoid inline gaps */ }
      /* allow the svg to keep its intrinsic size; users can zoom the page or use scrollbars to pan */
      /* svg { width: 100% !important; height: 100% !important; } */
      /* make it easy to see focus / text if any */
      body::-webkit-scrollbar { height: 12px; width: 12px; }
    </style>
  </head>
  <body>
    <div class="container">
      ${renderedContent}
    </div>
  </body>
</html>`;

      const newWindow = window.open('', '_blank');
      if (newWindow) {
        // Write the HTML to the new window so we can style and center the SVG
        newWindow.document.open();
        newWindow.document.write(html);
        newWindow.document.close();
        try { newWindow.opener = null; } catch (e) { /* ignore if blocked */ }
        newWindow.focus();
        return;
      }

      // Fallback: if popup is blocked, fall back to blob approach
      const blob = new Blob([renderedContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (win) { try { win.opener = null; } catch (e) { } }
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      console.error('Failed to open SVG in new tab:', err);
    }
  };

  const handleCopyMermaid = async () => {
    if (!content) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        // fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = content;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  useEffect(() => {
    const renderMermaid = async () => {
      try {
        mermaidAPI.initialize({
          startOnLoad: false,
          theme: theme.palette.mode === 'dark' ? 'dark' : 'light',
        });
        // Validate the content using mermaidAPI.parse
        mermaidAPI.parse(content, { suppressErrors: false });

        // If parsing succeeds, proceed to render the diagram
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`; // Unique ID for the graph
        const { svg } = await mermaidAPI.render(id, content); // Extract the SVG string

        // Set the rendered SVG content
        setRenderedContent(svg);
        setError(false); // No error
      } catch (err) {
        console.error('Mermaid parsing/rendering error:', err);

        // Stop rendering and set error state
        setRenderedContent(null);
        setError(true);

        // Explicitly return to prevent further execution
        return;
      }
    };

    if (isComplete) {
      renderMermaid();
    }
  }, [content, isComplete, theme.palette.mode]);

  if (error) {
    // Display your custom error image or message
    return (
      <div className="mermaid-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px dashed', padding: '0 8px' }}>
        <ErrorOutlined style={{ fontSize: 24, color: '#f44336' }} />
        <p>Error rendering mermaid graph. Please check the syntax.</p>
      </div>
    );
  }

  if (!renderedContent) {
    // Display a loading message while rendering
    return <div className="mermaid">Loading mermaid graph...</div>;
  }

  // Render the SVG content with an overlay "open in new tab" button
  return (
    <div style={{ position: 'relative', border: '1px solid', borderRadius: 4, borderColor: theme.palette.divider, padding: 2 }}>
      <div
        className="mermaid"
        dangerouslySetInnerHTML={{ __html: renderedContent }}
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
      />
      <IconButton
        aria-label="Open diagram in new tab"
        onClick={handleOpenInNewTab}
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          padding: 4,
          zIndex: 20,
        }}
      >
        <OpenInNew />
      </IconButton>

      <Tooltip title={copied ? 'Copied!' : 'Copy mermaid source'}>
        <IconButton
          aria-label="Copy mermaid source"
          onClick={handleCopyMermaid}
          style={{
            position: 'absolute',
            bottom: 6,
            right: 6,
            padding: 4,
            zIndex: 20,
          }}
        >
          {copied ? <Check /> : <ContentCopy />}
        </IconButton>
      </Tooltip>
    </div>
  );
};

MermaidRenderer.propTypes = {
  content: PropTypes.string.isRequired,
  isComplete: PropTypes.bool.isRequired,
};

export default MermaidRenderer;