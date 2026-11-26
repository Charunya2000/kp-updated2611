'use server';

const SUPPORTED_LOBS = ['Medicare', 'Medicaid', 'CHIP', 'Commercial', 'Marketplace', 'NCQA'];

function stripSharePointGuidance(text) {
  const lines = String(text || '')
    .split('\n')
    .filter((line) => {
      const lower = line.toLowerCase();
      return !(lower.includes('sharepoint') || lower.includes('shared documents') || lower.includes('sp-cloud.kp.org'));
    });

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function buildUnsupportedLobMessage() {
  return `I'm happy to answer questions related to the following lines of business: ${SUPPORTED_LOBS.join(', ')}.`;
}

export const formatResponseNode = async (state) => {

  let errorMessage = "";
  try {
    const { configDocuments, parsedIntent } = state;

    const formatConfigs = configDocuments.filter(doc => doc.purpose === "FormatConfig" && doc.title === "Initial User Intent Format Response").map(doc => doc.documentText);

    if (Number(formatConfigs.length) !== 1) {
      errorMessage = "Error: There should be exactly one 'Initial User Intent Format Response' message in the config.";
      throw new Error(errorMessage);
    }

    const formatConfig = formatConfigs[0];

    const hasSupportedLob = SUPPORTED_LOBS.some(
      (lob) => String(parsedIntent?.lob || '').toLowerCase() === lob.toLowerCase()
    );

    if (!hasSupportedLob) {
      return {
        ...state,
        formattedResponse: buildUnsupportedLobMessage()
      };
    }

    const formattedMessage = formatConfig.replace(/\$\{(\w+)\}/g, (_, param) => {
      return parsedIntent[param] !== undefined ? parsedIntent[param] : '';
    });

    const sanitizedResponse = stripSharePointGuidance(formattedMessage);

    return {
      ...state,
      formattedResponse: sanitizedResponse || parsedIntent?.markdownResponse || ''
    };

  } catch (error) {
    console.error(errorMessage, error);
    return {
      ...state,
      formattedResponse: "Sorry, I couldn't format the response due to an error."
    };
  }
}

