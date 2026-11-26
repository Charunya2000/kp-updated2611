import { validateUserAccess } from '@/app/services/userAccessService';
import { notFound } from 'next/navigation';
import IFrame from '../components/IFrame'

export const dynamic = 'force-dynamic';

export default async function Page() {
  // Get path segments - this page is under kpit-ai-portal-members/profile-analyzer
  const team = 'kpit-ai-portal-members';
  const assistant = 'profile-analyzer';

  const userAssistant = await validateUserAccess(team, assistant);

  if (!userAssistant) {
    notFound();
  }

  return (<IFrame url={'https://dev-profanalyzer-web-1.aisvc.aksnp.azure.kp.org'} title="Profile Analyzer" />);
}