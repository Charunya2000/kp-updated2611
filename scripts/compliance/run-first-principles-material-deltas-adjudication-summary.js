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

function normalizeFraction(value, fallback = 0.8) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) return fallback;
  return parsed;
}

function parseArgs(argv = []) {
  const args = argv.slice(2);

  const getArg = (name, fallback = '') => {
    const idx = args.indexOf(name);
    return idx >= 0 ? String(args[idx + 1] || '').trim() : fallback;
  };

  const inputPath = getArg('--input');
  const minReviewed = normalizePositiveInt(getArg('--min-reviewed', '20'), 20);
  const targetPrecision = normalizeFraction(getArg('--target-precision', '0.8'), 0.8);
  const outputPath = getArg('--output');

  if (!inputPath) {
    throw new Error('Missing required --input <adjudication.csv>');
  }

  return {
    inputPath,
    minReviewed,
    targetPrecision,
    outputPath,
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

  if (!lines.length) return [];

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

  return rows;
}

function dispositionIsMaterial(value = '') {
  const normalized = normalizeString(value).toLowerCase();
  return normalized === 'material';
}

function dispositionIsCounted(value = '') {
  const normalized = normalizeString(value).toLowerCase();
  return ['material', 'non-material', 'false-positive'].includes(normalized);
}

function toPercent(numerator, denominator) {
  const n = Number(numerator || 0);
  const d = Number(denominator || 0);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return 0;
  return Number(((n / d) * 100).toFixed(2));
}

function recommendThreshold(rows = [], { targetPrecision = 0.8, minReviewed = 20 } = {}) {
  const reviewed = rows
    .filter((row) => dispositionIsCounted(row.reviewerDisposition))
    .map((row) => ({
      score: Number(row.materialityScore || 0),
      isMaterial: dispositionIsMaterial(row.reviewerDisposition),
    }))
    .filter((row) => Number.isFinite(row.score))
    .sort((a, b) => b.score - a.score);

  if (reviewed.length < minReviewed) {
    return {
      threshold: null,
      precision: 0,
      reviewedCount: reviewed.length,
      note: `Need at least ${minReviewed} adjudicated rows to recommend a threshold reliably.`,
    };
  }

  let materialSoFar = 0;
  let best = null;

  for (let i = 0; i < reviewed.length; i += 1) {
    if (reviewed[i].isMaterial) materialSoFar += 1;
    const reviewedCount = i + 1;
    const precision = materialSoFar / reviewedCount;

    if (precision >= targetPrecision) {
      best = {
        threshold: reviewed[i].score,
        precision: Number((precision * 100).toFixed(2)),
        reviewedCount,
      };
      break;
    }
  }

  if (!best) {
    const precision = materialSoFar / reviewed.length;
    return {
      threshold: reviewed[reviewed.length - 1]?.score ?? 0,
      precision: Number((precision * 100).toFixed(2)),
      reviewedCount: reviewed.length,
      note: `Target precision ${Math.round(targetPrecision * 100)}% not reached with current adjudications.`,
    };
  }

  return best;
}

function computeDispositionBreakdown(rows = []) {
  const counts = {
    material: 0,
    'non-material': 0,
    'false-positive': 0,
    'needs-review': 0,
    other: 0,
  };

  for (const row of rows) {
    const disposition = normalizeString(row?.reviewerDisposition).toLowerCase();
    if (Object.prototype.hasOwnProperty.call(counts, disposition)) {
      counts[disposition] += 1;
    } else if (disposition) {
      counts.other += 1;
    }
  }

  return counts;
}

function buildDataQualityWarnings({ dispositionBreakdown = {}, reviewedCount = 0 } = {}) {
  const warnings = [];
  const materialCount = Number(dispositionBreakdown.material || 0);
  const nonMaterialCount = Number(dispositionBreakdown['non-material'] || 0);
  const falsePositiveCount = Number(dispositionBreakdown['false-positive'] || 0);
  const negativeCount = nonMaterialCount + falsePositiveCount;

  if (reviewedCount > 0 && materialCount === reviewedCount) {
    warnings.push('All reviewed rows are labeled material; threshold recommendation may be overly optimistic.');
  }

  if (reviewedCount > 0 && negativeCount === 0) {
    warnings.push('No non-material/false-positive labels found; precision estimate is not discriminative.');
  }

  if (reviewedCount > 0 && materialCount === 0) {
    warnings.push('No material labels found; recommendation may be overly conservative.');
  }

  return warnings;
}

async function main() {
  const args = parseArgs(process.argv);
  const inputAbsolute = path.isAbsolute(args.inputPath)
    ? args.inputPath
    : path.resolve(process.cwd(), args.inputPath);

  const raw = await fs.readFile(inputAbsolute, 'utf8');
  const rows = parseCsv(raw);

  if (!rows.length) {
    throw new Error(`No rows found in '${inputAbsolute}'.`);
  }

  const counted = rows.filter((row) => dispositionIsCounted(row.reviewerDisposition));
  const material = counted.filter((row) => dispositionIsMaterial(row.reviewerDisposition));
  const byBucket = [90, 80, 70, 60].map((threshold) => {
    const bucket = counted.filter((row) => Number(row.materialityScore || 0) >= threshold);
    const materialBucket = bucket.filter((row) => dispositionIsMaterial(row.reviewerDisposition));
    return {
      threshold,
      reviewedCount: bucket.length,
      precisionPct: toPercent(materialBucket.length, bucket.length),
    };
  });

  const recommendation = recommendThreshold(rows, {
    targetPrecision: args.targetPrecision,
    minReviewed: args.minReviewed,
  });

  const dispositionBreakdown = computeDispositionBreakdown(rows);
  const dataQualityWarnings = buildDataQualityWarnings({
    dispositionBreakdown,
    reviewedCount: counted.length,
  });

  const summary = {
    inputPath: inputAbsolute,
    reviewedCount: counted.length,
    materialCount: material.length,
    overallMaterialPct: toPercent(material.length, counted.length),
    dispositionBreakdown,
    dataQualityWarnings,
    precisionByThreshold: byBucket,
    recommendation: {
      targetPrecisionPct: Number((args.targetPrecision * 100).toFixed(2)),
      ...recommendation,
    },
  };

  const defaultOutput = `${inputAbsolute.replace(/\.csv$/i, '')}.summary.json`;
  const outputAbsolute = args.outputPath
    ? (path.isAbsolute(args.outputPath) ? args.outputPath : path.resolve(process.cwd(), args.outputPath))
    : defaultOutput;

  await fs.writeFile(outputAbsolute, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(`Adjudication summary written to: ${outputAbsolute}`);
  console.log(`Reviewed rows: ${summary.reviewedCount}`);
  console.log(`Overall material rate: ${summary.overallMaterialPct}%`);
  if (summary.dataQualityWarnings.length) {
    for (const warning of summary.dataQualityWarnings) {
      console.log(`Data quality warning: ${warning}`);
    }
  }
  if (summary.recommendation.threshold === null) {
    console.log(summary.recommendation.note);
  } else {
    console.log(`Recommended minimum materialityScore threshold: ${summary.recommendation.threshold}`);
    console.log(`Estimated precision at recommendation: ${summary.recommendation.precision}%`);
  }
}

main().catch((error) => {
  console.error('Failed to summarize adjudication:', normalizeString(error?.message, String(error)));
  process.exitCode = 1;
});
