'use server';

import { AzureOpenAI } from "openai";
import { getFeatureFlag } from "./featureFlagService";
import { vectorize as vectorizeWithNexusOs } from "./nexusos/embeddingClient.js";

let embeddingsClient = null;

// Simple in-memory cache for feature flags
const featureFlagCache = {};
const FEATURE_FLAG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in ms

async function getFeatureFlagCached(flagName) {
  const now = Date.now();
  const cached = featureFlagCache[flagName];
  if (cached && (now - cached.timestamp < FEATURE_FLAG_CACHE_TTL)) {
    return cached.value;
  }
  const value = await getFeatureFlag(flagName);
  if (!value || !value.enabled) {
    console.log(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'vectorize', detail: { action: 'Using NexusOS for vectorization', message: 'Feature flag use-hpais-azure-instance-embeddings is not configured, or is disabled' } } }));
  }
  featureFlagCache[flagName] = { value, timestamp: now };
  return value;
}

function getHpaisEmbeddingsClient() {
  if (!embeddingsClient) {
    const envName = process.env['envName'];
    const embeddingsEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.embeddingsEndpoint`];
    const embeddingsAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.openai.api.key`];
    const embeddingsDeployment = "gpt-4o-aisvc";
    const embeddingsDeploymentAPIVersion = "2023-05-15";
    embeddingsClient = new AzureOpenAI({
      apiVersion: embeddingsDeploymentAPIVersion,
      endpoint: embeddingsEndpoint,
      apiKey: embeddingsAPIKey,
      deployment: embeddingsDeployment
    });
  }
  return embeddingsClient;
}

async function vectorize({ nuid, content }) {
  try {
    const featureFlag = await getFeatureFlagCached('use-hpais-azure-instance-embeddings');
    if (!featureFlag || !featureFlag.enabled) {
      return vectorizeWithNexusOs({ nuid, content });
    }

    embeddingsClient = getHpaisEmbeddingsClient();
    const { data: [{ embedding }] } = await embeddingsClient.embeddings.create(
      {
        input: content,
        model: "text-embedding-ada-002",
        user: nuid,
      }
    );
    return embedding;
  } catch (error) {
    console.error('Error creating embedding:', error);
    throw error;
  }
}

export {
  vectorize
}