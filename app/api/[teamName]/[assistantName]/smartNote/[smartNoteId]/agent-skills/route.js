'use server';

import { NextResponse } from 'next/server';
import { createJob, getJobById, updateJob } from '@/app/services/backgroundJobService';
import { getAgentSkills } from '@/app/services/agentSkillsService';
import { isTerminalStatus, normalizeStatus, withTimeout } from '@/app/services/agentSkillsRouteUtils';
import { listMemoryItems } from '@/app/services/memoryService';

const JOB_TYPE = 'AgentSkills';
const JOB_TIMEOUT_MS = Math.max(15_000, Number.parseInt(process.env.INFOSEARCH_AGENT_SKILLS_JOB_TIMEOUT_MS || '120000', 10));
const JOB_STATUS = Object.freeze({
  QUEUED: 'Queued',
  PROCESSING: 'Processing',
  COMPLETE: 'Complete',
  ERROR: 'Error'
});

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;
    let body = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const useMemoryContext = body.useMemoryContext !== false;
    const memoryContext = useMemoryContext
      ? await loadPinnedMemoryContext(teamName, smartNoteId)
      : [];

    const job = await createJob(teamName, JOB_TYPE, {
      status: JOB_STATUS.QUEUED,
      assistantName,
      smartNoteId,
      lastError: null,
      result: null,
      payload: sanitizeRequestPayload(body, memoryContext)
    });

    if (!job?.id) {
      throw new Error('Unable to create agent skills background job');
    }

    processAgentSkillsJob(teamName, job.id, {
      ...body,
      teamName,
      assistantName,
      smartNoteId,
      useMemoryContext,
      memoryContext
    }).catch((error) => {
      logAgentSkillsEvent('AgentSkillsJobAsyncError', { teamName, jobId: job.id, error: error.message });
    });

    logAgentSkillsEvent('AgentSkillsJobQueued', { teamName, jobId: job.id, smartNoteId });

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      normalizedStatus: normalizeStatus(job.status),
      isTerminal: false,
      pollAfterMs: 2500
    }, { status: 202 });
  } catch (error) {
    logAgentSkillsEvent('AgentSkillsJobQueueFailed', { error: error.message });
    return NextResponse.json({ error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}

export async function GET(req, { params }) {
  try {
    const { teamName } = await params;
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'jobId query parameter is required' }, { status: 400 });
    }

    const job = await getJobById(teamName, jobId);
    if (!job) {
      return NextResponse.json({ error: 'BackgroundJob not found' }, { status: 404 });
    }

    const normalizedStatus = normalizeStatus(job.status);
    return NextResponse.json({
      ...job,
      normalizedStatus,
      isTerminal: isTerminalStatus(normalizedStatus),
      pollAfterMs: normalizedStatus === 'processing' || normalizedStatus === 'queued' ? 2500 : 0
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}

function sanitizeRequestPayload(payload = {}, memoryContext = []) {
  const market = payload.market || payload.filters?.market || null;
  const region = payload.region || market || null;

  return {
    query: payload.query || '',
    userRole: payload.userRole || 'Seller',
    useMemoryContext: payload.useMemoryContext !== false,
    region,
    market,
    industry: payload.industry || null,
    filters: payload.filters || (market ? { market } : null),
    memoryContextCount: memoryContext.length,
    limitPerBucket: Number.isInteger(payload.limitPerBucket) && payload.limitPerBucket > 0
      ? payload.limitPerBucket
      : undefined
  };
}

async function loadPinnedMemoryContext(teamName, smartNoteId) {
  try {
    const memories = await listMemoryItems(teamName, smartNoteId, {
      scope: 'smartnote',
      includeExpired: false
    });

    return memories
      .filter((item) => item?.pinned)
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        key: item.key,
        value: item.value,
        memoryType: item.memoryType,
        scope: item.scope,
        confidence: item.confidence,
        sensitivity: item.sensitivity
      }));
  } catch (error) {
    logAgentSkillsEvent('AgentSkillsMemoryContextUnavailable', {
      teamName,
      smartNoteId,
      error: error.message
    });
    return [];
  }
}

async function processAgentSkillsJob(teamName, jobId, options) {
  try {
    await updateJob(teamName, jobId, {
      status: JOB_STATUS.PROCESSING,
      startedAt: new Date().toISOString()
    });

    const result = await withTimeout(
      getAgentSkills(options),
      JOB_TIMEOUT_MS,
      `Agent skills request exceeded ${JOB_TIMEOUT_MS}ms`
    );

    await updateJob(teamName, jobId, {
      status: JOB_STATUS.COMPLETE,
      completedAt: new Date().toISOString(),
      result
    });

    logAgentSkillsEvent('AgentSkillsJobCompleted', { teamName, jobId });
  } catch (error) {
    await updateJob(teamName, jobId, {
      status: JOB_STATUS.ERROR,
      completedAt: new Date().toISOString(),
      lastError: error?.message || 'Unexpected error'
    });

    logAgentSkillsEvent('AgentSkillsJobFailed', { teamName, jobId, error: error.message });
  }
}

function logAgentSkillsEvent(name, detail) {
  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name,
      detail
    }
  }));
}
