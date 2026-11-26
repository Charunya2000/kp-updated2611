export const getAllChatCompletionConfigss = async (teamName, assistantName) => {

  try {
    const response = await fetch(`/api/admin/${teamName}/${assistantName}/chat-completion`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching chat completions:', error);
    throw error;
  }

}

export const getChatCompletionConfigsById = async (id, teamName, assistantName) => {

  try {
    const response = await fetch(`/api/admin/${teamName}/${assistantName}/chat-completion/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching chat completion by ID:', error);
    throw error;
  }
}

export const createChatCompletionConfigs = async (chatCompletionData, teamName, assistantName) => {

  try {
    const response = await fetch(`/api/admin/${teamName}/${assistantName}/chat-completion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chatCompletionData),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating completion:', error);
    throw error;
  }
}

export const updateChatCompletionConfigs = async (chatCompletionData, teamName, assistantName) => {
  try {
    const response = await fetch(`/api/admin/${teamName}/${assistantName}/chat-completion/${chatCompletionData.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chatCompletionData),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating chat completion:', error);
    throw error;
  }
}

export const deleteChatCompletionConfigs = async (chatCompletionData, teamName, assistantName) => {

  try {

    const response = await fetch(`/api/admin/${teamName}/${assistantName}/chat-completion/${chatCompletionData.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting chat completion:', error);
    throw error;
  }
}