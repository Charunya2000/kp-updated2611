'use server';

import { selectDocumentsExt } from '../../../db/selectDocument.js';
import { insertBulkDocuments } from '../../../db/insertDocument.js';
import { validateBasicMulti } from '../../../app/services/validation.js';
import { v4 as uuidv4 } from 'uuid';
import { loadEnvLocal } from '../../../utils/envLoader.js'
import { setProcessEnvironment } from '../../../scripts/configActions.js'

/**
 * Migration script to extract unique nuids from UserAssistant documents
 * and create TeamMember documents for each unique nuid
 */
export async function migrateUserAssistantsToTeamMembers(targetEnv = 'dev', targetDbName = 'team-kpit-ai-portal-members-db', teamId = 'ecbebd4c-0167-4d10-8701-4d7ba3527f4e', teamName = 'kpit-ai-portal-members', batchSize = 12) {
  const BATCH_SIZE = batchSize;

  try {
    console.log('Starting migration from UserAssistants to TeamMembers...');

    // Step 1: Check if any TeamMembers already exist (resume capability)
    console.log('Checking for existing TeamMembers...');
    const existingTeamMembers = await selectDocumentsExt(
      { type: 'TeamMember', teamId: teamId },
      validateBasicMulti,
      {},
      targetDbName,
      'user_collection'
    );
    console.log(`Found ${existingTeamMembers.length} existing TeamMembers for team ${teamName}`);

    // Create a set of existing NUIDs to avoid duplicates
    const existingNUIDs = new Set(existingTeamMembers.map(tm => tm.nuid));
    console.log(`Found ${existingNUIDs.size} unique NUIDs already in TeamMembers`);

    // Step 2: Fetch all UserAssistant documents
    console.log('Fetching all UserAssistant documents...');
    const userAssistants = await selectDocumentsExt(
      { type: 'UserAssistant' },
      validateBasicMulti,
      {},
      targetDbName,
      'user_collection'
    );
    console.log(`Found ${userAssistants.length} UserAssistant documents`);

    if (userAssistants.length === 0) {
      console.log('No UserAssistant documents found to process');
      return {
        totalUserAssistants: 0,
        uniqueNUIDs: 0,
        alreadyExisting: 0,
        newTeamMembers: 0
      };
    }

    // Step 3: Extract unique nuids from UserAssistant documents
    console.log('Extracting unique nuids from UserAssistant documents...');
    const uniqueNUIDs = new Set();

    userAssistants.forEach(userAssistant => {
      if (userAssistant.nuid && typeof userAssistant.nuid === 'string') {
        uniqueNUIDs.add(userAssistant.nuid);
      }
    });

    console.log(`Found ${uniqueNUIDs.size} unique nuids in UserAssistant documents`);

    // Step 4: Filter out NUIDs that already have TeamMember documents
    const newNUIDs = Array.from(uniqueNUIDs).filter(nuid => !existingNUIDs.has(nuid));
    console.log(`Found ${newNUIDs.length} new NUIDs to create TeamMember documents for`);

    if (newNUIDs.length === 0) {
      console.log('All unique NUIDs already have TeamMember documents');
      return {
        totalUserAssistants: userAssistants.length,
        uniqueNUIDs: uniqueNUIDs.size,
        alreadyExisting: existingNUIDs.size,
        newTeamMembers: 0
      };
    }

    // Step 5: Create TeamMember documents for new NUIDs
    console.log(`Creating ${newNUIDs.length} TeamMember documents...`);
    const currentDate = new Date();
    const teamMemberDocuments = [];

    for (const nuid of newNUIDs) {
      const teamMemberDoc = {
        type: 'TeamMember',
        nuid: nuid,
        teamId: teamId,
        teamName: teamName,
        createdBy: 'C597732',
        updatedBy: 'C597732',
        id: uuidv4(),
        createdAt: currentDate,
        updatedAt: currentDate,
        app: 'SmartNotes',
        roles: ['member'],
        _migrationInfo: {
          migratedFrom: 'UserAssistant',
          migrationDate: currentDate,
          migrationScript: 'migrate-userAssistants-to-teamMembers.js'
        }
      };

      teamMemberDocuments.push(teamMemberDoc);
    }

    // Step 6: Insert TeamMember documents in batches
    let insertedCount = 0;
    for (let i = 0; i < teamMemberDocuments.length; i += BATCH_SIZE) {
      const batch = teamMemberDocuments.slice(i, i + BATCH_SIZE);
      console.log(`Inserting batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} documents)...`);

      try {
        await insertBulkDocuments(
          batch,
          validateBasicMulti,
          targetDbName,
          'user_collection'
        );
        insertedCount += batch.length;
        console.log(`✅ Successfully inserted batch of ${batch.length} TeamMember documents`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Short delay to avoid overwhelming the DB
      } catch (error) {
        console.error(`❌ Failed to insert batch starting at index ${i}:`, error);
        throw error;
      }
    }

    console.log(`✅ Migration completed successfully!`);
    console.log(`Total UserAssistant documents processed: ${userAssistants.length}`);
    console.log(`Unique NUIDs found: ${uniqueNUIDs.size}`);
    console.log(`Already existing TeamMembers: ${existingNUIDs.size}`);
    console.log(`New TeamMember documents created: ${insertedCount}`);

    return {
      totalUserAssistants: userAssistants.length,
      uniqueNUIDs: uniqueNUIDs.size,
      alreadyExisting: existingNUIDs.size,
      newTeamMembers: insertedCount
    };

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}


// (async () => {
//   debugger;
//   console.log('Loading environment variables...');
//   loadEnvLocal();

//   console.log('Setting up environment configuration...');
//   await setProcessEnvironment();

//   console.log('Connecting to database...');
//   await migrateUserAssistantsToTeamMembers();

//   console.log('Migration script finished.');
//   process.exit(0);
// })();
