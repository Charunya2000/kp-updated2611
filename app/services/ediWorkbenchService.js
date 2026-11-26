import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pipeline } from 'node:stream/promises';
import { getBlockBlobClient } from './blobStorageService.js';
import { normalizeSubscriberBatchSize } from '../utils/ediWorkbenchParserOptions.js';

const nodeRequire = createRequire(import.meta.url);
// efss is a vendored ClojureScript/Google-Closure bundle that boots via dynamic
// require(path.join(__dirname, ...)) calls. Neither the dev bundler (Turbopack) nor the
// prod bundler (webpack) can trace those, so it must be loaded by plain Node at runtime.
// Turbopack aggressively constant-folds process.cwd()/path.join, so a dynamic specifier
// alone is not enough; we also invoke the require indirectly via .call(...) so the bundler
// does not recognize it as a traceable require(...) expression and never tries to compile
// the Closure tree. The path is resolved from process.cwd() (project root, same assumption
// as the validation worker) so it works in both dev and prod builds.
const efssEntryPath = path.join(process.cwd(), 'app', 'services', 'efss', 'npm-lib', 'index.js');
const x12 = nodeRequire.call(null, efssEntryPath);
const efssPackage = nodeRequire.call(null, path.join(process.cwd(), 'app', 'services', 'efss', 'npm-lib', 'package.json'));
const SSN_DIGITS_LENGTH = 9;

export function supportsEditableCompanionGuide() {
  return x12?.capabilities?.editableCompanionGuide === true
    && x12?.capabilities?.editableCompanionGuideSchemaVersion === 1
    && typeof x12?.parseCompanionGuideEditable === 'function'
    && typeof x12?.validateEditableCompanionGuide === 'function';
}

function normalizeDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeToken(value) {
  return String(value || '').trim();
}

function toBoolean(value, fallback) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (lowered === 'true' || lowered === '1' || lowered === 'yes' || lowered === 'on') {
      return true;
    }
    if (lowered === 'false' || lowered === '0' || lowered === 'no' || lowered === 'off') {
      return false;
    }
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return fallback;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

export function normalizeEdiParseOptions(explicitOptions, runConfig, template) {
  const source = {
    ...(template?.parserOptions || {}),
    ...((runConfig?.effectiveValues && runConfig.effectiveValues.parserOptions) || {}),
    ...(explicitOptions || {}),
  };

  const dbValidation = toBoolean(
    firstDefined(source.dbValidation, source['dbValidation?']),
    toBoolean(process.env.DB_VALIDATION, false),
  );

  const envName = String(
    firstDefined(source.envName, source['env-name'], process.env.envName, process.env.ENV_NAME) || '',
  ).trim();

  const subscriberOnlyDbValidation = dbValidation
    ? true
    : toBoolean(
        firstDefined(
          source.subscriberOnlyDbValidation,
          source['subscriberOnlyDbValidation?'],
          source['subscriber-only-db-validation?'],
        ),
        toBoolean(process.env.SUBSCRIBER_ONLY_DB_VALIDATION, true),
      );

  const singleQueryDbValidation = true;
  const compareSingleQueryVsLegacy = false;

  const includeLookupSql = toBoolean(
    firstDefined(source.includeLookupSql, source['includeLookupSql?']),
    false,
  );

  const logMemory = toBoolean(process.env.EFSS_LOG_MEMORY, false);
  const subscriberBatchSize = normalizeSubscriberBatchSize(source.subscriberBatchSize);

  return {
    dbValidation,
    envName,
    subscriberOnlyDbValidation,
    singleQueryDbValidation,
    compareSingleQueryVsLegacy,
    includeLookupSql,
    logMemory,
    subscriberBatchSize,
    streaming: true,
    includeParsed: false,
    includeEnriched: false,
    collectInvalidFindings: false,
    collectSubscriberStatuses: false,
    findingBatchSize: 250,
  };
}

export function assertEfssBoundedMemoryCapabilities(capabilities = x12?.capabilities) {
  if (capabilities?.streaming !== true
    || capabilities?.subscriberBoundedStreaming !== true
    || capabilities?.subscriberBatching !== true
    || capabilities?.defaultSubscriberBatchSize !== 1
    || capabilities?.compactInvalidFindings !== true
    || capabilities?.subscriberStatusCollectionControl !== true
    || capabilities?.findingBatchEvents !== true
    || capabilities?.isaProgressEvents !== true
    || capabilities?.treeOutputControls !== true) {
    throw new Error('Loaded EFS-S raw library lacks memory-efficient Workbench support');
  }
}

export function buildEfssValidationOptions(baseOptions, effectiveParseOptions) {
  return {
    ...baseOptions,
    ...effectiveParseOptions,
    streaming: true,
    includeParsed: false,
    includeEnriched: false,
    collectInvalidFindings: false,
    collectSubscriberStatuses: false,
    findingBatchSize: 250,
  };
}

export function dbValidationTelemetry(result) {
  return {
    singleQueryDbValidationEnabled:
      result?.report?.['single-query-db-validation-enabled'],
    subscriberBatchSize: result?.report?.['subscriber-batch-size'],
    singleQueryPrefetchSummary:
      result?.report?.['single-query-prefetch-summary'],
  };
}

export function assertDbValidationTelemetry(result, dbValidationEnabled) {
  const telemetry = dbValidationTelemetry(result);
  if (dbValidationEnabled && telemetry.singleQueryDbValidationEnabled !== true) {
    throw new Error('DB validation did not use EFS-S single-query mode');
  }
  return telemetry;
}

export function assertStrictCollectionTelemetry(result) {
  const report = result?.report || {};
  if (report['invalid-findings-collected'] !== false
    || report['subscriber-statuses-collected'] !== false) {
    throw new Error('EFS-S did not honor bounded-memory collection controls');
  }
}

export function normalizeFinding(value = {}) {
  return {
    path: value.path,
    reason: value.reason,
    failedValue: value['failed-value'] ?? value.failedValue,
    valueProvided: value['value-provided'] ?? value.valueProvided,
    segment: value.segment,
    ref: value.ref,
    name: value.name,
    loopName: value['loop-name'] ?? value.loopName,
    loopDescription: value['loop-description'] ?? value.loopDescription,
    locatorTrail: value['locator-trail'] ?? value.locatorTrail,
    subscriberIndex: value['subscriber-index'] ?? value.subscriberIndex,
    subscriberSsn: value['subscriber-ssn'] ?? value.subscriberSsn,
    isaIndex: value['isa-index'] ?? value.isaIndex,
  };
}

export function normalizeCompactInvalidFindings(pipelineResult) {
  const source = pipelineResult?.invalidFindings || pipelineResult?.['invalid-findings'];
  if (!Array.isArray(source)) {
    throw new Error(
      'Installed EFS-S package does not support bounded-memory streaming with compact invalidFindings',
    );
  }

  return source.map(normalizeFinding);
}

