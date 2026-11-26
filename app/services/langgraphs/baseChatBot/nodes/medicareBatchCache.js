
import { connectToDatabase } from '@db/connection';

const MEDICARE_CACHE_DATABASE =
    'team-bcs-db';

const MEDICARE_CACHE_COLLECTION =
    'BCS_Medicare_BatchCache';

let indexesInitialized = false;

/**
 * Returns the MongoDB collection used to store Medicare batch metadata.
 *
 * This assumes connectToDatabase() returns an object containing:
 *
 * {
 *     db: MongoDB Db object
 * }
 *
 * If your connection helper returns the Db object directly,
 * see the alternate version explained after this code.
 */
async function getMedicareBatchCacheCollection() {
    const connection =
        await connectToDatabase(
            MEDICARE_CACHE_DATABASE
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
        MEDICARE_CACHE_COLLECTION
    );
}

/**
 * Creates permanent Medicare cache indexes.
 *
 * No TTL index is created because Medicare cache records
 * must remain persistent until manually deleted.
 */
export async function ensureMedicareCacheIndexes() {
    if (indexesInitialized) {
        return;
    }

    const collection =
        await getMedicareBatchCacheCollection();

    await collection.createIndex(
        {
            cacheKey: 1
        },
        {
            unique: true,
            name: 'uq_medicare_cache_key'
        }
    );

    await collection.createIndex(
        {
            requestId: 1
        },
        {
            unique: true,
            name: 'uq_medicare_request_id',
            partialFilterExpression: {
                requestId: {
                    $type: 'string'
                }
            }
        }
    );

    await collection.createIndex(
        {
            fileHash: 1
        },
        {
            name: 'idx_medicare_file_hash'
        }
    );

    await collection.createIndex(
        {
            status: 1
        },
        {
            name: 'idx_medicare_status'
        }
    );

    indexesInitialized = true;

    console.log(
        '[MEDICARE CACHE] MongoDB indexes initialized successfully.'
    );
}

/**
 * Removes any old MongoDB TTL indexes.
 *
 * Run this during the first deployment after switching to permanent
 * cache records. After the TTL index has been removed successfully,
 * you do not need to call this method on every request.
 */
export async function removeMedicareCacheTtlIndexes() {
    const collection =
        await getMedicareBatchCacheCollection();

    const indexes =
        await collection.indexes();

    const ttlIndexes =
        indexes.filter(
            index =>
                index.expireAfterSeconds !==
                undefined
        );

    if (ttlIndexes.length === 0) {
        console.log(
            '[MEDICARE CACHE] No TTL indexes were found.'
        );

        return;
    }

    for (const ttlIndex of ttlIndexes) {
        await collection.dropIndex(
            ttlIndex.name
        );

        console.log(
            '[MEDICARE CACHE] Removed TTL index:',
            ttlIndex.name
        );
    }
}

/**
 * Finds a Medicare cache record by its user-facing Request ID.
 *
 * Example Request ID:
 * MED-A19F82C4E121
 */
export async function findMedicareCacheByRequestId(
    requestId
) {
    if (!requestId) {
        return null;
    }

    const collection =
        await getMedicareBatchCacheCollection();

    return collection.findOne({
        requestId:
            String(requestId)
                .trim()
                .toUpperCase()
    });
}

/**
 * Finds a Medicare cache record by its internal cache key.
 *
 * This returns PROCESSING, COMPLETED, or FAILED records.
 */
