import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function main() {
  const inputArgument = argumentValue('--input') || process.argv[2];
  if (!inputArgument) throw new Error('--input is required');
  const runDirectory = path.resolve(inputArgument);
  const fixturesDirectory = path.join(runDirectory, 'fixtures');
  const summary = JSON.parse(await fs.readFile(
    path.join(runDirectory, 'raw', 'fixture-execution.json'),
    'utf8',
  ));
  const relativeFiles = [];
  for (const fixture of summary.fixtures) {
    relativeFiles.push(path.join(fixture.fixtureId, 'input.rcno'));
    if (fixture.rcna.file) relativeFiles.push(path.join(fixture.fixtureId, fixture.rcna.file));
    if (fixture.x834.file) relativeFiles.push(path.join(fixture.fixtureId, fixture.x834.file));
  }
  const missing = [];
  for (const relativeFile of relativeFiles) {
    try {
      await fs.access(path.join(fixturesDirectory, relativeFile));
    } catch {
      missing.push(relativeFile);
    }
  }
  if (missing.length) throw new Error(`Archive inputs are missing: ${missing.join(', ')}`);

  const outputPath = path.join(runDirectory, 'RCNOA-Generated-Files.zip');
  await fs.rm(outputPath, { force: true });
  const result = spawnSync('tar', [
    '-a', '-cf', outputPath,
    ...relativeFiles.map((file) => file.replace(/\\/g, '/')),
  ], {
    cwd: fixturesDirectory,
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.error?.message || 'ZIP creation failed');
  }
  console.log(`Created ZIP with ${relativeFiles.length} files: ${outputPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});