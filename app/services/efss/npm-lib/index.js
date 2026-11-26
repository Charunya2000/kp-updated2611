const fs = require("fs");
const path = require("path");

require(path.join(__dirname, "cljs", "goog", "bootstrap", "nodejs.js"));
require(path.join(__dirname, "cljs", "cljs_deps.js"));

global.CLOSURE_UNCOMPILED_DEFINES = {
  "cljs.core._STAR_target_STAR_": "nodejs"
};

goog.require("org.kp.kpmc.core");

const core = global.org.kp.kpmc.core;
const defaultLookupSpecFile = path.join(__dirname, "save", "companion-db-lookups.edn");
const companionGuideDbMappingFile = path.join(__dirname, "reference", "companion-guide-db-mapping.edn");
const hasLookupSpecs = fs.existsSync(defaultLookupSpecFile);

if (!fs.existsSync(companionGuideDbMappingFile)) {
  throw new Error(`Packaged companion guide DB mapping is missing: ${companionGuideDbMappingFile}`);
}

function withLookupSpecDefaults(opts) {
  const dbValidationRequested = opts &&
    (opts.dbValidation === true || opts["dbValidation?"] === true ||
      opts["db-validation?"] === true);
  if (dbValidationRequested && !hasLookupSpecs &&
      opts.lookupSpecFile == null && opts["lookup-spec-file"] == null) {
    throw new Error(
      "DB validation requires a canonical lookup spec. " +
      "Repackage EFS-S with -LookupSpecFile <path-to-specs.edn>."
    );
  }

  if (!opts || typeof opts !== "object") {
    return hasLookupSpecs ? { lookupSpecFile: defaultLookupSpecFile } : {};
  }

  if (hasLookupSpecs && opts.lookupSpecFile == null && opts["lookup-spec-file"] == null) {
    return { ...opts, lookupSpecFile: defaultLookupSpecFile };
  }

  return opts;
}

module.exports = {
  core,
  capabilities: core.capabilities_json(),
  lookupSpecFilePath: hasLookupSpecs ? defaultLookupSpecFile : null,
  hasLookupSpecs,
  companionGuideDbMappingPath: companionGuideDbMappingFile,
  reverso: core.reverso,
  parseX12Full: core.parse_x12_full_json,
  parseX12Chunked: core.parse_x12_chunked_json,
  parseCompanionGuide: core.parse_companion_guide_json,
  parseCompanionGuideEditable: core.parse_companion_guide_editable_json,
  parseCompanionGuideEditableText: core.parse_companion_guide_editable_text_json,
  saveCompanionGuideEdn: core.save_companion_guide_edn,
  enrichParseTree: core.enrich_parse_tree_json,
  enrichX12WithCompanionGuide: core.enrich_x12_with_companion_guide,
  runRuleHarness: (companionCsv, ediFile, opts) => core.run_rule_harness_json(companionCsv, ediFile, withLookupSpecDefaults(opts)),
  runStructuralRuleHarness: (companionCsv, ediFile, opts) => core.run_structural_rule_harness_json(companionCsv, ediFile, withLookupSpecDefaults(opts)),
  compareRuleHarnesses: (companionCsv, ediFile, opts) => core.compare_rule_harnesses_json(companionCsv, ediFile, withLookupSpecDefaults(opts)),
  parseEnrichValidate: (companionCsv, ediFile, opts) => core.parse_enrich_validate_json(companionCsv, ediFile, withLookupSpecDefaults(opts)),
  parseEnrichValidateStructural: (companionCsv, ediFile, opts) => core.parse_enrich_validate_structural_json(companionCsv, ediFile, withLookupSpecDefaults(opts)),
  validateEditableCompanionGuide: (editableGuide, ediFile, opts) => core.validate_editable_companion_guide_json(editableGuide, ediFile, withLookupSpecDefaults(opts)),
  parseCliOpts: core.parse_cli_opts,
  runCli: core.run_cli_BANG_,
  parseX12FullRaw: core.parse_x12_full,
  parseX12ChunkedRaw: core.parse_x12_chunked,
  parseCompanionGuideRaw: core.parse_companion_guide,
  runRuleHarnessRaw: core.run_rule_harness,
  runStructuralRuleHarnessRaw: core.run_structural_rule_harness,
  compareRuleHarnessesRaw: core.compare_rule_harnesses,
  enrichParseTreeRaw: core.enrich_parse_tree
};