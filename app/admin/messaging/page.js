'use server';

import { Box } from "@mui/material";
import { isAppAdmin } from "@/app/services/applicationRoleService";
import { forbidden } from "next/navigation";
import ApplicationMessaging from "./ApplicationMessaging";

export default async function MessagingPage() {
  const isAdmin = await isAppAdmin();

  if (!isAdmin) {
    forbidden();
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ApplicationMessaging />
    </Box>
  );
}
