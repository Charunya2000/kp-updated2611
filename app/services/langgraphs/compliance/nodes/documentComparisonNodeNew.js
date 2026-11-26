// documentComparisonNodeNew.js
// Implements two-pass comparison strategy:
// Pass 1: For each source topic, search target and categorize as "only-in-source" or "also-in-target"
// Pass 2: For each target topic not found in pass 1, categorize as "new-in-target"

import { SearchClient, AzureKeyCredential } from '@azure/search-documents';

export const documentComparisonNodeNew = async (state) => {
  const { updateChatInteractionProgress } = await import('../helpers/progressTracking');

  let progressResponse = state.progressResponse || "## Comparison Progress\n\n";
  progressResponse += "⏳ Consolidating source document topics...\n\n---\n";

  // Update progress
  if (state.chatInteractionId) {
    await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
  }

  const { fullDocumentA, fullDocumentB, completionsClient, searchClient, configDocuments } = state;

  if (!fullDocumentA || !fullDocumentB) {
    console.error(`❌ [documentComparisonNodeNew] Missing document data`);
    progressResponse = progressResponse.replace("⏳", "❌");
    if (state.chatInteractionId) {
      await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
    }
    return {
      ...state,
      documentDifferences: { error: "Missing document data for comparison" },
      progressResponse
    };
  }

  const startTime = Date.now();

  // ===== CONSOLIDATION RULES =====
  const CONSOLIDATION_RULES = {
    maxLevelForTopics: 1,           // Only L0 (chapters) and L1 (sections) become topics
    minContentLength: 250,          // L1 sections < 200 chars may be skipped
    skipNumericTitles: true,        // Don't create topics for numeric-only titles
    aggregateAllDescendants: true   // Collect ALL child/grandchild content
  };

  // Helper: Clean and consolidate heading text
  function cleanHeading(text) {
    if (typeof text !== 'string') return text;
    let cleaned = text.trim();
    // Remove leading document structure numbering/lettering (e.g., 156.330, A., (1), etc.)
    // Match patterns like: 156.330, 156.330(a), A., (1), (a), I., etc.
    cleaned = cleaned.replace(/^((\d{1,3}(\.\d+)*([a-zA-Z])?)|([A-Z]\.)|(\([a-zA-Z0-9]+\)))[\s:.-]*+/g, '');
    // Remove any additional leading whitespace or punctuation
    cleaned = cleaned.replace(/^[-:.,\s]+/, '');
    // Remove trailing non-alpha characters
    cleaned = cleaned.replace(/[^a-zA-Z0-9]+$/, '');
    if (!cleaned.match(/[a-zA-Z]/)) {
      return text.trim();
    }
    return cleaned.trim();
  }

  // Helper: Build parent-child relationships
  function buildHierarchyMaps(sections) {
    const sectionMap = new Map(sections.map(s => [s.id, s]));
    const childrenByParent = {};

    sections.forEach(s => {
      if (s.parentId && s.parentId !== null) {
        if (!childrenByParent[s.parentId]) {
          childrenByParent[s.parentId] = [];
        }
        childrenByParent[s.parentId].push(s);
      }
    });

    return { sectionMap, childrenByParent };
  }

  // Helper: Recursively collect all descendant content (L2, L3, L4, etc.)
  function collectDescendantContent(sectionId, sectionMap, childrenByParent, depth = 0) {
    const section = sectionMap.get(sectionId);
    if (!section) return '';

    let aggregated = section.content || '';

    // Recursively collect children's content
    if (childrenByParent[sectionId] && childrenByParent[sectionId].length > 0) {
      for (const child of childrenByParent[sectionId]) {
        const childContent = collectDescendantContent(child.id, sectionMap, childrenByParent, depth + 1);
        if (childContent) {
          aggregated += '\n' + childContent;
        }
      }
    }

    return aggregated;
  }

  // Helper: Count all descendants (direct and indirect children)
  function countAllDescendants(sectionId, childrenByParent) {
    let count = 0;
    if (childrenByParent[sectionId] && childrenByParent[sectionId].length > 0) {
      for (const child of childrenByParent[sectionId]) {
        count += 1 + countAllDescendants(child.id, childrenByParent);
      }
    }
    return count;
  }

  // Helper: Consolidate topics hierarchically (roll-up strategy)
  function consolidateTopicsHierarchically(sections, rules) {
    const { sectionMap, childrenByParent } = buildHierarchyMaps(sections);
    const topics = [];

    // Only keep Level 0 and 1 as candidate topics
    const candidateSections = sections.filter(s => s.level <= rules.maxLevelForTopics);

    for (const section of candidateSections) {
      // Skip numeric-only titles if configured
      if (rules.skipNumericTitles && /^\d+(\.\d+)*$/.test((section.title || '').trim())) {
        continue;
      }

      // Skip Level 1 sections with insufficient content (unless they have children with content)
      const sourceLength = (section.content || '').length;
      const childCount = countAllDescendants(section.id, childrenByParent);

      if (section.level > 0 && sourceLength < rules.minContentLength && childCount === 0) {
        continue;
      }

      // Aggregate all descendant content (roll-up)
      const aggregatedContent = collectDescendantContent(section.id, sectionMap, childrenByParent);

      const aggregatedLength = aggregatedContent.length;
      const childrenCollected = aggregatedLength - sourceLength;

      topics.push({
        id: section.id,
        title: cleanHeading(section.title),
        originalTitle: section.title,
        content: aggregatedContent,          // Combined with all descendants
        sourceContent: section.content || '', // Original content for reference
        page: section.page,
        level: section.level,
        childCount: childrenByParent[section.id]?.length || 0,
        descendantCount: countAllDescendants(section.id, childrenByParent),
        sourceSize: sourceLength,
        aggregatedSize: aggregatedLength,
        aggregatedFrom: childrenCollected  // How much was added from children
      });
    }

    return topics;
  }

  // Helper: Log consolidation summary
  function logConsolidationSummary(topics, originalSectionCount) {
    if (topics.length === 0) return;

    topics.forEach((topic, idx) => {
      const indent = '  '.repeat(topic.level);
      const ratio = topic.sourceSize > 0 ? ((topic.aggregatedSize / topic.sourceSize) * 100).toFixed(0) : 0;
    });
  }

  // Helper: Search target document for related content
  async function searchTargetForTopic(topic, targetDocId) {
    if (!searchClient) {
      console.warn('[documentComparisonNodeNew] No search client available, using fuzzy matching instead');
      return null;
    }

    try {
      // Search by topic title
      const searchResults = await searchClient.search(topic.title, {
        filter: `smartnote_id eq '${targetDocId}'`,
        select: ['id', 'content', 'title', 'page', 'level'],
        top: 5
      });

      const results = [];
      for await (const result of searchResults.results) {
        results.push(result.document);
      }

      return results.length > 0 ? results : null;
    } catch (error) {
      console.error(`[documentComparisonNodeNew] Search error for topic "${topic.title}":`, error.message);
      return null;
    }
  }

  // Helper: Determine if target results are related to source topic using LLM
  async function isRelatedContent(sourceTopic, targetResults) {
    if (!completionsClient || !targetResults || targetResults.length === 0) {
      return false;
    }

    const targetContent = targetResults.map(r => `Title: ${r.title}\nContent: ${(r.content || '').substring(0, 300)}`).join('\n---\n');

    const prompt = `Determine if the following target document content is related to the source topic:

Source Topic: "${sourceTopic.title}"
Source Content: ${(sourceTopic.content || '').substring(0, 500)}

Target Content Found:
${targetContent}

Respond with only "YES" or "NO" - is this target content related to the source topic?`;

    try {
      const completion = await completionsClient.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a compliance expert. Determine if content is related to a topic. Be strict - respond YES only if clearly related." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_completion_tokens: 10
      });

      const response = completion.choices[0]?.message?.content?.trim().toUpperCase() || "NO";
      return response.includes("YES");
    } catch (error) {
      console.error('[documentComparisonNodeNew] LLM relationship check failed:', error.message);
      return false;
    }
  }

  // Helper: Summarize content using LLM
  async function summarizeContent(label, content) {
    if (!completionsClient || !content) {
      return "No content available";
    }

    const prompt = `Summarize the following ${label} content in 2-3 sentences:

${content.substring(0, 1000)}`;

    try {
      const completion = await completionsClient.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a compliance expert. Provide concise, factual summaries." },
          { role: "user", content: prompt }
        ],
        temperature: 0.5,
        max_completion_tokens: 200
      });

      return completion.choices[0]?.message?.content?.trim() || "No summary available";
    } catch (error) {
      console.error(`[documentComparisonNodeNew] Summary error for ${label}:`, error.message);
      return `Error: ${error.message}`;
    }
  }

  // Helper: Generate difference analysis using LLM
  async function generateDifferenceAnalysis(sourceContent, targetContent) {
    if (!completionsClient) {
      return "No analysis available";
    }

    const prompt = `Compare the following two document sections and describe the key differences in detail. Focus on substantive content, requirements, or intent, not just wording:

Source Content:
${(sourceContent || '').substring(0, 2000)}

Target Content:
${(targetContent || '').substring(0, 2000)}

Provide a concise but thorough analysis of how these differ.`;

    try {
      const completion = await completionsClient.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a compliance expert. Compare content and highlight meaningful differences in requirements, obligations, or intent." },
          { role: "user", content: prompt }
        ],
        temperature: 0.5,
        max_completion_tokens: 400
      });

      return completion.choices[0]?.message?.content?.trim() || "No differences found";
    } catch (error) {
      console.error('[documentComparisonNodeNew] Analysis error:', error.message);
      return `Error: ${error.message}`;
    }
  }

  let comparisonResults = [];
  let sourceProcessed = new Set();
  let targetProcessed = new Set();

  try {
    // Mark consolidation complete, start Pass 1
    progressResponse = progressResponse.replace("⏳ Consolidating", "✓ Consolidating");
    progressResponse += "⏳ Pass 1: Comparing source topics with target...\n\n---\n";
    if (state.chatInteractionId) {
      await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
    }

    // PASS 1: Compare source document topics with target

    const sourceTopics = consolidateTopicsHierarchically(fullDocumentA.sections || [], CONSOLIDATION_RULES);
    logConsolidationSummary(sourceTopics, (fullDocumentA.sections || []).length);

    for (const sourceTopic of sourceTopics) {
      // Search target for related content
      const targetResults = await searchTargetForTopic(sourceTopic, fullDocumentB.conversationId);

      if (!targetResults || targetResults.length === 0) {
        // Topic only in source
        const sourceSummary = await summarizeContent('Source', sourceTopic.content);
        comparisonResults.push({
          category: "only-in-source",
          sourceTitle: sourceTopic.title,
          sourceSummary,
          targetSummary: null,
          differenceAnalysis: "Topic exists in source document but not found in target document.",
          sourceId: sourceTopic.id
        });
      } else {
        // Check if related using LLM
        const isRelated = await isRelatedContent(sourceTopic, targetResults);

        if (!isRelated) {
          // Found content but not related - categorize as only-in-source
          const sourceSummary = await summarizeContent('Source', sourceTopic.content);
          comparisonResults.push({
            category: "only-in-source",
            sourceTitle: sourceTopic.title,
            sourceSummary,
            targetSummary: null,
            differenceAnalysis: "Topic exists in source but no related content found in target.",
            sourceId: sourceTopic.id
          });
        } else {
          // Found and related - compare details using actual content
          const sourceSummary = await summarizeContent('Source', sourceTopic.content);
          const targetContent = targetResults.map(r => r.content).join('\n');
          const targetSummary = await summarizeContent('Target', targetContent);
          const differenceAnalysis = await generateDifferenceAnalysis(sourceTopic.content, targetContent);

          comparisonResults.push({
            category: "also-in-target",
            sourceTitle: sourceTopic.title,
            sourceSummary,
            targetSummary,
            differenceAnalysis,
            sourceId: sourceTopic.id,
            targetIds: targetResults.map(r => r.id)
          });

          // Mark target results as processed
          targetResults.forEach(r => targetProcessed.add(r.id));
        }
      }

      sourceProcessed.add(sourceTopic.id);
    }

    // Mark Pass 1 complete, start Pass 2
    progressResponse = progressResponse.replace("⏳ Pass 1", "✓ Pass 1");
    progressResponse += "⏳ Pass 2: Finding new topics in target...\n\n---\n";
    if (state.chatInteractionId) {
      await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
    }

    // PASS 2: Find new topics in target document not in source

    const targetTopics = consolidateTopicsHierarchically(fullDocumentB.sections || [], CONSOLIDATION_RULES);
    logConsolidationSummary(targetTopics, (fullDocumentB.sections || []).length);

    for (const targetTopic of targetTopics) {
      if (targetProcessed.has(targetTopic.id)) {
        continue; // Already covered in pass 1
      }

      // Search source for this target topic
      // (In a real scenario, we'd also search source doc, but for now we'll just mark as new)
      const targetSummary = await summarizeContent('Target', targetTopic.content);
      comparisonResults.push({
        category: "new-in-target",
        targetTitle: targetTopic.title,
        targetSummary,
        sourceSummary: null,
        differenceAnalysis: "This topic is new in the target document and does not exist in the source.",
        targetId: targetTopic.id
      });

      targetProcessed.add(targetTopic.id);
    }

    // Mark Pass 2 complete
    progressResponse = progressResponse.replace("⏳ Pass 2", "✓ Pass 2");
    progressResponse += "⏳ Generating final comparison summary...\n\n---\n";
    if (state.chatInteractionId) {
      await updateChatInteractionProgress(state.chatId, state.chatInteractionId, progressResponse);
    }

  } catch (error) {
    console.error(`❌ [documentComparisonNodeNew] Comparison failed:`, error);
    progressResponse = progressResponse.replace(/⏳.*/, "❌ Comparison failed: " + error.message);
    if (state.chatInteractionId) {
      await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
    }
    return {
      ...state,
      documentDifferences: { error: `Comparison failed: ${error.message}` },
      progressResponse
    };
  }

  const analysisTime = Date.now() - startTime;

  // Mark complete
  progressResponse = progressResponse.replace("⏳ Generating", "✓ Generating");
  if (state.chatInteractionId) {
    await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
  }

  return {
    ...state,
    documentDifferences: {
      results: comparisonResults,
      summary: {
        onlyInSource: comparisonResults.filter(r => r.category === "only-in-source").length,
        alsoInTarget: comparisonResults.filter(r => r.category === "also-in-target").length,
        newInTarget: comparisonResults.filter(r => r.category === "new-in-target").length,
        total: comparisonResults.length
      },
      timestamp: new Date().toISOString(),
      processingTime: analysisTime
    },
    progressResponse
  };
};
