'use server';

import { connectToDatabase } from './connection.js';
import { validateArgumentsSingle, validateArgumentsMulti } from '../app/services/validation.js';
import { formatDocument } from '../utils/formatting.js';

export async function selectDocuments(query, dbName = 'aisvc_userdb', dbCollection = 'user_collection') {
  await validateArgumentsMulti(query);

  formatDocument(query);
  query.app = 'SmartNotes';

  const db = await connectToDatabase(dbName);
  const documents = await db.collection(dbCollection).find(query).sort({ createdAt: 1 }).toArray();
  // Log for Splunk
  console.log(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'selectDocuments', detail: { query } } }));
  return documents;
}

export async function selectDocumentsExt(query, validationFn, options, dbName = 'aisvc_userdb', dbCollection = 'user_collection') {
  if (typeof (validationFn) === 'undefined' || validationFn === null) {
    await validateArgumentsMulti(query);
  } else {
    await validationFn(query);
  }

  formatDocument(query);

  const db = await connectToDatabase(dbName);
  const documents = await db.collection(dbCollection).find(query, options).sort({ createdAt: 1 }).toArray();
  // Log for Splunk
  console.log(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'selectDocumentsExt', detail: query } }));
  return documents;
}

export async function selectDocumentCount(query, dbName = 'aisvc_userdb', dbCollection = 'user_collection') {
  await validateArgumentsMulti(query);
  formatDocument(query);
  const db = await connectToDatabase(dbName);
  const count = await db.collection(dbCollection).countDocuments(query);
  // Log for Splunk
  console.log(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'selectDocumentCount', detail: { query } } }));
  return count;
}

export async function selectDocument(query, dbName = 'aisvc_userdb', dbCollection = 'user_collection') {
  let document = null;
  try {
    await validateArgumentsSingle(query);
    formatDocument(query);
    const db = await connectToDatabase(dbName);
    query.app = 'SmartNotes';
    document = await db.collection(dbCollection).findOne(query);
    // Log for Splunk
    console.log(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'selectDocument', detail: { query } } }));
  } catch (error) {
    console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'selectDocument', detail: { query, error: error.message } } }));
  }
  return document;
}

export async function selectDocumentExt(query, validationFn, options, dbName = 'aisvc_userdb', dbCollection = 'user_collection') {
  let document = null;
  try {
    if (typeof (validationFn) === 'undefined' || validationFn === null) {
      await validateArgumentsSingle(query);
    } else {
      await validationFn(query);
    }

    formatDocument(query);

    const db = await connectToDatabase(dbName);
    document = await db.collection(dbCollection).findOne(query, options);
    // Log for Splunk
    console.log(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'selectDocumentExt', detail: { query } } }));
  } catch (error) {
    console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'selectDocumentExt', detail: { query, error: error.message } } }));
    throw new Error(error.message); // Do not swallow the error
  }
  return document;
}

export async function aggregateDistinctNuids(dbName = 'aisvc_userdb', dbCollection = 'statistics', assistantName = null) {
  const db = await connectToDatabase(dbName);

  let matchStage = { type: 'Statistic', nuid: { $ne: null } };
  if (assistantName) {
    matchStage.assistantName = assistantName;
  }

  const results = await db.collection(dbCollection).aggregate([
    { $match: matchStage },
    { $group: { _id: '$nuid' } },
    { $sort: { _id: 1 } }
  ]).toArray();

  return results.map(r => r._id);
}

export async function aggregateDistVarCategories(dbName = 'aisvc_userdb', dbCollection = 'statistics', assistantName = null, nuid = null) {
  const db = await connectToDatabase(dbName);

  const matchStage = { type: 'Statistic' };
  if (assistantName) {
    matchStage.assistantName = assistantName;
  }
  if (nuid) {
    matchStage.nuid = nuid;
  }

  const results = await db.collection(dbCollection).aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          $cond: [
            {
              $or: [
                { $eq: ['$variantCategory', null] },
                { $eq: ['$variantCategory', ''] }
              ]
            },
            '__NO_CATEGORY__',
            '$variantCategory'
          ]
        }
      }
    },
    { $sort: { _id: 1 } }
  ]).toArray();

  return results.map((r) => r._id || '__NO_CATEGORY__');
}

