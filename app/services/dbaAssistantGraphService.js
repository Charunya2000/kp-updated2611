'use server';

import { Annotation, StateGraph, START, END } from "./langgraphs/langgraph-light.js";
import { chatCompletionMarkdown, chatCompletionPrompts } from './chatCompletionService2.js';
import { searchIndex, semanticSearchIndex, searchIndexWithVectorField } from './searchVectorDataService.js';
import { vectorize } from './vectorizeDataService.js';
// Import conceptual index functions to leverage natural language to database object mapping
import { searchConceptualIndex, mapQueryToDatabaseObjects } from './dbConceptualIndexService.js';
// Import the database metadata service to access the structured metadata index
import { searchDatabaseMetadata } from './dbMetadataIndexService.js';
import { systemPromptNode } from "./langgraphs/shared/nodes/addSystemPromptsNode.js";

// Update the system context to emphasize fully qualified names
const dbaSystemContext = `
You are a KPMC Assistant with the DBA persona. 
You help users write SQL queries for Oracle Database using foundational knowledge and the following Azure AI Search indexes:
- db-concepts-001
- jdbc-metadata-001.
Tips:
- First analyze the user prompt to determine tables and columns of interest.
- Query the concepts index (multiple times if needed) to capture all documents needed to construct the query.
- Review content JSON for table relationships (foreignKeys, primaryKeys).
- Only construct the query once you have all necessary table/column/relationship information.
- Always use fully qualified table names with schema (SCHEMA_NAME.TABLE_NAME).
- Avoid PII/PHI in all responses.
- Always format your responses using proper markdown syntax.
- Place SQL queries in \`\`\`sql code blocks.
- Use markdown tables when appropriate for structured data.
- Use headers (##, ###) for section organization.
`;

// Node: Parse user intent to identify key entities
const parseUserIntentNode = async (state) => {
  state.onProgress?.("Parsing the user's intent");
  const messages = [
    {
      role: "system",
      content: `You are a database query analyzer specialized in extracting both explicit and implicit database references.
      Important: Users often refer to database objects indirectly or conceptually. For example:
      - "Using the member owner schema" should be identified as the schema "MEMBER_OWNER"
      - "Looking for person name and date of birth" should identify conceptual column needs
      - "Information about patients" might refer to a person-related table
      
      Distinguish between SCHEMA names and TABLE names. For example, 'MEMBER_OWNER.TAP_PERSON' means 
      MEMBER_OWNER is the schema and TAP_PERSON is the table.
      
      Respond in JSON format with fields:
      - schemas (array): Schema names mentioned or implied in the query
      - tables (array): Table names mentioned or implied in the query (do NOT include schema names here)
      - columns (array): Exact column names mentioned in the query
      - columnConcepts (array): Conceptual column descriptions (like "person name", "date of birth", "birth date", "full name")
      - tableConcepts (array): Conceptual table descriptions (like "person", "member", "patient", "coverage")
      - conditions (array): Filter conditions mentioned in the query (e.g., "starts on June 1st 2023")
      - relationships (array): Table join relationships mentioned
      - queryType (string): Type of query (SELECT, INSERT, etc.)
      
      Be thorough in identifying all possible relevant concepts. Include variations of terms (e.g., both "date of birth" and "birth date").`
    },
    { role: "user", content: state.userPrompt }
  ];

  let intentResponse = "";
  await chatCompletionMarkdown({
    messages,
    onToken: (content) => { intentResponse += content; },
    teamName: state?.teamName,
    assistantName: state?.assistantName,
  });

  // Parse JSON response, handle potential errors
  let parsedIntent;
  try {
    // Extract JSON from the response
    const jsonMatch = intentResponse.match(/```json\n([\s\S]*?)\n```/) ||
      intentResponse.match(/({[\s\S]*})/) ||
      [null, intentResponse];
    const jsonString = jsonMatch[1];
    parsedIntent = JSON.parse(jsonString);

    // Ensure we have all required properties with defaults
    parsedIntent = {
      schemas: parsedIntent.schemas || [],
      tables: parsedIntent.tables || [],
      columns: parsedIntent.columns || [],
      columnConcepts: parsedIntent.columnConcepts || [],
      tableConcepts: parsedIntent.tableConcepts || [],
      conditions: parsedIntent.conditions || [],
      relationships: parsedIntent.relationships || [],
      queryType: parsedIntent.queryType || "unknown"
    };

  } catch (e) {
    console.error("Error parsing intent:", e);
    parsedIntent = {
      schemas: [],
      tables: [],
      columns: [],
      columnConcepts: [],
      conditions: [],
      relationships: [],
      queryType: "unknown"
    };
  }

  return { parsedIntent };
};

// Node: Vectorize user prompt
const vectorizePromptNode = async (state) => {
  const promptEmbedding = await vectorize({ nuid: state.nuid, content: state.userPrompt });
  return { promptEmbedding };
};

// Node: Create tailored search strategies based on user intent
const createSearchStrategyNode = async (state) => {
  state.onProgress?.('Creating a search strategy');
  const { parsedIntent } = state;
  const searchStrategies = [];

  // First, create a semantic search strategy based on the entire user prompt
  // This helps catch implied database objects that might be missed by explicit extraction
  searchStrategies.push({
    type: "semanticContextSearch",
    priority: "high"
  });

  // Add a high-priority strategy specifically for conceptual index search
  searchStrategies.push({
    type: "conceptIndexSearch",
    priority: "high",
    intent: parsedIntent
  });

  // Strategy 1: Search by schema - both explicit and variations
  if (parsedIntent.schemas && parsedIntent.schemas.length > 0) {
    for (const schema of parsedIntent.schemas) {
      // Exact match
      searchStrategies.push({
        type: "schemaSearch",
        filter: `schema_name eq '${schema.toUpperCase()}'`
      });
    }
  }

  // Strategy 2: Search by explicit table names
  if (parsedIntent.tables && parsedIntent.tables.length > 0) {
    for (const table of parsedIntent.tables) {
      // First, try exact match
      searchStrategies.push({
        type: "tableSearch",
        filter: `table_name eq '${table.toUpperCase()}'`,
        tableName: table
      });
    }
  }

  // Strategy 3: Search by table concepts (using the conceptual index)
  if (parsedIntent.tableConcepts && parsedIntent.tableConcepts.length > 0) {
    for (const tableConcept of parsedIntent.tableConcepts) {
      searchStrategies.push({
        type: "tableConceptSearch",
        concept: tableConcept
      });
    }
  }

  // Strategy 4: Search by column names and concepts (using the conceptual index)
  const allColumnTerms = [
    ...(parsedIntent.columns || []),
    ...(parsedIntent.columnConcepts || [])
  ];

  if (allColumnTerms.length > 0) {
    searchStrategies.push({
      type: "columnSearch",
      terms: allColumnTerms,
      exactColumns: parsedIntent.columns || [],
      conceptColumns: parsedIntent.columnConcepts || []
    });
  }

  // Strategy 5: General vector search (fallback)
  searchStrategies.push({
    type: "vectorSearch",
    priority: searchStrategies.length === 0 ? "high" : "low"
  });

  return { searchStrategies };
};

