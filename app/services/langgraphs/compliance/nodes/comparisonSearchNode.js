// comparisonSearchNode.js

import { connectToDatabase } from "@/db/connection";

export const comparisonSearchNode = async (state) => {
  const { updateChatInteractionProgress } = await import('../helpers/progressTracking');

  let progressResponse = state.progressResponse || "## Comparison Progress\n\n";
  progressResponse += "⏳ Searching for relevant documents...\n\n---\n";

  // Update progress
  if (state.chatInteractionId) {
    await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
  }

  const {
    geisingerConversationA,
    geisingerConversationB,
    userPrompt,
    promptEmbedding,
    parsedIntent: rawIntent,
    searchClient
  } = state;

  // --- Intent Schema Enforcement and Defaults ---
  const parsedIntent = { ...rawIntent };
  // console.log(`Parsed Intent before defaults: ${JSON.stringify(parsedIntent, null, 2)}`);
  // ...existing code...
  parsedIntent.searchFields = ["content", "title"];
  parsedIntent.dataSources = Array.isArray(parsedIntent.dataSources)
    ? parsedIntent.dataSources.filter(ds => ["CognitiveSearch", "MongoDB"].includes(ds))
    : ["CognitiveSearch", "MongoDB"];
  parsedIntent.select = Array.isArray(parsedIntent.select) && parsedIntent.select.length > 0
    ? parsedIntent.select
    : ["id", "content", "title", "page", "level"];
  parsedIntent.mongoSelect = Array.isArray(parsedIntent.mongoSelect) && parsedIntent.mongoSelect.length > 0
    ? parsedIntent.mongoSelect
    : ["nuid", "title", "content", "level", "page"];
  parsedIntent.mongoFilters = typeof parsedIntent.mongoFilters === "object" && parsedIntent.mongoFilters !== null
    ? parsedIntent.mongoFilters
    : {};
  parsedIntent.filters = typeof parsedIntent.filters === "object" && parsedIntent.filters !== null
    ? parsedIntent.filters
    : {};

  // Helper to build OData filter
  function buildODataFilter(filters) {

    const filterString = Object.entries(filters)
      .map(([key, value]) => {
        if (typeof value === 'object' && value.ne !== undefined) {
          return `${key} ne '${value.ne}'`;
        }
        return `${key} eq '${value}'`;
      })
      .join(' and ');

    return filterString;
  }

  // --- Cognitive Search ---
  const searchCognitive = async (conversationId, extraFilters = {}) => {
    // console.log(`\n=== searchCognitive called ===`);
    // console.log(`conversationId: ${conversationId}`);
    // console.log(`extraFilters: ${JSON.stringify(extraFilters)}`);

    let filterObj = { smartnote_id: conversationId, ...extraFilters };
    let filter = buildODataFilter(filterObj);
    // console.log(`Built OData filter: ${filter}`);

    const selectFields = parsedIntent.select;
    const searchFields = parsedIntent.searchFields;
    // console.log(`userPrompt: "${userPrompt}"`);
    // console.log(`promptEmbedding exists: ${!!promptEmbedding}`);
    // console.log(`searchFields: ${JSON.stringify(searchFields)}`);
    // console.log(`selectFields: ${JSON.stringify(selectFields)}`);

    // console.log(`Making semantic search request...`);
    let semanticResults = await searchClient.search(userPrompt, {
      filter,
      select: [...selectFields, "page", "title", "level"],
      top: 50,
      embedding: promptEmbedding,
      vectorFields: ["content_vector"],
      searchFields
    });
    let semanticScoredResults = [];
    let semanticResultCount = 0;
    for await (const result of semanticResults.results) {
      semanticScoredResults.push(result);
      semanticResultCount++;
    }
    // console.log(`✓ Semantic Search Results Count: ${semanticResultCount}`);
    if (semanticScoredResults.length > 0) {
      // console.log(`  First semantic result: ${JSON.stringify(semanticScoredResults[0], null, 2)}`);
    }

    // console.log(`Making keyword search request...`);
    let keywordResults = await searchClient.search(userPrompt, {
      filter,
      select: [...selectFields, "page"],
      top: 50,
      searchFields
    });
    let keywordScoredResults = [];
    let keywordResultCount = 0;
    for await (const result of keywordResults.results) {
      keywordScoredResults.push(result);
      keywordResultCount++;
    }
    // console.log(`✓ Keyword Search Results Count: ${keywordResultCount}`);
    if (keywordScoredResults.length > 0) {
      // console.log(`  First keyword result: ${JSON.stringify(keywordScoredResults[0], null, 2)}`);
    }

    // Merge scored results
    let allScoredResults = [...semanticScoredResults, ...keywordScoredResults];
    // Deduplicate within this search: prefer semantic results (higher scores typically)
    const seenWithinSearch = new Set();
    const deduplicatedResults = [];
    for (const r of allScoredResults) {
      const id = r.document?.id || r.id;
      if (id && !seenWithinSearch.has(id)) {
        seenWithinSearch.add(id);
        deduplicatedResults.push(r);
      }
    }
    // Only keep the doc with the top score
    if (deduplicatedResults.length === 0) return [];
    const topResult = deduplicatedResults.reduce((max, r) => ((r.score ?? 0) > (max.score ?? 0) ? r : max), deduplicatedResults[0]);
    return [topResult];
  };

  // --- MongoDB ---
  const searchMongo = async (conversationId, extraFilters = {}) => {
    const db = await connectToDatabase();
    let query = { conversationId };
    // Apply regex filter for title if present in extraFilters
    if (extraFilters && typeof extraFilters.title === 'object' && extraFilters.title.$regex) {
      query.title = { $regex: extraFilters.title.$regex, $options: extraFilters.title.$options || 'i' };
    }
    // Add other filters
    Object.entries(extraFilters).forEach(([key, value]) => {
      if (key !== 'title') query[key] = value;
    });
    const projection = {};
    parsedIntent.mongoSelect.forEach(f => projection[f] = 1);
    const results = await db.collection("geisinger-docs").find(query, { projection }).limit(100).toArray();
    return results;
  };
  // ...existing code...

  // --- Run search for both documents ---
  // console.log(`\n=== Starting comparisonSearchNode ===`);
  // console.log(`geisingerConversationA ID: ${geisingerConversationA?.id}`);
  // console.log(`geisingerConversationB ID: ${geisingerConversationB?.id}`);
  // console.log(`parsedIntent.dataSources: ${JSON.stringify(parsedIntent.dataSources)}`);

  let searchResultsA = [];
  let searchResultsB = [];

  if (parsedIntent.dataSources.includes("CognitiveSearch")) {
    // console.log(`\n--- Searching Cognitive Search ---`);
    try {
      searchResultsA = await searchCognitive(geisingerConversationA?.id, parsedIntent.filters);
      if (!Array.isArray(searchResultsA)) searchResultsA = [];
      // console.log(`searchResultsA count after search: ${searchResultsA.length}`);
      searchResultsB = await searchCognitive(geisingerConversationB?.id, parsedIntent.filters);
      if (!Array.isArray(searchResultsB)) searchResultsB = [];
      // console.log(`searchResultsB count after search: ${searchResultsB.length}`);

    } catch (error) {
      console.error("Error in cognitive search:", error);
      searchResultsA = [];
      searchResultsB = [];
    }
  } else {
    // console.log(`Skipping Cognitive Search - not in dataSources`);
  }
  if (parsedIntent.dataSources.includes("MongoDB")) {
    // console.log(`\n--- Searching MongoDB ---`);
    try {
      const mongoResultsA = await searchMongo(geisingerConversationA?.id, parsedIntent.mongoFilters);
      const mongoResultsB = await searchMongo(geisingerConversationB?.id, parsedIntent.mongoFilters);
      // console.log(`mongoResultsA count: ${Array.isArray(mongoResultsA) ? mongoResultsA.length : 0}`);
      // console.log(`mongoResultsB count: ${Array.isArray(mongoResultsB) ? mongoResultsB.length : 0}`);

      searchResultsA = Array.isArray(searchResultsA) ? searchResultsA : [];
      searchResultsB = Array.isArray(searchResultsB) ? searchResultsB : [];
      searchResultsA = searchResultsA.concat(Array.isArray(mongoResultsA) ? mongoResultsA : []);
      searchResultsB = searchResultsB.concat(Array.isArray(mongoResultsB) ? mongoResultsB : []);

      // console.log(`searchResultsA count after MongoDB concat: ${searchResultsA.length}`);
      // console.log(`searchResultsB count after MongoDB concat: ${searchResultsB.length}`);
    } catch (error) {
      console.error("Error in MongoDB search:", error);
      // Keep existing searchResultsA/B if cognitive search worked
    }
  } else {
    console.log(`Skipping MongoDB - not in dataSources`);
  }

  // console.log(`\n--- Before dedupeAndSort ---`);
  // console.log(`searchResultsA: ${searchResultsA.length} items`);
  // console.log(`searchResultsB: ${searchResultsB.length} items`);

  // Deduplicate by id and sort by score if present
  function dedupeAndSort(results) {
    const seen = new Set();
    // Prefer cognitive search results: assume cognitive results have a 'score' property
    // and mongo results do not (or have lower score priority)
    const deduped = [];
    for (const r of results) {
      // Skip undefined or null results
      if (!r) continue;
      const id = r.document?.id || r.id || r.nuid;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      deduped.push(r);
    }
    // Sort by score descending and keep only top 20
    return deduped.sort((a, b) => {
      // Prefer results with a score (cognitive) over those without (mongo)
      if ((a.score ?? null) !== null && (b.score ?? null) === null) return -1;
      if ((a.score ?? null) === null && (b.score ?? null) !== null) return 1;
      return (b.score ?? 0) - (a.score ?? 0);
    }).slice(0, 20);
  }
  searchResultsA = dedupeAndSort(searchResultsA);
  searchResultsB = dedupeAndSort(searchResultsB);

  // console.log(`\n--- After dedupeAndSort ---`);
  // console.log(`searchResultsA final count: ${searchResultsA.length}`);
  // console.log(`searchResultsB final count: ${searchResultsB.length}`);

  if (searchResultsA.length > 0) {
    console.log(`searchResultsA sample:`, searchResultsA.slice(0, 2).map(r => ({ id: r.document?.id || r.id, score: r.score })));
  }
  if (searchResultsB.length > 0) {
    console.log(`searchResultsB sample:`, searchResultsB.slice(0, 2).map(r => ({ id: r.document?.id || r.id, score: r.score })));
  }

  // Mark search complete
  progressResponse = progressResponse.replace("⏳ Searching", "✓ Searching");
  progressResponse += "⏳ Summarizing search results...\n\n---\n";
  if (state.chatInteractionId) {
    await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
  }

  console.log(`=== comparisonSearchNode complete ===\n`);






  return {
    ...state,
    searchResultsA,
    searchResultsB,
    progressResponse
  };
};
