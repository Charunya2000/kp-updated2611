import {
    after
} from "next/server";
import {
    medicareQueueProcessingNode
} from "./medicareQueueProcessingNode.js";
import ExcelJS from 'exceljs-hardened';
import oracledb from 'oracledb';
import fs from "fs/promises";
// import { AzureOpenAI } from 'openai';

import { writeFileBufferToBlobStorage, generateTemporaryDownloadLink } from '@/app/services/blobStorageService'; // Adjust this path to match exactly where your helpers are located
import {
    enqueueMedicareProcessingJob
} from './medicareProcessingQueue.js';
import {
    chatCompletion
} from  "@/app/services/chatCompletionService2";

import {
    ensureMedicareCacheIndexes,
    findMedicareCacheByRequestId,
    findMedicareCacheByCacheKey,
    markMedicareCacheProcessing,
    markMedicareCacheFailed
} from './medicareBatchCache.js';
import crypto from 'crypto';
import {
    answerMedicareDataQuestion,
    looksLikeMedicareDataQuestion,
    isMedicareFileOutputRequest,
    answerMedicareMongoDatabaseSummaryQuestion,
    isMedicareMongoDatabaseSummaryQuestion
} from "./medicareDataQuestionService.js";

import {
    countStoredMedicareRows
} from "./medicareProcessedRows.js";


oracledb.bindByName = true;
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = true;

const envName = process.env['envName'];
const JIRA_CONFIG = {
    ENABLED: true,
    JIRA_URL: "https://jira-aes.kp.org",

    JIRA_TOKEN:  process.env[`host.${envName}-aiportal-web-2.bcs.jira.apikey`],
    JIRA_PROJECT_KEY: "BCS",
    JIRA_ISSUE_TYPE: "Task",
     JIRA_DESCRIPTION:
        "Auto-generated Medicare SQL output."

};


function buildMedicareJiraIssueUrl(
    jiraIssueKey
) {
    const normalizedIssueKey =
        String(
            jiraIssueKey ||
            ""
        )
            .trim()
            .toUpperCase();

    if (!normalizedIssueKey) {
        return null;
    }

    const jiraBaseUrl =
        String(
            JIRA_CONFIG.JIRA_URL ||
            ""
        )
            .trim()
            .replace(
                /\/+$/,
                ""
            );

    if (!jiraBaseUrl) {
        return null;
    }

    return (
        `${jiraBaseUrl}/browse/` +
        `${encodeURIComponent(normalizedIssueKey)}`
    );
}
function extractMonthFromFileName(
    fileName
) {
    const normalizedFileName =
        String(
            fileName ||
            ""
        )
            .replace(
                /\.[^.]+$/,
                ""
            )
            .replace(
                /[_-]+/g,
                " "
            )
            .toLowerCase();

    const monthPatterns = [
        [
            "January",
            /\b(?:january|jan)\b/i
        ],
        [
            "February",
            /\b(?:february|feb)\b/i
        ],
        [
            "March",
            /\b(?:march|mar)\b/i
        ],
        [
            "April",
            /\b(?:april|apr)\b/i
        ],
        [
            "May",
            /\bmay\b/i
        ],
        [
            "June",
            /\b(?:june|jun)\b/i
        ],
        [
            "July",
            /\b(?:july|jul)\b/i
        ],
        [
            "August",
            /\b(?:august|augest|aug)\b/i
        ],
        [
            "September",
            /\b(?:september|sept|sep)\b/i
        ],
        [
            "October",
            /\b(?:october|oct)\b/i
        ],
        [
            "November",
            /\b(?:november|nov)\b/i
        ],
        [
            "December",
            /\b(?:december|dec)\b/i
        ]
    ];

    for (
        const [
            monthName,
            monthPattern
        ] of monthPatterns
    ) {
        if (
            monthPattern.test(
                normalizedFileName
            )
        ) {
            return monthName;
        }
    }

    return null;
}

function buildMedicareJiraSummary(
    sourceFileName
) {
    const monthName =
        extractMonthFromFileName(
            sourceFileName
        );

    if (monthName) {
        return (
            "Request to execute queries in Prod - " +
            `Medicare ${monthName} file`
        );
    }

    return (
        "Request to execute queries in Prod - Medicare file"
    );
}

