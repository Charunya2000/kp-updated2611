import { setProcessEnvironment } from '../configActions.js';
import { runFirstPrinciplesPdfReview } from './run-first-principles-pdf-review.js';

async function main() {
  await setProcessEnvironment();
  await runFirstPrinciplesPdfReview(process.argv);
}

main().catch((error) => {
  console.error('First-principles PDF review (with config) failed:', error?.message || String(error));
  process.exitCode = 1;
});
