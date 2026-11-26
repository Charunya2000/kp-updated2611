import { v4 as uuidv4 } from 'uuid';
import { createHmac } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { connectToDatabase } from '../../../db/connection.js';
import { RCNOA_SCOPE } from './rcnoaCore.js';
import {
  DEFAULT_RCNOA_QUERY_CONFIGURATION,
  validateRcnoaQueryConfiguration,
} from './rcnoaQueryConfigurationService.js';
import {
  RCNOA_TIMEOUT_DEFAULTS,
  seedRcnoaBusinessConfiguration,
  validateRcnoaBusinessConfiguration,
} from './rcnoaBusinessConfigurationService.js';

const COLLECTION_NAME = 'user_collection';
const APP_NAME = 'SmartNotes';
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const QUERY_CONFIGURATION_ID = 'rcnoa-query-configuration';
const BUSINESS_CONFIGURATION_ID = 'rcnoa-business-configuration';
const LOCAL_PRIOR_RCNA_FILE = 'prior-rcna-records.json';
const PRIOR_RCNA_QUERY_BATCH_SIZE = 500;
let indexPromise = null;

export const RCNOA_TYPES = Object.freeze({
  businessConfiguration: 'RcnoaBusinessConfiguration',
  queryConfiguration: 'RcnoaQueryConfiguration',
  schedule: 'RcnoaSchedule',
  run: 'RcnoaRun',
  runItem: 'RcnoaRunItem',
  artifact: 'RcnoaArtifact',
  priorRcna: 'RcnoaPriorRcnaRecord',
});

export const RCNOA_RUN_STATUSES = Object.freeze([
  'AWAITING_UPLOAD',
  'AWAITING_RCNA_REVIEW',
  'QUEUED',
  'PROCESSING',
  'COMPLETE',
  'PARTIAL',
  'ERROR',
  'CANCELED',
  'SKIPPED',
]);

export const RCNOA_RUN_OPERATIONS = Object.freeze([
  'RCNO_TO_RCNA',
  'RCNA_IMPORT',
  'RCNA_TO_834',
  '834_TO_SFTP',
]);

const TERMINAL_STATUSES = new Set(['AWAITING_RCNA_REVIEW', 'COMPLETE', 'PARTIAL', 'ERROR', 'CANCELED', 'SKIPPED']);
const DELETABLE_STATUSES = new Set([...TERMINAL_STATUSES, 'AWAITING_UPLOAD']);

function teamDbName() {
  return `team-${RCNOA_SCOPE.teamName}-db`;
}

async function getCollection() {
  const db = await connectToDatabase(teamDbName());
  return db.collection(COLLECTION_NAME);
}

function now() {
  return new Date();
}

function baseDocument(type, values, actor) {
  const timestamp = now();
  return {
    ...values,
    id: values.id || uuidv4(),
    type,
    app: APP_NAME,
    teamName: RCNOA_SCOPE.teamName,
    assistantName: RCNOA_SCOPE.assistantName,
    createdAt: values.createdAt || timestamp,
    updatedAt: timestamp,
    ...(actor ? { createdBy: values.createdBy || actor, updatedBy: actor } : {}),
  };
}

function pageOptions({ page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) {
  const normalizedPage = Math.max(1, Number.parseInt(page, 10) || 1);
  const normalizedPageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(pageSize, 10) || DEFAULT_PAGE_SIZE),
  );
  return {
    page: normalizedPage,
    pageSize: normalizedPageSize,
    skip: (normalizedPage - 1) * normalizedPageSize,
  };
}

function withoutMongoId(document) {
  if (!document) return document;
  const { _id, ...rest } = document;
  return rest;
}

export async function ensureRcnoaIndexes() {
  if (!indexPromise) {
    indexPromise = (async () => {
      const collection = await getCollection();
      await collection.createIndex({ type: 1, id: 1 });
      await collection.createIndex({ type: 1, parentId: 1, createdAt: -1 });
      await collection.createIndex({ type: 1, teamName: 1, assistantName: 1, createdAt: -1 });
      await collection.createIndex({ type: 1, idempotencyKey: 1 });
      await collection.createIndex({ type: 1, enabled: 1, nextScheduledAt: 1 });
      await collection.createIndex({ type: 1, reconciliationCycle: 1, memberMatchKey: 1, effectiveAt: -1 });
    })().catch((error) => {
      indexPromise = null;
      throw error;
    });
  }
  return indexPromise;
}

