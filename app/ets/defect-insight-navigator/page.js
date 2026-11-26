import { validateUserAccess } from '@/app/services/userAccessService';
import { notFound } from 'next/navigation';
import DefectInsightHub from './DefectInsightHub';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const userAssistant = await validateUserAccess('ets', 'defect-insight-navigator');
  if (!userAssistant) notFound();
  return <DefectInsightHub />;
}
