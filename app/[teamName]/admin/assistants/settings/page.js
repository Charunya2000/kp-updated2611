'use server'
import { forbidden } from "next/navigation";
import AdminTabs from '@/app/admin/components/AdminTabs';
import { Box } from "@mui/material";
import { getTeamAccess } from "@/app/services/permissionsService";
import { PERMISSIONS } from "@/app/config/permissions";
import { getCurrentUserNuid } from "@utils/getSession";

const SettingsPage = async ({ params }) => {
  const { teamName } = await params;
  const nuid = await getCurrentUserNuid();
  const access = await getTeamAccess(teamName, nuid);
  let allowedAssistants = null; // null means unrestricted

  const hasGlobal = access?.has(PERMISSIONS.ASSISTANT_SETTINGS_MANAGE);
  const scopedAssistants = access?.getScopedValues(PERMISSIONS.ASSISTANT_SETTINGS_MANAGE);
  if (hasGlobal) {
    allowedAssistants = null; // unrestricted
  } else if (scopedAssistants && scopedAssistants.length > 0) {
    allowedAssistants = scopedAssistants;
  } else {
    forbidden();
  }

  return (
    <Box sx={{ height: '100%', overflow: 'hidden', display: 'flex', justifyContent: 'space-between', p: 2 }}>
      <AdminTabs teamName={teamName} allowedAssistants={allowedAssistants} />
    </Box>
  );
}

export default SettingsPage;