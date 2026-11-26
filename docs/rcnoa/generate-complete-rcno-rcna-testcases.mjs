import fs from 'node:fs/promises';
import path from 'node:path';

import {
  formatNoticeCodeDisplay,
  formatPriorityDisplay,
} from '../../app/services/rcnoa/rcnoaDecisionDisplay.js';

const outPath = path.join('docs', 'rcnoa', 'RCNO-RCNA-Complete-TestCases.json');

const orderedRules = [
  { order: 1, ruleName: 'RuleA', selectedRuleId: 'A100', family: 'A', resultCode: 'M', priority: '5', code: 'MM', description: 'Matches (no action required)', status: 'ready' },
  { order: 2, ruleName: 'RuleB', selectedRuleId: 'B200', family: 'B', resultCode: 'F', priority: 'Prior', code: 'Prior', description: 'Prior description', status: 'ready' },

  { order: 3, ruleName: 'RuleF1', selectedRuleId: 'F1300', family: 'F', resultCode: 'F', priority: '1', code: 'CE502', description: 'Carrier data matches RCNO; no action', status: 'ready' },
  { order: 4, ruleName: 'RuleF2', selectedRuleId: 'F2400', family: 'F', resultCode: 'F', priority: '4', code: 'CE001', description: 'OPM to send 834 cancellation', status: 'ready' },
  { order: 5, ruleName: 'RuleF3', selectedRuleId: 'F3500', family: 'F', resultCode: 'F', priority: '4', code: 'CE500', description: 'Carrier to investigate and reprocess the 834', status: 'ready' },
  { order: 6, ruleName: 'RuleF4', selectedRuleId: 'F4600', family: 'F', resultCode: 'F', priority: '1', code: 'AE002', description: 'OPM to match ended coverage', status: 'ready' },
  { order: 7, ruleName: 'RuleF5', selectedRuleId: 'F5700', family: 'F', resultCode: 'F', priority: '1', code: 'AE003', description: 'OPM to match carrier record', status: 'ready' },
  { order: 8, ruleName: 'RuleF6', selectedRuleId: 'F6800', family: 'F', resultCode: 'F', priority: '1', code: 'AE004', description: 'OPM to investigate missing 834 / age-out handling', status: 'ready' },
  { order: 9, ruleName: 'RuleF7', selectedRuleId: 'F7000', family: 'F', resultCode: 'F', priority: '1', code: 'Z0000', description: 'Invalid scenario', status: 'ready' },
  { order: 10, ruleName: 'RuleF8', selectedRuleId: 'F8000', family: 'F', resultCode: 'F', priority: '1', code: 'AE502', description: 'Carrier data matches RCNO; no action', status: 'ready' },
  { order: 11, ruleName: 'RuleF9', selectedRuleId: 'F9000', family: 'F', resultCode: 'F', priority: '1', code: 'AE504', description: 'No action required', status: 'ready' },
  { order: 12, ruleName: 'RuleF10', selectedRuleId: 'F10000', family: 'F', resultCode: 'F', priority: '1', code: 'AE010', description: 'OPM to correct coverage end date', status: 'ready' },
  { order: 13, ruleName: 'RuleF11', selectedRuleId: 'F11000', family: 'F', resultCode: 'F', priority: '1', code: 'AE001', description: 'OPM to correct coverage start date / pending enrollment', status: 'ready' },
  { order: 14, ruleName: 'RuleF12', selectedRuleId: 'F12000', family: 'F', resultCode: 'F', priority: '1', code: 'AE502', description: 'Carrier data matches RCNO; no action', status: 'ready' },
  { order: 15, ruleName: 'RuleF13', selectedRuleId: 'F13000', family: 'F', resultCode: 'F', priority: '1', code: 'AE500', description: 'Carrier to investigate and reprocess the 834', status: 'ready' },
  { order: 16, ruleName: 'RuleF14', selectedRuleId: 'F14000', family: 'F', resultCode: 'F', priority: '1', code: 'AE501', description: 'Carrier to process the 834 enrollment', status: 'ready' },
  { order: 17, ruleName: 'RuleF20', selectedRuleId: 'F20000', family: 'F', resultCode: 'F', priority: '1', code: 'AE013', description: 'OPM to investigate why an 834 was not sent', status: 'ready' },

  { order: 18, ruleName: 'RuleI1', selectedRuleId: 'I1000', family: 'I', resultCode: 'I', priority: '2', code: 'AC002', description: 'OPM to match ended coverage', status: 'ready' },
  { order: 19, ruleName: 'RuleI2', selectedRuleId: 'I2000', family: 'I', resultCode: 'I', priority: '2', code: 'AC004', description: 'No 834 termination/cancel received; OPM to investigate', status: 'ready' },
  { order: 20, ruleName: 'RuleI3', selectedRuleId: 'I3000', family: 'I', resultCode: 'I', priority: '4', code: 'CE001', description: 'OPM to send 834 cancellation', status: 'ready' },
  { order: 21, ruleName: 'RuleI4', selectedRuleId: 'I4000', family: 'I', resultCode: 'I', priority: '2', code: 'AC500', description: 'Carrier to investigate and reprocess processed enrollment', status: 'ready' },
  { order: 22, ruleName: 'RuleI5', selectedRuleId: 'I5000', family: 'I', resultCode: 'I', priority: '4', code: 'CE500', description: 'Carrier investigation/reprocessing required', status: 'ready' },
  { order: 23, ruleName: 'RuleI6', selectedRuleId: 'I6000', family: 'I', resultCode: 'I', priority: '2', code: 'AC501', description: 'Cancellation/termination awaiting processing', status: 'ready' },
  { order: 24, ruleName: 'RuleI7', selectedRuleId: 'I7000', family: 'I', resultCode: 'I', priority: '4', code: 'CE501', description: 'Carrier to process cancellation', status: 'ready' },

  { order: 25, ruleName: 'RuleN0', selectedRuleId: 'N0000', family: 'N', resultCode: 'N', priority: '1', code: 'KICKO', description: 'MRN not found on an N record', status: 'ready' },
  { order: 26, ruleName: 'RuleN1', selectedRuleId: 'N1000', family: 'N', resultCode: 'N', priority: '3', code: 'DM501', description: 'Carrier to update member field', status: 'ready' },
  { order: 27, ruleName: 'RuleN2', selectedRuleId: 'N2000', family: 'N', resultCode: 'N', priority: '3', code: 'DM508', description: 'Carrier to update member field', status: 'ready' },
  { order: 28, ruleName: 'RuleN3', selectedRuleId: 'N3000', family: 'N', resultCode: 'N', priority: '3', code: 'DM509', description: 'Carrier to update member field', status: 'ready' },
  { order: 29, ruleName: 'RuleN4', selectedRuleId: 'N4000', family: 'N', resultCode: 'N', priority: '3', code: 'DM502', description: 'OPM to update member field', status: 'ready' },
  { order: 30, ruleName: 'RuleN5', selectedRuleId: 'N5000', family: 'N', resultCode: 'N', priority: '3', code: 'DM503', description: 'OPM to update member field', status: 'ready' },
  { order: 31, ruleName: 'RuleN4_1', selectedRuleId: 'N4000-1', family: 'N', resultCode: 'N', priority: '3', code: 'DM001', description: 'OPM to update member field', status: 'ready' },
  { order: 32, ruleName: 'RuleN5_1', selectedRuleId: 'N5000-1', family: 'N', resultCode: 'N', priority: '3', code: 'DM002', description: 'OPM to update member field', status: 'ready' },
  { order: 33, ruleName: 'RuleN5_2', selectedRuleId: 'N5000-2', family: 'N', resultCode: 'N', priority: '3', code: 'AE014', description: 'OPM to correct date of death and coverage end', status: 'ready' },
  { order: 34, ruleName: 'RuleN6', selectedRuleId: 'N6000', family: 'N', resultCode: 'N', priority: '3', code: 'DM003', description: 'OPM to update member SSN', status: 'ready' },
  { order: 35, ruleName: 'RuleN7', selectedRuleId: 'N7000', family: 'N', resultCode: 'N', priority: '3', code: 'DM004', description: 'OPM to update subscriber SSN', status: 'ready' },
  { order: 36, ruleName: 'RuleN8', selectedRuleId: 'N8000', family: 'N', resultCode: 'N', priority: '3', code: 'DM505', description: 'Carrier to update member SSN', status: 'ready' },
  { order: 37, ruleName: 'RuleN9', selectedRuleId: 'N9000', family: 'N', resultCode: 'N', priority: '3', code: 'DM506', description: 'Carrier to update subscriber SSN', status: 'ready' },
  { order: 38, ruleName: 'RuleN91', selectedRuleId: 'N91000', family: 'N', resultCode: 'N', priority: '3', code: 'DM512', description: 'No action required', status: 'ready' },
  { order: 39, ruleName: 'RuleN92', selectedRuleId: 'N92000', family: 'N', resultCode: 'N', priority: '3', code: 'DM507', description: 'Carrier to update mailing address', status: 'ready' },
  { order: 40, ruleName: 'RuleN10', selectedRuleId: 'N10000', family: 'N', resultCode: 'N', priority: '3', code: 'DM006', description: 'OPM to update gender', status: 'ready' },
  { order: 41, ruleName: 'RuleN11', selectedRuleId: 'N11000', family: 'N', resultCode: 'N', priority: '3', code: 'DM510', description: 'Carrier to update gender', status: 'ready' },
  { order: 42, ruleName: 'RuleN12', selectedRuleId: 'N12000', family: 'N', resultCode: 'N', priority: '1', code: 'AE999', description: 'Manual business review', status: 'ready' },
  { order: 43, ruleName: 'RuleN13', selectedRuleId: 'N13000', family: 'N', resultCode: 'N', priority: '1', code: 'AE501', description: 'Carrier to process enrollment transaction', status: 'ready' },
  { order: 44, ruleName: 'RuleN14', selectedRuleId: 'N14000', family: 'N', resultCode: 'N', priority: '1', code: 'AE504', description: 'No action required', status: 'ready' },
  { order: 45, ruleName: 'RuleN15', selectedRuleId: 'N15000', family: 'N', resultCode: 'N', priority: '3', code: 'DM007', description: 'OPM to update birth date', status: 'ready' },
  { order: 46, ruleName: 'RuleN16', selectedRuleId: 'N16000', family: 'N', resultCode: 'N', priority: '3', code: 'DM504', description: 'Carrier to update birth date', status: 'ready' },

  { order: 47, ruleName: 'RuleCatchAE', selectedRuleId: 'AE-1', family: 'CatchAll', resultCode: 'F', priority: '1', code: 'AE*', description: 'Active enrollment mismatch', status: 'ready' },
  { order: 48, ruleName: 'RuleCatchAC', selectedRuleId: 'AC-2', family: 'CatchAll', resultCode: 'I', priority: '2', code: 'AC*', description: 'Active carrier enrollment mismatch', status: 'ready' },
  { order: 49, ruleName: 'RuleCatchDM', selectedRuleId: 'DM-3', family: 'CatchAll', resultCode: 'N', priority: '3', code: 'DM*', description: 'Active demographic mismatch', status: 'ready' },
  { order: 50, ruleName: 'RuleCatchCE', selectedRuleId: 'CE-4', family: 'CatchAll', resultCode: 'F', priority: '4', code: 'CE*', description: 'Cancelled enrollment mismatch', status: 'ready' },
  { order: 51, ruleName: 'DefaultRule', selectedRuleId: 'No_rule99999', family: 'Default', resultCode: 'N', priority: '1', code: '0000', description: 'No Rules Applied', status: 'ready' }
];

