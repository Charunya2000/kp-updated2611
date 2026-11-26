'use server';

import excelUtils from '../../../excelUtilsService';
import { writeFileBufferToBlobStorage, generateTemporaryDownloadLink } from '@services/blobStorageService';

const { createWorkbook, objectsToWorksheet, getWorkbookBuffer } = excelUtils;

/**
 * Save the generated test cases to a spreadsheet and upload to blob storage
 * This node creates an Excel spreadsheet from the test cases and uploads it to Azure Blob Storage
 * 
 * @param {Object} state - Current state of the graph
 * @returns {Object} - Updated state with download link for the spreadsheet
 */
export const saveTemplateToBlobStorageNode = async (state) => {
  const { smartNoteId, testCases, documentName, summary } = state;

  if (!testCases || testCases.length === 0) {
    return {
      templateDownloadUrl: null,
      message: state.message || 'No test cases available to save to template'
    };
  }

  try {
    // Create a new workbook
    const workbook = createWorkbook();

    // Convert test cases to a format suitable for Excel
    // Each test case can have multiple steps, so we create sub rows for steps
    const worksheetData = [];
    testCases.forEach(testCase => {
      if (testCase.steps && testCase.steps.length > 0) {
        testCase.steps.forEach((step, idx) => {
          worksheetData.push({
            'Test Case ID': idx === 0 ? testCase.testCaseId || '' : '',
            'Test Case Name': idx === 0 ? testCase.testCaseName || '' : '',
            'Description': idx === 0 ? testCase.description || '' : '',
            'Pre-Condition': idx === 0 ? testCase.preCondition || '' : '',
            'Requirement IDs': idx === 0 ? testCase.requirementIds || '' : '',
            'Requirements': idx === 0 ? testCase.requirements || '' : '',
            'Data': step.data || '',
            'Steps #': step.stepNumber || '',
            'Step Description': step.stepDescription || '',
            'Expected Result': step.expectedResult || '',
            'Test Case Type': idx === 0 ? testCase.testCaseType || '' : '',
            'Test Case Status': idx === 0 ? testCase.testCaseStatus || '' : '',
            'Test Case Priority': idx === 0 ? testCase.testCasePriority || '' : '',
            'Test Case Designer Name': idx === 0 ? testCase.testCaseDesignerName || '' : '',
            'Test Case Assigned To': idx === 0 ? testCase.testCaseAssignedTo || '' : '',
            'Module': idx === 0 ? testCase.module || '' : '',
            'Method': idx === 0 ? testCase.method || '' : '',
            'Market': idx === 0 ? testCase.market || '' : '',
            'Application': idx === 0 ? testCase.application || '' : '',
            'Workstream': idx === 0 ? testCase.workstream || '' : '',
            'Feature': idx === 0 ? testCase.feature || '' : '',
            'Category': idx === 0 ? testCase.category || '' : '',
            'Persona': idx === 0 ? testCase.persona || '' : '',
            'Union': idx === 0 ? testCase.union || '' : '',
          });
        });
      } else {
        worksheetData.push({
          'Test Case ID': testCase.testCaseId || '',
          'Test Case Name': testCase.testCaseName || '',
          'Description': testCase.description || '',
          'Pre-Condition': testCase.preCondition || '',
          'Requirement IDs': testCase.requirementIds || '',
          'Requirements': testCase.requirements || '',
          'Data': testCase.data || '',
          'Steps #': '',
          'Step Description': '',
          'Expected Result': '',
          'Test Case Type': testCase.testCaseType || '',
          'Test Case Status': testCase.testCaseStatus || '',
          'Test Case Priority': testCase.testCasePriority || '',
          'Test Case Designer Name': testCase.testCaseDesignerName || '',
          'Test Case Assigned To': testCase.testCaseAssignedTo || '',
          'Module': testCase.module || '',
          'Method': testCase.method || '',
          'Market': testCase.market || '',
          'Application': testCase.application || '',
          'Workstream': testCase.workstream || '',
          'Feature': testCase.feature || '',
          'Category': testCase.category || '',
          'Persona': testCase.persona || '',
          'Union': testCase.union || '',
        });
      }
    });

    // Create worksheet from the data
    const worksheet = objectsToWorksheet(workbook, worksheetData, 'Test Cases');

    // Set column widths for better readability using exceljs syntax
    worksheet.columns = [
      { width: 10 }, // Test Case ID
      { width: 10 }, // Test Case Name
      { width: 10 }, // Description
      { width: 10 }, // Pre-Condition
      { width: 10 }, // Requirement IDs
      { width: 15 }, // Requirements
      { width: 10 }, // Data
      { width: 10 }, // Steps #
      { width: 10 }, // Step Description
      { width: 10 }, // Expected Result
      { width: 15 }, // Test Case Type
      { width: 15 }, // Test Case Status
      { width: 15 }, // Test Case Priority
      { width: 10 }, // Test Case Designer Name
      { width: 10 }, // Test Case Assigned To
      { width: 10 }, // Module
      { width: 10 }, // Method
      { width: 10 }, // Market
      { width: 10 }, // Application
      { width: 10 }, // Workstream
      { width: 10 }, // Feature
      { width: 10 }, // Category
      { width: 10 }, // Persona
      { width: 10 }, // Union
    ];

    // Generate a safe file name from the document name (prefix only, no suffix)
    let safeDocumentName = 'unknown_document';
    if (documentName) {
      // Remove suffix if present
      const prefix = documentName.lastIndexOf('.') !== -1
        ? documentName.substring(0, documentName.lastIndexOf('.'))
        : documentName;
      safeDocumentName = prefix.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    }

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
      return {
        templateDownloadUrl: null,
        message: state.message,
        error: 'Failed to upload test case spreadsheet to blob storage'
      };
    }

    // Generate a temporary download link (valid for 48 hours)
    const linkValidity = 48 * 60; // 48 hours in minutes
    const downloadUrl = await generateTemporaryDownloadLink(
      containerName,
      blobName,
      linkValidity
    );

    let finalMessage = `Test cases generated and spreadsheet template created successfully.\n\n[Download Test Case Spreadsheet](${downloadUrl})`;

    // Add summary information if available
    if (summary && summary.sections && summary.sections.length > 0) {
      const sectionDetails = summary.sections
        .map(section => `  • ${section.shortTopic}: ${section.testCaseCount} test case${section.testCaseCount !== 1 ? 's' : ''}`)
        .join('\n');

      finalMessage = `Test cases generated and spreadsheet template created successfully.

**Generation Summary:**
  Total Test Cases: ${summary.totalTestCasesCount}

**By Section:**
${sectionDetails}

[Download Test Case Spreadsheet](${downloadUrl})`;
    }

    if (state.warningMessage) {
      finalMessage = `${state.warningMessage}\n\n${finalMessage}`;
    }

    return {
      templateDownloadUrl: downloadUrl,
      message: finalMessage
    };
  } catch (error) {
    console.error('Error creating and uploading test case spreadsheet:', error);
    return {
      templateDownloadUrl: null,
      message: state.message,
      error: `Error creating test case spreadsheet: ${error.message}`
    };
  }
};
