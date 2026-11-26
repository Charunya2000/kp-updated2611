# Comparison V2 Externalization Checklist

Companion to: `app/services/langgraphs/compliance/config/comparison-v2-config-manifest.md`

## Objective
Externalize all V2 comparison behavior controls from `complianceComparisonService2.js` to config files first, then to GeisingerConfig runtime documents, without changing current behavior by default.

## Success Criteria
- No functional regression in topic/comprehensive modes.
- Existing env overrides keep working.
- Defaults remain backward-compatible when no external config is present.
- Config can be changed without rebuild in Phase 2.

## Non-Goals (For This Plan)
- Rewriting comparison algorithm semantics.
- Migrating legacy `complianceComparisonService.js` behavior.
- UI redesign or progress UX changes.

## Precedence Contract
Use this precedence order for every config key:
1. GeisingerConfig runtime value (Phase 2)
2. Local file config value (Phase 1)
3. Env override (where intentionally supported)
4. Hard-coded safe default

Note:
- For keys already env-driven in production workflows, keep env as a supported override; do not remove unless explicitly approved.

## PR Plan

### PR1: Config Loader Foundation (No Behavior Change)
- Add `app/services/langgraphs/compliance/config/loadComparisonConfigV2.js`.
- Implement typed merge of config fragments:
- `comparison-mode-v2.json`
- `comparison-retrieval-v2.json`
- `comparison-ranking-v2.json`
- `comparison-alignment-v2.json`
- `comparison-completion-v2.json`
- `comparison-runtime-v2.json`
- Implement schema validation and coercion:
- Numeric bounds for thresholds (`0..1`) and token limits (`>0`).
- Required arrays (`searchFields`, `selectFields`, model list).
- Boolean normalization for feature flags.
- Add unit tests for loader merge behavior.
- Add unit tests for invalid file values and fallback behavior.

Acceptance checks:
- Loader returns a complete config object matching current defaults.
- Invalid file values do not crash runtime; they fall back safely.

### PR2: Wire V2 Service To Loader (No Semantic Change)
- Replace `HARD_CODED_COMPARISON_CONFIG` construction with loader output in `loadConfigNodeV2`.
- Preserve all current defaults exactly in config files.
- Keep all existing env overrides active and applied after file load.
- Add startup/config snapshot logging (non-sensitive) with kpmsg name like `comparisonV2ConfigResolved`.

Acceptance checks:
- Before/after run on same input yields equivalent counts and mode routing.
- No compile/lint errors.

### PR3: Externalize Prompt Surface
- Move inline prompt text to file-backed prompt config:
- Topic analysis system/user instructions.
- Comprehensive analysis system/user instructions.
- Adjudication system/user instructions.
- Optional fallback narrative templates.
- Add safe defaults in code if prompt files missing.

Acceptance checks:
- Prompts resolve from files when present.
- Missing prompt files do not break execution.

### PR4: Externalize Runtime Constants
- Move these to `comparison-runtime-v2.json` with defaults:
- `search.indexName`
- `data.collectionName`
- `heartbeat.intervalMs`
- `heartbeat.stages[]`
- `artifact.containerName`
- `artifact.pathPrefix`
- `artifact.filePattern`
- Keep sensitive values in env only; runtime file stores non-secret knobs.

Acceptance checks:
- Spreadsheet and progress behavior remain functional.
- Search and DB reads still target expected resources.

### PR5: GeisingerConfig Runtime Overlay (No-Build Updates)
- Add query/parse layer for comparison config docs (new collection name recommended: `Document Comparison V2 Config`).
- Resolve runtime config by precedence contract.
- Add in-memory cache with TTL (for example 60s) and cache-bypass flag for troubleshooting.
- Add failure-safe path: if DB config unavailable/invalid, continue with file/env/default chain.

Acceptance checks:
- Updating GeisingerConfig changes behavior without rebuild/redeploy.
- If DB unavailable, service still runs with file/env/defaults.

### PR6: Admin/Operational Guardrails
- Add validation endpoint or admin utility to preview effective config and source-by-key.
- Add audit-safe logs for config version/hash and source (db/file/env/default).
- Add runbook docs for rollback:
- Disable DB overlay.
- Revert to file/env.
- Revert env thresholds.

