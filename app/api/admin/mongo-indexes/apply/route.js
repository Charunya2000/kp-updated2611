import { NextResponse } from 'next/server';
import { withAppAdminGuard } from '@/app/api/guards';
import { connectToDatabase } from '@/db/connection';
import { createMongoCollectionWithIndexes } from '@/app/services/mongoIndexService';

export const POST = await withAppAdminGuard(postHandler);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateIndexLine(parsed, lineNumber) {
  if (!isPlainObject(parsed)) {
    return { error: `Line ${lineNumber}: expected a JSON object.` };
  }

  const databaseName = String(parsed.databaseName ?? '').trim();
  const collectionName = String(parsed.collectionName ?? '').trim();
  const name = String(parsed.name ?? '').trim();
  const key = parsed.key;
  const options = parsed.options == null ? {} : parsed.options;

  if (!databaseName) {
    return { error: `Line ${lineNumber}: missing required field "databaseName".` };
  }

  if (!collectionName) {
    return { error: `Line ${lineNumber}: missing required field "collectionName".` };
  }

  if (!name) {
    return { error: `Line ${lineNumber}: missing required field "name".` };
  }

  if (!isPlainObject(key) || Object.keys(key).length === 0) {
    return { error: `Line ${lineNumber}: "key" must be a non-empty object.` };
  }

  if (!isPlainObject(options)) {
    return { error: `Line ${lineNumber}: "options" must be an object when provided.` };
  }

  return {
    normalized: {
      lineNumber,
      databaseName,
      collectionName,
      name,
      key,
      options,
    },
  };
}

function parseJsonLines(indexData, targetDatabaseName) {
  const validationErrors = [];
  const validIndexes = [];
  const indexNames = new Set();
  const lines = String(indexData || '').split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index].trim();

    if (!line) {
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      validationErrors.push({
        line: lineNumber,
        error: `Line ${lineNumber}: invalid JSON (${error.message}).`,
      });
      continue;
    }

    const validation = validateIndexLine(
      targetDatabaseName && isPlainObject(parsed) ? { ...parsed, databaseName: targetDatabaseName } : parsed,
      lineNumber
    );
    if (validation.error) {
      validationErrors.push({
        line: lineNumber,
        error: validation.error,
      });
      continue;
    }

    const indexDef = validation.normalized;
    const identity = JSON.stringify([indexDef.databaseName, indexDef.collectionName, indexDef.name]);
    if (indexNames.has(identity)) {
      validationErrors.push({ line: lineNumber, error: `Line ${lineNumber}: duplicate index name "${indexDef.name}" for ${indexDef.databaseName}.${indexDef.collectionName}.` });
      continue;
    }
    indexNames.add(identity);
    validIndexes.push(indexDef);
  }

  return { validIndexes, validationErrors };
}

function groupIndexes(validIndexes) {
  const grouped = new Map();

  for (const indexDef of validIndexes) {
    const key = JSON.stringify([indexDef.databaseName, indexDef.collectionName]);
    const existing = grouped.get(key) || [];
    existing.push(indexDef);
    grouped.set(key, existing);
  }

  return grouped;
}

async function validateTargetCollections(validIndexes) {
  const errorsByGroup = new Map();

  for (const [groupKey, definitions] of groupIndexes(validIndexes)) {
    const { databaseName, collectionName } = definitions[0];
    try {
      const db = await connectToDatabase(databaseName);
      await db
        .listCollections({ name: collectionName }, { nameOnly: true })
        .toArray();
    } catch (error) {
      errorsByGroup.set(groupKey, `Cannot validate ${databaseName}.${collectionName}: ${error.message}`);
    }
  }

  return errorsByGroup;
}

