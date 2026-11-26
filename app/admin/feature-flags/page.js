'use server';

import { Box } from "@mui/material";
import { isAppAdmin } from "@/app/services/applicationRoleService";
import { forbidden } from "next/navigation";
import FeatureFlags from "./FeatureFlags";

export default async function FeatureFlagsPage() {
  const isAdmin = await isAppAdmin();

  if (!isAdmin) {
    forbidden();
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <FeatureFlags />
    </Box>
  );
}
