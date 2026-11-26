'use server';

import { chatCompletionMarkdown } from '@/app/services/langgraphs/chatCompletionService2.js';

export const evaluateQueryNode = async (state) => {
  const messages = [
    {
      role: "system",
      content: "You are a SQL quality evaluator. Evaluate the SQL query against the user's intent. Rate it from 1-10 on correctness, completeness, and efficiency. Suggest improvements if needed."
    },
    {
      role: "user",
      content: `
        Original User Query: ${state.userPrompt}
        Generated SQL: ${state.sqlResponse}
        Available Tables: ${JSON.stringify(state.analysisResult.foundTables)}
      `
    }
  ];

  let evaluation = "";
  await chatCompletionMarkdown({
    messages,
    onToken: (content) => { evaluation += content; },
    teamName: state?.teamName,
    assistantName: state?.assistantName
  });

  // Extract rating from evaluation
  let qualityScore = 0;
  const match = evaluation.match(/(\d+)\/10/) || evaluation.match(/rating.*?(\d+)/i);
  if (match && match[1]) {
    qualityScore = parseInt(match[1], 10);
  }
  if (isNaN(qualityScore)) {
    qualityScore = 0; // Default to 0 if no valid score found
  }

  const needsRefinement = qualityScore < 7;

  return {
    queryEvaluation: evaluation,
    qualityScore,
    needsRefinement
  };
};
