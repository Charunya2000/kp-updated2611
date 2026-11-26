# EFS-S DB Lookup Validation: `no-spec` Investigation

## Summary

DB validation is enabled and completes quickly, but no database lookup rules are actually applied. The portal reports:

```text
DB validation is enabled, but no lookup rules were applied (all lookups reported no-spec).
Check lookupSpecFile 'app/services/efss/lookups/companion-guide-db-mapping.edn'.
```

The configured EDN file is readable and valid, but it is not in the lookup-spec schema expected by EFS-S. The file contains top-level `:mappings`; EFS-S builds its lookup index exclusively from top-level `:specs`. This produces an empty lookup index, so every nonblank lookup candidate resolves to `:no-spec`.

This should be fixed in the EFS-S repository/package by defining and shipping the intended lookup-spec artifact or by explicitly supporting the mapping schema. The portal should not guess DB-validation behavior from descriptive mappings unless that behavior is part of the EFS-S contract.

## Confirmed Runtime Flow

1. The portal passes this option:

   ```js
   lookupSpecFile: 'app/services/efss/lookups/companion-guide-db-mapping.edn'
   ```

2. EFS-S maps the JavaScript option `lookupSpecFile` to the ClojureScript option `:lookup-spec-file`.

3. `load-lookup-specs` reads and parses the EDN document.

4. `build-lookup-index` reads only `(:specs lookup-doc)` and indexes specs by:

   ```clojure
   [(:loop spec) (:segment-id spec) (:segment-ref spec)]
   ```

5. `find-lookup-spec` first attempts an exact key match and then falls back to matching `:segment-id` plus `:segment-ref`.

6. When no matching spec exists, `evaluate-lookup` returns:

   ```clojure
   {:lookup-applied false
    :valid true
    :status :no-spec}
   ```

7. The portal detects that all lookup statuses are `no-spec` and emits the warning.

## Schema Mismatch

The configured portal file starts with a document shaped like:

```clojure
{:source-guide "..."
 :ddl-source "MEMBER_OWNER_DDL.sql"
 :generated-on #inst "..."
 :mappings
 [{:loop "Header"
   :segments
   [{:segment-id "ISA"
     :targets
     [{:table "TAP_IDENTIFIER"
       :elements
       [{:segment-ref "ISA05"
         :column "INTERCHANGE_ID_QUALIFIER"}]}]}]}]}
```

EFS-S expects a canonical document shaped like:

```clojure
{:specs
 [{:id "..."
   :loop "Header"
   :segment-id "ISA"
   :segment-ref "ISA05"
   :enabled? true
   :lookup-kind :table-column
   :table "TAP_IDENTIFIER"
   :column "INTERCHANGE_ID_QUALIFIER"
   ;; Other fields required by the selected executor, such as SQL/scope.
   }]}
```

Because `(:specs lookup-doc)` is `nil`, reducing it creates an empty map rather than a missing index. That distinction explains the observed status:

- Missing/unreadable document can lead to `:no-lookup-index`.
- Readable document with no `:specs` creates an empty index and leads to `:no-spec`.

## Packaging Issue

The packaged Node wrapper defines its default lookup file as:

```js
path.join(__dirname, 'save', 'companion-db-lookups.edn')
```

The package README also refers to `save/companion-db-lookups.edn`, but inspection of `efs-s-x12-1.0.tgz` found no lookup EDN and no `save/companion-db-lookups.edn` entry. Therefore the package advertises/defaults to an artifact that is not shipped.

This may be the primary upstream packaging defect if a canonical generated `:specs` file already exists in the EFS-S source/build environment.

## Important Semantic Concern

The current `:mappings` document appears to describe where companion-guide elements map into database tables and columns. That does not necessarily mean every mapping is a valid existence lookup.

Automatically converting every mapping to an enabled lookup spec could produce false failures or meaningless SQL. EFS-S executors may need additional semantics such as:

- validation scope, for example subscriber versus transaction/file
- SQL predicate or `:sql :exists`
- joins needed to reach a mapped table
- normalization rules for dates, identifiers, qualifiers, and codes
- whether the mapping is informational, persistence-oriented, or validation-oriented
- whether the rule is enabled and why it may be disabled

The upstream fix should make these semantics explicit rather than infer them silently in the portal.

## Recommended Upstream Resolution

### Preferred: Generate and ship canonical lookup specs

