WITH CAC AS (
  SELECT
    DISTINCT(
      cv.region_code || '-' || cv.regional_customer_id || '-' || cv.contract_id
    ) AS CAC_POLICY_NBR,
    --expensive, remove distinct if possible
    TO_DATE(cv.effective_date, 'DD-MON-YY') AS CAC_START_DT,
    TO_DATE(cv.TERMINATION_DATE, 'DD-MON-YY') AS CAC_END_DT,
    TRIM(UPPER(REPLACE(cv.funding_type, ' ', ''))) AS CAC_policy_type_cd,
    TRIM(UPPER(cv.description)) AS CAC_description,
    cva.state_code AS CAC_JURISDICTION,
    CASE
      WHEN sr.child_rule_id = 329
      AND sr.value = 'Group' THEN 'BIL-C331-BILL-ARNG-LISRFND'
      WHEN sr.child_rule_id = 329
      AND sr.value = 'Member' THEN 'BIL-C332-BILL-ARNG-LISRFND'
      ELSE 'BIL-C331-BILL-ARNG-LISRFND'
    END AS CAC_LIS_BILLING_ARRANGEMENT_RULE,
    CASE
      WHEN sr.child_rule_id = 328
      AND sr.value = 'Group' THEN 'BIL-C341-BILL-ARNG-LEP'
      WHEN sr.child_rule_id = 328
      AND sr.value = 'Member' THEN 'BIL-C342-BILL-ARNG-LEP'
      ELSE 'BIL-C341-BILL-ARNG-LEP'
    END AS CAC_LEP_BILLING_ARRANGEMENT_RULE
  FROM
    (
      SELECT
        CONTRACT_ID,
        CONTRACT_VERSION_NUMBER,
        REGIONAL_CUSTOMER_ID,
        REGION_CODE,
        NAME,
        DESCRIPTION,
        EFFECTIVE_DATE,
        END_DATE,
        CONTRACT_LENGTH,
        AUTO_RENEW_FLAG,
        ANNIVERSARY_DATE,
        ORIGINAL_CONTRACT_YEAR_BEGIN,
        ORIGINAL_CONTRACT_YEAR_END,
        RENEWAL_REQUEST_NOTIFICATION_DAYS,
        REQUEST_REASON_TYPE_CODE,
        AUTORENEWAL_REQUEST_SUBMISSION_DAYS,
        REQUIRE_MANUAL_APPROVAL_FLAG,
        DISPOSITION_STATUS_CODE,
        TERMINATION_DATE,
        TERMINATION_REASON_CODE,
        REINSTATEMENT_REASON_CODE,
        CREATED_BASED_ON_REQUEST_ID,
        COPIED_FROM_CONTRACT_VERSION_NUMBER,
        COPIED_FROM_CONTRACT_ID,
        COPIED_FROM_REGION_CODE,
        COPIED_FROM_REGIONAL_CUSTOMER_ID,
        REPLACED_BY_CONTRACT_VERSION_NUMBER,
        REPLACED_BY_CONTRACT_ID,
        REPLACED_BY_REGION_CODE,
        REPLACED_BY_REGIONAL_CUSTOMER_ID,
        REPLACED_BY_DATE,
        JDOC,
        ROW_ID,
        SRC_RECORD_STATUS_CD,
        SRC_INSERT_USER,
        SRC_INSERT_PROCESS,
        SRC_INSERT_TIMESTAMP,
        SRC_UPDATE_USER,
        SRC_UPDATE_PROCESS,
        SRC_UPDATE_TIMESTAMP,
        RECORD_STATUS_CODE,
        INSERT_USER,
        INSERT_PROCESS,
        INSERT_TIMESTAMP,
        UPDATE_USER,
        UPDATE_PROCESS,
        UPDATE_TIMESTAMP,
        UPSTREAM_SRC_CMT_NUMBER,
        ODS_INSERT_TIMESTAMP,
        ODS_UPDATE_TIMESTAMP,
        MEDICAID_CONTRACTED_PARTY,
        FUNDING_TYPE,
        ROW_NUMBER() OVER (
          PARTITION BY contract_id,
          regional_customer_id,
          region_code
          ORDER BY
            contract_version_number DESC
        ) AS rn
      FROM
        CONTRACT_OWNER.cac_contract_version
    ) cv
    LEFT JOIN CONTRACT_OWNER.cac_contract_version_address cva ON cv.regional_customer_id = cva.regional_customer_id
    AND cv.region_code = cva.region_code
    AND cv.contract_id = cva.contract_id
    LEFT JOIN CONTRACT_OWNER.cac_selected_rule sr ON cv.regional_customer_id = sr.regional_customer_id
    AND cv.region_code = sr.region_code
    AND cv.contract_id = sr.contract_id
  WHERE
    rn = 1
    AND cv.REGION_CODE = :region
),
ORMB AS (
  SELECT
    DISTINCT p.POLICY_NBR AS ORMB_POLICY_NBR,
    TO_DATE(p.START_DT, 'DD-MON-YY') AS ORMB_START_DT,
    TO_DATE(p.END_DT, 'DD-MON-YY') AS ORMB_END_DT,
    TRIM(UPPER(REPLACE(p.POLICY_TYPE_CD, ' ', ''))) AS ORMB_POLICY_TYPE_CD,
    TRIM(UPPER(p.DESCR)) AS ORMB_DESCRIPTION,
    ch.JURISDICTION AS ORMB_JURISDICTION,
    ch.LIS_BILLING_ARRANGEMENT_RULE AS ORMB_LIS_BILLING_ARRANGEMENT_RULE,
    ch.LEP_BILLING_ARRANGEMENT_RULE AS ORMB_LEP_BILLING_ARRANGEMENT_RULE
  FROM
    BILLING_OWNER.CI_POLICY p
    LEFT JOIN (
      SELECT
        POLICY_ID,
        MAX(
          CASE
            WHEN CHAR_TYPE_CD = 'CMJURISD' THEN TRIM(UPPER(SRCH_CHAR_VAL))
          END
        ) AS JURISDICTION,
        MAX(
          CASE
            WHEN CHAR_TYPE_CD = 'CMLISRUL' THEN TRIM(UPPER(SRCH_CHAR_VAL))
          END
        ) AS LIS_BILLING_ARRANGEMENT_RULE,
        MAX(
          CASE
            WHEN CHAR_TYPE_CD = 'CMLEPRUL' THEN TRIM(UPPER(SRCH_CHAR_VAL))
          END
        ) AS LEP_BILLING_ARRANGEMENT_RULE
      FROM
        BILLING_OWNER.CI_POLICY_CHAR
      WHERE
        CHAR_TYPE_CD IN ('CMJURISD', 'CMLISRUL', 'CMLEPRUL')
      GROUP BY
        POLICY_ID
    ) ch ON p.POLICY_ID = ch.POLICY_ID -- AND cv.regional_customer_id = '80000'
    -- ORDER BY cv.region_code, cv.regional_customer_id asc
)
SELECT
  CAC.cac_policy_nbr,
  ormb.ormb_policy_nbr,
  CAC.cac_start_dt,
  ormb.ormb_start_dt,
  CASE
    WHEN CAC.cac_start_dt = ormb.ormb_start_dt THEN 'true'
    ELSE 'false'
  END AS start_dt_compare,
  cac.cac_end_dt,
  ormb.ormb_end_dt,
  CASE
    WHEN CAC.cac_end_dt = ormb.ormb_end_dt THEN 'true'
    ELSE 'false'
  END AS end_dt_compare,
  cac.cac_POLICY_TYPE_CD,
  ormb.ORMB_POLICY_TYPE_CD,
  CASE
    WHEN CAC.cac_POLICY_TYPE_CD = ormb.ormb_POLICY_TYPE_CD THEN 'true'
    ELSE 'false'
  END AS POLICY_TYPE_CD_MATCH,
  cac.cac_DESCRIPTION,
  ormb.ormb_DESCRIPTION,
  CASE
    WHEN CAC.cac_DESCRIPTION = ormb.ormb_DESCRIPTION THEN 'true'
    ELSE 'false'
  END AS DESCRIPTION_MATCH,
  cac.cac_JURISDICTION,
  ormb.ormb_JURISDICTION,
  CASE
    WHEN CAC.cac_JURISDICTION = ormb.ormb_JURISDICTION THEN 'true'
    ELSE 'false'
  END AS JURISDICTION_MATCH,
  cac.cac_LIS_BILLING_ARRANGEMENT_RULE,
  ormb.ormb_LIS_BILLING_ARRANGEMENT_RULE,
  CASE
    WHEN CAC.cac_LIS_BILLING_ARRANGEMENT_RULE = ormb.ormb_LIS_BILLING_ARRANGEMENT_RULE THEN 'true'
    ELSE 'false'
  END AS LIS_BILLING_ARRANGEMENT_RULE_MATCH,
  cac.cac_LEP_BILLING_ARRANGEMENT_RULE,
  ormb.ormb_LEP_BILLING_ARRANGEMENT_RULE,
  CASE
    WHEN CAC.cac_LEP_BILLING_ARRANGEMENT_RULE = ormb.ormb_LEP_BILLING_ARRANGEMENT_RULE THEN 'true'
    ELSE 'false'
  END AS LEP_BILLING_ARRANGEMENT_RULE_MATCH
FROM
  CAC
  LEFT JOIN ORMB ON CAC.CAC_POLICY_NBR = ORMB.ORMB_POLICY_NBR