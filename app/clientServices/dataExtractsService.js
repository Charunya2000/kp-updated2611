'use client';

export async function exportUserNuidsCsv() {
  const response = await fetch('/api/admin/data-extracts/user-nuids', {
    method: 'GET',
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to export user NUIDs.');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `user-nuids-${timestamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
