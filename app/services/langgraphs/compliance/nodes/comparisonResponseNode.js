// comparisonResponseNode.js


export const comparisonResponseNode = async (state) => {
  const { updateChatInteractionProgress } = await import('../helpers/progressTracking');

  let progressResponse = state.progressResponse || "## Comparison Progress\n\n";
  progressResponse += "⏳ Formatting final response...\n\n---\n";

  // Update progress
  if (state.chatInteractionId) {
    await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
  }

  const { comparisonSummary = {}, alignedResults = {}, userPrompt, configDocuments } = state;
  let errorMessage = "";
  try {
    // Find the format config for comparison response
    const formatConfigs = configDocuments.filter(doc => doc.purpose === "FormatConfig" && doc.title === "Document Comparison Format Response").map(doc => doc.documentText);
    let formatConfig;
    if (formatConfigs.length === 1) {
      formatConfig = formatConfigs[0];
    } else {
      // Default formatConfig - simplified to use the combined comparison summary
      formatConfig = `## Document Comparison\n\n**Prompt:** ${'${userPrompt}'}\n\n**Comparison Analysis:**\n${'${comparisonAnalysis}'}\n\n**Alignment Summary:**\n${'${alignmentSummary}'}\n`;
    }

    // Replace template variables with state values - use the actual analysis from comparison
    const replacements = {
      userPrompt,
      comparisonAnalysis: comparisonSummary.analysis || "No comparison analysis available.",
      alignmentSummary: alignedResults.alignmentSummary || "No alignment summary available."
    };

    // Replace all ${var} in formatConfig with corresponding value
    let formattedResponse = formatConfig.replace(/\$\{(\w+)\}/g, (_, key) => replacements[key] !== undefined ? replacements[key] : '');

    // Mark formatting complete
    progressResponse = progressResponse.replace("⏳ Formatting", "✓ Formatting");
    if (state.chatInteractionId) {
      await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
    }

    return {
      ...state,
      comparisonResponse: formattedResponse,
      progressResponse
    };
  } catch (error) {
    console.error(errorMessage, error);
    progressResponse = progressResponse.replace("⏳", "❌");
    if (state.chatInteractionId) {
      await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
    }
    return {
      ...state,
      comparisonResponse: "Sorry, I couldn't format the comparison response due to an error.",
      progressResponse
    };
  }
};