1. Locate or restore the EFS-S generator for `save/companion-db-lookups.edn`.
2. Ensure its output has top-level `:specs` and all fields required by the active lookup executors.
3. Include the generated EDN in the npm package/tarball.
4. Keep the wrapper default path aligned with the packaged location.
5. Add package tests that install/require the packed tarball, not only the source tree.
6. Expose the canonical packaged path through `lookupSpecFilePath` as the wrapper does today.
7. Update the portal to use that exported/default artifact instead of the descriptive mapping file.

### Alternative: Officially support `:mappings`

If `:mappings` is intended as valid EFS-S input, normalize it inside EFS-S at the load boundary:

```clojure
(defn load-lookup-specs [lookup-spec-file]
  ;; Parse EDN, validate its schema, and return one canonical document
  ;; containing :specs for all downstream consumers.
  )
```

Normalization must occur before all consumers, because lookup indexing, prefetch, and report counts read `(:specs lookup-doc)` directly. Normalizing only in `build-lookup-index` would make matching work while leaving prefetch and `:lookup-spec-count` inconsistent.

The conversion should be backed by a documented contract for SQL, scope, enablement, and unsupported mapping types. Invalid or unsupported documents should fail clearly instead of silently becoming an empty index.

## Recommended Validation and Error Handling

EFS-S should validate the loaded document before execution. Suggested behavior:

- File missing/unreadable: return or throw a specific lookup-file error.
- EDN parse failure: report a parse error with the file path.
- Neither `:specs` nor a supported alternative schema exists: report `:unsupported-lookup-schema`.
- `:specs` exists but is empty: report `:empty-lookup-specs`.
- Specs are malformed or duplicate the same lookup key: report actionable validation errors.
- Specs load successfully: report both loaded count and enabled count.

Silently treating an unsupported document as an empty index makes validation appear successful and fast while applying no DB rules.

## Focused Upstream Tests

Add tests for at least these cases:

1. A canonical `:specs` document loads and produces a nonzero index.
2. A known rule resolves by exact `[loop segment-id segment-ref]` key.
3. The documented fallback resolves by `[segment-id segment-ref]` when appropriate.
4. An unsupported top-level schema fails explicitly.
5. An empty `:specs` collection fails explicitly or produces a clearly distinct status.
6. The single-query prefetch path sees the same normalized specs as the legacy executor.
7. `:lookup-spec-count` equals the canonical loaded spec count.
8. `npm pack` includes the default EDN file.
9. Requiring the packed module produces an existing `lookupSpecFilePath`.
10. A small end-to-end fixture applies at least one lookup and does not report all `no-spec`.

## Quick Reproduction Checks

From the EFS-S repository, inspect the shape of the generated/default EDN and verify package contents:

```powershell
# The expected file should contain a top-level :specs key.
Select-String -Path .\save\companion-db-lookups.edn -Pattern ':specs'

# The packed artifact must include that file.
npm pack

tar -tf .\efs-s-x12-*.tgz | Select-String -Pattern 'save/companion-db-lookups.edn|lookup.*\.edn'
```

Then execute a focused harness fixture and assert:

```text
lookup-spec-count > 0
lookup-applied count > 0
not(all lookup statuses == no-spec)
```

## Portal Files Involved

- `app/[teamName]/[assistantName]/smartNote/[id]/components/ediWorkbench/EdiWorkbenchExperience.js`
- `app/api/[teamName]/[assistantName]/smartNote/[smartNoteId]/edi-workbench/parse/start/route.js`
- `app/services/ediWorkbenchService.js`
- `app/services/efss/lookups/companion-guide-db-mapping.edn`
- `app/services/efss/npm-lib/index.js`
- `app/services/efss/npm-lib/cljs/org/kp/kpmc/core.cljs`
- `app/services/efss/npm-lib/cljs/org/kp/kpmc/companion_rules.cljs`

## Partial Local Experiment

During diagnosis, an experimental compatibility adapter was started locally in:

- `app/services/efss/npm-lib/index.js`
- `app/services/efss/npm-lib/cljs/org/kp/kpmc/companion_rules.cljs`

It converts `:mappings` entries into minimal `:specs`. This experiment confirms where normalization would need to occur, but it has not been validated and should not be treated as the final fix. In particular, it assumes every mapping is enabled and does not establish all required SQL/scope semantics.

Before consuming a newly fixed EFS-S package in the portal, remove or supersede this local adapter so package behavior is tested without an accidental compatibility layer.
