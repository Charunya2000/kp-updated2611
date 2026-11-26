import { loadEnvLocal } from '../../utils/envLoader.js';
import { setProcessEnvironment } from '../configActions.js';
import { closeMigrationConnections } from './utils/multiEnvConnection.js';

// Import migration orchestrator and individual migration functions
import { DatabaseMigrator, typesToKeep, typesToAddProperty, createAdditionalProperty } from './aisvc_userdb to team-[team]-db/migrate-database.js';
import { migrateUserDetailsToAisvcUserdb } from './userDetail-consolidation/migrate-userDetails-to-aisvc-userdb.js';
import { migrateRolesToAssistants } from './roleToAssistant/migrateRolesToAssistantsNode.js';
import { migrateUserRolesToUserAssistants } from './userRoleToUserAssistant/migrate-userRoles-to-userAssistants.js';
import { runRoleIdToAssistantIdMigration } from './roleId-to-assistantId/migrate-roleId-to-assistantId.js';
import { runRoleIdsArrayToAssistantIdsMigration } from './roleIds-array-to-assistantIds/migrate-roleIds-array-to-assistantIds.js';
import { runSelecteUserRoleToSelectedUserAssistantMigration } from './selecteUserRole-to-selectedUserAssistant/migrate-selecteUserRole-to-selectedUserAssistant.js';
import { migrateUserAssistantsToTeamMembers } from './userAssistant-to-teamMember/migrate-userAssistants-to-teamMembers.js';
import { migrateAdminUserAssistantToTeamMemberRole } from './adminUserAssistant-to-teamMemberRole/migrate-adminUserAssistant-to-teamMemberRole.js';

class MigrationOrchestrator {
  constructor(migrationConfig = {}) {
    // Default migration configuration
    this.config = {
      // sourceEnv: 'dev',
      // targetEnv: 'dev',
      // sourceDbName: 'bcs_userdb',
      // targetDbName: 'team-bcs-db',
      // teamId: '9eed6a90-8c04-4f6e-bff8-52e2948c374f',
      // teamName: 'bcs',
      batchSize: 100,
      ...migrationConfig
    };

    this.migrationSteps = [
      {
        name: 'UserDetail Consolidation Migration',
        description: `Migrate UserDetail documents from ${this.config.sourceEnv}:${this.config.sourceDbName} to ${this.config.targetEnv}:aisvc_userdb (if source is not already aisvc_userdb)`,
        execute: this.runUserDetailConsolidationMigration.bind(this)
      },
      {
        name: 'Database Migration',
        description: `Migrate documents from ${this.config.sourceEnv}:${this.config.sourceDbName} to ${this.config.targetEnv}:${this.config.targetDbName}`,
        execute: this.runDatabaseMigration.bind(this)
      },
      {
        name: 'Roles to Assistants Migration',
        description: 'Convert role documents to Assistant documents',
        execute: this.runRolesToAssistantsMigration.bind(this)
      },
      {
        name: 'UserRoles to UserAssistants Migration',
        description: 'Convert userRole documents to UserAssistant documents',
        execute: this.runUserRolesToUserAssistantsMigration.bind(this)
      },
      {
        name: 'RoleId to AssistantId Migration',
        description: 'Convert roleId properties to assistantId in existing documents',
        execute: this.runRoleIdToAssistantIdMigration.bind(this)
      },
      {
        name: 'RoleIds Array to AssistantIds Migration',
        description: 'Convert roleIds arrays to assistantIds arrays in existing documents',
        execute: this.runRoleIdsArrayToAssistantIdsMigration.bind(this)
      },
      {
        name: 'SelecteUserRole to SelectedUserAssistant Migration',
        description: 'Rename selecteUserRole property to selectedUserAssistant in all documents',
        execute: this.runSelecteUserRoleToSelectedUserAssistantMigration.bind(this)
      },
      {
        name: 'UserAssistants to TeamMembers Migration',
        description: 'Extract unique nuids from UserAssistant documents and create TeamMember documents',
        execute: this.runUserAssistantsToTeamMembersMigration.bind(this)
      },
      {
        name: 'Admin UserAssistant to TeamMember Role Migration',
        description: 'Convert admin UserAssistant documents to TeamMember admin roles and delete original UserAssistants',
        execute: this.runAdminUserAssistantToTeamMemberRoleMigration.bind(this)
      }
    ];
  }

  async runUserDetailConsolidationMigration() {
    console.log('📋 Starting UserDetail consolidation migration...');
    const result = await migrateUserDetailsToAisvcUserdb(this.config.sourceEnv, this.config.targetEnv, this.config.sourceDbName, this.config.targetDbName, this.config.teamName);
    return result;
  }

  async runDatabaseMigration() {
    console.log('📦 Starting database migration...');
    const migrator = new DatabaseMigrator(this.config.sourceEnv, this.config.targetEnv, this.config.sourceDbName, this.config.targetDbName, this.config.batchSize);
    const additionalProperty = createAdditionalProperty(this.config.teamId, this.config.teamName);
    const result = await migrator.migrate(typesToKeep, typesToAddProperty, additionalProperty);
    await migrator.validateMigration(typesToKeep);
    return result;
  }

  async runRolesToAssistantsMigration() {
    console.log('🔄 Starting roles to assistants migration...');
    const result = await migrateRolesToAssistants(this.config.targetEnv, this.config.targetDbName, this.config.teamId, this.config.teamName, this.config.batchSize);
    return result;
  }

  async runUserRolesToUserAssistantsMigration() {
    console.log('👤 Starting userRoles to userAssistants migration...');
    const result = await migrateUserRolesToUserAssistants(this.config.targetEnv, this.config.targetDbName, this.config.teamName, this.config.batchSize);
    return result;
  }

