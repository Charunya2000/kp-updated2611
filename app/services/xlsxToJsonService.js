// import fs from 'fs';
// import * as XLSX from 'xlsx';

// export function findTablesInSheet(filePath) {
//   // Read the file as a buffer and load the workbook.
//   const fileBuffer = fs.readFileSync(filePath);
//   const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
//   const sheetName = workbook.SheetNames[0];
//   const sheet = workbook.Sheets[sheetName];

//   // Get the overall used range.
//   const range = XLSX.utils.decode_range(sheet['!ref']);
//   const totalRows = range.e.r - range.s.r + 1;
//   const totalCols = range.e.c - range.s.c + 1;

//   // Build a Boolean grid for each cell in the used range.
//   // true indicates cell has content; false means empty.
//   const grid = Array.from({ length: totalRows }, () => Array(totalCols).fill(false));

//   // Populate grid from cell values.
//   for (let R = range.s.r; R <= range.e.r; R++) {
//     for (let C = range.s.c; C <= range.e.c; C++) {
//       const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
//       if (
//         sheet[cellAddress] &&
//         sheet[cellAddress].v !== undefined &&
//         String(sheet[cellAddress].v).trim() !== ''
//       ) {
//         grid[R - range.s.r][C - range.s.c] = true;
//       }
//     }
//   }

//   // Process merged cells. If any cell in a merged range has content,
//   // mark every cell in that merge as true.
//   const merges = sheet['!merges'] || [];
//   for (const merge of merges) {
//     const startRow = merge.s.r;
//     const endRow = merge.e.r;
//     const startCol = merge.s.c;
//     const endCol = merge.e.c;
//     let hasContent = false;
//     for (let r = startRow; r <= endRow; r++) {
//       for (let c = startCol; c <= endCol; c++) {
//         const gridR = r - range.s.r;
//         const gridC = c - range.s.c;
//         if (gridR >= 0 && gridR < totalRows && gridC >= 0 && gridC < totalCols) {
//           if (grid[gridR][gridC]) {
//             hasContent = true;
//             break;
//           }
//         }
//       }
//       if (hasContent) break;
//     }
//     if (hasContent) {
//       for (let r = startRow; r <= endRow; r++) {
//         for (let c = startCol; c <= endCol; c++) {
//           const gridR = r - range.s.r;
//           const gridC = c - range.s.c;
//           if (gridR >= 0 && gridR < totalRows && gridC >= 0 && gridC < totalCols) {
//             grid[gridR][gridC] = true;
//           }
//         }
//       }
//     }
//   }

//   // Determine which rows and columns are completely empty.
//   function isRowEmpty(i) {
//     for (let j = 0; j < totalCols; j++) {
//       if (grid[i][j]) return false;
//     }
//     return true;
//   }
//   function isColEmpty(j) {
//     for (let i = 0; i < totalRows; i++) {
//       if (grid[i][j]) return false;
//     }
//     return true;
//   }

//   // Partition rows into contiguous groups that are not completely empty.
//   const rowGroups = [];
//   let startRow = null;
//   for (let i = 0; i < totalRows; i++) {
//     if (!isRowEmpty(i)) {
//       if (startRow === null) startRow = i;
//     } else {
//       if (startRow !== null) {
//         rowGroups.push({ start: startRow, end: i - 1 });
//         startRow = null;
//       }
//     }
//   }
//   if (startRow !== null) rowGroups.push({ start: startRow, end: totalRows - 1 });

//   // Partition columns into contiguous groups that are not completely empty.
//   const colGroups = [];
//   let startCol = null;
//   for (let j = 0; j < totalCols; j++) {
//     if (!isColEmpty(j)) {
//       if (startCol === null) startCol = j;
//     } else {
//       if (startCol !== null) {
//         colGroups.push({ start: startCol, end: j - 1 });
//         startCol = null;
//       }
//     }
//   }
//   if (startCol !== null) colGroups.push({ start: startCol, end: totalCols - 1 });

//   // Every region is defined by a horizontal block from rowGroups and a vertical block from colGroups.
//   // (This assumes that empty rows and columns serve as boundaries.)
//   const regions = [];
//   for (const rGroup of rowGroups) {
//     for (const cGroup of colGroups) {
//       // Verify that at least one cell in the rectangle contains content.
//       let hasContent = false;
//       for (let i = rGroup.start; i <= rGroup.end && !hasContent; i++) {
//         for (let j = cGroup.start; j <= cGroup.end; j++) {
//           if (grid[i][j]) {
//             hasContent = true;
//             break;
//           }
//         }
//       }
//       if (hasContent) {
//         // Convert indices back to actual Excel cell addresses,
//         // adding back the offset stored in range.s.
//         const startCell = XLSX.utils.encode_cell({ r: rGroup.start + range.s.r, c: cGroup.start + range.s.c });
//         const endCell = XLSX.utils.encode_cell({ r: rGroup.end + range.s.r, c: cGroup.end + range.s.c });
//         regions.push({ region: { start: startCell, end: endCell } });
//       }
//     }
//   }

//   return regions;
// }

// const filePath = 'test.xlsx';
// const regions = findTablesInSheet(filePath);
// console.log("Detected table regions:", regions);