export async function aggregateStatistics(flavor, dateRange, dbName = 'aisvc_userdb', dbCollection = 'statistics', assistantName = null, nuid = null, variantCategory = null) {
  const db = await connectToDatabase(dbName);

  let matchStage = { type: 'Statistic', category: { $exists: false } };
  if (assistantName) {
    matchStage.assistantName = assistantName;
  }
  if (nuid) {
    matchStage.nuid = nuid;
  }
  if (variantCategory && variantCategory !== 'all') {
    if (variantCategory === '__NO_CATEGORY__') {
      matchStage.$or = [
        { variantCategory: { $exists: false } },
        { variantCategory: null },
        { variantCategory: '' }
      ];
    } else {
      matchStage.variantCategory = variantCategory;
    }
  }

  let aggregationPipeline = [
    {
      $match: matchStage
    },
    {
      $addFields: {
        dayOfWeek: { $dayOfWeek: "$date" },
        weekStart: {
          $subtract: [
            "$date",
            { $multiply: [{ $subtract: [{ $dayOfWeek: "$date" }, 1] }, 24 * 60 * 60 * 1000] }
          ]
        }
      }
    },
    {
      $addFields: {
        weekStart: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$weekStart"
          }
        }
      }
    }
  ];

  const normalizedVariantCategoryExpr = {
    $cond: [
      {
        $or: [
          { $eq: ['$variantCategory', null] },
          { $eq: ['$variantCategory', ''] }
        ]
      },
      '__NO_CATEGORY__',
      '$variantCategory'
    ]
  };

  const currentDate = new Date();
  let startDate;

  switch (dateRange) {
    case 'This month':
      startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      break;
    case 'Last 2 months':
      startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      break;
    case 'Last 3 months':
      startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 2, 1);
      break;
    case 'This year':
      startDate = new Date(currentDate.getFullYear(), 0, 1);
      break;
    case 'All':
    default:
      startDate = null;
      break;
  }

  if (startDate) {
    aggregationPipeline.push({
      $match: { date: { $gte: startDate } }
    });
  }

  if (flavor === 'unique-nuids') {
    aggregationPipeline.push(
      {
        $group: {
          _id: {
            weekStart: "$weekStart",
            variant: "$variant",
            variantCategory: normalizedVariantCategoryExpr,
            nuid: "$nuid"
          }
        }
      },
      {
        $group: {
          _id: {
            weekStart: "$_id.weekStart",
            variant: "$_id.variant",
            variantCategory: "$_id.variantCategory"
          },
          count: { $sum: 1 }
        }
      }
    );
  } else {
    aggregationPipeline.push(
      {
        $group: {
          _id: {
            weekStart: "$weekStart",
            variant: "$variant",
            variantCategory: normalizedVariantCategoryExpr
          },
          count: { $sum: 1 }
        }
      }
    );
  }

  aggregationPipeline.push(
    {
      $sort: { "_id.weekStart": 1 }
    }
  );

  const statistics = await db.collection(dbCollection).aggregate(aggregationPipeline).toArray();
  return statistics;
}

