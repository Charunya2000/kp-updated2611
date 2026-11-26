// detectComparisonModeNode.js

export const detectComparisonModeNode = async (state) => {
  const { userPrompt } = state;

  // Default to topic mode
  let comparisonMode = 'topic';

  if (userPrompt && typeof userPrompt === 'string') {
    const prompt = userPrompt.toLowerCase();

    // Keywords that indicate full document comparison
    const documentModeKeywords = [
      'whole document',
      'entire document',
      'complete document',
      'full document',
      'all differences',
      'all the differences',
      'every difference',
      'comprehensive comparison',
      'complete comparison',
      'full comparison',
      'document comparison',
      'compare documents',
      'compare the documents',
      'compare both documents',
      'what are the differences',
      'what differences exist',
      'show all differences',
      'list all differences',
      'identify all differences',
      'find all differences',
      'document level',
      'overall differences',
      'structural differences',
      'content differences',
      'side by side',
      'side-by-side'
    ];

    // Check if any document mode keywords are present
    const isDocumentMode = documentModeKeywords.some(keyword =>
      prompt.includes(keyword)
    );

    if (isDocumentMode) {
      comparisonMode = 'document';
    }
  }

  return {
    ...state,
    comparisonMode
  };
};