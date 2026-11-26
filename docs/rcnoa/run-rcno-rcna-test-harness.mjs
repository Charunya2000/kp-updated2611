import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_TEST_FILE = path.join('docs', 'rcnoa', 'RCNO-RCNA-EPDS-MDW-TestCases.json');

function parseArgs(argv) {
  const args = {
    file: DEFAULT_TEST_FILE,
    caseId: null,
    adapter: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--file' && argv[i + 1]) {
      args.file = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--case' && argv[i + 1]) {
      args.caseId = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--adapter' && argv[i + 1]) {
      args.adapter = argv[i + 1];
      i += 1;
    }
  }

  return args;
}

function normalizeAddressLine(value = '') {
  return String(value || '')
    .toUpperCase()
    .replace(/\./g, '')
    .replace(/\bSTREET\b/g, 'ST')
    .replace(/\bAVENUE\b/g, 'AVE')
    .replace(/\bROAD\b/g, 'RD')
    .replace(/\bDRIVE\b/g, 'DR')
    .replace(/\s+/g, ' ')
    .trim();
}

function isAddressEquivalent(rcnoRecord, membershipRecord) {
  if (!membershipRecord) return false;

  const left = [
    normalizeAddressLine(rcnoRecord.PSHBS_Address_Line1),
    normalizeAddressLine(rcnoRecord.PSHBS_Address_Line2),
    normalizeAddressLine(rcnoRecord.PSHBS_Address_Line3),
    String(rcnoRecord.PSHBS_City || '').toUpperCase().trim(),
    String(rcnoRecord.PSHBS_State || '').toUpperCase().trim(),
    String(rcnoRecord.PSHBS_ZIP || '').trim(),
    String(rcnoRecord.PSHBS_Country || 'US').toUpperCase().trim()
  ].join('|');

  const right = [
    normalizeAddressLine(membershipRecord.Address_Line1),
    normalizeAddressLine(membershipRecord.Address_Line2),
    normalizeAddressLine(membershipRecord.Address_Line3),
    String(membershipRecord.City || '').toUpperCase().trim(),
    String(membershipRecord.State || '').toUpperCase().trim(),
    String(membershipRecord.ZIP || '').trim(),
    String(membershipRecord.Country || 'US').toUpperCase().trim()
  ].join('|');

  return left === right;
}

function hasRecent834Match(recentEnrollmentCandidates, rcnoRecord, processedFlag = null) {
  const targetSsn = String(rcnoRecord.PSHBS_Subscriber_SSN || rcnoRecord.PSHBS_Member_SSN || '').trim();
  const targetStart = String(rcnoRecord.PSHBS_Coverage_Start_Date || '').trim();
  const targetEnd = String(rcnoRecord.PSHBS_Coverage_End_Date || '').trim();

  return (Array.isArray(recentEnrollmentCandidates) ? recentEnrollmentCandidates : []).some((candidate) => {
    const sameSsn = String(candidate?.Member_or_Subscriber_SSN || '').trim() === targetSsn;
    const sameStart = String(candidate?.Coverage_Start_Date || '').trim() === targetStart;
    const sameEnd = String(candidate?.Coverage_End_Date || '').trim() === targetEnd;
    const processedOk = processedFlag === null
      ? true
      : String(candidate?.['834_Processed'] || '').trim().toUpperCase() === processedFlag;

    return sameSsn && sameStart && sameEnd && processedOk;
  });
}

function buildRcnaResult(rcnoRecord, priority, code, description, ruleId, agingMonths = '0') {
  return {
    selectedRuleId: ruleId,
    workingRcnaRecord: {
      rcnoColumns1to73: rcnoRecord,
      Priority: String(priority),
      PSHB_Code: String(code),
      Code_Description: String(description),
      Notes: '',
      Aging_Months: String(agingMonths)
    },
    outboundRcnaRecord: {
      rcnoColumns1to73: rcnoRecord,
      Priority: String(priority),
      PSHB_Code: String(code),
      Code_Description: String(description)
    }
  };
}

