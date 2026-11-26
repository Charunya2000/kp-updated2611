import { encodingForModel } from 'js-tiktoken';

// Count tokens in messages using tiktoken for gpt-4o model
export function countTokens(messages, model = 'gpt-4o') {
  let totalTokens = 0;

  try {
    messages.forEach(message => {
      let tokens = 0;
      if (typeof (message.content) === 'string') {
        tokens = encodingForModel(model).encode(message.content);
      } else if (Array.isArray(message.content)) {
        message.content.forEach(content => {
          if (content.type === 'text') {
            tokens = encodingForModel(model).encode(content.text)
          } else if (content.type === 'image_url') {
            tokens = encodingForModel(model).encode(content.image_url.url)
          }
        })
      }
      totalTokens += tokens.length;
    });
  } catch (error) {
    console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'countTokens', detail: { error: error.message } } }));
  }

  return totalTokens;
}
