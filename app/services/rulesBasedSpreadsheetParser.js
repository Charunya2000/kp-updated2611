/**
 * Rules-Based Spreadsheet Parser
 * 
 * A flexible engine for parsing Excel spreadsheets based on configurable rules.
 * This approach allows for adaptive parsing of different spreadsheet structures
 * without requiring explicit directions for each file.
 * 
 * @module rulesBasedSpreadsheetParser
 */

// Import required libraries
const XLSX = require('xlsx');

/**
 * Rule class representing a single parsing rule
 */
class Rule {
  /**
   * Create a new rule
   * 
   * @param {Object} config - Rule configuration
   * @param {string} config.id - Unique identifier for the rule
   * @param {Function} config.condition - Function that determines if the rule applies
   * @param {Function} config.action - Function to execute when the rule matches
   * @param {number} config.priority - Rule priority (higher numbers = higher priority)
   * @param {number} config.confidence - Initial confidence level (0.0 to 1.0)
   * @param {Object} config.metadata - Additional information about the rule
   */
  constructor({ id, condition, action, priority = 10, confidence = 0.8, metadata = {} }) {
    this.id = id;
    this.condition = condition;
    this.action = action;
    this.priority = priority;
    this.confidence = confidence;
    this.metadata = metadata;

    // Statistics for rule refinement
    this.stats = {
      applied: 0,
      succeeded: 0,
      failed: 0
    };
  }

  /**
   * Check if this rule applies to the given context
   * 
   * @param {Object} context - Current parsing context
   * @param {...any} args - Additional arguments needed for evaluation
   * @returns {boolean} True if the rule applies
   */
  applies(context, ...args) {
    try {
      return this.condition(context, ...args);
    } catch (error) {
      console.error(`Error evaluating rule condition for ${this.id}:`, error);
      return false;
    }
  }

  /**
   * Apply this rule to the given context
   * 
   * @param {Object} context - Current parsing context
   * @param {...any} args - Additional arguments needed for rule application
   * @returns {Object} Result of applying the rule
   */
  apply(context, ...args) {
    try {
      this.stats.applied++;
      const result = this.action(context, ...args);
      if (result) {
        this.stats.succeeded++;
        return { success: true, result, ruleId: this.id, confidence: this.confidence };
      } else {
        this.stats.failed++;
        return { success: false, ruleId: this.id };
      }
    } catch (error) {
      this.stats.failed++;
      console.error(`Error applying rule ${this.id}:`, error);
      return { success: false, ruleId: this.id, error: error.message };
    }
  }

  /**
   * Update the rule's confidence based on success/failure
   * 
   * @param {boolean} success - Whether the rule application was successful
   * @param {number} factor - Adjustment factor
   */
  updateConfidence(success, factor = 0.05) {
    if (success) {
      this.confidence = Math.min(1.0, this.confidence + factor);
    } else {
      this.confidence = Math.max(0.1, this.confidence - factor);
    }
  }
}

/**
 * Context class for maintaining state during parsing
 */
class ParsingContext {
  /**
   * Create a new parsing context
   * 
   * @param {Object} worksheet - XLSX worksheet object
   * @param {Object} options - Additional options
   */
  constructor(worksheet, options = {}) {
    this.worksheet = worksheet;
    this.options = options;
    this.range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    this.results = [];
    this.currentRow = this.range.s.r;
    this.currentCol = this.range.s.c;
    this.visitedCells = new Set();
    this.sectionMarkers = [];
    this.detectedStructures = [];
    this.metadata = {};

    // Special structures
    this.tables = [];
    this.keyValuePairs = [];
    this.lists = [];
    this.titles = [];

    // Create merged cells map
    this.mergedCellsMap = this._createMergedCellsMap();
  }

  /**
   * Create a map of merged cells for quick lookup
   * 
   * @returns {Map} Map of cell references to their main cell
   * @private
   */
  _createMergedCellsMap() {
    const mergedCellsMap = new Map();
    const merges = this.worksheet['!merges'] || [];

    for (const merge of merges) {
      const { s: start, e: end } = merge;
      const mainCellRef = XLSX.utils.encode_cell(start);

      for (let r = start.r; r <= end.r; r++) {
        for (let c = start.c; c <= end.c; c++) {
          const cellRef = XLSX.utils.encode_cell({ r, c });
          if (cellRef !== mainCellRef) {
            mergedCellsMap.set(cellRef, mainCellRef);
          }
        }
      }
    }

    return mergedCellsMap;
  }

