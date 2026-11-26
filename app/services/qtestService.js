'use server';

import { setProcessEnvironment } from '../../scripts/configActions.js';
import { loadEnvLocal } from '../../utils/envLoader.js';
import { connectToDatabase } from '../../db/connection.js';
import { v4 as uuidv4 } from 'uuid';

// import { writeFile, readFile } from 'fs/promises';
// import { v4 as uuidv4 } from 'uuid';
// import { vectorize } from './vectorizeDataService.js';
// import { insertVectorDataPlain } from './insertVectorDataService.js'

/*
// Retrieves all requirements using pagination.
export async function getQTRequirements2() {
  const bearerToken = `Bearer ${token}`;
  const size = 100; 
  let page = 1;
  let continueFetching = true;
  const allRequirements = [];

  while (continueFetching) {
    const url = `https://qtest.appl.kp.org/api/v3/projects/1045/requirements?size=${size}&page=${page}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': bearerToken,
          'Content-Type': 'application/json',
          'X-Token': token
        }
      });
      const data = await response.json();

      // Assume API returns an array of requirements.
      if (Array.isArray(data) && data.length > 0) {
        allRequirements.push(...data);
        page++;
      }
      // If “data” is not an array, check for a meta property
      else if (data && data.requirements && data.requirements.length > 0) {
        allRequirements.push(...data.requirements);
        page++;
      } else {
        continueFetching = false;
      }
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error);
      continueFetching = false;
    }
  }
  return allRequirements;
}


// and inserts the document into the existing Azure Search index.
export async function processRequirements(requirementsJson) {
  for (const req of requirementsJson) {
    // Use the top-level "pid" property (and fallback if necessary)
    const pid = req.pid ? req.pid.toString().trim() : '';
    // Use top-level "name"
    const name = req.name ? req.name.trim() : 'Unnamed Requirement';

    // Initialize defaults for Status, Priority, Type, and Description.
    let status = 'Unknown';
    let priority = 'Normal';
    let type = 'General';
    let description = '';

    // Iterate through the "properties" array to extract corresponding fields.
    if (req.properties && Array.isArray(req.properties)) {
      for (const prop of req.properties) {
        if (prop.field_name === 'Status') {
          status = prop.field_value_name ? prop.field_value_name.trim() : status;
        } else if (prop.field_name === 'Priority') {
          priority = prop.field_value_name ? prop.field_value_name.trim() : priority;
        } else if (prop.field_name === 'Type') {
          type = prop.field_value_name ? prop.field_value_name.trim() : type;
        } else if (prop.field_name === 'Description') {
          description = prop.field_value ? prop.field_value.trim() : '';
        }
      }
    }

    // Generate a new UUID for the document id.
    const id = uuidv4();

    // Use our lazy client from vectorizeDataService.js to vectorize the description.
    let description_vector = [];
    if (description !== '') {
      description_vector = await vectorize({ nuid: pid, content: description });
    }

    // Build the Azure Search document.
    const document = {
      id,              // New uuid
      pid,             // From "pid"
      name,            // From "name"
      status,          // Extracted from properties
      priority,        // Extracted from properties
      type,            // Extracted from properties
      description,     // Extracted from properties ("Description")
      description_vector
    };

    try {
      // Use our lazy client from insertVectorDataService.js to insert the document.
      // The insertVectorData function expects: { nuid, smartNoteId, id, smartNoteType, content, contentVector }.
      const insertResult = await insertVectorDataPlain('wstp-qtest-001', document);
      console.log(`Inserted document with id ${pid}:`);
    } catch (error) {
      console.error(`Error inserting document ${pid}:`, error);
    }
  }
}

const main = async () => {
  await setProcessEnvironment();
  const requirements = JSON.parse(await readFile('requirements.json', 'utf-8'));
  await processRequirements(requirements);
  console.log('All requirements processed.');
};

main().catch(err => {
  console.error('Error executing main function:', err);
  process.exit(1);
});
*/

// Returns the current environment name (defaults to 'dev')
const getQTestEnv = () => process.env.envName || 'dev';
// Builds the qTest API base URL from environment config
const getQTestUrl = () => process.env[`host.${getQTestEnv()}-aiportal-web-2.qtest.api.url`];
// Retrieves the qTest API bearer token from environment config
const getQTestToken = () => process.env[`host.${getQTestEnv()}-aiportal-web-2.qtest.api.token`];

