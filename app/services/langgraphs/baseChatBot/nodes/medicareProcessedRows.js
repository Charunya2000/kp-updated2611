
import {
    connectToDatabase
} from "@db/connection";

const MEDICARE_PROCESSED_ROWS_DATABASE =
    "team-bcs-db";

const MEDICARE_PROCESSED_ROWS_COLLECTION =
    "BCS_Medicare_ProcessedRows";

let indexesInitialized =
    false;

/**
 * Returns the MongoDB collection used for queryable
 * Medicare processed-row data.
 */
async function getProcessedRowsCollection() {
    const connection =
        await connectToDatabase(
            MEDICARE_PROCESSED_ROWS_DATABASE
        );

    const database =
        connection?.db &&
            typeof connection.db.collection ===
            "function"
            ? connection.db
            : connection;

    if (
        !database ||
        typeof database.collection !==
        "function"
    ) {
        throw new Error(
            "connectToDatabase() did not return a valid MongoDB database."
        );
    }

    return database.collection(
        MEDICARE_PROCESSED_ROWS_COLLECTION
    );
}

/**
 * Normalizes general text used in MongoDB filters.
 */
export function normalizeMedicareText(
    value
) {
    return String(
        value ?? ""
    )
        .replace(
            /\s+/g,
            " "
        )
        .trim()
        .toLowerCase();
}

/**
 * Normalizes HICN or HCIN values for exact matching.
 */
export function normalizeMedicareHcin(
    value
) {
    return String(
        value ?? ""
    )
        .replace(
            /[^a-zA-Z0-9]/g,
            ""
        )
        .trim()
        .toUpperCase();
}

/**
 * Normalizes Medicare Request IDs.
 */
function normalizeMedicareRequestId(
    value
) {
    return String(
        value ?? ""
    )
        .trim()
        .toUpperCase();
}

/**
 * Creates indexes used by Medicare data questions.
 */
export async function ensureMedicareProcessedRowIndexes() {
    if (indexesInitialized) {
        return;
    }

    const collection =
        await getProcessedRowsCollection();

    await collection.createIndex(
        {
            requestId:
                1,

            sourceRowNumber:
                1
        },
        {
            name:
                "uq_medicare_row_request_source",

            unique:
                true
        }
    );

    await collection.createIndex(
        {
            requestId:
                1,

            hcinNormalized:
                1
        },
        {
            name:
                "idx_medicare_row_hcin"
        }
    );

    await collection.createIndex(
        {
            requestId:
                1,

            brokerNameNormalized:
                1,

            actionType:
                1
        },
        {
            name:
                "idx_medicare_row_broker_action"
        }
    );

    await collection.createIndex(
        {
            requestId:
                1,

            categoryNormalized:
                1
        },
        {
            name:
                "idx_medicare_row_category"
        }
    );

    await collection.createIndex(
        {
            requestId:
                1,

            targetYears:
                1
        },
        {
            name:
                "idx_medicare_row_target_year"
        }
    );

    await collection.createIndex(
        {
            cacheKey:
                1
        },
        {
            name:
                "idx_medicare_row_cache_key"
        }
    );

    indexesInitialized =
        true;

    console.log(
        "[MEDICARE ROW DATA] MongoDB indexes initialized."
    );
}

/**
 * Replaces all queryable rows for one Medicare Request ID.
 *
 * This function is safe for worker retries because it deletes rows
 * from an earlier attempt before inserting the latest processed rows.
 */
