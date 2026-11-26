# Legacy Service3 Config Reference (Prepare, Converse, Compare)

This document catalogs configurable properties that affect the legacy `service3` compliance path:
- Preparation
- Conversation
- Comparison (`topic` and `comprehensive`)

It is focused on runtime behavior in:
- `app/services/langgraphs/compliance/docConversationService3.js`
- `app/services/langgraphs/compliance/complianceConversationService2.js`
- `app/services/langgraphs/compliance/complianceComparisonService2.js`

## Scope And Precedence

For loader-based configs, precedence is:
1. GeisingerConfig overlay docs
2. File config in `app/services/langgraphs/compliance/config/*.json|*.md`
3. Hard-coded defaults in loader
4. Env overrides (only where explicitly wired)

Engine-routing selection (legacy vs first-principles) is resolved separately by:
- `app/services/langgraphs/compliance/helpers/loadFirstPrinciplesRuntimeConfigV1.js`
- `app/services/langgraphs/compliance/helpers/runtimeEngineRouting.js`
- `app/services/langgraphs/compliance/helpers/prepEngineRouting.js`

## Admin-Editable Data Sources

1. `Document Conversation` collection (general runtime routing doc)
- Query shape (runtime router + admin page):
  - `type: GeisingerConfig`
  - `collectionName: Document Conversation`
  - `purpose: GeneralConfig`
  - `title: Document Conversation Config For Conversation Prepare`

2. `Document Preparation Config` and `Geisinger Preparation` collections
- Used by `loadPreparationConfigV1`.
- Fragment docs selected by title/purpose aliases:
  - `preparation-runtime-v1`
  - `preparation-ui-v1`

3. `Document Conversation` collection (conversation v2 overlays)
- Used by `complianceConversationService2` + `loadConversationConfigV2`.
- Fragment docs selected by title/purpose aliases:
  - retrieval, ranking, runtime, answer, format

4. `Document Comparison V2 Config` (and fallback `Document Comparison`)
- Used by `complianceComparisonService2` + `loadComparisonConfigV2`.
- Fragment docs selected by title/purpose aliases:
  - mode, retrieval, ranking, alignment, completion, runtime

## Engine Routing Controls (Keep Legacy Service3 Active)

These are not scoring/retrieval knobs. They choose which engine runs.

| Property | Type / Allowed | Default | Used By | Notes |
|---|---|---|---|---|
| `prepEngine` | string: `legacy` \| `first-principles` | `legacy` | preparation routing | Set to `legacy` for service3 prep.
| `conversationEngine` | string: `service3` \| `first-principles` | `service3` | conversation routing | Set to `service3` for legacy conversation.
| `comparisonEngine` | string: `service3` \| `first-principles` | `service3` | comparison routing | Set to `service3` for legacy topic/comprehensive compare.
| `rolloutScope.teamAllowlist[]` | string[] | `[]` | routing fallback rules | Limits first-principles by team.
| `rolloutScope.lobAllowlist[]` | string[] | `[]` | routing fallback rules | Limits first-principles by LOB.

Env overrides for routing:
- `COMPLIANCE_FORCE_CONVERSATION_ENGINE`
- `COMPLIANCE_FORCE_COMPARISON_ENGINE`

## Preparation Config (Legacy Service3)

### A) Preparation V1 Runtime/UI (`loadPreparationConfigV1`)

Source collections: `Document Preparation Config`, `Geisinger Preparation`.

