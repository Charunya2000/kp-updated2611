'use server';

// Node: Generate SQL using OpenAI model with query plan
export const generateSqlNode = async (state) => {
  // Check if there are validation errors in the query plan
  const hasValidationErrors = state.queryPlan.includes("VALIDATION ERRORS") || state.queryPlan.includes("VALIDATION WARNINGS");
  const hasFabricatedColumns = state.queryPlan.includes("FABRICATED COLUMNS DETECTED");

  // If there are fabricated columns, we need to regenerate the query plan
  if (hasFabricatedColumns) {
    // Extract the list of fabricated columns
    const fabricatedColumnsMatch = state.queryPlan.match(/The columns \[(.*?)\] do not exist/);
    const fabricatedColumns = fabricatedColumnsMatch ?
      fabricatedColumnsMatch[1].split(', ').map(col => col.trim()) : [];

    // Get the original plan without validation errors
    const originalPlan = state.queryPlan.split("\n\nVALIDATION ERRORS")[0];

    // Return an error message instead of a SQL query
    return {
      sqlResponse: `
## Error: Invalid Query Plan

I cannot generate a SQL query based on the current plan because it references columns that don't exist in the database:

**Non-existent columns:** ${fabricatedColumns.join(', ')}

Please refine your request to use only columns that exist in the database schema. Here are some possible alternatives:

1. If you're looking for phone information, you might use 'phone_number' and 'phone_type_code' instead of specific phone types.
2. If you need personal information, check for columns like 'first_name', 'last_name', 'email', etc.

Would you like me to suggest a modified query that uses only existing columns?
`
    };
  }

  const messages = [
    {
      role: "system",
      content: `${dbaSystemContext}
      
      CRITICAL INSTRUCTION: Your task is to create an Oracle SQL query that STRICTLY follows the query plan provided.
      DO NOT deviate from the tables, columns, and relationships outlined in the query plan.
      The query plan is the authoritative source for what tables and columns to use.
      
      Follow these explicit guidelines:
      1. Use ONLY the tables and columns mentioned in the query plan${hasValidationErrors ? " (ignoring any validation warnings)" : ""}
      2. Make sure to properly qualify all column names with their table names
      3. Always qualify all table references with schema names (SCHEMA_NAME.TABLE_NAME format)
      4. Implement all joins exactly as specified in the query plan
      5. Return ONLY a valid Oracle SQL query based precisely on the query plan
      6. DO NOT include any columns that aren't explicitly in the query plan
      7. Use standard ANSI SQL syntax that works in Oracle Database
      8. Include all necessary JOIN conditions to connect all tables in the query
    `
    },
    {
      role: "user",
      content: `
        User Query: ${state.userPrompt}
        
        QUERY PLAN TO FOLLOW:
        ${hasValidationErrors ? state.queryPlan.split(/\n\nVALIDATION (ERRORS|WARNINGS)/)[0].trim() : state.queryPlan}
        
        Column to Table Mapping: ${JSON.stringify(state.analysisResult.columnToTableMap)}
        
        Conceptual Mappings: ${state.conceptualMappings ? JSON.stringify(state.conceptualMappings) : "None available"}
        
        Instructions:
        1. Follow the query plan EXACTLY - do not improvise or change the tables or columns
        2. Make sure to properly qualify all column names with their table names
        3. Always qualify all table references with schema names (SCHEMA_NAME.TABLE_NAME format)
        4. Implement all joins exactly as specified in the query plan
        5. Return ONLY a valid Oracle SQL query based precisely on the query plan
        6. DO NOT include any columns that aren't explicitly in the query plan
        7. Use standard ANSI SQL syntax that works in Oracle Database
        8. Include all necessary JOIN conditions to connect all tables in the query
      `
    }
  ];

  let sqlResponse = "";
  await chatCompletionMarkdown({
    messages,
    onToken: (content) => {
      sqlResponse += content;
    },
    teamName: state?.teamName,
    assistantName: state?.assistantName
  });

  return { sqlResponse };
};
