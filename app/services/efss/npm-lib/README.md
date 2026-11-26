# efs-s-x12

Generated npm-style bundle from efs-s ClojureScript output.

## Build source project

1. Run `mvn -q compile` in the source repo.
2. Run `powershell -ExecutionPolicy Bypass -File scripts/build-npm-lib.ps1`.

## Use from another Node.js repo

Copy this folder's complete contents through the consuming repository's established
raw-library update workflow. Keep `index.js`, `package.json`, `cljs/`, `save/`, and
`reference/` together as one coherent compiled build. The consumer loads these files
directly; do not create or install a `.tgz` package.

When built with canonical lookup specs, the packaged bundle includes them at
`save/companion-db-lookups.edn`. It also includes descriptive mapping metadata at
`reference/companion-guide-db-mapping.edn`.

Use the exported `lookupSpecFilePath` for DB validation. The exported
`companionGuideDbMappingPath` is reference metadata and is not an executable lookup
spec. Check `hasLookupSpecs` before enabling DB validation.

Install the peer dependency:

```bash
npm install oracledb@6.8.0
```

## Editable companion guides

Enable editing only when the complete schema version 1 contract is available:

```js
const supportsEditableGuide =
  efs.capabilities?.editableCompanionGuide === true &&
  efs.capabilities?.editableCompanionGuideSchemaVersion === 1 &&
  typeof efs.parseCompanionGuideEditable === "function" &&
  typeof efs.validateEditableCompanionGuide === "function";
```

Schema version 1 is a JSON-friendly document with this shape:

```js
{
  schemaVersion: 1,
  source: { name, kind: "csv" },
  columns: [...],
  legend: [{ rowId, sourceRow, key, value }],
  loops: [{
    loopId, sourceRow, loopName, segmentId,
    segmentDescription, segmentRequirement
  }],
  elements: [{
    rowId, sourceRow, loopId, segmentName, segmentRef, usage,
    kpElement, elementDescription,
    options: [{ rowId, sourceRow, usage, kpElement, elementDescription }]
  }],
  diagnostics: [{
    severity, code, message, rowId, sourceRow, field, sourceValue
  }]
}
```

Preserve `schemaVersion`, `rowId`, `loopId`, `sourceRow`, `source`, `options`, and
`diagnostics` when persisting or editing the document.

Parse a CSV file into an editable document:

```js
const document = efs.parseCompanionGuideEditable(companionCsvPath);
```

Validate an edited document with the same options accepted by `parseEnrichValidate`:

```js
const result = efs.validateEditableCompanionGuide(document, ediPath, options);
```

Use `parseCompanionGuideEditableText(csvText, { sourceName })` when the caller already
holds the uploaded CSV content.

Invalid submitted models throw an error whose `type` is
`invalid-editable-companion-guide`. Structured diagnostics are available at
`error.details.diagnostics`. Diagnostic properties are `rowId`, `sourceRow`, and
`sourceValue`; `field` values use JavaScript names such as `loopId`, `schemaVersion`,
`segmentRef`, and `segmentRequirement`. Callers must not parse error message text.

Validating an unedited editable document must produce the same validation counts,
findings, subscriber statuses, progress behavior, lookup defaults, and streaming
behavior as `parseEnrichValidate` with the source CSV and equivalent options.