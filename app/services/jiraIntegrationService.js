'use server';

import { getServerSession } from '@utils/getSession';
import { selectSmartNote } from '@services/smartNoteService';
import { getUserAssistantsByNUID } from './userAssistantService';

const JIRA_BASE_URL = 'https://jira-aes.kp.org/rest/api/latest';
const envName = process.env['envName'];
const token = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.jira.api.key`];

const JIRA_API_TOKEN = `Bearer ${token}`;
const headers = {
  'Authorization': JIRA_API_TOKEN,
  'Content-Type': 'application/json'
}

const filters = {
  "hppdm-assistant": [{ filterName: "HPPDM_FILTER_01", filterId: 119709 }],
  "scheduletopay":
    [{ filterName: "WSTP_All_Epics", filterId: 136920 },
    { filterName: "WSTP2_Northwest_Accruals", filterId: 136906 },
    { filterName: "WSTP3_Northwest_Advanced_Scheduling", filterId: 136907 },
    { filterName: "WSTP4_Northwest_Attendance", filterId: 136908 },
    { filterName: "WSTP5_Northwest_Attestation", filterId: 136909 },
    { filterName: "WSTP6_Northwest_Basic_Scheduling", filterId: 136910 },
    { filterName: "WSTP7_Northwest_Devices", filterId: 136911 },
    { filterName: "WSTP8_Northwest_Display_And_Access", filterId: 136912 },
    { filterName: "WSTP9_Northwest_EZCall", filterId: 136913 },
    { filterName: "WSTP10_Northwest_Integrations", filterId: 136914 },
    { filterName: "WSTP11_Northwest_Leave", filterId: 136915 },
    { filterName: "WSTP12_Northwest_Leave", filterId: 136916 },
    { filterName: "WSTP13_Northwest_Reporting", filterId: 136917 },
    { filterName: "WSTP14_Northwest_Time_Off_Requests", filterId: 136918 },
    { filterName: "WSTP15_Northwest_Timekeeping", filterId: 136919 }]
}

const projects = {
  "marketing": [{ projectName: "KPXP" }],
  "mdw-assistant": [{ projectName: "Membership Data Warehouse" }],
}

const valueStreams = [
  { id: 1, name: 'VS-1 Customer Install and Maintenance' },
  { id: 2, name: 'VS-2 Enroll & Maintain Members' },
  { id: 3, name: 'VS-3 Member Billing and Finance' },
  { id: 4, name: 'VS-4 Member/Applicant Self Service' },
  { id: 5, name: 'VS-5 Reporting' },
  { id: 6, name: 'VS-6 Provide Membership Data to Downstream Customers (includes Data Warehouses)' },
  { id: 7, name: 'VS-7 Customer Service' },
  { id: 8, name: 'VS-8 Publish Service' },
  { id: 9, name: 'PR-9 Correspondence & Notifications' },
  { id: 10, name: 'PR-10 Medicare Member Management' }
];

// Field IDs for parent relationships - these might need adjustment based on your Jira instance
const PARENT_FIELDS = {
  EPIC_LINK: "customfield_10101", // Common Epic Link field ID
  PARENT: "parent",               // Standard parent field for sub-tasks
  FEATURE_PARENT: "customfield_10200" // Example - adjust to your actual feature parent field
};

async function getJiraFiltersByAssistant(smartNoteId, teamName) {
  const query = { type: 'SmartNote', parentId: { $exists: true }, id: smartNoteId };
  const smartNote = await selectSmartNote(query, teamName);
  const selectedUserAssistant = smartNote.selectedUserAssistant;
  const filtersByAssistant = filters[selectedUserAssistant] || [];
  return filtersByAssistant;
}

async function getJiraProjectsByAssistant() {
  const { nuid } = await getServerSession();
  const foo = await getUserAssistantsByNUID(nuid);
  const { assistants } = foo;
  const projectsByAssistant = assistants.reduce((acc, assistant) => {
    const project = projects[assistant.name];
    if (project) {
      acc.push(...project.map(p => ({ assistant: assistant.name, projectName: p.projectName })));
    }
    return acc;
  }, []);
  return projectsByAssistant;
}

async function getJiraIssuesByFilterId(filterId, startAt, maxResults) {

  const jql = `filter = "${filterId}"`;
  return await getJiraIssues(jql, startAt, maxResults)
}

async function getJiraIssuesByJQL(Jql, startAt, maxResults) {
  const jql = `${Jql}`; // Use the provided JQL directly
  if (jql.includes('currentUser()')) {
    const currentUserNUID = await currentUser();
    return await getJiraIssues(jql.replace('currentUser()', `"${currentUserNUID}"`), startAt, maxResults)
  }
  return await getJiraIssues(jql, startAt, maxResults)
}

// function for getCurrentUser for Jira Query --> assignee = currentUser() AND resolution = Unresolved order by updated DESC

const currentUser = async () => {
  const { nuid } = await getServerSession();
  return nuid;
}

// Helper function to increase reusability

const getJiraIssues = async (jql, startAt, maxResults) => {
  const body = {
    jql: jql,
    fields: ["summary", "description", "status", "issuetype", "customfield_10332"],
    startAt: startAt,
    maxResults: maxResults
  };

  const response = await fetch(`${JIRA_BASE_URL}/search`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body),
  });

  const data = await response.json();

  const { issues, total, startAt: returnedStartAt, maxResults: returnedMaxResults } = data;

  const pageIssues = issues.map(issue => {
    const { key, fields } = issue;
    const { summary, description, status, customfield_10332: acceptanceCriteria, issuetype } = fields;
    const result = {
      key,
      summary,
      description,
      status: status.name,
      issueType: issuetype.name,
      acceptanceCriteria
    };
    return result;
  });

  return { issues: pageIssues, total, startAt: returnedStartAt, maxResults: returnedMaxResults };
}

// Helper to get field ID or fallback
function getFieldId(fieldsData, names, fallback) {
  const field = fieldsData.find(f => names.includes(f.name));
  return field ? field.id : fallback;
}

async function getJiraIssuesByProjectName(projectName, filterKey, filterText, alignmentString, startAt, maxResults) {
  // Build JQL with filters
  const keyClause = isEmptyOrNull(filterKey) ? '' : ` and key = ${filterKey}`;
  const descriptionClause = isEmptyOrNull(filterText) ? '' : ` and description ~ "${filterText}"`;
  const issuetypeClause = alignmentString ? ` and issuetype in (${alignmentString})` : '';
  const jql = `project = "${projectName}"${keyClause}${descriptionClause}${issuetypeClause}`;

  // Fetch field metadata
  const fieldsResponse = await fetch(`${JIRA_BASE_URL}/field`, { method: 'GET', headers });
  const fieldsData = await fieldsResponse.json();

  // Map of field names to fallback IDs
  const customFields = {
    acceptanceCriteria: { names: ["Acceptance Criteria", "acceptance criteria"], fallback: "customfield_10016" },
    epicName: { names: ["Epic Name", "epic name"], fallback: "customfield_10103" },
    // epicLink: { names: ["Epic Link", "epic link"], fallback: "customfield_10101" },
    fixVersions: { names: ["Fix Version/s", "fix version/s"], fallback: "fixVersions" },
    storyPoints: { names: ["Story Points", "story points"], fallback: "customfield_10107" },
    assignee: { names: ["Assignee", "assignee"], fallback: "assignee" },
    reporter: { names: ["Reporter", "reporter"], fallback: "reporter" }
  };

  // Build fields array
  const fields = ["summary", "description", "status", "issuetype"];
  Object.values(customFields).forEach(({ names, fallback }) => {
    fields.push(getFieldId(fieldsData, names, fallback));
  });

  // Fetch issues
  const body = { jql, fields, startAt, maxResults };
  const response = await fetch(`${JIRA_BASE_URL}/search`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body),
  });
  const data = await response.json();
  const { issues, total, startAt: returnedStartAt, maxResults: returnedMaxResults } = data;

  // Get field IDs for mapping
  const fieldIds = {};
  for (const [key, { names, fallback }] of Object.entries(customFields)) {
    fieldIds[key] = getFieldId(fieldsData, names, fallback);
  }

  // Map issues to your output format
  const pageIssues = issues.map(issue => {
    const { key, fields } = issue;
    return {
      key,
      summary: fields.summary,
      description: fields.description,
      acceptanceCriteria: fields[fieldIds.acceptanceCriteria] || null,
      status: fields.status?.name,
      issueType: fields.issuetype?.name,
      epicName: fields[fieldIds.epicName] || null, // epicName only exist on Epics not stories; refer to Epic Link
      // epicLink: fields[fieldIds.epicLink] || null, // Uncomment if you want to include Epic Link
      fixVersions: Array.isArray(fields[fieldIds.fixVersions]) ? fields[fieldIds.fixVersions].map(v => v.name) : [],
      storyPoints: fields[fieldIds.storyPoints] || null,
      assigneeName: fields[fieldIds.assignee]?.displayName,
      assigneeEmail: fields[fieldIds.assignee]?.emailAddress,
      assigneeNUID: fields[fieldIds.assignee]?.name, // name is the NUID from metadata
      reporterName: fields[fieldIds.reporter]?.displayName,
      reporterEmail: fields[fieldIds.reporter]?.emailAddress,
      reporterNUID: fields[fieldIds.reporter]?.name // name is the NUID from metadata
    };
  });

  return { issues: pageIssues, total, startAt: returnedStartAt, maxResults: returnedMaxResults };
}

async function getValueStreams() {
  return valueStreams;
}

function getValueStreamNameById(id) {
  const numericId = Number(id); // Convert id to a number
  const valueStream = valueStreams.find(stream => stream.id === numericId);
  return valueStream ? valueStream.name : null;
}

function isEmptyOrNull(str) {
  return !str || str.trim() === '';
}

/*
 * How to find JQL field names from Jira UI:
 * 1. Go to Issues > Search for Issues
 * 2. Use the basic filters (project, status, etc.)
 * 3. Click "Advanced" to see the generated JQL
 * 4. The field names appear on the left side of operators (=, ~, etc.)
 * 
 * For custom fields, they often appear as "cf[12345]" in the URL
 * but may show with readable names in the Advanced JQL view
 */

async function getJiraIssuesByValueStream(valueStreamId, filterKey, filterText, alignmentString, startAt, maxResults) {
  try {
    const valueStream = getValueStreamNameById(valueStreamId);
    const keyClause = isEmptyOrNull(filterKey) ? '' : 'and key = ' + filterKey;
    const descriptionClause = isEmptyOrNull(filterText) ? '' : 'and description ~ ' + filterText;
    const jql = `"Value Stream" = "${valueStream}" ${keyClause} ${descriptionClause} and issuetype in (${alignmentString})`;

    // First, let's get the field mapping from Jira
    const fieldsResponse = await fetch(`${JIRA_BASE_URL}/field`, {
      method: 'GET',
      headers: headers
    });

    const fieldsData = await fieldsResponse.json();

    // Find the Acceptance Criteria field in the response
    const acceptanceCriteriaField = fieldsData.find(field =>
      field.name === "Acceptance Criteria" || field.name === "acceptance criteria"
    );

    // Now we can use the correct field ID in our request
    const body = {
      jql: jql,
      fields: ["summary", "description", "status", "issuetype"],
      startAt: startAt,
      maxResults: maxResults
    };

    // If we found the field ID, add it to the fields array
    if (acceptanceCriteriaField) {
      body.fields.push(acceptanceCriteriaField.id);
    } else {
      // Fallback to trying common patterns
      body.fields.push("customfield_10016"); // Example - you might need to adjust this
    }

    const response = await fetch(`${JIRA_BASE_URL}/search`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (response.status !== 200 || !data.issues) {
      if (data.errorMessages && data.errorMessages.length > 0) {
        console.log(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'getJiraIssuesByValueStream', detail: data.errorMessages } }));
      }
      return [];
    }

    const { issues, total, startAt: returnedStartAt, maxResults: returnedMaxResults } = data;

    const pageIssues = issues.map(issue => {
      const { key, fields } = issue;
      const { summary, description, status, issuetype } = fields;

      // Use the field ID we found earlier
      let acceptanceCriteria = null;
      if (acceptanceCriteriaField) {
        acceptanceCriteria = fields[acceptanceCriteriaField.id];
      } else {
        // Fallback logic
        acceptanceCriteria = fields["customfield_10016"] || null;
      }

      return {
        key,
        summary,
        description,
        acceptanceCriteria,
        status: status.name,
        issueType: issuetype.name
      };
    });

    return { issues: pageIssues, total, startAt: returnedStartAt, maxResults: returnedMaxResults };
  } catch (error) {
    console.log(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'getJiraIssuesByValueStream', detail: error } }));
  }

  return [];
}

/**
 * Get parent issue(s) for a specific issue
 * @param {string} issueKey - The Jira issue key (e.g., "ABC-123")
 * @returns {Promise<Object>} - Object containing different types of parents
 */
async function getIssueParents(issueKey) {
  try {
    // First get the issue with relevant fields
    const response = await fetch(`${JIRA_BASE_URL}/issue/${issueKey}?fields=parent,${PARENT_FIELDS.EPIC_LINK},issuelinks`, {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      throw new Error(`Failed to get issue: ${response.status}`);
    }

    const data = await response.json();
    const result = {
      issueKey,
      parentSubtask: null,
      epicParent: null,
      featureParent: null,
      linkedParents: []
    };

    // Check for subtask parent
    if (data.fields.parent) {
      result.parentSubtask = {
        key: data.fields.parent.key,
        summary: data.fields.parent.fields?.summary,
        issueType: data.fields.parent.fields?.issuetype?.name
      };
    }

    // Check for Epic Link
    if (data.fields[PARENT_FIELDS.EPIC_LINK]) {
      // Epic link is just the key, so we need to fetch epic details
      const epicKey = data.fields[PARENT_FIELDS.EPIC_LINK];
      result.epicParent = await getBasicIssueInfo(epicKey);
    }

    // Check for Feature parent (if using custom field)
    if (data.fields[PARENT_FIELDS.FEATURE_PARENT]) {
      const featureKey = data.fields[PARENT_FIELDS.FEATURE_PARENT];
      result.featureParent = await getBasicIssueInfo(featureKey);
    }

    // Check for linked issues that might be parents
    if (data.fields.issuelinks) {
      for (const link of data.fields.issuelinks) {
        // Look for inward links of types that indicate parent relationship
        // Common link types: "is part of", "is child of", etc.
        if (link.type.inward.includes("is part of") ||
          link.type.inward.includes("child") ||
          link.type.inward.includes("subtask")) {
          if (link.inwardIssue) {
            result.linkedParents.push({
              key: link.inwardIssue.key,
              summary: link.inwardIssue.fields?.summary,
              issueType: link.inwardIssue.fields?.issuetype?.name,
              relationship: link.type.inward
            });
          }
        }
      }
    }

    return result;
  } catch (error) {
    console.error("Error getting issue parents:", error);
    throw error;
  }
}

/**
 * Get basic info about an issue
 * @param {string} issueKey - The Jira issue key
 * @returns {Promise<Object>} - Basic issue info
 */
async function getBasicIssueInfo(issueKey) {
  try {
    const response = await fetch(`${JIRA_BASE_URL}/issue/${issueKey}?fields=summary,issuetype`, {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      return { key: issueKey, error: `Failed to fetch: ${response.status}` };
    }

    const data = await response.json();
    return {
      key: issueKey,
      summary: data.fields?.summary,
      issueType: data.fields?.issuetype?.name
    };
  } catch (error) {
    console.error(`Error fetching issue ${issueKey}:`, error);
    return { key: issueKey, error: error.message };
  }
}

export {
  getJiraIssuesByJQL,
  getValueStreams,
  getJiraFiltersByAssistant,
  getJiraProjectsByAssistant,
  getJiraIssuesByFilterId,
  getJiraIssuesByValueStream,
  getJiraIssuesByProjectName,
  getIssueParents  // Export the new function
};