import { getServerSession } from '@utils/getSession';

export async function isAppAdmin() {
  const user = await getServerSession();

  return !!user?.groups?.includes('HPTS_AIPORTAL_ADMIN');
}