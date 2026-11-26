import fs from 'node:fs/promises';
import path from 'node:path';

function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function normalizePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function parseArgs(argv = []) {
  const args = argv.slice(2);

  const getArg = (name, fallback = '') => {
    const idx = args.indexOf(name);
    return idx >= 0 ? String(args[idx + 1] || '').trim() : fallback;
  };

  const inputPath = getArg('--input');
  const outputPath = getArg('--output');
  const top = normalizePositiveInt(getArg('--top', '200'), 200);
  const overwrite = args.includes('--overwrite');

  if (!inputPath) {
    throw new Error('Missing required --input <adjudication.csv>');
  }

  return {
    inputPath,
    outputPath,
    top,
    overwrite,
  };
}

function parseCsvLine(line = '') {
  const out = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  out.push(current);
  return out;
}

function parseCsv(text = '') {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (!lines.length) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (text.includes('"') || text.includes(',') || text.includes('\n') || text.includes('\r')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows = [], headers = []) {
  const lines = [];
  lines.push(headers.map(csvEscape).join(','));

  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row?.[header] ?? '')).join(','));
  }

  return `${lines.join('\n')}\n`;
}

function suggestDisposition(row = {}) {
  const classification = normalizeString(row.classification).toLowerCase();
  const score = Number(row.materialityScore || 0);
  const reasonCodes = normalizeString(row.reasonCodes).toLowerCase();

  if (classification === 'conflict') {
    return { disposition: 'material', materiality: 'high', note: 'auto: conflict + modality/obligation shift' };
  }

  if (classification === 'partial' && score >= 90) {
    return { disposition: 'material', materiality: 'medium', note: 'auto: high-score partial; verify substantive delta' };
  }

  if (classification.startsWith('gap-') && reasonCodes.includes('timeline_presence_shift')) {
    return { disposition: 'needs-review', materiality: 'medium', note: 'auto: gap with timeline signal; check if merged/contained elsewhere' };
  }

  if (classification.startsWith('gap-')) {
    return { disposition: 'needs-review', materiality: 'low', note: 'auto: gap candidate; verify true novelty vs chunking artifact' };
  }

  return { disposition: 'needs-review', materiality: 'low', note: 'auto: requires reviewer validation' };
}

async function main() {
  const args = parseArgs(process.argv);
  const inputAbsolute = path.isAbsolute(args.inputPath)
    ? args.inputPath
    : path.resolve(process.cwd(), args.inputPath);

  const raw = await fs.readFile(inputAbsolute, 'utf8');
  const { headers, rows } = parseCsv(raw);

  if (!headers.length || !rows.length) {
    throw new Error(`No CSV rows found in '${inputAbsolute}'.`);
  }

  const requiredColumns = ['reviewerDisposition', 'reviewerMateriality', 'reviewerNotes'];
  for (const col of requiredColumns) {
    if (!headers.includes(col)) {
      throw new Error(`Missing expected column '${col}' in '${inputAbsolute}'.`);
    }
  }

  let updated = 0;
  const limit = Math.min(args.top, rows.length);

  for (let i = 0; i < limit; i += 1) {
    const row = rows[i];
    const dispositionAlready = normalizeString(row.reviewerDisposition);

    if (dispositionAlready && !args.overwrite) {
      continue;
    }

    const suggestion = suggestDisposition(row);
    row.reviewerDisposition = suggestion.disposition;
    row.reviewerMateriality = suggestion.materiality;
    row.reviewerNotes = suggestion.note;
    updated += 1;
  }

  const defaultOutput = `${inputAbsolute.replace(/\.csv$/i, '')}.suggested.csv`;
  const outputAbsolute = args.outputPath
    ? (path.isAbsolute(args.outputPath) ? args.outputPath : path.resolve(process.cwd(), args.outputPath))
    : defaultOutput;

  await fs.writeFile(outputAbsolute, toCsv(rows, headers), 'utf8');

  console.log(`Wrote suggested adjudication file: ${outputAbsolute}`);
  console.log(`Rows updated: ${updated}`);
  if (!args.overwrite) {
    console.log('Existing reviewerDisposition values were preserved. Use --overwrite to replace.');
  }
}

main().catch((error) => {
  console.error('Failed to create suggested adjudication:', normalizeString(error?.message, String(error)));
  process.exitCode = 1;
});
