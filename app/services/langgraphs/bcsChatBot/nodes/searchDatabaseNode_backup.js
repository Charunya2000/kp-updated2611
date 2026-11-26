'use server';
import { chatCompletion } from "@/app/services/chatCompletionService2";

export const queryDatabaseNode = async ({ state }) => {
  try {
    let systemMessage = JSON.stringify(state.config.database.systemMessage);
    // Build index definition for prompt
    const messages = [
      { role: "system", content: systemMessage },
      { role: "user", content: `User Query: ${state.userPrompt}` }
    ];

    const completionConfig = {
      temperature: state.config.userIntent.temperature || 0.7,
      max_tokens: state.config.userIntent.max_tokens || 1000,
      model: "gpt-4o",
      messages: messages,
      teamName: state?.teamName,
      assistantName: state?.assistantName,
    };
    let intentResponse = await chatCompletion(completionConfig);
    const responseMessage = intentResponse;

    const sqlQuery = state.sqlQuery || '';

    const response = await fetch("/api/db2", {
      method: "POST",
      body: JSON.stringify({
        sql: sqlQuery

      })
    });


    if (response.status === 404) {
      return {
        ...state,
        datbaseMetaData: {
          sqlQuery,
          recordFound: false,
          message: `Unable to perform operation`,
          timestamp: new Date().toISOString()
        },
        searchSuccess: false
      };
    }

    if (!response.ok) {
      throw new Error(`Database error: ${response.status} ${response.statusText}`);
    }

    const sqlData = await response.json();

    return {
      ...state,
      githubMetadata: {
        sqlQuery,

        recordFound: true,
        records: sqlData,
        timestamp: new Date().toISOString()
      },
      searchSuccess: true
    };

  } catch (error) {
    console.error('Error fetching from Database:', error);
    return {
      ...state,
      githubMetadata: {
        sqlQuery,
        recordFound: false,
        error: error.message,
        timestamp: new Date().toISOString()
      },
      searchSuccess: false
    };
  }
};