export function normalizeEfssProgressEvent(event) {
  if (!event || typeof event !== 'object') {
    return null;
  }

  const eventType = String(event['event-type'] || '').trim();
  const rawPercent = Number(event['percent-complete']);
  const normalizedPercent = Number.isFinite(rawPercent)
    ? Math.max(0, Math.min(100, rawPercent))
    : null;
  const overallJobPercent = normalizedPercent === null
    ? 58
    : Math.min(99, 58 + Math.round(normalizedPercent * 0.41));
  const statusText = String(event.status || '').trim();
  const isaIndex = Number(event['isa-index']);
  const subscriberIndex = Number(event['subscriber-index']);
  const processed = Number(event['processed-subscribers']);
  const total = Number(event['total-subscribers']);
  const indexText = Number.isFinite(subscriberIndex) && subscriberIndex > 0
    ? `subscriber ${subscriberIndex}`
    : 'subscriber';
  const progressText = Number.isFinite(processed) && Number.isFinite(total) && total > 0
    ? `(${processed}/${total})`
    : '';
  let step;

  if (eventType === 'isa-started') {
    step = `Processing ISA ${Number.isFinite(isaIndex) ? isaIndex : ''}`.trim();
  } else if (eventType === 'isa-parsed') {
    step = `Parsed ISA ${Number.isFinite(isaIndex) ? isaIndex : ''}`.trim();
  } else if (eventType === 'isa-completed') {
    step = `Completed ISA ${Number.isFinite(isaIndex) ? isaIndex : ''}`.trim();
  } else {
    step = statusText
      ? `Validating ${indexText} ${progressText} - ${statusText}`.trim()
      : `Validating ${indexText} ${progressText}`.trim();
  }

  const isSubscriberEvent = eventType === 'subscriber-heartbeat'
    || eventType === 'subscriber-completed';
  const isIsaEvent = eventType === 'isa-started'
    || eventType === 'isa-parsed'
    || eventType === 'isa-completed';

  return {
    overallJobPercent,
    step,
    details: {
      subscriberProgress: isSubscriberEvent ? event : null,
      isaProgress: isIsaEvent ? event : null,
    },
  };
}

export function sanitizeEdiWorkbenchWorkerResult(result) {
  if (!result || typeof result !== 'object') {
    return result;
  }

  const workerResult = { ...result };
  delete workerResult.parsed;
  delete workerResult.parseTree;
  delete workerResult.enriched;
  delete workerResult.enrichedResult;
  delete workerResult.annotatedTree;
  delete workerResult.canonicalValidationReport;
  delete workerResult.invalidElements;
  delete workerResult.subscriberStatuses;

  return workerResult;
}

export function buildCompactEdiWorkbenchWorkerResult(result, runId) {
  const pipelineResult = result?.canonicalValidationReport || {};
  const report = pipelineResult.report || {};
  const dbTelemetry = dbValidationTelemetry(pipelineResult);

  return {
    type: 'validation-completed',
    runId,
    validationSummary: pipelineResult['validation-summary'] || result?.x12Validation || null,
    report: {
      validation: report.validation,
      lookupSummary: report['lookup-summary'],
      subscriberProgressSummary: report['subscriber-progress-summary'],
      subscriberCount: report['subscriber-count'],
      subscriberBatchSize: report['subscriber-batch-size'],
      singleQueryDbValidationEnabled: dbTelemetry.singleQueryDbValidationEnabled,
      singleQueryPrefetchSummary: dbTelemetry.singleQueryPrefetchSummary,
      invalidFindingsCollected: report['invalid-findings-collected'],
      subscriberStatusesCollected: report['subscriber-statuses-collected'],
      elapsedMs: report['elapsed-ms'],
      isaCount: report['isa-count'],
    },
    effectiveParseOptions: result?.executionContext?.parseOptions || null,
  };
}

function inferSegmentDelimiter(rawText) {
  return rawText.includes('~') ? '~' : '\n';
}

function inferElementSeparator(rawText) {
  const isaIndex = rawText.indexOf('ISA');
  if (isaIndex >= 0 && rawText.length > isaIndex + 3) {
    return rawText[isaIndex + 3];
  }

  return '*';
}