export async function getRcnoaSchedule() {
  const collection = await getCollection();
  return withoutMongoId(await collection.findOne({
    type: RCNOA_TYPES.schedule,
    teamName: RCNOA_SCOPE.teamName,
    assistantName: RCNOA_SCOPE.assistantName,
  }));
}

export async function saveRcnoaSchedule(schedule, actor) {
  const collection = await getCollection();
  const existing = await getRcnoaSchedule();
  const document = baseDocument(RCNOA_TYPES.schedule, {
    ...schedule,
    id: existing?.id,
    version: Number(existing?.version || 0) + 1,
    createdAt: existing?.createdAt,
    createdBy: existing?.createdBy || actor,
  }, actor);

  await collection.updateOne(
    { type: RCNOA_TYPES.schedule, teamName: RCNOA_SCOPE.teamName },
    { $set: document },
    { upsert: true },
  );
  return document;
}

export async function getRcnoaQueryConfiguration() {
  const collection = await getCollection();
  const filter = {
    type: RCNOA_TYPES.queryConfiguration,
    id: QUERY_CONFIGURATION_ID,
    teamName: RCNOA_SCOPE.teamName,
    assistantName: RCNOA_SCOPE.assistantName,
  };
  let document = await collection.findOne(filter);
  if (!document) {
    const defaults = validateRcnoaQueryConfiguration(DEFAULT_RCNOA_QUERY_CONFIGURATION);
    const seeded = baseDocument(RCNOA_TYPES.queryConfiguration, {
      ...defaults,
      id: QUERY_CONFIGURATION_ID,
      version: 1,
    }, 'rcnoa-system');
    await collection.updateOne(filter, { $setOnInsert: seeded }, { upsert: true });
    document = await collection.findOne(filter);
  }
  return { ...DEFAULT_RCNOA_QUERY_CONFIGURATION, ...withoutMongoId(document) };
}

export async function saveRcnoaQueryConfiguration(configuration, actor) {
  const collection = await getCollection();
  const existing = await getRcnoaQueryConfiguration();
  if (Number(configuration?.version) !== Number(existing.version)) {
    throw new Error('RCNOA query configuration changed; refresh before saving');
  }
  const normalized = validateRcnoaQueryConfiguration(configuration);
  const document = baseDocument(RCNOA_TYPES.queryConfiguration, {
    ...normalized,
    id: QUERY_CONFIGURATION_ID,
    version: Number(existing.version || 0) + 1,
    createdAt: existing.createdAt,
    createdBy: existing.createdBy || actor,
  }, actor);
  const result = await collection.updateOne(
    {
      type: RCNOA_TYPES.queryConfiguration,
      id: QUERY_CONFIGURATION_ID,
      version: existing.version,
    },
    { $set: document },
  );
  if (result.matchedCount !== 1) {
    throw new Error('RCNOA query configuration changed; refresh before saving');
  }
  return document;
}

export async function getRcnoaBusinessConfiguration() {
  const collection = await getCollection();
  const filter = {
    type: RCNOA_TYPES.businessConfiguration,
    id: BUSINESS_CONFIGURATION_ID,
    teamName: RCNOA_SCOPE.teamName,
    assistantName: RCNOA_SCOPE.assistantName,
  };
  let document = await collection.findOne(filter);
  if (!document) {
    const seeded = baseDocument(RCNOA_TYPES.businessConfiguration, {
      ...seedRcnoaBusinessConfiguration(),
      id: BUSINESS_CONFIGURATION_ID,
      version: 1,
    }, 'rcnoa-system');
    await collection.updateOne(filter, { $setOnInsert: seeded }, { upsert: true });
    document = await collection.findOne(filter);
  }
  const { fileContractApproved, ...configuration } = withoutMongoId(document);
  return {
    ...RCNOA_TIMEOUT_DEFAULTS,
    ...configuration,
    reusePriorRcnaDecisions: configuration.reusePriorRcnaDecisions !== false,
    ignoreFirstRcnoColumn: configuration.ignoreFirstRcnoColumn === true,
    ignoreLastRcnoColumn: configuration.ignoreLastRcnoColumn === true,
  };
}

