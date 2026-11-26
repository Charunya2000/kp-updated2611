

import {
    aggregateMedicareRowsByBroker,
    countMedicareProcessedRows,
    countStoredMedicareRows,
    findMedicareProcessedRows,
    findMedicareProcessedRowsByHcin,
    normalizeMedicareHcin,
    normalizeMedicareText
} from "./medicareProcessedRows.js";
import {
    findCompletedMedicareBatchRecords
} from "./medicareBatchCache.js";
/*
 * Maximum number of detail rows returned in one chat response.
 */
const MAX_DETAIL_ROWS =
    20;

/*
 * Broker aliases supported in natural-language questions.
 *
 * The alias value must match brokerName stored in
 * medicare_processed_rows.
 */
const BROKER_ALIASES = [
    {
        canonicalName:
            "SelectQuote",

        patterns: [
            /\bselect\s*quote\b/i,
            /\bselectquote\b/i,
            /\bSQ\b/i
        ]
    },
    {
        canonicalName:
            "eHealth",

        patterns: [
            /\be[\s-]*health\b/i,
            /\behealth\b/i,
            /\bEH\b/i
        ]
    },
    {
        canonicalName:
            "GoHealth",

        patterns: [
            /\bgo[\s-]*health\b/i,
            /\bgohealth\b/i,
            /\bGH\b/i
        ]
    },
    {
        canonicalName:
            "Tranzact",

        patterns: [
            /\btranzact\b/i,
            /\bTZ\b/i
        ]
    },
    {
        canonicalName:
            "Premier",

        patterns: [
            /\bpremier\b/i,
            /\bPRE\b/i
        ]
    },
    {
        canonicalName:
            "Integrity",

        patterns: [
            /\bintegrity\b/i,
            /\bINT\b/i
        ]
    },
    {
        canonicalName:
            "Aptia",

        patterns: [
            /\baptia\b/i,
            /\bAPT\b/i
        ]
    },
    {
        canonicalName:
            "ARHE",

        patterns: [
            /\bARHE\b/i
        ]
    },
    {
        canonicalName:
            "TW",

        patterns: [
            /\bTW\b/i
        ]
    },
    {
        canonicalName:
            "GS National",

        patterns: [
            /\bGS\s+National\b/i,
            /\bGSNational\b/i,
            /\bGSN\b/i
        ]
    },
    {
        canonicalName:
            "HealthMarkets",

        patterns: [
            /\bhealth\s*markets\b/i,
            /\bhealthmarket\b/i,
            /\bhealthmarkets\b/i,
            /\bHM\b/i
        ]
    },
    {
        canonicalName:
            "AmeriLife",

        patterns: [
            /\bameri\s*life\b/i,
            /\bamerilife\b/i,
            /\bAML\b/i
        ]
    },
    {
        canonicalName:
            "HPOne",

        patterns: [
            /\bHP\s*One\b/i,
            /\bHPOne\b/i
        ]
    }
];

/*
 * Natural-language action mappings.
 *
 * A chargeback question intentionally includes both:
 *
 * REVERSE_CB
 * CB_RENEWAL_COMM
 */
