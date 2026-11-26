# Data Load & Environment Migration

## Overview

The Data Load tools allow administrators to migrate data between environments for both Azure AI Search indexes and MongoDB collections. The workflow consists of extracting data from a source environment using command-line scripts, uploading the exported files to blob storage, and then loading the data into the target environment through the admin UI.

---

## Migration Workflow

### Step 1: Extract Data from Source Environment

Before migrating, export data from the source (typically a lower) environment using the extraction scripts. These scripts require local environment variables to be configured via `.env.local` or `setProcessEnvironment()`.

#### Extract AI Search Index

```bash
node scripts/ai-search/extract-ai-search-index.js --index <indexName> [--format jsonl] [--dry-run]
```

| Option | Description |
|--------|-------------|
| `--index <name>` | **(required)** Name of the AI Search index to extract |
| `--format <type>` | Output format: `json` or `jsonl` (default: `jsonl`) |
| `--dry-run` | Log first 5 documents without writing a file |

**Output:** `<indexName>-extract-<timestamp>.jsonl` in the script directory.

> AI Search data loads require `.jsonl` format.

#### Extract MongoDB Collection

```bash
node scripts/mongo/extract-mongo-collection.js --database <dbName> --collection <collName> [--format bsonl] [--dry-run] [--output <filePath>]
```

| Option | Description |
|--------|-------------|
| `--database <name>` | **(required)** MongoDB database name |
| `--collection <name>` | **(required)** MongoDB collection name |
| `--format <type>` | Output format: `bsonl` (default) or `jsonl` |
| `--dry-run` | Log first 5 documents without writing a file |
| `--output <path>` | Custom output file path |

**Output:** `<dbName>-<collName>-extract-<timestamp>.bsonl` in the script directory.

> Mongo data loads require `.bsonl` format. BSONL uses MongoDB Extended JSON v2 which preserves type information (ObjectId, Date, NumberLong, etc.) automatically.

#### Extract MongoDB Indexes

```bash
node scripts/mongo/extract-mongo-indexes.js --database <dbName> --collection <collName> [--dry-run] [--output <filePath>]
```

| Option | Description |
|--------|-------------|
| `--database <name>` | **(required)** MongoDB database name |
| `--collection <name>` | **(required)** MongoDB collection name |
| `--dry-run` | Log first 5 indexes without writing a file |
| `--output <path>` | Custom output file path |

**Output:** `<dbName>-<collName>-indexes-<timestamp>.jsonl` in the script directory. Each line contains: `databaseName`, `collectionName`, `extractedAt`, `name`, `key`, and optionally `options`.

---

### Step 2: Upload Exported Files to Blob Storage

Upload your exported files to blob storage using the admin UI **or** manually via Azure Portal/CLI.

- **Maximum file size:** 200 MB per file
- Navigate to **Admin → Data Loads**
- In the **Upload Files to Blob Storage** section:
  1. Select an existing container or type a new container name
  2. Select your exported file(s)
  3. Click **Upload**
- The UI will warn if a file with the same name already exists and prompt for overwrite confirmation

---

### Step 3: Load Data into Target Environment

#### For AI Search

1. On the **Data Loads** page, go to the **AI Search Data Load** section
2. Select the **Container** containing your uploaded file
3. Select the **Blob File** (must be `.jsonl`)
4. Select the target **Index Name** from the dropdown
5. Click **Start Upload**
6. If the index already has documents, you will be prompted:
   - **Cancel** — abort the operation
   - **Skip Existing** — insert only documents whose key does not already exist in the index
   - **Overwrite** — replace all documents, including those that already exist

The upload runs as a background job. Progress is displayed with current/total counts and duration.

#### For MongoDB

1. On the **Data Loads** page, go to the **Mongo DB Data Load** section
2. Select the **Container** containing your uploaded file
3. Select the **Blob File** (must be `.bsonl`)
4. Select the target **Database Name** (choose existing or type a new name)
5. Select the target **Collection Name** (choose existing or type a new name)
6. Click **Start Upload**
7. If the collection already has documents, you will be prompted with the same Cancel / Skip Existing / Overwrite options

---

## Admin UI Pages

### 1. Data Loads (`/admin/data-loads`)

The primary page for data migration. Contains three sections:

#### Upload Files to Blob Storage

| Field | Description |
|-------|-------------|
| Container | Select from existing containers or type a custom name (created automatically) |
| File Picker | Multi-file selection, any format |

- Max 200 MB per file
- Duplicate filenames trigger an overwrite confirmation dialog

#### AI Search Data Load

| Field | Description |
|-------|-------------|
| Select Container | Dropdown of existing blob containers |
| Select Blob File | Dropdown of files in the selected container |
| Index Name | Dropdown of existing AI Search indexes |

