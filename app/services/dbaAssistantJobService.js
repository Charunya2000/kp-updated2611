import { createJob, updateJob } from '@/app/services/backgroundJobService';
import { dbaAssistantGraphBackground } from '@/app/services/dbaAssistantGraphService';
import { jobStatus } from '@utils/constants';

const INITIAL_MESSAGE = 'Hold on while I process your query...';

function buildMessage(content) {
    return [{ content, timestamp: new Date().toISOString() }];
}

export async function startDbaAssistantJob({ nuid, teamName, assistantName, smartNoteId, chatInteractionId, userPrompt }) {
    const backgroundJob = await createJob(teamName, `UserPrompt_${smartNoteId}`, {
        assistantName,
        status: jobStatus.PROCESSING,
        parentId: chatInteractionId,
        smartNoteId,
        teamName,
        nuid,
        messages: buildMessage(INITIAL_MESSAGE),
    });

    if (!backgroundJob) {
        throw new Error('Failed to create background job for the DBA assistant');
    }

    console.log(JSON.stringify({
        kpmsg: {
            id: 'AI_PORTAL_NOTEBOOK',
            name: 'startDbaAssistantJob',
            detail: { nuid, teamName, assistantName, smartNoteId, backgroundJobId: backgroundJob.id }
        }
    }));

    // Fire and forget - the graph runs after the response has been returned
    (async () => {
        try {
            const { answer, suggestedPrompts } = await dbaAssistantGraphBackground({
                nuid,
                userPrompt,
                teamName,
                assistantName,
                // Not awaited so a slow write never stalls the graph
                onProgress: (content) => {
                    updateJob(teamName, backgroundJob.id, { messages: buildMessage(content) })
                        .catch((error) => console.error(JSON.stringify({
                            kpmsg: {
                                id: 'AI_PORTAL_NOTEBOOK',
                                name: 'startDbaAssistantJobProgress',
                                detail: { nuid, backgroundJobId: backgroundJob.id, error: error.message }
                            }
                        })));
                }
            });

            await updateJob(teamName, backgroundJob.id, {
                status: jobStatus.COMPLETE,
                result: { answer, suggestedPrompts },
                messages: buildMessage(answer),
                completedAt: new Date().toISOString(),
            });

            console.log(JSON.stringify({
                kpmsg: {
                    id: 'AI_PORTAL_NOTEBOOK',
                    name: 'startDbaAssistantJobComplete',
                    detail: { nuid, teamName, backgroundJobId: backgroundJob.id }
                }
            }));
        } catch (error) {
            await updateJob(teamName, backgroundJob.id, {
                status: jobStatus.ERROR,
                lastError: error.message,
                messages: buildMessage('I encountered an error while generating your SQL query. Please try again or rephrase your request.'),
                completedAt: new Date().toISOString(),
            });

            console.error(JSON.stringify({
                kpmsg: {
                    id: 'AI_PORTAL_NOTEBOOK',
                    name: 'startDbaAssistantJobError',
                    detail: { nuid, teamName, backgroundJobId: backgroundJob.id, error: error.message }
                }
            }));
        }
    })();

    return { backgroundJobId: backgroundJob.id };
}
