'use server';

// Node: Create tailored search strategies based on user intent
export const createSearchStrategyNode = async (state) => {
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
