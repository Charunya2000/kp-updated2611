'use server';

/**
 * Node to fetch metadata and file content from Enterprise GitHub.
 * Preserves original walk/fetch logic while implementing safety checks for state properties.
 */
export const getMetadataFromGitHubNode = async ({ state }) => {
    // 1. ENVIRONMENT CONFIGURATION (Reading from your .env.bat / .env.dev)
    const GITHUB_API_BASE = process.env.GITHUB_API_BASE || 'https://github.kp.org/api/v3';
    const GITHUB_ACCESS_TOKEN = process.env.GITHUB_ACCESS_TOKEN;

    // 2. STATE PARAMETERS (Added safety defaults to prevent 'undefined' crashes)
    const organization = state?.organization || "HP-OPS";
    const repository = state?.repository || "NPGUIAutomation";
    const branch = state?.branch || 'master';
    const targetPath = state?.targetPath || 'src/test/java';
    const recursive = state?.recursive !== false; // Default to true
    const fetchContent = state?.fetchContent !== false; // Default to true

    // Basic validation for mandatory credentials
    if (!GITHUB_ACCESS_TOKEN) {
        console.error("[GitHub Node] ERROR: GITHUB_ACCESS_TOKEN is missing in environment.");
        return {
            ...state,
            searchSuccess: false,
            githubMetadata: { error: 'GITHUB_ACCESS_TOKEN not set in environment' }
        };
    }

    // 3. AUTHENTICATION HEADERS
    const authHeaders = {
        'Authorization': `Bearer ${GITHUB_ACCESS_TOKEN.trim()}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Node.js-LangGraph-Bot'
    };

    // Helper: call GitHub contents API for a path
    const fetchPath = async (path) => {
        const sanitizedBase = GITHUB_API_BASE.replace(/\/+$/, ''); // Remove trailing slashes
        const url = `${sanitizedBase}/repos/${encodeURIComponent(organization)}/${encodeURIComponent(repository)}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
        
        const res = await fetch(url, { headers: authHeaders });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            const err = new Error(`GitHub API ${res.status} ${res.statusText}: ${text}`);
            err.status = res.status;
            throw err;
        }
        return res.json();
    };

    // Helper: fetch raw content
    const getFileContent = async (fileObject) => {
        if (fileObject.content && fileObject.encoding === 'base64') {
            try {
                return Buffer.from(fileObject.content, 'base64').toString('utf8');
            } catch { /* fallback to download_url */ }
        }
        if (fileObject.download_url) {
            const r = await fetch(fileObject.download_url, { headers: authHeaders });
            if (r.ok) return await r.text();
        }
        return null;
    };

    // 4. WALK LOGIC (Preserving your original recursive search logic)
    const javaFiles = []; 
    const walk = async (path) => {
        const data = await fetchPath(path);

        // If data is a single file
        if (!Array.isArray(data)) {
            const file = data;
            if (file.type === 'file' && file.name.toLowerCase().endsWith('.java')) {
                const item = {
                    name: file.name,
                    path: file.path,
                    size: file.size,
                    sha: file.sha,
                    downloadUrl: file.download_url,
                    sourceFolder: file.path.replace(targetPath + '/', '').split('/')[0]
                };
                if (fetchContent) item.content = await getFileContent(file);
                javaFiles.push(item);
            }
            return;
        }

        // data is an array => folder listing
        for (const item of data) {
            if (item.type === 'file' && item.name.toLowerCase().endsWith('.java')) {
                const entry = {
                    name: item.name,
                    path: item.path,
                    size: item.size,
                    sha: item.sha,
                    downloadUrl: item.download_url,
                    sourceFolder: item.path.replace(targetPath + '/', '').split('/')[0]
                };
                if (fetchContent) {
                    try {
                        const fileData = await fetchPath(item.path);
                        entry.content = await getFileContent(fileData);
                    } catch (e) {
                        entry.content = null;
                    }
                }
                javaFiles.push(entry);
            } else if (recursive && item.type === 'dir') {
                await walk(item.path);
            }
        }
    };

    try {
        console.log(`[GitHub Node] Starting search in ${organization}/${repository} at ${targetPath}...`);
        await walk(targetPath);

        // 5. FINAL RETURN
        return {
            ...state,
            searchSuccess: true,
            githubMetadata: {
                organization,
                repository,
                branch,
                targetPath,
                isFolderSearch: true,
                filesFound: javaFiles.length,
                files: javaFiles,
                timestamp: new Date().toISOString()
            }
        };

    } catch (err) {
        console.error("[GitHub Node] ERROR:", err.message);
        return {
            ...state,
            searchSuccess: false,
            githubMetadata: {
                organization,
                repository,
                error: err.message || String(err),
                timestamp: new Date().toISOString()
            }
        };
    }
};