export async function saveRcnoaBusinessConfiguration(configuration, actor) {
  const collection = await getCollection();
  const existing = await getRcnoaBusinessConfiguration();
  if (Number(configuration?.version) !== Number(existing.version)) {
    throw new Error('RCNOA business configuration changed; refresh before saving');
  }
  const normalized = validateRcnoaBusinessConfiguration(configuration, existing);
  const document = baseDocument(RCNOA_TYPES.businessConfiguration, {
    ...normalized,
    id: BUSINESS_CONFIGURATION_ID,
    version: Number(existing.version || 0) + 1,
    createdAt: existing.createdAt,
    createdBy: existing.createdBy || actor,
  }, actor);
  const result = await collection.updateOne(
    {
      type: RCNOA_TYPES.businessConfiguration,
      id: BUSINESS_CONFIGURATION_ID,
      version: existing.version,
    },
    { $set: document, $unset: { fileContractApproved: '' } },
  );
  if (result.matchedCount !== 1) {
    throw new Error('RCNOA business configuration changed; refresh before saving');
  }
  return document;
}

export async function claimDueRcnoaSchedule(schedule, nextScheduledAt, actor = 'rcnoa-scheduler') {
  const collection = await getCollection();
  const timestamp = now();
  const result = await collection.findOneAndUpdate(
    {
      type: RCNOA_TYPES.schedule,
      id: schedule.id,
      version: schedule.version,
      enabled: true,
      nextScheduledAt: { $lte: timestamp },
    },
    {
      $set: {
        lastTriggeredAt: schedule.nextScheduledAt,
        nextScheduledAt,
        updatedAt: timestamp,
        updatedBy: actor,
      },
      $inc: { version: 1 },
    },
    { returnDocument: 'after' },
  );
  return withoutMongoId(result);
}

export async function hasActiveScheduledRcnoaRun() {
  const collection = await getCollection();
  return Boolean(await collection.findOne({
    type: RCNOA_TYPES.run,
    mode: 'scheduled',
    status: { $in: ['QUEUED', 'PROCESSING'] },
  }, { projection: { id: 1 } }));
}

export async function createRcnoaRun({
  mode,
  operation = 'RCNO_TO_RCNA',
  requestedBy,
  inputFileName,
  lookupSource = 'live',
  mockFixtureId = null,
  mockFixtureVersion = null,
  mockFixtureChecksum = null,
  parentId = null,
  idempotencyKey = null,
  retryOfRunId = null,
  status = 'QUEUED',
  currentStage = 'QUEUED',
}) {
  if (!['scheduled', 'adhoc'].includes(mode)) throw new Error('Invalid RCNOA run mode');
  if (!RCNOA_RUN_OPERATIONS.includes(operation)) throw new Error('Invalid RCNOA run operation');
  if (!['live', 'mock'].includes(lookupSource)) throw new Error('Invalid RCNOA lookup source');
  if (mode === 'scheduled' && lookupSource !== 'live') {
    throw new Error('Scheduled RCNOA runs must use live lookups');
  }
  if (!RCNOA_RUN_STATUSES.includes(status)) throw new Error('Invalid RCNOA run status');

  const collection = await getCollection();
  if (idempotencyKey) {
    const existing = await collection.findOne({ type: RCNOA_TYPES.run, idempotencyKey });
    if (existing) return withoutMongoId(existing);
  }

  const document = baseDocument(RCNOA_TYPES.run, {
    parentId,
    mode,
    operation,
    idempotencyKey,
    requestedBy,
    inputFileName,
    lookupSource,
    mockFixtureId,
    mockFixtureVersion,
    mockFixtureChecksum,
    retryOfRunId,
    status,
    currentStage,
    heartbeatAt: null,
    startedAt: null,
    finishedAt: null,
    counts: {
      received: 0,
      processed: 0,
      succeeded: 0,
      blocked: 0,
      failed: 0,
      rcnaWritten: 0,
      members834Written: 0,
      members834Skipped: 0,
    },
    errorCode: null,
    errorSummary: null,
    note: '',
  }, requestedBy);
  await collection.insertOne(document);
  return document;
}

