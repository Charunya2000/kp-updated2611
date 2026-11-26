// generateDifferencesSpreadsheetNode.js

import ExcelJS from 'exceljs-hardened';
import path from 'path';
import os from 'os';
import fs from 'fs';

export const generateDifferencesSpreadsheetNode = async (state) => {
  const { updateChatInteractionProgress } = await import('../helpers/progressTracking');

  let progressResponse = state.progressResponse || "## Comparison Progress\n\n";
  const generatingLabel = "⏳ Generating comparison spreadsheet...";
  let progressMutated = false;

  if (!progressResponse.includes(generatingLabel)) {
    progressResponse += `${generatingLabel}\n\n---\n`;
    progressMutated = true;
  }

  if (progressMutated && state.chatInteractionId) {
    await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
  }

  const { documentDifferences, fullDocumentA, fullDocumentB, geisingerConversationA, geisingerConversationB } = state;

  if (!documentDifferences || !fullDocumentA || !fullDocumentB) {
    console.error(`❌ [generateDifferencesSpreadsheetNode] Missing required data for spreadsheet generation`);
    progressResponse = progressResponse.replace("⏳", "❌");
    if (state.chatInteractionId) {
      await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
    }
    return {
      ...state,
      errorMessage: "Missing data for spreadsheet generation",
      progressResponse
    };
  }

  const startTime = Date.now();

  try {
    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GenAI Portal Document Comparison';
    workbook.created = new Date();

    // Define consistent styling
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFF' }, size: 11 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '366092' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
    };

    const cellStyle = {
      alignment: { vertical: 'top', wrapText: true },
      border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
    };

    // 1. Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Category', key: 'category', width: 25 },
      { header: 'Count', key: 'count', width: 15 },
      { header: 'Description', key: 'description', width: 60 }
    ];

    const summaryData = [
      {
        category: 'Document A Title',
        count: fullDocumentA.totalSections ?? 0,
        description: geisingerConversationA?.fileAName || fullDocumentA.title || 'Source document'
      },
      {
        category: 'Document B Title',
        count: fullDocumentB.totalSections ?? 0,
        description: geisingerConversationB?.fileAName || fullDocumentB.title || 'Target document'
      },
      {
        category: 'Only in Source',
        count: documentDifferences.summary?.onlyInSource || 0,
        description: 'Topics found in source but not in target'
      },
      {
        category: 'Also in Target',
        count: documentDifferences.summary?.alsoInTarget || 0,
        description: 'Topics found in both documents'
      },
      {
        category: 'New in Target',
        count: documentDifferences.summary?.newInTarget || 0,
        description: 'Topics found only in target document'
      },
      {
        category: 'Total Comparisons',
        count: documentDifferences.summary?.total || 0,
        description: 'Total number of topics analyzed'
      }
    ];

    summarySheet.addRows(summaryData);
    summarySheet.getRow(1).eachCell(cell => { cell.style = headerStyle; });
    summarySheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell(cell => { cell.style = cellStyle; });
      }
    });

    // 2. Detailed Comparison Results Sheet
    const resultsSheet = workbook.addWorksheet('Comparison Results');
    resultsSheet.columns = [
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Source Title', key: 'sourceTitle', width: 35 },
      { header: 'Source Page', key: 'sourcePage', width: 12 },
      { header: 'Source Summary', key: 'sourceSummary', width: 45 },
      { header: 'Target Title', key: 'targetTitle', width: 35 },
      { header: 'Target Page', key: 'targetPage', width: 12 },
      { header: 'Target Summary', key: 'targetSummary', width: 45 },
      { header: 'Difference Analysis', key: 'analysis', width: 50 },
      { header: 'LLM Difference Analysis', key: 'llmDiff', width: 60 }
    ];

    if (documentDifferences.results && Array.isArray(documentDifferences.results)) {
      const resultsData = documentDifferences.results.map(result => ({
        category: result.category === 'only-in-source' ? 'Only in Source' : result.category === 'also-in-target' ? 'Also in Target' : 'New in Target',
        sourceTitle: result.sourceTitle || 'N/A',
        sourcePage: typeof result.sourcePage === 'number' ? result.sourcePage : (typeof result.sourceSectionPage === 'number' ? result.sourceSectionPage : ''),
        sourceSummary: result.sourceSummary || 'N/A',
        targetTitle: result.targetTitle || 'N/A',
        targetPage: typeof result.targetPage === 'number' ? result.targetPage : (typeof result.targetSectionPage === 'number' ? result.targetSectionPage : ''),
        targetSummary: result.targetSummary || 'N/A',
        analysis: result.analysis || '',
        llmDiff: result.llmDiff || ''
      }));

      resultsSheet.addRows(resultsData);
    }

    resultsSheet.getRow(1).eachCell(cell => { cell.style = headerStyle; });
    resultsSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell(cell => { cell.style = cellStyle; });

        // Color code by category
        const categoryCell = row.getCell('category');
        const category = categoryCell.value;
        if (category === 'Also in Target') {
          categoryCell.style = { ...cellStyle, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'C6EFCE' } } };
        } else if (category === 'Only in Source') {
          categoryCell.style = { ...cellStyle, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC7CE' } } };
        } else if (category === 'New in Target') {
          categoryCell.style = { ...cellStyle, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEB9C' } } };
        }
      }
    });

    // Set column widths for readability
    resultsSheet.columns.forEach(col => {
      col.width = Math.max(col.width || 15, 15);
    });

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `document-comparison-${timestamp}.xlsx`;
    const tempFilePath = path.join(os.tmpdir(), fileName);

    // Write the file
    await workbook.xlsx.writeFile(tempFilePath);

    const generationTime = Date.now() - startTime;
    // Mark spreadsheet complete
    progressResponse = progressResponse.replace("⏳ Generating", "✓ Generating");
    progressResponse += "⏳ Uploading spreadsheet to blob storage...\n\n---\n";
    if (state.chatInteractionId) {
      await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
    }

    return {
      ...state,
      spreadsheetPath: tempFilePath,
      spreadsheetFileName: fileName,
      progressResponse
    };
  } catch (error) {
    console.error(`❌ [generateDifferencesSpreadsheetNode] Excel generation failed:`, error);
    progressResponse = progressResponse.replace("⏳", "❌");
    if (state.chatInteractionId) {
      await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
    }
    return {
      ...state,
      errorMessage: `Spreadsheet generation failed: ${error.message}`,
      progressResponse
    };
  }
};