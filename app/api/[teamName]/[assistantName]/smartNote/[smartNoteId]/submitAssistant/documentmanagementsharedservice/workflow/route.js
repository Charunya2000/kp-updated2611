'use server';

import { NextResponse } from 'next/server';
// import { getSourcesBySmartNoteId } from '@/app/services/sourceService';
// import { selectRelatedUploadedDocuments } from '@/app/services/actualSourcesService';
import { submitPromptDMSS } from '@/app/services/langgraphs/dmss/dmssAssistantGraphService';
import { getServerSession } from '@/utils/getSession';

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;
    const { formData, sources, chatInteraction } = await req.json();
    const { nuid } = await getServerSession();

    const stream = await submitPromptDMSS({ nuid, smartNoteId, sources, chatInteraction, teamName, assistantName, formData, isWorkflow: true });

    return new NextResponse(stream, {
      headers: { 'Content-Type': 'text/event-stream' }
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// const getSelectedSources = async (smartNoteId) => {
//   const sources = await getSourcesBySmartNoteId(smartNoteId);
//   const selectedSources = sources.filter(source => source.selected);

//   const lettersSource = selectedSources.filter(s => s.category === "Letter").map(s => s.sourceId);
//   const testCaseTemplateSource = selectedSources.filter(s => s.category === "Test Case Template").map(s => s.sourceId);
//   const uploadedNoteSource = selectedSources.filter(s => s.category === "Uploaded Note").map(s => s.sourceId);

//   const actualSources = await selectRelatedUploadedDocuments(smartNoteId);

//   return {
//     letters: lettersSource ? actualSources.filter(doc => lettersSource.includes(doc.id)) : null,
//     testCaseTemplates: testCaseTemplateSource ? actualSources.filter(doc => testCaseTemplateSource.includes(doc.id)) : null,
//     uploadedNotes: uploadedNoteSource ? actualSources.filter(doc => uploadedNoteSource.includes(doc.id)) : null,
//   }
// }