const ACTION_DEFINITIONS = [
    /*
     * Generic chargeback.
     *
     * Specific CB renewal and reverse-CB rules are
     * evaluated first by extractActionDefinition().
     */
    {
        key:
            "CHARGEBACK",

        label:
            "chargeback",

        actionTypes: [
            "REVERSE_CB",
            "CB_RENEWAL_COMM"
        ],

        patterns: [
            /\bcharge[\s-]*backs?\b/i,
            /\bcharge[\s-]*back\s+records?\b/i,
            /\bcharge[\s-]*back\s+details?\b/i,
            /\bcharge[\s-]*back\s+counts?\b/i,
            /\bcharge[\s-]*back\s+transactions?\b/i,
            /\bhow\s+many\s+charge[\s-]*backs?\b/i,
            /\btotal\s+charge[\s-]*backs?\b/i,
            /\bnumber\s+of\s+charge[\s-]*backs?\b/i,
            /\bCB\b/i,
            /\bCB\s+records?\b/i,
            /\bCB\s+details?\b/i,
            /\bCB\s+counts?\b/i
        ]
    },

    /*
     * Reverse chargeback.
     */
    {
        key:
            "REVERSE_CB",

        label:
            "reverse chargeback",

        actionTypes: [
            "REVERSE_CB"
        ],

        patterns: [
            /\breverse\s+CBs?\b/i,
            /\breversed\s+CBs?\b/i,
            /\breversing\s+CBs?\b/i,

            /\breverse\s+charge[\s-]*backs?\b/i,
            /\breversed\s+charge[\s-]*backs?\b/i,
            /\breversing\s+charge[\s-]*backs?\b/i,

            /\breverse\b.*\bCB\b/i,
            /\breverse\b.*\bcharge[\s-]*backs?\b/i,

            /\bcharge[\s-]*back\s+reversals?\b/i,
            /\breversals?\s+of\s+charge[\s-]*backs?\b/i,

            /\breverse\s+(?:year\s*\d{4}\s+|yr\s*\d{4}\s+|\d{4}\s+)?CBs?\b/i,
            /\breverse\s+(?:year\s*\d{4}\s+|yr\s*\d{4}\s+|\d{4}\s+)?charge[\s-]*backs?\b/i
        ]
    },

    /*
     * Chargeback renewal commission.
     *
     * This must be checked before normal PAY_RENEWAL.
     */
    {
        key:
            "CB_RENEWAL_COMM",

        label:
            "chargeback renewal commission",

        actionTypes: [
            "CB_RENEWAL_COMM"
        ],

        patterns: [
            /\bCB\b.*\brenewals?\b/i,
            /\bCB\b.*\bcomm(?:ission)?s?\b/i,
            /\bCB\s+renewal\s+comm(?:ission)?s?\b/i,
            /\bCB\s+comm(?:ission)?s?\s+(?:for\s+)?renewals?\b/i,

            /\bcharge[\s-]*backs?\b.*\brenewals?\b/i,
            /\bcharge[\s-]*backs?\b.*\bcomm(?:ission)?s?\b/i,

            /\brenewal\s+comm(?:ission)?s?\s+charge[\s-]*backs?\b/i,
            /\brenewals?\b.*\bcharge[\s-]*backs?\b/i,

            /\bcharge[\s-]*backs?\s+(?:for\s+)?renewal\s+comm(?:ission)?s?\b/i
        ]
    },

    /*
     * Initial payment.
     */
    {
        key:
            "PAY_INITIAL",

        label:
            "initial payment",

        actionTypes: [
            "PAY_INITIAL"
        ],

        patterns: [
            /\bpay\s+initial\b/i,
            /\bpay\s+initial\s+payments?\b/i,
            /\bpay\s+initial\s+comm(?:ission)?s?\b/i,

            /\binitial\s+payments?\b/i,
            /\binitial\s+payment\s+records?\b/i,
            /\binitial\s+payment\s+details?\b/i,
            /\binitial\s+payment\s+counts?\b/i,

            /\binitial\s+comm(?:ission)?s?\b/i,
            /\binitial\s+transactions?\b/i,

            /\bfirst\s+payments?\b/i,
            /\bfirst\s+comm(?:ission)?s?\b/i,

            /\bhow\s+many\s+initial\s+payments?\b/i,
            /\btotal\s+initial\s+payments?\b/i,
            /\bnumber\s+of\s+initial\s+payments?\b/i
        ]
    },

    /*
     * Renewal payment.
     *
     * The more-specific CB_RENEWAL_COMM rule is checked
     * before this rule.
     */
    {
        key:
            "PAY_RENEWAL",

        label:
            "renewal payment",

        actionTypes: [
            "PAY_RENEWAL"
        ],

        patterns: [
            /\bpay\s+renewals?\b/i,
            /\bpay\b.*\brenewals?\b/i,

            /\bpay\s+year\s*\d{4}\s+renewals?\b/i,
            /\bpay\s+yr\s*\d{4}\s+renewals?\b/i,
            /\bpay\s+\d{4}\s+renewals?\b/i,

            /\brenewals?\s+payments?\b/i,
            /\brenewals?\s+payment\s+records?\b/i,
            /\brenewals?\s+payment\s+details?\b/i,
            /\brenewals?\s+payment\s+counts?\b/i,

            /\brenewals?\s+commissions?\b/i,
            /\brenewals?\s+commission\s+payments?\b/i,

            /\brenewals?\s+transactions?\b/i,
            /\brenewals?\s+records?\b/i,
            /\brenewals?\s+details?\b/i,
            /\brenewals?\s+counts?\b/i,

            /\bhow\s+many\s+renewals?\b/i,
            /\btotal\s+renewals?\b/i,
            /\bnumber\s+of\s+renewals?\b/i,

            /*
             * Generic fallback.
             *
             * Safe because CB_RENEWAL_COMM is checked first.
             */
            /\brenewals?\b/i
        ]
    },

    /*
     * Disenrollment and cancellation.
     */
    {
        key:
            "PROCESS_DISENROLLMENT",

        label:
            "disenrollment or cancellation",

        actionTypes: [
            "PROCESS_DISENROLLMENT"
        ],

        patterns: [
            /\bprocess\s+(?:for\s+)?disenroll(?:ment)?s?\b/i,
            /\bprocess\b.*\bdisenroll(?:ment)?s?\b/i,

            /\bdisenroll(?:ment)?s?\b/i,
            /\bdisenrolled\b/i,
            /\bdisenrolling\b/i,

            /\bdisenrollment\s+records?\b/i,
            /\bdisenrollment\s+details?\b/i,
            /\bdisenrollment\s+counts?\b/i,
            /\bdisenrollment\s+transactions?\b/i,

            /\bhow\s+many\s+disenrollments?\b/i,
            /\btotal\s+disenrollments?\b/i,
            /\bnumber\s+of\s+disenrollments?\b/i,

            /\bcancell?ations?\b/i,
            /\bcancelled\b/i,
            /\bcanceled\b/i,
            /\bcancel\s+membership\b/i,
            /\bmembership\s+cancell?ations?\b/i,

            /\btermination\s+details?\b/i,
            /\bterminated\s+members?\b/i
        ]
    }
];

