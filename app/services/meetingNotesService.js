// 'use server';

// import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
// import { setProcessEnvironment } from '../../scripts/configActions.js';
// import { chatCompletionOne } from './chatCompletionsService.js';

// const configNode = async (_, { sendEvent }) => {
//   console.log(`-----configNode-----`);
//   await setProcessEnvironment();
//   return {};
// };

// const provideTemplateNode = async (state, { sendEvent }) => {
//   console.log(`-----provideTemplateNode-----`);
//   const template = {
//     agenda: [
//       "Introductions",
//       "Review Agenda",
//       "Conduct Meeting",
//       "Review Action Items"
//     ],
//     meetingType: state.meetingType
//   };
//   sendEvent({ type: 'template', template });
//   return { template };
// };

// const introductionsNode = async (state, { sendEvent }) => {
//   console.log(`-----introductionsNode-----`);
//   sendEvent({ type: 'interaction', displayType: 'textfield', prompt: 'Please introduce yourself and your role.' });
//   await chatCompletionOne({
//     messages: [{ role: 'system', content: 'Please introduce yourself and your role.' }],
//     onData: (data) => sendEvent({ type: 'data', data })
//   });
//   return {};
// };

// const reviewAgendaNode = async (state, { sendEvent }) => {
//   console.log(`-----reviewAgendaNode-----`);
//   sendEvent({ type: 'interaction', displayType: 'confirmation', prompt: `Review the following agenda: ${state.template.agenda.join(', ')}` });
//   await chatCompletionOne({
//     messages: [{ role: 'system', content: `Review the following agenda: ${state.template.agenda.join(', ')}` }],
//     onData: (data) => sendEvent({ type: 'data', data })
//   });
//   return {};
// };

// const conductMeetingNode = async (state, { sendEvent }) => {
//   console.log(`-----conductMeetingNode-----`);
//   sendEvent({ type: 'interaction', displayType: 'textfield', prompt: 'Please conduct the meeting and take notes.' });
//   await chatCompletionOne({
//     messages: [{ role: 'system', content: 'Please conduct the meeting and take notes.' }],
//     onData: (data) => sendEvent({ type: 'data', data })
//   });
//   return {};
// };

// const reviewActionItemsNode = async (state, { sendEvent }) => {
//   console.log(`-----reviewActionItemsNode-----`);
//   sendEvent({ type: 'interaction', displayType: 'textfield', prompt: 'Review the action items from the meeting.' });
//   await chatCompletionOne({
//     messages: [{ role: 'system', content: 'Review the action items from the meeting.' }],
//     onData: (data) => sendEvent({ type: 'data', data })
//   });
//   return {};
// };

// const StateAnnotation = Annotation.Root({
//   meetingType: Annotation,
//   template: Annotation,
//   introductions: Annotation,
//   reviewedAgenda: Annotation,
//   meetingNotes: Annotation,
//   actionItems: Annotation
// });

// const graphBuilder = new StateGraph(StateAnnotation);

// const graph = graphBuilder
//   .addNode("configNode", configNode)
//   .addNode("provideTemplateNode", provideTemplateNode)
//   .addNode("introductionsNode", introductionsNode)
//   .addNode("reviewAgendaNode", reviewAgendaNode)
//   .addNode("conductMeetingNode", conductMeetingNode)
//   .addNode("reviewActionItemsNode", reviewActionItemsNode)
//   .addEdge(START, "configNode")
//   .addEdge("configNode", "provideTemplateNode")
//   .addEdge("provideTemplateNode", "introductionsNode")
//   .addEdge("introductionsNode", "reviewAgendaNode")
//   .addEdge("reviewAgendaNode", "conductMeetingNode")
//   .addEdge("conductMeetingNode", "reviewActionItemsNode")
//   .addEdge("reviewActionItemsNode", END)
//   .compile();

// export async function takeMeetingNotes({ meetingType, sendEvent }) {
//   const { result } = await graph.invoke({
//     meetingType: meetingType
//   }, { sendEvent });
//   console.log(`\nresult: ${JSON.stringify(result)}`);
//   return result;
// }