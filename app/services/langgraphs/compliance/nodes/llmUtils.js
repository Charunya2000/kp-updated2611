// llmUtils.js
// Shared LLM utility functions for both topic and document comparison

/**
 * Robust LLM completion with model/config fallback
 * @param {object} completionsClient - OpenAI client
 * @param {object} config - LLM config (model, temperature, etc.)
 * @param {Array} messages - OpenAI chat messages
 * @param {number} [maxTokensOverride] - Optional override for max tokens
 * @returns {Promise<string>} LLM response content
 */
export async function callCompletionWithFallback(completionsClient, config, messages, maxTokensOverride) {
  const models = Array.isArray(config.completion?.preferredModels) && config.completion.preferredModels.length > 0
    ? config.completion.preferredModels
    : [config.completion?.model || 'gpt-4o'];
  const maxTokens = Number(maxTokensOverride || config.completion?.maxTokens || 1200);
  let lastError = null;
  for (const model of models) {
    try {
      const completion = await completionsClient.chat.completions.create({
        model,
        messages,
        temperature: config.completion?.temperature ?? 0.2,
        max_completion_tokens: maxTokens
      });
      return completion?.choices?.[0]?.message?.content || '';
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('No completion response returned from fallback models.');
}

/**
 * Build a prompt for LLM difference assessment between two sections
 */
export function buildSectionDiffPrompt(sourceContent, targetContent) {
  return `Compare the following two sections for substantive differences. If they are equivalent, say so. Otherwise, summarize the key differences.\n\nSection A:\n${sourceContent}\n\nSection B:\n${targetContent}`;
}
