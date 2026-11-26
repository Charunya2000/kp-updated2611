import { validateUserAccess } from '@/app/services/userAccessService';
import { notFound } from 'next/navigation';
import IFrame from '../components/IFrame'
import { getServerSession } from '@/utils/getSession';

export const dynamic = 'force-dynamic';

export default async function Page() {
  // Get path segments - this page is under kpit-ai-portal-members/invoice-variance
  const team = 'kpit-ai-portal-members';
  const assistant = 'invoice-variance-pprod';

  // get user info from session or auth (not implemented here)
  const { nuid } = await getServerSession();

  // Validate user has access to this team/assistant combination
  const userAssistant = await validateUserAccess(team, assistant);

  if (!userAssistant) {
    // User doesn't have access, return 404
    notFound();
  }

  return (<IFrame url={'https://preprod-docdiff.app-nx.dev.thriveai.kp.org/'} title="Invoice Variance" message={nuid} />);
}