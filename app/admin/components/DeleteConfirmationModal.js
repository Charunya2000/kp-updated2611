'use client';
import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

const DeleteConfirmationModal = ({
  open,
  onClose,
  onConfirm,
  itemName,
  title = "Delete Item?",
  message = "This will permanently delete"
}) => {
  const theme = useTheme();

  if (!open) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1300,
      }}
      onClick={onClose}
    >
      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{
          width: '50%',
          maxWidth: '350px',
          borderRadius: '24px',
          backgroundColor: theme.palette.mode === 'dark' ? '#0D1C3D' : '#F7F7F7',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.24)',
        }}
      >
        {/* Warning icon */}
        <Box sx={{
          display: 'flex',
          justifyContent: 'center',
          mb: 2,
          pt: 2.5
        }}>
          <Box sx={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: 'rgba(211, 47, 47, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'subtle-pulse 3s infinite',
          }}>
            <WarningIcon sx={{ 
              color: '#d32f2f', 
              fontSize: '34px'
            }} />
          </Box>
        </Box>

        <Typography variant="h6" fontWeight="bold" sx={{ 
          mb: 1.5, 
          fontSize: '1.2rem', 
          textAlign: 'center',
          px: 2.5 
        }}>
          {title}
        </Typography>

        <Typography variant="body2" sx={{ 
          mb: 1, 
          fontSize: '0.95rem',
          lineHeight: 1.4,
          textAlign: 'center',
          px: 2.5 
        }}>
          {message}
        </Typography>

        {/* Highlighted item name */}
        <Box sx={{
          display: 'flex',
          justifyContent: 'center',
          px: 2.5,
          mb: 2.5
        }}>
          <Box sx={{
            display: 'inline-block',
            backgroundColor: 'rgba(211, 47, 47, 0.12)',
            border: '2px solid rgba(211, 47, 47, 0.4)',
            borderRadius: '12px',
            px: 2,
            py: 0.8,
            boxShadow: '0 4px 16px rgba(211, 47, 47, 0.25)',
            transform: 'scale(1.02)',
          }}>
            <Typography 
              variant="body1"
              sx={{ 
                fontWeight: 'bold', 
                color: '#c62828',
                fontSize: '1.1rem',
                wordBreak: 'break-word',
                letterSpacing: '0.2px'
              }}
            >
              "{itemName}"
            </Typography>
          </Box>
        </Box>

        {/* Buttons */}
        <Box sx={{ 
          display: 'flex', 
          gap: 1.5, 
          justifyContent: 'center',
          flexDirection: { xs: 'column', sm: 'row' },
          px: 2.5,
          pb: 2.5,
          '& button': {
            transition: 'all 0.2s ease-in-out'
          }
        }}>
          <Button
            onClick={onClose}
            variant="outlined"
            size="small"
            sx={{ 
              minWidth: { xs: '100%', sm: '80px' },
              textTransform: 'none',
              fontSize: '0.9rem',
              py: 0.8,
              borderRadius: '8px',
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'
              }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            variant="contained"
            size="small"
            sx={{ 
              minWidth: { xs: '100%', sm: '80px' },
              textTransform: 'none',
              fontSize: '0.9rem',
              py: 0.8,
              borderRadius: '8px',
              backgroundColor: '#d32f2f',
              boxShadow: '0 2px 8px rgba(211, 47, 47, 0.2)',
              '&:hover': {
                backgroundColor: '#b71c1c',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(211, 47, 47, 0.3)'
              }
            }}
          >
            Delete
          </Button>
        </Box>

        <style jsx>{`
          @keyframes subtle-pulse {
            0% {
              box-shadow: 0 0 0 0 rgba(211, 47, 47, 0.8);
            }
            50% {
              box-shadow: 0 0 0 12px rgba(211, 47, 47, 0);
            }
            100% {
              box-shadow: 0 0 0 0 rgba(211, 47, 47, 0);
            }
          }
        `}</style>
      </Box>
    </Box>
  );
};

export default DeleteConfirmationModal;