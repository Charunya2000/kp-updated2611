# InfoSource Batch Processing Plan

## 1. Objectives
- Pull Infosource asset and page metadata from the provided CSVs.
- Retrieve referenced files and HTML content from the Linux server clones.
- Chunk, vectorize, and upload enriched documents into the `infosource_assets` and `infosource_pages` Azure AI Search indexes that are scoped to the `new.t3` endpoints/keys.
- Keep the architecture modular so it can plug into existing LangGraph-style workflows when needed.

## 2. Environment & Secrets
| Scope | Variables | Notes |
| --- | --- | --- |
| Linux server access | `LINUX_SERVER_HOST`, `LINUX_SERVER_ROOT_FOLDER`, `LINUX_SERVER_USERNAME`, `LINUX_SERVER_PASSWORD` | Use `linuxServerAccessService.js` to make authenticated SFTP/SSH requests. Consider allowing key-based auth if future requirements demand it. |
| Azure AI Search (new.t3) | `envName` (default `dev`), `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint.new.t3`, `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.new.t3.api.key`, `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.new.t3.api.key` | Instantiate new `SearchClient` instances per index. Keep credentials scoped to this batch process only. |
| Other services | Reuse patterns from `vectorizeDataService.js`, `nexusos/completionsClient.js`, `db/*` | Ensure no direct OpenAI calls; go through the integration layer. |

## 3. Input Data Sources
1. `infoSourceData/all_assets_2025-12-03.csv`
   - Required columns: Page Reference, Document Title, Document Path, Document Owner, Last Reviewed/Updated (date only), Keywords, Market Owner, Market, Unique Id, Category, Asset Status.
   - Map `Document Path` → `[LINUX_SERVER_ROOT_FOLDER]/assets_clone/...`.
2. `infoSourceData/all_pages_2025-12-03.csv`
   - Required columns: Title, Path, Category, Market, Keywords, Content Owner, Valid Through (date only), Last Reviewed/Updated (date only), Unique Id.
   - Map `Path` → `[LINUX_SERVER_ROOT_FOLDER]/pages_clone/...`.
3. Raw content locations (Linux server):
   - `[ROOT]/AEM_reports`
   - `[ROOT]/assets_clone`
   - `[ROOT]/assets_lists`
   - `[ROOT]/pages_clone`
   - `[ROOT]/pages_lists`

## 4. High-Level Flow
1. **Bootstrap**: Resolve env vars, set up SSH/SFTP client, instantiate Search clients for both indexes, and prepare vectorization/completions helpers.
2. **Load CSV Metadata**: Stream each CSV line-by-line to avoid memory blowup, using headers to map fields.
3. **Locate Files**: For each row, derive the Linux path (assets vs. pages) and confirm file existence using `linuxServerAccessService.js` + SFTP.
4. **Content Extraction**:
   - For binary files (PDF, DOCX, images), reuse logic from `insertChunckedFileIntoVectorDataService.js` (chunking, extraction fallback, image handling via `extractImageText`).
   - For HTML/page directories, read both the HTML page and any associated metadata files under `pages_clone`.
5. **Chunk + Vectorize**: Apply `chunkDocument`-like logic; call `vectorizeDataService.vectorize()` with retry/backoff for 429s. For assets needing additional prompt enrichment, call `nexusos/completionsClient` if necessary.
6. **Build Search Documents**: Mirror the structure in `insertVectorDataService.js` but tailor fields to `infosource_assets.json` and `infosource_pages.json` schemas (IDs, metadata fields, vectors, timestamps).
7. **Upload in Batches**: Push documents in batches of ≤50 with exponential backoff on throttling. Use the `new.t3` API key pair to ensure correct index targeting.
8. **Audit Logging**: Emit `kpmsg` logs for each major step (CSV row processed, file fetched, upload success/failure) to aid traceability.

