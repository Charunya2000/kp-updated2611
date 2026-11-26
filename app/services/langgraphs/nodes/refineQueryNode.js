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

export const refineQueryNode = async (state) => {
  if (!state.needsRefinement) {
    return { refinedSqlResponse: state.sqlResponse };
  }

  const messages = [
    { role: "system", content: dbaSystemContext },
    ...state.dbContextMessages,
    {
      role: "user",
      content: `
        Original query: ${state.userPrompt}
        
        You generated this SQL query:
        ${state.sqlResponse}
        
        Evaluation of the query:
        ${state.queryEvaluation}
        
        Please refine the SQL query to address these issues.
      `
    }
  ];

  let refinedSqlResponse = "";
  await chatCompletionMarkdown({
    messages,
    onToken: (content) => { refinedSqlResponse += content; },
    teamName: state?.teamName,
    assistantName: state?.assistantName
  });

  return { refinedSqlResponse };
};
