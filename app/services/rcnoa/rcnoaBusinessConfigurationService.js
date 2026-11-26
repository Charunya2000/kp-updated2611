const DEFAULT_N12_CODE = 'AE999';
const MAX_JSON_LENGTH = 100000;

export const RCNOA_TIMEOUT_DEFAULTS = Object.freeze({
  processingInactivityMinutes: 30,
  oracleCallTimeoutSeconds: 240,
  sftpConnectionTimeoutSeconds: 30,
});

export const DEFAULT_RCNOA_BUSINESS_CONFIGURATION = Object.freeze({
  n12Code: DEFAULT_N12_CODE,
  envelope: {},
  intentByCode: {},
  relationshipMap: {},
  addressLine3Mode: '',
  priorRcnaMatchKeySecret: '',
  reusePriorRcnaDecisions: true,
  ignoreFirstRcnoColumn: false,
  ignoreLastRcnoColumn: false,
  mappingApproved: false,
  skip834Creation: false,
  ...RCNOA_TIMEOUT_DEFAULTS,
});

function boundedInteger(value, fallback, name, minimum, maximum) {
  const normalized = value === undefined || value === null || value === ''
    ? fallback
    : Number(value);
  if (!Number.isInteger(normalized) || normalized < minimum || normalized > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} through ${maximum}`);
  }
  return normalized;
}

function plainObject(value, name) {
  let parsed = value;
  if (typeof parsed === 'string') {
    if (parsed.length > MAX_JSON_LENGTH) throw new Error(`${name} is too large`);
    try {
      parsed = parsed.trim() ? JSON.parse(parsed) : {};
    } catch {
      throw new Error(`${name} must contain valid JSON`);
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${name} must be a JSON object`);
  }
  return parsed;
}

export function validateRcnoaBusinessConfiguration(configuration, existing = null) {
  const n12Code = String(configuration?.n12Code || DEFAULT_N12_CODE).trim().toUpperCase();
  if (!/^[A-Z0-9]{1,20}$/.test(n12Code)) {
    throw new Error('N12 code must contain 1 through 20 letters or numbers');
  }

  const addressLine3Mode = String(configuration?.addressLine3Mode || '').trim();
  if (addressLine3Mode && !['reject', 'append-to-line2'].includes(addressLine3Mode)) {
    throw new Error('Address line 3 mode must be reject or append-to-line2');
  }

  const submittedSecret = String(configuration?.priorRcnaMatchKeySecret || '');
  const priorRcnaMatchKeySecret = submittedSecret || existing?.priorRcnaMatchKeySecret || '';
  if (submittedSecret && submittedSecret.length < 32) {
    throw new Error('Prior RCNA match-key secret must contain at least 32 characters');
  }

  return {
    n12Code,
    envelope: plainObject(configuration?.envelope, '834 envelope'),
    intentByCode: plainObject(configuration?.intentByCode, '834 intent map'),
    relationshipMap: plainObject(configuration?.relationshipMap, '834 relationship map'),
    addressLine3Mode,
    priorRcnaMatchKeySecret,
    reusePriorRcnaDecisions: configuration?.reusePriorRcnaDecisions !== false,
    ignoreFirstRcnoColumn: configuration?.ignoreFirstRcnoColumn === true,
    ignoreLastRcnoColumn: configuration?.ignoreLastRcnoColumn === true,
    mappingApproved: configuration?.mappingApproved === true,
    skip834Creation: configuration?.skip834Creation === true,
    processingInactivityMinutes: boundedInteger(
      configuration?.processingInactivityMinutes,
      RCNOA_TIMEOUT_DEFAULTS.processingInactivityMinutes,
      'Processing inactivity timeout',
      5,
      480,
    ),
    oracleCallTimeoutSeconds: boundedInteger(
      configuration?.oracleCallTimeoutSeconds,
      RCNOA_TIMEOUT_DEFAULTS.oracleCallTimeoutSeconds,
      'Oracle call timeout',
      30,
      1800,
    ),
    sftpConnectionTimeoutSeconds: boundedInteger(
      configuration?.sftpConnectionTimeoutSeconds,
      RCNOA_TIMEOUT_DEFAULTS.sftpConnectionTimeoutSeconds,
      'SFTP connection timeout',
      5,
      300,
    ),
  };
}

export function seedRcnoaBusinessConfiguration(environment = process.env) {
  return validateRcnoaBusinessConfiguration({
    n12Code: environment.RCNOA_N12_CODE || DEFAULT_N12_CODE,
    envelope: environment.RCNOA_834_ENVELOPE_JSON || {},
    intentByCode: environment.RCNOA_834_INTENT_BY_CODE_JSON || {},
    relationshipMap: environment.RCNOA_834_RELATIONSHIP_MAP_JSON || {},
    addressLine3Mode: environment.RCNOA_ADDRESS_LINE3_MODE || '',
    priorRcnaMatchKeySecret: environment.RCNOA_PRIOR_RCNA_MATCH_KEY_SECRET || '',
    reusePriorRcnaDecisions: String(
      environment.RCNOA_REUSE_PRIOR_RCNA_DECISIONS ?? 'true',
    ).trim().toLowerCase() !== 'false',
    ignoreFirstRcnoColumn: environment.RCNOA_IGNORE_FIRST_RCNO_COLUMN === 'true',
    ignoreLastRcnoColumn: environment.RCNOA_IGNORE_LAST_RCNO_COLUMN === 'true',
    mappingApproved: environment.RCNOA_834_MAPPING_APPROVED === 'true',
    skip834Creation: environment.RCNOA_SKIP_834_CREATION === 'true',
    processingInactivityMinutes: environment.RCNOA_PROCESSING_INACTIVITY_TIMEOUT_MINUTES,
    oracleCallTimeoutSeconds: environment.RCNOA_ORACLE_CALL_TIMEOUT_SECONDS,
    sftpConnectionTimeoutSeconds: environment.RCNOA_SFTP_CONNECTION_TIMEOUT_SECONDS,
  });
}

export function publicRcnoaBusinessConfiguration(configuration) {
  if (!configuration) return configuration;
  const { priorRcnaMatchKeySecret, ...publicConfiguration } = configuration;
  return {
    ...publicConfiguration,
    priorRcnaMatchKeySecretConfigured: Boolean(priorRcnaMatchKeySecret),
  };
}