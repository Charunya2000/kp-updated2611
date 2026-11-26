'use server';

export const constructPlanNode = async (state) => {

  const { completionsClient, userPrompt, configDocuments, parsedIntent, intentSchema } = state;

  const userIntentDoc = configDocuments.find(doc => doc.purpose === "UserIntent" && doc.title === "User Doc Conversation Intent");
  const schema = userIntentDoc?.userIntent?.schema;
  if (!completionsClient) throw new Error('OpenAI completionsClient required');
  if (!schema) throw new Error('JSON schema missing from state');
  if (!userPrompt) throw new Error('userPrompt missing from state');

  // Build system prompt with schema
  const systemPrompt = `You are an expert assistant. Given a user prompt, generate a structured search plan for GeisingerConversation data.\nYour response must strictly follow this JSON schema:\n\n\u0060\u0060\u0060json\n${JSON.stringify(schema, null, 2)}\n\u0060\u0060\u0060`;

  // Compose messages
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  // Call GPT-4o
  const completion = await completionsClient.chat.completions.create({
    model: 'gpt-4o',
    messages,
    temperature: 0.7,
    max_completion_tokens: 1000,
    stream: false
  });

  const content = completion.choices[0]?.message?.content || '';

  // Extract JSON from response
  let plan;
  try {
    const jsonString = content.replace(/```json\s*([\s\S]*?)\s*```/, '$1').trim();
    plan = JSON.parse(jsonString);
  } catch (e) {
    console.error('Failed to parse plan JSON from GPT-4o response:', e, content);
    throw new Error('Plan construction failed: invalid JSON');
  }

  return {
    ...state,
    plan
  };
};
