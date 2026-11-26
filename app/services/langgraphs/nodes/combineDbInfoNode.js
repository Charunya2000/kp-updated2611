'use server';

export const combineDbInfoNode = async (state) => {
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
