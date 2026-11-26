'use client';

import React, { useEffect, useState } from "react";
import { Box, CircularProgress, Typography, Button } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

const getDownloadUrl = (filePath) => {
  if (!filePath) return null;
  if (filePath.startsWith('http')) return filePath;
  return filePath.startsWith('/') ? filePath : `/${filePath}`;
};

const getStatusColor = (status) => {
  if (!status) return 'text.primary';
  const s = status.toLowerCase();
  if (s === 'completed') return 'success.main';
  if (s === 'processing') return 'warning.main';
  if (s === 'initiating') return 'info.main';
  if (s === 'failed') return 'error.main';
  return 'text.primary';
};

function AnimatedDots() {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => (prev.length < 3 ? prev + '.' : ''));
    }, 400);
    return () => clearInterval(interval);
  }, []);
  return <span>{dots}</span>;
}

const getStatusIcon = (status) => {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === 'processing') {
    // Animated 3 dots for Processing
    return (
      <span style={{ fontWeight: 'bold', fontSize: 22, marginLeft: -12, color: '#ed6c02', display: 'inline-block', verticalAlign: 'middle' }}>
        <AnimatedDots />
      </span>
    );
  }
  if (s === 'initiating') {
    return <CircularProgress size={22} color="info" sx={{ ml: -1 }} />;
  }
  if (s === 'completed') {
    return <CheckCircleIcon sx={{ color: 'success.main', ml: -1.5, fontSize: 22 }} />;
  }
  if (s === 'failed') {
    return <CancelIcon sx={{ color: 'error.main', ml: -1.5, fontSize: 22 }} />;
  }
  return null;
};


const Status = ({ status }) => {
  const theme = useTheme();
  const [displayedMessage, setDisplayedMessage] = useState("");
  const downloadUrl = getDownloadUrl(status?.file_path);

  useEffect(() => {
    if (!status || !status.message) {
      setDisplayedMessage("");
      return;
    }
    const words = status.message.split(" ");
    let i = 0;
    setDisplayedMessage("");
    const interval = setInterval(() => {
      setDisplayedMessage((prev) => {
        if (i >= words.length) {
          clearInterval(interval);
          return prev;
        }
        const next = prev ? prev + " " + words[i] : words[i];
        i++;
        return next;
      });
    }, 110);
    return () => clearInterval(interval);
  }, [status?.message, status?.status]);

  if (!status) {
    return (
      <Box sx={{
        p: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: theme.palette.mode === 'dark' ? '#0D1C3D' : '#F7F7F7'
      }}>
        <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'error.main' }}>
          Status: unavailable.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{
      p: 2,
      borderRadius: 2,
      border: '1px solid',
      borderColor: 'divider',
      backgroundColor: theme.palette.mode === 'dark' ? '#0D1C3D' : '#F7F7F7'
    }}>
      <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 'bold',
            color: getStatusColor(status.status),
            mr: 1
          }}
        >
          Status: {status.status}
        </Typography>
        {getStatusIcon(status.status)}
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
        Message: <span style={{ fontWeight: 'bold' }}>{displayedMessage}</span>
      </Typography>
      {downloadUrl && (
        <Button
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          variant="secondary"
          sx={{
            fontWeight: 'bold',
            textTransform: 'none',
            mt: 1,
            fontSize: '1.25rem',
            py: 1,
            px: 2,
            borderRadius: 2
          }}
        >
          Download File
        </Button>
      )}
    </Box>
  );
};
export default Status;