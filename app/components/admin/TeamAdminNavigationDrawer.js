'use client';

import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Box,
  Collapse
} from "@mui/material";
import {
  Groups,
  SmartToy,
  Storage,
  Description,
  Search,
  QueryStats,
  BarChart,
  Settings,
  Add,
  Assignment,
  Build,
  ExpandLess,
  ExpandMore,
  People,
  AccountTree,
  DataObject,
  Update,
  Polyline,
  Visibility,
  Security,
  SyncAlt
} from "@mui/icons-material";
import { usePathname } from "next/navigation";
import { useAuth } from '@/app/contexts/OpenIdAuthContext';
import { useState, useEffect } from "react";
import Link from "next/link";
import { getTeamMember } from "@/app/clientServices/teamMemberService";
import { PERMISSIONS } from "@/app/config/permissions";

const DRAWER_WIDTH = 280;

const AdminNavigationDrawer = ({ open, onClose, teamName, firstAssistantName }) => {
  const pathname = usePathname();
  const [assistantsExpanded, setAssistantsExpanded] = useState(true);
  const [userRoles, setUserRoles] = useState([]);
  const [userPermissions, setUserPermissions] = useState([]);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const { user } = useAuth();

  // Fetch user's roles and resolved permissions for this team
  useEffect(() => {
    const fetchUserRoles = async () => {
      if (!teamName || !user?.nuid) {
        setRolesLoaded(true);
        return;
      }

      try {
        const teamMember = await getTeamMember(teamName, user.nuid);
        setUserRoles(teamMember.roles || []);
        setUserPermissions(teamMember.permissions || teamMember.grants || []);
      } catch (error) {
        console.error('Error fetching user roles:', error);
      } finally {
        setRolesLoaded(true);
      }
    };

    fetchUserRoles();
  }, [teamName, user?.nuid]);

  // Permission check: supports a single key, an array (any match), or a scoped prefix
  const hasPermission = (permConfig) => {
    if (!permConfig) return true; // no permission required
    const perms = userPermissions;
    if (perms.includes('*')) return true;

    if (Array.isArray(permConfig)) {
      return permConfig.some(config => hasPermission(config));
    }

    // { scoped: 'admin.assistants.settings.manage' } — matches unscoped OR any scoped value
    if (permConfig.scoped) {
      if (perms.includes(permConfig.scoped)) return true;
      const prefix = `${permConfig.scoped}:`;
      return perms.some(p => p.startsWith(prefix));
    }

    // Single permission string
    return perms.includes(permConfig);
  };

  const configurationLinks = [
    {
      title: "Team Management",
      href: "/admin/teams",
      icon: <Groups />
    },
    {
      title: "Members",
      href: `/${teamName}/admin/members`,
      icon: <People />,
      permission: [PERMISSIONS.TEAM_MEMBERS_VIEW, PERMISSIONS.TEAM_MEMBERS_MANAGE, PERMISSIONS.TEAM_MEMBERS_PERMISSIONS_MANAGE],
    },
    {
      title: "Role Templates",
      href: `/${teamName}/admin/role-templates`,
      icon: <Security />,
      permission: PERMISSIONS.TEAM_ROLE_TEMPLATES_MANAGE,
    },
    {
      title: "Assistants",
      href: `/${teamName}/admin/assistants`,
      icon: <SmartToy />,
      hasSubItems: true,
      permission: [
        PERMISSIONS.ASSISTANTS_MANAGE,
        { scoped: PERMISSIONS.ASSISTANTS_ASSIGN_USERS },
        { scoped: PERMISSIONS.ASSISTANT_SETTINGS_MANAGE },
        { scoped: PERMISSIONS.ASSISTANT_NEWS_MANAGE },
      ],
      subItems: [
        {
          title: "Manage Assistants",
          href: `/${teamName}/admin/assistants`,
          icon: <Add />,
          permission: PERMISSIONS.ASSISTANTS_MANAGE,
        },
        {
          title: "Assign Users",
          href: `/${teamName}/admin/assistants/assign`,
          icon: <Assignment />,
          permission: { scoped: PERMISSIONS.ASSISTANTS_ASSIGN_USERS },
        },
        {
          title: "Assistant Settings",
          href: `/${teamName}/admin/assistants/settings`,
          icon: <Build />,
          permission: { scoped: PERMISSIONS.ASSISTANT_SETTINGS_MANAGE },
        },
        {
          title: "News & Updates",
          href: `/${teamName}/admin/assistants/news`,
          icon: <Assignment />,
          permission: { scoped: PERMISSIONS.ASSISTANT_NEWS_MANAGE },
        }
      ]
    },
    {
      title: "SharePoint Sites",
      href: `/${teamName}/admin/sharepointsites`,
      icon: <Storage />,
      permission: PERMISSIONS.SHAREPOINT_SITES_MANAGE,
    },
    // {
    //   title: "Context Templates",
    //   href: `/${teamName}/admin/context-templates`,
    //   icon: <Description />,
    // },
    {
      title: "CAC Compare Queries",
      href: `/${teamName}/admin/cac-queries`,
      icon: <QueryStats />
    },
    {
      team: "kpif-ma",
      title: "Insight 360 Queries",
      href: `/${teamName}/admin/insight-360-queries`,
      icon: <QueryStats />,
      permission: PERMISSIONS.INSIGHT360_QUERIES_MANAGE,
    },
    {
      team: "kpif-ma",
      title: "Insight 360 Audit",
      href: `/${teamName}/admin/insight-360-audit`,
      icon: <Visibility />,
      permission: PERMISSIONS.INSIGHT360_AUDIT_VIEW,
    },
    {
      team: "medicare-companion",
      title: "Medicare Companion Audit",
      href: `/${teamName}/admin/medicare-companion-audit`,
      icon: <Visibility />,
      permission: PERMISSIONS.MEDICARE_COMPANION_AUDIT_VIEW,
    },
    {
      team: 'regulatory',
      title: "Geisinger Config",
      href: `/${teamName}/admin/geisinger-config`,
      icon: <QueryStats />,
      permission: PERMISSIONS.REGULATORY_CONFIG_MANAGE
    },
    {
      team: 'regulatory',
      title: "Geisinger Preparation",
      href: `/${teamName}/admin/geisinger-preparation`,
      icon: <Build />,
      permission: PERMISSIONS.REGULATORY_PREPARATION_MANAGE
    },
    {
      team: 'reconciliation-notice-processing',
      title: "RCNOA Processing",
      href: `/${teamName}/admin/rcnoa`,
      icon: <SyncAlt />,
      permission: PERMISSIONS.RCNOA_PROCESSING_MANAGE
    },
    {
      title: "Workflows",
      href: `/${teamName}/admin/workflows`,
      icon: <AccountTree />,
      permission: PERMISSIONS.WORKFLOWS_MANAGE,
    },
    {
      team: 'bcs',
      title: "Update Incident Index",
      href: `/${teamName}/admin/update-incident-data`,
      icon: <DataObject />,
      permission: PERMISSIONS.BCS_INCIDENT_INDEX_MANAGE,
    },
    {
      team: 'ets',
      title: "ETS Index Management",
      href: `/${teamName}/admin/ets-index-management`,
      icon: <Update />,
      permission: PERMISSIONS.ETS_INDEX_MANAGE,
    },
    {
      team: 'nps',
      title: "NPS Admin Config",
      href: `/${teamName}/admin/npsadmin`,
      icon: <Description />,
      permission: PERMISSIONS.NPS_ADMIN_MANAGE,
    },
    {
      team: 'bcs',
      title: "BCS Admin Config",
      href: `/${teamName}/admin/bcsadmin`,
      icon: <Description />,
      permission: PERMISSIONS.BCS_ADMIN_MANAGE,
    },
    {
      team: 'npscmat',
      title: "NPS CMAT Admin Config",
      href: `/${teamName}/admin/npscmatadmin`,
      icon: <Description />,
      permission: PERMISSIONS.CMAT_ADMIN_MANAGE,
    },
    {
      team: 'membership-admin',
      title: "Audit Template Config",
      href: `/${teamName}/admin/kpif-compare-config`,
      icon: <Settings />,
      permission: PERMISSIONS.KPIF_AUDIT_TEMPLATE_MANAGE,
    },
    {
      team: 'membership-admin',
      title: "Compare Query Config",
      href: `/${teamName}/admin/kpif-query-config`,
      icon: <DataObject />,
      permission: PERMISSIONS.KPIF_QUERY_CONFIG_MANAGE,
    },
    {
      team: 'medicare-cmp',
      title: "Audit Template Config",
      href: `/${teamName}/admin/medicare-compare-config`,
      icon: <Settings />,
      permission: PERMISSIONS.MEDICARE_AUDIT_TEMPLATE_MANAGE,
    },
    {
      team: 'medicare-cmp',
      title: "Compare Query Config",
      href: `/${teamName}/admin/medicare-query-config`,
      icon: <DataObject />,
      permission: PERMISSIONS.MEDICARE_QUERY_CONFIG_MANAGE,
    }
  ].filter(link => {
    // Team-scoped links: only show for matching team
    if (link.team && link.team !== teamName) return false;

    // App-admin-only links: require app admin group
    if (link.href === `/admin/teams` || link.href === `/${teamName}/admin/cac-queries`) {
      const isGeisingerAdmin = user?.org === 'geisinger' && user?.adminFlag;
      return user?.groups?.includes('HPTS_AIPORTAL_ADMIN') || isGeisingerAdmin;
    }

    // Permission-based check: show if user has the required permission
    if (link.permission) {
      return hasPermission(link.permission);
    }

    return true;
  }).map(link => {
    // Filter sub-items by permission
    if (link.hasSubItems && link.subItems) {
      return {
        ...link,
        subItems: link.subItems.filter(sub => hasPermission(sub.permission)),
      };
    }
    return link;
  });

  const dashboardLinks = [
    {
      title: "Application Statistics",
      href: `/${teamName}/admin/statistics`,
      icon: <BarChart />,
      permission: PERMISSIONS.STATISTICS_VIEW,
    },
    {
      title: "LLM Statistics",
      href: `/${teamName}/admin/llm-statistics`,
      icon: <BarChart />,
      permission: PERMISSIONS.LLM_STATISTICS_VIEW,
    },
    {
      title: "Approval Statistics",
      href: `/${teamName}/admin/approval-statistics`,
      icon: <BarChart />,
      permission: PERMISSIONS.APPROVAL_STATISTICS_VIEW,
    }
  ].filter(link => hasPermission(link.permission));

  const isActiveRoute = (href) => {
    return pathname === href;
  };

  const isParentRouteActive = (link) => {
    if (!link.hasSubItems) return false;
    return link.subItems.some(subItem => pathname === subItem.href);
  };

  const handleAssistantsToggle = () => {
    setAssistantsExpanded(!assistantsExpanded);
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
          <Box key={link.href} sx={{
            ...(assistantsExpanded && link.hasSubItems ? { backgroundColor: 'action.selected', py: 0.5 } : {}),
            ...{ borderRadius: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }
          }}>
            {link.hasSubItems ? (
              <ListItemButton
                onClick={handleAssistantsToggle}
                sx={{
                  mx: 0.5,
                  borderRadius: 1,
                  '&:hover': {
                    backgroundColor: 'action.contrastText',
                  }
                }}
              >
                <ListItemIcon
                  sx={{
                    color: 'inherit',
                    minWidth: 40
                  }}
                >
                  {link.icon}
                </ListItemIcon>
                <ListItemText
                  primary={link.title}
                  primaryTypographyProps={{
                    fontSize: '1rem',
                    fontWeight: 400
                  }}
                />
                {assistantsExpanded ? <ExpandLess /> : <ExpandMore />}
              </ListItemButton>
            ) : (
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
                      color: 'inherit',
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
            )}

            {link.hasSubItems && (
              <Collapse in={assistantsExpanded} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {link.subItems.map((subItem) => (
                    <Link key={subItem.href} href={subItem.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          pl: 4,
                          mx: 0.5,
                          borderRadius: 1,
                          px: 2,
                          py: 1.5,
                          cursor: 'pointer',
                          backgroundColor: isActiveRoute(subItem.href) ? 'listitem.active.background' : 'transparent',
                          color: isActiveRoute(subItem.href) ? 'listitem.active.text' : 'inherit',
                          '&:hover': {
                            backgroundColor: isActiveRoute(subItem.href) ? 'listitem.active.background' : 'listitem.hover.background',
                            color: isActiveRoute(subItem.href) ? 'listitem.active.text' : 'listitem.hover.text',
                          }
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            color: 'inherit',
                            minWidth: 32
                          }}
                        >
                          {subItem.icon}
                        </ListItemIcon>
                        <ListItemText
                          primary={subItem.title}
                          primaryTypographyProps={{
                            fontSize: '1rem',
                            fontWeight: isActiveRoute(subItem.href) ? 600 : 400
                          }}
                        />
                      </Box>
                    </Link>
                  ))}
                </List>
              </Collapse>
            )}
          </Box>
        ))}
      </List>
    </Box>
  );

  const drawerContent = (
    <Box sx={{ width: DRAWER_WIDTH, height: '100%', bgcolor: 'background.paper' }}>
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', height: '64px' }}>
        <Link href={`/${teamName}/admin`}>
          <Typography variant="h5" sx={{ fontWeight: 600, color: 'text.primary', '&:hover': { color: 'link.hover' } }}>
            Admin Panel
          </Typography>
        </Link>
      </Box>

      <Box sx={{ p: 2, overflow: 'auto', height: 'calc(100% - 64px)' }}>
        {configurationLinks.length > 0 && renderLinkSection("Configuration", configurationLinks, <Settings />)}

        {dashboardLinks.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            {renderLinkSection("Dashboards", dashboardLinks, <BarChart />)}
          </>
        )}
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
