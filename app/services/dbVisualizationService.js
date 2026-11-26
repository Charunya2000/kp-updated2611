'use server';

import {
  searchDatabaseMetadata,
  getAllDatabaseSchemas,
  getTablesForSchema,
  getColumnsForTable
} from './dbMetadataIndexService';

/**
 * Generate a Mermaid diagram string for visualizing database relationships
 * @param {string} schemaName - Optional schema name to filter tables
 * @param {Array} tablesToInclude - Optional array of table names to include
 * @returns {Promise<string>} Mermaid diagram markup
 */
export async function generateERDiagram({ schemaName = null, tablesToInclude = [] }) {
  try {
    // Get tables to visualize
    let tables = [];
    if (schemaName) {
      // Get all tables for the specified schema
      tables = await getTablesForSchema(schemaName);
    } else if (tablesToInclude.length > 0) {
      // Get specific tables by name
      const allTables = await searchDatabaseMetadata({
        entityType: 'table',
        limit: 500
      });

      tables = allTables.filter(table =>
        tablesToInclude.some(tableName =>
          table.table_name.toLowerCase() === tableName.toLowerCase()
        )
      );
    } else {
      // Get a limited set of tables for a manageable diagram
      tables = await searchDatabaseMetadata({
        entityType: 'table',
        limit: 20
      });
    }

    if (tables.length === 0) {
      return {
        success: false,
        error: "No tables found to visualize"
      };
    }

    // Start building Mermaid ER diagram
    let mermaidDiagram = 'erDiagram\n';
    const processedTables = new Set();
    const relationships = [];

    // Process each table
    for (const table of tables) {
      // Skip if already processed
      if (processedTables.has(table.table_name)) {
        continue;
      }

      // Get columns for this table
      const columns = await getColumnsForTable(table.schema_name, table.table_name);

      // Add table definition with columns
      mermaidDiagram += `  ${table.table_name} {\n`;

      // Add columns with data types
      for (const column of columns) {
        // Format data type
        let dataType = column.data_type || 'unknown';
        if (column.is_primary_key) {
          dataType += ' PK';
        }
        if (column.is_foreign_key) {
          dataType += ' FK';
        }

        mermaidDiagram += `    ${dataType} ${column.column_name}\n`;
      }

      mermaidDiagram += '  }\n';
      processedTables.add(table.table_name);

      // Record relationships for this table
      if (table.referenced_by_tables && table.referenced_by_tables.length > 0) {
        for (const referencingTable of table.referenced_by_tables) {
          // Extract just the table name from "SCHEMA.TABLE" format
          const referencingTableName = referencingTable.split('.').pop();

          if (referencingTableName &&
            // Only include relationships to tables we're showing
            (tablesToInclude.length === 0 ||
              tablesToInclude.includes(referencingTableName))) {
            relationships.push({
              from: referencingTableName,
              to: table.table_name,
              relationship: "||--o{", // Many-to-one relationship by default
              label: "references"
            });
          }
        }
      }
    }

    // Add relationships to the diagram
    for (const rel of relationships) {
      mermaidDiagram += `  ${rel.from} ${rel.relationship} ${rel.to} : "${rel.label}"\n`;
    }

    return {
      success: true,
      diagram: mermaidDiagram,
      tables: Array.from(processedTables),
      relationships: relationships.length
    };
  } catch (error) {
    console.error("Error generating ER diagram:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Find existing data model diagrams from documentation
 * @param {string} searchTerm - Term to search for in diagram names or descriptions
 * @returns {Promise<Array>} List of matching diagrams
 */
export async function findDataModelDiagrams(searchTerm) {
  try {
    // This would typically connect to a document repository or knowledge base
    // where diagrams are stored. For now, we'll return a simulated response.

    // In a real implementation, this might search SharePoint, Confluence, or other
    // document repositories where ERDs are stored

    const mockDiagrams = [
      {
        title: "Member Data Entity Relationship Diagram",
        description: "Shows relationships between Member, Coverage, and related entities",
        url: "/documents/member-data-erd.png",
        lastUpdated: "2023-10-15"
      },
      {
        title: "Claims Processing Data Model",
        description: "Visual representation of the claims processing system tables and relationships",
        url: "/documents/claims-processing-model.pdf",
        lastUpdated: "2023-09-22"
      },
      {
        title: "Provider Network Schema Diagram",
        description: "Database schema for provider network management",
        url: "/documents/provider-network-schema.svg",
        lastUpdated: "2023-11-05"
      }
    ];

    // Filter based on search term
    const results = searchTerm
      ? mockDiagrams.filter(diagram =>
        diagram.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        diagram.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
      : mockDiagrams;

    return {
      success: true,
      diagrams: results
    };
  } catch (error) {
    console.error("Error finding data model diagrams:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate a dot format graph for use with Graphviz visualization
 * @param {string} schemaName - Schema name to visualize
 * @returns {Promise<string>} Dot language graph definition
 */
export async function generateGraphvizDiagram(schemaName) {
  try {
    // Get tables for the schema
    const tables = await getTablesForSchema(schemaName);

    if (tables.length === 0) {
      return {
        success: false,
        error: `No tables found for schema ${schemaName}`
      };
    }

    // Build the Graphviz DOT format string
    let dotGraph = 'digraph DatabaseSchema {\n';
    dotGraph += '  rankdir=LR;\n';
    dotGraph += '  node [shape=record, fontname="Arial"];\n';
    dotGraph += '  edge [fontname="Arial", fontsize=10];\n\n';

    // Process each table
    for (const table of tables) {
      // Get columns for this table
      const columns = await getColumnsForTable(table.schema_name, table.table_name);

      // Create the node label with table name and columns
      let nodeLabel = `{${table.table_name}|`;

      // Add primary key columns first
      const pkColumns = columns.filter(col => col.is_primary_key);
      if (pkColumns.length > 0) {
        nodeLabel += pkColumns.map(col => `<${col.column_name}> ${col.column_name} (PK)`).join('\\l');
        nodeLabel += '\\l|';
      }

      // Add other columns
      const regularColumns = columns.filter(col => !col.is_primary_key);
      nodeLabel += regularColumns.map(col => {
        let colStr = `<${col.column_name}> ${col.column_name}`;
        if (col.is_foreign_key) colStr += ' (FK)';
        return colStr;
      }).join('\\l');
      nodeLabel += '\\l}';

      // Add the node
      dotGraph += `  "${table.table_name}" [label="${nodeLabel}"];\n`;
    }

    // Add relationships
    dotGraph += '\n  // Relationships\n';
    for (const table of tables) {
      if (table.referenced_by_tables && table.referenced_by_tables.length > 0) {
        for (let i = 0; i < table.referenced_by_tables.length; i++) {
          const referencingTable = table.referenced_by_tables[i].split('.').pop();

          if (tables.some(t => t.table_name === referencingTable)) {
            dotGraph += `  "${referencingTable}" -> "${table.table_name}" [label="references"];\n`;
          }
        }
      }
    }

    dotGraph += '}\n';

    return {
      success: true,
      dotGraph,
      tables: tables.length
    };
  } catch (error) {
    console.error("Error generating Graphviz diagram:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate a simplified JSON representation of the database schema
 * for use with visualization libraries like D3.js
 * @param {string} schemaName - Schema to visualize
 * @returns {Promise<Object>} JSON representation of the schema
 */
export async function generateSchemaJSON(schemaName) {
  try {
    // Get tables for the schema
    const tables = await getTablesForSchema(schemaName);

    if (tables.length === 0) {
      return {
        success: false,
        error: `No tables found for schema ${schemaName}`
      };
    }

    // Build a schema representation for visualization
    const nodes = [];
    const links = [];
    const tableMap = {};

    // Process each table to create nodes
    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];

      // Get columns for this table
      const columns = await getColumnsForTable(table.schema_name, table.table_name);

      // Create a node for the table
      const node = {
        id: i,
        name: table.table_name,
        schema: table.schema_name,
        type: 'table',
        columns: columns.map(col => ({
          name: col.column_name,
          dataType: col.data_type,
          isPrimaryKey: col.is_primary_key,
          isForeignKey: col.is_foreign_key,
          isNullable: col.is_nullable
        }))
      };

      nodes.push(node);
      tableMap[table.table_name] = i;
    }

    // Process relationships to create links
    for (const table of tables) {
      if (table.referenced_by_tables && table.referenced_by_tables.length > 0) {
        for (let i = 0; i < table.referenced_by_tables.length; i++) {
          const referencingTable = table.referenced_by_tables[i].split('.').pop();

          if (tableMap.hasOwnProperty(referencingTable)) {
            links.push({
              source: tableMap[referencingTable],
              target: tableMap[table.table_name],
              type: 'references'
            });
          }
        }
      }
    }

    return {
      success: true,
      schemaData: {
        nodes,
        links
      }
    };
  } catch (error) {
    console.error("Error generating schema JSON:", error);
    return {
      success: false,
      error: error.message
    };
  }
}