| Property | Type | Default | Legacy Effect |
|---|---|---|---|
| `runtime.job.jobType` | string | `GeisingerDocumentPreparation` | Background job type used by prep service.
| `runtime.job.maxConcurrency` | int >= 1 | `10` | Caps server-side worker concurrency.
| `runtime.job.defaultConcurrency` | int >= 1 | `1` | Default concurrency when request omits value.
| `runtime.discovery.defaultRootFolder` | string | `Shared Documents/Regulatory and Contractual Documents` | Default folder for discovery.
| `runtime.discovery.preparableExtensions[]` | string[] | `['pdf','docx']` | File types accepted by discovery.
| `runtime.discovery.requireSingleLobWhenFileNameFilterPresent` | boolean | `true` | Validation rule in discovery/start flow.
| `runtime.collections.conversationCollectionName` | string | `user_collection` | Mongo collection used for conversation lookups.
| `runtime.preparationVersion.envVar` | string | `GEISINGER_PREPARATION_VERSION` | Which env var controls active preparation version.
| `runtime.preparationVersion.defaultValue` | string | `1` | Fallback prep version when env var missing.
| `runtime.sharePoint.domainToggleEnvVar` | string | `USE_VAULT` | Used by prep discovery service to pick Graph vs REST fetch.
| `runtime.sharePoint.vaultDomain` | string | `geisinger.sharepoint.com` | Present in runtime snapshot; not consumed by acquisition code path.
| `runtime.sharePoint.legacyDomain` | string | `sp-cloud.kp.org` | Present in runtime snapshot; not consumed by acquisition code path.
| `ui.defaults.concurrency` | int >= 1 | `1` | Admin page initial concurrency value.
| `ui.defaults.discoveryRootFolder` | string | `Shared Documents/Regulatory and Contractual Documents` | Admin page initial discovery root.
| `ui.defaults.pollingIntervalMs` | int >= 250 | `3000` | Admin prep page polling interval base value.
| `ui.limits.concurrencyInputMin` | int >= 1 | `1` | Admin page min bound.
| `ui.limits.concurrencyInputMax` | int >= min | `10` | Admin page max bound.

### B) Legacy Preparation GeneralConfig (`docConversationService3`)

Source doc query:
- `Document Conversation` / `GeneralConfig` / `Document Conversation Config For Conversation Prepare`
- Parsed from fenced ```json``` in `documentText`.

| Property | Type | Default | Legacy Effect |
|---|---|---|---|
| `embedding.throttleMs` | number | `250` | Delay between embedding batches in prep indexing.
| `azure.searchIndex` | string | `geisinger-002` | Azure Search index name for prep chunk upload.

### C) Preparation Env Flags

| Env Var | Default | Effect |
|---|---|---|
| `GEISINGER_PREPARATION_CONFIG_ENABLED` | `true` | Enables Geisinger overlay docs for preparation v1 loader.
| `GEISINGER_PREPARATION_VERSION` | `1` | Active prep version fallback if configured envVar missing.
| `USE_VAULT` | (unset/false) | In prep acquisition path, `true` uses Graph + fileId; otherwise SharePoint REST path.
| `GEISINGER_PREP_FIRST_PRINCIPLES_ALLOW_LEGACY_FALLBACK` | `true` | If first-principles prep fails, fallback to legacy prep.

## Conversation Config (Legacy Service3)

Source collection: `Document Conversation` (all docs with non-empty `documentText` are loaded and then fragment-mapped).

### Retrieval

| Property | Type | Default | Effect |
|---|---|---|---|
| `retrieval.searchFields[]` | string[] | `['content','title','smart_file_name']` | Azure Search fields queried.
| `retrieval.selectFields[]` | string[] | `['id','smartnote_id','smart_file_name','smart_file_type','title','content','page','createdAt']` | Returned fields from search.
| `retrieval.strategy.keywordTop` | int >= 1 | `60` | Keyword pass top N.
| `retrieval.strategy.semanticTop` | int >= 1 | `60` | Semantic/vector pass top N.
| `retrieval.strategy.maxVariants` | int >= 1 | `4` | Query variants generated.
| `retrieval.strategy.maxLobBatches` | int >= 1 | `8` | Max LOB filter batches.
| `retrieval.strategy.maxConversationIdsPerBatch` | int >= 1 | `120` | IDs per search batch.
| `retrieval.strategy.maxCandidatesAfterMerge` | int >= 1 | `220` | Candidate cap after rank merge.
| `retrieval.strategy.selectedDocEvidenceCount` | int >= 1 | `16` | Evidence cap for selected-document mode.
| `retrieval.strategy.allLobEvidenceCount` | int >= 1 | `28` | Evidence cap for all-docs-in-lob mode.
| `retrieval.strategy.perDocumentCapAllLob` | int >= 1 | `4` | Per-document cap in all-docs mode.

### Ranking

