export async function submitNps({ nuid, text }) {
  try {
    const response = await fetch('/api/nps/npschatbot/nps', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ nuid, text }),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: error.message };
  }
}