// Retrieves all projects from qTest API
// GET {QTEST_URL}/api/v3/projects
export async function getAllProjects() {
  const bearerToken = `Bearer ${getQTestToken()}`; // Construct authorization header
  const url = `${getQTestUrl()}/projects`; // Build projects endpoint URL

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': bearerToken,
      'Content-Type': 'application/json',
    }
  });
  return await response.json(); // Return array of project objects
}

// Fetches modules at a specific level in the module tree
// GET {QTEST_URL}/api/v3/projects/{projectId}/modules                    → top-level modules
// GET {QTEST_URL}/api/v3/projects/{projectId}/modules?parentId={parentId} → child modules
async function fetchModulesAtLevel(projectId, parentId = null) {
  const bearerToken = `Bearer ${getQTestToken()}`; // Construct authorization header
  let url = `${getQTestUrl()}/projects/${projectId}/modules`; // Base modules endpoint
  if (parentId != null) {
    url += `?parentId=${parentId}`; // Append parentId to fetch children of a specific module
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': bearerToken,
        'Content-Type': 'application/json',
      }
    });
    const data = await response.json(); // Parse JSON response
    return Array.isArray(data) ? data : []; // Return array or empty array if invalid
  } catch (error) {
    console.error(`Error fetching modules for project ${projectId} (parentId=${parentId}):`, error.message);
    return []; // Return empty array on error
  }
}

// Recursively fetches all modules for a project by walking the tree structure
// Starts from root (no parentId), then fetches children for each module
// Stops when API returns an empty array (leaf node, no more children)
export async function fetchModulesForProject(projectId) {
  const allModules = []; // Accumulator for all modules across all levels

  // Recursive function to crawl module tree
  async function crawl(parentId, level) {
    const modules = await fetchModulesAtLevel(projectId, parentId); // Fetch modules at this level
    if (!modules || modules.length === 0) return; // Stop recursion: no children at this level

    for (const mod of modules) {
      allModules.push({ ...mod, _level: level }); // Store module with its depth level
      await crawl(mod.id, level + 1); // Recurse into this module's children
    }
  }

  await crawl(null, 1); // Start from root level (no parentId)
  return allModules; // Return flat array of all modules with _level metadata
}

