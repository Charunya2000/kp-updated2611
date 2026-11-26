# ETS-001 Index Migration Scripts

This directory contains scripts for migrating the `ets-001` Azure AI Search index between environments.

## Prerequisites

1. **Node.js** with ES Module support
2. **Azure AI Search SDK**: `@azure/search-documents`
3. **Environment Configuration**: Access to KP Config for the target environment
4. **Permissions**: Appropriate Azure Search API keys with read/write access

## Configuration

### 1. Update `.env.local`

For **pre-prod (PP)** environment:

```bash
# Set the KP Config profile to pre-prod
KPCONFIG_PROFILE=genai-port-client-pp
```

For other environments, use:
- `genai-port-client-dev` - Development
- `genai-port-client-uat` - UAT
- `genai-port-client-prod` - Production

### 2. Ensure Other KP Config Variables Are Set

Your `.env.local` should also include:

```bash
KPCONFIG_URI=https://np-kpconfig.ccms.aksnp.azure.kp.org
KPCONFIG_PASSWORD=<your-password>
KPCONFIG_ACCESSTOKEN=<your-access-token>
KPCONFIG_NAME=hpts-aisvc
KPCONFIG_USER=<your-user-id>
KPCONFIG_LABEL=master
```

## Scripts

### `migrate-ets-index.js`

**Purpose**: Retrieve the schema from the source index and verify field retrievability.

**Usage**:

```bash
# From project root
node scripts/migrations/ai-search-indexes/ets-001/migrate-ets-index.js
```

**What it does**:
1. Loads environment configuration from KP Config
2. Connects to the Azure AI Search service
3. Retrieves the complete schema for the `ets-001` index
4. Checks if the `content_vector` field is retrievable
5. Lists all non-retrievable fields that would be lost during migration
6. Saves the schema to a JSON file: `ets-001-schema-{env}.json`

**Output**:

- Console logs with migration readiness report
- JSON file containing the complete index schema
- List of fields that cannot be migrated (non-retrievable)

## Migration Process

### Step 0: Test Configuration (Recommended)

Before running the migration, verify your environment setup:

```bash
node scripts/migrations/ai-search-indexes/ets-001/test-config.js
```

This will verify all required environment variables are set correctly.

### Step 1: Retrieve Source Schema

```bash
# Set environment to pre-prod in .env.local
# KPCONFIG_PROFILE=genai-port-client-pp

node scripts/migrations/ai-search-indexes/ets-001/migrate-ets-index.js
```

Review the output to identify:
- Total number of fields
- Non-retrievable fields (will be lost)
- Status of `content_vector` field

### Step 2: Make content_vector Retrievable (if needed)

If the `content_vector` field is **not** retrievable, you have two options:

#### Option A: Update Source Index

Manually update the index definition to make the field retrievable:

```javascript
import { SearchIndexClient, AzureKeyCredential } from '@azure/search-documents';

const indexClient = new SearchIndexClient(endpoint, new AzureKeyCredential(key));
const index = await indexClient.getIndex('ets-001');

// Update field
index.fields = index.fields.map(field => {
  if (field.name === 'content_vector') {
    return { ...field, retrievable: true };
  }
  return field;
});

await indexClient.createOrUpdateIndex(index);
```

#### Option B: Re-index from Original Source

If you cannot make the field retrievable, you must re-index from the original data source rather than migrating from the existing index.

### Step 3: Migrate Data

Once all required fields are retrievable, proceed with data migration using the export-transform-import pattern.

## Important Notes

### Non-Retrievable Fields

Fields marked as `retrievable: false` **cannot be read** from the index and will be **permanently lost** during migration. Common scenarios:

- Vector fields often default to non-retrievable to save storage
- Sensitive fields may be marked non-retrievable for security
- Large fields may be non-retrievable to optimize performance

### Migration Strategies

1. **Direct Migration**: Only works if all needed fields are retrievable
2. **Schema Update**: Make fields retrievable before migration
3. **Re-indexing**: Rebuild from original data source

### Zero-Downtime Migration

For production migrations:

1. Create new index with correct schema
2. Use index aliases
3. Populate new index
4. Swap alias to point to new index
5. Delete old index after verification

## Troubleshooting

### Error: Missing Azure Search Configuration

**Problem**: Environment variables not loaded from KP Config

**Solution**:
- Verify `.env.local` contains correct `KPCONFIG_PROFILE`
- Ensure KP Config credentials are valid
- Check network connectivity to KP Config service

### Error: Index Not Found

**Problem**: Index name incorrect or doesn't exist in target environment

**Solution**:
- Verify index name is exactly `ets-001`
- Check that you're connected to the correct environment
- Confirm index exists using Azure Portal or CLI

### Field Not Retrievable

**Problem**: Migration would lose critical data

**Solution**:
- Follow Step 2 above to make field retrievable
- Or re-index from original source
- Do NOT proceed with migration if critical fields are non-retrievable

## Related Documentation

- [Azure AI Search Documentation](https://learn.microsoft.com/en-us/azure/search/)
- [Azure Search Node.js SDK](https://www.npmjs.com/package/@azure/search-documents)
- Project: See `AGENTS.md` for application architecture

## Support

For questions or issues, contact the AI Portal development team.
