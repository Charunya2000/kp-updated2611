# Azure Surface Approach

Status: Draft for review (v2)
Audience: Architect, implementer, reviewer
Scope: Define a documentation-first approach to satisfy the Spring Cloud Config Azure environment interaction surface with a new implementation pattern and normalized key naming.

## 0) Purpose

This document defines the approved approach before any code changes.

Goals:

1. Satisfy the Azure environment interaction surface contracts with a concrete implementation strategy.
2. Replace ad hoc property naming with a normalized key format.
3. Ensure the plan includes full BDD and architecture/interaction analysis before implementation starts.

## 1) Mandatory Operating Protocol Alignment

For this workstream:

1. Documentation first.
2. Plan before code.
   1. This plan includes a full BDD description of the proposed changes.
   2. This plan includes architecture interaction and existing functionality interaction review.
3. Slice-based implementation.
4. Deployment log update per completed slice.
5. Focused tests per slice.
6. Full-suite/build validation before closure.
7. Narrow, informative commits.
8. Strict TypeScript only for all new and changed code paths.
9. Strict unit-testing coverage for all new logic and behavior changes.

No implementation should begin until this document is reviewed and explicitly approved.

Planning status:

1. This workstream remains in planning-only state.
2. No implementation changes are authorized until explicit approval is provided.

## 2) Problem Statement

Current context from scripts/configActions.js indicates configuration is loaded from a Spring Cloud Config endpoint and mapped into process environment variables.

Identified issues to address in the new implementation approach:

1. Existing property keys are inconsistent and difficult to reason about at scale.
2. Key naming does not consistently expose resource type, variant, and credential/endpoint semantics.
3. The contract surface requires a clear implementation boundary that is independent from one large script.

## 3) Naming Standard (Proposed)

Required naming pattern for normalized environment keys:

1. RESOURCE_TYPE_VARIANT_ENDPOINT
2. RESOURCE_TYPE_VARIANT_USER_NAME
3. RESOURCE_TYPE_VARIANT_PASSWORD
4. RESOURCE_TYPE_VARIANT_API_KEY
5. RESOURCE_TYPE_VARIANT_CLIENT_ID
6. RESOURCE_TYPE_VARIANT_CLIENT_SECRET

Guidelines:

1. Use uppercase snake case only.
2. RESOURCE should identify provider or platform area (for example AZURE_OPENAI, AZURE_SEARCH, STORAGE_BLOB, AUTH_FAM, DATAHUB).
3. TYPE should identify the integration function (for example CHAT, EMBEDDING, PRIMARY, REPORTING, INGESTION).
4. VARIANT should identify deployment/environment lane (for example DEV, UAT, PP, PROD, T3).
5. Suffix should identify value kind (ENDPOINT, USER_NAME, PASSWORD, API_KEY, CLIENT_ID, CLIENT_SECRET).

Example normalized keys:

1. AZURE_OPENAI_CHAT_DEV_ENDPOINT
2. AZURE_OPENAI_CHAT_DEV_API_KEY
3. AZURE_SEARCH_PRIMARY_UAT_ENDPOINT
4. STORAGE_BLOB_PRIMARY_PP_ACCOUNT_NAME
5. DATAHUB_APPUSER_RBC2_PROD_USER_NAME
6. DATAHUB_APPUSER_RBC2_PROD_PASSWORD

## 4) Proposed Surface-Satisfaction Architecture

Proposed components (documentation-level only):

1. SpringConfigClient
   1. Reads Spring Cloud Config payload from configured URI.
   2. Handles authentication and response validation.
2. ConfigKeyNormalizer
   1. Maps remote property names to normalized env-style keys.
   2. Contains explicit, versioned mapping rules.
3. AzureSurfaceConfigProvider
   1. Resolves required values for surface interfaces using normalized keys.
   2. Applies fallback/override policy and validation rules.
4. Surface Implementations
   1. Concrete implementations satisfy contracts in src/server/surfaces/spring-cloud-config-azure-env/action-surfaces.ts.
   2. Surface implementations read only from AzureSurfaceConfigProvider, not directly from raw property names.

