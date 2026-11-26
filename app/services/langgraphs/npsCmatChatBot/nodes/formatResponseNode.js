
const MARKDOWN_TEMPLATES = {
  ERROR: `## Error\n\n{error}\n\n{contextSection}\n\nPlease try again or rephrase your question.`,
  RESPONSE: `{content}\n\n{suggestedPrompts}\n\n---\n
   
    \n\n*Generated at {timestamp}*`
};
/*


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
          .replace('{error}', 'No response generated from the assistant.'),

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