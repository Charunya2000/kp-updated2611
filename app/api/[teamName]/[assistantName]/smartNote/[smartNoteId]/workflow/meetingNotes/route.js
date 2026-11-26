'use server';

// import { NextResponse } from 'next/server';
// import { takeMeetingNotes } from '@services/meetingNotesService';

// export async function POST(req) {
//   try {
//     const { meetingType } = await req.json();

//     const headers = new Headers({
//       'Content-Type': 'text/event-stream',
//       'Cache-Control': 'no-cache',
//       'Connection': 'keep-alive',
//     });

//     const stream = new ReadableStream({
//       start(controller) {
//         const sendEvent = (data) => {
//           controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
//         };

//         takeMeetingNotes({ meetingType, sendEvent }).then((result) => {
//           controller.enqueue(`data: ${JSON.stringify({ type: 'end', result })}\n\n`);
//           controller.close();
//         }).catch((error) => {
//           controller.error(error);
//         });
//       },
//     });

//     return new NextResponse(stream, { headers });
//   } catch (error) {
//     console.error(error);
//     return NextResponse.json({ error: error.message }, { status: 500 });
//   }
// }