// Node: Execute multiple search strategies and gather results
const executeSearchStrategiesNode = async (state) => {
  state.onProgress?.('Gathering database metadata');
  const { searchStrategies, promptEmbedding, userPrompt } = state;
  const allResults = [];
  const discoveredTables = new Set();
  const conceptualMappings = {}; // Store conceptual mappings for later reference

  // Execute each strategy
  for (const strategy of searchStrategies) {
    let results = [];

    if (strategy.type === "conceptIndexSearch") {
      // Use the conceptual index directly with the parsed intent
      try {
        const { intent } = strategy;

        // Store the parsed intent for later reference
        conceptualMappings.tables = [];
        conceptualMappings.columns = [];
        conceptualMappings.schemas = [];
        conceptualMappings.conditions = intent.conditions || [];

        // Search for table concepts from the parsed intent
        if (intent.tableConcepts && intent.tableConcepts.length > 0) {
          for (const tableConcept of intent.tableConcepts) {
            // Search the concept index for this table concept
            const conceptResults = await searchConceptualIndex({
              concept: tableConcept,
              entityType: "table",
              limit: 5
            });

            // Add to conceptual mappings
            conceptualMappings.tables.push(...conceptResults);

            // For each matched table, get the full metadata
            for (const table of conceptResults) {
              const metadataResults = await searchDatabaseMetadata({
                entityType: "table",
                schemaName: table.schema_name,
                tableName: table.table_name
              });

              // Format the results to match the expected structure
              results.push(...metadataResults.map(doc => ({
                document: doc,
                score: table.score || 0.8,
                conceptMatch: true,
                matchType: "conceptual-table",
                matchedConcept: tableConcept
              })));

              // Also get columns for this table
              const columnResults = await searchDatabaseMetadata({
                entityType: "column",
                schemaName: table.schema_name,
                tableName: table.table_name
              });

              if (columnResults.length > 0) {
                // Add table's columns information to the results
                results.push({
                  document: {
                    schema_name: table.schema_name,
                    table_name: table.table_name,
                    columns: columnResults
                  },
                  score: table.score || 0.8,
                  conceptMatch: true,
                  matchType: "table-columns",
                  matchedConcept: tableConcept
                });
              }
            }
          }
        }

        // Search for column concepts from the parsed intent
        if (intent.columnConcepts && intent.columnConcepts.length > 0) {
          for (const columnConcept of intent.columnConcepts) {
            // Search the concept index for this column concept
            const conceptResults = await searchConceptualIndex({
              concept: columnConcept,
              entityType: "column",
              limit: 5
            });

            // Add to conceptual mappings
            conceptualMappings.columns.push(...conceptResults);

            // For each matched column, get the full metadata
            for (const column of conceptResults) {
              // Get the column metadata
              const columnMetadata = await searchDatabaseMetadata({
                entityType: "column",
                schemaName: column.schema_name,
                tableName: column.table_name,
                searchText: column.column_name
              });

              results.push(...columnMetadata.map(doc => ({
                document: doc,
                score: column.score || 0.8,
                conceptMatch: true,
                matchType: "conceptual-column",
                matchedConcept: columnConcept
              })));

              // Also get the table this column belongs to
              const tableMetadata = await searchDatabaseMetadata({
                entityType: "table",
                schemaName: column.schema_name,
                tableName: column.table_name
              });

              if (tableMetadata.length > 0) {
                results.push({
                  document: tableMetadata[0],
                  score: column.score || 0.8,
                  conceptMatch: true,
                  matchType: "column-table",
                  matchedConcept: columnConcept
                });
              }
            }
          }
        }

        // If we didn't find anything with the parsed intent, fall back to the general mapping approach
        if (results.length === 0) {

          // Use the general concept mapping as a backup
          const generalMapping = await mapQueryToDatabaseObjects({
            query: userPrompt
          });

          // Add the results from general mapping
          conceptualMappings.tables.push(...(generalMapping.tables || []));
          conceptualMappings.columns.push(...(generalMapping.columns || []));
          conceptualMappings.schemas.push(...(generalMapping.schemas || []));

          // Process the general mapping results
          // For each table found in the general mapping
          for (const table of generalMapping.tables || []) {
            const metadataResults = await searchDatabaseMetadata({
              entityType: "table",
              schemaName: table.schema_name,
              tableName: table.table_name
            });

            results.push(...metadataResults.map(doc => ({
              document: doc,
              score: table.score || 0.7,
              conceptMatch: true,
              matchType: "general-mapping-table"
            })));

            // Get columns for this table
            const columnResults = await searchDatabaseMetadata({
              entityType: "column",
              schemaName: table.schema_name,
              tableName: table.table_name
            });

            if (columnResults.length > 0) {
              results.push({
                document: {
                  schema_name: table.schema_name,
                  table_name: table.table_name,
                  columns: columnResults
                },
                score: table.score || 0.7,
                conceptMatch: true,
                matchType: "general-mapping-table-columns"
              });
            }
          }

          // For each column found in general mapping
          for (const column of generalMapping.columns || []) {
            const columnMetadata = await searchDatabaseMetadata({
              entityType: "column",
              schemaName: column.schema_name,
              tableName: column.table_name,
              searchText: column.column_name
            });

            results.push(...columnMetadata.map(doc => ({
              document: {
                schema_name: column.schema_name,
                table_name: column.table_name,
                column_name: column.column_name,
                metadata: doc
              },
              score: column.score || 0.7,
              conceptMatch: true,
              matchType: "general-mapping-column"
            })));

            // Get the table this column belongs to
            const tableResults = await searchDatabaseMetadata({
              entityType: "table",
              schemaName: column.schema_name,
              tableName: column.table_name
            });

            if (tableResults.length > 0) {
              results.push({
                document: tableResults[0],
                score: column.score || 0.7,
                conceptMatch: true,
                matchType: "general-mapping-column-table"
              });
            }
          }
        }

      } catch (error) {
        console.error("Error using conceptual index:", error);
      }
    } else if (strategy.type === "semanticContextSearch") {
      // Perform a broader search using the entire user prompt
      try {
        // Search for tables first
        const tableResults = await searchDatabaseMetadata({
          entityType: "table",
          searchText: userPrompt,
          limit: 15
        });

        results.push(...tableResults.map(doc => ({
          document: doc,
          score: 0.7,
          matchType: "semantic-table-search"
        })));

        // Then search for columns that might match the user's intent
        const columnResults = await searchDatabaseMetadata({
          entityType: "column",
          searchText: userPrompt,
          limit: 15
        });

        results.push(...columnResults.map(doc => ({
          document: doc,
          score: 0.6,
          matchType: "semantic-column-search"
        })));
      } catch (error) {
        console.error("Error in semantic search:", error);

        // Fallback to vector search if semantic search fails
        results = await searchIndex({
          searchIndex: 'smart-database-001', // Use the correct index
          selectFields: ["database_name", "schema_name", "table_name", "content"],
          searchEmbedding: promptEmbedding,
          nearestNeighbors: 15
        });
      }
    } else if (strategy.type === "tableConceptSearch" && strategy.concept) {
      // Search for tables matching this concept
      try {
        const tableResults = await searchDatabaseMetadata({
          entityType: "table",
          searchText: strategy.concept,
          limit: 8
        });

        results.push(...tableResults.map(doc => ({
          document: doc,
          score: 0.8,
          matchType: "concept-table-search",
          sourceConcept: strategy.concept
        })));
      } catch (error) {
        console.error("Error searching for table concept:", error);
      }
    } else if (strategy.type === "columnSearch" && strategy.terms.length > 0) {
      // Search for columns matching these terms
      try {
        for (const term of strategy.terms) {
          const columnResults = await searchDatabaseMetadata({
            entityType: "column",
            searchText: term,
            limit: 5
          });

          // For each column, also get its table
          for (const column of columnResults) {
            results.push({
              document: column,
              score: 0.8,
              matchType: "column-term-search",
              searchTerm: term
            });

            // Get the table this column belongs to
            if (column.table_name && column.schema_name) {
              const tableResults = await searchDatabaseMetadata({
                entityType: "table",
                schemaName: column.schema_name,
                tableName: column.table_name,
                limit: 1
              });

              if (tableResults.length > 0) {
                results.push({
                  document: tableResults[0],
                  score: 0.7,
                  matchType: "column-parent-table",
                  relatedColumn: column.column_name
                });
              }
            }
          }
        }
      } catch (error) {
        console.error("Error searching for column terms:", error);
      }
    } else if (strategy.type === "schemaSearch") {
      // Search for tables in this schema
      try {
        const schemaName = strategy.filter.match(/schema_name eq '([^']+)'/)[1];
        const tableResults = await searchDatabaseMetadata({
          entityType: "table",
          schemaName: schemaName,
          limit: 20
        });

        results.push(...tableResults.map(doc => ({
          document: doc,
          score: 0.9,
          matchType: "schema-table-search"
        })));
      } catch (error) {
        console.error("Error in schema search:", error);
      }
    } else if (strategy.type === "tableSearch") {
      // Search for this specific table
      try {
        const tableName = strategy.filter.match(/table_name eq '([^']+)'/)[1];
        const tableResults = await searchDatabaseMetadata({
          entityType: "table",
          tableName: tableName,
          limit: 5
        });

        results.push(...tableResults.map(doc => ({
          document: doc,
          score: 0.95,
          matchType: "exact-table-search"
        })));

        // Also get columns for these tables
        for (const table of tableResults) {
          const columnResults = await searchDatabaseMetadata({
            entityType: "column",
            schemaName: table.schema_name,
            tableName: table.table_name,
            limit: 50
          });

          if (columnResults.length > 0) {
            results.push({
              document: {
                schema_name: table.schema_name,
                table_name: table.table_name,
                columns: columnResults
              },
              score: 0.9,
              matchType: "table-columns"
            });
          }
        }
      } catch (error) {
        console.error("Error in table search:", error);
      }
    } else if (strategy.type === "vectorSearch") {
      // Generic vector search - use regular text search for jdbc-metadata-001 since it doesn't have vector fields
      if (searchIndex === 'jdbc-metadata-001') {
        results = await semanticSearchIndex({
          searchIndex: 'jdbc-metadata-001',
          selectFields: ["schema_name", "table_name", "column_name", "entity_type", "fully_qualified_name",
            "primary_key_columns", "references_table", "references_column",
            "referenced_by_tables", "referenced_by_columns"],
          searchText: userPrompt, // Use the original text prompt instead of vector
          filter: strategy.filter,
          top: strategy.priority === "high" ? 15 : 8
        });
      }
    }

    // Add to all results and track discovered tables
    for (const result of results) {
      if (result.document) {
        if (result.document.table_name && !discoveredTables.has(result.document.table_name)) {
          discoveredTables.add(result.document.table_name);
          allResults.push(result);
        } else {
          allResults.push(result);
        }
      }
    }
  }

  return {
    dbSearchResults: allResults,
    discoveredTables: Array.from(discoveredTables),
    conceptualMappings // Pass conceptual mappings to later nodes
  };
};

