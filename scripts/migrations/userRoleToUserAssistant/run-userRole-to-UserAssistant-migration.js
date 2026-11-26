#!/usr/bin/env node

/**
 * Migration Script Runner
 * Run this script to migrate userRoles to UserAssistants
 * Run Command:
 *   node scripts/migrations/userRoleToUserAssistant/run-userRole-to-UserAssistant-migration.js
 */
import { runMigration } from './migrate-userRoles-to-userAssistants.js';

async function main() {
  console.log('='.repeat(60));
  console.log('UserRole to UserAssistant Migration Script');
  console.log('='.repeat(60));

  debugger;
  try {
    const result = await runMigration();

    if (result.status === 'success') {
      console.log('\n✅ Migration completed successfully!');
      console.log('\nMigration Results:');
      console.log(`- Original UserRoles: ${result.migration.totalUserRoles}`);
      console.log(`- Available Assistants: ${result.migration.totalAssistants}`);
      console.log(`- Successful Mappings: ${result.migration.successfulMappings}`);
      console.log(`- Failed Mappings: ${result.migration.failedMappings}`);
      console.log(`- UserAssistants Created: ${result.migration.userAssistantsCreated}`);

      console.log('\nVerification Results:');
      console.log(`- Total UserAssistants in DB: ${result.verification.newUserAssistants}`);
      console.log(`- Migration Verified: ${result.verification.migrationSuccess ? '✅' : '❌'}`);
    } else {
      console.log('\n❌ Migration failed!');
      console.log('Error:', result.error);
    }

  } catch (error) {
    console.error('\n❌ Script execution failed:', error);
  }

  console.log('\n' + '='.repeat(60));
  process.exit(1);
}

// Run the script
main();
