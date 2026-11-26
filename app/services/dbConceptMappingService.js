'use server';

/**
 * This service bridges the gap between natural language concepts and actual database objects
 * by creating and maintaining concept-to-entity mappings derived from database schema.
 */

// In-memory cache of concept mappings
let conceptCache = {
  tableMappings: new Map(),  // concept -> [table objects]
  columnMappings: new Map(), // concept -> [column objects]
  schemaMappings: new Map(), // concept -> [schema objects]
  initialized: false,
  lastUpdated: null
};

// Common word replacements and synonyms
const commonConcepts = {
  tables: {
    "person": ["person", "individual", "member", "patient", "customer", "employee", "user"],
    "coverage": ["coverage", "policy", "insurance", "plan", "enrollment", "benefit"],
    "address": ["address", "location", "contact", "place", "residence"],
    "payment": ["payment", "transaction", "claim", "invoice", "billing", "fee"],
    "history": ["history", "log", "audit", "record", "trail", "tracking"]
  },
  columns: {
    "name": ["name", "full name", "person name", "first name", "last name", "full_name", "first_name", "last_name"],
    "id": ["id", "identifier", "key", "code", "number", "num", "no", "primary key"],
    "date of birth": ["date of birth", "birth date", "dob", "birthdate", "birthday", "birth_date", "date_of_birth"],
    "start date": ["start date", "begin date", "effective date", "from date", "commence date", "start_date", "begin_date", "effective_date"]
  },
  schemas: {
    "member owner": ["member owner", "member_owner", "memberowner", "member", "membership"]
  },
  // Common database naming patterns
  patterns: {
    tablePrefixes: ["TAP_", "DIM_", "FACT_", "TBL_", "VW_", "STG_"],
    tableSuffixes: ["_DATA", "_INFO", "_DTL", "_MASTER", "_HIST"],
    columnAbbreviations: {
      "NAME": ["NM", "NAME"],
      "DATE": ["DT", "DATE"],
      "IDENTIFIER": ["ID", "CODE", "KEY"],
      "NUMBER": ["NUM", "NO", "NBR"]
    }
  }
};

/**
 * Analyze a database table and generate concept mappings
 * @param {Object} tableDoc - The table document from Azure AI Search
 * @returns {Object} Generated concept mappings
 */
function analyzeTable(tableDoc) {
  if (!tableDoc || !tableDoc.content) return null;

  let content;
  try {
    content = typeof tableDoc.content === 'string' ? JSON.parse(tableDoc.content) : tableDoc.content;
  } catch (e) {
    console.error("Error parsing table content:", e);
    return null;
  }

  const tableName = tableDoc.table_name;
  const schemaName = tableDoc.schema_name;
  const columns = content.columns || [];
  const primaryKeys = content.primaryKeys || [];
  const foreignKeys = content.foreignKeys || [];

  // Generate table concepts
  const tableConcepts = generateTableConcepts(tableName);

  // Generate column concepts
  const columnMappings = columns.map(column => {
    const columnConcepts = generateColumnConcepts(column.column_name, column.type_name);
    return {
      column_name: column.column_name,
      concepts: columnConcepts,
      type: column.type_name,
      is_primary: primaryKeys.some(pk => pk.column_name === column.column_name),
      nullable: column.nullable === 1
    };
  });

  // Generate schema concepts
  const schemaConcepts = generateSchemaConcepts(schemaName);

  return {
    table_name: tableName,
    schema_name: schemaName,
    tableConcepts,
    schemaConcepts,
    columnMappings,
    foreignKeys,
    primaryKeys: primaryKeys.map(pk => pk.column_name)
  };
}

/**
 * Get potential user concepts for a specific database object name
 * @param {string} objectType - Type of object ('table', 'column', 'schema')
 * @param {string} objectName - The database object name
 * @returns {string[]} Array of potential user concepts
 */
export function getConceptsForDatabaseObject(objectType, objectName) {
  if (!objectName) return [];

  switch (objectType.toLowerCase()) {
    case 'table':
      return generateTableConcepts(objectName);
    case 'column':
      return generateColumnConcepts(objectName);
    case 'schema':
      return generateSchemaConcepts(objectName);
    default:
      return [];
  }
}

