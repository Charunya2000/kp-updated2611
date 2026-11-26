import { getIndexConfigById } from "@services/aiSearchConfigService";

export const createMessagesFromDesignIndexes = async (designIndexes) => {
  const messages = [];
  let indexConfig, previousIndexName = '';
  for (const designIndexArray of designIndexes) {
    for (const result of designIndexArray) {
      // avoid unnecessary calls to getIndexByName if the index name hasn't changed
      if (previousIndexName !== designIndexArray.indexName) {
        previousIndexName = designIndexArray.indexName;
        indexConfig = await getIndexConfigById(designIndexArray.searchIndexConfigId, state.teamName);
      }

      try {
        let content = '';
        if (!indexConfig || !indexConfig.template) {
          // build a generic template
          content = Object.keys(result.document)
            .map(key => `${key}: ${result.document[key]}`)
            .join(', ');
        } else {
          const templateFunction = new Function(...Object.keys(result.document), `return \`${indexConfig.template}\`;`);
          content = templateFunction(...Object.values(result.document));
        }

        const message = {
          role: 'assistant',
          content: content
        };
        messages.push(message);
      } catch (error) {
        console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'createMessagesFromDesignIndexes', detail: { indexSettings: indexConfig, designIndexFields: result.document } } }));

        throw new Error(error.message);
      }
    }
  }
  return messages;
};