export async function findMedicareCacheByCacheKey(
    cacheKey
) {
    if (!cacheKey) {
        return null;
    }

    const collection =
        await getMedicareBatchCacheCollection();

    return collection.findOne({
        cacheKey
    });
}
export async function findCompletedMedicareBatchRecords({
    limit = 100,
    requestedBy = null,
    teamName = null
} = {}) {
    const collection =
        await getMedicareBatchCacheCollection();

    const safeLimit =
        Math.min(
            Math.max(
                Number(limit) || 100,
                1
            ),
            500
        );

    /*
     * Build the MongoDB filter.
     *
     * Only add requestedBy and teamName when they
     * contain usable values.
     */
    const query = {
        status:
            "COMPLETED"
    };

    const normalizedRequestedBy =
        typeof requestedBy === "string"
            ? requestedBy.trim()
            : "";

    const normalizedTeamName =
        typeof teamName === "string"
            ? teamName.trim()
            : "";

    if (normalizedRequestedBy) {
        query.requestedBy =
            normalizedRequestedBy;
    }

    if (normalizedTeamName) {
        query.teamName =
            normalizedTeamName;
    }

    console.log(
        "[MEDICARE CACHE] Finding completed records:",
        {
            query,
            requestedLimit:
                safeLimit,

            sortingMode:
                "APPLICATION_MEMORY"
        }
    );

    /*
     * Do not use MongoDB .sort() here.
     *
     * Azure Cosmos DB requires a matching composite
     * index for the previous completedAt + createdAt
     * database-side sort.
     *
     * Retrieve a bounded result set and perform the
     * ordering in JavaScript instead.
     */
    const records =
        await collection
            .find(
                query,
                {
                    projection: {
                        _id:
                            0,

                        requestId:
                            1,

                        cacheKey:
                            1,

                        status:
                            1,

                        "source.fileName":
                            1,

                        "source.name":
                            1,

                        "source.fileSize":
                            1,

                        sourceFileName:
                            1,

                        "metrics.totalRecords":
                            1,

                        "metrics.generatedSqlActionCount":
                            1,

                        "metrics.unsupportedSqlActionCount":
                            1,

                        totalRecords:
                            1,

                        generatedSqlActionCount:
                            1,

                        unsupportedSqlActionCount:
                            1,

                        requestedBy:
                            1,

                        teamName:
                            1,

                        completedAt:
                            1,

                        createdAt:
                            1,

                        updatedAt:
                            1
                    }
                }
            )
            /*
             * Fetch at most 500 records so the application
             * does not load an unbounded collection.
             */
            .limit(
                500
            )
            .toArray();

    /*
     * Sort newest completed records first.
     *
     * Fall back to updatedAt and createdAt for older
     * documents that do not have completedAt.
     */
    records.sort(
        function (
            firstRecord,
            secondRecord
        ) {
            const firstTimestamp =
                new Date(
                    firstRecord
                        ?.completedAt ||
                    firstRecord
                        ?.updatedAt ||
                    firstRecord
                        ?.createdAt ||
                    0
                ).getTime();

            const secondTimestamp =
                new Date(
                    secondRecord
                        ?.completedAt ||
                    secondRecord
                        ?.updatedAt ||
                    secondRecord
                        ?.createdAt ||
                    0
                ).getTime();

            const safeFirstTimestamp =
                Number.isFinite(
                    firstTimestamp
                )
                    ? firstTimestamp
                    : 0;

            const safeSecondTimestamp =
                Number.isFinite(
                    secondTimestamp
                )
                    ? secondTimestamp
                    : 0;

            return (
                safeSecondTimestamp -
                safeFirstTimestamp
            );
        }
    );

    const limitedRecords =
        records.slice(
            0,
            safeLimit
        );

    console.log(
        "[MEDICARE CACHE] Completed records found:",
        {
            matchingRecordCount:
                records.length,

            returnedRecordCount:
                limitedRecords.length,

            requestedBy:
                normalizedRequestedBy ||
                null,

            teamName:
                normalizedTeamName ||
                null
        }
    );

    return limitedRecords;
}
/**
 * Finds a completed persistent Medicare cache result.
 */
export async function findCompletedMedicareCache(
    cacheKey
) {
    if (!cacheKey) {
        return null;
    }

    const collection =
        await getMedicareBatchCacheCollection();

    return collection.findOne({
        cacheKey,
        status:
            'COMPLETED'
    });
}

/**
 * Creates a new PROCESSING record when the file does not
 * already exist.
 *
 * The cacheKey unique index prevents two records from being
 * created for the same uploaded file.
 *
 * The method returns the actual MongoDB record. If another user
 * submits the same file concurrently, the existing request ID
 * is returned.
 */
export async function markMedicareCacheProcessing({
    requestId,
    cacheKey,
    fileHash,
    processorVersion,
    sourceFileName,
    sourceFileSize,
    requestedBy,
    teamName,
    brokerSplit
}) {
    if (!requestId) {
        throw new Error(
            'requestId is required when creating a Medicare cache record.'
        );
    }

    if (!cacheKey) {
        throw new Error(
            'cacheKey is required when creating a Medicare cache record.'
        );
    }

    if (!fileHash) {
        throw new Error(
            'fileHash is required when creating a Medicare cache record.'
        );
    }

    const collection =
        await getMedicareBatchCacheCollection();

    const now =
        new Date();

    await collection.updateOne(
        {
            cacheKey
        },
        {
            $setOnInsert: {
                requestId:
                    String(requestId)
                        .trim()
                        .toUpperCase(),

                cacheKey,

                fileHash,

                processorVersion,

                status:
                    'PROCESSING',

                source: {
                    fileName:
                        sourceFileName,

                    fileSize:
                        sourceFileSize
                },

                output: {
                    excelBlobName:
                        null,

                    sqlBlobName:
                        null
                },

                metrics: {
                    totalRecords:
                        0,

                    generatedSqlActionCount:
                        0,

                    unsupportedSqlActionCount:
                        0
                },

                queryData: {
                    available:
                        false,

                    storedRowCount:
                        0,

                    storedAt:
                        null
                },

                summary: {
                    brokerSplit:
                        Array.isArray(
                            brokerSplit
                        )
                            ? brokerSplit
                            : []
                },
                jira: {
                    issueKey:
                        null,

                    createdAt:
                        null
                },

                requestedBy:
                    requestedBy || null,

                teamName:
                    teamName || null,

                createdAt:
                    now,

                updatedAt:
                    now,

                processingStartedAt:
                    now,

                completedAt:
                    null,

                failedAt:
                    null,

                error:
                    null
            }
        },
        {
            upsert:
                true
        }
    );

    return collection.findOne({
        cacheKey
    });
}