  /**
   * Mark a cell as visited
   * 
   * @param {number} row - Row index
   * @param {number} col - Column index
   */
  markVisited(row, col) {
    const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
    this.visitedCells.add(cellRef);
  }

  /**
   * Check if a cell has been visited
   * 
   * @param {number} row - Row index
   * @param {number} col - Column index
   * @returns {boolean} True if visited
   */
  isVisited(row, col) {
    const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
    return this.visitedCells.has(cellRef);
  }

  /**
   * Add a detected structure to the context
   * 
   * @param {string} type - Type of structure
   * @param {Object} data - Structure data
   * @param {number} startRow - Starting row index
   * @param {number} endRow - Ending row index
   * @param {number} startCol - Starting column index
   * @param {number} endCol - Ending column index
   */
  addStructure(type, data, startRow, endRow, startCol, endCol) {
    const structure = {
      type,
      data,
      range: {
        s: { r: startRow, c: startCol },
        e: { r: endRow, c: endCol }
      }
    };

    this.detectedStructures.push(structure);

    // Add to specific structure type collection
    switch (type) {
      case 'table':
        this.tables.push(structure);
        break;
      case 'keyValue':
        this.keyValuePairs.push(structure);
        break;
      case 'list':
        this.lists.push(structure);
        break;
      case 'title':
        this.titles.push(structure);
        break;
    }

    // Mark all cells in the structure as visited
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        this.markVisited(r, c);
      }
    }

    return structure;
  }

  /**
   * Add a result to the context
   * 
   * @param {Object} result - Result to add
   */
  addResult(result) {
    this.results.push(result);
  }
}

/**
 * Rules Engine for managing and applying parsing rules
 */
class RulesEngine {
  /**
   * Create a new rules engine
   */
  constructor() {
    this.rules = {
      structure: [],
      content: [],
      context: []
    };
    this.feedback = [];
  }

