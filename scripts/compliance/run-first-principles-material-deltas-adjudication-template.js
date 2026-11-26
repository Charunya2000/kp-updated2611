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
  const top = normalizePositiveInt(getArg('--top', '200'), 200);
  const outputPath = getArg('--output');

  if (!inputPath) {
    throw new Error('Missing required --input <material-deltas.json>');
  }

  return {
    inputPath,
    top,
    outputPath,
  };
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

async function main() {
  const args = parseArgs(process.argv);
  const inputAbsolute = path.isAbsolute(args.inputPath)
    ? args.inputPath
    : path.resolve(process.cwd(), args.inputPath);

  const raw = await fs.readFile(inputAbsolute, 'utf8');
  const parsed = JSON.parse(raw);
  const rows = Array.isArray(parsed?.rows) ? parsed.rows : [];

  if (!rows.length) {
    throw new Error(`No rows found in '${inputAbsolute}'. Expected a material-deltas JSON with a rows array.`);
  }

  const shortlisted = rows.slice(0, args.top).map((row) => ({
    rank: row.rank,
    type: row.type,
    classification: row.classification,
    changeType: row.changeType,
    materialityScore: row.materialityScore,
    reasonCodes: row.reasonCodes,
    leftSection: row.leftSection,
    rightSection: row.rightSection,
    leftCitation: row.leftCitation,
    rightCitation: row.rightCitation,
    leftText: row.leftText,
    rightText: row.rightText,
    reviewerDisposition: '',
    reviewerMateriality: '',
    reviewerNotes: '',
    reviewerName: '',
  }));

  const defaultOutput = `${inputAbsolute.replace(/\.json$/i, '')}.adjudication.csv`;
  const outputAbsolute = args.outputPath
    ? (path.isAbsolute(args.outputPath) ? args.outputPath : path.resolve(process.cwd(), args.outputPath))
    : defaultOutput;

  const headers = [
    'rank',
    'type',
    'classification',
    'changeType',
    'materialityScore',
    'reasonCodes',
    'leftSection',
    'rightSection',
    'leftCitation',
    'rightCitation',
    'leftText',
    'rightText',
    'reviewerDisposition',
    'reviewerMateriality',
    'reviewerNotes',
    'reviewerName',
  ];

  await fs.writeFile(outputAbsolute, toCsv(shortlisted, headers), 'utf8');

  console.log(`Created adjudication template: ${outputAbsolute}`);
  console.log(`Rows exported: ${shortlisted.length}`);
  console.log('Disposition guidance: use material | non-material | false-positive | needs-review');
}

main().catch((error) => {
  console.error('Failed to build adjudication template:', normalizeString(error?.message, String(error)));
  process.exitCode = 1;
});