/**
 * Enhanced generate concept terms for a table name with domain-specific heuristics
 * @param {string} tableName - The table name
 * @returns {string[]} Array of concept terms
 */
function generateTableConcepts(tableName) {
  if (!tableName) return [];

  const concepts = new Set();
  const tableNameLower = tableName.toLowerCase();

  // Remove common prefixes
  let cleanName = tableNameLower;
  for (const prefix of commonConcepts.patterns.tablePrefixes) {
    if (cleanName.startsWith(prefix.toLowerCase())) {
      cleanName = cleanName.substring(prefix.length);
      break;
    }
  }

  // Remove common suffixes
  for (const suffix of commonConcepts.patterns.tableSuffixes) {
    if (cleanName.endsWith(suffix.toLowerCase())) {
      cleanName = cleanName.substring(0, cleanName.length - suffix.length);
      break;
    }
  }

  // Add the clean name
  concepts.add(cleanName);

  // Add the original name without prefixes/suffixes
  concepts.add(tableNameLower);

  // Check for known entity concepts
  for (const [concept, synonyms] of Object.entries(commonConcepts.tables)) {
    if (synonyms.some(syn => cleanName.includes(syn.toLowerCase()))) {
      concepts.add(concept);
      // Add all synonyms as well
      synonyms.forEach(syn => concepts.add(syn));
    }
  }

  // Handle specific table naming patterns
  if (cleanName.includes('person') || cleanName.includes('member')) {
    concepts.add('person');
    concepts.add('user');
    concepts.add('individual');
    concepts.add('member');
  }

  if (cleanName.includes('coverage') || cleanName.includes('policy')) {
    concepts.add('coverage');
    concepts.add('insurance');
    concepts.add('policy');
    concepts.add('plan');
  }

  // Add variations with spaces for underscore-separated names
  if (cleanName.includes('_')) {
    concepts.add(cleanName.replace(/_/g, ' '));
  }

  // Add plural/singular variations
  if (cleanName.endsWith('s')) {
    concepts.add(cleanName.slice(0, -1)); // Remove trailing 's'
  } else {
    concepts.add(cleanName + 's'); // Add trailing 's'
  }

  return Array.from(concepts);
}

/**
 * Generate concept terms for a column name
 * @param {string} columnName - The column name
 * @param {string} dataType - The column data type
 * @returns {string[]} Array of concept terms
 */
function generateColumnConcepts(columnName, dataType) {
  if (!columnName) return [];

  const concepts = new Set();
  const columnNameLower = columnName.toLowerCase();

  // Add the original column name
  concepts.add(columnNameLower);

  // Add variations with spaces instead of underscores
  if (columnNameLower.includes('_')) {
    concepts.add(columnNameLower.replace(/_/g, ' '));
  }

  // Check for known column concepts
  for (const [concept, synonyms] of Object.entries(commonConcepts.columns)) {
    if (synonyms.some(syn => columnNameLower.includes(syn.toLowerCase()) ||
      syn.toLowerCase().includes(columnNameLower))) {
      concepts.add(concept);
      // Add all synonyms as well
      synonyms.forEach(syn => concepts.add(syn));
    }
  }

  // Add data type specific concepts
  if (dataType) {
    const dataTypeLower = dataType.toLowerCase();
    if (dataTypeLower.includes('date') || dataTypeLower.includes('time')) {
      if (columnNameLower.includes('birth')) {
        concepts.add('date of birth');
        concepts.add('birth date');
      } else if (columnNameLower.includes('start') || columnNameLower.includes('begin')) {
        concepts.add('start date');
        concepts.add('begin date');
      }
    }
  }

  return Array.from(concepts);
}

/**
 * Generate concept terms for a schema name
 * @param {string} schemaName - The schema name
 * @returns {string[]} Array of concept terms
 */
function generateSchemaConcepts(schemaName) {
  if (!schemaName) return [];

  const concepts = new Set();
  const schemaNameLower = schemaName.toLowerCase();

  // Add the original schema name
  concepts.add(schemaNameLower);

  // Add variations with spaces instead of underscores
  if (schemaNameLower.includes('_')) {
    concepts.add(schemaNameLower.replace(/_/g, ' '));
  }

  // Check for known schema concepts
  for (const [concept, synonyms] of Object.entries(commonConcepts.schemas)) {
    if (synonyms.some(syn => schemaNameLower === syn.toLowerCase())) {
      concepts.add(concept);
      // Add all synonyms as well
      synonyms.forEach(syn => concepts.add(syn));
    }
  }

  return Array.from(concepts);
}

