import { validateUserAccess } from '@/app/services/userAccessService';
import { notFound } from 'next/navigation';
import IFrame from '../components/IFrame'
import { getServerSession } from '@/utils/getSession';

export const dynamic = 'force-dynamic';

export default async function Page() {
  // Get path segments - this page is under ciai/invoice-variance
  const team = 'ciai';
  const assistant = 'customer-installation';
  const env = process.env.envName;

  // get user info from session or auth (not implemented here)
  const { nuid } = await getServerSession();

  // Validate user has access to this team/assistant combination
  const userAssistant = await validateUserAccess(team, assistant);

  if (!userAssistant) {
    // User doesn't have access, return 404
    notFound();
  }

  // get IFrame URL:
  let iframeUrl = 'https://dev-ciai-web-1.aisvc.aksnp.azure.kp.org';
  switch (env) {
    case 'dev':
      iframeUrl = "https://dev-ciai-web-1.aisvc.aksnp.azure.kp.org";
      break;
    case 'uat':
      iframeUrl = "https://uat3-ciai-web-1.aisvc.aksnp.azure.kp.org";
      break;
    case 'pp':
      iframeUrl = "https://pp-ciai-web-1.aisvc.aksnp.azure.kp.org";
      break;
    case 'psup':
      iframeUrl = "https://psup-ciai-web-1.aisvc.aksp.azure.kp.org";
      break;
    case 'prod':
      iframeUrl = "https://prod-ciai-web-1.aisvc.aksp.azure.kp.org";
      break;
  }

  return (<IFrame url={iframeUrl} title="Invoice Variance" message={nuid} />);
}