## 5. Detailed Batch Steps
1. **Graph Skeleton (LangGraph-style)**:
   - `START → readCsvNode → fetchFileNode → extractContentNode → chunkVectorizeNode → buildSearchDocsNode → uploadSearchDocsNode → END`.
   - Conditional branches handle missing files, extraction errors, or rows lacking required metadata.
2. **readCsvNode**
   - Accepts file type (`assets` vs `pages`).
   - Streams rows, emits structured payloads with normalized dates (ISO date-only strings) and tokenized tags/keywords.
3. **fetchFileNode**
   - Uses `linuxServerAccessService.copyFileFromLinuxServer` to download to a temp folder (clean up afterwards).
   - Records missing files and optionally writes them to a retry list.
4. **extractContentNode**
   - Applies mimetype-specific extraction: PDF/image/Office helpers from existing services; HTML parsing for pages (strip scripts, keep structured text, optionally store raw HTML separately).
5. **chunkVectorizeNode**
   - Reuses chunking heuristics (including Chinese character detection) and vectorization w/ retry.
   - Optionally enriches context via completions service if additional summaries are needed for search fields.
6. **buildSearchDocsNode**
   - Creates documents aligned with `infosource_assets.json` or `infosource_pages.json` schema, including metadata fields from the CSV plus enrichment (keywords array, categories array, status fields, normalized owners, etc.).
7. **uploadSearchDocsNode**
   - Batches documents and uses `SearchClient.uploadDocuments()` with new `searchEndpoint.new.t3` and `aiupload.new.t3` keys.
   - Logs success/failure via `kpmsg`.

## 6. Error Handling & Observability
- Wrap each major step in try/catch; use `kpmsg` structured logs for success/error events.
- Maintain retry files for rows that fail extraction or upload, with a follow-up pass.
- Track counters (rows processed, files missing, uploads succeeded/failed) for final summary output.

## 7. Validation Checklist
- [ ] Confirm env vars set for Linux + AI Search targets.
- [ ] Dry-run CSV parsing (no uploads) to validate field mappings.
- [ ] Validate at least one asset + page end-to-end, ensuring vectors appear in the correct indexes.
- [ ] Ensure batch cleans up temporary local copies.
- [ ] Produce summary report (JSON/CSV) for auditing.

## 8. Next Actions After Approval
1. Scaffold the batch script (likely under `app/services/batch/infosourceBatchService.js`).
2. Implement nodes/functions per plan, reusing shared utilities where possible.
3. Add npm script (e.g., `npm run batch:infosource`) to invoke the process with required env vars.
4. Add `infoSearchBatch` npm script (patterned after `load-kpmc-users`) that chains the environment bootstrap (e.g., `env17.bat`) before running the batch entrypoint.
5. Document runbook and troubleshooting steps in AGENTS.md or a new operations doc.

## 9. Execution Command
- Add to `package.json` scripts: `"infoSearchBatch": "env17.bat && node app/services/batch/infoSearchBatchService.js"` (adjust path once the batch entrypoint exists).
- Mirrors `load-kpmc-users` by depending on the caller to run `env17.bat` first; using it inline guarantees the environment variables are hydrated before Node launches.
- Run with `npm run infoSearchBatch` during ops or CI; include notes in the runbook to capture required env vars and expected runtime.

## 10. Agent Skills RAG Experience (Parallel Track)
With the Linux batch currently processing, we can advance the Agent Skills experience so the UI/RAG tier is ready once the indexes are populated.

### 10.1 Objectives
- Deliver a retrieval flow that grounds “Approach/Impress/Follow-up/Finetune” guidance in the newly built indexes (or interim mock data) and enforces the markdown + citation contract from `instructions.txt` and `PROMP_TEMPLATE.md`.
- Provide consistent footnote references (e.g., `[1]`) that open a citation modal including Source (title + hyperlink), Region, Document Owner, and Last Updated/Reviewed.
- Ensure UX elements such as Insight Rail and Deal Canvas can display these skills once RAG answers are available.

