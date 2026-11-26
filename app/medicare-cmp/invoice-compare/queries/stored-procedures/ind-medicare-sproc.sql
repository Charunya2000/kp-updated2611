CREATE OR REPLACE PROCEDURE COMPARE_OWNER.MEDICARE_CMP_RUN_BATCH (
  P_RUN_ID       IN NUMBER,
  P_BATCH_NBR    IN VARCHAR2,
  P_REFRESH_DATA IN VARCHAR2 DEFAULT 'N'   -- 'Y' or 'N'
) AS
  V_BATCH_NBR      NUMBER;
  V_REFRESH        VARCHAR2(1) := UPPER(NVL(
    TRIM(P_REFRESH_DATA),
    'N'
  ));
  V_EXISTS         NUMBER;
  V_CURRENT_STATUS VARCHAR2(100);
  V_ERROR_MSG      VARCHAR2(4000);

  PROCEDURE SET_RUN_STATUS (
    P_STATUS             IN VARCHAR2,
    P_STEP               IN VARCHAR2 DEFAULT NULL,
    P_NEXT_STEP          IN VARCHAR2 DEFAULT NULL,
    P_ERROR              IN VARCHAR2 DEFAULT NULL,
    P_INVOICES_MED       IN NUMBER DEFAULT NULL,
    P_TOTAL_RECORDS_ORMB IN NUMBER DEFAULT NULL,
    P_TOTAL_COMPARE_MED  IN NUMBER DEFAULT NULL
  ) IS
    PRAGMA AUTONOMOUS_TRANSACTION;
  BEGIN
    MERGE INTO COMPARE_OWNER.MEDICARE_CMP_RUN_STATUS S
    USING (
      SELECT P_RUN_ID AS RUN_ID,
             V_BATCH_NBR AS BATCH_NBR
        FROM DUAL
    ) X ON ( S.RUN_ID = X.RUN_ID
       AND S.BATCH_NBR = X.BATCH_NBR )
    WHEN MATCHED THEN UPDATE
    SET S.STATUS = P_STATUS,
        S.CURRENT_STEP = NVL(
      P_STEP,
      S.CURRENT_STEP
    ),
        S.NEXT_STEP = P_NEXT_STEP,
        S.ERROR_MESSAGE =
      CASE
        WHEN P_ERROR IS NOT NULL THEN
          SUBSTR(
            P_ERROR,
            1,
            1000
          )
        ELSE
          S.ERROR_MESSAGE
      END,
        S.INVOICES_MED = NVL(
      P_INVOICES_MED,
      S.INVOICES_MED
    ),
        S.TOTAL_RECORDS_ORMB = NVL(
      P_TOTAL_RECORDS_ORMB,
      S.TOTAL_RECORDS_ORMB
    ),
        S.TOTAL_COMPARE_MED = NVL(
      P_TOTAL_COMPARE_MED,
      S.TOTAL_COMPARE_MED
    ),
        S.LAST_UPDATE_TS = SYSTIMESTAMP,
        S.END_TS =
      CASE
        WHEN P_STATUS IN ( 'COMPLETE',
                           'ERROR',
                           'CANCELED' ) THEN
          SYSTIMESTAMP
        ELSE
          NULL
      END
    WHEN NOT MATCHED THEN
    INSERT (
      RUN_ID,
      BATCH_NBR,
      STATUS,
      CURRENT_STEP,
      NEXT_STEP,
      ERROR_MESSAGE,
      INVOICES_MED,
      TOTAL_RECORDS_ORMB,
      TOTAL_COMPARE_MED,
      START_TS,
      LAST_UPDATE_TS,
      END_TS )
    VALUES
      ( P_RUN_ID,
        V_BATCH_NBR,
        P_STATUS,
        P_STEP,
        P_NEXT_STEP,
        SUBSTR(
          P_ERROR,
          1,
          1000
        ),
        NVL(
          P_INVOICES_MED,
          0
        ),
        NVL(
          P_TOTAL_RECORDS_ORMB,
          0
        ),
        NVL(
          P_TOTAL_COMPARE_MED,
          0
        ),
        SYSTIMESTAMP,
        SYSTIMESTAMP,
        CASE
          WHEN P_STATUS IN ( 'COMPLETE',
                             'ERROR',
                             'CANCELED' ) THEN
            SYSTIMESTAMP
          ELSE
            NULL
        END
      );

    COMMIT;
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END SET_RUN_STATUS;

  PROCEDURE CHECK_CANCELED IS
    V_STATUS VARCHAR2(100);
  BEGIN
    SELECT STATUS
      INTO V_STATUS
      FROM COMPARE_OWNER.MEDICARE_CMP_RUN_STATUS
     WHERE RUN_ID = P_RUN_ID
       AND BATCH_NBR = V_BATCH_NBR;

    IF V_STATUS = 'CANCELED' THEN
      RAISE_APPLICATION_ERROR(
        -20099,
        'Job canceled by user'
      );
    END IF;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      NULL;
  END CHECK_CANCELED;

BEGIN
  V_BATCH_NBR := TO_NUMBER ( TRIM(P_BATCH_NBR) );
  IF P_RUN_ID IS NULL THEN
    RAISE_APPLICATION_ERROR(
      -20002,
      'P_RUN_ID must be provided'
    );
  END IF;
  IF V_REFRESH NOT IN ( 'Y',
                        'N' ) THEN
    SET_RUN_STATUS(
      'ERROR',
      'VALIDATION',
      NULL,
      'P_REFRESH_DATA must be Y or N'
    );
    RAISE_APPLICATION_ERROR(
      -20001,
      'P_REFRESH_DATA must be Y or N'
    );
  END IF;

  SET_RUN_STATUS(
    'IN_PROGRESS',
    'INITIALIZATION',
    'SOURCE MED INSERT'
  );
  IF V_REFRESH = 'N' THEN
    SELECT COUNT(*)
      INTO V_EXISTS
      FROM (
      SELECT 1
        FROM COMPARE_OWNER.MEDICARE_CMP_RESULTS
       WHERE BATCH_NBR = V_BATCH_NBR
         AND ROWNUM = 1
    );

    IF V_EXISTS > 0 THEN
      SET_RUN_STATUS(
        'COMPLETE',
        'RESULTS ALREADY AVAILABLE',
        NULL
      );
      RETURN;
    END IF;
  END IF;

  IF V_REFRESH = 'Y' THEN
    DELETE FROM COMPARE_OWNER.MEDICARE_CMP_RESULTS
     WHERE BATCH_NBR = V_BATCH_NBR;
    DELETE FROM COMPARE_OWNER.MEDICARE_CMP_SOURCE_MED_XML
     WHERE BATCH_NBR = V_BATCH_NBR;
    DELETE FROM COMPARE_OWNER.MEDICARE_CMP_TARGET_ORMB
     WHERE BATCH_NBR = V_BATCH_NBR;
  END IF;
  CHECK_CANCELED;

  --------------------------------------------------------------------
  -- Load SOURCE MED XML (from ind_med_xml_read_v3.0.sql)
  --------------------------------------------------------------------
  INSERT INTO COMPARE_OWNER.MEDICARE_CMP_SOURCE_MED_XML (
    KPMC_TRANSACTION_ID,
    BILL_ID,
    REGION,
    BATCH_NBR,
    ENTITY_TYPE,
    ENTITY_KEY,
    FIELD_NAME,
    FIELD_VALUE
  )
    WITH PAYLOAD_RANKED AS (
      SELECT EPL.KPMC_TRANSACTION_ID,
             B.ACCT_ID,
             B.BILL_ID,
             B.RGN_CD,
             B.BATCH_CD,
             B.BATCH_NBR,
             EPL.PAYLOAD_XML,
             CESD.CM_EXT_SEQ_NUM,
             ROW_NUMBER()
             OVER(PARTITION BY B.BILL_ID
                  ORDER BY B.STM_SEQ_NM DESC,
                           EPL.INSERT_TIMESTAMP DESC,
                           EPL.KPMC_TRANSACTION_ID DESC
             ) AS RN
        FROM KPMC_DOCMGMT_ADM.KPMC_EXTRACT_PAYLOAD EPL
        JOIN KPMC_DOCMGMT_ADM.INDV_INVOICE_CONS_CTL B
      ON B.KPMC_INDIVIDUAL_INVOICE_TRANSACTION_ID = EPL.KPMC_TRANSACTION_ID
        JOIN BILLING_OWNER.CM_EXTR_STM_DTL CESD
      ON CESD.BILL_ID = B.BILL_ID
       WHERE EPL.TYPE = 'INDV_CONS_CBILL'
         AND B.BATCH_CD = 'CM-STMEX'
         AND B.BATCH_NBR = P_BATCH_NBR
         AND B.STM_SEQ_NM = (
        SELECT MAX(C.STM_SEQ_NM)
          FROM KPMC_DOCMGMT_ADM.INDV_INVOICE_CONS_CTL C
         WHERE C.KPMC_INDIVIDUAL_INVOICE_TRANSACTION_ID = B.KPMC_INDIVIDUAL_INVOICE_TRANSACTION_ID
      )
         AND CESD.CM_EXT_SEQ_NUM = (
        SELECT MAX(CESDS.CM_EXT_SEQ_NUM)
          FROM BILLING_OWNER.CM_EXTR_STM_DTL CESDS
         WHERE CESD.STM_ID = CESDS.STM_ID
      )
         AND EPL.INSERT_TIMESTAMP = (
        SELECT MAX(EPL1.INSERT_TIMESTAMP)
          FROM KPMC_DOCMGMT_ADM.KPMC_EXTRACT_PAYLOAD EPL1
         WHERE EPL1.KPMC_TRANSACTION_ID = EPL.KPMC_TRANSACTION_ID
      )
    )
--select * from PAYLOAD_RANKED;
    ,PAYLOAD_BASE AS (
      SELECT KPMC_TRANSACTION_ID,
             ACCT_ID,
             BILL_ID,
             RGN_CD,
             BATCH_CD,
             BATCH_NBR,
             CM_EXT_SEQ_NUM,
             PAYLOAD_XML
        FROM PAYLOAD_RANKED
       WHERE RN = 1
    )
--select * from PAYLOAD_BASE;
    ,STATEMENT_ROWS AS (
      SELECT PB.KPMC_TRANSACTION_ID,
             PB.ACCT_ID,
             PB.BILL_ID,
             PB.RGN_CD,
             PB.BATCH_CD,
             PB.BATCH_NBR,
             S.INVOICE_TOTAL_AMOUNT,
             S.COVERAGE_THROUGH_MONTH,
             S.COVERAGE_THROUGH_YEAR,
             S.INVOICE_SUMMARY_DUE_DATE,
             S.ORMB_ACCT_ID,
             S.PRIMARY_SUB_TOTAL_AMOUNT,
             S.MRN_PREFIX,
             S.MRN_SUFFIX,
             S.INVOICE_ACI_ACCT_NB,
             S.INVOICE_ACI_AUTO_PAY_DATE,
             S.INVOICE_GENERATED_DATE,
             S.SUBSCRIBER_FIRST_NAME,
             S.SUBSCRIBER_MID_INTL,
             S.SUBSCRIBER_LAST_NAME,
             S.SUBSCRIBER_ADDR_CARE_OF_FIRST_NAME,
             S.SUBSCRIBER_ADDR_CARE_OF_MID_NAME,
             S.SUBSCRIBER_ADDR_CARE_OF_LAST_NAME,
             S.SUBSCRIBER_ADDR_ADDR_LN1,
             S.SUBSCRIBER_ADDR_ADDR_LN2,
             S.SUBSCRIBER_ADDR_ADDR_CITY,
             S.SUBSCRIBER_ADDR_ADDR_STATE_CD,
             S.SUBSCRIBER_ADDR_ADDR_ZIP_CD,
             S.SUBSCRIBER_ADDR_ADDR_ZIP_CD_PLUS4,
             S.SECONDARY_XML,
             S.SUBSCRIBERS_XML,
             PB.CM_EXT_SEQ_NUM
        FROM PAYLOAD_BASE PB
       CROSS JOIN XMLTABLE ( '/Statement'
          PASSING XMLPARSE(DOCUMENT PB.PAYLOAD_XML)
        COLUMNS
          INVOICE_TOTAL_AMOUNT VARCHAR2(50) PATH 'INVOICE-TOTAL-AMOUNT',
          COVERAGE_THROUGH_MONTH VARCHAR2(20) PATH 'COVERAGE-THROUGH-MONTH',
          COVERAGE_THROUGH_YEAR VARCHAR2(20) PATH 'COVERAGE-THROUGH-YEAR',
          INVOICE_SUMMARY_DUE_DATE VARCHAR2(20) PATH 'INVOICE-SUMMARY-DUE-DATE',
          ORMB_ACCT_ID VARCHAR2(50) PATH 'ORMB-ACCT-ID',
          PRIMARY_SUB_TOTAL_AMOUNT VARCHAR2(50) PATH 'PRIMARY-SUB-TOTAL-AMOUNT',
          MRN_PREFIX VARCHAR2(20) PATH 'MRN-PREFIX',
          MRN_SUFFIX VARCHAR2(50) PATH 'MRN-SUFFIX',
          INVOICE_ACI_ACCT_NB VARCHAR2(50) PATH 'INVOICE-ACI-ACCT-NB',
          INVOICE_ACI_AUTO_PAY_DATE VARCHAR2(20) PATH 'INVOICE-ACI-AUTO-PAY-DATE',
          INVOICE_GENERATED_DATE VARCHAR2(20) PATH 'INVOICE-GENERATED-DATE',
          SUBSCRIBER_FIRST_NAME VARCHAR2(100) PATH 'SUBSCRIBER-FIRST-NAME' DEFAULT NULL,
          SUBSCRIBER_MID_INTL VARCHAR2(100) PATH 'SUBSCRIBER-MID-INTL' DEFAULT NULL,
          SUBSCRIBER_LAST_NAME VARCHAR2(100) PATH 'SUBSCRIBER-LAST-NAME' DEFAULT NULL,
          SUBSCRIBER_ADDR_CARE_OF_FIRST_NAME VARCHAR2(100) PATH 'SUBSCRIBER-ADDR-CARE-OF-FIRST-NAME' DEFAULT NULL,
          SUBSCRIBER_ADDR_CARE_OF_MID_NAME VARCHAR2(100) PATH 'SUBSCRIBER-ADDR-CARE-OF-MID-NAME' DEFAULT NULL,
          SUBSCRIBER_ADDR_CARE_OF_LAST_NAME VARCHAR2(100) PATH 'SUBSCRIBER-ADDR-CARE-OF-LAST-NAME' DEFAULT NULL,
          SUBSCRIBER_ADDR_ADDR_LN1 VARCHAR2(100) PATH 'SUBSCRIBER-ADDR-ADDR-LN1' DEFAULT NULL,
          SUBSCRIBER_ADDR_ADDR_LN2 VARCHAR2(100) PATH 'SUBSCRIBER-ADDR-ADDR-LN2' DEFAULT NULL,
          SUBSCRIBER_ADDR_ADDR_CITY VARCHAR2(100) PATH 'SUBSCRIBER-ADDR-ADDR-CITY' DEFAULT NULL,
          SUBSCRIBER_ADDR_ADDR_STATE_CD VARCHAR2(100) PATH 'SUBSCRIBER-ADDR-ADDR-STATE-CD' DEFAULT NULL,
          SUBSCRIBER_ADDR_ADDR_ZIP_CD VARCHAR2(100) PATH 'SUBSCRIBER-ADDR-ADDR-ZIP-CD' DEFAULT NULL,
          SUBSCRIBER_ADDR_ADDR_ZIP_CD_PLUS4 VARCHAR2(100) PATH 'SUBSCRIBER-ADDR-ADDR-ZIP-CD-PLUS4' DEFAULT NULL,
          SECONDARY_XML XMLTYPE PATH 'SECONDARY-ARRAY',
          SUBSCRIBERS_XML XMLTYPE PATH 'SUBSCRIBER-ARRAY'
      ) S
    )