/**
 * Escapes text before using it in a dynamically created regular expression.
 */
function escapeRegularExpression(
    value
) {
    return String(
        value ?? ""
    ).replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
}

/**
 * Converts an unknown message value into plain text.
 */
function normalizeQuestionInput(
    question
) {
    return String(
        question ?? ""
    )
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}
export function isMedicareMongoDatabaseSummaryQuestion(
    question
) {
    const normalizedQuestion =
        normalizeQuestionInput(
            question
        );

    if (!normalizedQuestion) {
        return false;
    }

    const mentionsMedicare =
        /\bmedicare\b/i.test(
            normalizedQuestion
        );

    const mentionsMongoDatabase =
        /\bmongodb\b/i.test(
            normalizedQuestion
        ) ||
        /\bmongo\s+db\b/i.test(
            normalizedQuestion
        ) ||
        /\bdatabase\b/i.test(
            normalizedQuestion
        );

    const asksForCountOrList =
        /\bhow\s+many\b/i.test(
            normalizedQuestion
        ) ||
        /\bcounts?\b/i.test(
            normalizedQuestion
        ) ||
        /\btotal\b/i.test(
            normalizedQuestion
        ) ||
        /\bnumber\s+of\b/i.test(
            normalizedQuestion
        ) ||
        /\blist\b/i.test(
            normalizedQuestion
        ) ||
        /\bshow\b/i.test(
            normalizedQuestion
        ) ||
        /\bdisplay\b/i.test(
            normalizedQuestion
        ) ||
        /\bprovide\b/i.test(
            normalizedQuestion
        ) ||
        /\bgive\s+me\b/i.test(
            normalizedQuestion
        ) ||
        /\bget\s+me\b/i.test(
            normalizedQuestion
        );

    const mentionsRecordsOrFiles =
        /\brecords?\b/i.test(
            normalizedQuestion
        ) ||
        /\brows?\b/i.test(
            normalizedQuestion
        ) ||
        /\btransactions?\b/i.test(
            normalizedQuestion
        ) ||
        /\bfiles?\b/i.test(
            normalizedQuestion
        ) ||
        /\bexcel\b/i.test(
            normalizedQuestion
        );

    const mentionsProcessing =
        /\bprocessed\b/i.test(
            normalizedQuestion
        ) ||
        /\bprocessing\b/i.test(
            normalizedQuestion
        ) ||
        /\bstored\b/i.test(
            normalizedQuestion
        ) ||
        /\buploaded\b/i.test(
            normalizedQuestion
        ) ||
        /\bcompleted\b/i.test(
            normalizedQuestion
        );

    /*
     * Explicit MongoDB/database wording takes priority
     * over the active Medicare Request ID.
     *
     * Examples:
     * - Get Medicare processed record counts from MongoDB.
     * - List processed Medicare files from the database.
     * - How many Medicare records are stored in mongo db?
     */
    const isExplicitMongoDatabaseSummary =
        mentionsMedicare &&
        mentionsMongoDatabase &&
        asksForCountOrList &&
        mentionsRecordsOrFiles;

    if (isExplicitMongoDatabaseSummary) {
        return true;
    }

    /*
     * Detect request-specific questions.
     */
    const hasMedicareRequestId =
        /\bMED-(?:[A-F0-9]{12}|\d{8}-\d{6}-[A-F0-9]{4})\b/i.test(
            normalizedQuestion
        );

    const hasHicn =
        /\bHICN\b/i.test(
            normalizedQuestion
        ) ||
        /\bHCIN\b/i.test(
            normalizedQuestion
        );

    const mentionsActionCategory =
        /\bpay\s+initial\b/i.test(
            normalizedQuestion
        ) ||
        /\binitial\s+payments?\b/i.test(
            normalizedQuestion
        ) ||
        /\bpay\s+renewal\b/i.test(
            normalizedQuestion
        ) ||
        /\brenewal\s+payments?\b/i.test(
            normalizedQuestion
        ) ||
        /\breverse\b/i.test(
            normalizedQuestion
        ) ||
        /\bchargeback\b/i.test(
            normalizedQuestion
        ) ||
        /\bdisenroll(?:ment)?\b/i.test(
            normalizedQuestion
        ) ||
        /\bcancell?ation\b/i.test(
            normalizedQuestion
        );

    const mentionsBroker =
        /\bbroker\b/i.test(
            normalizedQuestion
        ) ||
        /\behealth\b/i.test(
            normalizedQuestion
        ) ||
        /\bselectquote\b/i.test(
            normalizedQuestion
        ) ||
        /\bgs\s+national\b/i.test(
            normalizedQuestion
        ) ||
        /\bgohealth\b/i.test(
            normalizedQuestion
        ) ||
        /\bhealth\s*markets?\b/i.test(
            normalizedQuestion
        ) ||
        /\bamerilife\b/i.test(
            normalizedQuestion
        ) ||
        /\bhpone\b/i.test(
            normalizedQuestion
        ) ||
        /\btranzact\b/i.test(
            normalizedQuestion
        ) ||
        /\bintegrity\b/i.test(
            normalizedQuestion
        ) ||
        /\bpremier\b/i.test(
            normalizedQuestion
        ) ||
        /\baptia\b/i.test(
            normalizedQuestion
        );

    /*
     * Dataset-specific questions must use the active or
     * explicit Medicare Request ID.
     */
    if (
        hasMedicareRequestId ||
        hasHicn ||
        mentionsActionCategory ||
        mentionsBroker
    ) {
        return false;
    }

    const mentionsGlobalScope =
        /\bprocessing\s+history\b/i.test(
            normalizedQuestion
        ) ||
        /\bupload\s+history\b/i.test(
            normalizedQuestion
        ) ||
        /\ball\s+(?:processed\s+)?medicare\s+files\b/i.test(
            normalizedQuestion
        ) ||
        /\ball\s+(?:uploaded\s+)?medicare\s+files\b/i.test(
            normalizedQuestion
        ) ||
        /\beach\s+(?:processed\s+)?medicare\s+file\b/i.test(
            normalizedQuestion
        ) ||
        /\boverall\b/i.test(
            normalizedQuestion
        );

    /*
     * Preserve the simple generic question:
     *
     * "How many Medicare records were processed?"
     */
    const isGenericProcessedCountQuestion =
        mentionsMedicare &&
        /\bhow\s+many\b/i.test(
            normalizedQuestion
        ) &&
        /\brecords?\b/i.test(
            normalizedQuestion
        ) &&
        /\bprocessed\b/i.test(
            normalizedQuestion
        );

    /*
     * Support list-style global questions:
     *
     * "List all processed Medicare files and record counts."
     */
    const isGlobalListQuestion =
        mentionsMedicare &&
        mentionsGlobalScope &&
        asksForCountOrList &&
        mentionsRecordsOrFiles &&
        mentionsProcessing;

    return (
        isGenericProcessedCountQuestion ||
        isGlobalListQuestion
    );
}
/**
 * Detects whether the user is asking for generated files instead
 * of asking a question about the stored Medicare rows.
 */
