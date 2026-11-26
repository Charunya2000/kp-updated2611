import { NextResponse } from 'next/server';
import oracledb from 'oracledb';
import { getOracleConnection } from '@/app/services/oracleService';

export async function POST(req, { params }) {
    try {
        const { teamName, assistantName } = await params;
        const { rmsCarrier, rmsProgram, rmsCmBaseBenefitId } = await req.json();

        // Build dynamic WHERE clause based on provided parameters
        const whereClauses = [];
        const bindParams = {};

        if (rmsCarrier) {
            whereClauses.push('RMS_CARRIER = :rmsCarrier');
            bindParams.rmsCarrier = rmsCarrier;
        }
        if (rmsProgram) {
            whereClauses.push('RMS_PROGRAM = :rmsProgram');
            bindParams.rmsProgram = rmsProgram;
        }
        if (rmsCmBaseBenefitId) {
            whereClauses.push('RMS_CM_BASE_BENEFIT_ID = :rmsCmBaseBenefitId');
            bindParams.rmsCmBaseBenefitId = rmsCmBaseBenefitId;
        }

        // Build the SQL query
        let sqlQuery = `
      SELECT 
        REGION_CODE, 
        RMS_CARRIER,
        RMS_PROGRAM, 
        RMS_CM_BASE_BENEFIT_ID,
        RMS_BENEFIT_SHORT_DESCRIPTION,
        RMS_BENEFIT_LONG_DESCRIPTION,
        EFFECTIVE_START_DATE,
        EFFECTIVE_END_DATE   
      FROM BENEFIT_OWNER.KPMC_BENEFIT_DETAIL
    `.trim();

        if (whereClauses.length > 0) {
            sqlQuery += '\nWHERE ' + whereClauses.join('\n  AND ');
        }

        // Log the query execution
        console.log(JSON.stringify({
            kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'queryBenefitDetail',
                detail: {
                    teamName,
                    assistantName,
                    rmsCarrier,
                    rmsProgram,
                    rmsCmBaseBenefitId
                }
            }
        }));

        // TODO: Execute the SQL query against your database
        // This is a placeholder - you'll need to implement the actual database connection
        // For now, returning mock data structure
        const results = await executeSqlQuery(sqlQuery, bindParams);

        return NextResponse.json({
            success: true,
            results,
            query: sqlQuery
        });

    } catch (error) {
        console.error(JSON.stringify({
            kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'queryBenefitDetail',
                detail: { error: error.message }
            }
        }));

        return NextResponse.json(
            { error: 'Failed to execute query', details: error.message },
            { status: 500 }
        );
    }
}

async function executeSqlQuery(query, params) {
    let connection;

    try {
        // Get connection from the pool
        connection = await getOracleConnection();

        console.log(JSON.stringify({
            kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'executeBenefitQuery',
                detail: {
                    params,
                    queryPreview: query.substring(0, 100) + '...'
                }
            }
        }));

        // Execute the query with named bind parameters
        const result = await connection.execute(
            query,
            params,
            {
                outFormat: oracledb.OUT_FORMAT_OBJECT, // Return results as objects
                maxRows: 50 // Limit results to prevent memory issues
            }
        );

        console.log(JSON.stringify({
            kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'executeBenefitQuery',
                detail: {
                    rowCount: result.rows.length,
                    success: true
                }
            }
        }));

        return result.rows;

    } catch (error) {
        console.error(JSON.stringify({
            kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'executeBenefitQuery',
                detail: { error: error.message }
            }
        }));
        throw error;
    } finally {
        // Always release the connection back to the pool
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    } result.rows;

    return [];
}
