import { connectToEnvironmentDatabase } from '../utils/multiEnvConnection.js';

export class UserDetailConsolidationMigrator {
  constructor(sourceEnv, targetEnv, sourceDbName, targetDbName, teamName) {
    this.sourceEnv = sourceEnv;
    this.targetEnv = targetEnv;
    this.sourceDbName = sourceDbName;
    this.targetDbName = targetDbName;
    this.targetAisvcDbName = 'aisvc_userdb';
    this.teamName = teamName;
    this.batchSize = 1000;
  }

  /**
   * Helper method to update or add teamName to UserDetail teams array
   */
  updateUserDetailTeams(userDetail, teamName) {
    // Initialize teams array if it doesn't exist
    if (!userDetail.teams) {
      userDetail.teams = [];
    }

    // Check if team already exists in the teams array
    const teamExists = userDetail.teams.some(team =>
      (typeof team === 'string' && team === teamName) ||
      (typeof team === 'object' && team.teamName === teamName)
    );

    // Add team if it doesn't exist
    if (!teamExists) {
      userDetail.teams.push(teamName);
      return true; // Indicates team was added
    }

    return false; // Team already existed
  }

  async migrateUserDetailsToAisvcUserdb() {
    console.log(`\n🔄 UserDetail Consolidation Migration`);
    console.log(`Source: ${this.sourceEnv}/${this.sourceDbName}`);
    console.log(`Target: ${this.targetEnv}/${this.targetAisvcDbName}`);
    console.log(`Team: ${this.teamName}`);

    // Check if source and target environments are the same
    if (this.sourceEnv === this.targetEnv) {
      console.log('✅ Source and target environments are the same, skipping UserDetail consolidation migration');
      return {
        skipped: true,
        reason: 'Source and target environments are the same',
        migratedDocuments: 0
      };
    }

    try {
      // Connect to source and target databases
      const sourceDb = await connectToEnvironmentDatabase(this.sourceEnv, this.sourceDbName);
      const targetAisvcDb = await connectToEnvironmentDatabase(this.targetEnv, this.targetAisvcDbName);

      // Get UserDetail collection from source
      const sourceCollection = sourceDb.collection('user_collection');
      const targetCollection = targetAisvcDb.collection('user_collection');
      debugger;

      // Count total UserDetail documents in source
      const totalUserDetails = await sourceCollection.countDocuments({ type: 'UserDetail' });
      console.log(`📊 Found ${totalUserDetails} UserDetail documents to migrate`);

      if (totalUserDetails === 0) {
        console.log('✅ No UserDetail documents found in source database');
        return {
          skipped: true,
          reason: 'No UserDetail documents found in source',
          migratedDocuments: 0
        };
      }

      // Check for existing UserDetail documents in target to avoid duplicates
      const existingUserDetails = await targetCollection.countDocuments({ type: 'UserDetail' });
      console.log(`📊 Found ${existingUserDetails} existing UserDetail documents in target aisvc_userdb`);

      // Get all UserDetail documents from source
      const userDetails = await sourceCollection.find({ type: 'UserDetail' }).toArray();

      let migratedCount = 0;
      let skippedCount = 0;
      let updatedTeamsCount = 0;
      const errors = [];

      // Process in batches
      for (let i = 0; i < userDetails.length; i += this.batchSize) {
        const batch = userDetails.slice(i, i + this.batchSize);
        console.log(`Processing batch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(userDetails.length / this.batchSize)}`);

        for (const userDetail of batch) {
          try {
            // Check if UserDetail already exists in target (by _id or unique identifier)
            const existingUserDetail = await targetCollection.findOne({ _id: userDetail._id });

            if (existingUserDetail) {
              // console.log(`🔄 UserDetail with id ${userDetail._id} already exists in target, updating teams...`);

              // Update teams for existing UserDetail
              const teamWasAdded = this.updateUserDetailTeams(existingUserDetail, this.teamName);

              if (teamWasAdded) {
                // Update the document in the database
                await targetCollection.updateOne(
                  { _id: existingUserDetail._id },
                  { $set: { teams: existingUserDetail.teams } }
                );
                // console.log(`✅ Added team '${this.teamName}' to existing UserDetail ${existingUserDetail._id}`);
                updatedTeamsCount++;
              } else {
                console.log(`ℹ️  Team '${this.teamName}' already exists for UserDetail ${existingUserDetail._id}`);
              }

              skippedCount++;
              continue;
            }

            // Check for duplicate by nuid if available
            if (userDetail.nuid) {
              const existingByNuid = await targetCollection.findOne({ nuid: userDetail.nuid, type: 'UserDetail' });
              if (existingByNuid) {
                console.log(`🔄 UserDetail with nuid ${userDetail.nuid} already exists in target, updating teams...`);

                // Update teams for existing UserDetail found by nuid
                const teamWasAdded = this.updateUserDetailTeams(existingByNuid, this.teamName);

                if (teamWasAdded) {
                  // Update the document in the database
                  await targetCollection.updateOne(
                    { _id: existingByNuid._id },
                    { $set: { teams: existingByNuid.teams } }
                  );
                  console.log(`✅ Added team '${this.teamName}' to existing UserDetail with nuid ${userDetail.nuid}`);
                  updatedTeamsCount++;
                } else {
                  console.log(`ℹ️  Team '${this.teamName}' already exists for UserDetail with nuid ${userDetail.nuid}`);
                }

                skippedCount++;
                continue;
              }
            }

            // Update teams for the new UserDetail before inserting
            this.updateUserDetailTeams(userDetail, this.teamName);

            // Insert UserDetail into target aisvc_userdb
            await targetCollection.insertOne(userDetail);
            migratedCount++;
            console.log(`✅ Migrated UserDetail ${userDetail.nuid} with team '${this.teamName}' added`);

            if (migratedCount % 100 === 0) {
              console.log(`✅ Migrated ${migratedCount}/${totalUserDetails} UserDetail documents`);
            }

          } catch (error) {
            console.error(`❌ Error migrating UserDetail ${userDetail.nuid}:`, error.message);
            errors.push({
              documentId: userDetail.nuid,
              error: error.message
            });
          }
        }
      }

      console.log(`\n📊 UserDetail Migration Summary:`);
      console.log(`   Total documents found: ${totalUserDetails}`);
      console.log(`   Successfully migrated: ${migratedCount}`);
      console.log(`   Skipped (duplicates): ${skippedCount}`);
      console.log(`   Teams updated: ${updatedTeamsCount}`);
      console.log(`   Errors: ${errors.length}`);

      if (errors.length > 0) {
        console.log(`\n❌ Migration errors:`);
        errors.forEach(error => {
          console.log(`   Document ${error.documentId}: ${error.error}`);
        });
      }

      debugger;

      return {
        skipped: false,
        totalDocuments: totalUserDetails,
        migratedDocuments: migratedCount,
        skippedDocuments: skippedCount,
        teamsUpdated: updatedTeamsCount,
        errors: errors
      };

    } catch (error) {
      console.error(`💥 UserDetail consolidation migration failed:`, error);
      throw error;
    }
  }
}

export async function migrateUserDetailsToAisvcUserdb(sourceEnv, targetEnv, sourceDbName, targetDbName, teamName) {
  const migrator = new UserDetailConsolidationMigrator(sourceEnv, targetEnv, sourceDbName, targetDbName, teamName);
  return await migrator.migrateUserDetailsToAisvcUserdb();
}