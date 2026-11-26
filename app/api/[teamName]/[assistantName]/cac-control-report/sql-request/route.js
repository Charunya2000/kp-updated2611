import { getOracleConnection, oracleAccounts } from '../../../../../services/oracleService';
import { generateTemporaryDownloadLink, writeFileBufferToBlobStorage } from '@/app/services/blobStorageService';
import { createCacControlReport, selectCacControlReport, updateCacControlReport } from '@/app/services/cacControlReportService';
import { prepDocument } from '@/app/clientServices/insertDocument';
import { NextResponse } from 'next/server';
import { getBillingPlanQuery } from './plan';
import { getBillingPolicyQuery } from './policy';
import { getEnrollmentQuery } from './enrollment';

let clients = [];

function buildReportBlobName({ dataset, entity, region, targetDatabase }) {
  const normalizedDataset = dataset.toLowerCase();
  const normalizedEntity = entity.toLowerCase();
  const normalizedRegion = region.toUpperCase();

  return `${targetDatabase}/${normalizedDataset}-compare_results-${normalizedEntity}-${normalizedRegion}.csv`;
}

function getValidTargetDatabases() {
  const envName = process.env.envName || 'dev';
  if (envName === 'dev') {
    return ['dev', 'rbc2'];
  }
  if (envName === 'uat') {
    return ['uat', 'rbc2'];
  }
  return ['default'];
}

function getOracleAccountForTargetDatabase(targetDatabase) {
  if (targetDatabase === 'rbc2') {
    return oracleAccounts.APPUSER_RBC2;
  }
  return null;
}

export async function GET(req) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  writer.write(new TextEncoder().encode('data: Connected\n\n'));

  const clientId = Date.now();
  const newClient = {
    id: clientId,
    writer
  };
  clients.push(newClient);

  req.signal.addEventListener('abort', () => {
    clients = clients.filter(client => client.id !== clientId);

    // Close the writer to release resources
    try {
      writer.close();
    } catch (error) {
      console.error('Error closing writer:', error);
    }
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}

function getDefaultTargetDatabase() {
  const envName = process.env.envName || 'dev';
  if (envName === 'dev') {
    return 'dev';
  }
  if (envName === 'uat') {
    return 'uat';
  }
  return 'default';
}

export async function POST(request, { params }) {
  const { dataset, entity, region, targetDatabase = getDefaultTargetDatabase() } = await request.json();
  const { teamName, assistantName } = await params;
  if (!entity || !region) {
    return new Response('Missing required parameters', { status: 400 });
  }

  const validTargetDatabases = getValidTargetDatabases();
  if (!validTargetDatabases.includes(targetDatabase)) {
    return new Response('Invalid target database', { status: 400 });
  }

  let cacReport = null;
  const containerName = 'cac-control-reports';
  const blobName = buildReportBlobName({ dataset, entity, region, targetDatabase });
  const contentType = 'text/csv';
  const linkValidity = 48 * 60; // 48 hours

  try {
    let sqlQuery = await getSqlQuery(dataset, entity, teamName, targetDatabase);

    const reportQuery = { dataset: dataset, name: region, parent: entity, targetDatabase };

    cacReport = await selectCacControlReport(teamName, reportQuery);
    if (!cacReport) {
      // create a new report entry in the database
      cacReport = await createCacControlReport(teamName, prepDocument({ dataset: dataset, name: region, parent: entity, targetDatabase, lastRunDate: new Date(), downloadUrl: null, processingTime: null, isProcessing: true }));
    } else {
      cacReport = await updateCacControlReport(teamName, { id: cacReport.id, targetDatabase, lastRunDate: new Date(), isProcessing: true }, reportQuery);
    }

    const startTime = new Date();
    let rs = null;
    const bindIn = { region: region };
    const connection = await getOracleConnection(getOracleAccountForTargetDatabase(targetDatabase));

    connection.execute(sqlQuery, bindIn, { resultSet: true, prefetchRows: 1000 }).then(async (result) => {
      rs = result.resultSet;
      let rows;
      const numRows = 1000;
      const csvParts = [];

      csvParts.push(result.metaData.map(md => md.name).join(","));
      do {
        rows = await rs.getRows(numRows);
        if (rows.length > 0) {
          rows.forEach(row => {
            csvParts.push(row.map(r => `"${r}"`).join(","));
          });
        }
      } while (rows.length === numRows);

      // Convert CSV content to a buffer
      const csvBuffer = Buffer.from(csvParts.join('\n'), 'utf-8');
      // write the buffer to azure blob storage and get a temporary download link
      const isWriteSuccess = await writeFileBufferToBlobStorage(csvBuffer, containerName, blobName, contentType);

      const endTime = new Date();
      const processingTime = endTime - startTime; // in milliseconds
      if (isWriteSuccess) {
        const downloadLink = await generateTemporaryDownloadLink(containerName, blobName, linkValidity);

        cacReport = await updateCacControlReport(teamName, { id: cacReport.id, targetDatabase, downloadUrl: downloadLink, processingTime: processingTime, isProcessing: false }, reportQuery);

        // Notify clients report gen has finished - only after DB is updated
        clients.forEach(client => {
          try {
            client.writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ action: 'ComparisonComplete', dataset: dataset, parent: entity, name: region, targetDatabase })}\n\n`));
          } catch (error) {
            console.error('Error sending SSE message to client:', error);
            // Remove the client if writing fails
            clients = clients.filter(c => c.id !== client.id);
          }
        });
      } else {
        cacReport = await updateCacControlReport(teamName, { id: cacReport.id, targetDatabase, isProcessing: false }, reportQuery);
      }
    }).catch(async (err) => {
      console.error(JSON.stringify(
        {
          kpmsg:
          {
            id: 'AI_PORTAL_NOTEBOOK',
            name: 'POST: sql-request',
            detail: `POST: sql-request with ${JSON.stringify({ dataset, entity, region, targetDatabase })}`
          },
          error: err
        }
      ));
      cacReport = await updateCacControlReport(teamName, { id: cacReport.id, targetDatabase, isProcessing: false }, reportQuery);
    }).finally(() => {
      if (rs) {
        try {
          rs.close();
        } catch (err) {
          console.error('Error closing result set:', err);
        }
      }

      if (connection) {
        try {
          connection.close();
        } catch (err) {
          console.error('Error closing connection:', err);
        }
      }
    });

    return NextResponse.json({ started: true, message: 'CSV generation started' });
  } catch (error) {
    console.error('Error generating CSV:', error);
    if (cacReport?.id) {
      await updateCacControlReport(teamName, { id: cacReport.id, targetDatabase, isProcessing: false }, { dataset: dataset, name: region, parent: entity, targetDatabase });
    }
    return new Response('Error generating CSV', { status: 500 });
  }
}

async function getSqlQuery(dataset, entity, teamName, targetDatabase) {
  if (dataset === 'Billing') {
    switch (entity) {
      case 'Plan':
        return await getBillingPlanQuery(teamName, targetDatabase);
      case 'Policy':
        return await getBillingPolicyQuery(teamName);
      default:
        return new Response('Invalid entity name', { status: 400 });
    }
  } else if (dataset === 'Enrollment') {
    return await getEnrollmentQuery(teamName);
  }
}