function splitSegments(rawText, segmentDelimiter) {
  return rawText
    .split(segmentDelimiter)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function splitElements(segment, elementSeparator) {
  return segment.split(elementSeparator).map((entry) => entry.trim());
}

function getSubscriberSsnFromSegmentElements(elements) {
  const segmentId = elements[0];

  if (segmentId === 'REF' && elements[1] === '0F') {
    const digits = normalizeDigits(elements[2]);
    return digits.length === SSN_DIGITS_LENGTH ? digits : null;
  }

  if (segmentId === 'NM1') {
    if (elements[8] === '34') {
      const digits = normalizeDigits(elements[9]);
      return digits.length === SSN_DIGITS_LENGTH ? digits : null;
    }

    for (let i = 7; i < 9; i += 1) {
      if (elements[i] === '34') {
        const digits = normalizeDigits(elements[i + 1]);
        return digits.length === SSN_DIGITS_LENGTH ? digits : null;
      }
    }
  }

  return null;
}

function extractComparableValuesFromMemberSegments(memberSegments, elementSeparator) {
  const result = {
    ssn: null,
    nm1: {
      NM101: null,
      NM102: null,
      NM103: null,
      NM104: null,
      NM105: null,
      NM106: null,
      NM107: null,
      NM108: null,
      NM109: null,
    },
    ref: {
      REF0F: null,
      REF1L: null,
      REFDX: null,
      REFZZ: null,
    },
  };

  memberSegments.forEach((segment) => {
    const elements = splitElements(segment, elementSeparator);
    const segmentId = elements[0];

    if (segmentId === 'REF') {
      const qualifier = elements[1];
      const refValue = normalizeToken(elements[2]);

      if (qualifier === '0F') {
        const digits = normalizeDigits(refValue);
        if (digits.length === SSN_DIGITS_LENGTH) {
          result.ref.REF0F = digits;
          result.ssn = result.ssn || digits;
        }
      }

      if (qualifier === '1L') {
        result.ref.REF1L = refValue;
      }

      if (qualifier === 'DX') {
        result.ref.REFDX = refValue;
      }

      if (qualifier === 'ZZ') {
        result.ref.REFZZ = refValue;
      }

      return;
    }

    if (segmentId !== 'NM1') {
      return;
    }

    if (elements[1] !== 'IL') {
      return;
    }

    result.nm1.NM101 = normalizeToken(elements[1]);
    result.nm1.NM102 = normalizeToken(elements[2]);
    result.nm1.NM103 = normalizeToken(elements[3]);
    result.nm1.NM104 = normalizeToken(elements[4]);
    result.nm1.NM105 = normalizeToken(elements[5]);
    result.nm1.NM106 = normalizeToken(elements[6]);
    result.nm1.NM107 = normalizeToken(elements[7]);
    result.nm1.NM108 = normalizeToken(elements[8]);
    result.nm1.NM109 = normalizeDigits(elements[9]);

    if (result.nm1.NM108 === '34' && result.nm1.NM109.length === SSN_DIGITS_LENGTH) {
      result.ssn = result.ssn || result.nm1.NM109;
    }
  });

  return result;
}

function patchSeSegment(seSegment, elementSeparator, segmentCount) {
  const elements = splitElements(seSegment, elementSeparator);
  const control = elements[2] || '';
  return ['SE', String(segmentCount), control].join(elementSeparator);
}

async function buildScopedEdiTempFileBySubscriberSsn(ediFilePath, targetSubscriberSsn) {
  const raw = await fs.readFile(ediFilePath, 'utf8');
  const segmentDelimiter = inferSegmentDelimiter(raw);
  const elementSeparator = inferElementSeparator(raw);
  const segments = splitSegments(raw, segmentDelimiter);
  const normalizedTarget = normalizeDigits(targetSubscriberSsn);

  if (!normalizedTarget || normalizedTarget.length !== SSN_DIGITS_LENGTH) {
    return {
      filePath: ediFilePath,
      metrics: {
        subscriberScanMode: 'unscoped',
        totalSubscribers: 0,
        matchedSubscribers: 0,
        keptSegments: segments.length,
        originalSegments: segments.length,
      },
      matchedSubscribers: [],
    };
  }

  const outputSegments = [];
  const matchedSubscribers = [];
  let inTransaction = false;
  let stSegment = null;
  let seSegment = null;
  let headerSegments = [];
  let currentMemberSegments = null;
  let keptMemberBlocks = [];
  let totalSubscribers = 0;

  const flushMember = () => {
    if (!inTransaction || !Array.isArray(currentMemberSegments)) {
      return;
    }

    totalSubscribers += 1;
    const comparable = extractComparableValuesFromMemberSegments(currentMemberSegments, elementSeparator);
    if (comparable.ssn === normalizedTarget) {
      keptMemberBlocks.push(currentMemberSegments);
      matchedSubscribers.push({
        subscriberIndex: totalSubscribers,
        ssn: comparable.ssn,
        nm1: comparable.nm1,
        ref: comparable.ref,
      });
    }

    currentMemberSegments = null;
  };

  const flushTransaction = () => {
    if (!inTransaction || !stSegment || !seSegment) {
      return;
    }

    const memberSegments = keptMemberBlocks.flat();
    const transactionSegments = [stSegment, ...headerSegments, ...memberSegments];
    const seCount = transactionSegments.length + 1;
    transactionSegments.push(patchSeSegment(seSegment, elementSeparator, seCount));
    outputSegments.push(...transactionSegments);

    inTransaction = false;
    stSegment = null;
    seSegment = null;
    headerSegments = [];
    currentMemberSegments = null;
    keptMemberBlocks = [];
  };

  segments.forEach((segment) => {
    const segmentId = splitElements(segment, elementSeparator)[0];

    if (!inTransaction) {
      if (segmentId === 'ST') {
        inTransaction = true;
        stSegment = segment;
        headerSegments = [];
        currentMemberSegments = null;
        keptMemberBlocks = [];
      } else {
        outputSegments.push(segment);
      }
      return;
    }

    if (segmentId === 'INS') {
      flushMember();
      currentMemberSegments = [segment];
      return;
    }

    if (segmentId === 'SE') {
      flushMember();
      seSegment = segment;
      flushTransaction();
      return;
    }

    if (Array.isArray(currentMemberSegments)) {
      currentMemberSegments.push(segment);
    } else {
      headerSegments.push(segment);
    }
  });

  const scopedRaw = `${outputSegments.join(segmentDelimiter)}${segmentDelimiter}`;
  const scopedPath = path.join(os.tmpdir(), `${Date.now()}-${Math.random().toString(36).slice(2)}-scoped.edi`);
  await fs.writeFile(scopedPath, scopedRaw, 'utf8');

  return {
    filePath: scopedPath,
    metrics: {
      subscriberScanMode: 'single-subscriber',
      totalSubscribers,
      matchedSubscribers: matchedSubscribers.length,
      keptSegments: outputSegments.length,
      originalSegments: segments.length,
    },
    matchedSubscribers,
  };
}

function buildStipulatedValueFindings({ stipulatedValues, matchedSubscribers }) {
  if (!stipulatedValues || !Array.isArray(matchedSubscribers) || matchedSubscribers.length === 0) {
    return [];
  }

  const findings = [];
  const nm1Input = stipulatedValues?.nm1 || {};
  const refInput = stipulatedValues?.ref || {};

  const compareText = (actual, expected) => normalizeToken(actual).toUpperCase() === normalizeToken(expected).toUpperCase();
  const compareDigits = (actual, expected) => normalizeDigits(actual) === normalizeDigits(expected);

  matchedSubscribers.forEach((subscriber, index) => {
    const trailPrefix = [`Stipulated values`, `Subscriber ${index + 1}`];

    const nm1Checks = [
      ['NM101', false],
      ['NM102', false],
      ['NM103', false],
      ['NM104', false],
      ['NM105', false],
      ['NM106', false],
      ['NM107', false],
      ['NM108', false],
      ['NM109', true],
    ];

    nm1Checks.forEach(([field, digitsOnly]) => {
      const expected = nm1Input[field];
      if (!expected) {
        return;
      }

      const actual = subscriber?.nm1?.[field] || null;
      const isMatch = digitsOnly
        ? compareDigits(actual, expected)
        : compareText(actual, expected);

      if (!isMatch) {
        findings.push({
          path: `stipulatedValues.nm1.${field}[${index}]`,
          reason: `${field} expected '${expected}' but found '${actual || ''}' for subscriber SSN ${subscriber.ssn || 'unknown'}`,
          segment: 'Stipulated NM1 validation',
          ref: field,
          name: 'NM1 element',
          locatorTrail: [...trailPrefix, `NM1 ${field}`],
        });
      }
    });

    const refChecks = [
      ['REF0F', true],
      ['REF1L', false],
      ['REFDX', false],
      ['REFZZ', false],
    ];

    refChecks.forEach(([field, digitsOnly]) => {
      const expected = refInput[field];
      if (!expected) {
        return;
      }

      const actual = subscriber?.ref?.[field] || null;
      const isMatch = digitsOnly
        ? compareDigits(actual, expected)
        : compareText(actual, expected);

      if (!isMatch) {
        findings.push({
          path: `stipulatedValues.ref.${field}[${index}]`,
          reason: `${field} expected '${expected}' but found '${actual || ''}' for subscriber SSN ${subscriber.ssn || 'unknown'}`,
          segment: 'Stipulated REF validation',
          ref: field,
          name: 'REF element',
          locatorTrail: [...trailPrefix, `REF ${field}`],
        });
      }
    });
  });

  return findings;
}

function cljsToJs(value) {
  const c = global?.cljs?.core;
  if (c && typeof c.clj__GT_js === 'function') {
    return c.clj__GT_js(value);
  }
  return value;
}

function inferValidity(value) {
  if (!value || typeof value !== 'object') {
    return 'unknown';
  }

  const candidates = [value.valid, value.isValid, value.validationStatus, value.status, value.result];
  const normalized = candidates.find((entry) => typeof entry === 'boolean' || typeof entry === 'string');

  if (typeof normalized === 'boolean') {
    return normalized ? 'valid' : 'invalid';
  }

  const lowered = String(normalized || '').toLowerCase();
  if (!lowered) {
    return 'unknown';
  }
  if (lowered.includes('valid') || lowered === 'ok' || lowered === 'pass' || lowered === 'passed') {
    return 'valid';
  }
  if (lowered.includes('invalid') || lowered === 'error' || lowered === 'fail' || lowered === 'failed') {
    return 'invalid';
  }
  return 'unknown';
}

function formatObjectPath(parentPath, key) {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) {
    return `${parentPath}.${key}`;
  }

  return `${parentPath}[${JSON.stringify(key)}]`;
}