| Property | Type | Default | Effect |
|---|---|---|---|
| `ranking.scoreWeight` | number | `1` | Multiplies base search score.
| `ranking.exactSectionBoost` | number | `3.5` | Boost for exact section number hits.
| `ranking.titleTermBoost` | number | `1.2` | Per-title-term boost.
| `ranking.contentTermBoost` | number | `0.4` | Per-content-term boost.
| `ranking.exactPromptBoost` | number | `2` | Boost for exact prompt text match.
| `ranking.queryVariantBoost.exact` | number | `0.8` | Variant boost.
| `ranking.queryVariantBoost.normalized` | number | `0.5` | Variant boost.
| `ranking.queryVariantBoost.sectionOnly` | number | `0.7` | Variant boost.
| `ranking.queryVariantBoost.quotedClause` | number | `0.3` | Variant boost.

### Answer

| Property | Type | Default | Effect |
|---|---|---|---|
| `answer.model` | string | `gpt-4o` | Chat completion model.
| `answer.temperature` | number | `0.2` | Completion temperature.
| `answer.maxTokens` | int >= 1 | `1200` | Completion token cap.
| `answer.systemPrompt` | string | healthcare analyst prompt | System role content.

### Format

| Property | Type | Default | Effect |
|---|---|---|---|
| `format.responseTemplate` | string | default markdown template | Final response template.
| `format.includeEvidenceSection` | boolean | `false` | Include evidence list section.
| `format.evidenceSectionTitle` | string | `### Evidence Used` | Evidence section heading.
| `format.maxUsedDocumentsInResponse` | int >= 1 | `12` | Limit used document list in response.

### Runtime

| Property | Type | Default | Effect |
|---|---|---|---|
| `runtime.search.indexName` | string | `geisinger-002` | Azure Search index for retrieval.
| `runtime.data.collectionName` | string | `user_collection` | Mongo collection for conversation scope lookups.
| `runtime.embedding.model` | string | `text-embedding-ada-002` | Embedding model for prompt vectors.
| `runtime.embedding.deployment` | string | `gpt-4o-aisvc` | Embedding client deployment.
| `runtime.embedding.apiVersion` | string | `2023-05-15` | Embedding API version.
| `runtime.preparationVersion.envVar` | string | `GEISINGER_PREPARATION_VERSION` | Active prep version env var name.
| `runtime.preparationVersion.defaultValue` | string | `1` | Active prep version default.
| `runtime.progress.initialMessage` | string | `Running conversation retrieval and analysis...` | Declared config, but current startup path uses hard-coded default object.
| `runtime.debug.searchLogging.enabled` | boolean | `false` | Declared config, but diagnostics currently forced on in code.
| `runtime.debug.searchLogging.maxResults` | int 1..50 | `8` | Limits debug top-hit payload size.

### Conversation Env Flags

| Env Var | Default | Effect |
|---|---|---|
| `COMPLIANCE_CONVERSATION_GEISINGER_CONFIG_ENABLED` | `true` | Enables/disables Geisinger overlay docs for conversation v2 loader.
| `USE_VAULT` | (unset/false) | SharePoint link domain in conversation citations.

## Comparison Config (Legacy Service3)

Source collections: `Document Comparison V2 Config` then `Document Comparison` fallback.

### Mode Detection

| Property | Type | Default | Topic/Comprehensive Effect |
|---|---|---|---|
| `mode.comprehensiveKeywords[]` | string[] | preset phrase list | If prompt contains keyword, route to comprehensive mode (unless explicit mode supplied).

### Retrieval

| Property | Type | Default | Effect |
|---|---|---|---|
| `retrieval.searchFields[]` | string[] | `['content','title','smart_file_name']` | Search fields for topic and fallback retrieval.
| `retrieval.selectFields[]` | string[] | `['id','smartnote_id','smart_file_name','title','content','page','createdAt']` | Selected fields from search.
| `retrieval.topicMode.keywordTop` | int >= 1 | `70` | Topic mode keyword top N.
| `retrieval.topicMode.semanticTop` | int >= 1 | `70` | Topic mode semantic top N.
| `retrieval.topicMode.maxVariants` | int >= 1 | `4` | Topic query variants.
| `retrieval.topicMode.maxCandidatesAfterMerge` | int >= 1 | `220` | Topic candidate merge cap.
| `retrieval.topicMode.evidencePerDocument` | int >= 1 | `16` | Topic evidence cap per side.
| `retrieval.comprehensiveMode.maxSectionsPerDocument` | int >= 1 | `220` | Max sections kept per document in comprehensive mode.
| `retrieval.comprehensiveMode.chunkFetchTop` | int >= 1 | `1200` | Search fetch top N before filtering.
| `retrieval.comprehensiveMode.minTitleLength` | int >= 0 | `2` | Section filtering threshold.
| `retrieval.comprehensiveMode.minContentLength` | int >= 0 | `20` | Section filtering threshold.