/**
 * Initialize concept mappings from search results
 * @param {Array} searchResults - Results from Azure AI Search
 */
function initializeConceptMappings(searchResults) {
  // Clear existing cache
  conceptCache.tableMappings = new Map();
  conceptCache.columnMappings = new Map();
  conceptCache.schemaMappings = new Map();

  // Process each table
  for (const result of searchResults) {
    const mappings = analyzeTable(result.document);
    if (!mappings) continue;

    // Add table mappings
    for (const concept of mappings.tableConcepts) {
      if (!conceptCache.tableMappings.has(concept)) {
        conceptCache.tableMappings.set(concept, []);
      }
      conceptCache.tableMappings.get(concept).push({
        table_name: mappings.table_name,
        schema_name: mappings.schema_name
      });
    }

    // Add column mappings
    for (const column of mappings.columnMappings) {
      for (const concept of column.concepts) {
        if (!conceptCache.columnMappings.has(concept)) {
          conceptCache.columnMappings.set(concept, []);
        }
        conceptCache.columnMappings.get(concept).push({
          column_name: column.column_name,
          table_name: mappings.table_name,
          schema_name: mappings.schema_name,
          type: column.type,
          is_primary: column.is_primary
        });
      }
    }

    // Add schema mappings
    for (const concept of mappings.schemaConcepts) {
      if (!conceptCache.schemaMappings.has(concept)) {
        conceptCache.schemaMappings.set(concept, []);
      }
      conceptCache.schemaMappings.get(concept).push({
        schema_name: mappings.schema_name
      });
    }
  }

  conceptCache.initialized = true;
  conceptCache.lastUpdated = new Date();
}

/**
 * Find tables matching a concept
 * @param {string} concept - The natural language concept
 * @returns {Array} Matching tables
 */
