import { selectSmartNote } from "../../../smartNoteService";

export const systemMessagesNode = async (state) => {
  const query = { type: 'SmartNote', parentId: { $exists: true }, id: state.smartNoteId }
  const smartNote = await selectSmartNote(query);
  const systemMessage = 'You are an expert in Agile product management.';
  return { systemMessage, assistant: smartNote.selectedUserAssistant, persona: smartNote.persona };
};