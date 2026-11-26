'use server';

import { NextResponse } from 'next/server';
import { getTeamAccess } from '@/app/services/permissionsService';
import { getCurrentUserNuid } from '@utils/getSession';
import { PERMISSIONS } from '@/app/config/permissions';
import ExcelJS from 'exceljs-hardened';

/**
 * POST /api/[teamName]/admin/approval-statistics/export
 *
 * Export approval statistics to Excel file
 */
export async function POST(req, { params }) {
  try {
    const { teamName } = await params;
    const body = await req.json();
    const { statistics, filters } = body;

    // Permission check
    const userNuid = await getCurrentUserNuid();
    const access = await getTeamAccess(teamName, userNuid);
    if (!access?.has(PERMISSIONS.APPROVAL_STATISTICS_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Create workbook
    const workbook = new ExcelJS.Workbook();

    // Add summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Filter Name', key: 'filterName', width: 30 },
      { header: 'Value', key: 'value', width: 50 }
    ];

    // Add filter information
    if (filters) {
      if (filters.assistantName) {
        summarySheet.addRow({ filterName: 'Assistant', value: filters.assistantName });
      }
      if (filters.nuid) {
        summarySheet.addRow({ filterName: 'NUID', value: filters.nuid });
      }
      if (filters.dateRangeStart) {
        summarySheet.addRow({ filterName: 'Date From', value: filters.dateRangeStart });
      }
      if (filters.dateRangeEnd) {
        summarySheet.addRow({ filterName: 'Date To', value: filters.dateRangeEnd });
      }
      if (filters.feedbackStatus !== undefined) {
        const statusLabel =
          filters.feedbackStatus === 1 || filters.feedbackStatus === '1'
            ? 'Approved'
            : filters.feedbackStatus === 0 || filters.feedbackStatus === '0'
              ? 'Disapproved'
              : 'No Feedback';
        summarySheet.addRow({ filterName: 'Feedback Status', value: statusLabel });
      }
    }

    // Add export date
    summarySheet.addRow({ filterName: 'Export Date', value: new Date().toISOString() });

    // Add statistics sheet
    const statsSheet = workbook.addWorksheet('Statistics');
    statsSheet.columns = [
      { header: 'Assistant', key: 'assistant', width: 20 },
      { header: 'NUID', key: 'nuid', width: 15 },
      { header: 'Feedback', key: 'feedback', width: 12 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Count', key: 'count', width: 10 },
      { header: 'Avg Feedback', key: 'avgFeedback', width: 15 }
    ];

    // Add data rows
    if (Array.isArray(statistics)) {
      statistics.forEach(stat => {
        const feedbackLabel =
          stat._id.feedback === 1 ? 'Approved' :
          stat._id.feedback === 0 ? 'Disapproved' :
          'No Feedback';

        statsSheet.addRow({
          assistant: stat._id.assistantName,
          nuid: stat._id.nuid,
          feedback: feedbackLabel,
          date: stat._id.date,
          count: stat.count,
          avgFeedback: stat.avgFeedback ? stat.avgFeedback.toFixed(2) : 'N/A'
        });
      });
    }

    // Format header rows
    [summarySheet, statsSheet].forEach(sheet => {
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF366092' }
      };
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Return as downloadable file
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="approval-statistics-${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'exportApprovalStatistics',
        detail: { error: error.message }
      }
    }));

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
