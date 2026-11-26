import axios from 'axios';
import FormData from 'form-data';
import { getServerSession } from '@utils/getSession';
import { createJob, updateJob } from '@/app/services/backgroundJobService';
import { jobStatus } from '@utils/constants';
import { getTeamMember } from '@/app/services/teamMemberService';

function toTitleCase(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatScalar(value) {
  if (value === null || value === undefined || value === '') {
    return 'N/A';
  }

  if (Array.isArray(value)) {
    return value.length ? value.map((item) => formatScalar(item)).join(', ') : 'N/A';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function escapeMarkdownCell(value) {
  return String(value || '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br/>');
}

function normalizeEpdsRecords(epdsResult) {
  if (Array.isArray(epdsResult)) {
    return epdsResult;
  }

  if (typeof epdsResult === 'string') {
    const trimmedResult = epdsResult.trim();
    if (!trimmedResult) {
      return [];
    }

    try {
      const parsedResult = JSON.parse(trimmedResult);
      if (Array.isArray(parsedResult)) {
        return parsedResult;
      }

      return parsedResult ? [parsedResult] : [];
    } catch {
      return [trimmedResult];
    }
  }

  return epdsResult ? [epdsResult] : [];
}

function resolveEpdsRecords(responseData) {
  if (Array.isArray(responseData)) {
    return responseData;
  }

  if (responseData && typeof responseData === 'object') {
    if (Object.prototype.hasOwnProperty.call(responseData, 'epds_result')) {
      return normalizeEpdsRecords(responseData.epds_result);
    }

    if (Object.prototype.hasOwnProperty.call(responseData, 'data')) {
      return normalizeEpdsRecords(responseData.data);
    }

    return [];
  }

  return [];
}

function formatEpdsRecords(records) {
  const objectRecords = records.filter((record) => record && typeof record === 'object' && !Array.isArray(record));

  if (!objectRecords.length) {
    const header = '| Result |';
    const divider = '| --- |';
    const rows = records.map((record) => `| ${escapeMarkdownCell(formatScalar(record))} |`);
    return [header, divider, ...rows].join('\n');
  }

  const columns = [];
  objectRecords.forEach((record) => {
    Object.keys(record).forEach((key) => {
      if (!columns.includes(key)) {
        columns.push(key);
      }
    });
  });

  const header = `| ${columns.map((key) => escapeMarkdownCell(toTitleCase(key))).join(' | ')} |`;
  const divider = `| ${columns.map(() => '---').join(' | ')} |`;
  const rows = objectRecords.map((record) => {
    const cells = columns.map((key) => escapeMarkdownCell(formatScalar(record?.[key])));
    return `| ${cells.join(' | ')} |`;
  });

  return [header, divider, ...rows].join('\n');
}

function formatEpdsResponse(responseData) {
  if (typeof responseData === 'string') {
    const trimmed = responseData.trim();
    if (!trimmed) {
      return '';
    }

    if (trimmed.startsWith('|')) {
      return trimmed;
    }

    try {
      const parsed = JSON.parse(trimmed);
      return formatEpdsResponse(parsed);
    } catch {
      return trimmed;
    }
  }

  if (responseData && typeof responseData === 'object' && typeof responseData.response === 'string') {
    const trimmedResponse = responseData.response.trim();
    if (trimmedResponse) {
      try {
        const parsedResponse = JSON.parse(trimmedResponse);
        if (parsedResponse && typeof parsedResponse === 'object' && Object.prototype.hasOwnProperty.call(parsedResponse, 'epds_result')) {
          const parsedResult = String(parsedResponse.epds_result || '').trim();
          if (parsedResult) {
            return parsedResult;
          }
        }
      } catch {
        // keep original response text when it is not JSON
      }
      return trimmedResponse;
    }
  }

  const records = resolveEpdsRecords(responseData);

  if (!records.length) {
    return '';
  }

  return formatEpdsRecords(records);
}

function extractEpdsResultContent(responseData) {
  if (typeof responseData === 'string') {
    const trimmed = responseData.trim();
    if (!trimmed) {
      return '';
    }

    try {
      const parsed = JSON.parse(trimmed);
      return extractEpdsResultContent(parsed);
    } catch {
      return trimmed;
    }
  }

  if (responseData && typeof responseData === 'object') {
    if (typeof responseData.response === 'string') {
      const nested = responseData.response.trim();
      if (nested) {
        try {
          const parsedNested = JSON.parse(nested);
          return extractEpdsResultContent(parsedNested);
        } catch {
          return nested;
        }
      }
    }

    const epdsContent = Object.prototype.hasOwnProperty.call(responseData, 'epds_result')
      ? String(responseData.epds_result || '').trim()
      : '';

    const financialContent = Object.prototype.hasOwnProperty.call(responseData, 'financial_result')
      ? formatFinancialResult(responseData.financial_result)
      : '';

    if (epdsContent || financialContent) {
      return [epdsContent, financialContent].filter(Boolean).join('\n\n');
    }

    if (Object.prototype.hasOwnProperty.call(responseData, 'data')) {
      return extractEpdsResultContent(responseData.data);
    }
  }

  const formatted = formatEpdsResponse(responseData);
  return String(formatted || '').trim();
}

function formatFinancialResult(financialResult) {
  if (!financialResult) return '';
  return String(financialResult).trim();
}

function normalizeAssistantResponse(responseData) {
  if (!responseData || typeof responseData !== 'object') {
    return responseData;
  }

  if (responseData.response) {
    return responseData;
  }

  const hasEpdsKey = Object.prototype.hasOwnProperty.call(responseData, 'epds_result');
  const hasFinancialKey = Object.prototype.hasOwnProperty.call(responseData, 'financial_result');

  if (responseData.router === 'epds' || hasEpdsKey || hasFinancialKey) {
    const parts = [];

    if (hasEpdsKey && responseData.epds_result !== null && responseData.epds_result !== undefined) {
      const epdsFormatted = formatEpdsResponse(responseData);
      if (epdsFormatted) parts.push(epdsFormatted);
    }

    if (hasFinancialKey) {
      const financialFormatted = formatFinancialResult(responseData.financial_result);
      if (financialFormatted) parts.push(financialFormatted);
    }

    return {
      ...responseData,
      response: parts.join('\n\n'),
    };
  }

  return responseData;
}

function tryParseJsonObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(trimmedValue);
    return parsedValue && typeof parsedValue === 'object' && !Array.isArray(parsedValue)
      ? parsedValue
      : null;
  } catch {
    return null;
  }
}

function normalizeEpdsDate(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue) {
    return '';
  }

  const dateMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) {
    return rawValue;
  }

  const [, year, month, day] = dateMatch;
  return `${month}/${day}/${year}`;
}