export function isMedicareFileOutputRequest(
    question
) {
    const normalizedQuestion =
        normalizeQuestionInput(
            question
        );

    if (!normalizedQuestion) {
        return false;
    }

    const filePatterns = [
        /\bdownload\b/i,
        /\bdownload\s+link\b/i,
        /\bexcel\s+file\b/i,
        /\bprocessed\s+excel\b/i,
        /\bsql\s+file\b/i,
        /\bsql\s+output\b/i,
        /\bgenerated\s+files?\b/i,
        /\bshow\s+(?:me\s+)?(?:the\s+)?files?\b/i,
        /\bgive\s+(?:me\s+)?(?:the\s+)?files?\b/i,
        /\bget\s+(?:the\s+)?(?:excel|sql)\b/i
    ];

    return filePatterns.some(
        function (
            pattern
        ) {
            return pattern.test(
                normalizedQuestion
            );
        }
    );
}

/**
 * Determines whether the current message looks like a question
 * about previously processed Medicare row data.
 */
export function looksLikeMedicareDataQuestion(
    question
) {
    const normalizedQuestion =
        normalizeQuestionInput(
            question
        );

    if (!normalizedQuestion) {
        return false;
    }

    if (
        isMedicareFileOutputRequest(
            normalizedQuestion
        )
    ) {
        return false;
    }

    const dataQuestionPatterns = [
        /\bhow\s+many\b/i,
        /\bcount\b/i,
        /\btotal\b/i,
        /\bnumber\s+of\b/i,
        /\bshow\b/i,
        /\blist\b/i,
        /\bfind\b/i,
        /\bwhich\b/i,
        /\bwhat\b/i,
        /\bgive\s+me\b/i,
        /\bsummary\b/i,
        /\bdetails?\b/i,
        /\brecords?\b/i,
        /\brows?\b/i,
        /\btransactions?\b/i,
        /\bbrokers?\b/i,
        /\bHICN\b/i,
        /\bHCIN\b/i,
        /\bpayment\s+summary\b/i,
        /\bAI\s+summary\b/i,
        /\bcharge[\s-]*backs?\b/i,
        /\brenewals?\b/i,
        /\binitial\s+payments?\b/i,
        /\bdisenroll(?:ment)?s?\b/i,
        /\bcancell?ations?\b/i,
        /\bpay\s+initial\b/i,
        /\bpay\b.*\brenewal\b/i,
        /\breverse\s+CB\b/i,
        /\bCB\s+comm\b/i
    ];

    return dataQuestionPatterns.some(
        function (
            pattern
        ) {
            return pattern.test(
                normalizedQuestion
            );
        }
    );
}

/**
 * Finds a broker name mentioned in the question.
 */
function extractBrokerName(
    question
) {
    for (
        const brokerDefinition of
        BROKER_ALIASES
    ) {
        const matched =
            brokerDefinition.patterns.some(
                function (
                    pattern
                ) {
                    return pattern.test(
                        question
                    );
                }
            );

        if (matched) {
            return brokerDefinition
                .canonicalName;
        }
    }

    return null;
}

