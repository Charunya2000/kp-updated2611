'use server'

import { isAppAdmin } from "@/app/services/applicationRoleService";
import { forbidden } from 'next/navigation';
import TeamManagement from "./TeamManagement";

const TeamManagementPage = async () => {
  const isAdmin = await isAppAdmin();

  if (!isAdmin) {
    forbidden();
  }

  return <TeamManagement />;
}

export default TeamManagementPage;
