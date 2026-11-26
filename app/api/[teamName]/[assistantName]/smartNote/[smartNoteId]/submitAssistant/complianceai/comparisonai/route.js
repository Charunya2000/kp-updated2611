'use server';

import { findGeisingerComparisonsByInferredLobAndStatus } from '@/app/services/langgraphs/compliance/docConversationService3.js';
import { NextResponse } from 'next/server';
import { getServerSession } from '@utils/getSession';
import { runComplianceComparisonWithRouting } from '@/app/services/langgraphs/compliance/complianceRuntimeRouterService';

export async function GET(req, { params }) {
  try {
    const { searchParams } = new URL(req.url);
    const routeParams = await params;
    const teamName = routeParams?.teamName;
    const lob = searchParams.get('lob');
    const status = searchParams.get('status');
    console.log(`Received request to fetch Geisinger comparisons for team: ${teamName}, lob: ${lob}, status: ${status}`);
    if (!lob) {
      return NextResponse.json({ error: 'Missing required query parameter: lob' }, { status: 400 });
    }
    const jobs = await findGeisingerComparisonsByInferredLobAndStatus(teamName, lob, status || undefined);
    return NextResponse.json(jobs, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const request = await req.json();
    const routeParams = await params;
    const { nuid } = await getServerSession();
    // Extract chatInteractionId from request to pass to graph for progress tracking
    const teamName = request?.teamName || routeParams?.teamName;
    const assistantName = request?.assistantName || routeParams?.assistantName;
    const smartNoteId = request?.smartNoteId || routeParams?.smartNoteId;
    const { geisingerComparison, smartNote, sources, chatId, chatInteractionId, prompt, comparisonMode } = request;

    const result = await runComplianceComparisonWithRouting({
      nuid,
      teamName,
      assistantName,
      smartNoteId,
      chatInteractionId,
      geisingerComparison,
      sources,
      chatId,
      prompt,
      comparisonMode,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    const status = Number(error?.statusCode) || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