function buildLocatorToken(value) {
  if (Array.isArray(value) && value.length > 0) {
    const firstItem = value[0];
    if (typeof firstItem === 'string' || typeof firstItem === 'number') {
      return String(firstItem);
    }
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const ref = value.ref
    ? String(value.ref)
    : (value['segment-ref'] || value.segmentRef || value['rule-id'] || value.ruleId || null);
  const name = value.name ? String(value.name) : null;

  if (ref && name) {
    return `${ref} - ${name}`;
  }

  if (ref) {
    return ref;
  }

  if (name) {
    return name;
  }

  return null;
}

function extractRefFromReason(reason) {
  if (!reason) {
    return null;
  }

  const match = String(reason).match(/\b([A-Z]{2,4}\d{2})\b/);
  return match ? match[1] : null;
}

function dedupeTrail(tokens) {
  const output = [];
  for (const token of tokens) {
    if (!token) {
      continue;
    }

    if (output[output.length - 1] !== token) {
      output.push(token);
    }
  }
  return output;
}

function hasNestedInvalidDetail(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const stack = [];
  if (Array.isArray(value)) {
    value.forEach((entry) => stack.push(entry));
  } else {
    Object.values(value).forEach((entry) => stack.push(entry));
  }

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') {
      continue;
    }

    const currentReason = current['invalid-description'] || current.invalidDescription || null;
    const currentRef = current.ref || current['segment-ref'] || current.segmentRef || null;
    const currentName = current.name || null;
    if (currentReason || currentRef || currentName) {
      return true;
    }

    if (Array.isArray(current)) {
      current.forEach((entry) => stack.push(entry));
    } else {
      Object.values(current).forEach((entry) => stack.push(entry));
    }
  }

  return false;
}

function parsePathTokens(pathValue) {
  const pathText = String(pathValue || '');
  if (!pathText) {
    return [];
  }

  const tokens = [];
  const matcher = /\[(\d+)\]|\["([^"\\]*(?:\\.[^"\\]*)*)"\]|\['([^'\\]*(?:\\.[^'\\]*)*)'\]|\.([A-Za-z0-9_$-]+)/g;
  let match;

  while ((match = matcher.exec(pathText)) !== null) {
    if (match[1] !== undefined) {
      tokens.push(Number(match[1]));
      continue;
    }

    if (match[2] !== undefined) {
      tokens.push(JSON.parse(`"${match[2]}"`));
      continue;
    }

    if (match[3] !== undefined) {
      tokens.push(match[3]);
      continue;
    }

    if (match[4]) {
      tokens.push(match[4]);
    }
  }

  return tokens;
}

function getValueAtPath(rootValue, pathTokens) {
  let current = rootValue;
  for (const token of pathTokens) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof token === 'number') {
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[token];
      continue;
    }

    if (typeof current !== 'object') {
      return undefined;
    }

    current = current[token];
  }

  return current;
}

function getPathNodeChain(rootValue, pathTokens) {
  const chain = [];
  let current = rootValue;

  for (const token of pathTokens) {
    if (current === null || current === undefined) {
      break;
    }

    if (typeof token === 'number') {
      if (!Array.isArray(current)) {
        break;
      }
      current = current[token];
      chain.push(current);
      continue;
    }

    if (typeof current !== 'object') {
      break;
    }

    current = current[token];
    chain.push(current);
  }

  return chain;
}

function getMetaFromNode(node) {
  if (!node) {
    return null;
  }

  if (typeof node === 'object' && !Array.isArray(node)) {
    const hasMeta = node['loop-name'] || node['loop-description'] || node['segment-description'] || node.ref || node.name;
    return hasMeta ? node : null;
  }

  if (!Array.isArray(node)) {
    return null;
  }

  for (const entry of node) {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const hasMeta = entry['loop-name'] || entry['loop-description'] || entry['segment-description'] || entry.ref || entry.name;
      if (hasMeta) {
        return entry;
      }
    }
  }

  return null;
}

function getSegmentIdFromNode(node) {
  if (!Array.isArray(node)) {
    return null;
  }

  for (const entry of node) {
    if (Array.isArray(entry) && entry[0] === 'seg_id' && entry[1]) {
      return String(entry[1]);
    }
  }

  return null;
}

export function extractFailedValueFromNode(node) {
  if (node === null || node === undefined) {
    return null;
  }

  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
    return String(node);
  }

  if (!Array.isArray(node) && typeof node === 'object') {
    const valueProvided = node['value-provided?'];
    if (valueProvided === false) {
      return '';
    }
    if (valueProvided === true && node.value !== null && node.value !== undefined) {
      return String(node.value);
    }
  }

  if (!Array.isArray(node)) {
    return null;
  }

  const tag = node[0];
  if (
    tag === 'data_segment_unit'
    || tag === 'isa_data_segment_unit'
    || tag === 'id'
    || tag === 'seg_id'
  ) {
    const value = node[1];
    if (value === null || value === undefined) {
      return null;
    }
    return String(value);
  }

  // For unknown array shapes, try returning the first primitive payload value.
  for (let i = 1; i < node.length; i += 1) {
    const entry = node[i];
    if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
      return String(entry);
    }
  }

  return null;
}

function normalizeSubscriberSsn(value) {
  const digits = normalizeDigits(value);
  return digits.length === SSN_DIGITS_LENGTH ? digits : null;
}

function extractSubscriberIdentity(value, context = {}) {
  const lookup = value?.lookup && typeof value.lookup === 'object' ? value.lookup : null;
  const subscriberSsn = normalizeSubscriberSsn(
    value?.['subscriber-ssn']
      ?? value?.subscriberSsn
      ?? lookup?.['subscriber-ssn']
      ?? lookup?.subscriberSsn
      ?? context.subscriberSsn,
  );
  const rawIndex = value?.['subscriber-index']
    ?? value?.subscriberIndex
    ?? lookup?.['subscriber-index']
    ?? lookup?.subscriberIndex
    ?? context.subscriberIndex;
  const parsedIndex = Number(rawIndex);

  return {
    subscriberIndex: Number.isInteger(parsedIndex) && parsedIndex > 0 ? parsedIndex : null,
    subscriberSsn,
  };
}

