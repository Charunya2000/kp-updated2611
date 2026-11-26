import { connectToEnvironmentDatabase, closeMigrationConnections } from '../utils/multiEnvConnection.js';

/**
 * Migration: Add description field to existing Assistant documents.
 *
 * Previously, welcome messages were hard-coded in Assistants.js.
 * This migration writes those descriptions into each Assistant document
 * so they can be managed from the Team Admin panel.
 */

const ASSISTANT_DESCRIPTIONS = {
  "kp-smart-notes": "KP Smart Notes is a general purpose AI Assistant, designed to provide insight from the sources you curate.",
  "kpmc-assistant": "Smart Notes is an AI Assistant that improves the efficiency of product management, testing, and delivery. It streamlines requirement assessment, user story creation with acceptance criteria, and testing processes, making them less time consuming and more accurate.It also supports contextual responses using KPMC Knowledge.",
  "medicaid-ai-assistant": "AI Assistant to improve contract analysis and enhance requirements traceability for Medicaid contracts, MOUs, and APLs. Contract management teams face significant challenges in tracking Medicaid contract requirements, amendments, and related documents, resulting in a time-consuming process.",
  "cms-assistant": "The AI Assistant for CMS CFR Regulatory Analysis is a cutting-edge solution designed to streamline and enhance regulatory compliance processes within the Centers for Medicare & Medicaid Services (CMS).",
  "hppdm-assistant": "The Health Plan Provider Data Management (HPPDM) AI Assistant supports user story creation, test case creation, and automated test creation.",
  "sales-and-marketing": "The Sales & Marketing AI Assistant supports sales and marketing material creation.",
  "kpif-marketing-and-products": "The KPIF Marketing & Products AI Assistant supports marketing and products development activities.",
  "scheduletopay": "Schedule to Pay AI Assistant is designed to assist the testing of the scheduling and payment application."
};

/**
 * Run migration for a single environment and team database.
 * @param {string} environment - e.g. 'dev', 'uat', 'pp', 'psup', 'prod'
 * @param {string} teamDbName - e.g. 'team-bcs-db'
 */
export async function migrateAssistantDescriptions(environment, teamDbName) {
  const db = await connectToEnvironmentDatabase(environment, teamDbName);
  const collection = db.collection('user_collection');

  const assistants = await collection.find({ type: 'Assistant' }).toArray();

  let updated = 0;
  let skipped = 0;

  for (const assistant of assistants) {
    const description = ASSISTANT_DESCRIPTIONS[assistant.name];

    if (!description) {
      skipped++;
      continue;
    }

    // Only set description if not already present
    if (assistant.description) {
      skipped++;
      continue;
    }

    await collection.updateOne(
      { _id: assistant._id },
      {
        $set: {
          description,
          updatedAt: new Date(),
        }
      }
    );
    updated++;
    console.log(`  Updated "${assistant.name}" in ${teamDbName}`);
  }

  console.log(`[${environment}] ${teamDbName}: ${updated} updated, ${skipped} skipped (${assistants.length} total assistants)`);
  return { updated, skipped, total: assistants.length };
}

/**
 * Run migration across all environments.
 * Usage: node --experimental-vm-modules scripts/migrations/assistant-description/migrate-assistant-description.js
 *
 * Pass environment and team DB name as arguments:
 *   node ... dev team-bcs-db
 *   node ... prod team-kpit-ai-portal-members-db
 *
 * Or run without arguments for a dry-run listing the descriptions.
 */
async function main() {
  const [environment, teamDbName] = process.argv.slice(2);

  if (!environment || !teamDbName) {
    console.log('Usage: node migrate-assistant-description.js <environment> <teamDbName>');
    console.log('Example: node migrate-assistant-description.js dev team-bcs-db');
    console.log('\nDescriptions that will be applied:');
    for (const [name, desc] of Object.entries(ASSISTANT_DESCRIPTIONS)) {
      console.log(`  ${name}: ${desc.substring(0, 60)}...`);
    }
    process.exit(0);
  }

  try {
    console.log(`Running assistant description migration on ${environment}:${teamDbName}...`);
    const result = await migrateAssistantDescriptions(environment, teamDbName);
    console.log('Migration complete:', result);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await closeMigrationConnections();
  }
}

main();
