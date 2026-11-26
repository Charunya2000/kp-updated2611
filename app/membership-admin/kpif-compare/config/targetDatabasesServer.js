import { oracleAccounts } from '@/app/services/oracleService';
import { KPIF_TARGET_DATABASES } from './targetDatabases';

export const KPIF_DATABASE_TO_ACCOUNT = {
  default: oracleAccounts.APPUSER_DEFAULT ? oracleAccounts.APPUSER_DEFAULT : null,
  jpt: oracleAccounts.COMPARE_OWNER_JPT,
  perf: oracleAccounts.COMPARE_OWNER_PERF,
  rbc2: oracleAccounts.COMPARE_OWNER_RBC2,
  uat: oracleAccounts.COMPARE_OWNER_UAT,};

export const KPIF_DATABASE_CONFIGS = KPIF_TARGET_DATABASES.map((targetDatabase) => ({
  targetDatabase,
  account: KPIF_DATABASE_TO_ACCOUNT[targetDatabase],
}));