  /**
   * Register a new rule
   * 
   * @param {string} category - Rule category
   * @param {Rule} rule - Rule to register
   */
  registerRule(category, rule) {
    if (!this.rules[category]) {
      this.rules[category] = [];
    }
    this.rules[category].push(rule);

    // Sort rules by priority
    this.rules[category].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Evaluate all rules in a category against the context
   * 
   * @param {string} category - Rule category to evaluate
   * @param {ParsingContext} context - Current parsing context
   * @param {...any} args - Additional arguments for rule evaluation
   * @returns {Object|null} Result of the first matching rule, or null
   */
  evaluateRules(category, context, ...args) {
    for (const rule of this.rules[category]) {
      if (rule.applies(context, ...args)) {
        return rule.apply(context, ...args);
      }
    }
    return null;
  }

  /**
   * Record feedback for rule refinement
   * 
   * @param {string} ruleId - ID of the rule
   * @param {boolean} success - Whether the rule was successful
   * @param {Object} details - Additional details
   */
  recordFeedback(ruleId, success, details = {}) {
    this.feedback.push({
      ruleId,
      success,
      timestamp: new Date(),
      details
    });

    // Find the rule and update its confidence
    for (const category in this.rules) {
      const rule = this.rules[category].find(r => r.id === ruleId);
      if (rule) {
        rule.updateConfidence(success);
        break;
      }
    }
  }

  /**
   * Get statistics for all rules
   * 
   * @returns {Object} Rule statistics
   */
  getRuleStats() {
    const stats = {};
    for (const category in this.rules) {
      stats[category] = this.rules[category].map(rule => ({
        id: rule.id,
        priority: rule.priority,
        confidence: rule.confidence,
        applied: rule.stats.applied,
        succeeded: rule.stats.succeeded,
        failed: rule.stats.failed,
        successRate: rule.stats.applied ? rule.stats.succeeded / rule.stats.applied : 0
      }));
    }
    return stats;
  }
}

/**
 * Utility functions for rule conditions and actions
 */
const Utils = {
  /**
   * Get the value of a cell
   * 
   * @param {Object} worksheet - XLSX worksheet
   * @param {number|string} row - Row index or cell reference
   * @param {number} [col] - Column index (if row is numeric)
   * @param {Map} [mergedCellsMap] - Map of merged cells
   * @returns {*} Cell value
   */
  getCellValue(worksheet, row, col, mergedCellsMap) {
    let cellRef;

    if (typeof row === 'string') {
      cellRef = row;
    } else {
      cellRef = XLSX.utils.encode_cell({ r: row, c: col });
    }

    // Check if this is a merged cell and get the main cell reference
    if (mergedCellsMap && mergedCellsMap.has(cellRef)) {
      cellRef = mergedCellsMap.get(cellRef);
    }

    const cell = worksheet[cellRef];
    return cell ? cell.v : null;
  },

  /**
   * Check if a cell has content
   * 
   * @param {Object} worksheet - XLSX worksheet
   * @param {number} row - Row index
   * @param {number} col - Column index
   * @param {Map} [mergedCellsMap] - Map of merged cells
   * @returns {boolean} True if the cell has content
   */
  hasCellContent(worksheet, row, col, mergedCellsMap) {
    const value = this.getCellValue(worksheet, row, col, mergedCellsMap);
    return value !== null && value !== undefined && String(value).trim() !== '';
  },

  /**
   * Check if a cell is the first column
   * 
   * @param {number} col - Column index
   * @returns {boolean} True if it's the first column
   */
  isFirstColumn(col) {
    return col === 0;
  },

  /**
   * Check if a row is empty
   * 
   * @param {Object} worksheet - XLSX worksheet
   * @param {number} row - Row index
   * @param {number} minCol - Minimum column index
   * @param {number} maxCol - Maximum column index
   * @param {Map} [mergedCellsMap] - Map of merged cells
   * @returns {boolean} True if the row is empty
   */
  isEmptyRow(worksheet, row, minCol, maxCol, mergedCellsMap) {
    for (let col = minCol; col <= maxCol; col++) {
      if (this.hasCellContent(worksheet, row, col, mergedCellsMap)) {
        return false;
      }
    }
    return true;
  },

  /**
   * Count consecutive empty rows
   * 
   * @param {Object} worksheet - XLSX worksheet
   * @param {number} startRow - Starting row index
   * @param {number} minCol - Minimum column index
   * @param {number} maxCol - Maximum column index
   * @param {Map} [mergedCellsMap] - Map of merged cells
   * @returns {number} Number of consecutive empty rows
   */
  countConsecutiveEmptyRows(worksheet, startRow, minCol, maxCol, mergedCellsMap) {
    let count = 0;
    let row = startRow;
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');

    while (row <= range.e.r && this.isEmptyRow(worksheet, row, minCol, maxCol, mergedCellsMap)) {
      count++;
      row++;
    }

    return count;
  },

  /**
   * Check if a range forms a table
   * 
   * @param {Object} worksheet - XLSX worksheet
   * @param {number} startRow - Starting row index
   * @param {number} endRow - Ending row index
   * @param {number} startCol - Starting column index
   * @param {number} endCol - Ending column index
   * @param {Map} [mergedCellsMap] - Map of merged cells
   * @returns {boolean} True if the range forms a table
   */
  isTable(worksheet, startRow, endRow, startCol, endCol, mergedCellsMap) {
    // Check if there's at least one header row and one data row
    if (endRow - startRow < 1) {
      return false;
    }

    // Check if the first row has content in most cells (potential header)
    let headerCellCount = 0;
    for (let col = startCol; col <= endCol; col++) {
      if (this.hasCellContent(worksheet, startRow, col, mergedCellsMap)) {
        headerCellCount++;
      }
    }

    const headerCoverage = headerCellCount / (endCol - startCol + 1);
    if (headerCoverage < 0.5) {
      return false;
    }

    // Check if subsequent rows have similar structure
    let consistentRowCount = 0;
    for (let row = startRow + 1; row <= endRow; row++) {
      let cellCount = 0;
      for (let col = startCol; col <= endCol; col++) {
        if (this.hasCellContent(worksheet, row, col, mergedCellsMap)) {
          cellCount++;
        }
      }

      // Row should have similar structure to header (allow some flexibility)
      if (cellCount > 0 && Math.abs(cellCount - headerCellCount) <= 2) {
        consistentRowCount++;
      }
    }

    // At least 50% of rows should be consistent with the header
    return consistentRowCount >= (endRow - startRow) * 0.5;
  },

  /**
   * Check if a range forms a key-value structure
   * 
   * @param {Object} worksheet - XLSX worksheet
   * @param {number} row - Row index
   * @param {Map} [mergedCellsMap] - Map of merged cells
   * @returns {boolean} True if the row forms a key-value pair
   */
  isKeyValuePair(worksheet, row, mergedCellsMap) {
    // Basic check: Key in column A, value in column B
    return this.hasCellContent(worksheet, row, 0, mergedCellsMap) &&
      this.hasCellContent(worksheet, row, 1, mergedCellsMap) &&
      !this.hasCellContent(worksheet, row, 2, mergedCellsMap);
  },

  /**
   * Check if a cell could be a title
   * 
   * @param {Object} worksheet - XLSX worksheet
   * @param {number} row - Row index
   * @param {Map} [mergedCellsMap] - Map of merged cells
   * @returns {boolean} True if the cell could be a title
   */
  isTitle(worksheet, row, mergedCellsMap) {
    // A title is typically in column A with no content in other columns
    return this.hasCellContent(worksheet, row, 0, mergedCellsMap) &&
      !this.hasCellContent(worksheet, row, 1, mergedCellsMap) &&
      this.isEmptyRow(worksheet, row, 1, 10, mergedCellsMap);
  },

  /**
   * Extract data from a table structure
   * 
   * @param {Object} worksheet - XLSX worksheet
   * @param {number} startRow - Starting row index
   * @param {number} endRow - Ending row index
   * @param {number} startCol - Starting column index
   * @param {number} endCol - Ending column index
   * @param {Map} [mergedCellsMap] - Map of merged cells
   * @returns {Object} Extracted table data
   */
  extractTableData(worksheet, startRow, endRow, startCol, endCol, mergedCellsMap) {
    // Extract headers
    const headers = [];
    for (let col = startCol; col <= endCol; col++) {
      const headerValue = this.getCellValue(worksheet, startRow, col, mergedCellsMap) || `Column${col - startCol + 1}`;
      headers.push(headerValue);
    }

    // Extract rows
    const rows = [];
    for (let row = startRow + 1; row <= endRow; row++) {
      const rowData = {};
      let hasData = false;

      for (let col = startCol; col <= endCol; col++) {
        const value = this.getCellValue(worksheet, row, col, mergedCellsMap);
        if (value !== null) {
          rowData[headers[col - startCol]] = value;
          hasData = true;
        }
      }

      if (hasData) {
        rows.push(rowData);
      }
    }

    return { headers, rows };
  }
};

/**
 * Predefined rules for common spreadsheet structures
 */
const PredefinedRules = {
  /**
   * Rules for detecting key-value pairs
   */
  keyValueRules: [
    new Rule({
      id: 'basic-key-value-pair',
      condition: (context, row, col) => {
        return Utils.isKeyValuePair(context.worksheet, row, context.mergedCellsMap) &&
          Utils.isFirstColumn(col);
      },
      action: (context, row, col) => {
        const key = Utils.getCellValue(context.worksheet, row, col, context.mergedCellsMap) || '';
        const value = Utils.getCellValue(context.worksheet, row, col + 1, context.mergedCellsMap) || '';

        return context.addStructure('keyValue', { key, value }, row, row, col, col + 1);
      },
      priority: 10,
      confidence: 0.8,
      metadata: {
        description: 'Detects simple key-value pairs in columns A and B',
        examples: ['Integration Overview: [value]', 'File Type: CSV']
      }
    }),

    new Rule({
      id: 'key-value-with-list',
      condition: (context, row, col) => {
        // Key in A, value in B that looks like a list (contains commas, bullets, etc.)
        if (!Utils.isKeyValuePair(context.worksheet, row, context.mergedCellsMap)) {
          return false;
        }

        const value = Utils.getCellValue(context.worksheet, row, col + 1, context.mergedCellsMap);
        if (!value) return false;

        const valueStr = String(value);
        return valueStr.includes(',') ||
          valueStr.includes(';') ||
          valueStr.includes('\n') ||
          valueStr.includes('•') ||
          valueStr.includes('-') ||
          /\[\s*["'].*["']\s*\]/.test(valueStr); // Array-like notation
      },
      action: (context, row, col) => {
        const key = Utils.getCellValue(context.worksheet, row, col, context.mergedCellsMap) || '';
        const valueRaw = Utils.getCellValue(context.worksheet, row, col + 1, context.mergedCellsMap) || '';

        // Try to convert to a list if it resembles array notation
        let valueList = valueRaw;
        if (typeof valueRaw === 'string') {
          // Check if it's in JSON array format
          if (/^\s*\[.*\]\s*$/.test(valueRaw)) {
            try {
              valueList = JSON.parse(valueRaw);
            } catch (e) {
              // Not valid JSON, try other approaches
              if (valueRaw.includes(';')) {
                valueList = valueRaw.split(';').map(item => item.trim()).filter(Boolean);
              } else if (valueRaw.includes(',')) {
                valueList = valueRaw.split(',').map(item => item.trim()).filter(Boolean);
              } else if (valueRaw.includes('\n')) {
                valueList = valueRaw.split('\n').map(item => item.trim()).filter(Boolean);
              }
            }
          } else {
            // Check for other list patterns
            if (valueRaw.includes(';')) {
              valueList = valueRaw.split(';').map(item => item.trim()).filter(Boolean);
            } else if (valueRaw.includes(',')) {
              valueList = valueRaw.split(',').map(item => item.trim()).filter(Boolean);
            } else if (valueRaw.includes('\n')) {
              valueList = valueRaw.split('\n').map(item => item.trim()).filter(Boolean);
            }
          }
        }

        return context.addStructure('keyValueWithList', { key, value: valueList }, row, row, col, col + 1);
      },
      priority: 15, // Higher priority than basic key-value
      confidence: 0.7,
      metadata: {
        description: 'Detects key-value pairs where the value is a list',
        examples: ['Criteria: [item1, item2, item3]', 'Assumptions: [bullet1; bullet2]']
      }
    })
  ],

  /**
   * Rules for detecting tables
   */
  tableRules: [
    new Rule({
      id: 'standard-table',
      condition: (context, startRow, startCol, endRow, endCol) => {
        return Utils.isTable(context.worksheet, startRow, endRow, startCol, endCol, context.mergedCellsMap);
      },
      action: (context, startRow, startCol, endRow, endCol) => {
        const tableData = Utils.extractTableData(
          context.worksheet, startRow, endRow, startCol, endCol, context.mergedCellsMap
        );

        return context.addStructure('table', tableData, startRow, endRow, startCol, endCol);
      },
      priority: 5,
      confidence: 0.7,
      metadata: {
        description: 'Detects standard tables with headers and data rows',
        examples: ['Tables with headers in the first row and data in subsequent rows']
      }
    })
  ],

  /**
   * Rules for detecting section titles
   */
  titleRules: [
    new Rule({
      id: 'section-title',
      condition: (context, row, col) => {
        return Utils.isTitle(context.worksheet, row, context.mergedCellsMap);
      },
      action: (context, row, col) => {
        const title = Utils.getCellValue(context.worksheet, row, col, context.mergedCellsMap);
        return context.addStructure('title', { title }, row, row, col, col);
      },
      priority: 20,
      confidence: 0.9,
      metadata: {
        description: 'Detects section titles in column A with no other content',
        examples: ['Mapping Details:', 'File layout:']
      }
    })
  ],

  /**
   * Rules for detecting blank rows as section separators
   */
  sectionRules: [
    new Rule({
      id: 'section-break',
      condition: (context, row, endRow) => {
        const consecutiveEmptyRows = Utils.countConsecutiveEmptyRows(
          context.worksheet, row, 0, 10, context.mergedCellsMap
        );

        return consecutiveEmptyRows >= 2 && row + consecutiveEmptyRows <= endRow;
      },
      action: (context, row, endRow) => {
        const consecutiveEmptyRows = Utils.countConsecutiveEmptyRows(
          context.worksheet, row, 0, 10, context.mergedCellsMap
        );

        return context.addStructure('sectionBreak', { rows: consecutiveEmptyRows },
          row, row + consecutiveEmptyRows - 1, 0, 10);
      },
      priority: 25,
      confidence: 0.95,
      metadata: {
        description: 'Detects multiple consecutive empty rows as section separators',
        examples: ['2+ empty rows between content sections']
      }
    })
  ]
};

/**
 * Main parser class that orchestrates the parsing process
 */
class RulesBasedParser {
  /**
   * Create a new parser
   * 
   * @param {Object} options - Parser options
   */
  constructor(options = {}) {
    this.options = {
      debug: false,
      enableLearning: true,
      ...options
    };

    this.rulesEngine = new RulesEngine();
    this.initializeRules();
  }

  /**
   * Initialize default rules
   */
  initializeRules() {
    // Register structure detection rules
    for (const rule of PredefinedRules.keyValueRules) {
      this.rulesEngine.registerRule('structure', rule);
    }

    for (const rule of PredefinedRules.tableRules) {
      this.rulesEngine.registerRule('structure', rule);
    }

    for (const rule of PredefinedRules.titleRules) {
      this.rulesEngine.registerRule('structure', rule);
    }

    for (const rule of PredefinedRules.sectionRules) {
      this.rulesEngine.registerRule('structure', rule);
    }
  }

  /**
   * Register a custom rule
   * 
   * @param {string} category - Rule category
   * @param {Object} ruleConfig - Rule configuration
   */
  registerRule(category, ruleConfig) {
    const rule = new Rule(ruleConfig);
    this.rulesEngine.registerRule(category, rule);
  }

  /**
   * Parse a worksheet
   * 
   * @param {Object} worksheet - XLSX worksheet
   * @param {string} sheetName - Name of the sheet
   * @returns {Object} Parsed sheet data
   */
  parseWorksheet(worksheet, sheetName) {
    if (this.options.debug) {
      console.log(`Parsing worksheet: ${sheetName}`);
    }

    // Create parsing context
    const context = new ParsingContext(worksheet, this.options);

    // Initial parsing strategy:
    // 1. Scan for obvious structures (tables, key-value pairs, titles)
    // 2. Mark cells as processed
    // 3. Repeat until all cells are processed or no more structures are found

    const range = context.range;

    // First pass: Identify section breaks
    for (let row = range.s.r; row <= range.e.r; row++) {
      const result = this.rulesEngine.evaluateRules('structure', context, row, range.e.r);
      if (result && result.success) {
        if (this.options.debug) {
          console.log(`Identified section break at row ${row + 1}`);
        }
      }
    }

    // Second pass: Identify titles and key-value pairs
    for (let row = range.s.r; row <= range.e.r; row++) {
      // Skip already processed rows
      if (context.isVisited(row, 0)) {
        continue;
      }

      // Try to identify a title
      let result = this.rulesEngine.evaluateRules('structure', context, row, 0);
      if (result && result.success) {
        if (this.options.debug) {
          console.log(`Identified title at row ${row + 1}`);
        }
        continue;
      }

      // Try to identify a key-value pair
      result = this.rulesEngine.evaluateRules('structure', context, row, 0);
      if (result && result.success) {
        if (this.options.debug) {
          console.log(`Identified key-value pair at row ${row + 1}`);
        }
        continue;
      }
    }

    // Third pass: Identify tables in unprocessed regions
    for (let row = range.s.r; row <= range.e.r; row++) {
      // Skip already processed rows
      if (context.isVisited(row, 0)) {
        continue;
      }

      // Try to find a table starting at this row
      // For simplicity, assume tables start at column A
      // Look for a block of unprocessed cells
      let endRow = row;
      while (endRow < range.e.r && !context.isVisited(endRow + 1, 0)) {
        endRow++;
      }

      // Need at least 2 rows for a table
      if (endRow > row) {
        const result = this.rulesEngine.evaluateRules(
          'structure', context, row, 0, endRow, range.e.c
        );

        if (result && result.success) {
          if (this.options.debug) {
            console.log(`Identified table from row ${row + 1} to ${endRow + 1}`);
          }
          continue;
        }
      }

      // Mark as visited if no structure was found
      context.markVisited(row, 0);
    }

    // Prepare the final result
    return this._prepareResult(context, sheetName);
  }

  /**
   * Parse a workbook
   * 
   * @param {string|Buffer|ArrayBuffer|Uint8Array} input - Excel file data
   * @param {Object} options - Parsing options
   * @returns {Object} Parsed workbook data
   */
  parseWorkbook(input, options = {}) {
    const workbook = XLSX.read(input, { type: options.type || 'buffer' });

    const result = {
      fileName: options.fileName || 'unknown.xlsx',
      sheets: [],
      totalRows: 0,
      totalTables: 0,
      totalKeyValuePairs: 0,
      totalLists: 0,
      totalTabularData: 0
    };

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const sheetData = this.parseWorksheet(worksheet, sheetName);

      result.sheets.push(sheetData);
      result.totalRows += sheetData.rows.length;
      result.totalTables += sheetData.tableCount || 0;
      result.totalKeyValuePairs += sheetData.keyValuePairs || 0;
      result.totalLists += sheetData.lists || 0;
      result.totalTabularData += sheetData.tabularData || 0;
    }

    return result;
  }

  /**
   * Prepare the final result for a worksheet
   * 
   * @param {ParsingContext} context - Parsing context
   * @param {string} sheetName - Name of the sheet
   * @returns {Object} Final result
   * @private
   */
  _prepareResult(context, sheetName) {
    const rows = [];
    let tableIndex = 0;

    // Process detected structures into rows
    for (const structure of context.detectedStructures) {
      if (structure.type === 'sectionBreak') {
        continue; // Skip section breaks in output
      }

      if (structure.type === 'table') {
        tableIndex++;

        // Add header row as a separate entry
        const headerRow = {
          id: `${sheetName}_table${tableIndex}_header`,
          sheetName,
          tableIndex,
          rowNumber: structure.range.s.r + 1, // 1-indexed
          type: 'tableHeader',
          headers: structure.data.headers,
          rowData: { _tableIndex: tableIndex },
          rowText: structure.data.headers.join('; ')
        };

        rows.push(headerRow);

        // Add data rows
        structure.data.rows.forEach((rowData, index) => {
          const rowNumber = structure.range.s.r + 2 + index; // 1-indexed, +2 for header row

          const row = {
            id: `${sheetName}_table${tableIndex}_row_${rowNumber}`,
            sheetName,
            tableIndex,
            rowNumber,
            type: 'table',
            headers: structure.data.headers,
            rowData: { ...rowData, _tableIndex: tableIndex },
            rowText: Object.entries(rowData)
              .map(([key, value]) => `${key}: ${value}`)
              .join('; ')
          };

          rows.push(row);
        });
      } else if (structure.type === 'keyValue') {
        const row = {
          id: `${sheetName}_keyValue_row_${structure.range.s.r + 1}`,
          sheetName,
          tableIndex: ++tableIndex,
          rowNumber: structure.range.s.r + 1, // 1-indexed
          type: 'keyValue',
          rowData: {
            key: structure.data.key,
            value: structure.data.value
          },
          rowText: `${structure.data.key}: ${structure.data.value}`
        };

        rows.push(row);
      } else if (structure.type === 'keyValueWithList') {
        const row = {
          id: `${sheetName}_keyValueList_row_${structure.range.s.r + 1}`,
          sheetName,
          tableIndex: ++tableIndex,
          rowNumber: structure.range.s.r + 1, // 1-indexed
          type: 'keyValueWithList',
          rowData: {
            key: structure.data.key,
            valueList: structure.data.value
          },
          rowText: `${structure.data.key}: ${JSON.stringify(structure.data.value)}`
        };

        rows.push(row);
      } else if (structure.type === 'title') {
        const row = {
          id: `${sheetName}_title_row_${structure.range.s.r + 1}`,
          sheetName,
          tableIndex: ++tableIndex,
          rowNumber: structure.range.s.r + 1, // 1-indexed
          type: 'title',
          rowData: {
            title: structure.data.title
          },
          rowText: structure.data.title
        };

        rows.push(row);
      }
    }

    // Sort rows by row number
    rows.sort((a, b) => a.rowNumber - b.rowNumber);

    // Count different types of data
    const keyValuePairs = rows.filter(row => row.type === 'keyValue').length;
    const lists = rows.filter(row => row.type === 'keyValueWithList').length;
    const tabularData = rows.filter(row => row.type === 'table').length;
    const tableCount = [...new Set(rows.filter(row => row.type === 'table' || row.type === 'tableHeader')
      .map(row => row.tableIndex))].length;

    return {
      sheetName,
      rows,
      rowCount: rows.length,
      tableCount,
      keyValuePairs,
      lists,
      tabularData
    };
  }

  /**
   * Get rule statistics
   * 
   * @returns {Object} Rule statistics
   */
  getRuleStats() {
    return this.rulesEngine.getRuleStats();
  }
}

// Export the public API
module.exports = {
  RulesBasedParser,
  Rule,
  Utils,
  // Allow direct access to predefined rules for customization
  PredefinedRules
};
