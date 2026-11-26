import { connectToEnvironmentDatabase } from '../utils/multiEnvConnection.js';
import { setProcessEnvironment } from '../../configActions.js';
import { loadEnvLocal } from '../../../utils/envLoader.js';
import { formatName } from '../../../utils/formatting.js';

class DatabaseMigrator {
  constructor(sourceEnv = 'pp', targetEnv = 'dev', sourceDbName = 'aisvc_userdb', targetDbName = 'team-kpit-ai-portal-members-db', batchSize = 12) {
    this.sourceEnv = sourceEnv;
    this.targetEnv = targetEnv;
    this.sourceDbName = sourceDbName;
    this.targetDbName = targetDbName; // Check this in the source database before running
    this.batchSize = batchSize; // Process documents in batches
  }

  async migrate(typesToKeep = [], typesToAddProperty = [], additionalProperty = {}) {
    console.log(`Source: ${this.sourceEnv}/${this.sourceDbName} → Target: ${this.targetEnv}/${this.targetDbName}`);

    try {
      // Connect to source and target databases
      const sourceDb = await connectToEnvironmentDatabase(this.sourceEnv, this.sourceDbName);
      const targetDb = await connectToEnvironmentDatabase(this.targetEnv, this.targetDbName);

      // Get all collections from source database
      const collections = await sourceDb.listCollections().toArray();
      console.log(`Found ${collections.length} collections to migrate`);

      const migrationResults = {
        totalCollections: collections.length,
        processedCollections: 0,
        totalDocuments: 0,
        migratedDocuments: 0,
        skippedDocuments: 0,
        errors: []
      };

      // Process each collection
      for (const collectionInfo of collections) {
        const collectionName = collectionInfo.name;
        console.log(`\nProcessing collection: ${collectionName}`);

        try {
          const result = await this.migrateCollection(
            sourceDb,
            targetDb,
            collectionName,
            typesToKeep,
            typesToAddProperty,
            additionalProperty
          );
          await new Promise(resolve => setTimeout(resolve, 1000)); // Short delay to avoid overwhelming the DB

          migrationResults.processedCollections++;
          migrationResults.totalDocuments += result.totalDocuments;
          migrationResults.migratedDocuments += result.migratedDocuments;
          migrationResults.skippedDocuments += result.skippedDocuments;

          console.log(`  ✅ Completed: ${result.migratedDocuments}/${result.totalDocuments} documents migrated`);
        } catch (error) {
          console.error(`  ❌ Error processing collection ${collectionName}:`, error.message);
          migrationResults.errors.push({
            collection: collectionName,
            error: error.message
          });
        }
      }

      // Print final results
      this.printMigrationSummary(migrationResults);
      return migrationResults;

    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  async migrateCollection(sourceDb, targetDb, collectionName, typesToKeep, typesToAddProperty, additionalProperty) {
    const sourceCollection = sourceDb.collection(collectionName);
    const targetCollection = targetDb.collection(collectionName);

    // Get total document count
    const totalDocuments = await (await sourceCollection.find({ type: { $in: typesToKeep } })).count();
    console.log(`  Total documents in ${collectionName}: ${totalDocuments}`);

    if (totalDocuments === 0) {
      return { totalDocuments: 0, migratedDocuments: 0, skippedDocuments: 0 };
    }

    let migratedDocuments = 0;
    let skippedDocuments = 0;
    let processedDocuments = 0;

    // Create indexes on target collection if they exist on source
    await this.copyIndexes(sourceCollection, targetCollection);
    console.log('  📋 Copied indexes complete');

    // Process documents in batches
    console.log('  🚚 Starting document migration in batches...');
    const cursor = sourceCollection.find({ type: { $in: typesToKeep } });

    while (await cursor.hasNext()) {
      console.log(`  Processing batch starting at document ${processedDocuments + 1}...`);
      const batch = [];

      // Collect batch of documents
      for (let i = 0; i < this.batchSize && await cursor.hasNext(); i++) {
        const doc = await cursor.next();
        batch.push(doc);
      }

      // Process batch
      console.log(`  📦 Processing batch of ${batch.length} documents...`);
      const processedBatch = this.processBatch(batch, typesToKeep, typesToAddProperty, additionalProperty);

      if (processedBatch.length > 0) {
        // Insert batch into target collection
        await targetCollection.insertMany(processedBatch, { ordered: false });
        await new Promise(resolve => setTimeout(resolve, 1000)); // Short delay to avoid overwhelming the DB
        console.log(`  📦 Batch processing completed.`);
        migratedDocuments += processedBatch.length;
      }

      skippedDocuments += (batch.length - processedBatch.length);
      processedDocuments += batch.length;

      // Progress indicator
      if (processedDocuments % (this.batchSize * 10) === 0) {
        console.log(`  Progress: ${processedDocuments}/${totalDocuments} (${Math.round((processedDocuments / totalDocuments) * 100)}%)`);
      }
    }

    return { totalDocuments, migratedDocuments, skippedDocuments };
  }

  processBatch(documents, typesToKeep, typesToAddProperty, additionalProperty) {
    return documents
      .filter(doc => {
        // Skip documents without type property
        if (!doc.type) {
          return false;
        }

        // Only keep documents with specified types
        return typesToKeep.includes(doc.type);
      })
      .map(doc => {
        // Create a copy of the document
        const newDoc = { ...doc };

        // Remove the _id to allow MongoDB to generate a new one
        delete newDoc._id;

        // Format selectedUserRole field if it exists
        if (newDoc.selectedUserRole && typeof newDoc.selectedUserRole === 'string') {
          newDoc.selectedUserRole = formatName(newDoc.selectedUserRole);
          newDoc.assistantName = formatName(newDoc.selectedUserRole);
        }

        // Add additional property if type matches
        if (typesToAddProperty.includes(doc.type)) {
          Object.assign(newDoc, additionalProperty);
        }

        // Ensure app is set to SmartNotes
        newDoc.app = 'SmartNotes';

        // Add migration metadata
        newDoc._migrationInfo = {
          migratedAt: new Date(),
          sourceDatabase: this.sourceDbName,
          originalId: doc._id
        };

        return newDoc;
      });
  }

  async copyIndexes(sourceCollection, targetCollection) {
    try {
      const indexes = await sourceCollection.listIndexes().toArray();

      for (const index of indexes) {
        // Skip the default _id index
        if (index.name === '_id_') continue;

        const indexSpec = { ...index.key };
        const options = {
          name: index.name,
          background: true
        };

        // Copy additional index options
        if (index.unique) options.unique = true;
        if (index.sparse) options.sparse = true;
        if (index.partialFilterExpression) options.partialFilterExpression = index.partialFilterExpression;

        await targetCollection.createIndex(indexSpec, options);
        console.log(`  📋 Copied index: ${index.name}`);
      }
    } catch (error) {
      console.warn(`  ⚠️  Warning: Could not copy indexes for collection: ${error.message}`);
    }
  }

  printMigrationSummary(results) {
    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Collections processed: ${results.processedCollections}/${results.totalCollections}`);
    console.log(`Total documents processed: ${results.totalDocuments.toLocaleString()}`);
    console.log(`Documents migrated: ${results.migratedDocuments.toLocaleString()}`);
    console.log(`Documents skipped: ${results.skippedDocuments.toLocaleString()}`);
    console.log(`Success rate: ${((results.migratedDocuments / results.totalDocuments) * 100).toFixed(2)}%`);

    if (results.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      results.errors.forEach(error => {
        console.log(`  - ${error.collection}: ${error.error}`);
      });
    } else {
      console.log('\n✅ Migration completed successfully with no errors!');
    }
    console.log('='.repeat(60));
  }

  // Utility method to validate migration
  async validateMigration(typesToKeep) {
    console.log('\nValidating migration...');

    const sourceDb = await connectToEnvironmentDatabase(this.sourceEnv, this.sourceDbName);
    const targetDb = await connectToEnvironmentDatabase(this.targetEnv, this.targetDbName);

    const sourceCollections = await sourceDb.listCollections().toArray();

    for (const collectionInfo of sourceCollections) {
      const collectionName = collectionInfo.name;
      const sourceCollection = sourceDb.collection(collectionName);
      const targetCollection = targetDb.collection(collectionName);

      // Count documents with specified types in source
      const sourceCount = await sourceCollection.countDocuments({
        type: { $in: typesToKeep }
      });

      // Count migrated documents in target
      const targetCount = await targetCollection.countDocuments();

      console.log(`${collectionName}: ${sourceCount} source → ${targetCount} target`);

      if (sourceCount !== targetCount) {
        console.warn(`⚠️  Mismatch in collection ${collectionName}`);
      }
    }
  }
}


// Example usage
const migrator = new DatabaseMigrator();

// Define your type configurations
const typesToKeep = [
  'Assistant',
  'CacControlReport',
  'Chat',
  'ChatHistory',
  'ChatInteraction',
  'DB Compare Query',
  'DesignFileReference',
  'DesignIndex',
  'DesignReference',
  'JiraIssue',
  'Persona',
  'role',
  'SavedNote',
  'SavedResponse',
  'SearchIndexConfig',
  'SharePointFile',
  'SharePointSite',
  'SmartNote',
  'SmartNoteTemplate',
  'Source',
  'TemplateCollection',
  'TemplateDocument',
  'TemplatePurpose',
  'TemplateWorkflow',
  'TestCase',
  'TestDataGenJob',
  'UploadedDocument',
  'userRole',
  'WebsiteURL',
  // 'Statistic' //- TODO: uncomment this before the actual final migration
];

const typesToAddProperty = [
  'Assistant',
  'Chat',
  'ChatHistory',
  'ChatInteraction',
  'DesignIndex',
  'DesignReference',
  'JiraIssue',
  'Persona',
  'SavedNote',
  'SavedResponse',
  'SearchIndexConfig',
  'SharePointFile',
  'SharePointSite',
  'SmartNote',
  'SmartNoteTemplate',
  'Source',
  'TemplateCollection',
  'TemplateDocument',
  'TemplatePurpose',
  'TemplateWorkflow',
  'TestCase',
  'TestDataGenJob',
  'UploadedDocument',
  'WebsiteURL',
];

const additionalProperty = {
  teamId: 'ecbebd4c-0167-4d10-8701-4d7ba3527f4e', // Check this in the aisvc_userdb before running
  teamName: 'kpit-ai-portal-members' // Check this in the aisvc_userdb before running
};

// Function to create additionalProperty with custom values
export function createAdditionalProperty(teamId = 'ecbebd4c-0167-4d10-8701-4d7ba3527f4e', teamName = 'kpit-ai-portal-members') {
  return { teamId, teamName };
}

// Check if script is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    console.log('Loading environment variables...');
    loadEnvLocal();

    console.log('Setting up environment configuration...');
    await setProcessEnvironment();

    // Parse CLI arguments
    const args = process.argv.slice(2);
    const config = {};

    for (let i = 0; i < args.length; i += 2) {
      const key = args[i]?.replace(/^--/, '');
      const value = args[i + 1];
      if (key && value) {
        config[key] = value;
      }
    }

    const migrator = new DatabaseMigrator(
      config.sourceEnv || 'pp',
      config.targetEnv || 'dev',
      config.sourceDbName,
      config.targetDbName
    );

    const additionalProperty = {
      teamId: config.teamId || 'ecbebd4c-0167-4d10-8701-4d7ba3527f4e',
      teamName: config.teamName || 'kpit-ai-portal-members'
    };

    console.log('Starting database migration...');
    await migrator.migrate(typesToKeep, typesToAddProperty, additionalProperty);
    await migrator.validateMigration(typesToKeep);

    console.log('Database migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration script failed:', error);
    process.exit(1);
  }
}

// Export classes and configurations for use in other scripts
export { DatabaseMigrator, typesToKeep, typesToAddProperty, additionalProperty };