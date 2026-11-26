import { selectDocumentsExt } from '../../../db/selectDocument.js';
import { updateBulkDocuments } from '../../../db/updateDocument.js';
import { validateBasicMulti } from '../../../app/services/validation.js';

/**
 * Migration script to convert roleId properties to assistantId properties
 * Maps roleId ObjectId to Assistant.id via Assistant._migrationInfo.originalId
 */
export async function runRoleIdToAssistantIdMigration(targetEnv = 'dev', targetDbName = 'team-kpit-ai-portal-members-db', batchSize = 12) {
  return await migrateRoleIdToAssistantId(targetEnv, targetDbName, batchSize);
}

export async function migrateRoleIdToAssistantId(targetEnv = 'dev', targetDbName = 'team-kpit-ai-portal-members-db', batchSize = 12) {
  const BATCH_SIZE = batchSize;

  // List of document types that have roleId property that need to be migrated
  const DOCUMENT_TYPES_WITH_ROLE_ID = [
    'SearchIndexConfig',
    // Add other document types here if they also have roleId property
    // Add more types as needed
  ];

  try {
    console.log('Starting migration from roleId to assistantId...');

    // Step 1: Fetch all existing Assistants
    console.log('Fetching all Assistants...');
    const assistants = await selectDocumentsExt(
      { type: 'Assistant' },
      validateBasicMulti,
      {},
      targetDbName,
      'user_collection'
    );
    console.log(`Found ${assistants.length} Assistants available for mapping`);

    // Step 2: Create a mapping from original role ObjectId to Assistant.id
    const roleToAssistantMap = new Map();

    for (const assistant of assistants) {
      // Map original role ObjectId to Assistant.id using migration info
      if (assistant._migrationInfo && assistant._migrationInfo.originalId && assistant.id) {
        roleToAssistantMap.set(assistant._migrationInfo.originalId.toString(), assistant.id);
      }
    }

    console.log(`Created mapping for ${roleToAssistantMap.size} role-to-assistant relationships`);

    if (roleToAssistantMap.size === 0) {
      console.warn('No role-to-assistant mappings found. Make sure the Assistants have proper _migrationInfo.originalId');
      return {
        totalDocuments: 0,
        migrated: 0,
        skipped: 0,
        failed: 0,
        status: 'no_mappings'
      };
    }

    // Step 3: Process each document type
    const migrationResults = {
      totalDocuments: 0,
      migrated: 0,
      skipped: 0,
      failed: 0,
      documentTypeResults: {}
    };

    for (const documentType of DOCUMENT_TYPES_WITH_ROLE_ID) {
      console.log(`\nProcessing document type: ${documentType}`);

      try {
        const typeResult = await migrateDocumentType(
          documentType,
          roleToAssistantMap,
          BATCH_SIZE,
          targetDbName
        );

        migrationResults.totalDocuments += typeResult.totalDocuments;
        migrationResults.migrated += typeResult.migrated;
        migrationResults.skipped += typeResult.skipped;
        migrationResults.failed += typeResult.failed;
        migrationResults.documentTypeResults[documentType] = typeResult;

        console.log(`✅ Completed ${documentType}: ${typeResult.migrated}/${typeResult.totalDocuments} documents migrated`);
      } catch (error) {
        console.error(`❌ Error processing document type ${documentType}:`, error.message);
        migrationResults.documentTypeResults[documentType] = {
          totalDocuments: 0,
          migrated: 0,
          skipped: 0,
          failed: 0,
          error: error.message
        };
      }
    }

    // Step 4: Summary
    const summary = {
      ...migrationResults,
      migrationCompletedAt: new Date(),
      mappingsAvailable: roleToAssistantMap.size,
      documentTypesProcessed: DOCUMENT_TYPES_WITH_ROLE_ID
    };

    console.log('\n🎉 Migration completed!');
    console.log('Migration Summary:', summary);

    return summary;

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Migrate a specific document type from roleId to assistantId
 */
async function migrateDocumentType(documentType, roleToAssistantMap, batchSize, targetDbName) {
  // Step 1: Fetch all documents of this type that have roleId
  console.log(`  Fetching all ${documentType} documents with roleId...`);
  const documentsWithRoleId = await selectDocumentsExt(
    {
      type: documentType,
      roleId: { $exists: true }
    },
    validateBasicMulti,
    {},
    targetDbName,
    'user_collection'
  );

  console.log(`  Found ${documentsWithRoleId.length} ${documentType} documents with roleId`);

  if (documentsWithRoleId.length === 0) {
    return {
      totalDocuments: 0,
      migrated: 0,
      skipped: 0,
      failed: 0
    };
  }

  // Step 2: Check if any already have assistantId (resume capability)
  const documentsWithAssistantId = await selectDocumentsExt(
    {
      type: documentType,
      assistantId: { $exists: true }
    },
    validateBasicMulti,
    {},
    targetDbName,
    'user_collection'
  );

  const existingAssistantIds = new Set(
    documentsWithAssistantId
      .filter(doc => doc._migrationInfo?.originalRoleId)
      .map(doc => doc._migrationInfo.originalRoleId.toString())
  );

  // Step 3: Filter out documents that already have been migrated
  const documentsToMigrate = documentsWithRoleId.filter(doc =>
    !existingAssistantIds.has(doc.roleId.toString())
  );

  console.log(`  Found ${documentsToMigrate.length} ${documentType} documents remaining to migrate (${documentsWithRoleId.length - documentsToMigrate.length} already migrated)`);

  if (documentsToMigrate.length === 0) {
    return {
      totalDocuments: documentsWithRoleId.length,
      migrated: 0,
      skipped: documentsWithRoleId.length,
      failed: 0
    };
  }

  // Step 4: Process documents in batches
  const timestamp = new Date();
  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  const totalBatches = Math.ceil(documentsToMigrate.length / batchSize);
  console.log(`  Processing ${documentsToMigrate.length} documents in ${totalBatches} batches of ${batchSize}`);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const startIndex = batchIndex * batchSize;
    const endIndex = Math.min(startIndex + batchSize, documentsToMigrate.length);
    const batchDocuments = documentsToMigrate.slice(startIndex, endIndex);

    console.log(`  Processing batch ${batchIndex + 1}/${totalBatches} (${batchDocuments.length} documents)...`);

    const documentsToUpdate = [];
    let batchMigrated = 0;
    let batchSkipped = 0;
    let batchFailed = 0;

    // Process each document in the current batch
    for (const doc of batchDocuments) {
      try {
        // Find the corresponding Assistant.id using roleId
        const assistantId = roleToAssistantMap.get(doc.roleId.toString());

        if (!assistantId) {
          console.warn(`    Could not find Assistant mapping for roleId: ${doc.roleId}. Document will be skipped.`);
          batchSkipped++;
          continue;
        }

        // Create updated document for bulk operation
        const updatedDocument = {
          updateOne: {
            filter: { _id: doc._id },
            update: {
              $set: {
                assistantId: assistantId,
                updatedAt: timestamp,
                '_migrationInfo.roleIdToAssistantIdMigration': {
                  migratedAt: timestamp,
                  originalRoleId: doc.roleId,
                  newAssistantId: assistantId
                }
              },
              $unset: {
                roleId: 1 // Remove the roleId property
              }
            }
          }
        };

        documentsToUpdate.push(updatedDocument);
        batchMigrated++;

      } catch (error) {
        console.error(`    Error processing document ${doc._id}:`, error);
        batchFailed++;
      }
    }

    // Update the current batch
    if (documentsToUpdate.length > 0) {
      try {
        console.log(`    Updating batch of ${documentsToUpdate.length} documents...`);
        await updateBulkDocuments(
          documentsToUpdate,
          false, // ordered = false for better performance
          targetDbName,
          'user_collection'
        );
        console.log(`    ✅ Successfully updated ${documentsToUpdate.length} documents`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Short delay to avoid overwhelming the DB
      } catch (error) {
        console.error(`    ❌ Failed to update batch ${batchIndex + 1}:`, error);
        batchFailed += documentsToUpdate.length;
        batchMigrated -= documentsToUpdate.length;
      }
    } else {
      console.log(`    No documents to update for batch ${batchIndex + 1}`);
    }

    totalMigrated += batchMigrated;
    totalSkipped += batchSkipped;
    totalFailed += batchFailed;

    console.log(`    Batch ${batchIndex + 1} complete: ${batchMigrated} migrated, ${batchSkipped} skipped, ${batchFailed} failed`);
  }

  return {
    totalDocuments: documentsWithRoleId.length,
    migrated: totalMigrated,
    skipped: totalSkipped + (documentsWithRoleId.length - documentsToMigrate.length),
    failed: totalFailed
  };
}

/**
 * Utility function to verify the migration results
 */
export async function verifyRoleIdToAssistantIdMigration() {
  try {
    console.log('Verifying roleId to assistantId migration...');

    const DOCUMENT_TYPES_WITH_ROLE_ID = [
      'SearchIndexConfig',
      // Add other types as needed
    ];

    const verification = {
      documentTypeResults: {},
      verifiedAt: new Date()
    };

    for (const documentType of DOCUMENT_TYPES_WITH_ROLE_ID) {
      console.log(`\nVerifying ${documentType}...`);

      // Count documents with roleId (should be 0 after migration)
      const documentsWithRoleId = await selectDocumentsExt(
        {
          type: documentType,
          roleId: { $exists: true }
        },
        validateBasicMulti,
        {},
        'team-kpit-ai-portal-members-db',
        'user_collection'
      );

      // Count documents with assistantId
      const documentsWithAssistantId = await selectDocumentsExt(
        {
          type: documentType,
          assistantId: { $exists: true }
        },
        validateBasicMulti,
        {},
        'team-kpit-ai-portal-members-db',
        'user_collection'
      );

      // Count documents with migration info
      const documentsWithMigrationInfo = await selectDocumentsExt(
        {
          type: documentType,
          '_migrationInfo.roleIdToAssistantIdMigration': { $exists: true }
        },
        validateBasicMulti,
        {},
        'team-kpit-ai-portal-members-db',
        'user_collection'
      );

      verification.documentTypeResults[documentType] = {
        documentsWithRoleId: documentsWithRoleId.length,
        documentsWithAssistantId: documentsWithAssistantId.length,
        documentsWithMigrationInfo: documentsWithMigrationInfo.length,
        migrationSuccess: documentsWithRoleId.length === 0 && documentsWithAssistantId.length > 0
      };

      console.log(`  ${documentType} verification:`);
      console.log(`    Documents with roleId: ${documentsWithRoleId.length} (should be 0)`);
      console.log(`    Documents with assistantId: ${documentsWithAssistantId.length}`);
      console.log(`    Documents with migration info: ${documentsWithMigrationInfo.length}`);

      // Show sample migrated documents
      if (documentsWithAssistantId.length > 0) {
        console.log(`\n  Sample migrated ${documentType} documents:`);
        documentsWithAssistantId.slice(0, 2).forEach((doc, index) => {
          console.log(`    ${index + 1}. ID: ${doc._id}`);
          console.log(`       AssistantId: ${doc.assistantId}`);
          console.log(`       Type: ${doc.type}`);
          if (doc._migrationInfo?.roleIdToAssistantIdMigration) {
            console.log(`       Original RoleId: ${doc._migrationInfo.roleIdToAssistantIdMigration.originalRoleId}`);
            console.log(`       Migrated At: ${doc._migrationInfo.roleIdToAssistantIdMigration.migratedAt}`);
          }
          console.log('');
        });
      }
    }

    console.log('\nVerification Results:', verification);
    return verification;

  } catch (error) {
    console.error('Verification failed:', error);
    throw error;
  }
}


