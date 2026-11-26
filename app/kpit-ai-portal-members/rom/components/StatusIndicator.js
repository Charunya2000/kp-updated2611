'use client';

import React from 'react';
import {
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  LinearProgress,
  Stack,
  Chip,
  Alert
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Info as InfoIcon
} from '@mui/icons-material';

const StatusIndicator = ({ currentStatus, isLoading, extractedDetails, detailedRom }) => {
  
  const getStatusInfo = () => {
    switch (currentStatus) {
      case 'input_processed':
        return {
          title: 'Searching for Similar Projects',
          description: 'Looking up our knowledge base for comparable ROM references...',
          color: 'info',
        };
      case 'similar_rom_found':
        return {
          title: 'Extracting Project Details',
          description: 'AI is analyzing your project inputs and similar ROMs to extract structured details...',
          color: 'info',
        };
      case 'extracting_details_waiting':
        return {
          title: 'Extracting Project Details',
          description: 'AI is analyzing your project against similar ROMs. This may take a minute or two...',
          color: 'info',
        };
      case 'details_extracted':
        return {
          title: 'Details Ready for Review',
          description: 'Project details extracted successfully. Loading review...',
          color: 'success',
        };
      case 'generating_rom':
        return {
          title: 'Generating ROM Estimate',
          description: 'Building a detailed cost breakdown based on the approved project details...',
          color: 'info',
        };
      case 'detailed_rom_generated':
        return {
          title: 'ROM Estimate Ready',
          description: 'Detailed ROM generated. Loading review...',
          color: 'success',
        };
      case 'generating_summary':
        return {
          title: 'Generating Executive Summary',
          description: 'Creating the final executive summary and deliverables...',
          color: 'info',
        };
      case 'final_summary_generated':
        return {
          title: 'Estimate Complete',
          description: 'ROM estimation complete. Loading results...',
          color: 'success',
        };
      default:
        return {
          title: 'Processing',
          description: 'Working on your ROM estimate...',
          color: 'info',
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <Paper sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
          <ScheduleIcon sx={{ mr: 2, fontSize: 32, color: `${statusInfo.color}.main` }} />
          <Typography variant="h4" component="h2" color={`${statusInfo.color}.main`}>
            {statusInfo.title}
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          {statusInfo.description}
        </Typography>
        
        {/* Animated progress bar — indeterminate while loading, hidden when idle */}
        {isLoading && (
          <Box sx={{ width: '100%', maxWidth: 500, mx: 'auto', mt: 2 }}>
            <LinearProgress 
              color={statusInfo.color}
              sx={{ height: 6, borderRadius: 3 }}
            />
          </Box>
        )}
      </Box>

      {/* Completed milestones */}
      <Stack spacing={1.5} sx={{ mb: 3 }}>
        {extractedDetails && (
          <Alert severity="success" icon={<CheckCircleIcon />} sx={{ py: 0.5 }}>
            <Typography variant="body2">
              <strong>Project details extracted</strong>
            </Typography>
          </Alert>
        )}
        {detailedRom && (
          <Alert severity="success" icon={<CheckCircleIcon />} sx={{ py: 0.5 }}>
            <Typography variant="body2">
              <strong>Detailed ROM estimate generated</strong>
            </Typography>
          </Alert>
        )}
      </Stack>

      {/* Current Status Card */}
      <Card sx={{ bgcolor: `${statusInfo.color}.50`, border: '1px solid', borderColor: `${statusInfo.color}.200` }}>
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip 
              label={currentStatus.replace(/_/g, ' ').toUpperCase()} 
              color={statusInfo.color}
              size="small"
            />
            <Typography variant="body2" color="text.secondary">
              {getStatusDescription(currentStatus)}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Help Information */}
      {isLoading && (
        <Alert severity="info" sx={{ mt: 3 }} icon={<InfoIcon />}>
          <Typography variant="body2">
            We're processing your project through our ROM estimation workflow. 
            You'll be notified when your review is needed or when results are ready.
          </Typography>
        </Alert>
      )}
    </Paper>
  );
};

// Helper function to get detailed status descriptions
const getStatusDescription = (status) => {
  const descriptions = {
    'input_processed': 'Searching for similar projects in the knowledge base...',
    'similar_rom_found': 'Extracting structured details from your project inputs...',
    'extracting_details_waiting': 'AI analysis in progress. This typically takes 1–2 minutes.',
    'details_extracted': 'Loading review screen...',
    'generating_rom': 'Building detailed cost breakdown. This may take a moment...',
    'detailed_rom_generated': 'Loading ROM review...',
    'generating_summary': 'Creating executive summary and final deliverables...',
    'final_summary_generated': 'Loading final results...',
    'completed': 'ROM estimate complete — ready for download.'
  };
  
  return descriptions[status] || 'Processing your request...';
};

export default StatusIndicator;