export async function getRcnoaRun(runId) {
  const collection = await getCollection();
  return withoutMongoId(await collection.findOne({ type: RCNOA_TYPES.run, id: runId }));
}

export async function updateRcnoaRunNote(runId, note, actor) {
  const normalizedNote = String(note ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalizedNote.length > 120) {
    throw new Error('Run note cannot exceed 120 characters');
  }
  const collection = await getCollection();
  const result = await collection.findOneAndUpdate(
    { type: RCNOA_TYPES.run, id: runId },
    { $set: { note: normalizedNote, updatedAt: now(), updatedBy: actor } },
    { returnDocument: 'after' },
  );
  if (!result) throw new Error('RCNOA run not found');
  return withoutMongoId(result);
}

export async function listRcnoaRuns({ page, pageSize, status, mode, from, to } = {}) {
  const collection = await getCollection();
  const options = pageOptions({ page, pageSize });
  const query = { type: RCNOA_TYPES.run };
  if (status && RCNOA_RUN_STATUSES.includes(status)) query.status = status;
  if (mode && ['scheduled', 'adhoc'].includes(mode)) query.mode = mode;
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(to);
  }

  const [items, total] = await Promise.all([
    collection.find(query).sort({ createdAt: -1 }).skip(options.skip).limit(options.pageSize).toArray(),
    collection.countDocuments(query),
  ]);
  return { ...options, total, items: items.map(withoutMongoId) };
}

export async function transitionRcnoaRun(runId, {
  fromStatuses,
  status,
  currentStage,
  counts,
  errorCode = null,
  errorSummary = null,
  startedAt,
  actor,
}) {
  if (!Array.isArray(fromStatuses) || !fromStatuses.length) {
    throw new Error('At least one source status is required');
  }
  if (!RCNOA_RUN_STATUSES.includes(status)) throw new Error('Invalid RCNOA run status');

  const timestamp = now();
  const update = {
    status,
    currentStage,
    updatedAt: timestamp,
      heartbeatAt: TERMINAL_STATUSES.has(status) ? null : timestamp,
      finishedAt: TERMINAL_STATUSES.has(status) ? timestamp : null,
    errorCode,
    errorSummary,
    ...(startedAt ? { startedAt } : {}),
    ...(counts ? { counts } : {}),
    ...(actor ? { updatedBy: actor } : {}),
  };

  const collection = await getCollection();
  const result = await collection.findOneAndUpdate(
    { type: RCNOA_TYPES.run, id: runId, status: { $in: fromStatuses } },
    { $set: update },
    { returnDocument: 'after' },
  );
  return withoutMongoId(result);
}

export async function createRcnoaRunItems(runId, items, actor) {
  if (!Array.isArray(items) || !items.length) return [];
  const collection = await getCollection();
  const documents = items.map((item) => baseDocument(RCNOA_TYPES.runItem, {
    ...item,
    parentId: runId,
  }, actor));
  await collection.insertMany(documents);
  return documents;
}

export async function listRcnoaRunItems(runId, { page, pageSize } = {}) {
  const collection = await getCollection();
  const options = pageOptions({ page, pageSize });
  const query = { type: RCNOA_TYPES.runItem, parentId: runId };
  const [items, total] = await Promise.all([
    collection.find(query).sort({ sourceRowNumber: 1 }).skip(options.skip).limit(options.pageSize).toArray(),
    collection.countDocuments(query),
  ]);
  return { ...options, total, items: items.map(withoutMongoId) };
}

export async function listAllRcnoaRunItems(runId) {
  const collection = await getCollection();
  const query = { type: RCNOA_TYPES.runItem, parentId: runId };
  const items = await collection.find(query).sort({ sourceRowNumber: 1 }).toArray();
  return {
    page: 1,
    pageSize: items.length,
    total: items.length,
    items: items.map(withoutMongoId),
  };
}

