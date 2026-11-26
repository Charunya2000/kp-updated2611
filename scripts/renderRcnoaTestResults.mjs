import fs from 'node:fs/promises';
import path from 'node:path';

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function markdown(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function duration(milliseconds) {
  if (!Number.isFinite(milliseconds)) return 'n/a';
  return `${(milliseconds / 1000).toFixed(3)} s`;
}

function relativeLink(runDirectory, target) {
  return path.relative(runDirectory, target).replace(/\\/g, '/');
}

async function readJson(filePath, required = true) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (!required && error.code === 'ENOENT') return null;
    throw new Error(`Unable to read ${filePath}: ${error.message}`);
  }
}

function assertions(jestResults) {
  return (jestResults?.testResults || []).flatMap((suite) => (
    (suite.assertionResults || []).map((assertion) => ({
      suite: suite.name,
      name: assertion.fullName || assertion.title,
      status: assertion.status,
      failureMessages: assertion.failureMessages || [],
    }))
  ));
}

function hasPassingAssertion(allAssertions, pattern) {
  return allAssertions.some((assertion) => (
    assertion.status === 'passed' && pattern.test(assertion.name)
  ));
}

function catalogRow(fixtureResults, testCaseId) {
  for (const fixture of fixtureResults.fixtures || []) {
    const row = fixture.rows.find((item) => item.testCaseId === testCaseId);
    if (row) return { fixture, row };
  }
  return null;
}

function validationCoverage(jestResults, fixtureResults) {
  const allAssertions = assertions(jestResults);
  const mappings = [
    ['VAL-001-PrimaryFieldCount72', hasPassingAssertion(allAssertions, /wrong fixed width/i), 'Jest: wrong-width RCNO row'],
    ['VAL-002-MalformedLookupRow', hasPassingAssertion(allAssertions, /malformed membership lookup/i), 'Jest: malformed membership lookup'],
    ['VAL-003-ConflictingDuplicateMembership', hasPassingAssertion(allAssertions, /membership candidates.*conflicting duplicates/i), 'Jest: membership duplicate handling'],
    ['VAL-004-ConflictingDuplicateRecent834', hasPassingAssertion(allAssertions, /recent 834 candidates.*conflicting duplicates/i), 'Jest: recent-834 duplicate handling'],
    ['VAL-005-NoRuleSelectedImpossible', hasPassingAssertion(allAssertions, /explicit default/i), 'Jest: explicit default selection'],
    ['VAL-006-InputMutationGuard', hasPassingAssertion(allAssertions, /does not mutate/i), 'Jest: mutation guard'],
    ['VAL-007-N12ApprovedDefault', hasPassingAssertion(allAssertions, /approved AE999/i)
      && Boolean(catalogRow(fixtureResults, 'CAT-042-N12000')?.row.passed), 'Jest plus CAT-042-N12000'],
    ['VAL-008-I4I5CoverageDiscriminator', hasPassingAssertion(allAssertions, /active membership coverage for processed=Y/i)
      && Boolean(catalogRow(fixtureResults, 'CAT-021-I4000')?.row.passed)
      && Boolean(catalogRow(fixtureResults, 'CAT-022-I5000')?.row.passed), 'Jest plus CAT-021/CAT-022'],
    ['VAL-009-I6I7CoverageDiscriminator', hasPassingAssertion(allAssertions, /active membership coverage for processed=N/i)
      && Boolean(catalogRow(fixtureResults, 'CAT-023-I6000')?.row.passed)
      && Boolean(catalogRow(fixtureResults, 'CAT-024-I7000')?.row.passed), 'Jest plus CAT-023/CAT-024'],
    ['VAL-010-AddressStandardizerRequiredForN91N92', hasPassingAssertion(allAssertions, /requires an address normalizer/i)
      && Boolean(catalogRow(fixtureResults, 'CAT-038-N91000')?.row.passed)
      && Boolean(catalogRow(fixtureResults, 'CAT-039-N92000')?.row.passed), 'Jest plus CAT-038/CAT-039'],
  ];
  return mappings.map(([testCaseId, covered, evidence]) => ({ testCaseId, covered, evidence }));
}

function reportStatus(metadata, jestResults, fixtureResults, validation, archiveExists) {
  const generationPassed = metadata?.generationExitCode === 0;
  const jestPassed = jestResults?.success === true && metadata?.jestExitCode === 0;
  const fixturesPassed = fixtureResults?.passed === true && metadata?.fixtureExitCode === 0;
  const validationPassed = validation.every((item) => item.covered);
  const archivePassed = metadata?.archiveExitCode === undefined
    ? archiveExists
    : metadata.archiveExitCode === 0 && archiveExists;
  return {
    generationPassed,
    jestPassed,
    fixturesPassed,
    validationPassed,
    archivePassed,
    passed: generationPassed && jestPassed && fixturesPassed && validationPassed && archivePassed,
  };
}

