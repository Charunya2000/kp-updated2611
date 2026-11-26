'use server';
import { promises as fs } from 'fs';
import path from 'path';
import { getBcsAdminText } from "@services/bcsAdminServerService";

/**
 * Loads the configuration for a specific NUID.
 * Preserves original logic while adding validation for prompt profiles.
 */
export const getConfigNode = async (state) => {
  if (state.config) return {}

  const teamName = state.teamName.toUpperCase();

  if (!teamName) {
    console.error("[getConfigNode] CRITICAL ERROR: No teamName provided. Falling back to default.");
    return {
      ...state,
      config: getDefaultConfig()
    };
  }

  try {
    const configs = await getBcsAdminText(teamName);

    if (!configs || !Array.isArray(configs) || configs.length === 0) {
      console.error(`[getConfigNode] FETCH ERROR: No config found for teamName: ${teamName}. Using default.`);
      return {
        ...state,
        config: getDefaultConfig()
      };
    }

    // Use the latest config found
    const configJson = configs[configs.length - 1].text;
    //console.log("[DEBUG getConfigNode] Raw Config JSON:", configJson);

    let config = {};
    try {
      config = JSON.parse(configJson);
      //config = await getLocalData();

      // VALIDATION LOGIC: Check for required profiles
      const requiredProfiles = [

        'knowledge_base',
        'test_case'


      ];

      requiredProfiles.forEach(profile => {
        if (!config.promptProfiles || !config.promptProfiles[profile]) {
          console.error(`[getConfigNode] VALIDATION ERROR: Profile "${profile}" is missing from the fetched config.`);
        }
      });

    } catch (err) {
      console.error(`[getConfigNode] PARSE ERROR: Failed to parse config JSON for ${teamName}: ${err.message}`);
      return {
        ...state,
        config: getDefaultConfig()
      };
    }

    return {
      ...state,
      config
    };

  } catch (error) {
    console.error(`[getConfigNode] SYSTEM ERROR: Unexpected failure loading config: ${error.message}`);
    return {
      ...state,
      config: getDefaultConfig()
    };
  }
};
async function getLocalData() {
  // Get the path to the JSON file
  const filePath = path.join(process.cwd(), 'app/services/langgraphs/baseChatBot/config.json');

  // Read the JSON file asynchronously
  const jsonData = await fs.readFile(filePath, 'utf8');

  // Parse the data as JSON
  const objectData = JSON.parse(jsonData);

  return objectData;
}
/**
 * DEFAULT CONFIG FALLBACK
 * Returns a "Safe Default" that includes the new GitHub parameters.
 */
async function getDefaultConfig() {

  const config = await getLocalData();




  console.warn("[getConfigNode] WARNING: System is operating on DEFAULT configuration.");
  return config

}