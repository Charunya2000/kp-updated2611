// 'use server';

// import { AzureOpenAI } from "openai";


// let completionsClient = null;

// function getCompletionsClient() {
//   if (!completionsClient) {
//     const envName = process.env['envName'];
//     const completionsEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.completionsEndpoint`];
//     const completionsAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.openai.api.key`];
//     const completionsDeployment = (envName === 'pp') ? 'gpt-4o' : 'gpt-4o-aisvc';
//     const completionsDeploymentAPIiVersion = "2024-08-01-preview";
//     completionsClient = new AzureOpenAI({
//       apiVersion: completionsDeploymentAPIiVersion,
//       endpoint: completionsEndpoint,
//       apiKey: completionsAPIKey,
//       deployment: completionsDeployment
//     });
//   }
//   return completionsClient;
// }

// function parseResponse(inputString) {
//   // Define the regular expression to match the pattern
//   const regex = /<wiki>(.*?)<\/wiki>\n\n(.*)/s;

//   // Execute the regular expression on the input string
//   const match = regex.exec(inputString);

//   if (!match) {
//     throw new Error(`Invalid input string format: ${inputString}`);
//   }

//   // Extract the response and prompts
//   let response = match[1].trim();
//   let suggestedPrompts = match[2].trim().split('\n').map(prompt => prompt.trim());

//   // Replace non-standard apostrophes with standard ASCII apostrophes
//   response = response.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");

//   // Trim off any leading characters for each suggestedPrompt line that isn't a character of [a-z] or [A-Z]
//   suggestedPrompts = suggestedPrompts.map(prompt => prompt.replace(/^[^a-zA-Z]+/, ''));

//   // Return the JSON object
//   return {
//     response,
//     suggestedPrompts
//   };
// }

// async function chatCompletionOne({ messages }) {
//   try {
//     const completionsClient = getCompletionsClient();
//     const completion = await completionsClient.chat.completions.create({
//       temperature: 0.7,
//       max_tokens: 1000,
//       model: "gpt-4o",
//       messages: messages
//     });
//     const { message: { content } } = completion.choices[0];
//     const contentObject = parseResponse(content);
//     return contentObject;
//   } catch (error) {
//     console.error('Error creating chat completion:', error);
//     return { "response": "Your request could not be processed. Please try again.", "suggestedPrompts": [] }
//   }
// }

// async function chatCompletion({ contextMessages, userMessages }) {
//   const chatCompletionsMessages = [
//     ...contextMessages,
//     ...userMessages
//   ];
//   return await chatCompletionOne({ messages: chatCompletionsMessages });
// }

// export {
//   chatCompletion,
//   chatCompletionOne,
//   parseResponse
// };