/**
 * Updates a cache record after the Excel and SQL files have
 * been generated and uploaded successfully to Azure Blob Storage.
 *
 * The Jira issue key is saved in the same document. If the cache
 * record already has a Jira issue key and jiraIssueKey is not passed,
 * the existing Jira information remains unchanged.
 */
export async function saveCompletedMedicareCache({
    requestId,
    cacheKey,
    fileHash,
    processorVersion,
    sourceFileName,
    sourceFileSize,
    excelBlobName,
    sqlBlobName,
    totalRecords,
    generatedSqlActionCount,
    unsupportedSqlActionCount,
    requestedBy,
    teamName,
    jiraIssueKey,
    storedRowCount = 0,
    queryDataAvailable = false
}) {
    if (!requestId) {
        throw new Error(
            "requestId is required when completing a Medicare cache record."
        );
    }

    if (!cacheKey) {
        throw new Error(
            "cacheKey is required when completing a Medicare cache record."
        );
    }

    const collection =
        await getMedicareBatchCacheCollection();

    const now =
        new Date();

    const normalizedStoredRowCount =
        Math.max(
            Number(
                storedRowCount
            ) ||
            0,
            0
        );

    const normalizedTotalRecords =
        Math.max(
            Number(
                totalRecords
            ) ||
            0,
            0
        );

    const normalizedGeneratedSqlActionCount =
        Math.max(
            Number(
                generatedSqlActionCount
            ) ||
            0,
            0
        );

    const normalizedUnsupportedSqlActionCount =
        Math.max(
            Number(
                unsupportedSqlActionCount
            ) ||
            0,
            0
        );

    const normalizedQueryDataAvailable =
        queryDataAvailable === true &&
        normalizedStoredRowCount > 0;

    if (
        normalizedTotalRecords > 0 &&
        normalizedStoredRowCount !==
        normalizedTotalRecords
    ) {
        throw new Error(
            `Cannot complete Medicare cache record. Expected ` +
            `${normalizedTotalRecords} stored rows, but received ` +
            `${normalizedStoredRowCount}.`
        );
    }

    const completedFields = {
        requestId:
            String(
                requestId
            )
                .trim()
                .toUpperCase(),

        fileHash,

        processorVersion,

        status:
            "COMPLETED",

        source: {
            fileName:
                sourceFileName,

            fileSize:
                Number(
                    sourceFileSize
                ) ||
                0
        },

        output: {
            excelBlobName,

            sqlBlobName
        },

        metrics: {
            totalRecords:
                normalizedTotalRecords,

            generatedSqlActionCount:
                normalizedGeneratedSqlActionCount,

            unsupportedSqlActionCount:
                normalizedUnsupportedSqlActionCount
        },

        queryData: {
            available:
                normalizedQueryDataAvailable,

            storedRowCount:
                normalizedStoredRowCount,

            storedAt:
                normalizedQueryDataAvailable
                    ? now
                    : null
        },

        requestedBy:
            requestedBy ||
            null,

        teamName:
            teamName ||
            null,

        completedAt:
            now,

        updatedAt:
            now,

        failedAt:
            null,

        error:
            null
    };

    if (jiraIssueKey) {
        completedFields.jira = {
            issueKey:
                jiraIssueKey,

            createdAt:
                now,

            creationReserved:
                false
        };
    }

    const updateResult =
        await collection.updateOne(
            {
                cacheKey
            },
            {
                $set:
                    completedFields
            },
            {
                upsert:
                    false
            }
        );

    if (
        updateResult.matchedCount ===
        0
    ) {
        throw new Error(
            `No Medicare cache record was found for cacheKey ${cacheKey}.`
        );
    }

    const completedRecord =
        await collection.findOne({
            cacheKey
        });

    if (!completedRecord) {
        throw new Error(
            `The completed Medicare cache record could not be loaded for ` +
            `${cacheKey}.`
        );
    }

    console.log(
        "[MEDICARE CACHE] Request marked completed:",
        {
            requestId:
                completedRecord.requestId,

            cacheKey,

            totalRecords:
                normalizedTotalRecords,

            storedRowCount:
                normalizedStoredRowCount,

            queryDataAvailable:
                normalizedQueryDataAvailable
        }
    );

    return completedRecord;
}