### 10.2 Data Inputs & Mapping
- **Primary corpora**: `infosource_assets` and `infosource_pages` indexes (new.t3) once batch is done; until then, use the CSV rows or a seeded mock collection to validate the flow.
- **Instruction overlays**: `instructions.txt` “Latest Instructions” block + `infoSourceData/PROMP_TEMPLATE.md` define the skills taxonomy and tone. Store these prompts under `prompts/agentSkillsPrompt.ts` (new) for reuse.
- Map retrieved snippets into the four skill buckets. Each chunk should preserve `region`, `documentOwner`, and `lastUpdated` so that the UI can satisfy the citation policy.

### 10.3 Retrieval & Orchestration Plan
1. **Query builder**: Accept seller intent (e.g., “KP differentiators for manufacturing CFO in GA”) and expand into skill-specific sub-queries using `nexusos/completionsClient` (structured output with bucket field).
2. **Search execution**: Invoke a thin wrapper over `SearchClient` that can target assets vs pages indexes, filter by region/market when provided, and request captions/highlights.
3. **Post-processing**: Normalize results into `{ skillBucket, summary, quote, citation }` objects. Deduplicate by `documentId` and trim to top 3 per bucket.
4. **Fallback path**: If live search fails (e.g., batch still running), load cached exemplars from `/infoSourceData/agentSkillMocks.json` (to create) so UI development continues.

### 10.4 Response Formatting Contract
- Core answers rendered in markdown with inline footnote numbers `[1]`, `[2]`, etc.
- Maintain a citation registry per response; clicking a footnote triggers a modal fed by `{ sourceTitle, url, region, owner, lastUpdated }`.
- When information is missing, output “Information not available in the current plan documents.” per `PROMP_TEMPLATE.md` guidance.
- Align tone (consultative, ROI-focused) and role-based variants (Seller vs Marketer) using the template’s branching logic.

### 10.5 UX Integration Tasks
1. **Agent Skills Panel**: Add a new component adjacent to `InsightRail` that renders the four skill groups with their citations and CTA buttons.
2. **Footnote Modal**: Extend a shared `CitationDrawer` component (new) so Insight Rail, Deal Canvas, and Agent Skills reuse the same presentation + metadata fields.
3. **Polling vs streaming**: Refactor the InfoSource smart note experience to use the Geisinger-style polling hooks, ensuring Agent Skills responses arrive via the same background job queue referenced in `entryWindowService.js`.

### 10.6 Implementation Checklist
- [x] Scaffold `app/services/agentSkillsService.js` with query expansion + search wrappers.
- [x] Define `AgentSkillBuckets` enum and shared types for citations + responses (`app/types/agentSkills.js`).
- [x] Seed mock data for local dev while batch completes.
- [x] Wire API route (`app/api/{team}/{assistant}/smartNote/{id}/agent-skills/route.js`) that orchestrates the flow and polling-safe statuses.
- [x] Update front-end components (InfoSourceExperience + new AgentSkillsPanel) to display role output, footnotes, and copy actions.
- [x] Add utility tests/smoke validation path for status normalization and timeout helpers.

## 11. Memory Layer (SmartNote-Scoped)

### 11.1 Purpose
- Capture durable, user-approved memory across interactions for the same SmartNote.
- Persist high-value facts/preferences/constraints/actions while avoiding freeform transcript bloat.
- Keep memory auditable, editable, and deletable via explicit API routes.

### 11.2 Memory Schema (`MemoryItem`)
- `id`: UUID
- `type`: `MemoryItem`
- `parentId`: SmartNote ID
- `nuid`: owner user id
- `scope`: `interaction | smartnote | user | team`
- `memoryType`: `fact | preference | constraint | action`
- `key`: short normalized key
- `value`: memory content
- `source`: `manual | extraction | system`
- `sourceInteractionId`: optional chat interaction id
- `confidence`: 0..1
- `sensitivity`: `low | medium | high`
- `pinned`: boolean
- `expiresAt`: nullable Date
- `metadata`: object (extensible)

