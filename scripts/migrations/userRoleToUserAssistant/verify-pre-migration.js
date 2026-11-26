#!/usr/bin/env node

/**
 * Pre-migration verification script
 * Run this before the migration to check your data structure
 */

import { selectDocumentsExt } from '../../../db/selectDocument.js';
import { validateBasicMulti } from '../../../app/services/validation.js';

async function verifyDataStructure() {
  console.log('='.repeat(60));
  console.log('Pre-Migration Data Structure Verification');
  console.log('='.repeat(60));

  try {
    // Check userRoles
    console.log('\n📋 Checking userRoles...');
    const userRoles = await selectDocumentsExt({ type: 'userRole' }, validateBasicMulti);
    console.log(`Found ${userRoles.length} userRole documents`);

    if (userRoles.length > 0) {
      console.log('\nSample userRole structure:');
      const sample = userRoles[0];
      console.log(JSON.stringify({
        _id: sample._id,
        type: sample.type,
        userNUID: sample.userNUID,
        roleId: sample.roleId,
        createdAt: sample.createdAt,
        _migrationInfo: sample._migrationInfo || 'Not present'
      }, null, 2));
    }

    // Check Assistants
    console.log('\n🤖 Checking Assistants...');
    const assistants = await selectDocumentsExt({ type: 'Assistant' }, validateBasicMulti);
    console.log(`Found ${assistants.length} Assistant documents`);

    if (assistants.length > 0) {
      console.log('\nSample Assistant structure:');
      const sample = assistants[0];
      console.log(JSON.stringify({
        _id: sample._id,
        id: sample.id, // Show the id field that will be used in assistantId
        type: sample.type,
        name: sample.name,
        displayName: sample.displayName,
        category: sample.category,
        teamId: sample.teamId,
        teamName: sample.teamName,
        _migrationInfo: sample._migrationInfo || 'Not present'
      }, null, 2));

      // Check migration info availability and id field
      const assistantsWithMigrationInfo = assistants.filter(a => a._migrationInfo && a._migrationInfo.originalId);
      const assistantsWithIdField = assistants.filter(a => a.id);
      console.log(`\n📊 Assistants with migration info: ${assistantsWithMigrationInfo.length}/${assistants.length}`);
      console.log(`📊 Assistants with id field: ${assistantsWithIdField.length}/${assistants.length}`);

      if (assistantsWithMigrationInfo.length === 0) {
        console.log('⚠️  WARNING: No Assistants have migration info. The migration may not be able to map userRoles correctly.');
        console.log('   Make sure your Assistants were migrated from the original roles with proper _migrationInfo.');
      }

      if (assistantsWithIdField.length === 0) {
        console.log('⚠️  WARNING: No Assistants have an id field. The migration requires Assistant.id to map to UserAssistant.assistantId.');
      }
    }

    // Check existing UserAssistants
    console.log('\n👥 Checking existing UserAssistants...');
    const userAssistants = await selectDocumentsExt({ type: 'UserAssistant' }, validateBasicMulti);
    console.log(`Found ${userAssistants.length} existing UserAssistant documents`);

    if (userAssistants.length > 0) {
      console.log('⚠️  UserAssistants already exist. Migration will skip duplicates.');
    }

    // Migration readiness check
    console.log('\n🔍 Migration Readiness Check:');
    console.log(`✅ UserRoles found: ${userRoles.length > 0 ? 'Yes' : 'No'}`);
    console.log(`✅ Assistants found: ${assistants.length > 0 ? 'Yes' : 'No'}`);

    const assistantsWithMigrationInfo = assistants.filter(a => a._migrationInfo && a._migrationInfo.originalId);
    const assistantsWithIdField = assistants.filter(a => a.id);
    console.log(`✅ Assistants with migration info: ${assistantsWithMigrationInfo.length > 0 ? 'Yes' : 'No'}`);
    console.log(`✅ Assistants with id field: ${assistantsWithIdField.length > 0 ? 'Yes' : 'No'}`);

    const readyForMigration = userRoles.length > 0 && assistants.length > 0 && assistantsWithMigrationInfo.length > 0 && assistantsWithIdField.length > 0;
    console.log(`\n🚀 Ready for migration: ${readyForMigration ? '✅ YES' : '❌ NO'}`);

    if (!readyForMigration) {
      console.log('\n❌ Prerequisites not met:');
      if (userRoles.length === 0) console.log('   - No userRoles found to migrate');
      if (assistants.length === 0) console.log('   - No Assistants found to map to');
      if (assistantsWithMigrationInfo.length === 0) console.log('   - Assistants missing migration info for mapping');
      if (assistantsWithIdField.length === 0) console.log('   - Assistants missing id field for UserAssistant.assistantId mapping');
    }

    return {
      userRolesCount: userRoles.length,
      assistantsCount: assistants.length,
      assistantsWithMigrationInfo: assistantsWithMigrationInfo.length,
      assistantsWithIdField: assistantsWithIdField.length,
      readyForMigration
    };

  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    throw error;
  }
}

// Run the verification
verifyDataStructure()
  .then(result => {
    console.log('\n' + '='.repeat(60));
    console.log('Verification completed successfully!');
    console.log('='.repeat(60));
  })
  .catch(error => {
    console.error('Verification failed:', error);
    process.exit(1);
  });
