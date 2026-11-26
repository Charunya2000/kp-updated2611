'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/app/contexts/OpenIdAuthContext';
import { Box, List, ListItem, ListItemText, Collapse, IconButton, ListItemButton } from '@mui/material';
import { ChevronLeft, ChevronRight, ExpandLess, ExpandMore } from '@mui/icons-material';
import { useUserAssistants, useUserAssistantsDispatch } from '@reducers/UserAssistantContext';
import { useSmartNotesDispatch } from '@/reducers/improved/SmartNotesContext';
import { useSmartNoteTemplatesDispatch } from '@/reducers/improved/SmartNoteTemplatesContext';
import { getUserAssistantsByNuid, getTeamMemberTeamsListWithRoles } from '../clientServices/userService';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLocalStorage } from '../hooks/useLocalStorage';

export default function LeftNav() {
  const { addLocalStorageItem, getLocalStorageItem } = useLocalStorage();
  const { user } = useAuth();
  const [open, setOpen] = useState(true);
  const [expandedTeams, setExpandedTeams] = useState({});
  const [userTeams, setUserTeams] = useState([]);
  const { userAssistants, selectedUserAssistant } = useUserAssistants();
  const userAssistantsDispatch = useUserAssistantsDispatch();
  const smartNotesDispatch = useSmartNotesDispatch();
  const smartNoteTemplatesDispatch = useSmartNoteTemplatesDispatch();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const fetchAssistants = async () => {
      try {

        let [result, userTeamsResp] = await Promise.all([
          getUserAssistantsByNuid(),
          getTeamMemberTeamsListWithRoles()
        ]);

        if (!result || result.assistants?.length === 0 || !userTeamsResp || userTeamsResp.length === 0) {
          router.push('/no-assistants');
          return;
        }

        setUserTeams(userTeamsResp || []);

        // include teams from userTeams even if user has no assistants in them
        const assistantTeamNames = result.assistants
          .filter(assistant => assistant.teamName)
          .map(assistant => assistant.teamName);
        const memberTeamNames = (userTeamsResp || []).map(t => t.teamName);
        const uniqueTeams = [...new Set([...assistantTeamNames, ...memberTeamNames])];

        userAssistantsDispatch({ type: 'SET_USER_ASSISTANTS_AND_TEAMS', userAssistants: result.assistants, userTeams: uniqueTeams });

        // Set all teams to be expanded by default
        const expandedTeamsDefault = {};
        uniqueTeams.forEach(teamName => {
          expandedTeamsDefault[teamName] = true;
        });
        setExpandedTeams(expandedTeamsDefault);

        if (!selectedUserAssistant) {
          let teamName, assistantName;
          if (result.assistants && result.assistants.length > 0) {
            const localStorageTeamName = getLocalStorageItem('selectedAssistantTeamName');
            const localStorageAssistantName = getLocalStorageItem('selectedAssistantName');
            let selectedAssistant = null;
            if (localStorageTeamName && localStorageAssistantName) {
              selectedAssistant = result.assistants.find(ast => ast.teamName === localStorageTeamName && ast.name === localStorageAssistantName);
            } else {
              selectedAssistant = result.assistants.find(ast => ast.teamName === 'kpit-ai-portal-members' && ast.name === 'kp-smart-notes');
            }

            if (selectedAssistant && !selectedAssistant.isNavRoute) {
              teamName = selectedAssistant.teamName;
              assistantName = selectedAssistant.name;

              router.push(`/${teamName}/${assistantName}`);
              userAssistantsDispatch({ type: 'SET_SELECTED_USER_ASSISTANT', selectedUserAssistant: selectedAssistant });
              return;
            }

            // Find first smartnote-based assistant (not a nav route)
            const firstSmartNoteAssistant = result.assistants.find(ast => !ast.isNavRoute);

            if (firstSmartNoteAssistant) {
              teamName = firstSmartNoteAssistant.teamName;
              assistantName = firstSmartNoteAssistant.name;

              userAssistantsDispatch({ type: 'SET_SELECTED_USER_ASSISTANT', selectedUserAssistant: firstSmartNoteAssistant });
              router.push(`/${teamName}/${assistantName}`);
              return;
            }

            // User only has non-standard assistants - stay on home page
            // The page.js will show the welcome message
          }
        }
      } catch (error) {
        console.error('Error fetching assistants:', error);
      }
    };

    if (user) {
      fetchAssistants();
    }
  }, [user]);

  const handleToggle = () => {
    setOpen(!open);
  };

  const handleTeamToggle = (teamName) => {
    setExpandedTeams(prev => ({
      ...prev,
      [teamName]: !prev[teamName]
    }));
  };

  const handleAssistantClick = (assistant) => {
    // Only clear smart notes and templates if switching to a different assistant
    if (selectedUserAssistant?.name !== assistant.name || selectedUserAssistant?.teamName !== assistant.teamName) {
      smartNotesDispatch({ type: 'CLEAR_SMART_NOTES' });
      smartNoteTemplatesDispatch({ type: 'CLEAR_SMART_NOTE_TEMPLATES' });
    }

    if (assistant.isNavRoute) {
      return;
    }

    addLocalStorageItem('selectedAssistantTeamName', assistant.teamName);
    addLocalStorageItem('selectedAssistantName', assistant.name);
    userAssistantsDispatch({ type: 'SET_SELECTED_USER_ASSISTANT', selectedUserAssistant: assistant });
  };

  const DISABLED_ASSISTANTS = ['kpif-virtual-expert-ai', 'id-cards-ai-assistant'];

  const renderAssistants = () => {
    // Build teams from union of userAssistants and userTeams so teams with no assistants still appear
    const teamsMap = {};
    userAssistants
      .filter(assistant => !DISABLED_ASSISTANTS.includes(assistant.name) && assistant.teamName)
      .forEach(assistant => {
        if (!teamsMap[assistant.teamName]) {
          teamsMap[assistant.teamName] = { teamName: assistant.teamName, displayName: assistant.teamDisplayName };
        }
      });
    (userTeams || []).forEach(t => {
      if (t && t.teamName && !teamsMap[t.teamName]) {
        teamsMap[t.teamName] = { teamName: t.teamName, displayName: t.displayName };
      }
    });
    const teams = Object.values(teamsMap).sort((a, b) => a.teamName.toLowerCase().localeCompare(b.teamName.toLowerCase()));

    const categories = [...new Set(
      userAssistants.filter(assistant => !DISABLED_ASSISTANTS.includes(assistant.name))
        .map(assistant => assistant.category)
        .filter(Boolean)
    )].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    const childAssistants = userAssistants
      .filter(assistant => assistant.category && !DISABLED_ASSISTANTS.includes(assistant.name))
      .sort((a, b) => a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase()));

    return teams
      .filter(team => !DISABLED_ASSISTANTS.includes(team.teamName))
      .map(team => {
        const member = (userTeams || []).find(t => t.teamName === team.teamName);
        // Use resolved permissions if available, fall back to role-based check
        const hasPermissions = member && Array.isArray(member.permissions) && member.permissions.length > 0;
        const isAdmin = member && (
          hasPermissions
            ? member.permissions.includes('*') || member.permissions.some(p => p.startsWith('admin.'))
            : (
              member.roles === 'owner' ||
              member.roles === 'admin' ||
              (Array.isArray(member.roles) && (
                member.roles.includes('owner') ||
                member.roles.includes('admin') ||
                (team.teamName === 'ets' && member.roles.includes('etsindexmanager')) ||
                (team.teamName === 'kpif-ma' && member.roles.includes('auditor'))
              ))
            )
        );
        // Check if user has ONLY auditor role (no admin/owner) — hides assistants
        const isAuditorOnly = member && team.teamName === 'kpif-ma' &&
          Array.isArray(member.roles) &&
          member.roles.includes('auditor') &&
          !member.roles.includes('admin') &&
          !member.roles.includes('owner');
        const teamHasAssistants = childAssistants.some(a => a.teamName === team.teamName);

        const teamCategories = categories
          .filter(category => !DISABLED_ASSISTANTS.includes(category))
          .filter(category => userAssistants.some(assistant => assistant.category === category && assistant.teamName === team.teamName));

        return (
          <React.Fragment key={team.teamName}>
            <ListItem
              button="true"
              onClick={() => handleTeamToggle(team.teamName)}
              sx={{
                display: 'flex',
                gap: 2,
                width: '100%',
                py: 0.5,
                cursor: 'pointer',
                bgcolor: 'transparency.05',
                '&:hover': {
                  bgcolor: 'transparency.20',
                },
              }}
            >
              <ListItemText primary={team.displayName} nowrap="true" sx={{
                whiteSpace: 'nowrap', '& .MuiListItemText-primary': {
                  fontSize: '1.125rem',
                }
              }} />
              {expandedTeams[team.teamName] ? <ExpandLess /> : <ExpandMore />}
            </ListItem>
            <Collapse in={expandedTeams[team.teamName]} timeout="auto" unmountOnExit>
              {/* Admin category first when user is admin/owner */}
              {isAdmin && (
                <>
                  <ListItem sx={{ width: '100%', py: 0.5, paddingRight: 5, pl: 2, bgcolor: 'listitem.default.background', }}>
                    <ListItemText
                      primary={'Admin'}
                      nowrap="true"
                      sx={{
                        whiteSpace: 'nowrap',
                        '& .MuiListItemText-primary': {
                          fontWeight: 'bold',
                          color: 'primary.main'
                        }
                      }}
                    />
                  </ListItem>
                  <Link key={`${team.teamName}-admin`} href={`/${team.teamName}/admin`} style={{ textDecoration: 'none' }}>
                    <ListItem
                      button="true"
                      selected={pathname === `/${team.teamName}/admin`}
                      sx={{
                        pl: 6,
                        bgcolor: pathname === `/${team.teamName}/admin` ? 'listitem.selected.background' : 'listitem.default.background',
                        color: pathname === `/${team.teamName}/admin` ? 'listitem.selected.text' : 'listitem.default.text',
                        width: '100%',
                        py: 0.5,
                        cursor: 'pointer',
                        paddingRight: 5,
                        '&:hover': {
                          bgcolor: '#4169E1',
                          color: 'white',
                        },
                      }}
                    >
                      <ListItemText primary={'Admin'} nowrap="true" sx={{ whiteSpace: 'nowrap' }} />
                    </ListItem>
                  </Link>
                </>
              )}

              {/* Assistants - hidden for auditor-only users on kpif-ma */}
              {!isAuditorOnly && teamCategories.map(category => (
                <React.Fragment key={`${team.teamName}-${category}`}>
                  <ListItem sx={{ width: '100%', py: 0.5, paddingRight: 5, pl: 2, bgcolor: 'listitem.default.background', }}>
                    <ListItemText
                      primary={category}
                      nowrap="true"
                      sx={{
                        whiteSpace: 'nowrap',
                        '& .MuiListItemText-primary': {
                          fontWeight: 'bold',
                          color: 'primary.main'
                        }
                      }}
                    />
                  </ListItem>
                  {childAssistants
                    .filter(childAssistant => childAssistant.category === category && childAssistant.teamName === team.teamName && !DISABLED_ASSISTANTS.includes(childAssistant.name))
                    .map(childAssistant => (
                      <Link key={childAssistant.name} href={`/${childAssistant.teamName}/${childAssistant.name}`} style={{ textDecoration: 'none' }}>
                        <ListItem
                          button="true"
                          selected={pathname === `/${childAssistant.teamName}/${childAssistant.name}`}
                          onClick={() => handleAssistantClick(childAssistant)}
                          sx={{
                            pl: 6,
                            bgcolor: pathname === `/${childAssistant.teamName}/${childAssistant.name}` ? 'listitem.selected.background' : 'listitem.default.background',
                            color: pathname === `/${childAssistant.teamName}/${childAssistant.name}` ? 'listitem.selected.text' : 'listitem.default.text',
                            width: '100%',
                            py: 0.5,
                            cursor: 'pointer',
                            paddingRight: 5,
                            '&:hover': {
                              bgcolor: '#4169E1',
                              color: 'white',
                            },
                          }}
                        >
                          <ListItemText primary={childAssistant.displayName} nowrap="true" sx={{ whiteSpace: 'nowrap' }} />
                        </ListItem>
                      </Link>
                    ))}
                </React.Fragment>
              ))}

              {(!teamHasAssistants && !isAdmin) && (
                <ListItem sx={{ pl: 2, py: 1, maxWidth: 360 }}>
                  <ListItemText primary={"You do not have access to any assistants in this team. Please contact your team owner for more information"} sx={{ color: 'text.secondary' }} />
                </ListItem>
              )}
            </Collapse>
          </React.Fragment>
        );
      });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: 'auto', borderTop: '1px solid', borderRight: '1px solid', borderBottom: '1px solid', borderColor: 'color.dolphin', borderRadius: '0 10px 10px 0', mb: 2, height: 'auto', maxHeight: '100%', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 0, m: 0 }}>
        <IconButton onClick={handleToggle}>
          {open ? <ChevronLeft /> : <ChevronRight />}
        </IconButton>
      </Box>
      <Collapse in={open} orientation="horizontal" timeout="auto" unmountOnExit sx={{ height: 'calc(100% - 40px)' }}>
        <List component="nav" sx={{ height: '100%', overflow: 'auto', pb: 0 }}>
          {renderAssistants()}
        </List>
      </Collapse>
    </Box>
  );
}