function parseAging(value) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function referenceTransformRow({ rcnoRecord, membershipCandidates, recentEnrollmentCandidates, priorRcnaCandidates }) {
  const resultCode = String(rcnoRecord?.RCNO_Subscriber_ID_Result || '').trim().toUpperCase();
  const membership = Array.isArray(membershipCandidates) ? membershipCandidates : [];
  const prior = Array.isArray(priorRcnaCandidates) ? priorRcnaCandidates : [];

  if (resultCode === 'M') {
    return buildRcnaResult(rcnoRecord, '5', 'MM', 'Matches (no action required)', 'A100', '0');
  }

  const unchangedPrior = prior.find((row) => row?.matchesCurrentRcnoColumns1to73 === true);
  if (unchangedPrior) {
    const aging = parseAging(unchangedPrior.Aging_Months) + 1;
    return buildRcnaResult(
      rcnoRecord,
      unchangedPrior.Priority,
      unchangedPrior.PSHB_Code,
      unchangedPrior.Code_Description,
      'B200',
      String(aging)
    );
  }

  if (resultCode === 'F') {
    const hasMembership = membership.some((m) => String(m?.kp_mrn || '').trim() === String(rcnoRecord?.MENR_Member_ID || '').trim());
    const has834Y = hasRecent834Match(recentEnrollmentCandidates, rcnoRecord, 'Y');
    const has834N = hasRecent834Match(recentEnrollmentCandidates, rcnoRecord, 'N');
    const has834Any = hasRecent834Match(recentEnrollmentCandidates, rcnoRecord, null);

    if (!hasMembership && has834Y) {
      return buildRcnaResult(rcnoRecord, '1', 'AE500', 'Carrier to investigate and reprocess the 834', 'F13000', '0');
    }
    if (!hasMembership && has834N) {
      return buildRcnaResult(rcnoRecord, '1', 'AE501', 'Carrier to process the 834 enrollment', 'F14000', '0');
    }
    if (!hasMembership && !has834Any) {
      return buildRcnaResult(rcnoRecord, '1', 'AE013', 'OPM to investigate why an 834 was not sent', 'F20000', '0');
    }
  }

  if (resultCode === 'I') {
    const hasMembership = membership.some((m) => String(m?.kp_mrn || '').trim() === String(rcnoRecord?.MENR_Member_ID || '').trim());
    const has834Any = hasRecent834Match(recentEnrollmentCandidates, rcnoRecord, null);
    if (hasMembership && !has834Any) {
      return buildRcnaResult(rcnoRecord, '2', 'AC004', 'No 834 termination/cancel received; OPM to investigate', 'I2000', '0');
    }
  }

  if (resultCode === 'N') {
    const matchedMembership = membership.find((m) => String(m?.kp_mrn || '').trim() === String(rcnoRecord?.MENR_Member_ID || '').trim());
    const memberIdResult = String(rcnoRecord?.RCNO_Member_ID_Result || '').trim().toUpperCase();

    if (!matchedMembership && memberIdResult === 'N') {
      return buildRcnaResult(rcnoRecord, '1', 'KICKO', 'MRN not found on an N record', 'N0000', '0');
    }

    const addressResultFields = [
      'RCNO_Address_Line1_Result',
      'RCNO_Address_Line2_Result',
      'RCNO_Address_Line3_Result',
      'RCNO_City_Result',
      'RCNO_State_Result',
      'RCNO_ZIP_Result',
      'RCNO_Country_Result'
    ];
    const anyAddressN = addressResultFields.some((f) => String(rcnoRecord?.[f] || '').trim().toUpperCase() === 'N');
    if (anyAddressN && isAddressEquivalent(rcnoRecord, matchedMembership)) {
      return buildRcnaResult(rcnoRecord, '3', 'DM512', 'No action required', 'N91000', '0');
    }

    const planMismatch = String(rcnoRecord?.RCNO_Plan_Code_Result || '').trim().toUpperCase() === 'N';
    const startMismatch = String(rcnoRecord?.RCNA_Coverage_Start_Result || '').trim().toUpperCase() === 'N';
    const endMismatch = String(rcnoRecord?.RCNO_Coverage_End_Result || '').trim().toUpperCase() === 'N';

    if (planMismatch && startMismatch && endMismatch) {
      return buildRcnaResult(rcnoRecord, '1', 'AE999', 'Manual business review', 'N12000', '0');
    }
  }

  return buildRcnaResult(rcnoRecord, '1', '0000', 'No Rules Applied', 'No_rule99999', '0');
}

function deepMerge(base, override) {
  const left = base && typeof base === 'object' && !Array.isArray(base) ? { ...base } : {};
  const right = override && typeof override === 'object' && !Array.isArray(override) ? override : {};

  Object.keys(right).forEach((key) => {
    const rightValue = right[key];
    const leftValue = left[key];
    if (
      leftValue && rightValue
      && typeof leftValue === 'object'
      && typeof rightValue === 'object'
      && !Array.isArray(leftValue)
      && !Array.isArray(rightValue)
    ) {
      left[key] = deepMerge(leftValue, rightValue);
    } else {
      left[key] = rightValue;
    }
  });

  return left;
}

function pickDerived(rcnaRecord) {
  return {
    Priority: String(rcnaRecord?.Priority ?? ''),
    PSHB_Code: String(rcnaRecord?.PSHB_Code ?? ''),
    Code_Description: String(rcnaRecord?.Code_Description ?? ''),
    Notes: String(rcnaRecord?.Notes ?? ''),
    Aging_Months: String(rcnaRecord?.Aging_Months ?? '')
  };
}

function pickOutbound(rcnaRecord) {
  return {
    Priority: String(rcnaRecord?.Priority ?? ''),
    PSHB_Code: String(rcnaRecord?.PSHB_Code ?? ''),
    Code_Description: String(rcnaRecord?.Code_Description ?? '')
  };
}

function diffObject(expected, actual) {
  const keys = [...new Set([...Object.keys(expected || {}), ...Object.keys(actual || {})])];
  const diffs = [];
  keys.forEach((key) => {
    const e = expected?.[key];
    const a = actual?.[key];
    if (String(e ?? '') !== String(a ?? '')) {
      diffs.push(`${key}: expected='${e}' actual='${a}'`);
    }
  });
  return diffs;
}

