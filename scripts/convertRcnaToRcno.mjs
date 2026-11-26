import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { parseRcnaText, serializeRcnoaRecords } from '../app/services/rcnoa/rcnoaCore.js';

const RCNO_COLUMN_COUNT = 73;

function convertRcnaTextToRcno(text) {
  return serializeRcnoaRecords(
    parseRcnaText(text).map((record) => record.slice(0, RCNO_COLUMN_COUNT)),
  );
}

function defaultOutputPath(inputPath) {
  const parsed = path.parse(inputPath);
  const plaintextName = parsed.base.replace(/\.txt(?:\.pgp)?$/i, '');
  const canonicalRcnoName = plaintextName.replace('_RCNA_', '_RCNO_');
  const baseName = canonicalRcnoName === plaintextName
    ? plaintextName.replace(/\.rcna$/i, '')
    : canonicalRcnoName;
  return path.join(parsed.dir, `${baseName}.reconstructed.rcno.txt`);
}

async function assertOutputDoesNotExist(outputPath) {
  try {
    await access(outputPath);
    throw new Error(`Output file already exists: ${outputPath}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

const [, , inputArgument, outputArgument] = process.argv;
if (!inputArgument) {
  console.error('Usage: npm run rcna-to-rcno -- <input-rcna-file> [output-rcno-file]');
  console.error('Input must be decrypted UTF-8 pipe-delimited RCNA content.');
  process.exitCode = 1;
} else {
  try {
    const inputPath = path.resolve(inputArgument);
    const outputPath = path.resolve(outputArgument || defaultOutputPath(inputPath));
    if (inputPath === outputPath) throw new Error('Input and output paths must be different');
    await assertOutputDoesNotExist(outputPath);

    const rcnaText = await readFile(inputPath, 'utf-8');
    const rcnoText = convertRcnaTextToRcno(rcnaText);
    await writeFile(outputPath, rcnoText, 'utf-8');
    console.log(`Reconstructed RCNO file: ${outputPath}`);
  } catch (error) {
    console.error(`Failed to reconstruct RCNO file: ${error.message}`);
    process.exitCode = 1;
  }
}