import { NextResponse } from 'next/server';
import { selectSmartNote, updateSmartNote } from '@services/smartNoteService';

export async function PUT(req, { params }) {
  try {
    const { smartNoteId, teamName, assistantName } = await params;
    // Always set updatedAt to now
    const updateData = { updatedAt: new Date().toISOString() };
    // Fetch the existing smart note
    const query = { type: 'SmartNote', id: smartNoteId, parentId: { $exists: true } };
    const smartNote = await selectSmartNote(query, teamName);
    if (!smartNote) {
      return NextResponse.json({ error: 'SmartNote not found' }, { status: 404 });
    }
    // Merge and update
    const updatedSmartNote = { ...smartNote, ...updateData };
    const result = await updateSmartNote(updatedSmartNote, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