async function postHandler(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const indexData = String(body?.indexData ?? '');
  const dryRun = Boolean(body?.dryRun);
  if (body?.targetDatabaseName != null && typeof body.targetDatabaseName !== 'string') {
    return NextResponse.json({ error: 'targetDatabaseName must be a string.' }, { status: 400 });
  }
  const targetDatabaseName = (body?.targetDatabaseName ?? '').trim();

  if (!indexData.trim()) {
    return NextResponse.json(
      { error: 'indexData is required and must contain JSONL content.' },
      { status: 400 }
    );
  }

  const { validIndexes, validationErrors } = parseJsonLines(indexData, targetDatabaseName);

  if (validIndexes.length === 0 || validationErrors.length > 0) {
    return NextResponse.json({
      success: false,
      dryRun,
      summary: {
        totalLines: indexData.split(/\r?\n/).filter((line) => line.trim()).length,
        validIndexes: validIndexes.length,
        invalidIndexes: validationErrors.length,
        readyToApply: 0,
        createdCollectionsCount: 0,
        appliedCount: 0,
        failedCount: 0,
      },
      validationErrors,
      results: [],
    }, { status: 400 });
  }

  const collectionErrors = await validateTargetCollections(validIndexes);
  for (const indexDef of validIndexes) {
    const groupKey = JSON.stringify([indexDef.databaseName, indexDef.collectionName]);
    if (collectionErrors.has(groupKey)) {
      validationErrors.push({
        line: indexDef.lineNumber,
        error: `Line ${indexDef.lineNumber}: ${collectionErrors.get(groupKey)}`,
      });
    }
  }

  const readyToApply = validIndexes.filter((indexDef) => {
    const groupKey = JSON.stringify([indexDef.databaseName, indexDef.collectionName]);
    return !collectionErrors.has(groupKey);
  });

  if (dryRun) {
    const results = readyToApply.map((indexDef) => ({
      line: indexDef.lineNumber,
      databaseName: indexDef.databaseName,
      collectionName: indexDef.collectionName,
      name: indexDef.name,
      status: 'validated',
      message: 'JSONL fields and target database access validated. Indexes will be applied to existing collections or created together with new collections. Provider index support and conflicts are checked only when applying.',
    }));

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'applyMongoIndexesDryRun',
        detail: {
          validIndexes: validIndexes.length,
          invalidIndexes: validationErrors.length,
          readyToApply: readyToApply.length,
        },
      },
    }));

    return NextResponse.json({
      success: validationErrors.length === 0,
      dryRun: true,
      summary: {
        totalLines: indexData.split(/\r?\n/).filter((line) => line.trim()).length,
        validIndexes: validIndexes.length,
        invalidIndexes: validationErrors.length,
        readyToApply: readyToApply.length,
        appliedCount: 0,
        failedCount: 0,
        createdCollectionsCount: 0,
      },
      validationErrors,
      results,
    });
  }

  const results = [];
  let appliedCount = 0;
  let failedCount = 0;
  let createdCollectionsCount = 0;

  for (const definitions of groupIndexes(readyToApply).values()) {
    let groupError;
    let created = false;
    try {
      const db = await connectToDatabase(definitions[0].databaseName);
      ({ created } = await createMongoCollectionWithIndexes(db, definitions));
      if (created) {
        createdCollectionsCount += 1;
      }
      appliedCount += definitions.length;
    } catch (error) {
      groupError = error.message || 'Unknown error while applying indexes. Some indexes may already have been applied.';
      failedCount += definitions.length;
    }
    for (const indexDef of definitions) {
      results.push({
        line: indexDef.lineNumber,
        databaseName: indexDef.databaseName,
        collectionName: indexDef.collectionName,
        name: indexDef.name,
        status: groupError ? 'failed' : 'applied',
        message: groupError || (created
          ? 'Collection created with all supplied indexes; stored keys and uniqueness verified.'
          : 'Indexes applied to existing collection; stored keys and uniqueness verified.'),
      });
    }
  }

  const success = validationErrors.length === 0 && failedCount === 0;

  const responsePayload = {
    success,
    dryRun: false,
    summary: {
      totalLines: indexData.split(/\r?\n/).filter((line) => line.trim()).length,
      validIndexes: validIndexes.length,
      invalidIndexes: validationErrors.length,
      readyToApply: readyToApply.length,
      appliedCount,
      failedCount,
      createdCollectionsCount,
    },
    validationErrors,
    results,
  };

  if (success) {
    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'applyMongoIndexes',
        detail: {
          appliedCount,
          createdCollectionsCount,
          totalProvided: validIndexes.length,
        },
      },
    }));

    return NextResponse.json(responsePayload, { status: 200 });
  }

  console.error(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'applyMongoIndexes',
      detail: {
        invalidIndexes: validationErrors.length,
        failedCount,
      },
    },
  }));

  return NextResponse.json(responsePayload, { status: 400 });
}
