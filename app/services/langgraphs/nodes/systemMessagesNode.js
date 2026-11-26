'use server';

import { selectSmartNote } from '@services/smartNoteService';

const getSystemContent = async (smartNoteId) => {
  const query = { type: 'SmartNote', parentId: { $exists: true }, id: smartNoteId }
  const smartNote = await selectSmartNote(query);
  if (smartNote.selectedUserAssistant === 'kpmc-assistant') {
    switch (smartNote.persona) {
      case 'Business': {
        return 'You are a business user with domain expertise and work within an Agile software delivery life cycle.';
      }
      case 'Planning': {
        return 'You are an iteration planning member defining user stories for the next sprint and work within an Agile software delivery life cycle.';
      }
      case 'Architecture': {
        return 'You are an architect, helping development teams with technical design and work within an Agile software delivery life cycle.';
      }
      case 'Development': {
        return 'You are a developer and your job is to understand requirements and implement a solution working within an Agile software delivery life cycle.';
      }
      case 'Testing': {
        return 'You are a tester and your job is to create test cases and automated tests working within an Agile software delivery life cycle.';
      }
      default: {
        return 'You are an expert in Agile product management.';
      }
    }
  } else {
    return 'You are an expert in Agile product management.';
  }
};

export const systemMessagesNode = async (state) => {
  const systemMessage = await getSystemContent(state.smartNoteId);
  const query = { type: 'SmartNote', parentId: { $exists: true }, id: state.smartNoteId }
  const smartNote = await selectSmartNote(query);
  return { systemMessage, assistant: smartNote.selectedUserAssistant, persona: smartNote.persona };
};
