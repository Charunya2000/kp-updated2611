import { validateUserAccess } from '@/app/services/userAccessService';
import { notFound } from 'next/navigation';
import RomEstimator from '@/app/kpit-ai-portal-members/rom/RomEstimator';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const team = 'kpit-ai-portal-members';
  const assistant = 'rom';

  const userAssistant = await validateUserAccess(team, assistant);

  if (!userAssistant) {
    notFound();
  }

  return (<RomEstimator />);
}