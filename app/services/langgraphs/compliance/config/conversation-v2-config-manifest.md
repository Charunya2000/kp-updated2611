# Conversation V2 Config Manifest

Route validated: `app/api/[teamName]/[assistantName]/smartNote/[smartNoteId]/submitAssistant/complianceai/conversationai/route.js`

## Route Validation Summary
- The route itself contains no behavior knobs; it normalizes request fields and delegates to `complianceConversationGraphV2`.
- Effective config surface is in `app/services/langgraphs/compliance/complianceConversationService2.js`.

## Current Runtime Config Sources
- Loader-driven: `loadConversationConfigV2` in `complianceConversationService2.js`.
- File fragments under `app/services/langgraphs/compliance/config`.
- GeisingerConfig overlays from `Document Conversation`.
- Hard-coded safety fallback: `HARD_CODED_CONVERSATION_CONFIG`.
- Environment variables:
- `GEISINGER_PREPARATION_VERSION`
- `USE_VAULT`
- `envName` and dynamic host-based keys for embeddings/search endpoints and keys.

## Hard-Coded Config Surface (Conversation V2)
- Retrieval:
- `searchFields`, `selectFields`
- `strategy.keywordTop`, `strategy.semanticTop`, `strategy.maxVariants`
- `strategy.maxLobBatches`, `strategy.maxConversationIdsPerBatch`, `strategy.maxCandidatesAfterMerge`
- `strategy.selectedDocEvidenceCount`, `strategy.allLobEvidenceCount`, `strategy.perDocumentCapAllLob`
- `strategy.evidenceSnippetMaxLength` (snippet text length sent as LLM evidence)
- Ranking:
- `scoreWeight`, `exactSectionBoost`, `titleTermBoost`, `contentTermBoost`, `exactPromptBoost`
- `queryVariantBoost.exact|normalized|sectionOnly|quotedClause`
- Answer:
- `model`, `temperature`, `maxTokens`, `systemPrompt`
- Format:
- `responseTemplate`, `includeEvidenceSection`, `evidenceSectionTitle`
- Runtime constants:
- `SEARCH_INDEX_NAME='geisinger-002'`
- `GEISINGER_COLLECTION='user_collection'`
- embeddings deployment/model/api version
- response section cap for used docs (`slice(0, 12)`)

## File-Backed Assets (Runtime-Wired)
- `conversation-retrieval-v2.json`
- `conversation-ranking-v2.json`
- `conversation-answer-v2.md`
- `conversation-format-v2.md`
- `conversation-runtime-v2.json`

## Externalization Target
- Runtime should resolve by precedence:
1. GeisingerConfig docs in `Document Conversation`
2. local file assets under `app/services/langgraphs/compliance/config`
3. env fallback for infrastructure-only host/key resolution
4. hard-coded safety defaults

## Notes
- Route changes are not required for externalization; service-layer config loading is the required implementation point.
