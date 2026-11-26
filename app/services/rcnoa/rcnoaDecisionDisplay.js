const PRIORITY_DISPLAY_BY_CODE = Object.freeze({
  '1': '1: Active Enrollment mismatch',
  '2': '2: Active Carrier Enrollment Mismatch',
  '3': '3: Active Demographic Mismatches',
  '4': '4: Cancelled Enrollment Mismatch',
  '5': '5: Matches (no action required)',
});

const NOTICE_CODE_DISPLAY_BY_CODE = Object.freeze({
  MM: 'MM Matched Enrollment Record and Fields',
  AE001: 'AE001 Conflicting enrollment coverage start date',
  AE002: 'AE002 Deceased Subscriber',
  AE003: 'AE003 Deceased Member',
  AE004: 'AE004 Coverage end date set for aged off dependent',
  AE005: 'AE005 Incompatible enrollment type',
  AE006: 'AE006 Medicare Advantage',
  AE007: 'AE007 No Dependent 834 Enrollment Received',
  AE008: 'AE008 Duplicate Enrollment',
  AE009: 'AE009 Duplicate RCNO record',
  AE010: 'AE010 Conflicting enrollment coverage end date',
  AE011: 'AE011 Exact match Carrier record exists',
  AE012: 'AE012 Cannot enroll dependent older than 26 years',
  AE013: 'AE013 No 834 Enrollment Received',
  AE014: 'AE014 Conflicting Date of Death',
  AE999: 'AE*',
  AE501: 'AE501 834 Enrollment Awaiting Processing',
  AE502: 'AE502 No 834 Enrollment Received',
  AE503: 'AE503 Carrier MENR missing record',
  AC001: 'AC001 Eligible dependent missing from coverage',
  AC002: 'AC002 Active Carrier enrollment now ended',
  AC003: 'AC003 Exact Match PSHBS record exists',
  AC004: 'AC004 No 834 Term or Cancel Received',
  AC501: 'AC501 No 834 Enrollment Received',
  AC502: 'AC502 834 Termination Awaiting Processing',
  AC503: 'AC503 834 Cancelation Awaiting Processing',
  AC504: 'AC504 Duplicate Carrier MENR record',
  DM001: 'DM001 PSHBS Member Last Name truncated or invalid',
  DM002: 'DM002 PSHBS Member First Name truncated or invalid',
  DM003: 'DM003 Carrier has more accurate Member SSN',
  DM004: 'DM004 Carrier has more accurate Subscriber SSN',
  DM005: 'DM005 Mailing Address updated by Carrier due to emergency',
  DM006: 'DM006 Carrier has more accurate Gender Code',
  DM007: 'DM007 Carrier has more accurate Date of Birth',
  DM008: 'DM008 PSHBS Member first and last names reversed',
  DM009: 'DM009 Record incorrectly matched',
  DM501: 'DM501 Annuitant Number pending update',
  DM502: 'DM502 Member Last Name pending update',
  DM503: 'DM503 Member First Name pending update',
  DM504: 'DM504 Member Date of Birth pending update',
  DM505: 'DM505 Member SSN pending update',
  DM506: 'DM506 Subscriber SSN pending update',
  DM507: 'DM507 Mailing Address pending update',
  DM508: 'DM508 Payroll Office Number pending update',
  DM509: 'DM509 Relationship Code pending update',
  DM510: 'DM510 Gender Code pending update',
  CE001: 'CE001 No 834 cancellation received',
  CE002: 'CE002 Record incorrectly matched',
  CE501: 'CE501 834 cancellation awaiting processing',
  CE502: 'CE502 Erroneous cancellation reported on MENR',
});

function stringValue(value) {
  return value === null || value === undefined ? '' : String(value);
}

function normalized(value) {
  return stringValue(value).trim().toUpperCase();
}

export function extractRawPriority(priority) {
  const text = stringValue(priority).trim();
  if (!text) return '';
  const match = text.match(/^(\d)/);
  return match ? match[1] : text;
}

export function formatPriorityDisplay(priority) {
  const rawPriority = extractRawPriority(priority);
  return PRIORITY_DISPLAY_BY_CODE[rawPriority] || stringValue(priority);
}

export function extractRawNoticeCode(code) {
  const text = stringValue(code).trim();
  if (!text) return '';
  if (normalized(text) === 'AE*') return 'AE999';
  if (text.includes('/')) {
    return text.split('/').map((item) => {
      const match = item.trim().match(/^([A-Z0-9*]+)/i);
      return match ? match[1].toUpperCase() : normalized(item);
    }).join('/');
  }
  const match = text.match(/^([A-Z0-9*]+)/i);
  return match ? match[1].toUpperCase() : normalized(code);
}

export function formatNoticeCodeDisplay(code) {
  const rawCode = extractRawNoticeCode(code);
  if (rawCode.includes('/')) {
    return rawCode
      .split('/')
      .map((item) => NOTICE_CODE_DISPLAY_BY_CODE[item] || item)
      .join('/');
  }
  return NOTICE_CODE_DISPLAY_BY_CODE[rawCode] || stringValue(code);
}