const additionalValidationScenarios = [
  {
    id: 'VAL-001-PrimaryFieldCount72',
    scenario: 'Reject invocation with 72-field RCNO row',
    category: 'contract-validation',
    expected: {
      outcome: 'blockingValidationError',
      errorCode: 'INVALID_RCNO_FIELD_COUNT',
      errorMessage: 'Primary RCNO field count must be exactly 73.'
    }
  },
  {
    id: 'VAL-002-MalformedLookupRow',
    scenario: 'Reject malformed MDW lookup candidate',
    category: 'contract-validation',
    expected: {
      outcome: 'blockingValidationError',
      errorCode: 'INVALID_LOOKUP_FIELD_COUNT',
      errorMessage: 'Lookup candidate violates canonical contract.'
    }
  },
  {
    id: 'VAL-003-ConflictingDuplicateMembership',
    scenario: 'Reject conflicting duplicate membership candidates',
    category: 'determinism-validation',
    expected: {
      outcome: 'blockingValidationError',
      errorCode: 'AMBIGUOUS_LOOKUP_DUPLICATE',
      errorMessage: 'Conflicting duplicate membership candidates found.'
    }
  },
  {
    id: 'VAL-004-ConflictingDuplicateRecent834',
    scenario: 'Reject conflicting duplicate recent enrollment candidates',
    category: 'determinism-validation',
    expected: {
      outcome: 'blockingValidationError',
      errorCode: 'AMBIGUOUS_LOOKUP_DUPLICATE',
      errorMessage: 'Conflicting duplicate recent enrollment candidates found.'
    }
  },
  {
    id: 'VAL-005-NoRuleSelectedImpossible',
    scenario: 'Engine must always resolve one rule or explicit error',
    category: 'engine-validation',
    expected: {
      outcome: 'blockingValidationError',
      errorCode: 'RULE_SELECTION_FAILED',
      errorMessage: 'No rule selected and no default applied.'
    }
  },
  {
    id: 'VAL-006-InputMutationGuard',
    scenario: 'Input arrays must remain unchanged after execution',
    category: 'immutability-validation',
    expected: {
      outcome: 'success',
      invariant: 'no-input-mutation'
    }
  },
  {
    id: 'VAL-007-N12ApprovedDefault',
    scenario: 'N12 uses the approved default code',
    category: 'business-validation',
    expected: {
      outcome: 'success',
      selectedRuleId: 'N12000',
      code: 'AE999'
    }
  },
  {
    id: 'VAL-008-I4I5CoverageDiscriminator',
    scenario: 'I4/I5 use active membership coverage as the discriminator',
    category: 'business-validation',
    expected: {
      outcome: 'success',
      discriminator: 'membership-coverage-active-on-business-date'
    }
  },
  {
    id: 'VAL-009-I6I7CoverageDiscriminator',
    scenario: 'I6/I7 use active membership coverage as the discriminator',
    category: 'business-validation',
    expected: {
      outcome: 'success',
      discriminator: 'membership-coverage-active-on-business-date'
    }
  },
  {
    id: 'VAL-010-AddressStandardizerRequiredForN91N92',
    scenario: 'N91/N92 requires configured deterministic address standardizer',
    category: 'business-validation',
    expected: {
      outcome: 'blockingValidationError',
      errorCode: 'ADDRESS_STANDARDIZER_REQUIRED',
      errorMessage: 'Address standardizer configuration is required for N91/N92.'
    }
  }
];

