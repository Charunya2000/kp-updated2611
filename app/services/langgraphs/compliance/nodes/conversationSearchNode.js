'use server';

import { connectToDatabase } from '@/db/connection';

const CURRENT_PREPARATION_VERSION = String(process.env.GEISINGER_PREPARATION_VERSION || '1').trim();
const GEISINGER_COLLECTION = 'user_collection';

function normalizePreparationVersion(value) {
  if (value === null || value === undefined) return null;
  const version = String(value).trim();
  return version || null;
}

function toNumericVersion(value) {
  const normalized = normalizePreparationVersion(value);
  if (!normalized) return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function isAtOrAbovePreparationVersion(value, minimumPreparationVersion = CURRENT_PREPARATION_VERSION) {
  const normalized = normalizePreparationVersion(value);
  const minVersion = normalizePreparationVersion(minimumPreparationVersion) || '1';

  if (!normalized) {
    return minVersion === '1';
  }

  const docNumeric = toNumericVersion(normalized);
  const minNumeric = toNumericVersion(minVersion);
  if (docNumeric !== null && minNumeric !== null) {
    return docNumeric >= minNumeric;
  }

  return normalized === minVersion;
}

function buildODataFilter(filters) {
  return Object.entries(filters)
    .map(([key, value]) => {
      if (typeof value === 'object' && value.ne !== undefined) {
        return `${key} ne '${value.ne}'`;
      }
      if (typeof value === 'object' && Array.isArray(value.in)) {
        const escapedValues = value.in
          .map(v => String(v || '').replace(/'/g, "''"))
          .join(',');
        return `search.in(${key}, '${escapedValues}', ',')`;
      }
      // Add more operators as needed (e.g., gt, lt, in)
      return `${key} eq '${value}'`;
    })
    .join(' and ');
}

function buildCurrentPreparationVersionMongoFilter() {
  // Version thresholding is applied in-memory for compatibility with Mongo/Cosmos query behavior.
  return {};
}

export const conversationSearchNode = async (state) => {

  const { searchClient, geisingerConversation, userPrompt, promptEmbedding, parsedIntent: rawIntent } = state;

  // --- Intent Schema Enforcement and Defaults ---
  // Clone and validate intent
  const parsedIntent = { ...rawIntent };

  // Enforce enums
  const allowedStrategies = ["semantic", "keyword", "hybrid"];
  if (!allowedStrategies.includes(parsedIntent.searchStrategy)) {
    parsedIntent.searchStrategy = "keyword";
  }
  const allowedSources = ["CognitiveSearch", "MongoDB"];
  parsedIntent.dataSources = Array.isArray(parsedIntent.dataSources)
    ? parsedIntent.dataSources.filter(ds => allowedSources.includes(ds))
    : ["CognitiveSearch"];

  // If all-files mode is enabled, filter by all prepared conversation ids in the selected LOB.
  if (geisingerConversation?.allFilesInLob && geisingerConversation?.lob) {
    const normalizedTeamName = String(geisingerConversation?.teamName || '').trim();
    const dbName = normalizedTeamName ? `team-${normalizedTeamName}-db` : undefined;
    const db = await connectToDatabase(dbName);

    const conversationFilter = {
      type: 'GeisingerConversation',
      lob: geisingerConversation.lob,
      status: { $in: ['Complete', 'Prepared'] },
      ...buildCurrentPreparationVersionMongoFilter(),
    };

    const conversations = await db.collection(GEISINGER_COLLECTION)
      .find(conversationFilter)
      .project({ id: 1 })
      .toArray();

    const conversationIds = conversations
      .filter((c) => isAtOrAbovePreparationVersion(c?.preparationVersion))
      .map(c => c?.id)
      .filter(Boolean);

    if (conversationIds.length > 0) {
      parsedIntent.filters = { smartnote_id: { in: conversationIds } };
      parsedIntent.mongoFilters = {
        ...(parsedIntent.mongoFilters || {}),
        conversationId: { in: conversationIds }
      };

    } else {
      // Force an empty result set when no prepared docs exist in the selected LOB.
      parsedIntent.filters = { smartnote_id: '__NO_CONVERSATIONS_FOR_LOB__' };
      parsedIntent.mongoFilters = {
        ...(parsedIntent.mongoFilters || {}),
        conversationId: '__NO_CONVERSATIONS_FOR_LOB__'
      };

    }
  } else if (geisingerConversation?.id) {
    // Force filters to only smartnote_id for Cognitive Search
    parsedIntent.filters = { smartnote_id: geisingerConversation.id };
    parsedIntent.mongoFilters = { ...(parsedIntent.mongoFilters || {}), conversationId: geisingerConversation.id };
  }

  // Default searchFields
  if (!Array.isArray(parsedIntent.searchFields) || parsedIntent.searchFields.length === 0) {
    parsedIntent.searchFields = ["content"];
  }
  // Default select fields
  if (!Array.isArray(parsedIntent.select) || parsedIntent.select.length === 0) {
    parsedIntent.select = ["id", "smartnote_id", "content", "smart_file_name"];
  }
  // Default mongoSelect
  if (!Array.isArray(parsedIntent.mongoSelect)) {
    parsedIntent.mongoSelect = [];
  }
  // Default mongoFilters
  if (typeof parsedIntent.mongoFilters !== "object" || parsedIntent.mongoFilters === null) {
    parsedIntent.mongoFilters = {};
  }

  // --- Cognitive Search ---
  let cognitiveResults = [];
  let topCognitiveResultId = null;
  if (parsedIntent.dataSources.includes('CognitiveSearch')) {
    let filter = null;
    if (parsedIntent.filters && Object.keys(parsedIntent.filters).length > 0) {
      filter = buildODataFilter(parsedIntent.filters);
    }
    const selectFields = parsedIntent.select;
    const searchFields = parsedIntent.searchFields;
    let cognitiveSearchResults = [];
    let scoredResults = [];
    // Normalize search text to ensure section numbers like 156.220 are tokenized separately
    // 1. Insert a space after 'CFR' when immediately followed by a section number (e.g., CFR156.220 -> CFR 156.220)
    // 2. Insert a space before trailing letters immediately following a section number (e.g., 156.220a -> 156.220 a)
    // 3. Collapse multiple spaces
    let searchText = userPrompt || '*';
    if (typeof searchText === 'string' && searchText !== '*') {
      searchText = searchText
        // CFR followed directly by number
        .replace(/\b(CFR)(?=\d{1,3}\.\d{1,3})/gi, '$1 ')
        // Number immediately followed by letter (subsection) without space
        .replace(/(\d{1,3}\.\d{1,3})(?=[A-Za-z])(?!\.)/g, '$1 ')
        // Ensure a space after the section number if directly followed by '(' (e.g., 156.220(a)(1)) for clearer token separation (optional)
        .replace(/(\d{1,3}\.\d{1,3})(?=\()/g, '$1 ')
        // Trim and collapse extra whitespace
        .replace(/\s+/g, ' ')
        .trim();
    }

    if (parsedIntent.searchStrategy === 'semantic') {
      const results = await searchClient.search(searchText, {
        filter,
        select: [...selectFields, "page", "title", "level"].filter(f => f !== "score"),
        top: 5,
        embedding: promptEmbedding,
        vectorFields: ["content_vector"],
        searchFields
      });
      for await (const result of results.results) {
        cognitiveSearchResults.push(result.document);
        scoredResults.push(result);
      }

      // Find top scoring result
      if (scoredResults.length > 0) {
        scoredResults.sort((a, b) => b.score - a.score);
        topCognitiveResultId = scoredResults[0].document.id;
      }

    } else if (parsedIntent.searchStrategy === 'keyword') {
      const results = await searchClient.search(searchText, {
        filter,
        select: [...selectFields, "page", "title", "level"].filter(f => f !== "score"),
        top: 100,
        searchFields
      });
      for await (const result of results.results) {
        cognitiveSearchResults.push(result.document);
        scoredResults.push(result);
      }

      if (scoredResults.length > 0) {
        scoredResults.sort((a, b) => b.score - a.score);
        topCognitiveResultId = scoredResults[0].document.id;
      }

    } else if (parsedIntent.searchStrategy === 'hybrid') {
      // Hybrid: run both semantic and keyword, merge results
      const semanticResults = await searchClient.search(searchText, {
        filter,
        select: [...selectFields, "page", "title", "level"].filter(f => f !== "score"),
        top: 50,
        embedding: promptEmbedding,
        vectorFields: ["content_vector"],
        searchFields
      });
      let semanticDocs = [];
      let semanticScoredResults = [];
      for await (const result of semanticResults.results) {
        semanticDocs.push(result.document);
        semanticScoredResults.push(result);
      }
      const keywordText = parsedIntent.filters?.keyword || userPrompt || '*';
      const keywordResults = await searchClient.search(keywordText, {
        filter,
        select: [...selectFields, "page"].filter(f => f !== "score"),
        top: 50,
        searchFields
      });
      let keywordDocs = [];
      let keywordScoredResults = [];
      for await (const result of keywordResults.results) {
        keywordDocs.push(result.document);
        keywordScoredResults.push(result);
      }

      // Merge and deduplicate by id
      const seen = new Set();
      cognitiveSearchResults = [...semanticDocs, ...keywordDocs].filter(doc => {
        if (seen.has(doc.id)) return false;
        seen.add(doc.id);
        return true;
      });
      // Find top scoring result from both semantic and keyword
      let allScoredResults = [...semanticScoredResults, ...keywordScoredResults];
      // Boost results where userPrompt matches (in part) the title
      // CFR-specific boost: extract CFR number from prompt and check in title
      if (userPrompt && typeof userPrompt === 'string') {
        // Regex to extract CFR number (e.g., 156.330)
        // Updated regex: previously used word boundaries which failed for patterns like 'CFR156.220'.
        // Now we allow the numeric pattern to be directly adjacent to letters while avoiding being part of a longer numeric sequence.
        const cfrMatch = userPrompt.match(/(?<!\d)(\d{1,3}\.\d{1,3})(?!\d)/);
        if (cfrMatch) {
          const cfrNumber = cfrMatch[0];
          allScoredResults = allScoredResults.map(r => {
            const title = r.document.title || '';
            if (typeof title === 'string' && title.includes(cfrNumber)) {

              return { ...r, score: r.score + 2.5 };
            }
            return r;
          });
        }
      }

      if (allScoredResults.length > 0) {
        // Sort by score descending and take top 50

        const top5 = allScoredResults.sort((a, b) => b.score - a.score).slice(0, 5);
        const regex = /(§\s*)?(\d+\.\d+)/;
        const matching = top5.filter(r => typeof r.document.title === 'string' && regex.test(r.document.title));

        if (matching.length >= 2) {
          // Only select the top score from matching documents
          matching.sort((a, b) => b.score - a.score);
          topCognitiveResultId = matching[0].document.id;
        } else {
          // Default: top score from all
          topCognitiveResultId = top5[0].document.id;
        }
      }
    }
    cognitiveResults = cognitiveSearchResults;

  }

  // --- MongoDB ---
  let mongoResults = [];
  if (parsedIntent.dataSources.includes('MongoDB')) {
    const db = await connectToDatabase();
    let query = { type: 'HierarchyNode' };
    if (parsedIntent.mongoFilters && Object.keys(parsedIntent.mongoFilters).length > 0) {
      Object.entries(parsedIntent.mongoFilters).forEach(([key, value]) => {
        if (typeof value === 'object' && value.ne !== undefined) {
          query[key] = { $ne: value.ne };
        } else if (typeof value === 'object' && Array.isArray(value.in)) {
          query[key] = { $in: value.in };
        } else {
          query[key] = value;
        }
      });
    } else if (parsedIntent.filters && Object.keys(parsedIntent.filters).length > 0) {
      Object.entries(parsedIntent.filters).forEach(([key, value]) => {
        if (typeof value === 'object' && value.ne !== undefined) {
          query[key] = { $ne: value.ne };
        } else if (typeof value === 'object' && Array.isArray(value.in)) {
          query[key] = { $in: value.in };
        } else {
          query[key] = value;
        }
      });
    } else if (geisingerConversation?.id) {
      query.conversationId = geisingerConversation.id;
    }
    let projection = undefined;
    if (Array.isArray(parsedIntent.mongoSelect) && parsedIntent.mongoSelect.length > 0) {
      projection = {};
      parsedIntent.mongoSelect.forEach(field => { projection[field] = 1; });
    }
    const nodes = await db.collection('geisinger-docs')
      .find(query, { projection })
      .limit(100)
      .toArray();
    mongoResults = nodes;
  }

  // --- Context enrichment (if specified) ---
  // TODO: Implement context enrichment logic if plan.contextEnrichment is provided

  // --- Return updated state ---
  return {
    ...state,
    searchResults: {
      cognitiveResults,
      mongoResults,
      topCognitiveResultId
    }
  };
};
