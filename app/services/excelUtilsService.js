import { Workbook } from 'exceljs-hardened';


/**
 * Creates a new Excel workbook
 * @returns {ExcelJS.Workbook} The new workbook
 */
function createWorkbook() {
  return new Workbook();
}

/**
 * Reads an Excel file from a buffer
 * @param {Buffer} buffer - The file buffer
 * @returns {Promise<ExcelJS.Workbook>} The parsed workbook
 */
export async function readWorkbookFromBuffer(buffer) {
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}


/**
 * Converts an array of arrays to a worksheet
 * @param {ExcelJS.Workbook} workbook - The workbook
 * @param {Array} data - 2D array of data       
 * @param {string} sheetName - The name of the sheet
 * @returns {ExcelJS.Worksheet} The created worksheet with data
 */
function arrayToWorksheet(workbook, data, sheetName = 'Sheet1') {
  const worksheet = workbook.addWorksheet(sheetName);
  worksheet.addRows(data);
  return worksheet;
}

/**
 * Attempts to write or download workbook data to file
 * @param {ExcelJS.Workbook} workbook - The workbook
 * @param {string} filePath - The file path in which to write the workbook
 * @returns {Promise<void>}
 */
async function writeWorkbookToFile(workbook, filePath) {
  await workbook.xlsx.writeFile(filePath);
}

/**
 * Gets the buffer of the workbook
 * @param {ExcelJS.Workbook} workbook - The workbook
 * @returns {Promise<Buffer>} The buffer of the workbook
 */
async function getWorkbookBuffer(workbook) {
  return await workbook.xlsx.writeBuffer();
}

/**
 * Converts an array of JS objects to a worksheet
 * @param {ExcelJS.Worksheet} worksheet - The worksheet
 * @param {Object} rows - Array of JS objects that represent rows, where keys are column headers and values are cell values. Values that are arrays will be joined with newlines in the same cell.
 * @param {string} sheetName - The name of the sheet    
 * @returns {ExcelJS.Worksheet} The created worksheet with data
 */
function objectsToWorksheet(workbook, rows, sheetName = 'Sheet1') {
  const worksheet = workbook.addWorksheet(sheetName);
  if (rows.length > 0) {
    const headers = Object.keys(rows[0]);
    worksheet.addRows(
      [
        headers,
        ...rows.map(obj => headers.map(h => {
          return Array.isArray(obj[h]) ? obj[h].join('\n') : obj[h] // Spread Arrays into multiple lines in the same cell
        })
        )
      ]
    );

    // Enable word wrap for cells with newlines
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        if (cell.value && typeof cell.value === 'string' && cell.value.includes('\n')) {
          cell.alignment = { wrapText: true, vertical: 'top' };
        }
      });
    });
  }
  return worksheet;
}

/**
 * Gets the range of a worksheet
 * @param {ExcelJS.Worksheet} worksheet - The worksheet
 * @returns {Object} Range object with start and end positions {s: {r, c}, e: {r, c}}
 */
function getWorksheetRange(worksheet) {
  const dimensions = worksheet.dimensions;

  if (!dimensions) {
    return { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
  }

  return {
    s: {
      r: dimensions.top - 1,    // Convert to 0-based
      c: dimensions.left - 1    // Convert to 0-based
    },
    e: {
      r: dimensions.bottom - 1,  // Convert to 0-based
      c: dimensions.right - 1    // Convert to 0-based
    }
  };
}

/**
 * Gets the value of a cell at specific row and column
 * @param {ExcelJS.Worksheet} worksheet - The worksheet
 * @param {number} row - 0-based row index
 * @param {number} col - 0-based column index
 * @returns {any} The cell value
 */
function getCellValue(worksheet, row, col) {
  const cell = worksheet.getCell(row + 1, col + 1); // ExcelJS uses 1-based indexing
  return cell.value;
}

/**
 * Checks if a cell has meaningful content
 * @param {any} cellValue - The cell value
 * @returns {boolean} True if cell has content
 */
function hasContent(cellValue) {
  return cellValue !== undefined &&
    cellValue !== null &&
    !(typeof cellValue === 'string' && cellValue.trim() === '');
}

export default {
  createWorkbook,
  arrayToWorksheet,
  getWorkbookBuffer,
  objectsToWorksheet,
  getWorksheetRange,
  readWorkbookFromBuffer,
  getCellValue,
  hasContent
};

// Server-only export for API routes
export { writeWorkbookToFile };