function reconstructSubscriberSsnFromInsNode(node) {
  let subscriberSsn = null;

  const walk = (current) => {
    if (subscriberSsn || current === null || current === undefined) {
      return;
    }

    if (typeof current === 'string') {
      const refMatch = current.match(/(?:^|~)REF\*0F\*([^*~]+)/i);
      const nm1Match = current.match(/(?:^|~)NM1\*[^~]*\*34\*([^*~]+)/i);
      subscriberSsn = normalizeSubscriberSsn(refMatch?.[1] || nm1Match?.[1]);
      return;
    }

    if (typeof current !== 'object') {
      return;
    }

    Object.values(current).forEach(walk);
  };

  walk(node);
  return subscriberSsn;
}

function extractFailedValueFromRawSegment(rawSegmentText, segmentRef) {
  const text = String(rawSegmentText || '').trim();
  const refText = String(segmentRef || '').trim();
  if (!text || !refText) {
    return null;
  }

  const refMatch = refText.match(/^[A-Z]{2,4}(\d{2})$/i);
  if (!refMatch) {
    return null;
  }

  const elementIndex = Number(refMatch[1]);
  if (!Number.isFinite(elementIndex) || elementIndex < 1) {
    return null;
  }

  const separator = text.includes('*') ? '*' : (text.includes('|') ? '|' : null);
  if (!separator) {
    return null;
  }

  const elements = text.split(separator);
  if (elements.length <= elementIndex) {
    return null;
  }

  return String(elements[elementIndex] || '');
}

function extractFailedValueFromContext(node, pathNodeChain, entry) {
  const fromNode = extractFailedValueFromNode(node);
  if (
    node
    && !Array.isArray(node)
    && typeof node === 'object'
    && node['value-provided?'] === false
  ) {
    return '';
  }

  if (fromNode !== null && fromNode !== undefined && String(fromNode).length > 0) {
    return fromNode;
  }

  const refFromChain = (() => {
    for (let i = pathNodeChain.length - 1; i >= 0; i -= 1) {
      const candidate = pathNodeChain[i];
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        continue;
      }

      const value = candidate['segment-ref'] || candidate.segmentRef || candidate['rule-id'] || candidate.ruleId || null;
      if (value) {
        return value;
      }
    }

    return null;
  })();

  const ref = entry?.ref
    || (node && typeof node === 'object' ? (node['segment-ref'] || node.segmentRef || node['rule-id']) : null)
    || refFromChain
    || null;
  if (!ref) {
    return null;
  }

  for (let i = pathNodeChain.length - 1; i >= 0; i -= 1) {
    const candidate = pathNodeChain[i];
    if (!Array.isArray(candidate) || candidate[0] !== 'raw_segment') {
      continue;
    }

    const rawText = candidate.find((entryValue) => typeof entryValue === 'string' && entryValue.includes('*'))
      || candidate[candidate.length - 1];
    const extracted = extractFailedValueFromRawSegment(rawText, ref);
    if (extracted !== null && extracted !== undefined) {
      return extracted;
    }
  }

  return null;
}

function buildLocatorTrailFromEnrichedPath(enriched, pathValue) {
  if (!enriched || !pathValue) {
    return [];
  }

  const pathTokens = parsePathTokens(pathValue);
  if (pathTokens.length === 0) {
    return [];
  }

  const trail = [];

  for (let i = 1; i <= pathTokens.length; i += 1) {
    const partial = pathTokens.slice(0, i);
    const node = getValueAtPath(enriched, partial);
    if (!node) {
      continue;
    }

    const meta = getMetaFromNode(node);
    const loopName = meta?.['loop-name'];
    const loopDescription = meta?.['loop-description'];
    const segmentDescription = meta?.['segment-description'];
    const elementRef = meta?.ref;
    const elementName = meta?.name;
    const segmentId = getSegmentIdFromNode(node);

    if (loopName && loopName !== 'None' && loopName !== 'Header') {
      trail.push(`Loop ${loopName}`);
    }
    if (loopDescription) {
      trail.push(String(loopDescription));
    }
    if (segmentId) {
      trail.push(`Segment ${segmentId}`);
    }
    if (segmentDescription) {
      trail.push(String(segmentDescription));
    }
    if (elementRef && elementName) {
      trail.push(`${elementRef} - ${elementName}`);
    } else if (elementRef) {
      trail.push(String(elementRef));
    } else if (elementName) {
      trail.push(String(elementName));
    }
  }

  return dedupeTrail(trail);
}

function withContextualLocatorTrail(invalidElements, enriched) {
  if (!Array.isArray(invalidElements)) {
    return [];
  }

  return invalidElements.map((entry) => {
    const loopIdentityPatch = {
      loopName: entry?.loopName ?? entry?.['loop-name'] ?? null,
      loopDescription: entry?.loopDescription ?? entry?.['loop-description'] ?? null,
    };
    if (!enriched) {
      return { ...entry, ...loopIdentityPatch };
    }

    const pathTokens = parsePathTokens(entry?.path);
    const node = pathTokens.length > 0 ? getValueAtPath(enriched, pathTokens) : null;
    const pathNodeChain = pathTokens.length > 0 ? getPathNodeChain(enriched, pathTokens) : [];
    const failedValue = extractFailedValueFromContext(node, pathNodeChain, entry);
    const hasExistingFailedValue = entry?.failedValue !== null && entry?.failedValue !== undefined;
    const nodeIdentity = extractSubscriberIdentity(node);
    const chainIdentity = [...pathNodeChain]
      .reverse()
      .map((candidate) => extractSubscriberIdentity(candidate))
      .find((identity) => identity.subscriberSsn || identity.subscriberIndex);
    const subscriberIndex = entry?.subscriberIndex
      ?? nodeIdentity.subscriberIndex
      ?? chainIdentity?.subscriberIndex
      ?? null;
    const subscriberSsn = normalizeSubscriberSsn(entry?.subscriberSsn)
      ?? nodeIdentity.subscriberSsn
      ?? chainIdentity?.subscriberSsn
      ?? null;
    const identityPatch = { subscriberIndex, subscriberSsn, ...loopIdentityPatch };

    if (Array.isArray(entry?.locatorTrail) && entry.locatorTrail.length > 0) {
      if (failedValue === null || failedValue === undefined || hasExistingFailedValue) {
        return { ...entry, ...identityPatch };
      }

      return {
        ...entry,
        ...identityPatch,
        failedValue,
      };
    }

    const locatorTrail = buildLocatorTrailFromEnrichedPath(enriched, entry?.path);
    if (locatorTrail.length === 0) {
      if (failedValue === null || failedValue === undefined || hasExistingFailedValue) {
        return { ...entry, ...identityPatch };
      }

      return {
        ...entry,
        ...identityPatch,
        failedValue,
      };
    }

    if (failedValue === null || failedValue === undefined) {
      return {
        ...entry,
        ...identityPatch,
        locatorTrail,
      };
    }

    return {
      ...entry,
      ...identityPatch,
      locatorTrail,
      failedValue: hasExistingFailedValue ? entry.failedValue : failedValue,
    };
  });
}

