#!/usr/bin/env node

/**
 * Script to update ETS Azure Cognitive Search Index
 * Updates index: kpsearchaisvcppuws2aisc/ets-001
 * Adds field: tag (retrievable, filterable, sortable, facetable)
 */

import { SearchIndexClient, AzureKeyCredential } from "@azure/search-documents";
import readline from 'readline';

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env.local');

if (existsSync(envPath)) {
    const envFile = readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            if (!process.env[key]) {
                process.env[key] = value;
            }
        }
    });
}

// Configuration
const INDEX_NAME = 'ets-001';

async function updateETSIndex() {
    try {
        console.log('🚀 Starting ETS Index Update...');

        // Get environment configuration
        const envName = process.env['envName'] || 'pp';
        const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
        const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.api.key`];

        if (!searchEndpoint || !searchAPIKey) {
            throw new Error(`Missing Azure Search configuration for environment: ${envName}`);
        }

        console.log(`📋 Environment: ${envName}`);
        console.log(`🔍 Search Endpoint: ${searchEndpoint}`);
        console.log(`📑 Index Name: ${INDEX_NAME}`);

        // Initialize Azure Search Index Client
        const indexClient = new SearchIndexClient(
            searchEndpoint,
            new AzureKeyCredential(searchAPIKey)
        );

        // Test connection first
        console.log('🔌 Testing connection to Azure Search...');
        try {
            await indexClient.listIndexes().next();
            console.log('✅ Connection successful!');
        } catch (connError) {
            console.error('❌ Connection test failed:', connError.message);
            console.error('💡 Please verify:');
            console.error('   - API key is valid and has admin permissions');
            console.error('   - Search endpoint URL is correct');
            console.error('   - Network connection is stable');
            throw new Error('Failed to connect to Azure Search service');
        }

        // Get existing index definition
        console.log('📖 Retrieving existing index definition...');
        const existingIndex = await indexClient.getIndex(INDEX_NAME);

        console.log(`✅ Retrieved index: ${existingIndex.name}`);
        console.log(`📊 Current fields count: ${existingIndex.fields.length}`);

        // Check if 'tag' field already exists
        const tagFieldExists = existingIndex.fields.some(field => field.name === 'tag');

        if (tagFieldExists) {
            console.log('⚠️  Field "tag" already exists in the index.');

            // Display existing tag field configuration
            const existingTagField = existingIndex.fields.find(field => field.name === 'tag');
            console.log('📋 Existing tag field configuration:');
            console.log(JSON.stringify(existingTagField, null, 2));

            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const answer = await new Promise((resolve) => {
                rl.question('Do you want to update the existing tag field configuration? (y/N): ', resolve);
            });
            rl.close();

            if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
                console.log('❌ Operation cancelled by user.');
                return;
            }
        }

        // Create new tag field definition
        const tagField = {
            name: 'tag',
            type: 'Edm.String',
            searchable: true,      // Allow full-text search on tag values
            filterable: true,      // Allow filtering by tag
            retrievable: true,     // Include in search results
            sortable: true,        // Allow sorting by tag
            facetable: true,       // Enable faceted search
            key: false,           // Not a key field
            analyzer: null        // Use default analyzer
        };

        console.log('🏗️  Creating new field definition:');
        console.log(JSON.stringify(tagField, null, 2));

        // Update index fields
        if (tagFieldExists) {
            // Update existing field
            existingIndex.fields = existingIndex.fields.map(field =>
                field.name === 'tag' ? tagField : field
            );
            console.log('🔄 Updating existing tag field...');
        } else {
            // Add new field
            existingIndex.fields.push(tagField);
            console.log('➕ Adding new tag field...');
        }

        // Update the index
        console.log('🚀 Updating index definition...');
        const updateResult = await indexClient.createOrUpdateIndex(existingIndex);

        console.log('✅ Index update completed successfully!');
        console.log(`📊 Updated fields count: ${updateResult.fields.length}`);

        // Verify the tag field was added/updated correctly
        const updatedIndex = await indexClient.getIndex(INDEX_NAME);
        const updatedTagField = updatedIndex.fields.find(field => field.name === 'tag');

        if (updatedTagField) {
            console.log('✅ Tag field verification successful:');
            console.log(`   - Name: ${updatedTagField.name}`);
            console.log(`   - Type: ${updatedTagField.type}`);
            console.log(`   - Retrievable: ${updatedTagField.retrievable}`);
            console.log(`   - Filterable: ${updatedTagField.filterable}`);
            console.log(`   - Sortable: ${updatedTagField.sortable}`);
            console.log(`   - Facetable: ${updatedTagField.facetable}`);
            console.log(`   - Searchable: ${updatedTagField.searchable}`);
        } else {
            console.error('❌ Tag field not found in updated index!');
        }

    } catch (error) {
        console.error('❌ Error updating ETS index:', error.message);

        if (error.code === 'EPIPE' || error.message.includes('EPIPE')) {
            console.error('💡 Connection was closed unexpectedly. This could be due to:');
            console.error('   - Invalid or expired API key');
            console.error('   - Network connectivity issues');
            console.error('   - Firewall blocking the connection');
            console.error('   - Try regenerating your API key in Azure Portal');
        } else if (error.code === 'OperationNotAllowed') {
            console.error('💡 This might be due to index being in use. Try again when index is not being accessed.');
        } else if (error.code === 'InvalidRequestParameter') {
            console.error('💡 Check if the field definition is valid for your search service tier.');
        } else if (error.statusCode === 401 || error.statusCode === 403) {
            console.error('💡 Authentication failed. Please verify your API key has admin permissions.');
        }

        process.exit(1);
    }
}

// Helper function to display current index schema
async function showCurrentSchema() {
    try {
        const envName = process.env['envName'] || 'pp';
        const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
        const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.api.key`];

        const indexClient = new SearchIndexClient(
            searchEndpoint,
            new AzureKeyCredential(searchAPIKey)
        );

        const index = await indexClient.getIndex(INDEX_NAME);

        console.log('📋 Current Index Schema:');
        console.log('='.repeat(50));
        console.log(`Index Name: ${index.name}`);
        console.log(`Fields Count: ${index.fields.length}`);
        console.log('');

        index.fields.forEach((field, idx) => {
            console.log(`${idx + 1}. ${field.name} (${field.type})`);
            console.log(`   - Key: ${field.key || false}`);
            console.log(`   - Retrievable: ${field.retrievable || false}`);
            console.log(`   - Searchable: ${field.searchable || false}`);
            console.log(`   - Filterable: ${field.filterable || false}`);
            console.log(`   - Sortable: ${field.sortable || false}`);
            console.log(`   - Facetable: ${field.facetable || false}`);
            console.log('');
        });

    } catch (error) {
        console.error('❌ Error retrieving index schema:', error);
    }
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
ETS Index Update Script

Usage:
  node updateETSIndex.js [options]

Options:
  --schema, -s     Show current index schema
  --help, -h       Show this help message

Examples:
  node updateETSIndex.js           # Update index to add tag field
  node updateETSIndex.js --schema  # Show current index schema
`);
        return;
    }

    if (args.includes('--schema') || args.includes('-s')) {
        await showCurrentSchema();
        return;
    }

    await updateETSIndex();
}

// Run the script
if (process.argv[1] === new URL(import.meta.url).pathname) {
    main().catch(console.error);
}

export {
    updateETSIndex,
    showCurrentSchema
};