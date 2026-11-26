'use server';

import { NextResponse } from 'next/server';
import { getServerSession } from '@utils/getSession';
import { startDbaAssistantJob } from '@/app/services/dbaAssistantJobService';
import { selectSmartNote } from '@/app/services/smartNoteService';
import { submitPrompt } from '@/app/services/submitPromptService2';
import { bcsChatBotGraphStream } from '@/app/services/langgraphs/bcsChatBot/bcsChatbotService.js';
import { bcsChatBotGraphStream as bcsChatBotGraphStream2 } from '@/app/services/langgraphs/bcsChatBot/bcsChatbotService2.js';
import { selectPersona } from '@/app/services/personaService';
import { GraphExecutor } from '@/app/[teamName]/graph-builder/services/execution/graphExecutor.js';
import { getGraphById } from '@/app/services/graphConfigurationService';
import { recordLLMInteraction } from '@/app/services/statisticsService';
import { getFeatureFlag } from '@/app/services/featureFlagService';
import { runProdSupportGraph } from '@/app/services/langgraphs/prodSupport/prodSupportAssistantGraphService.js';
import { runProdSupportToolGraph } from '@/app/services/langgraphs/prodSupport/prodSupportToolsGraphService.js';

const PERSONAS_FOR_SPECIAL_ASSISTANTS = {
  scheduletopay: [
    {
      id: 'scheduletopay-Architecture',
      name: 'Architecture',
      prompt: 'You are an architect, helping development teams with technical design and work within an Agile software delivery life cycle.',
      enabled: true,
      // personasAssociatedGraph: 'Alternate scheduletopay Graph'
    },
    {
      id: 'scheduletopay-DBA',
      name: 'DBA',
      prompt: '',
      enabled: true,
      personasAssociatedGraph: 'DBA'
    },
    {
      id: 'scheduletopay-Testing',
      name: 'Testing',
      prompt: 'You are a tester and your job is to create test cases and automated tests working within an Agile software delivery life cycle.',
      enabled: true
      // personasAssociatedGraph: 'Alternate scheduletopay Graph'
    },
    {
      id: 'scheduletopay-ChangeRequest',
      name: 'Change Request',
      prompt: '',
      enabled: true
      // personasAssociatedGraph: 'Alternate scheduletopay Graph'
    }
  ],
  bcschatbot: [
    {
      id: 'bcschatbot-DevelopmentIteration',
      name: 'Development Iteration',
      prompt: '',
      enabled: true
      // personasAssociatedGraph: 'Alternate bcs Graph'
    }
  ],
};

