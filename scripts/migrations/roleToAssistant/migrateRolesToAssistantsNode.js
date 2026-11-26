// Node.js script to migrate roles to assistants for multi-tenant architecture
// Run this script using: node scripts/migrateRolesToAssistantsNode.js

import { connectToEnvironmentDatabase } from '../utils/multiEnvConnection.js';
import { setProcessEnvironment } from '../../configActions.js';
import { loadEnvLocal } from '../../../utils/envLoader.js';
import { v4 } from 'uuid';
import { formatName } from '../../../utils/formatting.js';

// Function to migrate roles to assistants
export async function migrateRolesToAssistants(targetEnv = 'dev', targetDbName = 'team-kpit-ai-portal-members-db', teamId = 'ecbebd4c-0167-4d10-8701-4d7ba3527f4e', teamName = 'kpit-ai-portal-members', batchSize = 12) {
  try {
    console.log('Starting migration of roles to assistants...');

    const db = await connectToEnvironmentDatabase(targetEnv, targetDbName); // Check this in the source database before running

    // Find all documents with type: "role"
    const roles = await db.collection('user_collection').find({ type: "role" }).toArray();

    if (roles.length === 0) {
      console.log('No roles found to migrate.');
      return { success: true, migratedCount: 0 };
    }

    console.log(`Found ${roles.length} roles to migrate.`);

    // Array to store new assistant documents
    const assistants = [];

    // Transform each role to assistant
    roles.forEach(role => {
      const assistant = {
        ...role, // Copy all existing fields
        type: "Assistant", // Change type from "role" to "Assistant"
        name: formatName(role.name),
        category: role.parentName, // Change parentName to category
        teamId: teamId, // Use provided teamId
        id: v4(), // Add unique id field
        teamName: teamName, // Use provided teamName
        // Update timestamps
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Remove the original _id to generate a new one
      delete assistant._id;
      // Remove the old parentName field since we've copied it to category
      delete assistant.parentName;

      assistants.push(assistant);
    });

    // Insert all assistants in batches
    console.log(`Inserting ${assistants.length} assistants into the database...`);
    console.log(`Assistants: `, assistants);
    let insertedCount = 0;
    for (let i = 0; i < assistants.length; i += batchSize) {
      const batch = assistants.slice(i, i + batchSize);
      const result = await db.collection('user_collection').insertMany(batch);
      console.log(`Inserted batch of ${result.insertedCount} assistants.`);
      insertedCount += result.insertedCount;
      await new Promise(resolve => setTimeout(resolve, 1000)); // Short delay to avoid overwhelming the DB
    }

    console.log(`Successfully migrated ${insertedCount} roles to assistants.`);

    return {
      success: true,
      migratedCount: insertedCount,
    };

  } catch (error) {
    console.error('Error during migration:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Main execution function
async function main() {
  console.log('=== Role to Assistant Migration Script ===');
  console.log('This script will copy all role documents to assistant documents');
  console.log('with the following changes:');
  console.log('- type: "role" -> "Assistant"');
  console.log('- parentName -> category');
  console.log('- Add new teamId field (initially null)');
  console.log('');

  try {
    // Parse CLI arguments
    const args = process.argv.slice(2);
    const config = {};

    for (let i = 0; i < args.length; i += 2) {
      const key = args[i]?.replace(/^--/, '');
      const value = args[i + 1];
      if (key && value) {
        config[key] = value;
      }
    }

    // 1. Run the migration
    console.log('Step 1: Running migration...');
    const migrationResult = await migrateRolesToAssistants(config.targetDbName, config.teamId, config.teamName);

    if (!migrationResult.success) {
      console.error('Migration failed:', migrationResult.error);
      return;
    }

    // // 2. Verify the migration
    // console.log('\nStep 2: Verifying migration...');
    // await verifyMigration();

    // console.log('\n=== Migration completed successfully! ===');
    // console.log('\nNext steps:');
    // console.log('1. Create your team documents');
    // console.log('2. Use updateAssistantTeamIds() function to assign assistants to teams');
    // console.log('3. Update your application code to use "Assistant" type instead of "role"');
    // console.log('4. Update references from "parentName" to "category"');

  } catch (error) {
    console.error('Migration script failed:', error);
  }
}

// Run main function only if script is executed directly
// node scripts\migrations\roleToAssistant\migrateRolesToAssistantsNode.js
if (import.meta.url === `file://${process.argv[1]}`) {
  debugger;
  (async () => {
    console.log('Loading environment variables...');
    loadEnvLocal();

    console.log('Setting up environment configuration...');
    await setProcessEnvironment();

    console.log('Connecting to database...');
    await main();

    console.log('Migration script finished.');
    process.exit(0);
  })();
}
