'use server';

export const searchMissingInfoNode = async (state) => {
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
