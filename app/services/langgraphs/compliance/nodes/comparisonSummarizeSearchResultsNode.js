// comparisonSummarizeSearchResultsNode.js



const writeToFile = async (searchResults, filenamePrefix = "comparison-summary") => {
  // Write comparisonSummary to a file for debugging
  try {
    const fs = require('fs');
    const path = require('path');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${filenamePrefix}-${timestamp}.json`;
    const filePath = path.join(process.cwd(), fileName);
    fs.writeFileSync(filePath, JSON.stringify(searchResults, null, 2));
    console.log(`[comparisonSummarizeSearchResultsNode] Wrote searchResults to ${filePath}`);
  } catch (err) {
    console.warn(`[comparisonSummarizeSearchResultsNode] Failed to write searchResults: ${err.message}`);
  }
}


export const comparisonSummarizeSearchResultsNode = async (state) => {
  const { updateChatInteractionProgress } = await import('../helpers/progressTracking');

  let progressResponse = state.progressResponse || "## Comparison Progress\n\n";
  progressResponse += "⏳ Summarizing search results...\n\n---\n";

  // Update progress
  if (state.chatInteractionId) {
    await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
  }

  const { searchResultsA = [], searchResultsB = [], completionsClient, userPrompt, configDocuments } = state;

  // await writeToFile(searchResultsA, "search-results-a");
  // await writeToFile(searchResultsB, "search-results-b");

  let errorMessage = "";
  let comparisons = [];
  let summaryA = "";
  let summaryB = "";
  let analysis = "";

  // --- CFR Header Filtering (mitigation for CFR documents) ---
  function filterOutCFRHeaders(results) {
    const CFR_HEADER_PATTERNS = [
      'Dept. of Health and Human Services',
      'CFR Subtitle A',
      '45 CFR Subtitle A',
      'Pt. 156',
      /^page\s+\d+$/i,
      /^\d+\s*-\s*\d+\s*$/
    ];
    return results.filter(r => {
      const doc = r.document || r;
      const title = (doc.title || '').trim();
      const content = (doc.content || '').slice(0, 100).trim();
      const logOn = doc.id === "a0d0701d-b948-4347-93e9-98be845ecfe2";
      for (const pattern of CFR_HEADER_PATTERNS) {
        if (typeof pattern === 'string') {
          if (logOn) { console.log(`Checking pattern: "${pattern}" against title: "${title}"`); }
          if (title === pattern || title.startsWith(pattern)) {
            console.log(`🚫 [CFR Header Filter] Skipping: "${title}"`);
            return false;
          }
        } else if (pattern instanceof RegExp) {
          if (pattern.test(title) || pattern.test(content)) {
            console.log(`🚫 [CFR Header Filter] Skipping (regex): "${title}"`);
            return false;
          }
        }
      }
      return true;
    });
  }
  const filteredSearchResultsA = filterOutCFRHeaders(searchResultsA);
  const filteredSearchResultsB = filterOutCFRHeaders(searchResultsB);
  // Only keep the top result for each side for topic-based comparison
  const topResultA = filteredSearchResultsA.length > 0 ? [filteredSearchResultsA[0]] : [];
  const topResultB = filteredSearchResultsB.length > 0 ? [filteredSearchResultsB[0]] : [];
  // Extract raw content from the top search results for direct comparison (must be after topResultA/B are defined)
  const rawContentA = topResultA.length > 0 ? (topResultA[0].document ? topResultA[0].document.content : topResultA[0].content) : '';
  const rawContentB = topResultB.length > 0 ? (topResultB[0].document ? topResultB[0].document.content : topResultB[0].content) : '';
  // console.log(`[CFR Header Filter] Results A: ${searchResultsA.length} → ${filteredSearchResultsA.length}`);
  // console.log(`[CFR Header Filter] Results B: ${searchResultsB.length} → ${filteredSearchResultsB.length}`);
  // console.log(`[CFR Header Filter] Filtered A details:`, filteredSearchResultsA.map(r => ({ id: r.document?.id || r.id, title: (r.document || r).title })));
  // console.log(`[CFR Header Filter] Filtered B details:`, filteredSearchResultsB.map(r => ({ id: r.document?.id || r.id, title: (r.document || r).title })));

  // Get summarization prompt template and system message from config
  const summarizePromptDoc = configDocuments.find(doc => doc.purpose === "SummarizeConfig" && doc.title === "Document Comparison Summarize Prompt");
  const systemMessageDoc = configDocuments.find(doc => doc.purpose === "SummarizeConfig" && doc.title === "Document Comparison Summarize System Message");
  const chatCompletionDoc = configDocuments.find(doc => doc.purpose === "ChatCompletionConfig" && doc.title === "Document Comparison Summarize Chat Completion Config");

  const promptTemplate = summarizePromptDoc?.documentText || "Summarize the following extracted sections from ${docLabel} in the context of the user prompt: ${userPrompt}\n\n${summaryInput}";
  const systemMessage = systemMessageDoc?.documentText || "You are a compliance expert. Summarize findings for document: ${docLabel}.";
  let parsedConfig = { model: "gpt-4o", temperature: 0.5, max_tokens: 600 };

  if (chatCompletionDoc) {
    try {
      const jsonConfigMatch = chatCompletionDoc.documentText.match(/```jsonconfig\s*([\s\S]*?)\s*```/);
      if (jsonConfigMatch && jsonConfigMatch[1]) {
        parsedConfig = JSON.parse(jsonConfigMatch[1]);
      }
    } catch (e) {
      console.warn('[comparisonSummarizeSearchResultsNode] Error parsing chat completion config:', e.message);
    }
  }

  // For each doc A entry, aggregate and summarize all relevant doc B entries, then generate a difference analysis
  async function summarizeContent(label, entries) {
    if (!completionsClient) return "No completions client available.";
    if (!Array.isArray(entries) || entries.length === 0) return "No content available.";

    const summaryInput = entries.map(r => {
      // Handle both Cognitive Search format (r.document) and MongoDB format (flattened)
      const d = r.document || r;
      const title = d.title || '';
      const page = d.page || '';
      const level = d.level !== undefined ? d.level : '';
      const content = d.content || '';

      return `Title: ${title}\nPage: ${page}\nLevel: ${level}\nContent: ${content}`;
    }).join('\n---\n');

    // console.log(`[summarizeContent] ${label} - entries count: ${entries.length}`);
    // console.log(`[summarizeContent] ${label} - summaryInput length: ${summaryInput.length}`);
    // console.log(`[summarizeContent] ${label} - first 300 chars of summaryInput:\n${summaryInput.slice(0, 300)}`);

    // Debug: log first entry structure
    // if (entries.length > 0) {
    //   const firstEntry = entries[0];
    //   console.log(`[summarizeContent] ${label} - first entry structure:`, {
    //     hasDocument: !!firstEntry.document,
    //     hasTitle: !!(firstEntry.document?.title || firstEntry.title),
    //     hasContent: !!(firstEntry.document?.content || firstEntry.content),
    //     keys: Object.keys(firstEntry).slice(0, 10)
    //   });
    // }

    // Use a simple, direct summarization prompt - NOT comparative
    const directSummarizePrompt = `You are a compliance expert. Summarize the following content from ${label} in the context of the user's topic: "${userPrompt}"

Provide a clear, comprehensive summary of all the key points, requirements, and information found in the content below. Include specific details, section numbers, and requirements.

Content to summarize:
${summaryInput}

Summary:`;

    console.log(`[summarizeContent] ${label} - PROMPT being sent to GPT:\n${directSummarizePrompt.substring(0, 500)}...`);

    const completion = await completionsClient.chat.completions.create({
      model: parsedConfig.model || "gpt-4o",
      messages: [
        { role: "system", content: "You are a compliance expert. Provide comprehensive, detailed summaries of the content you receive. Include all relevant details, requirements, and information." },
        { role: "user", content: directSummarizePrompt }
      ],
      temperature: parsedConfig.temperature ?? 0.5,
      max_completion_tokens: parsedConfig.max_tokens ?? 800
    });
    return completion.choices[0]?.message?.content?.trim() || '';
  }

  async function analyzeDifference(summaryA, summaryB) {
    if (!completionsClient) return "No completions client available.";
    const diffPrompt = `User Prompt: ${userPrompt}

Document A Summary:
${summaryA}

Document B Summary:
${summaryB}

Instructions: Compare these two document summaries on the specific topic requested (${userPrompt}). For each topic/section mentioned:
1. If BOTH documents contain content on this topic, describe what each says and how they differ
2. If ONLY Document A contains content, state what Document A says
3. If ONLY Document B contains content, state what Document B says
4. Do NOT say "Not provided" if there is actual content present in either summary

Be specific about what content IS present in each document rather than focusing on absences.`;
    const completion = await completionsClient.chat.completions.create({
      model: parsedConfig.model || "gpt-4o",
      messages: [
        { role: "system", content: "You are a compliance expert. Compare the two document summaries on the specific topic requested. State what IS present in each document, not what is absent." },
        { role: "user", content: diffPrompt }
      ],
      temperature: parsedConfig.temperature ?? 0.5,
      max_completion_tokens: parsedConfig.max_tokens ?? 800
    });
    return completion.choices[0]?.message?.content?.trim() || '';
  }

  try {
    // console.log(`[comparisonSummarizeSearchResultsNode] Starting topic-based comparison`);
    // console.log(`  searchResultsA count: ${searchResultsA.length}`);
    // console.log(`  searchResultsB count: ${searchResultsB.length}`);


    const { writeFile } = await import('fs/promises');
    const { join } = await import('path');

    const outputDir = state.outputDir || process.cwd();
    const resultsAPath = join(outputDir, 'searchResultsA.json');
    const resultsBPath = join(outputDir, 'searchResultsB.json');

    // await writeFile(resultsAPath, JSON.stringify(searchResultsA, null, 2), 'utf8');
    // await writeFile(resultsBPath, JSON.stringify(searchResultsB, null, 2), 'utf8');

    // Mark A summary started
    progressResponse = progressResponse.replace("⏳ Summarizing", "Summarizing Document A");
    if (state.chatInteractionId) {
      await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
    }

    // For topic-based comparison: summarize ONLY the top result for each document
    summaryA = await summarizeContent('Document A', topResultA);

    // Mark B summary started
    progressResponse = progressResponse.replace("Summarizing Document A", "✓ Document A summarized\n⏳ Summarizing Document B");
    if (state.chatInteractionId) {
      await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
    }

    summaryB = await summarizeContent('Document B', topResultB);

    // Mark analysis started
    progressResponse = progressResponse.replace("⏳ Summarizing Document B", "✓ Document B summarized\n⏳ Analyzing differences");
    if (state.chatInteractionId) {
      await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
    }

    analysis = await analyzeDifference(rawContentA, rawContentB);

    // console.log(`[comparisonSummarizeSearchResultsNode] Generated summaries and analysis: ${summaryA}, ${summaryB}, ${analysis}`);
    // const summaryPath = join(outputDir, 'comparisonSummary.json');
    // await writeFile(
    //   summaryPath,
    //   JSON.stringify({ summaryA, summaryB, analysis }, null, 2),
    //   'utf8'
    // );
    // Mark complete
    progressResponse = progressResponse.replace("⏳ Analyzing differences", "✓ Analyzing differences");
    progressResponse += "⏳ Generating final response...\n\n---\n";
    if (state.chatInteractionId) {
      await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
    }

    comparisons.push({
      topic: userPrompt,
      docASummary: summaryA,
      docBSummary: summaryB,
      analysis
    });
  } catch (error) {
    console.error('❌ [comparisonSummarizeSearchResultsNode] Error during summarization:', error);
    errorMessage = `Error during summarization: ${error.message}`;
    progressResponse = progressResponse.replace(/⏳.*/, "❌ " + errorMessage);
    if (state.chatInteractionId) {
      await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
    }
  }

  // Return the single comparison as the summary for topic-based analysis
  return {
    ...state,
    comparisonSummary: {
      comparisons,
      summaryA,
      summaryB,
      analysis
    },
    rawContentA,
    rawContentB,
    errorMessage,
    progressResponse
  };
};