// formatComparisonResponseNode.js

export const formatComparisonResponseNode = async (state) => {
  const { comparisonResponse, configDocuments } = state;
  let errorMessage = "";
  try {
    // Find the final format config for output
    const formatConfigs = configDocuments.filter(doc => doc.purpose === "FormatConfig" && doc.title === "Document Comparison Final Format Output").map(doc => doc.documentText);
    let formattedResponse = comparisonResponse;
    if (formatConfigs.length === 1) {
      // Replace ${comparisonResponse} in template with actual response
      formattedResponse = formatConfigs[0].replace(/\$\{comparisonResponse\}/g, comparisonResponse);
    }
    return {
      ...state,
      formattedResponse
    };
  } catch (error) {
    console.error(errorMessage, error);
    return {
      ...state,
      formattedResponse: comparisonResponse || "Sorry, I couldn't format the response due to an error."
    };
  }
};