// Teams are stored in aisvc_userdb
export async function aggregateTeamsWithOwners(dbName = 'aisvc_userdb', dbCollection = 'user_collection') {
  const db = await connectToDatabase(dbName);

  // First get all teams
  const teams = await db.collection(dbCollection).find({ type: 'Team' }).toArray();

  // fetch team owners for each team
  const teamsWithOwners = await Promise.all(
    teams.map(async (team) => {
      try {
        const teamDb = await connectToDatabase(`team-${team.name}-db`);

        // Use aggregation to find team members with 'owner' role
        const ownersPipeline = [
          {
            $match: {
              type: 'TeamMember',
              teamName: team.name,
              roles: { $elemMatch: { $eq: 'owner' } }
            }
          },
          {
            $project: {
              id: 1,
              nuid: 1,
              teamId: 1,
              roles: 1,
              createdAt: 1
            }
          }
        ];

        const owners = await teamDb.collection(dbCollection).aggregate(ownersPipeline).toArray();
        return { ...team, owners };
      } catch (error) {
        console.error(`Failed to fetch owners for team ${team.name}:`, error);
        return { ...team, owners: [] };
      }
    })
  );

  return teamsWithOwners;
}

// ===== Application-Level Statistics Aggregation =====

/**
 * Helper function to determine start date from date range
 */
function getStartDateFromRange(dateRange, currentDate) {
  switch (dateRange) {
    case 'This month':
      return new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    case 'Last 2 months':
      return new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    case 'Last 3 months':
      return new Date(currentDate.getFullYear(), currentDate.getMonth() - 2, 1);
    case 'This year':
      return new Date(currentDate.getFullYear(), 0, 1);
    case 'All':
    default:
      return null;
  }
}

/**
 * Get statistics across all teams or specific teams
 * @param {Object} options - Query options
 * @param {string} options.flavor - 'total-events' | 'unique-nuids' | 'detailed'
 * @param {string} options.dateRange - Date range filter
 * @param {string[]} options.teamNames - Array of team names, or null for all teams
 * @param {string[]} options.variants - Array of variant types to filter, or null for all
 * @param {string} options.category - Category to filter by (e.g., 'LLM Consumption', 'Image Processing')
 */
export async function aggregateLLMStatistics(flavor, dateRange, dbName = 'aisvc_userdb', dbCollection = 'statistics', assistantName = null, category = null, variants = null, nuid = null) {
  // Backward compatible with both:
  // 1) aggregateLLMStatistics({ ...options })
  // 2) aggregateLLMStatistics(flavor, dateRange, dbName, dbCollection, assistantName, category, variants)
  if (typeof flavor === 'object' && flavor !== null) {
    const options = flavor;
    flavor = options.flavor ?? 'detailed';
    dateRange = options.dateRange ?? 'This month';
    dbName = options.dbName ?? 'aisvc_userdb';
    dbCollection = options.dbCollection ?? 'statistics';
    assistantName = options.assistantName ?? null;
    category = options.category ?? null;
    variants = options.variants ?? null;
    nuid = options.nuid ?? null;
  } else {
    flavor = flavor ?? 'detailed';
    dateRange = dateRange ?? 'This month';
  }

  const db = await connectToDatabase(dbName);

  let matchStage = { type: 'Statistic' };
  if (assistantName) {
    matchStage.assistantName = assistantName;
  }
  if (category) {
    matchStage.category = category;
  }
  if (nuid) {
    matchStage.nuid = nuid;
  }
  if (Array.isArray(variants) && variants.length > 0) {
    matchStage.variant = { $in: variants };
  }

  let aggregationPipeline = [
    {
      $match: matchStage
    },
    {
      $addFields: {
        dayOfWeek: { $dayOfWeek: "$date" },
        weekStart: {
          $subtract: [
            "$date",
            { $multiply: [{ $subtract: [{ $dayOfWeek: "$date" }, 1] }, 24 * 60 * 60 * 1000] }
          ]
        }
      }
    },
    {
      $addFields: {
        weekStart: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$weekStart"
          }
        }
      }
    }
  ];

  const currentDate = new Date();
  const startDate = getStartDateFromRange(dateRange, currentDate);

  if (startDate) {
    aggregationPipeline.push({
      $match: { date: { $gte: startDate } }
    });
  }

  if (flavor === 'unique-nuids') {
    aggregationPipeline.push(
      {
        $group: {
          _id: { weekStart: "$weekStart", variant: "$variant", nuid: "$nuid" }
        }
      },
      {
        $group: {
          _id: { weekStart: "$_id.weekStart", variant: "$_id.variant" },
          count: { $sum: 1 }
        }
      }
    );
  } else {
    aggregationPipeline.push(
      {
        $group: {
          _id: { weekStart: "$weekStart", variant: "$variant" },
          count: { $sum: { $ifNull: ["$count", 1] } }
        }
      }
    );
  }

  aggregationPipeline.push(
    {
      $sort: { "_id.weekStart": 1 }
    }
  );

  const statistics = await db.collection(dbCollection).aggregate(aggregationPipeline).toArray();
  return statistics;
}

