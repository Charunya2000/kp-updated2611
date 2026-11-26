'use server';

import { connectToDatabase } from '@/db/connection';
const MEDICARE_QUEUE_DATABASE =
    'team-bcs-db';

const MEDICARE_QUEUE_COLLECTION =
    'BCS_Medicare_ProcessingJobs';

let queueIndexesInitialized =
    false;
/*
* Debug counter showing how many times index initialization
* was requested in the current Node.js process.
*/
let queueIndexCheckCount = 0;
async function getMedicareQueueCollection() {
    const connection =
        await connectToDatabase(
            MEDICARE_QUEUE_DATABASE
        );

    const database =
        connection?.db &&
            typeof connection.db.collection ===
            'function'
            ? connection.db
            : connection;

    if (
        !database ||
        typeof database.collection !==
        'function'
    ) {
        throw new Error(
            'connectToDatabase() did not return a valid MongoDB database.'
        );
    }

    return database.collection(
        MEDICARE_QUEUE_COLLECTION
    );
}

async function ensureMedicareQueueIndexes(
    triggeredBy = "UNKNOWN"
) {
    queueIndexCheckCount++;

    console.log(
        "[MEDICARE QUEUE INDEX] Index check requested:",
        {
            triggeredBy,

            checkCount:
                queueIndexCheckCount,

            alreadyInitialized:
                queueIndexesInitialized,

            processId:
                process.pid
        }
    );

    /*
     * Skip MongoDB createIndex() calls after successful
     * initialization in the current Node.js process.
     */
    if (queueIndexesInitialized) {
        console.log(
            "[MEDICARE QUEUE INDEX] Index creation skipped:",
            {
                triggeredBy,

                checkCount:
                    queueIndexCheckCount,

                reason:
                    "Queue indexes were already initialized in this Node.js process.",

                processId:
                    process.pid
            }
        );

        return;
    }

    console.log(
        "[MEDICARE QUEUE INDEX] Creating or verifying MongoDB indexes:",
        {
            triggeredBy,

            database:
                MEDICARE_QUEUE_DATABASE,

            collection:
                MEDICARE_QUEUE_COLLECTION,

            processId:
                process.pid
        }
    );

    const collection =
        await getMedicareQueueCollection();

    const cacheKeyIndexName =
        await collection.createIndex(
            {
                cacheKey: 1
            },
            {
                unique:
                    true,

                name:
                    "uq_medicare_job_cache_key"
            }
        );

    console.log(
        "[MEDICARE QUEUE INDEX] Cache-key index ready:",
        {
            indexName:
                cacheKeyIndexName
        }
    );

    const requestIdIndexName =
        await collection.createIndex(
            {
                requestId: 1
            },
            {
                unique:
                    true,

                name:
                    "uq_medicare_job_request_id"
            }
        );

    console.log(
        "[MEDICARE QUEUE INDEX] Request-ID index ready:",
        {
            indexName:
                requestIdIndexName
        }
    );

    const claimIndexName =
        await collection.createIndex(
            {
                status: 1,
                createdAt: 1
            },
            {
                name:
                    "idx_medicare_job_claim"
            }
        );

    console.log(
        "[MEDICARE QUEUE INDEX] Job-claim index ready:",
        {
            indexName:
                claimIndexName
        }
    );

    const lockIndexName =
        await collection.createIndex(
            {
                lockedAt: 1
            },
            {
                name:
                    "idx_medicare_job_locked_at"
            }
        );

    console.log(
        "[MEDICARE QUEUE INDEX] Lock-time index ready:",
        {
            indexName:
                lockIndexName
        }
    );

    queueIndexesInitialized =
        true;

    console.log(
        "[MEDICARE QUEUE INDEX] Index initialization completed:",
        {
            triggeredBy,

            checkCount:
                queueIndexCheckCount,

            queueIndexesInitialized,

            processId:
                process.pid,

            indexes: [
                cacheKeyIndexName,
                requestIdIndexName,
                claimIndexName,
                lockIndexName
            ]
        }
    );
}

export async function enqueueMedicareProcessingJob(
    job
) {
    if (!job?.requestId) {
        throw new Error(
            'requestId is required when submitting a Medicare job.'
        );
    }

    if (!job?.cacheKey) {
        throw new Error(
            'cacheKey is required when submitting a Medicare job.'
        );
    }

    if (!job?.sourceBlobName) {
        throw new Error(
            'sourceBlobName is required when submitting a Medicare job.'
        );
    }

    await ensureMedicareQueueIndexes(
        "enqueueMedicareProcessingJob"
    );

    const collection =
        await getMedicareQueueCollection();

    const now =
        new Date();

    await collection.updateOne(
        {
            cacheKey:
                job.cacheKey
        },
        {
            $setOnInsert: {
                requestId:
                    job.requestId,

                cacheKey:
                    job.cacheKey,

                status:
                    'QUEUED',

                payload:
                    job,

                attempts:
                    0,
                nextAttemptAt:
                    now,

                createdAt:
                    now,

                updatedAt:
                    now,

                lockedAt:
                    null,

                lockedBy:
                    null,

                completedAt:
                    null,

                failedAt:
                    null,

                lastError:
                    null
            }
        },
        {
            upsert:
                true
        }
    );

    const queuedJob =
        await collection.findOne({
            cacheKey:
                job.cacheKey
        });

    console.log(
        '[MEDICARE QUEUE] Job submitted:',
        {
            requestId:
                queuedJob?.requestId,

            cacheKey:
                queuedJob?.cacheKey,

            status:
                queuedJob?.status
        }
    );

    return queuedJob;
}