async function loadAdapter(adapterPath) {
  if (!adapterPath) return null;
  const resolved = path.isAbsolute(adapterPath) ? adapterPath : path.resolve(process.cwd(), adapterPath);
  const mod = await import(resolved);

  if (typeof mod.transformRow === 'function') {
    return mod.transformRow;
  }
  if (mod.default && typeof mod.default.transformRow === 'function') {
    return mod.default.transformRow;
  }

  throw new Error(`Adapter module does not export transformRow: ${resolved}`);
}

function printHeader(label) {
  console.log('='.repeat(80));
  console.log(label);
  console.log('='.repeat(80));
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const raw = await fs.readFile(args.file, 'utf8');
  const suite = JSON.parse(raw);

  const transformRow = await loadAdapter(args.adapter) || referenceTransformRow;
  const testCases = (Array.isArray(suite.testCases) ? suite.testCases : [])
    .filter((tc) => (args.caseId ? tc.id === args.caseId : true));

  if (testCases.length === 0) {
    throw new Error(args.caseId
      ? `No test case found with id '${args.caseId}'.`
      : 'No test cases found.');
  }

  printHeader(`RCNO/RCNA Harness: ${suite.document || 'Unnamed suite'}`);
  console.log(`Source file: ${args.file}`);
  console.log(`Engine: ${args.adapter ? `adapter (${args.adapter})` : 'built-in reference engine'}`);
  console.log(`Cases to run: ${testCases.length}`);
  console.log('');

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    const baselineName = tc?.input?.rcnoTemplate;
    const baseline = suite?.templates?.[baselineName] || {};
    const rcnoRecord = deepMerge(baseline, tc?.input?.rcnoOverrides || {});

    const payload = {
      rcnoRecord,
      membershipCandidates: tc?.input?.mdwEnrollmentCandidates || [],
      recentEnrollmentCandidates: tc?.input?.epds834Candidates || [],
      priorRcnaCandidates: tc?.input?.priorRcnaCandidates || [],
      context: {
        correlationId: `HARNESS-${tc.id}`,
        workItemId: tc.id,
        businessDate: '20250801',
        ruleCatalogVersion: 'draft-0724',
        configurationVersion: 'harness-v1'
      }
    };

    const expectedOutcome = String(tc?.expected?.outcome || '').trim();
    const expectedRule = String(tc?.expected?.selectedRuleId || '').trim();

    try {
      const actual = await transformRow(payload);
      const actualRule = String(actual?.selectedRuleId || '').trim();

      if (expectedOutcome !== 'success') {
        failed += 1;
        console.log(`FAIL ${tc.id}: expected outcome '${expectedOutcome}' but transform succeeded`);
        continue;
      }

      if (actualRule !== expectedRule) {
        failed += 1;
        console.log(`FAIL ${tc.id}: selectedRuleId expected '${expectedRule}' actual '${actualRule}'`);
        continue;
      }

      const expectedWorking = tc?.expected?.workingRcna || {};
      const actualWorking = pickDerived(actual?.workingRcnaRecord || {});
      const workingDiffs = diffObject(expectedWorking, actualWorking);

      const expectedOutbound = tc?.expected?.outboundRcna || {};
      const actualOutbound = pickOutbound(actual?.outboundRcnaRecord || {});
      const outboundDiffs = diffObject(expectedOutbound, actualOutbound);

      if (workingDiffs.length || outboundDiffs.length) {
        failed += 1;
        console.log(`FAIL ${tc.id}: derived field mismatch`);
        workingDiffs.forEach((d) => console.log(`  working -> ${d}`));
        outboundDiffs.forEach((d) => console.log(`  outbound -> ${d}`));
        continue;
      }

      passed += 1;
      console.log(`PASS ${tc.id} -> ${actualRule}`);
    } catch (error) {
      if (expectedOutcome === 'blockingValidationError') {
        const expectedCode = String(tc?.expected?.errorCode || '').trim();
        const expectedRuleId = String(tc?.expected?.selectedRuleId || '').trim();
        const actualCode = String(error?.code || '').trim();
        const actualRuleId = String(error?.selectedRuleId || '').trim();

        if (expectedCode === actualCode && expectedRuleId === actualRuleId) {
          passed += 1;
          console.log(`PASS ${tc.id} -> blockingValidationError (${actualCode})`);
        } else {
          failed += 1;
          console.log(`FAIL ${tc.id}: blocking error mismatch`);
          console.log(`  expected code='${expectedCode}' rule='${expectedRuleId}'`);
          console.log(`  actual   code='${actualCode}' rule='${actualRuleId}' message='${error?.message || ''}'`);
        }
      } else {
        failed += 1;
        console.log(`FAIL ${tc.id}: unexpected error '${error?.message || error}'`);
      }
    }
  }

  console.log('');
  console.log('-'.repeat(80));
  console.log(`Result: ${passed} passed, ${failed} failed, ${testCases.length} total`);
  console.log('-'.repeat(80));

  if (failed > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error('Harness failed:', error.message || error);
  process.exitCode = 1;
});
