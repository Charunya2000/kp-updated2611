import { normalizeRcnoaAddress } from './rcnoaAddressService.js';
import { parseRcnoText, serializeRcnoaRecords } from './rcnoaCore.js';
import { extractRawNoticeCode, extractRawPriority } from './rcnoaDecisionDisplay.js';
import { loadRcnoaOracleLookups } from './rcnoaOracleService.js';
import {
  getRcnoaBusinessConfiguration,
  loadPriorRcnaRecords,
} from './rcnoaRepositoryService.js';
import { RcnoToRcnaService } from './RcnoToRcnaService.js';

const RCNO_FIELD_NAMES = Object.freeze([
  'Record_Type',
  ...[
    ['PSHBS_Subscriber_ID', 'MENR_Subscriber_ID', 'RCNO_Subscriber_ID_Result'],
    ['PSHBS_Member_ID', 'MENR_Member_ID', 'RCNO_Member_ID_Result'],
    ['PSHBS_Annuitant_Number', 'MENR_Annuitant_Number', 'RCNO_Annuitant_Number_Result'],
    ['PSHBS_Last_Name', 'MENR_Last_Name', 'RCNA_Last_Name_Result'],
    ['PSHBS_First_Name', 'MENR_First_Name', 'RCNO_First_Name_Result'],
    ['PSHBS_Birth_Date', 'MENR_Birth_Date', 'RCNO_Birth_Date_Result'],
    ['PSHBS_Member_SSN', 'MENR_Member_SSN', 'RCNO_Member_SSN_Result'],
    ['PSHBS_Subscriber_SSN', 'MENR_Subscriber_SSN', 'RCNO_Subscriber_SSN_Result'],
    ['PSHBS_Plan_Code', 'MENR_Plan_Code', 'RCNO_Plan_Code_Result'],
    ['PSHBS_Coverage_Start_Date', 'MENR_Coverage_Start_Date', 'RCNA_Coverage_Start_Result'],
    ['PSHBS_Coverage_End_Date', 'MENR_Coverage_End_Date', 'RCNO_Coverage_End_Result'],
    ['PSHBS_Address_Line1', 'MENR_Address_Line1', 'RCNO_Address_Line1_Result'],
    ['PSHBS_Address_Line2', 'MENR_Address_Line2', 'RCNO_Address_Line2_Result'],
    ['PSHBS_Address_Line3', 'MENR_Address_Line3', 'RCNO_Address_Line3_Result'],
    ['PSHBS_City', 'MENR_City', 'RCNO_City_Result'],
    ['PSHBS_State', 'MENR_State', 'RCNO_State_Result'],
    ['PSHBS_ZIP', 'MENR_ZIP', 'RCNO_ZIP_Result'],
    ['PSHBS_Country', 'MENR_Country', 'RCNO_Country_Result'],
    ['PSHBS_Phone', 'MENR_Phone', 'RCNO_Phone_Result'],
    ['PSHBS_Email', 'MENR_Email', 'RCNO_Email_Result'],
    ['PSHBS_Payroll_Office_Number', 'MENR_Payroll_Office_Number', 'RCNO_Payroll_Office_Result'],
    ['PSHBS_Relationship_Code', 'MENR_Relationship_Code', 'RCNO_Relationship_Result'],
    ['PSHBS_Extended_Cov_End_Date', 'MENR_Extended_Cov_End_Date', 'RCNO_Extended_Cov_End_Result'],
    ['PSHBS_Gender_Code', 'MENR_Gender_Code', 'RCNO_Gender_Code_Result'],
  ].flat(),
]);

const WORKING_FIELD_NAMES = Object.freeze([
  ...RCNO_FIELD_NAMES,
  'Priority',
  'PSHB_Code',
  'Code_Description',
  'Notes',
  'Aging_Months',
]);

const MEMBERSHIP_FIELD_NAMES = Object.freeze([
  'kp_mrn',
  'Coverage_Start_Date',
  'Coverage_End_Date',
  'first_name',
  'last_name',
  'member_ssn',
  'member_gender',
  'Relationship_Code',
  'plan_code',
  'Annuitant_Number',
  'Payroll_Office_Number',
  'Member_Deceased',
  'Subscriber_Deceased',
  'Member_Age',
  'Not_Disabled',
  'Subscriber_SSN',
  'Exception_Flag',
  'Member_Birth_Date',
  'Member_Deceased_Date',
  'Address_Line1',
  'Address_Line2',
  'Address_Line3',
  'City',
  'State',
  'ZIP_Country',
]);