### Ranking (candidate scoring)

| Property | Type | Default | Effect |
|---|---|---|---|
| `ranking.scoreWeight` | number | `1` | Base score multiplier.
| `ranking.exactSectionBoost` | number | `3.5` | Section number exact-match boost.
| `ranking.titleTermBoost` | number | `1.2` | Title term hit boost.
| `ranking.contentTermBoost` | number | `0.4` | Content term hit boost.
| `ranking.exactPromptBoost` | number | `2` | Exact prompt text boost.
| `ranking.variantBoost.exact` | number | `0.8` | Variant boost.
| `ranking.variantBoost.normalized` | number | `0.5` | Variant boost.
| `ranking.variantBoost.sectionOnly` | number | `0.7` | Variant boost.
| `ranking.variantBoost.quotedClause` | number | `0.3` | Variant boost.

### Alignment (primary match behavior, comprehensive mode)

| Property | Type | Default | Effect |
|---|---|---|---|
| `alignment.similarityThreshold` | number 0..1 | `0.55` | Candidate inclusion threshold.
| `alignment.autoMatchThreshold` | number 0..1 | `0.86` | Automatic match threshold.
| `alignment.llmAdjudicationThreshold` | number 0..1 | `0.72` | LLM adjudication candidate threshold.
| `alignment.secondaryMatchThreshold` | number 0..1 | `0.88` | Secondary related match threshold.
| `alignment.maxTargetCandidatesPerSource` | int >= 1 | `4` | Candidate cap per source topic.

### Fallback Search (source-only rescue, comprehensive mode)

| Property | Type | Default | Effect |
|---|---|---|---|
| `alignment.fallbackSearch.enabled` | boolean | `true` | Enable fallback search pass.
| `alignment.fallbackSearch.onlyWhenNoPrimaryCandidate` | boolean | `true` | Restrict fallback to no-primary cases.
| `alignment.fallbackSearch.maxVariants` | int >= 1 | `2` | Fallback query variants.
| `alignment.fallbackSearch.keywordTop` | int >= 1 | `18` | Fallback keyword top N.
| `alignment.fallbackSearch.semanticTop` | int >= 1 | `18` | Fallback semantic top N.
| `alignment.fallbackSearch.maxCandidatesAfterMerge` | int >= 1 | `32` | Fallback candidate cap.
| `alignment.fallbackSearch.maxTargetCandidatesPerSource` | int >= 1 | `3` | Fallback candidate cap per source.
| `alignment.fallbackSearch.autoMatchThreshold` | number 0..1 | `0.9` | Fallback auto-match threshold.
| `alignment.fallbackSearch.llmAdjudicationThreshold` | number 0..1 | `0.6` | Fallback LLM-adjudication threshold.
| `alignment.fallbackSearch.maxSourceOnlyTopicsToProbe` | int >= 1 | `20` | Max source-only topics probed in fallback pass.

### Completion

| Property | Type | Default | Effect |
|---|---|---|---|
| `completion.preferredModels[]` | string[] | `['openai-5.1','gpt-4o']` | Fallback model order for completions.
| `completion.temperature` | number | `0.2` | Completion temperature.
| `completion.maxTokens` | int >= 1 | `1400` | Long completion cap.
| `completion.maxShortTokens` | int >= 1 | `800` | Short completion cap.

### Runtime

