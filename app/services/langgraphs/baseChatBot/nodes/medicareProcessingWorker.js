import crypto from "crypto";
import {
    pathToFileURL
} from "url";
// import {
//     setProcessEnvironment
// } from '../../../../../scripts/configActions.js';

import {
    readFileBufferFromBlobStorage,
    writeFileBufferToBlobStorage
} from '@/app/services/blobStorageService';
import {
    findMedicareCacheByCacheKey,
    saveCompletedMedicareCache,
    saveMedicareJiraIssueKey,
    reserveMedicareJiraCreation,
    releaseMedicareJiraCreation,
    markMedicareCacheFailed
} from './medicareBatchCache.js';


import {
    claimNextMedicareProcessingJob,
    markMedicareQueueJobCompleted,
    markMedicareQueueJobFailed,
    requeueMedicareProcessingJob
} from "./medicareProcessingQueue.js";

import {
    processExcelBatch,
    createMedicareJiraIssue,
    attachSqlBufferToJira
} from "./medicarePaymentDiagnosticNode.js";
import {
    replaceMedicareProcessedRows
} from "./medicareProcessedRows.js";


const WORKER_POLL_INTERVAL_MS =
    5000;

const MAX_JOB_ATTEMPTS =
    3;

const workerId =
    `medicare-worker-${process.pid}-${crypto
        .randomBytes(4)
        .toString("hex")}`;