- Requires `.jsonl` format
- Documents are validated against the index schema (field names, vector dimensions)
- Batches of 100 documents with exponential backoff for rate limiting
- Real-time progress tracking with inserted/skipped counts

#### Mongo DB Data Load

| Field | Description |
|-------|-------------|
| Select Container | Dropdown of existing blob containers |
| Select Blob File | Dropdown of files in the selected container |
| Database Name | Dropdown of existing databases or custom text input |
| Collection Name | Dropdown of collections in selected DB or custom text input |

- Requires `.bsonl` format (Extended JSON preserving ObjectId, Date, etc.)
- Batches of 25 documents with retry handling for CosmosDB rate limits
- Duplicate key errors (E11000) are handled gracefully when "Skip Existing" is selected

---

### 2. Create Search Index (`/admin/index-creation`)

Creates a new Azure AI Search index definition in the target environment.

**How to use:**
1. In the source environment, open the Azure Portal → AI Search → your index → **Edit JSON**
2. Copy the full JSON definition
3. Paste into the text field on this page
4. Click **Create Index**

The tool normalizes differences between Azure Portal JSON and the SDK format automatically:
- Strips `@odata.*` properties
- Normalizes vector search profile references
- Normalizes semantic search field names
- Normalizes field-level properties (`dimensions` → `vectorSearchDimensions`, etc.)

**Required JSON structure:**
```json
{
  "name": "my-index-001",
  "fields": [
    { "name": "id", "type": "Edm.String", "key": true },
    { "name": "content", "type": "Edm.String", "searchable": true }
  ]
}
```

---

### 3. Apply Mongo Indexes (`/admin/apply-mongo-indexes`)

Applies MongoDB index definitions to collections in the target environment.

**How to use:**
1. Run `extract-mongo-indexes.js` against the source environment
2. Open the output `.jsonl` file
3. Copy and paste the contents into the text field
4. Click **Validate (Dry Run)** to preview what will be applied
5. Click **Apply Indexes** to create the indexes

**Required fields per line:**

| Field | Type | Description |
|-------|------|-------------|
| `databaseName` | string | Target database |
| `collectionName` | string | Target collection |
| `name` | string | Index name |
| `key` | object | Index key specification (e.g. `{ "field": 1 }`) |
| `options` | object | *(optional)* Index options (unique, sparse, etc.) |

**Example JSONL:**
```jsonl
{"databaseName":"mydb","collectionName":"users","name":"email_1","key":{"email":1},"options":{"unique":true}}
{"databaseName":"mydb","collectionName":"users","name":"created_at_-1","key":{"created_at":-1}}
```

The summary shows total lines parsed, valid/invalid counts, and per-index results.

---

## Full Environment Migration Checklist

To fully migrate an environment (e.g., from Dev to UAT):

1. **Create the AI Search index** in the target environment
   - Copy the index JSON from Azure Portal and use the Create Search Index page

2. **Extract AI Search data** from the source environment
   ```bash
   node scripts/ai-search/extract-ai-search-index.js --index my-index
   ```

3. **Extract MongoDB collections** from the source environment
   ```bash
   node scripts/mongo/extract-mongo-collection.js --database mydb --collection mycollection
   ```

4. **Extract MongoDB indexes** from the source environment
   ```bash
   node scripts/mongo/extract-mongo-indexes.js --database mydb --collection mycollection
   ```

5. **Upload** all exported files to blob storage via the Data Loads page (max 200 MB each)

6. **Load AI Search data** — select the `.jsonl` file and target index

7. **Load MongoDB data** — select the `.bsonl` file, target database, and collection

8. **Apply MongoDB indexes** — paste the extracted index JSONL and apply

---

## Technical Details

### Duplicate Handling (Skip Existing)

When "Skip Existing" is selected:

- **AI Search:** Uses a batch `merge` probe with only the key field to identify existing documents without modifying them. Documents that return a 404 (not found) are then uploaded. This results in at most 2 API calls per batch of 100 — regardless of total document count.
- **MongoDB:** Attempts `insertMany` and catches duplicate key errors (E11000). Duplicates are skipped and reported.

### Rate Limiting

Both AI Search and MongoDB data loads handle rate limiting:
- Parses `Retry-After` headers when available
- Falls back to exponential backoff (starting at 2 seconds, max 15 retries)

### Background Jobs

Data loads run as background jobs with these statuses:
- `PROCESSING` → initial setup
- `INDEXING` → actively loading documents
- `COMPLETE` → finished successfully
- `ERROR` → failed (stall detection triggers after 10 minutes with 0 progress)
- `CANCELED` → manually canceled by user
