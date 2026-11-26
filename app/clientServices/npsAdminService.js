import { v4 as uuidv4 } from 'uuid';



export async function saveAdminText({ nuid, text }) {
  try {
    const response = await fetch('/api/nps/npschatbot/npsadmin', {
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
    const response = await fetch(`/api/nps/npschatbot/npsadmin?nuid=${encodeURIComponent(nuid)}`);
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: error.message };
  }
}


// ── Data Load functions 
//Added as part of NPS release - April 4/14/26 Start


export async function triggerIncidentDataLoad(sinceDate) {
  try {

    const response = await fetch('/api/nps/npschatbot/serviceNowDataLoad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sinceDate: sinceDate }),
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function triggerUserStoryLoad(sinceDate) {
  try {
    const response = await fetch('/api/nps/npschatbot/userStoryDataLoad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sinceDate ? { sinceDate } : {}),
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function triggerSharepointLoad(sinceDate) {
  try {
    const response = await fetch('/api/nps/npschatbot/sharepointDataLoad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sinceDate ? { sinceDate } : {}),
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function validateConfluencePages(rootPageIds) {
  try {
    const response = await fetch('/api/nps/npschatbot/confluenceDataLoad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rootPageIds, validate: true }),
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function triggerConfluenceLoad(rootPageIds) {
  try {
    const response = await fetch('/api/nps/npschatbot/confluenceDataLoad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rootPageIds }),
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function triggerScoreCardLoad() {
  try {
    const response = await fetch('/api/nps/npschatbot/scorecard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }

    });
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
}


export async function triggerReleaseNotesLoad(sinceDate) {
  try {
    const response = await fetch('/api/nps/npschatbot/releaseNotesDataLoad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sinceDate ? { sinceDate } : {}),
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
}
//Added as part of NPS release - April 4/14/26 End