  async runRoleIdToAssistantIdMigration() {
    console.log('🔗 Starting roleId to assistantId migration...');
    const result = await runRoleIdToAssistantIdMigration(this.config.targetEnv, this.config.targetDbName, this.config.batchSize);
    return result;
  }

  async runRoleIdsArrayToAssistantIdsMigration() {
    console.log('🔗🔢 Starting roleIds array to assistantIds migration...');
    const result = await runRoleIdsArrayToAssistantIdsMigration(this.config.targetEnv, this.config.targetDbName, this.config.batchSize);
    return result;
  }

  async runSelecteUserRoleToSelectedUserAssistantMigration() {
    console.log('🔄 Starting selecteUserRole to selectedUserAssistant migration...');
    const result = await runSelecteUserRoleToSelectedUserAssistantMigration(this.config.targetEnv, this.config.targetDbName, this.config.batchSize);
    return result;
  }

  async runUserAssistantsToTeamMembersMigration() {
    console.log('👥 Starting UserAssistants to TeamMembers migration...');
    const result = await migrateUserAssistantsToTeamMembers(this.config.targetEnv, this.config.targetDbName, this.config.teamId, this.config.teamName, this.config.batchSize);
    return result;
  }

  async runAdminUserAssistantToTeamMemberRoleMigration() {
    console.log('🔐 Starting admin UserAssistant to TeamMember role migration...');
    const result = await migrateAdminUserAssistantToTeamMemberRole(this.config.targetEnv, this.config.targetDbName, this.config.teamId, this.config.teamName, this.config.batchSize);
    return result;
  }

  async runAllMigrations() {
    console.log('🚀 Starting complete migration process...');
    console.log(`Total migration steps: ${this.migrationSteps.length}`);
    console.log('='.repeat(80));


    const results = [];
    let currentStep = 1;

    for (const step of this.migrationSteps) {
      try {
        console.log(`\n📋 Step ${currentStep}/${this.migrationSteps.length}: ${step.name}`);
        console.log(`Description: ${step.description}`);
        console.log('-'.repeat(60));

        const startTime = Date.now();
        const result = await step.execute();
        const duration = Date.now() - startTime;
        await new Promise(resolve => setTimeout(resolve, 500)); // Short delay to avoid overwhelming the DB

        console.log(`✅ Step ${currentStep} completed successfully in ${duration}ms`);

        results.push({
          step: currentStep,
          name: step.name,
          success: true,
          duration,
          result
        });

      } catch (error) {
        console.error(`❌ Step ${currentStep} failed: ${error.message}`);
        console.error('Stack trace:', error.stack);

        results.push({
          step: currentStep,
          name: step.name,
          success: false,
          error: error.message
        });

        // Stop on first failure
        throw new Error(`Migration failed at step ${currentStep}: ${step.name}`);
      }

      currentStep++;
    }

    this.printMigrationSummary(results);
    return results;
  }

  printMigrationSummary(results) {
    console.log('\n' + '='.repeat(80));
    console.log('COMPLETE MIGRATION SUMMARY');
    console.log('='.repeat(80));

    results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      const duration = result.duration ? ` (${result.duration}ms)` : '';
      console.log(`${status} Step ${result.step}: ${result.name}${duration}`);

      if (!result.success) {
        console.log(`   Error: ${result.error}`);
      }
    });

    const successfulSteps = results.filter(r => r.success).length;
    const totalSteps = results.length;

    console.log(`\nOverall Success Rate: ${successfulSteps}/${totalSteps} steps completed`);

    if (successfulSteps === totalSteps) {
      console.log('🎉 All migration steps completed successfully!');
    } else {
      console.log('⚠️  Some migration steps failed. Please review the errors above.');
    }

    console.log('='.repeat(80));
  }
}

// Main execution
async function main() {
  try {
    debugger;
    console.log('Loading environment variables...');
    loadEnvLocal();

    console.log('Setting up environment configuration...');
    await setProcessEnvironment();

    // Pre-prod to Dev ETS DB
    // const migrationConfig = {
    //   sourceEnv: 'pp',
    //   targetEnv: 'dev',
    //   sourceDbName: 'aisvc_userdb',
    //   targetDbName: 'team-enterprise-testing-services-db',
    //   teamId: '481d5126-bc4e-479b-a46a-a6be9a5573dd',
    //   teamName: 'enterprise-testing-services',
    // };

    // Uat to Uat: KPIT AI Portal Members
    // const migrationConfig = {
    //   sourceEnv: 'uat',
    //   targetEnv: 'uat',
    //   sourceDbName: 'aisvc_userdb',
    //   targetDbName: 'team-kpit-ai-portal-members-db',
    //   teamId: 'ecbebd4c-0167-4d10-8701-4d7ba3527f4e',
    //   teamName: 'kpit-ai-portal-members',
    // };

    const migrationConfig = {
      sourceEnv: 'pp',
      targetEnv: 'pp',
      sourceDbName: 'aisvc_userdb',
      targetDbName: 'team-enterprise-testing-services-db',
      teamId: 'e0db2f75-9f4e-43e9-a583-00f1eb6863bf',
      teamName: 'enterprise-testing-services',
    };

    console.log('Migration configuration:', migrationConfig);

    const orchestrator = new MigrationOrchestrator(migrationConfig);

    // Run all migrations in sequence
    await orchestrator.runAllMigrations();

    console.log('🎉 Complete migration process finished successfully!');
    process.exit(0);
  } catch (error) {
    console.error('💥 Complete migration process failed:', error);
    process.exit(1);
  }
}

// Run the main function
await main();
