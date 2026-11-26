import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

const { runRcnoaWorkerOnce } = await import('../app/services/rcnoa/rcnoaOperationsService.js');

const maxRuns = Math.min(100, Math.max(1, Number.parseInt(process.env.RCNOA_WORKER_MAX_RUNS || '10', 10)));

async function main() {
  let processed = 0;
  for (; processed < maxRuns; processed += 1) {
    const result = await runRcnoaWorkerOnce();
    if (!result.processedRun) break;
    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'rcnoaWorkerRunComplete',
        detail: {
          runId: result.processedRun.id,
          status: result.processedRun.status,
          currentStage: result.processedRun.currentStage,
        },
      },
    }));
  }

  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'rcnoaWorkerComplete',
      detail: { processed },
    },
  }));
}

main().catch((error) => {
  console.error(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'rcnoaWorkerFailed',
      detail: { error: String(error?.message || 'RCNOA worker failed').slice(0, 500) },
    },
  }));
  process.exitCode = 1;
});