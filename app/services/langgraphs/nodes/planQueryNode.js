'use server';

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


// Node: Plan the query construction
export const planQueryNode = async (state) => {
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
    assistantName: state?.assistantName
  });

  // Enhanced validation for query plan
  const validatedPlan = await validateQueryPlan(queryPlan, analysisResult, tableJoins, additionalTablesNeeded);

  return { queryPlan: validatedPlan };
};
