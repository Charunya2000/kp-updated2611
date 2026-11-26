'use client';

import { Box, Typography, Card, CardContent, List, ListItem, ListItemIcon, ListItemText, IconButton, Link } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ContactSupportIcon from '@mui/icons-material/ContactSupport';
import BugReportIcon from '@mui/icons-material/BugReport';
import FeedbackIcon from '@mui/icons-material/Feedback';
import CloseIcon from '@mui/icons-material/Close';
import { useRouter } from 'next/navigation';

export default function HelpPage() {
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
          aria-label="close"
          onClick={() => router.push('/')}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
          }}
        >
          <CloseIcon />
        </IconButton>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2, fontSize: 52 }}>
            <HelpOutlineIcon />
          </Box>
          <Typography variant="h4" align="center" gutterBottom>
            Help & Support
          </Typography>
          <Typography variant="body1" align="center" gutterBottom>
            Need assistance? Explore the resources below to get help with the KPIT AI Portal.
          </Typography>
          <Typography variant="body2" align="center" gutterBottom>
            Visit our team SharePoint site for more resources: {' '}
            <Link href="https://sp-cloud.kp.org/sites/hpaisvc" target="_blank" rel="noopener noreferrer">
              HPAI Services SharePoint
            </Link>
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon sx={{ fontSize: 32 }}>
                <ContactSupportIcon />
              </ListItemIcon>
              <ListItemText
                primary="Contact Support"
                secondary={
                  <>
                    Need to reach out? Email us at{' '}
                    <Link href="mailto:HealthPlanAIServices@kp.org">
                      HealthPlanAIServices@kp.org
                    </Link>
                  </>
                }
              />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ fontSize: 32 }}>
                <BugReportIcon />
              </ListItemIcon>
              <ListItemText
                primary="Report a Bug"
                secondary={
                  <>
                    Found an issue? Let us know so we can fix it. Email us at{' '}
                    <Link href="mailto:HealthPlanAIServices@kp.org">
                      HealthPlanAIServices@kp.org
                    </Link>
                  </>
                }
              />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ fontSize: 32 }}>
                <FeedbackIcon />
              </ListItemIcon>
              <ListItemText
                primary="Provide Feedback"
                secondary={
                  <>
                    Share your thoughts to help us improve. Email us at{' '}
                    <Link href="mailto:HealthPlanAIServices@kp.org">
                      HealthPlanAIServices@kp.org
                    </Link>
                  </>
                }
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>
    </Box>
  );
}