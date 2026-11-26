const MAX_QUERY_LENGTH = 100000;
const MIN_MDW_SSN_BATCH_SIZE = 1;
const MAX_MDW_SSN_BATCH_SIZE = 5000;
const SUPPORTED_BINDS = new Set(['businessDate', 'mrnsJson', 'ssnsJson']);

export const DEFAULT_RCNOA_QUERY_CONFIGURATION = Object.freeze({
  mdwSsnBatchSize: 300,
  epdsQuery: `WITH runtime AS (
  SELECT TO_TIMESTAMP(:businessDate, 'YYYYMMDD') AS business_timestamp
  FROM dual
)
SELECT DISTINCT
  demographics.SSN AS member_or_subscriber_ssn,
  TO_CHAR(coverage_member.EFFECTIVE_START_DATE, 'YYYYMMDD') AS coverage_start_date,
  TO_CHAR(coverage_member.EFFECTIVE_END_DATE, 'YYYYMMDD') AS coverage_end_date,
  CASE
    WHEN UPPER(TRIM(batch.STATUS_CODE)) = 'SUCCESS' THEN 'Y'
    ELSE 'N'
  END AS processed
FROM RAWDATA_OWNER.FILE_INFO file_info
JOIN RAWDATA_OWNER.BATCH_RUN batch
  ON batch.BATCH_IK = file_info.BATCH_IK
 AND batch.SOURCE_FILE_NAME = file_info.SOURCE_FILE_NAME
JOIN RAWDATA_OWNER.HEALTH_COVERAGE coverage
  ON coverage.REGION_CODE = file_info.REGION_CODE
 AND coverage.INTERCHANGE_CONTROL_NUMBER = file_info.INTERCHANGE_CONTROL_NUMBER
 AND coverage.SOURCE_FILE_NAME = file_info.SOURCE_FILE_NAME
JOIN RAWDATA_OWNER.HEALTH_COVERAGE_MEMBER coverage_member
  ON coverage_member.REGION_CODE = coverage.REGION_CODE
 AND coverage_member.INTERCHANGE_CONTROL_NUMBER = coverage.INTERCHANGE_CONTROL_NUMBER
 AND coverage_member.TRANSACTIONSET_CONTROL_NUMBER = coverage.TRANSACTIONSET_CONTROL_NUMBER
 AND coverage_member.SOURCE_FILE_NAME = coverage.SOURCE_FILE_NAME
JOIN RAWDATA_OWNER.MEMBER_DEMOGRAPHICS demographics
  ON demographics.REGION_CODE = coverage_member.REGION_CODE
 AND demographics.INTERCHANGE_CONTROL_NUMBER = coverage_member.INTERCHANGE_CONTROL_NUMBER
 AND demographics.TRANSACTIONSET_CONTROL_NUMBER = coverage_member.TRANSACTIONSET_CONTROL_NUMBER
 AND demographics.HEALTH_COVERAGE_MEMBER_IK = coverage_member.HEALTH_COVERAGE_MEMBER_IK
 AND demographics.SOURCE_FILE_NAME = coverage_member.SOURCE_FILE_NAME
CROSS JOIN runtime
WHERE UPPER(TRIM(file_info.FILE_TYPE)) = '834'
  AND file_info.INTERCHANGE_TIMESTAMP >= runtime.business_timestamp - INTERVAL '30' DAY
  AND file_info.INTERCHANGE_TIMESTAMP < runtime.business_timestamp
  AND demographics.SSN IS NOT NULL
  AND coverage_member.EFFECTIVE_START_DATE IS NOT NULL`,
  mdwQuery: `WITH runtime AS (
  SELECT TO_DATE(:businessDate, 'YYYYMMDD') AS business_date
  FROM dual
)
,
lookup_ssns AS (
  SELECT /*+ MATERIALIZE CARDINALITY(lookup_json 900) */ lookup_key
  FROM JSON_TABLE(
    :ssnsJson,
    '$[*]' COLUMNS (lookup_key VARCHAR2(20) PATH '$')
  ) lookup_json
)
,
lookup_mrns AS (
  SELECT /*+ MATERIALIZE CARDINALITY(lookup_json 300) */
         lookup_json.lookup_key
  FROM JSON_TABLE(
    :mrnsJson,
    '$[*]' COLUMNS (
      lookup_key VARCHAR2(20) PATH '$'
    )
  ) lookup_json
)
,
matched_people AS (
  SELECT /*+ MATERIALIZE
             LEADING(lookup member_person)
             USE_HASH(member_person)
             CARDINALITY(lookup 300) */
         DISTINCT member_person.PRSN_IK
  FROM lookup_mrns lookup
  JOIN MDW2_V.PRSN_CRNT member_person
    ON member_person.MRN_NB = LTRIM (SUBSTR (lookup.lookup_key, 3, 12), '0')
    AND member_person.MRN_PFX_NB = TO_CHAR(TO_NUMBER(SUBSTR (lookup.lookup_key, 1, 2)))
)
,
ranked_memberships AS (
  SELECT /*+ LEADING(matched_people membership)
             USE_NL(membership) */
         matched_people.PRSN_IK AS matched_prsn_ik,
         membership.PRSN_IK,
         membership.RGN_CD,
         membership.LNE_NB,
         MAX(membership.LNE_NB) OVER (
           PARTITION BY membership.PRSN_IK
         ) AS max_lne_nb
  FROM matched_people
  CROSS JOIN runtime
  JOIN MDW2_V.MBRSHP_CRNT membership
    ON membership.PRSN_IK = matched_people.PRSN_IK
)
,
candidate_people AS (
  SELECT /*+ MATERIALIZE CARDINALITY(lookup 900) USE_HASH(person) */ person.PRSN_IK,
  person.rgn_cd
  FROM lookup_ssns lookup
  JOIN MDW2_V.PRSN_CRNT person
    ON lookup.lookup_key = person.SSN_NB
    WHERE rgn_cd in ('SC','NC')
  UNION
  SELECT
      matched_prsn_ik PRSN_IK,
      RGN_CD
    FROM ranked_memberships
    WHERE LNE_NB = max_lne_nb
    and rgn_cd in ('SC','NC')
)
,
candidate_membership AS (
  SELECT /*+ MATERIALIZE CARDINALITY(candidate 900) USE_NL(membership) */ membership.*
  FROM candidate_people candidate
  join runtime on 1=1
  JOIN MDW2_V.MBRSHP_CRNT membership
    ON candidate.PRSN_IK = membership.PRSN_IK
--    where runtime.business_date between membership.MBRSHP_EFF_STRT_DT and membership.MBRSHP_EFF_END_DT
)
SELECT DISTINCT
  member_person.MRN_PFX_NB || LPAD(TO_CHAR(member_person.MRN_NB), 10, '0') AS kp_mrn,
--  member_person.rgn_cd,
  TO_CHAR(membership.MBRSHP_EFF_STRT_DT, 'YYYYMMDD') AS coverage_start_date,
  TO_CHAR(membership.MBRSHP_EFF_END_DT, 'YYYYMMDD') AS coverage_end_date,
--  membership.MBRSHP_EFF_STRT_DT,
  member_person.FRST_NM AS first_name,
  member_person.LST_NM AS last_name,
  member_person.SSN_NB AS member_ssn,
  NVL(member_person.GNDR_CD, 'U') AS member_gender,
  membership.REL_TO_SBSCRB_CD AS relationship_code,
  coverage.SRC_SYS_KEY_3_TX AS plan_code,
  CAST(NULL AS VARCHAR2(50)) AS annuitant_number,
  CAST(NULL AS VARCHAR2(50)) AS payroll_office_number,
  CASE WHEN member_death.DEATH_DT IS NULL THEN 'N' ELSE 'Y' END AS member_deceased,
  CASE WHEN subscriber_death.DEATH_DT IS NULL THEN 'N' ELSE 'Y' END AS subscriber_deceased,
  TRUNC(MONTHS_BETWEEN(runtime.business_date, member_person.BRTH_DT) / 12) AS member_age,
  CAST(NULL AS VARCHAR2(1)) AS not_disabled,
  subscriber_person.SSN_NB AS subscriber_ssn,
  CAST(NULL AS VARCHAR2(1)) AS exception_flag,
  TO_CHAR(member_person.BRTH_DT, 'YYYYMMDD') AS member_birth_date,
  TO_CHAR(member_death.DEATH_DT, 'YYYYMMDD') AS member_deceased_date
FROM candidate_membership membership
JOIN MDW2_V.PRSN_CRNT member_person
  ON member_person.PRSN_IK = membership.PRSN_IK
JOIN MDW2_V.PRSN_CRNT subscriber_person
  ON subscriber_person.PRSN_IK = membership.SBSCRB_PRSN_IK
JOIN MDW2_V.MBRSHP_CVRG_OPTN_CRNT coverage
  ON coverage.PRSN_IK = membership.PRSN_IK
AND coverage.RGN_CD = membership.RGN_CD
AND coverage.MBRSHP_LNE_NB = membership.LNE_NB
OUTER APPLY (
  SELECT MAX(death.DEATH_DT) AS DEATH_DT
  FROM MDW2_V.PRSN_DEATH_CRNT death
  WHERE death.PRSN_IK = member_person.PRSN_IK
) member_death
OUTER APPLY (
  SELECT MAX(death.DEATH_DT) AS DEATH_DT
  FROM MDW2_V.PRSN_DEATH_CRNT death
  WHERE death.PRSN_IK = subscriber_person.PRSN_IK
) subscriber_death
CROSS JOIN runtime
 ORDER BY coverage_end_date DESC NULLS LAST, kp_mrn`,
});

