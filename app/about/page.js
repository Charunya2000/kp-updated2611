'use client';

import { Box, Typography, Card, CardContent, Avatar, IconButton } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import CloseIcon from '@mui/icons-material/Close';
import { useRouter } from 'next/navigation';

export default function AboutPage() {
  const router = useRouter();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minHeight: '100vh',
        padding: 4,
      }}
    >
      <Card
        sx={{
          maxWidth: 600,
          width: '100%',
          boxShadow: 3,
          borderRadius: 2,
          padding: 3,
          position: 'relative',
          backgroundColor: 'card.body.deep'
        }}
      >
        <IconButton
          sx={{ position: 'absolute', top: 8, right: 8 }}
          onClick={() => router.push('/')}
          aria-label="close"
        >
          <CloseIcon />
        </IconButton>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2, fontSize: 52 }}>
            <InfoIcon />
          </Box>
          <Typography variant="h4" align="center">
            About KPIT AI Portal
          </Typography>
          <Typography variant="body1" align="center" marginTop={2}>
            Welcome to the KPIT AI Portal! This platform is designed to empower users with advanced AI tools and
            resources to enhance productivity and collaboration. Explore our features and discover how AI can
            transform your workflows.
          </Typography>
          <Typography variant="body2" align="center" marginTop={6}>
            Version: 1.0.0 | Last Updated: August 2025
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}