import { AzureOpenAI } from "openai";

let embeddingsClient = null;
let completionsClient = null;

function getEmbeddingsClient() {
  if (!embeddingsClient) {
    const envName = process.env['envName'];
    const embeddingsEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.embeddingsEndpoint`];
    const embeddingsAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.openai.api.key`];
    const embeddingsDeployment = "gpt-4o-aisvc";
    const embeddingsDeploymentAPIiVersion = "2023-05-15";
    embeddingsClient = new AzureOpenAI({
      apiVersion: embeddingsDeploymentAPIiVersion,
      endpoint: embeddingsEndpoint,
      apiKey: embeddingsAPIKey,
      deployment: embeddingsDeployment
    });
  }
  return embeddingsClient;
}

function getCompletionsClient() {
  if (!completionsClient) {
    const envName = process.env['envName'];
    const completionsEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.completionsEndpoint`];
    const completionsAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.openai.api.key`];
    const completionsDeployment = (envName === 'pp') ? 'gpt-4o' : 'gpt-4o-aisvc';
    const completionsDeploymentAPIiVersion = "2024-08-01-preview";
    completionsClient = new AzureOpenAI({
      apiVersion: completionsDeploymentAPIiVersion,
      endpoint: completionsEndpoint,
      apiKey: completionsAPIKey,
      deployment: completionsDeployment
    });
  }
  return completionsClient;
}

function testEmbeddingsClient(client) {
  return client.embeddings.create({
    input: "Test embedding",
    model: "text-embedding-ada-002"
  });
}

async function testCompletionsClient(client) {
  return client.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: "Test completion" }],
    max_tokens: 1
  });
}


export const validateClients = async () => {
  try {
    const embeddings = getEmbeddingsClient();
    await testEmbeddingsClient(embeddings);
    const completions = getCompletionsClient();
    await testCompletionsClient(completions);
  } catch (error) {
    console.error("Error validating embeddings and completions clients with error:", error);
    throw error;
  }
}
