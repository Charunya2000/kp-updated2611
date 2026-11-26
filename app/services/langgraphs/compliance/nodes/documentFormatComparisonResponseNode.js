// documentFormatComparisonResponseNode.js

export const documentFormatComparisonResponseNode = async (state) => {
  const { updateChatInteractionProgress } = await import('../helpers/progressTracking');

  let progressResponse = state.progressResponse || "## Comparison Progress\n\n";
  const finalizingLabel = "⏳ Finalizing comparison response...";
  let progressMutated = false;

  if (!progressResponse.includes(finalizingLabel)) {
    progressResponse += `${finalizingLabel}\n\n---\n`;
    progressMutated = true;
  }

  if (progressMutated && state.chatInteractionId) {
    await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
  }

  const {
    comparisonMode,
    documentDifferences,
    downloadLink,
    userPrompt,
    fullDocumentA,
    fullDocumentB,
    comparisonResponse, // For topic mode
    configDocuments
  } = state;


  let errorMessage = "";

  try {
    // Handle document mode formatting
    if (comparisonMode === 'document') {

      // Find document comparison format config
      const formatConfigs = configDocuments.filter(doc =>
        doc.purpose === "DocumentFormatConfig" && doc.title === "Document Comparison Format Response"
      ).map(doc => doc.documentText);

      let formatConfig;
      if (formatConfigs.length === 1) {
        formatConfig = formatConfigs[0];
      } else {
        // Default format config for document comparison
        formatConfig = `# 📊 Document Comparison Analysis

**User Request:** ${'${userPrompt}'}

## 📋 Document Summary

**Document A:** ${'${documentATitle}'} (${'${documentASections}'} sections, ${'${documentALength}'} characters)
**Document B:** ${'${documentBTitle}'} (${'${documentBSections}'} sections, ${'${documentBLength}'} characters)

## 🔍 Comparison Results

${'${comparisonAnalysis}'}

## 📊 Statistical Overview

${'${statisticalSummary}'}

${'${downloadSection}'}

---
*Analysis completed at ${'${timestamp}'}*`;
      }

      // Prepare replacement variables
      const statisticalData = documentDifferences.structured?.statistics || {};
      const coverage = documentDifferences.structured?.coverage || {};

      const statisticalSummary = `
**Content Coverage Analysis:**
- Common sections: ${coverage.commonSections || 0}
- Sections unique to Document A: ${coverage.uniqueToA || 0}
- Sections unique to Document B: ${coverage.uniqueToB || 0}
- Content overlap: ${coverage.overlapPercentage || 0}%

**Document Structure:**
- Total structural differences identified: ${documentDifferences.structured?.structural?.length || 0}
`;

      const downloadSection = downloadLink ? `
## 📁 Download Detailed Analysis

Your comprehensive document comparison is available as a detailed Excel spreadsheet:

🔗 **[Download Document Comparison Spreadsheet](${downloadLink})**

The spreadsheet includes:
- Summary metrics and statistics
- Structural differences analysis  
- Side-by-side content comparison
- Complete AI analysis report

*Note: The download link provides direct access to your comparison results. The file will be available for download for 30 days.*
` : `
## ⚠️ Spreadsheet Generation

There was an issue generating the detailed spreadsheet. Please contact support if you need the detailed analysis file.
`;

      const replacements = {
        userPrompt: userPrompt || 'Document comparison request',
        documentATitle: fullDocumentA?.title || 'Document A',
        documentASections: fullDocumentA?.totalSections || 0,
        documentALength: fullDocumentA?.totalContentLength || 0,
        documentBTitle: fullDocumentB?.title || 'Document B',
        documentBSections: fullDocumentB?.totalSections || 0,
        documentBLength: fullDocumentB?.totalContentLength || 0,
        comparisonAnalysis: documentDifferences?.analysis || 'Comparison analysis not available.',
        statisticalSummary: statisticalSummary,
        downloadSection: downloadSection,
        timestamp: new Date().toLocaleString()
      };

      // Replace all ${var} in formatConfig with corresponding value
      let formattedResponse = formatConfig.replace(/\$\{(\w+)\}/g, (_, key) =>
        replacements[key] !== undefined ? replacements[key] : `[${key} not available]`
      );

      // Mark formatting complete and replace progress with final response
      progressResponse = progressResponse.replace("⏳ Finalizing", "✓ Comparison complete");
      if (state.chatInteractionId) {
        await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
      }

      return {
        ...state,
        formattedResponse,
        progressResponse
      };

    } else {
      // Topic mode - use existing formatting logic

      // Use the existing comparisonResponse or fall back to default
      const formattedResponse = comparisonResponse || "Topic-based comparison completed.";

      // Mark formatting complete
      progressResponse = progressResponse.replace("⏳ Finalizing", "✓ Comparison complete");
      if (state.chatInteractionId) {
        await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
      }

      return {
        ...state,
        formattedResponse,
        progressResponse
      };
    }

  } catch (error) {
    console.error(`❌ [documentFormatComparisonResponseNode] Formatting failed:`, error);
    errorMessage = `Response formatting error: ${error.message}`;
    progressResponse = progressResponse.replace("⏳", "❌");
    if (state.chatInteractionId) {
      await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
    }

    // Fallback response
    const fallbackResponse = comparisonMode === 'document'
      ? `# Document Comparison Results

**User Request:** ${userPrompt || 'Document comparison'}

## Analysis Summary
${documentDifferences?.analysis || 'Analysis not available due to formatting error.'}

${downloadLink ? `## Download Results\n🔗 [Download Detailed Spreadsheet](${downloadLink})` : ''}

*Note: There was an issue formatting the full response. ${errorMessage}*`
      : "Sorry, I couldn't format the comparison response due to an error.";

    return {
      ...state,
      formattedResponse: fallbackResponse,
      errorMessage,
      progressResponse
    };
  }
};