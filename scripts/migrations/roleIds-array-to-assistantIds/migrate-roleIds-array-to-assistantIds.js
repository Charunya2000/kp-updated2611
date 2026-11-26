import { selectDocumentsExt } from '../../../db/selectDocument.js';
import { updateBulkDocuments } from '../../../db/updateDocument.js';
import { validateBasicMulti } from '../../../app/services/validation.js';

/**
 * Migration script to convert arrays of roleIds to arrays of assistantIds
 * Maps roleId ObjectIds to Assistant.ids via Assistant._migrationInfo.originalId
 */
export async function runRoleIdsArrayToAssistantIdsMigration(targetEnv = 'dev', targetDbName = 'team-kpit-ai-portal-members-db', batchSize = 12) {
  return await migrateRoleIdsArrayToAssistantIds(targetEnv, targetDbName, batchSize);
}

export async function migrateRoleIdsArrayToAssistantIds(targetEnv = 'dev', targetDbName = 'team-kpit-ai-portal-members-db', batchSize = 12) {
  const BATCH_SIZE = batchSize;

  // List of document types that have roleIds array property that need to be migrated
  const DOCUMENT_TYPES_WITH_ROLE_IDS_ARRAY = [
    // Add document types here that have roleIds array property
    // Examples: 'UserProfile', 'TeamConfig', 'ProjectSettings'
    // Add more types as needed based on your schema
  ];

  try {
    console.log('Starting migration from roleIds array to assistantIds array...');

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

    // Continue even if there are no mappings - we still want to rename the property
    if (roleToAssistantMap.size === 0) {
      console.warn('No role-to-assistant mappings found. Will still migrate roleIds to assistantIds (empty arrays).');
      console.warn('Note: Make sure the Assistants migration has been run first for proper mapping.');
    }

    // Step 3: First, discover document types that actually have roleIds arrays
    console.log('Discovering document types with roleIds arrays...');
    const discoveredTypes = await discoverDocumentTypesWithRoleIdsArray(targetDbName);

    const typesToProcess = [...new Set([...DOCUMENT_TYPES_WITH_ROLE_IDS_ARRAY, ...discoveredTypes])];
    console.log(`Found document types with roleIds arrays: ${typesToProcess.join(', ')}`);

    if (typesToProcess.length === 0) {
      console.log('No document types found with roleIds arrays');
      return {
        totalDocuments: 0,
        migrated: 0,
        skipped: 0,
        failed: 0,
        status: 'no_documents_found'
      };
    }

    // Step 4: Process each document type
    const migrationResults = {
      totalDocuments: 0,
      migrated: 0,
      skipped: 0,
      failed: 0,
      documentTypeResults: {}
    };

    for (const documentType of typesToProcess) {
      console.log(`\nProcessing document type: ${documentType}`);

      try {
        const typeResult = await migrateDocumentTypeRoleIdsArray(
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

    // Step 5: Summary
    const summary = {
      ...migrationResults,
      migrationCompletedAt: new Date(),
      mappingsAvailable: roleToAssistantMap.size,
      documentTypesProcessed: typesToProcess
    };

    console.log('\n🎉 RoleIds array migration completed!');
    console.log('Migration Summary:', summary);

    return summary;

  } catch (error) {
    console.error('RoleIds array migration failed:', error);
    throw error;
  }
}

/**
 * Discover document types that have roleIds arrays
 */
async function discoverDocumentTypesWithRoleIdsArray(targetDbName) {
  try {
    console.log('Scanning database for documents with roleIds arrays...');

    // Query for documents that have roleIds as an array property (including empty arrays)
    const documentsWithRoleIdsArray = await selectDocumentsExt(
      {
        type: { $exists: true },
        roleIds: {
          $exists: true,
          $type: 'array'
          // Removed the $not: { $size: 0 } to include empty arrays
        }
      },
      validateBasicMulti,
      {},
      targetDbName,
      'user_collection'
    );

    // Extract unique document types
    const types = [...new Set(documentsWithRoleIdsArray.map(doc => doc.type))];
    console.log(`Discovered ${types.length} document types with roleIds arrays: ${types.join(', ')}`);

    return types;
  } catch (error) {
    console.warn('Error discovering document types with roleIds arrays:', error.message);
    return [];
  }
}

/**
 * Migrate a specific document type from roleIds array to assistantIds array
 */
async function migrateDocumentTypeRoleIdsArray(documentType, roleToAssistantMap, batchSize, targetDbName) {
  // Step 1: Fetch all documents of this type that have roleIds array
  console.log(`  Fetching all ${documentType} documents with roleIds array...`);
  const documentsWithRoleIds = await selectDocumentsExt(
    {
      type: documentType,
      roleIds: {
        $exists: true,
        $type: 'array'
        // Removed the $not: { $size: 0 } to include empty arrays
      }
    },
    validateBasicMulti,
    {},
    targetDbName,
    'user_collection'
  );

  console.log(`  Found ${documentsWithRoleIds.length} ${documentType} documents with roleIds array`);

  if (documentsWithRoleIds.length === 0) {
    return {
      totalDocuments: 0,
      migrated: 0,
      skipped: 0,
      failed: 0
    };
  }

  // Step 2: Check if any already have assistantIds (resume capability)
  const documentsWithAssistantIds = await selectDocumentsExt(
    {
      type: documentType,
      assistantIds: { $exists: true }
    },
    validateBasicMulti,
    {},
    targetDbName,
    'user_collection'
  );

  const existingMigratedIds = new Set(
    documentsWithAssistantIds
      .filter(doc => doc._migrationInfo?.roleIdsArrayMigration)
      .map(doc => doc._id.toString())
  );

  // Step 3: Filter out documents that already have been migrated
  const documentsToMigrate = documentsWithRoleIds.filter(doc =>
    !existingMigratedIds.has(doc._id.toString())
  );

  console.log(`  Found ${documentsToMigrate.length} ${documentType} documents remaining to migrate (${documentsWithRoleIds.length - documentsToMigrate.length} already migrated)`);

  if (documentsToMigrate.length === 0) {
    return {
      totalDocuments: documentsWithRoleIds.length,
      migrated: 0,
      skipped: documentsWithRoleIds.length,
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
        // Convert the roleIds array to assistantIds array
        const roleIds = doc.roleIds || [];
        const assistantIds = [];
        const unmappedRoleIds = [];

        // Process each roleId in the array
        for (const roleId of roleIds) {
          const assistantId = roleToAssistantMap.get(roleId.toString());
          if (assistantId) {
            assistantIds.push(assistantId);
          } else {
            unmappedRoleIds.push(roleId.toString());
          }
        }

        // Log warnings for unmapped roleIds (but don't skip the document)
        if (unmappedRoleIds.length > 0 && roleIds.length > 0) {
          console.warn(`    Document ${doc._id}: Could not map ${unmappedRoleIds.length}/${roleIds.length} roleIds: [${unmappedRoleIds.join(', ')}]`);
        }

        // Always proceed with migration, even if no roleIds could be mapped or if array was empty
        // This ensures that the roleIds property is replaced with assistantIds property

        const migrationNote = roleIds.length === 0
          ? 'Empty roleIds array migrated to empty assistantIds array'
          : assistantIds.length === 0
            ? 'No roleIds could be mapped, but property renamed from roleIds to assistantIds'
            : `Successfully mapped ${assistantIds.length}/${roleIds.length} roleIds to assistantIds`;

        console.log(`    Document ${doc._id}: ${migrationNote}`);

        // Create updated document for bulk operation
        const updatedDocument = {
          updateOne: {
            filter: { _id: doc._id },
            update: {
              $set: {
                assistantIds: assistantIds, // Will be empty array if no mappings or originally empty
                updatedAt: timestamp,
                '_migrationInfo.roleIdsArrayMigration': {
                  migratedAt: timestamp,
                  originalRoleIds: roleIds,
                  newAssistantIds: assistantIds,
                  unmappedRoleIds: unmappedRoleIds,
                  mappingSuccess: `${assistantIds.length}/${roleIds.length}`,
                  migrationNote: migrationNote
                }
              },
              $unset: {
                roleIds: 1 // Always remove the roleIds property
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
    totalDocuments: documentsWithRoleIds.length,
    migrated: totalMigrated,
    skipped: totalSkipped + (documentsWithRoleIds.length - documentsToMigrate.length),
    failed: totalFailed
  };
}

/**
 * Utility function to verify the migration results
 */
export async function verifyRoleIdsArrayToAssistantIdsMigration(targetDbName) {
  try {
    console.log('Verifying roleIds array to assistantIds migration...');

    const verification = {
      documentTypeResults: {},
      verifiedAt: new Date()
    };

    // Discover types that might still have roleIds arrays
    const typesWithRoleIds = await discoverDocumentTypesWithRoleIdsArray(targetDbName);

    for (const documentType of typesWithRoleIds) {
      console.log(`\nVerifying ${documentType}...`);

      // Count documents with roleIds array (should be 0 after migration, including empty arrays)
      const documentsWithRoleIds = await selectDocumentsExt(
        {
          type: documentType,
          roleIds: {
            $exists: true,
            $type: 'array'
            // Include all arrays, even empty ones
          }
        },
        validateBasicMulti,
        {},
        targetDbName,
        'user_collection'
      );

      // Count documents with assistantIds array (should have increased after migration, including empty arrays)
      const documentsWithAssistantIds = await selectDocumentsExt(
        {
          type: documentType,
          assistantIds: {
            $exists: true,
            $type: 'array'
            // Include all arrays, even empty ones
          }
        },
        validateBasicMulti,
        {},
        targetDbName,
        'user_collection'
      );

      verification.documentTypeResults[documentType] = {
        documentsWithRoleIds: documentsWithRoleIds.length,
        documentsWithAssistantIds: documentsWithAssistantIds.length,
        migrationInfo: documentsWithAssistantIds.filter(doc =>
          doc._migrationInfo?.roleIdsArrayMigration
        ).length
      };

      console.log(`  ${documentType}: ${documentsWithRoleIds.length} still have roleIds, ${documentsWithAssistantIds.length} have assistantIds`);
    }

    console.log('\n✅ Verification completed');
    console.log('Verification Results:', verification);

    return verification;

  } catch (error) {
    console.error('Verification failed:', error);
    throw error;
  }
}