export async function createRcnoaArtifact(runId, artifact, actor) {
  const collection = await getCollection();
  const document = baseDocument(RCNOA_TYPES.artifact, { ...artifact, parentId: runId }, actor);
  await collection.insertOne(document);
  return document;
}

export async function listRcnoaArtifacts(runId) {
  const collection = await getCollection();
  const items = await collection.find({ type: RCNOA_TYPES.artifact, parentId: runId })
    .sort({ createdAt: 1 })
    .toArray();
  return items.map(withoutMongoId);
}

export async function isRcnoaArtifactBlobShared(runId, { containerName, blobName }) {
  if (!containerName || !blobName) return false;
  const collection = await getCollection();
  return Boolean(await collection.findOne({
    type: RCNOA_TYPES.artifact,
    parentId: { $ne: runId },
    containerName,
    blobName,
  }));
}

export async function deleteRcnoaRunDocuments(runId) {
  const collection = await getCollection();
  const runResult = await collection.deleteOne({
    type: RCNOA_TYPES.run,
    id: runId,
    status: { $in: [...DELETABLE_STATUSES] },
  });
  if (!runResult.deletedCount) {
    throw new Error('Only completed or awaiting-upload RCNOA runs can be deleted');
  }
  const childrenResult = await collection.deleteMany({
    type: { $in: [RCNOA_TYPES.runItem, RCNOA_TYPES.artifact] },
    parentId: runId,
  });
  return { deletedRunCount: runResult.deletedCount, deletedChildCount: childrenResult.deletedCount };
}

export async function getRcnoaArtifact(artifactId) {
  const collection = await getCollection();
  return withoutMongoId(await collection.findOne({ type: RCNOA_TYPES.artifact, id: artifactId }));
}

export async function createRcnoaRetryRun(sourceRun, actor) {
  if (!sourceRun || !['ERROR', 'PARTIAL'].includes(sourceRun.status)) {
    throw new Error('Only failed or partial RCNOA runs can be retried');
  }
  if ((sourceRun.operation || 'RCNO_TO_RCNA') !== 'RCNO_TO_RCNA') {
    throw new Error('Only RCNO to RCNA runs can be retried');
  }
  return createRcnoaRun({
    mode: sourceRun.mode,
    operation: 'RCNO_TO_RCNA',
    requestedBy: actor,
    inputFileName: sourceRun.inputFileName,
    lookupSource: sourceRun.lookupSource || 'live',
    mockFixtureId: sourceRun.mockFixtureId || null,
    mockFixtureVersion: sourceRun.mockFixtureVersion || null,
    mockFixtureChecksum: sourceRun.mockFixtureChecksum || null,
    parentId: sourceRun.parentId,
    retryOfRunId: sourceRun.id,
    idempotencyKey: `retry:${sourceRun.id}:${uuidv4()}`,
  });
}

export async function findRcnoaInputArtifact(runId, artifactType = 'rcno') {
  const collection = await getCollection();
  return withoutMongoId(await collection.findOne({
    type: RCNOA_TYPES.artifact,
    parentId: runId,
    direction: 'input',
    artifactType,
  }));
}

function priorRecordMatchKey(record, secret) {
  const canonical = record.slice(0, 73)
    .map((value) => String(value ?? '').trim().toUpperCase())
    .join('\u001f');
  return createHmac('sha256', secret).update(canonical).digest('hex');
}

export function localPriorRcnaFilePath(environment = process.env) {
  const outputDirectory = environment.RCNOA_LOCAL_OUTPUT_DIR || 'rcnoa-local-output';
  return path.resolve(process.cwd(), outputDirectory, LOCAL_PRIOR_RCNA_FILE);
}

async function readLocalPriorRcnaStore(environment = process.env) {
  try {
    const parsed = JSON.parse(await readFile(localPriorRcnaFilePath(environment), 'utf-8'));
    if (parsed?.version !== 1 || !Array.isArray(parsed.records)) {
      throw new Error('Local prior RCNA store has an unsupported format');
    }
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') return { version: 1, records: [] };
    if (error instanceof SyntaxError) throw new Error('Local prior RCNA store contains invalid JSON');
    throw error;
  }
}