// Node: Analyze if sufficient info is available and identify missing information
const analyzeDbResultsNode = async (state) => {
  state.onProgress?.('Checking for any missing information');
  const { dbSearchResults, parsedIntent, conceptualMappings } = state;

  // Track what we have and what we need
  const foundTables = new Set();
  const foundColumns = new Set();
  const neededJoins = new Set();
  const missingTables = new Set(parsedIntent.tables || []);
  const missingColumns = new Set(parsedIntent.columns || []);

  // Track table and column information for better query planning
  const tableInfo = {};
  const columnInfo = {};

  // Create a mapping from columns to their tables for maintaining associations
  const columnToTableMap = {};

  // Track which tables are required based on columns in the query
  const requiredTables = new Set();

  // Process each result based on the jdbc-metadata-001 structure
  for (const result of dbSearchResults) {
    const doc = result.document;
    if (!doc) continue;

    try {
      // Process based on entity_type
      if (doc.entity_type === "table") {
        // Track found tables
        foundTables.add(doc.table_name.toLowerCase());
        missingTables.delete(doc.table_name.toLowerCase());

        // Store table information
        const tableKey = `${doc.schema_name}.${doc.table_name}`.toLowerCase();
        tableInfo[tableKey] = {
          schema: doc.schema_name,
          table: doc.table_name,
          primary_key_columns: doc.primary_key_columns || [],
          referenced_by_tables: doc.referenced_by_tables || [],
          referenced_by_columns: doc.referenced_by_columns || [],
          fully_qualified_name: doc.fully_qualified_name
        };

        // Process columns array if it exists (from the table-columns match type)
        if (doc.columns && Array.isArray(doc.columns)) {
          for (const col of doc.columns) {
            const colName = col.column_name.toLowerCase();
            foundColumns.add(colName);
            missingColumns.delete(colName);

            // Add column to table mapping for this column
            columnToTableMap[colName] = {
              schema: doc.schema_name,
              table: doc.table_name,
              qualified_name: `${doc.schema_name}.${doc.table_name}.${col.column_name}`
            };

            // If this column matches anything in user's intent, mark its table as required
            if (parsedIntent.columns && parsedIntent.columns.includes(colName)) {
              requiredTables.add(doc.table_name.toLowerCase());
            }

            // Also check column concepts
            if (parsedIntent.columnConcepts) {
              for (const concept of parsedIntent.columnConcepts) {
                if (colName.includes(concept.toLowerCase())) {
                  requiredTables.add(doc.table_name.toLowerCase());
                  break;
                }
              }
            }

            // Store column information
            const columnKey = `${doc.schema_name}.${doc.table_name}.${col.column_name}`.toLowerCase();
            columnInfo[columnKey] = {
              schema: doc.schema_name,
              table: doc.table_name,
              column: col.column_name,
              data_type: col.data_type,
              is_primary_key: col.is_primary_key,
              is_foreign_key: col.is_foreign_key,
              references_table: col.references_table,
              references_column: col.references_column
            };
          }
        }

        // Identify needed joins from referenced tables
        if (doc.referenced_by_tables) {
          for (let i = 0; i < doc.referenced_by_tables.length; i++) {
            const refTable = doc.referenced_by_tables[i];
            neededJoins.add(`${doc.table_name} <- ${refTable}`);
          }
        }
      }
      else if (doc.entity_type === "column") {
        // Track found columns
        const colName = doc.column_name.toLowerCase();
        foundColumns.add(colName);
        missingColumns.delete(colName);

        // Also track the table that contains this column
        foundTables.add(doc.table_name.toLowerCase());
        missingTables.delete(doc.table_name.toLowerCase());

        // Add column to table mapping
        columnToTableMap[colName] = {
          schema: doc.schema_name,
          table: doc.table_name,
          qualified_name: `${doc.schema_name}.${doc.table_name}.${doc.column_name}`
        };

        // If this column matches anything in user's intent, mark its table as required
        if (parsedIntent.columns && parsedIntent.columns.includes(colName)) {
          requiredTables.add(doc.table_name.toLowerCase());
        }

        // Also check column concepts
        if (parsedIntent.columnConcepts) {
          for (const concept of parsedIntent.columnConcepts) {
            if (colName.includes(concept.toLowerCase())) {
              requiredTables.add(doc.table_name.toLowerCase());
              break;
            }
          }
        }

        // Store column information
        const columnKey = `${doc.schema_name}.${doc.table_name}.${doc.column_name}`.toLowerCase();
        columnInfo[columnKey] = {
          schema: doc.schema_name,
          table: doc.table_name,
          column: doc.column_name,
          data_type: doc.data_type,
          is_primary_key: doc.is_primary_key,
          is_foreign_key: doc.is_foreign_key,
          references_table: doc.references_table,
          references_column: doc.references_column
        };

        // Add table info if not already present
        const tableKey = `${doc.schema_name}.${doc.table_name}`.toLowerCase();
        if (!tableInfo[tableKey]) {
          tableInfo[tableKey] = {
            schema: doc.schema_name,
            table: doc.table_name,
            fully_qualified_name: doc.fully_qualified_name ? doc.fully_qualified_name.split('.').slice(0, 2).join('.') : `${doc.schema_name}.${doc.table_name}`
          };
        }

        // Identify potential joins
        if (doc.is_foreign_key && doc.references_table) {
          neededJoins.add(`${doc.table_name} -> ${doc.references_table}`);
        }
      }
      // Handle special structured results with columns array
      else if (doc.columns && Array.isArray(doc.columns)) {
        // Track found tables
        foundTables.add(doc.table_name.toLowerCase());
        missingTables.delete(doc.table_name.toLowerCase());

        // Process each column
        for (const col of doc.columns) {
          const colName = col.column_name.toLowerCase();
          foundColumns.add(colName);
          missingColumns.delete(colName);

          // Add column to table mapping
          columnToTableMap[colName] = {
            schema: doc.schema_name,
            table: doc.table_name,
            qualified_name: `${doc.schema_name}.${doc.table_name}.${col.column_name}`
          };

          // If this column matches anything in user's intent, mark its table as required
          if (parsedIntent.columns && parsedIntent.columns.includes(colName)) {
            requiredTables.add(doc.table_name.toLowerCase());
          }
        }
      }
    } catch (e) {
      console.error("Error processing database metadata:", e);
    }
  }

  // Enhance analysis with conceptual mappings
  if (conceptualMappings && conceptualMappings.tables) {
    for (const table of conceptualMappings.tables) {
      // Consider conceptually matched tables as found
      foundTables.add(table.table_name.toLowerCase());
      missingTables.delete(table.table_name.toLowerCase());
    }
  }

  if (conceptualMappings && conceptualMappings.columns) {
    for (const column of conceptualMappings.columns) {
      // Consider conceptually matched columns as found
      const colName = column.column_name.toLowerCase();
      foundColumns.add(colName);
      missingColumns.delete(colName);

      // Add column to table mapping
      columnToTableMap[colName] = {
        schema: column.schema_name,
        table: column.table_name,
        qualified_name: `${column.schema_name}.${column.table_name}.${column.column_name}`
      };

      // Mark this table as required since its column matched conceptually
      requiredTables.add(column.table_name.toLowerCase());
    }
  }

  // Calculate overall completeness (0-100)
  const tableScore = parsedIntent.tables && parsedIntent.tables.length > 0
    ? (foundTables.size / (foundTables.size + missingTables.size)) * 100
    : (foundTables.size > 0 ? 100 : 0);

  const columnScore = parsedIntent.columns && parsedIntent.columns.length > 0
    ? (foundColumns.size / (foundColumns.size + missingColumns.size)) * 100
    : (foundColumns.size > 0 ? 100 : 0);

  const relationshipScore = neededJoins.size > 0 ? 100 : 0;

  // Weighted overall score
  const overallScore = (tableScore * 0.4) + (columnScore * 0.4) + (relationshipScore * 0.2);

  // Determine if we have sufficient information
  const sufficientDbInfo = overallScore >= 70;

  // Create analysis result
  const analysisResult = {
    foundTables: Array.from(foundTables),
    foundColumns: Array.from(foundColumns),
    missingTables: Array.from(missingTables),
    missingColumns: Array.from(missingColumns),
    neededJoins: Array.from(neededJoins),
    completenessScore: overallScore,
    sufficientInfo: sufficientDbInfo,
    conceptualMappings: conceptualMappings, // Include conceptual mappings in the analysis
    tableInfo: tableInfo, // Add detailed table information for query planning
    columnInfo: columnInfo, // Add detailed column information for query planning
    columnToTableMap: columnToTableMap, // Add column to table mapping for better table association
    requiredTables: Array.from(requiredTables) // Add list of tables required based on columns in the query
  };

  return {
    sufficientDbInfo,
    analysisResult,
    missingInfo: {
      tables: Array.from(missingTables),
      columns: Array.from(missingColumns)
    }
  };
};

