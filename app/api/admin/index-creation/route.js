import { NextResponse } from 'next/server';
import { withAppAdminGuard } from '@/app/api/guards';
import { createIndex } from '@/app/services/aiSearchIndexService';

export const POST = await withAppAdminGuard(postHandler);

function normalizeSemanticField(field) {
  if (!field || typeof field !== 'object') {
    return field;
  }

  const { fieldName, ...rest } = field;
  return fieldName !== undefined
    ? { ...rest, name: fieldName }
    : field;
}

function normalizeSemanticSearch(semanticDefinition) {
  if (!semanticDefinition || typeof semanticDefinition !== 'object') {
    return semanticDefinition;
  }

  const {
    defaultConfiguration,
    defaultConfigurationName,
    configurations,
    ...rest
  } = semanticDefinition;

  return {
    ...rest,
    ...(defaultConfigurationName !== undefined && { defaultConfigurationName }),
    ...(defaultConfiguration !== undefined && { defaultConfigurationName: defaultConfiguration }),
    ...(Array.isArray(configurations) && {
      configurations: configurations.map((configuration) => {
        if (!configuration || typeof configuration !== 'object') {
          return configuration;
        }

        const { prioritizedFields, flightingOptIn, ...configurationRest } = configuration;

        if (!prioritizedFields || typeof prioritizedFields !== 'object') {
          return configurationRest;
        }

        const {
          titleField,
          contentFields,
          keywordsFields,
          prioritizedContentFields,
          prioritizedKeywordsFields,
          ...prioritizedFieldsRest
        } = prioritizedFields;

        return {
          ...configurationRest,
          prioritizedFields: {
            ...prioritizedFieldsRest,
            ...(titleField !== undefined && { titleField: normalizeSemanticField(titleField) }),
            ...(Array.isArray(contentFields) && {
              contentFields: contentFields.map(normalizeSemanticField),
            }),
            ...(Array.isArray(prioritizedContentFields) && {
              contentFields: prioritizedContentFields.map(normalizeSemanticField),
            }),
            ...(Array.isArray(keywordsFields) && {
              keywordsFields: keywordsFields.map(normalizeSemanticField),
            }),
            ...(Array.isArray(prioritizedKeywordsFields) && {
              keywordsFields: prioritizedKeywordsFields.map(normalizeSemanticField),
            }),
          },
        };
      }),
    }),
  };
}

async function postHandler(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { indexDefinition } = body;

  if (!indexDefinition || typeof indexDefinition !== 'object' || Array.isArray(indexDefinition)) {
    return NextResponse.json(
      { error: 'indexDefinition is required and must be a JSON object.' },
      { status: 400 }
    );
  }

  // Strip OData metadata properties (e.g. @odata.etag) that are server-assigned
  // and would be rejected by the create API
  const cleanDefinition = Object.fromEntries(
    Object.entries(indexDefinition).filter(([key]) => !key.startsWith('@odata.'))
  );

  // Normalize vectorSearch.profiles: the REST/Portal JSON uses "algorithm" but the
  // SDK interface requires "algorithmConfigurationName" for the same value.
  if (Array.isArray(cleanDefinition.vectorSearch?.profiles)) {
    cleanDefinition.vectorSearch = {
      ...cleanDefinition.vectorSearch,
      profiles: cleanDefinition.vectorSearch.profiles.map((profile) => {
        const { algorithm, ...rest } = profile;
        return algorithm !== undefined
          ? { ...rest, algorithmConfigurationName: algorithm }
          : rest;
      }),
    };
  }

  // Normalize similarity: the REST/Portal JSON uses "@odata.type" inside the object
  // but the SDK interface requires "odatatype" (no @ or dot).
  if (cleanDefinition.similarity?.['@odata.type']) {
    const { '@odata.type': odataType, ...similarityRest } = cleanDefinition.similarity;
    cleanDefinition.similarity = { ...similarityRest, odatatype: odataType };
  }

  // Normalize semantic search: exported REST/Portal JSON uses "semantic",
  // "fieldName", and prioritizedContent/prioritizedKeywords names, while the
  // SDK expects "semanticSearch", "name", "contentFields", and
  // "keywordsFields".
  if (cleanDefinition.semanticSearch || cleanDefinition.semantic) {
    cleanDefinition.semanticSearch = normalizeSemanticSearch(
      cleanDefinition.semanticSearch || cleanDefinition.semantic
    );
    delete cleanDefinition.semantic;
  }

  // Normalize fields: the REST/Portal JSON uses different property names than the SDK.
  // Renames applied per SDK serviceModels.d.ts:
  //   dimensions          → vectorSearchDimensions
  //   vectorSearchProfile → vectorSearchProfileName
  //   analyzer            → analyzerName
  //   searchAnalyzer      → searchAnalyzerName
  //   indexAnalyzer       → indexAnalyzerName
  if (Array.isArray(cleanDefinition.fields)) {
    cleanDefinition.fields = cleanDefinition.fields.map((field) => {
      const {
        dimensions,
        vectorSearchProfile,
        analyzer,
        searchAnalyzer,
        indexAnalyzer,
        ...rest
      } = field;
      return {
        ...rest,
        ...(dimensions !== undefined && { vectorSearchDimensions: dimensions }),
        ...(vectorSearchProfile !== undefined && { vectorSearchProfileName: vectorSearchProfile }),
        ...(analyzer !== undefined && { analyzerName: analyzer }),
        ...(searchAnalyzer !== undefined && { searchAnalyzerName: searchAnalyzer }),
        ...(indexAnalyzer !== undefined && { indexAnalyzerName: indexAnalyzer }),
      };
    });
  }

  try {
    const result = await createIndex(cleanDefinition);
    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'createSearchIndex',
        detail: { indexName: result.name },
      },
    }));
    return NextResponse.json({ success: true, indexName: result.name });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'createSearchIndex',
        detail: { error: error.message },
      },
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
