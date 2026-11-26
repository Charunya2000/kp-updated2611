import { validateUserAccess } from '@/app/services/userAccessService';
import { notFound } from 'next/navigation';
import SmartNote from './components/SmartNote';
import { getFeatureFlag } from '@/app/services/featureFlagService';

export const dynamic = 'force-dynamic';


export default async function Page({ params }) {
  const { teamName, id } = await params;
  const assistant = 'case-360-assistant';
  const userAssistant = await validateUserAccess(teamName, assistant);

  if (!userAssistant) {
    notFound();
  }

  const isPriorChatEnabledFlag = await getFeatureFlag('is-prior-chat-enabled-insight-360');
  const isPriorChatEnabled = Boolean(isPriorChatEnabledFlag?.enabled);

  const useEpdsFlag = await getFeatureFlag('use-epds');
  const isEpdsFeatureEnabled = Boolean(useEpdsFlag?.enabled);


  return (
    <SmartNote
      envName={process.env.envName}
      isPriorChatEnabled={isPriorChatEnabled}
      isEpdsFeatureEnabled={isEpdsFeatureEnabled}
    />
  );
}