import { requireTeamPermission } from '@/app/utils/requireTeamPermission';
import { PERMISSIONS } from '@/app/config/permissions';
import { Box } from '@mui/material';
import RoleTemplates from './RoleTemplates';

export default async function RoleTemplatesPage({ params }) {
  const { teamName } = await params;

  await requireTeamPermission(teamName, PERMISSIONS.TEAM_ROLE_TEMPLATES_MANAGE);

  return (
    <Box sx={{ height: '100%', display: 'flex', gap: 1 }}>
      <RoleTemplates teamName={teamName} />
    </Box>
  );
}
