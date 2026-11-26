'use server';
import { connectToDatabase } from '@/db/connection';

function buildDocumentsUsedFromSearchResults(searchResults, maxDocs = 8) {
  const cognitiveResults = Array.isArray(searchResults?.cognitiveResults)
    ? searchResults.cognitiveResults
    : [];

  if (cognitiveResults.length === 0) return [];

  const docsByName = new Map();

  for (const doc of cognitiveResults) {
    const fileName = String(doc?.smart_file_name || doc?.title || 'Untitled Document').trim();
    const page = Number(doc?.page);
    const key = fileName.toLowerCase();

    if (!docsByName.has(key)) {
      docsByName.set(key, {
        fileName,
        pages: new Set(),
      });
    }

    if (Number.isFinite(page) && page > 0) {
      docsByName.get(key).pages.add(page);
    }
  }

  return Array.from(docsByName.values())
    .slice(0, maxDocs)
    .map((item) => ({
      fileName: item.fileName,
      pages: Array.from(item.pages).sort((a, b) => a - b),
    }));
}

function buildDocumentsUsedSection(usedDocuments = []) {
  if (!Array.isArray(usedDocuments) || usedDocuments.length === 0) return '';

  const lines = usedDocuments.map((doc) => {
    const pageText = Array.isArray(doc.pages) && doc.pages.length > 0
      ? ` (pages: ${doc.pages.join(', ')})`
      : '';
    return `- ${doc.fileName}${pageText}`;
  });

  return `\n\n### Documents Used\n${lines.join('\n')}`;
}

export const formatResponseNode = async (state) => {
  let errorMessage = "";
  try {
    const { geisingerConversation, userPrompt, configDocuments, parsedIntent, conversationResponse, searchResults } = state;
    const topCognitiveResultId = searchResults?.topCognitiveResultId;
    // Retrieve topCognitiveResultId from cognitive search results
    let page, xPos, yPos;
    if (topCognitiveResultId && Array.isArray(searchResults?.cognitiveResults)) {
      const topDoc = searchResults.cognitiveResults.find(doc => doc.id === topCognitiveResultId);
      if (topDoc) {
        page = topDoc.page;
        xPos = topDoc.xPos;
        yPos = topDoc.yPos;
      }
    }

    // Build enhanced 
    let domain = 'sp-cloud.kp.org';
    if (process.env.USE_VAULT === 'true') {
      domain = 'geisinger.sharepoint.com';
    }

    const baseUrl = `https://${domain}${geisingerConversation.relativeAUrl}`;
    let url = encodeURI(baseUrl);
    // Add target parameter as query parameter FIRST
    url += '?target=_blank';

    if (page) {
      url += `#page=${page}`;
      // if (yPos !== undefined && yPos !== null) {
      //   url += `&view=FitH,${yPos}`;
      // }
      // Optionally add xPos if you want to support horizontal positioning
      // url += `&x=${xPos}`;
    }
    // Add _blank target info as a query param for client-side use
    geisingerConversation.url = url;

    const formatConfigs = configDocuments.filter(doc => doc.purpose === "FormatConfig" && doc.title === "Document Conversation Format Response").map(doc => doc.documentText);

    if (Number(formatConfigs.length) !== 1) {
      errorMessage = "Error: There should be exactly one 'Document Conversation Format Response' message in the config.";
      throw new Error(errorMessage);
    }

    const formatConfig = formatConfigs[0];

    // Check if any properties in formatConfig match those in parsedIntent
    const matchedIntentProps = Array.from(formatConfig.matchAll(/\$\{(\w+)\}/g)).map(m => m[1]).filter(prop => parsedIntent.hasOwnProperty(prop));
    let formattedMessage;
    if (matchedIntentProps.length === 0) {
      formattedMessage = formatConfig;
    } else {
      formattedMessage = formatConfig.replace(/\$\{(\w+)\}/g, (_, param) => {
        return parsedIntent[param] !== undefined ? parsedIntent[param] : '';
      });
    }

    const conversationResponseFormattedMessage = formattedMessage.replace(/\$\{conversationResponse\}/g, conversationResponse);
    const conversationResponseFormattedMessagePrompt = conversationResponseFormattedMessage.replace(/\$\{userPrompt\}/g, userPrompt);

    // Check if any props in formattedMessage match geisingerConversation
    const matchedProps = Array.from(conversationResponseFormattedMessagePrompt.matchAll(/\$\{(\w+)\}/g))
      .map(m => m[1])
      .filter(prop => geisingerConversation && geisingerConversation.hasOwnProperty(prop));
    let formattedMessageWithConversationProps = conversationResponseFormattedMessagePrompt;
    if (matchedProps.length > 0 && geisingerConversation) {
      formattedMessageWithConversationProps = conversationResponseFormattedMessagePrompt.replace(/\$\{(\w+)\}/g, (_, prop) => {
        return geisingerConversation.hasOwnProperty(prop) ? geisingerConversation[prop] : '';
      });
    }

    const usedDocuments = geisingerConversation?.allFilesInLob
      ? buildDocumentsUsedFromSearchResults(searchResults)
      : [];

    const documentsUsedSection = buildDocumentsUsedSection(usedDocuments);

    return {
      ...state,
      formattedResponse: `${formattedMessageWithConversationProps}${documentsUsedSection}`,
      usedDocuments,
    };

  } catch (error) {
    console.error(errorMessage, error);
    return {
      ...state,
      formattedResponse: "Sorry, I couldn't format the response due to an error."
    };
  }
}

