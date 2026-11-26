'use server'
import { forbidden } from "next/navigation";
import { Box } from "@mui/material";
import { getTeamAccess } from "@/app/services/permissionsService";
import { PERMISSIONS } from "@/app/config/permissions";
import { getCurrentUserNuid } from "@utils/getSession";
import NewsManagement from './components/NewsManagement';

const NewsPage = async ({ params }) => {
  const { teamName } = await params;
  const nuid = await getCurrentUserNuid();
  const access = await getTeamAccess(teamName, nuid);
  let allowedAssistants = null; // null means unrestricted

  const hasGlobal = access?.has(PERMISSIONS.ASSISTANT_NEWS_MANAGE);
  const scopedAssistants = access?.getScopedValues(PERMISSIONS.ASSISTANT_NEWS_MANAGE);
  if (hasGlobal) {
    allowedAssistants = null; // unrestricted
  } else if (scopedAssistants && scopedAssistants.length > 0) {
    allowedAssistants = scopedAssistants;
  } else {
    forbidden();
  }

  return (
    <Box sx={{ height: '100%', overflow: 'hidden', display: 'flex', justifyContent: 'space-between', p: 2 }}>
      <NewsManagement teamName={teamName} allowedAssistants={allowedAssistants} />
    </Box>
  );
}

export default NewsPage;