### 11.3 API Endpoints
- `GET /api/[teamName]/[assistantName]/smartNote/[smartNoteId]/memory`
   - Query: `scope`, `memoryType`, `includeExpired`
   - Returns memory list sorted by pinned/recent
- `POST /api/[teamName]/[assistantName]/smartNote/[smartNoteId]/memory`
   - Creates a memory item
- `GET /api/[teamName]/[assistantName]/smartNote/[smartNoteId]/memory/[memoryId]`
   - Fetches single memory item
- `PUT /api/[teamName]/[assistantName]/smartNote/[smartNoteId]/memory/[memoryId]`
   - Updates item fields (including pin/expiry/confidence)
- `DELETE /api/[teamName]/[assistantName]/smartNote/[smartNoteId]/memory/[memoryId]`
   - Deletes item
- `POST /api/[teamName]/[assistantName]/smartNote/[smartNoteId]/memory/extract`
   - Derives candidates from prompt/response
   - Supports dry-run (`persist=false`) or persistence (`persist=true`)

### 11.4 Extraction Behavior (MVP)
- Keyword-pattern extraction for constraints, preferences, follow-up actions, and must-have facts.
- Candidate dedupe by type+content signature.
- Conservative defaults:
   - `scope=smartnote`
   - `confidence≈0.72`
   - `pinned=false`

### 11.5 Next Enhancements
- Add review UI (“What I remember”) with approve/reject queue for extracted candidates.
- Add memory injection step into Agent Skills retrieval/generation pipeline.
- Add TTL and retention policies by sensitivity, plus optional team-shared memory mode.

## 12. Current Status Snapshot (2026-03-08)

### 12.1 Completed Since Initial Plan
- Agent Skills API + UI are fully wired with background-job polling, status normalization, and timeout-safe responses.
- Live Azure AI Search retrieval is in place for `infosource_assets` + `infosource_pages` with semantic-first fallback and score filtering.
- Citation behavior is deterministic and deduplicated, with modal drill-in for source metadata.
- Role-shaped outputs (Seller/Marketer) are implemented, including markdown and copy actions.
- Memory MVP is implemented end-to-end (CRUD, extraction, approve/pin/delete via “What I Remember” panel).
- Agent Skills generation now supports per-run memory control (`useMemoryContext`) and displays run mode (`Memory: On/Off`).
- Copied exports now include run context headers: Role, Memory mode, and Generated timestamp.

### 12.2 Remaining Work (Prioritized)
1. Calibrate retrieval knobs against fresh batch-loaded index data (values now configurable; tuning pass pending with production-like corpus).
2. Add retention/TTL policy handling for memory items by sensitivity.
3. Decide whether to promote memory scope beyond SmartNote (`user`/`team`) with governance rules.

### 12.3 Latest Delta
- Added in-app memory verification flow on `app/test/agent-skills/page.js`:
   - Manual toggle plus one-click `Run Memory On` and `Run Memory Off` execution buttons.
   - Verification run history showing requested/resolved memory mode, normalized status, bucket preview, and role snippet.
   - Notes guiding side-by-side comparison with identical query inputs.
- Added retrieval tuning controls in `app/services/agentSkillsService.js`:
   - Configurable score threshold, top-K expansion, max documents, and minimum post-filter floor.
   - Tuned rescoring (market/region exact-match boosts + query-term overlap boost).
   - Backfill path when strict thresholding produces too few results.
   - Semantic mode control (`off | auto | always`) with per-request override support.

### 12.4 Calibration Workflow (Implemented)
- In-app calibration suite is now available on `app/test/agent-skills/page.js`.
- Default run matrix executes three retrieval profiles (`Balanced`, `Precision-Heavy`, `Recall-Heavy`) across multiple queries.
- Each run captures: normalized status, bucket coverage (0..4), average insight score, data source, total documents, and bucket preview.
- A recommendation banner computes best profile using weighted scoring:
   - 70% bucket coverage
   - 30% average insight score
- Calibration output supports side-by-side review before setting environment defaults for dev/uat.
