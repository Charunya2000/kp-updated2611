import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { serializeRcnoaRecords } from './rcnoaCore.js';

const AMBIGUOUS_MEMBERSHIP_ERROR = 'AMBIGUOUS_LOOKUP_DUPLICATE';

export async function writeAmbiguousMembershipRows({
  runId,
  rcnoRecords,
  failures,
  environment = process.env,
}) {
  const failedRecords = failures
    .filter((failure) => failure.errorCode === AMBIGUOUS_MEMBERSHIP_ERROR)
    .map((failure) => rcnoRecords[failure.sourceRowNumber - 1])
    .filter(Boolean);

  if (!failedRecords.length) return null;

  const outputRoot = path.resolve(
    process.cwd(),
    environment.RCNOA_LOCAL_OUTPUT_DIR || 'rcnoa-local-output',
    'diagnostics',
  );
  const filePath = path.join(outputRoot, `${runId}-conflicting-duplicate-membership.rcno`);
  await mkdir(outputRoot, { recursive: true });
  await writeFile(filePath, serializeRcnoaRecords(failedRecords), 'utf-8');
  return filePath;
}