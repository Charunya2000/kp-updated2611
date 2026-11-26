'use server';

import { getUserAssistantsByNUID } from './userAssistantService';
import { getServerSession } from '@/utils/getSession';

function isDemoBypassSession(session) {
  return process.env.envName === 'dev' && process.env.DEMO_AUTH_BYPASS_ENABLED === 'true' && session?.demoBypass === true;
}

/**
 * Validates if the current user has access to a specific team/assistant combination
 * @param {string} teamName - The team name
 * @param {string} assistantName - The assistant name
 * @returns {Promise<Object|null>} Returns the user assistant if access is granted, null otherwise
 */
export async function validateUserAccess(teamName, assistantName) {
  try {
    const session = await getServerSession();

    if (isDemoBypassSession(session)) {
      return {
        teamName,
        name: assistantName,
        demoBypass: true,
      };
    }

    const userAssistants = await getUserAssistantsByNUID(session.nuid);

    // Check if user has access to the specific assistant within the team
    const hasAccess = userAssistants.assistants.some(assistant =>
      assistant.teamName === teamName && assistant.name === assistantName
    );

    if (!hasAccess) {
      return null;
    }

    // Return the matching assistant for the user
    return userAssistants.assistants.find(assistant =>
      assistant.teamName === teamName && assistant.name === assistantName
    );
  } catch (error) {
    console.error('Error validating user access:', error);
    return null;
  }
}

/**
 * Gets user's accessible assistants for a specific team
 * @param {string} team - The team name
 * @returns {Promise<Array>} Returns array of assistants user has access to in the team
 */
export async function getUserAssistantsForTeam(team) {
  try {
    const session = await getServerSession();

    if (isDemoBypassSession(session)) {
      return [{ teamName: team, name: '*', demoBypass: true }];
    }

    const userAssistants = await getUserAssistantsByNUID(session.nuid);

    return userAssistants.assistants.filter(assistant => assistant.teamName === team);
  } catch (error) {
    console.error('Error getting user assistants for team:', error);
    return [];
  }
}

/**
 * Checks if user has any access to a team
 * @param {string} team - The team name
 * @returns {Promise<boolean>} Returns true if user has any assistant in the team
 */
export async function hasTeamAccess(team) {
  try {
    const userAssistants = await getUserAssistantsForTeam(team);
    return userAssistants.length > 0;
  } catch (error) {
    console.error('Error checking team access:', error);
    return false;
  }
}

/**
 * Gets all user assistants for display in navigation or selection
 * @returns {Promise<Object>} Returns the complete user assistants object with assistants
 */
export async function getAllUserAssistants() {
  try {
    const session = await getServerSession();

    if (isDemoBypassSession(session)) {
      return { assistants: [{ teamName: '*', name: '*', demoBypass: true }] };
    }

    return await getUserAssistantsByNUID(session.nuid);
  } catch (error) {
    console.error('Error getting all user assistants:', error);
    return { assistants: [] };
  }
}
