import { verifyRoleIdToAssistantIdMigration } from './migrate-roleId-to-assistantId.js';
import { setProcessEnvironment } from '../../configActions.js';
import { loadEnvLocal } from '../../../utils/envLoader.js';

/**
 * Verification script to check the status of roleId to assistantId migration
 */
async function verifyMigration() {
  try {
    console.log('='.repeat(60));
    console.log('ROLEID TO ASSISTANTID MIGRATION VERIFICATION');
    console.log('='.repeat(60));

    console.log('\nLoading environment variables...');
    loadEnvLocal();

    console.log('Setting up environment configuration...');
    await setProcessEnvironment();

    console.log('Starting verification...');
    const verificationResult = await verifyRoleIdToAssistantIdMigration();

    console.log('\n📊 VERIFICATION SUMMARY');
    console.log('='.repeat(60));

    let allMigrationSuccessful = true;

    Object.entries(verificationResult.documentTypeResults).forEach(([type, results]) => {
      const status = results.migrationSuccess ? '✅ MIGRATED' : '❌ NEEDS MIGRATION';
      console.log(`\n${type}: ${status}`);
      console.log(`  Documents with roleId remaining: ${results.documentsWithRoleId}`);
      console.log(`  Documents with assistantId: ${results.documentsWithAssistantId}`);
      console.log(`  Documents with migration info: ${results.documentsWithMigrationInfo}`);

      if (!results.migrationSuccess) {
        allMigrationSuccessful = false;
      }
    });

    console.log('\n' + '='.repeat(60));
    if (allMigrationSuccessful) {
      console.log('🎉 ALL MIGRATIONS COMPLETED SUCCESSFULLY!');
      console.log('✅ No documents with roleId property remain');
      console.log('✅ All eligible documents now have assistantId property');
    } else {
      console.log('⚠️  MIGRATION INCOMPLETE');
      console.log('❌ Some documents still have roleId property');
      console.log('💡 Run the migration script to complete the process');
    }
    console.log('='.repeat(60));

    process.exit(allMigrationSuccessful ? 0 : 1);

  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

// Check if script is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyMigration();
}

export { verifyMigration };
