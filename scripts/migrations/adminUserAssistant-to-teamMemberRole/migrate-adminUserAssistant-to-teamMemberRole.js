'use server';

import { selectDocumentsExt } from '../../../db/selectDocument.js';
import { connectToEnvironmentDatabase } from '../utils/multiEnvConnection.js';
import { validateBasicMulti } from '../../../app/services/validation.js';

/**
 * Migration script to convert admin UserAssistant documents to TeamMember admin roles
 * 1. Find all UserAssistant documents where assistantName is 'admin'
 * 2. For each, find the corresponding TeamMember document by nuid
 * 3. Add 'admin' to the TeamMember's roles array if not already present
 * 4. Delete the original UserAssistant document
 * 5. Validate that deleted count matches modified count
 */
export async function migrateAdminUserAssistantToTeamMemberRole(targetEnv = 'dev', targetDbName = 'team-kpit-ai-portal-members-db', teamId = 'ecbebd4c-0167-4d10-8701-4d7ba3527f4e', teamName = 'kpit-ai-portal-members', batchSize = 12) {
  const BATCH_SIZE = batchSize;

  try {
    console.log('Starting migration from admin UserAssistant to TeamMember admin role...');

    // Step 1: Find all UserAssistant documents where assistantName is 'admin'
    console.log('Fetching all admin UserAssistants...');
    const adminUserAssistants = await selectDocumentsExt(
      {
        type: 'UserAssistant',
        assistantName: 'admin',
        teamId: teamId
      },
      validateBasicMulti,
      {},
      targetDbName,
      'user_collection'
    );
    console.log(`Found ${adminUserAssistants.length} admin UserAssistants for team ${teamName}`);

    if (adminUserAssistants.length === 0) {
      console.log('No admin UserAssistants found to migrate');
      return {
        adminUserAssistantsFound: 0,
        teamMembersModified: 0,
        userAssistantsDeleted: 0,
        skipped: 0,
        success: true
      };
    }

    // Step 2: Get all existing TeamMembers for this team
    console.log('Fetching all TeamMembers...');
    const teamMembers = await selectDocumentsExt(
      {
        type: 'TeamMember',
        teamId: teamId
      },
      validateBasicMulti,
      {},
      targetDbName,
      'user_collection'
    );
    console.log(`Found ${teamMembers.length} TeamMembers for team ${teamName}`);

    // Create a map of nuid -> TeamMember for quick lookup
    const teamMemberMap = new Map();
    teamMembers.forEach(tm => {
      if (tm.nuid) {
        teamMemberMap.set(tm.nuid, tm);
      }
    });

    // Step 3: Process admin UserAssistants and prepare TeamMember updates
    const teamMembersToUpdate = [];
    const userAssistantsToDelete = [];
    let skippedCount = 0;

    console.log('Processing admin UserAssistants...');
    for (const adminUA of adminUserAssistants) {
      if (!adminUA.nuid) {
        console.warn(`Skipping UserAssistant ${adminUA.id} - no nuid`);
        skippedCount++;
        continue;
      }

      const teamMember = teamMemberMap.get(adminUA.nuid);
      if (!teamMember) {
        console.warn(`Skipping UserAssistant ${adminUA.id} - no corresponding TeamMember found for nuid: ${adminUA.nuid}`);
        skippedCount++;
        continue;
      }

      // Check if 'admin' role is already present
      const currentRoles = teamMember.roles || [];
      if (!currentRoles.includes('admin')) {
        // Prepare TeamMember update
        const updatedRoles = [...currentRoles, 'admin'];
        teamMembersToUpdate.push({
          updateOne: {
            filter: { id: teamMember.id },
            update: {
              $set: {
                roles: updatedRoles,
                updatedAt: new Date()
              }
            }
          }
        });
        console.log(`Will add admin role to TeamMember for nuid: ${adminUA.nuid}`);
      } else {
        console.log(`TeamMember for nuid: ${adminUA.nuid} already has admin role`);
      }

      // Always delete the UserAssistant (whether role was added or already present)
      userAssistantsToDelete.push(adminUA.id);
    }

    console.log(`Prepared ${teamMembersToUpdate.length} TeamMember updates`);
    console.log(`Prepared ${userAssistantsToDelete.length} UserAssistant deletions`);
    console.log(`Skipped ${skippedCount} UserAssistants`);

    // Step 4: Execute TeamMember updates in batches
    let totalUpdated = 0;
    if (teamMembersToUpdate.length > 0) {
      console.log('Updating TeamMembers with admin roles...');

      // Get database connection for direct MongoDB operations
      const db = await connectToEnvironmentDatabase(targetEnv, targetDbName);
      const collection = db.collection('user_collection');

      for (let i = 0; i < teamMembersToUpdate.length; i += BATCH_SIZE) {
        const batch = teamMembersToUpdate.slice(i, i + BATCH_SIZE);
        console.log(`Processing TeamMember update batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(teamMembersToUpdate.length / BATCH_SIZE)}`);

        const updateResult = await collection.bulkWrite(batch, { ordered: false });
        totalUpdated += updateResult.modifiedCount || 0;
        console.log(`  Updated ${updateResult.modifiedCount || 0} TeamMembers in this batch`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Short delay to avoid overwhelming the DB
      }
    }

    // Step 5: Execute UserAssistant deletions in batches
    let totalDeleted = 0;
    if (userAssistantsToDelete.length > 0) {
      console.log('Deleting admin UserAssistants...');

      // Get database connection for direct MongoDB operations
      const db = await connectToEnvironmentDatabase(targetEnv, targetDbName);
      const collection = db.collection('user_collection');

      for (let i = 0; i < userAssistantsToDelete.length; i += BATCH_SIZE) {
        const batch = userAssistantsToDelete.slice(i, i + BATCH_SIZE);
        console.log(`Processing UserAssistant deletion batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(userAssistantsToDelete.length / BATCH_SIZE)}`);

        const deleteResult = await collection.deleteMany({
          id: { $in: batch }
        });
        totalDeleted += deleteResult.deletedCount || 0;
        console.log(`  Deleted ${deleteResult.deletedCount || 0} UserAssistants in this batch`);
        await new Promise(resolve => setTimeout(resolve, 500)); // Short delay to avoid overwhelming the DB
      }
    }

    // Step 6: Validation
    console.log('\n=== VALIDATION ===');
    console.log(`Admin UserAssistants found: ${adminUserAssistants.length}`);
    console.log(`TeamMembers updated: ${totalUpdated}`);
    console.log(`UserAssistants deleted: ${totalDeleted}`);
    console.log(`Skipped: ${skippedCount}`);

    // The validation should ensure all UserAssistants were deleted
    const expectedDeletions = adminUserAssistants.length - skippedCount;
    const validationSuccess = totalDeleted === expectedDeletions;

    if (!validationSuccess) {
      console.error(`❌ Validation failed: Expected ${expectedDeletions} deletions, but got ${totalDeleted}`);
    } else {
      console.log('✅ Validation successful: All eligible admin UserAssistants were processed');
    }

    // Step 7: Delete the admin Assistant document
    let adminAssistantDeleted = 0;
    console.log('\n=== DELETING ADMIN ASSISTANT ===');

    try {
      // Get database connection for direct MongoDB operations
      const db = await connectToEnvironmentDatabase(targetEnv, targetDbName);
      const collection = db.collection('user_collection');

      // Delete the admin Assistant document
      const deleteAdminAssistantResult = await collection.deleteMany({
        type: 'Assistant',
        name: 'admin',
        teamId: teamId
      });

      adminAssistantDeleted = deleteAdminAssistantResult.deletedCount || 0;
      console.log(`✅ Deleted ${adminAssistantDeleted} admin Assistant document(s)`);

    } catch (error) {
      console.error(`❌ Failed to delete admin Assistant: ${error.message}`);
    }

    // Final result
    const result = {
      adminUserAssistantsFound: adminUserAssistants.length,
      teamMembersModified: totalUpdated,
      userAssistantsDeleted: totalDeleted,
      adminAssistantDeleted: adminAssistantDeleted,
      skipped: skippedCount,
      success: validationSuccess
    };

    console.log('\n=== MIGRATION SUMMARY ===');
    console.log(`✅ Admin UserAssistants found: ${result.adminUserAssistantsFound}`);
    console.log(`✅ TeamMembers modified: ${result.teamMembersModified}`);
    console.log(`✅ UserAssistants deleted: ${result.userAssistantsDeleted}`);
    console.log(`✅ Admin Assistant deleted: ${result.adminAssistantDeleted}`);
    console.log(`⚠️  Skipped: ${result.skipped}`);
    console.log(`${result.success ? '✅' : '❌'} Migration ${result.success ? 'completed successfully' : 'failed validation'}`);

    return result;

  } catch (error) {
    console.error('Migration failed:', error);
    return {
      adminUserAssistantsFound: 0,
      teamMembersModified: 0,
      userAssistantsDeleted: 0,
      adminAssistantDeleted: 0,
      skipped: 0,
      success: false,
      error: error.message
    };
  }
}

/**
 * Verification function to check the migration results
 */
export async function verifyAdminUserAssistantMigration(targetEnv = 'dev', targetDbName = 'team-kpit-ai-portal-members-db', teamId = 'ecbebd4c-0167-4d10-8701-4d7ba3527f4e') {
  try {
    console.log('\n=== VERIFICATION ===');

    // Check for any remaining admin UserAssistants
    const remainingAdminUA = await selectDocumentsExt(
      {
        type: 'UserAssistant',
        assistantName: 'admin',
        teamId: teamId
      },
      validateBasicMulti,
      {},
      targetDbName,
      'user_collection'
    );

    // Check TeamMembers with admin role
    const teamMembersWithAdmin = await selectDocumentsExt(
      {
        type: 'TeamMember',
        teamId: teamId,
        roles: 'admin'
      },
      validateBasicMulti,
      {},
      targetDbName,
      'user_collection'
    );

    // Check for any remaining admin Assistant
    const remainingAdminAssistant = await selectDocumentsExt(
      {
        type: 'Assistant',
        name: 'admin',
        teamId: teamId
      },
      validateBasicMulti,
      {},
      targetDbName,
      'user_collection'
    );

    console.log(`Remaining admin UserAssistants: ${remainingAdminUA.length} (should be 0)`);
    console.log(`TeamMembers with admin role: ${teamMembersWithAdmin.length}`);
    console.log(`Remaining admin Assistant: ${remainingAdminAssistant.length} (should be 0)`);

    const verificationSuccess = remainingAdminUA.length === 0 && remainingAdminAssistant.length === 0;

    return {
      remainingAdminUserAssistants: remainingAdminUA.length,
      teamMembersWithAdminRole: teamMembersWithAdmin.length,
      remainingAdminAssistant: remainingAdminAssistant.length,
      verificationSuccess
    };

  } catch (error) {
    console.error('Verification failed:', error);
    return {
      remainingAdminUserAssistants: -1,
      teamMembersWithAdminRole: -1,
      remainingAdminAssistant: -1,
      verificationSuccess: false,
      error: error.message
    };
  }
}