// Fetches test cases for a specific module using GET API with skip/pageSize pagination
// GET {QTEST_URL}/api/v3/projects/{projectId}/test-cases?parentId={moduleId}&pageSize=200&skip={skip}
async function fetchTestCasesForModule(projectId, moduleId) {
  const bearerToken = `Bearer ${getQTestToken()}`; // Construct authorization header
  const pageSize = 200; // Number of test cases per page
  let skip = 0; // Offset for pagination
  const allTestCases = []; // Accumulator for all test cases in this module

  while (true) {
    // Build URL with module parentId and pagination params
    const url = `${getQTestUrl()}/projects/${projectId}/test-cases?parentId=${moduleId}&pageSize=${pageSize}&skip=${skip}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': bearerToken,
          'Content-Type': 'application/json',
        }
      });
      const data = await response.json(); // Parse JSON response
      const items = Array.isArray(data) ? data : []; // Ensure array format

      if (items.length === 0) break; // No more test cases, stop pagination

      allTestCases.push(...items); // Append this page's test cases

      if (items.length < pageSize) break; // Last page (fewer items than requested)
      skip += pageSize; // Move to next page
    } catch (error) {
      console.error(`Error fetching test cases for module ${moduleId} (skip=${skip}):`, error.message);
      break; // Stop pagination on error
    }
  }

  return allTestCases; // Return all test cases for this module
}

// Fetches full test case details (including test_steps) using POST search API in batches
// POST {QTEST_URL}/api/v3/projects/{projectId}/search
// Builds OR queries: "'id' = '123' OR 'id' = '456' ..." in groups of 50
async function fetchTestCaseDetailsBatch(projectId, testCaseIds) {
  const bearerToken = `Bearer ${getQTestToken()}`; // Construct authorization header
  const searchUrl = `${getQTestUrl()}/projects/${projectId}/search`; // Search endpoint
  const batchSize = 50; // Number of IDs per search query
  const allDetails = []; // Accumulator for full test case objects

  // Process IDs in batches of 50
  for (let i = 0; i < testCaseIds.length; i += batchSize) {
    const idBatch = testCaseIds.slice(i, i + batchSize); // Slice current batch of IDs
    // Build OR query: "'id' = '123' OR 'id' = '456' ..."
    const query = idBatch.map(id => `'id' = '${id}'`).join(' OR ');

    // Paginate through results for this batch query
    let page = 1;
    while (true) {
      try {
        const response = await fetch(searchUrl, {
          method: 'POST',
          headers: {
            'Authorization': bearerToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            "object_type": "test-cases",
            "fields": ["*"],               // Return all fields including test_steps
            "query": query,                // OR'd ID filter
            "page": page,
            "page_size": batchSize
          })
        });
        const data = await response.json(); // Parse search response

        if (!data?.items || data.items.length === 0) break; // No more results
        allDetails.push(...data.items); // Append results

        if (data.items.length < batchSize) break; // Last page
        page++;
      } catch (error) {
        console.error(`Error searching test cases batch (offset ${i}):`, error.message);
        break; // Skip this batch on error
      }
    }
  }

  return allDetails; // Return all full test case objects with test_steps
}

// Extracts flat fields from the qTest properties array
// Maps field_name → field_value or field_value_name based on the property type
function extractProperties(properties) {
  const props = {
    status: '',              // e.g., "Done"
    tcType: '',              // e.g., "Regression" (renamed to avoid conflict with document 'type')
    priority: '',            // e.g., "High"
    automation: '',          // e.g., "Yes"
    automationContent: '',   // e.g., "vve-bff-zoomapp.xml"
    automationDate: '',      // e.g., "2023-11-30T22:30:12+00:00"
    functionality: '',       // e.g., "Video Visit App - Setup"
    market: '',              // e.g., "" or "NCAL"
    shared: '',              // e.g., "false"
  };

  if (!properties || !Array.isArray(properties)) return props;

  for (const prop of properties) {
    switch (prop.field_name) {
      case 'Status': props.status = prop.field_value_name || ''; break;
      case 'Type': props.tcType = prop.field_value_name || ''; break;
      case 'Priority': props.priority = prop.field_value_name || ''; break;
      case 'Automation': props.automation = prop.field_value_name || ''; break;
      case 'Automation Content': props.automationContent = prop.field_value || ''; break;
      case 'Automation Date': props.automationDate = prop.field_value || ''; break;
      case 'Functionality': props.functionality = prop.field_value || ''; break;
      case 'Market': props.market = prop.field_value_name || ''; break;
      case 'Shared': props.shared = prop.field_value || ''; break;
      case 'Description': break; // Already captured from top-level description field
    }
  }

  return props;
}

// Processes a single project: fetches modules, then test cases per module, inserts into DB
// Flow: Modules → DB | Test Cases per Module → DB | Project summary → DB
async function processAndInsertProject(project, index, total, db) {
  const timestamp = new Date(); // Timestamp for all documents in this run
  let totalTestCasesInserted = 0; // Counter for inserted test cases
  let totalModulesInserted = 0; // Counter for inserted modules

  console.log(`\n[${index + 1}/${total}] Processing project "${project.name}" (ID: ${project.id})...`);

  try {
    // ── Step 1: Fetch all modules recursively and insert into 'modules' collection ──
    const modules = await fetchModulesForProject(project.id); // Crawl full module tree
    console.log(`  Found ${modules.length} modules`);

    if (modules.length > 0) {
      // Map each qTest module to our DB schema
      const moduleDocs = modules.map(mod => ({
        id: uuidv4(),                           // Unique document ID
        qtestModuleId: mod.id,                  // Original qTest module ID
        name: mod.name,                         // Module name
        order: mod.order,                       // Display order
        pid: mod.pid,                           // qTest PID (e.g., "MD-535")
        created_date: mod.created_date,         // qTest creation date
        last_modified_date: mod.last_modified_date, // qTest last modified date
        parent_id: mod.parent_id,               // Parent module ID (for tree reconstruction)
        description: mod.description || '',     // Module description
        level: mod._level,                      // Depth level in tree (1=root, 2=child, etc.)
        projectId: project.id,                  // Parent project ID
        projectName: project.name,              // Parent project name
        type: 'qtest-module',                   // Document type identifier
        nuid: null,                             // User ID (null for system import)
        app: 'SmartNotes',                      // Application identifier
        createdAt: timestamp,                   // DB insertion timestamp
        updatedAt: timestamp                    // DB update timestamp
      }));

      // Insert modules in batches of 100 to avoid oversized operations
      for (let i = 0; i < moduleDocs.length; i += 100) {
        const batch = moduleDocs.slice(i, i + 100); // Slice current batch
        const modResult = await db.collection('modules').insertMany(batch, { writeConcern: { w: 1 } });
        totalModulesInserted += modResult.insertedCount; // Accumulate count
      }
      console.log(`  Modules inserted: ${totalModulesInserted}`);
    }

    // ── Step 2: Fetch test cases per module, then fetch full details (with test_steps), insert into DB ──
    const seenQtestIds = new Set(); // Track seen test case IDs to prevent cross-module duplicates

    for (let m = 0; m < modules.length; m++) {
      const mod = modules[m]; // Current module

      // Step 2a: Get test case list from module endpoint (no test_steps in list response)
      const testCaseList = await fetchTestCasesForModule(project.id, mod.id);
      if (testCaseList.length === 0) continue; // Skip modules with no test cases

      // Filter out test cases already seen in a previous module
      const uniqueItems = testCaseList.filter(tc => {
        if (seenQtestIds.has(tc.id)) return false; // Already inserted from another module
        seenQtestIds.add(tc.id); // Mark as seen
        return true;
      });
      if (uniqueItems.length === 0) continue; // All test cases were duplicates

      // Step 2b: Fetch full details (with test_steps) via POST search API in batches of 50 IDs
      const uniqueIds = uniqueItems.map(tc => tc.id); // Extract just the IDs
      const fullTestCases = await fetchTestCaseDetailsBatch(project.id, uniqueIds);

      if (fullTestCases.length === 0) continue; // All fetches failed

      // Map each full test case to our DB schema
      const batch = fullTestCases.map(record => {
        // Extract test steps array from the full detail response
        const testSteps = [];
        if (record?.test_steps && Array.isArray(record.test_steps)) {
          record.test_steps.forEach(step => {
            testSteps.push({
              id: step.id,                           // Step ID
              description: step.description,         // Step description/action
              order: step.order,                     // Step order
              expected: step.expected,               // Expected result
              plain_value_text: step.plain_value_text || '' // Plain text value
            });
          });
        }

        // Extract flat properties from the properties array
        const props = extractProperties(record.properties);

        return {
          id: uuidv4(),                             // Unique document ID
          qtestId: record.id,                       // Original qTest test case ID
          name: record.name,                        // Test case name
          order: record.order,                      // Display order
          pid: record.pid,                          // qTest PID (e.g., "TC-118")
          created_date: record.created_date,        // qTest creation date
          last_modified_date: record.last_modified_date, // qTest last modified date
          description: record.description || '',    // Test case description
          precondition: record.precondition || '',  // Test case preconditions
          parent_id: record.parent_id,              // Parent module ID in qTest
          moduleId: mod.id,                         // Module this TC was fetched from
          moduleName: mod.name,                     // Module name for reference
          projectId: project.id,                    // Parent project ID
          projectName: project.name,                // Parent project name
          type: 'qtest-testcase',                   // Document type identifier
          status: props.status,                     // e.g., "Done", "New"
          tcType: props.tcType,                     // e.g., "Regression", "Functional"
          priority: props.priority,                 // e.g., "High", "Medium"
          automation: props.automation,              // e.g., "Yes", "No"
          automationContent: props.automationContent, // e.g., "vve-bff-zoomapp.xml"
          automationDate: props.automationDate,     // e.g., "2023-11-30T22:30:12+00:00"
          functionality: props.functionality,       // e.g., "Video Visit App - Setup"
          market: props.market,                     // e.g., "NCAL", ""
          shared: props.shared,                     // e.g., "false"
          testSteps: testSteps,                     // Array of test step objects
          nuid: null,                               // User ID (null for system import)
          app: 'SmartNotes',                        // Application identifier
          createdAt: timestamp,                     // DB insertion timestamp
          updatedAt: timestamp                      // DB update timestamp
        };
      });

      // Insert this batch of test cases into DB
      const insertResult = await db.collection('testcases').insertMany(batch, { writeConcern: { w: 1 } });
      totalTestCasesInserted += insertResult.insertedCount; // Accumulate count
    }

    console.log(`  Test cases inserted: ${totalTestCasesInserted} (${seenQtestIds.size} unique)`);

    // ── Step 3: Insert the project summary document into 'projects' collection ──
    const projectDoc = {
      id: uuidv4(),                             // Unique document ID
      nuid: null,                               // User ID (null for system import)
      projectId: project.id,                    // Original qTest project ID
      name: project.name,                       // Project name
      description: project.description || '',   // Project description
      type: 'qtest',                            // Document type identifier
      testCaseCount: totalTestCasesInserted,     // Total test cases inserted for this project
      moduleCount: totalModulesInserted,         // Total modules inserted for this project
      app: 'SmartNotes',                        // Application identifier
      createdAt: timestamp,                     // DB insertion timestamp
      updatedAt: timestamp                      // DB update timestamp
    };
    await db.collection('projects').insertOne(projectDoc, { writeConcern: { w: 1 } }); // Insert project doc

    console.log(`  ✓ Done: ${totalTestCasesInserted} test cases, ${totalModulesInserted} modules`);
    return { success: true, projectName: project.name, testCaseCount: totalTestCasesInserted, moduleCount: totalModulesInserted };
  } catch (error) {
    console.error(`  ✗ Failed "${project.name}" (ID: ${project.id}):`, error.message);
    return { success: false, projectName: project.name, error: error.message };
  }
}

// Performs incremental sync for a project: only fetches records modified since lastSyncDate
// Uses qTest search API query: "'last modified date' >= '{date}'"
// Upserts (insert or update) test cases and modules instead of deleting and re-inserting
async function incrementalSyncProject(project, db, lastSyncDate) {
  const timestamp = new Date(); // Timestamp for upserted documents
  const bearerToken = `Bearer ${getQTestToken()}`; // Construct authorization header
  const searchUrl = `${getQTestUrl()}/projects/${project.id}/search`; // Search endpoint
  // Format date for qTest query (ISO 8601 with timezone offset)
  const isoDate = lastSyncDate.toISOString().replace('Z', '+00:00');

  console.log(`\n  Incremental sync for "${project.name}" (since ${lastSyncDate.toISOString()})...`);

  // ── Step 1: Upsert modules (may have been added/modified) ──
  const modules = await fetchModulesForProject(project.id); // Fetch full module tree
  let modulesAdded = 0, modulesUpdated = 0;

  for (const mod of modules) {
    // Upsert: insert if new, update if exists
    const result = await db.collection('modules').updateOne(
      { qtestModuleId: mod.id, projectId: project.id }, // Match by qTest ID + project
      {
        $set: {                                          // Always update these fields
          name: mod.name, order: mod.order, pid: mod.pid,
          created_date: mod.created_date,
          last_modified_date: mod.last_modified_date,
          parent_id: mod.parent_id,
          description: mod.description || '',
          level: mod._level, projectName: project.name,
          updatedAt: timestamp
        },
        $setOnInsert: {                                  // Only set when creating new doc
          id: uuidv4(), qtestModuleId: mod.id,
          projectId: project.id, type: 'qtest-module',
          nuid: null, app: 'SmartNotes', createdAt: timestamp
        }
      },
      { upsert: true, writeConcern: { w: 1 } }
    );
    if (result.upsertedCount > 0) modulesAdded++;
    else if (result.modifiedCount > 0) modulesUpdated++;
  }
  console.log(`  Modules: ${modulesAdded} added, ${modulesUpdated} updated (${modules.length} total)`);

  // ── Step 2: Search for test cases modified since last sync ──
  const query = `'last modified date' >= '${isoDate}'`; // qTest search filter
  let page = 1;
  let tcAdded = 0, tcUpdated = 0;

  while (true) {
    try {
      const response = await fetch(searchUrl, {
        method: 'POST',
        headers: { 'Authorization': bearerToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          "object_type": "test-cases",
          "fields": ["*"],       // All fields including test_steps and properties
          "query": query,        // Filter by 'last modified date' >= lastSyncDate
          "page": page,
          "page_size": 100
        })
      });
      const data = await response.json(); // Parse search response

      if (page === 1 && data?.total != null) {
        console.log(`  Found ${data.total} test cases modified since last sync`);
      }
      if (!data?.items || data.items.length === 0) break; // No more results

      // Upsert each modified test case
      for (const record of data.items) {
        // Extract test steps
        const testSteps = [];
        if (record?.test_steps && Array.isArray(record.test_steps)) {
          record.test_steps.forEach(step => {
            testSteps.push({
              id: step.id, description: step.description,
              order: step.order, expected: step.expected,
              plain_value_text: step.plain_value_text || ''
            });
          });
        }
        // Extract properties (status, priority, etc.)
        const props = extractProperties(record.properties);

        // Upsert: insert if new, update if exists
        const result = await db.collection('testcases').updateOne(
          { qtestId: record.id, projectId: project.id }, // Match by qTest ID + project
          {
            $set: {                                        // Always update these fields
              name: record.name, order: record.order, pid: record.pid,
              created_date: record.created_date,
              last_modified_date: record.last_modified_date,
              description: record.description || '',
              precondition: record.precondition || '',
              parent_id: record.parent_id,
              projectName: project.name,
              status: props.status, tcType: props.tcType,
              priority: props.priority, automation: props.automation,
              automationContent: props.automationContent,
              automationDate: props.automationDate,
              functionality: props.functionality,
              market: props.market, shared: props.shared,
              testSteps: testSteps,
              updatedAt: timestamp
            },
            $setOnInsert: {                                // Only set when creating new doc
              id: uuidv4(), qtestId: record.id,
              projectId: project.id, type: 'qtest-testcase',
              nuid: null, app: 'SmartNotes', createdAt: timestamp
            }
          },
          { upsert: true, writeConcern: { w: 1 } }
        );
        if (result.upsertedCount > 0) tcAdded++;
        else if (result.modifiedCount > 0) tcUpdated++;
      }

      if (data.items.length < 100) break; // Last page
      page++;
    } catch (error) {
      console.error(`  Error in incremental sync (page ${page}):`, error.message);
      break;
    }
  }

  // ── Step 3: Update the project summary with current counts ──
  const tcCount = await db.collection('testcases').countDocuments({ projectId: project.id });
  const modCount = await db.collection('modules').countDocuments({ projectId: project.id });
  await db.collection('projects').updateOne(
    { projectId: project.id },
    {
      $set: { testCaseCount: tcCount, moduleCount: modCount, updatedAt: timestamp },
      $setOnInsert: {
        id: uuidv4(), nuid: null, projectId: project.id,
        name: project.name, description: project.description || '',
        type: 'qtest', app: 'SmartNotes', createdAt: timestamp
      }
    },
    { upsert: true, writeConcern: { w: 1 } }
  );

  console.log(`  ✓ Incremental sync done: ${tcAdded} new, ${tcUpdated} updated test cases`);
  return { success: true, projectName: project.name, tcAdded, tcUpdated, modulesAdded, modulesUpdated };
}

// Runs an array of async task functions with limited concurrency (worker pool pattern)
async function runWithConcurrency(tasks, concurrency) {
  const results = []; // Array to store results in original order
  let i = 0; // Shared task index counter

  // Worker function: picks up next available task until all are done
  async function worker() {
    while (i < tasks.length) {
      const taskIndex = i++; // Claim next task index
      results[taskIndex] = await tasks[taskIndex](); // Execute task and store result
    }
  }

  // Spin up workers (limited to concurrency or total tasks, whichever is smaller)
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers); // Wait for all workers to finish
  return results;
}

// Main entry point: orchestrates the full qTest data import pipeline
// First run = full import (delete + insert all), subsequent runs = incremental (upsert changed records)
const main = async () => {
  console.log('Starting qTest data import...');
  loadEnvLocal(); // Load .env.local file into process.env
  await setProcessEnvironment(); // Load environment-specific config (dev/uat/prod)

  try {
    // Fetch all projects from qTest API
    const projects = await getAllProjects();

    if (!projects || projects.length === 0) {
      console.error('No projects found from qTest API!');
      return;
    }

    console.log(`Found ${projects.length} projects from qTest API`);

    // Connect to the qtest_projects database
    const db = await connectToDatabase('qtest_projects');

    const incrementalResults = [];
    const fullImportProjects = [];

    // ── Separate projects into incremental sync vs full import ──
    for (const project of projects) {
      const existingProject = await db.collection('projects').findOne({ projectId: project.id });
      const lastSyncDate = existingProject?.updatedAt || null; // null = first run → full import

      if (lastSyncDate) {
        // ── INCREMENTAL SYNC: only fetch records modified since last sync ──
        console.log(`\nProject "${project.name}" (ID: ${project.id}) — last sync: ${lastSyncDate.toISOString()}, running incremental sync`);
        const result = await incrementalSyncProject(project, db, lastSyncDate);
        incrementalResults.push(result);
      } else {
        fullImportProjects.push(project);
      }
    }

    // ── FULL IMPORT: clear existing data and reimport for projects with no previous sync ──
    if (fullImportProjects.length > 0) {
      console.log(`\n${fullImportProjects.length} project(s) require full import`);

      for (const project of fullImportProjects) {
        console.log(`Clearing existing data for project "${project.name}" (ID: ${project.id})...`);
        const delTC = await db.collection('testcases').deleteMany({ projectId: project.id }, { writeConcern: { w: 1 } });
        const delMod = await db.collection('modules').deleteMany({ projectId: project.id }, { writeConcern: { w: 1 } });
        const delProj = await db.collection('projects').deleteMany({ projectId: project.id }, { writeConcern: { w: 1 } });
        console.log(`  Cleared: ${delTC.deletedCount} test cases, ${delMod.deletedCount} modules, ${delProj.deletedCount} projects`);
      }

      // Create task functions and run with concurrency limit
      const tasks = fullImportProjects.map((project, index) =>
        () => processAndInsertProject(project, index, fullImportProjects.length, db)
      );
      const results = await runWithConcurrency(tasks, 3); // Concurrency 3 for parallel processing

      // Summarize full import results
      const succeeded = results.filter(r => r?.success);
      const failed = results.filter(r => r && !r.success);
      const totalTestCases = succeeded.reduce((sum, r) => sum + (r.testCaseCount || 0), 0);
      const totalModules = succeeded.reduce((sum, r) => sum + (r.moduleCount || 0), 0);

      console.log(`\n${'='.repeat(60)}`);
      console.log(`Full import: ${succeeded.length}/${fullImportProjects.length} projects | ${totalTestCases} test cases | ${totalModules} modules`);

      if (failed.length > 0) {
        console.log(`Failed (${failed.length}):`);
        failed.forEach(f => console.log(`  - ${f.projectName}: ${f.error}`));
      }
    }

    // ── Summarize incremental sync results ──
    if (incrementalResults.length > 0) {
      const totalTcAdded = incrementalResults.reduce((sum, r) => sum + (r.tcAdded || 0), 0);
      const totalTcUpdated = incrementalResults.reduce((sum, r) => sum + (r.tcUpdated || 0), 0);
      const totalModAdded = incrementalResults.reduce((sum, r) => sum + (r.modulesAdded || 0), 0);
      const totalModUpdated = incrementalResults.reduce((sum, r) => sum + (r.modulesUpdated || 0), 0);

      console.log(`\n${'='.repeat(60)}`);
      console.log(`Incremental sync: ${incrementalResults.length} projects | ${totalTcAdded} new TC, ${totalTcUpdated} updated TC | ${totalModAdded} new modules, ${totalModUpdated} updated modules`);
    }

    // Verify DB counts (all projects)
    const dbTC = await db.collection('testcases').countDocuments();
    const dbMod = await db.collection('modules').countDocuments();
    const dbProj = await db.collection('projects').countDocuments();
    console.log(`\nDB Verification → testcases: ${dbTC} | modules: ${dbMod} | projects: ${dbProj}`);
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

main().catch(err => {
  console.error('Error executing main function:', err);
  process.exit(1);
});