'use client';

import { useAuth } from '@/app/contexts/OpenIdAuthContext';
import { useEffect, useState } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { Box, Button, Avatar, TextField, Typography, Select, MenuItem, FormControl, InputLabel, Switch, FormControlLabel, Alert, IconButton, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Link from 'next/link'; // Import the next/link component
import AccountDialog from './AccountDialog';
import { useSmartNote, useSmartNoteDispatch } from '@reducers/improved/SmartNoteContext';
import { saveSmartNote } from '@/app/clientServices/smartNoteService';
import { updateSmartNoteTemplate } from '../clientServices/smartNoteTemplateService';
import { useThemeMode } from '../../theme';
import KpLogo from './svg/KpLogo';
import { useUserAssistantsDispatch } from '@/reducers/UserAssistantContext';
import { getActiveMessages } from '@/app/clientServices/applicationMessaging';

export default function Header() {
  const { user, loading, signIn, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const smartNote = useSmartNote();
  const smartNoteDispatch = useSmartNoteDispatch();
  const [title, setTitle] = useState(smartNote ? smartNote.title : 'KPIT AI Portal');
  const [originalTitle, setOriginalTitle] = useState(smartNote ? smartNote.title : 'KPIT AI Portal');
  const [settingsOption, setSettingsOption] = useState(''); // State for the settings select
  const { mode, toggleMode } = useThemeMode();
  const [isAdmin, setIsAdmin] = useState(false);
  const userAssistantsDispatch = useUserAssistantsDispatch();
  const [appMessages, setAppMessages] = useState([]);
  const [dismissedMessages, setDismissedMessages] = useState([]);

  const hours = 60 * 60 * 1000;
  const dismissableDuration = 12; // controls hours message stays hidden
  const tooltip = `Dismissed messages will be shown again every ${dismissableDuration} hours.`;

  const isSmartNoteRoute = pathname?.includes('/smartNote/');

  const [isProduction, setIsProduction] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsProduction(window.location.origin.includes('prod-aiplatform') || window.location.origin.includes('psup-aiplatform'));
    }
  }, []);

  // Fetch active application messages
  useEffect(() => {
    const fetchAppMessages = async () => {
      try {
        const response = await getActiveMessages();
        if (response && response.messages) {
          setAppMessages(response.messages);

          // Load dismissed messages from localStorage with timestamps
          const dismissedData = JSON.parse(localStorage.getItem('dismissedAppMessages') || '{}');
          const now = new Date().getTime();
          const hoursInMs = dismissableDuration * hours;

          // Only keep dismissed message IDs that still exist in current messages
          const currentMessageIds = response.messages.map(msg => msg.id);

          // Filter out messages dismissed more than 6 hours ago and messages that no longer exist
          const validDismissed = Object.keys(dismissedData).filter(id => {
            const dismissedTime = dismissedData[id];
            const isStillValid = currentMessageIds.includes(id);
            const isHiddenExpected = (now - dismissedTime) < hoursInMs;
            return isStillValid && isHiddenExpected;
          });

          setDismissedMessages(validDismissed);

          // Update localStorage with cleaned up dismissed messages
          const updatedDismissedData = {};
          validDismissed.forEach(id => {
            updatedDismissedData[id] = dismissedData[id];
          });
          localStorage.setItem('dismissedAppMessages', JSON.stringify(updatedDismissedData));
        }
      } catch (error) {
        console.error('Error fetching application messages:', error);
      }
    };

    fetchAppMessages();
  }, []);

  useEffect(() => {
    if (user) {
      if (pathname === '/') {
        setTitle('KPIT AI Portal');
      } else if (isSmartNoteRoute && smartNote) {
        setTitle(smartNote.title);
        setOriginalTitle(smartNote.title)
      }

      const modifiedGroups = user?.groups || [];
      console.log(`header modifiedGroups: ${JSON.stringify(modifiedGroups)}`);

      const isAppAdmin = !!(user?.groups?.find(group => group === "HPTS_AIPORTAL_ADMIN"));
      setIsAdmin(isAppAdmin);
    }
    // else if (status === 'unauthenticated') {
    //   const si = async () => {
    //     await signIn("aiportal");
    //   };
    //   si();
    // }
  }, [params, smartNote, user, loading, signOut]);
  const handleDialogClose = () => {
    setDialogOpen(false);
  };

  const handleSignin = async () => {
    await signIn('aiportal');
  };

  const handleAvatarClick = () => {
    setDialogOpen(true);
  };

  const handleHomeLinkClicked = () => {
    userAssistantsDispatch({ type: 'SET_SELECTED_USER_ASSISTANT', selectedUserAssistant: '' });
  }

  const handleTitleChange = async () => {
    const updatedSmartNote = { ...smartNote, title: title };
    saveSmartNote(updatedSmartNote.teamName, updatedSmartNote.assistantName, updatedSmartNote);
    smartNoteDispatch({ type: 'UPDATE_SMART_NOTE', smartNote: updatedSmartNote });

    if (smartNote.templateId) {
      updateSmartNoteTemplate(smartNote.teamName, smartNote.assistantName, smartNote.templateId, { title: title });
    }
  };

  const handleKeyDown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await handleTitleChange();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setTitle(originalTitle); // Revert to the original title on escape
    }
  };

  const handleBlur = async () => {
    if (title !== originalTitle) {
      await handleTitleChange();
    }
  };

  const handleDismissMessage = (messageId) => {
    const now = new Date().getTime();
    const dismissedData = JSON.parse(localStorage.getItem('dismissedAppMessages') || '{}');

    // Add message ID with current timestamp
    dismissedData[messageId] = now;

    const updatedDismissed = [...dismissedMessages, messageId];
    setDismissedMessages(updatedDismissed);
    localStorage.setItem('dismissedAppMessages', JSON.stringify(dismissedData));
  };

  const getSeverityColor = (messageType) => {
    switch (messageType) {
      case 'ERROR':
        return 'error';
      case 'WARNING':
        return 'warning';
      case 'SUCCESS':
        return 'success';
      case 'INFO':
      default:
        return 'info';
    }
  };

  // Filter out dismissed messages
  const visibleMessages = appMessages.filter(msg => !dismissedMessages.includes(msg.id));

  // Show only the first message (stack behavior)
  const currentMessage = visibleMessages.length > 0 ? visibleMessages[0] : null;

  return (
    <>
      {/* Header Bar */}
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          flexGrow: 0,
          flexDirection: 'row',
          width: '100%',
          paddingX: 2.5,
          paddingY: 1,
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#002343',
        }}
      >
        <Box
          display="flex"
          alignItems="center"
          sx={{
            flexGrow: 1,
          }}
        >
          <Box onClick={handleHomeLinkClicked}>
            <Link href="/">
              <KpLogo width={30} height={30} sx={{ color: 'white', mr: 1 }} />
            </Link>
          </Box>
          {smartNote ? (
            <TextField
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              variant="outlined"
              size="medium"
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              slotProps={{
                htmlInput: {
                  sx: {
                    color: 'color.pebble',
                    fontSize: '24pt',
                    fontWeight: 500,
                    ...(title === "Untitled Smart Note" && {
                      borderBottom: '1px solid',
                      borderColor: 'color.graphiteDeep',
                      borderRadius: 0,
                      paddingBottom: 0,
                      marginBottom: '15.5px',
                      '&:hover': {
                        borderBottom: '1px solid',
                        borderColor: 'primary.main'
                      },
                    }),
                  },
                },
              }}
              sx={{
                fontSize: '24pt',
                fontWeight: 500,
                cursor: 'pointer',
                '&:hover': {
                  cursor: 'pointer',
                },
                width: '100%',
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'inherit',
                  '& fieldset': {
                    border: 'none',
                  },
                  '&:hover fieldset': {
                    border: 'none',
                  },
                  '&.Mui-focused fieldset': {
                    border: 'none',
                  },
                },
              }}
            />
          ) : (
            <Typography color="color.pebble" fontWeight={500} fontSize={'24pt'}>
              KPIT AI Portal
            </Typography>
          )}
        </Box>
        {
          !isProduction && !pathname.includes('invoice-variance-prod') &&
          (<Box sx={{ mx: 1 }}>
            <Alert severity="warning" sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography fontSize="14px" fontWeight={500}>
                This is a NON-PRODUCTION environment. As such, please refrain from uploading documents or submitting prompts with PII or PHI data.
              </Typography>
            </Alert>
          </Box>)
        }
        <Box display="flex" justifyContent="flex-end" alignItems="center" sx={{ flexGrow: 1 }}>
          <FormControl
            sx={{
              minWidth: 120,
              marginRight: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: '24px',
                height: '40px',
                background: 'transparent',
                '& fieldset': {
                  borderColor: 'color.graphiteDeep',
                },
                '&:hover fieldset': {
                  borderColor: 'color.graphite',
                },
                '&.Mui-focused': {
                  color: 'color.graphiteLight',
                  '& .MuiSelect-icon': {
                    color: 'color.graphiteLight',
                  }
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'color.graphite',
                  borderWidth: '1px',
                },
                '& .MuiSelect-icon': {
                  color: 'color.graphiteDeep',
                }
              },
            }}
          >
            <InputLabel
              id="settings-select-label"
              shrink={false} // Prevent the label from shrinking
              sx={{
                position: 'absolute',
                top: '50%',
                left: '16px',
                transform: 'translateY(-50%)',
                color: 'color.graphiteDeep',
                pointerEvents: 'none',
                '&.Mui-focused': {
                  color: 'color.graphite',
                }
              }}
            >
              Settings
            </InputLabel>
            <Select
              labelId="settings-select-label"
              value={settingsOption}
              displayEmpty
              inputProps={{ 'aria-label': 'Settings' }}
              sx={{
                bgcolor: 'transparent !important'
              }}
            >
              <MenuItem sx={{ p: 0 }}>
                <Link href="/help" style={{ textDecoration: 'none', color: 'inherit', width: '100%', padding: '6px 16px' }}>
                  Help
                </Link>
              </MenuItem>
              <MenuItem sx={{ p: 0 }}>
                <Link href="/about" style={{ textDecoration: 'none', color: 'inherit', width: '100%', padding: '6px 16px' }}>
                  About
                </Link>
              </MenuItem>
              {
                isAdmin && (
                  <MenuItem sx={{ p: 0 }}>
                    <Link href="/admin" style={{ textDecoration: 'none', color: 'inherit', width: '100%', padding: '6px 16px' }}>
                      Admin
                    </Link>
                  </MenuItem>
                )
              }
              <MenuItem sx={{ p: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={mode === 'dark'}
                      onChange={toggleMode}
                      size="small"
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: '#0078B3',
                        },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          backgroundColor: '#0078B3',
                        },
                      }}
                    />
                  }
                  label={`${mode === 'dark' ? 'Dark' : 'Light'} Mode`}
                  sx={{
                    margin: 0,
                    width: '100%',
                    '& .MuiFormControlLabel-label': {
                      fontSize: '14px',
                    },
                  }}
                />
              </MenuItem>
            </Select>
          </FormControl>
          {!user ? (
            <Button
              variant="primary"
              onClick={handleSignin}
            >
              Sign in
            </Button>
          ) : (
            <Box display="flex" alignItems="center">
              <Avatar
                sx={{ bgcolor: 'darkgreen', color: 'white', marginLeft: 2, cursor: 'pointer' }}
                onClick={handleAvatarClick}
              >
                {user && user.firstName && user.firstName[0]}
              </Avatar>
              <AccountDialog open={dialogOpen} onClose={handleDialogClose} />
            </Box>
          )}
        </Box>
        {/* Application Messages - Absolute Position */}
      </Box>
      {currentMessage && (
        <Box
          sx={{
            zIndex: 1300,
            width: '100%',
            maxHeight: '100px'
          }}
        >
          <Alert
            key={currentMessage.id}
            severity={getSeverityColor(currentMessage.messageType)}
            sx={{
              borderRadius: 0,
              display: 'flex',
              alignItems: 'center',
              height: '100%',
              '& .MuiAlert-message': {
                height: '100%',
                overflow: 'hidden',
                p: 0
              },
              '& .MuiAlert-action': {
                p: 0
              }
            }}
            action={
              <Tooltip title={tooltip}>
                <Button
                  aria-label="close"
                  variant="text"
                  color={getSeverityColor(currentMessage.messageType)}
                  size="small"
                  onClick={() => handleDismissMessage(currentMessage.id)}
                >
                  Dismiss
                </Button>
              </Tooltip>
            }
          >
            <Typography
              variant='body2'
              component='div'
              sx={{
                overflow: 'auto',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                fontSize: '14px',
                fontWeight: 500,
                m: 0
              }}>
              <span dangerouslySetInnerHTML={{ __html: currentMessage.text }} />
            </Typography>
          </Alert>
        </Box>
      )}
    </>
  );
}