async function main() {
  const inputArgument = argumentValue('--input') || process.argv[2];
  if (!inputArgument) throw new Error('--input is required');
  const runDirectory = path.resolve(inputArgument);
  const rawDirectory = path.join(runDirectory, 'raw');
  const [jestResults, fixtureResults, metadata] = await Promise.all([
    readJson(path.join(rawDirectory, 'jest-results.json')),
    readJson(path.join(rawDirectory, 'fixture-execution.json')),
    readJson(path.join(rawDirectory, 'run-metadata.json'), false),
  ]);
  const validation = validationCoverage(jestResults, fixtureResults);
  const archivePath = path.join(runDirectory, 'RCNOA-Generated-Files.zip');
  let archiveExists = true;
  try {
    await fs.access(archivePath);
  } catch {
    archiveExists = false;
  }
  const status = reportStatus(metadata, jestResults, fixtureResults, validation, archiveExists);
  const failedAssertions = assertions(jestResults).filter((item) => item.status === 'failed');
  const lines = [];

  lines.push('# RCNOA Test Results', '');
  lines.push(`**Overall status: ${status.passed ? 'PASS' : 'FAIL'}**`, '');
  lines.push('## Execution Metadata', '');
  lines.push('| Item | Value |', '| --- | --- |');
  lines.push(`| Started (UTC) | ${markdown(metadata?.startedAt || fixtureResults.startedAt)} |`);
  lines.push(`| Completed (UTC) | ${markdown(metadata?.completedAt || fixtureResults.completedAt)} |`);
  lines.push(`| Duration | ${duration(metadata?.durationMs)} |`);
  lines.push(`| Package | ${markdown(metadata?.packageName)} ${markdown(metadata?.packageVersion)} |`);
  lines.push(`| Node | ${markdown(metadata?.nodeVersion || process.version)} |`);
  lines.push(`| OS | ${markdown(metadata?.platform || process.platform)} |`);
  lines.push(`| Git commit | ${markdown(metadata?.gitCommit || 'unavailable')} |`);
  lines.push(`| Worktree | ${metadata?.worktreeDirty ? 'local changes present' : 'clean or unavailable'} |`, '');

  lines.push('## Stage Summary', '');
  lines.push('| Stage | Result | Exit code |', '| --- | --- | ---: |');
  lines.push(`| Fixture generation | ${status.generationPassed ? 'PASS' : 'FAIL'} | ${metadata?.generationExitCode ?? 'missing'} |`);
  lines.push(`| Repository Jest suite | ${status.jestPassed ? 'PASS' : 'FAIL'} | ${metadata?.jestExitCode ?? 'missing'} |`);
  lines.push(`| RCNOA fixture execution | ${status.fixturesPassed ? 'PASS' : 'FAIL'} | ${metadata?.fixtureExitCode ?? 'missing'} |`);
  lines.push(`| Output ZIP archive | ${status.archivePassed ? 'PASS' : 'FAIL'} | ${metadata?.archiveExitCode ?? (archiveExists ? 0 : 'missing')} |`);
  lines.push(`| Validation traceability | ${status.validationPassed ? 'PASS' : 'FAIL'} | n/a |`, '');

  lines.push('## Repository Tests', '');
  lines.push('| Metric | Count |', '| --- | ---: |');
  lines.push(`| Test suites | ${jestResults.numTotalTestSuites ?? 0} |`);
  lines.push(`| Passed suites | ${jestResults.numPassedTestSuites ?? 0} |`);
  lines.push(`| Failed suites | ${jestResults.numFailedTestSuites ?? 0} |`);
  lines.push(`| Tests | ${jestResults.numTotalTests ?? 0} |`);
  lines.push(`| Passed tests | ${jestResults.numPassedTests ?? 0} |`);
  lines.push(`| Failed tests | ${jestResults.numFailedTests ?? 0} |`);
  lines.push(`| Pending tests | ${jestResults.numPendingTests ?? 0} |`, '');
  lines.push(`Raw evidence: [Jest JSON](${relativeLink(runDirectory, path.join(rawDirectory, 'jest-results.json'))}) and [console log](${relativeLink(runDirectory, path.join(rawDirectory, 'jest-console.log'))}).`, '');

  if (failedAssertions.length) {
    lines.push('### Failed Tests', '');
    lines.push('| Suite | Test | Failure |', '| --- | --- | --- |');
    failedAssertions.forEach((failure) => {
      lines.push(`| ${markdown(relativeLink(process.cwd(), failure.suite))} | ${markdown(failure.name)} | ${markdown(failure.failureMessages[0] || 'No failure message')} |`);
    });
    lines.push('');
  }

  lines.push('## Fixture Summary', '');
  lines.push('| Metric | Count |', '| --- | ---: |');
  lines.push(`| Manifest fixtures | ${fixtureResults.fixtureCount} |`);
  lines.push(`| Passed fixtures | ${fixtureResults.passedFixtureCount} |`);
  lines.push(`| Failed fixtures | ${fixtureResults.failedFixtureCount} |`);
  lines.push(`| Transformed rows | ${fixtureResults.transformedRowCount} |`);
  lines.push(`| Catalog cases | ${fixtureResults.catalogCaseCount} |`);
  lines.push(`| Unique catalog cases | ${fixtureResults.uniqueCatalogCaseCount} |`);
  lines.push(`| RCNA files | ${fixtureResults.rcnaFileCount} |`);
  lines.push(`| 834 files | ${fixtureResults.x834FileCount} |`, '');

  lines.push('### Fixture Results', '');
  lines.push('| Fixture | Rows | Family | RCNA | 834 | Result | Evidence |', '| --- | ---: | --- | --- | --- | --- | --- |');
  fixtureResults.fixtures.forEach((fixture) => {
    const fixturePath = path.join(runDirectory, 'fixtures', fixture.fixtureId, 'comparison.json');
    lines.push(`| ${markdown(fixture.fixtureId)} | ${fixture.rows.length} | ${markdown(fixture.ruleFamily || 'focused')} | ${fixture.rcna.status} | ${fixture.x834.status} | ${fixture.passed ? 'PASS' : 'FAIL'} | [comparison](${relativeLink(runDirectory, fixturePath)}) |`);
  });
  lines.push('');

  lines.push('## Generated File Package', '');
  lines.push(`[Download all 40 generated input and output files](RCNOA-Generated-Files.zip).`, '');
  lines.push('The ZIP preserves one directory per fixture and contains only `input.rcno`, `actual.rcna`, and eligible `actual.834.x12` files.', '');
  lines.push('| Fixture | Input RCNO | Output RCNA | Output 834 |', '| --- | --- | --- | --- |');
  fixtureResults.fixtures.forEach((fixture) => {
    const base = `fixtures/${fixture.fixtureId}`;
    const input = `[input.rcno](${base}/input.rcno)`;
    const rcna = fixture.rcna.file ? `[${fixture.rcna.file}](${base}/${fixture.rcna.file})` : 'not generated';
    const x834 = fixture.x834.file ? `[${fixture.x834.file}](${base}/${fixture.x834.file})` : 'not applicable';
    lines.push(`| ${markdown(fixture.fixtureId)} | ${input} | ${rcna} | ${x834} |`);
  });
  lines.push('');

  lines.push('## Catalog Coverage', '');
  lines.push('| Test case | Fixture / row | Expected | Actual | Result |', '| --- | --- | --- | --- | --- |');
  fixtureResults.fixtures.forEach((fixture) => {
    fixture.rows.filter((row) => row.testCaseId).forEach((row) => {
      lines.push(`| ${markdown(row.testCaseId)} | ${markdown(fixture.fixtureId)} / ${row.sourceRow} | ${markdown(row.expected.ruleId)} / ${markdown(row.expected.code)} | ${markdown(row.actual?.ruleId)} / ${markdown(row.actual?.code)} | ${row.passed ? 'PASS' : 'FAIL'} |`);
    });
  });
  lines.push('');

  lines.push('## Validation Coverage', '');
  lines.push('| Validation case | Evidence | Result |', '| --- | --- | --- |');
  validation.forEach((item) => {
    lines.push(`| ${markdown(item.testCaseId)} | ${markdown(item.evidence)} | ${item.covered ? 'PASS' : 'MISSING'} |`);
  });
  lines.push('');

  lines.push('## Output Notes', '');
  lines.push('- Broad `complete-*-rules` fixtures are RCNA-only by contract and correctly report 834 as `NOT_APPLICABLE`.');
  lines.push('- Focused fixtures use deterministic test-only 834 intents and generate reviewable X12 files.');
  lines.push('- Fixture inputs and identifiers are synthetic. Error summaries redact nine-digit values.');
  lines.push('- The report reflects current-run machine-readable evidence; missing evidence produces a failed report.', '');

  if (!status.passed) {
    lines.push('## Failure Summary', '');
    if (!status.generationPassed) lines.push('- Fixture generation failed or its result is missing.');
    if (!status.jestPassed) lines.push(`- ${jestResults.numFailedTests ?? 0} Jest tests failed.`);
    if (!status.fixturesPassed) lines.push(`- ${fixtureResults.failedFixtureCount ?? 0} fixture executions failed.`);
    if (!status.archivePassed) lines.push('- The generated-file ZIP is missing or archive creation failed.');
    if (!status.validationPassed) lines.push('- One or more validation cases lack current-run evidence.');
    lines.push('');
  }

  lines.push('## Rerun', '', '```powershell', 'npm run test-rcnoa-report', '```', '');
  const outputPath = path.join(runDirectory, 'RCNOA-Test-Results.md');
  await fs.writeFile(outputPath, lines.join('\n'), 'utf8');
  console.log(`Rendered Markdown: ${outputPath}`);
  if (!status.passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});