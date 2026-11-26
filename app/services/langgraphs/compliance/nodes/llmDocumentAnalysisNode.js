// llmDocumentAnalysisNode.js
// Node to perform LLM-powered analysis on documentDifferences after matching is complete.

import { callCompletionWithFallback, buildSectionDiffPrompt } from './llmUtils.js';

export const llmDocumentAnalysisNode = async (state) => {
  // Defensive: ensure documentDifferences exists
  const { documentDifferences, completionsClient, comparisonConfigV2 } = state;
  if (!documentDifferences || !Array.isArray(documentDifferences.results)) {
    return {
      ...state,
      errorMessage: 'No documentDifferences found for LLM analysis.'
    };
  }


  // For each result, perform LLM-powered analysis as needed
  for (const result of documentDifferences.results) {
    if (result.sourceContent && result.targetContent) {
      try {
        const prompt = buildSectionDiffPrompt(result.sourceContent, result.targetContent);
        const messages = [
          { role: 'system', content: 'You are a compliance expert. Compare two regulatory text sections for substantive differences.' },
          { role: 'user', content: prompt }
        ];
        result.llmDiff = await callCompletionWithFallback(completionsClient, comparisonConfigV2, messages, comparisonConfigV2.completion.maxTokens);
      } catch (e) {
        result.llmDiff = `Error analyzing difference: ${e.message}`;
      }
    }
  }

  // Return updated state
  return {
    ...state,
    documentDifferences
  };
};
