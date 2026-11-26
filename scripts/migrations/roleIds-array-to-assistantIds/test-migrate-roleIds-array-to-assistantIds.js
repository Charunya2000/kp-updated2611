import { loadEnvLocal } from '../../../utils/envLoader.js';
import { setProcessEnvironment } from '../../configActions.js';
import { runRoleIdsArrayToAssistantIdsMigration, verifyRoleIdsArrayToAssistantIdsMigration } from './migrate-roleIds-array-to-assistantIds.js';

/**
 * Standalone test script for roleIds array to assistantIds migration
 */
async function testRoleIdsArrayMigration() {
  try {
    console.log('🧪 Starting standalone test for roleIds array to assistantIds migration...');
    console.log('='.repeat(80));

    // Load environment variables
    console.log('📋 Loading environment variables...');
    loadEnvLocal();

    // Set up environment configuration
    console.log('⚙️  Setting up environment configuration...');
    await setProcessEnvironment();

    console.log('✅ Environment setup complete');
    console.log('-'.repeat(80));

    // Run the migration
    console.log('\n🚀 Starting roleIds array to assistantIds migration...');
    const startTime = Date.now();

    const migrationResult = await runRoleIdsArrayToAssistantIdsMigration();

    const duration = Date.now() - startTime;
    console.log(`\n⏱️  Migration completed in ${duration}ms`);

    // Print detailed results
    console.log('\n📊 MIGRATION RESULTS:');
    console.log('='.repeat(80));
    console.log(`Total Documents: ${migrationResult.totalDocuments}`);
    console.log(`Migrated: ${migrationResult.migrated}`);
    console.log(`Skipped: ${migrationResult.skipped}`);
    console.log(`Failed: ${migrationResult.failed}`);

    if (migrationResult.status) {
      console.log(`Status: ${migrationResult.status}`);
    }

    // Print per-document-type results
    if (migrationResult.documentTypeResults && Object.keys(migrationResult.documentTypeResults).length > 0) {
      console.log('\n📋 RESULTS BY DOCUMENT TYPE:');
      console.log('-'.repeat(60));

      for (const [docType, result] of Object.entries(migrationResult.documentTypeResults)) {
        console.log(`\n${docType}:`);
        console.log(`  Total: ${result.totalDocuments}`);
        console.log(`  Migrated: ${result.migrated}`);
        console.log(`  Skipped: ${result.skipped}`);
        console.log(`  Failed: ${result.failed}`);

        if (result.error) {
          console.log(`  Error: ${result.error}`);
        }
      }
    }

    // Run verification if migration was successful
    if (migrationResult.migrated > 0 || migrationResult.totalDocuments > 0) {
      console.log('\n🔍 Running verification...');
      console.log('-'.repeat(60));

      try {
        const verificationResult = await verifyRoleIdsArrayToAssistantIdsMigration();

        console.log('\n✅ VERIFICATION RESULTS:');
        for (const [docType, result] of Object.entries(verificationResult.documentTypeResults)) {
          console.log(`\n${docType}:`);
          console.log(`  Documents with roleIds: ${result.documentsWithRoleIds} (should be 0)`);
          console.log(`  Documents with assistantIds: ${result.documentsWithAssistantIds}`);
          console.log(`  Documents with migration info: ${result.migrationInfo}`);

          // Validation warnings
          if (result.documentsWithRoleIds > 0) {
            console.warn(`  ⚠️  WARNING: ${result.documentsWithRoleIds} documents still have roleIds!`);
          }
        }
      } catch (verificationError) {
        console.error('❌ Verification failed:', verificationError.message);
      }
    }

    // Overall summary
    console.log('\n🎯 SUMMARY:');
    console.log('='.repeat(80));

    if (migrationResult.status === 'no_mappings') {
      console.log('⚠️  No role-to-assistant mappings found');
      console.log('   Make sure the Assistants migration has been run first');
    } else if (migrationResult.status === 'no_documents_found') {
      console.log('ℹ️  No documents found with roleIds arrays');
      console.log('   This is normal if no documents have roleIds arrays');
    } else if (migrationResult.migrated > 0) {
      console.log(`✅ Successfully migrated ${migrationResult.migrated} documents`);

      if (migrationResult.failed > 0) {
        console.log(`⚠️  ${migrationResult.failed} documents failed to migrate`);
      }

      if (migrationResult.skipped > 0) {
        console.log(`ℹ️  ${migrationResult.skipped} documents were skipped`);
      }
    } else {
      console.log('ℹ️  No documents needed migration');
    }

    console.log(`\n🎉 Test completed successfully in ${duration}ms!`);
    process.exit(0);

  } catch (error) {
    console.error('\n💥 Test failed:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Add some helper functions for debugging
async function debugRoleIdsArrayMigration() {
  try {
    console.log('🔍 DEBUG MODE: Analyzing roleIds arrays in database...');

    // You can add debug queries here to inspect the data
    // For example, finding sample documents with roleIds arrays

    console.log('Debug analysis complete');
  } catch (error) {
    console.error('Debug analysis failed:', error);
  }
}

// Check if this script is being run directly

const args = process.argv.slice(2);
debugger;
if (args.includes('--debug')) {
  await debugRoleIdsArrayMigration();
} else {
  await testRoleIdsArrayMigration();
}

export { testRoleIdsArrayMigration, debugRoleIdsArrayMigration };
