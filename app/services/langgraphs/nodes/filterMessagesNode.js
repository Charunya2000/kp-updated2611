export const filterMessagesNode = async (state) => {

  const filteredMessages = state.filteredSearchResults.map(result => {
    const message = {
      role: 'assistant',
      content: `source category: ${result.document.smart_type}, content: ${result.document.content}`
    };
    return message;
  });
  return { filteredMessages };
}