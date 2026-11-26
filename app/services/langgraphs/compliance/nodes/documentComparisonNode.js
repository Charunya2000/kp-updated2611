// documentComparisonNode.js

export const documentComparisonNode = async (state) => {
  const { fullDocumentA, fullDocumentB, completionsClient, configDocuments } = state;

  if (!fullDocumentA || !fullDocumentB) {
    console.error(`❌ [documentComparisonNode] Missing document data`);
    return {
      ...state,
      documentDifferences: { error: "Missing document data for comparison" }
    };
  }

  const startTime = Date.now();

  // Get configuration for document comparison
  const comparisonPromptDoc = configDocuments.find(doc =>
    doc.purpose === "DocumentComparisonConfig" && doc.title === "Document Comparison Analysis Prompt"
  );
  const systemMessageDoc = configDocuments.find(doc =>
    doc.purpose === "DocumentComparisonConfig" && doc.title === "Document Comparison System Message"
  );

  const defaultPrompt = `
    Perform a comprehensive comparison of these two documents. Analyze:
    
    1. STRUCTURAL DIFFERENCES:
       - Document organization and section hierarchy
       - Missing or additional sections in each document
       - Different section ordering or numbering
    
    2. CONTENT DIFFERENCES:
       - Text that appears in one document but not the other
       - Modified text between documents
       - Different terminology or phrasing
    
    3. COVERAGE ANALYSIS:
       - Topics covered in Document A but not Document B
       - Topics covered in Document B but not Document A
       - Overlapping content areas
    
    Document A: "${fullDocumentA.title}"
    Total sections: ${fullDocumentA.totalSections}
    
    Document B: "${fullDocumentB.title}"
    Total sections: ${fullDocumentB.totalSections}
    
    Provide detailed analysis with specific examples and section references.
  `;

  const defaultSystemMessage = `
    You are a document comparison expert. Analyze the provided documents thoroughly and identify all significant differences.
    Focus on structural, content, and coverage differences. Provide specific examples and clear categorization.
    Format your response with clear headings and bullet points for easy readability.
  `;

  const promptTemplate = comparisonPromptDoc?.documentText || defaultPrompt;
  const systemMessage = systemMessageDoc?.documentText || defaultSystemMessage;

  // Prepare document content for analysis
  const prepareDocumentForAnalysis = (doc) => {
    if (!doc || !doc.sections) return "No content available";

    return doc.sections.map((section, index) => {
      const levelIndent = '  '.repeat(section.level || 0);
      return `${levelIndent}[Page ${section.page || 'N/A'}] ${section.title || 'Untitled'}: ${(section.content || '').substring(0, 200)}${section.content?.length > 200 ? '...' : ''}`;
    }).join('\n');
  };

  const docAContent = prepareDocumentForAnalysis(fullDocumentA);
  const docBContent = prepareDocumentForAnalysis(fullDocumentB);

  // Utility: Strip section numbers and irrelevant prefixes from titles
  function cleanTitle(title) {
    let t = (title || '').toLowerCase().trim();
    // Remove leading chapter/section/part numbers and colons
    t = t.replace(/^(chapter|section|part)\s*\d+\s*:?\s*/i, '');
    // Remove leading numbers/dots
    t = t.replace(/^([\d.]+)\s*/, '');
    return t.trim();
  }

  // Utility: Jaccard similarity
  function jaccard(a, b) {
    const setA = new Set(a.split(/\s+/));
    const setB = new Set(b.split(/\s+/));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
  }

  // Utility: Levenshtein distance
  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a || !b) return Math.max(a?.length || 0, b?.length || 0);
    const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[a.length][b.length];
  }

  // Fuzzy match sections from A to B
  const maxSections = 50;
  const sectionsA = fullDocumentA.sections || [];
  const sectionsB = fullDocumentB.sections || [];
  let matchedPairs = [];
  let usedB = new Set();
  // Batch size for parallel processing
  const batchSize = 10;
  // Cleaned titles for B
  const cleanedTitlesB = sectionsB.map(s => cleanTitle(s.title));

  async function matchBatch(batchA) {
    return await Promise.all(batchA.map(sectionA => {
      const cleanedA = cleanTitle(sectionA.title);
      // Pre-filter candidates by title length (±20%)
      const lenA = cleanedA.length;
      const candidates = sectionsB
        .map((sectionB, idx) => ({ sectionB, idx, cleanedB: cleanedTitlesB[idx] }))
        .filter(({ cleanedB, idx }) => {
          if (usedB.has(idx)) return false;
          const lenB = cleanedB.length;
          return lenB >= lenA * 0.8 && lenB <= lenA * 1.2;
        });
      // Compute Jaccard similarity for candidates
      const jaccardScores = candidates.map(({ sectionB, idx, cleanedB }) => ({
        idx,
        sectionB,
        score: jaccard(cleanedA, cleanedB)
      }));
      // Keep top 3 candidates by Jaccard
      const topCandidates = jaccardScores.sort((a, b) => b.score - a.score).slice(0, 3);
      // Run Levenshtein on top candidates
      let bestMatchIdx = -1;
      let bestScore = Infinity;
      let bestSectionB = null;
      for (const candidate of topCandidates) {
        const levScore = levenshtein(cleanedA, candidate.sectionB.title ? cleanTitle(candidate.sectionB.title) : '');
        if (levScore < bestScore) {
          bestScore = levScore;
          bestMatchIdx = candidate.idx;
          bestSectionB = candidate.sectionB;
        }
      }
      // Accept match if Levenshtein score is reasonable
      if (bestMatchIdx !== -1 && bestScore <= Math.max(cleanedA.length, bestSectionB?.title?.length || 0) * 0.4) {
        usedB.add(bestMatchIdx);
        return { sectionA, sectionB: bestSectionB, score: bestScore };
      } else {
        return { sectionA, sectionB: null, score: null };
      }
    }));
  }

  // Process in batches
  for (let i = 0; i < Math.min(sectionsA.length, maxSections); i += batchSize) {
    const batchA = sectionsA.slice(i, i + batchSize);
    const batchMatches = await matchBatch(batchA);
    matchedPairs.push(...batchMatches);
  }

  // Batched LLM comparison for matched pairs
  let sectionComparisons = [];
  for (let idx = 0; idx < matchedPairs.length; idx++) {
    const { sectionA, sectionB } = matchedPairs[idx];
    let prompt;
    if (sectionB) {
      prompt = `Compare the following sections from two documents. Highlight any differences, changes in meaning, or compliance impact.\n\nSection from Document A:\nTitle: ${sectionA.title}\nContent: ${(sectionA.content || '').substring(0, 1000)}\n\nSection from Document B:\nTitle: ${sectionB.title}\nContent: ${(sectionB.content || '').substring(0, 1000)}\n`;
    } else {
      prompt = `Section from Document A has no corresponding section in Document B (based on fuzzy title matching).\n\nSection from Document A:\nTitle: ${sectionA.title}\nContent: ${(sectionA.content || '').substring(0, 1000)}\n`;
    }
    try {
      const completion = await completionsClient.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a compliance expert. Compare the two sections and call out any differences." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_completion_tokens: 1000
      });
      const analysis = completion.choices[0]?.message?.content?.trim() || "";
      sectionComparisons.push({
        sectionA: sectionA.title,
        sectionB: sectionB?.title || null,
        analysis
      });
    } catch (error) {
      sectionComparisons.push({
        sectionA: sectionA.title,
        sectionB: sectionB?.title || null,
        analysis: `Error: ${error.message}`
      });
    }
  }
  // Aggregate section analyses
  let comparisonAnalysis = sectionComparisons.map((sc, idx) => `Section ${idx + 1}:\n${sc.analysis}`).join('\n\n');

  // Fuzzy structural and coverage analysis
  let structuredDifferences = {
    structural: [],
    content: [],
    coverage: [],
    statistics: {
      documentA: {
        title: fullDocumentA.title,
        totalSections: fullDocumentA.totalSections,
        totalContentLength: fullDocumentA.totalContentLength
      },
      documentB: {
        title: fullDocumentB.title,
        totalSections: fullDocumentB.totalSections,
        totalContentLength: fullDocumentB.totalContentLength
      }
    }
  };
  try {
    // Titles for fuzzy matching
    const titlesA = sectionsA.map(s => s.title?.toLowerCase().trim()).filter(Boolean);
    const titlesB = sectionsB.map(s => s.title?.toLowerCase().trim()).filter(Boolean);
    // Find fuzzy matches and missing sections
    let missingInB = [];
    let missingInA = [];
    let matchedTitles = [];
    let usedB = new Set();
    for (let i = 0; i < titlesA.length; i++) {
      let bestMatchIdx = -1;
      let bestScore = Infinity;
      for (let j = 0; j < titlesB.length; j++) {
        if (usedB.has(j)) continue;
        const score = levenshtein(titlesA[i], titlesB[j]);
        if (score < bestScore) {
          bestScore = score;
          bestMatchIdx = j;
        }
      }
      if (bestMatchIdx !== -1 && bestScore <= Math.max(titlesA[i].length, titlesB[bestMatchIdx].length) * 0.4) {
        matchedTitles.push(titlesA[i]);
        usedB.add(bestMatchIdx);
      } else {
        missingInB.push(titlesA[i]);
      }
    }
    for (let j = 0; j < titlesB.length; j++) {
      if (!usedB.has(j)) {
        missingInA.push(titlesB[j]);
      }
    }
    structuredDifferences.structural = [
      ...missingInB.map(title => ({ type: 'missing_in_b', title, document: 'A' })),
      ...missingInA.map(title => ({ type: 'missing_in_a', title, document: 'B' }))
    ];
    structuredDifferences.coverage = {
      fuzzyMatchedSections: matchedTitles.length,
      uniqueToA: missingInB.length,
      uniqueToB: missingInA.length,
      totalSectionsA: titlesA.length,
      totalSectionsB: titlesB.length,
      overlapPercentage: matchedTitles.length > 0 ? ((matchedTitles.length / Math.max(titlesA.length, titlesB.length)) * 100).toFixed(1) : 0
    };
  } catch (error) {
    console.error(`❌ [documentComparisonNode] Fuzzy programmatic analysis failed:`, error);
  }

  const analysisTime = Date.now() - startTime;

  return {
    ...state,
    documentDifferences: {
      analysis: comparisonAnalysis,
      structured: structuredDifferences,
      timestamp: new Date().toISOString(),
      processingTime: analysisTime
    }
  };
};