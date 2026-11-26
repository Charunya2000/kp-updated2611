export const patchSmartNoteTitle = async (teamName, assistantName, smartNote, title) => {
  const query = { type: 'SmartNote', title: title, parentId: smartNote.parentId };
  const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(query),
  });
  return await result.json();
};

// export const deleteSmartNote = async (teamName, assistantName, smartNote) => {
//   const chatHistories = await fetch(`api/smartNote/${smartNote.id}/chatHistory`, {
//     method: 'GET',
//     headers: {
//       'Content-Type': 'application/json',
//     }
//   });
//   await Promise.all(chatHistories.map(async chatHistory => {
//     const chats = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/chatHistory/${chatHistory.id}/chat`, {
//       method: 'GET',
//       headers: {
//         'Content-Type': 'application/json',
//       }
//     });
//     await Promise.all(chats.map(async chat => {
//       const chatInteractions = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/chatHistory/${chatHistory.id}/chat${chat.id}/chatInteractions`, {
//         method: 'GET',
//         headers: {
//           'Content-Type': 'application/json',
//         }
//       });
//       await Promise.all(chatInteractions.map(async chatInteraction => {
//         await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/chatHistory/${chatHistory.id}/chat/${chat.id}/chatInteraction/${chatInteraction.id}/suggestedPrompts`, {
//           method: 'DELETE',
//           headers: {
//             'Content-Type': 'application/json',
//           }
//         });
//       }));
//       await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/chatHistory/${chatHistory.id}/chat/${chat.id}/chatInteraction`, {
//         method: 'DELETE',
//         headers: {
//           'Content-Type': 'application/json',
//         }
//       });
//     }));
//     await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/chatHistory/${chatHistory.id}/chat`, {
//       method: 'DELETE',
//       headers: {
//         'Content-Type': 'application/json',
//       }
//     });
//   }));
//   await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/chatHistory`, {
//     method: 'DELETE',
//     headers: {
//       'Content-Type': 'application/json',
//     }
//   });
//   await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/designReference`, {
//     method: 'DELETE',
//     headers: {
//       'Content-Type': 'application/json',
//     }
//   });
//   await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/jiraIssue`, {
//     method: 'DELETE',
//     headers: {
//       'Content-Type': 'application/json',
//     }
//   });
//   await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/savedNote`, {
//     method: 'DELETE',
//     headers: {
//       'Content-Type': 'application/json',
//     }
//   });
//   await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/savedResponse`, {
//     method: 'DELETE',
//     headers: {
//       'Content-Type': 'application/json',
//     }
//   });
//   await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/source`, {
//     method: 'DELETE',
//     headers: {
//       'Content-Type': 'application/json',
//     }
//   });
//   await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/uploadedDocument`, {
//     method: 'DELETE',
//     headers: {
//       'Content-Type': 'application/json',
//     }
//   });
//   await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}`, {

//     method: 'DELETE',
//     headers: {
//       'Content-Type': 'application/json',
//     }
//   });
//   await fetch(`/api/${teamName}/${assistantName}/smartNote/template/${smartNote.id}`, {
//     method: 'DELETE',
//     headers: {
//       'Content-Type': 'application/json',
//     }
//   });
//   const result = {
//     "acknowledged": true,
//     "deletedCount": 1
//   };
//   return await result.json();
// };