function collectLookupStats(value, stats = { total: 0, applied: 0, noSpec: 0 }) {
  if (!value || typeof value !== 'object') {
    return stats;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectLookupStats(entry, stats));
    return stats;
  }

  const lookupApplied = value['lookup-applied'];
  const lookupStatus = value.status;
  if (typeof lookupApplied === 'boolean') {
    stats.total += 1;
    if (lookupApplied) {
      stats.applied += 1;
    }
    if (String(lookupStatus || '').toLowerCase() === 'no-spec') {
      stats.noSpec += 1;
    }
  }

  Object.values(value).forEach((entry) => collectLookupStats(entry, stats));
  return stats;
}

export function collectValidationFindings(value, currentPath = 'enrichedResult', findings = {
  summary: { valid: 0, invalid: 0, unknown: 0 },
  invalidElements: [],
}, context = {
  loopName: null,
  loopDescription: null,
  segmentDescription: null,
  segmentId: null,
  elementRef: null,
  elementName: null,
  subscriberIndex: null,
  subscriberSsn: null,
}, traversal = { subscriberCount: 0 }) {
  if (!value || typeof value !== 'object') {
    return findings;
  }

  const locatorToken = buildLocatorToken(value);
  const baseTrail = [];
  if (context.loopName && context.loopName !== 'None' && context.loopName !== 'Header') {
    baseTrail.push(`Loop ${context.loopName}`);
  }
  if (context.segmentId) {
    baseTrail.push(`Segment ${context.segmentId}`);
  }
  if (context.segmentDescription) {
    baseTrail.push(context.segmentDescription);
  }

  const status = inferValidity(value);

  if (status === 'invalid') {
    const reason = value['invalid-description'] || value.invalidDescription || null;
    const effectiveRef = value.ref
      || value['segment-ref']
      || value.segmentRef
      || value['rule-id']
      || value.ruleId
      || context.elementRef
      || extractRefFromReason(reason);
    const effectiveName = value.name || context.elementName || null;
    const isAggregateInvalid = !reason && !effectiveRef && !effectiveName && hasNestedInvalidDetail(value);

    if (isAggregateInvalid) {
      // Skip parent aggregate failures when child nodes carry actionable details.
      // This prevents cards with only "Validation rule" and generic transaction/segment breadcrumbs.
    } else {
      const refNameToken = effectiveRef && effectiveName
        ? `${effectiveRef} - ${effectiveName}`
        : (effectiveRef || effectiveName || locatorToken);

      const locatorTrail = dedupeTrail([
        ...baseTrail,
        refNameToken,
      ]);

      findings.summary.invalid += 1;
      const subscriberIdentity = extractSubscriberIdentity(value, context);
      findings.invalidElements.push({
        path: currentPath,
        reason,
        failedValue: extractFailedValueFromNode(value),
        valueProvided: typeof value['value-provided?'] === 'boolean'
          ? value['value-provided?']
          : undefined,
        segment: value['segment-description'] || value.segmentDescription || context.segmentDescription || null,
        ref: effectiveRef || null,
        name: effectiveName || null,
        loopName: value.loopName ?? value['loop-name'] ?? context.loopName ?? null,
        loopDescription: value.loopDescription
          ?? value['loop-description']
          ?? context.loopDescription
          ?? null,
        locatorTrail,
        subscriberIndex: subscriberIdentity.subscriberIndex,
        subscriberSsn: subscriberIdentity.subscriberSsn,
      });
    }
  } else if (status === 'valid') {
    findings.summary.valid += 1;
  } else {
    findings.summary.unknown += 1;
  }

  if (Array.isArray(value)) {
    const arrayTag = typeof value[0] === 'string' ? value[0] : null;
    let nextContext = { ...context };

    if (arrayTag === 'ins_subscriber') {
      traversal.subscriberCount += 1;
      nextContext = {
        ...nextContext,
        subscriberIndex: traversal.subscriberCount,
        subscriberSsn: reconstructSubscriberSsnFromInsNode(value),
      };
    } else if (arrayTag === 'data_segment') {
      const meta = value.find((item) => item && typeof item === 'object' && !Array.isArray(item) && (
        item.loopName || item['loop-name'] || item.loopDescription || item['loop-description'] || item['segment-description']
      ));
      const segId = value.find((item) => Array.isArray(item) && item[0] === 'seg_id');

      nextContext = {
        ...nextContext,
        loopName: meta?.loopName ?? meta?.['loop-name'] ?? nextContext.loopName,
        loopDescription: meta?.loopDescription
          ?? meta?.['loop-description']
          ?? nextContext.loopDescription,
        segmentDescription: meta?.['segment-description'] || nextContext.segmentDescription,
        segmentId: segId?.[1] || nextContext.segmentId,
        elementRef: null,
        elementName: null,
      };
    } else if (arrayTag === 'data_segment_unit' || arrayTag === 'isa_data_segment_unit') {
      const meta = value.find((item) => item && typeof item === 'object' && !Array.isArray(item) && (
        item.ref || item.name || item['segment-ref'] || item.segmentRef || item['rule-id'] || item.ruleId
      ));

      nextContext = {
        ...nextContext,
        elementRef: meta?.ref || meta?.['segment-ref'] || meta?.segmentRef || meta?.['rule-id'] || meta?.ruleId || nextContext.elementRef,
        elementName: meta?.name || nextContext.elementName,
      };
    } else if (arrayTag === 'raw_segment') {
      const meta = value.find((item) => item && typeof item === 'object' && !Array.isArray(item) && (
        item['segment-id'] || item.loopName || item['loop-name'] || item.loopDescription || item['loop-description'] || item['segment-description']
      ));

      nextContext = {
        ...nextContext,
        loopName: meta?.loopName ?? meta?.['loop-name'] ?? nextContext.loopName,
        loopDescription: meta?.loopDescription
          ?? meta?.['loop-description']
          ?? nextContext.loopDescription,
        segmentDescription: meta?.['segment-description'] || nextContext.segmentDescription,
        segmentId: meta?.['segment-id'] || nextContext.segmentId,
        elementRef: null,
        elementName: null,
      };
    }

    value.forEach((entry, index) => {
      collectValidationFindings(entry, `${currentPath}[${index}]`, findings, nextContext, traversal);
    });
    return findings;
  }

  Object.entries(value).forEach(([key, entryValue]) => {
    collectValidationFindings(entryValue, formatObjectPath(currentPath, key), findings, context, traversal);
  });

  return findings;
}

