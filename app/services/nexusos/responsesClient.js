import { getClientCredentialsAuthToken } from "../auth/clientCredentialsAuthService.js";
import crypto from 'crypto';
import { addHashedNuidMapping } from "../userService.js";

// Cache for the ResponsesClient instance
let cachedResponsesClient = null;

// Function to get or create a cached CompletionsClient instance
async function getResponsesClient() {
  if (!cachedResponsesClient) {
    cachedResponsesClient = new ResponsesClient();
  }
  return cachedResponsesClient;
}

class ResponsesClient {
  constructor() {
    this.envName = process.env.envName || 'dev';
    this.apigeeDomain = process.env[`host.${this.envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.CC.apigeeDomain`] || '';
    this.defaultModel = process.env[`kp.nexusos.org.defaultModel`] || "gpt-4o-APP-7232";
    this.defaultTemperature = 0.7;
    this.defaultMaxTokens = 1000;
    // Create the chat API object
    this.chat = {
      responses: {
        create: this.createChatResponse.bind(this)
      }
    };
  }

  async createChatResponse(params) {
    try {
      const { messages, tools, model, temperature, max_tokens, user, event, sessionId, teamName, assistantName } = params;
      const authToken = await getClientCredentialsAuthToken();
      const teamAssistant = teamName && assistantName ? `${teamName}:${assistantName}` : null;
      const userHash = crypto.createHash('sha256').update(user || "ai_portal_user").digest('hex');

      const headers = {
        "Authorization": `Bearer ${authToken}`,
        "ESB-OAuth": `Bearer ${authToken}`,
        "Content-Type": "application/json",
        "x-user-id": userHash,
        "x-session-id": sessionId || "na",
        "x-host-system": "HPAIS",
        "x-ip-address": "10.0.0.1",
        "X-App-Version": "litellm",
        // "x-nuid": "sample_client_id",
        "x-app-id": "APP7232",
        "x-agent-id": teamAssistant || "agent_ai_portal",
        "x-event": event,
        // "x-step": "step-1",
      };

      const body = {
        model: this.defaultModel,
        input: messages,
        ...(Array.isArray(tools) && tools.length > 0 ? { tools } : {}),
        temperature: temperature || this.defaultTemperature,
        max_completion_tokens: max_tokens || this.defaultMaxTokens
      };

      console.log(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'ResponsesClient.createChatResponse', requestBody: { body } } }));

      const response = await fetch(`${this.apigeeDomain}/api/itops/siae/kpaigateway/v1r/responses`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 422) {
          throw new Error(`Unprocessable Entity: ${JSON.stringify(errorData)}`);
        }
        throw new Error(`Failed to fetch chat completion: ${JSON.stringify(errorData)}`);
      }
      const data = await response.json();

      // Add a mapping for userid to mongo
      addHashedNuidMapping(user, userHash);
      console.log(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'ResponsesClient.createChatResponse', data: { data } } }));
      return data;
    } catch (error) {
      console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'ResponsesClient.createChatResponse', detail: { error: error.message } } }));
      throw error;
    }
  }
}

async function generateChatResponse({ messages, model, temperature, max_tokens, user, event, sessionId, teamName, assistantName, tools }) {
  const responsesClient = await getResponsesClient();
  return responsesClient.chat.responses.create({
    messages,
    model,
    temperature,
    max_tokens,
    user,
    event,
    sessionId,
    teamName,
    assistantName,
    tools
  });
}

export {
  ResponsesClient,
  getResponsesClient,
  generateChatResponse
};

