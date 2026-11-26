# Geisinger Preparation Config Manifest V1

Primary files reviewed:
- `app/[teamName]/admin/geisinger-preparation/page.js`
- `app/services/geisingerPreparationService.js`
- `app/api/admin/[teamName]/geisinger-preparation/*/route.js`

## Scope
- Inventory and externalize config used by document preparation discovery, queueing, status polling, and admin UI defaults.

## Current Config Surface

### Service Runtime Config (Externalized)
- `job.jobType`, `job.maxConcurrency`, `job.defaultConcurrency`
- `discovery.defaultRootFolder`, `discovery.preparableExtensions`, `discovery.requireSingleLobWhenFileNameFilterPresent`
- `collections.conversationCollectionName`
- `sharePoint.domainToggleEnvVar`, `sharePoint.vaultDomain`, `sharePoint.legacyDomain`

### Environment-Driven
- `GEISINGER_PREPARATION_VERSION` (default `'1'`)
- `USE_VAULT` (Graph-vs-REST folder fetch and SharePoint domain behavior)

### UI Defaults (Externalized)
- `ui.defaults.concurrency`
- `ui.defaults.discoveryRootFolder`
- `ui.defaults.pollingIntervalMs`
- `ui.limits.concurrencyInputMin|concurrencyInputMax`

### API Defaults (Hard-Coded)
- Discover endpoint defaults `rootFolder='Shared Documents'`
- Status/stop/start routes pass-through values from request body/query

## New File Assets Added
- `preparation-runtime-v1.json`
- `preparation-ui-v1.json`

## Runtime Resolution
- `geisingerPreparationService.js` loads `loadPreparationConfigV1` and applies Geisinger overlays from `Document Preparation Config` (and legacy `Geisinger Preparation`).
- Admin page `app/[teamName]/admin/geisinger-preparation/page.js` reads `/api/admin/[teamName]/compliance/preparation-v1-config` for UI defaults and limits.
- Env remains only for bootstrap/infra toggles and dynamic preparation version resolution.

## Import Payload
- `preparation-v1-geisinger-import.json`

## Notes
- Runtime wiring is complete for preparation service and admin UI defaults.
