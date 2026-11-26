'use server'
import { getTeamAccess } from "@/app/services/permissionsService";
import { getCurrentUserNuid } from "@utils/getSession";
import { PERMISSIONS } from "@/app/config/permissions";
import { Box } from "@mui/material";
import { redirect } from "next/navigation";
import TeamMembers from "./TeamMembers";

const TeamMembersPage = async ({ params }) => {
  const { teamName } = await params;

  const nuid = await getCurrentUserNuid();
  const access = await getTeamAccess(teamName, nuid);
  if (!access?.hasAny([PERMISSIONS.TEAM_MEMBERS_VIEW, PERMISSIONS.TEAM_MEMBERS_MANAGE, PERMISSIONS.TEAM_MEMBERS_PERMISSIONS_MANAGE])) {
    return redirect('/');
  }

  return (
    <Box sx={{
      height: '100%',
      display: 'flex',
      gap: 1,
      p: 2,
    }}>
      <TeamMembers teamName={teamName} />
    </Box>
  );
}

export default TeamMembersPage;
