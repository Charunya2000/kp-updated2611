import fs from 'fs';
import path from 'path';
import { selectCompareQuery } from '@/app/services/cacQueryService';

export const getBillingPlanQuery = async (teamName, targetDatabase) => {
  const envName = process.env.envName || 'dev';

  // try to pull the query from the database first
  const defaultQuery = {
    env: envName,
    entity: 'plan',
    dataset: 'Billing'
  };

  let document = null;

  if (targetDatabase === 'rbc2') {
    const rbc2Query = {
      env: 'rbc2',
      entity: 'plan',
      dataset: 'Billing'
    };
    document = await selectCompareQuery(rbc2Query, teamName);
  }

  if (!document) {
    document = await selectCompareQuery(defaultQuery, teamName);
  }

  if (document) {
    return document.query;
  }

  // if not found, read the query from the file
  let filePath = '';
  if (targetDatabase === 'rbc2') {
    filePath = path.join(process.cwd(), 'app/api/[teamName]/[assistantName]/cac-control-report/sql-request/CAC_ORMB_DATAHUB_PLAN_PROD.sql');
  } else {
    switch (envName) {
      case 'dev':
        filePath = path.join(process.cwd(), 'app/api/[teamName]/[assistantName]/cac-control-report/sql-request/CAC_ORMB_DATAHUB_PLAN_DEV.sql');
        break;
      case 'uat':
        filePath = path.join(process.cwd(), 'app/api/[teamName]/[assistantName]/cac-control-report/sql-request/CAC_ORMB_DATAHUB_PLAN_UAT_PSUP.sql');
        break;
      case 'psup':
        filePath = path.join(process.cwd(), 'app/api/[teamName]/[assistantName]/cac-control-report/sql-request/CAC_ORMB_DATAHUB_PLAN_PROD.sql');
        break;
      case 'pp':
        filePath = path.join(process.cwd(), 'app/api/[teamName]/[assistantName]/cac-control-report/sql-request/CAC_ORMB_DATAHUB_PLAN_PROD.sql');
        break;
      case 'prod':
        filePath = path.join(process.cwd(), 'app/api/[teamName]/[assistantName]/cac-control-report/sql-request/CAC_ORMB_DATAHUB_PLAN_PROD.sql');
        break;
      default:
        throw new Error(`Unsupported environment: ${envName}`);
    }
  }
  const sqlQuery = fs.readFileSync(filePath, 'utf8');
  return sqlQuery;
}