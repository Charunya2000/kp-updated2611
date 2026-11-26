import { v4 as uuidv4 } from 'uuid';



export async function saveAdminText({ nuid, text }) {
  try {
    const response = await fetch('/api/bcs/bcschatbot/bcsadmin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: uuidv4(), nuid, text }),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getAdminText(nuid) {
  try {
    const response = await fetch(`/api/bcs/bcschatbot/bcsadmin?nuid=${encodeURIComponent(nuid)}`);
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: error.message };
  }
}


