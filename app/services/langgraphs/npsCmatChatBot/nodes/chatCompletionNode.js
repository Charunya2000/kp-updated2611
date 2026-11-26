'use server';


import { chatCompletion } from "@/app/services/chatCompletionService2.js";

import { connectToDatabase } from '@/db/connection';

let analyticsTemplate = ''


async function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}




// CONVERSATION HISTORY — stores complete conversation per session
// ═══════════════════════════════════════════════════════════════════

async function saveConversationToHistory(sessionId, nuid, userPrompt, assistantContent, intentType, metadata) {
  try {
    if (!sessionId) {
      console.warn('[saveConversationToHistory] No sessionId provided — skipping save');
      return;
    }

    const db = await connectToDatabase('team-npscmat-db');
    const collection = db.collection('NPSCMAT_CHAT_HISTORY');

    const turnDoc = {
      role_user: userPrompt || '',
      role_assistant: assistantContent || '',
      intentType: intentType || 'unknown',
      timestamp: new Date(),
      metadata: {
        subType: metadata?.subType || null,
        dateRange: metadata?.dateRange || null,
        recordCount: metadata?.recordCount || 0,
        slaComplianceRate: metadata?.slaComplianceRate || null,
        tokensUsed: metadata?.tokensUsed || null,
      }
    };

    // Upsert: find existing session doc, push new turn to conversation array
    await collection.updateOne(
      { sessionId, type: 'chat_session' },
      {
        $set: {
          sessionId,
          type: 'chat_session',
          nuid: nuid || 'unknown',
          updatedAt: new Date(),
          lastIntentType: intentType || 'unknown',
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
        $push: {
          conversation: turnDoc
        }
      },
      { upsert: true }
    );

    console.log(`[saveConversationToHistory] Saved turn for session ${sessionId}`);
  } catch (error) {
    console.error('[saveConversationToHistory] Error saving conversation:', error.message);
    // Non-blocking — don't fail the main flow
  }
}

/**
 * Retrieve conversation history for a session to provide context
 */
async function getConversationHistory(sessionId, maxTurns = 5) {
  try {
    if (!sessionId) return [];

    const db = await connectToDatabase('team-npscmat-db');
    const collection = db.collection('NPSCMAT_CHAT_HISTORY');

    const sessionDoc = await collection.findOne(
      { sessionId, type: 'chat_session' },
      { projection: { conversation: { $slice: -maxTurns } } }
    );

    if (!sessionDoc || !sessionDoc.conversation) return [];

    // Convert stored conversation into messages format
    const messages = [];
    sessionDoc.conversation.forEach(turn => {
      if (turn.role_user) {
        messages.push({ role: 'user', content: turn.role_user });
      }
      if (turn.role_assistant) {
        messages.push({ role: 'assistant', content: turn.role_assistant });
      }
    });

    return messages;
  } catch (error) {
    console.error('[getConversationHistory] Error:', error.message);
    return [];
  }
}






/* CHAT COMPLETION NODE */
export const chatCompletionNode = async (state) => {
  try {
    const TOKEN_LIMIT = 6000;
    let newSummary;
    let recentmessages = state.messages;
    const userMessage = state.messages[state.messages.length - 1];
    const intentType = state.structuredMemory?.activeDomain || 'INCIDENT';
    let profileKey = state.intentRaw
    let context = "";
    let dbSystemTemplate = '';
    let incidentSearchSystemTemplate = ''
    analyticsTemplate = ''


    console.log(`\n--- DEBUG CHAT COMPLETION ---\n\nDetected Intent Type: ${intentType} \n\n Raw Intent: ${state.intent?.raw || 'N/A'}`);

    /* ========== ROUTING LOGIC ========== */

    console.log(`Routing to profile: ${profileKey} (${intentType} FLOW)`);

    /* ========== BUILD MESSAGES ========== */

    let messages;

    // For all other intents: use config-based prompt profiles
    const promptProfiles = state.config?.promptProfiles || {};
    const selectedProfile = promptProfiles[profileKey] || promptProfiles['default'];

    const systemMessageRaw = selectedProfile?.systemMessage;
    const userMessageRaw = selectedProfile?.userMessage;

    const userQuestion = state.userPrompt || "";

    let systemContent = (typeof systemMessageRaw === 'string' ? systemMessageRaw : systemMessageRaw?.content) || "";
    let userContent = (typeof userMessageRaw === 'string' ? userMessageRaw : userMessageRaw?.content) || "";

    systemContent = systemContent
      .replace(/{context}/g, context || "")
      .replace(/{question}/g, userQuestion)


    userContent = userContent
      .replace(/{context}/g, context || "")
      .replace(/{question}/g, userQuestion);

    messages = [
      { role: "system", content: systemContent },
      { role: "user", content: userContent }
    ];

    messages = [

      {
        role: "system",
        content: systemContent
      }, { role: "user", content: userContent },
      //...(state.summary ? [{ role: "system", content: `Conversation summary:\n${state.summary}` }] : []),
      ...state.messages.slice(-2),

    ];






    let mainResponse = '';


    let temperature = state.config?.chatCompletion?.temperature || 0.4;
    let maxTokens = state.config?.chatCompletion?.max_tokens || 6000;


    // Make the main chat completion request
    const completionConfig = {
      temperature: temperature || 0.7,
      max_tokens: maxTokens || 1000,
      model: "gpt-4o",
      messages: messages,
      teamName: state?.teamName,
      assistantName: state?.assistantName,
      nuid: state?.nuid
    };

    // Extract the main response
    mainResponse = await chatCompletion(completionConfig);



    const assistantMessage = {
      role: "assistant",
      content: mainResponse
    };

    // Estimate tokens of this exchange
    const newTokens =
      await estimateTokens(userMessage.content) +
      await estimateTokens(mainResponse);

    const updatedTokenCount = state.tokenCount + newTokens;
    if (updatedTokenCount >= 1000) {
      const messagelength = recentmessages.length;
      recentmessages = recentmessages.slice(0, -messagelength + 1);
      const conversationText = state.messages.slice(-2)
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n");

      //   const summaryPrompt = `
      // Summarize this entire conversation in 3-4 concise sentences.
      // Preserve:
      // - Important identifiers
      // - Decisions made
      // - Context needed for follow-up
      // `;

      //   const messages = [
      //     { role: "system", content: summaryPrompt },
      //     { role: "user", content: conversationText },
      //   ];

      //  messages = [
      //       { role: "system", content: 'Summarize each conversation briefly.' },
      //      ...state.messages,assistantMessage
      //     ];
      // let responseSummary = await client.chat.completions.create({
      //      model: "gpt-4o",
      //      temperature: 0.7,
      //      max_tokens: 3000,
      //      messages: messages
      //    });
      //   let  summaryLLM = responseSummary.choices[0].message.content;

      // newSummary = state.summary
      //   ? state.summary + " " + summaryLLM
      //   : summaryLLM;
      //print(summaryLLM)
    }
    //  print(summaryLLM)


    // console.log("--- END DEBUG ---");
    // ── Save complete conversation turn to MongoDB ──────────────
    await saveConversationToHistory(
      state.sessionID, state.nuid, state.userPrompt, mainResponse, state.intentRaw,
      {
        subType: state.scorecardMetaData?.subType || null,
        dateRange: state.scorecardMetaData?.dateRange || null,
        recordCount: state.scorecardMetaData?.recordCount || state.databaseMetadata?.recordCount || 0,
        slaComplianceRate: state.scorecardMetaData?.analytics?.slaComplianceRate || null,
        tokensUsed: newTokens || null,
      }
    );

    return {
      ...state,
      //  messages: [recentmessages, assistantMessage],

      messages: [...state.messages.slice(-2), assistantMessage],
      // summary:[...state.summary,newSummary],
      tokenCount: updatedTokenCount,
      chatResponse: {
        content: mainResponse,
        timestamp: new Date().toISOString(),
        metadata: {
          intentType: intentType,
          profileUsed: profileKey,
          kbCount: state.searchResults?.items?.length || 0,


        },

      },
      chatSuccess: true
    };

  } catch (error) {
    console.error('Error in chatCompletionNode:', error);
    return {
      ...state,
      chatResponse: {
        content: `Error: ${error.message}`,
        timestamp: new Date().toISOString()
      },
      chatSuccess: false
    };
  }
};