// Node: Search for missing information if needed
const searchMissingInfoNode = async (state) => {
  if (state.sufficientDbInfo) {
    return { additionalDbResults: [] };
  }

  const { missingInfo, promptEmbedding, conceptualMappings } = state;
  const additionalResults = [];

  // First try to find missing tables using the conceptual index
  if (missingInfo.tables.length > 0) {
    for (const table of missingInfo.tables) {
      try {
        // Search for this table concept in the conceptual index
        const conceptResults = await searchConceptualIndex({
          concept: table,
          entityType: "table",
          limit: 3
        });

        // For each match, get the full metadata from jdbc-metadata-001
        for (const conceptTable of conceptResults) {
          const metadataResults = await searchDatabaseMetadata({
            entityType: "table",
            schemaName: conceptTable.schema_name,
            tableName: conceptTable.table_name,
            limit: 3
          });

          additionalResults.push(...metadataResults.map(doc => ({
            document: doc,
            score: conceptTable.score || 0.7,
            conceptMatch: true,
            matchType: "missing-table-concept"
          })));
        }
      } catch (error) {
        console.error(`Error finding missing table ${table} in conceptual index:`, error);

        // Fall back to search in jdbc-metadata-001
        const exactResults = await searchDatabaseMetadata({
          entityType: "table",
          searchText: table,
          limit: 5
        });

        additionalResults.push(...exactResults.map(doc => ({
          document: doc,
          score: 0.7,
          matchType: "missing-table-search"
        })));
      }
    }
  }

  // Search for tables with missing columns
  if (missingInfo.columns.length > 0) {
    for (const column of missingInfo.columns) {
      try {
        // Search for this column concept in the conceptual index
        const conceptResults = await searchConceptualIndex({
          concept: column,
          entityType: "column",
          limit: 3
        });

        // For each match, get the full metadata
        for (const conceptColumn of conceptResults) {
          const metadataResults = await searchDatabaseMetadata({
            entityType: "column",
            schemaName: conceptColumn.schema_name,
            tableName: conceptColumn.table_name,
            searchText: conceptColumn.column_name,
            limit: 3
          });

          additionalResults.push(...metadataResults.map(doc => ({
            document: doc,
            score: conceptColumn.score || 0.7,
            conceptMatch: true,
            matchType: "missing-column-concept"
          })));

          // Also get the table this column belongs to
          const tableResults = await searchDatabaseMetadata({
            entityType: "table",
            schemaName: conceptColumn.schema_name,
            tableName: conceptColumn.table_name,
            limit: 1
          });

          if (tableResults.length > 0) {
            additionalResults.push({
              document: tableResults[0],
              score: conceptColumn.score || 0.7,
              conceptMatch: true,
              matchType: "missing-column-table"
            });
          }
        }
      } catch (error) {
        console.error(`Error finding missing column ${column} in conceptual index:`, error);

        // Fall back to direct search
        const columnResults = await searchDatabaseMetadata({
          entityType: "column",
          searchText: column,
          limit: 5
        });

        additionalResults.push(...columnResults.map(doc => ({
          document: doc,
          score: 0.6,
          matchType: "missing-column-search"
        })));
      }
    }
  }

  // Search for related tables to complete joins
  const tablesForJoins = [
    ...state.analysisResult.foundTables,
    ...(conceptualMappings?.tables?.map(t => t.table_name) || [])
  ];

  if (tablesForJoins.length > 0) {
    for (const table of tablesForJoins) {
      // Find tables that reference this table through foreign keys
      try {
        // Use text search instead of vector search
        const referencingTables = await semanticSearchIndex({
          searchIndex: 'jdbc-metadata-001',
          selectFields: ["schema_name", "table_name", "column_name", "entity_type", "fully_qualified_name",
            "references_table", "references_column", "referenced_by_tables", "referenced_by_columns"],
          searchText: table,
          filter: `references_table eq '${table}' or referenced_by_tables/any(t: t eq '${table}')`,
          top: 10
        });

        for (const refTable of referencingTables) {
          if (refTable.document.references_table === table ||
            (refTable.document.referenced_by_tables &&
              refTable.document.referenced_by_tables.includes(table))) {
            additionalResults.push({
              document: refTable.document,
              score: 0.8,
              matchType: "related-table-join"
            });
          }
        }
      } catch (error) {
        console.error(`Error finding related tables for ${table}:`, error);
      }
    }
  }

  return { additionalDbResults: additionalResults };
};

