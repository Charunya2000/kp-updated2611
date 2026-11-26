# Comparison V2 Config Manifest

Source of truth reviewed: `app/services/langgraphs/compliance/complianceComparisonService2.js`

## Scope
- This manifest inventories runtime knobs used by `complianceComparisonGraphV2`.
- Goal: identify all configuration points before externalizing to files and then GeisingerConfig.
- Status labels: `env-configurable`, `hard-coded`, `partially-configurable`.

## Already Env-Configurable
- `GEISINGER_PREPARATION_VERSION` | Used for prep-version guardrail. | Status: `env-configurable`
- `COMPLIANCE_COMPARISON_MAX_SECTIONS_PER_DOCUMENT` | Caps comprehensive extracted sections per doc. | Status: `env-configurable`
- `COMPLIANCE_COMPARISON_SIMILARITY_THRESHOLD` | Candidate edge threshold. | Status: `env-configurable`
- `COMPLIANCE_COMPARISON_AUTO_MATCH_THRESHOLD` | Global one-to-one auto match threshold. | Status: `env-configurable`
- `COMPLIANCE_COMPARISON_LLM_ADJUDICATION_THRESHOLD` | LLM adjudication threshold for primary pass. | Status: `env-configurable`
- `COMPLIANCE_COMPARISON_SECONDARY_MATCH_THRESHOLD` | Secondary many-to-one threshold. | Status: `env-configurable`
- `COMPLIANCE_COMPARISON_DEBUG` | Debug JSONL on/off. | Status: `env-configurable`
- `COMPLIANCE_COMPARISON_DEBUG_PATH` | Debug JSONL path. | Status: `env-configurable`
- `COMPLIANCE_COMPARISON_DEBUG_INCLUDE_FULL_CONTENT` | Include full section content in debug payload. | Status: `env-configurable`
- `COMPLIANCE_COMPARISON_MARKDOWN_LIST_LIMIT` | Render cap for markdown lists. | Status: `env-configurable`

## Core Config Object: Mode
- `mode.comprehensiveKeywords` default list (`whole document`, `full comparison`, etc.) | Source: hard-coded object. | Status: `hard-coded`

## Core Config Object: Retrieval
- `retrieval.searchFields` default `['content', 'title', 'smart_file_name']` | Status: `hard-coded`
- `retrieval.selectFields` default `['id','smartnote_id','smart_file_name','title','content','page','createdAt']` | Status: `hard-coded`
- `retrieval.topicMode.keywordTop` default `70` | Status: `hard-coded`
- `retrieval.topicMode.semanticTop` default `70` | Status: `hard-coded`
- `retrieval.topicMode.maxVariants` default `4` | Status: `hard-coded`
- `retrieval.topicMode.maxCandidatesAfterMerge` default `220` | Status: `hard-coded`
- `retrieval.topicMode.evidencePerDocument` default `16` | Status: `hard-coded`
- `retrieval.topicMode.evidenceSnippetMaxLength` default `1600` | Status: `hard-coded`
- `retrieval.comprehensiveMode.maxSectionsPerDocument` default dynamic from env helper, fallback `220` | Status: `partially-configurable`
- `retrieval.comprehensiveMode.chunkFetchTop` default `1200` | Status: `hard-coded`
- `retrieval.comprehensiveMode.minTitleLength` default `2` | Status: `hard-coded`
- `retrieval.comprehensiveMode.minContentLength` default `20` | Status: `hard-coded`

## Core Config Object: Ranking
- `ranking.scoreWeight` default `1` | Status: `hard-coded`
- `ranking.exactSectionBoost` default `3.5` | Status: `hard-coded`
- `ranking.titleTermBoost` default `1.2` | Status: `hard-coded`
- `ranking.contentTermBoost` default `0.4` | Status: `hard-coded`
- `ranking.exactPromptBoost` default `2` | Status: `hard-coded`
- `ranking.variantBoost.exact` default `0.8` | Status: `hard-coded`
- `ranking.variantBoost.normalized` default `0.5` | Status: `hard-coded`
- `ranking.variantBoost.sectionOnly` default `0.7` | Status: `hard-coded`
- `ranking.variantBoost.quotedClause` default `0.3` | Status: `hard-coded`

## Core Config Object: Alignment
- `alignment.similarityThreshold` default `0.55` with env override | Status: `partially-configurable`
- `alignment.autoMatchThreshold` default `0.86` with env override | Status: `partially-configurable`
- `alignment.llmAdjudicationThreshold` default `0.72` with env override | Status: `partially-configurable`
- `alignment.secondaryMatchThreshold` default `0.88` with env override | Status: `partially-configurable`
- `alignment.maxTargetCandidatesPerSource` default `4` | Status: `hard-coded`
- `alignment.fallbackSearch.enabled` default `true` | Status: `hard-coded`
- `alignment.fallbackSearch.onlyWhenNoPrimaryCandidate` default `true` | Status: `hard-coded`
- `alignment.fallbackSearch.maxVariants` default `2` | Status: `hard-coded`
- `alignment.fallbackSearch.keywordTop` default `18` | Status: `hard-coded`
- `alignment.fallbackSearch.semanticTop` default `18` | Status: `hard-coded`
- `alignment.fallbackSearch.maxCandidatesAfterMerge` default `32` | Status: `hard-coded`
- `alignment.fallbackSearch.maxTargetCandidatesPerSource` default `3` | Status: `hard-coded`
- `alignment.fallbackSearch.autoMatchThreshold` default `0.9` | Status: `hard-coded`
- `alignment.fallbackSearch.llmAdjudicationThreshold` default `0.6` | Status: `hard-coded`
- `alignment.fallbackSearch.maxSourceOnlyTopicsToProbe` default `20` | Status: `hard-coded`

