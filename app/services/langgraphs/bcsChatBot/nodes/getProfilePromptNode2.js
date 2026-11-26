'use server';

export const getProfilePromptNode = async (state) => {
  const PROMPT_PROFILES = state.config?.promptProfiles || {};

  try {
    if (state.searchResults?.items?.length > 0) {
      // Safely get the index name from either metadata or search results
      const rawIndexName = state.indexMetadata?.indexName || state.searchResults?.indexName;

      // Start with a fallback, then overwrite if a valid index is found
      let profileKey = "default";

      if (typeof rawIndexName === 'string' && rawIndexName.trim() !== "") {
        // This will be "nps-incident-001" for incidents or "nps-knowledge-001" for KB
        profileKey = rawIndexName;
      }

      // Access the profile instructions using the exact index name
      const profileJson = PROMPT_PROFILES[profileKey] || PROMPT_PROFILES.default;
      const profile = typeof profileJson === 'string' ? JSON.parse(profileJson) : profileJson;

      return {
        ...state,
        promptProfile: profile,
        promptSuccess: true
      };
    }

    if (state.githubMetadata?.fileFound) {
      return {
        ...state,
        promptProfile: PROMPT_PROFILES.github,
        promptSuccess: true
      };
    }

    return {
      ...state,
      promptProfile: PROMPT_PROFILES.default,
      promptSuccess: true
    };

  } catch (error) {
    console.error('Error in getProfilePromptNode:', error);
    return {
      ...state,
      promptProfile: PROMPT_PROFILES.default,
      promptSuccess: false,
      error: error.message
    };
  }
};