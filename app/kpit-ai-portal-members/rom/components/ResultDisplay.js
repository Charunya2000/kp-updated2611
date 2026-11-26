'use client';

import React from 'react';
import {
  Paper,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Divider,
  Chip,
  Alert,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Summarize as SummaryIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';

const ResultDisplay = ({ summaryRom, detailedRom, extractedDetails, processedInput, onStartNew }) => {
  
  const handleDownload = (content, filename) => {
    const blob = new Blob([typeof content === 'string' ? content : JSON.stringify(content, null, 2)], {
      type: 'text/plain;charset=utf-8'
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      {/* Fixed Header */}
      <Paper elevation={3} sx={{ p: 4, mb: 3, position: 'sticky', top: 0, zIndex: 100 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckCircleIcon sx={{ mr: 3, fontSize: 48, color: 'success.main' }} />
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3" component="h1" sx={{ fontWeight: 'bold', color: 'success.main', mb: 1 }}>
              ROM Estimate Complete!
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Your comprehensive ROM estimate has been generated successfully
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Main Content */}
      <Box sx={{ px: 3, pb: 20 }}>
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>

      <Alert severity="success" sx={{ mb: 4 }}>
        <Typography variant="body1">
          <strong>Congratulations!</strong> Your ROM estimate has been completed. You can now download your results or start a new estimation.
        </Typography>
      </Alert>

      {/* Summary Section */}
      <Card sx={{ mb: 4, bgcolor: 'primary.50', border: '2px solid', borderColor: 'primary.200' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <SummaryIcon sx={{ mr: 2, color: 'primary.main' }} />
            <Typography variant="h5" color="primary.main">
              Executive Summary
            </Typography>
          </Box>
          
          {summaryRom ? (
            <Box>
              {typeof summaryRom === 'string' ? (
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {summaryRom}
                </Typography>
              ) : (
                <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                  <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(summaryRom, null, 2)}
                  </Typography>
                </Box>
              )}
            </Box>
          ) : (
            <Typography variant="body1" color="text.secondary">
              Summary information is being processed...
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Detailed Results Accordion */}
      <Grid container spacing={3}>
        {detailedRom && (
          <Grid item xs={12}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Detailed ROM Estimate</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, maxHeight: 400, overflow: 'auto' }}>
                  {typeof detailedRom === 'string' ? (
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {detailedRom}
                    </Typography>
                  ) : (
                    <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(detailedRom, null, 2)}
                    </Typography>
                  )}
                </Box>
              </AccordionDetails>
            </Accordion>
          </Grid>
        )}

        {extractedDetails && (
          <Grid item xs={12}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Project Details Used</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                          Project Information
                        </Typography>
                        <Stack spacing={1}>
                          <Box>
                            <Typography variant="body2" fontWeight="bold">Title:</Typography>
                            <Typography variant="body2">{extractedDetails.project_title || 'N/A'}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="body2" fontWeight="bold">Confidence Level:</Typography>
                            <Chip label={`${extractedDetails.confidence_level || 'N/A'}/10`} size="small" />
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                          Scope & Markets
                        </Typography>
                        {extractedDetails.markets && (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" fontWeight="bold">Target Markets:</Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                              {extractedDetails.markets.split(',').map((market, index) => (
                                <Chip key={index} label={market.trim()} size="small" variant="outlined" />
                              ))}
                            </Box>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>
        )}
      </Grid>

      <Divider sx={{ my: 4 }} />

          {/* Download Section */}
          <Paper elevation={2} sx={{ p: 4, bgcolor: 'primary.50', border: '2px solid', borderColor: 'primary.200' }}>
            <Typography variant="h5" gutterBottom textAlign="center" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
              🎉 Your ROM Estimate is Ready!
            </Typography>
            <Typography variant="body1" textAlign="center" sx={{ mb: 3, color: 'text.secondary' }}>
              Download your comprehensive ROM analysis documents below
            </Typography>
          </Paper>
        
        {/* Additional Information */}
        <Alert severity="info" sx={{ mb: 4 }}>
          <Typography variant="body2">
            <strong>What's Next?</strong> You can download your ROM estimate documents using the buttons below, or start a new estimation for a different project. 
            The detailed report includes all the analysis and assumptions used to generate your estimate.
          </Typography>
        </Alert>
        </Box>
      </Box>

      {/* Action Buttons - Fixed at Bottom */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          p: 3,
          zIndex: 1000,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.1)'
        }}
      >
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
          <Stack direction="row" spacing={3} justifyContent="center" flexWrap="wrap">
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={onStartNew}
              startIcon={<RefreshIcon />}
              sx={{
                minWidth: 200,
                py: 2,
                fontSize: '1.1rem',
                fontWeight: 'bold',
                borderRadius: 3,
                boxShadow: 4,
                '&:hover': {
                  boxShadow: 8,
                  transform: 'translateY(-2px)'
                },
                transition: 'all 0.3s ease'
              }}
            >
              Start New ROM Estimate
            </Button>
            
            {summaryRom && (
              <Button
                variant="outlined"
                color="primary"
                size="large"
                onClick={() => handleDownload(summaryRom, 'ROM_Summary.txt')}
                startIcon={<DownloadIcon />}
                sx={{
                  minWidth: 200,
                  py: 2,
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  borderRadius: 3,
                  borderWidth: 2,
                  '&:hover': {
                    borderWidth: 2,
                    transform: 'translateY(-2px)'
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                Download Summary
              </Button>
            )}
            
            {detailedRom && (
              <Button
                variant="outlined"
                color="secondary"
                size="large"
                onClick={() => handleDownload(detailedRom, 'ROM_Detailed_Estimate.txt')}
                startIcon={<DownloadIcon />}
                sx={{
                  minWidth: 200,
                  py: 2,
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  borderRadius: 3,
                  borderWidth: 2,
                  '&:hover': {
                    borderWidth: 2,
                    transform: 'translateY(-2px)'
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                Download Detailed Report
              </Button>
            )}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
};

export default ResultDisplay;