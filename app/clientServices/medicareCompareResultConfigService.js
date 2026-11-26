'use client';

export async function getMedCompareResultConfig(teamName) {
  const res = await fetch(`/api/admin/${teamName}/medicare-compare-result-config`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  return await res.json();
}

export async function saveMedCompareResultConfig(teamName, config) {
  const res = await fetch(`/api/admin/${teamName}/medicare-compare-result-config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return await res.json();
}
