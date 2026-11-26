import fs from 'node:fs/promises';
import path from 'node:path';

const defaultInput = path.join('docs', 'rcnoa', 'RCNO-RCNA-EPDS-MDW-TestCases.json');
const defaultOutput = path.join('docs', 'rcnoa', 'RCNO-RCNA-EPDS-MDW-TestCases.html');

const inputPath = process.argv[2] || defaultInput;
const outputPath = process.argv[3] || defaultOutput;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function renderScalar(value) {
  if (value === null) return '<span class="muted">null</span>';
  if (value === undefined) return '<span class="muted">undefined</span>';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return escapeHtml(value);
}

function renderArray(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return '<p class="muted">None</p>';
  }

  const allObjects = values.every((item) => isPlainObject(item));
  if (allObjects) {
    const keys = [...new Set(values.flatMap((item) => Object.keys(item)))];
    return `
      <table>
        <thead>
          <tr>${keys.map((key) => `<th>${escapeHtml(key)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${values.map((item) => `<tr>${keys.map((key) => `<td>${renderValue(item[key])}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    `;
  }

  return `<ol>${values.map((item) => `<li>${renderValue(item)}</li>`).join('')}</ol>`;
}

function renderObject(obj) {
  const keys = Object.keys(obj || {});
  if (keys.length === 0) {
    return '<p class="muted">None</p>';
  }

  return `
    <table>
      <thead>
        <tr><th style="width: 260px;">Field</th><th>Value</th></tr>
      </thead>
      <tbody>
        ${keys.map((key) => `<tr><td class="field">${escapeHtml(key)}</td><td>${renderValue(obj[key])}</td></tr>`).join('')}
      </tbody>
    </table>
  `;
}

function renderValue(value) {
  if (Array.isArray(value)) return renderArray(value);
  if (isPlainObject(value)) return renderObject(value);
  return renderScalar(value);
}

function renderFieldSchemas(fieldSchemas = {}) {
  const keys = Object.keys(fieldSchemas);
  return keys.map((key) => {
    const value = fieldSchemas[key];
    return `
      <section class="card">
        <h3>${escapeHtml(key)}</h3>
        ${renderValue(value)}
      </section>
    `;
  }).join('');
}

function renderTemplates(templates = {}) {
  return Object.entries(templates).map(([name, data]) => `
    <section class="card">
      <h3>${escapeHtml(name)}</h3>
      ${renderValue(data)}
    </section>
  `).join('');
}

function renderTestCase(testCase, index) {
  const statusClass = String(testCase?.expected?.outcome || '').toLowerCase().includes('error')
    || String(testCase?.expected?.outcome || '').toLowerCase().includes('blocking')
    ? 'badge bad'
    : 'badge good';

  return `
    <section class="card page-break">
      <h2>${index + 1}. ${escapeHtml(testCase.id || 'Unnamed test case')}</h2>
      <p><strong>Scenario:</strong> ${escapeHtml(testCase.scenario || '')}</p>
      <p><strong>Expected outcome:</strong> <span class="${statusClass}">${escapeHtml(testCase?.expected?.outcome || 'n/a')}</span></p>

      <h3>Input</h3>
      ${renderValue(testCase.input || {})}

      <h3>Expected</h3>
      ${renderValue(testCase.expected || {})}
    </section>
  `;
}

function buildHtml(data) {
  const notes = Array.isArray(data?.notes) ? data.notes : [];
  const testCases = Array.isArray(data?.testCases) ? data.testCases : [];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(data?.document || 'RCNO RCNA Test Cases')}</title>
  <style>
    body {
      font-family: Calibri, Arial, sans-serif;
      margin: 24px;
      color: #1f2937;
      line-height: 1.35;
      font-size: 11pt;
      background: #ffffff;
    }
    h1, h2, h3 { margin: 0 0 10px 0; color: #0f3d75; }
    h1 { font-size: 22pt; margin-bottom: 8px; }
    h2 { font-size: 16pt; margin-top: 12px; }
    h3 { font-size: 12pt; margin-top: 10px; }
    p { margin: 8px 0; }
    ul, ol { margin: 6px 0 6px 20px; }
    .muted { color: #6b7280; }
    .card {
      border: 1px solid #d5deea;
      border-radius: 8px;
      padding: 14px;
      margin: 14px 0;
      background: #fbfdff;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0 12px 0;
      table-layout: fixed;
      word-wrap: break-word;
    }
    th, td {
      border: 1px solid #cfd8e3;
      padding: 6px 8px;
      vertical-align: top;
      text-align: left;
    }
    th {
      background: #eaf1f9;
      color: #143a63;
      font-weight: 700;
    }
    td.field {
      font-weight: 600;
      background: #f7fbff;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 10pt;
      font-weight: 700;
      border: 1px solid;
    }
    .badge.good {
      color: #14532d;
      border-color: #86efac;
      background: #dcfce7;
    }
    .badge.bad {
      color: #7f1d1d;
      border-color: #fca5a5;
      background: #fee2e2;
    }
    .meta {
      margin: 6px 0 12px 0;
      padding: 10px;
      border-left: 4px solid #93c5fd;
      background: #f0f7ff;
    }
    .page-break {
      page-break-inside: avoid;
    }
    @media print {
      body { margin: 0.4in; }
      .page-break { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(data?.document || 'RCNO RCNA Test Cases')}</h1>
  <div class="meta">
    <p><strong>Version:</strong> ${escapeHtml(data?.version || '')}</p>
    <p><strong>Generated from:</strong> ${escapeHtml(data?.generatedFrom || '')}</p>
    <p><strong>Total test cases:</strong> ${testCases.length}</p>
  </div>

  <section class="card">
    <h2>Notes</h2>
    ${notes.length ? `<ul>${notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>` : '<p class="muted">No notes</p>'}
  </section>

  <h2>Field Schemas</h2>
  ${renderFieldSchemas(data?.fieldSchemas || {})}

  <h2>Templates</h2>
  ${renderTemplates(data?.templates || {})}

  <h2>Test Cases</h2>
  ${testCases.map((tc, i) => renderTestCase(tc, i)).join('')}
</body>
</html>`;
}

async function main() {
  const raw = await fs.readFile(inputPath, 'utf8');
  const json = JSON.parse(raw);
  const html = buildHtml(json);
  await fs.writeFile(outputPath, html, 'utf8');

  console.log(`Rendered HTML: ${outputPath}`);
}

main().catch((error) => {
  console.error('Failed to render HTML from JSON:', error);
  process.exitCode = 1;
});
