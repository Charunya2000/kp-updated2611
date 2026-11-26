import { oracleAccounts } from '@/app/services/oracleService';
import { TARGET_DATABASES } from './targetDatabases';

export const DATABASE_TO_ACCOUNT = {
  default: oracleAccounts.APPUSER_DEFAULT ? oracleAccounts.APPUSER_DEFAULT : null,
  jpt: oracleAccounts.COMPARE_OWNER_JPT,
  perf: oracleAccounts.COMPARE_OWNER_PERF,
  rbc2: oracleAccounts.COMPARE_OWNER_RBC2,
  uat: oracleAccounts.COMPARE_OWNER_UAT,
};

export const DATABASE_CONFIGS = TARGET_DATABASES.map((targetDatabase) => ({
  targetDatabase,
  account: DATABASE_TO_ACCOUNT[targetDatabase],
}));