function makePredicateHints(rule) {
  const hints = [];
  if (rule.family === 'A') {
    hints.push('Set RCNO column 4 result to M.');
  }
  if (rule.family === 'B') {
    hints.push('Ensure RuleA does not match.');
    hints.push('Provide prior RCNA candidate with exact RCNO columns 1-73 match.');
  }
  if (rule.family === 'F') {
    hints.push('Set RCNO column 4 result to F.');
    hints.push('Satisfy specific F-family predicate for this rule while failing prior rules.');
  }
  if (rule.family === 'I') {
    hints.push('Set RCNO column 4 result to I.');
    hints.push('Satisfy specific I-family predicate for this rule while failing prior rules.');
  }
  if (rule.family === 'N') {
    hints.push('Set RCNO column 4 result to N.');
    hints.push('Satisfy specific N-family predicate for this rule while failing prior rules.');
  }
  if (rule.family === 'CatchAll') {
    hints.push('Ensure all catalog rules fail, then satisfy catch-all precondition.');
  }
  if (rule.family === 'Default') {
    hints.push('Ensure no catalog or catch-all rule conditions match.');
  }
  return hints;
}

function buildRuleCase(rule) {
  const id = `CAT-${String(rule.order).padStart(3, '0')}-${rule.selectedRuleId.replace(/[^A-Za-z0-9]/g, '_')}`;

  const base = {
    id,
    scenario: `Rule-catalog coverage for ${rule.ruleName} (${rule.selectedRuleId})`,
    category: 'rule-catalog',
    ruleOrder: rule.order,
    ruleName: rule.ruleName,
    status: rule.status,
    input: {
      rcnoTemplate: 'baselineRcnoTemplate',
      rcnoOverrides: {
        RCNO_Subscriber_ID_Result: rule.resultCode
      },
      mdwEnrollmentCandidates: [],
      epds834Candidates: [],
      priorRcnaCandidates: [],
      predicateHints: makePredicateHints(rule)
    }
  };

  if (rule.selectedRuleId === 'B200') {
    base.input.priorRcnaCandidates = [
      {
        matchesCurrentRcnoColumns1to73: true,
        Priority: formatPriorityDisplay('4'),
        PSHB_Code: formatNoticeCodeDisplay('CE001'),
        Code_Description: 'OPM to send 834 cancellation',
        Aging_Months: '2',
        sourcePriorRcnaId: 'PRIOR-B200-01'
      }
    ];

    return {
      ...base,
      expected: {
        outcome: 'success',
        selectedRuleId: rule.selectedRuleId,
        workingRcna: {
          Priority: formatPriorityDisplay('4'),
          PSHB_Code: formatNoticeCodeDisplay('CE001'),
          Code_Description: 'OPM to send 834 cancellation',
          Notes: '',
          Aging_Months: '3'
        },
        outboundRcna: {
          Priority: formatPriorityDisplay('4'),
          PSHB_Code: formatNoticeCodeDisplay('CE001'),
          Code_Description: 'OPM to send 834 cancellation'
        }
      }
    };
  }

  return {
    ...base,
    expected: {
      outcome: 'success',
      selectedRuleId: rule.selectedRuleId,
      workingRcna: {
        Priority: formatPriorityDisplay(rule.priority),
        PSHB_Code: formatNoticeCodeDisplay(rule.code),
        Code_Description: rule.description,
        Notes: '',
        Aging_Months: '0'
      },
      outboundRcna: {
        Priority: formatPriorityDisplay(rule.priority),
        PSHB_Code: formatNoticeCodeDisplay(rule.code),
        Code_Description: rule.description
      }
    }
  };
}

