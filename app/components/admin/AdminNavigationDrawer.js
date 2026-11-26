'use client';

import {
  Drawer,
  List,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Box
} from "@mui/material";
import {
  Groups,
  BarChart,
  Settings,
  Message,
  CloudUpload,
  ManageSearch,
  PlaylistAddCheck,
  Security,
  Assessment,
  FlagRounded,
  FileDownload
} from "@mui/icons-material";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

const DRAWER_WIDTH = 280;

const AdminNavigationDrawer = ({ open, onClose }) => {
  const pathname = usePathname();
  const [assistantsExpanded, setAssistantsExpanded] = useState(true);
  const [teamsExpanded, setTeamsExpanded] = useState(false);


  const configurationLinks = [
    {
      title: "Team Management",
      href: "/admin/teams",
      icon: <Groups />
    },
    {
      title: "Application Messaging",
      href: "/admin/messaging",
      icon: <Message />
    },
    {
      title: "Feature Flags",
      href: "/admin/feature-flags",
      icon: <FlagRounded />
    },
    {
      title: "Data Loads",
      href: "/admin/data-loads",
      icon: <CloudUpload />
    },
    {
      title: "Data Extracts",
      href: "/admin/data-extracts",
      icon: <FileDownload />
    },
    {
      title: "Create Search Index",
      href: "/admin/index-creation",
      icon: <ManageSearch />
    },
    {
      title: "Apply Mongo Indexes",
      href: "/admin/apply-mongo-indexes",
      icon: <PlaylistAddCheck />
    },
    {
      title: "Permissions Management",
      href: "/admin/permissions-management",
      icon: <Security />
    },
  ];

  const dashboardLinks = [
    {
      title: "Usage Report",
      href: "/admin/usage-report",
      icon: <Assessment />
    },
    {
      title: "Integrations Health",
      href: "/admin/integrations-health",
      icon: <Assessment />
    },
  ];

  const isActiveRoute = (href) => {
    return pathname === href;
  };

  const renderLinkSection = (title, links, icon) => (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, mb: 1 }}>
        {icon}
        <Typography
          variant="h6"
          sx={{
            ml: 1,
            fontSize: '1.125rem',
            fontWeight: 600
          }}
        >
          {title}
        </Typography>
      </Box>
      <List dense sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {links.map((link) => (
          <Box key={link.href} sx={{ borderRadius: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Link href={link.href} style={{ textDecoration: 'none', color: 'inherit' }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  mx: 0.5,
                  borderRadius: 1,
                  px: 2,
                  py: 1.5,
                  cursor: 'pointer',
                  backgroundColor: isActiveRoute(link.href) ? 'listitem.active.background' : 'transparent',
                  color: isActiveRoute(link.href) ? 'listitem.active.text' : 'inherit',
                  '&:hover': {
                    backgroundColor: isActiveRoute(link.href) ? 'listitem.active.background' : 'listitem.hover.background',
                    color: isActiveRoute(link.href) ? 'listitem.active.text' : 'listitem.hover.text',
                  }
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isActiveRoute(link.href) ? 'inherit' : 'text.secondary',
                    minWidth: 40
                  }}
                >
                  {link.icon}
                </ListItemIcon>
                <ListItemText
                  primary={link.title}
                  primaryTypographyProps={{
                    fontSize: '1rem',
                    fontWeight: isActiveRoute(link.href) ? 600 : 400
                  }}
                />
              </Box>
            </Link>
          </Box>
        ))}
      </List>
    </Box>
  );

  const drawerContent = (
    <Box sx={{ width: DRAWER_WIDTH, height: '100%', bgcolor: 'background.paper' }}>
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', height: '64px' }}>
        <Link href="/admin">
          <Typography variant="h5" sx={{ fontWeight: 600, color: 'text.primary', '&:hover': { color: 'link.hover' } }}>
            Admin Panel
          </Typography>
        </Link>
      </Box>

      <Box sx={{ p: 2, overflow: 'auto', height: 'calc(100% - 64px)' }}>
        {renderLinkSection("Configuration", configurationLinks, <Settings />)}

        <Divider sx={{ my: 2 }} />

        {renderLinkSection("Dashboards", dashboardLinks, <BarChart />)}
      </Box>
    </Box>
  );

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      variant="persistent"
      sx={{
        maxWidth: open ? DRAWER_WIDTH : 0,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          maxWidth: DRAWER_WIDTH,
          boxSizing: 'border-box',
          borderRight: '1px solid',
          borderColor: 'divider',
          position: 'relative',
          height: '100%',
          top: 0,
          overflow: 'hidden'
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
};

export default AdminNavigationDrawer;
