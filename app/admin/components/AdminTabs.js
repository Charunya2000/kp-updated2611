'use client';
import React, { useState, useEffect } from 'react';
import { Box, Tabs, Tab, Typography, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { getAllAssistants } from '@/app/clientServices/assistantService.js';
import IndexesManagement from '@/app/[teamName]/admin/assistants/settings/components/IndexesManagement';
import PersonasManagement from '@/app/[teamName]/admin/assistants/settings/components/PersonasManagement';
import PromptLibraryManagement from '@/app/[teamName]/admin/assistants/settings/components/PromptLibraryManagement';
import SystemPromptsManagement from '@/app/[teamName]/admin/assistants/settings/components/SystemPromptsManagement';
import useSnackbar from '@/app/hooks/useSnackbar';
import ChatCompletionConfigManagement from '@/app/[teamName]/admin/assistants/settings/components/ChatCompletionConfigManagement';
import McpServersManagement from '@/app/[teamName]/admin/assistants/settings/components/McpServersManagement';

const tabKeys = ['system-prompts', 'personas', 'prompt-library', 'indexes', 'completions', 'mcp-servers'];

const AdminTabs = ({ teamName, allowedAssistants }) => {
  const { SnackbarComponent, showSnackbar } = useSnackbar({ duration: 1500 });
  const theme = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const tabParam = searchParams.get('tab') || 'system-prompts';
  const assistantParam = searchParams.get('assistant') || '';

  const [activeTab, setActiveTab] = useState(tabKeys.indexOf(tabParam));
  const [selectedAssistant, setSelectedAssistant] = useState(assistantParam);

  useEffect(() => {
    setActiveTab(tabKeys.indexOf(tabParam));
  }, [tabParam]);

  useEffect(() => {
    setSelectedAssistant(assistantParam);
  }, [assistantParam]);

  const [assistants, setAssistants] = useState([]);
  const [localSelectedAssistant, setLocalSelectedAssistant] = useState('');
  const [assistantsLoaded, setAssistantsLoaded] = useState(false);

  useEffect(() => {
    async function fetchAssistants() {
      try {
        const response = await getAllAssistants(teamName);
        // exclude these assistant names (response.name)
        const excluded = new Set([
          'bcschatbot',
          'document-management-shared-service'
        ]);
        const filtered = Array.isArray(response)
          ? response.filter(a => !excluded.has(a.name) && !a.isHiddenFromSettings)
          : [];
        // If allowedAssistants is an array, restrict to only those assistants
        const permitted = allowedAssistants
          ? filtered.filter(a => allowedAssistants.includes(a.name))
          : filtered;
        const sortedAssistants = permitted.slice().sort((a, b) => a.displayName.localeCompare(b.displayName));
        setAssistants(sortedAssistants);
        setLocalSelectedAssistant(sortedAssistants[0]?.id || '');
      } catch (e) {
        setAssistants([]);
        setLocalSelectedAssistant('');
      } finally {
        setAssistantsLoaded(true);
      }
    }
    fetchAssistants();
  }, []);

  useEffect(() => {
    const assistantName = searchParams.get('assistant');
    if (assistants.length === 0) return;

    const found = assistants.find(a => a.name === assistantName);

    if (assistantName) {
      if (found) {
        if (found.id !== localSelectedAssistant) {
          setLocalSelectedAssistant(found.id);
        }
      } else {
        router.replace('/forbidden');
      }
    } else {
      setLocalSelectedAssistant(assistants[0].id);
      const defaultTab = assistants[0].name === 'case-360-assistant' ? 'prompt-library' : tabKeys[activeTab];
      if (assistants[0].name === 'case-360-assistant') setActiveTab(2);
      const newUrl = `${pathname}?tab=${encodeURIComponent(defaultTab)}&assistant=${encodeURIComponent(assistants[0].name)}`;
      router.replace(newUrl);
    }
  }, [searchParams, assistants, pathname, router, activeTab]);

  const handleTabChange = (event, newValue) => {
    const newTab = tabKeys[newValue];
    const assistantObj = assistants.find(a => a.id === localSelectedAssistant);
    const assistantName = assistantObj?.name || '';
    let query = `?tab=${encodeURIComponent(newTab)}`;
    if (assistantName) query += `&assistant=${encodeURIComponent(assistantName)}`;
    router.replace(`${pathname}${query}`);
    setActiveTab(newValue);
  };

  const handleAssistantChange = (assistantId) => {
    setLocalSelectedAssistant(assistantId);
    const assistantObj = assistants.find(a => a.id === assistantId);
    const assistantName = assistantObj?.name || '';

    // If on case-360-assistant, only show Prompt Library tab
    // If switching from case-360-assistant to another, force to System Prompts tab
    let newTab = tabKeys[activeTab];
    if (assistantName === 'case-360-assistant') {
      newTab = 'prompt-library';
      setActiveTab(2);
    } else if (activeTab === 2) {
      // If currently on Prompt Library and switching to non-case-360, go to System Prompts
      newTab = 'system-prompts';
      setActiveTab(0);
    }

    let query = `?tab=${encodeURIComponent(newTab)}`;
    if (assistantName) query += `&assistant=${encodeURIComponent(assistantName)}`;
    router.replace(`${pathname}${query}`);
  };

  const isCase360Assistant = () => {
    const currentAssistant = assistants.find(a => a.id === localSelectedAssistant);
    return currentAssistant?.name === 'case-360-assistant';
  };

  // Get visible tabs based on selected assistant
  const getVisibleTabs = () => {
    const allTabs = ["System Prompts", "Personas", "Prompt Library", "Indexes", "Chat Completions", "MCP Servers"];
    if (isCase360Assistant()) {
      return ["Prompt Library"]; // Only Prompt Library for case-360-assistant
    }
    return allTabs;
  };

  const getVisibleTabIndex = () => {
    if (isCase360Assistant()) {
      return 0;
    }
    return activeTab;
  };

  let tabContent = null;
  switch (activeTab) {
    case 0:
      tabContent = (
        <SystemPromptsManagement
          teamName={teamName}
          assistantName={assistantParam}
          onAssistantChange={handleAssistantChange}
          showSnackbar={showSnackbar}
        />
      );
      break;
    case 1:
      tabContent = (
        <PersonasManagement
          teamName={teamName}
          assistantName={assistantParam}
          showSnackbar={showSnackbar}
        />
      );
      break;
    case 2:
      tabContent = (
        <PromptLibraryManagement
          teamName={teamName}
          assistantName={assistantParam}
          showSnackbar={showSnackbar}
        />
      );
      break;
    case 3:
      tabContent = (
        <IndexesManagement
          teamName={teamName}
          assistantName={assistantParam}
          assistantId={localSelectedAssistant}
          showSnackbar={showSnackbar}
        />
      );
      break;
    case 4:
      tabContent = (
        <ChatCompletionConfigManagement showSnackbar={showSnackbar} teamName={teamName}
          assistantName={assistantParam} />
      )
      break;
    case 5:
      tabContent = (
        <McpServersManagement
          showSnackbar={showSnackbar}
          assistantId={localSelectedAssistant}
          teamName={teamName}
          assistantName={assistantParam}
        />
      );
      break;
    default:
      tabContent = null;
  }

  // show message when team has no assistants (but avoid showing during initial load)
  if (assistantsLoaded && assistants.length === 0) {
    return (
      <Box
        sx={{
          pt: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          width: '100%',
          overflow: 'hidden',
          px: 3
        }}
      >
        <Typography variant="h6" color="text.primary" sx={{ mb: 1, textAlign: 'center' }}>
          This team currently has no assistants that can be configured
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          If you think this is an error, contact your team administrator.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        pt: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <Box sx={{
        height: '100%',
        width: '100%',
        maxWidth: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignSelf: 'stretch'
      }}>
        {/* Header with just the dropdown */}
        <Box sx={{
          width: '100%',
          maxWidth: 'none',
          alignSelf: 'stretch',
          mb: 3,
          px: 0.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start'
        }}>
          {/* Assistant Selector Dropdown */}
          <FormControl variant="outlined" size="small" sx={{ minWidth: 300 }}>
            <InputLabel sx={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Select Assistant</InputLabel>
            <Select
              value={localSelectedAssistant || ''}
              onChange={(e) => handleAssistantChange(e.target.value)}
              label="Select Assistant"
              sx={{
                fontSize: '0.95rem',
                height: 40,
                borderRadius: '8px',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.color.graphiteDeep,
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.color.contrastBlue,
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.color.midnight,
                }
              }}
            >
              {assistants.map((assistant) => (
                <MenuItem key={assistant.id} value={assistant.id}>
                  {assistant.displayName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <SnackbarComponent />
        </Box>

        {/* Tabs */}
        <Box sx={{
          width: 'fit-content',
          maxWidth: 'none',
          alignSelf: 'flex-start'
        }}>
          <Tabs
            value={getVisibleTabIndex()}
            onChange={handleTabChange}
            textColor="primary"
            indicatorColor="primary"
            TabIndicatorProps={{
              sx: {
                height: 4,
                borderRadius: 2,
                background: theme.palette.color.midnight,
                bottom: 0
              }
            }}
            sx={{
              minHeight: 50,
              height: 50,
              width: 'fit-content',
              borderRadius: 0,
              boxShadow: 1,
              border: `0.5px solid ${theme.palette.color.graphiteDeep}`,
              borderTop: 'none',
              overflow: 'visible',
              alignItems: 'flex-start',
              '& .MuiTabs-flexContainer': {
                position: 'relative',
                height: '100%',
                width: 'fit-content',
              },
              '& .MuiTabs-scroller': {
                width: 'fit-content',
                '& .MuiTabs-flexContainer': {
                  display: 'flex',
                  justifyContent: 'flex-start',
                  width: 'fit-content',
                }
              }
            }}
          >
            {getVisibleTabs().map((label, idx) => (
              <Tab
                key={label}
                label={label}
                sx={{
                  fontWeight: getVisibleTabIndex() === idx ? 'bold' : 500,
                  color: getVisibleTabIndex() === idx
                    ? '#fff !important'
                    : `${theme.palette.color.inky} !important`,
                  textTransform: 'none',
                  fontSize: '1.1rem',
                  width: 150,
                  height: 50,
                  px: 3,
                  py: 0,
                  borderRadius: 0,
                  background: getVisibleTabIndex() === idx ? theme.palette.color.midnight : 'transparent',
                  transition: 'color 0.2s, font-weight 0.2s, background 0.2s, border-color 0.2s',
                  border: `1px solid ${theme.palette.color.graphiteDeep}`,
                  borderRight: idx === 3 ? `2px solid ${theme.palette.color.graphiteDeep}` : `1px solid ${theme.palette.color.graphiteDeep}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.typography.fontFamily,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 'fit-content',
                  position: 'relative',
                  '&.Mui-selected': {
                    color: '#fff !important',
                    borderColor: theme.palette.color.midnight,
                    borderWidth: '2px',
                    zIndex: 2,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  },
                  '&:hover': {
                    backgroundColor: getVisibleTabIndex() === idx
                      ? theme.palette.color.midnight
                      : 'rgba(0, 0, 0, 0.04)',
                    borderColor: getVisibleTabIndex() === idx
                      ? theme.palette.color.midnight
                      : theme.palette.color.contrastBlue,
                    zIndex: 1,
                  },
                  '&:not(.Mui-selected)': {
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)',
                  }
                }}
              />
            ))}
          </Tabs>
        </Box>

        {/* Separator line after tabs */}
        <Box
          sx={{
            width: '100%',
            height: '1px',
            backgroundColor: theme.palette.color.graphiteDeep,
            mt: 0,
            mb: 0
          }}
        />

        {/* Content Box */}
        <Box
          sx={{
            p: { xs: 1 },
            height: 'auto%',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            border: `2px solid ${theme.palette.color.graphiteDeep}`,
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            overflow: 'hidden',
          }}
        >
          {tabContent}
        </Box>
      </Box>
    </Box>
  );
};

export default AdminTabs;