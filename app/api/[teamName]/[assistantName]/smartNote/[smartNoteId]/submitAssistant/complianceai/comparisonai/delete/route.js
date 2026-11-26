import { NextResponse } from 'next/server';
import { deleteGeisingerComparisonByLobFileAFileB } from '@services/langgraphs/compliance/complianceComparisonService2';

export async function DELETE(req, { params }) {
  try {
    const routeParams = await params;
    const teamName = routeParams?.teamName;
    const assistantName = routeParams?.assistantName;
    const body = await req.json();
    const { lob, comparisonType, geisingerConversationAId: fileAId, geisingerConversationBId: fileBId } = body;
    console.log(`Received request to delete GeisingerComparison for team: ${teamName}, assistant: ${assistantName}, lob: ${lob}, fileAId: ${fileAId}, fileBId: ${fileBId}`);
    const result = await deleteGeisingerComparisonByLobFileAFileB(teamName, lob, comparisonType, fileAId, fileBId);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