--select * from STATEMENT_ROWS;
    ,SECONDARY_ROWS AS (
      SELECT ST.KPMC_TRANSACTION_ID,
             ST.ACCT_ID,
             ST.BILL_ID,
             ST.BATCH_NBR,
             ST.RGN_CD AS REGION,
             SEC.SECONDARY_SEQ,
             SEC.SECONDARY_PARENT_BILLING_UNIT,
             SEC.SECONDARY_SUB_TOTAL_AMOUNT,
             SEC.SECONDARY_CONTRACT_OPTION_NAME,
             SEC.SECONDARY_FAMILY_ACCOUNT_NO,
             SEC.SECONDARY_MRN_SUFFIX
        FROM STATEMENT_ROWS ST
        LEFT JOIN XMLTABLE ( '/SECONDARY-ARRAY'
          PASSING ST.SECONDARY_XML
        COLUMNS
          SECONDARY_SEQ FOR ORDINALITY,
          SECONDARY_PARENT_BILLING_UNIT VARCHAR2(100) PATH 'SECONDARY-PARENT-BILLING-UNIT',
          SECONDARY_SUB_TOTAL_AMOUNT VARCHAR2(50) PATH 'SECONDARY-SUB-TOTAL-AMOUNT',
          SECONDARY_CONTRACT_OPTION_NAME VARCHAR2(100) PATH 'SECONDARY-CONTRACT-OPTION-NAME',
          SECONDARY_FAMILY_ACCOUNT_NO VARCHAR2(50) PATH 'SECONDARY-FAMILY-ACCOUNT-NO',
          SECONDARY_MRN_SUFFIX VARCHAR2(50) PATH 'SECONDARY-MRN-SUFFIX'
      ) SEC
      ON 1 = 1
    )
--select * from SECONDARY_ROWS;
    ,SUBSCRIBER_ROWS AS (
      SELECT ST.KPMC_TRANSACTION_ID,
             ST.ACCT_ID,
             ST.BILL_ID,
             ST.BATCH_NBR,
             ST.RGN_CD AS REGION,
             SUB.SUBSCRIBER_SEQ,
             SUB.SUBSCRIBER_XML,
             COALESCE(
               NULLIF(
                 TRIM(SUB.SUMMARY_ORMB_ACCT_ID),
                 ''
               ),
               NULLIF(
                 TRIM(SUB.SUMMARY_SUBSCRIBER_MRN_PREFIX)
                 || TRIM(SUB.SUMMARY_SUBSCRIBER_MRN_SUFFIX),
                 ''
               ),
               TO_CHAR(SUB.SUBSCRIBER_SEQ)
             ) AS SUBSCRIBER_KEY,
             SUB.ACTIVITY_START_DATE,
             SUB.ACTIVITY_END_DATE,
             SUB.COVERAGE_THROUGH_MONTH_DETAIL,
             SUB.BEGINNING_BALANCE,
             SUB.PAYMENTS_AMOUNT,
             SUB.REMITTANCE_REVERSAL_AMOUNT,
             SUB.MED_NON_SUP_PREM_AMOUNT,
             SUB.ADJUSTMENT_AMOUNT,
             SUB.SUB_TOTAL,
             SUB.CURRENT_RETIREE_SUBSIDY_AMOUNT,
             SUB.CURRENT_SPDAP_AMOUNT,
             SUB.CURRENT_DUES_LEP_AMOUNT,
             SUB.CURRENT_DUES_LIS_AMOUNT,
             SUB.RETROACTIVE_DUES_LEP_AMOUNT,
             SUB.RETROACTIVE_LIS_AMOUNT,
             SUB.RETROACTIVE_RETIREE_SUBSIDY_AMOUNT,
             SUB.RETROACTIVE_SPDAP_AMOUNT
        FROM STATEMENT_ROWS ST
        LEFT JOIN XMLTABLE ( '/SUBSCRIBER-ARRAY'
          PASSING ST.SUBSCRIBERS_XML
        COLUMNS
          SUBSCRIBER_SEQ FOR ORDINALITY,
          SUBSCRIBER_XML XMLTYPE PATH '.',
          SUMMARY_ORMB_ACCT_ID VARCHAR2(50) PATH 'SUMMARY-ORMB-ACCT-ID',
          SUMMARY_SUBSCRIBER_MRN_PREFIX VARCHAR2(20) PATH 'SUMMARY-SUBSCRIBER-MRN-PREFIX',
          SUMMARY_SUBSCRIBER_MRN_SUFFIX VARCHAR2(50) PATH 'SUMMARY-SUBSCRIBER-MRN-SUFFIX',
          ACTIVITY_START_DATE VARCHAR2(20) PATH 'ACTIVITY-START-DATE',
          ACTIVITY_END_DATE VARCHAR2(20) PATH 'ACTIVITY-END-DATE',
          COVERAGE_THROUGH_MONTH_DETAIL VARCHAR2(20) PATH 'COVERAGE-THROUGH-MONTH-DETAIL',
          BEGINNING_BALANCE VARCHAR2(50) PATH 'BEGINNING-BALANCE',
          PAYMENTS_AMOUNT VARCHAR2(50) PATH 'PAYMENTS-AMOUNT',
          REMITTANCE_REVERSAL_AMOUNT VARCHAR2(50) PATH 'REMITTANCE-REVERSAL-AMOUNT',
          MED_NON_SUP_PREM_AMOUNT VARCHAR2(50) PATH 'MED-NON-SUP-PREM-AMOUNT',
          ADJUSTMENT_AMOUNT VARCHAR2(50) PATH 'ADJUSTMENT-AMOUNT',
          SUB_TOTAL VARCHAR2(50) PATH 'SUB-TOTAL',
          CURRENT_RETIREE_SUBSIDY_AMOUNT VARCHAR2(50) PATH 'CURRENT-RETIREE-SUBSIDY-AMOUNT',
          CURRENT_SPDAP_AMOUNT VARCHAR2(50) PATH 'CURRENT-SPDAP-AMOUNT',
          CURRENT_DUES_LEP_AMOUNT VARCHAR2(50) PATH 'CURRENT-DUES-LEP-AMOUNT',
          CURRENT_DUES_LIS_AMOUNT VARCHAR2(50) PATH 'CURRENT-DUES-LIS-AMOUNT',
          RETROACTIVE_DUES_LEP_AMOUNT VARCHAR2(50) PATH 'RETROACTIVE-DUES-LEP-AMOUNT',
          RETROACTIVE_LIS_AMOUNT VARCHAR2(50) PATH 'RETROACTIVE-LIS-AMOUNT',
          RETROACTIVE_RETIREE_SUBSIDY_AMOUNT VARCHAR2(50) PATH 'RETROACTIVE-RETIREE-SUBSIDY-AMOUNT',
          RETROACTIVE_SPDAP_AMOUNT VARCHAR2(50) PATH 'RETROACTIVE-SPDAP-AMOUNT'
      ) SUB
      ON 1 = 1
         AND ST.ACCT_ID = SUB.SUMMARY_ORMB_ACCT_ID
    )
--select * from SUBSCRIBER_ROWS;
    ,PAST_DUE_ROWS AS (
      SELECT SR.KPMC_TRANSACTION_ID,
             SR.BILL_ID,
             SR.BATCH_NBR,
             SR.REGION,
             SR.SUBSCRIBER_KEY,
             PD.ITEM_SEQ,
             PD.PAST_DUE_COVERAGE_PERIOD,
             PD.PAST_DUE_DUE_DATE,
             PD.PAST_DUE_AMOUNT
        FROM SUBSCRIBER_ROWS SR
        LEFT JOIN XMLTABLE ( '/SUBSCRIBER-ARRAY/PAST-DUE-ARRAY'
          PASSING SR.SUBSCRIBER_XML
        COLUMNS
          ITEM_SEQ FOR ORDINALITY,
          PAST_DUE_COVERAGE_PERIOD VARCHAR2(20) PATH 'PAST-DUE-COVERAGE-PERIOD',
          PAST_DUE_DUE_DATE VARCHAR2(20) PATH 'PAST-DUE-DUE-DATE',
          PAST_DUE_AMOUNT VARCHAR2(50) PATH 'PAST-DUE-AMOUNT'
      ) PD
      ON 1 = 1
       ORDER BY SR.KPMC_TRANSACTION_ID,
                SR.BILL_ID,
                SR.SUBSCRIBER_KEY,
                TO_DATE(PD.PAST_DUE_DUE_DATE,
                        'MM/DD/YYYY'),
                TO_NUMBER(PD.PAST_DUE_AMOUNT)
    )
--select * from PAST_DUE_ROWS;
    ,PAYMENTS_30_ROWS AS (
      SELECT SR.KPMC_TRANSACTION_ID,
             SR.BILL_ID,
             SR.BATCH_NBR,
             SR.REGION,
             SR.SUBSCRIBER_KEY,
             P30.ITEM_SEQ,
             P30.PAYMENTS_30_DATE,
             P30.PAYMENTS_30_AMOUNT
        FROM SUBSCRIBER_ROWS SR
        LEFT JOIN XMLTABLE ( '/SUBSCRIBER-ARRAY/PAYMENTS-30-DAY-ARRAY'
          PASSING SR.SUBSCRIBER_XML
        COLUMNS
          ITEM_SEQ FOR ORDINALITY,
          PAYMENTS_30_DATE VARCHAR2(20) PATH 'PAYMENTS-30-DATE',
          PAYMENTS_30_AMOUNT VARCHAR2(50) PATH 'PAYMENTS-30-AMOUNT'
      ) P30
      ON 1 = 1
    )