export async function createMedicareJiraIssue(
    sourceFileName
) {
    if (!JIRA_CONFIG.ENABLED) {
        return null;
    }

    if (!JIRA_CONFIG.JIRA_URL) {
        throw new Error(
            "JIRA_URL is not configured."
        );
    }

    if (!JIRA_CONFIG.JIRA_TOKEN) {
        throw new Error(
            "JIRA_TOKEN is not configured."
        );
    }

    const jiraSummary =
        buildMedicareJiraSummary(
            sourceFileName
        );

    console.log(
        "[JIRA] Creating Medicare issue:",
        {
            sourceFileName:
                sourceFileName ||
                null,

            summary:
                jiraSummary
        }
    );

    const createRes =
        await fetch(
            `${JIRA_CONFIG.JIRA_URL}/rest/api/2/issue`,
            {
                method:
                    "POST",

                headers: {
                    Authorization:
                        `Bearer ${JIRA_CONFIG.JIRA_TOKEN}`,

                    Accept:
                        "application/json",

                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({
                        fields: {
                            project: {
                                key:
                                    JIRA_CONFIG.JIRA_PROJECT_KEY
                            },

                            summary:
                                jiraSummary,

                            description:
                                JIRA_CONFIG.JIRA_DESCRIPTION,

                            issuetype: {
                                name:
                                    JIRA_CONFIG.JIRA_ISSUE_TYPE
                            }
                        }
                    })
            }
        );

    if (!createRes.ok) {
        const jiraErrorText =
            await createRes.text();

        throw new Error(
            `Jira issue creation failed: ${jiraErrorText}`
        );
    }

    const issueData =
        await createRes.json();

    const issueKey =
        issueData?.key;

    if (!issueKey) {
        throw new Error(
            "Jira issue creation response did not contain an issue key."
        );
    }

    console.log(
        "[JIRA] Issue created:",
        {
            issueKey,

            summary:
                jiraSummary
        }
    );

    return issueKey;
}
export async function attachSqlBufferToJira(
    issueKey,
    sqlBuffer,
    sqlFileName
) {
    if (!JIRA_CONFIG.ENABLED) {
        return false;
    }

    if (!issueKey) {
        throw new Error(
            "issueKey is required for Jira attachment upload."
        );
    }

    if (!JIRA_CONFIG.JIRA_TOKEN) {
        throw new Error(
            "JIRA_TOKEN is not configured."
        );
    }

    if (!Buffer.isBuffer(sqlBuffer)) {
        throw new Error(
            "sqlBuffer must be a Buffer."
        );
    }

    const form =
        new FormData();

    form.append(
        "file",
        new Blob(
            [sqlBuffer],
            {
                type:
                    "text/plain"
            }
        ),
        sqlFileName
    );

    const attachRes =
        await fetch(
            `${JIRA_CONFIG.JIRA_URL}/rest/api/2/issue/${issueKey}/attachments`,
            {
                method:
                    "POST",

                headers: {
                    Authorization:
                        `Bearer ${JIRA_CONFIG.JIRA_TOKEN}`,

                    "X-Atlassian-Token":
                        "no-check"
                },

                body:
                    form
            }
        );

    if (!attachRes.ok) {
        throw new Error(
            `Jira attachment upload failed: ${await attachRes.text()}`
        );
    }

    console.log(
        "[JIRA] SQL attachment uploaded:",
        {
            issueKey,
            sqlFileName
        }
    );

    return true;
}
function getExcelCellText(cellValue) {
    if (
        cellValue === null ||
        cellValue === undefined
    ) {
        return "";
    }

    if (
        typeof cellValue === "string" ||
        typeof cellValue === "number" ||
        typeof cellValue === "boolean"
    ) {
        return String(cellValue).trim();
    }

    if (
        typeof cellValue === "object" &&
        Array.isArray(cellValue.richText)
    ) {
        return cellValue.richText
            .map(part =>
                String(part?.text || "")
            )
            .join("")
            .trim();
    }

    if (
        typeof cellValue === "object" &&
        typeof cellValue.text === "string"
    ) {
        return cellValue.text.trim();
    }

    if (
        typeof cellValue === "object" &&
        cellValue.result !== undefined
    ) {
        return String(
            cellValue.result
        ).trim();
    }

    return String(cellValue).trim();
}
function normalizeStoredHcin(
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

function normalizeStoredText(
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
function extractYearsFromActionText(actionText) {
    const normalizedAction =
        String(actionText ?? "")
            .replace(/\s+/g, " ")
            .trim()
            .toUpperCase();

    const yearMatches =
        normalizedAction.match(/\b20\d{2}\b/g) || [];

    return [...new Set(yearMatches)];
}

function getCompletionResponseText(response) {
    /*
     * Your chatCompletion reference code indicates that the service
     * normally returns the generated text directly.
     */
    if (typeof response === "string") {
        return response.trim();
    }

    /*
     * Support an OpenAI-compatible response as a fallback.
     */
    if (
        typeof response?.choices?.[0]?.message?.content ===
        "string"
    ) {
        return response.choices[0].message.content.trim();
    }

    if (typeof response?.content === "string") {
        return response.content.trim();
    }

    if (
        typeof response?.message?.content === "string"
    ) {
        return response.message.content.trim();
    }

    if (typeof response?.data === "string") {
        return response.data.trim();
    }

    if (
        typeof response?.data?.content === "string"
    ) {
        return response.data.content.trim();
    }

    throw new Error(
        "chatCompletion returned an unsupported response format."
    );
}

function parseJsonFromCompletion(response) {
    const responseText =
        getCompletionResponseText(response);

    /*
     * First look for a fenced JSON block.
     */
    let jsonMatch =
        /```json\s*([\s\S]*?)\s*```/i.exec(
            responseText
        );

    /*
     * Otherwise look for a JSON object in the response.
     */
    if (!jsonMatch) {
        jsonMatch =
            /({[\s\S]*})/.exec(responseText);
    }

    const jsonString =
        jsonMatch?.[1] || responseText;

    return JSON.parse(jsonString);
}
async function extractParamsWithAI(
    actionText,
    hcin,
    state
) {
    /*
     * Deterministic fallback for action values such as:
     *
     * Pay Yr2026 Renewal
     * Reverse Yr2025 CB
     * CB Comm for Yrs2024 - 2026
     */
    const fallbackTargetYears =
        extractYearsFromActionText(actionText);

    const systemMessage = {
        role: "system",
        content: `
You extract structured date information from Medicare payment action requirements.

Return only a valid JSON object.
Do not return Markdown, code fences, or explanatory text.

Required response structure:
{
    "targetDate": null,
    "targetYears": ["2026"]
}

Rules:
1. targetDate must use YYYY-MM-DD format.
2. Use null when no exact target date exists.
3. targetYears must include all four-digit years referenced in the action.
4. Use an empty array when no target year exists.
`.trim()
    };

    const userMessage = {
        role: "user",
        content: `
Analyze this Medicare action requirement.

Extract the target years or exact target date.

Action Text: "${actionText}"
HICN: "${hcin}"
`.trim()
    };

    const completionConfig = {
        temperature: 0,
        max_tokens: 500,
        model: "gpt-4o",
        messages: [
            systemMessage,
            userMessage
        ],
        teamName: state?.teamName,
        assistantName: state?.assistantName,
        nuid: state?.nuid
    };

    try {
        const response =
            await chatCompletion(completionConfig);

        const intentResponse =
            parseJsonFromCompletion(response);

        const aiTargetYears =
            Array.isArray(
                intentResponse?.targetYears
            )
                ? intentResponse.targetYears
                    .map(year =>
                        String(year).trim()
                    )
                    .filter(year =>
                        /^20\d{2}$/.test(year)
                    )
                : [];

        const targetYears =
            aiTargetYears.length > 0
                ? [...new Set(aiTargetYears)]
                : fallbackTargetYears;

        const rawTargetDate =
            intentResponse?.targetDate;

        const targetDate =
            rawTargetDate &&
            String(rawTargetDate)
                .trim()
                .toLowerCase() !== "null"
                ? String(rawTargetDate).trim()
                : null;

        return {
            targetDate,
            targetYears,
            errorFlag: false,
            errorMessage: null
        };
    } catch (error) {
        console.error(
            "[AI ERROR] Medicare parameter extraction failed:",
            {
                hasHcin:
                    Boolean(
                        hcin
                    ),
        
                error:
                    error instanceof Error
                        ? error.message
                        : String(error)
            }
        );
        /*
         * Preserve deterministic years when chatCompletion fails.
         */
        return {
            targetDate: null,
            targetYears:
                fallbackTargetYears,
            errorFlag: true,
            errorMessage:
                error instanceof Error
                    ? error.message
                    : String(error)
        };
    }
}

// ============================================================================
// 2. ORACLE DB QUERY UTILITY & SQL QUERIES
// ============================================================================
async function queryOracleDB(
    connection,
    sqlQuery,
    bindParams = {}
) {
    if (!connection) {
        throw new Error(
            "Oracle connection is undefined."
        );
    }

    if (
        typeof connection.execute !==
        "function"
    ) {
        throw new Error(
            "Invalid Oracle connection: execute() is unavailable."
        );
    }

    const result =
        await connection.execute(
            sqlQuery,
            bindParams
        );

    return result.rows || [];
}

const paymentQuery = `
    SELECT TO_CHAR(EFFECTIVEDATE, 'YYYY-MM-DD') as EFFECTIVEDATE, REVENUE, TRANSACTIONCODE as TYPE, TO_CHAR(compensationdate, 'YYYY-MM-DD') as COMPENSATIONDATE, '1dep' as PAYMENTSTATUS 
    FROM BSC.KPCA_MEDICARE_DEPOSIT_HISTORY WHERE TRANSACTIONDESC IN (SELECT mmt_hicn FROM mhl_mbe_hicn_lkup_t WHERE mhl_ik IN (SELECT mhl_ik FROM mhl_mbe_hicn_lkup_t WHERE mmt_hicn IN (:hicn)))
    UNION ALL
    SELECT TO_CHAR(EFFECTIVEDATE, 'YYYY-MM-DD') as EFFECTIVEDATE, REVENUE, TRANSACTIONCODE as TYPE, TO_CHAR(compensationdate, 'YYYY-MM-DD') as COMPENSATIONDATE, '2cre' as PAYMENTSTATUS 
    FROM BSC.KPCA_MEDICARE_CREDIT WHERE TRANSACTIONDESC IN (SELECT mmt_hicn FROM mhl_mbe_hicn_lkup_t WHERE mhl_ik IN (SELECT mhl_ik FROM mhl_mbe_hicn_lkup_t WHERE mmt_hicn IN (:hicn)))
`;

const acceptQuery = `
    SELECT MPA_IK, CONNECTORID, TO_CHAR(MCT_ENRL_EFF_DT, 'YYYY-MM-DD') as CMSEFFECTIVEDATE, TO_CHAR(MMT_AGT_TERM_DT, 'YYYY-MM-DD') as TERMDATE, MPA_TRAN_IND as TYPE, MMT_NEW_TO_KP_FLG as NEWTOKPFLAG, MMT_VOL_FLG as TERMFLAG
    FROM BASE.MPA_TRAN_ACPT_T WHERE MMT_HICN IN (SELECT mmt_hicn FROM mhl_mbe_hicn_lkup_t WHERE mhl_ik IN (SELECT mhl_ik FROM mhl_mbe_hicn_lkup_t WHERE mmt_hicn IN (:hicn)))
`;

const mbePendingQuery = `
    SELECT CONNECTORID, TO_CHAR(MMT_AGT_TERM_DT, 'YYYY-MM-DD') as TERMDATE, MMT_VOL_FLG as TERMFLAG, MMT_CHNG_IND, MMT_NEW_TO_KP_FLG as NEWTOKPFLAG, MMT_APP_STS_CD as MBESTATUS, TO_CHAR(MMT_MBRSHP_EFF_DT, 'YYYY-MM-DD') as MBEEFFECTIVEDATE 
    FROM BASE.MMC_MULTI_CONN_TRAN_T WHERE mmt_hicn IN (SELECT mmt_hicn FROM mhl_mbe_hicn_lkup_t WHERE mhl_ik IN (SELECT mhl_ik FROM mhl_mbe_hicn_lkup_t WHERE mmt_hicn IN (:hicn))) AND MMC_ARCV_IND='N'
`;

const cmsQuery = `
    SELECT MCT_IK, MCT_SEQ_NB, TO_CHAR(MCT_ENRL_EFF_DT, 'YYYY-MM-DD') as CMSEFFECTIVEDATE, MCT_CYC_YR_EFF_DT as CYCLEYEAR, MCT_CHNG_IND, MCT_NEW_IND
    FROM BASE.MCT_TRAN_LD_T WHERE mct_hicn IN (SELECT mmt_hicn FROM mhl_mbe_hicn_lkup_t WHERE mhl_ik IN (SELECT mhl_ik FROM mhl_mbe_hicn_lkup_t WHERE mmt_hicn IN (:hicn))) ORDER BY MCT_ENRL_EFF_DT
`;

// ============================================================================
// 3. UTILS
// ============================================================================
function extractYearFromJustification(text) {
    if (!text) return null;
    const regex = /(?:effective|date)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-](\d{4}))/i;
    const match = text.match(regex);
    if (match && match[2]) return match[2];
    
    const yearMatch = text.match(/(20\d{2})/);
    return yearMatch ? yearMatch[1] : null;
}

function extractYearFromAgencyDate(text) {
    if (!text) return null;
    const str = String(text).trim();
    if (str.length === 8) {
        return str.substring(4, 8);
    }
    return null;
}

function extractExactOracleDate(
    text,
    isCBRenewalComm = false
) {
    if (!text) {
        return null;
    }

    const normalizedText = String(text)
        .replace(/\s+/g, " ")
        .trim();

    let match = null;

    if (isCBRenewalComm) {
        /*
         * CB renewal cases can contain formats such as:
         *
         * Account termed with EH as of 7/31/2017
         * Account CANCELLED with EH as of 12/31/2021
         * Account Disenrolled with EH as of 12/31/2021
         * Termed2/28/2022
         * Cancelled with SQ effective 11/30/2021
         *
         * For CB renewal cases, extract the first complete
         * MM/DD/YYYY or MM-DD-YYYY date.
         */
        const cbRenewalDateRegex = new RegExp(
            "(\\d{1,2})\\s*[/-]\\s*" +
            "(\\d{1,2})\\s*[/-]\\s*" +
            "(\\d{4})"
        );

        match =
            cbRenewalDateRegex.exec(
                normalizedText
            );
    } else {
        /*
         * Preserve the existing contextual behavior for
         * all non-CB-renewal actions.
         *
         * Supported examples:
         *
         * Effective 03/31/2025
         * Effective date: 03/31/2025
         * Termed 2/28/2022
         * Termed for 2/28/2022
         */
        const contextualDateRegex = new RegExp(
            "(?:effective(?:\\s+date)?|" +
            "termed(?:\\s+for)?|" +
            "terminated|" +
            "disenrolled|" +
            "cancelled|" +
            "canceled)" +
            "[^0-9]{0,100}" +
            "(\\d{1,2})\\s*[/-]\\s*" +
            "(\\d{1,2})\\s*[/-]\\s*" +
            "(\\d{4})",
            "i"
        );

        match =
            contextualDateRegex.exec(
                normalizedText
            );
    }

    if (!match) {
        console.warn(
            "[DATE EXTRACTION] No valid date found:",
            {
                isCBRenewalComm,
                sourceText: normalizedText
            }
        );

        return null;
    }

    const month =
        Number.parseInt(match[1], 10);

    const day =
        Number.parseInt(match[2], 10);

    const year =
        Number.parseInt(match[3], 10);

    /*
     * Validate the numeric ranges.
     */
    if (
        !Number.isInteger(month) ||
        !Number.isInteger(day) ||
        !Number.isInteger(year) ||
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31 ||
        year < 1900 ||
        year > 2999
    ) {
        console.warn(
            "[DATE EXTRACTION] Invalid date components:",
            {
                month,
                day,
                year,
                isCBRenewalComm,
                sourceText: normalizedText
            }
        );

        return null;
    }

    /*
     * Validate the actual calendar date.
     * This rejects invalid dates such as 02/31/2025.
     */
    const validationDate =
        new Date(
            Date.UTC(
                year,
                month - 1,
                day
            )
        );

    if (
        validationDate.getUTCFullYear() !== year ||
        validationDate.getUTCMonth() !== month - 1 ||
        validationDate.getUTCDate() !== day
    ) {
        console.warn(
            "[DATE EXTRACTION] Invalid calendar date:",
            {
                month,
                day,
                year,
                isCBRenewalComm,
                sourceText: normalizedText
            }
        );

        return null;
    }

    const months = [
        "JAN",
        "FEB",
        "MAR",
        "APR",
        "MAY",
        "JUN",
        "JUL",
        "AUG",
        "SEP",
        "OCT",
        "NOV",
        "DEC"
    ];

    const oracleDate =
        `${String(day).padStart(2, "0")}-` +
        `${months[month - 1]}-` +
        `${year}`;

    console.log(
        "[DATE EXTRACTION] Date extracted successfully:",
        {
            originalDate: match[0],
            oracleDate,
            isCBRenewalComm,
            sourceText: normalizedText
        }
    );

    return oracleDate;
}

function normalizeActionText(value) {
    return String(value ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();
}

function classifySqlAction(actionText) {
    const action = normalizeActionText(actionText);

    /*
     * Supported examples:
     *
     * Process for Disenrollment
     * Process disenrollment
     */
    const isProcessDisenrollment =
        /\bPROCESS\s+(?:FOR\s+)?DISENROLL(?:MENT)?\b/.test(action);

    /*
     * Supported examples:
     *
     * Pay Initial
     * Pay Initial Commission
     */
    const isPayInitial =
        /\bPAY\s+INITIAL\b/.test(action) ||
        /\bINITIAL\s+PAY(?:MENT)?\b/.test(action);

    /*
     * Supported examples:
     *
     * Pay Renewal
     * Pay Yr2026 Renewal
     * Pay Year 2026 Renewal
     * Pay 2026 Renewal
     *
     * The .* allows text such as YR2026 between PAY and RENEWAL.
     */
    const isPayRenewal =
        /\bPAY\b.*\bRENEWAL\b/.test(action) &&
        !/\bREVERSE\b/.test(action) &&
        !/\bCB\b/.test(action) &&
        !/\bCHARGEBACK\b/.test(action);

    /*
     * Supported examples:
     *
     * CB Comm for Yr2026
     * CB Yr2026 Comm
     * CB comm for Yrs2024 - 2026
     * CB Yr2024 and Yr2025 Renewal Comm
     */
    const isCBRenewalComm =
        !/\bREVERSE\b/.test(action) &&
        (
            /\bCB\b/.test(action) ||
            /\bCHARGEBACK\b/.test(action)
        ) &&
        (
            /\bCOMM\b/.test(action) ||
            /\bCOMMISSION\b/.test(action) ||
            /\bRENEWAL\b/.test(action)
        );

    /*
     * Supported examples:
     *
     * Reverse CB
     * Reverse Yr2024 CB
     * Reverse Yr2025 CB (32.50)
     * Reverse Yr2026 CB (432)
     */
    const isReverseCB =
        /\bREVERSE\b/.test(action) &&
        (
            /\bCB\b/.test(action) ||
            /\bCHARGEBACK\b/.test(action)
        );

    let sqlActionType = null;

    /*
     * Check the most specific action types first.
     */
    if (isProcessDisenrollment) {
        sqlActionType = "PROCESS_DISENROLLMENT";
    } else if (isPayInitial) {
        sqlActionType = "PAY_INITIAL";
    } else if (isPayRenewal) {
        sqlActionType = "PAY_RENEWAL";
    } else if (isCBRenewalComm) {
        sqlActionType = "CB_RENEWAL_COMM";
    } else if (isReverseCB) {
        sqlActionType = "REVERSE_CB";
    }

    return {
        normalizedAction: action,
        sqlActionType,
        isPay: isPayInitial || isPayRenewal,
        isReverse: isReverseCB || isCBRenewalComm,
        isDisenroll: isProcessDisenrollment
    };
}
function classifyBrokerSplitActions(
    actionText
) {
    const action =
        normalizeActionText(
            actionText
        );

    const actionTypes =
        [];

    /*
     * PAY INITIAL
     */
    const hasPayInitial =
        /\bPAY\b.*\bINITIAL\b/.test(
            action
        ) ||
        /\bPAY\b.*\bINIITAL\b/.test(
            action
        ) ||
        /\bINITIAL\b.*\bPAY(?:MENT)?S?\b/.test(
            action
        );

    if (hasPayInitial) {
        actionTypes.push(
            "PAY_INITIAL"
        );
    }

    /*
     * PAY RENEWAL / RENEWALS
     */
    const hasPayRenewal =
        /\bPAY\b.*\bRENEWALS?\b/.test(
            action
        ) ||
        (
            /\bRENEWALS?\b/.test(
                action
            ) &&
            !(
                /\bCB\b/.test(
                    action
                ) &&
                /\bCOMM(?:ISSION)?S?\b/.test(
                    action
                )
            )
        );

    if (hasPayRenewal) {
        actionTypes.push(
            "PAY_RENEWAL"
        );
    }

    /*
     * REVERSE / CHARGEBACK
     */
    const hasReverseOrChargeback =
        /\bCB\b/.test(
            action
        ) ||
        /\bCHARGE[\s-]*BACKS?\b/.test(
            action
        ) ||
        (
            /\bREVERSE\b/.test(
                action
            ) &&
            /\bCOMM(?:ISSION)?S?\b/.test(
                action
            )
        ) ||
        /\bREVERSE\s+(?:(?:YR|YEAR)\s*)?\d{4}/.test(
            action
        );

    if (hasReverseOrChargeback) {
        actionTypes.push(
            "REVERSE_CB"
        );
    }

    /*
     * DISENROLLMENT / CANCELLATION
     */
    const hasDisenrollment =
        /\bPROCESS\b.*\bDISENROLL(?:MENT)?S?\b/.test(
            action
        ) ||
        /\bADJUST\b.*\bDISENROLL(?:MENT)?S?\b/.test(
            action
        ) ||
        /\bPROCESS\b.*\bCANCELL?ATIONS?\b/.test(
            action
        ) ||
        /\bADJUST\b.*\bCANCELL?ATIONS?\b/.test(
            action
        );

    if (hasDisenrollment) {
        actionTypes.push(
            "PROCESS_DISENROLLMENT"
        );
    }

    return [
        ...new Set(
            actionTypes
        )
    ];
}
function getBrokerSplitCategory(
    sqlActionType
) {
    if (
        sqlActionType ===
        "PAY_INITIAL"
    ) {
        return "Pay Initial";
    }

    if (
        sqlActionType ===
        "PAY_RENEWAL"
    ) {
        return "Pay Renewal";
    }

    if (
        sqlActionType ===
            "REVERSE_CB" ||
        sqlActionType ===
            "CB_RENEWAL_COMM"
    ) {
        return "Reverse / Chargeback";
    }

    if (
        sqlActionType ===
        "PROCESS_DISENROLLMENT"
    ) {
        return "Disenrollment / Cancellation";
    }

    return null;
}

const brokerMapping = {
    ARHE: {
        connectorId: 350631,
        displayName: "ARHE"
    },

    PREMIER: {
        connectorId: 397515,
        displayName: "Premier"
    },

    PRE: {
        connectorId: 397515,
        displayName: "Premier"
    },

    INTEGRITY: {
        connectorId: 397750,
        displayName: "Integrity"
    },

    INT: {
        connectorId: 397750,
        displayName: "Integrity"
    },

    APTIA: {
        connectorId: 409671,
        displayName: "Aptia"
    },

    APT: {
        connectorId: 409671,
        displayName: "Aptia"
    },

    GOHEALTH: {
        connectorId: 386235,
        displayName: "GoHealth"
    },

    GH: {
        connectorId: 386235,
        displayName: "GoHealth"
    },

    SELECTQUOTE: {
        connectorId: 386282,
        displayName: "SelectQuote"
    },

    SQ: {
        connectorId: 386282,
        displayName: "SelectQuote"
    },

    TRANZACT: {
        connectorId: 386285,
        displayName: "Tranzact"
    },

    TZ: {
        connectorId: 386285,
        displayName: "Tranzact"
    },

    TW: {
        connectorId: 360849,
        displayName: "TW"
    },

    EHEALTH: {
        connectorId: 361764,
        displayName: "eHealth"
    },

    EH: {
        connectorId: 361764,
        displayName: "eHealth"
    },

    "GS NATIONAL": {
        connectorId: 384193,
        displayName: "GS National"
    },

    GSN: {
        connectorId: 384193,
        displayName: "GS National"
    },

    "HEALTH MARKET": {
        connectorId: 384190,
        displayName: "HealthMarkets"
    },

    HM: {
        connectorId: 384190,
        displayName: "HealthMarkets"
    },

    AMERILIFE: {
        connectorId: 417444,
        displayName: "AmeriLife"
    },

    AML: {
        connectorId: 417444,
        displayName: "AmeriLife"
    },

    HPONE: {
        connectorId: 411053,
        displayName: "HPOne"
    }
};

function getBrokerDetails(
    brokerValue
) {
    const originalValue =
        String(
            brokerValue ||
            ""
        ).trim();

    const brokerCode =
        originalValue.toUpperCase();

    const brokerDetails =
        brokerMapping[
            brokerCode
        ];

    if (brokerDetails) {
        return brokerDetails;
    }

    return {
        connectorId:
            "UNKNOWN_CONNECTOR",

        displayName:
            originalValue ||
            "Unknown Broker"
    };
}
async function buildMedicareBrokerSplit(
    uploadedFileBuffer
) {
    const workbook =
        new ExcelJS.Workbook();

    await workbook.xlsx.load(
        uploadedFileBuffer
    );

    if (
        workbook.worksheets.length ===
        0
    ) {
        throw new Error(
            "The uploaded Excel workbook contains no worksheets."
        );
    }

    const worksheet =
        workbook.worksheets[0];

    const headerRow =
        worksheet.getRow(1);

    let actionColumnNumber =
        null;

    let brokerColumnNumber =
        null;

    let hcinColumnNumber =
        null;

    headerRow.eachCell(
        (
            cell,
            columnNumber
        ) => {
            const headerText =
                getExcelCellText(
                    cell.value
                )
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .trim()
                    .toUpperCase();

            if (
                headerText.includes(
                    "ACTION REQUIRED"
                )
            ) {
                actionColumnNumber =
                    columnNumber;
            }

            if (
                headerText ===
                    "BROKER" ||
                headerText.includes(
                    "BROKER"
                )
            ) {
                brokerColumnNumber =
                    columnNumber;
            }

            if (
                headerText.includes(
                    "HICN"
                ) ||
                headerText.includes(
                    "HCIN"
                )
            ) {
                hcinColumnNumber =
                    columnNumber;
            }
        }
    );

    if (!actionColumnNumber) {
        throw new Error(
            "The uploaded Excel file does not contain an Action Required column."
        );
    }

    if (!brokerColumnNumber) {
        throw new Error(
            "The uploaded Excel file does not contain a Broker column."
        );
    }

    if (!hcinColumnNumber) {
        throw new Error(
            "The uploaded Excel file does not contain an HICN or HCIN column."
        );
    }

    const categoryOrder = [
        "Pay Initial",
        "Pay Renewal",
        "Reverse / Chargeback",
        "Disenrollment / Cancellation"
    ];

    const brokerCountMap =
        new Map();

    for (
        let rowNumber = 2;
        rowNumber <= worksheet.rowCount;
        rowNumber++
    ) {
        const row =
            worksheet.getRow(
                rowNumber
            );

        const actionText =
            getExcelCellText(
                row.getCell(
                    actionColumnNumber
                ).value
            );

        const brokerText =
            getExcelCellText(
                row.getCell(
                    brokerColumnNumber
                ).value
            );

        const hcin =
            getExcelCellText(
                row.getCell(
                    hcinColumnNumber
                ).value
            );

        /*
         * Preserve the existing Broker Split eligibility rule.
         */
        if (
            !actionText ||
            !hcin
        ) {
            continue;
        }

        const actionTypes =
    classifyBrokerSplitActions(
        actionText
    );

    if (
        actionTypes.length ===
        0
    ) {
        console.warn(
            "[BROKER SPLIT] Unsupported action:",
            {
                rowNumber,
                broker:
                    brokerText ||
                    null,
                actionText,
                hcin
            }
        );

        continue;
    }

    const broker =
        getBrokerDetails(
            brokerText
        ).displayName;

    for (
        const actionType of
        actionTypes
    ) {
        const category =
            getBrokerSplitCategory(
                actionType
            );

        if (!category) {
            continue;
        }

        const mapKey =
            `${broker}|||${category}`;

        brokerCountMap.set(
            mapKey,
            (
                brokerCountMap.get(
                    mapKey
                ) ||
                0
            ) + 1
        );
    }
    }

    const brokerSplit =
        [];

    for (
        const [
            mapKey,
            transactions
        ] of brokerCountMap.entries()
    ) {
        const [
            broker,
            category
        ] =
            mapKey.split(
                "|||"
            );

        brokerSplit.push({
            broker,
            category,
            transactions
        });
    }

    brokerSplit.sort(
        (
            firstItem,
            secondItem
        ) => {
            const brokerComparison =
                firstItem.broker.localeCompare(
                    secondItem.broker
                );

            if (
                brokerComparison !==
                0
            ) {
                return brokerComparison;
            }

            return (
                categoryOrder.indexOf(
                    firstItem.category
                ) -
                categoryOrder.indexOf(
                    secondItem.category
                )
            );
        }
    );

    console.log(
        "[MEDICARE SUMMARY] Broker split generated:",
        {
            brokerSplitCount:
                brokerSplit.length,
    
            brokerSplit
        }
    );
    
    return brokerSplit;
    }
    
    function formatMedicareBrokerSplit(
        brokerSplit
    ) {
    if (
        !Array.isArray(
            brokerSplit
        ) ||
        brokerSplit.length === 0
    ) {
        return "";
    }

    const categoryOrder = [
        "Pay Initial",
        "Pay Renewal",
        "Reverse / Chargeback",
        "Disenrollment / Cancellation"
    ];

    const lines = [
        "Broker Split",
        ""
    ];

    for (
        const category of
        categoryOrder
    ) {
        const categoryItems =
            brokerSplit.filter(
                item =>
                    item?.category ===
                    category
            );

        if (
            categoryItems.length ===
            0
        ) {
            continue;
        }

        lines.push(
            category
        );

        for (
            const item of
            categoryItems
        ) {
            const transactions =
                Number(
                    item?.transactions ||
                    0
                );

            const transactionLabel =
                transactions === 1
                    ? "transaction"
                    : "transactions";

            lines.push(
                `- ${item?.broker || "Unknown Broker"}: ` +
                `${transactions} ` +
                `${transactionLabel}`
            );
        }

        lines.push("");
    }

    return lines
        .join("\n")
        .trim();
}
function buildMedicareBrokerSplitTable(
    brokerSplit
) {
    const categoryOrder = [
        "Pay Initial",
        "Pay Renewal",
        "Reverse / Chargeback",
        "Disenrollment / Cancellation"
    ];

    const rows =
        Array.isArray(
            brokerSplit
        )
            ? brokerSplit.map(
                function (item) {
                    return {
                        category:
                            item?.category ||
                            "",

                        broker:
                            getBrokerDetails(
                                item?.broker
                            ).displayName,

                        transactions:
                            Number(
                                item?.transactions ||
                                0
                            )
                    };
                }
            )
            : [];

    /*
     * Sort by broker first so the frontend can display
     * one visual section for each broker.
     */
    rows.sort(
        function (
            firstItem,
            secondItem
        ) {
            const brokerComparison =
                firstItem.broker.localeCompare(
                    secondItem.broker
                );

            if (
                brokerComparison !==
                0
            ) {
                return brokerComparison;
            }

            const firstCategoryIndex =
                categoryOrder.indexOf(
                    firstItem.category
                );

            const secondCategoryIndex =
                categoryOrder.indexOf(
                    secondItem.category
                );

            return (
                firstCategoryIndex -
                secondCategoryIndex
            );
        }
    );

    return {
        title:
            "From the uploaded file, here are the action items that need to be worked on.",

        groupedBy:
            "broker",

        columns: [
            {
                key:
                    "category",

                label:
                    "Action Item"
            },
            {
                key:
                    "transactions",

                label:
                    "Transactions"
            }
        ],

        rows
    };
}
function escapeSqlString(value) {
    return String(value ?? "").replace(/'/g, "''");
}

function buildPaymentSummary(fPay) {
    if (!Array.isArray(fPay) || fPay.length === 0) {
        return "No payment records found.";
    }
    
    const comm =
        fPay.find(row =>
            String(row.TYPE || "")
                .toUpperCase()
                .includes("COMM")
        );

    const afee =
        fPay.find(row =>
            String(row.TYPE || "")
                .toUpperCase()
                .includes("AFEE")
        );

    const paymentRow =
        comm ||
        afee ||
        fPay[0];

    const status =
        paymentRow?.PAYMENTSTATUS;

    const compensationDate =
        comm?.COMPENSATIONDATE ||
        afee?.COMPENSATIONDATE ||
        paymentRow?.COMPENSATIONDATE ||
        "Unknown";

    const commRevenue =
        comm?.REVENUE ?? 0;

    const afeeRevenue =
        afee?.REVENUE ?? 0;

    if (status === "1dep") {
        return (
            `COMM ${commRevenue} and ${afeeRevenue} AFEE ` +
            `are processed on compensation date ${compensationDate}`
        );
    }

    return (
        `COMM ${commRevenue} and ${afeeRevenue} AFEE ` +
        `will be processed on compensation date ${compensationDate}`
    );
}
async function runWithConcurrency(
    items,
    concurrency,
    worker
) {
    if (!Array.isArray(items) || items.length === 0) {
        return [];
    }

    const results =
        new Array(items.length);

    let nextIndex = 0;

    async function runWorker() {
        while (true) {
            const currentIndex =
                nextIndex++;

            if (currentIndex >= items.length) {
                return;
            }

            results[currentIndex] =
                await worker(
                    items[currentIndex],
                    currentIndex
                );
        }
    }

    const workerCount =
        Math.min(
            Math.max(concurrency, 1),
            items.length
        );

    await Promise.all(
        Array.from(
            { length: workerCount },
            () => runWorker()
        )
    );

    return results;
}
// ============================================================================
// MEDICARE MONGODB CACHE CONFIGURATION
// ============================================================================

/*
 * Increase this version whenever a code change affects the generated
 * Excel file, SQL file, Oracle filtering, action classification,
 * payment-summary rules, or other processing results.
 */
const MEDICARE_PROCESSOR_VERSION =
    "medicare-payment-v1";

const MEDICARE_SOURCE_CONTAINER =
    "medicare-source-files";

const MEDICARE_OUTPUT_CONTAINER =
    "medicare-issues";

/**
 * Converts the uploaded file into a Node.js Buffer.
 *
 * The normal browser upload flow already returns a Buffer.
 */
async function normalizeUploadedFileToBuffer(
    uploadedFile
) {
    if (Buffer.isBuffer(uploadedFile)) {
        return uploadedFile;
    }

    if (
        uploadedFile instanceof
        Uint8Array
    ) {
        return Buffer.from(
            uploadedFile
        );
    }

    if (
        typeof uploadedFile ===
            "string" &&
        uploadedFile.trim() !==
            ""
    ) {
        return await fs.readFile(
            uploadedFile
        );
    }

    throw new Error(
        "The uploaded Excel file must be a Buffer, Uint8Array, or valid server file path."
    );
}

/**
 * Creates a SHA-256 fingerprint from the uploaded Excel file.
 *
 * The same file content always produces the same hash.
 * Different file content produces a different hash.
 */
function generateMedicareFileHash(
    uploadedFileBuffer
) {
    return crypto
        .createHash('sha256')
        .update(uploadedFileBuffer)
        .digest('hex');
}

/**
 * Combines the processing version and file hash.
 *
 * Example:
 * medicare-payment-v1:abc123...
 */
function generateMedicareCacheKey(
    fileHash
) {
    return (
        `${MEDICARE_PROCESSOR_VERSION}:` +
        `${fileHash}`
    );
}

const MEDICARE_WAIT_MINUTES =
    5;

/*
 * Supports:
 *
 * Old format:
 * MED-0EB45D7AD8A1
 *
 * New date-time format:
 * MED-20260814-162345-A1B2
 */
const MEDICARE_REQUEST_ID_PATTERN =
    /\bMED-(?:[A-F0-9]{12}|\d{8}-\d{6}-[A-F0-9]{4})\b/i;


    function generateMedicareRequestId() {
        const now =
            new Date();
    
        const year =
            String(
                now.getUTCFullYear()
            );
    
        const month =
            String(
                now.getUTCMonth() + 1
            ).padStart(
                2,
                "0"
            );
    
        const day =
            String(
                now.getUTCDate()
            ).padStart(
                2,
                "0"
            );
    
        const hours =
            String(
                now.getUTCHours()
            ).padStart(
                2,
                "0"
            );
    
        const minutes =
            String(
                now.getUTCMinutes()
            ).padStart(
                2,
                "0"
            );
    
        const seconds =
            String(
                now.getUTCSeconds()
            ).padStart(
                2,
                "0"
            );
    
        const uniqueSuffix =
            crypto
                .randomBytes(2)
                .toString("hex")
                .toUpperCase();
    
        const datePart =
            `${year}${month}${day}`;
    
        const timePart =
            `${hours}${minutes}${seconds}`;
    
        return (
            `MED-${datePart}-` +
            `${timePart}-` +
            `${uniqueSuffix}`
        );
    }

function extractMedicareRequestIdFromState(
    state
) {
    const currentQuestion =
        getCurrentUserQuestionFromState(
            state
        );

    const match =
        currentQuestion.match(
            MEDICARE_REQUEST_ID_PATTERN
        );

    return match
        ? match[0].toUpperCase()
        : null;
}
function hasUploadedMedicareFile(
    state
) {
    const metadata =
        state?.metadata || {};

    return Boolean(
        Buffer.isBuffer(
            metadata.uploadedFileBuffer
        ) ||
        metadata.uploadedFileBuffer instanceof
            Uint8Array ||
        (
            typeof metadata.uploadedFilePath ===
                "string" &&
            metadata.uploadedFilePath.trim() !==
                ""
        ) ||
        (
            typeof metadata.attachmentContent ===
                "string" &&
            metadata.attachmentContent.trim() !==
                ""
        )
    );
}

function buildProcessingMessage(
    requestId,
    existingFile = false
) {
    if (existingFile) {
        return (
            `This Medicare file is already being processed.\n\n` +
            `Request ID: ${requestId}\n\n` +
            `Please check again after approximately ` +
            `${MEDICARE_WAIT_MINUTES} minutes using this Request ID.\n\n` +
            `You do not need to upload the file again.`
        );
    }

    return (
        `Medicare request submitted successfully.\n\n` +
        `Request ID: ${requestId}\n\n` +
        `Your file is being processed.\n\n` +
        `Please check again after approximately ` +
        `${MEDICARE_WAIT_MINUTES} minutes using this Request ID.\n\n` +
        `You do not need to upload the file again.`
    );
}

/**
 * Reads the user's current request from commonly used state properties.
 */
function getUserQueryFromState(
    state
) {
    const latestMessage =
        Array.isArray(
            state?.messages
        ) &&
        state.messages.length > 0
            ? state.messages[
                state.messages.length - 1
            ]
            : null;

    const latestMessageContent =
        typeof latestMessage ===
        'string'
            ? latestMessage
            : latestMessage?.content || '';

    return [
        state?.userPrompt,
        state?.userMessage,
        state?.query,
        state?.input,
        latestMessageContent
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}
function getCurrentUserQuestionFromState(
    state
) {
    const messages =
        Array.isArray(
            state?.messages
        )
            ? state.messages
            : [];

    for (
        let index =
            messages.length - 1;
        index >= 0;
        index--
    ) {
        const message =
            messages[index];

        let messageType =
            "";

        if (
            typeof message?._getType ===
            "function"
        ) {
            messageType =
                String(
                    message._getType()
                ).toLowerCase();
        }

        const role =
            String(
                message?.role ||
                message?.type ||
                messageType ||
                ""
            ).toLowerCase();

        const content =
            typeof message === "string"
                ? message
                : message?.content;

        const isUserMessage =
            role === "user" ||
            role === "human";

        if (
            isUserMessage &&
            typeof content === "string" &&
            content.trim()
        ) {
            return content.trim();
        }
    }

    const directQuestion =
        state?.userResponse ||
        state?.userMessage ||
        state?.query ||
        state?.input ||
        state?.userPrompt ||
        "";

    return String(
        directQuestion
    ).trim();
}
/**
 * Determines whether the user requested the SQL output file.
 */
function isSqlRequestedFromState(
    state
) {
    const currentQuestion =
        getCurrentUserQuestionFromState(
            state
        ).toLowerCase();

    return (
        currentQuestion.includes(
            "sql"
        ) ||
        state?.intent
            ?.generateSqlTxt ===
            true
    );
}


// ============================================================================
// 4. MAIN BATCH PROCESSOR (MODIFIED TO RETURN BUFFERS & STRINGS)
// ============================================================================
export async function processExcelBatch(inputFilePathOrBuffer, state) {
    let sqlQueriesText = [
        "-- Medicare Batch SQL Generation Report",
        `-- Generated at: ${new Date().toISOString()}`,
        "-- IMPORTANT: Review and validate all statements before execution.",
        "-- ============================================================",
        ""
    ].join("\n");
    
    let generatedSqlActionCount = 0;
    let unsupportedSqlActionCount = 0;
    
    const appendSql = (text, isExecutable = true) => {
        sqlQueriesText += text.endsWith("\n") ? text : `${text}\n`;
    
        if (isExecutable) {
            generatedSqlActionCount++;
        } else {
            unsupportedSqlActionCount++;
        }
    };

    try {
       // await setProcessEnvironment();
    } catch (envErr) {
        console.error(`[FATAL ENV ERROR] ${envErr.message}`);
        throw envErr;
    }

    const workbook =
    new ExcelJS.Workbook();

try {
    if (!inputFilePathOrBuffer) {
        throw new Error(
            "No Excel file was supplied to processExcelBatch."
        );
    }

    if (
        Buffer.isBuffer(
            inputFilePathOrBuffer
        )
    ) {
        console.log(
            "[FILE DEBUG] Loading Excel Buffer:",
            inputFilePathOrBuffer.length,
            "bytes"
        );

        await workbook.xlsx.load(
            inputFilePathOrBuffer
        );
    } else if (
        inputFilePathOrBuffer instanceof
        Uint8Array
    ) {
        const normalizedBuffer =
            Buffer.from(
                inputFilePathOrBuffer
            );

        console.log(
            "[FILE DEBUG] Loading Excel Uint8Array:",
            normalizedBuffer.length,
            "bytes"
        );

        await workbook.xlsx.load(
            normalizedBuffer
        );
    } else if (
        typeof inputFilePathOrBuffer ===
        "string"
    ) {
        console.log(
            "[FILE DEBUG] Loading Excel file path:",
            inputFilePathOrBuffer
        );

        await workbook.xlsx.readFile(
            inputFilePathOrBuffer
        );
    } else {
        throw new Error(
            "Unsupported Excel input type."
        );
    }
} catch (error) {
    console.error(
        "[FATAL FILE ERROR] Could not read Excel file:",
        error
    );

    throw new Error(
        `Could not read the uploaded Excel file: ${
            error instanceof Error
                ? error.message
                : String(error)
        }`
    );
}

if (!workbook.worksheets.length) {
    throw new Error(
        "The uploaded Excel workbook contains no worksheets."
    );
}

console.log(
    "[FILE DEBUG] Workbook loaded:",
    workbook.worksheets.map(
        sheet => ({
            sheetName:
                sheet.name,

            rowCount:
                sheet.rowCount,

            actualRowCount:
                sheet.actualRowCount,

            columnCount:
                sheet.columnCount
        })
    )
);

    const worksheet = workbook.worksheets[0];
    let headerRow = worksheet.getRow(1);
    let originalColCount = headerRow.actualCellCount;
    
    let colActionReq = 3; 
    let colJustification = 5; 
    let colBroker = 7; 
    let colHCIN = 9; 
    let colAppStatus = 17; 
    let colAgencyDate = 19; 
    
    headerRow.eachCell((cell, colNumber) => {
        const val = String(cell.value).toUpperCase();
        if (val.includes("ACTION REQUIRED")) colActionReq = colNumber;
        if (val.includes("PREVIOUS COMMUNICATION") || val.includes("JUSTIFICATION")) colJustification = colNumber;
        if (val === "BROKER" || val.includes("BROKER")) colBroker = colNumber;
        //if (val.includes("HCIN")) colHCIN = colNumber;
        if (
            val.includes("HICN") ||
            val.includes("HCIN")
        ) {
            colHCIN = colNumber;
        }
        if (val.includes("APPLICATION STATUS CODE")) colAppStatus = colNumber; 
        if (val.includes("AGENCY MEMBERSHIP EFFECTIVE DATE") || val.includes("AGENCY ME")) colAgencyDate = colNumber;
    });

    const baseCol = originalColCount + 1;
    const subHeaderCells = [
        "AI_PAYMENT_SUMMARY",
    
        "PAYMENT_EFFECTIVE_DATE",
        "PAYMENT_REVENUE",
        "PAYMENT_TYPE",
        "PAYMENT_COMPENSATION_DATE",
        "PAYMENT_STATUS",
    
        "ACCEPT_CMS_EFF_DATE",
        "ACCEPT_TERM_DATE",
        "ACCEPT_TYPE",
        "ACCEPT_NEW_TO_KP_FLAG",
        "ACCEPT_TERM_FLAG",
    
        "MBE_TERM_DATE",
        "MBE_TERM_FLAG",
        "MBE_CHNG_IND",
        "MBE_NEW_TO_KP_FLAG",
        "MBE_STATUS",
        "MBE_EFF_DATE",
    
        "CMS_EFF_DATE",
        "CMS_CYCLE_YEAR",
        "CMS_CHNG_IND",
        "CMS_NEW_IND"
    ];

    subHeaderCells.forEach((val, index) => {
        const cell = headerRow.getCell(baseCol + index);
        cell.value = val;
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }; 
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
    });
    
    const processedRowsData = [];
    const processedRows =
    [];
const originalRowCount =
    worksheet.rowCount;

const metrics = {
    totalProcessed: 0,
    payInitial: 0,
    reversal: 0,
    disenrollment: 0
};

/*
 * Prepare one AI input for each processable Excel row.
 * This is not caching. Each row still receives its own AI call.
 */
const aiInputs = [];

for (
    let rowNumber = 2;
    rowNumber <= originalRowCount;
    rowNumber++
) {
    const sourceRow =
        worksheet.getRow(rowNumber);

    const actionText =
        String(
            sourceRow.getCell(
                colActionReq
            ).value || ""
        ).trim();

    const hcin =
        String(
            sourceRow.getCell(
                colHCIN
            ).value || ""
        ).trim();

    if (actionText && hcin) {
        aiInputs.push({
            rowNumber,
            actionText,
            hcin
        });
    }
}

console.log(
    `[AI BATCH] Processing ${aiInputs.length} rows`
);

const aiStartTime =
    Date.now();

/*
 * Five AI requests may run concurrently.
 * Reduce this to 3 if the AI service returns rate-limit errors.
 */
const aiExtractionResults =
    await runWithConcurrency(
        aiInputs,
        5,
        async item => {
            const extracted =
                await extractParamsWithAI(
                    item.actionText,
                    item.hcin,
                    state
                );

            return {
                rowNumber:
                    item.rowNumber,

                extracted
            };
        }
    );

const aiResultsByRow =
    new Map(
        aiExtractionResults.map(
            result => [
                result.rowNumber,
                result.extracted
            ]
        )
    );

    console.log(
        `[AI BATCH] Completed in ${
            Date.now() - aiStartTime
        } ms`
    );
    
    let dbConnection;

try {
    /*
     * Hardcoded Oracle connection configuration.
     * Replace each placeholder with the correct value.
     */
    const oracleUser =
        "L229023";

    const oraclePassword =
        "L229023#4567";

    const oracleHost =
        "db-base-nprod-pldc-scan.kp.org";

    const oraclePort =
        "1521";

    const oracleService =
        "baseut11_base.kp.org";

    if (
        !oracleUser ||
        !oraclePassword ||
        !oracleHost ||
        !oraclePort ||
        !oracleService
    ) {
        throw new Error(
            "Missing required Oracle database configuration."
        );
    }

    console.log(
        "[ORACLE CONFIG] Connection settings:",
        {
            user:
                oracleUser,

            host:
                oracleHost,

            port:
                oraclePort,

            service:
                oracleService,

            hasPassword:
                Boolean(oraclePassword),

            passwordLength:
                oraclePassword.length
        }
    );

    dbConnection =
        await oracledb.getConnection({
            user:
                oracleUser,

            password:
                oraclePassword,

            connectString:
                `${oracleHost}:${oraclePort}/${oracleService}`
        });

    console.log(
        "[ORACLE] Connection opened successfully:",
        {
            hasConnection:
                Boolean(dbConnection),

            hasExecute:
                typeof dbConnection?.execute ===
                "function"
        }
    );

    /*
     * Process every Excel row while the connection is open.
     */
    for (
        let r = 2;
        r <= originalRowCount;
        r++
    ) {
        const row = worksheet.getRow(r);
        const actionText = String(row.getCell(colActionReq).value || "").trim(); 
        const brokerText = String(row.getCell(colBroker).value || "").trim().toUpperCase(); 
        const hcin = String(row.getCell(colHCIN).value || "").trim();       
        const justificationText =getExcelCellText(row.getCell(colJustification).value);
        const agencyDateText = String(row.getCell(colAgencyDate).value || "").trim();
        const appStatusText = String(row.getCell(colAppStatus).value || "").trim(); 

        let originalValues = [];
        let originalStyles = [];
        for (let c = 1; c <= originalColCount; c++) {
            originalValues.push(row.getCell(c).value);
            originalStyles.push({
                font: row.getCell(c).font,
                fill: row.getCell(c).fill,
                border: row.getCell(c).border,
                alignment: row.getCell(c).alignment
            });
        }

        if (!actionText || !hcin) {
            processedRowsData.push({ values: originalValues, styles: originalStyles, additions: [], maxRows: 1 });
            continue;
        }
        
        const extracted =
    aiResultsByRow.get(r) || {
        targetDate: null,

        targetYears:
            extractYearsFromActionText(
                actionText
            ),

        errorFlag: true,

        errorMessage:
            "AI extraction result was not available for this row."
    };
        
        let targetYears = Array.isArray(extracted.targetYears)
            ? extracted.targetYears
            : [];
        
        let targetDate = extracted.targetDate || null;
        
        let isFutureSearchEnabled = false;        
        

        const actionInfo = classifySqlAction(actionText);

        const {
            normalizedAction,
            sqlActionType,
            isPay,
            isReverse,
            isDisenroll
        } = actionInfo;

        const isProcessDisenrollmentQuery =
            sqlActionType === "PROCESS_DISENROLLMENT";

        const isPayRenewalQuery =
            sqlActionType === "PAY_RENEWAL";

        const isPayInitialQuery =
            sqlActionType === "PAY_INITIAL";

        const isReverseCBQuery =
            sqlActionType === "REVERSE_CB";

        const isCBRenewalCommQuery =
            sqlActionType === "CB_RENEWAL_COMM";

        console.log(`[ROW ${r}] Action: "${actionText}"`);
        console.log(`[ROW ${r}] Normalized: "${normalizedAction}"`);
        console.log(
            `[ROW ${r}] SQL action type:`,
            sqlActionType || "UNSUPPORTED"
        );

        if (isPay) metrics.payInitial++;
        if (isReverse) metrics.reversal++;
        if (isDisenroll) metrics.disenrollment++;
        metrics.totalProcessed++;

        if (extracted.errorFlag) {
            console.error(
                `[ROW ${r}] AI extraction failed:`,
                {
                    hasHcin:
                        Boolean(
                            hcin
                        ),
            
                    error:
                        extracted.errorMessage
                }
            );
        
            /*
             * Do not clear targetYears here.
             * extractParamsWithAI already returns years extracted from
             * the action text when chatCompletion fails.
             */
        }
        
        /*
         * Existing fallback for disenrollment actions.
         */
        if (isDisenroll && targetYears.length === 0) {
            const fallbackYear =
                extractYearFromJustification(justificationText);
        
            if (fallbackYear) {
                targetYears = [fallbackYear];
                isFutureSearchEnabled = true;
            }
        }
        
        /*
         * Existing fallback for payment actions.
         */
        if (
            isPay &&
            targetYears.length === 0 &&
            !targetDate
        ) {
            const fallbackYear =
                extractYearFromAgencyDate(agencyDateText);
        
            if (fallbackYear) {
                targetYears = [fallbackYear];
            }
        }

        const payRows =
            await queryOracleDB(
                dbConnection,
                paymentQuery,
                { hicn: hcin }
            );

        const accRows =
            await queryOracleDB(
                dbConnection,
                acceptQuery,
                { hicn: hcin }
            );

        const mbeRows =
            await queryOracleDB(
                dbConnection,
                mbePendingQuery,
                { hicn: hcin }
            );

        const cmsRows =
            await queryOracleDB(
                dbConnection,
                cmsQuery,
                { hicn: hcin }
            );

        let fPay = [], fAcc = [], fMbe = [], fCms = [];

        if (targetYears.length > 0) {
            const baseYear = parseInt(targetYears[0], 10);
            fPay = payRows.filter(row => {
                if (!row.EFFECTIVEDATE) return false;
                const rowYear = parseInt(row.EFFECTIVEDATE.substring(0,4), 10);
                return isFutureSearchEnabled ? (rowYear >= baseYear) : targetYears.some(y => row.EFFECTIVEDATE.startsWith(y));
            });
            fAcc = accRows.filter(row => {
                if (!row.CMSEFFECTIVEDATE) return false;
                const rowYear = parseInt(row.CMSEFFECTIVEDATE.substring(0,4), 10);
                return isFutureSearchEnabled ? (rowYear >= baseYear) : targetYears.some(y => row.CMSEFFECTIVEDATE.startsWith(y));
            });
            
            if (isDisenroll || isPay || isCBRenewalCommQuery) {
                fMbe = mbeRows;
            } else {
                fMbe = mbeRows.filter(row => {
                    if (!row.MBEEFFECTIVEDATE) return false;
                    const rowYear = parseInt(row.MBEEFFECTIVEDATE.substring(0,4), 10);
                    return isFutureSearchEnabled ? (rowYear >= baseYear) : targetYears.some(y => row.MBEEFFECTIVEDATE.startsWith(y));
                });
            }

            fCms = cmsRows.filter(row => {
                if (!row.CMSEFFECTIVEDATE) return false;
                const rowYear = parseInt(row.CMSEFFECTIVEDATE.substring(0,4), 10);
                return isFutureSearchEnabled ? (rowYear >= baseYear) : targetYears.some(y => row.CMSEFFECTIVEDATE.startsWith(y));
            });
        } else if (targetDate) {
            fPay = payRows.filter(row => row.EFFECTIVEDATE === targetDate);
            fAcc = accRows.filter(row => row.CMSEFFECTIVEDATE === targetDate);
            if (isDisenroll || isPay || isCBRenewalCommQuery) fMbe = mbeRows;
            else fMbe = mbeRows.filter(row => row.MBEEFFECTIVEDATE === targetDate);
            fCms = cmsRows.filter(row => row.CMSEFFECTIVEDATE === targetDate);
        } else {
            fPay = payRows; fAcc = accRows; fMbe = mbeRows; fCms = cmsRows;
        }

        const aiPaymentSummary = buildPaymentSummary(fPay);

        const appStatus = appStatusText; 
        const brokerDetails =getBrokerDetails(
                        brokerText
                    );

        const brokerConnectorId =
            brokerDetails.connectorId;
        
        
            const rowCategory =
            getBrokerSplitCategory(
                sqlActionType
            );
        
        const normalizedProcessedRow = {
            sourceRowNumber:
                r,
        
            hcin:
                hcin,
        
            hcinNormalized:
                normalizeStoredHcin(
                    hcin
                ),
        
            brokerCode:
                brokerText,
        
            brokerName:
                brokerDetails.displayName,
        
            brokerNameNormalized:
                normalizeStoredText(
                    brokerDetails.displayName
                ),
        
            connectorId:
                brokerConnectorId,
        
            actionRequired:
                actionText,
        
            actionRequiredNormalized:
                normalizedAction,
        
            actionType:
                sqlActionType,
        
            sqlActionType:
                sqlActionType,
        
            category:
                rowCategory,
        
            categoryNormalized:
                normalizeStoredText(
                    rowCategory
                ),
        
            justification:
                justificationText,
        
            applicationStatus:
                appStatusText,
        
            agencyMembershipEffectiveDate:
                agencyDateText,
        
            targetDate:
                targetDate,
        
            targetYears:
                Array.isArray(
                    targetYears
                )
                    ? targetYears
                    : [],
        
            paymentSummary:
                aiPaymentSummary,
        
            paymentRecordCount:
                fPay.length,
        
            acceptRecordCount:
                fAcc.length,
        
            mbeRecordCount:
                fMbe.length,
        
            cmsRecordCount:
                fCms.length,
        
            generatedSql:
                Boolean(
                    sqlActionType
                )
        };
        
        processedRows.push(
            normalizedProcessedRow
        );
        // SQL GENERATION BLOCKS
        if (isProcessDisenrollmentQuery) {
            const oracleTermDate = extractExactOracleDate(justificationText) || 'UNKNOWN_DATE';
            let mbeTermFlag = null; 
            const vtfMatch = justificationText.match(/VTF\s*=\s*(Y|N)/i);
            if (vtfMatch) mbeTermFlag = vtfMatch[1].toUpperCase() === 'Y' ? 'Yes' : 'No';
            const mbeTermFlagVal = mbeTermFlag ? `'${mbeTermFlag}'` : 'null';

            appendSql(`-- Action Required: ${actionText}\n-- HCIN: ${hcin}\n\nupdate mmt_tran_ld_t set MMT_AGT_TERM_DT='${oracleTermDate}', MMT_VOL_FLG=${mbeTermFlagVal}, MMT_CHNG_IND='Y', MMT_NEW_IND='N', MMT_APP_STS_CD='${appStatus}', mmt_updt_usr_id='', mmt_updt_ts=sysdate\nwhere (mmt_hicn,CONNECTORID) in (('${hcin}', ${brokerConnectorId})) and MMT_ARCV_IND='N';\n\nupdate BASE.MCT_TRAN_LD_T set MCT_CHNG_IND='N', MCT_NEW_IND='N', MCT_UPDT_USR_ID='', MCT_UPDT_TS=sysdate\nwhere MCT_HICN in ('${hcin}') and (NVL(MCT_CHNG_IND,'XXX')<>'N' or nvl(MCT_NEW_IND,'XXX')<>'N');\n\ncommit;\n-- --------------------------------------------------\n`);
        }

        if (isPayRenewalQuery) {
            let highestMctIk = 'UNKNOWN_IK', matchedMctSeqNb = 'UNKNOWN_SEQ';
            if (cmsRows && cmsRows.length > 0) {
                let maxRow = cmsRows[0];
                for (let i = 1; i < cmsRows.length; i++) { if (cmsRows[i].MCT_IK > maxRow.MCT_IK) maxRow = cmsRows[i]; }
                highestMctIk = maxRow.MCT_IK; matchedMctSeqNb = maxRow.MCT_SEQ_NB;
            }
            appendSql(`-- Action Required: ${actionText}\n-- HCIN: ${hcin}\n\nupdate mmt_tran_ld_t set MMT_AGT_TERM_DT=null, MMT_VOL_FLG=null, MMT_CHNG_IND='N', MMT_NEW_IND='N', MMT_APP_STS_CD='${appStatus}', mmt_updt_usr_id='', mmt_updt_ts=sysdate\nwhere (mmt_hicn,CONNECTORID) in (('${hcin}', ${brokerConnectorId})) and MMT_ARCV_IND='N';\n\nupdate BASE.MCT_TRAN_LD_T set MCT_CHNG_IND='N', MCT_NEW_IND='N', MCT_UPDT_USR_ID='', MCT_UPDT_TS=sysdate\nwhere MCT_HICN in ('${hcin}') and (NVL(MCT_CHNG_IND,'XXX')<>'N' or nvl(MCT_NEW_IND,'XXX')<>'N');\n\nupdate BASE.MCT_TRAN_LD_T set MCT_CHNG_IND='Y', MCT_NEW_IND=null, MCT_UPDT_USR_ID='', MCT_UPDT_TS=sysdate\nwhere (MCT_IK,MCT_SEQ_NB,MCT_HICN) in ((${highestMctIk}, ${matchedMctSeqNb}, '${hcin}'));\n\ncommit;\n-- --------------------------------------------------\n`);
        }

        if (isPayInitialQuery) {
            let highestMctIk = 'UNKNOWN_IK', matchedMctSeqNb = 'UNKNOWN_SEQ';
            if (cmsRows && cmsRows.length > 0) {
                let maxRow = cmsRows[0];
                for (let i = 1; i < cmsRows.length; i++) { if (cmsRows[i].MCT_IK > maxRow.MCT_IK) maxRow = cmsRows[i]; }
                highestMctIk = maxRow.MCT_IK; matchedMctSeqNb = maxRow.MCT_SEQ_NB;
            }
            appendSql(`-- Action Required: ${actionText}\n-- HCIN: ${hcin}\n\nupdate mmt_tran_ld_t set MMT_CHNG_IND='Y', MMT_NEW_IND=null, MMT_APP_STS_CD='${appStatus}', mmt_updt_usr_id='', mmt_updt_ts=sysdate\nwhere (mmt_hicn,CONNECTORID) in (('${hcin}', ${brokerConnectorId})) and MMT_ARCV_IND='N';\n\nupdate BASE.MCT_TRAN_LD_T set MCT_CHNG_IND='N', MCT_NEW_IND='N', MCT_UPDT_USR_ID='', MCT_UPDT_TS=sysdate\nwhere MCT_HICN in ('${hcin}') and (NVL(MCT_CHNG_IND,'XXX')<>'N' or nvl(MCT_NEW_IND,'XXX')<>'N');\n\nupdate BASE.MCT_TRAN_LD_T set MCT_CHNG_IND='Y', MCT_NEW_IND=null, MCT_UPDT_USR_ID='', MCT_UPDT_TS=sysdate\nwhere (MCT_IK,MCT_SEQ_NB,MCT_HICN) in ((${highestMctIk}, ${matchedMctSeqNb}, '${hcin}'));\n\ncommit;\n-- --------------------------------------------------\n`);
        }

        if (isReverseCBQuery) {
            const hasActionYear = targetYears && targetYears.length > 0;
            const justDate = extractExactOracleDate(justificationText);
            const justYear = extractYearFromJustification(justificationText);
            const missingBoth = !hasActionYear && !(justDate || justYear);

            if (missingBoth) {
                appendSql(`-- Action Required: ${actionText}\n-- HCIN: ${hcin}\n\nupdate mmt_tran_ld_t set MMT_AGT_TERM_DT=null, MMT_VOL_FLG=null, MMT_CHNG_IND='N', MMT_NEW_IND='N', MMT_APP_STS_CD='${appStatus}', mmt_updt_usr_id='', mmt_updt_ts=sysdate\nwhere (mmt_hicn,CONNECTORID) in (('${hcin}', ${brokerConnectorId})) and MMT_ARCV_IND='N';\n\ncommit;\n-- --------------------------------------------------\n`);
            } else {
                let localTargetYear = hasActionYear ? targetYears[0] : justYear;
                let matchedAccept = null;
                if (localTargetYear) matchedAccept = accRows.find(r => r.CMSEFFECTIVEDATE && r.CMSEFFECTIVEDATE.startsWith(localTargetYear));
                else if (targetDate) matchedAccept = accRows.find(r => r.CMSEFFECTIVEDATE === targetDate);
                if (!matchedAccept && accRows.length > 0) matchedAccept = accRows[0];
                const mpaIk = matchedAccept?.MPA_IK || 'UNKNOWN_MPA_IK';

                appendSql(`-- Action Required: ${actionText}\n-- HCIN: ${hcin}\n\nupdate mmt_tran_ld_t set MMT_AGT_TERM_DT=null, MMT_VOL_FLG=null, MMT_CHNG_IND='N', MMT_NEW_IND='N', MMT_APP_STS_CD='${appStatus}', mmt_updt_usr_id='', mmt_updt_ts=sysdate\nwhere (mmt_hicn,CONNECTORID) in (('${hcin}', ${brokerConnectorId})) and MMT_ARCV_IND='N';\n\nupdate BASE.MPA_TRAN_ACPT_T set MMT_AGT_TERM_DT=null, MPA_TRAN_IND='ENRL', MMT_VOL_FLG=null, MPA_CMSN_FLAG=1, MPA_ADMN_FLAG=0, MMT_PRCS_IND='N', mpa_updt_usr_id='', mpa_updt_ts=sysdate\nwhere mpa_ik in (${mpaIk});\n\ncommit;\n-- --------------------------------------------------\n`);
            }
        }

        if (isCBRenewalCommQuery) {
            /*
             * Pass true to enable CB renewal date extraction.
             */
            const oracleTermDate =
                extractExactOracleDate(
                    justificationText,
                    true
                );
        
            const vtfMatch =
                justificationText.match(
                    /VTF\s*=\s*(Y|N)/i
                );
        
            /*
             * Preserve the existing Yes/No behavior.
             *
             * VTF = Y becomes Yes.
             * VTF = N becomes No.
             */
            const mbeTermFlag =
                vtfMatch
                    ? (
                        vtfMatch[1].toUpperCase() === "Y"
                            ? "Yes"
                            : "No"
                    )
                    : null;
        
            const mbeTermFlagVal =
                mbeTermFlag
                    ? `'${mbeTermFlag}'`
                    : "null";
        
            const safeActionText =
                escapeSqlString(actionText);
        
            const safeHcin =
                escapeSqlString(hcin);
        
            const safeAppStatus =
                escapeSqlString(appStatus);
        
            if (!oracleTermDate) {
                console.error(
                    `[ROW ${r}] CB renewal date was not found:`,
                    {
                        actionText,
                        hcin,
                        justificationText
                    }
                );
        
                appendSql(
                    [
                        `-- Action Required: ${safeActionText}`,
                        `-- HCIN: ${safeHcin}`,
                        "-- SQL NOT GENERATED",
                        "-- Reason: A valid termination date was not found in the justification.",
                        `-- Justification: ${escapeSqlString(justificationText)}`,
                        "-- Review the source record and provide a valid termination date.",
                        "-- --------------------------------------------------",
                        ""
                    ].join("\n"),
                    false
                );
            } else {
                appendSql(
                    `-- Action Required: ${safeActionText}\n` +
                    `-- HCIN: ${safeHcin}\n` +
                    `-- Extracted Term Date: ${oracleTermDate}\n` +
                    `-- Extracted VTF: ${mbeTermFlag || "Not found"}\n\n` +
        
                    `update mmt_tran_ld_t set ` +
                    `MMT_AGT_TERM_DT='${oracleTermDate}', ` +
                    `MMT_VOL_FLG=${mbeTermFlagVal}, ` +
                    `MMT_CHNG_IND='Y', ` +
                    `MMT_NEW_IND='N', ` +
                    `MMT_APP_STS_CD='${safeAppStatus}', ` +
                    `mmt_updt_usr_id='', ` +
                    `mmt_updt_ts=sysdate\n` +
                    `where (mmt_hicn,CONNECTORID) ` +
                    `in (('${safeHcin}', ${brokerConnectorId})) ` +
                    `and MMT_ARCV_IND='N';\n\n` +
        
                    `update BASE.MCT_TRAN_LD_T set ` +
                    `MCT_CHNG_IND='N', ` +
                    `MCT_NEW_IND='N', ` +
                    `MCT_UPDT_USR_ID='', ` +
                    `MCT_UPDT_TS=sysdate\n` +
                    `where MCT_HICN in ('${safeHcin}') ` +
                    `and (` +
                    `NVL(MCT_CHNG_IND,'XXX')<>'N' ` +
                    `or NVL(MCT_NEW_IND,'XXX')<>'N'` +
                    `);\n\n` +
        
                    `commit;\n` +
                    `-- --------------------------------------------------\n`
                );
            }
        }

        const maxRowsNeeded = Math.max(fPay.length, fAcc.length, fMbe.length, fCms.length, 1);
        let additionsArr = [];

        for (let i = 0; i < maxRowsNeeded; i++) {
            let rowAddition = [];
            rowAddition.push(i === 0 ? aiPaymentSummary : "");
            rowAddition.push(fPay[i]?.EFFECTIVEDATE || "", fPay[i]?.REVENUE || "", fPay[i]?.TYPE || "", fPay[i]?.COMPENSATIONDATE || "", fPay[i]?.PAYMENTSTATUS || "");
            rowAddition.push(fAcc[i]?.CMSEFFECTIVEDATE || "", fAcc[i]?.TERMDATE || "", fAcc[i]?.TYPE || "", fAcc[i]?.NEWTOKPFLAG || "", fAcc[i]?.TERMFLAG || "");
            rowAddition.push(fMbe[i]?.TERMDATE || "", fMbe[i]?.TERMFLAG || "", fMbe[i]?.MMT_CHNG_IND || "", fMbe[i]?.NEWTOKPFLAG || "", fMbe[i]?.MBESTATUS || "", fMbe[i]?.MBEEFFECTIVEDATE || "");
            rowAddition.push(fCms[i]?.CMSEFFECTIVEDATE || "", fCms[i]?.CYCLEYEAR || "", fCms[i]?.MCT_CHNG_IND || "", fCms[i]?.MCT_NEW_IND || "");
            additionsArr.push(rowAddition);
        }

        processedRowsData.push({ values: originalValues, styles: originalStyles, additions: additionsArr, maxRows: maxRowsNeeded });
    }

    worksheet.spliceRows(2, originalRowCount - 1);
    let currentRowNumber = 2;

    for (const group of processedRowsData) {
        const startRow = currentRowNumber;
        for (let i = 0; i < group.maxRows; i++) {
            const newRow = worksheet.getRow(currentRowNumber);
            if (i === 0) {
                for (let c = 0; c < originalColCount; c++) {
                    const cell = newRow.getCell(c + 1);
                    cell.value = group.values[c];
                    if (group.styles[c]) {
                        cell.font = group.styles[c].font; cell.fill = group.styles[c].fill; cell.border = group.styles[c].border; cell.alignment = group.styles[c].alignment;
                    }
                }
            }
            const additions = group.additions[i] || new Array(21).fill("");
            for (let a = 0; a < additions.length; a++) {
                const cell = newRow.getCell(baseCol + a);
                cell.value = additions[a]; cell.alignment = { vertical: 'top' }; 
            }
            currentRowNumber++;
        }
        if (group.maxRows > 1) {
            for (let c = 1; c <= originalColCount; c++) { worksheet.mergeCells(startRow, c, startRow + group.maxRows - 1, c); }
        }
    }

    const summarySheet = workbook.addWorksheet('High Level Summary');
    summarySheet.columns = [
        { header: 'Metric', key: 'metric', width: 45 },
        { header: 'Count', key: 'count', width: 20 }
    ];

    summarySheet.addRow({ metric: 'Total Action Items Processed', count: metrics.totalProcessed });
    summarySheet.addRow({ metric: 'Pay Initial / Pay Renewal Occurrences', count: metrics.payInitial });
    summarySheet.addRow({ metric: 'Reverse / Chargeback Occurrences', count: metrics.reversal });
    summarySheet.addRow({ metric: 'Disenrollment / Cancellation Occurrences', count: metrics.disenrollment });

    summarySheet.getRow(1).font = { bold: true, size: 12 };
    summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
    summarySheet.getRow(2).font = { bold: true };
    
    const excelBuffer = await workbook.xlsx.writeBuffer();
    
    return {
        excelBuffer:
            Buffer.isBuffer(
                excelBuffer
            )
                ? excelBuffer
                : Buffer.from(
                    excelBuffer
                ),
    
        sqlText:
            sqlQueriesText,
    
        totalRecords:
            metrics.totalProcessed,
    
        generatedSqlActionCount,
    
        unsupportedSqlActionCount,
    
        processedRows
    };
} finally {
    if (dbConnection) {
        try {
            await dbConnection.close();

            console.log(
                "[ORACLE] Connection closed successfully"
            );
        } catch (closeError) {
            console.error(
                "[ORACLE] Connection close failed:",
                closeError
            );
        }
    }
}
}
    // ============================================================================
// UI UPLOADED FILE DECODER
// ============================================================================
function getUploadedExcelFileFromState(state) {
    const metadata = state?.metadata || {};

    /*
     * Option 1: The backend already supplied a Node.js Buffer.
     */
    if (Buffer.isBuffer(metadata.uploadedFileBuffer)) {
        console.log(
            "[UPLOAD DEBUG] Using uploadedFileBuffer:",
            metadata.uploadedFileBuffer.length,
            "bytes"
        );

        return metadata.uploadedFileBuffer;
    }

    /*
     * Option 2: The backend supplied a Uint8Array.
     */
    if (metadata.uploadedFileBuffer instanceof Uint8Array) {
        const uploadedFileBuffer =
            Buffer.from(metadata.uploadedFileBuffer);

        console.log(
            "[UPLOAD DEBUG] Converted Uint8Array to Buffer:",
            uploadedFileBuffer.length,
            "bytes"
        );

        return uploadedFileBuffer;
    }

    /*
     * Option 3: The backend supplied a server-side file path.
     */
    if (
        typeof metadata.uploadedFilePath === "string" &&
        metadata.uploadedFilePath.trim() !== ""
    ) {
        console.log(
            "[UPLOAD DEBUG] Using uploadedFilePath:",
            metadata.uploadedFilePath
        );

        return metadata.uploadedFilePath;
    }

    /*
     * Option 4: The current UI supplies a Base64 data URL through
     * metadata.attachmentContent.
     */
    const attachmentContent =
        metadata.attachmentContent;

    if (
        typeof attachmentContent !== "string" ||
        attachmentContent.trim() === ""
    ) {
        console.error(
            "[UPLOAD ERROR] No attachment content found:",
            {
                metadataKeys:
                    Object.keys(metadata),

                attachmentName:
                    metadata.attachmentName || null,

                attachmentContentType:
                    typeof attachmentContent,

                hasAttachmentContent:
                    Boolean(attachmentContent)
            }
        );

        throw new Error(
            "No uploaded Excel attachment was found in metadata.attachmentContent."
        );
    }

    const trimmedContent =
        attachmentContent.trim();

    /*
     * Decode a standard browser data URL:
     *
     * data:application/vnd.openxmlformats-officedocument
     * .spreadsheetml.sheet;base64,UEsDB...
     */
    if (trimmedContent.startsWith("data:")) {
        const commaIndex =
            trimmedContent.indexOf(",");

        if (commaIndex < 0) {
            throw new Error(
                "The uploaded attachment data URL is malformed."
            );
        }

        const dataUrlHeader =
            trimmedContent.substring(
                0,
                commaIndex
            );

        const base64Content =
            trimmedContent.substring(
                commaIndex + 1
            );

        if (!dataUrlHeader.includes(";base64")) {
            throw new Error(
                "The uploaded Excel attachment is not Base64 encoded."
            );
        }

        const uploadedFileBuffer =
            Buffer.from(
                base64Content,
                "base64"
            );

        if (!uploadedFileBuffer.length) {
            throw new Error(
                "The uploaded Excel attachment decoded to an empty file."
            );
        }

        console.log(
            "[UPLOAD DEBUG] UI attachment decoded successfully:",
            {
                attachmentName:
                    metadata.attachmentName || null,

                dataUrlHeader,

                uploadedFileSize:
                    uploadedFileBuffer.length,

                isBuffer:
                    Buffer.isBuffer(
                        uploadedFileBuffer
                    )
            }
        );

        return uploadedFileBuffer;
    }

    /*
     * Optional fallback for raw Base64 without a data URL prefix.
     */
    const rawBase64Content =
        trimmedContent.replace(/\s/g, "");

    const uploadedFileBuffer =
        Buffer.from(
            rawBase64Content,
            "base64"
        );

    if (!uploadedFileBuffer.length) {
        throw new Error(
            "The uploaded Excel attachment could not be decoded."
        );
    }

    console.log(
        "[UPLOAD DEBUG] Raw Base64 attachment decoded:",
        {
            attachmentName:
                metadata.attachmentName || null,

            uploadedFileSize:
                uploadedFileBuffer.length,

            isBuffer:
                Buffer.isBuffer(
                    uploadedFileBuffer
                )
        }
    );

    return uploadedFileBuffer;
}

function normalizeActiveMedicareRequestId(
    requestId
) {
    const normalizedRequestId =
        String(
            requestId ||
            ""
        )
            .trim()
            .toUpperCase();

    return MEDICARE_REQUEST_ID_PATTERN.test(
        normalizedRequestId
    )
        ? normalizedRequestId
        : null;
}

function getActiveMedicareRequestIdFromState(
    state
) {
    const candidates = [
        state?.structuredMemory
            ?.domains
            ?.medicare_payment
            ?.activeRequestId,

        state?.structuredMemory
            ?.domains
            ?.medicarePayment
            ?.activeRequestId,

        state?.structuredMemory
            ?.medicare_payment
            ?.activeRequestId,

        state?.structuredMemory
            ?.activeMedicareRequestId,

        state?.activeMedicareRequestId,

        state?.requestId
    ];

    for (const candidate of candidates) {
        const normalizedRequestId =
            normalizeActiveMedicareRequestId(
                candidate
            );

        if (normalizedRequestId) {
            return normalizedRequestId;
        }
    }

    return null;
}

function buildMedicareRequestMemory(
    state,
    requestId
) {
    const normalizedRequestId =
        normalizeActiveMedicareRequestId(
            requestId
        );

    if (!normalizedRequestId) {
        return {};
    }

    return {
        requestId:
            normalizedRequestId,

        activeMedicareRequestId:
            normalizedRequestId,

        structuredMemory: {
            ...state?.structuredMemory,

            activeDomain:
                "medicare_payment",

            activeMedicareRequestId:
                normalizedRequestId,

            domains: {
                ...state?.structuredMemory
                    ?.domains,

                medicare_payment: {
                    ...state?.structuredMemory
                        ?.domains
                        ?.medicare_payment,

                    activeRequestId:
                        normalizedRequestId
                }
            }
        }
    };
}
async function returnMedicareDataQuestionResponse({
    state,
    cacheRecord,
    userQuestion
}) {
    const requestId =
        cacheRecord?.requestId ||
        null;

    const cacheKey =
        cacheRecord?.cacheKey ||
        null;

    if (!requestId) {
        throw new Error(
            "The completed Medicare cache record does not contain a Request ID."
        );
    }

    const status =
        String(
            cacheRecord?.status ||
            ""
        ).toUpperCase();

    if (status !== "COMPLETED") {
        return await returnMedicareCacheRecord({
            state,

            cacheRecord,

            containerName:
                MEDICARE_OUTPUT_CONTAINER,

            isSqlRequested:
                false
        });
    }

    const storedRowCount =
        await countStoredMedicareRows(
            requestId
        );

    if (storedRowCount === 0) {
        const unavailableMessage =
            `Request ID ${requestId} was completed, but queryable row data ` +
            `is not available for this older processing version.\n\n` +
            `Please upload the source Medicare file again to enable ` +
            `data questions for this request.`;

        return {
            ...state,

            ...buildMedicareRequestMemory(
                state,
                requestId
            ),

            formattedResponse:
                unavailableMessage,

            chatResponse: {
                content:
                    unavailableMessage
            },

            generatedFiles:
                [],

            brokerSplitTable:
                null,

            requestId,

            cacheKey,

            cacheHit:
                true,

            processing:
                false,

            dataQuestion:
                true,

            matchingRecordCount:
                0,

            chatSuccess:
                false,

            searchSuccess:
                false
        };
    }

    const questionResult =
        await answerMedicareDataQuestion({
            requestId,

            userQuestion
        });

    return {
        ...state,

        ...buildMedicareRequestMemory(
            state,
            requestId
        ),

        formattedResponse:
            questionResult
                .formattedResponse,

        chatResponse: {
            content:
                questionResult
                    .formattedResponse
        },

        generatedFiles:
            [],

        brokerSplitTable:
            null,

        requestId,

        cacheKey,

        cacheHit:
            true,

        processing:
            false,

        dataQuestion:
            true,

        matchingRecordCount:
            questionResult
                .matchingRecordCount,

        parsedMedicareQuestion:
            questionResult
                .parsedQuestion,

        chatSuccess:
            true,

        searchSuccess:
            true
    };
}
async function returnMedicareCacheRecord({
    state,
    cacheRecord,
    containerName,
    isSqlRequested
}) {
    const requestId =
        cacheRecord?.requestId ||
        null;

    const cacheKey =
        cacheRecord?.cacheKey ||
        null;

    const status =
        String(
            cacheRecord?.status ||
            ""
        ).toUpperCase();

    /*
     * Return an existing request that is still being processed.
     */
    if (
        status === "PROCESSING" ||
        status === "QUEUED" ||
        status === "RUNNING"
    ) {
        const brokerSplit =
            cacheRecord?.summary
                ?.brokerSplit ||
            [];

        console.log(
            "[MEDICARE TABLE DEBUG] Processing cache broker split:",
            {
                requestId,

                hasSummary:
                    Boolean(
                        cacheRecord?.summary
                    ),

                isArray:
                    Array.isArray(
                        brokerSplit
                    ),

                rowCount:
                    brokerSplit.length,

                brokerSplit
            }
        );

        const brokerSplitTable =
            buildMedicareBrokerSplitTable(
                brokerSplit
            );

        console.log(
            "[MEDICARE TABLE DEBUG] Processing table created:",
            {
                requestId,

                rowCount:
                    brokerSplitTable?.rows
                        ?.length ||
                    0,

                brokerSplitTable
            }
        );

        const message =
            buildProcessingMessage(
                requestId,
                true
            );

        return {
            ...state,
        
            ...buildMedicareRequestMemory(
                state,
                requestId
            ),
        
            formattedResponse:
                message,
        
            chatResponse: {
                content:
                    message
            },
        
            generatedFiles:
                [],
        
            brokerSplitTable,
        
            requestId,
        
            cacheKey,
        
            cacheHit:
                true,
        
            processing:
                true,
        
            chatSuccess:
                true,
        
            searchSuccess:
                true
        };
    }

    /*
     * Return a permanently failed request.
     */
    if (status === "FAILED") {
        const errorDetails =
            cacheRecord?.error?.message ||
            "The processing job failed.";

        const message =
            `Medicare request processing failed.\n\n` +
            `Request ID: ${requestId}\n\n` +
            `Details: ${errorDetails}`;

            return {
                ...state,
            
                ...buildMedicareRequestMemory(
                    state,
                    requestId
                ),
            
                formattedResponse:
                    message,
            
                chatResponse: {
                    content:
                        message
                },
            
                generatedFiles:
                    [],
            
                brokerSplitTable:
                    null,
            
                requestId,
            
                cacheKey,
            
                cacheHit:
                    true,
            
                processing:
                    false,
            
                chatSuccess:
                    false,
            
                searchSuccess:            
                false
        };
    }

    /*
     * Protect against unexpected cache statuses.
     */
    if (status !== "COMPLETED") {
        const message =
            `No completed result was found for Request ID ${requestId}.`;

        return {
            ...state,
        
            ...buildMedicareRequestMemory(
                state,
                requestId
            ),
        
            formattedResponse:
                message,

            chatResponse: {
                content:
                    message
            },

            generatedFiles:
                [],

            brokerSplitTable:
                null,

            requestId,

            cacheKey,

            cacheHit:
                true,

            processing:
                false,

            chatSuccess:
                false,

            searchSuccess:
                false
        };
    }

    /*
     * Build the completed response.
     */
    const generatedFiles =
        [];

    const excelBlobName =
        cacheRecord?.output
            ?.excelBlobName;

    const sqlBlobName =
        cacheRecord?.output
            ?.sqlBlobName;

    if (!excelBlobName) {
        throw new Error(
            `Excel output is missing for Request ID ${requestId}.`
        );
    }

    const excelSasUrl =
        await generateTemporaryDownloadLink(
            containerName,
            excelBlobName,
            60
        );

    if (!excelSasUrl) {
        throw new Error(
            `Could not generate the Excel download link for Request ID ${requestId}.`
        );
    }

    generatedFiles.push({
        name:
            "Medicare Processed Result (Excel)",

        url:
            excelSasUrl
    });

    let sqlSasUrl =
        "";

    if (
        isSqlRequested &&
        sqlBlobName
    ) {
        sqlSasUrl =
            await generateTemporaryDownloadLink(
                containerName,
                sqlBlobName,
                60
            );

        if (sqlSasUrl) {
            generatedFiles.push({
                name:
                    "Database Update Queries (SQL)",

                url:
                    sqlSasUrl
            });
        }
    }

    const metrics =
        cacheRecord?.metrics ||
        {};

    const totalRecords =
        metrics.totalRecords ??
        0;

    const generatedSqlActionCount =
        metrics.generatedSqlActionCount ??
        0;

    const unsupportedSqlActionCount =
        metrics.unsupportedSqlActionCount ??
        0;

    const jiraIssueKey =
        cacheRecord?.jira
            ?.issueKey ||
        null;
    
    const jiraIssueUrl =
    buildMedicareJiraIssueUrl(
        jiraIssueKey
    );
const brokerSplit =
    cacheRecord?.summary
        ?.brokerSplit ||
    [];

    console.log(
        "[MEDICARE TABLE DEBUG] Completed cache broker split:",
        {
            requestId,

            hasSummary:
                Boolean(
                    cacheRecord?.summary
                ),

            isArray:
                Array.isArray(
                    brokerSplit
                ),

            rowCount:
                brokerSplit.length,

            brokerSplit
        }
    );

    const brokerSplitTable =
        buildMedicareBrokerSplitTable(
            brokerSplit
        );

    console.log(
        "[MEDICARE TABLE DEBUG] Completed table created:",
        {
            requestId,

            rowCount:
                brokerSplitTable?.rows
                    ?.length ||
                0,

            brokerSplitTable
        }
    );

    let message =
        `Medicare Batch Processing Complete!\n\n` +
        `Request ID: ${requestId}\n\n` +
        `Total records processed: ${totalRecords}.\n\n`;

    if (
        isSqlRequested &&
        sqlSasUrl
    ) {
        message +=
            `SQL action groups generated: ${generatedSqlActionCount}.\n\n` +
            `Unsupported SQL actions: ${unsupportedSqlActionCount}.\n\n` +
            `The Excel and SQL files are available below.`;
    } else {
        message +=
            "The processed Excel file is available below.";
    }


    return {
        ...state,
    
        ...buildMedicareRequestMemory(
            state,
            requestId
        ),
    
        formattedResponse:
            message,
    
        chatResponse: {
            content:
                message
        },
    
        generatedFiles,
    
        brokerSplitTable,
    
        requestId,
    
        cacheKey,
    
        cacheHit:
            true,    

        processing:
            false,

        jiraIssueKey,

        jiraIssueUrl,
        
        chatSuccess:
            true,

        searchSuccess:
            true
    };
}
// ============================================================================
// 5. LANGGRAPH NODE EXPORT WITH MONGODB CACHE
// ============================================================================

export const medicarePaymentDiagnosticNode =
    async (state, config) => {
        console.log(
            "--> EXECUTING medicarePaymentDiagnosticNode..."
        );

        let cacheKey =
            null;

        let cacheProcessingStarted =
            false;

        try {
          //  await setProcessEnvironment();

            await ensureMedicareCacheIndexes();

            console.log(
                "[MEDICARE CACHE] Environment and indexes are ready."
            );

            const containerName =
                MEDICARE_OUTPUT_CONTAINER;

            const isSqlRequested =
                isSqlRequestedFromState(
                    state
                );

            const currentUserQuestion =
    getCurrentUserQuestionFromState(
        state
    );

/*
 * Detect a MongoDB-wide Medicare processing summary.
 *
 * This question does not require:
 * - An uploaded Excel file
 * - A Medicare Request ID
 * - An active request in session memory
 */
const isMongoDatabaseSummary =
    isMedicareMongoDatabaseSummaryQuestion(
        currentUserQuestion
    );

console.log(
    "[MEDICARE QUESTION DEBUG]",
    {
        currentUserQuestion,
        isMongoDatabaseSummary
    }
);

/*
 * Handle the MongoDB-wide summary before checking
 * for uploaded files or Request IDs.
 */
if (isMongoDatabaseSummary) {
    const mongoSummary =
        await answerMedicareMongoDatabaseSummaryQuestion({
            limit:
                100,

            /*
             * Restrict results to the current user.
             *
             * Remove requestedBy only if the requirement is
             * to show uploads from every user.
             */
            requestedBy:
                state?.nuid ||
                state?.metadata?.nuid ||
                null,

            /*
             * Also restrict results to the current team.
             */
            teamName:
                state?.teamName ||
                state?.metadata?.teamName ||
                null
        });

    console.log(
        "[MEDICARE MONGODB SUMMARY]",
        {
            fileCount:
                mongoSummary.fileCount,

            totalRecords:
                mongoSummary.totalRecords,

            recordCount:
                Array.isArray(
                    mongoSummary.records
                )
                    ? mongoSummary.records.length
                    : 0
        }
    );

    return {
    ...state,

    formattedResponse:
        mongoSummary.formattedResponse,

    chatResponse: {
        content:
            mongoSummary.formattedResponse
    },

    /*
     * A MongoDB-wide summary is not associated with
     * one specific request's generated files.
     */
    generatedFiles:
        [],

    brokerSplitTable:
        null,

    /*
     * Clear request-specific Jira values inherited
     * from the current LangGraph session.
     *
     * Otherwise ...state carries forward the Jira issue
     * from the previously active Medicare request.
     */
    jiraIssueKey:
        null,

    jiraIssueUrl:
        null,

    /*
     * This is a global MongoDB summary, not a response
     * for one active Medicare Request ID.
     */
    requestId:
        null,

    activeMedicareRequestId:
        state?.activeMedicareRequestId ||
        null,

    cacheKey:
        null,

    cacheHit:
        true,

    processing:
        false,

    medicareMongoSummary:
        true,

    medicareMongoSummaryResult:
        mongoSummary,

    chatSuccess:
        true,

    searchSuccess:
        true
};
}

            const isFileOutputRequest =
                isMedicareFileOutputRequest(
                    currentUserQuestion
                );

            const isDataQuestion =
                !isFileOutputRequest &&
                looksLikeMedicareDataQuestion(
                    currentUserQuestion
                );

            const hasUploadedFile =
                hasUploadedMedicareFile(
                    state
                );
            const explicitRequestId =
                extractMedicareRequestIdFromState(
                    state
                );

            const activeRequestId =
                getActiveMedicareRequestIdFromState(
                    state
                );
                console.log(
                    "[MEDICARE MEMORY DEBUG] Incoming memory:",
                    {
                        activeMedicareRequestId:
                            state?.activeMedicareRequestId ||
                            null,
                
                        requestId:
                            state?.requestId ||
                            null,
                
                        structuredMemory:
                            JSON.stringify(
                                state?.structuredMemory ||
                                null,
                                null,
                                2
                            )
                    }
                );

            const requestedRequestId =
                hasUploadedFile
                    ? null
                    : explicitRequestId ||
                        (
                            isDataQuestion
                                ? activeRequestId
                                : null
                        );

            console.log(
                "[MEDICARE REQUEST] Input selection:",
                {
                    hasUploadedFile,

                    explicitRequestId,

                    activeRequestId,

                    requestedRequestId,

                    isDataQuestion,

                    isFileOutputRequest,

                    processingMode:
                        hasUploadedFile
                            ? "UPLOADED_FILE"
                            : requestedRequestId
                                ? "REQUEST_ID_LOOKUP"
                                : "MISSING_INPUT"
                }
            );
            
            if (requestedRequestId) {
                console.log(
                    "[MEDICARE REQUEST] Looking up Request ID:",
                    requestedRequestId
                );

                const requestRecord =
                    await findMedicareCacheByRequestId(
                        requestedRequestId
                    );

                if (!requestRecord) {
                    const requestNotFoundMessage =
                        `No Medicare request was found for Request ID ` +
                        `${requestedRequestId}.\n\n` +
                        `Please verify the Request ID and try again.`;

                    return {
                        ...state,

                        formattedResponse:
                            requestNotFoundMessage,

                        chatResponse: {
                            content:
                                requestNotFoundMessage
                        },

                        generatedFiles:
                            [],

                        requestId:
                            requestedRequestId,

                        cacheKey:
                            null,

                        cacheHit:
                            false,

                        processing:
                            false,

                        chatSuccess:
                            false,

                        searchSuccess:
                            false
                    };
                }

                console.log(
                    "[MEDICARE REQUEST] Request record found:",
                    {
                        requestId:
                            requestRecord.requestId,

                        cacheKey:
                            requestRecord.cacheKey,

                        status:
                            requestRecord.status
                    }
                );

                const requestStatus =
                    String(
                        requestRecord?.status ||
                        ""
                    ).toUpperCase();

                if (
                    requestStatus === "COMPLETED" &&
                    isDataQuestion
                ) {
                    return await returnMedicareDataQuestionResponse({
                        state,

                        cacheRecord:
                            requestRecord,

                        userQuestion:
                            currentUserQuestion
                    });
                }

                return await returnMedicareCacheRecord({
                    state,

                    cacheRecord:
                        requestRecord,

                    containerName,

                    isSqlRequested
                });
            }

            if (!hasUploadedFile) {
                const missingInputMessage =
                    `Please upload a Medicare Excel file or provide an existing ` +
                    `Medicare Request ID so I can answer questions about the ` +
                    `correct dataset.`;

                return {
                    ...state,

                    formattedResponse:
                        missingInputMessage,

                    chatResponse: {
                        content:
                            missingInputMessage
                    },

                    generatedFiles:
                        [],

                    requestId:
                        null,

                    cacheKey:
                        null,

                    cacheHit:
                        false,

                    processing:
                        false,

                    chatSuccess:
                        false,

                    searchSuccess:
                        false
                };
            }

            console.log(
                "[UPLOAD DEBUG] Metadata received:",
                {
                    metadataKeys:
                        Object.keys(
                            state?.metadata || {}
                        ),

                    attachmentName:
                        state?.metadata
                            ?.attachmentName ||
                        null,

                    attachmentContentType:
                        typeof state?.metadata
                            ?.attachmentContent,

                    attachmentContentLength:
                        typeof state?.metadata
                            ?.attachmentContent ===
                        "string"
                            ? state.metadata
                                .attachmentContent
                                .length
                            : 0,

                    hasUploadedFileBuffer:
                        Boolean(
                            state?.metadata
                                ?.uploadedFileBuffer
                        ),

                    uploadedFilePath:
                        state?.metadata
                            ?.uploadedFilePath ||
                        null
                }
            );

            const uploadedFile =
                getUploadedExcelFileFromState(
                    state
                );

            console.log(
                "[UPLOAD DEBUG] File selected for processing:",
                {
                    attachmentName:
                        state?.metadata
                            ?.attachmentName ||
                        state?.metadata
                            ?.uploadedFileName ||
                        null,

                    source:
                        state?.metadata
                            ?.uploadedFileBuffer
                            ? "uploadedFileBuffer"
                            : state?.metadata
                                ?.uploadedFilePath
                                ? "uploadedFilePath"
                                : "attachmentContent",

                    isBuffer:
                        Buffer.isBuffer(
                            uploadedFile
                        ),

                    bufferLength:
                        Buffer.isBuffer(
                            uploadedFile
                        )
                            ? uploadedFile.length
                            : null,

                    filePath:
                        typeof uploadedFile ===
                        "string"
                            ? uploadedFile
                            : null
                }
            );

            const uploadedFileBuffer =
                await normalizeUploadedFileToBuffer(
                    uploadedFile
                );

            const fileHash =
                generateMedicareFileHash(
                    uploadedFileBuffer
                );

            cacheKey =
                generateMedicareCacheKey(
                    fileHash
                );

            const attachmentName =
                state?.metadata
                    ?.attachmentName ||
                state?.metadata
                    ?.uploadedFileName ||
                "uploaded-medicare-file.xlsx";

            console.log(
                "[MEDICARE CACHE] Cache lookup:",
                {
                    cacheKey,

                    processorVersion:
                        MEDICARE_PROCESSOR_VERSION,

                    attachmentName,

                    fileSize:
                        uploadedFileBuffer.length,

                    isSqlRequested
                }
            );

            const existingRecord =
                await findMedicareCacheByCacheKey(
                    cacheKey
                );

            if (existingRecord) {
                console.log(
                    "[MEDICARE CACHE] Existing file record found:",
                    {
                        requestId:
                            existingRecord.requestId,
            
                        cacheKey:
                            existingRecord.cacheKey,
            
                        status:
                            existingRecord.status
                    }
                );
            
                const existingStatus =
                    String(
                        existingRecord.status ||
                        ""
                    ).toUpperCase();
            
                if (
                    existingStatus === "COMPLETED" &&
                    isDataQuestion
                ) {
                    return await returnMedicareDataQuestionResponse({
                        state,
            
                        cacheRecord:
                            existingRecord,
            
                        userQuestion:
                            currentUserQuestion
                    });
                }
            
                return await returnMedicareCacheRecord({
                    state,
            
                    cacheRecord:
                        existingRecord,
            
                    containerName,
            
                    isSqlRequested
                });
            }

            console.log(
                "[MEDICARE CACHE] New file cache miss:",
                {
                    cacheKey,
                    fileHash
                }
            );
            const brokerSplit =
                await buildMedicareBrokerSplit(
                    uploadedFileBuffer
                );
            const proposedRequestId =
                generateMedicareRequestId();

            const processingRecord =
                await markMedicareCacheProcessing({
                    requestId:
                        proposedRequestId,

                    cacheKey,

                    fileHash,

                    processorVersion:
                        MEDICARE_PROCESSOR_VERSION,

                    sourceFileName:
                        attachmentName,

                    sourceFileSize:
                        uploadedFileBuffer.length,

                    requestedBy:
                        state?.nuid ||
                        state?.metadata?.nuid ||
                        null,

                    teamName:
                        state?.teamName ||
                        state?.metadata?.teamName ||
                        null,
                    brokerSplit
                });

            if (!processingRecord) {
                throw new Error(
                    "MongoDB did not return the Medicare processing record."
                );
            }

            const requestId =
                processingRecord.requestId;

            if (!requestId) {
                throw new Error(
                    "The Medicare processing record does not contain a Request ID."
                );
            }

            cacheProcessingStarted =
                requestId ===
                proposedRequestId;

            if (
                requestId !==
                proposedRequestId
            ) {
                console.log(
                    "[MEDICARE CACHE] Duplicate file request detected:",
                    {
                        proposedRequestId,
            
                        existingRequestId:
                            requestId,
            
                        cacheKey,
            
                        status:
                            processingRecord.status
                    }
                );
            
                const duplicateStatus =
                    String(
                        processingRecord?.status ||
                        ""
                    ).toUpperCase();
            
                if (
                    duplicateStatus === "COMPLETED" &&
                    isDataQuestion
                ) {
                    return await returnMedicareDataQuestionResponse({
                        state,
            
                        cacheRecord:
                            processingRecord,
            
                        userQuestion:
                            currentUserQuestion
                    });
                }
            
                return await returnMedicareCacheRecord({
                    state,
            
                    cacheRecord:
                        processingRecord,
            
                    containerName,
            
                    isSqlRequested
                });
            }

            const safeAttachmentName =
                String(
                    attachmentName
                ).replace(
                    /[^a-zA-Z0-9._-]/g,
                    "_"
                );

            const sourceBlobName =
                `source/${requestId}/${safeAttachmentName}`;

            console.log(
                "[MEDICARE REQUEST] Uploading source file for background processing:",
                {
                    requestId,
                    cacheKey,
                    sourceBlobName,
                    sourceFileSize:
                        uploadedFileBuffer.length
                }
            );

            const sourceUploadSuccess =
                await writeFileBufferToBlobStorage(
                    uploadedFileBuffer,
                    MEDICARE_SOURCE_CONTAINER,
                    sourceBlobName,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                );

            if (!sourceUploadSuccess) {
                throw new Error(
                    "Failed to upload the original Medicare file for background processing."
                );
            }

            await enqueueMedicareProcessingJob({
                requestId,

                cacheKey,

                fileHash,

                processorVersion:
                    MEDICARE_PROCESSOR_VERSION,

                sourceContainerName:
                    MEDICARE_SOURCE_CONTAINER,

                sourceBlobName,

                outputContainerName:
                    MEDICARE_OUTPUT_CONTAINER,

                attachmentName,

                sourceFileSize:
                    uploadedFileBuffer.length,

                requestedBy:
                    state?.nuid ||
                    state?.metadata?.nuid ||
                    null,

                teamName:
                    state?.teamName ||
                    state?.metadata?.teamName ||
                    null,

                processingContext: {
                    teamName:
                        state?.teamName ||
                        state?.metadata?.teamName ||
                        null,

                    assistantName:
                        state?.assistantName ||
                        null,

                    nuid:
                        state?.nuid ||
                        state?.metadata?.nuid ||
                        null,

                    intent:
                        state?.intent ||
                        null
                }
            });
            /*
            * Schedule Medicare processing after the chat response finishes.
            *
            * Do not await the processing node here. Next.js after() keeps
            * the long-running work outside the user-facing response path.
            */
            after(async () => {
                console.log(
                    "[MEDICARE REQUEST] Starting automatic background processing:",
                    {
                        requestId,
                        cacheKey
                    }
                );

                try {
                    await medicareQueueProcessingNode({
                        requestId,
                        cacheKey
                    });

                    console.log(
                        "[MEDICARE REQUEST] Automatic background processing finished:",
                        {
                            requestId,
                            cacheKey
                        }
                    );
                } catch (backgroundError) {
                    console.error(
                        "[MEDICARE REQUEST] Automatic background processing failed:",
                        {
                            requestId,
                            cacheKey,

                            error:
                                backgroundError instanceof Error
                                    ? backgroundError.message
                                    : String(backgroundError)
                        }
                    );
                }
            });
            console.log(
                "[MEDICARE REQUEST] Background processing job submitted:",
                {
                    requestId,
                    cacheKey,
                    sourceBlobName
                }
            );

            const processingMessage =
                buildProcessingMessage(
                    requestId,
                    false
                );

            const brokerSplitTable =
                buildMedicareBrokerSplitTable(
                    brokerSplit
                );

            return {
                ...state,
            
                ...buildMedicareRequestMemory(
                    state,
                    requestId
                ),
            
                formattedResponse:
                    processingMessage,
            
                chatResponse: {
                    content:
                        processingMessage
                },
            
                generatedFiles:
                    [],
            
                brokerSplitTable,
            
                requestId,
            
                cacheKey,
            
                cacheHit:
                    false,
            
                processing:
                    true,
            
                chatSuccess:
                    true,
            
                searchSuccess:
                    true
            };
        } catch (err) {
            console.error(
                "Error in medicarePaymentDiagnosticNode:",
                err
            );

            if (
                cacheKey &&
                cacheProcessingStarted
            ) {
                try {
                    await markMedicareCacheFailed(
                        cacheKey,
                        err
                    );
                } catch (cacheError) {
                    console.error(
                        "[MEDICARE CACHE] Failed to mark request as FAILED:",
                        cacheError
                    );
                }
            }

            const errorDetails =
                err instanceof Error
                    ? err.message
                    : String(err);

            const errorMessage =
                "An error occurred while submitting the Medicare request. " +
                `Details: ${errorDetails}`;

            return {
                ...state,

                generatedFiles:
                    [],

                formattedResponse:
                    errorMessage,

                chatResponse: {
                    content:
                        errorMessage
                },

                requestId:
                    null,

                cacheHit:
                    false,

                cacheKey,

                processing:
                    false,

                chatSuccess:
                    false,

                searchSuccess:
                    false
            };
        }
    };
//     } catch (err) {
//         console.error("Error in medicarePaymentDiagnosticNode:", err);
        
        
//         return {
//             ...state,
//             generatedFiles: fileLinks,
//             formattedResponse: "An error occurred while processing the Medicare files. Please check the logs.",
//             chatResponse: "An error occurred while processing the Medicare files. Please check the logs.",
//             chatSuccess: false,
//             searchSuccess: false
//         };

//     }
// };