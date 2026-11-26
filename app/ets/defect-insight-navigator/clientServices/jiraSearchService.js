const API_BASE = '/api/ets/defect-insight-navigator';
const NO_STORE = { cache: 'no-store' };

function normalizeErrorMessage(path, status, json, rawText) {
  const detail = json?.detail;
  const candidates = [
    json?.error,
    json?.message,
    typeof detail === 'string' ? detail : null,
    detail?.error,
    detail?.message,
  ].filter(Boolean);

  if (candidates.length) return String(candidates[0]);

  if (rawText && typeof rawText === 'string') {
    const cleaned = rawText.replace(/\s+/g, ' ').trim();
    if (cleaned) return cleaned.slice(0, 260);
  }

  return `${path} failed (${status})`;
}

async function parseResponse(res, path) {
  const rawText = await res.text();
  let json = {};
  if (rawText) {
    try {
      json = JSON.parse(rawText);
    } catch {
      json = {};
    }
  }

  if (!res.ok) {
    const message = normalizeErrorMessage(path, res.status, json, rawText);
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  if (Object.keys(json).length > 0) return json;
  return rawText ? { message: rawText } : {};
}

async function post(path, payload) {
  const res = await fetch(`${API_BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    ...NO_STORE,
  });
  return parseResponse(res, path);
}

async function get(path) {
  const res = await fetch(`${API_BASE}/${path}`, { ...NO_STORE });
  return parseResponse(res, path);
}

export const searchRca = (payload) => post('rca', payload);
export const summarizeRca = (payload) => post('rca-summary', payload);
export const runRcaAnalytics = (payload) => post('rca-analytics', payload);
export const submitFeedback = (payload) => post('feedback', payload);
export const fetchHealth = () => get('health');
export const fetchConfigSummary = () => get('config-summary');
export const fetchTeamInsights = (teamId) => get(`team-insights/${teamId}`);