function findTablesByConceptText(concept) {
  if (!concept || !conceptCache.initialized) return [];

  const conceptLower = concept.toLowerCase();
  let results = [];

  // Direct lookup
  if (conceptCache.tableMappings.has(conceptLower)) {
    results = results.concat(conceptCache.tableMappings.get(conceptLower));
  }

  // Fuzzy lookup - check if any stored concept contains this concept
  for (const [storedConcept, tables] of conceptCache.tableMappings.entries()) {
    if (storedConcept.includes(conceptLower) || conceptLower.includes(storedConcept)) {
      results = results.concat(tables);
    }
  }

  // Remove duplicates
  const seen = new Set();
  return results.filter(table => {
    const key = `${table.schema_name}.${table.table_name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Find columns matching a concept
 * @param {string} concept - The natural language concept
 * @returns {Array} Matching columns
 */
function findColumnsByConceptText(concept) {
  if (!concept || !conceptCache.initialized) return [];

  const conceptLower = concept.toLowerCase();
  let results = [];

  // Direct lookup
  if (conceptCache.columnMappings.has(conceptLower)) {
    results = results.concat(conceptCache.columnMappings.get(conceptLower));
  }

  // Fuzzy lookup - check if any stored concept contains this concept
  for (const [storedConcept, columns] of conceptCache.columnMappings.entries()) {
    if (storedConcept.includes(conceptLower) || conceptLower.includes(storedConcept)) {
      results = results.concat(columns);
    }
  }

  // Remove duplicates
  const seen = new Set();
  return results.filter(column => {
    const key = `${column.schema_name}.${column.table_name}.${column.column_name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Find schemas matching a concept
 * @param {string} concept - The natural language concept
 * @returns {Array} Matching schemas
 */
function findSchemasByConceptText(concept) {
  if (!concept || !conceptCache.initialized) return [];

  const conceptLower = concept.toLowerCase();
  let results = [];

  // Direct lookup
  if (conceptCache.schemaMappings.has(conceptLower)) {
    results = results.concat(conceptCache.schemaMappings.get(conceptLower));
  }

  // Fuzzy lookup - check if any stored concept contains this concept
  for (const [storedConcept, schemas] of conceptCache.schemaMappings.entries()) {
    if (storedConcept.includes(conceptLower) || conceptLower.includes(storedConcept)) {
      results = results.concat(schemas);
    }
  }

  // Remove duplicates
  const seen = new Set();
  return results.filter(schema => {
    if (seen.has(schema.schema_name)) return false;
    seen.add(schema.schema_name);
    return true;
  });
}

/**
 * Add a new mapping from a concept to a database entity
 * @param {string} concept - The natural language concept
 * @param {string} entityType - Type of entity ('table', 'column', 'schema')
 * @param {Object} entity - The database entity
 */
function addConceptMapping(concept, entityType, entity) {
  if (!concept) return;

  const conceptLower = concept.toLowerCase();

  switch (entityType) {
    case 'table':
      if (!conceptCache.tableMappings.has(conceptLower)) {
        conceptCache.tableMappings.set(conceptLower, []);
      }
      conceptCache.tableMappings.get(conceptLower).push({
        table_name: entity.table_name,
        schema_name: entity.schema_name
      });
      break;

    case 'column':
      if (!conceptCache.columnMappings.has(conceptLower)) {
        conceptCache.columnMappings.set(conceptLower, []);
      }
      conceptCache.columnMappings.get(conceptLower).push({
        column_name: entity.column_name,
        table_name: entity.table_name,
        schema_name: entity.schema_name,
        type: entity.type,
        is_primary: entity.is_primary
      });
      break;

    case 'schema':
      if (!conceptCache.schemaMappings.has(conceptLower)) {
        conceptCache.schemaMappings.set(conceptLower, []);
      }
      conceptCache.schemaMappings.get(conceptLower).push({
        schema_name: entity.schema_name
      });
      break;
  }
}

/**
 * Load database schema from Azure AI Search and initialize concept mappings
 */
export async function loadDatabaseSchema() {
  const { searchIndex } = await import('./searchVectorDataService');

  try {
    // Get all database objects from the index
    const results = await searchIndex({
      searchIndex: 'smart-database-001',
      selectFields: ["database_name", "schema_name", "table_name", "content"],
      searchEmbedding: null,
      nearestNeighbors: 1000  // Set to a large number to get all records
    });

    // Initialize concept mappings from search results
    initializeConceptMappings(results);

    return {
      tableCount: conceptCache.tableMappings.size,
      columnCount: conceptCache.columnMappings.size,
      schemaCount: conceptCache.schemaMappings.size
    };
  } catch (error) {
    console.error('Error loading database schema:', error);
    throw error;
  }
}

/**
 * Maps natural language concepts to database objects
 * @param {Object} params - Parameters for mapping
 * @param {Array} params.tableConcepts - Array of table concepts
 * @param {Array} params.columnConcepts - Array of column concepts
 * @param {Array} params.schemaConcepts - Array of schema concepts
 * @returns {Object} Mapping results
 */
export async function mapConceptsToDbObjects({ tableConcepts = [], columnConcepts = [], schemaConcepts = [] }) {
  // Make sure cache is initialized
  if (!conceptCache.initialized) {
    await loadDatabaseSchema();
  }

  const results = {
    tables: [],
    columns: [],
    schemas: []
  };

  // Map table concepts
  for (const concept of tableConcepts) {
    const matchingTables = findTablesByConceptText(concept);
    results.tables = results.tables.concat(
      matchingTables.map(table => ({
        ...table,
        matchedConcept: concept
      }))
    );
  }

  // Map column concepts
  for (const concept of columnConcepts) {
    const matchingColumns = findColumnsByConceptText(concept);
    results.columns = results.columns.concat(
      matchingColumns.map(column => ({
        ...column,
        matchedConcept: concept
      }))
    );
  }

  // Map schema concepts
  for (const concept of schemaConcepts) {
    const matchingSchemas = findSchemasByConceptText(concept);
    results.schemas = results.schemas.concat(
      matchingSchemas.map(schema => ({
        ...schema,
        matchedConcept: concept
      }))
    );
  }

  // Remove duplicates
  const uniqueTables = new Map();
  const uniqueColumns = new Map();
  const uniqueSchemas = new Map();

  results.tables.forEach(table => {
    const key = `${table.schema_name}.${table.table_name}`;
    if (!uniqueTables.has(key) || uniqueTables.get(key).confidence < table.confidence) {
      uniqueTables.set(key, table);
    }
  });

  results.columns.forEach(column => {
    const key = `${column.schema_name}.${column.table_name}.${column.column_name}`;
    if (!uniqueColumns.has(key) || uniqueColumns.get(key).confidence < column.confidence) {
      uniqueColumns.set(key, column);
    }
  });

  results.schemas.forEach(schema => {
    if (!uniqueSchemas.has(schema.schema_name) ||
      uniqueSchemas.get(schema.schema_name).confidence < schema.confidence) {
      uniqueSchemas.set(schema.schema_name, schema);
    }
  });

  return {
    tables: Array.from(uniqueTables.values()),
    columns: Array.from(uniqueColumns.values()),
    schemas: Array.from(uniqueSchemas.values())
  };
}

/**
 * Get all available concept mappings (for debugging or visualization)
 */
export function getAllConceptMappings() {
  if (!conceptCache.initialized) {
    return { error: "Concept cache not initialized. Call loadDatabaseSchema first." };
  }

  return {
    tableConcepts: Array.from(conceptCache.tableMappings.keys()),
    columnConcepts: Array.from(conceptCache.columnMappings.keys()),
    schemaConcepts: Array.from(conceptCache.schemaMappings.keys()),
    lastUpdated: conceptCache.lastUpdated
  };
}

/**
 * Add a successful mapping from user interaction
 * @param {string} userConcept - The concept used by the user
 * @param {Object} mappedEntity - The entity it was mapped to
 */
export function learnFromSuccess(userConcept, mappedEntity) {
  if (!userConcept || !mappedEntity) return;

  if (mappedEntity.table_name && !mappedEntity.column_name) {
    // This is a table mapping
    addConceptMapping(userConcept, 'table', mappedEntity);
  } else if (mappedEntity.column_name) {
    // This is a column mapping
    addConceptMapping(userConcept, 'column', mappedEntity);
  } else if (mappedEntity.schema_name && !mappedEntity.table_name) {
    // This is a schema mapping
    addConceptMapping(userConcept, 'schema', mappedEntity);
  }
}

/**
 * Generate database objects mapping for all tables in the index
 * This creates a complete mapping between all database objects and potential user concepts
 */
export async function generateCompleteConceptMappings() {
  // Make sure cache is initialized
  if (!conceptCache.initialized) {
    await loadDatabaseSchema();
  }

  const mappings = {
    tables: {},    // table_name -> [concepts]
    columns: {},   // table_name.column_name -> [concepts]
    schemas: {}    // schema_name -> [concepts]
  };

  // Generate table mappings
  for (const [concept, tables] of conceptCache.tableMappings.entries()) {
    for (const table of tables) {
      const key = `${table.schema_name}.${table.table_name}`;
      if (!mappings.tables[key]) {
        mappings.tables[key] = [];
      }
      if (!mappings.tables[key].includes(concept)) {
        mappings.tables[key].push(concept);
      }
    }
  }

  // Generate column mappings
  for (const [concept, columns] of conceptCache.columnMappings.entries()) {
    for (const column of columns) {
      const key = `${column.schema_name}.${column.table_name}.${column.column_name}`;
      if (!mappings.columns[key]) {
        mappings.columns[key] = [];
      }
      if (!mappings.columns[key].includes(concept)) {
        mappings.columns[key].push(concept);
      }
    }
  }

  // Generate schema mappings
  for (const [concept, schemas] of conceptCache.schemaMappings.entries()) {
    for (const schema of schemas) {
      if (!mappings.schemas[schema.schema_name]) {
        mappings.schemas[schema.schema_name] = [];
      }
      if (!mappings.schemas[schema.schema_name].includes(concept)) {
        mappings.schemas[schema.schema_name].push(concept);
      }
    }
  }

  return mappings;
}

/**
 * Get possible concepts for a specific database table
 * @param {string} tableName - Name of the table
 * @param {string} schemaName - Optional schema name
 * @returns {string[]} Array of concepts that could refer to this table
 */
export function getConceptsForTable(tableName, schemaName = null) {
  if (!conceptCache.initialized) {
    return ["Error: Concept cache not initialized. Call loadDatabaseSchema first."];
  }

  const concepts = new Set();

  // First, add all directly mapped concepts
  for (const [concept, tables] of conceptCache.tableMappings.entries()) {
    for (const table of tables) {
      if (table.table_name.toLowerCase() === tableName.toLowerCase()) {
        if (!schemaName || table.schema_name.toLowerCase() === schemaName.toLowerCase()) {
          concepts.add(concept);
        }
      }
    }
  }

  // If no direct mappings found, generate concepts based on the table name
  if (concepts.size === 0) {
    const generatedConcepts = generateTableConcepts(tableName);
    generatedConcepts.forEach(c => concepts.add(c));
  }

  return Array.from(concepts);
}

/**
 * Get possible concepts for a specific database column
 * @param {string} columnName - Name of the column
 * @param {string} tableName - Optional table name for context
 * @param {string} schemaName - Optional schema name for context
 * @returns {string[]} Array of concepts that could refer to this column
 */
export function getConceptsForColumn(columnName, tableName = null, schemaName = null) {
  if (!conceptCache.initialized) {
    return ["Error: Concept cache not initialized. Call loadDatabaseSchema first."];
  }

  const concepts = new Set();

  // First, add all directly mapped concepts
  for (const [concept, columns] of conceptCache.columnMappings.entries()) {
    for (const column of columns) {
      if (column.column_name.toLowerCase() === columnName.toLowerCase()) {
        if (
          (!tableName || column.table_name.toLowerCase() === tableName.toLowerCase()) &&
          (!schemaName || column.schema_name.toLowerCase() === schemaName.toLowerCase())
        ) {
          concepts.add(concept);
        }
      }
    }
  }

  // If no direct mappings found, generate concepts based on the column name
  if (concepts.size === 0) {
    const generatedConcepts = generateColumnConcepts(columnName);
    generatedConcepts.forEach(c => concepts.add(c));
  }

  return Array.from(concepts);
}

/**
 * Advanced analysis of table and column patterns across the database
 * This enhances the concept mapping by identifying naming patterns
 */
async function analyzeGlobalDatabasePatterns() {
  if (!conceptCache.initialized) {
    await loadDatabaseSchema();
  }

  // Collect all table and column names for pattern analysis
  const allTableNames = new Set();
  const allColumnNames = new Set();
  const columnsByTable = new Map();
  const tableNamePatterns = new Map();
  const columnNamePatterns = new Map();

  // Gather all table and column names
  for (const [_, tables] of conceptCache.tableMappings.entries()) {
    for (const table of tables) {
      const tableName = table.table_name.toLowerCase();
      allTableNames.add(tableName);

      if (!columnsByTable.has(tableName)) {
        columnsByTable.set(tableName, new Set());
      }
    }
  }

  for (const [_, columns] of conceptCache.columnMappings.entries()) {
    for (const column of columns) {
      const tableName = column.table_name.toLowerCase();
      const columnName = column.column_name.toLowerCase();

      allColumnNames.add(columnName);

      if (columnsByTable.has(tableName)) {
        columnsByTable.get(tableName).add(columnName);
      }
    }
  }

  // Analyze common prefixes/suffixes in table names
  const prefixCount = new Map();
  const suffixCount = new Map();

  for (const tableName of allTableNames) {
    // Check for prefixes (like TAP_, DIM_, etc.)
    for (let i = 2; i <= 5; i++) {
      if (tableName.length > i) {
        const prefix = tableName.substring(0, i).toUpperCase();
        prefixCount.set(prefix, (prefixCount.get(prefix) || 0) + 1);
      }
    }

    // Check for suffixes (like _HISTORY, _DATA, etc.)
    for (let i = 2; i <= 7; i++) {
      if (tableName.length > i) {
        const suffix = tableName.substring(tableName.length - i).toUpperCase();
        suffixCount.set(suffix, (suffixCount.get(suffix) || 0) + 1);
      }
    }
  }

  // Keep only significant patterns (appearing in multiple tables)
  const significantPrefixes = Array.from(prefixCount.entries())
    .filter(([_, count]) => count >= 3)
    .map(([prefix, _]) => prefix);

  const significantSuffixes = Array.from(suffixCount.entries())
    .filter(([_, count]) => count >= 3)
    .map(([suffix, _]) => suffix);

  // Update common patterns with database-specific patterns
  if (significantPrefixes.length > 0) {
    commonConcepts.patterns.tablePrefixes = [
      ...new Set([...commonConcepts.patterns.tablePrefixes, ...significantPrefixes])
    ];
  }

  if (significantSuffixes.length > 0) {
    commonConcepts.patterns.tableSuffixes = [
      ...new Set([...commonConcepts.patterns.tableSuffixes, ...significantSuffixes])
    ];
  }

  // Analyze common column names and their semantic meanings
  const commonColumns = Array.from(allColumnNames)
    .filter(colName => {
      let count = 0;
      for (const columns of columnsByTable.values()) {
        if (columns.has(colName)) {
          count++;
        }
      }
      return count >= 3; // Column appears in at least 3 tables
    });

  // Update column patterns based on analysis
  for (const colName of commonColumns) {
    if (colName.includes('date') || colName.includes('dt')) {
      if (!commonConcepts.columns["date"]) {
        commonConcepts.columns["date"] = [];
      }
      commonConcepts.columns["date"].push(colName);
    }

    if (colName.includes('name') || colName.includes('nm')) {
      if (!commonConcepts.columns["name"]) {
        commonConcepts.columns["name"] = [];
      }
      commonConcepts.columns["name"].push(colName);
    }

    if (colName.includes('id') || colName.endsWith('_id')) {
      if (!commonConcepts.columns["identifier"]) {
        commonConcepts.columns["identifier"] = [];
      }
      commonConcepts.columns["identifier"].push(colName);
    }
  }

  return {
    significantPrefixes,
    significantSuffixes,
    commonColumns
  };
}

/**
 * Bulk operation to get concepts for multiple database tables at once
 * @param {string[]} tableNames - Array of table names
 * @returns {Object} Mapping of table names to concept arrays
 */
export async function getConceptsForTables(tableNames) {
  // Ensure concept cache is initialized
  if (!conceptCache.initialized) {
    await loadDatabaseSchema();
  }

  const results = {};

  for (const tableName of tableNames) {
    results[tableName] = getConceptsForTable(tableName);
  }

  return results;
}

/**
 * Analyze the database to identify patterns and populate a complete mapping
 * between all database objects and their potential user concepts
 */
export async function analyzeDatabaseSchema() {
  // First, load the basic schema
  await loadDatabaseSchema();

  // Then analyze patterns across the database
  const patterns = await analyzeGlobalDatabasePatterns();

  // Generate mappings for all database objects
  const allMappings = await generateCompleteConceptMappings();

  return {
    stats: {
      tables: Object.keys(allMappings.tables).length,
      columns: Object.keys(allMappings.columns).length,
      schemas: Object.keys(allMappings.schemas).length,
      patterns
    },
    mappings: allMappings
  };
}

/**
 * Enhanced initialization function that performs deeper analysis
 * of the database schema and builds more comprehensive mappings
 */
export async function initializeDatabaseConceptMappings() {
  try {
    // First, load the basic schema
    const basicStats = await loadDatabaseSchema();

    // Then analyze global patterns
    await analyzeGlobalDatabasePatterns();

    // Update all mappings to reflect the new patterns
    // Re-process each table with the enhanced pattern recognition
    const { searchIndex } = await import('./searchVectorDataService');

    // Get all database objects from the index
    const results = await searchIndex({
      searchIndex: 'smart-database-001',
      selectFields: ["database_name", "schema_name", "table_name", "content"],
      searchEmbedding: null,
      nearestNeighbors: 1000  // Set to a large number to get all records
    });

    // Re-initialize with enhanced patterns
    initializeConceptMappings(results);

    // Generate comprehensive mappings
    const completeMappings = await generateCompleteConceptMappings();

    return {
      tableCount: conceptCache.tableMappings.size,
      columnCount: conceptCache.columnMappings.size,
      schemaCount: conceptCache.schemaMappings.size,
      mappingStats: {
        tables: Object.keys(completeMappings.tables).length,
        columns: Object.keys(completeMappings.columns).length,
        schemas: Object.keys(completeMappings.schemas).length
      }
    };
  } catch (error) {
    console.error('Error initializing database concept mappings:', error);
    throw error;
  }
}
