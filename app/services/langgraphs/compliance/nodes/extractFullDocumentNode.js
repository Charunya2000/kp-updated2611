// extractFullDocumentNode.js

import { promises as fs } from 'fs';
import path from 'path';
import { connectToDatabase } from "@/db/connection";

const SEARCH_RESULT_LOG_DIR = path.join(process.cwd(), 'logs', 'cognitive-search-results');

async function logCognitiveSearchResults(conversationId, documentLabel, results) {
  try {
    await fs.mkdir(SEARCH_RESULT_LOG_DIR, { recursive: true });
    const safeLabel = (documentLabel || 'unknown').toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const fileName = `${conversationId || 'unknown'}-${safeLabel}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filePath = path.join(SEARCH_RESULT_LOG_DIR, fileName);
    const payload = {
      conversationId,
      documentLabel,
      resultCount: Array.isArray(results) ? results.length : 0,
      results
    };
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    console.warn(`⚠️ [extractFullDocumentNode] Failed to log Cognitive Search results for ${documentLabel}: ${err.message}`);
  }
}

export const extractFullDocumentNode = async (state) => {
  const { updateChatInteractionProgress } = await import('../helpers/progressTracking');

  let progressResponse = state.progressResponse || "## Comparison Progress\n\n";
  progressResponse += "⏳ Extracting full documents...\n\n---\n";

  // Update progress
  if (state.chatInteractionId) {
    await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
  }

  const { geisingerConversationA, geisingerConversationB, searchClient } = state;

  // Extract full document content for both documents
  const extractDocument = async (conversation, documentLabel) => {
    if (!conversation?.id) {
      return null;
    }

    let cognitiveSearchResults = [];
    let mongoResults = [];

    // Get all content from Cognitive Search
    try {
      const searchResults = await searchClient.search('*', {
        filter: `smartnote_id eq '${conversation.id}'`,
        select: ["id", "content", "title", "page", "level", "smartnote_id"],
        top: 1000, // Get all chunks
        searchMode: 'all'
      });

      for await (const result of searchResults.results) {
        cognitiveSearchResults.push({
          id: result.document.id,
          content: result.document.content || '',
          title: result.document.title || '',
          page: result.document.page || 0,
          level: result.document.level || 0,
          source: 'CognitiveSearch'
        });
      }

      // await logCognitiveSearchResults(conversation.id, documentLabel, cognitiveSearchResults);
    } catch (error) {
      console.error(`❌ [extractFullDocumentNode] Cognitive Search error for ${documentLabel}:`, error);
    }

    // Get all content from MongoDB
    try {
      const db = await connectToDatabase();
      mongoResults = await db.collection("geisinger-docs")
        .find(
          { conversationId: conversation.id },
          {
            projection: {
              nuid: 1,
              title: 1,
              content: 1,
              level: 1,
              page: 1,
              conversationId: 1
            }
          }
        )
        .toArray();

      // Normalize MongoDB results to match Cognitive Search structure
      mongoResults = mongoResults.map(doc => ({
        id: doc.nuid || doc._id?.toString(),
        content: doc.content || '',
        title: doc.title || '',
        page: doc.page || 0,
        level: doc.level || 0,
        source: 'MongoDB'
      }));
    } catch (error) {
      console.error(`❌ [extractFullDocumentNode] MongoDB error for ${documentLabel}:`, error);
    }

    // Combine and deduplicate results
    const allResults = [...cognitiveSearchResults, ...mongoResults];
    const deduplicatedResults = [];
    const seenIds = new Set();

    for (const result of allResults) {
      if (result.id && !seenIds.has(result.id)) {
        seenIds.add(result.id);
        deduplicatedResults.push(result);
      }
    }

    // Sort by page and level for logical document structure
    deduplicatedResults.sort((a, b) => {
      if (a.page !== b.page) return (a.page || 0) - (b.page || 0);
      return (a.level || 0) - (b.level || 0);
    });

    return {
      conversationId: conversation.id,
      title: conversation.title || `Document ${documentLabel}`,
      sections: deduplicatedResults,
      totalSections: deduplicatedResults.length,
      totalContentLength: deduplicatedResults.reduce((sum, section) => sum + (section.content?.length || 0), 0)
    };
  };

  const startTime = Date.now();

  // Extract both documents in parallel
  const [fullDocumentA, fullDocumentB] = await Promise.all([
    extractDocument(geisingerConversationA, 'Document A'),
    extractDocument(geisingerConversationB, 'Document B')
  ]);

  const extractionTime = Date.now() - startTime;

  // Mark extraction complete
  progressResponse = progressResponse.replace("⏳ Extracting", "✓ Extracting");
  progressResponse += "⏳ Comparing documents hierarchically...\n\n---\n";
  if (state.chatInteractionId) {
    await updateChatInteractionProgress(state.teamName, state.chatId, state.chatInteractionId, progressResponse);
  }

  return {
    ...state,
    fullDocumentA,
    fullDocumentB,
    progressResponse
  };
};