/**
 * Finds an action type mentioned in the question.
 *
 * Specific CB renewal commission wording is checked before
 * the general chargeback definition.
 */
function extractActionDefinition(
    question
) {
    const priorityOrder = [
        "CB_RENEWAL_COMM",
        "REVERSE_CB",
        "PAY_INITIAL",
        "PAY_RENEWAL",
        "PROCESS_DISENROLLMENT",
        "CHARGEBACK"
    ];

    for (
        const actionKey of
        priorityOrder
    ) {
        const definition =
            ACTION_DEFINITIONS.find(
                function (
                    item
                ) {
                    return item.key ===
                        actionKey;
                }
            );

        if (!definition) {
            continue;
        }

        const matched =
            definition.patterns.some(
                function (
                    pattern
                ) {
                    return pattern.test(
                        question
                    );
                }
            );

        if (matched) {
            return definition;
        }
    }

    return null;
}

/**
 * Extracts a four-digit target year.
 */
function extractTargetYear(
    question
) {
    const match =
        question.match(
            /\b(20\d{2})\b/
        );

    return match
        ? match[1]
        : null;
}

/**
 * Extracts a likely HICN or HCIN value from a question.
 *
 * Preferred examples:
 *
 * HICN ABC123456
 * HCIN: ABC123456
 * for HICN ABC123456
 */
function extractHcin(
    question
) {
    const explicitMatch =
        /\b(?:HICN|HCIN)\s*(?:number|#|:|is|=)?\s*([a-zA-Z0-9-]{4,30})\b/i.exec(
            question
        );

    if (explicitMatch?.[1]) {
        const normalized =
            normalizeMedicareHcin(
                explicitMatch[1]
            );

        return normalized.length >= 4
            ? normalized
            : null;
    }

    return null;
}

/**
 * Determines what response style the user requested.
 */
// function extractQuestionMode(
//     question,
//     parsedFilters
// ) {
//     if (
//         parsedFilters.hcin &&
//         (
//             /\bsummary\b/i.test(
//                 question
//             ) ||
//             /\bdetails?\b/i.test(
//                 question
//             ) ||
//             /\bwhat\b/i.test(
//                 question
//             ) ||
//             /\bshow\b/i.test(
//                 question
//             )
//         )
//     ) {
//         return "HICN_DETAILS";
//     }

//     if (
//         /\bAI\s+(?:payment\s+)?summary\b/i.test(
//             question
//         ) ||
//         /\bpayment\s+summary\b/i.test(
//             question
//         )
//     ) {
//         return parsedFilters.hcin
//             ? "HICN_DETAILS"
//             : "DETAIL_LIST";
//     }

//     if (
//         /\bbroker\s+(?:split|summary|breakdown)\b/i.test(
//             question
//         ) ||
//         /\bsummary\s+by\s+broker\b/i.test(
//             question
//         ) ||
//         /\bgroup(?:ed)?\s+by\s+broker\b/i.test(
//             question
//         )
//     ) {
//         return "BROKER_SUMMARY";
//     }

//     if (
//         /\bshow\b/i.test(
//             question
//         ) ||
//         /\blist\b/i.test(
//             question
//         ) ||
//         /\bdetails?\b/i.test(
//             question
//         ) ||
//         /\brecords?\b/i.test(
//             question
//         ) ||
//         /\brows?\b/i.test(
//             question
//         )
//     ) {
//         return "DETAIL_LIST";
//     }

//     return "COUNT";
// }
function extractQuestionMode(
    question,
    parsedFilters
) {
    const normalizedQuestion =
        normalizeQuestionInput(
            question
        );

    /*
     * HICN-specific questions should return record details.
     */
    if (parsedFilters.hcin) {
        return "HICN_DETAILS";
    }

    /*
     * Payment-summary questions should return matching
     * record details rather than only a count.
     */
    if (
        /\bAI\s+(?:payment\s+)?summary\b/i.test(
            normalizedQuestion
        ) ||
        /\bpayment\s+summary\b/i.test(
            normalizedQuestion
        )
    ) {
        return "DETAIL_LIST";
    }

    /*
     * Broker summary or broker breakdown questions keep
     * the existing aggregation behavior.
     */
    if (
        /\bbroker\s+(?:split|summary|breakdown)\b/i.test(
            normalizedQuestion
        ) ||
        /\bsummary\s+by\s+broker\b/i.test(
            normalizedQuestion
        ) ||
        /\bgroup(?:ed)?\s+by\s+broker\b/i.test(
            normalizedQuestion
        )
    ) {
        return "BROKER_SUMMARY";
    }

    /*
     * If the user explicitly requests details, rows,
     * records, a list, display, or show, return details
     * even when the question also contains "count".
     *
     * Example:
     * "Get me count disenrollment details"
     */
    const explicitlyRequestsDetails =
        /\bshow\b/i.test(
            normalizedQuestion
        ) ||
        /\blist\b/i.test(
            normalizedQuestion
        ) ||
        /\bdetails?\b/i.test(
            normalizedQuestion
        ) ||
        /\bdisplay\b/i.test(
            normalizedQuestion
        ) ||
        /\brows?\b/i.test(
            normalizedQuestion
        ) ||
        /\brecords?\b/i.test(
            normalizedQuestion
        );

    if (explicitlyRequestsDetails) {
        return "DETAIL_LIST";
    }

    /*
     * Detect count wording.
     */
    const asksForCount =
        /\bhow\s+many\b/i.test(
            normalizedQuestion
        ) ||
        /\bcounts?\b/i.test(
            normalizedQuestion
        ) ||
        /\bnumber\s+of\b/i.test(
            normalizedQuestion
        ) ||
        /\btotal\s+(?:number\s+of\s+)?(?:records?|rows?|transactions?)\b/i.test(
            normalizedQuestion
        );

    /*
     * A count question that contains a broker or action
     * filter should return the total plus matching details.
     *
     * Examples:
     * "How many renewal payments are there for eHealth?"
     * "How many disenrollments are there?"
     */
    const hasSpecificDataFilter =
        Boolean(
            parsedFilters.brokerName
        ) ||
        Boolean(
            parsedFilters.actionKey
        ) ||
        Boolean(
            parsedFilters.targetYear
        );

    if (
        asksForCount &&
        hasSpecificDataFilter
    ) {
        return "DETAIL_LIST";
    }

    /*
     * A generic count question without filters remains
     * count-only.
     */
    if (asksForCount) {
        return "COUNT";
    }

    /*
     * Return details for filtered Medicare questions,
     * even when no explicit display verb is provided.
     */
    if (hasSpecificDataFilter) {
        return "DETAIL_LIST";
    }

    return "COUNT";
}
/**
 * Parses supported filters from a natural-language question.
 */
