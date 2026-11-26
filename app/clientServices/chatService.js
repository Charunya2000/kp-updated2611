'use client';

export const createChat = async (teamName, assistantName, chat) => {
  let insertedChat = null;
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${chat.parentId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chat),
    });
    insertedChat = await result.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
  return insertedChat;
};

export const getChats = async (teamName, assistantName, smartNote) => {
  let chats = null;
  try {
    const result = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/chat`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    chats = await result.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
  return chats;
};
