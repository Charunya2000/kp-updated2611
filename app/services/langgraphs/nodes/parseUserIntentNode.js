'use server';

import { chatCompletionMarkdown } from './chatCompletionService2.js';

export const parseUserIntentNode = async (state) => {
  const messages = [
    {
      role: "system",
      content: `You are a database query analyzer specialized in extracting both explicit and implicit database references.
      Important: Users often refer to database objects indirectly or conceptually. For example:
      - "Using the member owner schema" should be identified as the schema "MEMBER_OWNER"
      - "Looking for person name and date of birth" should identify conceptual column needs
      - "Information about patients" might refer to a person-related table
      
      Distinguish between SCHEMA names and TABLE names. For example, 'MEMBER_OWNER.TAP_PERSON' means 
      MEMBER_OWNER is the schema and TAP_PERSON is the table.
      
      Respond in JSON format with fields:
      - schemas (array): Schema names mentioned or implied in the query
      - tables (array): Table names mentioned or implied in the query (do NOT include schema names here)
      - columns (array): Exact column names mentioned in the query
      - columnConcepts (array): Conceptual column descriptions (like "person name", "date of birth", "birth date", "full name")
      - tableConcepts (array): Conceptual table descriptions (like "person", "member", "patient", "coverage")
      - conditions (array): Filter conditions mentioned in the query (e.g., "starts on June 1st 2023")
      - relationships (array): Table join relationships mentioned
      - queryType (string): Type of query (SELECT, INSERT, etc.)
      
      Be thorough in identifying all possible relevant concepts. Include variations of terms (e.g., both "date of birth" and "birth date").`
    },
    { role: "user", content: state.userPrompt }
  ];

  let intentResponse = "";
  await chatCompletionMarkdown({
    messages,
    onToken: (content) => { intentResponse += content; },
    teamName: state?.teamName,
    assistantName: state?.assistantName
  });

  // Parse JSON response, handle potential errors
  let parsedIntent;
  try {
    // Extract JSON from the response using RegExp.exec()
    let jsonMatch = /```json\n([\s\S]*?)\n```/.exec(intentResponse);
    if (!jsonMatch) {
      jsonMatch = /({[\s\S]*})/.exec(intentResponse);
    }
    if (!jsonMatch) {
      jsonMatch = [null, intentResponse];
    }
    const jsonString = jsonMatch[1];
    parsedIntent = JSON.parse(jsonString);

    // Ensure we have all required properties with defaults
    parsedIntent = {
      schemas: parsedIntent.schemas || [],
      tables: parsedIntent.tables || [],
      columns: parsedIntent.columns || [],
      columnConcepts: parsedIntent.columnConcepts || [],
      tableConcepts: parsedIntent.tableConcepts || [],
      conditions: parsedIntent.conditions || [],
      relationships: parsedIntent.relationships || [],
      queryType: parsedIntent.queryType || "unknown"
    };

  } catch (e) {
    console.error("Error parsing intent:", e);
    parsedIntent = {
      schemas: [],
      tables: [],
      columns: [],
      columnConcepts: [],
      conditions: [],
      relationships: [],
      queryType: "unknown"
    };
  }

  return { parsedIntent };
};
