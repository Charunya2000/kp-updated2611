
const envName = process.env['envName'];
const JIRA_CONFIG = {
    ENABLED: true,
    JIRA_URL: "https://jira-aes.kp.org",

    JIRA_TOKEN: process.env[`host.${envName}-aiportal-web-2.bcs.jira.apikey`],
    JIRA_PROJECT_KEY: "BCS",
    JIRA_ISSUE_TYPE: "Task"
};



const attachmentType = {
    txt: {
        value: "text/plain",

    },
    xlsx: {
        value: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

    },
    csv: {
        value: "text/csv",

    },
};



export async function createJIRATask(summary, description) {
    if (!JIRA_CONFIG.ENABLED) { return null; }

    if (!JIRA_CONFIG.JIRA_TOKEN) {
        throw new Error(
            "JIRA_TOKEN is not configured."
        );
    }

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

                            summary: summary,

                            description: description,

                            issuetype: {
                                name:
                                    JIRA_CONFIG.JIRA_ISSUE_TYPE
                            }
                        }
                    })
            }
        );

    if (!createRes.ok) {
        throw new Error(
            `Jira issue creation failed: ${await createRes.text()}`
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
        issueKey
    );

    return issueKey;
}

export async function attacheFilestoJIRATask(issueKey, attachmentBuffer, fileName, fileType) {
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

    if (!Buffer.isBuffer(attachmentBuffer)) {
        throw new Error(
            "No Buffer Data available."
        );
    }

    const form = new FormData();
    const afileType = attachmentType[fileType]
    form.append(
        "file",
        new Blob(
            [attachmentBuffer],
            {
                type: afileType

            }
        ),
        fileName
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
            fileName
        }
    );

    return true;
}