function parseMedicareQuestion(
    userQuestion
) {
    const normalizedQuestion =
        normalizeQuestionInput(
            userQuestion
        );

    const brokerName =
        extractBrokerName(
            normalizedQuestion
        );

    const actionDefinition =
        extractActionDefinition(
            normalizedQuestion
        );

    const hcin =
        extractHcin(
            normalizedQuestion
        );

    const targetYear =
        extractTargetYear(
            normalizedQuestion
        );

    const parsedQuestion = {
        originalQuestion:
            normalizedQuestion,

        normalizedQuestion:
            normalizeMedicareText(
                normalizedQuestion
            ),

        brokerName,

        actionKey:
            actionDefinition?.key ||
            null,

        actionLabel:
            actionDefinition?.label ||
            null,

        actionTypes:
            actionDefinition
                ?.actionTypes ||
            [],

        hcin,

        targetYear,

        mode:
            null
    };

    parsedQuestion.mode =
        extractQuestionMode(
            normalizedQuestion,
            parsedQuestion
        );

    return parsedQuestion;
}

/**
 * Returns a singular or plural transaction label.
 */
function formatTransactionCount(
    count
) {
    const normalizedCount =
        Number(
            count
        ) ||
        0;

    return (
        `${normalizedCount} ` +
        (
            normalizedCount === 1
                ? "transaction"
                : "transactions"
        )
    );
}

/**
 * Returns a readable filter description.
 */
function buildFilterDescription(
    parsedQuestion
) {
    const descriptions =
        [];

    if (parsedQuestion.actionLabel) {
        descriptions.push(
            parsedQuestion.actionLabel
        );
    }

    if (parsedQuestion.brokerName) {
        descriptions.push(
            `for ${parsedQuestion.brokerName}`
        );
    }

    if (parsedQuestion.targetYear) {
        descriptions.push(
            `for ${parsedQuestion.targetYear}`
        );
    }

    if (parsedQuestion.hcin) {
        descriptions.push(
            `for HICN ${parsedQuestion.hcin}`
        );
    }

    if (descriptions.length === 0) {
        return "matching Medicare";
    }

    return descriptions.join(
        " "
    );
}

/**
 * Formats a count response.
 */
function formatCountResponse({
    requestId,
    parsedQuestion,
    count
}) {
    const filterDescription =
        buildFilterDescription(
            parsedQuestion
        );

    return (
        `Based on Request ID ${requestId}, there ` +
        `${count === 1 ? "is" : "are"} ` +
        `${formatTransactionCount(count)} ` +
        `matching ${filterDescription}.`
    );
}

/**
 * Formats one stored Medicare row for chat output.
 */
function formatDetailRow(
    row,
    index
) {
    const lines = [
        `${index + 1}. HICN: ${row?.hcin || "Not available"}`,
        `   Broker: ${row?.brokerName || "Not available"}`,
        `   Action: ${row?.actionRequired || row?.actionType || "Not available"}`,
        `   Category: ${row?.category || "Not available"}`,
        `   Payment summary: ${row?.paymentSummary || "No payment summary available"}`
    ];

    if (row?.applicationStatus) {
        lines.push(
            `   Application status: ${row.applicationStatus}`
        );
    }

    if (
        Array.isArray(
            row?.targetYears
        ) &&
        row.targetYears.length > 0
    ) {
        lines.push(
            `   Target year(s): ${row.targetYears.join(", ")}`
        );
    }

    return lines.join(
        "\n"
    );
}