--select * from PAYMENTS_30_ROWS;
    ,HEADER_BASE AS (
      SELECT DISTINCT KPMC_TRANSACTION_ID,
                      BILL_ID,
                      BATCH_NBR,
                      CM_EXT_SEQ_NUM,
                      TRIM(RGN_CD) AS REGION,
                      CASE
                        WHEN TRIM(INVOICE_TOTAL_AMOUNT) IS NULL THEN
                          NULL
                        WHEN REGEXP_LIKE ( TRIM(INVOICE_TOTAL_AMOUNT),
                                           '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
                          TO_CHAR(
                            TO_NUMBER(TRIM(INVOICE_TOTAL_AMOUNT)),
                            'FM9999999990D00'
                          )
                        ELSE
                          TRIM(INVOICE_TOTAL_AMOUNT)
                      END AS INVOICE_TOTAL_AMOUNT,
                      CASE
                        WHEN TRIM(COVERAGE_THROUGH_MONTH) IS NULL THEN
                          NULL
                        WHEN REGEXP_LIKE ( TRIM(COVERAGE_THROUGH_MONTH),
                                           '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' ) THEN
                          TO_CHAR(
                            TO_DATE(TRIM(COVERAGE_THROUGH_MONTH),
                                  'MM/DD/YYYY'),
                            'YYYY-MM-DD'
                          )
                        ELSE
                          TRIM(COVERAGE_THROUGH_MONTH)
                      END AS COVERAGE_THROUGH_MONTH,
                      CASE
                        WHEN TRIM(COVERAGE_THROUGH_YEAR) IS NULL THEN
                          NULL
                        WHEN REGEXP_LIKE ( TRIM(COVERAGE_THROUGH_YEAR),
                                           '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' ) THEN
                          TO_CHAR(
                            TO_DATE(TRIM(COVERAGE_THROUGH_YEAR),
                                  'MM/DD/YYYY'),
                            'YYYY-MM-DD'
                          )
                        ELSE
                          TRIM(COVERAGE_THROUGH_YEAR)
                      END AS COVERAGE_THROUGH_YEAR,
                      CASE
                        WHEN TRIM(INVOICE_SUMMARY_DUE_DATE) IS NULL THEN
                          NULL
                        WHEN REGEXP_LIKE ( TRIM(INVOICE_SUMMARY_DUE_DATE),
                                           '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' ) THEN
                          TO_CHAR(
                            TO_DATE(TRIM(INVOICE_SUMMARY_DUE_DATE),
                                  'MM/DD/YYYY'),
                            'YYYY-MM-DD'
                          )
                        ELSE
                          TRIM(INVOICE_SUMMARY_DUE_DATE)
                      END AS INVOICE_SUMMARY_DUE_DATE,
                      TRIM(ORMB_ACCT_ID) AS ORMB_ACCT_ID,
                      CASE
                        WHEN TRIM(PRIMARY_SUB_TOTAL_AMOUNT) IS NULL THEN
                          NULL
                        WHEN REGEXP_LIKE ( TRIM(PRIMARY_SUB_TOTAL_AMOUNT),
                                           '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
                          TO_CHAR(
                            TO_NUMBER(TRIM(PRIMARY_SUB_TOTAL_AMOUNT)),
                            'FM9999999990D00'
                          )
                        ELSE
                          TRIM(PRIMARY_SUB_TOTAL_AMOUNT)
                      END AS PRIMARY_SUB_TOTAL_AMOUNT,
                      TRIM(MRN_PREFIX) AS MRN_PREFIX,
                      TRIM(MRN_SUFFIX) AS MRN_SUFFIX,
                      TRIM(INVOICE_ACI_ACCT_NB) AS INVOICE_ACI_ACCT_NB,
                      CASE
                        WHEN TRIM(INVOICE_ACI_AUTO_PAY_DATE) IS NULL THEN
                          NULL
                        WHEN REGEXP_LIKE ( TRIM(INVOICE_ACI_AUTO_PAY_DATE),
                                           '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' ) THEN
                          TO_CHAR(
                            TO_DATE(TRIM(INVOICE_ACI_AUTO_PAY_DATE),
                                  'MM/DD/YYYY'),
                            'YYYY-MM-DD'
                          )
                        ELSE
                          TRIM(INVOICE_ACI_AUTO_PAY_DATE)
                      END AS INVOICE_ACI_AUTO_PAY_DATE,
                      CASE
                        WHEN TRIM(INVOICE_GENERATED_DATE) IS NULL THEN
                          NULL
                        WHEN REGEXP_LIKE ( TRIM(INVOICE_GENERATED_DATE),
                                           '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' ) THEN
                          TO_CHAR(
                            TO_DATE(TRIM(INVOICE_GENERATED_DATE),
                                  'MM/DD/YYYY'),
                            'YYYY-MM-DD'
                          )
                        ELSE
                          TRIM(INVOICE_GENERATED_DATE)
                      END AS INVOICE_GENERATED_DATE,
                      NULLIF(
                        TRIM(SUBSCRIBER_FIRST_NAME),
                        ''
                      ) AS SUBSCRIBER_FIRST_NAME,
                      NULLIF(
                        TRIM(SUBSCRIBER_MID_INTL),
                        ''
                      ) AS SUBSCRIBER_MID_INTL,
                      NULLIF(
                        TRIM(SUBSCRIBER_LAST_NAME),
                        ''
                      ) AS SUBSCRIBER_LAST_NAME,
                      NULLIF(
                        TRIM(SUBSCRIBER_ADDR_CARE_OF_FIRST_NAME),
                        ''
                      ) AS SUBSCRIBER_ADDR_CARE_OF_FIRST_NAME,
                      NULLIF(
                        TRIM(SUBSCRIBER_ADDR_CARE_OF_MID_NAME),
                        ''
                      ) AS SUBSCRIBER_ADDR_CARE_OF_MID_NAME,
                      NULLIF(
                        TRIM(SUBSCRIBER_ADDR_CARE_OF_LAST_NAME),
                        ''
                      ) AS SUBSCRIBER_ADDR_CARE_OF_LAST_NAME,
                      NULLIF(
                        TRIM(SUBSCRIBER_ADDR_ADDR_LN1),
                        ''
                      ) AS SUBSCRIBER_ADDR_ADDR_LN1,
                      NULLIF(
                        TRIM(SUBSCRIBER_ADDR_ADDR_LN2),
                        ''
                      ) AS SUBSCRIBER_ADDR_ADDR_LN2,
                      NULLIF(
                        TRIM(SUBSCRIBER_ADDR_ADDR_CITY),
                        ''
                      ) AS SUBSCRIBER_ADDR_ADDR_CITY,
                      NULLIF(
                        TRIM(SUBSCRIBER_ADDR_ADDR_STATE_CD),
                        ''
                      ) AS SUBSCRIBER_ADDR_ADDR_STATE_CD,
                      NULLIF(
                        TRIM(SUBSCRIBER_ADDR_ADDR_ZIP_CD),
                        ''
                      ) AS SUBSCRIBER_ADDR_ADDR_ZIP_CD,
                      NULLIF(
                        TRIM(SUBSCRIBER_ADDR_ADDR_ZIP_CD_PLUS4),
                        ''
                      ) AS SUBSCRIBER_ADDR_ADDR_ZIP_CD_PLUS4
        FROM STATEMENT_ROWS
    )
--select * from HEADER_BASE;
    ,HEADER_COMPARE AS (
      SELECT KPMC_TRANSACTION_ID,
             BILL_ID,
             REGION,
             BATCH_NBR,
             'HEADER' AS ENTITY_TYPE,
             '0' AS ENTITY_KEY,
             FIELD_NAME,
             FIELD_VALUE
        FROM (
        SELECT KPMC_TRANSACTION_ID,
               HB.BILL_ID,
               BATCH_NBR,
               REGION,
               INVOICE_TOTAL_AMOUNT,
               COVERAGE_THROUGH_MONTH,
               COVERAGE_THROUGH_YEAR,
               INVOICE_SUMMARY_DUE_DATE,
               ORMB_ACCT_ID,
               PRIMARY_SUB_TOTAL_AMOUNT,
               MRN_PREFIX,
               MRN_SUFFIX,
               INVOICE_ACI_ACCT_NB,
               INVOICE_ACI_AUTO_PAY_DATE,
               INVOICE_GENERATED_DATE,
               SUBSCRIBER_FIRST_NAME,
               SUBSCRIBER_MID_INTL,
               SUBSCRIBER_LAST_NAME,
               SUBSCRIBER_ADDR_CARE_OF_FIRST_NAME,
               SUBSCRIBER_ADDR_CARE_OF_MID_NAME,
               SUBSCRIBER_ADDR_CARE_OF_LAST_NAME,
               SUBSCRIBER_ADDR_ADDR_LN1,
               SUBSCRIBER_ADDR_ADDR_LN2,
               SUBSCRIBER_ADDR_ADDR_CITY,
               SUBSCRIBER_ADDR_ADDR_STATE_CD,
               SUBSCRIBER_ADDR_ADDR_ZIP_CD,
               SUBSCRIBER_ADDR_ADDR_ZIP_CD_PLUS4
          FROM HEADER_BASE HB
          JOIN BILLING_OWNER.CM_EXTR_STM_DTL CESD
        ON CESD.BILL_ID = HB.BILL_ID
           AND HB.CM_EXT_SEQ_NUM = CESD.CM_EXT_SEQ_NUM
           AND CESD.CM_PRIM_BILL_SW = 'Y'
      ) UNPIVOT INCLUDE NULLS ( FIELD_VALUE
        FOR FIELD_NAME
      IN ( INVOICE_TOTAL_AMOUNT AS 'INVOICE-TOTAL-AMOUNT',
           COVERAGE_THROUGH_MONTH AS 'COVERAGE-THROUGH-MONTH',
           COVERAGE_THROUGH_YEAR AS 'COVERAGE-THROUGH-YEAR',
           INVOICE_SUMMARY_DUE_DATE AS 'INVOICE-SUMMARY-DUE-DATE',
           ORMB_ACCT_ID AS 'ORMB-ACCT-ID',
           PRIMARY_SUB_TOTAL_AMOUNT AS 'PRIMARY-SUB-TOTAL-AMOUNT',
           MRN_PREFIX AS 'MRN-PREFIX',
           MRN_SUFFIX AS 'MRN-SUFFIX',
           INVOICE_ACI_ACCT_NB AS 'INVOICE-ACI-ACCT-NB',
           INVOICE_ACI_AUTO_PAY_DATE AS 'INVOICE-ACI-AUTO-PAY-DATE',
           INVOICE_GENERATED_DATE AS 'INVOICE-GENERATED-DATE',
           SUBSCRIBER_FIRST_NAME AS 'SUBSCRIBER-FIRST-NAME',
           SUBSCRIBER_MID_INTL AS 'SUBSCRIBER-MID-INTL',
           SUBSCRIBER_LAST_NAME AS 'SUBSCRIBER-LAST-NAME',
           SUBSCRIBER_ADDR_CARE_OF_FIRST_NAME AS 'SUBSCRIBER-ADDR-CARE-OF-FIRST-NAME',
           SUBSCRIBER_ADDR_CARE_OF_MID_NAME AS 'SUBSCRIBER-ADDR-CARE-OF-MID-NAME',
           SUBSCRIBER_ADDR_CARE_OF_LAST_NAME AS 'SUBSCRIBER-ADDR-CARE-OF-LAST-NAME',
           SUBSCRIBER_ADDR_ADDR_LN1 AS 'SUBSCRIBER-ADDR-ADDR-LN1',
           SUBSCRIBER_ADDR_ADDR_LN2 AS 'SUBSCRIBER-ADDR-ADDR-LN2',
           SUBSCRIBER_ADDR_ADDR_CITY AS 'SUBSCRIBER-ADDR-ADDR-CITY',
           SUBSCRIBER_ADDR_ADDR_STATE_CD AS 'SUBSCRIBER-ADDR-ADDR-STATE-CD',
           SUBSCRIBER_ADDR_ADDR_ZIP_CD AS 'SUBSCRIBER-ADDR-ADDR-ZIP-CD',
           SUBSCRIBER_ADDR_ADDR_ZIP_CD_PLUS4 AS 'SUBSCRIBER-ADDR-ADDR-ZIP-CD-PLUS4' ) )
    )
--select * from HEADER_COMPARE;
    ,SECONDARY_COMPARE AS (
      SELECT KPMC_TRANSACTION_ID,
             BILL_ID,
             REGION,
             BATCH_NBR,
             'SECONDARY' AS ENTITY_TYPE,
             ENTITY_KEY,
             FIELD_NAME,
             FIELD_VALUE
        FROM (
        SELECT KPMC_TRANSACTION_ID,
               SR.BILL_ID,
               BATCH_NBR,
               TRIM(REGION) AS REGION,
               COALESCE(
                 NULLIF(
                   TRIM(SECONDARY_MRN_SUFFIX),
                   ''
                 ),
                 TO_CHAR(SECONDARY_SEQ)
               ) AS ENTITY_KEY,
               TRIM(SECONDARY_PARENT_BILLING_UNIT) AS SECONDARY_PARENT_BILLING_UNIT,
               TO_CHAR(
                 TO_NUMBER(SECONDARY_SUB_TOTAL_AMOUNT),
                 'FM9999999990D00'
               ) AS SECONDARY_SUB_TOTAL_AMOUNT,
               TRIM(SECONDARY_CONTRACT_OPTION_NAME) AS SECONDARY_CONTRACT_OPTION_NAME,
               TRIM(SECONDARY_FAMILY_ACCOUNT_NO) AS SECONDARY_FAMILY_ACCOUNT_NO,
               TRIM(SECONDARY_MRN_SUFFIX) AS SECONDARY_MRN_SUFFIX
          FROM SECONDARY_ROWS SR
          JOIN BILLING_OWNER.CM_EXTR_STM_DTL CESD
        ON CESD.BILL_ID = SR.BILL_ID
           AND CESD.CM_PRIM_BILL_SW = 'N'
      ) UNPIVOT INCLUDE NULLS ( FIELD_VALUE
        FOR FIELD_NAME
      IN ( SECONDARY_PARENT_BILLING_UNIT AS 'SECONDARY-PARENT-BILLING-UNIT',
           SECONDARY_SUB_TOTAL_AMOUNT AS 'SECONDARY-SUB-TOTAL-AMOUNT',
           SECONDARY_CONTRACT_OPTION_NAME AS 'SECONDARY-CONTRACT-OPTION-NAME',
           SECONDARY_FAMILY_ACCOUNT_NO AS 'SECONDARY-FAMILY-ACCOUNT-NO',
           SECONDARY_MRN_SUFFIX AS 'SECONDARY-MRN-SUFFIX' ) )
    )
--select * from SECONDARY_COMPARE;
    ,SUBSCRIBER_COMPARE AS (
      SELECT KPMC_TRANSACTION_ID,
             BILL_ID,
             REGION,
             BATCH_NBR,
             'SUBSCRIBER' AS ENTITY_TYPE,
             SUBSCRIBER_KEY AS ENTITY_KEY,
             FIELD_NAME,
             FIELD_VALUE
        FROM (
        SELECT KPMC_TRANSACTION_ID,
               BILL_ID,
               BATCH_NBR,
               TRIM(REGION) AS REGION,
               SUBSCRIBER_KEY,
               TO_CHAR(
                 TO_DATE(ACTIVITY_START_DATE,
                       'MM/DD/YYYY'),
                 'YYYY-MM-DD'
               ) AS ACTIVITY_START_DATE,
               TO_CHAR(
                 TO_DATE(ACTIVITY_END_DATE,
                       'MM/DD/YYYY'),
                 'YYYY-MM-DD'
               ) AS ACTIVITY_END_DATE,
               TO_CHAR(
                 TO_DATE(COVERAGE_THROUGH_MONTH_DETAIL,
                       'MM/DD/YYYY'),
                 'YYYY-MM-DD'
               ) AS COVERAGE_THROUGH_MONTH_DETAIL,
               TO_CHAR(
                 TO_NUMBER(BEGINNING_BALANCE),
                 'FM9999999990D00'
               ) AS BEGINNING_BALANCE,
               TO_CHAR(
                 TO_NUMBER(PAYMENTS_AMOUNT),
                 'FM9999999990D00'
               ) AS PAYMENTS_AMOUNT,
               TO_CHAR(
                 TO_NUMBER(REMITTANCE_REVERSAL_AMOUNT),
                 'FM9999999990D00'
               ) AS REMITTANCE_REVERSAL_AMOUNT,
               TO_CHAR(
                 TO_NUMBER(MED_NON_SUP_PREM_AMOUNT),
                 'FM9999999990D00'
               ) AS MED_NON_SUP_PREM_AMOUNT,
               TO_CHAR(
                 TO_NUMBER(ADJUSTMENT_AMOUNT),
                 'FM9999999990D00'
               ) AS ADJUSTMENT_AMOUNT,
               TO_CHAR(
                 TO_NUMBER(SUB_TOTAL),
                 'FM9999999990D00'
               ) AS SUB_TOTAL,
               TO_CHAR(
                 TO_NUMBER(CURRENT_RETIREE_SUBSIDY_AMOUNT),
                 'FM9999999990D00'
               ) AS CURRENT_RETIREE_SUBSIDY_AMOUNT,
               TO_CHAR(
                 TO_NUMBER(CURRENT_SPDAP_AMOUNT),
                 'FM9999999990D00'
               ) AS CURRENT_SPDAP_AMOUNT,
               TO_CHAR(
                 TO_NUMBER(CURRENT_DUES_LEP_AMOUNT),
                 'FM9999999990D00'
               ) AS CURRENT_DUES_LEP_AMOUNT,
               TO_CHAR(
                 TO_NUMBER(CURRENT_DUES_LIS_AMOUNT),
                 'FM9999999990D00'
               ) AS CURRENT_DUES_LIS_AMOUNT,
               TO_CHAR(
                 TO_NUMBER(RETROACTIVE_DUES_LEP_AMOUNT),
                 'FM9999999990D00'
               ) AS RETROACTIVE_DUES_LEP_AMOUNT,
               TO_CHAR(
                 TO_NUMBER(RETROACTIVE_LIS_AMOUNT),
                 'FM9999999990D00'
               ) AS RETROACTIVE_LIS_AMOUNT,
               TO_CHAR(
                 TO_NUMBER(RETROACTIVE_RETIREE_SUBSIDY_AMOUNT),
                 'FM9999999990D00'
               ) AS RETROACTIVE_RETIREE_SUBSIDY_AMOUNT,
               TO_CHAR(
                 TO_NUMBER(RETROACTIVE_SPDAP_AMOUNT),
                 'FM9999999990D00'
               ) AS RETROACTIVE_SPDAP_AMOUNT
          FROM SUBSCRIBER_ROWS
      ) UNPIVOT INCLUDE NULLS ( FIELD_VALUE
        FOR FIELD_NAME
      IN ( ACTIVITY_START_DATE AS 'ACTIVITY-START-DATE',
           ACTIVITY_END_DATE AS 'ACTIVITY-END-DATE',
           COVERAGE_THROUGH_MONTH_DETAIL AS 'COVERAGE-THROUGH-MONTH-DETAIL',
           BEGINNING_BALANCE AS 'BEGINNING-BALANCE',
           PAYMENTS_AMOUNT AS 'PAYMENTS-AMOUNT',
           REMITTANCE_REVERSAL_AMOUNT AS 'REMITTANCE-REVERSAL-AMOUNT',
           MED_NON_SUP_PREM_AMOUNT AS 'MED-NON-SUP-PREM-AMOUNT',
           ADJUSTMENT_AMOUNT AS 'ADJUSTMENT-AMOUNT',
           SUB_TOTAL AS 'SUB-TOTAL',
           CURRENT_RETIREE_SUBSIDY_AMOUNT AS 'CURRENT-RETIREE-SUBSIDY-AMOUNT',
           CURRENT_SPDAP_AMOUNT AS 'CURRENT-SPDAP-AMOUNT',
           CURRENT_DUES_LEP_AMOUNT AS 'CURRENT-DUES-LEP-AMOUNT',
           CURRENT_DUES_LIS_AMOUNT AS 'CURRENT-DUES-LIS-AMOUNT',
           RETROACTIVE_DUES_LEP_AMOUNT AS 'RETROACTIVE-DUES-LEP-AMOUNT',
           RETROACTIVE_LIS_AMOUNT AS 'RETROACTIVE-LIS-AMOUNT',
           RETROACTIVE_RETIREE_SUBSIDY_AMOUNT AS 'RETROACTIVE-RETIREE-SUBSIDY-AMOUNT',
           RETROACTIVE_SPDAP_AMOUNT AS 'RETROACTIVE-SPDAP-AMOUNT' ) )
    )
--select * from SUBSCRIBER_COMPARE;
    ,PAST_DUE_COMPARE AS (
      SELECT KPMC_TRANSACTION_ID,
             BILL_ID,
             REGION,
             BATCH_NBR,
             'PAST_DUE' AS ENTITY_TYPE,
             ENTITY_KEY,
             FIELD_NAME,
             FIELD_VALUE
        FROM (
        SELECT KPMC_TRANSACTION_ID,
               BILL_ID,
               BATCH_NBR,
               TRIM(REGION) AS REGION,
               SUBSCRIBER_KEY
               || ':'
               || NVL(
                 SUBSTR(
                   TO_CHAR(
                     TO_DATE(PAST_DUE_COVERAGE_PERIOD,
                           'MM/DD/YYYY'),
                     'YYYY-MM-DD'
                   ),
                   1,
                   7
                 ),
                 'NULL'
               ) AS ENTITY_KEY,
               TO_CHAR(
                 TO_DATE(PAST_DUE_COVERAGE_PERIOD,
                       'MM/DD/YYYY'),
                 'YYYY-MM-DD'
               ) AS PAST_DUE_COVERAGE_PERIOD,
               TO_CHAR(
                 TO_DATE(PAST_DUE_DUE_DATE,
                       'MM/DD/YYYY'),
                 'YYYY-MM-DD'
               ) AS PAST_DUE_DUE_DATE,
               TO_CHAR(
                 TO_NUMBER(PAST_DUE_AMOUNT),
                 'FM9999999990D00'
               ) AS PAST_DUE_AMOUNT
          FROM PAST_DUE_ROWS
      ) UNPIVOT INCLUDE NULLS ( FIELD_VALUE
        FOR FIELD_NAME
      IN ( PAST_DUE_COVERAGE_PERIOD AS 'PAST-DUE-COVERAGE-PERIOD',
           PAST_DUE_DUE_DATE AS 'PAST-DUE-DUE-DATE',
           PAST_DUE_AMOUNT AS 'PAST-DUE-AMOUNT' ) )
    )
--select * from PAST_DUE_COMPARE;
    ,PAYMENTS_30_COMPARE AS (
      SELECT KPMC_TRANSACTION_ID,
             BILL_ID,
             REGION,
             BATCH_NBR,
             'PAYMENTS_30' AS ENTITY_TYPE,
             ENTITY_KEY,
             FIELD_NAME,
             FIELD_VALUE
        FROM (
        SELECT X.KPMC_TRANSACTION_ID,
               X.BILL_ID,
               X.BATCH_NBR,
               X.REGION,
               X.SUBSCRIBER_KEY
               || ':'
               || TO_CHAR(X.SORT_ITEM_SEQ) AS ENTITY_KEY,
               TO_CHAR(
                 X.PAY_DT,
                 'YYYY-MM-DD'
               ) AS PAYMENTS_30_DATE,
               TO_CHAR(
                 X.PAY_AMT,
                 'FM9999999990D00'
               ) AS PAYMENTS_30_AMOUNT
          FROM (
          SELECT P30.KPMC_TRANSACTION_ID,
                 P30.BILL_ID,
                 P30.BATCH_NBR,
                 TRIM(P30.REGION) AS REGION,
                 P30.SUBSCRIBER_KEY,
                 TO_DATE(P30.PAYMENTS_30_DATE,
                         'MM/DD/YYYY') AS PAY_DT,
                 TO_NUMBER(P30.PAYMENTS_30_AMOUNT) AS PAY_AMT,
                 ROW_NUMBER()
                 OVER(PARTITION BY P30.KPMC_TRANSACTION_ID,
                                   P30.BILL_ID,
                                   P30.SUBSCRIBER_KEY
                      ORDER BY TO_DATE(P30.PAYMENTS_30_DATE,
                 'MM/DD/YYYY'),
                               TO_NUMBER(P30.PAYMENTS_30_AMOUNT),
                               P30.ITEM_SEQ
                 ) AS SORT_ITEM_SEQ
            FROM PAYMENTS_30_ROWS P30
        ) X
      ) UNPIVOT INCLUDE NULLS ( FIELD_VALUE
        FOR FIELD_NAME
      IN ( PAYMENTS_30_DATE AS 'PAYMENTS-30-DATE',
           PAYMENTS_30_AMOUNT AS 'PAYMENTS-30-AMOUNT' ) )
    )

--select * from PAYMENTS_30_COMPARE;
    SELECT *
      FROM HEADER_COMPARE
    UNION ALL
    SELECT *
      FROM SECONDARY_COMPARE
    UNION ALL
    SELECT *
      FROM SUBSCRIBER_COMPARE
    UNION ALL
    SELECT *
      FROM PAST_DUE_COMPARE
    UNION ALL
    SELECT *
      FROM PAYMENTS_30_COMPARE
     ORDER BY 2,
              5;


  DECLARE
    V_INVOICES_MED NUMBER := SQL%ROWCOUNT;
  BEGIN
    SELECT COUNT(DISTINCT BILL_ID)
      INTO V_INVOICES_MED
      FROM COMPARE_OWNER.MEDICARE_CMP_SOURCE_MED_XML
     WHERE BATCH_NBR = V_BATCH_NBR;

    SET_RUN_STATUS(
      P_STATUS       => 'MED_CMP_SOURCE_XML INSERTION COMPLETED',
      P_STEP         => 'SOURCE MED INSERT',
      P_NEXT_STEP    => 'TARGET ORMB INSERT',
      P_INVOICES_MED => V_INVOICES_MED
    );
  END;

  CHECK_CANCELED;

  --------------------------------------------------------------------
  -- Load TARGET ORMB data (from ormb-ind-medicare_v2.0.sql)
  --------------------------------------------------------------------

  INSERT INTO COMPARE_OWNER.MEDICARE_CMP_TARGET_ORMB (
    BILL_ID,
    REGION,
    BATCH_NBR,
    ENTITY_TYPE,
    ENTITY_KEY,
    FIELD_NAME,
    FIELD_VALUE
  )
    WITH BILL_SCOPE AS (
      SELECT DISTINCT SBR.BATCH_NBR,
                      CES.BILL_ID,
                      CES.CM_PRIM_BILL_SW
        FROM BILLING_OWNER.CM_EXTR_STM_BATCH_RUN SBR
       INNER JOIN BILLING_OWNER.CM_EXTR_STM_DTL CES
      ON SBR.STM_ID = CES.STM_ID
         AND SBR.BATCH_NBR = V_BATCH_NBR
         AND SBR.BATCH_CD = 'CM-STMEX'
         AND SBR.CM_EXT_SEQ_NUM = (
        SELECT MAX(SBR1.CM_EXT_SEQ_NUM)
          FROM BILLING_OWNER.CM_EXTR_STM_BATCH_RUN SBR1
         WHERE SBR1.STM_ID = SBR.STM_ID
      )
         AND CES.CM_EXT_SEQ_NUM = (
        SELECT MAX(CES1.CM_EXT_SEQ_NUM)
          FROM BILLING_OWNER.CM_EXTR_STM_DTL CES1
         WHERE CES1.STM_ID = CES.STM_ID
           AND CES1.BILL_ID = CES.BILL_ID
      )
       INNER JOIN BILLING_OWNER.CI_ACCT ACT
      ON ACT.ACCT_ID = CES.ACCT_ID
         AND ACT.CIS_DIVISION = 'GOV'
       INNER JOIN BILLING_OWNER.CM_EXTR_STM STM
      ON STM.STM_ID = SBR.STM_ID
         AND STM.CM_EXT_SEQ_NUM = (
        SELECT MAX(STM1.CM_EXT_SEQ_NUM)
          FROM BILLING_OWNER.CM_EXTR_STM STM1
         WHERE STM1.STM_ID = STM.STM_ID
      )
    )
--select * from BILL_SCOPE;
    ,SUB_PREM AS (
      SELECT BS.BILL_ID,
             NVL(
               SUM(CEBSPD.CM_TOT_COV_AMT),
               0
             ) AS CM_TOT_COV_AMT
        FROM BILL_SCOPE BS
       INNER JOIN BILLING_OWNER.CM_EXTR_BILL CEB
      ON BS.BILL_ID = CEB.BILL_ID
         AND CEB.CM_EXT_SEQ_NUM = (
        SELECT MAX(CEBS.CM_EXT_SEQ_NUM)
          FROM BILLING_OWNER.CM_EXTR_BILL CEBS
         WHERE CEBS.BILL_ID = CEB.BILL_ID
      )
        JOIN BILLING_OWNER.CM_EXTR_BILL_SUB_PREM_DTL CEBSPD
      ON CEBSPD.BILL_ID = CEB.BILL_ID
         AND CEB.CM_EXT_SEQ_NUM = CEBSPD.CM_EXT_SEQ_NUM
         AND CEBSPD.CM_RETRO_SW = 'Y'
       GROUP BY BS.BILL_ID
    )
--select * from SUB_PREM;
    ,TOT_ADJ AS (
      SELECT BS.BILL_ID,
             NVL(
               SUM(CEBSPC.TOT_AMT),
               0
             ) AS TOT_AMT
        FROM BILL_SCOPE BS
       INNER JOIN BILLING_OWNER.CM_EXTR_BILL CEB
      ON BS.BILL_ID = CEB.BILL_ID
         AND CEB.CM_EXT_SEQ_NUM = (
        SELECT MAX(CEBS.CM_EXT_SEQ_NUM)
          FROM BILLING_OWNER.CM_EXTR_BILL CEBS
         WHERE CEBS.BILL_ID = CEB.BILL_ID
      )
        LEFT JOIN BILLING_OWNER.CM_EXTR_BILL_SUB_PREM_CORR CEBSPC
      ON CEBSPC.BILL_ID = CEB.BILL_ID
         AND CEB.CM_EXT_SEQ_NUM = CEBSPC.CM_EXT_SEQ_NUM
         AND CEBSPC.CM_RETRO_SW = 'Y'
       GROUP BY BS.BILL_ID
    )
--select * from TOT_ADJ;
    ,ADJ_AMT AS (
      SELECT CEB.BILL_ID,
             NVL(
               SUM(SP.CM_TOT_COV_AMT),
               0
             ) + NVL(
               SUM(TA.TOT_AMT),
               0
--         ) + NVL(
--           SUM(CEBSND.CM_TOT_COV_AMT),
--           0
--         ) + NVL(
--           SUM(CEBSNC.TOT_AMT),
--           0
             ) AS OTHR_ADJ_AMT
        FROM BILL_SCOPE BS
       INNER JOIN BILLING_OWNER.CM_EXTR_BILL CEB
      ON BS.BILL_ID = CEB.BILL_ID
         AND CEB.CM_EXT_SEQ_NUM = (
        SELECT MAX(CEBS.CM_EXT_SEQ_NUM)
          FROM BILLING_OWNER.CM_EXTR_BILL CEBS
         WHERE CEBS.BILL_ID = CEB.BILL_ID
      )
       INNER JOIN BILLING_OWNER.CM_EXTR_BILL_ACCT CEBA
      ON CEB.BILL_ID = CEBA.BILL_ID
         AND CEB.CM_EXT_SEQ_NUM = CEBA.CM_EXT_SEQ_NUM
        LEFT JOIN SUB_PREM SP
      ON CEB.BILL_ID = SP.BILL_ID
        LEFT JOIN TOT_ADJ TA
      ON CEB.BILL_ID = TA.BILL_ID
       GROUP BY CEB.BILL_ID
    )
--select * from ADJ_AMT;
    ,BILL_LATEST AS (
      SELECT X.BILL_ID,
             X.BATCH_NBR,
             X.CM_EXT_SEQ_NUM,
             X.BILL_DT,
             X.COV_START_DT,
             X.COV_END_DT,
             X.DUE_DT,
             X.ACCT_ID,
             X.CM_PRIM_BILL_SW,
             X.ACCT_NBR,
             X.REGION,
             X.LOB,
             X.PAID_FROM_DT,
             X.PAID_THROUGH_DT,
             X.CM_PREV_BAL,
             X.PAY_AMT,
             X.CM_CANC_PAY_AMT,
             X.CM_TOT_BAL_AMT,
             X.CM_MED_PREM_AMT,
             X.TOT_ADJ_AMT
        FROM (
        SELECT CEB.BILL_ID,
               BS.BATCH_NBR,
               CEB.CM_EXT_SEQ_NUM,
               CEB.BILL_DT,
               CEB.COV_START_DT,
               CEB.COV_END_DT,
               CEB.DUE_DT,
               CEBA.ACCT_ID,
               BS.CM_PRIM_BILL_SW,
               CEBA.ACCT_NBR,
               REGEXP_SUBSTR(
                 CEBA.ACCT_NBR,
                 '[^-]+',
                 1,
                 1
               ) AS REGION,
               CEBA.CUST_CL_CD AS LOB,
               CASE
                 WHEN CEB.CM_PREV_BILL_DT IS NOT NULL THEN
                   CEB.CM_PREV_BILL_DT
                 ELSE
                   ADD_MONTHS(
                     CEB.BILL_DT,
                     -1
                   )
               END PAID_FROM_DT,
               CEB.BILL_DT AS PAID_THROUGH_DT,
               CEBA.CM_PREV_BAL,
               CEBA.PAY_AMT,
               CEBA.CM_CANC_PAY_AMT,
               CEBA.CM_TOT_BAL_AMT,
               CEBA.CM_MED_PREM_AMT,
               CEBA.TOT_ADJ_AMT + OTHR_ADJ_AMT AS TOT_ADJ_AMT
          FROM BILL_SCOPE BS
         INNER JOIN BILLING_OWNER.CM_EXTR_BILL CEB
        ON BS.BILL_ID = CEB.BILL_ID
           AND CEB.CM_EXT_SEQ_NUM = (
          SELECT MAX(CEBS.CM_EXT_SEQ_NUM)
            FROM BILLING_OWNER.CM_EXTR_BILL CEBS
           WHERE CEBS.BILL_ID = CEB.BILL_ID
        )
         INNER JOIN BILLING_OWNER.CM_EXTR_BILL_ACCT CEBA
        ON CEB.BILL_ID = CEBA.BILL_ID
           AND CEB.CM_EXT_SEQ_NUM = CEBA.CM_EXT_SEQ_NUM
          LEFT JOIN ADJ_AMT AM
        ON AM.BILL_ID = CEB.BILL_ID
      ) X
    )
--select * from BILL_LATEST;
    ,PLAN_CVRG_ID AS (
      SELECT BL.BILL_ID,
             BL.CM_EXT_SEQ_NUM,
             BL.ACCT_ID,
             MM.MEMBERSHIP_ID,
             MM.POLICY_ID,
             MM.PLAN_ID,
             SUBSTR(
               CI.EXT_MEMBER_ID,
               5
             ) COVERAGE_ID,
             ROW_NUMBER()
             OVER(PARTITION BY BL.BILL_ID
                  ORDER BY MM.MEMBERSHIP_ID
             ) AS RN
        FROM BILL_LATEST BL
       INNER JOIN BILLING_OWNER.CM_EXTR_BILL_SUB_MEM MM
      ON BL.BILL_ID = MM.BILL_ID
         AND MM.CM_EXT_SEQ_NUM = BL.CM_EXT_SEQ_NUM
         AND UPPER(TRIM(MM.SA_REL_TYPE_CD)) IN ( 'SB',
                                                 'NCS' )
       INNER JOIN BILLING_OWNER.CI_MEMBERSHIP CI
      ON MM.MEMBERSHIP_ID = CI.MEMBERSHIP_ID
         AND MM.PLAN_ID = CI.PLAN_ID
         AND MM.POLICY_ID = CI.POLICY_ID
         AND CI.BO_STATUS_CD <> 'CANCEL'
    )
---select * from PLAN_CVRG_ID;
    ,SUB_INFO AS (
      SELECT PCI.BILL_ID,
             PCI.CM_EXT_SEQ_NUM,
             PCI.ACCT_ID,
             PCI.MEMBERSHIP_ID,
             PCI.POLICY_ID,
             PCI.PLAN_ID,
             PCI.COVERAGE_ID,
             TPC.PERSON_ID,
             TP.FIRST_NAME AS SUBSCRIBER_FIRST_NAME,
             TP.MIDDLE_NAME AS SUBSCRIBER_MID_INTL,
             TP.LAST_NAME AS SUBSCRIBER_LAST_NAME,
             TPCA.AFFILIATED_PERSON_FIRST_NAME AS SUBSCRIBER_ADDR_CARE_OF_FIRST_NAME,
             TPCA.AFFILIATED_PERSON_MIDDLE_NAME AS SUBSCRIBER_ADDR_CARE_OF_MID_NAME,
             TPCA.AFFILIATED_PERSON_LAST_NAME AS SUBSCRIBER_ADDR_CARE_OF_LAST_NAME
        FROM PLAN_CVRG_ID PCI
        LEFT JOIN MEMBER_USER.TAP_PERSON_COVERAGE TPC
      ON PCI.COVERAGE_ID = TPC.COVERAGE_ID
        LEFT JOIN MEMBER_USER.TAP_PERSON TP
      ON TPC.PERSON_ID = TP.PERSON_ID
        LEFT JOIN MEMBER_USER.TAP_PERSON_COVERAGE_AFFILIATION TPCA
      ON PCI.COVERAGE_ID = TPCA.COVERAGE_ID
    )
--select * from sub_info;
    ,PERSON_ADDR_BEST AS (
    /* Ranks only TEMPORARY (2), PERMANENT (3), MAILING (4) per person */
      SELECT PERSON_ID,
             ADDRESS_LINE_1,
             ADDRESS_LINE_2,
             CITY,
             STATE_CODE,
             POSTAL_CODE,
             ROW_NUMBER()
             OVER(PARTITION BY PERSON_ID
                  ORDER BY
                   CASE ADDRESS_TYPE_CODE
                     WHEN 'TEMPORARY' THEN
                       2
                     WHEN 'PERMANENT' THEN
                       3
                     WHEN 'MAILING'   THEN
                       4
                   END
                 ASC
             ) AS RN
        FROM MEMBER_USER.TAP_PERSON_ADDRESS
       WHERE ADDRESS_TYPE_CODE IN ( 'TEMPORARY',
                                    'PERMANENT',
                                    'MAILING' )
         AND PERSON_ID IN (
        SELECT PERSON_ID
          FROM SUB_INFO
         WHERE PERSON_ID IS NOT NULL
      )
    ),SUB_ADDRESS_RAW AS (
      SELECT SI.BILL_ID,
             SI.CM_EXT_SEQ_NUM,
             SI.COVERAGE_ID,
             SI.PERSON_ID,
           /* Priority: 1 (Bill) -> 2,3,4 (Person) -> 5 (Coverage) */
             COALESCE(
               BA.ADDRESS1,
               PA.ADDRESS_LINE_1,
               CA.ADDRESS_LINE_1
             ) AS SUBSCRIBER_ADDR_ADDR_LN1,
             COALESCE(
               BA.ADDRESS2,
               PA.ADDRESS_LINE_2,
               CA.ADDRESS_LINE_2
             ) AS SUBSCRIBER_ADDR_ADDR_LN2,
             COALESCE(
               BA.CITY,
               PA.CITY,
               CA.CITY
             ) AS SUBSCRIBER_ADDR_ADDR_CITY,
             COALESCE(
               BA.STATE,
               PA.STATE_CODE,
               CA.STATE_CODE
             ) AS SUBSCRIBER_ADDR_ADDR_STATE_CD,
             COALESCE(
               BA.POSTAL,
               PA.POSTAL_CODE,
               CA.POSTAL_CODE
             ) AS POSTAL_CODE,
             ROW_NUMBER()
             OVER(PARTITION BY SI.BILL_ID,
                               SI.CM_EXT_SEQ_NUM
                  ORDER BY
                   CASE
                     WHEN BA.BILL_ID IS NOT NULL THEN
                       1
                     WHEN PA.PERSON_ID IS NOT NULL THEN
                       2
                     WHEN CA.COVERAGE_ID IS NOT NULL THEN
                       5
                     ELSE
                       9
                   END
                 ASC
             ) AS RN
        FROM SUB_INFO SI
      /* Priority 1: Billing Address */
        LEFT JOIN BILLING_OWNER.CM_EXTR_BILL_ADDR BA
      ON BA.BILL_ID = SI.BILL_ID
         AND BA.CM_EXT_SEQ_NUM = SI.CM_EXT_SEQ_NUM
         AND BA.ADDRESS_TYPE_FLG = 'BILL'
      /* Priority 2, 3, 4: Person Address (only if Billing Address is missing) */
        LEFT JOIN PERSON_ADDR_BEST PA
      ON PA.PERSON_ID = SI.PERSON_ID
         AND PA.RN = 1
         AND BA.BILL_ID IS NULL
      /* Priority 5: Subscriber Coverage Address (only if both Bill and Person are missing) */
        LEFT JOIN MEMBER_USER.TAP_COVERAGE_ADDRESS CA
      ON CA.COVERAGE_ID = SI.COVERAGE_ID
         AND CA.ADDRESS_TYPE_CODE = 'SUBSCRIBER'
         AND BA.BILL_ID IS NULL
         AND PA.PERSON_ID IS NULL
    ),SUB_ADDRESS AS (
      SELECT BILL_ID,
             CM_EXT_SEQ_NUM,
             COVERAGE_ID,
             PERSON_ID,
             SUBSCRIBER_ADDR_ADDR_LN1,
             SUBSCRIBER_ADDR_ADDR_LN2,
             SUBSCRIBER_ADDR_ADDR_CITY,
             SUBSCRIBER_ADDR_ADDR_STATE_CD,
             CASE
               WHEN INSTR(
                 POSTAL_CODE,
                 '-',
                 1
               ) > 0 THEN
                 SUBSTR(
                   POSTAL_CODE,
                   1,
                   INSTR(
                     POSTAL_CODE,
                     '-',
                     1,
                     1
                   ) - 1
                 )
               ELSE
                 POSTAL_CODE
             END AS SUBSCRIBER_ADDR_ADDR_ZIP_CD,
             CASE
               WHEN INSTR(
                 POSTAL_CODE,
                 '-',
                 1
               ) > 0 THEN
                 SUBSTR(
                   POSTAL_CODE,
                   INSTR(
                     POSTAL_CODE,
                     '-',
                     1,
                     1
                   ) + 1
                 )
             END AS SUBSCRIBER_ADDR_ADDR_ZIP_CD_PLUS4
        FROM SUB_ADDRESS_RAW
       WHERE RN = 1
    )
--SELECT * FROM sub_address;
    ,STM_AGG AS (
      SELECT X.BILL_ID,
             X.BILL_DT AS STATEMENT_DT,
             X.CM_TOT_BAL_AMT AS STATEMENT_TOTAL_BALANCE
        FROM (
        SELECT CES.BILL_ID,
               STM.BILL_DT,
               STM.CM_TOT_BAL_AMT,
               ROW_NUMBER()
               OVER(PARTITION BY CES.BILL_ID
                    ORDER BY SBR.CM_EXT_SEQ_NUM DESC,
                             CES.CM_EXT_SEQ_NUM DESC,
                             STM.CM_EXT_SEQ_NUM DESC
               ) AS RN
          FROM BILL_LATEST BL
         INNER JOIN BILLING_OWNER.CM_EXTR_STM_BATCH_RUN SBR
        ON SBR.BATCH_NBR = BL.BATCH_NBR
           AND SBR.BATCH_CD = 'CM-STMEX'
         INNER JOIN BILLING_OWNER.CM_EXTR_STM_DTL CES
        ON CES.STM_ID = SBR.STM_ID
           AND CES.BILL_ID = BL.BILL_ID
           AND CES.CM_EXT_SEQ_NUM = (
          SELECT MAX(CES1.CM_EXT_SEQ_NUM)
            FROM BILLING_OWNER.CM_EXTR_STM_DTL CES1
           WHERE CES1.STM_ID = CES.STM_ID
             AND CES1.BILL_ID = CES.BILL_ID
        )
         INNER JOIN BILLING_OWNER.CM_EXTR_STM STM
        ON STM.STM_ID = SBR.STM_ID
           AND STM.CM_EXT_SEQ_NUM = (
          SELECT MAX(STM1.CM_EXT_SEQ_NUM)
            FROM BILLING_OWNER.CM_EXTR_STM STM1
           WHERE STM1.STM_ID = STM.STM_ID
        )
         INNER JOIN BILLING_OWNER.CI_ACCT ACT
        ON ACT.ACCT_ID = CES.ACCT_ID
           AND ACT.CIS_DIVISION = 'GOV'
         WHERE SBR.CM_EXT_SEQ_NUM = (
          SELECT MAX(SBR1.CM_EXT_SEQ_NUM)
            FROM BILLING_OWNER.CM_EXTR_STM_BATCH_RUN SBR1
           WHERE SBR1.STM_ID = SBR.STM_ID
        )
      ) X
       WHERE X.RN = 1
    )
--select * from STM_AGG;
    ,SUBSIDY_SRC AS (
      SELECT BL.BILL_ID,
             BL.CM_EXT_SEQ_NUM,
             EBSNPD.CHRG_DESCR,
             EBSNPD.CM_RETRO_SW,
             EBSNPD.CM_TOT_COV_AMT AS AMT
        FROM BILL_LATEST BL
       INNER JOIN BILLING_OWNER.CM_EXTR_BILL_SUB_NONPREM_DTL EBSNPD
      ON BL.BILL_ID = EBSNPD.BILL_ID
         AND BL.CM_EXT_SEQ_NUM = EBSNPD.CM_EXT_SEQ_NUM
      UNION ALL
      SELECT BL.BILL_ID,
             BL.CM_EXT_SEQ_NUM,
             EBSNPC.CHRG_DESCR,
             EBSNPC.CM_RETRO_SW,
             EBSNPC.TOT_AMT AS AMT
        FROM BILL_LATEST BL
       INNER JOIN BILLING_OWNER.CM_EXTR_BILL_SUB_NONPREM_CORR EBSNPC
      ON BL.BILL_ID = EBSNPC.BILL_ID
         AND BL.CM_EXT_SEQ_NUM = EBSNPC.CM_EXT_SEQ_NUM
    )
--select * from SUBSIDY_SRC;
    ,SUBSIDY_AGG AS (
      SELECT SS.BILL_ID,
             SS.CM_EXT_SEQ_NUM,
             SUM(
               CASE
                 WHEN SS.CHRG_DESCR = 'Retiree Subsidy'
                    AND SS.CM_RETRO_SW = 'N' THEN
                   NVL(
                     SS.AMT,
                     0
                   )
                 ELSE
                   0
               END
             ) AS RETIREE_SUBSIDY,
             SUM(
               CASE
                 WHEN SS.CHRG_DESCR = 'Retiree Subsidy'
                    AND SS.CM_RETRO_SW = 'Y' THEN
                   NVL(
                     SS.AMT,
                     0
                   )
                 ELSE
                   0
               END
             ) AS RETRO_RETIREE_SUBSIDY,
             SUM(
               CASE
                 WHEN SS.CHRG_DESCR = 'SPAP Subsidy'
                    AND SS.CM_RETRO_SW = 'N' THEN
                   NVL(
                     SS.AMT,
                     0
                   )
                 ELSE
                   0
               END
             ) AS SPAP_SUBSIDY,
             SUM(
               CASE
                 WHEN SS.CHRG_DESCR = 'SPAP Subsidy'
                    AND SS.CM_RETRO_SW = 'Y' THEN
                   NVL(
                     SS.AMT,
                     0
                   )
                 ELSE
                   0
               END
             ) AS RETRO_SPAP_SUBSIDY,
             SUM(
               CASE
                 WHEN SS.CHRG_DESCR IN('LIS SUBSIDY',
                                       'Low Income Subsidy')
                    AND SS.CM_RETRO_SW = 'N' THEN
                   NVL(
                     SS.AMT,
                     0
                   )
                 ELSE
                   0
               END
             ) AS LIS_AMT,
             SUM(
               CASE
                 WHEN SS.CHRG_DESCR IN('LIS SUBSIDY',
                                       'Low Income Subsidy')
                    AND SS.CM_RETRO_SW = 'Y' THEN
                   NVL(
                     SS.AMT,
                     0
                   )
                 ELSE
                   0
               END
             ) AS RETRO_LIS_AMT,
             SUM(
               CASE
                 WHEN SS.CHRG_DESCR IN('LEP FEE',
                                       'Late Enrollment Penalty')
                    AND SS.CM_RETRO_SW = 'N' THEN
                   NVL(
                     SS.AMT,
                     0
                   )
                 ELSE
                   0
               END
             ) AS LEP_AMT,
             SUM(
               CASE
                 WHEN SS.CHRG_DESCR IN('LEP FEE',
                                       'Late Enrollment Penalty')
                    AND SS.CM_RETRO_SW = 'Y' THEN
                   NVL(
                     SS.AMT,
                     0
                   )
                 ELSE
                   0
               END
             ) AS RETRO_LEP_AMT
        FROM SUBSIDY_SRC SS
       GROUP BY SS.BILL_ID,
                SS.CM_EXT_SEQ_NUM
    )
--select * from SUBSIDY_AGG;
    ,AUTOPAY_AGG AS (
      SELECT BL.BILL_ID,
             BL.CM_EXT_SEQ_NUM,
             MAX(EBAP.CM_APAY_SCH_DT) AS AUTOPAY_SCHEDULE_DATE,
             MAX(EBAP.CM_EXT_ACCT_ID_SBUSTR) AS AUTOPAY_ACCOUNT_ID
        FROM BILL_LATEST BL
        LEFT JOIN BILLING_OWNER.CM_EXTR_BILL_AUTOPAY EBAP
      ON BL.BILL_ID = EBAP.BILL_ID
         AND BL.CM_EXT_SEQ_NUM = EBAP.CM_EXT_SEQ_NUM
       GROUP BY BL.BILL_ID,
                BL.CM_EXT_SEQ_NUM
    )
--select * from AUTOPAY_AGG;
    ,PAY_AGG AS (
      SELECT BL.BILL_ID,
             BL.CM_EXT_SEQ_NUM,
             SUM(EBP.PAY_AMT) AS PAYMENT_TOTAL
        FROM BILL_LATEST BL
        LEFT JOIN BILLING_OWNER.CM_EXTR_BILL_PAY EBP
      ON BL.BILL_ID = EBP.BILL_ID
         AND BL.CM_EXT_SEQ_NUM = EBP.CM_EXT_SEQ_NUM
         AND EBP.PAY_STATUS_FLG != '60'
       GROUP BY BL.BILL_ID,
                BL.CM_EXT_SEQ_NUM
    )
--select * from PAY_AGG;
    ,MEMBER_RANKED AS (
      SELECT BS.BILL_ID,
             CM_PRIM_BILL_SW,
             SUBSTR(
               CM_MEM_RMRN,
               1,
               3
             ) AS REGION_CODE,
             SUBSTR(
               CM_MEM_RMRN,
               4
             ) AS F_SUBMRN,
             CASE SUBSTR(
               CM_MEM_RMRN,
               1,
               3
             )
               WHEN 'MAS' THEN
                 30
               WHEN 'KNW' THEN
                 10
               WHEN 'HAW' THEN
                 12
               WHEN 'COL' THEN
                 16
               WHEN 'WAS' THEN
                 35
               WHEN 'GEO' THEN
                 28
               ELSE
                 NULL
             END AS F_SUBMRN_PFIX
        FROM BILLING_OWNER.CM_EXTR_BILL_SUB_MEM CEBSM
        JOIN BILL_SCOPE BS
      ON BS.BILL_ID = CEBSM.BILL_ID
         AND CEBSM.CM_EXT_SEQ_NUM = (
        SELECT MAX(CM_EXT_SEQ_NUM)
          FROM BILLING_OWNER.CM_EXTR_BILL_SUB_MEM CEBSMS
         WHERE CEBSMS.BILL_ID = CEBSM.BILL_ID
           AND CEBSMS.SA_REL_TYPE_CD = 'SB'
      )
    )
--select * from MEMBER_RANKED;
    ,PRIMARY_MEMBER AS (
      SELECT BILL_ID,
             F_SUBMRN,
             F_SUBMRN_PFIX
        FROM MEMBER_RANKED
       WHERE CM_PRIM_BILL_SW = 'Y'
    )
--select * from PRIMARY_MEMBER;
    ,SECONDARY_MEMBER AS (
      SELECT BILL_ID,
             F_SUBMRN,
             F_SUBMRN_PFIX
        FROM MEMBER_RANKED
       WHERE CM_PRIM_BILL_SW = 'N'
    )
--select * from SECONDARY_MEMBER;
    ,PAST_DUE_DTL AS (
      SELECT BL.BILL_ID,
             BL.BATCH_NBR,
             BL.REGION,
             BL.ACCT_ID,
             EBO.CM_COV_PERIOD,
             EBO.DUE_DT,
             EBO.CM_BILL_UNPAID_AMT,
             ROW_NUMBER()
             OVER(PARTITION BY BL.BILL_ID
                  ORDER BY EBO.DUE_DT,
                           EBO.CM_BILL_UNPAID_AMT
             ) AS ITEM_SEQ
        FROM BILL_LATEST BL
       INNER JOIN BILLING_OWNER.CM_EXTR_BILL_OPEN EBO
      ON BL.BILL_ID = EBO.BILL_ID
         AND BL.CM_EXT_SEQ_NUM = EBO.CM_EXT_SEQ_NUM
    )
--select * from PAST_DUE_DTL;
    ,PAY_DTL AS (
      SELECT BL.BILL_ID,
             BL.BATCH_NBR,
             BL.REGION,
             BL.ACCT_ID,
             EBP.PAY_DT,
             EBP.PAY_AMT,
             ROW_NUMBER()
             OVER(PARTITION BY BL.BILL_ID
                  ORDER BY EBP.PAY_DT,
                           EBP.PAY_AMT
             ) AS ITEM_SEQ
        FROM BILL_LATEST BL
       INNER JOIN BILLING_OWNER.CM_EXTR_BILL_PAY EBP
      ON BL.BILL_ID = EBP.BILL_ID
         AND BL.CM_EXT_SEQ_NUM = EBP.CM_EXT_SEQ_NUM
         AND EBP.PAY_STATUS_FLG != '60'
    )
--select * from PAY_DTL;
    ,HEADER_COMPARE AS (
      SELECT BILL_ID,
             REGION,
             BATCH_NBR,
             'HEADER' AS ENTITY_TYPE,
             '0' AS ENTITY_KEY,
             FIELD_NAME,
             FIELD_VALUE
        FROM (
        SELECT BL.BILL_ID,
               BL.BATCH_NBR,
               BL.REGION,
               TO_CHAR(
                 NVL(
                   STA.STATEMENT_TOTAL_BALANCE,
                   BL.CM_TOT_BAL_AMT
                 ),
                 'FM9999999990D00'
               ) AS INVOICE_TOTAL_AMOUNT,
               TO_CHAR(
                 BL.COV_END_DT,
                 'YYYY-MM-DD'
               ) AS COVERAGE_THROUGH_MONTH,
               TO_CHAR(
                 BL.COV_END_DT,
                 'YYYY-MM-DD'
               ) AS COVERAGE_THROUGH_YEAR,
               TO_CHAR(
                 BL.DUE_DT,
                 'YYYY-MM-DD'
               ) AS INVOICE_SUMMARY_DUE_DATE,
               TRIM(TO_CHAR(BL.ACCT_ID)) AS ORMB_ACCT_ID,
               TO_CHAR(
                 BL.CM_TOT_BAL_AMT,
                 'FM9999999990D00'
               ) AS PRIMARY_SUB_TOTAL_AMOUNT,
               TRIM(PM.F_SUBMRN_PFIX) AS MRN_PREFIX,
               TRIM(PM.F_SUBMRN) AS MRN_SUFFIX,
               TRIM(APA.AUTOPAY_ACCOUNT_ID) AS INVOICE_ACI_ACCT_NB,
               CASE
                 WHEN TO_DATE(APA.AUTOPAY_SCHEDULE_DATE,
                 'YYYY-MM-DD') = DATE '4000-12-31' THEN
                   TO_CHAR(
                     BL.DUE_DT,
                     'YYYY-MM-DD'
                   )
                 WHEN TO_DATE(APA.AUTOPAY_SCHEDULE_DATE,
                   'YYYY-MM-DD') <> DATE '4000-12-31'
                    AND SUBSTR(
                   APA.AUTOPAY_SCHEDULE_DATE,
                   1,
                   4
                 ) = '4000' THEN
                   TO_CHAR(
                     BL.DUE_DT - EXTRACT(DAY FROM TO_DATE(APA.AUTOPAY_SCHEDULE_DATE,
                   'YYYY-MM-DD')),
                     'YYYY-MM-DD'
                   )
                 ELSE
                   TO_CHAR(
                     TO_DATE(APA.AUTOPAY_SCHEDULE_DATE,
                           'YYYY-MM-DD'),
                     'YYYY-MM-DD'
                   )
               END AS INVOICE_ACI_AUTO_PAY_DATE,
               TO_CHAR(
                 NVL(
                   STA.STATEMENT_DT,
                   BL.BILL_DT
                 ),
                 'YYYY-MM-DD'
               ) AS INVOICE_GENERATED_DATE,
               SI.SUBSCRIBER_FIRST_NAME,
               SI.SUBSCRIBER_MID_INTL,
               SI.SUBSCRIBER_LAST_NAME,
               SI.SUBSCRIBER_ADDR_CARE_OF_FIRST_NAME,
               SI.SUBSCRIBER_ADDR_CARE_OF_MID_NAME,
               SI.SUBSCRIBER_ADDR_CARE_OF_LAST_NAME,
               SA.SUBSCRIBER_ADDR_ADDR_LN1,
               SA.SUBSCRIBER_ADDR_ADDR_LN2,
               SA.SUBSCRIBER_ADDR_ADDR_CITY,
               SA.SUBSCRIBER_ADDR_ADDR_STATE_CD,
               SA.SUBSCRIBER_ADDR_ADDR_ZIP_CD,
               SA.SUBSCRIBER_ADDR_ADDR_ZIP_CD_PLUS4
          FROM BILL_LATEST BL
          LEFT JOIN SUB_INFO SI
        ON BL.BILL_ID = SI.BILL_ID
          LEFT JOIN SUB_ADDRESS SA
        ON BL.BILL_ID = SA.BILL_ID
          LEFT JOIN STM_AGG STA
        ON BL.BILL_ID = STA.BILL_ID
          LEFT JOIN AUTOPAY_AGG APA
        ON BL.BILL_ID = APA.BILL_ID
           AND BL.CM_EXT_SEQ_NUM = APA.CM_EXT_SEQ_NUM
          JOIN PRIMARY_MEMBER PM
        ON PM.BILL_ID = BL.BILL_ID
         WHERE BL.CM_PRIM_BILL_SW = 'Y'
      ) UNPIVOT INCLUDE NULLS ( FIELD_VALUE
        FOR FIELD_NAME
      IN ( INVOICE_TOTAL_AMOUNT AS 'INVOICE-TOTAL-AMOUNT',
           COVERAGE_THROUGH_MONTH AS 'COVERAGE-THROUGH-MONTH',
           COVERAGE_THROUGH_YEAR AS 'COVERAGE-THROUGH-YEAR',
           INVOICE_SUMMARY_DUE_DATE AS 'INVOICE-SUMMARY-DUE-DATE',
           ORMB_ACCT_ID AS 'ORMB-ACCT-ID',
           PRIMARY_SUB_TOTAL_AMOUNT AS 'PRIMARY-SUB-TOTAL-AMOUNT',
           MRN_PREFIX AS 'MRN-PREFIX',
           MRN_SUFFIX AS 'MRN-SUFFIX',
           INVOICE_ACI_ACCT_NB AS 'INVOICE-ACI-ACCT-NB',
           INVOICE_ACI_AUTO_PAY_DATE AS 'INVOICE-ACI-AUTO-PAY-DATE',
           INVOICE_GENERATED_DATE AS 'INVOICE-GENERATED-DATE',
           SUBSCRIBER_FIRST_NAME AS 'SUBSCRIBER-FIRST-NAME',
           SUBSCRIBER_MID_INTL AS 'SUBSCRIBER-MID-INTL',
           SUBSCRIBER_LAST_NAME AS 'SUBSCRIBER-LAST-NAME',
           SUBSCRIBER_ADDR_CARE_OF_FIRST_NAME AS 'SUBSCRIBER-ADDR-CARE-OF-FIRST-NAME',
           SUBSCRIBER_ADDR_CARE_OF_MID_NAME AS 'SUBSCRIBER-ADDR-CARE-OF-MID-NAME',
           SUBSCRIBER_ADDR_CARE_OF_LAST_NAME AS 'SUBSCRIBER-ADDR-CARE-OF-LAST-NAME',
           SUBSCRIBER_ADDR_ADDR_LN1 AS 'SUBSCRIBER-ADDR-ADDR-LN1',
           SUBSCRIBER_ADDR_ADDR_LN2 AS 'SUBSCRIBER-ADDR-ADDR-LN2',
           SUBSCRIBER_ADDR_ADDR_CITY AS 'SUBSCRIBER-ADDR-ADDR-CITY',
           SUBSCRIBER_ADDR_ADDR_STATE_CD AS 'SUBSCRIBER-ADDR-ADDR-STATE-CD',
           SUBSCRIBER_ADDR_ADDR_ZIP_CD AS 'SUBSCRIBER-ADDR-ADDR-ZIP-CD',
           SUBSCRIBER_ADDR_ADDR_ZIP_CD_PLUS4 AS 'SUBSCRIBER-ADDR-ADDR-ZIP-CD-PLUS4' ) )
    )
--select * from HEADER_COMPARE;
    ,SUBSCRIBER_COMPARE AS (
      SELECT BILL_ID,
             REGION,
             BATCH_NBR,
             'SUBSCRIBER' AS ENTITY_TYPE,
             ENTITY_KEY,
             FIELD_NAME,
             FIELD_VALUE
        FROM (
        SELECT BL.BILL_ID,
               BL.BATCH_NBR,
               BL.REGION,
               COALESCE(
                 TRIM(TO_CHAR(BL.ACCT_ID)),
                 TRIM(PM.F_SUBMRN)
               ) AS ENTITY_KEY,
               TO_CHAR(
                 BL.PAID_FROM_DT,
                 'YYYY-MM-DD'
               ) AS ACTIVITY_START_DATE,
               TO_CHAR(
                 BL.PAID_THROUGH_DT,
                 'YYYY-MM-DD'
               ) AS ACTIVITY_END_DATE,
               TO_CHAR(
                 BL.COV_END_DT,
                 'YYYY-MM-DD'
               ) AS COVERAGE_THROUGH_MONTH_DETAIL,
               TO_CHAR(
                 BL.CM_PREV_BAL,
                 'FM9999999990D00'
               ) AS BEGINNING_BALANCE,
               TO_CHAR(
                 NVL(
                   PA.PAYMENT_TOTAL,
                   BL.PAY_AMT
                 ),
                 'FM9999999990D00'
               ) AS PAYMENTS_AMOUNT,
               TO_CHAR(
                 BL.CM_CANC_PAY_AMT,
                 'FM9999999990D00'
               ) AS REMITTANCE_REVERSAL_AMOUNT,
               TO_CHAR(
                 BL.CM_MED_PREM_AMT,
                 'FM9999999990D00'
               ) AS MED_NON_SUP_PREM_AMOUNT,
               TO_CHAR(
                 BL.TOT_ADJ_AMT,
                 'FM9999999990D00'
               ) AS ADJUSTMENT_AMOUNT,
               TO_CHAR(
                 BL.CM_TOT_BAL_AMT,
                 'FM9999999990D00'
               ) AS SUB_TOTAL,
               TO_CHAR(
                 NVL(
                   SA.RETIREE_SUBSIDY,
                   0
                 ),
                 'FM9999999990D00'
               ) AS CURRENT_RETIREE_SUBSIDY_AMOUNT,
               TO_CHAR(
                 NVL(
                   SA.SPAP_SUBSIDY,
                   0
                 ),
                 'FM9999999990D00'
               ) AS CURRENT_SPDAP_AMOUNT,
               TO_CHAR(
                 NVL(
                   SA.LEP_AMT,
                   0
                 ),
                 'FM9999999990D00'
               ) AS CURRENT_DUES_LEP_AMOUNT,
               TO_CHAR(
                 NVL(
                   SA.LIS_AMT,
                   0
                 ),
                 'FM9999999990D00'
               ) AS CURRENT_DUES_LIS_AMOUNT,
               TO_CHAR(
                 NVL(
                   SA.RETRO_LEP_AMT,
                   0
                 ),
                 'FM9999999990D00'
               ) AS RETROACTIVE_DUES_LEP_AMOUNT,
               TO_CHAR(
                 NVL(
                   SA.RETRO_LIS_AMT,
                   0
                 ),
                 'FM9999999990D00'
               ) AS RETROACTIVE_LIS_AMOUNT,
               TO_CHAR(
                 NVL(
                   SA.RETRO_RETIREE_SUBSIDY,
                   0
                 ),
                 'FM9999999990D00'
               ) AS RETROACTIVE_RETIREE_SUBSIDY_AMOUNT,
               TO_CHAR(
                 NVL(
                   SA.RETRO_SPAP_SUBSIDY,
                   0
                 ),
                 'FM9999999990D00'
               ) AS RETROACTIVE_SPDAP_AMOUNT
          FROM BILL_LATEST BL
          LEFT JOIN PRIMARY_MEMBER PM
        ON PM.BILL_ID = BL.BILL_ID
          LEFT JOIN SUBSIDY_AGG SA
        ON SA.BILL_ID = BL.BILL_ID
           AND SA.CM_EXT_SEQ_NUM = BL.CM_EXT_SEQ_NUM
          LEFT JOIN PAY_AGG PA
        ON PA.BILL_ID = BL.BILL_ID
           AND PA.CM_EXT_SEQ_NUM = BL.CM_EXT_SEQ_NUM
      ) UNPIVOT INCLUDE NULLS ( FIELD_VALUE
        FOR FIELD_NAME
      IN ( ACTIVITY_START_DATE AS 'ACTIVITY-START-DATE',
           ACTIVITY_END_DATE AS 'ACTIVITY-END-DATE',
           COVERAGE_THROUGH_MONTH_DETAIL AS 'COVERAGE-THROUGH-MONTH-DETAIL',
           BEGINNING_BALANCE AS 'BEGINNING-BALANCE',
           PAYMENTS_AMOUNT AS 'PAYMENTS-AMOUNT',
           REMITTANCE_REVERSAL_AMOUNT AS 'REMITTANCE-REVERSAL-AMOUNT',
           MED_NON_SUP_PREM_AMOUNT AS 'MED-NON-SUP-PREM-AMOUNT',
           ADJUSTMENT_AMOUNT AS 'ADJUSTMENT-AMOUNT',
           SUB_TOTAL AS 'SUB-TOTAL',
           CURRENT_RETIREE_SUBSIDY_AMOUNT AS 'CURRENT-RETIREE-SUBSIDY-AMOUNT',
           CURRENT_SPDAP_AMOUNT AS 'CURRENT-SPDAP-AMOUNT',
           CURRENT_DUES_LEP_AMOUNT AS 'CURRENT-DUES-LEP-AMOUNT',
           CURRENT_DUES_LIS_AMOUNT AS 'CURRENT-DUES-LIS-AMOUNT',
           RETROACTIVE_DUES_LEP_AMOUNT AS 'RETROACTIVE-DUES-LEP-AMOUNT',
           RETROACTIVE_LIS_AMOUNT AS 'RETROACTIVE-LIS-AMOUNT',
           RETROACTIVE_RETIREE_SUBSIDY_AMOUNT AS 'RETROACTIVE-RETIREE-SUBSIDY-AMOUNT',
           RETROACTIVE_SPDAP_AMOUNT AS 'RETROACTIVE-SPDAP-AMOUNT' ) )
    ),SECONDARY_COMPARE AS (
      SELECT BILL_ID,
             REGION,
             BATCH_NBR,
             'SECONDARY' AS ENTITY_TYPE,
             ENTITY_KEY,
             FIELD_NAME,
             FIELD_VALUE
        FROM (
        SELECT BL.BILL_ID,
               BL.BATCH_NBR,
               BL.REGION,
               TRIM(SM.F_SUBMRN) AS ENTITY_KEY,
               TRIM(TO_CHAR(BL.ACCT_ID)) AS SECONDARY_PARENT_BILLING_UNIT,
               TO_CHAR(
                 BL.CM_TOT_BAL_AMT,
                 'FM9999999990D00'
               ) AS SECONDARY_SUB_TOTAL_AMOUNT,
               TRIM(SM.F_SUBMRN_PFIX) AS SECONDARY_FAMILY_ACCOUNT_NO,
               TRIM(SM.F_SUBMRN) AS SECONDARY_MRN_SUFFIX
          FROM BILL_LATEST BL
         INNER JOIN SECONDARY_MEMBER SM
        ON SM.BILL_ID = BL.BILL_ID
      ) UNPIVOT INCLUDE NULLS ( FIELD_VALUE
        FOR FIELD_NAME
      IN ( SECONDARY_PARENT_BILLING_UNIT AS 'SECONDARY-PARENT-BILLING-UNIT',
           SECONDARY_SUB_TOTAL_AMOUNT AS 'SECONDARY-SUB-TOTAL-AMOUNT',
           SECONDARY_FAMILY_ACCOUNT_NO AS 'SECONDARY-FAMILY-ACCOUNT-NO',
           SECONDARY_MRN_SUFFIX AS 'SECONDARY-MRN-SUFFIX' ) )
    ),PAST_DUE_COMPARE AS (
      SELECT BILL_ID,
             REGION,
             BATCH_NBR,
             'PAST_DUE' AS ENTITY_TYPE,
             ENTITY_KEY,
             FIELD_NAME,
             FIELD_VALUE
        FROM (
        SELECT PD.BILL_ID,
               PD.BATCH_NBR,
               PD.REGION,
               TRIM(TO_CHAR(PD.ACCT_ID))
               || ':'
               || NVL(
                 CASE
                   WHEN REGEXP_LIKE(TRIM(PD.CM_COV_PERIOD),
                                    '^[[:alpha:]]{3}-[0-9]{4}$') THEN
                     TO_CHAR(
                       TO_DATE(TRIM(PD.CM_COV_PERIOD),
                             'MON-YYYY',
                             'NLS_DATE_LANGUAGE=ENGLISH'),
                       'YYYY-MM'
                     )
                   ELSE
                     TRIM(PD.CM_COV_PERIOD)
                 END,
                 'NULL'
               ) AS ENTITY_KEY,
               TRIM(PD.CM_COV_PERIOD) AS PAST_DUE_COVERAGE_PERIOD,
               TO_CHAR(
                 PD.DUE_DT,
                 'YYYY-MM-DD'
               ) AS PAST_DUE_DUE_DATE,
               TO_CHAR(
                 PD.CM_BILL_UNPAID_AMT,
                 'FM9999999990D00'
               ) AS PAST_DUE_AMOUNT
          FROM PAST_DUE_DTL PD
      ) UNPIVOT INCLUDE NULLS ( FIELD_VALUE
        FOR FIELD_NAME
      IN ( PAST_DUE_COVERAGE_PERIOD AS 'PAST-DUE-COVERAGE-PERIOD',
           PAST_DUE_DUE_DATE AS 'PAST-DUE-DUE-DATE',
           PAST_DUE_AMOUNT AS 'PAST-DUE-AMOUNT' ) )
    ),PAYMENTS_30_COMPARE AS (
      SELECT BILL_ID,
             REGION,
             BATCH_NBR,
             'PAYMENTS_30' AS ENTITY_TYPE,
             ENTITY_KEY,
             FIELD_NAME,
             FIELD_VALUE
        FROM (
        SELECT X.BILL_ID,
               X.BATCH_NBR,
               X.REGION,
               TRIM(TO_CHAR(X.ACCT_ID))
               || ':'
               || TO_CHAR(X.SORT_ITEM_SEQ) AS ENTITY_KEY,
               TO_CHAR(
                 X.PAY_DT,
                 'YYYY-MM-DD'
               ) AS PAYMENTS_30_DATE,
               TO_CHAR(
                 X.PAY_AMT,
                 'FM9999999990D00'
               ) AS PAYMENTS_30_AMOUNT
          FROM (
          SELECT P.BILL_ID,
                 P.BATCH_NBR,
                 P.REGION,
                 P.ACCT_ID,
                 P.PAY_DT,
                 P.PAY_AMT,
                 ROW_NUMBER()
                 OVER(PARTITION BY P.BILL_ID,
                                   P.ACCT_ID
                      ORDER BY P.PAY_DT,
                               P.PAY_AMT,
                               P.ITEM_SEQ
                 ) AS SORT_ITEM_SEQ
            FROM PAY_DTL P
        ) X
      ) UNPIVOT INCLUDE NULLS ( FIELD_VALUE
        FOR FIELD_NAME
      IN ( PAYMENTS_30_DATE AS 'PAYMENTS-30-DATE',
           PAYMENTS_30_AMOUNT AS 'PAYMENTS-30-AMOUNT' ) )
    )
    SELECT *
      FROM HEADER_COMPARE
    UNION ALL
    SELECT *
      FROM SECONDARY_COMPARE
    UNION ALL
    SELECT *
      FROM SUBSCRIBER_COMPARE
    UNION ALL
    SELECT *
      FROM PAST_DUE_COMPARE
    UNION ALL
    SELECT *
      FROM PAYMENTS_30_COMPARE
     ORDER BY 1,
              4;

  DECLARE
    V_TOTAL_RECORDS_ORMB NUMBER;
  BEGIN
    SELECT COUNT(DISTINCT BILL_ID)
      INTO V_TOTAL_RECORDS_ORMB
      FROM COMPARE_OWNER.MEDICARE_CMP_TARGET_ORMB
     WHERE BATCH_NBR = V_BATCH_NBR;

    SET_RUN_STATUS(
      P_STATUS             => 'MED_CMP_TARGET_ORMB INSERTION COMPLETED',
      P_STEP               => 'TARGET ORMB INSERT',
      P_NEXT_STEP          => 'RESULTS COMPARISON INSERT',
      P_TOTAL_RECORDS_ORMB => V_TOTAL_RECORDS_ORMB
    );
  END;

  CHECK_CANCELED;

  --------------------------------------------------------------------
  -- Build final comparison rowset MEDICARE_CMP_RESULTS
  --------------------------------------------------------------------

  INSERT INTO COMPARE_OWNER.MEDICARE_CMP_RESULTS (
    RUN_ID,
    BATCH_NBR,
    KPMC_TRANSACTION_ID,
    BILL_ID,
    REGION,
    ENTITY_TYPE,
    ENTITY_KEY,
    FIELD_NAME,
    MEDICARE_VALUE,
    ORMB_VALUE,
    MATCH_STATUS
  )
    SELECT P_RUN_ID,
           S.BATCH_NBR,
           S.KPMC_TRANSACTION_ID,
           S.BILL_ID,
           S.REGION,
           S.ENTITY_TYPE,
           S.ENTITY_KEY,
           S.FIELD_NAME,
           S.FIELD_VALUE AS MEDICARE_VALUE,
           T.FIELD_VALUE AS ORMB_VALUE,
           CASE
             -- Special handling for date format mismatches
             WHEN S.FIELD_NAME = 'PAST-DUE-COVERAGE-PERIOD' THEN
               -- MEDICARE_VALUE: YYYY-MM-DD, ORMB_VALUE: MMM-YYYY
               -- Note: Oracle treats '' as NULL, so IS NULL checks are used instead of NVL(...,'') = ''
                 CASE
                   WHEN TRIM(S.FIELD_VALUE) IS NULL
                      AND TRIM(T.FIELD_VALUE) IS NULL THEN
                     'PASS'
                   WHEN TRIM(S.FIELD_VALUE) IS NULL
                       OR TRIM(T.FIELD_VALUE) IS NULL THEN
                     'FAIL'
                   WHEN UPPER(TO_CHAR(
                     TO_DATE(TRIM(S.FIELD_VALUE),
                     'YYYY-MM-DD'),
                     'Mon-YYYY'
                   )) = UPPER(TRIM(T.FIELD_VALUE)) THEN
                     'PASS'
                   ELSE
                     'FAIL'
                 END
             -- Standard string comparison for all other fields
             ELSE
               CASE
                 WHEN NVL(
                     TRIM(S.FIELD_VALUE),
                     '#NULL#'
                   ) = NVL(
                     TRIM(T.FIELD_VALUE),
                     '#NULL#'
                   ) THEN
                     'PASS'
                 ELSE
                   'FAIL'
               END
           END AS MATCH_STATUS
      FROM COMPARE_OWNER.MEDICARE_CMP_SOURCE_MED_XML S
      LEFT JOIN COMPARE_OWNER.MEDICARE_CMP_TARGET_ORMB T
    ON T.BATCH_NBR = S.BATCH_NBR
       AND T.BILL_ID = S.BILL_ID
       AND T.ENTITY_TYPE = S.ENTITY_TYPE
       AND T.ENTITY_KEY = S.ENTITY_KEY
       AND T.FIELD_NAME = S.FIELD_NAME
     WHERE S.BATCH_NBR = V_BATCH_NBR;

  DECLARE
    V_TOTAL_COMPARE_MED NUMBER;
  BEGIN
    SELECT COUNT(DISTINCT BILL_ID)
      INTO V_TOTAL_COMPARE_MED
      FROM COMPARE_OWNER.MEDICARE_CMP_RESULTS
     WHERE RUN_ID = P_RUN_ID
       AND BATCH_NBR = V_BATCH_NBR;

    SET_RUN_STATUS(
      P_STATUS            => 'MED_CMP_RESULTS INSERTION COMPLETED',
      P_STEP              => 'MED RESULTS INSERT',
      P_NEXT_STEP         => 'COMPLETE',
      P_TOTAL_COMPARE_MED => V_TOTAL_COMPARE_MED
    );
  END;

  COMMIT;
  SET_RUN_STATUS(
    'COMPLETE',
    'ALL INSERTIONS COMPLETED',
    NULL
  );
EXCEPTION
  WHEN OTHERS THEN
    V_ERROR_MSG := SUBSTR(
      SQLERRM
      || ' | '
      || DBMS_UTILITY.FORMAT_ERROR_BACKTRACE,
      1,
      4000
    );
    ROLLBACK;
    BEGIN
      SELECT STATUS
        INTO V_CURRENT_STATUS
        FROM COMPARE_OWNER.MEDICARE_CMP_RUN_STATUS
       WHERE RUN_ID = P_RUN_ID
         AND BATCH_NBR = V_BATCH_NBR;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        V_CURRENT_STATUS := NULL;
    END;

    IF NVL(
      V_CURRENT_STATUS,
      'X'
    ) != 'CANCELED' THEN
      SET_RUN_STATUS(
        'ERROR',
        'FAILED',
        NULL,
        V_ERROR_MSG
      );
    END IF;

    RAISE;
END;