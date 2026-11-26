import fs from 'fs';
import path from 'path';
import { selectCompareQuery } from '@/app/services/cacQueryService';

export const getBillingPolicyQuery = async (teamName) => {
  const envName = process.env.envName || 'dev';

  // try to pull the query from the database first
  const query = {
    env: envName,
    entity: 'policy',
    dataset: 'Billing'
  }
  const document = await selectCompareQuery(query, teamName);

  if (document) {
    return document.query;
  }

  // if not found, read the query from the file
  let filePath = '';
  switch (envName) {
    case 'dev':
      filePath = path.join(process.cwd(), 'app/api/[teamName]/[assistantName]/cac-control-report/sql-request/CAC to BILLING Policy.sql');
      break;
    case 'uat':
      filePath = path.join(process.cwd(), 'app/api/[teamName]/[assistantName]/cac-control-report/sql-request/CAC to BILLING Policy.sql');
      break;
    case 'psup':
      filePath = path.join(process.cwd(), 'app/api/[teamName]/[assistantName]/cac-control-report/sql-request/CAC to BILLING Policy.sql');
      break;
    case 'pp':
      filePath = path.join(process.cwd(), 'app/api/[teamName]/[assistantName]/cac-control-report/sql-request/CAC to BILLING Policy.sql');
      break;
    case 'prod':
      filePath = path.join(process.cwd(), 'app/api/[teamName]/[assistantName]/cac-control-report/sql-request/CAC to BILLING Policy.sql');
      break;
    default:
      throw new Error(`Unsupported environment: ${envName}`);
  }

  const sqlQuery = fs.readFileSync(filePath, 'utf8');
  return sqlQuery;
}