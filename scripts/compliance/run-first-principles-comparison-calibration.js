import fs from 'node:fs';
import path from 'node:path';
import { compareWithFirstPrinciplesEngine } from '../../app/services/langgraphs/compliance/docConversation1stPriComparisonEngine.js';

function parseArgs(argv = []) {
  const args = argv.slice(2);

  const fixturePos = args.indexOf('--fixture');
  const fixturePath = fixturePos >= 0
    ? String(args[fixturePos + 1] || '').trim()
    : 'scripts/compliance/fixtures/first-pri-comparison-calibration.json';

  const scorePos = args.indexOf('--scores');
  const scoreList = scorePos >= 0
    ? String(args[scorePos + 1] || '').split(',').map((value) => Number(value.trim())).filter((value) => Number.isFinite(value))
    : [];

  return {
    fixturePath,
    scoreList,
  };
}

function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function extractConversationIdFromFilter(filter = '') {
  const match = String(filter || '').match(/conversation_id\s+eq\s+'([^']+)'/i);
  return match ? String(match[1]).trim() : '';
}

function createMockDeps(conversations = {}) {
  return {
    getSearchClient() {
      return {
        async search(_queryText, options = {}) {
          const conversationId = extractConversationIdFromFilter(options.filter);
          const docs = Array.isArray(conversations[conversationId]) ? conversations[conversationId] : [];
          return {
            results: (async function* generate() {
              for (const document of docs) {
                yield { document };
              }
            })(),
          };
        },
      };
    },
    async generateComparisonSummary(result) {
      const text = [
        `Matches=${result?.summary?.matchCount || 0}`,
        `Partials=${result?.summary?.partialCount || 0}`,
        `Conflicts=${result?.summary?.conflictCount || 0}`,
      ].join('; ');
      return { text };
    },
    logEvent(name, detail) {
      console.log(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name,
          detail,
        }
      }));
    },
  };
}

function getConflictPairKey(conflict = {}) {
  const leftId = normalizeString(conflict?.left?.requirementId);
  const rightId = normalizeString(conflict?.right?.requirementId);
  if (!leftId || !rightId) return '';
  return `${leftId}::${rightId}`;
}

function scoreRunOrderComparator(a, b) {
  // Prefer zero misses first, then fewer false positives, then more true positives, then higher threshold.
  if (a.fn !== b.fn) return a.fn - b.fn;
  if (a.fp !== b.fp) return a.fp - b.fp;
  if (a.tp !== b.tp) return b.tp - a.tp;
  return b.minConflictScore - a.minConflictScore;
}

async function runScenario(scenario, minConflictScore, deps) {
  const result = await compareWithFirstPrinciplesEngine({
    leftConversationId: scenario.leftConversationId,
    rightConversationId: scenario.rightConversationId,
    queryText: scenario.query,
    options: {
      top: 25,
      minPartialScore: 0.45,
      minMatchScore: 0.72,
      minConflictScore,
    },
  }, deps);

  const expected = new Set(Array.isArray(scenario.expectedConflictPairs) ? scenario.expectedConflictPairs : []);
  const predicted = new Set(
    Array.isArray(result?.conflicts)
      ? result.conflicts.map(getConflictPairKey).filter(Boolean)
      : []
  );

  const tpPairs = Array.from(expected).filter((pair) => predicted.has(pair));
  const fpPairs = Array.from(predicted).filter((pair) => !expected.has(pair));
  const fnPairs = Array.from(expected).filter((pair) => !predicted.has(pair));

  return {
    scenarioId: scenario.id,
    minConflictScore,
    expectedConflictPairs: Array.from(expected),
    predictedConflictPairs: Array.from(predicted),
    tp: tpPairs.length,
    fp: fpPairs.length,
    fn: fnPairs.length,
    tpPairs,
    fpPairs,
    fnPairs,
    summary: result?.summary || {},
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const fixtureAbsolute = path.resolve(process.cwd(), args.fixturePath);
  const fixture = JSON.parse(fs.readFileSync(fixtureAbsolute, 'utf8'));

  const scoreSweep = args.scoreList.length > 0
    ? args.scoreList
    : (Array.isArray(fixture?.scoreSweep) ? fixture.scoreSweep : [0.42]);

  const scenarios = Array.isArray(fixture?.scenarios) ? fixture.scenarios : [];
  if (scenarios.length === 0) {
    throw new Error('Calibration fixture has no scenarios.');
  }

  const deps = createMockDeps(fixture?.conversations || {});

  const runs = [];
  for (const score of scoreSweep) {
    for (const scenario of scenarios) {
      runs.push(await runScenario(scenario, score, deps));
    }
  }

  const aggregated = scoreSweep.map((score) => {
    const scoreRuns = runs.filter((run) => run.minConflictScore === score);
    const tp = scoreRuns.reduce((sum, run) => sum + run.tp, 0);
    const fp = scoreRuns.reduce((sum, run) => sum + run.fp, 0);
    const fn = scoreRuns.reduce((sum, run) => sum + run.fn, 0);
    const precision = (tp + fp) > 0 ? Number((tp / (tp + fp)).toFixed(3)) : 1;
    const recall = (tp + fn) > 0 ? Number((tp / (tp + fn)).toFixed(3)) : 1;
    return {
      minConflictScore: score,
      tp,
      fp,
      fn,
      precision,
      recall,
    };
  }).sort(scoreRunOrderComparator);

  const recommended = aggregated[0] || null;

  console.log('\nFirst-principles comparison calibration summary');
  console.log(JSON.stringify({
    fixturePath: args.fixturePath,
    scoreSweep,
    recommended,
    aggregated,
    runs,
  }, null, 2));

  if (recommended && recommended.fn > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('First-principles comparison calibration failed:', error?.message || String(error));
  process.exitCode = 1;
});