export async function replaceMedicareProcessedRows({
    requestId,
    cacheKey,
    fileHash,
    processorVersion,
    sourceFileName,
    rows
}) {
    if (!requestId) {
        throw new Error(
            "requestId is required when storing Medicare rows."
        );
    }

    if (!cacheKey) {
        throw new Error(
            "cacheKey is required when storing Medicare rows."
        );
    }

    if (!Array.isArray(rows)) {
        throw new Error(
            "rows must be an array."
        );
    }

    const normalizedRequestId =
        normalizeMedicareRequestId(
            requestId
        );

    if (!normalizedRequestId) {
        throw new Error(
            "The normalized Medicare Request ID is empty."
        );
    }

    /*
     * The unique MongoDB index uses requestId and sourceRowNumber.
     * Validate every source row number before deleting existing rows.
     */
    const seenSourceRowNumbers =
        new Set();

    for (const row of rows) {
        const sourceRowNumber =
            Number(
                row?.sourceRowNumber
            );

        if (
            !Number.isInteger(
                sourceRowNumber
            ) ||
            sourceRowNumber < 2
        ) {
            throw new Error(
                `Invalid Medicare sourceRowNumber: ` +
                `${row?.sourceRowNumber}`
            );
        }

        if (
            seenSourceRowNumbers.has(
                sourceRowNumber
            )
        ) {
            throw new Error(
                `Duplicate Medicare sourceRowNumber: ` +
                `${sourceRowNumber}`
            );
        }

        seenSourceRowNumbers.add(
            sourceRowNumber
        );
    }

    await ensureMedicareProcessedRowIndexes();

    const collection =
        await getProcessedRowsCollection();

    await collection.deleteMany({
        requestId:
            normalizedRequestId
    });

    if (rows.length === 0) {
        console.log(
            "[MEDICARE ROW DATA] No processed rows were supplied:",
            {
                requestId:
                    normalizedRequestId,

                storedRowCount:
                    0
            }
        );

        return {
            storedRowCount:
                0
        };
    }

    const storedAt =
        new Date();

    const documents =
        rows.map(
            function (
                row
            ) {
                const actionType =
                    row.actionType ||
                    row.sqlActionType ||
                    null;

                const sqlActionType =
                    row.sqlActionType ||
                    row.actionType ||
                    null;

                const targetYears =
                    Array.isArray(
                        row.targetYears
                    )
                        ? [
                            ...new Set(
                                row.targetYears
                                    .map(
                                        function (
                                            targetYear
                                        ) {
                                            return String(
                                                targetYear
                                            ).trim();
                                        }
                                    )
                                    .filter(
                                        function (
                                            targetYear
                                        ) {
                                            return /^20\d{2}$/.test(
                                                targetYear
                                            );
                                        }
                                    )
                            )
                        ]
                        : [];

                return {
                    requestId:
                        normalizedRequestId,

                    cacheKey,

                    fileHash:
                        fileHash ||
                        null,

                    processorVersion:
                        processorVersion ||
                        null,

                    sourceFileName:
                        sourceFileName ||
                        "",

                    sourceRowNumber:
                        Number(
                            row.sourceRowNumber
                        ),

                    hcin:
                        String(
                            row.hcin ||
                            ""
                        ).trim(),

                    hcinNormalized:
                        normalizeMedicareHcin(
                            row.hcin
                        ),

                    brokerCode:
                        String(
                            row.brokerCode ||
                            ""
                        ).trim(),

                    brokerName:
                        String(
                            row.brokerName ||
                            ""
                        ).trim(),

                    brokerNameNormalized:
                        normalizeMedicareText(
                            row.brokerName
                        ),

                    connectorId:
                        row.connectorId ??
                        null,

                    actionRequired:
                        String(
                            row.actionRequired ||
                            ""
                        ).trim(),

                    actionRequiredNormalized:
                        normalizeMedicareText(
                            row.actionRequired
                        ),

                    actionType,

                    sqlActionType,

                    category:
                        String(
                            row.category ||
                            ""
                        ).trim(),

                    categoryNormalized:
                        normalizeMedicareText(
                            row.category
                        ),

                    justification:
                        String(
                            row.justification ||
                            ""
                        ).trim(),

                    applicationStatus:
                        String(
                            row.applicationStatus ||
                            ""
                        ).trim(),

                    agencyMembershipEffectiveDate:
                        String(
                            row.agencyMembershipEffectiveDate ||
                            ""
                        ).trim(),

                    targetDate:
                        row.targetDate ||
                        null,

                    targetYears,

                    paymentSummary:
                        String(
                            row.paymentSummary ||
                            ""
                        ).trim(),

                    paymentRecordCount:
                        Math.max(
                            Number(
                                row.paymentRecordCount
                            ) ||
                            0,
                            0
                        ),

                    acceptRecordCount:
                        Math.max(
                            Number(
                                row.acceptRecordCount
                            ) ||
                            0,
                            0
                        ),

                    mbeRecordCount:
                        Math.max(
                            Number(
                                row.mbeRecordCount
                            ) ||
                            0,
                            0
                        ),

                    cmsRecordCount:
                        Math.max(
                            Number(
                                row.cmsRecordCount
                            ) ||
                            0,
                            0
                        ),

                    generatedSql:
                        row.generatedSql ===
                        true,

                    storedAt
                };
            }
        );

    const insertResult =
        await collection.insertMany(
            documents,
            {
                ordered:
                    true
            }
        );

    const storedRowCount =
        Number(
            insertResult.insertedCount
        ) ||
        0;

    if (
        storedRowCount !==
        documents.length
    ) {
        throw new Error(
            `Expected to insert ${documents.length} Medicare rows, ` +
            `but inserted ${storedRowCount}.`
        );
    }

    console.log(
        "[MEDICARE ROW DATA] Processed rows stored:",
        {
            requestId:
                normalizedRequestId,

            storedRowCount
        }
    );

    return {
        storedRowCount
    };
}

/**
 * Builds a MongoDB filter for Medicare row queries.
 */
