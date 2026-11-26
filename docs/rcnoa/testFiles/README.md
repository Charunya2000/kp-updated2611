# RCNOA Predefined Mock Test Files

This directory contains synthetic, server-owned fixtures for RCNOA ad hoc business-rule testing.

Each selectable fixture has two same-stem files:

- `<fixture-id>.rcno`: ordinary 73-column pipe-delimited RCNO input;
- `<fixture-id>.mock.json`: fixed MDW, EPDS, and prior-RCNA lookup responses plus expected rule/code metadata.

The five `complete-*-rules` pairs collectively cover all 51 ordered rule-catalog cases from `RCNO-RCNA-Complete-TestCases.json`:

| Fixture | Rows | Coverage |
| --- | ---: | --- |
| `complete-ab-rules` | 2 | A100 and B200 |
| `complete-f-rules` | 15 | F1300 through F20000 |
| `complete-i-rules` | 7 | I1000 through I7000 |
| `complete-n-rules` | 22 | N0000 through N16000 |
| `complete-fallback-rules` | 5 | AE-1, AC-2, DM-3, CE-4, and No_rule99999 |

These broad-coverage fixtures are RCNA-only. Several catalog outcomes are wildcard, sentinel, or no-op codes, and a family can contain incompatible 834 transaction intents. The existing focused fixtures continue through 834 generation and remain available for end-to-end checks.

`manifest.json` is the authoritative allowlist used by the application. The UI and API never accept a client-provided fixture path or independently selected JSON response.

Do not edit generated fixture files directly. Update `scripts/rcnoaMockScenarioDefinitions.mjs` or `scripts/generateRcnoaMockFixtures.mjs`, then run:

```powershell
npm run generate-rcnoa-mock-fixtures
npm test -- --runInBand app/services/rcnoa/__tests__/rcnoaMockFixtureService.test.js
```

The generator verifies every fixture against the production `RcnoToRcnaService` before writing the catalog. It also verifies that the broad fixtures cover all 51 catalog IDs exactly once and that every row selects its expected rule and code while using the family's shared mock lookup arrays. All fixture values must remain synthetic and must not be copied from EPDS, MDW, RCNO, RCNA, or 834 production data.