/**
 * Aggregate LLM consumption statistics
 */
export async function aggregateLLMConsumption(options) {
  const { dateRange, teamNames } = options;
  const rawStats = await aggregateLLMStatistics({
    flavor: 'detailed',
    dateRange,
    teamNames,
    category: 'LLM Consumption'
  });

  // Process and structure the data
  const summary = {
    totalRequestTokens: 0,
    totalResponseTokens: 0,
    totalTokens: 0,
    totalSourcesUsed: 0,
    sourceUsage: {},
    byTeam: {},
    byNuid: {}
  };

  rawStats.forEach(stat => {
    // Initialize team stats if needed
    if (!summary.byTeam[stat.teamName]) {
      summary.byTeam[stat.teamName] = {
        requestTokens: 0,
        responseTokens: 0,
        totalTokens: 0,
        sourcesUsed: 0
      };
    }

    // Initialize NUID stats if needed
    if (!summary.byNuid[stat.nuid]) {
      summary.byNuid[stat.nuid] = {
        requestTokens: 0,
        responseTokens: 0,
        totalTokens: 0,
        teamName: stat.teamName
      };
    }

    // Handle Request Tokens
    if (stat.variant === 'Request Tokens') {
      const count = stat.count || 0;
      summary.totalRequestTokens += count;
      summary.totalTokens += count;
      summary.byTeam[stat.teamName].requestTokens += count;
      summary.byTeam[stat.teamName].totalTokens += count;
      summary.byNuid[stat.nuid].requestTokens += count;
      summary.byNuid[stat.nuid].totalTokens += count;
    }

    // Handle Response Tokens
    if (stat.variant === 'Response Tokens') {
      const count = stat.count || 0;
      summary.totalResponseTokens += count;
      summary.totalTokens += count;
      summary.byTeam[stat.teamName].responseTokens += count;
      summary.byTeam[stat.teamName].totalTokens += count;
      summary.byNuid[stat.nuid].responseTokens += count;
      summary.byNuid[stat.nuid].totalTokens += count;
    }

    // Handle Sources Used
    if (stat.variant === 'Sources Used') {
      const count = stat.count || 0;
      summary.totalSourcesUsed += count;
      summary.byTeam[stat.teamName].sourcesUsed += count;
    }

    // Handle individual source selections
    if (stat.variant && stat.variant.startsWith('Source: ')) {
      const sourceName = stat.variant.replace('Source: ', '');
      summary.sourceUsage[sourceName] = (summary.sourceUsage[sourceName] || 0) + 1;
    }
  });

  return summary;
}

/**
 * Aggregate image processing statistics
 */
