'use server';

export const analyzeDbResultsNode = async (state) => {
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