const RECENT_834_FIELD_NAMES = Object.freeze([
  'Subscriber_SSN',
  'Coverage_Start_Date',
  'Coverage_End_Date',
  '834_Processed',
]);

function currentBusinessDate(now = new Date()) {
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
}

function namedFields(record, names, sourceFieldCount = names.length) {
  return record.map((value, index) => ({
    column: index + 1,
    name: names[index] || `Additional_Field_${index + 1}`,
    value,
    origin: index < sourceFieldCount ? 'source' : 'derived',
  }));
}

function namedRecord(record, names, candidateNumber) {
  return {
    candidateNumber,
    fields: namedFields(record, names),
  };
}

export async function diagnoseRcnoaRow(rcnoRow, dependencies = {}) {
  if (typeof rcnoRow !== 'string') throw new TypeError('rcnoRow must be text');

  const getConfiguration = dependencies.getRcnoaBusinessConfiguration
    || getRcnoaBusinessConfiguration;
  const loadLookups = dependencies.loadRcnoaOracleLookups || loadRcnoaOracleLookups;
  const loadPrior = dependencies.loadPriorRcnaRecords || loadPriorRcnaRecords;
  const businessDate = dependencies.businessDate || currentBusinessDate();
  const businessConfiguration = await getConfiguration();
  const records = parseRcnoText(rcnoRow, {
    ignoreFirstColumn: businessConfiguration.ignoreFirstRcnoColumn,
    ignoreLastColumn: businessConfiguration.ignoreLastRcnoColumn,
  });
  if (records.length !== 1) throw new Error('Diagnostic input must contain exactly one RCNO row');
  const reconciliationCycle = businessDate.slice(0, 6);
  const [{ membershipRecords, recent834Records }, priorRcnaRecords] = await Promise.all([
    loadLookups({
      businessDate,
      rcnoRecords: records,
      callTimeoutSeconds: businessConfiguration.oracleCallTimeoutSeconds,
    }),
    businessConfiguration.reusePriorRcnaDecisions !== false
      ? loadPrior(
        records,
        reconciliationCycle,
        businessConfiguration.priorRcnaMatchKeySecret,
      )
      : Promise.resolve([]),
  ]);

  const transformed = new RcnoToRcnaService({
    businessDate,
    n12Code: businessConfiguration.n12Code,
    addressNormalizer: normalizeRcnoaAddress,
    reusePriorRcnaDecisions: businessConfiguration.reusePriorRcnaDecisions,
  }).transform({
    rcnoRecords: records,
    membershipRecords,
    recent834Records,
    priorRcnaRecords,
    trace: true,
  });
  const workingRecord = transformed.workingRecords[0];
  const outboundRecord = transformed.outboundRecords[0];

  return {
    businessDate,
    reconciliationCycle,
    configurationVersion: businessConfiguration.version ?? null,
    source: {
      fieldCount: records[0].length,
      fields: namedFields(records[0], RCNO_FIELD_NAMES),
      serializedRow: serializeRcnoaRecords(records).trimEnd(),
    },
    decision: {
      ruleId: transformed.audit[0].ruleId,
      priority: extractRawPriority(workingRecord[73]),
      priorityDisplay: workingRecord[73],
      code: extractRawNoticeCode(workingRecord[74]),
      codeDisplay: workingRecord[74],
      description: workingRecord[75],
      notes: workingRecord[76],
      agingMonths: workingRecord[77],
    },
    output: {
      workingFieldCount: workingRecord.length,
      outboundFieldCount: outboundRecord.length,
      workingFields: namedFields(workingRecord, WORKING_FIELD_NAMES, 73),
      outboundFields: namedFields(outboundRecord, WORKING_FIELD_NAMES, 73),
      serializedDiagnosticRow: serializeRcnoaRecords([workingRecord]).trimEnd(),
      serializedOutboundRow: serializeRcnoaRecords([outboundRecord]).trimEnd(),
    },
    evidence: {
      membership: membershipRecords.map((record, index) => (
        namedRecord(record, MEMBERSHIP_FIELD_NAMES, index + 1)
      )),
      recent834: recent834Records.map((record, index) => (
        namedRecord(record, RECENT_834_FIELD_NAMES, index + 1)
      )),
      priorRcna: priorRcnaRecords.map((record, index) => (
        namedRecord(record, WORKING_FIELD_NAMES, index + 1)
      )),
    },
    trace: transformed.traces[0],
  };
}
