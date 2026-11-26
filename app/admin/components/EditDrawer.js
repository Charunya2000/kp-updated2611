'use client';
import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Drawer,
  Divider,
  Tooltip
} from '@mui/material';
import { Close as CloseIcon, ContentCopy as ContentCopyIcon } from '@mui/icons-material';
import ResizableContainer from '@/app/components/ResizableContainer';

const EditDrawer = ({
  open,
  onClose,
  title,
  children,
  onSave,
  onCancel,
  saveButtonText,
  cancelButtonText = "Cancel",
  saveDisabled = false,
  subtitle
}) => {

  const resolvedSaveButtonText = saveButtonText ?? "Confirm changes";
  const [copied, setCopied] = useState(false);
  const [isTooltipHovered, setIsTooltipHovered] = useState(false);
  const copyResetTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) {
        clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(subtitle);
    setCopied(true);

    if (copyResetTimerRef.current) {
      clearTimeout(copyResetTimerRef.current);
    }

    copyResetTimerRef.current = setTimeout(() => {
      setCopied(false);
      copyResetTimerRef.current = null;
    }, 3000);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
    >
      <ResizableContainer
        initialWidth={400}
        minWidth={300}
        maxWidth={1000}
        resizeDirection="horizontal"
        handlePosition="left"
        sx={{ height: '100%' }}
      >
        <Box sx={{
          width: '100%',
          p: 3,
          overflow: 'hidden',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: "background.drawer"
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h4" fontWeight="bold" sx={{ fontSize: '1.6rem' }}>
              {title}
            </Typography>
            <IconButton onClick={onClose} size="medium">
              <CloseIcon sx={{ fontSize: '1.6rem' }} />
            </IconButton>
          </Box>

          {
            subtitle &&
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 0.5 }}>
              <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                {subtitle}
              </Typography>
              <Tooltip
                title={copied ? 'Copied!' : 'Copy'}
                open={copied || isTooltipHovered}
                onOpen={() => setIsTooltipHovered(true)}
                onClose={() => setIsTooltipHovered(false)}
              >
                <IconButton size="small" onClick={handleCopy} sx={{ color: 'primary.main' }}>
                  <ContentCopyIcon sx={{ fontSize: '1rem' }} />
                </IconButton>
              </Tooltip>
            </Box>
          }

          <Divider sx={{ mb: 3 }} />

          {/* Content */}
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5,
            mb: 3,
            overflow: 'auto',
            pt: '6px',
            flex: 1
          }}>
            {children}
          </Box>

          {/* Action Buttons */}
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            pt: 2,
            mt: 'auto'
          }}>
            <Button
              variant="primary"
              onClick={onSave}
              disabled={saveDisabled}
              fullWidth
              size="medium"
              sx={{
                fontWeight: 'bold',
                fontSize: '1rem',
                py: 1.2,
                borderRadius: '25px',
                textTransform: 'none'
              }}
            >
              {resolvedSaveButtonText}
            </Button>

            <Button
              variant="secondary"
              onClick={onCancel}
              fullWidth
              size="medium"
              sx={{
                fontSize: '1rem',
                py: 1.2,
                borderRadius: '25px',
                textTransform: 'none'
              }}
            >
              {cancelButtonText}
            </Button>
          </Box>
        </Box>
      </ResizableContainer>
    </Drawer >
  );
};

export default EditDrawer;