// Node: Combine all DB info for context
const combineDbInfoNode = async (state) => {
  let allResults = [...state.dbSearchResults];
  if (state.additionalDbResults && state.additionalDbResults.length > 0) {
    // Avoid duplicates by table_name
    const seen = new Set(allResults.map(r => r.document && r.document.table_name));
    for (const r of state.additionalDbResults) {
      if (r.document && r.document.table_name && !seen.has(r.document.table_name)) {
        allResults.push(r);
        seen.add(r.document.table_name);
      }
    }
  }

  // Extract table relationships for improved context
  const tableRelationships = [];
  const processedRelationships = new Set();

  for (const result of allResults) {
    if (!result.document) continue;

    // Get relationships from the jdbc-metadata-001 index format
    if (result.document.references_table) {
      const relationKey = `${result.document.table_name}-${result.document.references_table}`;
      if (!processedRelationships.has(relationKey)) {
        tableRelationships.push({
          sourceTable: result.document.table_name,
          sourceSchema: result.document.schema_name,
          targetTable: result.document.references_table,
          targetSchema: result.document.references_schema || result.document.schema_name,
          sourceColumn: result.document.column_name || "unknown",
          targetColumn: result.document.references_column || "unknown",
          relationship: "FK_REL"
        });
        processedRelationships.add(relationKey);
      }
    }

    // Process referenced_by_tables if available
    if (result.document.referenced_by_tables && Array.isArray(result.document.referenced_by_tables)) {
      for (let i = 0; i < result.document.referenced_by_tables.length; i++) {
        const refTable = result.document.referenced_by_tables[i];
        const refColumn = result.document.referenced_by_columns ?
          result.document.referenced_by_columns[i]?.split('.')?.pop() :
          "unknown";

        const relationKey = `${refTable}-${result.document.table_name}`;
        if (!processedRelationships.has(relationKey)) {
          tableRelationships.push({
            sourceTable: refTable,
            sourceSchema: result.document.schema_name, // Assumption
            targetTable: result.document.table_name,
            targetSchema: result.document.schema_name,
            sourceColumn: refColumn,
            targetColumn: result.document.primary_key_columns?.[0] || "unknown",
            relationship: "FK_REL_REFERENCED"
          });
          processedRelationships.add(relationKey);
        }
      }
    }
  }

  // Prepare context messages for the assistant
  const dbContextMessages = allResults
    .filter(r => r.document)
    .map(r => ({
      role: 'assistant',
      content: `DB Context: ${r.matchType || "Table"} ${r.document.table_name || r.document.column_name || "metadata"} in schema ${r.document.schema_name || "unknown"}, entity type: ${r.document.entity_type || "unknown"}, fully qualified name: ${r.document.fully_qualified_name || "unknown"}`
    }));

  // Add relationship summary if available
  if (tableRelationships.length > 0) {
    dbContextMessages.push({
      role: 'assistant',
      content: `Table Relationships Summary: ${JSON.stringify(tableRelationships)}`
    });
  }

  // Add conceptual mappings to context if available
  if (state.conceptualMappings) {
    dbContextMessages.push({
      role: 'assistant',
      content: `Conceptual Mappings: ${JSON.stringify(state.conceptualMappings)}`
    });
  }

  return {
    dbContextMessages,
    tableRelationships
  };
};

// Helper function to find the shortest path between two tables using BFS
function findShortestPath(graph, startTable, endTable) {
  // If either table doesn't exist in the graph, no path exists
  if (!graph[startTable] || !graph[endTable]) {
    return null;
  }

  // If start and end are the same, return a path with just that table
  if (startTable === endTable) {
    return [startTable];
  }

  // Queue for BFS, initialize with start table
  const queue = [startTable];
  // Keep track of visited tables to avoid cycles
  const visited = new Set([startTable]);
  // Store the path to each table
  const paths = {
    [startTable]: [startTable]
  };

  while (queue.length > 0) {
    const currentTable = queue.shift();

    // Get all tables that can be joined directly with the current table
    const neighbors = graph[currentTable] || [];

    for (const neighbor of neighbors) {
      // Skip already visited tables
      if (visited.has(neighbor)) continue;

      // Record the path to this neighbor
      paths[neighbor] = [...paths[currentTable], neighbor];

      // If we've reached the destination, return the path
      if (neighbor === endTable) {
        return paths[neighbor];
      }

      // Add neighbor to the queue and mark as visited
      queue.push(neighbor);
      visited.add(neighbor);
    }
  }

  // If we get here, no path exists
  return null;
}