Acceptance checks:
- Operators can identify active values and sources quickly.
- Rollback path is documented and tested.

## Key Schema Proposal

### comparison-mode-v2.json
- `comprehensiveKeywords: string[]`

### comparison-retrieval-v2.json
- `searchFields: string[]`
- `selectFields: string[]`
- `topicMode.keywordTop: number`
- `topicMode.semanticTop: number`
- `topicMode.maxVariants: number`
- `topicMode.maxCandidatesAfterMerge: number`
- `topicMode.evidencePerDocument: number`
- `comprehensiveMode.maxSectionsPerDocument: number`
- `comprehensiveMode.chunkFetchTop: number`
- `comprehensiveMode.minTitleLength: number`
- `comprehensiveMode.minContentLength: number`

### comparison-ranking-v2.json
- `scoreWeight: number`
- `exactSectionBoost: number`
- `titleTermBoost: number`
- `contentTermBoost: number`
- `exactPromptBoost: number`
- `variantBoost.exact: number`
- `variantBoost.normalized: number`
- `variantBoost.sectionOnly: number`
- `variantBoost.quotedClause: number`

### comparison-alignment-v2.json
- `similarityThreshold: number`
- `autoMatchThreshold: number`
- `llmAdjudicationThreshold: number`
- `secondaryMatchThreshold: number`
- `maxTargetCandidatesPerSource: number`
- `fallbackSearch.enabled: boolean`
- `fallbackSearch.onlyWhenNoPrimaryCandidate: boolean`
- `fallbackSearch.maxVariants: number`
- `fallbackSearch.keywordTop: number`
- `fallbackSearch.semanticTop: number`
- `fallbackSearch.maxCandidatesAfterMerge: number`
- `fallbackSearch.maxTargetCandidatesPerSource: number`
- `fallbackSearch.autoMatchThreshold: number`
- `fallbackSearch.llmAdjudicationThreshold: number`
- `fallbackSearch.maxSourceOnlyTopicsToProbe: number`

### comparison-completion-v2.json
- `preferredModels: string[]`
- `temperature: number`
- `maxTokens: number`
- `maxShortTokens: number`

### comparison-runtime-v2.json
- `search.indexName: string`
- `data.collectionName: string`
- `embedding.model: string`
- `embedding.deployment: string`
- `embedding.apiVersion: string`
- `heartbeat.intervalMs: number`
- `heartbeat.stages: string[]`
- `artifact.containerName: string`
- `artifact.pathPrefix: string`
- `artifact.filePattern: string`
- `display.topicEvidenceLimit: number`
- `display.analysisPreviewLimit: number`

## Test Plan (Per PR)
- Snapshot tests for resolved config object.
- Regression run with fixed documents and prompt:
- Compare counts (`matching`, `sourceOnly`, `targetOnly`, `primary`, `secondary`, `fallbackRecovered`).
- Compare validation flags (`sourceBalanced`, `targetBalanced`).
- Compare runtime duration budget.
- Negative tests:
- Missing config files.
- Malformed numeric values.
- Out-of-range thresholds.
- Missing GeisingerConfig docs.

## Rollout Strategy
- Stage 1: Merge PR1-PR2 behind default-off flag for loader use.
- Stage 2: Enable loader in dev; compare output parity over multiple runs.
- Stage 3: Merge PR3-PR4 and validate output quality unchanged.
- Stage 4: Introduce PR5 overlay in dev only, then uat.
- Stage 5: Promote to prod with canary and rapid rollback switch.

## Risk Register
- Risk: config drift between files and DB docs.
- Mitigation: config hash logging and source-by-key diagnostics.
- Risk: malformed config causes runtime failures.
- Mitigation: strict validation and fallback chain.
- Risk: unexpected quality shift after threshold edits.
- Mitigation: guarded rollout with baseline comparison job.
- Risk: operator confusion on active config source.
- Mitigation: effective config endpoint/report.

## Open Decisions Before Implementation
- Whether env overrides remain highest priority for specific keys.
- Whether prompt text externalization is included in first coding pass.
- Cache TTL and refresh semantics for GeisingerConfig overlay.
- Whether to externalize artifact naming/container now or later.
