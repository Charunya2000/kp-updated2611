import { cloneIndexDataForSmartNote, cloneSmartNoteFromTemplate, selectSmartNote, updateSmartNote } from "@/app/services/smartNoteService";
import { smartNoteStatus } from "@/utils/constants";
import { NextResponse } from "next/server";
import { createJob, deleteJob, updateJob } from "@/app/services/backgroundJobService";

export const POST = async (req, { params }) => {
  try {
    const { teamName, assistantName, templateId } = await params;
    const template = await req.json();

    const snQuery = {
      id: { $exists: true }, // we don't know the ID yet
      type: 'SmartNote',
      parentId: templateId,
      assistantName: assistantName,
      teamName: teamName
    }

    // See if the user has already cloned this template
    let smartNote = await selectSmartNote(snQuery, teamName);
    if (smartNote) {
      return NextResponse.json({ error: smartNote.error, title: smartNote.title, status: 409 }, { status: 409 });
    }

    smartNote = await cloneSmartNoteFromTemplate(templateId, teamName);
    const job = await createJob(teamName, `CloneSmartNote_${smartNote.id}`, {
      smartNoteId: smartNote.id,
      status: smartNoteStatus.Cloning,
      indexesCloned: null,
      indexesTotal: null,
      indexDocumentsCloned: null,
      indexDocumentsTotal: null
    });

    if (smartNote) {
      cloneIndexDataForSmartNote(smartNote, job.id).then(sn => {
        updateSmartNote({ ...sn, status: smartNoteStatus.Ready }, teamName);
        updateJob(teamName, job.id, { status: smartNoteStatus.Ready });
      }).catch((error) => {
        updateSmartNote({ ...smartNote, status: smartNoteStatus.Error }, teamName);
        updateJob(teamName, job.id, { status: smartNoteStatus.Error });
        console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'cloneIndexDataForSmartNote', detail: { message: `Error cloning index data for ${smartNote.id}`, error: error } } }));
      });
    }

    return NextResponse.json({ smartNote, jobId: job.id }, { status: 200 });
  }
  catch (error) {
    console.error('Error cloning Smart Note:', error);
    return NextResponse.json({ error: 'Failed to clone Smart Note', status: 500 }, { status: 500 });
  }
}