/**
 * Formats a list of matching rows.
 */
function formatDetailListResponse({
    requestId,
    parsedQuestion,
    rows,
    totalCount
}) {
    const filterDescription =
        buildFilterDescription(
            parsedQuestion
        );

    if (
        !Array.isArray(
            rows
        ) ||
        rows.length === 0
    ) {
        return (
            `Based on Request ID ${requestId}, no records were found ` +
            `matching ${filterDescription}.`
        );
    }

    const lines = [
        `Based on Request ID ${requestId}, ${formatTransactionCount(totalCount)} matched ${filterDescription}.`,
        ""
    ];

    for (
        let index = 0;
        index < rows.length;
        index++
    ) {
        lines.push(
            formatDetailRow(
                rows[index],
                index
            )
        );

        lines.push(
            ""
        );
    }

    if (
        totalCount >
        rows.length
    ) {
        lines.push(
            `Showing the first ${rows.length} of ${totalCount} matching records.`
        );
    }

    return lines
        .join(
            "\n"
        )
        .trim();
}

/**
 * Formats all rows found for one HICN.
 */
function formatHcinDetailsResponse({
    requestId,
    hcin,
    rows
}) {
    if (
        !Array.isArray(
            rows
        ) ||
        rows.length === 0
    ) {
        return (
            `Based on Request ID ${requestId}, no Medicare record was ` +
            `found for HICN ${hcin}.`
        );
    }

    const lines = [
        `Based on Request ID ${requestId}, ${formatTransactionCount(rows.length)} was found for HICN ${hcin}.`,
        ""
    ];

    for (
        let index = 0;
        index < rows.length;
        index++
    ) {
        lines.push(
            formatDetailRow(
                rows[index],
                index
            )
        );

        lines.push(
            ""
        );
    }

    return lines
        .join(
            "\n"
        )
        .trim();
}

/**
 * Formats broker and category aggregation results.
 */
function formatBrokerSummaryResponse({
    requestId,
    aggregationRows
}) {
    if (
        !Array.isArray(
            aggregationRows
        ) ||
        aggregationRows.length === 0
    ) {
        return (
            `Based on Request ID ${requestId}, no broker summary data ` +
            `was found.`
        );
    }

    const brokers =
        new Map();

    for (
        const aggregationRow of
        aggregationRows
    ) {
        const brokerName =
            aggregationRow?._id
                ?.brokerName ||
            "Unknown Broker";

        const category =
            aggregationRow?._id
                ?.category ||
            "Uncategorized";

        const transactions =
            Number(
                aggregationRow
                    ?.transactions
            ) ||
            0;

        if (
            !brokers.has(
                brokerName
            )
        ) {
            brokers.set(
                brokerName,
                []
            );
        }

        brokers.get(
            brokerName
        ).push({
            category,
            transactions
        });
    }

    const lines = [
        `Broker summary for Request ID ${requestId}:`,
        ""
    ];

    for (
        const [
            brokerName,
            categories
        ] of brokers.entries()
    ) {
        lines.push(
            brokerName
        );

        for (
            const categoryItem of
            categories
        ) {
            lines.push(
                `- ${categoryItem.category}: ` +
                `${formatTransactionCount(categoryItem.transactions)}`
            );
        }

        lines.push(
            ""
        );
    }

    return lines
        .join(
            "\n"
        )
        .trim();
}

/**
 * Answers a natural-language question using only the rows stored
 * for the supplied Medicare Request ID.
 */
