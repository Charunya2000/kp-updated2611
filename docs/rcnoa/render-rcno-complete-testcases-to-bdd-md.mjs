import fs from 'node:fs/promises';
import path from 'node:path';

const defaultInput = path.join('docs', 'rcnoa', 'RCNO-RCNA-Complete-TestCases.json');
const defaultOutput = path.join('docs', 'rcnoa', 'RCNO-RCNA-Complete-TestCases-BDD.md');

const inputPath = process.argv[2] || defaultInput;
const outputPath = process.argv[3] || defaultOutput;

function asString(value) {
  return String(value ?? '');
}

function mdEscape(value) {
  return asString(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function buildScenarioForRuleCase(testCase) {
  const expected = testCase.expected || {};
  const input = testCase.input || {};
  const working = expected.workingRcna || null;
  const outbound = expected.outboundRcna || null;
  const expectedOutcome = asString(expected.outcome);
  const selectedRuleId = asString(expected.selectedRuleId || testCase.selectedRuleId || testCase.ruleName);

  const lines = [];
  const tagStatus = testCase.status && testCase.status !== 'ready' ? ` @${testCase.status}` : '';
  lines.push(`@rule-catalog @order-${testCase.ruleOrder || 'na'}${tagStatus}`);
  lines.push(`Scenario: ${testCase.id} - ${testCase.scenario}`);
  lines.push(`  Given one canonical RCNO record is prepared from template "${asString(input.rcnoTemplate || '')}"`);
  lines.push('  And the RCNO overrides are applied as follows:');
  lines.push('    """json');
  lines.push(JSON.stringify(input.rcnoOverrides || {}, null, 2));
  lines.push('    """');
  lines.push(`  And ${Array.isArray(input.mdwEnrollmentCandidates) ? input.mdwEnrollmentCandidates.length : 0} MDW enrollment candidate record(s) are supplied`);
  lines.push(`  And ${Array.isArray(input.epds834Candidates) ? input.epds834Candidates.length : 0} EPDS recent-834 candidate record(s) are supplied`);
  lines.push(`  And ${Array.isArray(input.priorRcnaCandidates) ? input.priorRcnaCandidates.length : 0} prior RCNA candidate record(s) are supplied`);

  if (Array.isArray(input.predicateHints) && input.predicateHints.length > 0) {
    lines.push('  And the rule-targeting predicate hints are:');
    input.predicateHints.forEach((hint) => {
      lines.push(`    | ${mdEscape(hint)} |`);
    });
  }

  lines.push('  When the RCNO-to-RCNA transformRow service is executed');

  if (expectedOutcome === 'success') {
    lines.push('  Then the invocation succeeds');
    lines.push(`  And selected rule ID is "${selectedRuleId}"`);

    if (working) {
      lines.push('  And the working RCNA derived fields are:');
      lines.push('    | Field | Value |');
      lines.push(`    | Priority | ${mdEscape(working.Priority)} |`);
      lines.push(`    | PSHB_Code | ${mdEscape(working.PSHB_Code)} |`);
      lines.push(`    | Code_Description | ${mdEscape(working.Code_Description)} |`);
      lines.push(`    | Notes | ${mdEscape(working.Notes)} |`);
      lines.push(`    | Aging_Months | ${mdEscape(working.Aging_Months)} |`);
    }

    if (outbound) {
      lines.push('  And the outbound RCNA derived fields are:');
      lines.push('    | Field | Value |');
      lines.push(`    | Priority | ${mdEscape(outbound.Priority)} |`);
      lines.push(`    | PSHB_Code | ${mdEscape(outbound.PSHB_Code)} |`);
      lines.push(`    | Code_Description | ${mdEscape(outbound.Code_Description)} |`);
    }
  } else {
    lines.push('  Then the invocation fails as a blocking validation error');
    lines.push(`  And selected rule ID is "${selectedRuleId}"`);
    lines.push(`  And error code is "${asString(expected.errorCode)}"`);
    lines.push(`  And error message is "${asString(expected.errorMessage)}"`);
    lines.push('  And no success-shaped working/outbound RCNA record is returned');
  }

  return ['```gherkin', ...lines, '```'].join('\n');
}

function buildScenarioForValidationCase(testCase) {
  const expected = testCase.expected || {};
  const lines = [];

  lines.push(`@${mdEscape(testCase.category || 'validation')}`);
  lines.push(`Scenario: ${testCase.id} - ${testCase.scenario}`);
  lines.push('  Given one RCNO-to-RCNA invocation context is prepared');
  lines.push('  And the validation precondition for this scenario is intentionally triggered');
  lines.push('  When the RCNO-to-RCNA transformRow service is executed');

  if (asString(expected.outcome) === 'success') {
    lines.push('  Then the invocation succeeds');
    if (expected.invariant) {
      lines.push(`  And invariant "${asString(expected.invariant)}" is satisfied`);
    }
  } else {
    lines.push('  Then the invocation fails as a blocking validation error');
    if (expected.errorCode) {
      lines.push(`  And error code is "${asString(expected.errorCode)}"`);
    }
    if (expected.errorMessage) {
      lines.push(`  And error message is "${asString(expected.errorMessage)}"`);
    }
  }

  return ['```gherkin', ...lines, '```'].join('\n');
}

function buildDocument(data) {
  const testCases = Array.isArray(data.testCases) ? data.testCases : [];
  const ruleCases = testCases.filter((tc) => tc.category === 'rule-catalog');
  const validationCases = testCases.filter((tc) => tc.category !== 'rule-catalog');

  const byFamily = new Map();
  ruleCases.forEach((tc) => {
    const family = asString(tc.ruleName || '').match(/^Rule([A-Z]+)/)?.[1] || 'Other';
    if (!byFamily.has(family)) byFamily.set(family, []);
    byFamily.get(family).push(tc);
  });

  const lines = [];
  lines.push(`# RCNO-RCNA Complete BDD Test Specification`);
  lines.push('');
  lines.push(`Source suite: ${asString(data.document)}`);
  lines.push(`Version: ${asString(data.version)}`);
  lines.push(`Generated from: ${asString(data.generatedFrom)}`);
  lines.push('');

  if (data.coverageSummary) {
    lines.push('## Coverage Summary');
    lines.push('');
    lines.push(`- Total catalog rules: ${asString(data.coverageSummary.totalCatalogRules)}`);
    lines.push(`- Total catalog cases: ${asString(data.coverageSummary.totalCatalogCases)}`);
    lines.push(`- Total validation cases: ${asString(data.coverageSummary.totalValidationCases)}`);
    lines.push(`- Total test cases: ${asString(data.coverageSummary.totalTestCases)}`);
    lines.push('');
  }

  lines.push('## Core Ordered Rules (strict sequence)');
  lines.push('');
  lines.push('| Order | Rule Name | Selected Rule ID |');
  lines.push('|---:|---|---|');
  (data.strictOrderedCoreSubset || []).forEach((r) => {
    lines.push(`| ${mdEscape(r.order)} | ${mdEscape(r.ruleName)} | ${mdEscape(r.selectedRuleId)} |`);
  });
  lines.push('');

  lines.push('## Feature: RCNO to RCNA deterministic reconciliation');
  lines.push('');
  lines.push('Background:');
  lines.push('  Given exactly one canonical 73-field RCNO record is supplied per invocation');
  lines.push('  And zero or more MDW membership candidates are supplied explicitly');
  lines.push('  And zero or more EPDS recent-834 candidates are supplied explicitly');
  lines.push('  And zero or more prior RCNA candidates are supplied explicitly');
  lines.push('  And rules are evaluated strictly in configured order with first-match-wins behavior');
  lines.push('');

  const familyOrder = ['A', 'B', 'F', 'I', 'N', 'Catch', 'Default', 'Other'];
  familyOrder.forEach((family) => {
    const familyCases = (byFamily.get(family) || []).sort((a, b) => (a.ruleOrder || 999) - (b.ruleOrder || 999));
    if (familyCases.length === 0) return;
    lines.push(`### Rule Family ${family}`);
    lines.push('');
    familyCases.forEach((tc) => {
      lines.push(buildScenarioForRuleCase(tc));
      lines.push('');
    });
  });

  if (validationCases.length > 0) {
    lines.push('## Feature: RCNO to RCNA validation and determinism safeguards');
    lines.push('');
    validationCases.forEach((tc) => {
      lines.push(buildScenarioForValidationCase(tc));
      lines.push('');
    });
  }

  lines.push('---');
  lines.push('Generated by docs/rcnoa/render-rcno-complete-testcases-to-bdd-md.mjs');
  lines.push('');

  return lines.join('\n');
}

async function main() {
  const raw = await fs.readFile(inputPath, 'utf8');
  const data = JSON.parse(raw);
  const markdown = buildDocument(data);
  await fs.writeFile(outputPath, markdown, 'utf8');
  console.log(`Rendered BDD markdown: ${outputPath}`);
}

main().catch((err) => {
  console.error('Failed to render BDD markdown:', err);
  process.exitCode = 1;
});
