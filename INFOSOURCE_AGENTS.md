# InfoSource Agent & Batch Runbook

## Overview
This document describes the InfoSource ingestion batch that reads metadata from Infosource CSV exports, fetches the referenced files/HTML snapshots from the Linux clone directories, vectorizes the content, and loads chunks into the `infosource_assets` and `infosource_pages` Azure AI Search indexes (new t3 environment).

## Environment & Secrets
| Scope | Required Variables | Notes |
| --- | --- | --- |
| Linux server access | `LINUX_SERVER_HOST`, `LINUX_SERVER_USERNAME`, `LINUX_SERVER_ROOT_FOLDER`, **one** of `LINUX_SERVER_PASSWORD` or `LINUX_SERVER_KEY_PATH`/`LINUX_SERVER_PRIVATE_KEY` | Used by `linuxServerAccessService.js` for SSH/SFTP. Root folder should point to the parent directory that contains `assets_clone/` and `pages_clone/`. |
| Azure AI Search (new t3) | `envName` (default `dev`), `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint.new.t3`, `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.new.t3.api.key` | These keys feed the `SearchClient` in `infoSearchBatchService.js`. |
| Batch identity | `INFOSEARCH_BATCH_NUID` (optional) | Defaults to `infosource_batch` if not provided; passed to vectorization for traceability. |

## Source Inputs
- `infoSourceData/all_assets_2025-12-03.csv`
  - Uses columns: Page Reference, Document Title, Document Path, Document Owner, Last Reviewed/Updated, Keywords, Market Owner, Market, Unique Id, Category, Asset Status.
  - Row `Document Path` maps to `[LINUX_SERVER_ROOT_FOLDER]/assets_clone/...`.
- `infoSourceData/all_pages_2025-12-03.csv`
  - Uses columns: Title, Path, Category, Market, Keywords, Content Owner, Valid Through, Last Reviewed/Updated, Unique Id.
  - Row `Path` maps to `[LINUX_SERVER_ROOT_FOLDER]/pages_clone/...` with `.html` appended.

## Batch Implementation
The batch entrypoint lives at `app/services/batch/infoSearchBatchService.js` and performs:
1. Streams each CSV with `csv-parse` (line-by-line, header aware).
2. Builds the Linux remote path (assets vs pages) and downloads the file using `copyFileFromLinuxServer()` into `.tmp/infosource/...`.
3. Extracts text:
   - HTML → plain text via `html-to-text`.
   - PDF/DOCX/images → `extractImageText()` (uses GPT-4o pipeline) with fallbacks (e.g., `pdf-extraction`, `parseOfficeAsync`).
   - Other Office formats fall back to `parseOfficeAsync`.
4. Chunks text with multilingual heuristics (Chinese-aware) and vectorizes each chunk through `vectorizeDataService.vectorize()` with retry/backoff on 429s.
5. Builds documents conforming to `infosource_assets` or `infosource_pages` schemas (see `infosource_assets.json` & `infosource_pages.json`). Document IDs are deterministic (`Unique Id::chunkIndex`).
6. Uploads chunks in batches (≤50) to Azure AI Search using exponential backoff for throttling.
7. Emits `kpmsg` logs for each major milestone plus summary counts (`processed`, `missing`, `failed`, `uploaded`).

## Running the Batch
1. Open a shell and load environment variables (e.g., `env17.bat`).
2. Install dependencies if needed: `npm install` (ensures `csv-parse` etc.).
3. Execute the batch:
   - Full run: `npm run infoSearchBatch`
   - Filtered run (e.g., single asset row): `npm run infoSearchBatch -- --type assets --id ABC123`
     - `--type` accepts `assets` or `pages`; omit to run both.
     - `--id` (or `--uniqueId`) restricts processing to the matching CSV row.
4. Observe kpmsg logs for download failures, extraction issues, or upload retries. The run ends with `InfoSearch.batchComplete` summarizing counts for assets and pages.

## Validation Checklist
- Confirm both CSV files exist under `infoSourceData/` with the expected headers.
- After the run, query the `infosource_assets` and `infosource_pages` indexes (e.g., via Azure portal or existing search utilities) to ensure new documents are present.
- If a row fails (missing file, empty text, etc.), the logs include the remote path and reason. Fix the underlying issue and rerun; the deterministic IDs allow idempotent reprocessing.
- Temporary files are stored under `.tmp/infosource` and cleaned per-row, but you can delete the entire folder after the batch if desired.

## Troubleshooting
- **Missing env var**: `infoSearchBatchService` validates required variables at startup and throws detailed errors.
- **SSH auth failure**: verify password or key settings. For key-based auth, ensure the path is accessible to Node and the key is unencrypted or has an accompanying passphrase variable.
- **429 errors**: vectorization and upload paths already retry with exponential backoff; persistent failures may indicate service throttling—rerun later.
- **Empty extracted text**: check file encoding or format. The batch logs `InfoSearch.assetEmptyText` / `InfoSearch.pageEmptyText` with the remote path for manual inspection.

## Future Extensions
- Add resume/retry files for failed rows.
- Tie into scheduler/queue once volume dictates automation.
- Expand to handle additional content roots under the Linux server as new CSV exports become available.
