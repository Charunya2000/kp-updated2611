'use server';

export const adminPerfLogNode = async (state) => {
    // 1. Retrieve identifiers already extracted by searchDatabaseNode
    const { identifiers } = state;
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    
    let perfLogSQL = '';
    
    // Helper for numeric ID formatting (no quotes)
    const formatIds = (ids) => {
        if (!ids) return null;
        const idArray = Array.isArray(ids) ? ids : [ids];
        return idArray.join(', ');
    };

    const fQuote = formatIds(identifiers.quote_id);
    const fRqr = formatIds(identifiers.rqr_id);

    // 2. Generate the Performance Log SQL
    if (fQuote) {
        perfLogSQL = `SELECT * FROM admin.perf_log_data WHERE quote_id IN (${fQuote}) ORDER BY timestamp DESC FETCH FIRST 10 ROWS ONLY WITH UR;`;
    } else if (fRqr) {
        perfLogSQL = `SELECT * FROM admin.perf_log_data WHERE quote_id IN (SELECT quote_id FROM ruw.quote WHERE rqr_id IN (${fRqr})) ORDER BY timestamp DESC FETCH FIRST 10 ROWS ONLY WITH UR;`;
    }

    if (!perfLogSQL) {
        console.log('[PERF_LOG] No IDs found for performance log query.');
        return { ...state, perfLogMetadata: { recordFound: false, records: [] } };
    }

    try {
        console.log('[DEBUG PERF LOG] Executing:', perfLogSQL);
        const response = await fetch(`${baseUrl}/api/nps/npschatbot/db2`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sql: perfLogSQL })
        });

        let perfResults = [];
        if (response.ok) {
            const data = await response.json();
            const raw = data.data || data.results || [];
            perfResults = Array.isArray(raw) ? raw : [raw];
        }

        console.log(`[DEBUG PERF LOG] Found ${perfResults.length} records.`);

        // Store in a SEPARATE key so it doesn't overwrite intent results
        return {
            ...state,
            perfLogMetadata: {
                sqlQuery: perfLogSQL,
                recordFound: perfResults.length > 0,
                records: perfResults,
                recordCount: perfResults.length,
                timestamp: new Date().toISOString()
            }
        };
    } catch (error) {
        console.error('Error in adminPerfLogNode:', error);
        return { ...state, perfLogMetadata: { recordFound: false, error: error.message } };
    }
};