function wait(
    milliseconds
) {
    return new Promise(resolve => {
        setTimeout(
            resolve,
            milliseconds
        );
    });
}
function applyJiraIssueKeyToSql(
    sqlText,
    jiraIssueKey
) {
    if (!jiraIssueKey) {
        throw new Error(
            "A Jira issue key is required before finalizing the SQL file."
        );
    }

    const sourceSqlText =
        String(
            sqlText || ""
        );

    const finalSqlText =
        sourceSqlText.replace(
            /\b(MMT_UPDT_USR_ID|MCT_UPDT_USR_ID|MPA_UPDT_USR_ID)\s*=\s*''/gi,
            (match, fieldName) =>
                `${fieldName}='${jiraIssueKey}'`
        );

    return finalSqlText;
}
export async function processMedicareJob(
    queueJob
) {
    const job =
        queueJob?.payload;

    if (!job) {
        throw new Error(
            "The claimed Medicare queue job does not contain a payload."
        );
    }

    const {
        requestId,
        cacheKey,
        fileHash,
        processorVersion,
        sourceContainerName,
        sourceBlobName,
        outputContainerName,
        attachmentName,
        sourceFileSize,
        requestedBy,
        teamName,
        processingContext
    } = job;

    if (!requestId) {
        throw new Error(
            "The Medicare queue job does not contain requestId."
        );
    }

    if (!cacheKey) {
        throw new Error(
            "The Medicare queue job does not contain cacheKey."
        );
    }

    if (!sourceContainerName) {
        throw new Error(
            "The Medicare queue job does not contain sourceContainerName."
        );
    }

    if (!sourceBlobName) {
        throw new Error(
            "The Medicare queue job does not contain sourceBlobName."
        );
    }

    if (!outputContainerName) {
        throw new Error(
            "The Medicare queue job does not contain outputContainerName."
        );
    }

    console.log(
        "[MEDICARE WORKER] Processing job:",
        {
            workerId,
            requestId,
            cacheKey,
            attempt:
                queueJob?.attempts || 1,
            sourceContainerName,
            sourceBlobName,
            outputContainerName
        }
    );

    try {
        const existingCacheRecord =
            await findMedicareCacheByCacheKey(
                cacheKey
            );

        if (
            existingCacheRecord?.status ===
            "COMPLETED"
        ) {
            await markMedicareQueueJobCompleted(
                cacheKey
            );

            console.log(
                "[MEDICARE WORKER] Cache record is already completed:",
                {
                    requestId,
                    cacheKey
                }
            );

            return;
        }

        const uploadedFileBuffer =
            await readFileBufferFromBlobStorage(
                sourceContainerName,
                sourceBlobName
            );

        console.log(
            "[MEDICARE WORKER] Source Excel downloaded:",
            {
                requestId,
                fileSize:
                    uploadedFileBuffer.length
            }
        );

        const processingStartTime =
            Date.now();

        const processingResult =
            await processExcelBatch(
                uploadedFileBuffer,
                processingContext || {}
            );

        if (!processingResult) {
            throw new Error(
                "processExcelBatch() did not return a processing result."
            );
        }

        const {
            excelBuffer,
            sqlText,
            totalRecords = 0,
            generatedSqlActionCount = 0,
            unsupportedSqlActionCount = 0,
            processedRows = []
        } = processingResult;

        if (!excelBuffer) {
            throw new Error(
                "processExcelBatch() did not return an Excel buffer."
            );
        }
        if (
            !Array.isArray(
                processedRows
            )
        ) {
            throw new Error(
                "processExcelBatch() did not return processedRows as an array."
            );
        }

        if (
            totalRecords > 0 &&
            processedRows.length === 0
        ) {
            throw new Error(
                "No queryable Medicare rows were produced for the processed workbook."
            );
        }

        if (
            processedRows.length !==
            totalRecords
        ) {
            throw new Error(
                `Processed-row count mismatch. Expected ${totalRecords} rows, ` +
                `but received ${processedRows.length}.`
            );
        }

        console.log(
            "[MEDICARE WORKER] Medicare processing completed:",
            {
                requestId,
                durationMilliseconds:
                    Date.now() -
                    processingStartTime,
                totalRecords,
                processedRowCount: processedRows.length,
                generatedSqlActionCount,
                unsupportedSqlActionCount
            }
        );

        const timestamp =
            Date.now();

        const excelBlobName =
            `Medicare_Processed_Result_${timestamp}.xlsx`;

        const sqlBlobName =
            `database_update_queries_${timestamp}.txt`;

        const normalizedExcelBuffer =
            Buffer.isBuffer(
                excelBuffer
            )
                ? excelBuffer
                : Buffer.from(
                    excelBuffer
                );

        const draftSqlText =
            typeof sqlText ===
                "string" &&
                sqlText.trim().length > 0
                ? sqlText
                : [
                    "-- Medicare Batch SQL Generation Report",
                    `-- Generated at: ${new Date().toISOString()}`,
                    "-- No executable SQL statements were generated.",
                    ""
                ].join("\n");

        let jiraIssueKey =
            existingCacheRecord?.jira
                ?.issueKey ||
            null;

        if (!jiraIssueKey) {
            const jiraCreationReserved =
                await reserveMedicareJiraCreation(
                    cacheKey
                );

            if (jiraCreationReserved) {
                try {
                    jiraIssueKey =
                        await createMedicareJiraIssue(
                            attachmentName
                        );

                    if (!jiraIssueKey) {
                        throw new Error(
                            "Jira issue creation did not return an issue key."
                        );
                    }

                    await saveMedicareJiraIssueKey({
                        cacheKey,
                        jiraIssueKey
                    });
                } catch (jiraCreationError) {
                    await releaseMedicareJiraCreation(
                        cacheKey
                    );

                    throw jiraCreationError;
                }
            } else {
                const refreshedCacheRecord =
                    await findMedicareCacheByCacheKey(
                        cacheKey
                    );

                jiraIssueKey =
                    refreshedCacheRecord?.jira
                        ?.issueKey ||
                    null;

                if (!jiraIssueKey) {
                    const jiraCreationReserved =
                        await reserveMedicareJiraCreation(
                            cacheKey
                        );

                    if (jiraCreationReserved) {
                        try {
                            jiraIssueKey =
                                await createMedicareJiraIssue(
                                    attachmentName
                                );

                            if (!jiraIssueKey) {
                                throw new Error(
                                    "Jira issue creation did not return an issue key."
                                );
                            }

                            await saveMedicareJiraIssueKey({
                                cacheKey,
                                jiraIssueKey
                            });
                        } catch (jiraCreationError) {
                            await releaseMedicareJiraCreation(
                                cacheKey
                            );

                            throw jiraCreationError;
                        }
                    } else {
                        /*
                         * Another worker may be creating Jira.
                         * Wait briefly for the issue key to appear.
                         */
                        const jiraWaitAttempts =
                            6;

                        const jiraWaitMilliseconds =
                            5000;

                        for (
                            let jiraWaitAttempt = 1;
                            jiraWaitAttempt <= jiraWaitAttempts;
                            jiraWaitAttempt++
                        ) {
                            await wait(
                                jiraWaitMilliseconds
                            );

                            const refreshedCacheRecord =
                                await findMedicareCacheByCacheKey(
                                    cacheKey
                                );

                            jiraIssueKey =
                                refreshedCacheRecord?.jira
                                    ?.issueKey ||
                                null;

                            console.log(
                                "[MEDICARE WORKER] Waiting for Jira issue key:",
                                {
                                    requestId,
                                    cacheKey,
                                    jiraWaitAttempt,
                                    jiraWaitAttempts,
                                    jiraIssueAvailable:
                                        Boolean(
                                            jiraIssueKey
                                        )
                                }
                            );

                            if (jiraIssueKey) {
                                break;
                            }
                        }

                        if (!jiraIssueKey) {
                            /*
                             * Release any stale reservation so the next
                             * retry can create Jira.
                             */
                            await releaseMedicareJiraCreation(
                                cacheKey
                            );

                            throw new Error(
                                "No Jira issue key was available after waiting for Jira creation."
                            );
                        }
                    }
                }
            }
        }

        const finalSqlText =
            applyJiraIssueKeyToSql(
                draftSqlText,
                jiraIssueKey
            );

        const sqlBuffer =
            Buffer.from(
                finalSqlText,
                "utf8"
            );

        const [
            excelUploadSuccess,
            sqlUploadSuccess
        ] = await Promise.all([
            writeFileBufferToBlobStorage(
                normalizedExcelBuffer,
                outputContainerName,
                excelBlobName,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            ),

            writeFileBufferToBlobStorage(
                sqlBuffer,
                outputContainerName,
                sqlBlobName,
                "text/plain; charset=utf-8"
            )
        ]);

        if (!excelUploadSuccess) {
            throw new Error(
                "Failed to upload the processed Excel file."
            );
        }

        if (!sqlUploadSuccess) {
            throw new Error(
                "Failed to upload the SQL output file."
            );
        }

        const jiraAttachmentUploaded =
            await attachSqlBufferToJira(
                jiraIssueKey,
                sqlBuffer,
                sqlBlobName
            );

        if (!jiraAttachmentUploaded) {
            throw new Error(
                `Failed to attach the SQL file to Jira issue ${jiraIssueKey}.`
            );
        }

        console.log(
            "[MEDICARE WORKER] Output files uploaded and SQL attached to Jira:",
            {
                requestId,
                excelBlobName,
                sqlBlobName,
                jiraIssueKey
            }
        );
        const rowStorageResult =
            await replaceMedicareProcessedRows({
                requestId,

                cacheKey,

                fileHash,

                processorVersion,

                sourceFileName:
                    attachmentName,

                rows:
                    processedRows
            });

        const storedRowCount =
            Number(
                rowStorageResult?.storedRowCount ||
                0
            );

        if (
            storedRowCount !==
            processedRows.length
        ) {
            throw new Error(
                `Expected to store ${processedRows.length} Medicare rows, ` +
                `but stored ${storedRowCount}.`
            );
        }

        console.log(
            "[MEDICARE WORKER] Queryable rows stored:",
            {
                requestId,

                storedRowCount
            }
        );
        await saveCompletedMedicareCache({
            requestId,

            cacheKey,

            fileHash,

            processorVersion,

            sourceFileName:
                attachmentName,

            sourceFileSize,

            excelBlobName,

            sqlBlobName,

            totalRecords,

            generatedSqlActionCount,

            unsupportedSqlActionCount,

            requestedBy,

            teamName,

            jiraIssueKey,

            storedRowCount,

            queryDataAvailable:
                storedRowCount > 0
        });

        await markMedicareQueueJobCompleted(
            cacheKey
        );

        console.log(
            "[MEDICARE WORKER] Job completed successfully:",
            {
                requestId,

                cacheKey,

                excelBlobName,

                sqlBlobName,

                jiraIssueKey,

                storedRowCount
            }
        );
    } catch (error) {
        const errorMessage =
            error instanceof Error
                ? error.message
                : String(error);

        const attempts =
            Number(
                queueJob?.attempts ||
                1
            );

        console.error(
            "[MEDICARE WORKER] Job failed:",
            {
                requestId,
                cacheKey,
                attempts,
                error:
                    errorMessage
            }
        );

        if (
            attempts <
            MAX_JOB_ATTEMPTS
        ) {
            const retryDelayMilliseconds =
                Math.min(
                    attempts *
                    60 *
                    1000,
                    5 *
                    60 *
                    1000
                );

            await requeueMedicareProcessingJob(
                cacheKey,
                error,
                retryDelayMilliseconds
            );

            console.log(
                "[MEDICARE WORKER] Job returned to queue:",
                {
                    requestId,
                    cacheKey,
                    nextAttempt:
                        attempts + 1
                }
            );

            return;
        }

        await markMedicareCacheFailed(
            cacheKey,
            error
        );

        await markMedicareQueueJobFailed(
            cacheKey,
            error
        );

        console.error(
            "[MEDICARE WORKER] Job permanently failed:",
            {
                requestId,
                cacheKey,
                attempts,
                error:
                    errorMessage
            }
        );
    }
}

