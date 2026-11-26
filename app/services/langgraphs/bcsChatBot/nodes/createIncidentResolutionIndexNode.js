
// Node to create the "incident_resolution_index" in Azure Cognitive Search from Incident_BCS.json
import fs from 'fs';
import path from 'path';
import { AzureKeyCredential, SearchClient } from "@azure/search-documents";
import { setProcessEnvironment } from '../../../../../scripts/configActions.js';
import { AzureOpenAI } from "openai";
import { vectorize } from '@/app/services/vectorizeDataService';
import { getServerSession } from '@utils/getSession';
// import { loadEnvLocal } from '../../../../../utils/envLoader.js';
// Utility to convert 'YYYY-MM-DD HH:MM:SS' to 'YYYY-MM-DDTHH:MM:SSZ'
function toIso8601(dateStr) {
  if (!dateStr) return null;
  // If already ISO, return as is
  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/.test(dateStr)) return dateStr;
  // Replace space with 'T' and append 'Z'
  return dateStr.replace(' ', 'T') + 'Z';
}

const INCIDENT_INDEX_NAME = 'bcs-incident-001';

function getSearchClients() {
  const envName = process.env['envName'];
  const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
  const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.api.key`];

  return {
    indexClient: new SearchClient(searchEndpoint, INCIDENT_INDEX_NAME, new AzureKeyCredential(searchAPIKey)),
  };
}

function loadIncidentData() {
  const filePath = path.resolve(process.cwd(), 'C:/Users/A257371/Documents/development/tmp', 'Incident_BCS.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

async function vectorizeContent(text, embeddingsClient) {
  const { nuid } = await getServerSession();
  const embedding = await vectorize({
    nuid: nuid,
    content: text
  });
  return embedding;
}

async function transformIncidentsForIndex(incidents, embeddingsClient) {
  const results = [];
  for (let idx = 0; idx < incidents.length; idx++) {
    const inc = incidents[idx];
    if (inc.number && inc.short_description) {
      const fullText = JSON.stringify(inc);
      const embedding = await vectorizeContent(fullText, embeddingsClient);
      // Ensure resolved is ISO 8601 for Azure Cognitive Search
      // Handle empty or invalid resolved date
      if (inc.resolved && inc.resolved.trim() !== '') {
        inc.resolved = toIso8601(inc.resolved);
      } else {
        inc.resolved = null;
      }
      results.push({
        id: inc.number || `incident_${idx}`,
        number: inc.number,
        short_description: inc.short_description,
        priority: inc.priority,
        state: inc.state,
        assignment_group: inc.assignment_group,
        resolution_notes: inc.resolution_notes,
        resolved: inc.resolved,
        environment: inc.environment,
        description: inc.description,
        work_notes: inc.work_notes,
        source_name: inc.source_name,
        content: fullText,
        content_vector: embedding // vector field
      });
    }
  }
  return results;
}

export const createIncidentResolutionIndexNode = async (state) => {
  try {
    const { indexClient, indexMgmtClient } = getSearchClients();
    const incidents = loadIncidentData();

    // Setup Azure OpenAI embeddings client
    const envName = process.env['envName'];
    const embeddingsEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.embeddingsEndpoint`];
    const embeddingsAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.openai.api.key`];
    const embeddingsDeployment = "gpt-4o-aisvc";
    const embeddingsDeploymentAPIiVersion = "2023-05-15";
    const embeddingsClient = new AzureOpenAI({
      apiVersion: embeddingsDeploymentAPIiVersion,
      endpoint: embeddingsEndpoint,
      apiKey: embeddingsAPIKey,
      deployment: embeddingsDeployment
    });

    // Vectorize and transform incidents
    const transformed = await transformIncidentsForIndex(incidents, embeddingsClient);

    // Check if index exists
    let indexExists = false;
    for await (const idx of indexMgmtClient.listIndexes()) {
      if (idx.name === INCIDENT_INDEX_NAME) {
        indexExists = true;
        break;
      }
    }


    if (!indexExists) {
      // Create the index
      const indexDef = getIncidentIndexDefinition();
      await indexMgmtClient.createIndex(indexDef);
    }

    // Upload documents in batches
    const batchSize = 100;
    for (let i = 0; i < transformed.length; i += batchSize) {
      const batch = transformed.slice(i, i + batchSize);
      await indexClient.uploadDocuments(batch);
    }

    return {
      ...state,
      incidentResolutionIndexSuccess: true,
      incidentResolutionIndexCount: transformed.length
    };
  } catch (error) {
    console.error('Error creating incident_resolution_index:', error);
    return {
      ...state,
      incidentResolutionIndexError: error.message,
      incidentResolutionIndexSuccess: false
    };
  }
};

// CLI entry point for isolated execution
// Main method for isolated execution
const main = async () => {

  try {
    //loadEnvLocal();
    await setProcessEnvironment();

    // Dynamically import the JSON file
    const fsPromises = await import('fs/promises');
    const filePath = path.resolve(process.cwd(), 'C:/Users/A257371/Documents/development/tmp', 'Incident_BCS.json');
    const raw = await fsPromises.readFile(filePath, 'utf-8');
    const incidents = JSON.parse(raw);

    // Setup Azure OpenAI embeddings client
    const envName = process.env['envName'];
    const embeddingsEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.embeddingsEndpoint`];
    const embeddingsAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.openai.api.key`];
    const embeddingsDeployment = "gpt-4o-aisvc";
    const embeddingsDeploymentAPIiVersion = "2023-05-15";
    const embeddingsClient = new AzureOpenAI({
      apiVersion: embeddingsDeploymentAPIiVersion,
      endpoint: embeddingsEndpoint,
      apiKey: embeddingsAPIKey,
      deployment: embeddingsDeployment
    });

    const transformed = await transformIncidentsForIndex(incidents, embeddingsClient);
    const outPath = path.resolve(process.cwd(), 'C:/Users/A257371/Documents/development/tmp', 'Incident_BCS_transformed.json');
    await fsPromises.writeFile(outPath, JSON.stringify(transformed, null, 2), 'utf-8');
    const { indexClient } = getSearchClients();

    // Upload documents in batches
    const batchSize = 100;
    for (let i = 0; i < transformed.length; i += batchSize) {
      const batch = transformed.slice(i, i + batchSize);
      await indexClient.uploadDocuments(batch);
    }
    process.exit(0);
  } catch (err) {
    console.error("Error running createIncidentResolutionIndexNode in isolation:", err);
    process.exit(1);
  }
}


main().catch(err => {
  console.error('Error executing main function:', err);
  process.exit(1);
});

// ES module entry point
// if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
//   main();
// }
