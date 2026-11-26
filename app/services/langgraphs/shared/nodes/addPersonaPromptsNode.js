import { selectPersona } from '@/app/services/personaService';

export const personaNode = async (state) => {

  // if no persona was selected, skip the DB call and return an empty array
  if (!state?.userSelectedPersona) {
    return {};
  }

  const query = {
    teamName: state.teamName,
    assistantName: state.assistantName,
    name: state.userSelectedPersona,
    enabled: true
  };

  try {
    const persona = await selectPersona(query, state.teamName);
    return {
      // never return null for prompt — return empty string when missing/empty
      personaPrompt: (persona?.prompt ?? '').toString(),
      // keep associatedGraph as empty string when missing so callers can safely toLowerCase()/includes() after guarding
      personaAssociatedGraph: (persona?.associatedGraph ?? '').toString()
    };
  } catch (err) {
    console.error('Failed to load persona', err);
    return {};
  }
};
