import { selectCacControlReportsByTargetDatabase } from '@/app/services/cacControlReportService';
import { NextResponse } from 'next/server';

function getDefaultTargetDatabase() {
  const envName = process.env.envName || 'dev';
  if (envName === 'dev') {
    return 'dev';
  }
  if (envName === 'uat') {
    return 'uat';
  }
  return 'default';
}

export async function GET(req, { params }) {

  try {
    const { searchParams } = new URL(req.url);
    const { teamName, assistantName } = await params;
    const dataset = searchParams.get('dataset');
    const targetDatabase = searchParams.get('targetDatabase') || getDefaultTargetDatabase();
    const results = await selectCacControlReportsByTargetDatabase(teamName, dataset, targetDatabase);

    if (!results || results.length === 0) {
      return new Response('No reports found', { status: 404 });
    }

    return NextResponse.json(results, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Failed to get the latest report:', error);
    return new Response('Failed to get report', { status: 500 });
  }
}