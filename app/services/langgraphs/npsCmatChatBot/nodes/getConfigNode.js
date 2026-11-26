'use server';
import { promises as fs } from 'fs';
import path from 'path';
import { getAdminText } from "@services/npscmatAdminServerService";

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
    const configs = await getAdminText(teamName);

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
        'intake_assignment',
        'qa_review'

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
  const filePath = path.join(process.cwd(), 'app/services/langgraphs/bcsChatBot/config.json');

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
  //const filePath = path.join(process.cwd(), 'app/services/langgraphs/bcsChatBot/config.json');

  // Read the file content
  //const jsonData = fs.readFile(filePath, 'utf8');
  //const fileStream = fs.createReadStream(filePath);

  // Parse the data as JSON
  // const objectData = JSON.parse(data);



  console.warn("[getConfigNode] WARNING: System is operating on DEFAULT configuration.");
  return config
  // return {
  //   temperature: 0.7,
  //   max_tokens: 1000,
  //   userIntent: {}, // Preserved from original structure

  //   // NEW: GitHub Defaults for automation flow
  //   githubDefaults: {
  //     organization: "HP-OPS",
  //     repository: "NPGUIAutomation",
  //     branch: "master",
  //     targetPath: "src/test/java",
  //     recursive: true,
  //     fetchContent: true
  //   },

  //   database: {
  //     systemMessage: {
  //       role: "system",
  //       content: "You are a Database Assistant. Generate SQL queries for DB2 based on user queries. Return ONLY the SQL query."
  //     }
  //   },
  //   promptProfiles: {
  //     default: {
  //       systemMessage: {
  //         role: "system",
  //         content: "You are an expert IT support agent. Note: The system is currently using a fallback configuration."
  //       },
  //       userMessage: {
  //         role: "user",
  //         content: "CONTEXT:\n{context}\n\nQUESTION: {question}\n\nANSWER:"
  //       }
  //     }
  //   }
  // };
}