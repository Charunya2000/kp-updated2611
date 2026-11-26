'use client';

import { useState, useEffect, cloneElement, isValidElement } from 'react';
import { Box, IconButton, AppBar, Toolbar, Typography } from '@mui/material';
import { Menu as MenuIcon, ChevronLeft } from '@mui/icons-material';
import { usePathname } from 'next/navigation';
import AdminNavigationDrawer from './AdminNavigationDrawer';
import TeamAdminNavigationDrawer from './TeamAdminNavigationDrawer';

const AdminLayout = ({ children, teamName }) => {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(true);

  const getPageTitle = () => {
    const routeTitles = {
      '': 'Admin Panel', // for /admin or /[teamName]/admin
      '/teams': 'Team Management',
      '/members': 'Team Members',
      '/assistants': 'Create, Update, or Delete Assistants',
      '/assistants/assign': 'Assign Users to Assistants',
      '/assistants/settings': 'Assistant Settings',
      '/assistants/news': 'News & Updates',
      '/sharepointsites': 'SharePoint Sites',
      '/context-templates': 'Context Templates',
      '/cac-queries': 'CAC Compare Queries',
      '/insight-360-queries': 'Insight 360 Queries',
      '/insight-360-audit': 'Insight 360 Audit',
      '/geisingerconfig': 'Geisinger Config',
      '/rcnoa': 'RCNOA Processing',
      '/aiSearchConfig': 'Design Indexes',
      '/statistics': 'Application Statistics',
      '/llm-statistics': 'LLM Statistics',
      '/approval-statistics': 'Approval Statistics',
      '/update-incident-data': 'BCS Incident Data',
      '/ets-index-management': 'ETS Index Management',
      '/data-loads': 'Data Loads',
      '/index-creation': 'Create Search Index',
      '/apply-mongo-indexes': 'Apply Mongo Indexes',
      '/kpif-compare-config': 'KPIF Compare Result Config',
      '/kpif-query-config': 'KPIF Query Config',
      '/usage-report': 'Usage Report',
      '/integrations-health': 'Integrations Health'
    };

    // Extract the part after /admin or /[teamName]/admin
    const adminIndex = pathname.indexOf('/admin');
    if (adminIndex === -1) return 'Admin Panel';

    const afterAdmin = pathname.substring(adminIndex + 6); // 6 is length of '/admin'

    return routeTitles[afterAdmin] || 'Admin Panel';
  };

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  return (
    <Box sx={{ display: 'flex', height: '100%' }}>
      {/* Navigation Drawer */}
      {teamName ?
        <TeamAdminNavigationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} teamName={teamName} />
        : <AdminNavigationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />}

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
          transition: 'width 0.3s ease',
          width: drawerOpen ? 'calc(100% - 280px)' : '100%'
        }}
      >
        <AppBar
          position="static"
          elevation={1}
          sx={{
            bgcolor: 'background.paper',
            color: 'text.primary',
            borderBottom: '1px solid',
            borderColor: 'divider',
            height: '64px',
            flexShrink: 0
          }}
        >
          <Toolbar>
            <IconButton
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              {drawerOpen ? <ChevronLeft /> : <MenuIcon />}
            </IconButton>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {getPageTitle()}
            </Typography>
          </Toolbar>
        </AppBar>


        {/* Page Content */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            bgcolor: 'background.default',
            transition: 'width 0.3s ease',
            width: '100%'
          }}
        >
          {/* {isValidElement(children)
            ? cloneElement(children, { localNavigationDrawer: drawerOpen })
            : children}
          {pathname.endsWith('/admin/settings') && (
            <AdminTabs teamName={teamName} localNavigationDrawer={drawerOpen} />
          )} */}
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default AdminLayout;