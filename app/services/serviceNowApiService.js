import { getSNOWClientCredentialsAuthToken, getSNOWClientToken } from "./auth/clientCredentialsAuthService";

export async function getIncidentData(incidentNumber) {
  const authToken = await getSNOWClientCredentialsAuthToken();
  const snowToken = await getSNOWClientToken();
  const envName = process.env.envName || 'dev';
  const snowEndpoint = `https://api-gtwy-uat.kp.org/api/itbio/siae/servicenowtableapifam/v1/incident`; // TODO: update with actual endpoint per env

  // sysparm_display_value=true          <-- to get display values instead of sys_ids
  // sysparm_exclude_reference_link=true <-- to exclude reference links in the response
  const params = new URLSearchParams({
    number: incidentNumber,
    sysparm_display_value: 'true',
    sysparm_exclude_reference_link: 'true'
  });

  const response = await fetch(`${snowEndpoint}?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${snowToken}`,
      'ESB-OAUTH': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to fetch incident data: ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return data;
}

export async function createIncident(incidentPayload) {
  const authToken = await getSNOWClientCredentialsAuthToken();
  const snowToken = await getSNOWClientToken();
  const envName = process.env.envName || 'dev';
  const snowEndpoint = `https://api-gtwy-uat.kp.org/api/itbio/siae/servicenowgenericapi/v1/api_create_transaction`; // TODO: update with actual endpoint per env

  const payload = mapIncidentPayload(incidentPayload);

  const response = await fetch(snowEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${snowToken}`,
      'ESB-OAUTH': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to fetch incident data: ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return data;
}

function mapIncidentPayload(incidentPayload) {
  const payload = {
    domain: "incident",
    intent: "create_incident",
    u_requested_for: incidentPayload.requestedFor || "C597732",
    category: incidentPayload.category,
    cmdb_ci: incidentPayload.configurationItem,
    short_description: incidentPayload.shortDescription,
  };

  const optionalFieldsMap = {
    environment: 'u_environment',
    impact: 'impact',
    urgency: 'urgency',
    vendorReference: 'u_vendor_reference',
    subcategory: 'subcategory',
    assignmentGroup: 'assignment_group',
    workNotes: 'work_notes',
    comments: 'comments'
  };

  Object.entries(optionalFieldsMap).forEach(([key, mappedKey]) => {
    if (incidentPayload[key]) {
      payload[mappedKey] = incidentPayload[key];
    }
  });

  return payload;
}

// sampleIncidentPayload
// {
//   "domain": "incident",
//   "intent": "create_incident",
//   "u_requested_for": "C597732",
//   "category": "error",
//   "cmdb_ci": "3dc1ab1bdbce5344d99bd206ca9619cf",
//   "short_description": "Test for ALM API Create Incident API",
//   "u_environment": "development",
//   "impact": "5",
//   "urgency": "3",
//   "u_vendor_referenc e": "test123",
//   "subcategory": "batch",
//   "assignment_group": "",
//   "work_notes": "test work notes",
//   "comments": "test comment"
// };