### 4.1 Lazy Runtime Initialization (Build-Safe by Design)

Required behavior:

1. No Spring Config network calls at module top-level.
2. No Azure/OpenAI client construction at module top-level.
3. No top-level code path that requires resolved env-dependent endpoints during Next.js build.
4. First runtime call triggers lazy configuration bootstrap via an async factory.

Recommended pattern:

1. Use `getOrInitConfigProvider()` that memoizes an in-flight Promise.
2. Use `getOrInit<Resource>Client()` per resource family (chat, embeddings, responses, search, storage).
3. Keep all initialization in server-only modules and runtime code paths.

### 4.2 Connection and Client Lifecycle Strategy

Best-practice policy for this repo:

1. One logical client instance per resource family per Node.js process.
2. Reuse HTTP agents/underlying sockets through singleton client reuse.
3. Do not share mutable request data on singleton objects; pass request metadata per call.
4. In serverless/multi-instance runtime, allow one singleton per worker/process (expected and acceptable).

Rationale:

1. Minimizes connection churn and TLS handshake overhead.
2. Reduces latency under repeated LLM calls.
3. Avoids race conditions from repeated parallel bootstraps.

### 4.3 Nexus Proxy Routing Model

Authoritative runtime routing:

1. Chat completions route through Nexus proxy chat endpoint contract.
2. Embeddings route through Nexus proxy embeddings endpoint contract.
3. Responses API routes through Nexus proxy responses endpoint contract for MCP-oriented flows.

Current service alignment inputs:

1. app/services/chatCompletionService2.js currently supports a feature-flag split between direct Azure and Nexus proxy path.
2. app/services/vectorizeDataService.js currently supports a feature-flag split between direct Azure and Nexus embeddings proxy path.
3. This approach keeps existing proxy pathways and formalizes them behind shared client/provider abstractions.

### 4.4 Responses API and MCP Surface Direction

Design direction:

1. Introduce a dedicated ResponsesProxyClient for MCP-compatible interactions.
2. Keep Responses request/response envelopes explicit and versioned.
3. Isolate MCP-specific request shaping from general chat completion flows.

Initial contract intent:

1. Input supports role-based messages and system instructions.
2. Headers include required Nexus metadata (`ESB-OAuth`, `x-user-id`, `x-session-id`, `x-host-system`, `x-ip-address`, `envlbl`, optional `x-event`).
3. Error mapping normalizes proxy/gateway failures into stable internal error codes.

### 4.5 Key Registry and Mapping Model

Required artifacts:

1. A central key registry file listing normalized key names by domain.
2. A deterministic mapping dictionary from Spring property names to normalized keys.
3. Domain-level required/optional key declarations.

Behavior:

1. Unknown Spring keys are ignored unless explicitly configured for diagnostics.
2. Missing required normalized keys fail initialization for that domain.
3. Domain validation emits non-secret diagnostics for readiness checks.

## 5) BDD Description (Full)

### 5.1 Configuration Retrieval

1. Given Spring Cloud Config endpoint credentials are valid,
2. When the runtime initializes environment configuration,
3. Then the system retrieves the property source payload,
4. And validates payload shape and required root fields,
5. And exposes a deterministic configuration map for downstream resolution.

### 5.2 Key Normalization

1. Given remote property names are heterogeneous,
2. When the normalization layer processes the payload,
3. Then each recognized property is mapped to a normalized key using RESOURCE_TYPE_VARIANT_SUFFIX format,
4. And unmapped keys are reported in diagnostics without breaking startup unless marked required,
5. And mapping behavior is stable across runs.

### 5.3 Surface Configuration Resolution

1. Given normalized keys exist for required resources,
2. When a surface implementation requests endpoint/credential values,
3. Then AzureSurfaceConfigProvider returns validated values by normalized key,
4. And missing required values produce explicit configuration errors,
5. And optional values follow defined fallback precedence.

### 5.4 Surface Contract Satisfaction

