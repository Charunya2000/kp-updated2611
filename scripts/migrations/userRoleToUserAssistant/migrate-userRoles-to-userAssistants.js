'use server';

import { selectDocumentsExt, selectDocumentExt } from '../../../db/selectDocument.js';
import { insertBulkDocuments } from '../../../db/insertDocument.js';
import { validateBasicMulti } from '../../../app/services/validation.js';
import { v4 } from 'uuid';
import { updateDocument } from '../../..//db/updateDocument.js';

/**
 * Migration script to copy userRoles to UserAssistants
 * Maps userRole.roleId to Assistant._id via UserAssistant.assistantId
 */
export async function migrateUserRolesToUserAssistants(targetEnv = 'dev', targetDbName = 'team-kpit-ai-portal-members-db', teamName = 'kpit-ai-portal-members', batchSize = 12) {
  const BATCH_SIZE = batchSize;

  try {
    console.log('Starting migration from userRoles to UserAssistants...');

    // Step 1: Check if any UserAssistants already exist (resume capability)
    console.log('Checking for existing UserAssistants...');
    const existingUserAssistants = await selectDocumentsExt({ type: 'UserAssistant' }, validateBasicMulti, {}, targetDbName, 'user_collection');
    console.log(`Found ${existingUserAssistants.length} existing UserAssistants`);

    // Step 2: Fetch all existing userRoles
    console.log('Fetching all userRoles...');
    const allUserRoles = await selectDocumentsExt({ type: 'userRole' }, validateBasicMulti, {}, targetDbName, 'user_collection');
    console.log(`Found ${allUserRoles.length} total userRoles`);

    // Step 3: Filter out userRoles that already have UserAssistants
    const existingUserRoleIds = new Set(
      existingUserAssistants
        .filter(ua => ua._migrationInfo?.originalUserRoleId)
        .map(ua => ua._migrationInfo.originalUserRoleId.toString())
    );

    const userRoles = allUserRoles.filter(ur => !existingUserRoleIds.has(ur._id.toString()));
    console.log(`Found ${userRoles.length} userRoles remaining to migrate (${allUserRoles.length - userRoles.length} already migrated)`);

    if (userRoles.length === 0) {
      console.log('All userRoles have already been migrated to UserAssistants');
      return {
        totalUserRoles: allUserRoles.length,
        alreadyMigrated: existingUserAssistants.length,
        newlyMigrated: 0,
        skipped: 0
      };
    }

    // Step 4: Fetch all existing Assistants (formerly roles)
    console.log('Fetching all Assistants...');
    const assistants = await selectDocumentsExt({ type: 'Assistant' }, validateBasicMulti, {}, targetDbName, 'user_collection');
    console.log(`Found ${assistants.length} Assistants available for mapping`);

    // Step 5: Create a mapping from old role ObjectId to Assistant data
    const roleToAssistantMap = new Map();

    // Create mapping using _migrationInfo - map original role ObjectId to Assistant data
    for (const assistant of assistants) {
      // Only use migration info to map original role ObjectId to Assistant data
      if (assistant._migrationInfo && assistant._migrationInfo.originalId && assistant.id) {
        roleToAssistantMap.set(assistant._migrationInfo.originalId.toString(), {
          id: assistant.id,
          name: assistant.name,
          teamName: assistant.teamName || teamName, // fallback to provided team
          teamId: assistant.teamId
        });
      }
    }

    console.log(`Created mapping for ${roleToAssistantMap.size} role-to-assistant relationships`);

    // Step 6: Process userRoles in batches
    const timestamp = new Date();
    let totalSuccessfulMappings = 0;
    let totalFailedMappings = 0;
    let totalInserted = 0;

    const totalBatches = Math.ceil(userRoles.length / BATCH_SIZE);
    console.log(`Processing ${userRoles.length} userRoles in ${totalBatches} batches of ${BATCH_SIZE}`);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * BATCH_SIZE;
      const endIndex = Math.min(startIndex + BATCH_SIZE, userRoles.length);
      const batchUserRoles = userRoles.slice(startIndex, endIndex);

      console.log(`\nProcessing batch ${batchIndex + 1}/${totalBatches} (${batchUserRoles.length} userRoles)...`);

      const userAssistantsToCreate = [];
      let batchSuccessfulMappings = 0;
      let batchFailedMappings = 0;

      // Process each userRole in the current batch
      for (const userRole of batchUserRoles) {
        try {
          // Try to find the corresponding Assistant using migration info only
          let assistantData = null;

          // Map userRole.roleId (ObjectId) to Assistant data via _migrationInfo.originalId
          assistantData = roleToAssistantMap.get(userRole.roleId.toString());

          if (!assistantData) {
            // No mapping found - this means the Assistant doesn't have proper migration info
            console.warn(`Could not find Assistant mapping for roleId: ${userRole.roleId}. UserRole will be skipped.`);
            batchFailedMappings++;
            continue;
          }

          // Create UserAssistant document with enhanced data
          const userAssistant = {
            type: 'UserAssistant',
            id: v4(),
            nuid: userRole.userNUID,
            assistantId: assistantData.id,
            assistantName: assistantData.name,
            teamName: assistantData.teamName,
            teamId: assistantData.teamId,
            createdAt: timestamp,
            updatedAt: timestamp,
            _migrationInfo: {
              sourceType: 'userRole',
              originalUserRoleId: userRole._id,
              originalRoleId: userRole.roleId,
              userNUID: userRole.userNUID,
            }
          };

          userAssistantsToCreate.push(userAssistant);
          batchSuccessfulMappings++;

        } catch (error) {
          console.error(`Error processing userRole ${userRole._id}:`, error);
          batchFailedMappings++;
        }
      }

      // Insert the current batch
      if (userAssistantsToCreate.length > 0) {
        try {
          console.log(`Inserting batch of ${userAssistantsToCreate.length} UserAssistants...`);
          await insertBulkDocuments(userAssistantsToCreate, validateBasicMulti, targetDbName, 'user_collection');
          totalInserted += userAssistantsToCreate.length;
          console.log(`✅ Successfully inserted ${userAssistantsToCreate.length} UserAssistants`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Short delay to avoid overwhelming the DB
        } catch (error) {
          console.error(`❌ Failed to insert batch ${batchIndex + 1}:`, error);
          throw error; // Stop processing if batch insert fails
        }
      } else {
        console.log(`No UserAssistants to insert for batch ${batchIndex + 1}`);
      }

      totalSuccessfulMappings += batchSuccessfulMappings;
      totalFailedMappings += batchFailedMappings;

      console.log(`Batch ${batchIndex + 1} complete: ${batchSuccessfulMappings} mapped, ${batchFailedMappings} failed, ${userAssistantsToCreate.length} inserted`);
    }

    // Step 7: Find UserDetail for each unique NUID in userRoles, then add the team to the UserDetail
    const uniqueNUIDs = new Set(userRoles.map(ur => ur.userNUID));
    console.log(`\nUpdating UserDetail documents for ${uniqueNUIDs.size} unique NUIDs...`);

    let userDetailsUpdated = 0;
    for (const nuid of uniqueNUIDs) {
      try {
        const userDetail = await selectDocumentExt({ type: 'UserDetail', nuid: nuid }, validateBasicMulti, {}, 'aisvc_userdb', 'user_collection');
        if (!userDetail) {
          console.warn(`No UserDetail found for NUID: ${nuid}`);
          continue;
        }

        userDetail.teams = userDetail.teams || [];
        if (!userDetail.teams.includes(teamName)) {
          userDetail.teams.push(teamName);
          userDetail.updatedAt = new Date();
          // Update the UserDetail document in the database
          await updateDocument(userDetail, { type: 'UserDetail', nuid: nuid }, validateBasicMulti, 'aisvc_userdb', 'user_collection');
          userDetailsUpdated++;
        }
      } catch (error) {
        console.error(`Error updating UserDetail for NUID ${nuid}:`, error);
      }
    }
    console.log(`Updated ${userDetailsUpdated} UserDetail documents to include team: ${teamName}`);


    // Step 8: Summary
    const summary = {
      userDetailsUpdated: userDetailsUpdated,
      userDetailsSkipped: uniqueNUIDs.size - userDetailsUpdated,
      totalUserRoles: allUserRoles.length,
      alreadyMigrated: existingUserAssistants.length,
      remainingToMigrate: userRoles.length,
      newlyMigrated: totalInserted,
      totalAssistants: assistants.length,
      successfulMappings: totalSuccessfulMappings,
      failedMappings: totalFailedMappings,
      batchSize: BATCH_SIZE,
      totalBatches: totalBatches,
      migrationCompletedAt: timestamp
    };

    console.log('\n🎉 Migration completed successfully!');
    console.log('Migration Summary:', summary);

    return summary;

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Utility function to verify the migration results
 */
export async function verifyUserAssistantMigration(targetDbName = 'team-kpit-ai-portal-members-db') {
  try {
    console.log('Verifying UserAssistant migration...');

    // Count original userRoles
    const userRoles = await selectDocumentsExt({ type: 'userRole' }, validateBasicMulti, {}, targetDbName, 'user_collection');

    // Count new UserAssistants
    const userAssistants = await selectDocumentsExt({ type: 'UserAssistant' }, validateBasicMulti, {}, targetDbName, 'user_collection');

    // Count Assistants
    const assistants = await selectDocumentsExt({ type: 'Assistant' }, validateBasicMulti, {}, targetDbName, 'user_collection');

    const verification = {
      originalUserRoles: userRoles.length,
      newUserAssistants: userAssistants.length,
      availableAssistants: assistants.length,
      migrationSuccess: userAssistants.length > 0,
      verifiedAt: new Date()
    };

    console.log('Verification Results:', verification);

    // Show sample mappings
    if (userAssistants.length > 0) {
      console.log('Sample UserAssistant mappings:');
      userAssistants.slice(0, 3).forEach((ua, index) => {
        console.log(`${index + 1}. UserNUID: ${ua.userNUID}`);
        console.log(`   AssistantId: ${ua.assistantId}`);
        console.log(`   AssistantName: ${ua.assistantName || 'N/A'}`);
        console.log(`   TeamName: ${ua.teamName || 'N/A'}`);
        console.log(`   TeamId: ${ua.teamId || 'N/A'}`);
        if (ua._migrationInfo) {
          console.log(`   Migrated from UserRole: ${ua._migrationInfo.originalUserRoleId}, Original RoleId: ${ua._migrationInfo.originalRoleId}`);
        }
        console.log('');
      });
    }

    return verification;

  } catch (error) {
    console.error('Verification failed:', error);
    throw error;
  }
}

/**
 * Main migration function that can be called from a script or API endpoint
 */
export async function runMigration() {
  try {
    const migrationResult = await migrateUserRolesToUserAssistants();
    const verificationResult = await verifyUserAssistantMigration();

    return {
      migration: migrationResult,
      verification: verificationResult,
      status: 'success'
    };
  } catch (error) {
    console.error('Migration process failed:', error);
    return {
      status: 'failed',
      error: error.message
    };
  }
}
