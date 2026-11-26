'use client';

// Get all application messages
export const getAllMessages = async () => {
  try {
    const result = await fetch(`/api/admin/messaging`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!result.ok) {
      const errorText = await result.text();
      return { error: `Failed to fetch messages: ${result.status} ${errorText}` };
    }

    const data = await result.json();
    return data;
  } catch (error) {
    console.error('Error fetching messages:', error);
    return { error: error.message };
  }
};

// Get a single message by ID
export const getMessageById = async (id) => {
  try {
    const result = await fetch(`/api/admin/messaging/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!result.ok) {
      const errorText = await result.text();
      return { error: `Failed to fetch message: ${result.status} ${errorText}` };
    }

    const data = await result.json();
    return data;
  } catch (error) {
    console.error('Error fetching message:', error);
    return { error: error.message };
  }
};

// Create a new application message
export const createMessage = async (messageData) => {
  try {
    const result = await fetch(`/api/admin/messaging`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messageData),
    });

    if (!result.ok) {
      const errorText = await result.text();
      return { error: `Failed to create message: ${result.status} ${errorText}` };
    }

    const data = await result.json();
    return data;
  } catch (error) {
    console.error('Error creating message:', error);
    return { error: error.message };
  }
};

// Update an existing message
export const updateMessage = async (id, messageData) => {
  try {
    const result = await fetch(`/api/admin/messaging/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messageData),
    });

    if (!result.ok) {
      const errorText = await result.text();
      return { error: `Failed to update message: ${result.status} ${errorText}` };
    }

    const data = await result.json();
    return data;
  } catch (error) {
    console.error('Error updating message:', error);
    return { error: error.message };
  }
};

// Delete a message
export const deleteMessage = async (id) => {
  try {
    const result = await fetch(`/api/admin/messaging/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!result.ok) {
      const errorText = await result.text();
      return { error: `Failed to delete message: ${result.status} ${errorText}` };
    }

    const data = await result.json();
    return data;
  } catch (error) {
    console.error('Error deleting message:', error);
    return { error: error.message };
  }
};

// Get active messages (for displaying to users)
export const getActiveMessages = async () => {
  try {
    const result = await fetch(`/api/admin/messaging/active`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return await result.json();
  } catch (error) {
    console.error('Error fetching active messages:', error);
    return { error: error.message };
  }
};