function normalizeEpdsCriteria(criteria) {
  if (!criteria || typeof criteria !== 'object') {
    return {};
  }

  return {
    ...criteria,
    startFileReceiveDate: normalizeEpdsDate(criteria.startFileReceiveDate),
    endFileReceiveDate: normalizeEpdsDate(criteria.endFileReceiveDate),
  };
}

const resolveOrchestrationBaseUrl = () => {
  const localUrl = (process.env.ORCHESTRATION_APP_LOCAL_URL || 'http://0.0.0.0:8080').trim();
  const configuredUrl = (process.env.ORCHESTRATION_APP_URL || '').trim();
  const useLocal = process.env.ORCHESTRATION_APP_USE_LOCAL === 'true';

  const selected = useLocal
    ? localUrl
    : (configuredUrl || (process.env.NODE_ENV === 'development' ? localUrl : ''));

  return selected.replace(/\/+$/, '');
};

export const callCase360EndpointService = async (body) => {
  try {
    const { nuid, sessionId, name } = await getServerSession();
    const orchestrationBaseUrl = resolveOrchestrationBaseUrl();

    if (!orchestrationBaseUrl) {
      throw new Error('Orchestration backend URL is not configured. Set ORCHESTRATION_APP_URL or enable ORCHESTRATION_APP_USE_LOCAL.');
    }

    console.info(`[Case360] Using orchestration base URL: ${orchestrationBaseUrl}`);

    // Create BackgroundJob document in MongoDB before calling the external service
    const backgroundJob = await createJob(body.teamName, `UserPrompt_${body.smart_note_id}`, {
      assistantName: body.assistantName,
      status: jobStatus.PROCESSING,
      parentId: body.chatInteractionId,
      teamName: body.teamName,
      nuid,
      messages: [],
    });

    const normalizedPath = String(body.path || '').replace(/^\/+/, '');
    const isEpdsPath = normalizedPath === 'api/case360/epds/route';

    const parsedQuery = tryParseJsonObject(body.query);
    const queryPayload = isEpdsPath
      ? {
        ...(parsedQuery || {
          nuid,
          filter: 'latest',
          queryText: body.query,
          criteria: (body.epdsFilters && typeof body.epdsFilters === 'object') ? body.epdsFilters : {},
        }),
      }
      : { query: body.query, filter: 'latest', nuid };

    if (isEpdsPath) {
      if (!queryPayload.nuid) {
        queryPayload.nuid = nuid;
      }
      queryPayload.criteria = normalizeEpdsCriteria(queryPayload.criteria);
    }

    if (!isEpdsPath && body.epdsFilters && typeof body.epdsFilters === 'object') {
      queryPayload.epdsFilters = body.epdsFilters;
    }
    if (body.dataEnv === 'perf') {
      queryPayload.DATA_ENV = 'perf';
    }

    const formData = new FormData();
    formData.append('query', JSON.stringify(queryPayload));
    if (!isEpdsPath && body.epdsFilters && typeof body.epdsFilters === 'object') {
      formData.append('epds_filters', JSON.stringify(body.epdsFilters));
    }
    formData.append('path', body.path);
    formData.append('smart_note_id', body.smart_note_id);
    formData.append('teamName', body.teamName);
    formData.append('assistantName', body.assistantName);
    formData.append('sessionId', body.sessionId || sessionId);
    formData.append('smart_note_create_dt', body.createdAt);
    formData.append('user_name', name);
    formData.append('background_id', backgroundJob.id);

    // Fire and forget - call the external API
    (async () => {
      try {
        const response = await axios.post(
          `${orchestrationBaseUrl}/${body.path}`,
          formData,
          {
            headers: {
              ...formData.getHeaders(),
            },
          }
        );

        // For EPDS, persist only the EPDS result content for clean UI rendering.
        const rawResponseData = response?.data;
        const responseData = normalizeAssistantResponse(rawResponseData);
        const defaultMessageContent = responseData?.response || responseData?.message || JSON.stringify(responseData);
        const messageContent = isEpdsPath
          ? (extractEpdsResultContent(rawResponseData) || defaultMessageContent)
          : defaultMessageContent;

        const message = {
          content: messageContent,
          timestamp: new Date().toISOString(),
        };
        await updateJob(body.teamName, backgroundJob.id, {
          status: jobStatus.COMPLETE,
          messages: [message],
        });
      } catch (error) {
        const errorMessage = {
          content: error.response?.data?.message || error.message || 'An unexpected error occurred.',
          timestamp: new Date().toISOString(),
        };
        await updateJob(body.teamName, backgroundJob.id, {
          status: jobStatus.ERROR,
          messages: [errorMessage],
        });
        console.error(JSON.stringify({
          kpmsg: {
            id: 'AI_PORTAL_NOTEBOOK',
            name: 'callCase360EndpointService',
            detail: { nuid, backgroundJobId: backgroundJob.id, error: error.response ? error.response.data : error.message }
          }
        }));
      }
    })();

    return {
      backgroundJobId: backgroundJob.id,
      orchestrationBaseUrl,
    };
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'callCase360EndpointService',
        detail: { error: error.response ? error.response.data : error.message }
      }
    }));
    throw error;
  }
}