const strictOrderedSubset = orderedRules
  .filter((rule) => rule.order >= 1 && rule.order <= 9)
  .map((rule) => ({
    order: rule.order,
    ruleName: rule.ruleName,
    selectedRuleId: rule.selectedRuleId
  }));

const ruleCases = orderedRules.map(buildRuleCase);

const output = {
  document: 'RCNO-RCNA-Complete-TestCases',
  version: '1.0.0',
  generatedFrom: 'RCNO-RCNA-834-Detailed-Design.md',
  notes: [
    'Comprehensive suite for RCNO-to-RCNA test design coverage.',
    'Includes all 51 ordered rules from the rule catalog.',
    'Includes additional validation and determinism scenarios.',
    'Some scenarios are marked as blocked or requiring business clarification based on Outstanding Questions.'
  ],
  strictOrderedCoreSubset: strictOrderedSubset,
  coverageSummary: {
    totalCatalogRules: orderedRules.length,
    totalCatalogCases: ruleCases.length,
    totalValidationCases: additionalValidationScenarios.length,
    totalTestCases: ruleCases.length + additionalValidationScenarios.length,
    blockedOrClarificationRequiredRules: orderedRules
      .filter((r) => r.status !== 'ready')
      .map((r) => ({ order: r.order, selectedRuleId: r.selectedRuleId, status: r.status }))
  },
  fieldSchemas: {
    rcnoReference: 'Use baselineRcnoTemplate from RCNO-RCNA-EPDS-MDW-TestCases.json',
    mdwReference: 'Use canonical MDW enrollment candidate fields from section 8.4.2',
    epdsReference: 'Use canonical EPDS recent enrollment fields from section 8.4.1'
  },
  testCases: [
    ...ruleCases,
    ...additionalValidationScenarios
  ]
};

await fs.writeFile(outPath, JSON.stringify(output, null, 2), 'utf8');
console.log(`Wrote ${outPath}`);
console.log(`Catalog rule cases: ${ruleCases.length}`);
console.log(`Additional validation cases: ${additionalValidationScenarios.length}`);
console.log(`Total cases: ${output.coverageSummary.totalTestCases}`);