// Node: Plan the query construction
const planQueryNode = async (state) => {
  state.onProgress?.('Creating a query plan');
  const { parsedIntent, analysisResult, dbContextMessages } = state;

  // Create a flat list of all verified columns that exist in the metadata
  const verifiedColumns = Object.keys(analysisResult.columnToTableMap || {});

  // Generate a clearer mapping showing which tables have which columns
  const tableColumnsMapping = {};
  for (const colName in analysisResult.columnToTableMap) {
    const tableInfo = analysisResult.columnToTableMap[colName];
    const tableName = tableInfo.table.toLowerCase();

    if (!tableColumnsMapping[tableName]) {
      tableColumnsMapping[tableName] = [];
    }
    tableColumnsMapping[tableName].push(colName);
  }

  // Build a table-level join mapping to help identify missing join conditions
  const tableJoins = {};
  for (const tableKey in analysisResult.tableInfo) {
    const tableData = analysisResult.tableInfo[tableKey];
    if (!tableJoins[tableData.table]) {
      tableJoins[tableData.table] = {
        schema: tableData.schema,
        joinedWith: new Set(),
        primaryKeys: tableData.primary_key_columns || [],
        referencedBy: tableData.referenced_by_tables || []
      };
    }
  }

  // Enhance join mapping by examining relationships in the data
  for (const relationship of (state.tableRelationships || [])) {
    if (tableJoins[relationship.sourceTable]) {
      tableJoins[relationship.sourceTable].joinedWith.add(relationship.targetTable);
    }
    if (tableJoins[relationship.targetTable]) {
      tableJoins[relationship.targetTable].joinedWith.add(relationship.sourceTable);
    }
  }

  // Build a complete join graph to find paths between required tables
  const requiredTables = analysisResult.requiredTables || [];
  const joinGraph = {};

  // Initialize graph with all tables and their direct connections
  for (const table in tableJoins) {
    joinGraph[table] = Array.from(tableJoins[table].joinedWith);
  }

  // Find shortest paths between all required tables
  const joinPaths = {};
  const joinPathDetails = [];

  if (requiredTables.length > 1) {
    // If we have multiple tables, compute all possible paths between them
    for (let i = 0; i < requiredTables.length; i++) {
      const tableA = requiredTables[i];

      // Initialize table's path map if needed
      if (!joinPaths[tableA]) {
        joinPaths[tableA] = {};
      }

      for (let j = i + 1; j < requiredTables.length; j++) {
        const tableB = requiredTables[j];

        // Find shortest path from tableA to tableB using BFS
        const path = findShortestPath(joinGraph, tableA, tableB);

        if (path && path.length > 0) {
          joinPaths[tableA][tableB] = path;

          // If path requires intermediate tables, add them to the details
          if (path.length > 2) {
            joinPathDetails.push({
              from: tableA,
              to: tableB,
              path: path,
              intermediateCount: path.length - 2,
              intermediates: path.slice(1, -1)
            });
          }
        } else {
          joinPathDetails.push({
            from: tableA,
            to: tableB,
            error: "No join path found between these tables"
          });
        }
      }
    }
  }

  // Determine which tables are needed for complete join paths
  const additionalTablesNeeded = new Set();
  joinPathDetails.forEach(pathInfo => {
    if (pathInfo.intermediates) {
      pathInfo.intermediates.forEach(table => additionalTablesNeeded.add(table));
    }
  });

  const messages = [
    {
      role: "system",
      content: `You are a SQL query planner for Oracle Database. Based on the user's intent and available database information, create a plan for constructing a standard ANSI SQL query that works in Oracle.
      
      CRITICAL INSTRUCTIONS:
      1. ONLY use columns that have been verified to exist in the database metadata.
      2. DO NOT fabricate or invent column names - if you can't find an exact column you need, explain this in your plan.
      3. Every column you reference MUST appear in the VERIFIED COLUMNS list.
      4. You MUST maintain the proper column-to-table associations - every column must be associated with its correct parent table.
      5. For EVERY column you include in the plan, you MUST also include its parent table.
      6. ALWAYS use fully qualified table names with schema (SCHEMA_NAME.TABLE_NAME) in your plan.
      7. You MUST include join conditions between ALL tables needed by the selected columns which might mean join across more than two or three tables.
      8. Never assume a column exists just because it would make sense - ONLY use columns from the verified list.
      9. Use standard ANSI SQL JOIN syntax (e.g., INNER JOIN, LEFT JOIN) rather than Oracle's older syntax.
      10. Explicitly specify join conditions between all tables that need to be related.
      
      You must include in your plan:
      1. Specific tables to use with schema names (SCHEMA_NAME.TABLE_NAME format) - ALWAYS include the schema name
      2. Exact columns to select from each table, always specifying which table each column comes from
      3. Join conditions between ALL tables in the query, specifying the exact columns to join on
      4. Any WHERE conditions from the user's intent, using only verified columns
      5. Sort order or grouping if required
      
      ORACLE CONSIDERATIONS:
      - Use standard ANSI SQL syntax that works in Oracle Database
      - For dates, use TO_DATE function with proper format masks when needed
      - For string concatenation, use the || operator
      - For NULL handling, use NVL or COALESCE functions
      
      Be precise and specific in your plan, using the exact database object names from the metadata.`
    },
    {
      role: "user",
      content: `
        User Query: ${state.userPrompt}
        
        Parsed Intent: ${JSON.stringify(parsedIntent)}
        
        Analysis Result: 
        - Found Tables: ${JSON.stringify(analysisResult.foundTables)}
        - Found Columns: ${JSON.stringify(analysisResult.foundColumns)}
        - Needed Joins: ${JSON.stringify(analysisResult.neededJoins)}
        - Required Tables (based on columns): ${JSON.stringify(analysisResult.requiredTables)}
        
        Column to Table Mapping: ${JSON.stringify(analysisResult.columnToTableMap)}
        
        VERIFIED COLUMNS (ONLY USE THESE): ${JSON.stringify(verifiedColumns)}
        
        Available Columns Per Table:
        ${JSON.stringify(tableColumnsMapping, null, 2)}
        
        Table Information: ${JSON.stringify(analysisResult.tableInfo)}
        Column Information: ${JSON.stringify(analysisResult.columnInfo)}

        Table Relationship Summary: ${JSON.stringify(tableJoins)}
        
        Join Path Analysis:
        ${JSON.stringify(joinPathDetails)}
        
        Additional Tables Needed for Complete Join Paths: ${JSON.stringify(Array.from(additionalTablesNeeded))}
        
        Create a detailed SQL query plan that will satisfy the user's request.
        For each column in the SELECT clause, explicitly specify which table it comes from.
        Include ALL tables needed for the required columns, with proper join paths.
        ALWAYS qualify tables with their schema names (SCHEMA_NAME.TABLE_NAME).
        Include explicit JOIN conditions between ALL tables in the query.
        ONLY use columns that appear in the VERIFIED COLUMNS list.
        
        If you cannot find specific columns needed for the request (like home_phone when only phone_number exists),
        explain this limitation in your plan rather than fabricating columns.
        
        IMPORTANT: If tables cannot be directly joined, you MUST include intermediate tables from the Join Path Analysis to create a complete join path.
      `
    }
  ];

  // Include conceptual mappings in planning
  if (state.conceptualMappings) {
    messages[1].content += `\nConceptual Mappings: ${JSON.stringify(state.conceptualMappings)}`;
  }

  let queryPlan = "";
  await chatCompletionMarkdown({
    messages,
    onToken: (content) => { queryPlan += content; },
    teamName: state?.teamName,
    assistantName: state?.assistantName,
  });

  // Enhanced validation for query plan
  const validatedPlan = await validateQueryPlan(queryPlan, analysisResult, tableJoins, additionalTablesNeeded);

  return { queryPlan: validatedPlan };
};