function normalizeQuery(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} query is required`);
  const query = value.trim().replace(/;\s*$/, '').trim();
  if (!query) throw new Error(`${label} query is required`);
  if (query.length > MAX_QUERY_LENGTH) throw new Error(`${label} query cannot exceed ${MAX_QUERY_LENGTH} characters`);
  if (!/^(SELECT|WITH)\b/i.test(query)) throw new Error(`${label} query must be a SELECT or WITH statement`);
  if (query.includes(';')) throw new Error(`${label} query must contain one statement`);

  const structuralSql = query
    .replace(/--.*$/gm, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:''|[^'])*'/g, "''");
  if (/\b(INSERT|UPDATE|DELETE|MERGE|ALTER|DROP|CREATE|TRUNCATE|GRANT|REVOKE|BEGIN|DECLARE|CALL|EXECUTE)\b/i.test(structuralSql)) {
    throw new Error(`${label} query must be read-only`);
  }

  const bindNames = [...query.matchAll(/:([a-zA-Z][a-zA-Z0-9_]*)/g)].map((match) => match[1]);
  const unsupportedBind = bindNames.find((name) => !SUPPORTED_BINDS.has(name));
  if (unsupportedBind) throw new Error(`${label} query uses unsupported bind :${unsupportedBind}`);
  if (!bindNames.includes('businessDate')) throw new Error(`${label} query must use :businessDate`);
  if (label === 'MDW' && !bindNames.includes('ssnsJson')) {
    throw new Error('MDW query must use :ssnsJson for early filtering');
  }
  if (label === 'MDW' && !bindNames.includes('mrnsJson')) {
    throw new Error('MDW query must use :mrnsJson for I-family membership matching');
  }
  return query;
}

export function validateRcnoaQueryConfiguration(configuration) {
  if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) {
    throw new Error('RCNOA query configuration is required');
  }
  const mdwSsnBatchSize = Number(configuration.mdwSsnBatchSize);
  if (
    !Number.isInteger(mdwSsnBatchSize)
    || mdwSsnBatchSize < MIN_MDW_SSN_BATCH_SIZE
    || mdwSsnBatchSize > MAX_MDW_SSN_BATCH_SIZE
  ) {
    throw new Error(
      `MDW SSN batch size must be an integer between ${MIN_MDW_SSN_BATCH_SIZE} and ${MAX_MDW_SSN_BATCH_SIZE}`,
    );
  }
  return {
    mdwSsnBatchSize,
    epdsQuery: normalizeQuery(configuration.epdsQuery, 'EPDS'),
    mdwQuery: normalizeQuery(configuration.mdwQuery, 'MDW'),
  };
}