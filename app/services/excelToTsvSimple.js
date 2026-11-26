'use server';

/**
 * excelToTsvSimple.js
 * 
 * This utility file provides functions to convert Excel (.xlsx) files 
 * to tab-separated values (TSV) text and index them in Azure Search.
 * 
 * Key features:
 * - Processes multiple sheets in an Excel file
 * - Creates separate AI Search documents for each sheet
 * - Intelligently chunks content based on size
 * - Vectorizes and indexes content directly
 * 
 * @module utils/excelToTsvSimple
 */

import excelUtils from './excelUtilsService';
import { countTokens } from './countTokensService';
import { v4 as uuidv4 } from 'uuid';
import { vectorize } from './vectorizeDataService';
import { SearchClient, AzureKeyCredential } from '@azure/search-documents';

const { getWorksheetRange, getCellValue, hasContent, readWorkbookFromBuffer } = excelUtils;
const smartNoteIndexName = 'smartnote-file-002';
const envName = process.env['envName'];
const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.api.key`];

// Change to an object to cache clients by index name
let searchClients = {};

function getSearchClient(index) {
  index = index ?? smartNoteIndexName;

  // Check if we already have a client for this specific index
  if (!searchClients[index]) {
    // Create a new client for this index
    searchClients[index] = new SearchClient(
      searchEndpoint,
      index,
      new AzureKeyCredential(searchAPIKey)
    );
  }

  // Return the cached client for this index
  return searchClients[index];
}

/**
 * Converts an Excel file buffer to tab-separated text for a specific sheet
 * 
 * @param {Object} sheet - The Excel sheet to process
 * @param {String} sheetName - The name of the sheet
 * @param {Array<Object>} excludeTables - Array of table objects to exclude from TSV conversion
 * @returns {String} Tab-separated text representation of the Excel sheet
 */
function convertSheetToTsv(sheet, sheetName, excludeTables = []) {
  try {
    // Find the maximum column index with meaningful content
    const range = getWorksheetRange(sheet);
    let maxNonEmptyColumn = 0;
    let maxNonEmptyRow = 0;

    // Scan all cells to find the rightmost non-empty cell and bottom-most non-empty cell
    // excluding cells that are in table ranges
    for (let r = range.s.r; r <= range.e.r; r++) {
      let rowHasContent = false;

      for (let c = range.s.c; c <= range.e.c; c++) {
        // Skip cells that are in table ranges
        if (isCellInTableRange(r + 1, c + 1, excludeTables)) {
          continue;
        }

        const cellValue = getCellValue(sheet, r, c);

        if (hasContent(cellValue)) {
          if (c > maxNonEmptyColumn) {
            maxNonEmptyColumn = c;
          }
          rowHasContent = true;
        }
      }

      if (rowHasContent && r > maxNonEmptyRow) {
        maxNonEmptyRow = r;
      }
    }

    // Build TSV content manually, excluding table ranges
    const rows = [];
    for (let r = range.s.r; r <= maxNonEmptyRow; r++) {
      const cells = [];
      let rowHasNonTableContent = false;

      for (let c = range.s.c; c <= maxNonEmptyColumn; c++) {
        // Skip cells that are in table ranges
        if (isCellInTableRange(r + 1, c + 1, excludeTables)) {
          cells.push(''); // Keep column alignment
          continue;
        }

        const cellValue = getCellValue(sheet, r, c);
        const cellText = cellValue !== null && cellValue !== undefined ? String(cellValue) : '';
        cells.push(cellText);

        if (cellText) {
          rowHasNonTableContent = true;
        }
      }

      // Only add rows that have content outside of tables
      if (rowHasNonTableContent) {
        rows.push(cells.join('\t').trimEnd());
      }
    }

    // Only return content if there's something to return
    if (rows.length === 0) {
      return '';
    }

    let result = rows.join('\n');
    const structuredHeader = `Excel Sheet Title: ${sheetName}\n\nExcel Content:\n`;
    result = structuredHeader + result;

    return result;
  } catch (error) {
    console.error(`Error converting sheet "${sheetName}" to TSV:`, error);
    throw new Error(`Failed to convert sheet "${sheetName}" to TSV: ${error.message}`);
  }
}

/**
 * Converts sheet data to structured format
 * 
 * @param {Object} sheet - The Excel sheet to process
 * @param {String} sheetName - The name of the sheet
 * @returns {Array<Object>} Array of row objects with header-value pairs
 */
function convertSheetToStructuredJson(sheet, sheetName) {
  try {
    const range = getWorksheetRange(sheet);
    let maxNonEmptyColumn = 0;
    let maxNonEmptyRow = 0;

    // Scan all cells to find boundaries
    for (let r = range.s.r; r <= range.e.r; r++) {
      let rowHasContent = false;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellValue = getCellValue(sheet, r, c);
        if (hasContent(cellValue)) {
          if (c > maxNonEmptyColumn) maxNonEmptyColumn = c;
          rowHasContent = true;
        }
      }
      if (rowHasContent && r > maxNonEmptyRow) maxNonEmptyRow = r;
    }

    // Extract headers from first row
    const headers = [];
    for (let c = range.s.c; c <= maxNonEmptyColumn; c++) {
      const headerValue = getCellValue(sheet, range.s.r, c);
      headers.push(headerValue !== null && headerValue !== undefined ? String(headerValue).trim() : `Column${c + 1}`);
    }

    // Build array of row objects
    const rows = [];
    for (let r = range.s.r + 1; r <= maxNonEmptyRow; r++) {
      const rowObj = {};
      for (let c = range.s.c; c <= maxNonEmptyColumn; c++) {
        const cellValue = getCellValue(sheet, r, c);
        rowObj[headers[c]] = cellValue !== null && cellValue !== undefined ? String(cellValue) : '';
      }
      rows.push(rowObj);
    }

    // Return array of row objects instead of JSON string
    return rows;
  } catch (error) {
    console.error(`Error converting sheet "${sheetName}" to structured JSON:`, error);
    throw new Error(`Failed to convert sheet "${sheetName}": ${error.message}`);
  }
}

/**
 * Extracts all Excel-defined tables from a worksheet
 * 
 * @param {Object} sheet - The Excel sheet to analyze
 * @returns {Array<Object>} Array of table objects with name, range, and data
 */
function extractExcelTables(sheet) {
  const tables = [];

  // Check if the sheet has any tables
  if (!sheet.tables || Object.keys(sheet.tables).length === 0) {
    return tables;
  }

  // Process each table in the worksheet (tables is an object, not array)
  for (const tableName in sheet.tables) {
    const table = sheet.tables[tableName];
    try {
      const tableRef = table.table?.tableRef || table.ref;
      if (!tableRef) continue;

      // Parse the table reference (e.g., "A1:D10")
      const [startCell, endCell] = tableRef.split(':');
      const range = sheet.getCell(startCell);
      const endRange = sheet.getCell(endCell);

      const tableData = {
        name: table.name || table.displayName || 'UnnamedTable',
        ref: tableRef,
        startRow: range.row,
        endRow: endRange.row,
        startCol: range.col,
        endCol: endRange.col,
        rows: []
      };

      // Extract headers
      const headers = [];
      for (let c = tableData.startCol; c <= tableData.endCol; c++) {
        const cell = sheet.getCell(tableData.startRow, c);
        headers.push(cell.value ? String(cell.value).trim() : `Column${c}`);
      }

      // Extract data rows
      for (let r = tableData.startRow + 1; r <= tableData.endRow; r++) {
        const rowObj = {};
        for (let c = tableData.startCol; c <= tableData.endCol; c++) {
          const cell = sheet.getCell(r, c);
          const headerIndex = c - tableData.startCol;
          rowObj[headers[headerIndex]] = cell.value !== null && cell.value !== undefined ? String(cell.value) : '';
        }
        tableData.rows.push(rowObj);
      }

      tables.push(tableData);
    } catch (error) {
      console.error(`Error extracting table:`, error);
    }
  }

  return tables;
}

/**
 * Checks if a cell is within any of the table ranges
 * 
 * @param {Number} row - Row number (1-based)
 * @param {Number} col - Column number (1-based)
 * @param {Array<Object>} tables - Array of table objects with range info
 * @returns {boolean} True if cell is within a table range
 */
function isCellInTableRange(row, col, tables) {
  for (const table of tables) {
    if (row >= table.startRow && row <= table.endRow &&
      col >= table.startCol && col <= table.endCol) {
      return true;
    }
  }
  return false;
}

/**
 * Detects if a worksheet has table-like structure
 * A sheet is considered table-like if:
 * 1. It has at least 2 rows
 * 2. The first row appears to be headers (all non-empty cells)
 * 3. Data rows have consistent column structure
 * 
 * @param {Object} sheet - The Excel sheet to analyze
 * @returns {boolean} True if the sheet has table structure
 */
function hasTableStructure(sheet) {
  try {
    const range = getWorksheetRange(sheet);

    // Need at least 2 rows (header + data)
    if (range.e.r - range.s.r < 1) {
      return false;
    }

    // Check if first row has content in most cells (likely headers)
    let firstRowNonEmptyCells = 0;
    let firstRowTotalCells = 0;

    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellValue = getCellValue(sheet, range.s.r, c);
      firstRowTotalCells++;
      if (hasContent(cellValue)) {
        firstRowNonEmptyCells++;
      }
    }

    // If less than 50% of first row has content, probably not a table
    if (firstRowNonEmptyCells < firstRowTotalCells * 0.5) {
      return false;
    }

    // Check if we have at least one data row with content
    let hasDataRows = false;
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellValue = getCellValue(sheet, r, c);
        if (hasContent(cellValue)) {
          hasDataRows = true;
          break;
        }
      }
      if (hasDataRows) break;
    }

    return hasDataRows;
  } catch (error) {
    console.error('Error detecting table structure:', error);
    return false;
  }
}

/**
 * Chunks text content based on size
 * If content is less than 16384 bytes, returns a single chunk
 * Otherwise, creates chunks of that size (respecting line boundaries)
 * with any remainder lines as the last chunk
 * 
 * @param {String} content - The content to chunk
 * @returns {Array<String>} Array of content chunks
 */
function chunkContent(content) {
  /*// Convert to bytes to check size
  const contentBytes = Buffer.from(content, 'utf8');
  const contentSize = contentBytes.length;

  // If content is small enough, return as single chunk
  // Instead of contentsize we have to use countToken less than 8000
  if (contentSize <= 32768) {
    return [content];
  }*/
  const tokenCount = countTokens([{ role: 'user', content: content }]);
  if (tokenCount <= 8000) {
    return [content];
  }

  // For larger content, chunk by token count while respecting line boundaries
  const chunks = [];
  const lines = content.split('\n');
  let currentChunk = [];
  const targetTokenLimit = 8000;

  for (const line of lines) {
    // Create temporary chunk with the new line to test token count
    const testChunk = [...currentChunk, line].join('\n');
    const testTokenCount = countTokens([{ role: 'user', content: testChunk }]);

    // If adding this line would exceed the token limit and we already have content,
    // complete the current chunk and start a new one
    if (testTokenCount > targetTokenLimit && currentChunk.length > 0) {
      const chunkText = currentChunk.join('\n');
      chunks.push(chunkText);
      currentChunk = [line];
    } else {
      // Add the line to the current chunk
      currentChunk.push(line);
    }
  }

  // Add the last chunk if there's anything left
  if (currentChunk.length > 0) {
    const lastChunkText = currentChunk.join('\n');
    chunks.push(lastChunkText);
  }

  return chunks;
}

/**
 * Chunks row objects using First Fit algorithm to maximize token usage
 * while staying under the token limit
 * 
 * @param {Array<Object>} rowObjects - Array of row data objects
 * @param {Number} maxTokens - Maximum tokens per chunk (default: 8000)
 * @returns {Array<Array<Object>>} Array of row chunks
 */
function chunkRowsFirstFit(rowObjects, maxTokens = 8000) {
  const chunks = [];
  let currentChunk = [];

  for (const rowData of rowObjects) {
    const rowJsonContent = JSON.stringify(rowData);
    const rowTokenCount = countTokens([{ role: 'user', content: rowJsonContent }]);

    // Validate single row doesn't exceed limit
    if (rowTokenCount >= maxTokens) {
      throw new Error(`Single row exceeds token limit (${rowTokenCount} tokens). Maximum allowed is ${maxTokens} tokens.`);
    }

    // Check if adding this row would exceed the limit
    const combinedContent = JSON.stringify([...currentChunk, rowData]);
    const combinedTokenCount = countTokens([{ role: 'user', content: combinedContent }]);

    if (combinedTokenCount >= maxTokens && currentChunk.length > 0) {
      // Current chunk is full, save it and start new one
      chunks.push(currentChunk);
      currentChunk = [rowData];
    } else {
      // Add to current chunk
      currentChunk.push(rowData);
    }
  }

  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Memory consumption notes for Excel processing:
 * 
 * The xlsx.read() function typically requires 5-10x the file size in memory due to:
 * 1. The original file buffer (1x)
 * 2. Parsed internal representation (2-3x)
 * 3. Cell data structures and formatting information (2-6x)
 * 
 * For a 530KB Excel file:
 *   - Minimum memory: ~2.5MB (5x)
 *   - Average memory: ~4MB (7-8x)
 *   - Peak memory: ~5.3MB (10x)
 * 
 * The memory is primarily used during parsing and is eligible for garbage 
 * collection after processing completes.
 * 
 * For large files (>5MB), consider:
 * - Processing sheets sequentially rather than holding the entire workbook
 * - Using stream-based parsing if available
 * - Increasing Next.js server memory limits if needed
 */

export async function processExcelFile(fileBuffer, document, nuid, fileType) {
  try {
    // Parse the Excel file from buffer
    // This is the memory-intensive step - for a 530KB file, expect ~4MB peak usage
    const workbook = await readWorkbookFromBuffer(fileBuffer);

    // Set index based on document type
    let index = smartNoteIndexName; // Default
    if (document.type === 'SharePointFile') {
      index = `sharepoint-uploads`;
    }

    const responses = [];
    // Process each sheet in the workbook
    for (const worksheet of workbook.worksheets) {
      const sheetName = worksheet.name;

      // STEP 1: Extract and process Excel-defined tables first
      const excelTables = extractExcelTables(worksheet);
      const documents = [];

      if (excelTables.length > 0 && document.type === 'UploadedDocument') {
        // Process each table separately
        for (const table of excelTables) {
          if (table.rows.length > 0) {
            // Chunk table rows to maximize token usage while staying under limit
            const rowChunks = chunkRowsFirstFit(table.rows, 8000);

            // Process each chunk as a single document
            for (const chunk of rowChunks) {
              // Convert chunk to JSON array string
              const chunkContent = JSON.stringify(chunk);
              const contentVector = await vectorize({ nuid, content: chunkContent });

              documents.push({
                id: uuidv4(),
                nuid: nuid,
                smartnote_id: document.parentId,
                smart_file_type: fileType,
                smart_file_name: `${document.fileName}`,
                smart_file_category: 'User',
                content: chunkContent,
                content_vector: contentVector
              });
            }
          }
        }
      }

      // STEP 2: Process remaining content (non-table cells) as TSV
      const tsvContent = convertSheetToTsv(worksheet, sheetName, excelTables);

      // Only process TSV content if there's something to process
      if (tsvContent && tsvContent.trim().length > 0) {
        // Chunk the content based on size
        const contentChunks = chunkContent(tsvContent);

        // Process each chunk
        for (const chunk of contentChunks) {
          try {
            // Vectorize the chunk
            const contentVector = await vectorize({ nuid, content: chunk });

            if (document.type === 'SharePointFile') {
              const siteName = document.relativeUrl.split('/')[2];

              documents.push({
                id: uuidv4(),
                nuid: nuid,
                smartnote_id: document.parentId,
                site_name: siteName.toLowerCase(),
                file_type: fileType,
                file_name: `${document.fileName}`,
                file_category: 'User',
                relative_url: document.relativeUrl,
                content: chunk,
                content_vector: contentVector
              });
            } else if (document.type === 'UploadedDocument') {
              documents.push({
                id: uuidv4(),
                nuid: nuid,
                smartnote_id: document.parentId,
                smart_file_type: fileType,
                smart_file_name: `${document.fileName}`,
                smart_file_category: 'User',
                content: chunk,
                content_vector: contentVector
              });
            }
          } catch (error) {
            console.error(`Error processing chunk from sheet "${sheetName}":`, error);
            throw error;
          }
        }
      }

      // Upload all documents for this sheet (tables + remaining content)
      if (documents.length > 0) {
        const batch = documents.map(doc => ({
          '@search.action': 'upload',
          ...doc
        }));
        responses.push(await getSearchClient(index).uploadDocuments(batch));
      }
    }

    return responses;
  } catch (error) {
    console.error('Error processing Excel file:', error);
    throw new Error(`Failed to process Excel file: ${error.message}`);
  }
}

/**
 * Original function maintained for backward compatibility
 * Now simply extracts text from the first sheet
 */
export async function convertExcelToTsv(fileBuffer, options = {}) {
  const { sheetName } = options;

  try {
    // Parse the Excel file from buffer
    const workbook = await readWorkbookFromBuffer(fileBuffer);

    const targetSheet = sheetName
      ? workbook.getWorksheet(sheetName)
      : workbook.worksheets[0];

    if (!targetSheet) {
      throw new Error(sheetName
        ? `Sheet "${sheetName}" not found in workbook`
        : 'No sheets found in workbook');
    }

    return convertSheetToTsv(targetSheet, targetSheet.name);
  } catch (error) {
    console.error('Error converting Excel to TSV:', error);
    throw new Error(`Failed to convert Excel to TSV: ${error.message}`);
  }
}