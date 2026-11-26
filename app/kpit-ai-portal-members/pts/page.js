import { validateUserAccess } from '@/app/services/userAccessService';
import { notFound } from 'next/navigation';
import PtsAnalyzer from '@/app/kpit-ai-portal-members/pts/PtsAnalyzer';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const team = 'kpit-ai-portal-members';
  const assistant = 'pts';

  const userAssistant = await validateUserAccess(team, assistant);

  if (!userAssistant) {
    notFound();
  }

  return (<PtsAnalyzer />);
}