function buildFindingsFromPipelineResult(pipelineResult, enriched) {
  const summary = pipelineResult?.summary || pipelineResult?.validationSummary || null;
  const invalidElements = Array.isArray(pipelineResult?.invalidElements)
    ? pipelineResult.invalidElements
    : (Array.isArray(pipelineResult?.findings) ? pipelineResult.findings : null);

  const enrichedFindings = enriched
    ? collectValidationFindings(enriched)
    : { summary: { valid: 0, invalid: 0, unknown: 0 }, invalidElements: [] };

  const mergeInvalidElements = (primary, secondary) => {
    const merged = [];
    const seen = new Map();

    const pushUnique = (entry) => {
      if (!entry || typeof entry !== 'object') {
        return;
      }

      const key = JSON.stringify([
        entry.path || null,
        entry.ref || null,
        entry.name || null,
        entry.segment || null,
        entry.loopName ?? entry['loop-name'] ?? null,
        entry.reason || null,
      ]);

      if (seen.has(key)) {
        const existingIndex = seen.get(key);
        const existing = merged[existingIndex];
        merged[existingIndex] = {
          ...existing,
          failedValue: existing.failedValue ?? entry.failedValue,
          valueProvided: existing.valueProvided ?? entry.valueProvided,
          subscriberIndex: existing.subscriberIndex ?? entry.subscriberIndex ?? null,
          subscriberSsn: existing.subscriberSsn ?? entry.subscriberSsn ?? null,
          loopName: existing.loopName ?? entry.loopName ?? entry['loop-name'] ?? null,
          loopDescription: existing.loopDescription
            ?? entry.loopDescription
            ?? entry['loop-description']
            ?? null,
          locatorTrail: existing.locatorTrail?.length ? existing.locatorTrail : entry.locatorTrail,
        };
        return;
      }

      seen.set(key, merged.length);
      merged.push(entry);
    };

    (Array.isArray(primary) ? primary : []).forEach(pushUnique);
    (Array.isArray(secondary) ? secondary : []).forEach(pushUnique);
    return merged;
  };

  if (summary && Array.isArray(invalidElements)) {
    const hasValidUnknown = summary.valid !== undefined || summary.unknown !== undefined;
    const valid = hasValidUnknown
      ? Number(summary.valid || 0)
      : Number(summary.passed || 0);
    const invalidFromSummary = Number(summary.invalid ?? summary.failed ?? 0);
    const unknown = hasValidUnknown
      ? Number(summary.unknown || 0)
      : Math.max(0, Number(summary.total || 0) - valid - invalidFromSummary);

    const contextualPipelineInvalids = withContextualLocatorTrail(invalidElements, enriched);
    const mergedInvalidElements = mergeInvalidElements(contextualPipelineInvalids, enrichedFindings.invalidElements);
    const invalid = Math.max(invalidFromSummary, mergedInvalidElements.length);

    return {
      summary: {
        valid,
        invalid,
        unknown,
      },
      invalidElements: mergedInvalidElements,
    };
  }

  if (enriched) {
    return enrichedFindings;
  }

  return {
    summary: { valid: 0, invalid: 0, unknown: 0 },
    invalidElements: [],
  };
}

async function downloadBlobToTempFile(containerName, blobName, suffix, onTempFile = null) {
  const blobClient = await getBlockBlobClient(containerName, blobName);
  const exists = await blobClient.exists();

  if (!exists) {
    throw new Error(`Blob does not exist: ${containerName}/${blobName}`);
  }

  const tempFile = path.join(os.tmpdir(), `${Date.now()}-${Math.random().toString(36).slice(2)}${suffix}`);
  if (typeof onTempFile === 'function') {
    onTempFile(tempFile);
  }
  try {
    const response = await blobClient.download();
    if (!response.readableStreamBody) {
      throw new Error(`Blob download did not return a readable stream: ${containerName}/${blobName}`);
    }
    await pipeline(response.readableStreamBody, createWriteStream(tempFile));
  } catch (error) {
    await fs.rm(tempFile, { force: true }).catch(() => null);
    throw error;
  }
  return tempFile;
}

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  fields.push(current);
  return fields;
}