1. Given configuration is loaded and normalized,
2. When runtime composes Azure surface implementations,
3. Then each contract in action-surfaces can be satisfied by an implementation that depends on AzureSurfaceConfigProvider,
4. And call-site behavior remains contract-compatible,
5. And selected implementation identity is available for diagnostics.

### 5.5 Failure and Safety Behavior

1. Given Spring Config is unavailable or invalid,
2. When initialization executes,
3. Then startup fails fast for hard-required domains,
4. And logs include non-secret diagnostic context (missing keys, domain, mode),
5. And secret values are never emitted in logs.

### 5.6 Lazy Initialization and Build Safety

1. Given Next.js build-time module loading,
2. When server modules are imported,
3. Then no network call is made to Spring Config,
4. And no Azure/OpenAI client is created at import-time,
5. And initialization occurs only at first runtime invocation.

### 5.7 Singleton Client Reuse

1. Given multiple runtime requests in one process,
2. When chat/embedding/responses clients are requested,
3. Then one client instance per resource family is reused,
4. And concurrent first-use requests share one in-flight initialization promise,
5. And duplicated connection creation is prevented.

### 5.8 Proxy-First Chat and Embedding Behavior

1. Given Nexus proxy pathways are configured,
2. When chat or embedding requests are made,
3. Then requests use the corresponding Nexus endpoints with required headers,
4. And request metadata is propagated per call,
5. And feature-flag fallback behavior remains explicit and testable.

### 5.9 Responses API for MCP Workflows

1. Given an MCP-enabled execution path,
2. When a responses request is submitted,
3. Then the Responses proxy client sends payload to the Nexus responses endpoint,
4. And response envelope is normalized for internal consumers,
5. And unsupported features fail with explicit capability errors.

## 6) Architecture Interaction Review

### 6.1 Interaction with Existing Configuration Flow

1. Current flow in scripts/configActions.js performs direct property filtering and direct process.env assignment.
2. Proposed flow introduces layered boundaries (fetch, normalize, resolve) before values are consumed by surface implementations.
3. This reduces coupling between remote property naming and runtime interface contracts.

### 6.2 Interaction with Surface Contracts

1. Surface contracts remain stable and implementation-agnostic.
2. Configuration sourcing becomes an internal implementation concern.
3. Contract consumers remain unchanged if method signatures stay compatible.

### 6.3 Interaction with Existing Functionality

1. Authentication and callback URL setup continue to rely on environment-derived values, but source key names become normalized at provider boundary.
2. Existing external integrations (OpenAI, Search, Blob, DataHub, ServiceNow, Splunk, DB2) are preserved via explicit mapping rules.
3. Environment-specific exceptions (for example ZQ behavior) should move from inline script conditionals to declarative mapping/override policy.

### 6.5 Existing Implementation vs Recommended Best Practice

Observed in current implementation paths:

1. Direct `process.env` key access with long raw key names spread across services.
2. Client creation and env lookups mixed into service-level logic.
3. Feature-flag fallback behavior duplicated across service modules.

Recommended improvement for this repo:

1. Centralize env resolution behind AzureSurfaceConfigProvider.
2. Centralize proxy request building in dedicated Nexus proxy clients.
3. Keep services thin: orchestration only, no raw env/property resolution.
4. Use async singleton factories with in-flight promise memoization.
5. Introduce typed domain config objects (chat config, embedding config, responses config).

This means we will not copy the old implementation as-is; we will preserve behavior while upgrading architecture and reliability.

### 6.4 Operational and Security Interaction

1. Secret material remains in environment/process memory only as required by runtime.
2. Logging must avoid secret values and include only key identities and domain status.
3. Diagnostics should provide required/missing key reports per integration domain.

## 7) Open Decisions Requiring Approval

Confirmed decision:

1. Nexus proxy requests must include required metadata headers: `ESB-OAuth`, `x-user-id`, `x-session-id`, `x-host-system`, `x-ip-address`, `envlbl`; `x-event` is optional.