export async function aggregateImageProcessing(options) {
  const { dateRange, teamNames } = options;
  const rawStats = await aggregateLLMStatistics({
    flavor: 'detailed',
    dateRange,
    teamNames,
    category: 'Image Processing'
  });

  const summary = {
    totalImages: 0,
    pngImages: 0,
    jpegImages: 0,
    webpImages: 0,
    heicImages: 0,
    tiffImages: 0,
    wordDocImages: 0,
    pdfDocImages: 0,
    byTeam: {},
    byNuid: {}
  };

  rawStats.forEach(stat => {
    const count = stat.count || 1;
    summary.totalImages += count;

    // Initialize team stats if needed
    if (!summary.byTeam[stat.teamName]) {
      summary.byTeam[stat.teamName] = {
        total: 0,
        png: 0,
        jpeg: 0,
        webp: 0,
        heic: 0,
        tiff: 0,
        word: 0,
        pdf: 0
      };
    }
    summary.byTeam[stat.teamName].total += count;

    // Initialize NUID stats if needed
    if (!summary.byNuid[stat.nuid]) {
      summary.byNuid[stat.nuid] = {
        total: 0,
        teamName: stat.teamName
      };
    }
    summary.byNuid[stat.nuid].total += count;

    // Categorize by variant
    switch (stat.variant) {
      case 'PNG Images Processed':
        summary.pngImages += count;
        summary.byTeam[stat.teamName].png += count;
        break;
      case 'JPEG Images Processed':
        summary.jpegImages += count;
        summary.byTeam[stat.teamName].jpeg += count;
        break;
      case 'WebP Images Processed':
        summary.webpImages += count;
        summary.byTeam[stat.teamName].webp += count;
        break;
      case 'HEIC Images Processed':
        summary.heicImages += count;
        summary.byTeam[stat.teamName].heic += count;
        break;
      case 'TIFF Images Processed':
        summary.tiffImages += count;
        summary.byTeam[stat.teamName].tiff += count;
        break;
      case 'Word Doc Images Processed':
        summary.wordDocImages += count;
        summary.byTeam[stat.teamName].word += count;
        break;
      case 'PDF Doc Images Processed':
        summary.pdfDocImages += count;
        summary.byTeam[stat.teamName].pdf += count;
        break;
    }
  });

  return summary;
}

/**
 * Aggregate failure statistics
 */
export async function aggregateFailures(options) {
  const { dateRange, teamNames } = options;
  const rawStats = await aggregateLLMStatistics({
    flavor: 'detailed',
    dateRange,
    teamNames,
    category: 'Failures'
  });

  const summary = {
    totalFailures: 0,
    byTeam: {},
    byNuid: {}
  };

  rawStats.forEach(stat => {
    const count = stat.count || 1;
    summary.totalFailures += count;

    // Initialize team stats if needed
    if (!summary.byTeam[stat.teamName]) {
      summary.byTeam[stat.teamName] = {
        total: 0
      };
    }
    summary.byTeam[stat.teamName].total += count;

    // Initialize NUID stats if needed
    if (!summary.byNuid[stat.nuid]) {
      summary.byNuid[stat.nuid] = {
        total: 0,
        teamName: stat.teamName
      };
    }
    summary.byNuid[stat.nuid].total += count;
  });

  return summary;
}

/**
 * Aggregate integration statistics
 */
export async function aggregateIntegrations(options) {
  const { dateRange, teamNames } = options;
  const rawStats = await aggregateLLMStatistics({
    flavor: 'total-events',
    dateRange,
    teamNames,
    variants: [
      'JiraIssue',
      'Confluence Added as Source',
      'SharePoint Added as Source',
      'QTest Added as Source',
      'WebURL',
      'UploadedDocument',
      'Download from Blob Storage'
    ]
  });

  const summary = {
    byIntegrationType: {},
    byTeam: {},
    byNuid: {}
  };

  rawStats.forEach(stat => {
    // Count by integration type
    summary.byIntegrationType[stat.variant] =
      (summary.byIntegrationType[stat.variant] || 0) + 1;

    // Count by team
    if (!summary.byTeam[stat.teamName]) {
      summary.byTeam[stat.teamName] = {};
    }
    summary.byTeam[stat.teamName][stat.variant] =
      (summary.byTeam[stat.teamName][stat.variant] || 0) + 1;

    // Count by NUID
    if (!summary.byNuid[stat.nuid]) {
      summary.byNuid[stat.nuid] = {
        total: 0,
        teamName: stat.teamName
      };
    }
    summary.byNuid[stat.nuid].total++;
  });

  return summary;
}