export async function startMedicareWorker() {


    console.log(
        "[MEDICARE WORKER] Worker started:",
        {
            workerId,
            pollIntervalMilliseconds:
                WORKER_POLL_INTERVAL_MS,
            maxJobAttempts:
                MAX_JOB_ATTEMPTS,
            envName:
                process.env.envName
        }
    );

    while (true) {
        try {
            const queueJob =
                await claimNextMedicareProcessingJob(
                    workerId
                );

            if (!queueJob) {
                await wait(
                    WORKER_POLL_INTERVAL_MS
                );

                continue;
            }

            console.log(
                "[MEDICARE WORKER] Queue job claimed:",
                {
                    requestId:
                        queueJob.requestId,
                    cacheKey:
                        queueJob.cacheKey,
                    status:
                        queueJob.status,
                    attempts:
                        queueJob.attempts
                }
            );

            await processMedicareJob(
                queueJob
            );
        } catch (error) {
            console.error(
                "[MEDICARE WORKER] Worker loop error:",
                error
            );

            await wait(
                WORKER_POLL_INTERVAL_MS
            );
        }
    }
}

const isWorkerStartedDirectly =
    process.argv[1] &&
    pathToFileURL(
        process.argv[1]
    ).href ===
    import.meta.url;

if (isWorkerStartedDirectly) {
    startMedicareWorker().catch(error => {
        console.error(
            "[MEDICARE WORKER] Fatal startup error:",
            error
        );

        process.exit(1);
    });
}