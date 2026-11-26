const x12 = require("efs-s-x12");
const fs = require("fs");
const path = require("path");

function cljsToJs(value) {
  const c = global?.cljs?.core;
  if (c && typeof c.clj__GT_js === "function") {
    return c.clj__GT_js(value);
  }
  return value;
}

function makeCljsParserOpts({ logMemory = false, logEveryNSubscribers } = {}) {
  const cc = global?.cljs?.core;
  if (!cc || !cc.PersistentArrayMap || !cc.Keyword) {
    return null;
  }

  const entries = [];
  if (logMemory) {
    entries.push(new cc.Keyword(null, "log-memory?", "log-memory?", 738652043), true);
  }

  if (Number.isFinite(logEveryNSubscribers) && logEveryNSubscribers > 0) {
    entries.push(
      new cc.Keyword(null, "log-every-n-subscribers", "log-every-n-subscribers", 515345643),
      logEveryNSubscribers
    );
  }

  if (entries.length === 0) {
    return null;
  }

  return cc.PersistentArrayMap.fromArray(entries, true, false);
}

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function defaultOutputPaths(x12FilePath, outputDir) {
  const baseName = path.basename(x12FilePath, path.extname(x12FilePath));
  const outDir = outputDir || path.join(process.cwd(), "out");
  return {
    parsedPath: path.join(outDir, `${baseName}.parsed.json`),
    enrichedPath: path.join(outDir, `${baseName}.enriched.json`),
    validationPath: path.join(outDir, `${baseName}.validation.json`),
  };
}

function getParseEnrichValidateFn() {
  return x12?.parseEnrichValidate || x12?.core?.parse_enrich_validate_json || null;
}

function wrapTransactionSet(tx) {
  return [
    "transaction_set",
    tx.header,
    ["trans_block", ["unsecured_trans_block", tx.parse_tree]],
    tx.trailer,
  ];
}

function findFirstTag(node, tag) {
  if (!Array.isArray(node) || node.length === 0) {
    return null;
  }

  if (node[0] === tag) {
    return node;
  }

  for (let i = 1; i < node.length; i += 1) {
    const child = node[i];
    const found = findFirstTag(child, tag);
    if (found) {
      return found;
    }
  }

  return null;
}

function enrichChunkedParsed(parsed, companionGuide) {
  let transactionCount = 0;
  let enrichedCount = 0;

  const functionalGroups = parsed?.functional_groups || parsed?.["functional-groups"];

  if (!parsed || !Array.isArray(functionalGroups)) {
    return { enriched: parsed, transactionCount, enrichedCount };
  }

  for (const fg of functionalGroups) {
    if (!fg || !Array.isArray(fg.transactions)) {
      continue;
    }

    for (const tx of fg.transactions) {
      transactionCount += 1;

      const parseTree = tx?.parse_tree || tx?.["parse-tree"];

      if (!tx || tx.success !== true || !parseTree) {
        continue;
      }

      const txSet = wrapTransactionSet(tx);
      const enrichedTxSet = x12.enrichParseTree(txSet, companionGuide);
      const enrichedBody = findFirstTag(enrichedTxSet, "trans_body");

      tx.enriched_transaction_set = enrichedTxSet;
      if (enrichedBody) {
        tx.parse_tree = enrichedBody;
        tx["parse-tree"] = enrichedBody;
      }

      enrichedCount += 1;
    }
  }

  return { enriched: parsed, transactionCount, enrichedCount };
}