| Property | Type | Default | Effect |
|---|---|---|---|
| `runtime.search.indexName` | string | `geisinger-002` | Declared config; clients are currently initialized with default index path.
| `runtime.data.collectionName` | string | `user_collection` | Declared config; conversation fetch helpers rely on service constants in current flow.
| `runtime.embedding.model` | string | `text-embedding-ada-002` | Declared config; embedding call paths use fixed model/deployment defaults.
| `runtime.embedding.deployment` | string | `gpt-4o-aisvc` | Declared config, not actively switched at client init.
| `runtime.embedding.apiVersion` | string | `2023-05-15` | Declared config, not actively switched at client init.
| `runtime.heartbeat.intervalMs` | int >= 1000 | `8000` | Declared config; heartbeat currently uses hard-coded 8000 ms default.
| `runtime.heartbeat.stages[]` | string[] | built-in stage list | Declared config; heartbeat currently uses hard-coded stage list.
| `runtime.artifact.containerName` | string | `compliance-ai` | Declared config; spreadsheet upload currently uses hard-coded container.
| `runtime.artifact.pathPrefix` | string | `document-comparisons` | Declared config; path currently built with hard-coded prefix.
| `runtime.artifact.filePattern` | string | `comparison-v2-{timestamp}.xlsx` | Declared config; file naming currently hard-coded.
| `runtime.display.topicEvidenceLimit` | int >= 1 | `10` | Declared config; not currently applied in formatter logic.
| `runtime.display.analysisPreviewLimit` | int >= 1 | `20` | Declared config; not currently applied in formatter logic.
| `runtime.display.markdownListLimit` | int >= 1 | `30` | Actively used to cap list lengths in markdown output.

### Comparison Env Flags

| Env Var | Default | Effect |
|---|---|---|
| `COMPLIANCE_COMPARISON_GEISINGER_CONFIG_ENABLED` | `true` | Enables/disables Geisinger overlay docs for comparison v2 loader.
| `COMPLIANCE_COMPARISON_ENABLE_LEGACY_ENV_OVERRIDES` | `false` | Enables env-based threshold/list-limit overrides.
| `COMPLIANCE_COMPARISON_MAX_SECTIONS_PER_DOCUMENT` | n/a | Overrides `retrieval.comprehensiveMode.maxSectionsPerDocument` (when legacy env overrides enabled).
| `COMPLIANCE_COMPARISON_SIMILARITY_THRESHOLD` | n/a | Overrides `alignment.similarityThreshold`.
| `COMPLIANCE_COMPARISON_AUTO_MATCH_THRESHOLD` | n/a | Overrides `alignment.autoMatchThreshold`.
| `COMPLIANCE_COMPARISON_LLM_ADJUDICATION_THRESHOLD` | n/a | Overrides `alignment.llmAdjudicationThreshold`.
| `COMPLIANCE_COMPARISON_SECONDARY_MATCH_THRESHOLD` | n/a | Overrides `alignment.secondaryMatchThreshold`.
| `COMPLIANCE_COMPARISON_MARKDOWN_LIST_LIMIT` | n/a | Overrides `runtime.display.markdownListLimit`.
| `COMPLIANCE_COMPARISON_EMBED_RETRY_ATTEMPTS` | `4` | Embedding retry attempts.
| `COMPLIANCE_COMPARISON_EMBED_RETRY_BASE_MS` | `1000` | Retry backoff base ms.
| `COMPLIANCE_COMPARISON_EMBED_RETRY_MAX_MS` | `65000` | Retry backoff cap.
| `COMPLIANCE_COMPARISON_EMBED_BATCH_SIZE` | `12` | Embedding request batch size.
| `COMPLIANCE_COMPARISON_EMBED_BATCH_DELAY_MS` | `250` | Delay between embedding batches.
| `COMPLIANCE_COMPARISON_DEBUG` | `false` | Enables JSONL debug artifact writing.
| `COMPLIANCE_COMPARISON_DEBUG_PATH` | `comparison-debug.jsonl` | Debug artifact output path.
| `COMPLIANCE_COMPARISON_DEBUG_INCLUDE_FULL_CONTENT` | `false` | Includes full content in debug payloads.
| `USE_VAULT` | (unset/false) | SharePoint link domain in comparison citations.

## What To Tune First For Overmatching (Legacy Comprehensive)

If your issue is false-positive matches in comprehensive mode, tune in this order:
1. `alignment.autoMatchThreshold` (increase)
2. `alignment.llmAdjudicationThreshold` (increase)
3. `alignment.similarityThreshold` (increase slightly)
4. `alignment.secondaryMatchThreshold` (increase)
5. Fallback rescue strictness:
   - `alignment.fallbackSearch.autoMatchThreshold` (increase)
   - `alignment.fallbackSearch.llmAdjudicationThreshold` (increase)
   - `alignment.fallbackSearch.maxSourceOnlyTopicsToProbe` (decrease)

`ranking.*` affects candidate ordering, but alignment thresholds are the primary match/no-match gate in legacy comprehensive compare.
