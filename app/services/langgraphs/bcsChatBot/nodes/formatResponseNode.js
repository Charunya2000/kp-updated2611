'use server';

/*
* MARKDOWN TEMPLATES
*/
// const MARKDOWN_TEMPLATES = {
//     ERROR: `## Error\n\n{error}\n\n{contextSection}\n\nPlease try again or rephrase your question.`,
//     RESPONSE: `{content}\n\n{suggestedPrompts}\n\n---\n
//     #### Query Summary\n{queryMetadata}\n\n#### Source Details\n{sourceMetadata}
//     \n\n*Generated at {timestamp}*`
// };
const MARKDOWN_TEMPLATES = {
  ERROR: `## Error\n\n{error}\n\n{contextSection}\n\nPlease try again or rephrase your question.`,
  RESPONSE: `{content}\n\n{suggestedPrompts}\n\n---\n
   
    \n\n*Generated at {timestamp}*`
};
/*
* QUERY METADATA FORMATTER
*/
function formatQueryMetadata(state) {
  const parts = [];

  // Identifiers
  if (state.identifiers && Object.keys(state.identifiers).length > 0) {
    const ids = Object.entries(state.identifiers)
      .filter(([_, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `**${k}:** ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('\n');
    if (ids) {
      parts.push(`**Extracted Identifiers:**\n${ids}`);
    }
  }

  // SQL Query
  if (state.databaseMetadata?.sqlQuery) {
    parts.push(`**SQL Query:**\n\`\`\`sql\n${state.databaseMetadata.sqlQuery}\n\`\`\``);
  }

  // Splunk Query
  if (state.splunkMetadata?.query) {
    parts.push(`**Splunk Query:**\nindex="${state.splunkMetadata.index || 'N/A'}" ${state.splunkMetadata.query}\n`);
  }

  // Knowledge Base Query (New/Updated)
  if (state.intent?.type === 'KNOWLEDGE_BASE') {
    let knowledgeIndexName = "nps-knowledge-001"

    const indexUsed = state.indexMetadata?.indexName || state.searchResults?.indexName || knowledgeIndexName;
    parts.push(`**Search Intent:** Knowledge Base Retrieval\n**Index Queried:** ${indexUsed}\n**Query Type:** Semantic/Vector Search`);
  }
  // AI Scorecard Query
  if (state.intent?.type === 'AI_SCORECARD') {
    const analytics = state.scorecardMetaData?.analytics;
    parts.push(`**Search Intent:** AI Scorecard Analysis\n**Data Source:** MongoDB NPS_SCORECARD Collection\n**Total Records Analyzed:** ${state.scorecardMetaData?.recordCount || 0}\n**Measured Functionalities:** ${analytics?.measuredCount || 0}\n**SLA Breached:** ${analytics?.slaBreachedCount || 0}\n**Within SLA:** ${analytics?.withinSLACount || 0}`);
  }
  return parts.join('\n\n') || 'No query metadata available.';
}

/*
* SOURCE METADATA FORMATTER
*/
function formatSourceMetadata(state) {
  const sources = [];

  // DB2
  if (state.databaseMetadata?.recordFound) {
    sources.push(`**IBM DB2 Database**\nRecords: ${state.databaseMetadata.recordCount ?? 'N/A'}\nQuery Type: ${state.databaseMetadata.queryType ?? 'general'}`);
  }

  // Splunk
  if (state.splunkMetadata?.recordFound) {
    sources.push(`**Splunk Logs**\nIndex: ${state.splunkMetadata.index ?? 'N/A'}\nLogs: ${state.splunkMetadata.logCount ?? 0}`);
  }

  // Azure Search (Updated to include File Name and Source Path)
  if (state.searchResults?.items?.length > 0) {
    const indexName = state.indexMetadata?.indexName || state.searchResults?.indexName || 'N/A';
    const resultCount = state.searchResults.items.length;

    // Extract unique file names and paths from the search results
    const fileDetails = state.searchResults.items.map(item => {
      const doc = item.document || {};
      return `- **File:** ${doc.file_name || 'Unknown'}\n  **Path:** ${doc.source_path || 'N/A'}`;
    });
    const uniqueFileDetails = [...new Set(fileDetails)].join('\n');

    sources.push(`**Azure Cognitive Search**\nIndex: ${indexName}\nResults: ${resultCount}\n**Referenced Documents:**\n${uniqueFileDetails}`);
  }

  // Knowledge Base (Metadata fallback)
  if (state.knowledgeBaseMetaData?.recordFound) {
    sources.push(`**Knowledge Base Retrieval**\nEntries Found: ${state.knowledgeBaseMetaData.recordCount ?? 0}\nTimestamp: ${state.knowledgeBaseMetaData.timestamp ?? 'N/A'}`);
  }

  // GitHub
  if (state.githubMetadata?.fileFound) {
    sources.push(`**GitHub**\nFile: ${state.githubMetadata.file?.name ?? 'N/A'}\nPath: ${state.githubMetadata.file?.path ?? 'N/A'}`);
  }

  if (sources.length === 0) {
    return 'No data sources were queried.';
  }

  return sources.join('\n\n');
}

/*
* SUGGESTED PROMPTS FORMATTER
*/
function formatSuggestedPrompts(prompts) {
  if (!Array.isArray(prompts) || prompts.length === 0) return '';
  return `### Suggested Follow-up Queries\n\n${prompts.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
}

/*
* TIMESTAMP FORMATTER
*/
function formatTimestamp(timestamp) {
  try {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  } catch (e) {
    return new Date().toISOString();
  }
}

/*
* MAIN NODE EXPORT
*/
export const formatResponseNode = async (state) => {
  try {
    const { chatResponse, chatSuccess } = state;

    if (!chatSuccess || !chatResponse?.content) {
      return {
        ...state,
        formattedResponse: MARKDOWN_TEMPLATES.ERROR
          .replace('{error}', 'No response generated from the assistant.')
          .replace('{contextSection}', formatSourceMetadata(state)),
        formatSuccess: false
      };
    }

    // Replace placeholders in the main response template
    const finalMarkdown = MARKDOWN_TEMPLATES.RESPONSE
      .replace('{content}', chatResponse.content)
      .replace('{suggestedPrompts}', formatSuggestedPrompts(chatResponse.suggestedPrompts))
      //   .replace('{queryMetadata}', formatQueryMetadata(state))
      //  .replace('{sourceMetadata}', formatSourceMetadata(state))
      .replace('{timestamp}', formatTimestamp(new Date()));
    let newResponseSummary = state?.chatNewResponseSummary || '';
    if (state.userContext == 'NEW') {

      newResponseSummary = state.chatResponse?.content;
    }

    return {
      ...state,
      formattedResponse: finalMarkdown,
      formatSuccess: true,
      promptSuccess: true,
      chatSuccess: true,
      chatNewResponseSummary: newResponseSummary
    };

  } catch (error) {
    console.error('Error in formatResponseNode:', error);
    return {
      ...state,
      formattedResponse: "A processing error occurred: " + error.message,
      formatSuccess: false
    };
  }
};