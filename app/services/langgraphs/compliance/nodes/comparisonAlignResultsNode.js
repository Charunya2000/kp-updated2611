// comparisonAlignResultsNode.js

const writeToFile = async (comparisonSummary) => {
  // Write comparisonSummary to a file for debugging
  try {
    const fs = require('fs');
    const path = require('path');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `comparison-summary-${timestamp}.json`;
    const filePath = path.join(process.cwd(), fileName);
    fs.writeFileSync(filePath, JSON.stringify(comparisonSummary, null, 2));
    console.log(`[comparisonAlignResultsNode] Wrote comparisonSummary to ${filePath}`);
  } catch (err) {
    console.warn(`[comparisonAlignResultsNode] Failed to write comparisonSummary: ${err.message}`);
  }
}

export const comparisonAlignResultsNode = async (state) => {

  const { updateChatInteractionProgress, createProgressMarkdown } = await import('../helpers/progressTracking');

  let progressResponse = state.progressResponse || createProgressMarkdown("Starting comparison alignment");
  progressResponse += createProgressMarkdown("Aligning comparison results");

  // Update progress
  if (state.chatInteractionId) {
    await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
  }

  const { comparisonSummary = {}, completionsClient, userPrompt, configDocuments, rawContentA, rawContentB } = state;
  let errorMessage = "";
  // await writeToFile(comparisonSummary); // Write the comparison summary to a file for debugging
  // Get alignment prompt template and system message from config
  const alignPromptDoc = configDocuments.find(doc => doc.purpose === "AlignConfig" && doc.title === "Document Comparison Align Prompt");
  const systemMessageDoc = configDocuments.find(doc => doc.purpose === "AlignConfig" && doc.title === "Document Comparison Align System Message");
  const chatCompletionDoc = configDocuments.find(doc => doc.purpose === "ChatCompletionConfig" && doc.title === "Document Comparison Align Chat Completion Config");

  const promptTemplate = alignPromptDoc?.documentText || "Based on the comparison analysis provided, create a brief alignment summary for the user prompt: \\${userPrompt}\\n\\nComparison Analysis:\\n\\${comparisonAnalysis}\\n\\nIMPORTANT: If the content in both documents is substantively the same, respond with: 'No meaningful differences found.' Only describe differences that would affect the requirements, obligations, or interpretation. Do not invent or exaggerate differences. If the content is identical except for minor wording or formatting, state that the content is equivalent.";
  const systemMessage = systemMessageDoc?.documentText || "You are a compliance expert. Create a brief alignment summary based on the provided comparison analysis. Do not invent or exaggerate differences. If the content is substantively the same, state 'No meaningful differences found.'";
  let parsedConfig = { model: "gpt-4o", temperature: 0.5, max_tokens: 400 };
  if (chatCompletionDoc) {
    try {
      const jsonConfigMatch = chatCompletionDoc.documentText.match(/```jsonconfig\s*([\s\S]*?)\s*```/);
      if (jsonConfigMatch && jsonConfigMatch[1]) {
        parsedConfig = JSON.parse(jsonConfigMatch[1]);
      }
    } catch (e) {
      errorMessage = "Error parsing chat completion config: " + e.message;
    }
  }

  // Use the existing comparison summary instead of re-processing raw search results
  let alignmentSummary = "";
  if (completionsClient && comparisonSummary.analysis) {
    // Use the already-generated comparison analysis to create a focused alignment summary
    const prompt = promptTemplate
      .replace(/\$\{userPrompt\}/g, userPrompt)
      .replace(/\$\{comparisonAnalysis\}/g, comparisonSummary.analysis);

    try {
      const completion = await completionsClient.chat.completions.create({
        model: parsedConfig.model || "gpt-4o",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: prompt }
        ],
        temperature: parsedConfig.temperature ?? 0.5,
        max_completion_tokens: parsedConfig.max_tokens ?? 400
      });
      alignmentSummary = completion.choices[0]?.message?.content?.trim() || "";
    } catch (e) {
      alignmentSummary = "Error generating alignment summary: " + e.message;
    }
  } else {
    alignmentSummary = "Alignment summary based on comparison analysis: The documents have been analyzed and compared as shown in the comparison table above.";
  }

  // Mark alignment complete
  progressResponse = progressResponse.replace("⏳ Aligning", "✓ Aligning");
  progressResponse += "⏳ Formatting final response...\n\n---\n";
  if (state.chatInteractionId) {
    await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
  }

  return {
    ...state,
    comparisonSummary, // Preserve the comparison summary from the previous node
    alignedResults: {
      alignedByTitle: [], // No longer needed since we have structured comparison
      alignmentSummary
    },
    progressResponse
  };
};