// Enhanced function to validate query plan and make sure all columns exist and tables have proper joins
async function validateQueryPlan(queryPlan, analysisResult, tableJoins, additionalTablesNeeded = new Set()) {
  try {
    // First extract all schema.table patterns to identify the tables used in the query
    const schemaTableRegex = /\b([A-Za-z0-9_]+)\.([A-Zaz0-9_]+)\b/g;
    const mentionedTables = new Map(); // Map of table name to schema name
    let match;

    while ((match = schemaTableRegex.exec(queryPlan)) !== null) {
      const schema = match[1];
      const table = match[2];
      mentionedTables.set(table.toLowerCase(), schema.toLowerCase());
    }

    // Now extract table.column patterns - these will have the table already identified above
    const tableColumnRegex = /\b([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\b/g;
    const mentionedColumns = [];

    while ((match = tableColumnRegex.exec(queryPlan)) !== null) {
      const first = match[1].toLowerCase();
      const second = match[2].toLowerCase();

      // If the first part is a table name we found earlier, this is a table.column reference
      if (mentionedTables.has(first)) {
        mentionedColumns.push({
          table: first, // This is definitely a table
          column: second // This is definitely a column
        });
      }
      // Otherwise, this might be a schema.table reference, which we've already processed
    }

    // Extract JOIN conditions
    const joinRegex = /\b(JOIN\s+[A-Za-z0-9_\.]+\s+(?:AS\s+)?[A-Za-z0-9_]+\s+ON\s+[A-Zaz0-9_\.]+\s*=\s*[A-Za-z0-9_\.]+)/gi;
    const mentionedJoins = [];
    while ((match = joinRegex.exec(queryPlan)) !== null) {
      mentionedJoins.push(match[1]);
    }

    // Check if each mentioned column is in the verified column list
    const validationMessages = [];
    const columnToTableMap = analysisResult.columnToTableMap || {};
    const fabricatedColumns = [];

    for (const { table, column } of mentionedColumns) {
      // Skip standard SQL keywords that might be mistaken for columns
      if (['select', 'from', 'where', 'join', 'and', 'or', 'on', 'group', 'order', 'by', 'having'].includes(column)) {
        continue;
      }

      // Check if this column exists in our verified mapping
      const mappingInfo = columnToTableMap[column];
      if (!mappingInfo) {
        validationMessages.push(`ERROR: Column '${column}' was not found in the verified metadata. This column does not exist and must be removed.`);
        fabricatedColumns.push(column);
      } else if (mappingInfo.table.toLowerCase() !== table) {
        validationMessages.push(`ERROR: Column '${column}' belongs to table '${mappingInfo.table}', not '${table}'. Please use correct table association.`);
      }
    }

    // Check if we have at least n-1 join conditions for n tables (to ensure all tables are connected)
    const requiredTableCount = mentionedTables.size;
    const requiredJoinCount = requiredTableCount > 1 ? requiredTableCount - 1 : 0;

    if (mentionedJoins.length < requiredJoinCount) {
      validationMessages.push(`WARNING: The query plan may have insufficient JOIN conditions. For ${requiredTableCount} tables, at least ${requiredJoinCount} JOIN conditions are expected.`);
    }

    // Check if all required intermediate tables are included
    for (const intermediateTable of additionalTablesNeeded) {
      if (!mentionedTables.has(intermediateTable.toLowerCase())) {
        validationMessages.push(`WARNING: The query plan is missing intermediate table '${intermediateTable}' which is needed to complete join paths between tables.`);
      }
    }

    // If validation errors exist, return the plan with validation messages
    if (validationMessages.length > 0) {
      if (fabricatedColumns.length > 0) {
        return `${queryPlan}\n\nVALIDATION ERRORS - FABRICATED COLUMNS DETECTED:\n${validationMessages.join('\n')}\n\nThe columns [${fabricatedColumns.join(', ')}] do not exist in the database schema and must be removed.`;
      } else {
        return `${queryPlan}\n\nVALIDATION WARNINGS:\n${validationMessages.join('\n')}`;
      }
    }

    return queryPlan;
  } catch (error) {
    console.error("Error validating query plan:", error);
    return queryPlan; // Return the original plan if validation fails
  }
}

// Node: Generate SQL using OpenAI model with query plan
const generateSqlNode = async (state) => {
  state.onProgress?.('Generating SQL');
  // Check if there are validation errors in the query plan
  const hasValidationErrors = state.queryPlan.includes("VALIDATION ERRORS") || state.queryPlan.includes("VALIDATION WARNINGS");
  const hasFabricatedColumns = state.queryPlan.includes("FABRICATED COLUMNS DETECTED");

  // If there are fabricated columns, we need to regenerate the query plan
  if (hasFabricatedColumns) {
    // Extract the list of fabricated columns
    const fabricatedColumnsMatch = state.queryPlan.match(/The columns \[(.*?)\] do not exist/);
    const fabricatedColumns = fabricatedColumnsMatch ?
      fabricatedColumnsMatch[1].split(', ').map(col => col.trim()) : [];

    // Get the original plan without validation errors
    const originalPlan = state.queryPlan.split("\n\nVALIDATION ERRORS")[0];

    // Return an error message instead of a SQL query
    return {
      sqlResponse: `
## Error: Invalid Query Plan

I cannot generate a SQL query based on the current plan because it references columns that don't exist in the database:

**Non-existent columns:** ${fabricatedColumns.join(', ')}

Please refine your request to use only columns that exist in the database schema. Here are some possible alternatives:

1. If you're looking for phone information, you might use 'phone_number' and 'phone_type_code' instead of specific phone types.
2. If you need personal information, check for columns like 'first_name', 'last_name', 'email', etc.

Would you like me to suggest a modified query that uses only existing columns?
`
    };
  }

  const messages = [
    {
      role: "system",
      content: `${dbaSystemContext}
      
      CRITICAL INSTRUCTION: Your task is to create an Oracle SQL query that STRICTLY follows the query plan provided.
      DO NOT deviate from the tables, columns, and relationships outlined in the query plan.
      The query plan is the authoritative source for what tables and columns to use.
      
      Follow these explicit guidelines:
      1. Use ONLY the tables and columns mentioned in the query plan${hasValidationErrors ? " (ignoring any validation warnings)" : ""}
      2. Make sure to properly qualify all column names with their table names
      3. Always qualify all table references with schema names (SCHEMA_NAME.TABLE_NAME format)
      4. Implement all joins exactly as specified in the query plan
      5. Return ONLY a valid Oracle SQL query based precisely on the query plan
      6. DO NOT include any columns that aren't explicitly in the query plan
      7. Use standard ANSI SQL syntax that works in Oracle Database
      8. Include all necessary JOIN conditions to connect all tables in the query
    `
    },
    {
      role: "user",
      content: `
        User Query: ${state.userPrompt}
        
        QUERY PLAN TO FOLLOW:
        ${hasValidationErrors ? state.queryPlan.split(/\n\nVALIDATION (ERRORS|WARNINGS)/)[0].trim() : state.queryPlan}
        
        Column to Table Mapping: ${JSON.stringify(state.analysisResult.columnToTableMap)}
        
        Conceptual Mappings: ${state.conceptualMappings ? JSON.stringify(state.conceptualMappings) : "None available"}
        
        Instructions:
        1. Follow the query plan EXACTLY - do not improvise or change the tables or columns
        2. Make sure to properly qualify all column names with their table names
        3. Always qualify all table references with schema names (SCHEMA_NAME.TABLE_NAME format)
        4. Implement all joins exactly as specified in the query plan
        5. Return ONLY a valid Oracle SQL query based precisely on the query plan
        6. DO NOT include any columns that aren't explicitly in the query plan
        7. Use standard ANSI SQL syntax that works in Oracle Database
        8. Include all necessary JOIN conditions to connect all tables in the query
      `
    }
  ];

  let sqlResponse = "";
  await chatCompletionMarkdown({
    messages,
    onToken: (content) => {
      sqlResponse += content;
    },
    teamName: state?.teamName,
    assistantName: state?.assistantName,
  });

  return { sqlResponse };
};

// Node: Self-evaluate the SQL query for quality and completeness
const evaluateQueryNode = async (state) => {
  state.onProgress?.('Evaluating and refining...');
  const messages = [
    {
      role: "system",
      content: "You are a SQL quality evaluator. Evaluate the SQL query against the user's intent. Rate it from 1-10 on correctness, completeness, and efficiency. Suggest improvements if needed."
    },
    {
      role: "user",
      content: `
        Original User Query: ${state.userPrompt}
        Generated SQL: ${state.sqlResponse}
        Available Tables: ${JSON.stringify(state.analysisResult.foundTables)}
      `
    }
  ];

  let evaluation = "";
  await chatCompletionMarkdown({
    messages,
    onToken: (content) => { evaluation += content; },
    teamName: state?.teamName,
    assistantName: state?.assistantName
  });

  // Extract rating from evaluation
  let qualityScore = 0;
  try {
    const match = evaluation.match(/(\d+)\/10/) || evaluation.match(/rating.*?(\d+)/i);
    if (match && match[1]) {
      qualityScore = parseInt(match[1], 10);
    }
  } catch (e) {
    qualityScore = 0;
  }

  const needsRefinement = qualityScore < 7;

  return {
    queryEvaluation: evaluation,
    qualityScore,
    needsRefinement
  };
};

// Node: Refine the query if evaluation indicates issues
const refineQueryNode = async (state) => {
  if (!state.needsRefinement) {
    return { refinedSqlResponse: state.sqlResponse };
  }

  const messages = [
    { role: "system", content: dbaSystemContext },
    ...state.dbContextMessages,
    {
      role: "user",
      content: `
        Original query: ${state.userPrompt}
        
        You generated this SQL query:
        ${state.sqlResponse}
        
        Evaluation of the query:
        ${state.queryEvaluation}
        
        Please refine the SQL query to address these issues.
      `
    }
  ];

  let refinedSqlResponse = "";
  await chatCompletionMarkdown({
    messages,
    onToken: (content) => { refinedSqlResponse += content; },
    teamName: state?.teamName,
    assistantName: state?.assistantName,
  });

  return { refinedSqlResponse };
};

// Final node: Format the response with the SQL and explanation - enhanced for markdown
const formatResponseNode = async (state) => {
  const finalSql = state.refinedSqlResponse || state.sqlResponse;

  const messages = [
    { role: "system", content: dbaSystemContext },
    {
      role: "system",
      content: "Always respond with proper markdown formatting. SQL queries must be in ```sql code blocks. Use ## and ### headers for organization, and use **bold** for emphasis of important points."
    },
    {
      role: "user",
      content: `
        Create a formatted response for this query: "${state.userPrompt}"
        
        Use this exact SQL query in your response:
        
        ${finalSql}
        
        Include:
        1. A brief explanation of the tables and relationships used
        2. The SQL query (in a proper markdown SQL code block) exactly as provided above
        3. A brief explanation of how the query works
        
        Format the response in clear markdown with proper syntax highlighting for SQL.
        Do NOT include the SQL query outside of the markdown code block.
      `
    }
  ];

  let formattedResponse = "";
  let suggestedPrompts = [];
  await chatCompletionMarkdown({
    messages,
    onToken: (content) => {
      formattedResponse += content;
      // Stream tokens to client if sendEvent is provided
      if (state.sendEvent) {
        state.sendEvent({ type: 'data', data: content });
      }
    },
    teamName: state?.teamName,
    assistantName: state?.assistantName,
  });

  // Generate suggested prompts based on the formatted response
  const promptMessages = [
    {
      role: "user",
      content: `Based on your ${formattedResponse} response, provide 3 suggested prompts, plain text only, separated by ~!~ and don't number them.`
    }
  ];

  suggestedPrompts = await chatCompletionPrompts({ messages: promptMessages, teamName: state?.teamName, assistantName: state?.assistantName });
  state.sendEvent?.({ type: 'data', data: JSON.stringify({ suggestedPrompts }) });

  return {
    formattedResponse,
    suggestedPrompts // Include suggested prompts in the return value
  };
};

// State annotation
const StateAnnotation = Annotation.Root({
  nuid: Annotation,
  userPrompt: Annotation,
  teamName: Annotation,
  assistantName: Annotation,
  parsedIntent: Annotation,
  promptEmbedding: Annotation,
  searchStrategies: Annotation,
  dbSearchResults: Annotation,
  discoveredTables: Annotation,
  sufficientDbInfo: Annotation,
  analysisResult: Annotation,
  missingInfo: Annotation,
  additionalDbResults: Annotation,
  dbContextMessages: Annotation,
  tableRelationships: Annotation,
  queryPlan: Annotation,
  sqlResponse: Annotation,
  queryEvaluation: Annotation,
  qualityScore: Annotation,
  needsRefinement: Annotation,
  refinedSqlResponse: Annotation,
  formattedResponse: Annotation,
  sendEvent: Annotation, // Add this for streaming support
  onProgress: Annotation // Progress callback for background job processing
});

// Build the graph with conditional edges
const graphBuilder = new StateGraph(StateAnnotation);

// Add all nodes
graphBuilder
  .addNode("systemPromptsNode", systemPromptNode)
  .addNode("parseUserIntentNode", parseUserIntentNode)
  .addNode("vectorizePromptNode", vectorizePromptNode)
  .addNode("createSearchStrategyNode", createSearchStrategyNode)
  .addNode("executeSearchStrategiesNode", executeSearchStrategiesNode)
  .addNode("analyzeDbResultsNode", analyzeDbResultsNode)
  .addNode("searchMissingInfoNode", searchMissingInfoNode)
  .addNode("combineDbInfoNode", combineDbInfoNode)
  .addNode("planQueryNode", planQueryNode)
  .addNode("generateSqlNode", generateSqlNode)
  .addNode("evaluateQueryNode", evaluateQueryNode)
  .addNode("refineQueryNode", refineQueryNode)
  .addNode("formatResponseNode", formatResponseNode);

// Define the edges with conditions
graphBuilder
  .addEdge(START, "systemPromptsNode")
  .addEdge("systemPromptsNode", "parseUserIntentNode")
  .addEdge("parseUserIntentNode", "vectorizePromptNode")
  .addEdge("vectorizePromptNode", "createSearchStrategyNode")
  .addEdge("createSearchStrategyNode", "executeSearchStrategiesNode")
  .addEdge("executeSearchStrategiesNode", "analyzeDbResultsNode")
  .addEdge("analyzeDbResultsNode", "searchMissingInfoNode")
  .addEdge("searchMissingInfoNode", "combineDbInfoNode")
  .addEdge("combineDbInfoNode", "planQueryNode")
  .addEdge("planQueryNode", "generateSqlNode")
  .addEdge("generateSqlNode", "evaluateQueryNode")
  .addEdge("evaluateQueryNode", "refineQueryNode")
  .addEdge("refineQueryNode", "formatResponseNode")
  .addEdge("formatResponseNode", END);

// Compile the graph
const graph = graphBuilder.compile();

// Entry point - ensure markdown formatting is preserved
export async function dbaAssistantGraph({ nuid, userPrompt }) {
  try {
    // If called directly, return the response as a string
    const result = await graph.invoke({
      nuid,
      userPrompt
    });

    // Return the formatted response, ensuring markdown is preserved
    const response = result.formattedResponse || result.refinedSqlResponse || result.sqlResponse;

    // Include suggested prompts in the response
    return {
      answer: response,
      suggestedPrompts: result.suggestedPrompts || []
    };
  } catch (error) {
    console.error("Error in dbaAssistantGraph:", error);
    return {
      answer: "I encountered an error while generating your SQL query. Please try again or rephrase your request.",
      suggestedPrompts: []
    };
  }
}

// Background version - emits progress messages instead of streaming tokens
export async function dbaAssistantGraphBackground({ nuid, userPrompt, teamName, assistantName, onProgress }) {
  const result = await graph.invoke({
    nuid,
    userPrompt,
    teamName,
    assistantName,
    onProgress
  });

  return {
    answer: result.formattedResponse || result.refinedSqlResponse || result.sqlResponse,
    suggestedPrompts: result.suggestedPrompts || []
  };
}

// New streaming version of the function
export async function dbaAssistantGraphStream({ nuid, userPrompt, teamName, assistantName }) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        // Invoke the graph with streaming capability
        await graph.invoke({
          nuid,
          userPrompt,
          teamName,
          assistantName,
          sendEvent: (event) => {
            if (event.type === 'data') {
              // Enqueue each data event (e.g., markdown response tokens)
              controller.enqueue(encoder.encode(event.data));
            }
          }
        });
      } catch (error) {
        console.error("Error in dbaAssistantGraphStream:", error);
        controller.enqueue(encoder.encode("I encountered an error while generating your SQL query. Please try again or rephrase your request."));
      } finally {
        // Close the stream
        controller.close();
      }
    }
  });

  return stream;
}
