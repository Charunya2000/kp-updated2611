'use server'

import { Box, List, ListItem, Typography, Divider } from "@mui/material";
import { getTeamAccess } from "@/app/services/permissionsService";
import { getCurrentUserNuid } from "@utils/getSession";
import { isEtsIndexManager, isInsight360Auditor } from "@/app/services/teamRoleService";
import { PERMISSIONS } from "@/app/config/permissions";
import { redirect } from "next/navigation";

const Page = async ({ params }) => {
  const { teamName } = await params;
  const isindexManager = await isEtsIndexManager(teamName); // this function also checks for admin/owner
  const isAuditor = await isInsight360Auditor(teamName);
  const nuid = await getCurrentUserNuid();
  const access = await getTeamAccess(teamName, nuid);

  let hasAdminPermission = false;
  if (!isindexManager && !isAuditor) {
    hasAdminPermission = access?.permissions?.some(p => p === '*' || p.startsWith('admin.'));
  }

  if (!isindexManager && !isAuditor && !hasAdminPermission) {
    return redirect('/not-found');
  }

  const perms = access?.permissions || [];
  const has = (permConfig) => {
    if (perms.includes('*')) return true;
    if (permConfig.scoped) {
      if (perms.includes(permConfig.scoped)) return true;
      return perms.some(p => p.startsWith(`${permConfig.scoped}:`));
    }
    if (Array.isArray(permConfig)) return permConfig.some(p => perms.includes(p));
    return perms.includes(permConfig);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h3" sx={{ mb: 3, fontWeight: 600 }}>
        Welcome to the Admin Panel
      </Typography>
      <Typography variant="body1" sx={{ mb: 3 }}>
        If you are here, it means you have been granted one or more admin-level privileges. Below are details about pages you have access to. You may not have access to every feature on every page. Please check with a team owner to request additional privileges.
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {has([PERMISSIONS.TEAM_MEMBERS_VIEW, PERMISSIONS.TEAM_MEMBERS_MANAGE]) && (
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>Members</Typography>
            <Divider sx={{ mb: 1 }} />
            <Box sx={{ ml: 3, py: 0 }}>
              <Typography variant='body1'>Add and remove team members from your team</Typography>
              <Typography variant='body1'>Change member roles and assign role-based permissions</Typography>
              <Typography variant='body1'>Grant per-assistant settings permissions to individual members</Typography>
            </Box>
          </Box>
        )}

        {has(PERMISSIONS.TEAM_ROLE_TEMPLATES_MANAGE) && (
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>Role Templates</Typography>
            <Divider sx={{ mb: 1 }} />
            <Box sx={{ ml: 3, py: 0 }}>
              <Typography variant='body1'>Create and manage role templates that define which permissions each role grants</Typography>
              <Typography variant='body1'>Override global role templates with team-specific customizations</Typography>
            </Box>
          </Box>
        )}

        {has(PERMISSIONS.ASSISTANTS_MANAGE) && (
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>Manage Assistants</Typography>
            <Divider sx={{ mb: 1 }} />
            <Box sx={{ ml: 3, py: 0 }}>
              <Typography variant='body1'>Create, update, and delete assistants for your team</Typography>
              <Typography variant='body1'>Configure assistant display names, categories, and visibility</Typography>
            </Box>
          </Box>
        )}

        {has({ scoped: PERMISSIONS.ASSISTANTS_ASSIGN_USERS }) && (
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>Assign Users</Typography>
            <Divider sx={{ mb: 1 }} />
            <Box sx={{ ml: 3, py: 0 }}>
              <Typography variant='body1'>Assign and remove team members from specific assistants in bulk</Typography>
            </Box>
          </Box>
        )}

        {has({ scoped: PERMISSIONS.ASSISTANT_SETTINGS_MANAGE }) && (
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>Assistant Settings</Typography>
            <Divider sx={{ mb: 1 }} />
            <Typography variant="body1" sx={{ ml: 1, mb: 1 }}>
              Configure the behavior and capabilities of each assistant. Select an assistant from the dropdown, then use the following tabs:
            </Typography>

            <Box sx={{ ml: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 500 }}>System Prompts</Typography>
                <Box sx={{ ml: 3, py: 0 }}>
                  <Typography variant='body1'>Create and manage system prompts that define the assistant&apos;s primary objective and instructions</Typography>
                  <Typography variant='body1'>Set the active system prompt that guides every conversation</Typography>
                </Box>
              </Box>

              <Box>
                <Typography variant="h6" sx={{ fontWeight: 500 }}>Personas</Typography>
                <Box sx={{ ml: 3, py: 0 }}>
                  <Typography variant='body1'>Create personas that shape the assistant&apos;s tone, style, and domain focus</Typography>
                  <Typography variant='body1'>Users can switch between personas to get tailored responses</Typography>
                </Box>
              </Box>

              <Box>
                <Typography variant="h6" sx={{ fontWeight: 500 }}>Prompt Library</Typography>
                <Box sx={{ ml: 3, py: 0 }}>
                  <Typography variant='body1'>Build a library of reusable prompts available to all users of the assistant</Typography>
                  <Typography variant='body1'>Create generic prompts or target them to a specific persona</Typography>
                </Box>
              </Box>

              <Box>
                <Typography variant="h6" sx={{ fontWeight: 500 }}>Indexes</Typography>
                <Box sx={{ ml: 3, py: 0 }}>
                  <Typography variant='body1'>Manage search indexes that provide the assistant with domain-specific knowledge</Typography>
                  <Typography variant='body1'>Configure which data sources are available for retrieval-augmented generation</Typography>
                </Box>
              </Box>

              <Box>
                <Typography variant="h6" sx={{ fontWeight: 500 }}>Chat Completions</Typography>
                <Box sx={{ ml: 3, py: 0 }}>
                  <Typography variant='body1'>Configure the LLM model, temperature, and other completion parameters</Typography>
                  <Typography variant='body1'>Fine-tune response behavior for the assistant</Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        )}

        {has(PERMISSIONS.SHAREPOINT_SITES_MANAGE) && (
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>SharePoint Sites</Typography>
            <Divider sx={{ mb: 1 }} />
            <Box sx={{ ml: 3, py: 0 }}>
              <Typography variant='body1'>Add and remove SharePoint site sources that users can reference in conversations</Typography>
            </Box>
          </Box>
        )}

        {/* {has(PERMISSIONS.CONTEXT_TEMPLATES_MANAGE) && (
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>Context Templates</Typography>
            <Divider sx={{ mb: 1 }} />
            <Box sx={{ ml: 3, py: 0 }}>
              <Typography variant='body1'>Create and manage reusable context template collections</Typography>
              <Typography variant='body1'>Define structured context that can be applied to assistant interactions</Typography>
            </Box>
          </Box>
        )} */}

        {has(PERMISSIONS.WORKFLOWS_MANAGE) && (
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>Workflows</Typography>
            <Divider sx={{ mb: 1 }} />
            <Box sx={{ ml: 3, py: 0 }}>
              <Typography variant='body1'>If your team has any custom-built workflows, assign which assistants they show up in</Typography>
            </Box>
          </Box>
        )}

        {has(PERMISSIONS.STATISTICS_VIEW) && (
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>Application Statistics</Typography>
            <Divider sx={{ mb: 1 }} />
            <Box sx={{ ml: 3, py: 0 }}>
              <Typography variant='body1'>View usage statistics and analytics for your team&apos;s assistants</Typography>
            </Box>
          </Box>
        )}

        {has(PERMISSIONS.LLM_STATISTICS_VIEW) && (
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>LLM Statistics</Typography>
            <Divider sx={{ mb: 1 }} />
            <Box sx={{ ml: 3, py: 0 }}>
              <Typography variant='body1'>Monitor LLM token usage, costs, and performance metrics</Typography>
            </Box>
          </Box>
        )}
      </Box>

      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 3 }}>
        Expect more changes to this panel soon as we add additional features for you to customize assistants.
      </Typography>
    </Box>
  );
}

export default Page;