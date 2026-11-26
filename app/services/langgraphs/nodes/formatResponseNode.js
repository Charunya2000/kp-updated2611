'use server';

const dbaSystemContext = `
You are a KPMC Assistant with the DBA persona. 
You help users write SQL queries for Oracle Database using foundational knowledge and the following Azure AI Search indexes:
- db-concepts-001
- jdbc-metadata-001.
Tips:
- First analyze the user prompt to determine tables and columns of interest.
- Query the concepts index (multiple times if needed) to capture all documents needed to construct the query.
- Review content JSON for table relationships (foreignKeys, primaryKeys).
- Only construct the query once you have all necessary table/column/relationship information.
- Always use fully qualified table names with schema (SCHEMA_NAME.TABLE_NAME).
- Avoid PII/PHI in all responses.
- Always format your responses using proper markdown syntax.
- Place SQL queries in \`\`\`sql code blocks.
- Use markdown tables when appropriate for structured data.
- Use headers (##, ###) for section organization.
`;

export const formatResponseNode = async (state) => {
  const finalSql = state.refinedSqlResponse || state.sqlResponse;

  const messages = [
    { role: "system", content: dbaSystemContext },
    {
      role: "system",
      content: "Always respond with proper markdown formatting. SQL queries must be in ```sql code blocks. Use ## and ### headers for organization, and use **bold** for emphasis of important points."
    },
    {
      role: "user",
      content: `
        Create a formatted response for this query: "${state.userPrompt}"
        
        Use this exact SQL query in your response:
        
        ${finalSql}
        
        Include:
        1. A brief explanation of the tables and relationships used
        2. The SQL query (in a proper markdown SQL code block) exactly as provided above
        3. A brief explanation of how the query works
        
        Format the response in clear markdown with proper syntax highlighting for SQL.
        Do NOT include the SQL query outside of the markdown code block.
      `
    }
  ];

  let formattedResponse = "";
  let suggestedPrompts = [];
  await chatCompletionMarkdown({
    messages,
    onToken: (content) => {
      formattedResponse += content;
      // Stream tokens to client if sendEvent is provided
      if (state.sendEvent) {
        state.sendEvent({ type: 'data', data: content });
      }
    },
    teamName: state?.teamName,
    assistantName: state?.assistantName
  });

  // Generate suggested prompts based on the formatted response
  const promptMessages = [
    {
      role: "user",
      content: `Based on your ${formattedResponse} response, provide 3 suggested prompts, plain text only, separated by ~!~ and don't number them.`
    }
  ];

  suggestedPrompts = await chatCompletionPrompts({ messages: promptMessages });
  state.sendEvent({ type: 'data', data: JSON.stringify({ suggestedPrompts }) });

  return {
    formattedResponse,
    suggestedPrompts // Include suggested prompts in the return value
  };
};