export async function answerMedicareMongoDatabaseSummaryQuestion({
    limit = 100,
    requestedBy = null,
    teamName = null
} = {}) {
    const batchRecords =
        await findCompletedMedicareBatchRecords({
            limit,
            requestedBy,
            teamName
        });

    if (
        !Array.isArray(batchRecords) ||
        batchRecords.length === 0
    ) {
        return {
            formattedResponse:
                "No completed Medicare processing records were found in MongoDB.",

            responseMode:
                "MONGO_BATCH_SUMMARY",

            fileCount:
                0,

            totalRecords:
                0,

            records:
                []
        };
    }

    let totalProcessedRecords = 0;

    const records =
        batchRecords.map(function (
            record,
            index
        ) {
            const fileName =
                record?.source?.fileName ||
                record?.sourceFileName ||
                "Unknown Excel file";

            const requestId =
                record?.requestId ||
                "Unknown Request ID";

            const processedRecordCount =
                Math.max(
                    Number(
                        record?.metrics
                            ?.totalRecords ??
                        record?.totalRecords ??
                        0
                    ) || 0,
                    0
                );

            totalProcessedRecords +=
                processedRecordCount;

            return {
                sequenceNumber:
                    index + 1,

                fileName,
                requestId,
                processedRecordCount
            };
        });

    const lines =
        records.map(function (record) {
            const recordLabel =
                record.processedRecordCount === 1
                    ? "record"
                    : "records";

            return (
                `ExcelFile ${record.sequenceNumber} | ` +
                `${record.fileName} | ` +
                `${record.requestId} | ` +
                `${record.processedRecordCount} ` +
                `${recordLabel} processed`
            );
        });
    const formattedResponse = [
        "Medicare processing records available in MongoDB:",
        "",
        ...lines,
        "",
        `Total Excel files: ${records.length}`,
        `Total records processed: ${totalProcessedRecords}`
    ].join("\n");

    return {
        formattedResponse,

        responseMode:
            "MONGO_BATCH_SUMMARY",

        fileCount:
            records.length,

        totalRecords:
            totalProcessedRecords,

        records
    };
}
export async function answerMedicareDataQuestion({
    requestId,
    userQuestion
}) {
    const normalizedRequestId =
        String(
            requestId ?? ""
        )
            .trim()
            .toUpperCase();

    if (!normalizedRequestId) {
        throw new Error(
            "requestId is required to answer a Medicare data question."
        );
    }

    const normalizedUserQuestion =
        normalizeQuestionInput(
            userQuestion
        );

    if (!normalizedUserQuestion) {
        throw new Error(
            "userQuestion is required to answer a Medicare data question."
        );
    }

    const storedRowCount =
        await countStoredMedicareRows(
            normalizedRequestId
        );

    if (storedRowCount === 0) {
        return {
            formattedResponse:
                `No queryable Medicare rows are available for Request ID ` +
                `${normalizedRequestId}.`,

            matchingRecordCount:
                0,

            parsedQuestion:
                parseMedicareQuestion(
                    normalizedUserQuestion
                )
        };
    }

    const parsedQuestion =
        parseMedicareQuestion(
            normalizedUserQuestion
        );

    /*
     * Broker summary questions use a MongoDB aggregation.
     */
    if (
        parsedQuestion.mode ===
        "BROKER_SUMMARY"
    ) {
        const aggregationRows =
            await aggregateMedicareRowsByBroker({
                requestId:
                    normalizedRequestId,

                brokerNames:
                    parsedQuestion.brokerName
                        ? [
                            parsedQuestion
                                .brokerName
                        ]
                        : []
            });

        const matchingRecordCount =
            aggregationRows.reduce(
                function (
                    total,
                    row
                ) {
                    return (
                        total +
                        (
                            Number(
                                row?.transactions
                            ) ||
                            0
                        )
                    );
                },
                0
            );

        return {
            formattedResponse:
                formatBrokerSummaryResponse({
                    requestId:
                        normalizedRequestId,

                    aggregationRows
                }),

            matchingRecordCount,

            parsedQuestion
        };
    }

    /*
     * HICN detail lookup returns all stored rows for the HICN.
     */
    if (
        parsedQuestion.mode ===
        "HICN_DETAILS" &&
        parsedQuestion.hcin
    ) {
        let rows =
            await findMedicareProcessedRowsByHcin({
                requestId:
                    normalizedRequestId,

                hcin:
                    parsedQuestion.hcin
            });

        /*
         * Apply optional action and target-year filters after the HICN
         * lookup so multiple records for the same HICN remain supported.
         */
        if (
            parsedQuestion.actionTypes
                .length > 0
        ) {
            const actionTypeSet =
                new Set(
                    parsedQuestion
                        .actionTypes
                );

            rows =
                rows.filter(
                    function (
                        row
                    ) {
                        return actionTypeSet.has(
                            row?.actionType
                        );
                    }
                );
        }

        if (
            parsedQuestion.targetYear
        ) {
            rows =
                rows.filter(
                    function (
                        row
                    ) {
                        return (
                            Array.isArray(
                                row?.targetYears
                            ) &&
                            row.targetYears.includes(
                                parsedQuestion
                                    .targetYear
                            )
                        );
                    }
                );
        }

        return {
            formattedResponse:
                formatHcinDetailsResponse({
                    requestId:
                        normalizedRequestId,

                    hcin:
                        parsedQuestion.hcin,

                    rows
                }),

            matchingRecordCount:
                rows.length,

            parsedQuestion
        };
    }

    const queryFilters = {
        requestId:
            normalizedRequestId,

        brokerName:
            parsedQuestion.brokerName,

        actionTypes:
            parsedQuestion.actionTypes,

        hcin:
            parsedQuestion.hcin,

        targetYear:
            parsedQuestion.targetYear
    };

    const matchingRecordCount =
        await countMedicareProcessedRows(
            queryFilters
        );

    /*
     * Count questions return only the matching total.
     */
    if (
        parsedQuestion.mode ===
        "COUNT"
    ) {
        return {
            formattedResponse:
                formatCountResponse({
                    requestId:
                        normalizedRequestId,

                    parsedQuestion,

                    count:
                        matchingRecordCount
                }),

            matchingRecordCount,

            parsedQuestion
        };
    }

    /*
     * Detail questions return a limited set of matching rows.
     */
    const matchingRows =
        await findMedicareProcessedRows({
            ...queryFilters,

            limit:
                MAX_DETAIL_ROWS
        });

    return {
        formattedResponse:
            formatDetailListResponse({
                requestId:
                    normalizedRequestId,

                parsedQuestion,

                rows:
                    matchingRows,

                totalCount:
                    matchingRecordCount
            }),

        matchingRecordCount,

        parsedQuestion
    };
}