/**
 * Saves a Jira issue key without changing the processing status.
 *
 * This can be used immediately after Jira creation.
 */
export async function saveMedicareJiraIssueKey({
    cacheKey,
    jiraIssueKey
}) {
    if (
        !cacheKey ||
        !jiraIssueKey
    ) {
        return null;
    }

    const collection =
        await getMedicareBatchCacheCollection();

    await collection.updateOne(
        {
            cacheKey,
            $or: [
                {
                    'jira.issueKey':
                        null
                },
                {
                    'jira.issueKey': {
                        $exists:
                            false
                    }
                }
            ]
        },
        {
            $set: {
                'jira.issueKey':
                    jiraIssueKey,

                'jira.createdAt':
                    new Date(),

                updatedAt:
                    new Date()
            }
        }
    );

    return collection.findOne({
        cacheKey
    });
}

/**
 * Attempts to reserve Jira creation for one cache record.
 *
 * This helps prevent multiple workers from creating multiple Jira
 * issues for the same file.
 *
 * Returns true when this worker obtained the reservation.
 * Returns false when Jira already exists or another worker reserved it.
 */
export async function reserveMedicareJiraCreation(
    cacheKey
) {
    if (!cacheKey) {
        return false;
    }

    const collection =
        await getMedicareBatchCacheCollection();

    const now =
        new Date();

    const staleReservationTime =
        new Date(
            Date.now() -
            15 * 60 * 1000
        );

    const result =
        await collection.updateOne(
            {
                cacheKey,

                $and: [
                    {
                        $or: [
                            {
                                "jira.issueKey":
                                    null
                            },
                            {
                                "jira.issueKey": {
                                    $exists:
                                        false
                                }
                            }
                        ]
                    },
                    {
                        $or: [
                            {
                                "jira.creationReserved": {
                                    $ne:
                                        true
                                }
                            },
                            {
                                "jira.creationReservedAt": {
                                    $lt:
                                        staleReservationTime
                                }
                            },
                            {
                                "jira.creationReservedAt": {
                                    $exists:
                                        false
                                }
                            }
                        ]
                    }
                ]
            },
            {
                $set: {
                    "jira.creationReserved":
                        true,

                    "jira.creationReservedAt":
                        now,

                    "jira.creationReservedBy":
                        `process-${process.pid}`,

                    updatedAt:
                        now
                },

                $unset: {
                    "jira.creationReservationReleasedAt":
                        ""
                }
            }
        );

    const reserved =
        result.modifiedCount ===
        1;

    console.log(
        "[MEDICARE JIRA] Reservation result:",
        {
            cacheKey,
            reserved,
            staleReservationTime
        }
    );

    return reserved;
}

/**
 * Clears the Jira reservation when Jira creation fails.
 *
 * This allows a later worker or retry to create the Jira issue.
 */
export async function releaseMedicareJiraCreation(
    cacheKey
) {
    if (!cacheKey) {
        return;
    }

    const collection =
        await getMedicareBatchCacheCollection();

    await collection.updateOne(
        {
            cacheKey
        },
        {
            $set: {
                'jira.creationReserved':
                    false,

                'jira.creationReservationReleasedAt':
                    new Date(),

                updatedAt:
                    new Date()
            },
            $unset: {
                "jira.creationReservedBy":
                    "",
                "jira.creationReservedAt":
                    ""
            }
        }
    );
}

/**
 * Marks an existing cache record as FAILED.
 */
export async function markMedicareCacheFailed(
    cacheKey,
    error
) {
    if (!cacheKey) {
        return;
    }

    try {
        const collection =
            await getMedicareBatchCacheCollection();

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

                    error: {
                        message:
                            errorMessage
                    }
                }
            }
        );
    } catch (cacheError) {
        console.error(
            '[MEDICARE CACHE] Failed to mark cache record as FAILED:',
            cacheError
        );
    }
}

/**
 * Deletes one Medicare cache record.
 *
 * Use this only when the cache metadata is invalid or the associated
 * Azure Blob files are missing.
 */
export async function deleteMedicareCache(
    cacheKey
) {
    if (!cacheKey) {
        return;
    }

    const collection =
        await getMedicareBatchCacheCollection();

    const result =
        await collection.deleteOne({
            cacheKey
        });

    console.log(
        '[MEDICARE CACHE] Cache delete result:',
        {
            cacheKey,

            deletedCount:
                result.deletedCount
        }
    );
}