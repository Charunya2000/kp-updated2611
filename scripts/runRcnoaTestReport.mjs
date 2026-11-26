import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

function timestamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
}

function commandResult(command, args, logPath) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 100 * 1024 * 1024,
    shell: false,
  });
  const output = [result.stdout, result.stderr, result.error?.message]
    .filter(Boolean)
    .join('\n');
  return fs.writeFile(logPath, output, 'utf8').then(() => ({
    exitCode: Number.isInteger(result.status) ? result.status : 1,
    output,
  }));
}

function gitValue(args) {
  const result = spawnSync('git', args, { cwd: process.cwd(), encoding: 'utf8', shell: false });
  return result.status === 0 ? result.stdout.trim() : null;
}

async function ensureJestResult(filePath, exitCode) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, `${JSON.stringify({
      success: false,
      numTotalTestSuites: 0,
      numPassedTestSuites: 0,
      numFailedTestSuites: exitCode ? 1 : 0,
      numTotalTests: 0,
      numPassedTests: 0,
      numFailedTests: exitCode ? 1 : 0,
      numPendingTests: 0,
      testResults: [],
      resultFileMissing: true,
    }, null, 2)}\n`, 'utf8');
  }
}

async function ensureFixtureResult(filePath) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, `${JSON.stringify({
      passed: false,
      fixtureCount: 0,
      passedFixtureCount: 0,
      failedFixtureCount: 0,
      transformedRowCount: 0,
      catalogCaseCount: 0,
      uniqueCatalogCaseCount: 0,
      passedCatalogCaseCount: 0,
      rcnaFileCount: 0,
      x834FileCount: 0,
      fixtures: [],
      resultFileMissing: true,
    }, null, 2)}\n`, 'utf8');
  }
}

async function main() {
  const startedAt = new Date();
  const runDirectory = path.resolve(
    process.argv[2] || path.join('out', 'rcnoa-test-results', timestamp(startedAt)),
  );
  const rawDirectory = path.join(runDirectory, 'raw');
  await fs.mkdir(rawDirectory, { recursive: true });
  await fs.writeFile(
    path.join('out', 'rcnoa-test-results', 'latest.txt'),
    `${runDirectory}\n`,
    'utf8',
  );

  console.log(`RCNOA test evidence directory: ${runDirectory}`);
  console.log('1/5 Generating fixtures');
  const generation = await commandResult(
    process.execPath,
    ['scripts/generateRcnoaMockFixtures.mjs'],
    path.join(rawDirectory, 'fixture-generation.log'),
  );

  console.log('2/5 Running all Jest tests');
  const jestResultPath = path.join(rawDirectory, 'jest-results.json');
  const jestCliPath = path.join(path.dirname(require.resolve('jest/package.json')), 'bin', 'jest.js');
  const jest = await commandResult(
    process.execPath,
    [jestCliPath, '--runInBand', '--json', `--outputFile=${jestResultPath}`],
    path.join(rawDirectory, 'jest-console.log'),
  );
  await ensureJestResult(jestResultPath, jest.exitCode);

  console.log('3/5 Executing RCNOA fixtures');
  const fixtureResultPath = path.join(rawDirectory, 'fixture-execution.json');
  const fixture = generation.exitCode === 0
    ? await commandResult(
      process.execPath,
      ['scripts/runRcnoaMockFixtureSuite.mjs', '--output', runDirectory],
      path.join(rawDirectory, 'fixture-console.log'),
    )
    : { exitCode: 1, output: 'Skipped because fixture generation failed' };
  if (generation.exitCode !== 0) {
    await fs.writeFile(path.join(rawDirectory, 'fixture-console.log'), fixture.output, 'utf8');
  }
  await ensureFixtureResult(fixtureResultPath);

  const metadata = {
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    packageName: packageJson.name,
    packageVersion: packageJson.version,
    nodeVersion: process.version,
    platform: `${process.platform} ${process.arch}`,
    gitCommit: gitValue(['rev-parse', 'HEAD']),
    worktreeDirty: Boolean(gitValue(['status', '--porcelain'])),
    generationExitCode: generation.exitCode,
    jestExitCode: jest.exitCode,
    fixtureExitCode: fixture.exitCode,
  };
  const metadataPath = path.join(rawDirectory, 'run-metadata.json');
  await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

  console.log('4/6 Creating output ZIP');
  const archive = await commandResult(
    process.execPath,
    ['scripts/createRcnoaOutputArchive.mjs', '--input', runDirectory],
    path.join(rawDirectory, 'archive-console.log'),
  );
  metadata.archiveExitCode = archive.exitCode;
  await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

  console.log('5/6 Rendering Markdown');
  const report = await commandResult(
    process.execPath,
    ['scripts/renderRcnoaTestResults.mjs', '--input', runDirectory],
    path.join(rawDirectory, 'report-console.log'),
  );

  console.log('6/6 Rendering HTML');
  const markdownPath = path.join(runDirectory, 'RCNOA-Test-Results.md');
  const htmlPath = path.join(runDirectory, 'RCNOA-Test-Results.html');
  let html = { exitCode: 1, output: 'Skipped because Markdown was not created' };
  try {
    await fs.access(markdownPath);
    html = await commandResult(
      process.execPath,
      ['docs/rcnoa/copy-markdown-to-html.mjs', markdownPath, htmlPath],
      path.join(rawDirectory, 'html-console.log'),
    );
  } catch {
    await fs.writeFile(path.join(rawDirectory, 'html-console.log'), html.output, 'utf8');
  }

  metadata.completedAt = new Date().toISOString();
  metadata.durationMs = Date.now() - startedAt.getTime();
  metadata.reportExitCode = report.exitCode;
  metadata.htmlExitCode = html.exitCode;
  await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

  const failed = [generation, jest, fixture, archive, report, html]
    .some((stage) => stage.exitCode !== 0);
  console.log(`Markdown report: ${markdownPath}`);
  console.log(`HTML report: ${htmlPath}`);
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});