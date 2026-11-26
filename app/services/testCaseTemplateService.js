'use server';

import excelUtils from './excelUtilsService';
import { writeFileBufferToBlobStorage, generateTemporaryDownloadLink } from './blobStorageService';

const { createWorkbook, objectsToWorksheet, getWorkbookBuffer } = excelUtils;
/**
 * Generate an Excel spreadsheet from test cases and save to blob storage
 * 
 * @param {string} smartNoteId - ID of the smart note
 * @param {Array} testCases - Array of test cases
 * @param {string} documentName - Name of the original document
 * @returns {Promise<string>} - URL to download the template
 */
export async function generateTestCaseTemplate(smartNoteId, testCases, documentName) {
  if (!testCases || testCases.length === 0) {
    return null;
  }

  try {
    // Create a new workbook
    const workbook = createWorkbook();

    // Convert test cases to a format suitable for Excel
    // We need to handle steps specially since they need to be represented as sub-cells
    const worksheetData = testCases.map(testCase => {
      // Create a base row for each test case
      const baseRow = {
        'Test Case ID': testCase.testCaseId || '',
        'Test Case Name': testCase.testCaseName || '',
        'Description': testCase.description || '',
        'Pre-Condition': testCase.preCondition || '',
        'Steps #': '', // Will be filled with concatenated step numbers
        'Step Description': '', // Will be filled with concatenated step descriptions
        'Expected Result': '', // Will be filled with concatenated expected results
        'Test Case Type': testCase.testCaseType || '',
        'Test Case Status': testCase.testCaseStatus || '',
        'Test Case Priority': testCase.testCasePriority || '',
        'Test Case Assigned To': testCase.testCaseAssignedTo || '',
        'Custom Field 1': testCase.customField1 || '',
        'Custom Field 2': testCase.customField2 || '',
        'Custom Field 3': testCase.customField3 || '',
        'Requirement IDs': testCase.requirementIds || ''
      };

      // Handle steps by concatenating them with line breaks
      if (testCase.steps && testCase.steps.length > 0) {
        baseRow['Steps #'] = testCase.steps.map(step => step.stepNumber).join('\n');
        baseRow['Step Description'] = testCase.steps.map(step => step.stepDescription).join('\n');
        baseRow['Expected Result'] = testCase.steps.map(step => step.expectedResult).join('\n');
      }

      return baseRow;
    });

    // Create worksheet from the data
    const worksheet = objectsToWorksheet(workbook, worksheetData, 'Test Cases');

    // Set column widths for better readability using exceljs syntax
    worksheet.columns = [
      { width: 15 }, // Test Case ID
      { width: 30 }, // Test Case Name
      { width: 40 }, // Description
      { width: 30 }, // Pre-Condition
      { width: 10 }, // Steps #
      { width: 40 }, // Step Description
      { width: 40 }, // Expected Result
      { width: 15 }, // Test Case Type
      { width: 15 }, // Test Case Status
      { width: 15 }, // Test Case Priority
      { width: 20 }, // Test Case Assigned To
      { width: 15 }, // Custom Field 1
      { width: 15 }, // Custom Field 2
      { width: 15 }, // Custom Field 3
      { width: 20 }  // Requirement IDs
    ];

    // Generate a safe file name from the document name
    const safeDocumentName = documentName
      ? documentName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
      : 'updated_test_cases';

    // Create the blob name
    const blobName = `test_cases-${smartNoteId}-${safeDocumentName}.xlsx`;
    const containerName = 'test-case-spreadsheets';
    const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    // Convert workbook to buffer using exceljs
    const excelBuffer = await getWorkbookBuffer(workbook);

    // Upload to blob storage
    const isWriteSuccess = await writeFileBufferToBlobStorage(
      excelBuffer,
      containerName,
      blobName,
      contentType
    );

    if (!isWriteSuccess) {
      console.error('Failed to upload spreadsheet to blob storage');
      return null;
    }

    // Generate a temporary download link (valid for 48 hours)
    const linkValidity = 48 * 60; // 48 hours in minutes
    const downloadUrl = await generateTemporaryDownloadLink(
      containerName,
      blobName,
      linkValidity
    );

    return downloadUrl;
  } catch (error) {
    console.error('Error creating and uploading test case spreadsheet:', error);
    return null;
  }
}