function serializeCsvLine(fields) {
  return fields.map((value) => {
    if (!/[",\r\n]/.test(value)) {
      return value;
    }
    return `"${value.replace(/"/g, '""')}"`;
  }).join(',');
}

function normalizeSlashDelimitedList(value) {
  if (!value || !value.includes('/') || value.includes('://')) {
    return value;
  }

  const segments = value.split('/').map((segment) => segment.trim());
  if (segments.length < 2 || segments.some((segment) => !segment)) {
    return value;
  }

  const looksLikeEnum = segments.every((segment) => /^[A-Za-z0-9 _\-.$]+$/.test(segment));
  if (!looksLikeEnum) {
    return value;
  }

  return segments.join(', ');
}

async function normalizeCompanionCsvListDelimiters(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const hasCrlf = raw.includes('\r\n');
  const newline = hasCrlf ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  let changed = false;

  const updatedLines = lines.map((line) => {
    if (!line || !line.includes('/')) {
      return line;
    }

    const fields = parseCsvLine(line);
    if (fields.length < 4) {
      return line;
    }

    const kpElement = fields[3];
    const normalized = normalizeSlashDelimitedList(kpElement);
    if (normalized === kpElement) {
      return line;
    }

    fields[3] = normalized;
    changed = true;
    return serializeCsvLine(fields);
  });

  if (changed) {
    await fs.writeFile(filePath, updatedLines.join(newline), 'utf8');
  }
}

export async function ingestEditableCompanionGuideFromBlob({
  companionContainer,
  companionBlobName,
  treatSlashAsComma = true,
}) {
  if (!supportsEditableCompanionGuide()) {
    return { supported: false };
  }

  if (!companionContainer || !companionBlobName) {
    throw new Error('Missing companion guide blob location');
  }

  const companionExtension = path.extname(companionBlobName).toLowerCase();
  if (companionExtension !== '.csv') {
    throw new Error(`Companion guide must be CSV for editable ingestion (received '${companionExtension || 'unknown'}')`);
  }

  let companionTempPath = null;
  try {
    companionTempPath = await downloadBlobToTempFile(
      companionContainer,
      companionBlobName,
      companionExtension,
    );

    if (treatSlashAsComma) {
      await normalizeCompanionCsvListDelimiters(companionTempPath);
    }

    return {
      supported: true,
      schemaVersion: x12.capabilities.editableCompanionGuideSchemaVersion,
      efssPackageVersion: efssPackage.version || null,
      editableGuide: x12.parseCompanionGuideEditable(companionTempPath),
    };
  } finally {
    if (companionTempPath) {
      await fs.rm(companionTempPath, { force: true }).catch(() => {});
    }
  }
}

export async function parseAndEnrichEdiFromBlob({
  ediContainer,
  ediBlobName,
  companionContainer,
  companionBlobName,
  editableGuide = null,
  template = null,
  runConfig = null,
  validationScope = null,
  parseOptions = null,
  includeRaw = false,
  onProgress = null,
  onFindingBatch = null,
  onTempFile = null,
}) {
  if (!ediContainer || !ediBlobName) {
    throw new Error('Missing EDI blob location');
  }

  if (!companionContainer || !companionBlobName) {
    throw new Error('Missing companion guide blob location');
  }

  let ediTempPath = null;
  let scopedEdiTempPath = null;
  let companionTempPath = null;

  const reportProgress = (overallJobPercent, step, details = null) => {
    if (typeof onProgress !== 'function') {
      return;
    }

    onProgress({ overallJobPercent, step, details });
  };

  try {
    if (editableGuide != null && !supportsEditableCompanionGuide()) {
      throw new Error('Loaded EFS-S raw library lacks editable companion guide validation support');
    }
    const useEditableGuide = editableGuide != null;
    const companionExtension = path.extname(companionBlobName).toLowerCase();
    if (companionExtension !== '.csv') {
      throw new Error(`Companion guide must be CSV for efs-s-x12 validation pipeline (received '${companionExtension || 'unknown'}')`);
    }

    const treatSlashAsComma = runConfig?.effectiveValues?.delimiterConfig?.treatSlashAsComma
      ?? template?.delimiterConfig?.treatSlashAsComma
      ?? true;

    reportProgress(10, 'Fetching EDI file');
    ediTempPath = await downloadBlobToTempFile(
      ediContainer,
      ediBlobName,
      path.extname(ediBlobName) || '.txt',
      onTempFile,
    );
    if (useEditableGuide) {
      reportProgress(25, 'Using edited companion guide');
    } else {
      reportProgress(25, 'Fetching companion guide');
      companionTempPath = await downloadBlobToTempFile(
        companionContainer,
        companionBlobName,
        companionExtension || '.csv',
        onTempFile,
      );

      if (treatSlashAsComma) {
        await normalizeCompanionCsvListDelimiters(companionTempPath);
      }
    }

    reportProgress(40, 'Reading the EDI file');
    reportProgress(58, 'Parsing, enriching, and validating EDI payload');
    const effectiveParseOptions = normalizeEdiParseOptions(parseOptions, runConfig, template);
    const validateGuide = useEditableGuide
      ? x12.validateEditableCompanionGuide
      : x12?.parseEnrichValidate || x12?.core?.parse_enrich_validate_json;
    if (typeof validateGuide !== 'function') {
      throw new Error('Required efs-s-x12 companion guide validation API is not available');
    }

    assertEfssBoundedMemoryCapabilities();
    if (effectiveParseOptions.dbValidation && (!x12.hasLookupSpecs || !x12.lookupSpecFilePath)) {
      throw new Error('Installed EFS-S package does not contain DB lookup specs');
    }
    const heartbeatEveryDbAttemptsRaw = Number.parseInt(process.env.EFS_HEARTBEAT_EVERY_DB_ATTEMPTS || '10', 10);
    const heartbeatEveryDbAttempts = Number.isFinite(heartbeatEveryDbAttemptsRaw) && heartbeatEveryDbAttemptsRaw > 0
      ? heartbeatEveryDbAttemptsRaw
      : 10;

    const efssValidationOptions = buildEfssValidationOptions({
      validationScope,
      templateId: template?.id || null,
      runConfigId: runConfig?.id || null,
      heartbeatEveryDbAttempts,
      onFindingBatch: (findings) => {
        if (typeof onFindingBatch !== 'function' || !Array.isArray(findings)) {
          return;
        }
        onFindingBatch(findings.map(normalizeFinding));
      },
      onProgress: (event) => {
        const progressEvent = normalizeEfssProgressEvent(event);
        if (!progressEvent) {
          return;
        }
        reportProgress(
          progressEvent.overallJobPercent,
          progressEvent.step,
          progressEvent.details,
        );
      },
    }, effectiveParseOptions);
    const pipelineRaw = validateGuide(
      useEditableGuide ? editableGuide : companionTempPath,
      ediTempPath,
      efssValidationOptions,
    );
    const pipelineResult = cljsToJs(pipelineRaw) || {};
    assertDbValidationTelemetry(pipelineResult, effectiveParseOptions.dbValidation);
    assertStrictCollectionTelemetry(pipelineResult);
    const validationSummary = pipelineResult?.['validation-summary']
      || pipelineResult?.validationSummary
      || pipelineResult?.report?.validation
      || null;
    const subscriberStatuses = pipelineResult?.['subscriber-statuses']
      || pipelineResult?.subscriberStatuses
      || pipelineResult?.report?.['subscriber-statuses']
      || [];
    const compactInvalidFindings = normalizeCompactInvalidFindings(pipelineResult);
    const invalidFromSummary = Number(validationSummary?.failed ?? validationSummary?.invalid ?? 0);
    const validFromSummary = Number(validationSummary?.passed ?? validationSummary?.valid ?? 0);
    const totalFromSummary = Number(validationSummary?.total ?? 0);
    const findings = {
      summary: {
        valid: validFromSummary,
        invalid: Math.max(invalidFromSummary, compactInvalidFindings.length),
        unknown: Math.max(0, totalFromSummary - validFromSummary - invalidFromSummary),
      },
      invalidElements: compactInvalidFindings,
    };
    const compactLookupStats = pipelineResult?.lookupStats
      || pipelineResult?.['lookup-stats']
      || pipelineResult?.report?.lookupStats
      || pipelineResult?.report?.['lookup-stats']
      || null;
    const lookupSummary = validationSummary?.lookup
      || pipelineResult?.report?.['lookup-summary']
      || null;
    const lookupStats = compactLookupStats || {
      total: Number(lookupSummary?.total ?? lookupSummary?.attempted ?? 0),
      applied: Number(lookupSummary?.applied ?? lookupSummary?.attempted ?? 0),
      noSpec: Number(lookupSummary?.noSpec ?? lookupSummary?.['no-spec'] ?? 0),
    };
    const warnings = [];
    if (effectiveParseOptions.dbValidation && lookupStats.total > 0 && lookupStats.applied === 0) {
      warnings.push(
        'DB validation is enabled, but no lookup rules were applied (all lookups reported no-spec). Check the installed EFS-S lookup specs and rule coverage.',
      );
    }
    const artifactPaths = { parsedPath: null, enrichedPath: null };

    const result = {
      summary: findings.summary,
      invalidElements: findings.invalidElements,
      x12Validation: validationSummary,
      subscriberStatuses,
      scopedSubscriberMetrics: null,
      executionContext: {
        templateId: template?.id || null,
        runConfigId: runConfig?.id || null,
        validationScope,
        parseOptions: effectiveParseOptions,
        lookupStats,
        warnings,
        treatSlashAsComma,
        scopedSubscriberMetrics: null,
        artifactPaths,
      },
      canonicalValidationReport: pipelineResult,
    };

    reportProgress(100, 'Validation complete');

    return result;
  } catch (error) {
    const detail = {
      validationScopeMode: validationScope?.mode || null,
      errorType: error?.type || error?.name || 'ValidationError',
    };

    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'parseAndEnrichEdiFromBlob',
        detail,
      },
    }));

    throw error;
  } finally {
    await Promise.all([
      ediTempPath ? fs.unlink(ediTempPath).catch(() => null) : Promise.resolve(),
      scopedEdiTempPath ? fs.unlink(scopedEdiTempPath).catch(() => null) : Promise.resolve(),
      companionTempPath ? fs.unlink(companionTempPath).catch(() => null) : Promise.resolve(),
    ]);
  }
}