export async function claimNextMedicareProcessingJob(
    workerId
) {
    await ensureMedicareQueueIndexes(
        "claimNextMedicareProcessingJob");

    const collection =
        await getMedicareQueueCollection();

    const staleLockTime =
        new Date(
            Date.now() -
            30 * 60 * 1000
        );

    const result =
        await collection.findOneAndUpdate(
            {
                $or: [
                    {
                        status:
                            "QUEUED",

                        $or: [
                            {
                                nextAttemptAt: {
                                    $lte:
                                        new Date()
                                }
                            },
                            {
                                nextAttemptAt: {
                                    $exists:
                                        false
                                }
                            },
                            {
                                nextAttemptAt:
                                    null
                            }
                        ]
                    },
                    {
                        status:
                            "RUNNING",

                        lockedAt: {
                            $lt:
                                staleLockTime
                        }
                    }
                ]
            },
            {
                $set: {
                    status:
                        'RUNNING',

                    lockedAt:
                        new Date(),

                    lockedBy:
                        workerId,

                    startedAt:
                        new Date(),

                    updatedAt:
                        new Date()
                },

                $inc: {
                    attempts:
                        1
                }
            },
            {
                sort: {
                    createdAt:
                        1
                },

                returnDocument:
                    'after'
            }
        );

    return result?.value || result || null;
}
export async function claimMedicareProcessingJobByRequest({
    requestId,
    cacheKey,
    workerId
}) {
    await ensureMedicareQueueIndexes(
        "claimMedicareProcessingJobByRequest"
    );

    const collection =
        await getMedicareQueueCollection();

    const normalizedRequestId =
        String(
            requestId ||
            ""
        )
            .trim()
            .toUpperCase();

    const normalizedCacheKey =
        String(
            cacheKey ||
            ""
        ).trim();

    if (
        !normalizedRequestId &&
        !normalizedCacheKey
    ) {
        return null;
    }

    const identityFilter = {};

    if (normalizedRequestId) {
        identityFilter.requestId =
            normalizedRequestId;
    }

    if (normalizedCacheKey) {
        identityFilter.cacheKey =
            normalizedCacheKey;
    }

    const now =
        new Date();

    const staleLockTime =
        new Date(
            Date.now() -
            30 * 60 * 1000
        );

    const result =
        await collection.findOneAndUpdate(
            {
                ...identityFilter,

                $or: [
                    {
                        status:
                            "QUEUED",

                        $or: [
                            {
                                nextAttemptAt: {
                                    $lte:
                                        now
                                }
                            },
                            {
                                nextAttemptAt: {
                                    $exists:
                                        false
                                }
                            },
                            {
                                nextAttemptAt:
                                    null
                            }
                        ]
                    },
                    {
                        status:
                            "RUNNING",

                        lockedAt: {
                            $lt:
                                staleLockTime
                        }
                    }
                ]
            },
            {
                $set: {
                    status:
                        "RUNNING",

                    lockedAt:
                        now,

                    lockedBy:
                        workerId,

                    startedAt:
                        now,

                    updatedAt:
                        now
                },

                $inc: {
                    attempts:
                        1
                }
            },
            {
                returnDocument:
                    "after"
            }
        );

    const claimedJob =
        result?.value ||
        result ||
        null;

    console.log(
        "[MEDICARE QUEUE] Exact job claim result:",
        {
            requestedRequestId:
                normalizedRequestId ||
                null,

            requestedCacheKey:
                normalizedCacheKey ||
                null,

            claimedRequestId:
                claimedJob?.requestId ||
                null,

            claimedCacheKey:
                claimedJob?.cacheKey ||
                null,

            claimedStatus:
                claimedJob?.status ||
                null
        }
    );

    return claimedJob;
}
export async function markMedicareQueueJobCompleted(
    cacheKey
) {
    const collection =
        await getMedicareQueueCollection();

    await collection.updateOne(
        {
            cacheKey
        },
        {
            $set: {
                status:
                    'COMPLETED',

                completedAt:
                    new Date(),

                updatedAt:
                    new Date(),

                lockedAt:
                    null,

                lockedBy:
                    null,

                lastError:
                    null
            }
        }
    );
}

export async function markMedicareQueueJobFailed(
    cacheKey,
    error
) {
    const collection =
        await getMedicareQueueCollection();

    const errorMessage =
        error instanceof Error
            ? error.message
            : String(error);

    await collection.updateOne(
        {
            cacheKey
        },
        {
            $set: {
                status:
                    'FAILED',

                failedAt:
                    new Date(),

                updatedAt:
                    new Date(),

                lockedAt:
                    null,

                lockedBy:
                    null,

                lastError: {
                    message:
                        errorMessage
                }
            }
        }
    );
}

export async function requeueMedicareProcessingJob(
    cacheKey,
    error,
    retryDelayMilliseconds = 60000
) {
    if (!cacheKey) {
        return;
    }

    const collection =
        await getMedicareQueueCollection();

    const errorMessage =
        error instanceof Error
            ? error.message
            : String(error);

    const safeRetryDelay =
        Math.max(
            Number(
                retryDelayMilliseconds
            ) ||
            60000,
            10000
        );

    const nextAttemptAt =
        new Date(
            Date.now() +
            safeRetryDelay
        );

    await collection.updateOne(
        {
            cacheKey
        },
        {
            $set: {
                status:
                    "QUEUED",

                nextAttemptAt,

                updatedAt:
                    new Date(),

                lockedAt:
                    null,

                lockedBy:
                    null,

                lastError: {
                    message:
                        errorMessage,

                    recordedAt:
                        new Date()
                }
            }
        }
    );

    console.log(
        "[MEDICARE QUEUE] Job scheduled for retry:",
        {
            cacheKey,
            nextAttemptAt,
            retryDelayMilliseconds:
                safeRetryDelay
        }
    );
}