function parseX12File(filePath, companionPath, outputDir, options = {}) {
  const { chunked = false } = options;

  if (!filePath) {
    throw new Error("Missing X12 file path. Usage: npm run parse-x12 -- path\\to\\test1.txt [path\\to\\companion.csv] [outputDir] [--chunked]");
  }

  if (!chunked && !companionPath) {
    throw new Error("Missing companion CSV path for full parse/enrich mode. Usage: npm run parse-x12 -- path\\to\\test1.txt path\\to\\companion.csv [outputDir]");
  }

  try {
    const { parsedPath, enrichedPath, validationPath } = defaultOutputPaths(filePath, outputDir);
    const parseEnrichValidate = getParseEnrichValidateFn();
    const canRunOneStep = !chunked && !!companionPath && typeof parseEnrichValidate === "function";

    if (canRunOneStep) {
      const pipelineRaw = parseEnrichValidate(companionPath, filePath, {
        logMemory: !!options.logMemory,
        lookupSpecFile: options.lookupSpecFile,
        includeLookupSql: !!options.includeLookupSql,
        dbValidation: !!options.dbValidation,
        envName: options.envName,
        subscriberOnlyDbValidation: options.subscriberOnlyDbValidation,
      });

      const pipeline = cljsToJs(pipelineRaw) || {};
      const parsed = pipeline?.parsed || pipeline?.parseTree || null;
      const enriched = pipeline?.enriched || pipeline?.enrichedResult || null;
      const validationSummary = pipeline?.validationSummary || pipeline?.report?.validation || null;

      if (!parsed) {
        throw new Error("One-step parse pipeline returned no parsed payload.");
      }

      writeJsonFile(parsedPath, parsed);
      if (enriched) {
        writeJsonFile(enrichedPath, enriched);
      }
      if (validationSummary) {
        writeJsonFile(validationPath, validationSummary);
      }

      console.log(`Parsed JSON written: ${parsedPath}`);
      if (enriched) {
        console.log(`Enriched JSON written: ${enrichedPath}`);
      }
      if (validationSummary) {
        console.log(`Validation JSON written: ${validationPath}`);
      }

      return {
        parsed,
        enriched,
        validationSummary,
        report: pipeline?.report || null,
        parsedPath,
        enrichedPath: enriched ? enrichedPath : null,
        validationPath: validationSummary ? validationPath : null,
      };
    }

    const cljsParserOpts = makeCljsParserOpts(options);

    // Run the raw CLJS pipeline first, then convert once at the edge for JSON.
    const parsedRaw = chunked
      ? (typeof x12.parseX12ChunkedRaw === "function"
        ? (cljsParserOpts ? x12.parseX12ChunkedRaw(filePath, cljsParserOpts) : x12.parseX12ChunkedRaw(filePath))
        : x12.parseX12Chunked(filePath))
      : (typeof x12.parseX12FullRaw === "function"
        ? (cljsParserOpts ? x12.parseX12FullRaw(filePath, cljsParserOpts) : x12.parseX12FullRaw(filePath))
        : x12.parseX12Full(filePath));

    const enrichedRaw = (!chunked && companionPath)
      ? (() => {
        const companionRaw = typeof x12.parseCompanionGuideRaw === "function"
          ? x12.parseCompanionGuideRaw(companionPath)
          : x12.parseCompanionGuide(companionPath);

        return typeof x12.enrichParseTreeRaw === "function"
          ? x12.enrichParseTreeRaw(parsedRaw, companionRaw)
          : x12.enrichParseTree(parsedRaw, companionRaw);
      })()
      : null;

    const parsed = cljsToJs(parsedRaw);
    writeJsonFile(parsedPath, parsed);

    let enriched = enrichedRaw ? cljsToJs(enrichedRaw) : null;

    if (chunked && companionPath) {
      const companionGuide = typeof x12.parseCompanionGuide === "function"
        ? x12.parseCompanionGuide(companionPath)
        : cljsToJs(typeof x12.parseCompanionGuideRaw === "function"
          ? x12.parseCompanionGuideRaw(companionPath)
          : null);

      const chunkedEnrich = enrichChunkedParsed(parsed, companionGuide);
      enriched = chunkedEnrich.enriched;
      console.log(
        `Chunked enrichment completed: ${chunkedEnrich.enrichedCount}/${chunkedEnrich.transactionCount} transactions enriched.`
      );
    }

    if (enriched) {
      writeJsonFile(enrichedPath, enriched);
    }

    console.log(`Parsed JSON written: ${parsedPath}`);
    if (enriched) {
      console.log(`Enriched JSON written: ${enrichedPath}`);
    } else if (chunked) {
      console.log("Chunked mode: enrichment skipped (no companion CSV provided).")
    }

    return {
      parsed,
      enriched,
      validationSummary: null,
      report: null,
      parsedPath,
      enrichedPath: enriched ? enrichedPath : null,
      validationPath: null,
    };
  } catch (err) {
    console.error("parse/enrich failed:", err.message);

    // CLJS runtime is globally loaded by the package bootstrap
    const c = global?.cljs?.core;
    if (c && err?.data) {
      try {
        // Human-readable CLJS map/string
        console.error("ex-data (pr-str):", c.pr_str(err.data));

        // JS-converted view (often easier to inspect)
        const jsData = c.clj__GT_js(err.data);
        console.error("ex-data (js):", JSON.stringify(jsData, null, 2));

        if (jsData?.failure) {
          console.error("failure:", String(jsData.failure));
        }
      } catch (e) {
        console.error("Could not decode cljs ex-data:", e.message);
      }
    }

    throw err;
  }
}

function main() {
  const argv = process.argv.slice(2);
  const positional = [];
  let logMemory = false;
  let chunked = false;
  let logEveryNSubscribers;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--log-memory") {
      logMemory = true;
      continue;
    }

    if (arg === "--chunked") {
      chunked = true;
      continue;
    }

    if (arg === "--log-every-n-subscribers") {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        logEveryNSubscribers = Number.parseInt(next, 10);
        i += 1;
      }
      continue;
    }

    positional.push(arg);
  }

  const filePath = positional[0];
  const companionPath = positional[1];
  const outputDir = positional[2];

  return parseX12File(filePath, companionPath, outputDir, {
    chunked,
    logMemory,
    logEveryNSubscribers,
  });
}

if (require.main === module) {
  try {
    const result = main();
    console.log(JSON.stringify({
      parsedPath: result.parsedPath,
      enrichedPath: result.enrichedPath,
      validationPath: result.validationPath,
    }, null, 2));
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}

module.exports = {
  parseX12File,
  main,
};