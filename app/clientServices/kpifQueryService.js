'use client';

export async function getKpifQuery(teamName, queryKey) {
  const res = await fetch(
    `/api/admin/${teamName}/kpif-query?queryKey=${encodeURIComponent(queryKey)}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    },
  );
  return await res.json();
}

export async function saveKpifQuery(teamName, queryKey, content) {
  const res = await fetch(`/api/admin/${teamName}/kpif-query`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queryKey, content }),
  });
  return await res.json();
}

export async function testKpifQuery(teamName, queryKey, sql, targetDatabase, bindParams = {}) {
  const res = await fetch(`/api/admin/${teamName}/kpif-query/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queryKey, sql, targetDatabase, bindParams }),
  });
  return await res.json();
}