1. Canonical VARIANT vocabulary (DEV/UAT/PP/PROD/T3 and any additional lanes).
2. Whether ACCOUNT_NAME should be treated as a standard suffix alongside endpoint and credentials.
3. Hard-fail versus soft-fail domains during startup.
4. Backward compatibility window for legacy property names.
5. Whether dual-read mode (legacy + normalized) is required during migration.
6. Whether chat and embeddings should remain feature-flag switchable between direct Azure and Nexus, or become proxy-only.
7. Final Responses API capability scope for MCP (streaming, tool calls, structured output, parallel tool calls).
8. Required timeout, retry, and circuit-breaker thresholds per endpoint family.

## 8) Proposed Slice Plan (After Approval)

1. Slice A: Define normalized key registry, domain requirements, and legacy-to-normalized mapping dictionary.
2. Slice B: Implement SpringConfigClient with payload validation and non-secret diagnostics.
3. Slice C: Implement lazy AzureSurfaceConfigProvider with async memoization and domain getters.
4. Slice D: Implement Nexus proxy client layer for chat, embeddings, and responses (MCP-focused) with shared headers.
5. Slice E: Implement surface adapters that satisfy action-surfaces contracts using provider + proxy clients.
6. Slice F: Add implementation-id reporting, startup/readiness checks, and failure taxonomy.
7. Slice G: Focused tests, regression tests for proxy behavior, and full-suite/build validation.

## 9) Validation Strategy (After Approval)

1. Unit tests for key normalization rules and fallback behavior.
2. Unit tests for required-key validation by domain.
3. Contract tests for each surface implementation.
4. Startup diagnostics tests ensuring non-secret reporting.
5. Integration smoke test against representative Spring Config payload.
6. Build-time safety tests confirming no network calls at module import.
7. Concurrency tests confirming single initialization under parallel first-use requests.
8. Proxy header propagation tests for chat, embeddings, and responses.
9. Responses API MCP contract tests for supported/unsupported capability handling.

Unit-testing enforcement:

1. Every behavior change must have corresponding unit tests in the same slice.
2. Regression tests are required for any bug fix or behavior correction.
3. Pull requests should not merge with skipped or flaky tests in affected domains.

## 10) TypeScript Quality Gates (After Approval)

Type system standards:

1. `strict` TypeScript mode is the baseline for all new modules.
2. Avoid `any`; use explicit types, discriminated unions, and typed result envelopes.
3. Runtime inputs from external systems (Spring Config payloads, proxy responses) must be validated and narrowed before use.
4. Public interfaces for surface contracts and proxy clients must be exported as explicit types.
5. Error mapping must use typed error categories rather than free-form strings.

Definition of done impact:

1. Type checks pass with no new warnings/errors in modified areas.
2. Unit tests cover success path, failure path, and validation path for each new module.
3. Build and test gates remain mandatory before completion.

## 11) Nexus Proxy Contract (Normalized Reference)

Reference source:

1. docs/NEXUS_OS_V3_APIS.md

Endpoint families:

1. `/chat/completions`
2. `/embeddings`
3. `/responses`

Required request metadata headers:

1. `ESB-OAuth: Bearer <token>`
2. `envlbl`
3. `x-user-id`
4. `x-session-id`
5. `x-host-system`
6. `x-ip-address`
7. Optional: `x-event`

Security notes:

1. Do not log OAuth tokens or secret headers.
2. Log request IDs, endpoint family, and status code only.
3. Separate user attribution headers from auth token handling.

## 12) Open Questions (Targeted)

The following items should be confirmed before implementation starts:

1. Responses API features required in Nexus for MCP in this phase (streaming, tools, structured output, parallel tools).
2. Canonical model names for chat, embeddings, and responses per environment.
3. Proxy timeout/retry defaults and whether they differ by endpoint family.
4. Whether `Authorization: Basic` is required in all cases or only specific gateway routes.

## 13) Review Gate

This document is the mandatory review gate for this workstream.

Implementation is blocked until explicit approval is provided.
