// documentComparisonNodeNew2.js
// Optimized: Direct section title matching, minimal LLM use, no repeated search queries.

export const documentComparisonNodeNew2 = async (state) => {
  const { updateChatInteractionProgress } = await import('../helpers/progressTracking');

  let progressResponse = state.progressResponse || "## Comparison Progress\n\n";
  progressResponse += "⏳ Consolidating document topics...\n\n---\n";

  if (state.chatInteractionId) {
    await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
  }

  const { fullDocumentA, fullDocumentB } = state;
  if (!fullDocumentA || !fullDocumentB) {
    progressResponse = progressResponse
      .replace("⏳ Comparing documents hierarchically...", "❌ Comparing documents hierarchically...")
      .replace("⏳ Consolidating document topics...", "❌ Consolidating document topics...");
    if (!progressResponse.includes("⏳ Finalizing comparison response...")) {
      progressResponse += "⏳ Finalizing comparison response...\n\n---\n";
    }

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


  // Robust normalization for titles: remove legal symbols, punctuation, collapse whitespace, lowercase
  function normalizeTitle(title) {
    if (!title || typeof title !== 'string') return '';
    // Remove legal symbols (e.g., §), punctuation, collapse whitespace, lowercase
    return title
      .replace(/[§]/g, '') // Remove section symbol
      .replace(/[^a-zA-Z0-9]+/g, ' ') // Remove all non-alphanumeric
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim()
      .toLowerCase();
  }

  // Simple fuzzy match: returns index of best match or -1
  function fuzzyMatchTitle(sourceNorm, targetNorms) {
    let bestIdx = -1;
    let bestScore = 0;
    for (let i = 0; i < targetNorms.length; i++) {
      const t = targetNorms[i];
      // Jaccard similarity on word sets
      const sWords = new Set(sourceNorm.split(' '));
      const tWords = new Set(t.split(' '));
      const intersection = new Set([...sWords].filter(x => tWords.has(x)));
      const union = new Set([...sWords, ...tWords]);
      const score = intersection.size / union.size;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    // Threshold: at least 0.7 similarity
    return bestScore >= 0.7 ? bestIdx : -1;
  }

  const sourceSections = fullDocumentA.sections || [];
  const targetSections = fullDocumentB.sections || [];
  const targetNormTitles = targetSections.map(s => normalizeTitle(s.title));
  // Debug logging for 156.330 in target sections
  let comparisonResults = [];
  let matchedTargetIds = new Set();

  // For LLM diff
  const { completionsClient } = state;
  async function analyzeContentDifference(sourceContent, targetContent) {
    if (!completionsClient) return '';
    const prompt = `Compare the following two sections for substantive differences. If they are equivalent, say so. Otherwise, summarize the key differences.\n\nSection A:\n${sourceContent}\n\nSection B:\n${targetContent}`;
    try {
      const completion = await completionsClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a compliance expert. Compare two regulatory text sections for substantive differences.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_completion_tokens: 400
      });
      return completion.choices[0]?.message?.content?.trim() || '';
    } catch (e) {
      return `Error analyzing difference: ${e.message}`;
    }
  }

  for (const sourceSection of sourceSections) {
    const sourceNorm = normalizeTitle(sourceSection.title);

    // Try exact match first
    let matchIdx = targetNormTitles.indexOf(sourceNorm);
    // If not found, try fuzzy match
    if (matchIdx === -1) {
      matchIdx = fuzzyMatchTitle(sourceNorm, targetNormTitles);
    }
    let targetSection = matchIdx !== -1 ? targetSections[matchIdx] : null;
    // If still not found, try content-based match (first 100 chars)
    if (!targetSection && sourceSection.content) {
      const sourceContentStart = (sourceSection.content || '').substring(0, 100).replace(/\s+/g, ' ').toLowerCase();
      for (let i = 0; i < targetSections.length; i++) {
        const tContentStart = (targetSections[i].content || '').substring(0, 100).replace(/\s+/g, ' ').toLowerCase();
        if (sourceContentStart && tContentStart && sourceContentStart === tContentStart) {
          targetSection = targetSections[i];
          break;
        }
      }
    }
    // Compose summaries (first 150 chars of content if no summary)
    const sourceSummary = sourceSection.summary || (sourceSection.content ? sourceSection.content.substring(0, 150) : '');
    const targetSummary = targetSection && (targetSection.summary || (targetSection.content ? targetSection.content.substring(0, 150) : ''));
    if (targetSection) {
      // Normalized content comparison
      const normSourceContent = (sourceSection.content || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const normTargetContent = (targetSection.content || '').replace(/\s+/g, ' ').trim().toLowerCase();
      // Simple fuzzy: Jaccard on word sets
      const sWords = new Set(normSourceContent.split(' '));
      const tWords = new Set(normTargetContent.split(' '));
      const intersection = new Set([...sWords].filter(x => tWords.has(x)));
      const union = new Set([...sWords, ...tWords]);
      const contentScore = union.size > 0 ? intersection.size / union.size : 0;
      let llmDiff = '';
      if (contentScore < 0.85) {
        // Not a close fuzzy match, use LLM to analyze difference
        llmDiff = await analyzeContentDifference(sourceSection.content, targetSection.content);
      }
      comparisonResults.push({
        category: "also-in-target",
        sourceTitle: sourceSection.title,
        targetTitle: targetSection.title,
        sourceContent: sourceSection.content,
        targetContent: targetSection.content,
        sourceId: sourceSection.id,
        targetId: targetSection.id,
        sourcePage: sourceSection.page,
        targetPage: targetSection.page,
        sourceSummary,
        targetSummary,
        llmDiff
      });
      matchedTargetIds.add(targetSection.id);
    } else {
      comparisonResults.push({
        category: "only-in-source",
        sourceTitle: sourceSection.title,
        sourceContent: sourceSection.content,
        sourceId: sourceSection.id,
        sourcePage: sourceSection.page,
        sourceSummary
      });
    }
  }

  // Pass 2: For each unmatched target section, mark as new-in-target
  for (let i = 0; i < targetSections.length; i++) {
    const targetSection = targetSections[i];
    if (!matchedTargetIds.has(targetSection.id)) {
      const targetSummary = targetSection.summary || (targetSection.content ? targetSection.content.substring(0, 150) : '');
      comparisonResults.push({
        category: "new-in-target",
        targetTitle: targetSection.title,
        targetContent: targetSection.content,
        targetId: targetSection.id,
        targetPage: targetSection.page,
        targetSummary
      });
    }
  }

  // Optionally, add LLM summarization/difference analysis only for ambiguous or unmatched cases

  const analysisTime = Date.now() - startTime;

  progressResponse = progressResponse
    .replace("⏳ Comparing documents hierarchically...", "✓ Comparing documents hierarchically...")
    .replace("⏳ Consolidating document topics...", "✓ Consolidating document topics...");

  const nextStageLabel = "⏳ Generating comparison spreadsheet...";
  if (!progressResponse.includes(nextStageLabel)) {
    progressResponse += `${nextStageLabel}\n\n---\n`;
  }

  progressResponse += `\n✓ Comparison complete in ${analysisTime}ms.`;

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