## Core Config Object: Completion
- `completion.preferredModels` default `['openai-5.1','gpt-4o']` | Status: `hard-coded`
- `completion.temperature` default `0.2` | Status: `hard-coded`
- `completion.maxTokens` default `1400` | Status: `hard-coded`
- `completion.maxShortTokens` default `800` | Status: `hard-coded`

## Core Config Object: Runtime Display
- `runtime.display.topicEvidenceLimit` default `10` | Status: `hard-coded`
- `runtime.display.analysisPreviewLimit` default `20` | Status: `hard-coded`
- `runtime.display.markdownListLimit` default `30` | Status: `hard-coded`
- `runtime.display.topicListDeltaMaxItems` default `20` | Status: `hard-coded`

## Additional Runtime Constants Outside Core Config
- `SEARCH_INDEX_NAME` default `'geisinger-002'` | Status: `hard-coded`
- `GEISINGER_COLLECTION` default `'user_collection'` | Status: `hard-coded`
- Embedding model in batch embeddings: `'text-embedding-ada-002'` | Status: `hard-coded`
- Embeddings client deployment: `'gpt-4o-aisvc'` | Status: `hard-coded`
- Embeddings client API version: `'2023-05-15'` | Status: `hard-coded`
- Progress heartbeat interval default `8000ms` | Status: `hard-coded`
- Heartbeat stage messages array | Status: `hard-coded`
- Spreadsheet upload container `'compliance-ai'` | Status: `hard-coded`
- Spreadsheet path prefix `'document-comparisons'` | Status: `hard-coded`
- Spreadsheet file pattern `'comparison-v2-{timestamp}.xlsx'` | Status: `hard-coded`
- SharePoint host switch from `USE_VAULT` (`geisinger.sharepoint.com` vs `sp-cloud.kp.org`) | Status: `env-configurable` via `USE_VAULT`

## Additional Hard-Coded Fallback Defaults Used In Logic
- `callCompletionWithFallback` fallback max tokens `1200` when config missing | Status: `hard-coded fallback`
- `callCompletionWithFallback` fallback model `gpt-4o` when preferred models missing | Status: `hard-coded fallback`
- `runFallbackSearchForConversationSection` defaults when fallback config absent:
- `maxVariants=4`, `keywordTop=35`, `semanticTop=35`, `maxCandidatesAfterMerge=70` | Status: `hard-coded fallback`
- Fallback ranking shortlist default `maxTargetCandidatesPerSource=6` | Status: `hard-coded fallback`
- Fallback similarity defaults `autoMatchThreshold=0.9`, `llmAdjudicationThreshold=0.6` | Status: `hard-coded fallback`

## Formatting And Prompt-Surface Constants
- Topic-mode evidence display cap `10` per side in markdown | Status: `hard-coded`
- LLM analysis payload preview caps in comprehensive analysis (`matched/sourceOnly/targetOnly` capped to `20`) | Status: `hard-coded`
- Several prompt strings are inline in code:
- Topic comparison system and user instructions
- Comprehensive analysis system and user instructions
- Adjudication system and user instructions
- Difference assessment fallback prose
- These are not currently file-backed in V2 | Status: `hard-coded`

## Existing Config Assets Not Consumed By V2
- `app/services/langgraphs/compliance/config/comparison-retrieval-v2.json`
- `app/services/langgraphs/compliance/config/comparison-alignment-v2.json`
- `app/services/langgraphs/compliance/config/comparison-analysis-v2.md`
- `app/services/langgraphs/compliance/config/comparison-format-v2.md`
- V2 currently loads `HARD_CODED_COMPARISON_CONFIG` directly and does not read these files.

## Proposed Externalization Targets (Phase 1: File-Backed)
- `config/comparison-mode-v2.json` for mode keyword detection.
- `config/comparison-retrieval-v2.json` for retrieval knobs.
- `config/comparison-ranking-v2.json` for ranking weights.
- `config/comparison-alignment-v2.json` for primary/secondary/fallback matching knobs.
- `config/comparison-completion-v2.json` for model and token controls.
- `config/comparison-runtime-v2.json` for index, collection, heartbeat, artifact naming/path/container.
- `config/comparison-prompts-v2.md` or split prompt files for topic/comprehensive/adjudication text.

## Proposed Externalization Targets (Phase 2: Geisinger Config Runtime)
- Persist same schema payloads as GeisingerConfig documents under a dedicated comparison collection.
- Use file values as defaults when Geisinger docs are absent.
- Add optional refresh/caching behavior so changes apply without rebuild.

## Completeness Statement
- Based on code scan of `complianceComparisonService2.js`, this manifest captures all primary config paths and major runtime literals that influence behavior, quality, and output volume.
- Before implementation, we should decide whether to externalize prompt prose and artifact naming in the same pass or defer those to a second pass.
