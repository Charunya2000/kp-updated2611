'use client';

export async function getMedicareQuery(teamName, queryKey) {
  const res = await fetch(
    `/api/admin/${teamName}/medicare-query?queryKey=${encodeURIComponent(queryKey)}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    },
  );
  return await res.json();
}

export async function saveMedicareQuery(teamName, queryKey, content) {
  const res = await fetch(`/api/admin/${teamName}/medicare-query`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queryKey, content }),
  });
  return await res.json();
}

export async function testMedicareQuery(teamName, queryKey, sql, targetDatabase, bindParams = {}) {
  const res = await fetch(`/api/admin/${teamName}/medicare-query/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queryKey, sql, targetDatabase, bindParams }),
  });
  return await res.json();
}
