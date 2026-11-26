'use server';

// Fix the import paths by adding .js extensions
import { searchIndex } from './searchVectorDataService.js';
import { vectorize } from './vectorizeDataService.js';
import { chatCompletion, chatCompletionMarkdown } from './chatCompletionService2.js';
import { AzureOpenAI } from "openai";
import { AzureKeyCredential, SearchClient, SearchIndexClient } from "@azure/search-documents";
import { getAllDatabaseSchemas, getColumnsForTable, getTablesForSchema } from './dbMetadataIndexService.js';

// Configuration for the conceptual index
const CONCEPT_INDEX_NAME = 'db-concepts-001';
const METADATA_INDEX_NAME = 'smart-database-001';

// Azure Search client for the conceptual index
let conceptIndexClient = null;
let searchIndexClient = null;
let completionsClient = null;

/**
 * Initialize Azure Search clients
 */
function getSearchClients() {
  if (!conceptIndexClient || !searchIndexClient) {
    const envName = process.env['envName'];
    const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
    const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.api.key`];

    conceptIndexClient = new SearchClient(
      searchEndpoint,
      CONCEPT_INDEX_NAME,
      new AzureKeyCredential(searchAPIKey)
    );

    searchIndexClient = new SearchIndexClient(
      searchEndpoint,
      new AzureKeyCredential(searchAPIKey)
    );
  }

  return { conceptIndexClient, searchIndexClient };
}

/**
 * Enhanced concept generation using direct Azure OpenAI API access
 * @param {Array} dbObjects - Array of database objects to process in batch
 * @returns {Promise<Array>} Generated concept data for all objects
 */
async function batchGenerateConceptsWithLM(dbObjects) {
  try {
    const results = [];

    // Process in smaller batches to avoid API limits
    const batchSize = 5;
    for (let i = 0; i < dbObjects.length; i += batchSize) {
      const batch = dbObjects.slice(i, i + batchSize);
      const batchPromises = batch.map(async ({ dbObject, objectType }) => {
        // Create appropriate system prompt
        const systemPrompt = `As a database expert, generate natural language concepts that users might use when referring to database objects.
        Based on the provided database object, create:
        1. A primary concept name (the most natural way users would refer to this ${objectType})
        2. Alternative forms or synonyms for this concept
        3. A brief description of what this ${objectType} represents in business terms
        4. Example user questions that would need this ${objectType}
        
        Respond in JSON format with these fields:
        - concept: The primary natural language concept
        - alternate_forms: Array of alternative ways users might refer to this
        - description: Brief business description
        - example_phrases: Array of example user questions
        
        Focus on business terminology rather than technical names.`;

        // Create content prompt based on object type
        let contentPrompt = "";
        if (objectType === "table") {
          contentPrompt = `
          Database Object Information:
          - Type: Table
          - Technical Name: ${dbObject.table_name}
          - Schema: ${dbObject.table_schem || dbObject.schema_name}
          - Columns: ${dbObject.columns.map(c => c.column_name).join(', ')}
          - Primary Key(s): ${dbObject.primaryKeys ? dbObject.primaryKeys.map(pk => pk.column_name).join(', ') : 'Unknown'}
          
          Generate concepts for how users would naturally refer to this table in questions.`;
        } else if (objectType === "column") {
          contentPrompt = `
          Database Object Information:
          - Type: Column
          - Technical Name: ${dbObject.column_name}
          - Data Type: ${dbObject.type_name}
          - Table: ${dbObject.table_name}
          - Schema: ${dbObject.table_schem || dbObject.schema_name}
          - Is Primary Key: ${dbObject.is_primary ? 'Yes' : 'No'}
          - Is Nullable: ${dbObject.is_nullable === 'YES' || dbObject.nullable === 1 ? 'Yes' : 'No'}
          
          Generate concepts for how users would naturally refer to this column in questions.`;
        } else if (objectType === "schema") {
          contentPrompt = `
          Database Object Information:
          - Type: Schema
          - Technical Name: ${dbObject.schema_name || dbObject.table_schem}
          
          Generate concepts for how users would naturally refer to this schema in questions.`;
        }

        try {
          // Direct API call to Azure OpenAI
          const completionConfig = {
            temperature: 0.7,
            max_tokens: 800,
            model: "gpt-4o",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: contentPrompt }
            ]
          };

          // Extract and parse response
          const conceptResponse = await chatCompletion(completionConfig)
          let conceptData;

          try {
            // Extract JSON from the response
            const jsonMatch = conceptResponse.match(/```json\n([\s\S]*?)\n```/) ||
              conceptResponse.match(/({[\s\S]*})/) ||
              [null, conceptResponse];
            const jsonString = jsonMatch[1];
            conceptData = JSON.parse(jsonString);
          } catch (e) {
            console.error("Error parsing concept response:", e);
            conceptData = {
              concept: objectType === "table" ? dbObject.table_name.toLowerCase().replace(/_/g, ' ') :
                objectType === "column" ? dbObject.column_name.toLowerCase().replace(/_/g, ' ') :
                  dbObject.schema_name.toLowerCase().replace(/_/g, ' '),
              alternate_forms: [],
              description: `${objectType} in the database`,
              example_phrases: []
            };
          }

          // Vectorize the concept
          const conceptVector = await vectorize({
            nuid: "system",
            content: `${conceptData.concept} ${conceptData.description} ${conceptData.alternate_forms.join(' ')}`
          });

          return {
            ...conceptData,
            conceptVector,
            objectType,
            dbObject
          };
        } catch (error) {
          console.error(`Error in OpenAI API call for ${objectType}:`, error);
          // Return fallback response
          return {
            concept: objectType === "table" ? dbObject.table_name.toLowerCase().replace(/_/g, ' ') :
              objectType === "column" ? dbObject.column_name.toLowerCase().replace(/_/g, ' ') :
                dbObject.schema_name.toLowerCase().replace(/_/g, ' '),
            alternate_forms: [],
            description: `${objectType} in the database`,
            example_phrases: [],
            objectType,
            dbObject
          };
        }
      });

      // Process batch and add to results
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Slight delay to avoid rate limiting
      if (i + batchSize < dbObjects.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results;
  } catch (error) {
    console.error("Error in batch concept generation:", error);
    throw error;
  }
}

/**
 * Generate concepts for a database object using the LM
 * @param {Object} dbObject - Database object (table, column, schema)
 * @param {string} objectType - Type of object (table, column, schema)
 * @returns {Promise<Object>} Generated concepts
 */
async function generateConceptsWithLM(dbObject, objectType) {
  try {
    const systemPrompt = `As a database expert, generate natural language concepts that users might use when referring to database objects.
    Based on the provided database object, create:
    1. A primary concept name (the most natural way users would refer to this ${objectType})
    2. Alternative forms or synonyms for this concept
    3. A brief description of what this ${objectType} represents in business terms
    4. Example user questions that would need this ${objectType}
    
    Respond in JSON format with these fields:
    - concept: The primary natural language concept
    - alternate_forms: Array of alternative ways users might refer to this
    - description: Brief business description
    - example_phrases: Array of example user questions
    
    Focus on business terminology rather than technical names.`;

    // Create appropriate content based on object type
    let contentPrompt = "";
    if (objectType === "table") {
      contentPrompt = `
      Database Object Information:
      - Type: Table
      - Technical Name: ${dbObject.table_name}
      - Schema: ${dbObject.table_schem || dbObject.schema_name}
      - Columns: ${dbObject.columns.map(c => c.column_name).join(', ')}
      - Primary Key(s): ${dbObject.primaryKeys ? dbObject.primaryKeys.map(pk => pk.column_name).join(', ') : 'Unknown'}
      
      Generate concepts for how users would naturally refer to this table in questions.`;
    } else if (objectType === "column") {
      contentPrompt = `
      Database Object Information:
      - Type: Column
      - Technical Name: ${dbObject.column_name}
      - Data Type: ${dbObject.type_name}
      - Table: ${dbObject.table_name}
      - Schema: ${dbObject.table_schem || dbObject.schema_name}
      - Is Primary Key: ${dbObject.is_primary ? 'Yes' : 'No'}
      - Is Nullable: ${dbObject.is_nullable === 'YES' || dbObject.nullable === 1 ? 'Yes' : 'No'}
      
      Generate concepts for how users would naturally refer to this column in questions.`;
    } else if (objectType === "schema") {
      contentPrompt = `
      Database Object Information:
      - Type: Schema
      - Technical Name: ${dbObject.schema_name || dbObject.table_schem}
      
      Generate concepts for how users would naturally refer to this schema in questions.`;
    }

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: contentPrompt }
    ];

    let conceptResponse = "";
    await chatCompletionMarkdown({
      messages,
      onToken: (content) => { conceptResponse += content; }
    });

    // Parse JSON response
    let conceptData;
    try {
      // Extract JSON from the response
      const jsonMatch = conceptResponse.match(/```json\n([\s\S]*?)\n```/) ||
        conceptResponse.match(/({[\s\S]*})/) ||
        [null, conceptResponse];
      const jsonString = jsonMatch[1];
      conceptData = JSON.parse(jsonString);
    } catch (e) {
      console.error("Error parsing concept response:", e);
      conceptData = {
        concept: objectType === "table" ? dbObject.table_name.toLowerCase().replace(/_/g, ' ') :
          objectType === "column" ? dbObject.column_name.toLowerCase().replace(/_/g, ' ') :
            dbObject.schema_name.toLowerCase().replace(/_/g, ' '),
        alternate_forms: [],
        description: `${objectType} in the database`,
        example_phrases: []
      };
    }

    // Vectorize the primary concept
    const conceptVector = await vectorize({
      nuid: "system",
      content: `${conceptData.concept} ${conceptData.description} ${conceptData.alternate_forms.join(' ')}`
    });

    return {
      ...conceptData,
      conceptVector
    };
  } catch (error) {
    console.error(`Error generating concepts for ${objectType}:`, error);
    throw error;
  }
}

/**
 * Process a database table and generate concepts for it and its columns
 * @param {Object} tableDoc - The table document from the metadata index
 * @returns {Promise<Array>} Array of concept documents
 */
async function processTableAndColumns(tableDoc) {
  try {
    // Parse content if needed
    let content;
    try {
      content = typeof tableDoc.content === 'string' ? JSON.parse(tableDoc.content) : tableDoc.content;
    } catch (e) {
      console.error("Error parsing table content:", e);
      return [];
    }

    const tableName = tableDoc.table_name;
    const schemaName = tableDoc.schema_name || content.table_schem;
    const columns = content.columns || [];
    const primaryKeys = content.primaryKeys || [];
    const foreignKeys = content.foreignKeys || [];

    // Create the table object
    const tableObject = {
      table_name: tableName,
      table_schem: schemaName,
      schema_name: schemaName,
      columns: columns,
      primaryKeys: primaryKeys,
      foreignKeys: foreignKeys
    };

    // Generate concepts for the table
    const tableConceptData = await generateConceptsWithLM(tableObject, "table");

    // Create the table concept document
    const tableConceptDoc = {
      id: `table_${schemaName}_${tableName}`.replace(/[^a-zA-Z0-9_]/g, '_'),
      concept: tableConceptData.concept,
      alternate_forms: tableConceptData.alternate_forms,
      entity_type: "table",
      schema_name: schemaName,
      table_name: tableName,
      column_name: null,
      description: tableConceptData.description,
      confidence: 0.9,
      example_phrases: tableConceptData.example_phrases,
      concept_vector: tableConceptData.conceptVector
    };

    // Array to hold all concept documents
    const conceptDocs = [tableConceptDoc];

    // Process each column
    for (const column of columns) {
      // Skip processing columns with generic/common names like "id", "created_date", etc.
      if (/^(id|created_by|created_date|updated_by|updated_date|version)$/i.test(column.column_name)) {
        continue;
      }

      // Create column object
      const columnObject = {
        column_name: column.column_name,
        type_name: column.type_name,
        table_name: tableName,
        schema_name: schemaName,
        is_primary: primaryKeys.some(pk => pk.column_name === column.column_name),
        is_nullable: column.is_nullable || (column.nullable === 1 ? 'YES' : 'NO')
      };

      // Generate concepts for the column
      const columnConceptData = await generateConceptsWithLM(columnObject, "column");

      // Create the column concept document
      const columnConceptDoc = {
        id: `column_${schemaName}_${tableName}_${column.column_name}`.replace(/[^a-zA-Z0-9_]/g, '_'),
        concept: columnConceptData.concept,
        alternate_forms: columnConceptData.alternate_forms,
        entity_type: "column",
        schema_name: schemaName,
        table_name: tableName,
        column_name: column.column_name,
        description: columnConceptData.description,
        confidence: 0.85,
        example_phrases: columnConceptData.example_phrases,
        concept_vector: columnConceptData.conceptVector
      };

      conceptDocs.push(columnConceptDoc);
    }

    return conceptDocs;
  } catch (error) {
    console.error("Error processing table and columns:", error);
    return [];
  }
}

/**
 * Build the conceptual index by processing all tables from the metadata index
 */
export async function buildConceptualIndex() {
  try {
    // Get the client for the concept index
    const { conceptIndexClient } = getSearchClients();

    // Get all database objects from the metadata index
    const results = await searchIndex({
      searchIndex: METADATA_INDEX_NAME,
      selectFields: ["database_name", "schema_name", "table_name", "content"],
      searchEmbedding: null,
      nearestNeighbors: 1000  // Set to a large number to get all records
    });

    // Set to track processed schemas
    const processedSchemas = new Set();

    // Process tables in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      const batchPromises = batch.map(async (result) => {
        try {
          const doc = result.document;
          if (!doc || !doc.table_name || !doc.content) return [];

          // Track schemas to process them separately
          const schemaName = doc.schema_name ||
            (typeof doc.content === 'string' ?
              JSON.parse(doc.content).table_schem :
              doc.content.table_schem);

          if (schemaName) {
            processedSchemas.add(schemaName);
          }

          // Process the table and its columns
          return await processTableAndColumns(doc);
        } catch (e) {
          console.error("Error processing document:", e);
          return [];
        }
      });

      const batchResults = await Promise.all(batchPromises);
      const conceptDocs = batchResults.flat();

      // Upload concepts to the index in smaller batches
      const uploadBatchSize = 50;
      for (let j = 0; j < conceptDocs.length; j += uploadBatchSize) {
        const uploadBatch = conceptDocs.slice(j, j + uploadBatchSize);
        await conceptIndexClient.uploadDocuments(uploadBatch);
      }
    }

    // Process schemas
    const schemaConceptDocs = [];
    for (const schema of processedSchemas) {
      const schemaObject = {
        schema_name: schema
      };

      const schemaConceptData = await generateConceptsWithLM(schemaObject, "schema");

      const schemaConceptDoc = {
        id: `schema_${schema}`.replace(/[^a-zA-Z0-9_]/g, '_'),
        concept: schemaConceptData.concept,
        alternate_forms: schemaConceptData.alternate_forms,
        entity_type: "schema",
        schema_name: schema,
        table_name: null,
        column_name: null,
        description: schemaConceptData.description,
        confidence: 0.95,
        example_phrases: schemaConceptData.example_phrases,
        concept_vector: schemaConceptData.conceptVector
      };

      schemaConceptDocs.push(schemaConceptDoc);
    }

    // Upload schema concepts
    if (schemaConceptDocs.length > 0) {
      await conceptIndexClient.uploadDocuments(schemaConceptDocs);
    }

    return {
      success: true,
      tablesProcessed: results.length,
      schemasProcessed: processedSchemas.size
    };
  } catch (error) {
    console.error("Error building conceptual index:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Search the conceptual index for a given concept
 * @param {Object} params - Search parameters
 * @param {string} params.concept - The concept to search for
 * @param {string} params.entityType - Optional entity type filter (table, column, schema)
 * @returns {Promise<Array>} Search results
 */
export async function searchConceptualIndex({ concept, entityType, limit = 10 }) {
  try {
    // Get the client for the concept index
    const { conceptIndexClient } = getSearchClients();

    // Create a vector embedding for the concept
    const conceptVector = await vectorize({
      nuid: "system",
      content: concept
    });

    // Prepare filters
    let filter = null;
    if (entityType) {
      filter = `entity_type eq '${entityType}'`;
    }

    // Perform search
    const searchResults = await conceptIndexClient.search(concept, {
      filter: filter,
      top: limit,
      vectorSearchOptions: {
        queries: [{
          vector: conceptVector,
          fields: ["concept_vector"],
          kind: "vector",
          kNearestNeighborsCount: limit
        }]
      },
      semanticSearchOptions: {
        configurationName: "my-semantic-config"
      }
    });

    // Collect results
    const results = [];
    for await (const result of searchResults.results) {
      results.push({
        ...result.document,
        score: result.score
      });
    }

    return results;
  } catch (error) {
    console.error("Error searching conceptual index:", error);
    throw error;
  }
}

/**
 * Add a new concept mapping to the index
 * @param {Object} conceptDoc - The concept document to add
 */
export async function addConceptMapping(conceptDoc) {
  try {
    // Get the client for the concept index
    const { conceptIndexClient } = getSearchClients();

    // Ensure the document has a vector embedding
    if (!conceptDoc.concept_vector) {
      conceptDoc.concept_vector = await vectorize({
        nuid: "system",
        content: `${conceptDoc.concept} ${conceptDoc.description} ${conceptDoc.alternate_forms?.join(' ') || ''}`
      });
    }

    // Upload the document
    await conceptIndexClient.uploadDocuments([conceptDoc]);

    return {
      success: true,
      message: "Concept mapping added successfully"
    };
  } catch (error) {
    console.error("Error adding concept mapping:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Map a natural language query to database objects using the conceptual index
 * @param {Object} params - Parameters
 * @param {string} params.query - The natural language query
 * @returns {Promise<Object>} The mapped database objects
 */
export async function mapQueryToDatabaseObjects({ query }) {
  try {
    // Extract potential concepts from the query using the LM
    const extractionPrompt = `
    Extract database concepts from this user query. Identify potential:
    - Table references (nouns that might be tables)
    - Column references (attributes or properties mentioned)
    - Schema references (database sections mentioned)
    - Conditions or filters
    
    Format as JSON with these arrays:
    - tableConcepts: Concepts that likely refer to tables
    - columnConcepts: Concepts that likely refer to columns
    - schemaConcepts: Concepts that likely refer to schemas
    - conditions: Any conditions or filters mentioned
    
    For the user query: "${query}"
    `;

    let extractionResponse = "";
    await chatCompletionMarkdown({
      messages: [
        { role: "system", content: "You are a database query analyzer that extracts key concepts from natural language." },
        { role: "user", content: extractionPrompt }
      ],
      onToken: (content) => { extractionResponse += content; }
    });

    // Parse extraction response
    let extractedConcepts;
    try {
      const jsonMatch = extractionResponse.match(/```json\n([\s\S]*?)\n```/) || extractionResponse.match(/({[\s\S]*})/) || [null, extractionResponse]; // Ensure valid fallback
      const jsonString = jsonMatch[1];
      extractedConcepts = JSON.parse(jsonString);
    } catch (e) {
      console.error("Error parsing extraction response:", e);
      extractedConcepts = {
        tableConcepts: [],
        columnConcepts: [],
        schemaConcepts: [],
        conditions: []
      };
    }

    // Search for each concept type
    const tableResults = [];
    for (const concept of extractedConcepts.tableConcepts || []) {
      const results = await searchConceptualIndex({
        concept,
        entityType: "table",
        limit: 3
      });
      tableResults.push(...results);
    }

    const columnResults = [];
    for (const concept of extractedConcepts.columnConcepts || []) {
      const results = await searchConceptualIndex({
        concept,
        entityType: "column",
        limit: 3
      });
      columnResults.push(...results);
    }

    const schemaResults = [];
    for (const concept of extractedConcepts.schemaConcepts || []) {
      const results = await searchConceptualIndex({
        concept,
        entityType: "schema",
        limit: 2
      });
      schemaResults.push(...results);
    }

    // Deduplicate and sort by score
    const uniqueTables = {};
    tableResults.forEach(result => {
      const key = `${result.schema_name}.${result.table_name}`;
      if (!uniqueTables[key] || uniqueTables[key].score < result.score) {
        uniqueTables[key] = result;
      }
    });

    const uniqueColumns = {};
    columnResults.forEach(result => {
      const key = `${result.schema_name}.${result.table_name}.${result.column_name}`;
      if (!uniqueColumns[key] || uniqueColumns[key].score < result.score) {
        uniqueColumns[key] = result;
      }
    });

    const uniqueSchemas = {};
    schemaResults.forEach(result => {
      if (!uniqueSchemas[result.schema_name] || uniqueSchemas[result.schema_name].score < result.score) {
        uniqueSchemas[result.schema_name] = result;
      }
    });

    return {
      tables: Object.values(uniqueTables).sort((a, b) => b.score - a.score),
      columns: Object.values(uniqueColumns).sort((a, b) => b.score - a.score),
      schemas: Object.values(uniqueSchemas).sort((a, b) => b.score - a.score),
      conditions: extractedConcepts.conditions || []
    };
  } catch (error) {
    console.error("Error mapping query to database objects:", error);
    throw error;
  }
}

/**
 * Process multiple tables at once for better efficiency
 * @param {Array} tableDocs - Array of table documents from the metadata index
 * @returns {Promise<Array>} Array of concept documents
 */
async function processTablesInBatch(tableDocs) {
  try {
    // Prepare objects for batch processing
    const dbObjects = [];

    // First, process each table
    for (const tableDoc of tableDocs) {
      // Parse content if needed
      let content;
      try {
        content = typeof tableDoc.content === 'string' ? JSON.parse(tableDoc.content) : tableDoc.content;
      } catch (e) {
        console.error("Error parsing table content:", e);
        continue;
      }

      const tableName = tableDoc.table_name;
      const schemaName = tableDoc.schema_name || content.table_schem;
      const columns = content.columns || [];
      const primaryKeys = content.primaryKeys || [];
      const foreignKeys = content.foreignKeys || [];

      // Create the table object
      const tableObject = {
        table_name: tableName,
        table_schem: schemaName,
        schema_name: schemaName,
        columns: columns,
        primaryKeys: primaryKeys,
        foreignKeys: foreignKeys
      };

      // Add table to batch
      dbObjects.push({
        dbObject: tableObject,
        objectType: "table"
      });

      // Add relevant columns to batch
      for (const column of columns) {
        // Skip processing columns with generic/common names
        if (/^(source_create_timestamp|source_change_timestamp|record_status_code|insert_user|insert_process|insert_timestamp|update_user|update_process|update_timestamp|upstream_src_cmt_number|ods_insert_timestamp|ods_update_timestamp)$/i.test(column.column_name)) {
          continue;
        }

        // Create column object
        const columnObject = {
          column_name: column.column_name,
          type_name: column.type_name,
          table_name: tableName,
          schema_name: schemaName,
          is_primary: primaryKeys.some(pk => pk.column_name === column.column_name),
          is_nullable: column.is_nullable || (column.nullable === 1 ? 'YES' : 'NO')
        };

        // Add column to batch
        dbObjects.push({
          dbObject: columnObject,
          objectType: "column"
        });
      }
    }

    // Generate concepts for all objects in batch
    const conceptResults = await batchGenerateConceptsWithLM(dbObjects);

    // Convert to concept documents
    const conceptDocs = [];

    for (const result of conceptResults) {
      const { dbObject, objectType, ...conceptData } = result;

      if (objectType === "table") {
        // Create table concept document
        conceptDocs.push({
          id: `table_${dbObject.schema_name}_${dbObject.table_name}`.replace(/[^a-zA-Z0-9_]/g, '_'),
          concept: conceptData.concept,
          alternate_forms: conceptData.alternate_forms,
          entity_type: "table",
          schema_name: dbObject.schema_name,
          table_name: dbObject.table_name,
          column_name: null,
          description: conceptData.description,
          confidence: 0.9,
          example_phrases: conceptData.example_phrases,
          concept_vector: conceptData.conceptVector
        });
      } else if (objectType === "column") {
        // Create column concept document
        conceptDocs.push({
          id: `column_${dbObject.schema_name}_${dbObject.table_name}_${dbObject.column_name}`.replace(/[^a-zA-Z0-9_]/g, '_'),
          concept: conceptData.concept,
          alternate_forms: conceptData.alternate_forms,
          entity_type: "column",
          schema_name: dbObject.schema_name,
          table_name: dbObject.table_name,
          column_name: dbObject.column_name,
          description: conceptData.description,
          confidence: 0.85,
          example_phrases: conceptData.example_phrases,
          concept_vector: conceptData.conceptVector
        });
      }
    }

    return conceptDocs;
  } catch (error) {
    console.error("Error processing tables in batch:", error);
    return [];
  }
}

/**
 * Enhanced build function that uses batch processing for better performance
 */
export async function buildConceptualIndexEnhanced(schemaName) {
  try {
    // Get the client for the concept index
    const { conceptIndexClient } = getSearchClients();

    // Get all schemas
    const schemas = schemaName ? [schemaName] : await getAllDatabaseSchemas();

    // Process each schema
    for (const schema of schemas) {

      // Get all tables for this schema
      const tables = await getTablesForSchema(schema);

      // Process tables in batches
      const tableBatchSize = 20;
      for (let i = 0; i < tables.length; i += tableBatchSize) {
        const tableBatch = tables.slice(i, i + tableBatchSize);

        // Prepare table objects for batch processing
        const dbObjects = [];

        // Add tables to the batch
        for (const table of tableBatch) {
          // Get columns for this table
          const columns = await getColumnsForTable(table.schema_name, table.table_name);

          // Create table object with all its information
          const tableObject = {
            table_name: table.table_name,
            schema_name: table.schema_name,
            primary_key_columns: table.primary_key_columns || [],
            referenced_by_tables: table.referenced_by_tables || [],
            columns: columns.map(col => ({
              column_name: col.column_name,
              type_name: col.data_type,
              ordinal_position: col.ordinal_position,
              nullable: col.is_nullable ? 1 : 0,
              is_nullable: col.is_nullable ? "YES" : "NO",
              column_size: col.column_size
            }))
          };

          // Add table to batch
          dbObjects.push({
            dbObject: tableObject,
            objectType: "table"
          });

          // Add columns to batch (skip system/metadata columns)
          for (const column of columns) {
            if (/^(id|created_by|created_date|updated_by|updated_date|version)$/i.test(column.column_name)) {
              continue;
            }

            dbObjects.push({
              dbObject: {
                column_name: column.column_name,
                type_name: column.data_type,
                table_name: table.table_name,
                schema_name: table.schema_name,
                is_primary: column.is_primary_key,
                is_nullable: column.is_nullable
              },
              objectType: "column"
            });
          }
        }

        // Generate concepts for all objects in this batch
        const conceptResults = await batchGenerateConceptsWithLM(dbObjects);

        // Convert to concept documents
        const conceptDocs = [];
        for (const result of conceptResults) {
          const { dbObject, objectType, ...conceptData } = result;

          if (objectType === "table") {
            conceptDocs.push({
              id: `table_${dbObject.schema_name}_${dbObject.table_name}`.replace(/[^a-zA-Z0-9_]/g, '_'),
              concept: conceptData.concept,
              alternate_forms: conceptData.alternate_forms,
              entity_type: "table",
              schema_name: dbObject.schema_name,
              table_name: dbObject.table_name,
              column_name: null,
              description: conceptData.description,
              confidence: 0.9,
              example_phrases: conceptData.example_phrases,
              concept_vector: conceptData.conceptVector
            });
          } else if (objectType === "column") {
            conceptDocs.push({
              id: `column_${dbObject.schema_name}_${dbObject.table_name}_${dbObject.column_name}`.replace(/[^a-zA-Z0-9_]/g, '_'),
              concept: conceptData.concept,
              alternate_forms: conceptData.alternate_forms,
              entity_type: "column",
              schema_name: dbObject.schema_name,
              table_name: dbObject.table_name,
              column_name: dbObject.column_name,
              description: conceptData.description,
              confidence: 0.85,
              example_phrases: conceptData.example_phrases,
              concept_vector: conceptData.conceptVector
            });
          }
        }

        // Upload concept documents
        if (conceptDocs.length > 0) {
          // Upload in smaller batches
          const uploadBatchSize = 50;
          for (let j = 0; j < conceptDocs.length; j += uploadBatchSize) {
            const uploadBatch = conceptDocs.slice(j, j + uploadBatchSize);
            await conceptIndexClient.uploadDocuments(uploadBatch);
          }
        }
      }
    }

    // Create schema concept documents
    const schemaObjects = schemas.map(schema => ({
      dbObject: { schema_name: schema },
      objectType: "schema"
    }));

    const schemaResults = await batchGenerateConceptsWithLM(schemaObjects);
    const schemaConceptDocs = schemaResults.map(result => {
      const { dbObject, objectType, ...conceptData } = result;
      return {
        id: `schema_${dbObject.schema_name}`.replace(/[^a-zA-Z0-9_]/g, '_'),
        concept: conceptData.concept,
        alternate_forms: conceptData.alternate_forms,
        entity_type: "schema",
        schema_name: dbObject.schema_name,
        table_name: null,
        column_name: null,
        description: conceptData.description,
        confidence: 0.95,
        example_phrases: conceptData.example_phrases,
        concept_vector: conceptData.conceptVector
      };
    });

    // Upload schema concepts
    if (schemaConceptDocs.length > 0) {
      await conceptIndexClient.uploadDocuments(schemaConceptDocs);
    }

    return {
      success: true,
      schemasProcessed: schemas.length,
      method: "metadata-based-processing"
    };
  } catch (error) {
    console.error("Error building conceptual index with metadata-based processing:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create a workflow that first processes JDBC metadata and then builds the conceptual index
 */
export async function createFullDatabaseConceptualSystem(schemaName) {
  try {
    // Step 1: Import the migration function from metadata service
    const { migrateJdbcMetadata, createJdbcMetadataIndex } = await import('./dbMetadataIndexService.js');

    // First ensure the JDBC metadata index exists
    await createJdbcMetadataIndex(schemaName);

    // Step 2: Process JDBC metadata into structured form
    const metadataResult = await migrateJdbcMetadata(schemaName);

    if (!metadataResult.success) {
      throw new Error(`Metadata migration failed: ${metadataResult.error}`);
    }

    // Pause to ensure index is fully updated
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 3: Build conceptual index based on the processed metadata
    const conceptResult = await buildConceptualIndexEnhanced(schemaName);

    if (!conceptResult.success) {
      throw new Error(`Conceptual index build failed: ${conceptResult.error}`);
    }


    return {
      success: true,
      metadataResult,
      conceptResult
    };
  } catch (error) {
    console.error("Error creating full database conceptual system:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get natural language concepts for a specific database object from the conceptual index
 * @param {Object} params - Search parameters
 * @param {string} params.schemaName - Schema name
 * @param {string} params.tableName - Optional table name
 * @param {string} params.columnName - Optional column name
 * @returns {Promise<Object>} Concepts for the specified database object
 */
export async function getConceptsForDatabaseObject({ schemaName, tableName, columnName }) {
  try {
    // Determine the entity type based on provided parameters
    let entityType = "schema";
    let filter = `schema_name eq '${schemaName}'`;

    if (tableName) {
      entityType = columnName ? "column" : "table";
      filter += ` and table_name eq '${tableName}'`;

      if (columnName) {
        filter += ` and column_name eq '${columnName}'`;
      }
    }

    filter += ` and entity_type eq '${entityType}'`;

    // Get the client for the concept index
    const { conceptIndexClient } = getSearchClients();

    // Perform search
    const searchResults = await conceptIndexClient.search("*", {
      filter: filter,
      top: 1
    });

    // Get the first matching result
    let conceptDoc = null;
    for await (const result of searchResults.results) {
      conceptDoc = result.document;
      break;
    }

    if (!conceptDoc) {
      // If no concept exists, generate one on-the-fly
      if (entityType === "schema") {
        const schemaObject = { schema_name: schemaName };
        const conceptData = await generateConceptsWithLM(schemaObject, "schema");

        conceptDoc = {
          concept: conceptData.concept,
          alternate_forms: conceptData.alternate_forms,
          description: conceptData.description,
          example_phrases: conceptData.example_phrases
        };
      } else if (entityType === "table") {
        // Get table details from metadata index
        const tableDetails = await getTablesForSchema(schemaName)
          .then(tables => tables.find(t => t.table_name === tableName));

        if (tableDetails) {
          const columns = await getColumnsForTable(schemaName, tableName);

          const tableObject = {
            table_name: tableName,
            schema_name: schemaName,
            columns: columns.map(col => ({
              column_name: col.column_name,
              type_name: col.data_type
            })),
            primaryKeys: tableDetails.primary_key_columns?.map(pk => ({ column_name: pk })) || []
          };

          const conceptData = await generateConceptsWithLM(tableObject, "table");

          conceptDoc = {
            concept: conceptData.concept,
            alternate_forms: conceptData.alternate_forms,
            description: conceptData.description,
            example_phrases: conceptData.example_phrases
          };
        }
      } else if (entityType === "column") {
        // Get column details from metadata index
        const columnDetails = await getColumnsForTable(schemaName, tableName)
          .then(columns => columns.find(c => c.column_name === columnName));

        if (columnDetails) {
          const columnObject = {
            column_name: columnName,
            type_name: columnDetails.data_type,
            table_name: tableName,
            schema_name: schemaName,
            is_primary: columnDetails.is_primary_key,
            is_nullable: columnDetails.is_nullable
          };

          const conceptData = await generateConceptsWithLM(columnObject, "column");

          conceptDoc = {
            concept: conceptData.concept,
            alternate_forms: conceptData.alternate_forms,
            description: conceptData.description,
            example_phrases: conceptData.example_phrases
          };
        }
      }
    }

    return {
      success: !!conceptDoc,
      entityType,
      concepts: conceptDoc
    };
  } catch (error) {
    console.error("Error getting concepts for database object:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get database objects that match a natural language concept
 * @param {string} concept - Natural language concept
 * @returns {Promise<Object>} Database objects that match the concept
 */
export async function getDatabaseObjectsForConcept(concept) {
  try {
    const conceptResults = await searchConceptualIndex({
      concept,
      limit: 5
    });

    // Group results by entity type
    const tables = conceptResults.filter(r => r.entity_type === "table");
    const columns = conceptResults.filter(r => r.entity_type === "column");
    const schemas = conceptResults.filter(r => r.entity_type === "schema");

    // Get additional metadata for each matched object
    const enhancedResults = {
      tables: await Promise.all(tables.map(async table => {
        const tableDetails = await getTablesForSchema(table.schema_name)
          .then(tables => tables.find(t => t.table_name === table.table_name) || {});

        return {
          ...table,
          primaryKeys: tableDetails.primary_key_columns || [],
          referencedBy: tableDetails.referenced_by_tables || []
        };
      })),
      columns: await Promise.all(columns.map(async column => {
        const columnDetails = await getColumnsForTable(column.schema_name, column.table_name)
          .then(columns => columns.find(c => c.column_name === column.column_name) || {});

        return {
          ...column,
          dataType: columnDetails.data_type,
          isPrimary: columnDetails.is_primary_key,
          isNullable: columnDetails.is_nullable
        };
      })),
      schemas
    };

    return {
      success: true,
      results: enhancedResults,
      matchCount: conceptResults.length
    };
  } catch (error) {
    console.error("Error getting database objects for concept:", error);
    return {
      success: false,
      error: error.message
    };
  }
}
