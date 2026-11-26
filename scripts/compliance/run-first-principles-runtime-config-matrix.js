import { mkdtemp, rm, writeFile, readFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveFirstPrinciplesRuntimeConfigV1 } from '../../app/services/langgraphs/compliance/helpers/loadFirstPrinciplesRuntimeConfigV1.js';

function getByPath(obj, dottedPath) {
  return String(dottedPath || '')
    .split('.')
    .filter(Boolean)
    .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function assertEqual(actual, expected, context) {
  const pass = actual === expected;
  if (!pass) {
    throw new Error(`${context}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function loadFixture() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const fixturePath = path.join(currentDir, 'fixtures', 'first-pri-runtime-config-matrix.json');
  const content = await readFile(fixturePath, 'utf8');
  return JSON.parse(content);
}

async function runCase(testCase) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'first-pri-config-matrix-'));
  const envOverrides = (testCase?.env && typeof testCase.env === 'object') ? testCase.env : {};
  const previousEnv = new Map();

  try {
    for (const [key, value] of Object.entries(envOverrides)) {
      previousEnv.set(key, process.env[key]);
      if (value === null || value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = String(value);
      }
    }

    if (!testCase.skipConfigFile) {
      const configFilePath = path.join(tempDir, 'first-principles-runtime-v1.json');
      await writeFile(configFilePath, JSON.stringify(testCase.configFile || {}, null, 2), 'utf8');
    }

    const snapshot = await resolveFirstPrinciplesRuntimeConfigV1({
      inferredLob: testCase.inferredLob || '',
      configDir: tempDir,
      geisingerConfigDocuments: Array.isArray(testCase.geisingerConfigDocuments)
        ? testCase.geisingerConfigDocuments
        : [],
    });

    for (const [dottedPath, expectedValue] of Object.entries(testCase.expected || {})) {
      const actual = getByPath(snapshot, dottedPath);
      assertEqual(actual, expectedValue, `[${testCase.id}] ${dottedPath}`);
    }

    return {
      id: testCase.id,
      description: testCase.description || '',
      status: 'PASS',
    };
  } finally {
    for (const [key, previousValue] of previousEnv.entries()) {
      if (previousValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previousValue;
      }
    }

    await rm(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  const fixture = await loadFixture();
  const cases = Array.isArray(fixture?.cases) ? fixture.cases : [];
  if (cases.length === 0) {
    throw new Error('No test cases found in first-pri-runtime-config-matrix fixture.');
  }

  const results = [];
  for (const testCase of cases) {
    try {
      const result = await runCase(testCase);
      results.push(result);
    } catch (error) {
      results.push({
        id: testCase.id,
        description: testCase.description || '',
        status: 'FAIL',
        error: error?.message || String(error),
      });
    }
  }

  const failed = results.filter((item) => item.status === 'FAIL');
  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'firstPrinciplesRuntimeConfigMatrix',
      detail: {
        total: results.length,
        passed: results.length - failed.length,
        failed: failed.length,
      },
    },
  }));

  for (const result of results) {
    const suffix = result.status === 'PASS' ? '' : ` :: ${result.error}`;
    console.log(`${result.status} ${result.id} - ${result.description}${suffix}`);
  }

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'firstPrinciplesRuntimeConfigMatrixFailed',
      detail: {
        error: error?.message || String(error),
      },
    },
  }));
  process.exitCode = 1;
});
