import { getServerSession } from "@/utils/getSession";
import { SearchClient, AzureKeyCredential } from "@azure/search-documents";
import { updateJob } from "@/app/services/backgroundJobService";
import { jobStatus } from "@/utils/constants";
import { vectorize } from "@/app/services/vectorizeDataService";
let indexName = "nps-incident-001"
//if (process.env['envName']=='dev'){indexName="bcs-incident-001"}

const INCIDENT_INDEX_NAME = indexName;

export async function getValidatedIncidents(fileContent, requiredFields) {
  let incidents = null;

  const validationResults = {
    isValid: true,
    message: '',
    missingProperties: [],
    incidents: null
  }

  if (!isAdmin) {
    validationResults.isValid = false;
    validationResults.message = 'User does not have permission to perform this action.';
    return validationResults;
  }


  // validate content
  try {
    incidents = JSON.parse(fileContent);
    for (let i = 0; i < incidents.length; i++) {
      const keys = Object.keys(incidents[i]);
      const missing = requiredFields.filter(prop => !keys.includes(prop));
      if (missing.length > 0) {
        validationResults.isValid = false;
        validationResults.missingProperties.push({ index: i, fields: missing });
        validationResults.message = 'Missing required properties';
      }
    }
  } catch (error) {
    console.error('Validation error:', error);
    validationResults.isValid = false;
    validationResults.message = 'Invalid JSON format: ' + error.message;
    return validationResults;
  }

  validationResults.incidents = incidents;
  return validationResults;
}

export async function uploadIncidentsToIndex(incidents, teamName, jobId) {
  try {
    if (incidents) {
      const transformed = await transformIncidentsForIndex(incidents, teamName, jobId);
      const indexClient = getSearchClients();

      // Upload documents in batches
      const batchSize = 100;
      for (let i = 0; i < transformed.length; i += batchSize) {
        const batch = transformed.slice(i, i + batchSize);
        console.log(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'uploadIncidentsToIndex', detail: { action: 'batchUpload', index: INCIDENT_INDEX_NAME, batchSize: batch.length } } }));
        await indexClient.uploadDocuments(batch);

        await updateJob(teamName, jobId, {
          status: jobStatus.INDEXING,
          current: Math.min(i + batch.length, transformed.length),
        });
      }
    } else {
      throw new Error('No incidents to upload');
    }
  } catch (error) {
    console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'uploadIncidentsToIndex', detail: { error: error.message } } }));
    throw new Error(`Failed to upload incidents: ${error.message}`);
  }
}

function getSearchClients() {
  const envName = process.env['envName'];
  const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
  const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.api.key`];

  return new SearchClient(searchEndpoint, INCIDENT_INDEX_NAME, new AzureKeyCredential(searchAPIKey));
}

async function transformIncidentsForIndex(incidents, teamName, jobId) {
  const { nuid } = await getServerSession();
  const results = [];

  for (let idx = 0; idx < incidents.length; idx++) {
    const inc = incidents[idx];
    if (inc.number && inc.short_description) {
      const fullText = JSON.stringify(inc);
      const embedding = await vectorize({ nuid: nuid, content: fullText });

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

      // every 10% of progress, log status
      const progressInterval = Math.floor(incidents.length / 10);
      if (progressInterval > 0 && (idx + 1) % progressInterval === 0) {
        updateJob(teamName, jobId, {
          status: jobStatus.PROCESSING,
          current: Math.min(idx + 1, incidents.length),
        });
      }
    }
  }
  return results;
}

function toIso8601(dateStr) {
  if (!dateStr) return null;
  // If already ISO, return as is
  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/.test(dateStr)) return dateStr;
  // Replace space with 'T' and append 'Z'
  return dateStr.replace(' ', 'T') + 'Z';
}