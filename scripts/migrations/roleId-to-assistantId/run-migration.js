import { runRoleIdToAssistantIdMigration } from './migrate-roleId-to-assistantId.js';
import { setProcessEnvironment } from '../../configActions.js';
import { loadEnvLocal } from '../../../utils/envLoader.js';

/**
 * Main script to run the roleId to assistantId migration
 * This script should be run after the userRole-to-UserAssistant migration is complete
 */
async function main() {
  try {
    console.log('='.repeat(60));
    console.log('ROLEID TO ASSISTANTID MIGRATION SCRIPT');
    console.log('='.repeat(60));
    console.log('⚠️  IMPORTANT: This migration must be run AFTER the userRole-to-UserAssistant migration!');
    console.log('⚠️  This script will:');
    console.log('   1. Find all documents with roleId property');
    console.log('   2. Map roleId to assistantId using Assistant._migrationInfo.originalId');
    console.log('   3. Replace roleId with assistantId');
    console.log('   4. Remove the original roleId property');
    console.log('='.repeat(60));

    console.log('\nLoading environment variables...');
    loadEnvLocal();

    console.log('Setting up environment configuration...');
    await setProcessEnvironment();

    console.log('Starting roleId to assistantId migration...');
    const result = await runRoleIdToAssistantIdMigration();

    if (result.status === 'success') {
      console.log('\n🎉 Migration completed successfully!');
      console.log('\nFinal Summary:');
      console.log(`  Total documents processed: ${result.migration.totalDocuments}`);
      console.log(`  Successfully migrated: ${result.migration.migrated}`);
      console.log(`  Skipped (already migrated): ${result.migration.skipped}`);
      console.log(`  Failed: ${result.migration.failed}`);

      console.log('\nDocument Type Breakdown:');
      Object.entries(result.migration.documentTypeResults).forEach(([type, results]) => {
        console.log(`  ${type}:`);
        console.log(`    Total: ${results.totalDocuments}`);
        console.log(`    Migrated: ${results.migrated}`);
        console.log(`    Skipped: ${results.skipped}`);
        console.log(`    Failed: ${results.failed}`);
        if (results.error) {
          console.log(`    Error: ${results.error}`);
        }
      });

      console.log('\nVerification Results:');
      Object.entries(result.verification.documentTypeResults).forEach(([type, results]) => {
        console.log(`  ${type}:`);
        console.log(`    Documents with roleId remaining: ${results.documentsWithRoleId} (should be 0)`);
        console.log(`    Documents with assistantId: ${results.documentsWithAssistantId}`);
        console.log(`    Migration success: ${results.migrationSuccess ? '✅' : '❌'}`);
      });

      process.exit(0);
    } else {
      console.error('❌ Migration failed:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  }
}

// Check if script is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };
