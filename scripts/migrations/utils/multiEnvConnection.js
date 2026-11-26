import { MongoClient } from 'mongodb';
import { loadEnvLocal } from '../../../utils/envLoader.js';
import { setProcessEnvironment } from '../../configActions.js';

// Cache connections by environment + database name
const connectionCache = new Map();

export async function connectToEnvironmentDatabase(environment, databaseName) {
  const cacheKey = `${environment}:${databaseName}`;

  if (connectionCache.has(cacheKey)) {
    return connectionCache.get(cacheKey);
  }

  // Load environment-specific configuration
  const envConfig = await getEnvironmentConfig(environment);

  const client = new MongoClient(envConfig.mongoUri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    // Migration-specific options
    maxIdleTimeMS: 30000,
  });

  await client.connect();
  const database = client.db(databaseName);

  connectionCache.set(cacheKey, database);
  return database;
}

async function getEnvironmentConfig(environment) {
  // Load the appropriate env profile
  loadEnvLocal();
  process.env.KPCONFIG_PROFILE = `genai-port-client-${environment}`;

  await setProcessEnvironment();

  return {
    mongoUri: process.env[`host.${environment}-aiportal-web-2.aisvc.aksnp.azure.kp.org.mongodb.endpoint`],
    // Add other environment-specific configs
  };
}

export async function closeMigrationConnections() {
  // Helper to clean up all migration connections
  for (const [key, db] of connectionCache.entries()) {
    await db.client.close();
  }
  connectionCache.clear();
}