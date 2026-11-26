'use server';

export const executeSearchStrategiesNode = async (state) => {
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
