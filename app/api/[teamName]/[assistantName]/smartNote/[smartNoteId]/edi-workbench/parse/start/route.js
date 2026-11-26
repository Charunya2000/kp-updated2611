import { NextResponse } from 'next/server';
import { createEdiValidationJob } from '@/app/services/ediWorkbenchJobService';
import {
  getEdiCompanionGuideTemplateById,
} from '@/app/services/ediCompanionGuideTemplateService';
import {
  getEdiCompanionGuideRunConfigById,
} from '@/app/services/ediCompanionGuideRunConfigService';
import {
  normalizeSubscriberBatchSize,
  SUBSCRIBER_BATCH_SIZE_ERROR,
} from '@/app/utils/ediWorkbenchParserOptions';
import { getServerSession } from '@/utils/getSession';

const OVERRIDE_MODE = 'single-subscriber-overrides';

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeSsn(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeStipulatedValues(stipulatedValues) {
  if (!stipulatedValues || typeof stipulatedValues !== 'object') {
    return null;
  }

  const nm1Input = stipulatedValues.nm1 && typeof stipulatedValues.nm1 === 'object'
    ? stipulatedValues.nm1
    : {};
  const refInput = stipulatedValues.ref && typeof stipulatedValues.ref === 'object'
    ? stipulatedValues.ref
    : {};

  const nm1 = {
    NM101: normalizeText(nm1Input.NM101),
    NM102: normalizeText(nm1Input.NM102),
    NM103: normalizeText(nm1Input.NM103),
    NM104: normalizeText(nm1Input.NM104),
    NM105: normalizeText(nm1Input.NM105),
    NM106: normalizeText(nm1Input.NM106),
    NM107: normalizeText(nm1Input.NM107),
    NM108: normalizeText(nm1Input.NM108),
    NM109: normalizeSsn(nm1Input.NM109),
  };

  const ref = {
    REF0F: normalizeSsn(refInput.REF0F),
    REF1L: normalizeText(refInput.REF1L),
    REFDX: normalizeText(refInput.REFDX),
    REFZZ: normalizeText(refInput.REFZZ),
  };

  const hasValues = Object.values(nm1).some((value) => value)
    || Object.values(ref).some((value) => value);

  if (!hasValues) {
    return null;
  }

  return { nm1, ref };
}

function normalizeValidationScope(validationScope) {
  const mode = String(validationScope?.mode || '').trim();
  if (mode !== 'single-subscriber' && mode !== OVERRIDE_MODE) {
    return { mode: 'all-subscribers', subscriberSsn: null };
  }

  const subscriberSsn = String(validationScope?.subscriberSsn || '').replace(/\D/g, '');
  return {
    mode,
    subscriberSsn: subscriberSsn || null,
    stipulatedValues: normalizeStipulatedValues(validationScope?.stipulatedValues),
  };
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function toBoolean(value, fallback) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (lowered === 'true' || lowered === '1' || lowered === 'yes' || lowered === 'on') {
      return true;
    }
    if (lowered === 'false' || lowered === '0' || lowered === 'no' || lowered === 'off') {
      return false;
    }
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return fallback;
}

function normalizeParseOptions(parseOptions) {
  const source = parseOptions && typeof parseOptions === 'object' ? parseOptions : {};

  const dbValidation = toBoolean(
    firstDefined(source.dbValidation, source['dbValidation?']),
    toBoolean(process.env.DB_VALIDATION, false),
  );

  const envName = String(
    firstDefined(source.envName, source['env-name'], process.env.envName, process.env.ENV_NAME) || '',
  ).trim();

  const subscriberOnlyDbValidation = dbValidation
    ? true
    : toBoolean(
        firstDefined(
          source.subscriberOnlyDbValidation,
          source['subscriberOnlyDbValidation?'],
          source['subscriber-only-db-validation?'],
        ),
        toBoolean(process.env.SUBSCRIBER_ONLY_DB_VALIDATION, true),
      );

  const singleQueryDbValidation = true;
  const compareSingleQueryVsLegacy = false;

  const includeLookupSql = toBoolean(
    firstDefined(source.includeLookupSql, source['includeLookupSql?']),
    false,
  );

  const logMemory = toBoolean(
    firstDefined(source.logMemory, source['logMemory?'], source['log-memory?']),
    false,
  );
  const subscriberBatchSize = normalizeSubscriberBatchSize(source.subscriberBatchSize);

  return {
    dbValidation,
    envName,
    subscriberOnlyDbValidation,
    singleQueryDbValidation,
    compareSingleQueryVsLegacy,
    includeLookupSql,
    logMemory,
    subscriberBatchSize,
  };
}

export async function POST(req, { params }) {
  try {
    const requestStartedAt = Date.now();
    const { teamName, assistantName, smartNoteId } = await params;
    const { nuid } = await getServerSession();
    const {
      edi,
      companion,
      templateId = null,
      runConfigId = null,
      editableGuide = null,
      editableGuideMetadata = null,
      validationScope = null,
      parseOptions = null,
    } = await req.json();

    if (!edi?.container || !edi?.blobName) {
      return NextResponse.json({ error: 'EDI file location is required' }, { status: 400 });
    }

    if (!companion?.container || !companion?.blobName) {
      return NextResponse.json({ error: 'Companion guide file location is required' }, { status: 400 });
    }

    let resolvedTemplate = null;
    let resolvedRunConfig = null;
    let effectiveTemplateId = templateId || null;

    if (runConfigId) {
      resolvedRunConfig = await getEdiCompanionGuideRunConfigById({
        teamName,
        runConfigId,
      });

      if (!resolvedRunConfig || resolvedRunConfig.smartNoteId !== smartNoteId) {
        return NextResponse.json({ error: 'Run config not found for this SmartNote' }, { status: 404 });
      }

      if (!effectiveTemplateId && resolvedRunConfig.templateId) {
        effectiveTemplateId = resolvedRunConfig.templateId;
      }
    }

    if (effectiveTemplateId) {
      resolvedTemplate = await getEdiCompanionGuideTemplateById({
        teamName,
        templateId: effectiveTemplateId,
      });

      if (!resolvedTemplate || resolvedTemplate.smartNoteId !== smartNoteId) {
        return NextResponse.json({ error: 'Template not found for this SmartNote' }, { status: 404 });
      }
    }

    const effectiveValidationScope = normalizeValidationScope(
      validationScope || resolvedRunConfig?.validationScope || null,
    );

    if (
      !effectiveValidationScope?.stipulatedValues
      && effectiveValidationScope?.mode === OVERRIDE_MODE
    ) {
      effectiveValidationScope.stipulatedValues = normalizeStipulatedValues(
        resolvedRunConfig?.effectiveValues?.singleSubscriberOverride || null,
      );
    }

    const effectiveParseOptions = normalizeParseOptions(
      parseOptions
      || resolvedRunConfig?.effectiveValues?.parserOptions
      || resolvedTemplate?.parserOptions
      || null,
    );

    const job = createEdiValidationJob({
      edi,
      companion,
      editableGuide,
      editableGuideMetadata,
      templateId: effectiveTemplateId,
      runConfigId,
      validationScope: effectiveValidationScope,
      parseOptions: effectiveParseOptions,
      runtimeConfig: {
        teamName,
        assistantName,
        smartNoteId,
        ownerNuid: nuid,
        template: resolvedTemplate,
        runConfig: resolvedRunConfig,
      },
    });

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'ediWorkbenchParseStartAccepted',
        detail: {
          jobId: job.jobId,
          templateId: effectiveTemplateId,
          runConfigId,
          validationScopeMode: effectiveValidationScope?.mode || null,
          parseOptions: effectiveParseOptions,
          elapsedMs: Date.now() - requestStartedAt,
        },
      },
    }));

    return NextResponse.json(job, { status: 202 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'ediWorkbenchParseStart',
        detail: { error: error?.message || 'Failed to start EDI parse job' },
      },
    }));

    const status = error?.message === SUBSCRIBER_BATCH_SIZE_ERROR ? 400 : 500;
    return NextResponse.json({ error: error?.message || 'Failed to start EDI parse job' }, { status });
  }
}
