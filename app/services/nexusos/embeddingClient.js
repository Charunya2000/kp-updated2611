import { getClientCredentialsAuthToken } from "../auth/clientCredentialsAuthService.js";
import crypto from 'crypto';
import { addHashedNuidMapping } from "../userService.js";

// Cache for the EmbeddingsClient instance
let cachedEmbeddingsClient = null;

// Function to get or create a cached EmbeddingsClient instance
function getEmbeddingsClient(model) {
  if (!cachedEmbeddingsClient) {
    cachedEmbeddingsClient = new EmbeddingsClient(model);
  }
  return cachedEmbeddingsClient;
}

class EmbeddingsClient {
  constructor(model) {
    this.envName = process.env.envName || 'dev';
    this.apigeeDomain = process.env[`host.${this.envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.CC.apigeeDomain`] || '';
    this.defaultModel = model || "text-embedding-ada-002-APP-7232";

    // Create the embeddings API object
    this.embeddings = {
      create: this.createEmbedding.bind(this)
    };
  }

  async createEmbedding(params) {
    try {
      const { input, model, user, sessionId, event } = params;
      const modelToUse = this.defaultModel; // for now we only support text-embedding-ada-002-APP-7232 via NexusOS
      const userHash = crypto.createHash('sha256').update(user || "ai_portal_user").digest('hex');

      const authToken = await getClientCredentialsAuthToken();
      const requestBody = {
        model: modelToUse,
        input: input
      };

      const requestHeaders = {
        'Authorization': `Bearer ${authToken}`,
        'ESB-OAuth': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'envlbl': 'litellm',
        'x-user-id': userHash,
        "x-session-id": sessionId || "na",
        "x-host-system": "AI_Portal",
        "x-ip-address": "10.0.0.1",
        "x-event": event || "vectorize",
      };

      // Add user parameter if provided
      if (user) {
        requestBody.user = user;
      }

      const response = await fetch(`${this.apigeeDomain}/api/itops/siae/kpaigateway/v1r/embeddings`, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 422) {
          throw new Error(`Unprocessable Entity: ${JSON.stringify(errorData)}`, { cause: { statusCode: 422 } });
        }
        throw new Error(`Failed to fetch embedding: ${JSON.stringify(errorData)}`, { cause: { statusCode: response.status } });
      }

      const json = await response.json();

      // Add a mapping for userid to mongo
      addHashedNuidMapping(user, userHash);

      // Transform the response to match AzureOpenAI format
      return json;
    } catch (error) {
      console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'EmbeddingsClient.createEmbedding', detail: { error: error.message } } }));
      throw error;
    }
  }
}

// Function to vectorize content using the cached EmbeddingsClient
async function vectorize({ nuid, content, model, sessionId, event }) {
  try {
    const embeddingsClient = getEmbeddingsClient();
    const { data: [{ embedding }] } = await embeddingsClient.embeddings.create({
      input: content,
      model: model || "text-embedding-ada-002-APP-7232",
      user: nuid,
      sessionId: sessionId || "na",
      event: event || "vectorize"
    });
    return embedding;
  } catch (error) {
    console.error('Error creating embedding with Nexus OS:', error);
    throw error;
  }
}

export {
  EmbeddingsClient,
  getEmbeddingsClient,
  vectorize
};