async function writeLocalPriorRcnaStore(store, environment = process.env) {
  const filePath = localPriorRcnaFilePath(environment);
  const temporaryPath = `${filePath}.${uuidv4()}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, 'utf-8');
  await rename(temporaryPath, filePath);
}

async function loadLocalPriorRcnaRecords(rcnoRecords, reconciliationCycle, secret) {
  const matchKeys = rcnoRecords.map((record) => priorRecordMatchKey(record, secret));
  const store = await readLocalPriorRcnaStore();
  const byKey = new Map(store.records
    .filter((record) => record.reconciliationCycle === reconciliationCycle)
    .map((record) => [record.memberMatchKey, record]));

  return rcnoRecords.flatMap((record, index) => {
    const prior = byKey.get(matchKeys[index]);
    if (!prior) return [];
    return [[
      ...record.slice(0, 73),
      String(prior.priority ?? ''),
      String(prior.noticeCode ?? ''),
      String(prior.noticeDescription ?? ''),
      String(prior.notes ?? ''),
      String(prior.ageMonths ?? '0'),
    ]];
  });
}

async function saveLocalPriorRcnaRecords(
  runId,
  workingRecords,
  reconciliationCycle,
  secret,
  actor,
) {
  const store = await readLocalPriorRcnaStore();
  const effectiveAt = now().toISOString();
  const recordsByKey = new Map(store.records.map((record) => [
    `${record.reconciliationCycle}:${record.memberMatchKey}`,
    record,
  ]));
  workingRecords.forEach((record) => {
    const memberMatchKey = priorRecordMatchKey(record, secret);
    recordsByKey.set(`${reconciliationCycle}:${memberMatchKey}`, {
      parentId: runId,
      reconciliationCycle,
      memberMatchKey,
      priority: record[73],
      noticeCode: record[74],
      noticeDescription: record[75],
      notes: record[76],
      ageMonths: Number(record[77] || 0),
      effectiveAt,
      updatedBy: actor,
    });
  });
  await writeLocalPriorRcnaStore({
    version: 1,
    updatedAt: effectiveAt,
    records: [...recordsByKey.values()],
  });
  return workingRecords.length;
}

export async function loadPriorRcnaRecords(rcnoRecords, reconciliationCycle, secret) {
  if (!secret) throw new Error('Prior RCNA match-key secret is required');
  if (String(process.env.RCNOA_LOCAL_TESTING).toLowerCase() === 'true') {
    return loadLocalPriorRcnaRecords(rcnoRecords, reconciliationCycle, secret);
  }
  const matchKeys = rcnoRecords.map((record) => priorRecordMatchKey(record, secret));
  const uniqueMatchKeys = [...new Set(matchKeys)];
  const collection = await getCollection();
  const byKey = new Map();
  for (let offset = 0; offset < uniqueMatchKeys.length; offset += PRIOR_RCNA_QUERY_BATCH_SIZE) {
    const batch = uniqueMatchKeys.slice(offset, offset + PRIOR_RCNA_QUERY_BATCH_SIZE);
    const priorDocuments = await collection.find({
      type: RCNOA_TYPES.priorRcna,
      reconciliationCycle,
      memberMatchKey: { $in: batch },
    }).sort({ effectiveAt: -1 }).toArray();
    priorDocuments.forEach((document) => {
      if (!byKey.has(document.memberMatchKey)) byKey.set(document.memberMatchKey, document);
    });
  }

  return rcnoRecords.flatMap((record, index) => {
    const prior = byKey.get(matchKeys[index]);
    if (!prior) return [];
    return [[
      ...record.slice(0, 73),
      String(prior.priority ?? ''),
      String(prior.noticeCode ?? ''),
      String(prior.noticeDescription ?? ''),
      String(prior.notes ?? ''),
      String(prior.ageMonths ?? '0'),
    ]];
  });
}

export async function savePriorRcnaRecords(runId, workingRecords, reconciliationCycle, secret, actor) {
  if (!secret) throw new Error('Prior RCNA match-key secret is required');
  if (!Array.isArray(workingRecords) || !workingRecords.length) return 0;
  if (String(process.env.RCNOA_LOCAL_TESTING).toLowerCase() === 'true') {
    return saveLocalPriorRcnaRecords(
      runId,
      workingRecords,
      reconciliationCycle,
      secret,
      actor,
    );
  }
  const collection = await getCollection();
  const effectiveAt = now();
  const operations = workingRecords.map((record) => {
    const memberMatchKey = priorRecordMatchKey(record, secret);
    const document = baseDocument(RCNOA_TYPES.priorRcna, {
      parentId: runId,
      reconciliationCycle,
      memberMatchKey,
      priority: record[73],
      noticeCode: record[74],
      noticeDescription: record[75],
      notes: record[76],
      ageMonths: Number(record[77] || 0),
      effectiveAt,
    }, actor);
    return {
      updateOne: {
        filter: { type: RCNOA_TYPES.priorRcna, reconciliationCycle, memberMatchKey },
        update: { $set: document },
        upsert: true,
      },
    };
  });
  const result = await collection.bulkWrite(operations, { ordered: false });
  return Number(result.upsertedCount || 0) + Number(result.modifiedCount || 0);
}

export async function recoverStaleRcnoaRuns(actor = 'rcnoa-system') {
  const configuration = await getRcnoaBusinessConfiguration();
  const staleProcessingTimeoutMs = Number(
    configuration.processingInactivityMinutes
      || RCNOA_TIMEOUT_DEFAULTS.processingInactivityMinutes,
  ) * 60 * 1000;
  const timestamp = now();
  const collection = await getCollection();
  const staleResult = await collection.updateMany(
    {
      type: RCNOA_TYPES.run,
      status: 'PROCESSING',
      heartbeatAt: { $lt: new Date(timestamp.getTime() - staleProcessingTimeoutMs) },
    },
    {
      $set: {
        status: 'ERROR',
        currentStage: 'ERROR',
        heartbeatAt: null,
        finishedAt: timestamp,
        updatedAt: timestamp,
        updatedBy: actor,
        errorCode: 'RCNOA_PROCESSING_STALE',
        errorSummary: 'Processing stopped without completing. Submit the run again.',
      },
    },
  );
  if (staleResult.modifiedCount) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'recoverStaleRcnoaRuns',
        detail: { recoveredCount: staleResult.modifiedCount, staleAfterMs: staleProcessingTimeoutMs },
      },
    }));
  }
  return staleResult.modifiedCount;
}

export async function claimNextQueuedRcnoaRun(actor = 'rcnoa-worker', { mode, lookupSource } = {}) {
  await recoverStaleRcnoaRuns(actor);
  const timestamp = now();
  const collection = await getCollection();
  const filter = { type: RCNOA_TYPES.run, status: 'QUEUED' };
  if (mode) {
    if (!['adhoc', 'scheduled'].includes(mode)) throw new Error('Invalid RCNOA run mode');
    filter.mode = mode;
  }
  if (lookupSource) {
    if (!['live', 'mock'].includes(lookupSource)) throw new Error('Invalid RCNOA lookup source');
    filter.lookupSource = lookupSource;
  }
  const result = await collection.findOneAndUpdate(
    filter,
    {
      $set: {
        status: 'PROCESSING',
        currentStage: 'CLAIMED',
        startedAt: timestamp,
        heartbeatAt: timestamp,
        updatedAt: timestamp,
        updatedBy: actor,
      },
    },
    { sort: { createdAt: 1 }, returnDocument: 'after' },
  );
  return withoutMongoId(result);
}

export async function setRcnoaRunInput(runId, inputFileName, actor = 'rcnoa-worker') {
  const collection = await getCollection();
  const result = await collection.findOneAndUpdate(
    { type: RCNOA_TYPES.run, id: runId, status: 'PROCESSING' },
    { $set: { inputFileName, updatedAt: now(), updatedBy: actor } },
    { returnDocument: 'after' },
  );
  return withoutMongoId(result);
}