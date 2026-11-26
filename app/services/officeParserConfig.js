import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import path from 'path';

/**
 * officeparser 6.x parses PDFs with pdfjs-dist, which needs a worker. When no
 * `pdfWorkerSrc` is supplied, officeparser auto-resolves the worker with
 * `require.resolve(...)` and hands pdfjs a raw absolute path. On Windows that
 * path is a drive-letter path (e.g. `C:\...\pdf.worker.mjs`), which Node's ESM
 * loader rejects with:
 *   "Only URLs with a scheme in: file, data, and node are supported ...
 *    Received protocol 'c:'"
 * causing "Setting up fake worker failed" and breaking all PDF extraction.
 *
 * We resolve the worker to a proper `file://` URL and pass it explicitly via
 * `pdfWorkerSrc`, which works on Windows and POSIX alike. Resolution is done
 * once and cached; if it fails we fall back to officeparser's own behavior.
 */
let cachedWorkerSrc;

function resolvePdfWorkerSrc() {
    if (cachedWorkerSrc !== undefined) return cachedWorkerSrc;

    try {
        // Resolve from the project root (where node_modules lives). Avoids relying
        // on import.meta.url, which is unreliable once bundled by Next.js.
        const requireFromCwd = createRequire(pathToFileURL(path.join(process.cwd(), 'package.json')));
        const workerPath = requireFromCwd.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
        cachedWorkerSrc = pathToFileURL(workerPath).href;
    } catch (error) {
        console.error(JSON.stringify({
            kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'resolvePdfWorkerSrc',
                detail: { error: error.message },
            },
        }));
        cachedWorkerSrc = null; // Let officeparser use its own fallback.
    }

    return cachedWorkerSrc;
}

/**
 * Build an officeparser config that includes a valid `pdfWorkerSrc` file:// URL.
 * Safe to use for non-PDF documents too (the option is ignored for DOCX/PPTX/etc).
 *
 * @param {object} [extra] - Additional officeparser config to merge in.
 * @returns {object} officeparser config with pdfWorkerSrc when resolvable.
 */
export function getOfficeParserConfig(extra = {}) {
    const workerSrc = resolvePdfWorkerSrc();
    return workerSrc ? { ...extra, pdfWorkerSrc: workerSrc } : { ...extra };
}

export default getOfficeParserConfig;
