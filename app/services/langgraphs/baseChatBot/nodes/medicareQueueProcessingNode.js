import crypto from "crypto";

// import {
//     setProcessEnvironment
// } from "../../../../../scripts/configActions.js";

import {
    claimMedicareProcessingJobByRequest,
    claimNextMedicareProcessingJob
} from "./medicareProcessingQueue.js";

import {
    processMedicareJob
} from "./medicareProcessingWorker.js";

/**
 * Claims and processes one Medicare queue job.
 *
 * When invoked with a Request ID or cache key, the node
 * processes only that exact job.
 *
 * FIFO processing is used only when the node is invoked
 * without a specific Request ID or cache key.
 */
export async function medicareQueueProcessingNode(
    state = {}
) {
    const processorId =
        `medicare-node-${process.pid}-${crypto
            .randomBytes(4)
            .toString("hex")}`;

    const triggeredRequestId =
        state?.requestId
            ? String(
                state.requestId
            )
                .trim()
                .toUpperCase()
            : null;

    const triggeredCacheKey =
        state?.cacheKey
            ? String(
                state.cacheKey
            ).trim()
            : null;

    const hasSpecificTrigger =
        Boolean(
            triggeredRequestId ||
            triggeredCacheKey
        );

    try {


        console.log(
            "[MEDICARE PROCESSING NODE] Checking queue:",
            {
                processorId,
                triggeredRequestId,
                triggeredCacheKey,

                claimMode:
                    hasSpecificTrigger
                        ? "EXACT_REQUEST"
                        : "FIFO"
            }
        );

        let queueJob =
            null;

        if (hasSpecificTrigger) {
            queueJob =
                await claimMedicareProcessingJobByRequest({
                    requestId:
                        triggeredRequestId,

                    cacheKey:
                        triggeredCacheKey,

                    workerId:
                        processorId
                });
        } else {
            queueJob =
                await claimNextMedicareProcessingJob(
                    processorId
                );
        }

        if (!queueJob) {
            console.warn(
                "[MEDICARE PROCESSING NODE] No eligible job found:",
                {
                    processorId,
                    triggeredRequestId,
                    triggeredCacheKey,

                    reason:
                        hasSpecificTrigger
                            ? "TRIGGERED_JOB_NOT_AVAILABLE"
                            : "NO_QUEUED_JOB"
                }
            );

            return {
                ...state,

                medicareBackgroundProcessing: {
                    jobFound:
                        false,

                    processed:
                        false,

                    processorId,

                    triggeredRequestId,

                    triggeredCacheKey,

                    reason:
                        hasSpecificTrigger
                            ? "TRIGGERED_JOB_NOT_AVAILABLE"
                            : "NO_QUEUED_JOB"
                }
            };
        }

        if (
            triggeredRequestId &&
            queueJob.requestId !==
            triggeredRequestId
        ) {
            throw new Error(
                `Medicare queue mismatch. ` +
                `Triggered for ${triggeredRequestId}, ` +
                `but claimed ${queueJob.requestId}.`
            );
        }

        if (
            triggeredCacheKey &&
            queueJob.cacheKey !==
            triggeredCacheKey
        ) {
            throw new Error(
                `Medicare queue mismatch. ` +
                `Triggered cache key ${triggeredCacheKey}, ` +
                `but claimed ${queueJob.cacheKey}.`
            );
        }

        console.log(
            "[MEDICARE PROCESSING NODE] Job claimed:",
            {
                processorId,

                triggeredRequestId,

                requestId:
                    queueJob.requestId,

                cacheKey:
                    queueJob.cacheKey,

                status:
                    queueJob.status,

                attempts:
                    queueJob.attempts,

                claimMode:
                    hasSpecificTrigger
                        ? "EXACT_REQUEST"
                        : "FIFO"
            }
        );

        await processMedicareJob(
            queueJob
        );

        console.log(
            "[MEDICARE PROCESSING NODE] Processing invocation finished:",
            {
                processorId,

                triggeredRequestId,

                processedRequestId:
                    queueJob.requestId,

                cacheKey:
                    queueJob.cacheKey
            }
        );

        return {
            ...state,

            medicareBackgroundProcessing: {
                jobFound:
                    true,

                processed:
                    true,

                processorId,

                triggeredRequestId,

                processedRequestId:
                    queueJob.requestId,

                cacheKey:
                    queueJob.cacheKey
            }
        };
    } catch (error) {
        console.error(
            "[MEDICARE PROCESSING NODE] Processing failed:",
            {
                processorId,
                triggeredRequestId,
                triggeredCacheKey,

                error:
                    error instanceof Error
                        ? error.message
                        : String(error)
            }
        );

        return {
            ...state,

            medicareBackgroundProcessing: {
                jobFound:
                    false,

                processed:
                    false,

                processorId,

                triggeredRequestId,

                triggeredCacheKey,

                error:
                    error instanceof Error
                        ? error.message
                        : String(error)
            }
        };
    }
}