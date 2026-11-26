// qTest Search Service (v2) — Mongo-backed search via /api/qtest-search/search
const BASE = '/api/qtest-search/search';

/**
 * Fetch the list of available qTest projects.
 * @param {string} q - Optional partial name filter
 * @param {number} limit - Max results (default 200)
 */
export async function searchQTestProjects(q = '', limit = 200) {
  const params = new URLSearchParams({ limit });
  if (q) params.set('q', q);
  const res = await fetch(`${BASE}/projects?${params}`);
  if (!res.ok) throw new Error(`Failed to load projects: HTTP ${res.status}`);
  return res.json(); // { projects: [{ projectId, name, testCaseCount, ... }] }
}

/**
 * Search test cases within a project.
 * @param {object} options
 * @param {string} options.query - Free-text search query
 * @param {object} options.filters - SearchFiltersModel; project_id is required
 * @param {string} options.mode - "similar" | "contains" | "exact" (default: "similar")
 * @param {number} options.limit - Results per page (default: 25)
 * @param {number} options.offset - Page offset (default: 0)
 */
export async function searchTestCases({ query = '', filters = {}, mode = 'similar', limit = 25, offset = 0 }) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, filters, mode, limit, offset }),
  });
  if (!res.ok) throw new Error(`Search failed: HTTP ${res.status}`);
  return res.json(); // { query, limit, offset, total, results: [...] }
}

/**
 * Fetch full testcase detail by project and qTest ID.
 * @param {number} projectId
 * @param {number} qtestId
 */
export async function getQTestCaseDetail(projectId, qtestId) {
  const res = await fetch(`${BASE}/testcases/${projectId}/${qtestId}`);
  if (!res.ok) throw new Error(`Testcase not found: HTTP ${res.status}`);
  return res.json();
}

/**
 * Fetch module tree for a project (one level at a time).
 * @param {number} projectId
 * @param {number|null} parentId - Omit for root modules
 */
export async function getQTestProjectModules(projectId, parentId = null) {
  const url = parentId != null
    ? `${BASE}/projects/${projectId}/modules?parent_id=${parentId}`
    : `${BASE}/projects/${projectId}/modules`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load modules: HTTP ${res.status}`);
  return res.json(); // { project_id, parent_id, modules: [...] }
}
