import { MongoClient } from 'mongodb';
import { loadEnvLocal } from '../../../utils/envLoader.js';
import { setProcessEnvironment } from '../../configActions.js';
import { connectToEnvironmentDatabase } from '../utils/multiEnvConnection.js';

/**
 * Migration to rename selectedUserdRole property to selectedUserAssistant
 * This migration will:
 * 1. Find all documents with the selectedUserdRole property
 * 2. Rename the property to selectedUserAssistant while preserving the value
 * 3. Remove the old selectedUserdRole property
 */

export async function runSelecteUserRoleToSelectedUserAssistantMigration(targetEnv = 'dev', targetDbName = 'team-kpit-ai-portal-members-db', batchSize = 12) {
  return await migrateSelecteUserRoleToSelectedUserAssistant(targetEnv, targetDbName, batchSize);
}

export async function migrateSelecteUserRoleToSelectedUserAssistant(targetEnv = 'dev', targetDbName = 'team-kpit-ai-portal-members-db', batchSize = 12) {

  try {
    console.log(`\n🔍 Processing database: ${targetEnv}/${targetDbName}`);
    const db = await connectToEnvironmentDatabase(targetEnv, targetDbName);

    // Target only the user_collection
    const targetCollectionName = 'user_collection';
    console.log(`  📂 Processing collection: ${targetCollectionName}`);

    let totalUpdated = 0;
    const migrationResults = [];

    try {
      const collection = db.collection(targetCollectionName);

      // Find documents with selectedUserRole property
      const documentsWithSelectedUserRole = await collection.find({
        selectedUserRole: { $exists: true }
      }).toArray();

      if (documentsWithSelectedUserRole.length > 0) {
        console.log(`    🔄 Found ${documentsWithSelectedUserRole.length} documents with selectedUserRole property`);
        console.log(`    📦 Processing in batches of ${batchSize} documents...`);

        // Process documents in batches
        for (let i = 0; i < documentsWithSelectedUserRole.length; i += batchSize) {
          const batch = documentsWithSelectedUserRole.slice(i, i + batchSize);
          const batchNumber = Math.floor(i / batchSize) + 1;
          const totalBatches = Math.ceil(documentsWithSelectedUserRole.length / batchSize);

          console.log(`    🚀 Processing batch ${batchNumber}/${totalBatches} (${batch.length} documents)`);

          try {
            // Create bulk operations for this batch
            const bulkOperations = batch.map(doc => ({
              updateOne: {
                filter: { _id: doc._id },
                update: {
                  $rename: {
                    selectedUserRole: 'selectedUserAssistant'
                  }
                }
              }
            }));

            // Execute bulk operation
            const bulkResult = await collection.bulkWrite(bulkOperations, { ordered: false });

            totalUpdated += bulkResult.modifiedCount;
            console.log(`    ✅ Batch ${batchNumber} completed: ${bulkResult.modifiedCount}/${batch.length} documents updated`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Short delay to avoid overwhelming the DB

            if (bulkResult.writeErrors && bulkResult.writeErrors.length > 0) {
              console.warn(`    ⚠️  Batch ${batchNumber} had ${bulkResult.writeErrors.length} errors`);
              bulkResult.writeErrors.forEach(error => {
                console.error(`      ❌ Error: ${error.errmsg}`);
              });
            }
          } catch (error) {
            console.error(`    ❌ Error processing batch ${batchNumber}:`, error.message);
          }
        }

        migrationResults.push({
          database: targetDbName,
          collection: targetCollectionName,
          documentsFound: documentsWithSelectedUserRole.length,
          documentsUpdated: totalUpdated
        });
      } else {
        console.log(`    ℹ️  No documents with selectedUserRole property found`);
      }
    } catch (error) {
      console.error(`  ❌ Error processing collection ${targetCollectionName}:`, error.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('SELECTEUSERROLE TO SELECTEDUSERASSISTANT MIGRATION SUMMARY');
    console.log('='.repeat(60));

    if (migrationResults.length > 0) {
      migrationResults.forEach(result => {
        console.log(`📊 ${result.database}.${result.collection}: ${result.documentsUpdated} documents updated`);
      });
    } else {
      console.log(`ℹ️  No documents with selectedUserRole property found in ${targetDbName}.user_collection`);
    }

    console.log(`\n✅ Total documents updated: ${totalUpdated}`);
    console.log('='.repeat(60));

    return {
      success: true,
      totalUpdated,
      results: migrationResults
    };

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Allow this to be run standalone for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    // Read the environment variables
    console.log('🔄 Loading environment variables from .env.local');
    await loadEnvLocal();

    console.log('🔄 Setting process environment variables');
    await setProcessEnvironment();

    await runSelecteUserRoleToSelectedUserAssistantMigration();
    console.log('✅ Standalone migration completed successfully');
  } catch (error) {
    console.error('❌ Standalone migration failed:', error);
    process.exit(1);
  }
}