export async function POST(req, { params }) {
  try {
    // params is a plain object (do not await)
    const { teamName, assistantName, smartNoteId } = await params;

    const { sources, chatInteraction } = await req.json();
    const { nuid } = await getServerSession();

    const query = { type: 'SmartNote', parentId: { $exists: true }, id: smartNoteId };
    const smartNote = await selectSmartNote(query, teamName);

    // load persona record to determine associatedGraph
    let personaAssociatedGraph = '';
    let name = '';
    let prompt = '';
    let graphConfig = null;
    const currentAssistantName = smartNote?.selectedUserAssistant || assistantName;

    if (sources.length > 0) {
      const sourceCount = sources?.length || 0;

      let params = {
        requestTokens: 0,
        responseTokens: 0,
        sourcesCount: sourceCount,
        selectedSources: sources
      }
      recordLLMInteraction(nuid, null, teamName, currentAssistantName, params)
    }
    if (smartNote?.persona) {
      // 1) try DB record
      try {
        const personaRecord = await selectPersona({
          assistantName: currentAssistantName,
          name: smartNote.persona,
          enabled: true
        }, teamName);
        personaAssociatedGraph = (personaRecord?.associatedGraph ?? '').toString();
      } catch (err) {
        console.warn('Could not load persona record for associatedGraph', err);
      }

      // 2) fallback to in-memory list if DB had no associatedGraph or record missing
      if (!personaAssociatedGraph) {
        const candidates = PERSONAS_FOR_SPECIAL_ASSISTANTS[currentAssistantName] || [];
        const match = candidates.find(p => {
          const target = smartNote.persona?.toString().toLowerCase();
          return !!(
            (p.name && p.name.toString().toLowerCase() === target)
            || (p.id && p.id.toString().toLowerCase() === target)
          );
        });
        if (match) {
          // prefer explicit associatedGraph on the fallback entry, otherwise use name or id
          personaAssociatedGraph = (match.associatedGraph ?? match.name ?? match.id ?? '').toString();
          // also expose name and prompt from the fallback match
          name = (match.name ?? '').toString();
          prompt = (match.prompt ?? '').toString();
        }
      } else {
        graphConfig = await getGraphById(personaAssociatedGraph, teamName);
      }
    }

    let stream;
    // Test custom graph execution
    if (graphConfig) {
      stream = await runCustomGraph(graphConfig, chatInteraction);
    } else if (smartNote && smartNote.selectedUserAssistant === 'bcschatbot') {
      const persona = smartNote.persona;
      // Use the BCS Chat Bot graph 
      if (persona === 'Development Iteration') {
        stream = await bcsChatBotGraphStream2({
          teamName,
          assistantName,
          userMessage: chatInteraction.prompt,
          sessionId: '12345',
          metadata: {
            nuid,
            smartNoteId,
            sources
          }
        });
      } else {
        stream = await bcsChatBotGraphStream({
          teamName,
          assistantName,
          userMessage: chatInteraction.prompt,
          metadata: {
            nuid,
            smartNoteId,
            sources
          }
        });
      }
      // await personaAssociatedGraph
    } else if (smartNote && smartNote.selectedUserAssistant === 'npschatbot') {
      stream = await bcsChatBotGraphStream2({
        teamName,
        assistantName,
        userMessage: chatInteraction.prompt,
        sessionId: '12345',
        metadata: {
          nuid,
          smartNoteId,
          sources
        }
      });
    } else if (
      smartNote &&
      smartNote?.persona?.toString().toLowerCase() === 'dba' &&
      personaAssociatedGraph?.toString().toLowerCase() === 'dba'
    ) {
      // The DBA graph is long running, so it is processed as a background job the client polls
      const { backgroundJobId } = await startDbaAssistantJob({
        nuid,
        teamName,
        assistantName,
        smartNoteId,
        chatInteractionId: chatInteraction.id,
        userPrompt: chatInteraction.prompt
      });

      return NextResponse.json({ backgroundJobId }, { status: 202 });
    } else if (smartNote && smartNote.selectedUserAssistant === 'prod-support') {
      const useProdSupportToolGraph = await getFeatureFlag('use-prod-support-tool-graph');
      if (useProdSupportToolGraph && useProdSupportToolGraph.enabled) {
        stream = await runProdSupportToolGraph({
          nuid,
          smartNoteId,
          sources,
          chatInteraction,
          teamName,
          assistantName
        });
      } else {
        stream = await runProdSupportGraph({
          nuid,
          smartNoteId,
          sources,
          chatInteraction,
          teamName,
          assistantName
        });
      }
    } else {
      // Use the regular prompt service as fallback
      stream = await submitPrompt({
        nuid,
        smartNoteId,
        sources,
        chatInteraction,
        teamName,
        assistantName
      });
    }

    // Ensure only the markdown response and suggested prompts are returned
    return new NextResponse(stream, {
      headers: { 'Content-Type': 'text/event-stream' }
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function runCustomGraph(graph, chatInteraction) {
  console.log('Starting custom graph execution...');

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        console.log('Executing graph with nodes:', graph.nodes?.map(n => `${n.id}(${n.type})`) || 'No nodes found');
        console.log('Graph info:', { id: graph.id, name: graph.name, version: graph.version });

        // Create a GraphExecutor instance for this specific graph
        const executor = new GraphExecutor(graph);

        // Execute the graph with streaming support
        const result = await executor.executeGraph({
          prompt: chatInteraction.prompt,
          streaming: true,
          onToken: (token) => {
            // Stream each token as it's generated
            console.log('Streaming token:', token.substring(0, 50) + (token.length > 50 ? '...' : ''));
            controller.enqueue(encoder.encode(token));
          }
        });

        console.log('Graph execution result:', result.success ? 'Success' : 'Failed');
        console.log('Execution details:', {
          nodeCount: result.nodeCount,
          hadStreamingOutput: result.hadStreamingOutput,
          finalResultsCount: result.finalResults?.length || 0
        });

        // If execution failed, send error message
        if (!result.success) {
          const errorMessage = `Graph execution failed: ${result.error}`;
          console.error(errorMessage);
          controller.enqueue(encoder.encode(errorMessage));
        } else {
          // Send final results if available and no streaming occurred
          if (result.finalResults && result.finalResults.length > 0 && !result.hadStreamingOutput) {
            const finalOutput = result.finalResults[0]?.output?.formatted_output ||
              result.finalResults[0]?.output?.response ||
              'Graph completed successfully';
            console.log('Sending final output (no streaming occurred):', finalOutput.substring(0, 100) + '...');
            controller.enqueue(encoder.encode(finalOutput));
          } else if (result.hadStreamingOutput) {
            console.log('Streaming output was sent during execution');
          } else {
            console.log('No final output available');
            controller.enqueue(encoder.encode('Graph execution completed but no output was generated.'));
          }
        }

        // Close the stream
        controller.close();
      } catch (error) {
        console.error('Error executing custom graph:', error);
        const errorMessage = `Error: ${error.message}`;
        controller.enqueue(encoder.encode(errorMessage));
        controller.close();
      }
    }
  });

  return stream;
}