export const callMedicareCompanionEndpointService = async (body) => {
  try {
    const { nuid, sessionId } = await getServerSession();
    const orchestrationBaseUrl = resolveOrchestrationBaseUrl();

    if (!orchestrationBaseUrl) {
      throw new Error('Orchestration backend URL is not configured. Set ORCHESTRATION_APP_URL or enable ORCHESTRATION_APP_USE_LOCAL.');
    }

    // get the roles for this NUID
    const teamMember = await getTeamMember(body.teamName, nuid);

    const backgroundJob = await createJob(body.teamName, `UserPrompt_${body.smartNoteId}`, {
      assistantName: body.assistantName,
      status: jobStatus.PROCESSING,
      parentId: body.chatInteractionId,
      teamName: body.teamName,
      nuid,
      messages: [],
    });

    if (!backgroundJob) {
      throw new Error('Failed to create background job');
    }

    // Fire and forget - call the external API
    (async () => {
      try {
        // TODO: We may want to get the path from the assistant's config
        const response = await fetch(`${orchestrationBaseUrl}/api/medicare/medicare-companion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: body.prompt,
            teamName: body.teamName,
            assistantName: body.assistantName,
            smartNoteId: body.smartNoteId,
            isOffShoreUser: teamMember?.roles?.includes('offshore') || false,
            nuid,
            sessionId,
            member_id: body.mrn || null,
            background_id: backgroundJob.id,
          }),
        });

        if (!response.ok) {
          throw new Error(`Medicare Companion responded with ${response.status} ${response.statusText}`);
        }

        // const responseData = await response.json();
        // await updateJob(body.teamName, backgroundJob.id, {
        //   status: jobStatus.COMPLETE,
        //   messages: [{
        //     content: responseData?.response || responseData?.message || JSON.stringify(responseData),
        //     timestamp: new Date().toISOString(),
        //   }],
        // });
      } catch (error) {
        await updateJob(body.teamName, backgroundJob.id, {
          status: jobStatus.ERROR,
          messages: [{ content: error.message || 'An unexpected error occurred.', timestamp: new Date().toISOString() }],
        });
        console.error(JSON.stringify({
          kpmsg: {
            id: 'AI_PORTAL_NOTEBOOK',
            name: 'callMedicareCompanionEndpointService',
            detail: { nuid, backgroundJobId: backgroundJob.id, error: error.message }
          }
        }));
      }
    })();

    return { backgroundJobId: backgroundJob.id };
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'callMedicareCompanionEndpointService',
        detail: {
          error: error.message
        },
      }
    }));
    throw error;
  }
}