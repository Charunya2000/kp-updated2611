'use server';

import { AzureKeyCredential, SearchClient, SearchIndexClient } from "@azure/search-documents";

// Configuration for the JDBC metadata index
const DB_METADATA_INDEX_NAME = 'jdbc-metadata-001';
const CONCEPT_INDEX_NAME = 'db-concepts-001';
const RAW_METADATA_INDEX_NAME = 'smart-database-001';

// Azure Search clients
let metadataIndexClient = null;
let searchIndexClient = null;

/**
 * Initialize Azure Search clients
 */
function getSearchClients() {
  if (!metadataIndexClient || !searchIndexClient) {
    const envName = process.env['envName'];
    const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
    const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.api.key`];

    metadataIndexClient = new SearchClient(
      searchEndpoint,
      DB_METADATA_INDEX_NAME,
      new AzureKeyCredential(searchAPIKey)
    );

    searchIndexClient = new SearchIndexClient(
      searchEndpoint,
      new AzureKeyCredential(searchAPIKey)
    );
  }

  return { metadataIndexClient, searchIndexClient };
}

/**
 * Delete all documents from the JDBC metadata index
 */
async function deleteJdbcMetadataIndexContent(schemaName) {
  try {
    const { metadataIndexClient } = getSearchClients();

    const searchResults = await metadataIndexClient.search('*', {
      filter: `schema_name eq '${schemaName}'`, // Added filter for schema name
      select: ['id'],
      top: 1000 // Adjust batch size as needed
    });

    const documentIds = [];
    for await (const result of searchResults.results) {
      documentIds.push({ id: result.document.id });
    }

    if (documentIds.length === 0) {
      return;
    }

    await metadataIndexClient.deleteDocuments(documentIds);
  } catch (error) {
    console.error(`Error deleting content from index ${DB_METADATA_INDEX_NAME} for schema: ${schemaName}:`, error);
    throw error;
  }
}

/**
 * Create the JDBC metadata index if it doesn't exist and clear its content if it does
 */
export async function createJdbcMetadataIndex(schemaName) {
  try {
    const { searchIndexClient } = getSearchClients();

    // Check if index exists
    const indexes = await searchIndexClient.listIndexes();
    const indexExists = await (async () => {
      for await (const index of indexes) {
        if (index.name === DB_METADATA_INDEX_NAME) {
          return true;
        }
      }
      return false;
    })();

    if (indexExists) {
      // await deleteJdbcMetadataIndexContent(schemaName);
      return `Index ${DB_METADATA_INDEX_NAME} already exists and its content has been cleared.`;
    }

    // Define the enhanced index schema
    const indexDefinition = {
      name: DB_METADATA_INDEX_NAME,
      fields: [
        {
          name: "id",
          type: "Edm.String",
          key: true,
          searchable: false
        },
        // Hierarchy fields
        {
          name: "database_name",
          type: "Edm.String",
          searchable: true,
          filterable: true
        },
        {
          name: "schema_name",
          type: "Edm.String",
          searchable: true,
          filterable: true
        },
        {
          name: "table_name",
          type: "Edm.String",
          searchable: true,
          filterable: true
        },
        {
          name: "column_name",
          type: "Edm.String",
          searchable: true,
          filterable: true
        },
        // Entity type (table or column)
        {
          name: "entity_type",
          type: "Edm.String",
          searchable: false,
          filterable: true
        },
        // Table metadata
        {
          name: "fully_qualified_name",
          type: "Edm.String",
          searchable: true,
          filterable: true
        },
        {
          name: "primary_key_columns",
          type: "Collection(Edm.String)",
          searchable: true,
          filterable: true
        },
        // Column metadata
        {
          name: "data_type",
          type: "Edm.String",
          searchable: true,
          filterable: true
        },
        {
          name: "column_size",
          type: "Edm.Int32",
          searchable: false,
          filterable: true
        },
        {
          name: "is_nullable",
          type: "Edm.Boolean",
          searchable: false,
          filterable: true
        },
        {
          name: "ordinal_position",
          type: "Edm.Int32",
          searchable: false,
          filterable: true
        },
        {
          name: "is_primary_key",
          type: "Edm.Boolean",
          searchable: false,
          filterable: true
        },
        {
          name: "is_foreign_key",
          type: "Edm.Boolean",
          searchable: false,
          filterable: true
        },
        // Relationship metadata (flattened for searchability)
        {
          name: "references_table",
          type: "Edm.String",
          searchable: true,
          filterable: true
        },
        {
          name: "references_column",
          type: "Edm.String",
          searchable: true,
          filterable: true
        },
        {
          name: "referenced_by_tables",
          type: "Collection(Edm.String)",
          searchable: true,
          filterable: true
        },
        {
          name: "referenced_by_columns",
          type: "Collection(Edm.String)",
          searchable: true,
          filterable: true
        },
        // Original JDBC metadata (for reference)
        {
          name: "raw_metadata",
          type: "Edm.String",
          searchable: false
        }
      ],
      semantic: {
        configurations: [
          {
            name: "metadata-semantic-config",
            prioritizedFields: {
              titleField: { fieldName: "fully_qualified_name" },
              contentFields: [
                { fieldName: "table_name" },
                { fieldName: "column_name" }
              ]
            }
          }
        ]
      }
    };

    await searchIndexClient.createIndex(indexDefinition);
    return `Created index ${DB_METADATA_INDEX_NAME}`;
  } catch (error) {
    console.error("Error creating JDBC metadata index:", error);
    throw error;
  }
}

/**
 * Transform the original JDBC metadata into a structured format
 * @param {Object} originalMetadata - The original JDBC metadata from smart-database-001
 * @returns {Array} Array of documents for the new index
 */
function transformJdbcMetadata(originalMetadata) {
  const documents = [];

  try {
    const database = originalMetadata.database_name || "DEFAULT_DB";
    const schema = originalMetadata.schema_name;
    const tableName = originalMetadata.table_name;

    // Parse content if needed
    let content;
    try {
      content = typeof originalMetadata.content === 'string'
        ? JSON.parse(originalMetadata.content)
        : originalMetadata.content;
    } catch (e) {
      console.error("Error parsing content:", e);
      return [];
    }

    const columns = content.columns || [];
    const primaryKeys = content.primaryKeys || [];
    const foreignKeys = content.foreignKeys || [];

    // Create a table document
    const tableId = `${database}.${schema}.${tableName}`.replace(/\s+/g, '_').replace(/\./g, '-');
    const primaryKeyColumns = primaryKeys.map(pk => pk.column_name);

    // Tables that reference this table through their foreign keys
    const referencingTables = foreignKeys.map(fk => ({
      table: `${fk.fktable_schem}.${fk.fktable_name}`,
      column: fk.fkcolumn_name,
      targetColumn: fk.column_name
    }));

    // Add table document
    documents.push({
      id: tableId,
      database_name: database,
      schema_name: schema,
      table_name: tableName,
      column_name: null,
      entity_type: "table",
      fully_qualified_name: `${schema}.${tableName}`,
      primary_key_columns: primaryKeyColumns,
      references_table: null,
      references_column: null,
      referenced_by_tables: referencingTables.map(rt => rt.table),
      referenced_by_columns: referencingTables.map(rt => `${rt.table}.${rt.column}`),
      raw_metadata: JSON.stringify({
        primaryKeys,
        foreignKeys
      })
    });

    // Add column documents
    for (const column of columns) {
      const columnId = `${tableId}.${column.column_name}`.replace(/\s+/g, '_').replace(/\./g, '-');
      const isPrimaryKey = primaryKeys.some(pk => pk.column_name === column.column_name);

      // Determine if this column is referenced by foreign keys
      const referencedBy = foreignKeys
        .filter(fk => fk.column_name === column.column_name)
        .map(fk => ({
          table: `${fk.fktable_schem}.${fk.fktable_name}`,
          column: fk.fkcolumn_name
        }));

      documents.push({
        id: columnId,
        database_name: database,
        schema_name: schema,
        table_name: tableName,
        column_name: column.column_name,
        entity_type: "column",
        fully_qualified_name: `${schema}.${tableName}.${column.column_name}`,
        data_type: column.type_name,
        column_size: column.column_size,
        is_nullable: column.nullable === 1 || column.is_nullable === "YES",
        ordinal_position: column.ordinal_position,
        is_primary_key: isPrimaryKey,
        is_foreign_key: false, // Will be updated in a second pass
        references_table: null, // Will be updated in a second pass
        references_column: null, // Will be updated in a second pass
        referenced_by_tables: referencedBy.map(ref => ref.table),
        referenced_by_columns: referencedBy.map(ref => `${ref.table}.${ref.column}`),
        raw_metadata: JSON.stringify(column)
      });
    }

    return documents;
  } catch (error) {
    console.error("Error transforming JDBC metadata:", error);
    return [];
  }
}

/**
 * Migrate data from the original metadata index to the enhanced index
 */
export async function migrateJdbcMetadata(schemaName) {
  try {
    const envName = process.env['envName'];
    const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
    const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.api.key`];

    // Client for the source index
    const sourceClient = new SearchClient(
      searchEndpoint,
      RAW_METADATA_INDEX_NAME,
      new AzureKeyCredential(searchAPIKey)
    );

    // Client for the target index
    const targetClient = new SearchClient(
      searchEndpoint,
      DB_METADATA_INDEX_NAME,
      new AzureKeyCredential(searchAPIKey)
    );

    // Check if the target index already has documents for the specified schema
    const existingDocuments = await targetClient.search('*', {
      filter: `schema_name eq '${schemaName}'`, // Added filter for schema name
      top: 1
    });

    if (existingDocuments.results.length > 0) {
      return {
        success: true,
        sourceDocuments: 0,
        transformedDocuments: 0,
        message: `Index already has content for schema: ${schemaName}. Skipping migration.`
      };
    }

    // Get all documents from the source index with the specified schema name
    const searchResults = await sourceClient.search('*', {
      includeTotalCount: true,
      filter: `schema_name eq '${schemaName}'`, // Added filter for schema name
      top: 2
    });

    s
    const allDocuments = [];
    for await (const result of searchResults.results) {
      allDocuments.push(result.document);
    }

    // Transform and upload in batches
    const batchSize = 50;
    let totalUploaded = 0;

    for (let i = 0; i < allDocuments.length; i += batchSize) {
      const batch = allDocuments.slice(i, i + batchSize);
      const transformedBatch = batch.flatMap(doc => transformJdbcMetadata(doc));

      if (transformedBatch.length > 0) {
        await targetClient.uploadDocuments(transformedBatch);
        totalUploaded += transformedBatch.length;
      }
    }

    return {
      success: true,
      sourceDocuments: allDocuments.length,
      transformedDocuments: totalUploaded
    };
  } catch (error) {
    console.error(`Error migrating JDBC metadata for schema: ${schemaName}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Search for tables or columns by name or pattern
 * @param {Object} params - Search parameters
 * @param {string} params.searchText - Optional text to search for
 * @param {string} params.entityType - Optional filter for "table" or "column"
 * @param {string} params.schemaName - Optional schema name filter
 * @param {string} params.tableName - Optional table name filter
 * @returns {Promise<Array>} Search results
 */
export async function searchDatabaseMetadata({
  searchText = null,
  entityType = null,
  schemaName = null,
  tableName = null,
  limit = 50
}) {
  try {
    const { metadataIndexClient } = getSearchClients();

    // Build filter
    let filters = [];
    if (entityType) {
      filters.push(`entity_type eq '${entityType}'`);
    }
    if (schemaName) {
      filters.push(`schema_name eq '${schemaName}'`);
    }
    if (tableName) {
      filters.push(`table_name eq '${tableName}'`);
    }

    const filter = filters.length > 0 ? filters.join(' and ') : null;

    // Perform search
    const searchOptions = {
      filter,
      top: limit,
      orderBy: ["entity_type desc", "fully_qualified_name"]
    };

    // If searchText is provided, use it as the search term
    // Otherwise, do a wildcard search
    const searchQuery = searchText || '*';

    const searchResults = await metadataIndexClient.search(searchQuery, searchOptions);

    // Collect results
    const results = [];
    for await (const result of searchResults.results) {
      results.push(result.document);
    }

    return results;
  } catch (error) {
    console.error("Error searching database metadata:", error);
    throw error;
  }
}

/**
 * Get all database schemas from the metadata index
 * @returns {Promise<Array>} Array of schema names
 */
export async function getAllDatabaseSchemas() {
  try {
    const { metadataIndexClient } = getSearchClients();

    const searchResults = await metadataIndexClient.search('*', {
      facets: ["schema_name,count:0"],
      top: 0
    });

    // Extract unique schema names from facets
    const schemas = [];
    if (searchResults.facets && searchResults.facets.schema_name) {
      for (const facet of searchResults.facets.schema_name) {
        schemas.push(facet.value);
      }
    }

    return schemas;
  } catch (error) {
    console.error("Error getting database schemas:", error);
    throw error;
  }
}

/**
 * Get all tables for a given schema
 * @param {string} schemaName - Schema name
 * @returns {Promise<Array>} Array of table objects
 */
export async function getTablesForSchema(schemaName) {
  return searchDatabaseMetadata({
    entityType: "table",
    schemaName,
    limit: 1000
  });
}

/**
 * Get all columns for a given table
 * @param {string} schemaName - Schema name
 * @param {string} tableName - Table name
 * @returns {Promise<Array>} Array of column objects
 */
export async function getColumnsForTable(schemaName, tableName) {
  return searchDatabaseMetadata({
    entityType: "column",
    schemaName,
    tableName,
    limit: 1000
  });
}

// const main = async () => {
//   await migrateJdbcMetadata();
//   process.exit(0);
// };

// main().catch(err => {
//   console.error('Error executing main function:', err);
//   process.exit(1);
// });

// const match = someString.match(/regex/); // Ensure this is not on the left-hand side of an assignment
// if (match) {
//   // Process match
// }