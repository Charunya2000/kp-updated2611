'use client';

import { Dialog, DialogTitle, DialogContent, IconButton, Avatar, Button, Typography, Box } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '@/app/contexts/OpenIdAuthContext';
import { useRouter } from 'next/navigation';

export default function AccountDialog({ open, onClose }) {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push(`${process.env.NEXT_PUBLIC_FAM_PREFIX}/idp/startSLO.ping`);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '24px', // More rounded border
        },
      }}
    >
      <DialogTitle>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ marginTop: '1em', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography variant="h6" gutterBottom>
          {user?.email}
        </Typography>
        <Avatar
          sx={{ width: '78px', height: '78px', bgcolor: 'darkgreen', color: 'white', cursor: 'pointer' }}
        >
          {user?.firstName?.[0]}
        </Avatar>
        <Typography
          sx={{
            fontSize: '13pt',
            fontWeight: '400',
            textAlign: 'center',
            boxShadow: 'none',
            '&:hover': {
              boxShadow: 'none',
            },
            minWidth: '60%',
            maxWidth: '95%',
            marginTop: 2,
          }}
        >
          {user?.firstName} {user?.lastName}
        </Typography>
        <Button
          variant="primary"
          onClick={handleSignOut}
          sx={{ marginTop: 2 }}
          fullWidth
        >
          Sign out
        </Button>
      </DialogContent>
    </Dialog>
  );
}