function buildMongoFilter({
    requestId,
    brokerName,
    actionTypes,
    hcin,
    targetYear
}) {
    if (!requestId) {
        throw new Error(
            "requestId is required for Medicare row queries."
        );
    }

    const normalizedRequestId =
        normalizeMedicareRequestId(
            requestId
        );

    if (!normalizedRequestId) {
        throw new Error(
            "The normalized Medicare Request ID is empty."
        );
    }

    const filter = {
        requestId:
            normalizedRequestId
    };

    if (brokerName) {
        filter.brokerNameNormalized =
            normalizeMedicareText(
                brokerName
            );
    }

    if (
        Array.isArray(
            actionTypes
        ) &&
        actionTypes.length > 0
    ) {
        const normalizedActionTypes =
            actionTypes
                .map(
                    function (
                        actionType
                    ) {
                        return String(
                            actionType ||
                            ""
                        )
                            .trim()
                            .toUpperCase();
                    }
                )
                .filter(
                    Boolean
                );

        if (
            normalizedActionTypes.length >
            0
        ) {
            filter.actionType = {
                $in:
                    normalizedActionTypes
            };
        }
    }

    if (hcin) {
        filter.hcinNormalized =
            normalizeMedicareHcin(
                hcin
            );
    }

    if (targetYear) {
        filter.targetYears =
            String(
                targetYear
            ).trim();
    }

    return filter;
}

/**
 * Counts processed rows matching the supplied filters.
 */
export async function countMedicareProcessedRows({
    requestId,
    brokerName,
    actionTypes,
    hcin,
    targetYear
}) {
    await ensureMedicareProcessedRowIndexes();

    const collection =
        await getProcessedRowsCollection();

    const filter =
        buildMongoFilter({
            requestId,
            brokerName,
            actionTypes,
            hcin,
            targetYear
        });

    return collection.countDocuments(
        filter
    );
}

/**
 * Returns processed rows matching the supplied filters.
 */
export async function findMedicareProcessedRows({
    requestId,
    brokerName,
    actionTypes,
    hcin,
    targetYear,
    limit = 20
}) {
    await ensureMedicareProcessedRowIndexes();

    const collection =
        await getProcessedRowsCollection();

    const filter =
        buildMongoFilter({
            requestId,
            brokerName,
            actionTypes,
            hcin,
            targetYear
        });

    const normalizedLimit =
        Math.min(
            Math.max(
                Number(
                    limit
                ) ||
                20,
                1
            ),
            100
        );

    return collection
        .find(
            filter
        )
        .sort({
            sourceRowNumber:
                1
        })
        .limit(
            normalizedLimit
        )
        .toArray();
}

/**
 * Returns all stored rows for one HICN within a Request ID.
 */
export async function findMedicareProcessedRowsByHcin({
    requestId,
    hcin
}) {
    if (!hcin) {
        throw new Error(
            "hcin is required."
        );
    }

    return findMedicareProcessedRows({
        requestId,
        hcin,
        limit:
            100
    });
}

/**
 * Returns transaction counts grouped by broker and category.
 */
export async function aggregateMedicareRowsByBroker({
    requestId,
    brokerNames = []
}) {
    if (!requestId) {
        throw new Error(
            "requestId is required."
        );
    }

    await ensureMedicareProcessedRowIndexes();

    const collection =
        await getProcessedRowsCollection();

    const match = {
        requestId:
            normalizeMedicareRequestId(
                requestId
            )
    };

    if (
        Array.isArray(
            brokerNames
        ) &&
        brokerNames.length > 0
    ) {
        const normalizedBrokerNames =
            brokerNames
                .map(
                    normalizeMedicareText
                )
                .filter(
                    Boolean
                );

        if (
            normalizedBrokerNames.length >
            0
        ) {
            match.brokerNameNormalized = {
                $in:
                    normalizedBrokerNames
            };
        }
    }

    return collection.aggregate([
        {
            $match:
                match
        },
        {
            $group: {
                _id: {
                    brokerName:
                        "$brokerName",

                    category:
                        "$category"
                },

                transactions: {
                    $sum:
                        1
                }
            }
        },
        {
            $sort: {
                "_id.brokerName":
                    1,

                "_id.category":
                    1
            }
        }
    ]).toArray();
}

/**
 * Counts all queryable rows stored for one Medicare Request ID.
 */
export async function countStoredMedicareRows(
    requestId
) {
    if (!requestId) {
        return 0;
    }

    await ensureMedicareProcessedRowIndexes();

    const collection =
        await getProcessedRowsCollection();

    return collection.countDocuments({
        requestId:
            normalizeMedicareRequestId(
                requestId
            )
    });
}

/**
 * Deletes all queryable rows for one Medicare Request ID.
 */
export async function deleteMedicareProcessedRowsByRequestId(
    requestId
) {
    if (!requestId) {
        throw new Error(
            "requestId is required."
        );
    }

    await ensureMedicareProcessedRowIndexes();

    const collection =
        await getProcessedRowsCollection();

    const normalizedRequestId =
        normalizeMedicareRequestId(
            requestId
        );

    const result =
        await collection.deleteMany({
            requestId:
                normalizedRequestId
        });

    console.log(
        "[MEDICARE ROW DATA] Processed rows deleted:",
        {
            requestId:
                normalizedRequestId,

            deletedCount:
                result.deletedCount
        }
    );

    return result;
}