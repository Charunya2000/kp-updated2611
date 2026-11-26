'use server';

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@db/connection';
import { getTeamAccess } from '@/app/services/permissionsService';
import { getCurrentUserNuid } from '@utils/getSession';
import { PERMISSIONS } from '@/app/config/permissions';

const APPROVED_FEEDBACK_VALUES = [1, '1'];
const DISAPPROVED_FEEDBACK_VALUES = [0, '0'];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeAssistantValue(value) {
  return String(value || '').trim();
}

function compactAssistantValue(value) {
  return normalizeAssistantValue(value).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function slugAssistantValue(value) {
  return normalizeAssistantValue(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildAssistantCandidates(values) {
  const candidates = new Set();

  values
    .map(normalizeAssistantValue)
    .filter((value) => value && value.toLowerCase() !== 'all')
    .forEach((value) => {
      candidates.add(value);

      const compact = compactAssistantValue(value);
      if (compact) {
        candidates.add(compact);
      }

      const slug = slugAssistantValue(value);
      if (slug) {
        candidates.add(slug);
      }
    });

  return [...candidates];
}

function buildFlexibleAssistantRegex(value) {
  const compact = compactAssistantValue(value);
  if (!compact) {
    return null;
  }

  const tokens = compact.split('').map((char) => escapeRegExp(char));
  return new RegExp(`^${tokens.join('[^a-zA-Z0-9]*')}$`, 'i');
}

function buildAssistantMatch(searchParams) {
  const assistantName = searchParams.get('assistantName') || '';
  const assistantDisplayName = searchParams.get('assistantDisplayName') || '';
  const candidates = buildAssistantCandidates([assistantName, assistantDisplayName]);

  if (candidates.length === 0) {
    return null;
  }

  const exactRegexes = candidates.map((value) => new RegExp(`^${escapeRegExp(value)}$`, 'i'));
  const flexibleRegexes = candidates
    .map((value) => buildFlexibleAssistantRegex(value))
    .filter(Boolean);

  return {
    assistantName: { $in: [...exactRegexes, ...flexibleRegexes] }
  };
}

async function resolveAssistantNames(db, searchParams) {
  const assistantName = searchParams.get('assistantName') || '';
  const assistantDisplayName = searchParams.get('assistantDisplayName') || '';
  const candidates = buildAssistantCandidates([assistantName, assistantDisplayName]);

  if (candidates.length === 0) {
    return null;
  }

  const distinctAssistants = await db
    .collection('user_collection')
    .aggregate([
      { $match: { type: 'ChatInteraction', assistantName: { $exists: true, $ne: null } } },
      { $group: { _id: '$assistantName' } }
    ])
    .toArray();

  const compactCandidates = candidates.map((value) => compactAssistantValue(value)).filter(Boolean);

  const matchedAssistantNames = distinctAssistants
    .map((entry) => entry._id)
    .filter((value) => {
      const compactValue = compactAssistantValue(value);
      if (!compactValue) {
        return false;
      }

      return compactCandidates.some((candidate) =>
        compactValue === candidate
        || compactValue.includes(candidate)
        || candidate.includes(compactValue)
      );
    });

  if (matchedAssistantNames.length > 0) {
    return matchedAssistantNames;
  }

  return null;
}

async function resolveAssistantSmartNoteIds(db, searchParams) {
  const assistantName = searchParams.get('assistantName') || '';
  const assistantDisplayName = searchParams.get('assistantDisplayName') || '';
  const candidates = buildAssistantCandidates([assistantName, assistantDisplayName]);

  if (candidates.length === 0) {
    return null;
  }

  const compactCandidates = candidates.map((value) => compactAssistantValue(value)).filter(Boolean);

  const smartNotes = await db
    .collection('user_collection')
    .find(
      { type: 'SmartNote' },
      { projection: { id: 1, assistantName: 1, selectedUserAssistant: 1 } }
    )
    .toArray();

  const matchedSmartNoteIds = smartNotes
    .filter((note) => {
      const labels = [note?.assistantName, note?.selectedUserAssistant]
        .filter(Boolean)
        .map((value) => compactAssistantValue(value));

      if (labels.length === 0) {
        return false;
      }

      return labels.some((label) =>
        compactCandidates.some((candidate) =>
          label === candidate
          || label.includes(candidate)
          || candidate.includes(label)
        )
      );
    })
    .map((note) => note.id)
    .filter(Boolean);

  return matchedSmartNoteIds.length > 0 ? matchedSmartNoteIds : null;
}

async function buildAssistantScopeMatch(db, searchParams) {
  const resolvedAssistantNames = await resolveAssistantNames(db, searchParams);
  const resolvedSmartNoteIds = await resolveAssistantSmartNoteIds(db, searchParams);

  const orClauses = [];
  if (resolvedAssistantNames?.length) {
    orClauses.push({ assistantName: { $in: resolvedAssistantNames } });
  }
  if (resolvedSmartNoteIds?.length) {
    orClauses.push({ smartNoteId: { $in: resolvedSmartNoteIds } });
  }

  if (orClauses.length > 0) {
    return { $or: orClauses };
  }

  const assistantMatch = buildAssistantMatch(searchParams);
  if (assistantMatch) {
    return { assistantName: assistantMatch.assistantName };
  }

  return null;
}

function buildNormalizedNuidStages() {
  return [
    {
      $addFields: {
        normalizedNuid: {
          $let: {
            vars: {
              rawNuid: {
                $ifNull: [
                  '$nuid',
                  {
                    $ifNull: [
                      '$userNuid',
                      {
                        $ifNull: ['$createdBy.nuid', '$metadata.nuid']
                      }
                    ]
                  }
                ]
              }
            },
            in: {
              $trim: {
                input: {
                  $toString: {
                    $ifNull: ['$$rawNuid', '']
                  }
                }
              }
            }
          }
        }
      }
    }
  ];
}

/**
 * GET /api/[teamName]/admin/approval-statistics
 */
export async function GET(req, { params }) {
  try {
    const { teamName } = await params;
    const { searchParams } = new URL(req.url);

    // Permission check
    const userNuid = await getCurrentUserNuid();
    const access = await getTeamAccess(teamName, userNuid);
    if (!access?.has(PERMISSIONS.APPROVAL_STATISTICS_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = await connectToDatabase(`team-${teamName}-db`);

    const baseMatchStage = {
      type: 'ChatInteraction'
    };

    // Handle list assistants
    if (searchParams.get('listAssistants') === 'true') {
      const assistants = await db
        .collection('user_collection')
        .aggregate([
          { $match: baseMatchStage },
          { $match: { assistantName: { $exists: true, $ne: null } } },
          { $group: { _id: '$assistantName' } },
          { $sort: { _id: 1 } }
        ])
        .toArray();

      return NextResponse.json(assistants.map(a => a._id));
    }

    // Handle list NUIDs
    if (searchParams.get('listNuids') === 'true') {
      const matchStage = { type: 'ChatInteraction' };
      const assistantScopeMatch = await buildAssistantScopeMatch(db, searchParams);
      if (assistantScopeMatch) {
        Object.assign(matchStage, assistantScopeMatch);
      }

      const nuids = await db
        .collection('user_collection')
        .aggregate([
          { $match: matchStage },
          ...buildNormalizedNuidStages(),
          { $match: { normalizedNuid: { $exists: true, $nin: ['', 'null', 'undefined'] } } },
          { $group: { _id: '$normalizedNuid' } },
          { $sort: { _id: 1 } }
        ])
        .toArray();

      return NextResponse.json(nuids.map(n => n._id));
    }

    // Build filters for main statistics query
    const matchStage = { ...baseMatchStage };

    const dateRangeStart = searchParams.get('dateRangeStart');
    const dateRangeEnd = searchParams.get('dateRangeEnd');

    const assistantScopeMatch = await buildAssistantScopeMatch(db, searchParams);
    if (assistantScopeMatch) {
      Object.assign(matchStage, assistantScopeMatch);
    }

    const nuid = searchParams.get('nuid');
    const normalizedNuidFilter = nuid && nuid !== 'all'
      ? { $regex: `^${escapeRegExp(nuid.trim())}$`, $options: 'i' }
      : null;

    const feedbackStatus = searchParams.get('feedbackStatus');
    const feedbackFilterStage = {};
    if (feedbackStatus !== null && feedbackStatus !== undefined) {
      if (feedbackStatus === '1') {
        feedbackFilterStage.normalizedFeedback = 1;
      } else if (feedbackStatus === '0') {
        feedbackFilterStage.normalizedFeedback = 0;
      } else if (feedbackStatus === 'null') {
        feedbackFilterStage.normalizedFeedback = null;
      }
    }

    const pipeline = [
      { $match: matchStage },
      ...buildNormalizedNuidStages(),
      {
        $addFields: {
          interactionDate: {
            $ifNull: [
              {
                $convert: {
                  input: '$createdAt',
                  to: 'date',
                  onError: null,
                  onNull: null
                }
              },
              {
                $convert: {
                  input: '$updatedAt',
                  to: 'date',
                  onError: null,
                  onNull: null
                }
              }
            ]
          }
        }
      },
      {
        $addFields: {
          normalizedFeedback: {
            $switch: {
              branches: [
                {
                  case: { $in: ['$feedback', APPROVED_FEEDBACK_VALUES] },
                  then: 1
                },
                {
                  case: { $in: ['$feedback', DISAPPROVED_FEEDBACK_VALUES] },
                  then: 0
                }
              ],
              default: null
            }
          }
        }
      }
    ];

    if (dateRangeStart || dateRangeEnd) {
      const dateMatch = {};
      if (dateRangeStart) {
        dateMatch.$gte = new Date(dateRangeStart);
      }
      if (dateRangeEnd) {
        const endDate = new Date(dateRangeEnd);
        endDate.setHours(23, 59, 59, 999);
        dateMatch.$lte = endDate;
      }
      pipeline.push({ $match: { interactionDate: dateMatch } });
    }

    if (Object.keys(feedbackFilterStage).length > 0) {
      pipeline.push({ $match: feedbackFilterStage });
    }

    if (normalizedNuidFilter) {
      pipeline.push({ $match: { normalizedNuid: normalizedNuidFilter } });
    }

    // Fetch statistics with grouping
    const stats = await db
      .collection('user_collection')
      .aggregate([
        ...pipeline,
        {
          $group: {
            _id: {
              assistantName: '$assistantName',
              smartNoteId: {
                $cond: [
                  {
                    $ne: [
                      { $trim: { input: { $ifNull: ['$assistantName', ''] } } },
                      ''
                    ]
                  },
                  null,
                  '$smartNoteId'
                ]
              },
              nuid: '$normalizedNuid',
              feedback: '$normalizedFeedback',
              date: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$interactionDate'
                }
              }
            },
            count: { $sum: 1 },
            avgFeedback: { $avg: '$normalizedFeedback' }
          }
        },
        { $sort: { '_id.date': -1, '_id.assistantName': 1, '_id.nuid': 1 } }
      ])
      .toArray();

    const smartNoteIds = [...new Set(
      stats.map((stat) => stat._id.smartNoteId).filter(Boolean)
    )];
    const smartNotes = smartNoteIds.length > 0
      ? await db
        .collection('user_collection')
        .find(
          { type: 'SmartNote', id: { $in: smartNoteIds } },
          { projection: { id: 1, assistantName: 1, selectedUserAssistant: 1 } }
        )
        .toArray()
      : [];
    const assistantBySmartNoteId = new Map(
      smartNotes.map((smartNote) => [
        smartNote.id,
        smartNote.assistantName || smartNote.selectedUserAssistant || ''
      ])
    );

    const resolvedStats = stats.map((stat) => ({
      ...stat,
      _id: {
        ...stat._id,
        assistantName: stat._id.assistantName
          || assistantBySmartNoteId.get(stat._id.smartNoteId)
          || ''
      }
    }));

    return NextResponse.json(resolvedStats);
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'getApprovalStatistics',
        detail: { error: error.message }
      }
    }));

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
