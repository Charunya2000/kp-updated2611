'use client';

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Button,
  Typography,
  Box
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function AssistantNewsModal({
  open,
  onClose,
  news,
  assistantDisplayName,
  updatedAt,
}) {
  const hasNews = typeof news === 'string' && news.trim().length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="assistant-news-dialog-title"
      PaperProps={{
        sx: {
          borderRadius: '16px',
          maxHeight: '85vh',
        },
      }}
    >
      <DialogTitle
        id="assistant-news-dialog-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
        }}
      >
        <Box>
          <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
            News & Updates
          </Typography>
          {assistantDisplayName && (
            <Typography variant="body2" color="text.secondary">
              {assistantDisplayName}
            </Typography>
          )}
        </Box>
        <IconButton
          aria-label="close"
          onClick={onClose}
          size="small"
          sx={{
            color: (theme) => theme.palette.grey[500],
            '&:hover': {
              color: (theme) => theme.palette.text.primary,
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent
        dividers
        sx={{
          py: 2,
          px: 3,
          overflowY: 'auto',
          '& .markdown-body': {
            fontSize: '1rem',
            lineHeight: 1.6,
          },
          '& p': {
            mb: 1.5,
          },
          '& h1, & h2, & h3, & h4, & h5, & h6': {
            mt: 2,
            mb: 1,
            fontWeight: 600,
          },
          '& ul, & ol': {
            pl: 3,
            mb: 1.5,
          },
          '& li': {
            mb: 0.5,
          },
          '& a': {
            color: 'primary.main',
            textDecoration: 'underline',
          },
          '& code': {
            backgroundColor: 'action.hover',
            p: 0.5,
            borderRadius: '4px',
            fontSize: '0.9em',
            fontFamily: 'monospace',
          },
          '& pre': {
            backgroundColor: 'action.hover',
            p: 1.5,
            borderRadius: '8px',
            overflowX: 'auto',
            mb: 1.5,
          },
          '& blockquote': {
            borderLeft: '4px solid',
            borderColor: 'divider',
            pl: 2,
            py: 0.5,
            my: 1.5,
            color: 'text.secondary',
          },
          '& table': {
            width: '100%',
            borderCollapse: 'collapse',
            my: 2,
          },
          '& th, & td': {
            border: '1px solid',
            borderColor: 'divider',
            p: 1,
            textAlign: 'left',
          },
          '& th': {
            backgroundColor: 'action.hover',
            fontWeight: 600,
          },
        }}
      >
        {hasNews ? (
          <Box className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{news}</ReactMarkdown>
          </Box>
        ) : (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              No news or updates available for this assistant at this time.
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5, justifyContent: 'space-between' }}>
        {updatedAt ? (
          <Typography variant="caption" color="text.secondary">
            Last updated: {new Date(updatedAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })}
          </Typography>
        ) : (
          <Box />
        )}
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
