CREATE OR REPLACE PROCEDURE COMPARE_OWNER.KPIF_CMP_RUN_BATCH (
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
    P_INVOICES_CA        IN NUMBER DEFAULT NULL,
    P_INVOICES_ROC       IN NUMBER DEFAULT NULL,
    P_TOTAL_RECORDS_ORMB IN NUMBER DEFAULT NULL,
    P_TOTAL_COMPARE_CA   IN NUMBER DEFAULT NULL,
    P_TOTAL_COMPARE_ROC  IN NUMBER DEFAULT NULL
  ) IS
    PRAGMA AUTONOMOUS_TRANSACTION;
  BEGIN
    MERGE INTO COMPARE_OWNER.KPIF_CMP_RUN_STATUS S
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
        S.ERROR_MESSAGE = P_ERROR,
        S.INVOICES_CA = NVL(
      P_INVOICES_CA,
      S.INVOICES_CA
    ),
        S.INVOICES_ROC = NVL(
      P_INVOICES_ROC,
      S.INVOICES_ROC
    ),
        S.TOTAL_RECORDS_ORMB = NVL(
      P_TOTAL_RECORDS_ORMB,
      S.TOTAL_RECORDS_ORMB
    ),
        S.TOTAL_COMPARE_CA = NVL(
      P_TOTAL_COMPARE_CA,
      S.TOTAL_COMPARE_CA
    ),
        S.TOTAL_COMPARE_ROC = NVL(
      P_TOTAL_COMPARE_ROC,
      S.TOTAL_COMPARE_ROC
    ),
        S.LAST_UPDATE_TS = SYSTIMESTAMP,
        S.END_TS =
      CASE
        WHEN P_STATUS IN ( 'COMPLETE',
                           'ERROR' ) THEN
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
      INVOICES_CA,
      INVOICES_ROC,
      TOTAL_RECORDS_ORMB,
      TOTAL_COMPARE_CA,
      TOTAL_COMPARE_ROC,
      START_TS,
      LAST_UPDATE_TS,
      END_TS )
    VALUES
      ( P_RUN_ID,
        V_BATCH_NBR,
        P_STATUS,
        P_STEP,
        P_NEXT_STEP,
        P_ERROR,
        NVL(
          P_INVOICES_CA,
          0
        ),
        NVL(
          P_INVOICES_ROC,
          0
        ),
        NVL(
          P_TOTAL_RECORDS_ORMB,
          0
        ),
        NVL(
          P_TOTAL_COMPARE_CA,
          0
        ),
        NVL(
          P_TOTAL_COMPARE_ROC,
          0
        ),
        SYSTIMESTAMP,
        SYSTIMESTAMP,
        CASE
          WHEN P_STATUS IN ( 'COMPLETE',
                             'ERROR' ) THEN
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
      FROM COMPARE_OWNER.KPIF_CMP_RUN_STATUS
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
    'SOURCE CA INSERT'
  );
  IF V_REFRESH = 'N' THEN
    SELECT COUNT(*)
      INTO V_EXISTS
      FROM (
      SELECT 1
        FROM COMPARE_OWNER.KPIF_CMP_RESULTS
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

  -- Refresh path
  IF V_REFRESH = 'Y' THEN
    DELETE FROM COMPARE_OWNER.KPIF_CMP_RESULTS
     WHERE BATCH_NBR = V_BATCH_NBR;
    DELETE FROM COMPARE_OWNER.MOC_CMP_RESULTS
     WHERE BATCH_NBR = V_BATCH_NBR;
    DELETE FROM COMPARE_OWNER.KPIF_CMP_SOURCE_CA_XML
     WHERE BATCH_NBR = V_BATCH_NBR;
    DELETE FROM COMPARE_OWNER.KPIF_CMP_SOURCE_ROC_XML
     WHERE BATCH_NBR = V_BATCH_NBR;
    DELETE FROM COMPARE_OWNER.KPIF_CMP_TARGET_ORMB
     WHERE BATCH_NBR = V_BATCH_NBR;
  END IF;

  CHECK_CANCELED;

  --------------------------------------------------------------------
  -- Load SOURCE CA (from kpif_ca_xml_read_v1.0.sql)
  --------------------------------------------------------------------
  INSERT INTO COMPARE_OWNER.KPIF_CMP_SOURCE_CA_XML (
    BATCH_NBR,
    BILL_ID,
    KPMC_TRANSACTION_ID,
    RGN_CD,
    BATCH_CD,
    TYPE,
    REGION,
    BILLING_UNIT_ID,
    INVOICE_GENERATED_DATE,
    PAYMENT_DUE_DATE,
    RETROACTIVE_DUE,
    COVERAGE_THROUGH_MONTH,
    COVERGAE_THROUGH_YEAR,
    CURRENT_PREMIUM_DUE,
    AUTOPAY_INDICATOR,
    BILLING_UNIT_TYPE,
    JURISDICTION,
    ACTIVITY_START_DATE,
    ACTIVITY_END_DATE,
    PRIOR_MONTH_BALANCE,
    PAYMENT_RECEIVED,
    TOTAL_ADJUSTMENT_AMT,
    SUBTOTAL_DUE,
    PAST_DUE,
    REMITTANCE_RVERSAL_AMT,
    APTC,
    STATE_SUBSIDY,
    STATE_PREMIUM_CREDIT,
    RETRO_DUE_WITHOUT_LIS_AMT,
    RETRO_DUE_LEP_AMT,
    PAST_DUE_COVERAGE_PERIODS,
    PAST_DUE_DATES,
    PAST_DUE_AMOUNTS,
    RETROACTIVE_FEDERAL_COMBINED,
    RETROACTIVE_FEDREAL_AMT,
    RETROACTIVE_STATE_SUBSIDY_COMBINED,
    RETROACTIVE_STATE_SUBSDIY_AMT,
    RETROACTIVE_TOTAL_AMOUNT
  )
    SELECT B.BATCH_NBR,
           B.BILL_ID,
           EPL.KPMC_TRANSACTION_ID,
           B.FAMILY_ACCT_NO AS RGN_CD,
           B.BATCH_CD,
           EPL.TYPE,
           XML_FILE1.REGION,
           XML_FILE1.BILLING_UNIT_ID,
           XML_FILE1.INVOICE_GENERATED_DATE,
           XML_FILE1.PAYMENT_DUE_DATE,
           XML_FILE1.RETROACTIVE_DUE,
           XML_FILE1.COVERAGE_THROUGH_MONTH,
           XML_FILE1.COVERGAE_THROUGH_YEAR,
           XML_FILE1.CURRENT_PREMIUM_DUE,
           XML_FILE1.AUTOPAY_INDICATOR,
           XML_FILE1.BILLING_UNIT_TYPE,
           XML_FILE1.JURISDICTION,
           XML_FILE2.ACTIVITY_START_DATE,
           XML_FILE2.ACTIVITY_END_DATE,
           XML_FILE2.PRIOR_MONTH_BALANCE,
           XML_FILE2.PAYMENT_RECEIVED,
           XML_FILE2.TOTAL_ADJUSTMENT_AMT,
           XML_FILE2.SUBTOTAL_DUE,
           XML_FILE2.PAST_DUE,
           XML_FILE2.REMITTANCE_RVERSAL_AMT,
           XML_FILE2.APTC,
           XML_FILE2.STATE_SUBSIDY,
           XML_FILE2.STATE_PREMIUM_CREDIT,
           XML_FILE2.RETRO_DUE_WITHOUT_LIS_AMT,
           XML_FILE2.RETRO_DUE_LEP_AMT,
           CASE
             WHEN LENGTH(XML_FILE2.PAST_DUE_COVERAGE_PERIODS) > 1000 THEN
               '##OVERFLOW_S##'
             ELSE
               XML_FILE2.PAST_DUE_COVERAGE_PERIODS
           END,
           CASE
             WHEN LENGTH(XML_FILE2.PAST_DUE_DATES) > 1000 THEN
               '##OVERFLOW_S##'
             ELSE
               XML_FILE2.PAST_DUE_DATES
           END,
           CASE
             WHEN LENGTH(XML_FILE2.PAST_DUE_AMOUNTS) > 1000 THEN
               '##OVERFLOW_S##'
             ELSE
               XML_FILE2.PAST_DUE_AMOUNTS
           END,
           XML_FILE4.RETROACTIVE_FEDERAL_COMBINED,
           XML_FILE4.RETROACTIVE_FEDREAL_AMT_TOTAL RETROACTIVE_FEDREAL_AMT,
           XML_FILE4.RETROACTIVE_STATE_SUBSIDY_COMBINED,
           XML_FILE4.RETROACTIVE_STATE_SUBSDIY_AMT_TOTAL RETROACTIVE_STATE_SUBSDIY_AMT,
           XML_FILE2.RETROACTIVE_TOTAL_AMOUNT
      FROM KPMC_DOCMGMT_ADM.KPMC_EXTRACT_PAYLOAD EPL
     INNER JOIN KPMC_DOCMGMT_ADM.INDV_INVOICE_NON_CONS_CTL B
    ON EPL.KPMC_TRANSACTION_ID = B.KPMC_INDIVIDUAL_INVOICE_TRANSACTION_ID,
           XMLTABLE ( '/recipient'
               PASSING XMLPARSE(DOCUMENT EPL.PAYLOAD_XML)
             COLUMNS
               TRANSACTION_ID PATH 'KPMC_Individual_Invoice_Transaction_ID',
               REGION PATH 'WS-REGION',
               BILLING_UNIT_ID PATH 'WS-Parent-Billing-Unit',
               INVOICE_GENERATED_DATE PATH 'Stmnt_Dt',
               PAYMENT_DUE_DATE PATH 'WS-Payment-due-date',
               RETROACTIVE_DUE PATH 'WS-Retroactive-Dues',
               COVERAGE_THROUGH_MONTH PATH 'WS-Coverage-through-month',
               COVERGAE_THROUGH_YEAR PATH 'WS-Coverage-through-year',
               CURRENT_PREMIUM_DUE PATH 'WS-Current-Dues',
               AUTOPAY_INDICATOR PATH 'WS-AUTOPAY-IND',
               INVOICE_DETAILS XMLTYPE PATH 'Invoice_Details',
               BILLING_UNIT_TYPE PATH 'WS-BU-TYPE',
               JURISDICTION PATH 'WS-Member-State'
           ) XML_FILE1,
           XMLTABLE ( '/Invoice_Details/Covered_Family_Member_Details'
               PASSING XML_FILE1.INVOICE_DETAILS
             COLUMNS
               ACTIVITY_START_DATE PATH 'WS-Activity-Start-date',
               ACTIVITY_END_DATE PATH 'WS-Activity-End-date',
               PRIOR_MONTH_BALANCE PATH 'WS-Beginning-Balance',
               PAYMENT_RECEIVED PATH 'WS-Payments',
               TOTAL_ADJUSTMENT_AMT PATH 'WS-Adjustment-amount',
               SUBTOTAL_DUE PATH 'WS-Sub-total',
               PAST_DUE PATH 'Past-Due-Total-Amount',
               REMITTANCE_RVERSAL_AMT PATH 'WS-Remittance-reversal-amt',
               COVERAGE_THROUGH_MONTH PATH 'WS-Coverage-through-month',
               APTC PATH 'APTC',
               STATE_SUBSIDY PATH 'STE_SUBSIDY',
               STATE_PREMIUM_CREDIT PATH 'STE-PRE-CREDIT',
               RETRO_DUE_WITHOUT_LIS_AMT PATH 'WS-RDUE-WITHOUT-LIS-AMT',
               RETRO_DUE_LEP_AMT PATH 'WS-RDUE-LEP-AMT',
      -- Concatenate ALL Past_Due_Details entries sorted by due date then amount
               PAST_DUE_COVERAGE_PERIODS VARCHAR2(4000) PATH 'fn:string-join(for $i in Past_Due_Details order by concat(substring($i/Past-Due-Coverage-Period, 7, 4), substring($i/Past-Due-Coverage-Period, 1, 2), substring($i/Past-Due-Coverage-Period, 4, 2)), number($i/Past-Due-Amount) return string($i/Past-Due-Coverage-Period), ", ")'
               ,
               PAST_DUE_DATES VARCHAR2(4000) PATH 'fn:string-join(for $i in Past_Due_Details order by concat(substring($i/Past-Due-Due-Date, 7, 4), substring($i/Past-Due-Due-Date, 1, 2), substring($i/Past-Due-Due-Date, 4, 2)), number($i/Past-Due-Amount) return string($i/Past-Due-Due-Date), ", ")'
               ,
               PAST_DUE_AMOUNTS VARCHAR2(4000) PATH 'fn:string-join(for $i in Past_Due_Details order by concat(substring($i/Past-Due-Due-Date, 7, 4), substring($i/Past-Due-Due-Date, 1, 2), substring($i/Past-Due-Due-Date, 4, 2)), number($i/Past-Due-Amount) return string($i/Past-Due-Amount), ", ")'
               ,
               RETROACTIVE_SUBSIDY_DETAILS XMLTYPE PATH 'Retroactive_Subsidy_Details',
               RETROACTIVE_TOTAL_AMOUNT PATH 'RETROACTIVE-TOTAL-AMOUNT'
           ) XML_FILE2,
           XMLTABLE ( 'let $details := /Invoice_Details/Covered_Family_Member_Details/Retroactive_Subsidy_Details
     return <r>
       <fed>{string-join(
         for $d in $details
         where string-length($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD) > 0
         order by concat(substring($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD, 7, 4), substring($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD, 1, 2), substring($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD, 4, 2)), number($d/RETROACTIVE-FEDERAL-AMOUNT)
         return concat($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD, "=", $d/RETROACTIVE-FEDERAL-AMOUNT)
       , ", ")}</fed>
       <fed_amt>{string-join(
         for $d in $details
         where string-length(normalize-space($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD)) > 0 and string-length(normalize-space($d/RETROACTIVE-FEDERAL-AMOUNT)) > 0
         order by concat(substring($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD, 7, 4), substring($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD, 1, 2), substring($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD, 4, 2)), number($d/RETROACTIVE-FEDERAL-AMOUNT)
         return string($d/RETROACTIVE-FEDERAL-AMOUNT)
       , ",")}</fed_amt>
       <fed_amt_total>{
         let $fedAmounts := for $d in $details
           where string-length(normalize-space($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD)) > 0 and string-length(normalize-space($d/RETROACTIVE-FEDERAL-AMOUNT)) > 0
           return xs:decimal(normalize-space($d/RETROACTIVE-FEDERAL-AMOUNT))
         return if (exists($fedAmounts)) then sum($fedAmounts) else ()
       }</fed_amt_total>
       <state>{string-join(
         for $d in $details
         where string-length($d/RETROACTIVE-STATE-COVERAGE-PERIOD) > 0
         order by concat(substring($d/RETROACTIVE-STATE-COVERAGE-PERIOD, 7, 4), substring($d/RETROACTIVE-STATE-COVERAGE-PERIOD, 1, 2), substring($d/RETROACTIVE-STATE-COVERAGE-PERIOD, 4, 2)), number($d/RETROACTIVE-STATE-AMOUNT)
         return concat($d/RETROACTIVE-STATE-COVERAGE-PERIOD, "=", $d/RETROACTIVE-STATE-AMOUNT)
       , ", ")}</state>
       <state_amt>{string-join(
         for $d in $details
         where string-length(normalize-space($d/RETROACTIVE-STATE-COVERAGE-PERIOD)) > 0 and string-length(normalize-space($d/RETROACTIVE-STATE-AMOUNT)) > 0
         order by concat(substring($d/RETROACTIVE-STATE-COVERAGE-PERIOD, 7, 4), substring($d/RETROACTIVE-STATE-COVERAGE-PERIOD, 1, 2), substring($d/RETROACTIVE-STATE-COVERAGE-PERIOD, 4, 2)), number($d/RETROACTIVE-STATE-AMOUNT)
         return string($d/RETROACTIVE-STATE-AMOUNT)
       , ",")}</state_amt>
       <state_amt_total>{
         let $stateAmounts := for $d in $details
           where string-length(normalize-space($d/RETROACTIVE-STATE-COVERAGE-PERIOD)) > 0 and string-length(normalize-space($d/RETROACTIVE-STATE-AMOUNT)) > 0
           return xs:decimal(normalize-space($d/RETROACTIVE-STATE-AMOUNT))
         return if (exists($stateAmounts)) then sum($stateAmounts) else ()
       }</state_amt_total>
     </r>'
               PASSING XML_FILE1.INVOICE_DETAILS
             COLUMNS
               RETROACTIVE_FEDERAL_COMBINED VARCHAR2(4000) PATH '/r/fed',
               RETROACTIVE_FEDREAL_AMT_CSV VARCHAR2(4000) PATH '/r/fed_amt',
               RETROACTIVE_FEDREAL_AMT_TOTAL NUMBER PATH '/r/fed_amt_total',
               RETROACTIVE_STATE_SUBSIDY_COMBINED VARCHAR2(4000) PATH '/r/state',
               RETROACTIVE_STATE_SUBSDIY_AMT_CSV VARCHAR2(4000) PATH '/r/state_amt',
               RETROACTIVE_STATE_SUBSDIY_AMT_TOTAL NUMBER PATH '/r/state_amt_total'
           ) XML_FILE4
     WHERE B.RGN_CD IN ( 'NCR',
                         'SCR' )
       AND B.KPMC_MARKET_SEGMENT IN ( 'INDON',
                                      'INDOFF' )
       AND B.BATCH_NBR = V_BATCH_NBR;

  DECLARE
    V_INVOICES_CA NUMBER := SQL%ROWCOUNT;
  BEGIN
    SET_RUN_STATUS(
      P_STATUS      => 'KPIF_CMP_SOURCE_CA_XML INSERTION COMPLETED',
      P_STEP        => 'SOURCE CA INSERT',
      P_NEXT_STEP   => 'SOURCE ROC INSERT',
      P_INVOICES_CA => V_INVOICES_CA
    );
  END;

  CHECK_CANCELED;

  --------------------------------------------------------------------
  -- Load SOURCE CA (from kpif_roc_xml_read_v1.0.sql)
  --------------------------------------------------------------------

  INSERT INTO COMPARE_OWNER.KPIF_CMP_SOURCE_ROC_XML (
    BATCH_NBR,
    BILL_ID,
    TYPE,
    TRANSACTION_ID,
    INVOICE_NUMBER,
    REGION,
    REGION_ID,
    GROUP_ID,
    BILL_GRP_ID,
    SUB_GRP_ID,
    BILLING_UNIT_ID,
    INVOICE_GENERATED_DATE,
    STATEMENT_MONTH,
    STATEMENT_YEAR,
    PRIOR_MONTH_BALANCE,
    PAYMENT_RECEIVED,
    REJECTED_PAYMENT,
    CURRENT_PREMIUM_DUE,
    TOTAL_BALANCE_DUE,
    OTHER_ADJUSTMENT,
    ACI_PAY_MODE,
    JURISDICTION,
    REGION_NAME_INVOICE_DETAIL,
    CURRENT_MONTH_PREMIUM,
    CURRENT_MONTH_PREMIUM_NO_LISLEP,
    ADVANTAGE_PLUS,
    LATE_ENROLLMENT_PENALTY,
    LOW_INCOME_SUBSIDY,
    FEDERAL_SUBSIDY,
    STATE_SUBSIDY,
    SUBTOTAL,
    PAY_FROM_DATE,
    PAY_THROUGH_DATE,
    PAY_OVER_30_AMT,
    TOTAL_RETROACTIVE_AMOUNT,
    RETROACTIVE_FEDERAL_COMBINED,
    RETROACTIVE_FEDREAL_AMT,
    RETROACTIVE_STATE_SUBSIDY_COMBINED,
    RETROACTIVE_STATE_SUBSDIY_AMT,
    ROC_30_PAY_DATES,
    ROC_30_PAY_AMTS
  )
    SELECT B.BATCH_NBR,
           B.BILL_ID,
           EPL.TYPE,
           XML_FILE1.TRANSACTION_ID,
           XML_FILE1.INVOICE_NUMBER,
           XML_FILE1.REGION,
           XML_FILE1.REGION_ID,
           XML_FILE1.GROUP_ID,
           XML_FILE1.BILL_GRP_ID,
           XML_FILE1.SUB_GRP_ID,
           XML_FILE1.BILLING_UNIT_ID,
           XML_FILE1.INVOICE_GENERATED_DATE,
           XML_FILE1.STATEMENT_MONTH,
           XML_FILE1.STATEMENT_YEAR,
           XML_FILE1.PRIOR_MONTH_BALANCE,
           XML_FILE1.PAYMENT_RECEIVED,
           XML_FILE2.REJECTED_PAYMENT,
           XML_FILE1.CURRENT_PREMIUM_DUE,
           XML_FILE1.TOTAL_BALANCE_DUE,
           XML_FILE1.OTHER_ADJUSTMENT,
           XML_FILE1.ACI_PAY_MODE,
           XML_FILE1.JURISDICTION,
           XML_FILE2.REGION_NAME_INVOICE_DETAIL,
           XML_FILE2.CURRENT_MONTH_PREMIUM,
           XML_FILE2.CURRENT_MONTH_PREMIUM_NO_LISLEP,
           XML_FILE2.ADVANTAGE_PLUS,
           XML_FILE2.LATE_ENROLLMENT_PENALTY,
           XML_FILE2.LOW_INCOME_SUBSIDY,
           XML_FILE2.FEDERAL_SUBSIDY,
           XML_FILE2.STATE_SUBSIDY,
           XML_FILE2.SUBTOTAL,
           XML_FILE2.PAY_FROM_DATE,
           XML_FILE2.PAY_THROUGH_DATE,
           XML_FILE2.PAY_OVER_30_AMT,
           XML_FILE2.TOTAL_RETROACTIVE_AMOUNT,
           XML_FILE3.RETROACTIVE_FEDERAL_COMBINED,
           XML_FILE3.RETROACTIVE_FEDREAL_AMT_TOTAL RETROACTIVE_FEDREAL_AMT,
           XML_FILE3.RETROACTIVE_STATE_SUBSIDY_COMBINED,
           XML_FILE3.RETROACTIVE_STATE_SUBSDIY_AMT_TOTAL RETROACTIVE_STATE_SUBSDIY_AMT,
           CASE
             WHEN LENGTH(XML_FILE2.ROC_30_PAY_DATES) > 1000 THEN
               '##OVERFLOW_S##'
             ELSE
               XML_FILE2.ROC_30_PAY_DATES
           END,
           CASE
             WHEN LENGTH(XML_FILE2.ROC_30_PAY_AMTS) > 1000 THEN
               '##OVERFLOW_S##'
             ELSE
               XML_FILE2.ROC_30_PAY_AMTS
           END
      FROM KPMC_DOCMGMT_ADM.KPMC_EXTRACT_PAYLOAD EPL
     INNER JOIN KPMC_DOCMGMT_ADM.INDV_INVOICE_NON_CONS_CTL B
    ON EPL.KPMC_TRANSACTION_ID = B.KPMC_INDIVIDUAL_INVOICE_TRANSACTION_ID,
           XMLTABLE ( '/recipient'
               PASSING XMLPARSE(DOCUMENT EPL.PAYLOAD_XML)
             COLUMNS
               TRANSACTION_ID PATH 'KPMC_Individual_Invoice_Transaction_ID',
               INVOICE_NUMBER PATH 'ROC-INVOICE-NUMBER',
               REGION PATH 'ROC-REGION-NAME',
               REGION_ID PATH 'ROC-REGION-ID',
               GROUP_ID PATH 'ROC-GROUP-ID',
               BILL_GRP_ID PATH 'ROC-BILL-GRP-ID',
               SUB_GRP_ID PATH 'ROC-SUB-GRP-ID',
               BILLING_UNIT_ID PATH 'ROC-ORMB-ACCT-ID',
               INVOICE_GENERATED_DATE PATH 'ROC-INV-GENERATED-DATE',
               STATEMENT_MONTH PATH 'ROC-INV-STMT-MONTH',
               STATEMENT_YEAR PATH 'ROC-INV-STMT-YEAR',
               PRIOR_MONTH_BALANCE PATH 'ROC-INV-SMRY-PREV-BAL',
               PAYMENT_RECEIVED PATH 'ROC-PAY-TOT-AMOUNT',
               CURRENT_PREMIUM_DUE PATH 'ROC-INV-SMRY-CURR-PREM_DUE',
               TOTAL_BALANCE_DUE PATH 'ROC-INV-SMRY-TOT-BAL-DUE',
               OTHER_ADJUSTMENT PATH 'ROC-TOT-ADJ-AMT',
               ACI_PAY_MODE PATH 'ROC-INV-ACI-PAY-MODE',
               INVOICE_DETAILS XMLTYPE PATH 'Invoice_Details',
               JURISDICTION PATH 'JURISDICTION'
           ) XML_FILE1,
           XMLTABLE ( '/Invoice_Details/Covered_Family_Member_Details'
               PASSING XML_FILE1.INVOICE_DETAILS
             COLUMNS
               REGION_NAME_INVOICE_DETAIL PATH 'ROC-REGION-NAME-INVOICE-DETAIL',
               CURRENT_MONTH_PREMIUM PATH 'ROC-MED-NON-SUP-PREM-AMT',
               CURRENT_MONTH_PREMIUM_NO_LISLEP PATH 'ROC-PREM-DUE-NO-LISLEP',
               ADVANTAGE_PLUS PATH 'ROC-SUPPL-PREM-AMT',
               LATE_ENROLLMENT_PENALTY PATH 'ROC-LEP-AMT',
               LOW_INCOME_SUBSIDY PATH 'ROC-LIS-AMT',
               FEDERAL_SUBSIDY PATH 'APTC',
               STATE_SUBSIDY PATH 'STE_SUBSIDY',
               SUBTOTAL PATH 'ROC-SUB-TOT',
               PAY_FROM_DATE PATH 'ROC-PAY-FRM-DATE',
               REJECTED_PAYMENT PATH 'ROC-PAY-TOT-REJ-AMOUNT',
               PAY_THROUGH_DATE PATH 'ROC-PAY-THRU-DATE',
               PAY_OVER_30_AMT PATH 'ROC-PAY-OVER-30-AMT',
               TOTAL_RETROACTIVE_AMOUNT PATH 'RETROACTIVE-TOTAL-AMOUNT',
               RETROACTIVE_SUBSIDY_DETAILS XMLTYPE PATH 'Retroactive_Subsidy_Details',
    -- Concatenate ALL Itemized_Payment_Details entries sorted by date then amount
               ROC_30_PAY_DATES VARCHAR2(4000) PATH 'fn:string-join(for $i in Itemized_Payment_Details order by concat(substring($i/ROC-30-PAY-DATE, 7, 4), substring($i/ROC-30-PAY-DATE, 1, 2), substring($i/ROC-30-PAY-DATE, 4, 2)), number($i/ROC-30-PAY-AMT) return string($i/ROC-30-PAY-DATE), ", ")'
               ,
               ROC_30_PAY_AMTS VARCHAR2(4000) PATH 'fn:string-join(for $i in Itemized_Payment_Details order by concat(substring($i/ROC-30-PAY-DATE, 7, 4), substring($i/ROC-30-PAY-DATE, 1, 2), substring($i/ROC-30-PAY-DATE, 4, 2)), number($i/ROC-30-PAY-AMT) return string($i/ROC-30-PAY-AMT), ", ")'
           ) XML_FILE2,
           XMLTABLE ( 'let $details := /Invoice_Details/Covered_Family_Member_Details/Retroactive_Subsidy_Details
     return <r>
       <fed>{string-join(
         for $d in $details
         where string-length($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD) > 0
         order by concat(substring($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD, 7, 4), substring($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD, 1, 2), substring($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD, 4, 2)), number($d/RETROACTIVE-FEDERAL-AMOUNT)
         return concat($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD, "=", $d/RETROACTIVE-FEDERAL-AMOUNT)
       , ", ")}</fed>
       <fed_amt>{string-join(
         for $d in $details
         where string-length(normalize-space($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD)) > 0 and string-length(normalize-space($d/RETROACTIVE-FEDERAL-AMOUNT)) > 0
         order by concat(substring($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD, 7, 4), substring($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD, 1, 2), substring($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD, 4, 2)), number($d/RETROACTIVE-FEDERAL-AMOUNT)
         return string($d/RETROACTIVE-FEDERAL-AMOUNT)
       , ",")}</fed_amt>
       <fed_amt_total>{
         let $fedAmounts := for $d in $details
           where string-length(normalize-space($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD)) > 0 and string-length(normalize-space($d/RETROACTIVE-FEDERAL-AMOUNT)) > 0
           return xs:decimal(normalize-space($d/RETROACTIVE-FEDERAL-AMOUNT))
         return if (exists($fedAmounts)) then sum($fedAmounts) else ()
       }</fed_amt_total>
       <state>{string-join(
         for $d in $details
         where string-length($d/RETROACTIVE-STATE-COVERAGE-PERIOD) > 0
         order by concat(substring($d/RETROACTIVE-STATE-COVERAGE-PERIOD, 7, 4), substring($d/RETROACTIVE-STATE-COVERAGE-PERIOD, 1, 2), substring($d/RETROACTIVE-STATE-COVERAGE-PERIOD, 4, 2)), number($d/RETROACTIVE-STATE-AMOUNT)
         return concat($d/RETROACTIVE-STATE-COVERAGE-PERIOD, "=", $d/RETROACTIVE-STATE-AMOUNT)
       , ", ")}</state>
       <state_amt>{string-join(
         for $d in $details
         where string-length(normalize-space($d/RETROACTIVE-STATE-COVERAGE-PERIOD)) > 0 and string-length(normalize-space($d/RETROACTIVE-STATE-AMOUNT)) > 0
         order by concat(substring($d/RETROACTIVE-STATE-COVERAGE-PERIOD, 7, 4), substring($d/RETROACTIVE-STATE-COVERAGE-PERIOD, 1, 2), substring($d/RETROACTIVE-STATE-COVERAGE-PERIOD, 4, 2)), number($d/RETROACTIVE-STATE-AMOUNT)
         return string($d/RETROACTIVE-STATE-AMOUNT)
       , ",")}</state_amt>
       <state_amt_total>{
         let $stateAmounts := for $d in $details
           where string-length(normalize-space($d/RETROACTIVE-STATE-COVERAGE-PERIOD)) > 0 and string-length(normalize-space($d/RETROACTIVE-STATE-AMOUNT)) > 0
           return xs:decimal(normalize-space($d/RETROACTIVE-STATE-AMOUNT))
         return if (exists($stateAmounts)) then sum($stateAmounts) else ()
       }</state_amt_total>
     </r>'
               PASSING XML_FILE1.INVOICE_DETAILS
             COLUMNS
               RETROACTIVE_FEDERAL_COMBINED VARCHAR2(4000) PATH '/r/fed',
               RETROACTIVE_FEDREAL_AMT_CSV VARCHAR2(4000) PATH '/r/fed_amt',
               RETROACTIVE_FEDREAL_AMT_TOTAL NUMBER PATH '/r/fed_amt_total',
               RETROACTIVE_STATE_SUBSIDY_COMBINED VARCHAR2(4000) PATH '/r/state',
               RETROACTIVE_STATE_SUBSDIY_AMT_CSV VARCHAR2(4000) PATH '/r/state_amt',
               RETROACTIVE_STATE_SUBSDIY_AMT_TOTAL NUMBER PATH '/r/state_amt_total'
           ) XML_FILE3
     WHERE B.RGN_CD NOT IN ( 'NCR',
                             'SCR' )
       AND B.KPMC_MARKET_SEGMENT IN ( 'INDON',
                                      'INDOFF' )
       AND B.BATCH_NBR = V_BATCH_NBR;

  DECLARE
    V_INVOICES_ROC NUMBER := SQL%ROWCOUNT;
  BEGIN
    SET_RUN_STATUS(
      P_STATUS       => 'KPIF_CMP_SOURCE_ROC_XML INSERTION COMPLETED',
      P_STEP         => 'SOURCE ROC INSERT',
      P_NEXT_STEP    => 'TARGET ORMB INSERT',
      P_INVOICES_ROC => V_INVOICES_ROC
    );
  END;

  CHECK_CANCELED;

  --------------------------------------------------------------------
  -- Load TARGET ORMB (from ormb.sql)
  --------------------------------------------------------------------
  INSERT INTO COMPARE_OWNER.KPIF_CMP_TARGET_ORMB (
    BILL_ID,
    BATCH_NBR,
    REGION,
    LOB,
    PAST_DUE_DT,
    PAST_DUE_AMT,
    PAST_COVERAGE_PERIOD,
    ORMB_ACCT_ID,
    COVERAGE_START_DATE,
    COVERAGE_END_DATE,
    ACTIVITY_PERIOD,
    ACTIVITY_START_DATE,
    ACTIVITY_END_DATE,
    DUE_DATE,
    AUTOPAY_IND,
    PAID_FROM_DT,
    PAID_THROUGH_DT,
    PREVIOUS_BALANCE,
    PAY_AMT,
    CANCEL_PAY_AMT,
    NET_PAY_AMT,
    CM_TOT_RETRO_CHRG_AMT, -- This is same as RETRO_DUES
    CM_TOT_RETRO_CHRG_CURR_NONPREM_AMT,
    CURRENT_DUE,
    PAST_DUE_TOTAL_AMOUNT,
    RETRO_DUES, -- This can be repurposed into RETRO_SUBSIDY
    ADJUSTMENT_AMT,
    OTHER_ADJUSTMENTS,
    TOTAL_CURRENT_CHARGES,
    CURRENT_BALANCE,
    TOTAL_AMOUNT_DUE,
    APTC,
    RETRO_APTC,
    STATE_SUBSIDY,
    RETRO_STATE_SUBSIDY,
    STATE_PRE_CREDIT,
    RETRO_STATE_PRE_CREDIT,
    LIS_AMT,
    WS_RDUE_LIS_AMT,
    LEP_AMT,
    WS_RDUE_LEP_AMT,
    SUBSCRIBER_MRN,
    RETRO_DUE_WITHOUT_LIS_AMT,
    PAY_DETAIL_DATE,
    PAY_DETAIL_AMOUNT,
    FEDERAL_RETRO_DETAIL,
    STATE_RETRO_DETAIL
  )
    WITH BILL_SCOPE AS (
      SELECT DISTINCT BR.BILL_ID,
                      BR.BATCH_NBR
        FROM BILLING_OWNER.CI_BILL_ROUTING BR
       WHERE BR.BATCH_CD = 'CM-BILEX'
         AND BR.BATCH_NBR = V_BATCH_NBR
    ),BILL_LATEST AS (
      SELECT X.BILL_ID,
             X.BILL_DT,
             X.COV_START_DT,
             X.COV_END_DT,
             X.DUE_DT,
             X.CM_EXT_SEQ_NUM,
             X.ACCT_ID,
             X.PAID_FROM_DT,
             X.PAID_THROUGH_DT,
             X.ACCT_NBR,
             X.LOB,
             X.CM_RGI,
             X.CM_PREV_BAL,
             X.PAY_AMT,
             X.CM_CANC_PAY_AMT,
             X.CM_NET_PAY_AMT,
             X.CM_TOT_BAL_AMT,
             X.CM_TOT_RETRO_CHRG_AMT,
             X.CM_TOT_RETRO_CHRG_CURR_NONPREM_AMT,
             X.CM_TOT_RETRO_SUBSDY_AMT,
             X.TOT_ADJ_AMT,
             X.CM_MED_ANC_CHRG,
             X.CM_MED_PREM_AMT,
             X.CM_CURR_ANC_LIS_LEP_AMT,
             X.CM_BU_NAME,
             X.BATCH_NBR
        FROM (
        SELECT CEB.BILL_ID,
               CEB.BILL_DT,
               CEB.COV_START_DT,
               CEB.COV_END_DT,
               CEB.DUE_DT,
               CEB.CM_EXT_SEQ_NUM,
               CEBA.ACCT_ID,
               CASE
                 WHEN CEB.CM_PREV_BILL_DT IS NOT NULL THEN
                   TO_CHAR(
                     CEB.CM_PREV_BILL_DT,
                     'YYYY-MM-DD'
                   )
                 ELSE
                   TO_CHAR(
                     ADD_MONTHS(
                       CEB.BILL_DT,
                       -1
                     ),
                     'YYYY-MM-DD'
                   )
               END PAID_FROM_DT,
               TO_CHAR(
                 CEB.BILL_DT,
                 'YYYY-MM-DD'
               ) PAID_THROUGH_DT,
               CEBA.ACCT_NBR,
               CEBA.CUST_CL_CD LOB,
               CEBA.CM_RGI,
               CEBA.CM_PREV_BAL,
               CEBA.PAY_AMT,
               CEBA.CM_CANC_PAY_AMT,
               CEBA.CM_NET_PAY_AMT,
               CEBA.CM_TOT_BAL_AMT,
               CEBA.CM_TOT_RETRO_CHRG_AMT,
               CEBA.CM_TOT_RETRO_CHRG_CURR_NONPREM_AMT,
               CEBA.TOT_ADJ_AMT,
               CEBA.CM_MED_ANC_CHRG,
               CEBA.CM_MED_PREM_AMT,
               CEBA.CM_CURR_ANC_LIS_LEP_AMT,
               CEBA.CM_BU_NAME,
               BS.BATCH_NBR,
               CEBH.CM_TOT_RETRO_SUBSDY_AMT,
               ROW_NUMBER()
               OVER(PARTITION BY CEB.BILL_ID
                    ORDER BY CEB.CM_EXT_SEQ_NUM DESC
               ) RN
          FROM BILL_SCOPE BS
         INNER JOIN BILLING_OWNER.CM_EXTR_BILL CEB
        ON BS.BILL_ID = CEB.BILL_ID
         INNER JOIN BILLING_OWNER.CM_EXTR_BILL_ACCT CEBA
        ON CEB.BILL_ID = CEBA.BILL_ID
         INNER JOIN BILLING_OWNER.CM_EXTR_BILL_HDR CEBH
        ON CEBA.BILL_ID = CEBH.BILL_ID
           AND CEB.CM_EXT_SEQ_NUM = CEBA.CM_EXT_SEQ_NUM
         WHERE CEBA.CUST_CL_CD IN ( 'INDOFF',
                                    'INDON' )
      ) X
       WHERE X.RN = 1
    ),EBO_AGG AS (
      SELECT BL.BILL_ID,
             BL.CM_EXT_SEQ_NUM,
             LISTAGG(TO_CHAR(
               EBO.DUE_DT,
               'MM/DD/YYYY'
             ),
                     ', ' ON OVERFLOW TRUNCATE '||OVF||' WITHOUT COUNT) WITHIN GROUP(
              ORDER BY EBO.DUE_DT,
                       EBO.CM_BILL_UNPAID_AMT) PAST_DUE_DT,
             LISTAGG(TO_CHAR(EBO.CM_BILL_UNPAID_AMT),
                     ', ' ON OVERFLOW TRUNCATE '||OVF||' WITHOUT COUNT) WITHIN GROUP(
              ORDER BY EBO.DUE_DT,
                       EBO.CM_BILL_UNPAID_AMT) PAST_DUE_AMT,
             SUM(EBO.CM_BILL_UNPAID_AMT) PAST_DUE_TOTAL_AMOUNT,
             LISTAGG(EBO.CM_COV_PERIOD,
                     ', ' ON OVERFLOW TRUNCATE '||OVF||' WITHOUT COUNT) WITHIN GROUP(
              ORDER BY TO_DATE(EBO.CM_COV_PERIOD,
               'MON-YYYY',
               'NLS_DATE_LANGUAGE=ENGLISH'),
                       EBO.CM_BILL_UNPAID_AMT) PAST_COVERAGE_PERIOD
        FROM BILL_LATEST BL
        LEFT JOIN BILLING_OWNER.CM_EXTR_BILL_OPEN EBO
      ON BL.BILL_ID = EBO.BILL_ID
         AND BL.CM_EXT_SEQ_NUM = EBO.CM_EXT_SEQ_NUM
       GROUP BY BL.BILL_ID,
                BL.CM_EXT_SEQ_NUM
    ),SUBSIDY_SRC AS (
      SELECT BL.BILL_ID,
             BL.CM_EXT_SEQ_NUM,
             EBSNPD.CHRG_DESCR,
             EBSNPD.CM_RETRO_SW,
             EBSNPD.CM_TOT_COV_AMT AMT
        FROM BILL_LATEST BL
       INNER JOIN BILLING_OWNER.CM_EXTR_BILL_SUB_NONPREM_DTL EBSNPD
      ON BL.BILL_ID = EBSNPD.BILL_ID
         AND BL.CM_EXT_SEQ_NUM = EBSNPD.CM_EXT_SEQ_NUM
      UNION ALL
      SELECT BL.BILL_ID,
             BL.CM_EXT_SEQ_NUM,
             EBSNPC.CHRG_DESCR,
             EBSNPC.CM_RETRO_SW,
             EBSNPC.TOT_AMT AMT
        FROM BILL_LATEST BL
       INNER JOIN BILLING_OWNER.CM_EXTR_BILL_SUB_NONPREM_CORR EBSNPC
      ON BL.BILL_ID = EBSNPC.BILL_ID
         AND BL.CM_EXT_SEQ_NUM = EBSNPC.CM_EXT_SEQ_NUM
    ),SUBSIDY_AGG AS (
      SELECT SS.BILL_ID,
             SS.CM_EXT_SEQ_NUM,
             SUM(
               CASE
                 WHEN SS.CHRG_DESCR LIKE '%APTC%'
                    AND SS.CM_RETRO_SW = 'N' THEN
                   NVL(
                     SS.AMT,
                     0
                   )
                 ELSE
                   0
               END
             ) APTC,
             SUM(
               CASE
                 WHEN SS.CHRG_DESCR LIKE '%APTC%'
                    AND SS.CM_RETRO_SW = 'Y' THEN
                   NVL(
                     SS.AMT,
                     0
                   )
                 ELSE
                   0
               END
             ) RETRO_APTC,
             SUM(
               CASE
                 WHEN(SS.CHRG_DESCR LIKE 'State Subsidy%'
                     OR UPPER(SS.CHRG_DESCR) LIKE 'STATE SUBSIDY%')
                    AND SS.CM_RETRO_SW = 'N' THEN
                   NVL(
                     SS.AMT,
                     0
                   )
                 ELSE
                   0
               END
             ) STATE_SUBSIDY,
             SUM(
               CASE
                 WHEN(SS.CHRG_DESCR LIKE 'State Subsidy%'
                     OR UPPER(SS.CHRG_DESCR) LIKE 'STATE SUBSIDY%')
                    AND SS.CM_RETRO_SW = 'Y' THEN
                   NVL(
                     SS.AMT,
                     0
                   )
                 ELSE
                   0
               END
             ) RETRO_STATE_SUBSIDY,
             SUM(
               CASE
                 WHEN SS.CHRG_DESCR LIKE '%Premium Credit State Subsidy%'
                    AND SS.CM_RETRO_SW = 'N' THEN
                   NVL(
                     SS.AMT,
                     0
                   )
                 ELSE
                   0
               END
             ) STATE_PRE_CREDIT,
             SUM(
               CASE
                 WHEN SS.CHRG_DESCR LIKE '%Premium Credit State Subsidy%'
                    AND SS.CM_RETRO_SW = 'Y' THEN
                   NVL(
                     SS.AMT,
                     0
                   )
                 ELSE
                   0
               END
             ) RETRO_STATE_PRE_CREDIT,
             SUM(
               CASE
                 WHEN SS.CHRG_DESCR LIKE '%Low Income Subsidy%'
                    AND SS.CM_RETRO_SW = 'N' THEN
                   NVL(
                     SS.AMT,
                     0
                   )
                 ELSE
                   0
               END
             ) LIS_AMT,
             SUM(
               CASE
                 WHEN SS.CHRG_DESCR LIKE '%Low Income Subsidy%'
                    AND SS.CM_RETRO_SW = 'Y' THEN
                   NVL(
                     SS.AMT,
                     0
                   )
                 ELSE
                   0
               END
             ) WS_RDUE_LIS_AMT,
             SUM(
               CASE
                 WHEN SS.CHRG_DESCR LIKE '%Late Enrollment Penalty%'
                     OR SS.CHRG_DESCR LIKE '%LEP FEE%'
                    AND SS.CM_RETRO_SW = 'N' THEN
                   NVL(
                     SS.AMT,
                     0
                   )
                 ELSE
                   0
               END
             ) LEP_AMT,
             SUM(
               CASE
                 WHEN SS.CHRG_DESCR LIKE '%Late Enrollment Penalty%'
                     OR SS.CHRG_DESCR LIKE '%LEP FEE%'
                    AND SS.CM_RETRO_SW = 'Y' THEN
                   NVL(
                     SS.AMT,
                     0
                   )
                 ELSE
                   0
               END
             ) WS_RDUE_LEP_AMT
        FROM SUBSIDY_SRC SS
       GROUP BY SS.BILL_ID,
                SS.CM_EXT_SEQ_NUM
    ),RETRO_SUBSIDY_DETAIL AS (
      SELECT T.BILL_ID,
             LISTAGG(
               CASE
                 WHEN(T.CHRG_DESCR = 'APTC Subsidy'
                     OR T.CHRG_DESCR = 'APTC') THEN
                   (T.COVERGAE_PERIOD
                    || '=' || T.SNPD_CM_TOT_COV_AMT)
               END,
               ', ' ON OVERFLOW TRUNCATE '||OVF||' WITHOUT COUNT) WITHIN GROUP(
              ORDER BY T.START_DT,
                       T.SNPD_CM_TOT_COV_AMT) FEDERAL_RETRO_DETAIL,
             LISTAGG(
               CASE
                 WHEN T.CHRG_DESCR = 'State Subsidy'
                     OR UPPER(T.CHRG_DESCR) = 'STATE SUBSIDY' THEN
                   (T.COVERGAE_PERIOD
                    || '=' || T.SNPD_CM_TOT_COV_AMT)
               END,
               ', ' ON OVERFLOW TRUNCATE '||OVF||' WITHOUT COUNT) WITHIN GROUP(
              ORDER BY T.START_DT,
                       T.SNPD_CM_TOT_COV_AMT) STATE_RETRO_DETAIL
        FROM (
        SELECT BL.BILL_ID,
               EBSNPD.CHRG_DESCR,
               EBSNPD.START_DT,
               TO_CHAR(
                 EBSNPD.START_DT,
                 'MON'
               )
               || '-'
               || EXTRACT(YEAR FROM EBSNPD.START_DT) COVERGAE_PERIOD,
               EBSNPD.CM_TOT_COV_AMT SNPD_CM_TOT_COV_AMT
          FROM BILL_LATEST BL
         INNER JOIN BILLING_OWNER.CM_EXTR_BILL_SUB EBS
        ON BL.BILL_ID = EBS.BILL_ID
           AND EBS.CM_EXT_SEQ_NUM = BL.CM_EXT_SEQ_NUM
         INNER JOIN BILLING_OWNER.CM_EXTR_BILL_SUB_NONPREM_DTL EBSNPD
        ON EBSNPD.BILL_ID = EBS.BILL_ID
           AND EBSNPD.CM_EXT_SEQ_NUM = EBS.CM_EXT_SEQ_NUM
           AND EBSNPD.POLICY_ID = EBS.POLICY_ID
           AND EBSNPD.PLAN_ID = EBS.PLAN_ID
           AND EBSNPD.MEMBERSHIP_ID = EBS.MEMBERSHIP_ID
           AND EBSNPD.CM_RETRO_SW = 'Y'
           AND ( EBSNPD.CHRG_DESCR LIKE ( 'APTC%' )
            OR UPPER(EBSNPD.CHRG_DESCR) LIKE ( 'STATE%' ) )
          --AND EBSNPD.CHRG_DESCR IN ('APTC Subsidy', 'State Subsidy')
         WHERE EBSNPD.START_DT IS NOT NULL
        UNION ALL
        SELECT BL.BILL_ID,
               EBSNPC.CHRG_DESCR,
               EBSNPC.START_DT,
               TO_CHAR(
                 EBSNPC.START_DT,
                 'MON'
               )
               || '-'
               || EXTRACT(YEAR FROM EBSNPC.START_DT) COVERGAE_PERIOD,
               EBSNPC.TOT_AMT SNPD_CM_TOT_COV_AMT
          FROM BILL_LATEST BL
         INNER JOIN BILLING_OWNER.CM_EXTR_BILL_SUB EBS
        ON BL.BILL_ID = EBS.BILL_ID
           AND EBS.CM_EXT_SEQ_NUM = BL.CM_EXT_SEQ_NUM
         INNER JOIN BILLING_OWNER.CM_EXTR_BILL_SUB_NONPREM_CORR EBSNPC
        ON EBSNPC.BILL_ID = EBS.BILL_ID
           AND EBSNPC.CM_EXT_SEQ_NUM = EBS.CM_EXT_SEQ_NUM
           AND EBSNPC.POLICY_ID = EBS.POLICY_ID
           AND EBSNPC.PLAN_ID = EBS.PLAN_ID
           AND EBSNPC.MEMBERSHIP_ID = EBS.MEMBERSHIP_ID
           AND EBSNPC.CM_RETRO_SW = 'Y'
           AND ( EBSNPC.CHRG_DESCR LIKE ( 'APTC%' )
            OR UPPER(EBSNPC.CHRG_DESCR) LIKE ( 'STATE%' ) )
          --AND EBSNPC.CHRG_DESCR IN ('APTC Subsidy', 'State Subsidy')
         WHERE EBSNPC.START_DT IS NOT NULL
      ) T
       GROUP BY T.BILL_ID
    ),OTHER_ADJ_AGG AS (
      SELECT BL.BILL_ID,
             NVL(
               BL.TOT_ADJ_AMT,
               0
             ) + NVL(
               CEBSPD_AGG.TOT_CM_TOT_COV_AMT,
               0
             ) + NVL(
               CEBSPC_AGG.TOT_AMT,
               0
             ) + NVL(
               CEBSND_AGG.TOT_CM_TOT_COV_AMT,
               0
             ) + NVL(
               CEBSNC_AGG.TOT_AMT,
               0
             ) AS TOTAL_OTHER_ADJ
        FROM BILL_LATEST BL
        LEFT OUTER JOIN (
        SELECT BILL_ID,
               SUM(CM_TOT_COV_AMT) AS TOT_CM_TOT_COV_AMT
          FROM BILLING_OWNER.CM_EXTR_BILL_SUB_PREM_DTL
         WHERE CM_RETRO_SW = 'Y'
         GROUP BY BILL_ID
      ) CEBSPD_AGG
      ON BL.BILL_ID = CEBSPD_AGG.BILL_ID
        LEFT OUTER JOIN (
        SELECT BILL_ID,
               SUM(TOT_AMT) AS TOT_AMT
          FROM BILLING_OWNER.CM_EXTR_BILL_SUB_PREM_CORR
         WHERE CM_RETRO_SW = 'Y'
         GROUP BY BILL_ID
      ) CEBSPC_AGG
      ON BL.BILL_ID = CEBSPC_AGG.BILL_ID
        LEFT OUTER JOIN (
        SELECT BILL_ID,
               SUM(CM_TOT_COV_AMT) AS TOT_CM_TOT_COV_AMT
          FROM BILLING_OWNER.CM_EXTR_BILL_SUB_NONPREM_DTL
         WHERE CM_RETRO_SW = 'Y'
           AND CHRG_DESCR NOT IN ( 'APTC Subsidy',
                                   'APTC Offset Subsidy',
                                   'APTC',
                                   'State Subsidy',
                                   'STATE SUBSIDY',
                                   'State Offset Subsidy' )
           AND CHRG_DESCR NOT LIKE '%APTC%'
         GROUP BY BILL_ID
      ) CEBSND_AGG
      ON BL.BILL_ID = CEBSND_AGG.BILL_ID
        LEFT OUTER JOIN (
        SELECT BILL_ID,
               SUM(TOT_AMT) AS TOT_AMT
          FROM BILLING_OWNER.CM_EXTR_BILL_SUB_NONPREM_CORR
         WHERE CM_RETRO_SW = 'Y'
           AND CHRG_DESCR NOT IN ( 'APTC Subsidy',
                                   'APTC Offset Subsidy',
                                   'APTC',
                                   'State Subsidy',
                                   'STATE SUBSIDY',
                                   'State Offset Subsidy' )
           AND CHRG_DESCR NOT LIKE '%APTC%'
         GROUP BY BILL_ID
      ) CEBSNC_AGG
      ON BL.BILL_ID = CEBSNC_AGG.BILL_ID
    ),FT_ACCT_SCOPE AS (
      SELECT DISTINCT BL.ACCT_ID
        FROM BILL_LATEST BL
    ),FT_AGG AS (
      SELECT SA.ACCT_ID,
             SUM(FT.CUR_AMT) CURRENT_BALANCE
        FROM FT_ACCT_SCOPE FAS
       INNER JOIN BILLING_OWNER.CI_SA SA
      ON FAS.ACCT_ID = SA.ACCT_ID
       INNER JOIN BILLING_OWNER.CI_FT FT
      ON SA.SA_ID = FT.SA_ID
       WHERE FT.FREEZE_SW = 'Y'
       GROUP BY SA.ACCT_ID
    ),AUTOPAY_AGG AS (
      SELECT BL.BILL_ID,
             BL.CM_EXT_SEQ_NUM,
             MAX(EBAP.CM_APAY_SCH_DT) AUTOPAY_SCHEDULE_DATE
        FROM BILL_LATEST BL
        LEFT JOIN BILLING_OWNER.CM_EXTR_BILL_AUTOPAY EBAP
      ON BL.BILL_ID = EBAP.BILL_ID
         AND BL.CM_EXT_SEQ_NUM = EBAP.CM_EXT_SEQ_NUM
       GROUP BY BL.BILL_ID,
                BL.CM_EXT_SEQ_NUM
    ),PAY_AGG AS (
      SELECT X.BILL_ID,
             X.CM_EXT_SEQ_NUM,
             LISTAGG((TO_CHAR(
               X.PAY_DT,
               'MM/DD/YYYY'
             )),
                     ', ' ON OVERFLOW TRUNCATE '||OVF||' WITHOUT COUNT) WITHIN GROUP(
              ORDER BY X.PAY_DT,
                       X.PAY_AMT) PAY_DETAIL_DATE,
             LISTAGG(X.PAY_AMT,
                     ', ' ON OVERFLOW TRUNCATE '||OVF||' WITHOUT COUNT) WITHIN GROUP(
              ORDER BY X.PAY_DT,
                       X.PAY_AMT) PAY_DETAIL_AMOUNT
        FROM (
        SELECT BL.BILL_ID,
               BL.CM_EXT_SEQ_NUM,
               EBP.PAY_DT,
               EBP.PAY_AMT,
               ROW_NUMBER()
               OVER(PARTITION BY BL.BILL_ID,
                                 BL.CM_EXT_SEQ_NUM
                    ORDER BY EBP.PAY_DT,
                             EBP.PAY_AMT
               ) RN
          FROM BILL_LATEST BL
          LEFT JOIN BILLING_OWNER.CM_EXTR_BILL_PAY EBP
        ON BL.BILL_ID = EBP.BILL_ID
           AND BL.CM_EXT_SEQ_NUM = EBP.CM_EXT_SEQ_NUM
         WHERE EBP.PAY_STATUS_FLG != '60'
      ) X
       WHERE X.RN <= 30
       GROUP BY X.BILL_ID,
                X.CM_EXT_SEQ_NUM
    ),ADDR_BILL AS (
      SELECT X.BILL_ID,
             X.CM_EXT_SEQ_NUM,
             X.ADDRESS_TYPE_FLG,
             X.ADDRESS1,
             X.ADDRESS2,
             X.COUNTY,
             X.CITY,
             X.STATE,
             X.POSTAL,
             X.COUNTRY
        FROM (
        SELECT EBADR.BILL_ID,
               EBADR.CM_EXT_SEQ_NUM,
               EBADR.ADDRESS_TYPE_FLG,
               EBADR.ADDRESS1,
               EBADR.ADDRESS2,
               EBADR.COUNTY,
               EBADR.CITY,
               EBADR.STATE,
               EBADR.POSTAL,
               EBADR.COUNTRY,
               ROW_NUMBER()
               OVER(PARTITION BY EBADR.BILL_ID,
                                 EBADR.CM_EXT_SEQ_NUM
                    ORDER BY EBADR.ROWID DESC
               ) RN
          FROM BILLING_OWNER.CM_EXTR_BILL_ADDR EBADR
         INNER JOIN BILL_LATEST BL
        ON EBADR.BILL_ID = BL.BILL_ID
           AND EBADR.CM_EXT_SEQ_NUM = BL.CM_EXT_SEQ_NUM
         WHERE EBADR.ADDRESS_TYPE_FLG = 'BILL'
      ) X
       WHERE X.RN = 1
    ),CONTACT_MAIN AS (
      SELECT X.BILL_ID,
             X.CM_EXT_SEQ_NUM,
             X.ENTITY_NAME
        FROM (
        SELECT CEBC.BILL_ID,
               CEBC.CM_EXT_SEQ_NUM,
               CEBC.ENTITY_NAME,
               ROW_NUMBER()
               OVER(PARTITION BY CEBC.BILL_ID,
                                 CEBC.CM_EXT_SEQ_NUM
                    ORDER BY CEBC.ROWID DESC
               ) RN
          FROM BILLING_OWNER.CM_EXTR_BILL_CONTACT CEBC
         INNER JOIN BILL_LATEST BL
        ON CEBC.BILL_ID = BL.BILL_ID
           AND CEBC.CM_EXT_SEQ_NUM = BL.CM_EXT_SEQ_NUM
         WHERE CEBC.PER_REL_TYPE_CD = 'MAIN'
      ) X
       WHERE X.RN = 1
    ),SUBSCRIBER_MRN AS (
      SELECT X.BILL_ID,
             X.CM_MEM_RMRN,
             X.CM_SUBGROUP_ID
        FROM (
        SELECT EBSM.BILL_ID,
               EBSM.CM_MEM_RMRN,
               EBSM.CM_SUBGROUP_ID,
               ROW_NUMBER()
               OVER(PARTITION BY EBSM.BILL_ID
                    ORDER BY EBSM.ROWID DESC
               ) RN
          FROM BILLING_OWNER.CM_EXTR_BILL_SUB_MEM EBSM
         INNER JOIN BILL_LATEST BL
        ON EBSM.BILL_ID = BL.BILL_ID
         WHERE EBSM.SA_REL_TYPE_CD IN ( 'SB',
                                        'NCS' )
           AND EBSM.ID_TYPE_CD = 'RMRN'
      ) X
       WHERE X.RN = 1
    ),MAX_BILL_SEQ_NUM AS (
      SELECT BL.BILL_ID,
             BL.BILL_DT,
             BL.COV_START_DT,
             BL.COV_END_DT,
             BL.DUE_DT,
             BL.CM_EXT_SEQ_NUM MAX_CM_EXT_SEQ_NUM,
             BL.ACCT_ID,
             BL.PAID_FROM_DT,
             BL.PAID_THROUGH_DT,
             BL.ACCT_NBR,
             BL.LOB,
             BL.CM_RGI,
             BL.CM_PREV_BAL,
             BL.PAY_AMT,
             BL.CM_CANC_PAY_AMT,
             BL.CM_NET_PAY_AMT,
             BL.CM_TOT_BAL_AMT,
             BL.CM_TOT_RETRO_CHRG_AMT,
             BL.CM_TOT_RETRO_CHRG_CURR_NONPREM_AMT,
             BL.CM_TOT_RETRO_SUBSDY_AMT,
             BL.TOT_ADJ_AMT,
             BL.CM_MED_ANC_CHRG,
             BL.CM_MED_PREM_AMT,
             BL.CM_CURR_ANC_LIS_LEP_AMT,
             BL.CM_BU_NAME,
             BL.BATCH_NBR,
             CASE
               WHEN EBOA.PAST_DUE_DT LIKE '%||OVF||'
                   OR LENGTH(EBOA.PAST_DUE_DT) > 4000 THEN
                 '##OVERFLOW_T##'
               ELSE
                 EBOA.PAST_DUE_DT
             END PAST_DUE_DT,
             CASE
               WHEN EBOA.PAST_DUE_AMT LIKE '%||OVF||'
                   OR LENGTH(EBOA.PAST_DUE_AMT) > 4000 THEN
                 '##OVERFLOW_T##'
               ELSE
                 EBOA.PAST_DUE_AMT
             END PAST_DUE_AMT,
             NVL(
               EBOA.PAST_DUE_TOTAL_AMOUNT,
               0
             ) PAST_DUE_TOTAL_AMOUNT,
             CASE
               WHEN EBOA.PAST_COVERAGE_PERIOD LIKE '%||OVF||'
                   OR LENGTH(EBOA.PAST_COVERAGE_PERIOD) > 4000 THEN
                 '##OVERFLOW_T##'
               ELSE
                 EBOA.PAST_COVERAGE_PERIOD
             END PAST_COVERAGE_PERIOD,
             NVL(
               SA.APTC,
               0
             ) APTC,
             NVL(
               SA.RETRO_APTC,
               0
             ) RETRO_APTC,
             NVL(
               SA.STATE_SUBSIDY,
               0
             ) STATE_SUBSIDY,
             NVL(
               SA.RETRO_STATE_SUBSIDY,
               0
             ) RETRO_STATE_SUBSIDY,
             NVL(
               SA.STATE_PRE_CREDIT,
               0
             ) STATE_PRE_CREDIT,
             NVL(
               SA.RETRO_STATE_PRE_CREDIT,
               0
             ) RETRO_STATE_PRE_CREDIT,
             NVL(
               SA.LIS_AMT,
               0
             ) LIS_AMT,
             NVL(
               SA.WS_RDUE_LIS_AMT,
               0
             ) WS_RDUE_LIS_AMT,
             NVL(
               SA.LEP_AMT,
               0
             ) LEP_AMT,
             NVL(
               SA.WS_RDUE_LEP_AMT,
               0
             ) WS_RDUE_LEP_AMT,
             NVL(
               OAA.TOTAL_OTHER_ADJ,
               0
             ) OTHER_ADJUSTMENTS,
             NVL(
               FTA.CURRENT_BALANCE,
               0
             ) CURRENT_BALANCE
        FROM BILL_LATEST BL
        LEFT JOIN EBO_AGG EBOA
      ON BL.BILL_ID = EBOA.BILL_ID
         AND BL.CM_EXT_SEQ_NUM = EBOA.CM_EXT_SEQ_NUM
        LEFT JOIN SUBSIDY_AGG SA
      ON BL.BILL_ID = SA.BILL_ID
         AND BL.CM_EXT_SEQ_NUM = SA.CM_EXT_SEQ_NUM
        LEFT JOIN FT_AGG FTA
      ON BL.ACCT_ID = FTA.ACCT_ID
        LEFT JOIN OTHER_ADJ_AGG OAA
      ON BL.BILL_ID = OAA.BILL_ID
    ),KPMC_MOC_COMMERCIAL_MOT AS (
      SELECT MBSN.BILL_ID,
             MBSN.BILL_DT ACTIVITY_PERIOD,
             MBSN.COV_START_DT COVERAGE_START_DATE,
             MBSN.COV_END_DT COVERAGE_END_DATE,
             MBSN.PAID_FROM_DT ACTIVITY_START_DATE,
             MBSN.BILL_DT ACTIVITY_END_DATE,
             MBSN.DUE_DT DUE_DATE,
             MBSN.CURRENT_BALANCE,
             REGEXP_SUBSTR(
               MBSN.ACCT_NBR,
               '[^-]+',
               1,
               1
             ) REGION,
             REGEXP_SUBSTR(
               MBSN.ACCT_NBR,
               '[^-]+',
               1,
               2
             ) GROUP_ID,
             REGEXP_SUBSTR(
               MBSN.ACCT_NBR,
               '[^-]+',
               1,
               3
             ) BILL_GROUP_ID,
             LPAD(
               REGEXP_SUBSTR(
                 MBSN.ACCT_NBR,
                 '[^-]+',
                 1,
                 4
               ),
               9,
               '0'
             ) FAML_SUBSCR_ID,
             CASE
               WHEN REGEXP_SUBSTR(
                 MBSN.ACCT_NBR,
                 '[^-]+',
                 1,
                 1
               ) = 'KNW' THEN
                 10
               WHEN REGEXP_SUBSTR(
                 MBSN.ACCT_NBR,
                 '[^-]+',
                 1,
                 1
               ) = 'HAW' THEN
                 12
               WHEN REGEXP_SUBSTR(
                 MBSN.ACCT_NBR,
                 '[^-]+',
                 1,
                 1
               ) = 'COL' THEN
                 16
               WHEN REGEXP_SUBSTR(
                 MBSN.ACCT_NBR,
                 '[^-]+',
                 1,
                 1
               ) = 'GEO' THEN
                 28
               ELSE
                 NULL
             END REGION_CODE,
             MBSN.LOB,
             MBSN.ACCT_ID ORMB_ACCT_ID,
             MBSN.PAID_FROM_DT,
             MBSN.PAID_THROUGH_DT,
             MBSN.CM_PREV_BAL PREVIOUS_BALANCE,
             MBSN.PAY_AMT,
             MBSN.CM_CANC_PAY_AMT CANCEL_PAY_AMT,
             MBSN.CM_NET_PAY_AMT NET_PAY_AMT,
             MBSN.CM_TOT_RETRO_CHRG_AMT,
             MBSN.CM_TOT_RETRO_CHRG_CURR_NONPREM_AMT,
             MBSN.CM_TOT_RETRO_SUBSDY_AMT,
             ( MBSN.RETRO_APTC + MBSN.RETRO_STATE_SUBSIDY ) RETRO_DUES,
             MBSN.TOT_ADJ_AMT ADJUSTMENT_AMT,
             MBSN.OTHER_ADJUSTMENTS,
             ( MBSN.CM_MED_PREM_AMT + MBSN.CM_CURR_ANC_LIS_LEP_AMT ) CURRENT_DUE,
             MBSN.BATCH_NBR,
             MBSN.PAST_DUE_DT,
             MBSN.PAST_DUE_AMT,
             MBSN.PAST_DUE_TOTAL_AMOUNT,
             MBSN.PAST_COVERAGE_PERIOD,
             APA.AUTOPAY_SCHEDULE_DATE,
             MBSN.APTC,
             MBSN.RETRO_APTC,
             MBSN.STATE_SUBSIDY,
             MBSN.RETRO_STATE_SUBSIDY,
             MBSN.STATE_PRE_CREDIT,
             MBSN.RETRO_STATE_PRE_CREDIT,
             MBSN.LIS_AMT,
             MBSN.WS_RDUE_LIS_AMT,
             MBSN.LEP_AMT,
             MBSN.WS_RDUE_LEP_AMT,
             MBSN.CM_TOT_BAL_AMT,
             SM.CM_MEM_RMRN SUBSCRIBER_MRN,
             SM.CM_SUBGROUP_ID,
             CASE
               WHEN PA.PAY_DETAIL_DATE LIKE '%||OVF||'
                   OR LENGTH(PA.PAY_DETAIL_DATE) > 4000 THEN
                 '##OVERFLOW_T##'
               ELSE
                 PA.PAY_DETAIL_DATE
             END PAY_DETAIL_DATE,
             CASE
               WHEN PA.PAY_DETAIL_AMOUNT LIKE '%||OVF||'
                   OR LENGTH(PA.PAY_DETAIL_AMOUNT) > 4000 THEN
                 '##OVERFLOW_T##'
               ELSE
                 PA.PAY_DETAIL_AMOUNT
             END PAY_DETAIL_AMOUNT,
             RSD.FEDERAL_RETRO_DETAIL,
             RSD.STATE_RETRO_DETAIL
        FROM MAX_BILL_SEQ_NUM MBSN
        LEFT JOIN ADDR_BILL AB
      ON MBSN.BILL_ID = AB.BILL_ID
         AND MBSN.MAX_CM_EXT_SEQ_NUM = AB.CM_EXT_SEQ_NUM
        LEFT JOIN CONTACT_MAIN CM
      ON MBSN.BILL_ID = CM.BILL_ID
         AND MBSN.MAX_CM_EXT_SEQ_NUM = CM.CM_EXT_SEQ_NUM
        LEFT JOIN AUTOPAY_AGG APA
      ON MBSN.BILL_ID = APA.BILL_ID
         AND MBSN.MAX_CM_EXT_SEQ_NUM = APA.CM_EXT_SEQ_NUM
        LEFT JOIN PAY_AGG PA
      ON MBSN.BILL_ID = PA.BILL_ID
         AND MBSN.MAX_CM_EXT_SEQ_NUM = PA.CM_EXT_SEQ_NUM
        LEFT JOIN SUBSCRIBER_MRN SM
      ON MBSN.BILL_ID = SM.BILL_ID
        LEFT JOIN RETRO_SUBSIDY_DETAIL RSD
      ON MBSN.BILL_ID = RSD.BILL_ID
    )
    SELECT K.BILL_ID,
           K.BATCH_NBR,
           K.REGION,
           K.LOB,
           K.PAST_DUE_DT,
           K.PAST_DUE_AMT,
           K.PAST_COVERAGE_PERIOD,
           CASE
             WHEN K.LOB NOT IN ( 'INDON',
                                 'DIRECTBL' )
                AND K.REGION IN ( 'SCR',
                                  'NCR' ) THEN
               LPAD(
                 K.FAML_SUBSCR_ID,
                 9,
                 '0'
               )
             ELSE
               K.ORMB_ACCT_ID
           END ORMB_ACCT_ID,
           TO_CHAR(
             K.COVERAGE_START_DATE,
             'MM/DD/YYYY'
           ) COVERAGE_START_DATE,
           TO_CHAR(
             K.COVERAGE_END_DATE,
             'MM/DD/YYYY'
           ) COVERAGE_END_DATE,
           TO_CHAR(
             K.ACTIVITY_PERIOD,
             'MM/DD/YYYY'
           ) ACTIVITY_PERIOD,
           TO_CHAR(
             TO_DATE(K.ACTIVITY_START_DATE,
                   'YYYY-MM-DD'),
             'MM/DD/YYYY'
           ) ACTIVITY_START_DATE,
           TO_CHAR(
             K.ACTIVITY_END_DATE,
             'MM/DD/YYYY'
           ) ACTIVITY_END_DATE,
           TO_CHAR(
             K.DUE_DATE,
             'MM/DD/YYYY'
           ) AS DUE_DATE,
           CASE
             WHEN K.AUTOPAY_SCHEDULE_DATE IS NULL THEN
               'N'
             ELSE
               'Y'
           END AUTOPAY_IND,
           K.PAID_FROM_DT,
           K.PAID_THROUGH_DT,
           K.PREVIOUS_BALANCE,
           K.PAY_AMT,
           K.CANCEL_PAY_AMT,
           K.NET_PAY_AMT,
           K.CM_TOT_RETRO_CHRG_AMT,
           K.CM_TOT_RETRO_CHRG_CURR_NONPREM_AMT,
           K.CURRENT_DUE,
           K.PAST_DUE_TOTAL_AMOUNT,
           K.RETRO_DUES,
           K.ADJUSTMENT_AMT,
           K.OTHER_ADJUSTMENTS,
           ( K.CM_TOT_RETRO_CHRG_AMT + K.ADJUSTMENT_AMT + K.CURRENT_DUE + K.PREVIOUS_BALANCE + K.NET_PAY_AMT ) TOTAL_CURRENT_CHARGES
           , -- TOTAL BALANCE
           K.CURRENT_BALANCE,
           CASE
             WHEN K.REGION IN ( 'SCR',
                                'NCR' ) THEN
               K.CM_TOT_BAL_AMT -- SUB TOTAL for SCR and NCR
             ELSE
               ( K.CURRENT_DUE + K.PREVIOUS_BALANCE + K.NET_PAY_AMT )
           END TOTAL_AMOUNT_DUE,
           K.APTC,
           K.RETRO_APTC,
           K.STATE_SUBSIDY,
           K.RETRO_STATE_SUBSIDY,
           K.STATE_PRE_CREDIT,
           K.RETRO_STATE_PRE_CREDIT,
           K.LIS_AMT,
           K.WS_RDUE_LIS_AMT,
           K.LEP_AMT,
           K.WS_RDUE_LEP_AMT,
           K.SUBSCRIBER_MRN,
           ( K.CM_TOT_RETRO_CHRG_AMT - K.WS_RDUE_LIS_AMT ) RETRO_DUE_WITHOUT_LIS_AMT,
           K.PAY_DETAIL_DATE,
           K.PAY_DETAIL_AMOUNT,
           K.FEDERAL_RETRO_DETAIL,
           K.STATE_RETRO_DETAIL
      FROM KPMC_MOC_COMMERCIAL_MOT K
     ORDER BY BILL_ID;

  DECLARE
    V_TOTAL_RECORDS_ORMB NUMBER := SQL%ROWCOUNT;
  BEGIN
    SET_RUN_STATUS(
      P_STATUS             => 'KPIF_CMP_TARGET_ORMB INSERTION COMPLETED',
      P_STEP               => 'TARGET ORMB INSERT',
      P_NEXT_STEP          => 'RESULTS COMPARISON INSERT',
      P_TOTAL_RECORDS_ORMB => V_TOTAL_RECORDS_ORMB
    );
  END;

  CHECK_CANCELED;

  --------------------------------------------------------------------
  -- Build final comparison rowset KPIF_CMP_RESULTS
  --------------------------------------------------------------------
  INSERT INTO COMPARE_OWNER.KPIF_CMP_RESULTS (
    RUN_ID,
    BATCH_NBR,
    KPMC_TRANSACTION_ID,
    REGION,
    RGN_CD,
    LOB,
    SUBSCRIBER_MRN,
    JURISDICTION,
    IPB0001_22_MATCH,
    IPB0001_22_S_PRIOR_MONTH_BALANCE,
    IPB0001_22_T_PREVIOUS_BALANCE,
    IPB0001_23_MATCH,
    IPB0001_23_S_ACTIVITY_START_DATE,
    IPB0001_23_T_ACTIVITY_START_DATE,
    IPB0001_23_S_ACTIVITY_END_DATE,
    IPB0001_23_T_ACTIVITY_END_DATE,
    IPB0001_23_S_PAYMENT_RECEIVED,
    IPB0001_23_T_PAY_AMT,
    IPB0001_23_S_REMITTANCE_RVERSAL_AMT,
    IPB0001_23_T_CANCEL_PAY_AMT,
    IPB0001_24_MATCH,
    IPB0001_24_S_PAST_DUE_COVERAGE_PERIOD,
    IPB0001_24_T_PAST_COVERAGE_PERIOD,
    IPB0001_24_S_PAST_DUE_DATE,
    IPB0001_24_T_PAST_DUE_DT,
    IPB0001_24_S_PAST_DUE_AMOUNT,
    IPB0001_24_T_PAST_DUE_AMT,
    IPB0001_24_S_PAST_DUE,
    IPB0001_24_T_PAST_DUE_TOTAL_AMOUNT,
    IPB0001_28_MATCH,
    IPB0001_28_S_PAST_DUE_COVERAGE_PERIOD,
    IPB0001_28_T_PAST_COVERAGE_PERIOD,
    IPB0001_25_MATCH,
    IPB0001_25_S_COVERAGE_THROUGH_MONTH,
    IPB0001_25_T_COVERAGE_END_DATE,
    IPB0001_26_MATCH,
    IPB0001_26_S_RETRO_DUE_WITHOUT_LIS_AMT,
    IPB0001_26_T_RETRO_DUE_WITHOUT_LIS_AMT,
    IPB0001_26_S_RETRO_DUE_LEP_AMT,
    IPB0001_26_T_WS_RDUE_LEP_AMT,
    IPB0001_17_MATCH,
    IPB0001_17_S_SUBTOTAL_DUE,
    IPB0001_17_T_TOTAL_AMOUNT_DUE,
    IPB0001_27_MATCH,
    IPB0001_27_S_PRIOR_MONTH_BALANCE,
    IPB0001_27_T_PRIOR_MONTH_BALANCE,
    IPB0001_27_S_PAYMENT_RECEIVED,
    IPB0001_27_T_PAYMENT_RECEIVED,
    IPB0001_27_S_TOTAL_ADJUSTMENT_AMT,
    IPB0001_27_T_TOTAL_ADJUSTMENT_AMT,
    IPB0001_6_MATCH,
    IPB0001_6_S_BILLING_UNIT_ID,
    IPB0001_6_T_ORMB_ACCT_ID,
    IPB0001_12_MATCH,
    IPB0001_12_S_AUTOPAY_INDICATOR,
    IPB0001_12_T_AUTOPAY_IND,
    IPB0001_16_MATCH,
    IPB0001_16_S_PAYMENT_DUE_DATE,
    IPB0001_16_T_DUE_DATE,
    IPB0001_16_S_PRIOR_MONTH_BALANCE,
    IPB0001_16_T_PREVIOUS_BALANCE,
    IPB0001_16_S_PAYMENT_RECEIVED,
    IPB0001_16_T_PAY_AMT,
    IPB0001_16_S_TOTAL_ADJUSTMENT_AMT,
    IPB0001_16_T_ADJUSTMENT_AMT,
    IPB0001_16_S_RETROACTIVE_DUE,
    IPB0001_16_T_RETRO_DUES,
    IPB0001_3_MATCH,
    IPB0001_3_S_COVERAGE_THROUGH_MONTH,
    IPB0001_3_T_COVERAGE_END_DATE_FOR_MONTH,
    IPB0001_3_S_COVERAGE_THROUGH_YEAR,
    IPB0001_3_T_COVERAGE_END_DATE_FOR_YEAR,
    IPB0001_4_MATCH,
    IPB0001_4_S_INVOICE_GENERATED_DATE,
    IPB0001_4_T_ACTIVITY_PERIOD,
    IPB0001_29_MATCH,
    IPB0001_29_S_RETROACTIVE_FEDERAL_COMBINED,
    IPB0001_29_T_FEDERAL_RETRO_DETAIL,
    IPB0001_29_S_RETROACTIVE_STATE_SUBSIDY_COMBINED,
    IPB0001_29_T_STATE_RETRO_DETAIL,
    IPB0001_29_S_RETROACTIVE_FEDREAL_AMT,
    IPB0001_29_T_APTC,
    IPB0001_29_S_RETROACTIVE_STATE_SUBSDIY_AMT,
    IPB0001_29_T_RETRO_STATE_SUBSIDY,
    IPB0001_29_S_RETROACTIVE_TOTAL_AMOUNT,
    IPB0001_29_T_CM_TOT_RETRO_CHRG_AMT
  )
    SELECT P_RUN_ID,
           S.BATCH_NBR,
           S.KPMC_TRANSACTION_ID,
           S.REGION,
           S.RGN_CD,
           T.LOB,
           T.SUBSCRIBER_MRN,
           S.JURISDICTION,
           CASE
             WHEN NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.PRIOR_MONTH_BALANCE,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.PRIOR_MONTH_BALANCE,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               -99999999999999
             ) = NVL(
               ROUND(
                 T.PREVIOUS_BALANCE,
                 2
               ),
               -99999999999999
             ) THEN
               'Yes'
             ELSE
               'No'
           END AS IPB0001_22_MATCH,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.PRIOR_MONTH_BALANCE,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.PRIOR_MONTH_BALANCE,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_22_S_PRIOR_MONTH_BALANCE,
           T.PREVIOUS_BALANCE AS IPB0001_22_T_PREVIOUS_BALANCE,
           CASE
             WHEN NVL(
                 TRIM(S.ACTIVITY_START_DATE),
                 '~'
               ) = NVL(
                 TRIM(T.ACTIVITY_START_DATE),
                 '~'
               )
                AND NVL(
               TRIM(S.ACTIVITY_END_DATE),
               '~'
             ) = NVL(
               TRIM(T.ACTIVITY_END_DATE),
               '~'
             )
                AND NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.PAYMENT_RECEIVED,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.PAYMENT_RECEIVED,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               -99999999999999
             ) = NVL(
               ROUND(
                 T.PAY_AMT,
                 2
               ),
               -99999999999999
             )
                AND NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.REMITTANCE_RVERSAL_AMT,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.REMITTANCE_RVERSAL_AMT,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               -99999999999999
             ) = NVL(
               ROUND(
                 T.CANCEL_PAY_AMT,
                 2
               ),
               -99999999999999
             ) THEN
               'Yes'
             ELSE
               'No'
           END AS IPB0001_23_MATCH,
           S.ACTIVITY_START_DATE AS IPB0001_23_S_ACTIVITY_START_DATE,
           T.ACTIVITY_START_DATE AS IPB0001_23_T_ACTIVITY_START_DATE,
           S.ACTIVITY_END_DATE AS IPB0001_23_S_ACTIVITY_END_DATE,
           T.ACTIVITY_END_DATE AS IPB0001_23_T_ACTIVITY_END_DATE,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.PAYMENT_RECEIVED,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.PAYMENT_RECEIVED,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_23_S_PAYMENT_RECEIVED,
           T.PAY_AMT AS IPB0001_23_T_PAY_AMT,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.REMITTANCE_RVERSAL_AMT,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.REMITTANCE_RVERSAL_AMT,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_23_S_REMITTANCE_RVERSAL_AMT,
           T.CANCEL_PAY_AMT AS IPB0001_23_T_CANCEL_PAY_AMT,
           CASE
             WHEN S.PAST_DUE_COVERAGE_PERIODS = '##OVERFLOW_S##'
                 OR T.PAST_COVERAGE_PERIOD = '##OVERFLOW_T##'
                 OR S.PAST_DUE_DATES = '##OVERFLOW_S##'
                 OR T.PAST_DUE_DT = '##OVERFLOW_T##'
                 OR S.PAST_DUE_AMOUNTS = '##OVERFLOW_S##'
                 OR T.PAST_DUE_AMT = '##OVERFLOW_T##' THEN
               'No'
             WHEN NVL(
                 (
                   SELECT
                     LISTAGG(TO_CHAR(
                       TO_DATE(TRIM(REGEXP_SUBSTR(
                         S.PAST_DUE_COVERAGE_PERIODS,
                         '[^,]+',
                         1,
                         LEVEL
                       )),
                   'MM/DD/YYYY'),
                       'YYYYMM'
                     ),
                             ',') WITHIN GROUP(
                      ORDER BY LEVEL)
                     FROM DUAL
                   CONNECT BY
                     REGEXP_SUBSTR(
                       S.PAST_DUE_COVERAGE_PERIODS,
                       '[^,]+',
                       1,
                       LEVEL
                     ) IS NOT NULL
                 ),
                 '~'
               ) = NVL(
                 (
                   SELECT
                     LISTAGG(TO_CHAR(
                       CASE
                         WHEN REGEXP_LIKE(TRIM(REGEXP_SUBSTR(
                           T.PAST_COVERAGE_PERIOD,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                                          '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                           TO_DATE(TRIM(REGEXP_SUBSTR(
                             T.PAST_COVERAGE_PERIOD,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                                   'MM/DD/YYYY')
                         WHEN REGEXP_LIKE(UPPER(TRIM(REGEXP_SUBSTR(
                           T.PAST_COVERAGE_PERIOD,
                           '[^,]+',
                           1,
                           LEVEL
                         ))),
                                          '^[A-Z]{3}-[0-9]{4}$') THEN
                           TO_DATE(UPPER(TRIM(REGEXP_SUBSTR(
                             T.PAST_COVERAGE_PERIOD,
                             '[^,]+',
                             1,
                             LEVEL
                           ))),
                                   'MON-YYYY',
                                   'NLS_DATE_LANGUAGE=ENGLISH')
                       END,
                       'YYYYMM'
                     ),
                             ',') WITHIN GROUP(
                      ORDER BY LEVEL)
                     FROM DUAL
                   CONNECT BY
                     REGEXP_SUBSTR(
                       T.PAST_COVERAGE_PERIOD,
                       '[^,]+',
                       1,
                       LEVEL
                     ) IS NOT NULL
                 ),
                 '~'
               )
                AND NVL(
               (
                 SELECT
                   LISTAGG(TO_CHAR(
                     TO_DATE(TRIM(REGEXP_SUBSTR(
                       S.PAST_DUE_DATES,
                       '[^,]+',
                       1,
                       LEVEL
                     )),
                 'MM/DD/YYYY'),
                     'YYYYMMDD'
                   ),
                           ',') WITHIN GROUP(
                    ORDER BY LEVEL)
                   FROM DUAL
                 CONNECT BY
                   REGEXP_SUBSTR(
                     S.PAST_DUE_DATES,
                     '[^,]+',
                     1,
                     LEVEL
                   ) IS NOT NULL
               ),
               '~'
             ) = NVL(
               (
                 SELECT
                   LISTAGG(TO_CHAR(
                     CASE
                       WHEN REGEXP_LIKE(TRIM(REGEXP_SUBSTR(
                         T.PAST_DUE_DT,
                         '[^,]+',
                         1,
                         LEVEL
                       )),
                                        '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                         TO_DATE(TRIM(REGEXP_SUBSTR(
                           T.PAST_DUE_DT,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                                 'MM/DD/YYYY')
                       WHEN REGEXP_LIKE(UPPER(TRIM(REGEXP_SUBSTR(
                         T.PAST_DUE_DT,
                         '[^,]+',
                         1,
                         LEVEL
                       ))),
                                        '^[0-9]{2}-[A-Z]{3}-[0-9]{2}$') THEN
                         TO_DATE(UPPER(TRIM(REGEXP_SUBSTR(
                           T.PAST_DUE_DT,
                           '[^,]+',
                           1,
                           LEVEL
                         ))),
                                 'DD-MON-RR',
                                 'NLS_DATE_LANGUAGE=ENGLISH')
                     END,
                     'YYYYMMDD'
                   ),
                           ',') WITHIN GROUP(
                    ORDER BY LEVEL)
                   FROM DUAL
                 CONNECT BY
                   REGEXP_SUBSTR(
                     T.PAST_DUE_DT,
                     '[^,]+',
                     1,
                     LEVEL
                   ) IS NOT NULL
               ),
               '~'
             )
                AND NVL(
               (
                 SELECT
                   LISTAGG(TO_CHAR(
                     CASE
                       WHEN REGEXP_LIKE(NULLIF(
                         REGEXP_REPLACE(
                           TRIM(REGEXP_SUBSTR(
                             S.PAST_DUE_AMOUNTS,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           '[^0-9.-]',
                           ''
                         ),
                         ''
                       ),
                                        '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                         TO_NUMBER(NULLIF(
                           REGEXP_REPLACE(
                             TRIM(REGEXP_SUBSTR(
                               S.PAST_DUE_AMOUNTS,
                               '[^,]+',
                               1,
                               LEVEL
                             )),
                             '[^0-9.-]',
                             ''
                           ),
                           ''
                         ))
                     END,
                     'FM9999999999990D00',
                     'NLS_NUMERIC_CHARACTERS=.,'
                   ),
                           ',') WITHIN GROUP(
                    ORDER BY LEVEL)
                   FROM DUAL
                 CONNECT BY
                   REGEXP_SUBSTR(
                     S.PAST_DUE_AMOUNTS,
                     '[^,]+',
                     1,
                     LEVEL
                   ) IS NOT NULL
               ),
               '~'
             ) = NVL(
               (
                 SELECT
                   LISTAGG(TO_CHAR(
                     CASE
                       WHEN REGEXP_LIKE(NULLIF(
                         REGEXP_REPLACE(
                           TRIM(REGEXP_SUBSTR(
                             T.PAST_DUE_AMT,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           '[^0-9.-]',
                           ''
                         ),
                         ''
                       ),
                                        '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                         TO_NUMBER(NULLIF(
                           REGEXP_REPLACE(
                             TRIM(REGEXP_SUBSTR(
                               T.PAST_DUE_AMT,
                               '[^,]+',
                               1,
                               LEVEL
                             )),
                             '[^0-9.-]',
                             ''
                           ),
                           ''
                         ))
                     END,
                     'FM9999999999990D00',
                     'NLS_NUMERIC_CHARACTERS=.,'
                   ),
                           ',') WITHIN GROUP(
                    ORDER BY LEVEL)
                   FROM DUAL
                 CONNECT BY
                   REGEXP_SUBSTR(
                     T.PAST_DUE_AMT,
                     '[^,]+',
                     1,
                     LEVEL
                   ) IS NOT NULL
               ),
               '~'
             )
                AND NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.PAST_DUE,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.PAST_DUE,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               -99999999999999
             ) = NVL(
               ROUND(
                 T.PAST_DUE_TOTAL_AMOUNT,
                 2
               ),
               -99999999999999
             ) THEN
               'Yes'
             ELSE
               'No'
           END AS IPB0001_24_MATCH,
           S.PAST_DUE_COVERAGE_PERIODS AS IPB0001_24_S_PAST_DUE_COVERAGE_PERIOD,
           T.PAST_COVERAGE_PERIOD AS IPB0001_24_T_PAST_COVERAGE_PERIOD,
           S.PAST_DUE_DATES AS IPB0001_24_S_PAST_DUE_DATE,
           T.PAST_DUE_DT AS IPB0001_24_T_PAST_DUE_DT,
           S.PAST_DUE_AMOUNTS AS IPB0001_24_S_PAST_DUE_AMOUNT,
           T.PAST_DUE_AMT AS IPB0001_24_T_PAST_DUE_AMT,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.PAST_DUE,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.PAST_DUE,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_24_S_PAST_DUE,
           T.PAST_DUE_TOTAL_AMOUNT AS IPB0001_24_T_PAST_DUE_TOTAL_AMOUNT,
           CASE
             WHEN S.PAST_DUE_COVERAGE_PERIODS = '##OVERFLOW_S##'
                 OR T.PAST_COVERAGE_PERIOD = '##OVERFLOW_T##' THEN
               'No'
             WHEN NVL(
               (
                 SELECT
                   LISTAGG(TO_CHAR(
                     TO_DATE(TRIM(REGEXP_SUBSTR(
                       S.PAST_DUE_COVERAGE_PERIODS,
                       '[^,]+',
                       1,
                       LEVEL
                     )),
                 'MM/DD/YYYY'),
                     'YYYYMM'
                   ),
                           ',') WITHIN GROUP(
                    ORDER BY LEVEL)
                   FROM DUAL
                 CONNECT BY
                   REGEXP_SUBSTR(
                     S.PAST_DUE_COVERAGE_PERIODS,
                     '[^,]+',
                     1,
                     LEVEL
                   ) IS NOT NULL
               ),
               '~'
             ) = NVL(
               (
                 SELECT
                   LISTAGG(TO_CHAR(
                     CASE
                       WHEN REGEXP_LIKE(TRIM(REGEXP_SUBSTR(
                         T.PAST_COVERAGE_PERIOD,
                         '[^,]+',
                         1,
                         LEVEL
                       )),
                                        '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                         TO_DATE(TRIM(REGEXP_SUBSTR(
                           T.PAST_COVERAGE_PERIOD,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                                 'MM/DD/YYYY')
                       WHEN REGEXP_LIKE(UPPER(TRIM(REGEXP_SUBSTR(
                         T.PAST_COVERAGE_PERIOD,
                         '[^,]+',
                         1,
                         LEVEL
                       ))),
                                        '^[A-Z]{3}-[0-9]{4}$') THEN
                         TO_DATE(UPPER(TRIM(REGEXP_SUBSTR(
                           T.PAST_COVERAGE_PERIOD,
                           '[^,]+',
                           1,
                           LEVEL
                         ))),
                                 'MON-YYYY',
                                 'NLS_DATE_LANGUAGE=ENGLISH')
                     END,
                     'YYYYMM'
                   ),
                           ',') WITHIN GROUP(
                    ORDER BY LEVEL)
                   FROM DUAL
                 CONNECT BY
                   REGEXP_SUBSTR(
                     T.PAST_COVERAGE_PERIOD,
                     '[^,]+',
                     1,
                     LEVEL
                   ) IS NOT NULL
               ),
               '~'
             ) THEN
               'Yes'
             ELSE
               'No'
           END AS IPB0001_28_MATCH,
           S.PAST_DUE_COVERAGE_PERIODS AS IPB0001_28_S_PAST_DUE_COVERAGE_PERIOD,
           T.PAST_COVERAGE_PERIOD AS IPB0001_28_T_PAST_COVERAGE_PERIOD,
           CASE
             WHEN NVL(
               CASE
                 WHEN REGEXP_LIKE(TRIM(S.COVERAGE_THROUGH_MONTH),
                                  '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                   TO_CHAR(
                     TO_DATE(TRIM(S.COVERAGE_THROUGH_MONTH),
                           'MM/DD/YYYY'),
                     'YYYYMMDD'
                   )
                 ELSE
                   TRIM(S.COVERAGE_THROUGH_MONTH)
               END,
               '~'
             ) = NVL(
               CASE
                 WHEN REGEXP_LIKE(TRIM(T.COVERAGE_END_DATE),
                                  '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                   TO_CHAR(
                     TO_DATE(TRIM(T.COVERAGE_END_DATE),
                           'MM/DD/YYYY'),
                     'YYYYMMDD'
                   )
                 ELSE
                   TRIM(T.COVERAGE_END_DATE)
               END,
               '~'
             ) THEN
               'Yes'
             ELSE
               'No'
           END AS IPB0001_25_MATCH,
           S.COVERAGE_THROUGH_MONTH AS IPB0001_25_S_COVERAGE_THROUGH_MONTH,
           T.COVERAGE_END_DATE AS IPB0001_25_T_COVERAGE_END_DATE,
           CASE
             WHEN NVL(
                 ROUND(
                   CASE
                     WHEN REGEXP_LIKE(NULLIF(
                       REGEXP_REPLACE(
                         S.RETRO_DUE_WITHOUT_LIS_AMT,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ),
                                      '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                       TO_NUMBER(NULLIF(
                         REGEXP_REPLACE(
                           S.RETRO_DUE_WITHOUT_LIS_AMT,
                           '[^0-9.-]',
                           ''
                         ),
                         ''
                       ))
                   END,
                   2
                 ),
                 -99999999999999
               ) = NVL(
                 ROUND(
                   T.RETRO_DUE_WITHOUT_LIS_AMT,
                   2
                 ),
                 -99999999999999
               )
                AND NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.RETRO_DUE_LEP_AMT,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.RETRO_DUE_LEP_AMT,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               -99999999999999
             ) = NVL(
               ROUND(
                 T.WS_RDUE_LEP_AMT,
                 2
               ),
               -99999999999999
             ) THEN
               'Yes'
             ELSE
               'No'
           END AS IPB0001_26_MATCH,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.RETRO_DUE_WITHOUT_LIS_AMT,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.RETRO_DUE_WITHOUT_LIS_AMT,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_26_S_RETRO_DUE_WITHOUT_LIS_AMT,
           T.RETRO_DUE_WITHOUT_LIS_AMT AS IPB0001_26_T_RETRO_DUE_WITHOUT_LIS_AMT,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.RETRO_DUE_LEP_AMT,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.RETRO_DUE_LEP_AMT,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_26_S_RETRO_DUE_LEP_AMT,
           T.WS_RDUE_LEP_AMT AS IPB0001_26_T_WS_RDUE_LEP_AMT,
           CASE
             WHEN NVL(
               ROUND(
                 S.SUBTOTAL_DUE,
                 2
               ),
               -99999999999999
             ) = NVL(
               ROUND(
                 T.TOTAL_AMOUNT_DUE,
                 2
               ),
               -99999999999999
             ) THEN
               'Yes'
             ELSE
               'No'
           END AS IPB0001_17_MATCH,
           S.SUBTOTAL_DUE AS IPB0001_17_S_SUBTOTAL_DUE,
           T.TOTAL_AMOUNT_DUE AS IPB0001_17_T_TOTAL_AMOUNT_DUE,
           CASE
             WHEN NVL(
                 ROUND(
                   CASE
                     WHEN REGEXP_LIKE(NULLIF(
                       REGEXP_REPLACE(
                         S.PRIOR_MONTH_BALANCE,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ),
                                      '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                       TO_NUMBER(NULLIF(
                         REGEXP_REPLACE(
                           S.PRIOR_MONTH_BALANCE,
                           '[^0-9.-]',
                           ''
                         ),
                         ''
                       ))
                   END,
                   2
                 ),
                 -99999999999999
               ) = NVL(
                 ROUND(
                   T.PREVIOUS_BALANCE,
                   2
                 ),
                 -99999999999999
               )
                AND NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.PAYMENT_RECEIVED,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.PAYMENT_RECEIVED,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               -99999999999999
             ) = NVL(
               ROUND(
                 T.PAY_AMT,
                 2
               ),
               -99999999999999
             )
                AND NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.TOTAL_ADJUSTMENT_AMT,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.TOTAL_ADJUSTMENT_AMT,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               -99999999999999
             ) = NVL(
               ROUND(
                 T.ADJUSTMENT_AMT,
                 2
               ),
               -99999999999999
             ) THEN
               'Yes'
             ELSE
               'No'
           END AS IPB0001_27_MATCH,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.PRIOR_MONTH_BALANCE,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.PRIOR_MONTH_BALANCE,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_27A_S_PRIOR_MONTH_BALANCE,
           T.PREVIOUS_BALANCE AS IPB0001_27_T_PRIOR_MONTH_BALANCE,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.PAYMENT_RECEIVED,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.PAYMENT_RECEIVED,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_27B_S_PAYMENT_RECEIVED,
           T.PAY_AMT AS IPB0001_27_T_PAYMENT_RECEIVED,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.TOTAL_ADJUSTMENT_AMT,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.TOTAL_ADJUSTMENT_AMT,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_27C_S_TOTAL_ADJUSTMENT_AMT,
           T.ADJUSTMENT_AMT AS IPB0001_27_T_TOTAL_ADJUSTMENT_AMT,
           CASE
             WHEN NVL(
               TRIM(S.BILLING_UNIT_ID),
               '~'
             ) = NVL(
               TRIM(T.ORMB_ACCT_ID),
               '~'
             ) THEN
               'Yes'
             ELSE
               'No'
           END AS IPB0001_6_MATCH,
           S.BILLING_UNIT_ID AS IPB0001_6_S_BILLING_UNIT_ID,
           T.ORMB_ACCT_ID AS IPB0001_6_T_ORMB_ACCT_ID,
           CASE
             WHEN NVL(
               REPLACE(
                 UPPER(TRIM(S.AUTOPAY_INDICATOR)),
                 'A',
                 'Y'
               ),
               '~'
             ) = NVL(
               REPLACE(
                 UPPER(TRIM(T.AUTOPAY_IND)),
                 'A',
                 'Y'
               ),
               '~'
             ) THEN
               'Yes'
             ELSE
               'No'
           END AS IPB0001_12_MATCH,
           UPPER(TRIM(S.AUTOPAY_INDICATOR)) AS IPB0001_12_S_AUTOPAY_INDICATOR,
           UPPER(TRIM(T.AUTOPAY_IND)) AS IPB0001_12_T_AUTOPAY_IND,
           CASE
             WHEN NVL(
                 CASE
                   WHEN REGEXP_LIKE(TRIM(S.PAYMENT_DUE_DATE),
                                    '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                     TO_CHAR(
                       TO_DATE(TRIM(S.PAYMENT_DUE_DATE),
                             'MM/DD/YYYY'),
                       'YYYYMMDD'
                     )
                   ELSE
                     TRIM(S.PAYMENT_DUE_DATE)
                 END,
                 '~'
               ) = NVL(
                 CASE
                   WHEN REGEXP_LIKE(TRIM(T.DUE_DATE),
                                    '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                     TO_CHAR(
                       TO_DATE(TRIM(T.DUE_DATE),
                             'MM/DD/YYYY'),
                       'YYYYMMDD'
                     )
                   ELSE
                     TRIM(T.DUE_DATE)
                 END,
                 '~'
               )
                AND NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.PRIOR_MONTH_BALANCE,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.PRIOR_MONTH_BALANCE,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               -99999999999999
             ) = NVL(
               ROUND(
                 T.PREVIOUS_BALANCE,
                 2
               ),
               -99999999999999
             )
                AND NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.PAYMENT_RECEIVED,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.PAYMENT_RECEIVED,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               -99999999999999
             ) = NVL(
               ROUND(
                 T.PAY_AMT,
                 2
               ),
               -99999999999999
             )
                AND NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.TOTAL_ADJUSTMENT_AMT,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.TOTAL_ADJUSTMENT_AMT,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               -99999999999999
             ) = NVL(
               ROUND(
                 T.ADJUSTMENT_AMT,
                 2
               ),
               -99999999999999
             )
                AND NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.RETROACTIVE_DUE,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.RETROACTIVE_DUE,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               -99999999999999
             ) = NVL(
               ROUND(
                 T.CM_TOT_RETRO_CHRG_AMT,
                 2
               ),
               -99999999999999
             ) THEN
               'Yes'
             ELSE
               'No'
           END AS IPB0001_16_MATCH,
           S.PAYMENT_DUE_DATE AS IPB0001_16_S_PAYMENT_DUE_DATE,
           T.DUE_DATE AS IPB0001_16_T_DUE_DATE,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.PRIOR_MONTH_BALANCE,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.PRIOR_MONTH_BALANCE,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_16_S_PRIOR_MONTH_BALANCE,
           T.PREVIOUS_BALANCE AS IPB0001_16_T_PREVIOUS_BALANCE,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.PAYMENT_RECEIVED,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.PAYMENT_RECEIVED,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_16_S_PAYMENT_RECEIVED,
           T.PAY_AMT AS IPB0001_16_T_PAY_AMT,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.TOTAL_ADJUSTMENT_AMT,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.TOTAL_ADJUSTMENT_AMT,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_16_S_TOTAL_ADJUSTMENT_AMT,
           T.ADJUSTMENT_AMT AS IPB0001_16_T_ADJUSTMENT_AMT,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.RETROACTIVE_DUE,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.RETROACTIVE_DUE,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_16_S_RETROACTIVE_DUE,
           T.CM_TOT_RETRO_CHRG_AMT AS IPB0001_16_T_RETRO_DUES,
           CASE
             WHEN NVL(
                 CASE
                   WHEN REGEXP_LIKE(TRIM(S.COVERAGE_THROUGH_MONTH),
                                    '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                     TO_CHAR(
                       TO_DATE(TRIM(S.COVERAGE_THROUGH_MONTH),
                             'MM/DD/YYYY'),
                       'YYYYMMDD'
                     )
                   ELSE
                     TRIM(S.COVERAGE_THROUGH_MONTH)
                 END,
                 '~'
               ) = NVL(
                 CASE
                   WHEN REGEXP_LIKE(TRIM(T.COVERAGE_END_DATE),
                                    '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                     TO_CHAR(
                       TO_DATE(TRIM(T.COVERAGE_END_DATE),
                             'MM/DD/YYYY'),
                       'YYYYMMDD'
                     )
                   ELSE
                     TRIM(T.COVERAGE_END_DATE)
                 END,
                 '~'
               )
                AND NVL(
               CASE
                 WHEN REGEXP_LIKE(TRIM(S.COVERGAE_THROUGH_YEAR),
                                  '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                   TO_CHAR(
                     TO_DATE(TRIM(S.COVERGAE_THROUGH_YEAR),
                           'MM/DD/YYYY'),
                     'YYYYMMDD'
                   )
                 ELSE
                   TRIM(S.COVERGAE_THROUGH_YEAR)
               END,
               '~'
             ) = NVL(
               CASE
                 WHEN REGEXP_LIKE(TRIM(T.COVERAGE_END_DATE),
                                  '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                   TO_CHAR(
                     TO_DATE(TRIM(T.COVERAGE_END_DATE),
                           'MM/DD/YYYY'),
                     'YYYYMMDD'
                   )
                 ELSE
                   TRIM(T.COVERAGE_END_DATE)
               END,
               '~'
             ) THEN
               'Yes'
             ELSE
               'No'
           END AS IPB0001_3_MATCH,
           S.COVERAGE_THROUGH_MONTH AS IPB0001_3_S_COVERAGE_THROUGH_MONTH,
           T.COVERAGE_END_DATE AS IPB0001_3_T_COVERAGE_END_DATE_FOR_MONTH,
           S.COVERGAE_THROUGH_YEAR AS IPB0001_3_S_COVERAGE_THROUGH_YEAR,
           T.COVERAGE_END_DATE AS IPB0001_3_T_COVERAGE_END_DATE_FOR_YEAR,
           CASE
             WHEN NVL(
               CASE
                 WHEN REGEXP_LIKE(TRIM(S.INVOICE_GENERATED_DATE),
                                  '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                   TO_CHAR(
                     TO_DATE(TRIM(S.INVOICE_GENERATED_DATE),
                           'MM/DD/YYYY'),
                     'YYYYMMDD'
                   )
                 ELSE
                   TRIM(S.INVOICE_GENERATED_DATE)
               END,
               '~'
             ) = NVL(
               CASE
                 WHEN REGEXP_LIKE(TRIM(T.ACTIVITY_PERIOD),
                                  '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                   TO_CHAR(
                     TO_DATE(TRIM(T.ACTIVITY_PERIOD),
                           'MM/DD/YYYY'),
                     'YYYYMMDD'
                   )
                 ELSE
                   TRIM(T.ACTIVITY_PERIOD)
               END,
               '~'
             ) THEN
               'Yes'
             ELSE
               'No'
           END AS IPB0001_4_MATCH,
           S.INVOICE_GENERATED_DATE AS IPB0001_4_S_INVOICE_GENERATED_DATE,
           T.ACTIVITY_PERIOD AS IPB0001_4_T_ACTIVITY_PERIOD,
    -- IPB0001_29: Retroactive Federal/State Combined detail strings (normalized) + numeric amounts
    --   Source XML format: "04/01/2025=-300.00, 05/01/2025=-300.00"
    --   Target ORMB format: "APR-2026=-33.19, MAY-2026=-330"
    --   Both normalized to: "YYYYMM=-nnn.nn, YYYYMM=-nnn.nn"
           CASE
             WHEN NVL(
                 (
                   SELECT
                     LISTAGG(TO_CHAR(
                       CASE
                         WHEN REGEXP_LIKE(TRIM(SUBSTR(
                           TRIM(REGEXP_SUBSTR(
                             S.RETROACTIVE_FEDERAL_COMBINED,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           1,
                           INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      S.RETROACTIVE_FEDERAL_COMBINED,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) - 1
                         )),
                                          '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                           TO_DATE(TRIM(SUBSTR(
                             TRIM(REGEXP_SUBSTR(
                               S.RETROACTIVE_FEDERAL_COMBINED,
                               '[^,]+',
                               1,
                               LEVEL
                             )),
                             1,
                             INSTR(
                                      TRIM(REGEXP_SUBSTR(
                                        S.RETROACTIVE_FEDERAL_COMBINED,
                                        '[^,]+',
                                        1,
                                        LEVEL
                                      )),
                                      '='
                                    ) - 1
                           )),
                                   'MM/DD/YYYY')
                         WHEN REGEXP_LIKE(UPPER(TRIM(SUBSTR(
                           TRIM(REGEXP_SUBSTR(
                             S.RETROACTIVE_FEDERAL_COMBINED,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           1,
                           INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      S.RETROACTIVE_FEDERAL_COMBINED,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) - 1
                         ))),
                                          '^[A-Z]{3}-[0-9]{4}$') THEN
                           TO_DATE(UPPER(TRIM(SUBSTR(
                             TRIM(REGEXP_SUBSTR(
                               S.RETROACTIVE_FEDERAL_COMBINED,
                               '[^,]+',
                               1,
                               LEVEL
                             )),
                             1,
                             INSTR(
                                      TRIM(REGEXP_SUBSTR(
                                        S.RETROACTIVE_FEDERAL_COMBINED,
                                        '[^,]+',
                                        1,
                                        LEVEL
                                      )),
                                      '='
                                    ) - 1
                           ))),
                                   'MON-YYYY',
                                   'NLS_DATE_LANGUAGE=ENGLISH')
                       END,
                       'YYYYMM'
                     )
                             || '='
                             || TO_CHAR(
                       ROUND(
                         TO_NUMBER(TRIM(SUBSTR(
                           TRIM(REGEXP_SUBSTR(
                             S.RETROACTIVE_FEDERAL_COMBINED,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           INSTR(
                                      TRIM(REGEXP_SUBSTR(
                                        S.RETROACTIVE_FEDERAL_COMBINED,
                                        '[^,]+',
                                        1,
                                        LEVEL
                                      )),
                                      '='
                                    ) + 1
                         ))),
                         2
                       ),
                       'FM9999999999990D00',
                       'NLS_NUMERIC_CHARACTERS=.,'
                     ),
                             ', ') WITHIN GROUP(
                      ORDER BY LEVEL)
                     FROM DUAL
                   CONNECT BY
                     REGEXP_SUBSTR(
                       S.RETROACTIVE_FEDERAL_COMBINED,
                       '[^,]+',
                       1,
                       LEVEL
                     ) IS NOT NULL
                 ),
                 '~'
               ) = NVL(
                 (
                   SELECT
                     LISTAGG(TO_CHAR(
                       CASE
                         WHEN REGEXP_LIKE(TRIM(SUBSTR(
                           TRIM(REGEXP_SUBSTR(
                             T.FEDERAL_RETRO_DETAIL,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           1,
                           INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      T.FEDERAL_RETRO_DETAIL,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) - 1
                         )),
                                          '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                           TO_DATE(TRIM(SUBSTR(
                             TRIM(REGEXP_SUBSTR(
                               T.FEDERAL_RETRO_DETAIL,
                               '[^,]+',
                               1,
                               LEVEL
                             )),
                             1,
                             INSTR(
                                      TRIM(REGEXP_SUBSTR(
                                        T.FEDERAL_RETRO_DETAIL,
                                        '[^,]+',
                                        1,
                                        LEVEL
                                      )),
                                      '='
                                    ) - 1
                           )),
                                   'MM/DD/YYYY')
                         WHEN REGEXP_LIKE(UPPER(TRIM(SUBSTR(
                           TRIM(REGEXP_SUBSTR(
                             T.FEDERAL_RETRO_DETAIL,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           1,
                           INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      T.FEDERAL_RETRO_DETAIL,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) - 1
                         ))),
                                          '^[A-Z]{3}-[0-9]{4}$') THEN
                           TO_DATE(UPPER(TRIM(SUBSTR(
                             TRIM(REGEXP_SUBSTR(
                               T.FEDERAL_RETRO_DETAIL,
                               '[^,]+',
                               1,
                               LEVEL
                             )),
                             1,
                             INSTR(
                                      TRIM(REGEXP_SUBSTR(
                                        T.FEDERAL_RETRO_DETAIL,
                                        '[^,]+',
                                        1,
                                        LEVEL
                                      )),
                                      '='
                                    ) - 1
                           ))),
                                   'MON-YYYY',
                                   'NLS_DATE_LANGUAGE=ENGLISH')
                       END,
                       'YYYYMM'
                     )
                             || '='
                             || TO_CHAR(
                       ROUND(
                         TO_NUMBER(TRIM(SUBSTR(
                           TRIM(REGEXP_SUBSTR(
                             T.FEDERAL_RETRO_DETAIL,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           INSTR(
                                      TRIM(REGEXP_SUBSTR(
                                        T.FEDERAL_RETRO_DETAIL,
                                        '[^,]+',
                                        1,
                                        LEVEL
                                      )),
                                      '='
                                    ) + 1
                         ))),
                         2
                       ),
                       'FM9999999999990D00',
                       'NLS_NUMERIC_CHARACTERS=.,'
                     ),
                             ', ') WITHIN GROUP(
                      ORDER BY LEVEL)
                     FROM DUAL
                   CONNECT BY
                     REGEXP_SUBSTR(
                       T.FEDERAL_RETRO_DETAIL,
                       '[^,]+',
                       1,
                       LEVEL
                     ) IS NOT NULL
                 ),
                 '~'
               )
                AND NVL(
               (
                 SELECT
                   LISTAGG(TO_CHAR(
                     CASE
                       WHEN REGEXP_LIKE(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         1,
                         INSTR(
                                  TRIM(REGEXP_SUBSTR(
                                    S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                                    '[^,]+',
                                    1,
                                    LEVEL
                                  )),
                                  '='
                                ) - 1
                       )),
                                        '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                         TO_DATE(TRIM(SUBSTR(
                           TRIM(REGEXP_SUBSTR(
                             S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           1,
                           INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) - 1
                         )),
                                 'MM/DD/YYYY')
                       WHEN REGEXP_LIKE(UPPER(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         1,
                         INSTR(
                                  TRIM(REGEXP_SUBSTR(
                                    S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                                    '[^,]+',
                                    1,
                                    LEVEL
                                  )),
                                  '='
                                ) - 1
                       ))),
                                        '^[A-Z]{3}-[0-9]{4}$') THEN
                         TO_DATE(UPPER(TRIM(SUBSTR(
                           TRIM(REGEXP_SUBSTR(
                             S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           1,
                           INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) - 1
                         ))),
                                 'MON-YYYY',
                                 'NLS_DATE_LANGUAGE=ENGLISH')
                     END,
                     'YYYYMM'
                   )
                           || '='
                           || TO_CHAR(
                     ROUND(
                       TO_NUMBER(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) + 1
                       ))),
                       2
                     ),
                     'FM9999999999990D00',
                     'NLS_NUMERIC_CHARACTERS=.,'
                   ),
                           ', ') WITHIN GROUP(
                    ORDER BY LEVEL)
                   FROM DUAL
                 CONNECT BY
                   REGEXP_SUBSTR(
                     S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                     '[^,]+',
                     1,
                     LEVEL
                   ) IS NOT NULL
               ),
               '~'
             ) = NVL(
               (
                 SELECT
                   LISTAGG(TO_CHAR(
                     CASE
                       WHEN REGEXP_LIKE(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           T.STATE_RETRO_DETAIL,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         1,
                         INSTR(
                                  TRIM(REGEXP_SUBSTR(
                                    T.STATE_RETRO_DETAIL,
                                    '[^,]+',
                                    1,
                                    LEVEL
                                  )),
                                  '='
                                ) - 1
                       )),
                                        '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                         TO_DATE(TRIM(SUBSTR(
                           TRIM(REGEXP_SUBSTR(
                             T.STATE_RETRO_DETAIL,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           1,
                           INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      T.STATE_RETRO_DETAIL,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) - 1
                         )),
                                 'MM/DD/YYYY')
                       WHEN REGEXP_LIKE(UPPER(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           T.STATE_RETRO_DETAIL,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         1,
                         INSTR(
                                  TRIM(REGEXP_SUBSTR(
                                    T.STATE_RETRO_DETAIL,
                                    '[^,]+',
                                    1,
                                    LEVEL
                                  )),
                                  '='
                                ) - 1
                       ))),
                                        '^[A-Z]{3}-[0-9]{4}$') THEN
                         TO_DATE(UPPER(TRIM(SUBSTR(
                           TRIM(REGEXP_SUBSTR(
                             T.STATE_RETRO_DETAIL,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           1,
                           INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      T.STATE_RETRO_DETAIL,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) - 1
                         ))),
                                 'MON-YYYY',
                                 'NLS_DATE_LANGUAGE=ENGLISH')
                     END,
                     'YYYYMM'
                   )
                           || '='
                           || TO_CHAR(
                     ROUND(
                       TO_NUMBER(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           T.STATE_RETRO_DETAIL,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      T.STATE_RETRO_DETAIL,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) + 1
                       ))),
                       2
                     ),
                     'FM9999999999990D00',
                     'NLS_NUMERIC_CHARACTERS=.,'
                   ),
                           ', ') WITHIN GROUP(
                    ORDER BY LEVEL)
                   FROM DUAL
                 CONNECT BY
                   REGEXP_SUBSTR(
                     T.STATE_RETRO_DETAIL,
                     '[^,]+',
                     1,
                     LEVEL
                   ) IS NOT NULL
               ),
               '~'
             )
                AND NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.RETROACTIVE_FEDREAL_AMT,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.RETROACTIVE_FEDREAL_AMT,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               0
             ) = NVL(
               ROUND(
                 T.RETRO_APTC,
                 2
               ),
               0
             )
                AND NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.RETROACTIVE_STATE_SUBSDIY_AMT,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.RETROACTIVE_STATE_SUBSDIY_AMT,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               0
             ) = NVL(
               ROUND(
                 T.RETRO_STATE_SUBSIDY,
                 2
               ),
               0
             )
                AND NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.RETROACTIVE_TOTAL_AMOUNT,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.RETROACTIVE_TOTAL_AMOUNT,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               0
             ) = NVL(
               ROUND(
                 T.RETRO_DUES,
                 2
               ),
               0
             ) THEN
               'Yes'
             ELSE
               'No'
           END AS IPB0001_29_MATCH,
           S.RETROACTIVE_FEDERAL_COMBINED AS IPB0001_29_S_RETROACTIVE_FEDERAL_COMBINED,
           T.FEDERAL_RETRO_DETAIL AS IPB0001_29_T_FEDERAL_RETRO_DETAIL,
           S.RETROACTIVE_STATE_SUBSIDY_COMBINED AS IPB0001_29_S_RETROACTIVE_STATE_SUBSIDY_COMBINED,
           T.STATE_RETRO_DETAIL AS IPB0001_29_T_STATE_RETRO_DETAIL,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.RETROACTIVE_FEDREAL_AMT,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.RETROACTIVE_FEDREAL_AMT,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_29_S_RETROACTIVE_FEDREAL_AMT,
           T.RETRO_APTC AS IPB0001_29_T_APTC,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.RETROACTIVE_STATE_SUBSDIY_AMT,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.RETROACTIVE_STATE_SUBSDIY_AMT,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_29_S_RETROACTIVE_STATE_SUBSDIY_AMT,
           T.RETRO_STATE_SUBSIDY AS IPB0001_29_T_RETRO_STATE_SUBSIDY,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.RETROACTIVE_TOTAL_AMOUNT,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.RETROACTIVE_TOTAL_AMOUNT,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_29_S_RETROACTIVE_TOTAL_AMOUNT,
           T.RETRO_DUES AS IPB0001_29_T_CM_TOT_RETRO_CHRG_AMT
      FROM COMPARE_OWNER.KPIF_CMP_SOURCE_CA_XML S
      LEFT JOIN COMPARE_OWNER.KPIF_CMP_TARGET_ORMB T
    ON T.BATCH_NBR = S.BATCH_NBR
       AND T.BILL_ID = S.BILL_ID
     WHERE S.BATCH_NBR = V_BATCH_NBR;

  DECLARE
    V_TOTAL_COMPARE_CA NUMBER;
  BEGIN
    SELECT COUNT(*)
      INTO V_TOTAL_COMPARE_CA
      FROM COMPARE_OWNER.KPIF_CMP_RESULTS
     WHERE BATCH_NBR = V_BATCH_NBR
       AND RUN_ID = P_RUN_ID;

    SET_RUN_STATUS(
      P_STATUS           => 'KPIF_CMP_RESULTS INSERTION COMPLETED',
      P_STEP             => 'CA RESULTS INSERT',
      P_NEXT_STEP        => 'MOT_CMP_RESULTS_INSERTION',
      P_TOTAL_COMPARE_CA => V_TOTAL_COMPARE_CA
    );
  END;

  CHECK_CANCELED;

  --------------------------------------------------------------------
  -- Build final comparison rowset MOC_CMP_RESULTS
  --------------------------------------------------------------------
  INSERT INTO COMPARE_OWNER.MOC_CMP_RESULTS (
    RUN_ID,
    BATCH_NBR,
    KPMC_TRANSACTION_ID,
    REGION,
    RGN_CD,
    LOB,
    SUBSCRIBER_MRN,
    JURISDICTION,
    IPB0001_19_MATCH,
    IPB0001_19_S_TOTAL_BALANCE_DUE,
    IPB0001_19_T_TOTAL_CURRENT_CHARGES,
    IPB0001_29_MATCH,
    IPB0001_29_S_PRIOR_MONTH_BALANCE,
    IPB0001_29_T_PREVIOUS_BALANCE,
    IPB0001_29_S_PAYMENT_RECEIVED,
    IPB0001_29_T_PAY_AMT,
    IPB0001_29_S_OTHER_ADJUSTMENT,
    IPB0001_29_T_ADJUSTMENT_AMT,
    IPB0001_8_MATCH,
    IPB0001_8_S_BILLING_UNIT_ID,
    IPB0001_8_T_ORMB_ACCT_ID,
    IPB0001_24_MATCH,
    IPB0001_24_S_PRIOR_MONTH_BALANCE,
    IPB0001_24_T_PREVIOUS_BALANCE,
    IPB0001_25_MATCH,
    IPB0001_25_S_PAY_FROM_DATE,
    IPB0001_25_T_PAID_FROM_DT,
    IPB0001_25_S_PAY_THROUGH_DATE,
    IPB0001_25_T_PAID_THROUGH_DT,
    IPB0001_25_S_ROC_30_PAY_AMNTS,
    IPB0001_25_T_PAY_DETAIL_AMOUNT,
    IPB0001_25_S_PAYMENT_RECEIVED,
    IPB0001_25_T_PAY_AMT,
    IPB0001_25_S_REJECTED_PAYMENT,
    IPB0001_25_T_CANCEL_PAY_AMT,
    IPB0001_30_MATCH,
    IPB0001_30_S_PAYMENT_RECEIVED,
    IPB0001_30_T_PAY_AMT,
    IPB0001_30_S_ROC_30_PAY_DATES,
    IPB0001_30_T_PAY_DETAIL_DATE,
    IPB0001_30_S_ROC_30_PAY_AMTS,
    IPB0001_30_T_PAY_DETAIL_AMOUNT,
    IPB0001_42_MATCH,
    IPB0001_42_S_FEDERAL_SUBSIDY,
    IPB0001_42_T_APTC,
    IPB0001_42_S_REGION,
    IPB0001_42_T_REGION,
    IPB0001_42_S_STATE_SUBSIDY,
    IPB0001_42_T_STATE_SUBSIDY,
    IPB0001_28_MATCH,
    IPB0001_28_S_RETROACTIVE_FEDREAL_AMT,
    IPB0001_28_T_APTC,
    IPB0001_28_S_RETROACTIVE_STATE_SUBSIDY_AMT,
    IPB0001_28_T_RETRO_STATE_SUBSIDY,
    IPB0001_28_S_TOTAL_RETROACTIVE_AMOUNT,
    IPB0001_28_T_RETRO_DUES,
    IPB0001_28_S_OTHER_ADJUSTMENT,
    IPB0001_28_T_ADJUSTMENT_AMT,
    IPB0001_28_S_RETROACTIVE_FEDERAL_COMBINED,
    IPB0001_28_T_FEDERAL_RETRO_DETAIL,
    IPB0001_28_S_RETROACTIVE_STATE_SUBSIDY_COMBINED,
    IPB0001_28_T_STATE_RETRO_DETAIL,
    IPB0001_31_MATCH,
    IPB0001_31_S_RETROACTIVE_FEDERAL_AMT,
    IPB0001_31_T_APTC,
    IPB0001_31_S_RETROACTIVE_STATE_SUBSIDY_AMT,
    IPB0001_31_T_RETRO_STATE_SUBSIDY,
    IPB0001_31_S_TOTAL_RETROACTIVE_AMOUNT,
    IPB0001_31_T_RETRO_DUES,
    IPB0001_31_S_RETROACTIVE_FEDERAL_COMBINED,
    IPB0001_31_T_FEDERAL_RETRO_DETAIL,
    IPB0001_31_S_RETROACTIVE_STATE_SUBSIDY_COMBINED,
    IPB0001_31_T_STATE_RETRO_DETAIL,
    IPB0001_43_MATCH,
    IPB0001_43_S_SUBTOTAL,
    IPB0001_43_T_TOTAL_AMOUNT_DUE,
    IPB0001_14_MATCH,
    IPB0001_14_S_ACI_PAY_MODE,
    IPB0001_14_T_AUTOPAY_IND,
    IPB0001_18_MATCH,
    IPB0001_18_S_PRIOR_MONTH_BALANCE,
    IPB0001_18_T_PREVIOUS_BALANCE,
    IPB0001_18_S_PAYMENT_RECEIVED,
    IPB0001_18_T_PAY_AMT,
    IPB0001_18_S_OTHER_ADJUSTMENT,
    IPB0001_18_T_ADJUSTMENT_AMT,
    IPB0001_4_MATCH,
    IPB0001_4_S_STATEMENT_MONTH,
    IPB0001_4_T_COVERAGE_END_DATE_FOR_MONTH,
    IPB0001_4_S_STATEMENT_YEAR,
    IPB0001_4_T_COVERAGE_END_DATE_FOR_YEAR,
    IPB0001_5_MATCH,
    IPB0001_5_S_INVOICE_GENERATED_DATE,
    IPB0001_5_T_ACTIVITY_PERIOD
  )
    SELECT P_RUN_ID,
           S.BATCH_NBR,
           S.TRANSACTION_ID,
           S.REGION,
           S.REGION_ID,
           T.LOB,
           T.SUBSCRIBER_MRN,
           S.JURISDICTION,
    -- IPB0001_19: Total Balance Due (S) vs Total Current Charges (T)
           CASE
             WHEN NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.TOTAL_BALANCE_DUE,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.TOTAL_BALANCE_DUE,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               -99999999999999
             ) = NVL(
               ROUND(
                 T.TOTAL_CURRENT_CHARGES,
                 2
               ),
               -99999999999999
             ) THEN
               'Yes'
             ELSE
               'No'
           END AS IPB0001_19_MATCH,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.TOTAL_BALANCE_DUE,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.TOTAL_BALANCE_DUE,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_19_S_TOTAL_BALANCE_DUE,
           T.TOTAL_CURRENT_CHARGES AS IPB0001_19_T_TOTAL_CURRENT_CHARGES,
    -- IPB0001_29: Prior Month Balance + Payment Received + Other Adjustment
           CASE
             WHEN NVL(
                 ROUND(
                   CASE
                     WHEN REGEXP_LIKE(NULLIF(
                       REGEXP_REPLACE(
                         S.PRIOR_MONTH_BALANCE,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ),
                                      '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                       TO_NUMBER(NULLIF(
                         REGEXP_REPLACE(
                           S.PRIOR_MONTH_BALANCE,
                           '[^0-9.-]',
                           ''
                         ),
                         ''
                       ))
                   END,
                   2
                 ),
                 -99999999999999
               ) = NVL(
                 ROUND(
                   T.PREVIOUS_BALANCE,
                   2
                 ),
                 -99999999999999
               )
                AND NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.PAYMENT_RECEIVED,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.PAYMENT_RECEIVED,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               -99999999999999
             ) = NVL(
               ROUND(
                 T.PAY_AMT,
                 2
               ),
               -99999999999999
             )
                AND NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.OTHER_ADJUSTMENT,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.OTHER_ADJUSTMENT,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               -99999999999999
             ) = NVL(
               ROUND(
                 T.OTHER_ADJUSTMENTS,
                 2
               ),
               -99999999999999
             ) THEN
               'Yes'
             ELSE
               'No'
           END AS IPB0001_29_MATCH,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.PRIOR_MONTH_BALANCE,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.PRIOR_MONTH_BALANCE,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_29_S_PRIOR_MONTH_BALANCE,
           T.PREVIOUS_BALANCE AS IPB0001_29_T_PREVIOUS_BALANCE,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.PAYMENT_RECEIVED,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.PAYMENT_RECEIVED,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_29_S_PAYMENT_RECEIVED,
           T.PAY_AMT AS IPB0001_29_T_PAY_AMT,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.OTHER_ADJUSTMENT,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.OTHER_ADJUSTMENT,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_29_S_OTHER_ADJUSTMENT,
           T.OTHER_ADJUSTMENTS AS IPB0001_29_T_ADJUSTMENT_AMT,
    -- IPB0001_8: Billing Unit ID (S) vs ORMB Acct ID (T)
           CASE
             WHEN NVL(
               TRIM(S.BILLING_UNIT_ID),
               '~'
             ) = NVL(
               TRIM(T.ORMB_ACCT_ID),
               '~'
             ) THEN
               'Yes'
             ELSE
               'No'
           END AS IPB0001_8_MATCH,
           S.BILLING_UNIT_ID AS IPB0001_8_S_BILLING_UNIT_ID,
           T.ORMB_ACCT_ID AS IPB0001_8_T_ORMB_ACCT_ID,
    -- IPB0001_24: Prior Month Balance
           CASE
             WHEN NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.PRIOR_MONTH_BALANCE,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.PRIOR_MONTH_BALANCE,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               -99999999999999
             ) = NVL(
               ROUND(
                 T.PREVIOUS_BALANCE,
                 2
               ),
               -99999999999999
             ) THEN
               'Yes'
             ELSE
               'No'
           END AS IPB0001_24_MATCH,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.PRIOR_MONTH_BALANCE,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.PRIOR_MONTH_BALANCE,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_24_S_PRIOR_MONTH_BALANCE,
           T.PREVIOUS_BALANCE AS IPB0001_24_T_PREVIOUS_BALANCE,
    -- IPB0001_25: Pay dates, comma-separated amounts, payment received, rejected payment
           CASE
             WHEN S.ROC_30_PAY_AMTS = '##OVERFLOW_S##'
                 OR T.PAY_DETAIL_AMOUNT = '##OVERFLOW_T##' THEN
               'No'
      -- 1. PAY_FROM_DATE (MM/DD/YYYY) vs PAID_FROM_DT (YYYY-MM-DD)
             WHEN NVL(
                 CASE
                   WHEN REGEXP_LIKE(TRIM(S.PAY_FROM_DATE),
                                    '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                     TO_CHAR(
                       TO_DATE(TRIM(S.PAY_FROM_DATE),
                             'MM/DD/YYYY'),
                       'YYYYMMDD'
                     )
                   ELSE
                     TRIM(S.PAY_FROM_DATE)
                 END,
                 '~'
               ) = NVL(
                 CASE
                   WHEN REGEXP_LIKE(TRIM(T.PAID_FROM_DT),
                                    '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') THEN
                     TO_CHAR(
                       TO_DATE(TRIM(T.PAID_FROM_DT),
                             'YYYY-MM-DD'),
                       'YYYYMMDD'
                     )
                   ELSE
                     TRIM(T.PAID_FROM_DT)
                 END,
                 '~'
               )
      -- 2. PAY_THROUGH_DATE (MM/DD/YYYY) vs PAID_THROUGH_DT (YYYY-MM-DD)
                AND NVL(
               CASE
                 WHEN REGEXP_LIKE(TRIM(S.PAY_THROUGH_DATE),
                                  '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                   TO_CHAR(
                     TO_DATE(TRIM(S.PAY_THROUGH_DATE),
                           'MM/DD/YYYY'),
                     'YYYYMMDD'
                   )
                 ELSE
                   TRIM(S.PAY_THROUGH_DATE)
               END,
               '~'
             ) = NVL(
               CASE
                 WHEN REGEXP_LIKE(TRIM(T.PAID_THROUGH_DT),
                                  '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') THEN
                   TO_CHAR(
                     TO_DATE(TRIM(T.PAID_THROUGH_DT),
                           'YYYY-MM-DD'),
                     'YYYYMMDD'
                   )
                 ELSE
                   TRIM(T.PAID_THROUGH_DT)
               END,
               '~'
             )
      -- 3. ROC_30_PAY_AMTS vs PAY_DETAIL_AMOUNT (comma-separated monetary values, normalized as numbers)
                AND NVL(
               (
                 SELECT
                   LISTAGG(TO_CHAR(TO_NUMBER(TRIM(REGEXP_SUBSTR(
                     S.ROC_30_PAY_AMTS,
                     '[^,]+',
                     1,
                     LEVEL
                   )))),
                           ', ') WITHIN GROUP(
                    ORDER BY LEVEL)
                   FROM DUAL
                 CONNECT BY
                   REGEXP_SUBSTR(
                     S.ROC_30_PAY_AMTS,
                     '[^,]+',
                     1,
                     LEVEL
                   ) IS NOT NULL
               ),
               '~'
             ) = NVL(
               (
                 SELECT
                   LISTAGG(TO_CHAR(TO_NUMBER(TRIM(REGEXP_SUBSTR(
                     T.PAY_DETAIL_AMOUNT,
                     '[^,]+',
                     1,
                     LEVEL
                   )))),
                           ', ') WITHIN GROUP(
                    ORDER BY LEVEL)
                   FROM DUAL
                 CONNECT BY
                   REGEXP_SUBSTR(
                     T.PAY_DETAIL_AMOUNT,
                     '[^,]+',
                     1,
                     LEVEL
                   ) IS NOT NULL
               ),
               '~'
             )
      -- 4. PAYMENT_RECEIVED vs PAY_AMT
                AND NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.PAYMENT_RECEIVED,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.PAYMENT_RECEIVED,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               -99999999999999
             ) = NVL(
               ROUND(
                 T.PAY_AMT,
                 2
               ),
               -99999999999999
             )
      -- 5. REJECTED_PAYMENT vs CANCEL_PAY_AMT (null source treated as 0)
                AND NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.REJECTED_PAYMENT,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.REJECTED_PAYMENT,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               0
             ) = NVL(
               ROUND(
                 T.CANCEL_PAY_AMT,
                 2
               ),
               0
             ) THEN
               'Yes'
             ELSE
               'No'
           END AS IPB0001_25_MATCH,
           S.PAY_FROM_DATE AS IPB0001_25_S_PAY_FROM_DATE,
           T.PAID_FROM_DT AS IPB0001_25_T_PAID_FROM_DT,
           S.PAY_THROUGH_DATE AS IPB0001_25_S_PAY_THROUGH_DATE,
           T.PAID_THROUGH_DT AS IPB0001_25_T_PAID_THROUGH_DT,
           S.ROC_30_PAY_AMTS AS IPB0001_25_S_ROC_30_PAY_AMNTS,
           T.PAY_DETAIL_AMOUNT AS IPB0001_25_T_PAY_DETAIL_AMOUNT,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.PAYMENT_RECEIVED,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.PAYMENT_RECEIVED,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_25_S_PAYMENT_RECEIVED,
           T.PAY_AMT AS IPB0001_25_T_PAY_AMT,
           NVL(
             CASE
               WHEN REGEXP_LIKE(NULLIF(
                 REGEXP_REPLACE(
                   S.REJECTED_PAYMENT,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                 TO_NUMBER(NULLIF(
                   REGEXP_REPLACE(
                     S.REJECTED_PAYMENT,
                     '[^0-9.-]',
                     ''
                   ),
                   ''
                 ))
             END,
             0
           ) AS IPB0001_25_S_REJECTED_PAYMENT,
           T.CANCEL_PAY_AMT AS IPB0001_25_T_CANCEL_PAY_AMT,
    -- IPB0001_30: payment received + ordered payment date list + ordered payment amount list
           CASE
             WHEN S.ROC_30_PAY_DATES = '##OVERFLOW_S##'
                 OR S.ROC_30_PAY_AMTS = '##OVERFLOW_S##'
                 OR T.PAY_DETAIL_DATE = '##OVERFLOW_T##'
                 OR T.PAY_DETAIL_AMOUNT = '##OVERFLOW_T##' THEN
               'No'
             WHEN NVL(
                 ROUND(
                   CASE
                     WHEN REGEXP_LIKE(NULLIF(
                       REGEXP_REPLACE(
                         S.PAYMENT_RECEIVED,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ),
                                      '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                       TO_NUMBER(NULLIF(
                         REGEXP_REPLACE(
                           S.PAYMENT_RECEIVED,
                           '[^0-9.-]',
                           ''
                         ),
                         ''
                       ))
                   END,
                   2
                 ),
                 -99999999999999
               ) = NVL(
                 ROUND(
                   T.PAY_AMT,
                   2
                 ),
                 -99999999999999
               )
                AND NVL(
               (
                 SELECT
                   LISTAGG(
                     CASE
                       WHEN REGEXP_LIKE(TRIM(REGEXP_SUBSTR(
                         S.ROC_30_PAY_DATES,
                         '[^,]+',
                         1,
                         LEVEL
                       )),
                                        '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                         TO_CHAR(
                           TO_DATE(TRIM(REGEXP_SUBSTR(
                             S.ROC_30_PAY_DATES,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                                 'MM/DD/YYYY'),
                           'YYYYMMDD'
                         )
                       ELSE
                         TRIM(REGEXP_SUBSTR(
                           S.ROC_30_PAY_DATES,
                           '[^,]+',
                           1,
                           LEVEL
                         ))
                     END,
                     ',') WITHIN GROUP(
                    ORDER BY LEVEL)
                   FROM DUAL
                 CONNECT BY
                   REGEXP_SUBSTR(
                     S.ROC_30_PAY_DATES,
                     '[^,]+',
                     1,
                     LEVEL
                   ) IS NOT NULL
               ),
               '~'
             ) = NVL(
               (
                 SELECT
                   LISTAGG(
                     CASE
                       WHEN REGEXP_LIKE(TRIM(REGEXP_SUBSTR(
                         T.PAY_DETAIL_DATE,
                         '[^,]+',
                         1,
                         LEVEL
                       )),
                                        '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                         TO_CHAR(
                           TO_DATE(TRIM(REGEXP_SUBSTR(
                             T.PAY_DETAIL_DATE,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                                 'MM/DD/YYYY'),
                           'YYYYMMDD'
                         )
                       ELSE
                         TRIM(REGEXP_SUBSTR(
                           T.PAY_DETAIL_DATE,
                           '[^,]+',
                           1,
                           LEVEL
                         ))
                     END,
                     ',') WITHIN GROUP(
                    ORDER BY LEVEL)
                   FROM DUAL
                 CONNECT BY
                   REGEXP_SUBSTR(
                     T.PAY_DETAIL_DATE,
                     '[^,]+',
                     1,
                     LEVEL
                   ) IS NOT NULL
               ),
               '~'
             )
                AND NVL(
               (
                 SELECT
                   LISTAGG(
                     CASE
                       WHEN REGEXP_LIKE(NULLIF(
                         REGEXP_REPLACE(
                           TRIM(REGEXP_SUBSTR(
                             S.ROC_30_PAY_AMTS,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           '[^0-9.-]',
                           ''
                         ),
                         ''
                       ),
                                        '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                         TO_CHAR(
                           ROUND(
                             TO_NUMBER(NULLIF(
                               REGEXP_REPLACE(
                                 TRIM(REGEXP_SUBSTR(
                                   S.ROC_30_PAY_AMTS,
                                   '[^,]+',
                                   1,
                                   LEVEL
                                 )),
                                 '[^0-9.-]',
                                 ''
                               ),
                               ''
                             )),
                             2
                           ),
                           'FM9999999999990D00',
                           'NLS_NUMERIC_CHARACTERS=.,'
                         )
                       ELSE
                         TRIM(REGEXP_SUBSTR(
                           S.ROC_30_PAY_AMTS,
                           '[^,]+',
                           1,
                           LEVEL
                         ))
                     END,
                     ',') WITHIN GROUP(
                    ORDER BY LEVEL)
                   FROM DUAL
                 CONNECT BY
                   REGEXP_SUBSTR(
                     S.ROC_30_PAY_AMTS,
                     '[^,]+',
                     1,
                     LEVEL
                   ) IS NOT NULL
               ),
               '~'
             ) = NVL(
               (
                 SELECT
                   LISTAGG(
                     CASE
                       WHEN REGEXP_LIKE(NULLIF(
                         REGEXP_REPLACE(
                           TRIM(REGEXP_SUBSTR(
                             T.PAY_DETAIL_AMOUNT,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           '[^0-9.-]',
                           ''
                         ),
                         ''
                       ),
                                        '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                         TO_CHAR(
                           ROUND(
                             TO_NUMBER(NULLIF(
                               REGEXP_REPLACE(
                                 TRIM(REGEXP_SUBSTR(
                                   T.PAY_DETAIL_AMOUNT,
                                   '[^,]+',
                                   1,
                                   LEVEL
                                 )),
                                 '[^0-9.-]',
                                 ''
                               ),
                               ''
                             )),
                             2
                           ),
                           'FM9999999999990D00',
                           'NLS_NUMERIC_CHARACTERS=.,'
                         )
                       ELSE
                         TRIM(REGEXP_SUBSTR(
                           T.PAY_DETAIL_AMOUNT,
                           '[^,]+',
                           1,
                           LEVEL
                         ))
                     END,
                     ',') WITHIN GROUP(
                    ORDER BY LEVEL)
                   FROM DUAL
                 CONNECT BY
                   REGEXP_SUBSTR(
                     T.PAY_DETAIL_AMOUNT,
                     '[^,]+',
                     1,
                     LEVEL
                   ) IS NOT NULL
               ),
               '~'
             ) THEN
               'Yes'
             ELSE
               'No'
           END AS IPB0001_30_MATCH,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.PAYMENT_RECEIVED,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.PAYMENT_RECEIVED,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_30_S_PAYMENT_RECEIVED,
           T.PAY_AMT AS IPB0001_30_T_PAY_AMT,
           S.ROC_30_PAY_DATES AS IPB0001_30_S_ROC_30_PAY_DATES,
           T.PAY_DETAIL_DATE AS IPB0001_30_T_PAY_DETAIL_DATE,
           S.ROC_30_PAY_AMTS AS IPB0001_30_S_ROC_30_PAY_AMTS,
           T.PAY_DETAIL_AMOUNT AS IPB0001_30_T_PAY_DETAIL_AMOUNT,
    -- IPB0001_42: Federal Subsidy + Region + State Subsidy
           CASE
             WHEN NVL(
                 ROUND(
                   CASE
                     WHEN REGEXP_LIKE(NULLIF(
                       REGEXP_REPLACE(
                         S.FEDERAL_SUBSIDY,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ),
                                      '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                       TO_NUMBER(NULLIF(
                         REGEXP_REPLACE(
                           S.FEDERAL_SUBSIDY,
                           '[^0-9.-]',
                           ''
                         ),
                         ''
                       ))
                   END,
                   2
                 ),
                 -99999999999999
               ) = NVL(
                 ROUND(
                   T.APTC,
                   2
                 ),
                 -99999999999999
               )
                AND NVL(
               TRIM(S.REGION),
               '~'
             ) = NVL(
               TRIM(T.REGION),
               '~'
             )
                AND NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.STATE_SUBSIDY,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.STATE_SUBSIDY,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               -99999999999999
             ) = NVL(
               ROUND(
                 T.STATE_SUBSIDY,
                 2
               ),
               -99999999999999
             ) THEN
               'Yes'
             ELSE
               'No'
           END AS IPB0001_42_MATCH,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.FEDERAL_SUBSIDY,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.FEDERAL_SUBSIDY,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_42_S_FEDERAL_SUBSIDY,
           T.APTC AS IPB0001_42_T_APTC,
           S.REGION AS IPB0001_42_S_REGION,
           T.REGION AS IPB0001_42_T_REGION,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.STATE_SUBSIDY,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.STATE_SUBSIDY,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_42_S_STATE_SUBSIDY,
           T.STATE_SUBSIDY AS IPB0001_42_T_STATE_SUBSIDY,
    -- IPB0001_28: Retroactive Federal/State/Total + Other Adjustment + Combined detail strings (normalized)
           CASE
             WHEN NVL(
                 ROUND(
                   CASE
                     WHEN REGEXP_LIKE(NULLIF(
                       REGEXP_REPLACE(
                         S.RETROACTIVE_FEDREAL_AMT,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ),
                                      '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                       TO_NUMBER(NULLIF(
                         REGEXP_REPLACE(
                           S.RETROACTIVE_FEDREAL_AMT,
                           '[^0-9.-]',
                           ''
                         ),
                         ''
                       ))
                   END,
                   2
                 ),
                 0
               ) = NVL(
                 ROUND(
                   T.RETRO_APTC,
                   2
                 ),
                 0
               )
                AND NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.RETROACTIVE_STATE_SUBSDIY_AMT,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.RETROACTIVE_STATE_SUBSDIY_AMT,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               0
             ) = NVL(
               ROUND(
                 T.RETRO_STATE_SUBSIDY,
                 2
               ),
               0
             )
                AND NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.TOTAL_RETROACTIVE_AMOUNT,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.TOTAL_RETROACTIVE_AMOUNT,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               0
             ) = NVL(
               ROUND(
                 T.RETRO_DUES,
                 2
               ),
               0
             )
                AND NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.OTHER_ADJUSTMENT,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.OTHER_ADJUSTMENT,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               0
             ) = NVL(
               ROUND(
                 T.OTHER_ADJUSTMENTS,
                 2
               ),
               0
             )
                AND NVL(
               (
                 SELECT
                   LISTAGG(TO_CHAR(
                     CASE
                       WHEN REGEXP_LIKE(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           S.RETROACTIVE_FEDERAL_COMBINED,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         1,
                         INSTR(
                                  TRIM(REGEXP_SUBSTR(
                                    S.RETROACTIVE_FEDERAL_COMBINED,
                                    '[^,]+',
                                    1,
                                    LEVEL
                                  )),
                                  '='
                                ) - 1
                       )),
                                        '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                         TO_DATE(TRIM(SUBSTR(
                           TRIM(REGEXP_SUBSTR(
                             S.RETROACTIVE_FEDERAL_COMBINED,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           1,
                           INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      S.RETROACTIVE_FEDERAL_COMBINED,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) - 1
                         )),
                                 'MM/DD/YYYY')
                       WHEN REGEXP_LIKE(UPPER(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           S.RETROACTIVE_FEDERAL_COMBINED,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         1,
                         INSTR(
                                  TRIM(REGEXP_SUBSTR(
                                    S.RETROACTIVE_FEDERAL_COMBINED,
                                    '[^,]+',
                                    1,
                                    LEVEL
                                  )),
                                  '='
                                ) - 1
                       ))),
                                        '^[A-Z]{3}-[0-9]{4}$') THEN
                         TO_DATE(UPPER(TRIM(SUBSTR(
                           TRIM(REGEXP_SUBSTR(
                             S.RETROACTIVE_FEDERAL_COMBINED,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           1,
                           INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      S.RETROACTIVE_FEDERAL_COMBINED,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) - 1
                         ))),
                                 'MON-YYYY',
                                 'NLS_DATE_LANGUAGE=ENGLISH')
                     END,
                     'YYYYMM'
                   )
                           || '='
                           || TO_CHAR(
                     ROUND(
                       TO_NUMBER(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           S.RETROACTIVE_FEDERAL_COMBINED,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      S.RETROACTIVE_FEDERAL_COMBINED,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) + 1
                       ))),
                       2
                     ),
                     'FM9999999999990D00',
                     'NLS_NUMERIC_CHARACTERS=.,'
                   ),
                           ', ') WITHIN GROUP(
                    ORDER BY LEVEL)
                   FROM DUAL
                 CONNECT BY
                   REGEXP_SUBSTR(
                     S.RETROACTIVE_FEDERAL_COMBINED,
                     '[^,]+',
                     1,
                     LEVEL
                   ) IS NOT NULL
               ),
               '~'
             ) = NVL(
               (
                 SELECT
                   LISTAGG(TO_CHAR(
                     CASE
                       WHEN REGEXP_LIKE(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           T.FEDERAL_RETRO_DETAIL,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         1,
                         INSTR(
                                  TRIM(REGEXP_SUBSTR(
                                    T.FEDERAL_RETRO_DETAIL,
                                    '[^,]+',
                                    1,
                                    LEVEL
                                  )),
                                  '='
                                ) - 1
                       )),
                                        '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                         TO_DATE(TRIM(SUBSTR(
                           TRIM(REGEXP_SUBSTR(
                             T.FEDERAL_RETRO_DETAIL,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           1,
                           INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      T.FEDERAL_RETRO_DETAIL,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) - 1
                         )),
                                 'MM/DD/YYYY')
                       WHEN REGEXP_LIKE(UPPER(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           T.FEDERAL_RETRO_DETAIL,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         1,
                         INSTR(
                                  TRIM(REGEXP_SUBSTR(
                                    T.FEDERAL_RETRO_DETAIL,
                                    '[^,]+',
                                    1,
                                    LEVEL
                                  )),
                                  '='
                                ) - 1
                       ))),
                                        '^[A-Z]{3}-[0-9]{4}$') THEN
                         TO_DATE(UPPER(TRIM(SUBSTR(
                           TRIM(REGEXP_SUBSTR(
                             T.FEDERAL_RETRO_DETAIL,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           1,
                           INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      T.FEDERAL_RETRO_DETAIL,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) - 1
                         ))),
                                 'MON-YYYY',
                                 'NLS_DATE_LANGUAGE=ENGLISH')
                     END,
                     'YYYYMM'
                   )
                           || '='
                           || TO_CHAR(
                     ROUND(
                       TO_NUMBER(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           T.FEDERAL_RETRO_DETAIL,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      T.FEDERAL_RETRO_DETAIL,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) + 1
                       ))),
                       2
                     ),
                     'FM9999999999990D00',
                     'NLS_NUMERIC_CHARACTERS=.,'
                   ),
                           ', ') WITHIN GROUP(
                    ORDER BY LEVEL)
                   FROM DUAL
                 CONNECT BY
                   REGEXP_SUBSTR(
                     T.FEDERAL_RETRO_DETAIL,
                     '[^,]+',
                     1,
                     LEVEL
                   ) IS NOT NULL
               ),
               '~'
             )
                AND NVL(
               (
                 SELECT
                   LISTAGG(TO_CHAR(
                     CASE
                       WHEN REGEXP_LIKE(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         1,
                         INSTR(
                                  TRIM(REGEXP_SUBSTR(
                                    S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                                    '[^,]+',
                                    1,
                                    LEVEL
                                  )),
                                  '='
                                ) - 1
                       )),
                                        '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                         TO_DATE(TRIM(SUBSTR(
                           TRIM(REGEXP_SUBSTR(
                             S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           1,
                           INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) - 1
                         )),
                                 'MM/DD/YYYY')
                       WHEN REGEXP_LIKE(UPPER(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         1,
                         INSTR(
                                  TRIM(REGEXP_SUBSTR(
                                    S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                                    '[^,]+',
                                    1,
                                    LEVEL
                                  )),
                                  '='
                                ) - 1
                       ))),
                                        '^[A-Z]{3}-[0-9]{4}$') THEN
                         TO_DATE(UPPER(TRIM(SUBSTR(
                           TRIM(REGEXP_SUBSTR(
                             S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           1,
                           INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) - 1
                         ))),
                                 'MON-YYYY',
                                 'NLS_DATE_LANGUAGE=ENGLISH')
                     END,
                     'YYYYMM'
                   )
                           || '='
                           || TO_CHAR(
                     ROUND(
                       TO_NUMBER(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) + 1
                       ))),
                       2
                     ),
                     'FM9999999999990D00',
                     'NLS_NUMERIC_CHARACTERS=.,'
                   ),
                           ', ') WITHIN GROUP(
                    ORDER BY LEVEL)
                   FROM DUAL
                 CONNECT BY
                   REGEXP_SUBSTR(
                     S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                     '[^,]+',
                     1,
                     LEVEL
                   ) IS NOT NULL
               ),
               '~'
             ) = NVL(
               (
                 SELECT
                   LISTAGG(TO_CHAR(
                     CASE
                       WHEN REGEXP_LIKE(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           T.STATE_RETRO_DETAIL,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         1,
                         INSTR(
                                  TRIM(REGEXP_SUBSTR(
                                    T.STATE_RETRO_DETAIL,
                                    '[^,]+',
                                    1,
                                    LEVEL
                                  )),
                                  '='
                                ) - 1
                       )),
                                        '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                         TO_DATE(TRIM(SUBSTR(
                           TRIM(REGEXP_SUBSTR(
                             T.STATE_RETRO_DETAIL,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           1,
                           INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      T.STATE_RETRO_DETAIL,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) - 1
                         )),
                                 'MM/DD/YYYY')
                       WHEN REGEXP_LIKE(UPPER(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           T.STATE_RETRO_DETAIL,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         1,
                         INSTR(
                                  TRIM(REGEXP_SUBSTR(
                                    T.STATE_RETRO_DETAIL,
                                    '[^,]+',
                                    1,
                                    LEVEL
                                  )),
                                  '='
                                ) - 1
                       ))),
                                        '^[A-Z]{3}-[0-9]{4}$') THEN
                         TO_DATE(UPPER(TRIM(SUBSTR(
                           TRIM(REGEXP_SUBSTR(
                             T.STATE_RETRO_DETAIL,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           1,
                           INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      T.STATE_RETRO_DETAIL,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) - 1
                         ))),
                                 'MON-YYYY',
                                 'NLS_DATE_LANGUAGE=ENGLISH')
                     END,
                     'YYYYMM'
                   )
                           || '='
                           || TO_CHAR(
                     ROUND(
                       TO_NUMBER(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           T.STATE_RETRO_DETAIL,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      T.STATE_RETRO_DETAIL,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) + 1
                       ))),
                       2
                     ),
                     'FM9999999999990D00',
                     'NLS_NUMERIC_CHARACTERS=.,'
                   ),
                           ', ') WITHIN GROUP(
                    ORDER BY LEVEL)
                   FROM DUAL
                 CONNECT BY
                   REGEXP_SUBSTR(
                     T.STATE_RETRO_DETAIL,
                     '[^,]+',
                     1,
                     LEVEL
                   ) IS NOT NULL
               ),
               '~'
             ) THEN
               'Yes'
             ELSE
               'No'
           END AS IPB0001_28_MATCH,
           NVL(
             CASE
               WHEN REGEXP_LIKE(NULLIF(
                 REGEXP_REPLACE(
                   S.RETROACTIVE_FEDREAL_AMT,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                 TO_NUMBER(NULLIF(
                   REGEXP_REPLACE(
                     S.RETROACTIVE_FEDREAL_AMT,
                     '[^0-9.-]',
                     ''
                   ),
                   ''
                 ))
             END,
             0
           ) AS IPB0001_28_S_RETROACTIVE_FEDREAL_AMT,
           T.RETRO_APTC AS IPB0001_28_T_APTC,
           NVL(
             CASE
               WHEN REGEXP_LIKE(NULLIF(
                 REGEXP_REPLACE(
                   S.RETROACTIVE_STATE_SUBSDIY_AMT,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                 TO_NUMBER(NULLIF(
                   REGEXP_REPLACE(
                     S.RETROACTIVE_STATE_SUBSDIY_AMT,
                     '[^0-9.-]',
                     ''
                   ),
                   ''
                 ))
             END,
             0
           ) AS IPB0001_28_S_RETROACTIVE_STATE_SUBSIDY_AMT,
           T.RETRO_STATE_SUBSIDY AS IPB0001_28_T_RETRO_STATE_SUBSIDY,
           NVL(
             CASE
               WHEN REGEXP_LIKE(NULLIF(
                 REGEXP_REPLACE(
                   S.TOTAL_RETROACTIVE_AMOUNT,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                 TO_NUMBER(NULLIF(
                   REGEXP_REPLACE(
                     S.TOTAL_RETROACTIVE_AMOUNT,
                     '[^0-9.-]',
                     ''
                   ),
                   ''
                 ))
             END,
             0
           ) AS IPB0001_28_S_TOTAL_RETROACTIVE_AMOUNT,
           T.RETRO_DUES AS IPB0001_28_T_RETRO_DUES,
           NVL(
             CASE
               WHEN REGEXP_LIKE(NULLIF(
                 REGEXP_REPLACE(
                   S.OTHER_ADJUSTMENT,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                 TO_NUMBER(NULLIF(
                   REGEXP_REPLACE(
                     S.OTHER_ADJUSTMENT,
                     '[^0-9.-]',
                     ''
                   ),
                   ''
                 ))
             END,
             0
           ) AS IPB0001_28_S_OTHER_ADJUSTMENT,
           T.OTHER_ADJUSTMENTS AS IPB0001_28_T_ADJUSTMENT_AMT,
           S.RETROACTIVE_FEDERAL_COMBINED AS IPB0001_28_S_RETROACTIVE_FEDERAL_COMBINED,
           T.FEDERAL_RETRO_DETAIL AS IPB0001_28_T_FEDERAL_RETRO_DETAIL,
           S.RETROACTIVE_STATE_SUBSIDY_COMBINED AS IPB0001_28_S_RETROACTIVE_STATE_SUBSIDY_COMBINED,
           T.STATE_RETRO_DETAIL AS IPB0001_28_T_STATE_RETRO_DETAIL,
    -- IPB0001_31: Retroactive Federal/State/Total (without Other Adjustment) + Combined detail strings (normalized)
           CASE
             WHEN NVL(
                 ROUND(
                   CASE
                     WHEN REGEXP_LIKE(NULLIF(
                       REGEXP_REPLACE(
                         S.RETROACTIVE_FEDREAL_AMT,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ),
                                      '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                       TO_NUMBER(NULLIF(
                         REGEXP_REPLACE(
                           S.RETROACTIVE_FEDREAL_AMT,
                           '[^0-9.-]',
                           ''
                         ),
                         ''
                       ))
                   END,
                   2
                 ),
                 0
               ) = NVL(
                 ROUND(
                   T.RETRO_APTC,
                   2
                 ),
                 0
               )
                AND NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.RETROACTIVE_STATE_SUBSDIY_AMT,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.RETROACTIVE_STATE_SUBSDIY_AMT,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               0
             ) = NVL(
               ROUND(
                 T.RETRO_STATE_SUBSIDY,
                 2
               ),
               0
             )
                AND NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.TOTAL_RETROACTIVE_AMOUNT,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.TOTAL_RETROACTIVE_AMOUNT,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               0
             ) = NVL(
               ROUND(
                 T.RETRO_DUES,
                 2
               ),
               0
             )
                AND NVL(
               (
                 SELECT
                   LISTAGG(TO_CHAR(
                     CASE
                       WHEN REGEXP_LIKE(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           S.RETROACTIVE_FEDERAL_COMBINED,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         1,
                         INSTR(
                                  TRIM(REGEXP_SUBSTR(
                                    S.RETROACTIVE_FEDERAL_COMBINED,
                                    '[^,]+',
                                    1,
                                    LEVEL
                                  )),
                                  '='
                                ) - 1
                       )),
                                        '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                         TO_DATE(TRIM(SUBSTR(
                           TRIM(REGEXP_SUBSTR(
                             S.RETROACTIVE_FEDERAL_COMBINED,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           1,
                           INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      S.RETROACTIVE_FEDERAL_COMBINED,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) - 1
                         )),
                                 'MM/DD/YYYY')
                       WHEN REGEXP_LIKE(UPPER(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           S.RETROACTIVE_FEDERAL_COMBINED,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         1,
                         INSTR(
                                  TRIM(REGEXP_SUBSTR(
                                    S.RETROACTIVE_FEDERAL_COMBINED,
                                    '[^,]+',
                                    1,
                                    LEVEL
                                  )),
                                  '='
                                ) - 1
                       ))),
                                        '^[A-Z]{3}-[0-9]{4}$') THEN
                         TO_DATE(UPPER(TRIM(SUBSTR(
                           TRIM(REGEXP_SUBSTR(
                             S.RETROACTIVE_FEDERAL_COMBINED,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           1,
                           INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      S.RETROACTIVE_FEDERAL_COMBINED,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) - 1
                         ))),
                                 'MON-YYYY',
                                 'NLS_DATE_LANGUAGE=ENGLISH')
                     END,
                     'YYYYMM'
                   )
                           || '='
                           || TO_CHAR(
                     ROUND(
                       TO_NUMBER(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           S.RETROACTIVE_FEDERAL_COMBINED,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      S.RETROACTIVE_FEDERAL_COMBINED,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) + 1
                       ))),
                       2
                     ),
                     'FM9999999999990D00',
                     'NLS_NUMERIC_CHARACTERS=.,'
                   ),
                           ', ') WITHIN GROUP(
                    ORDER BY LEVEL)
                   FROM DUAL
                 CONNECT BY
                   REGEXP_SUBSTR(
                     S.RETROACTIVE_FEDERAL_COMBINED,
                     '[^,]+',
                     1,
                     LEVEL
                   ) IS NOT NULL
               ),
               '~'
             ) = NVL(
               (
                 SELECT
                   LISTAGG(TO_CHAR(
                     CASE
                       WHEN REGEXP_LIKE(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           T.FEDERAL_RETRO_DETAIL,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         1,
                         INSTR(
                                  TRIM(REGEXP_SUBSTR(
                                    T.FEDERAL_RETRO_DETAIL,
                                    '[^,]+',
                                    1,
                                    LEVEL
                                  )),
                                  '='
                                ) - 1
                       )),
                                        '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                         TO_DATE(TRIM(SUBSTR(
                           TRIM(REGEXP_SUBSTR(
                             T.FEDERAL_RETRO_DETAIL,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           1,
                           INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      T.FEDERAL_RETRO_DETAIL,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) - 1
                         )),
                                 'MM/DD/YYYY')
                       WHEN REGEXP_LIKE(UPPER(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           T.FEDERAL_RETRO_DETAIL,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         1,
                         INSTR(
                                  TRIM(REGEXP_SUBSTR(
                                    T.FEDERAL_RETRO_DETAIL,
                                    '[^,]+',
                                    1,
                                    LEVEL
                                  )),
                                  '='
                                ) - 1
                       ))),
                                        '^[A-Z]{3}-[0-9]{4}$') THEN
                         TO_DATE(UPPER(TRIM(SUBSTR(
                           TRIM(REGEXP_SUBSTR(
                             T.FEDERAL_RETRO_DETAIL,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           1,
                           INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      T.FEDERAL_RETRO_DETAIL,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) - 1
                         ))),
                                 'MON-YYYY',
                                 'NLS_DATE_LANGUAGE=ENGLISH')
                     END,
                     'YYYYMM'
                   )
                           || '='
                           || TO_CHAR(
                     ROUND(
                       TO_NUMBER(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           T.FEDERAL_RETRO_DETAIL,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      T.FEDERAL_RETRO_DETAIL,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) + 1
                       ))),
                       2
                     ),
                     'FM9999999999990D00',
                     'NLS_NUMERIC_CHARACTERS=.,'
                   ),
                           ', ') WITHIN GROUP(
                    ORDER BY LEVEL)
                   FROM DUAL
                 CONNECT BY
                   REGEXP_SUBSTR(
                     T.FEDERAL_RETRO_DETAIL,
                     '[^,]+',
                     1,
                     LEVEL
                   ) IS NOT NULL
               ),
               '~'
             )
                AND NVL(
               (
                 SELECT
                   LISTAGG(TO_CHAR(
                     CASE
                       WHEN REGEXP_LIKE(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         1,
                         INSTR(
                                  TRIM(REGEXP_SUBSTR(
                                    S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                                    '[^,]+',
                                    1,
                                    LEVEL
                                  )),
                                  '='
                                ) - 1
                       )),
                                        '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                         TO_DATE(TRIM(SUBSTR(
                           TRIM(REGEXP_SUBSTR(
                             S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           1,
                           INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) - 1
                         )),
                                 'MM/DD/YYYY')
                       WHEN REGEXP_LIKE(UPPER(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         1,
                         INSTR(
                                  TRIM(REGEXP_SUBSTR(
                                    S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                                    '[^,]+',
                                    1,
                                    LEVEL
                                  )),
                                  '='
                                ) - 1
                       ))),
                                        '^[A-Z]{3}-[0-9]{4}$') THEN
                         TO_DATE(UPPER(TRIM(SUBSTR(
                           TRIM(REGEXP_SUBSTR(
                             S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           1,
                           INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) - 1
                         ))),
                                 'MON-YYYY',
                                 'NLS_DATE_LANGUAGE=ENGLISH')
                     END,
                     'YYYYMM'
                   )
                           || '='
                           || TO_CHAR(
                     ROUND(
                       TO_NUMBER(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) + 1
                       ))),
                       2
                     ),
                     'FM9999999999990D00',
                     'NLS_NUMERIC_CHARACTERS=.,'
                   ),
                           ', ') WITHIN GROUP(
                    ORDER BY LEVEL)
                   FROM DUAL
                 CONNECT BY
                   REGEXP_SUBSTR(
                     S.RETROACTIVE_STATE_SUBSIDY_COMBINED,
                     '[^,]+',
                     1,
                     LEVEL
                   ) IS NOT NULL
               ),
               '~'
             ) = NVL(
               (
                 SELECT
                   LISTAGG(TO_CHAR(
                     CASE
                       WHEN REGEXP_LIKE(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           T.STATE_RETRO_DETAIL,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         1,
                         INSTR(
                                  TRIM(REGEXP_SUBSTR(
                                    T.STATE_RETRO_DETAIL,
                                    '[^,]+',
                                    1,
                                    LEVEL
                                  )),
                                  '='
                                ) - 1
                       )),
                                        '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                         TO_DATE(TRIM(SUBSTR(
                           TRIM(REGEXP_SUBSTR(
                             T.STATE_RETRO_DETAIL,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           1,
                           INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      T.STATE_RETRO_DETAIL,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) - 1
                         )),
                                 'MM/DD/YYYY')
                       WHEN REGEXP_LIKE(UPPER(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           T.STATE_RETRO_DETAIL,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         1,
                         INSTR(
                                  TRIM(REGEXP_SUBSTR(
                                    T.STATE_RETRO_DETAIL,
                                    '[^,]+',
                                    1,
                                    LEVEL
                                  )),
                                  '='
                                ) - 1
                       ))),
                                        '^[A-Z]{3}-[0-9]{4}$') THEN
                         TO_DATE(UPPER(TRIM(SUBSTR(
                           TRIM(REGEXP_SUBSTR(
                             T.STATE_RETRO_DETAIL,
                             '[^,]+',
                             1,
                             LEVEL
                           )),
                           1,
                           INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      T.STATE_RETRO_DETAIL,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) - 1
                         ))),
                                 'MON-YYYY',
                                 'NLS_DATE_LANGUAGE=ENGLISH')
                     END,
                     'YYYYMM'
                   )
                           || '='
                           || TO_CHAR(
                     ROUND(
                       TO_NUMBER(TRIM(SUBSTR(
                         TRIM(REGEXP_SUBSTR(
                           T.STATE_RETRO_DETAIL,
                           '[^,]+',
                           1,
                           LEVEL
                         )),
                         INSTR(
                                    TRIM(REGEXP_SUBSTR(
                                      T.STATE_RETRO_DETAIL,
                                      '[^,]+',
                                      1,
                                      LEVEL
                                    )),
                                    '='
                                  ) + 1
                       ))),
                       2
                     ),
                     'FM9999999999990D00',
                     'NLS_NUMERIC_CHARACTERS=.,'
                   ),
                           ', ') WITHIN GROUP(
                    ORDER BY LEVEL)
                   FROM DUAL
                 CONNECT BY
                   REGEXP_SUBSTR(
                     T.STATE_RETRO_DETAIL,
                     '[^,]+',
                     1,
                     LEVEL
                   ) IS NOT NULL
               ),
               '~'
             ) THEN
               'Yes'
             ELSE
               'No'
           END AS IPB0001_31_MATCH,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.RETROACTIVE_FEDREAL_AMT,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.RETROACTIVE_FEDREAL_AMT,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_31_S_RETROACTIVE_FEDERAL_AMT,
           T.RETRO_APTC AS IPB0001_31_T_APTC,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.RETROACTIVE_STATE_SUBSDIY_AMT,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.RETROACTIVE_STATE_SUBSDIY_AMT,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_31_S_RETROACTIVE_STATE_SUBSIDY_AMT,
           T.RETRO_STATE_SUBSIDY AS IPB0001_31_T_RETRO_STATE_SUBSIDY,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.TOTAL_RETROACTIVE_AMOUNT,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.TOTAL_RETROACTIVE_AMOUNT,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_31_S_TOTAL_RETROACTIVE_AMOUNT,
           T.RETRO_DUES AS IPB0001_31_T_RETRO_DUES,
           S.RETROACTIVE_FEDERAL_COMBINED AS IPB0001_31_S_RETROACTIVE_FEDERAL_COMBINED,
           T.FEDERAL_RETRO_DETAIL AS IPB0001_31_T_FEDERAL_RETRO_DETAIL,
           S.RETROACTIVE_STATE_SUBSIDY_COMBINED AS IPB0001_31_S_RETROACTIVE_STATE_SUBSIDY_COMBINED,
           T.STATE_RETRO_DETAIL AS IPB0001_31_T_STATE_RETRO_DETAIL,
    -- IPB0001_43: Subtotal vs Total Amount Due
           CASE
             WHEN NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.SUBTOTAL,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.SUBTOTAL,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               -99999999999999
             ) = NVL(
               ROUND(
                 T.TOTAL_AMOUNT_DUE,
                 2
               ),
               -99999999999999
             ) THEN
               'Yes'
             ELSE
               'No'
           END AS IPB0001_43_MATCH,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.SUBTOTAL,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.SUBTOTAL,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_43_S_SUBTOTAL,
           T.TOTAL_AMOUNT_DUE AS IPB0001_43_T_TOTAL_AMOUNT_DUE,
    -- IPB0001_14: ACI Pay Mode vs Autopay Ind
           CASE
             WHEN NVL(
               REPLACE(
                 UPPER(TRIM(S.ACI_PAY_MODE)),
                 'A',
                 'Y'
               ),
               '~'
             ) = NVL(
               REPLACE(
                 UPPER(TRIM(T.AUTOPAY_IND)),
                 'A',
                 'Y'
               ),
               '~'
             ) THEN
               'Yes'
             ELSE
               'No'
           END AS IPB0001_14_MATCH,
           UPPER(TRIM(S.ACI_PAY_MODE)) AS IPB0001_14_S_ACI_PAY_MODE,
           UPPER(TRIM(T.AUTOPAY_IND)) AS IPB0001_14_T_AUTOPAY_IND,
    -- IPB0001_18: Prior Month Balance + Payment Received + Other Adjustment
           CASE
             WHEN NVL(
                 ROUND(
                   CASE
                     WHEN REGEXP_LIKE(NULLIF(
                       REGEXP_REPLACE(
                         S.PRIOR_MONTH_BALANCE,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ),
                                      '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                       TO_NUMBER(NULLIF(
                         REGEXP_REPLACE(
                           S.PRIOR_MONTH_BALANCE,
                           '[^0-9.-]',
                           ''
                         ),
                         ''
                       ))
                   END,
                   2
                 ),
                 -99999999999999
               ) = NVL(
                 ROUND(
                   T.PREVIOUS_BALANCE,
                   2
                 ),
                 -99999999999999
               )
                AND NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.PAYMENT_RECEIVED,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.PAYMENT_RECEIVED,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               -99999999999999
             ) = NVL(
               ROUND(
                 T.PAY_AMT,
                 2
               ),
               -99999999999999
             )
                AND NVL(
               ROUND(
                 CASE
                   WHEN REGEXP_LIKE(NULLIF(
                     REGEXP_REPLACE(
                       S.OTHER_ADJUSTMENT,
                       '[^0-9.-]',
                       ''
                     ),
                     ''
                   ),
                                    '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$') THEN
                     TO_NUMBER(NULLIF(
                       REGEXP_REPLACE(
                         S.OTHER_ADJUSTMENT,
                         '[^0-9.-]',
                         ''
                       ),
                       ''
                     ))
                 END,
                 2
               ),
               -99999999999999
             ) = NVL(
               ROUND(
                 T.OTHER_ADJUSTMENTS,
                 2
               ),
               -99999999999999
             ) THEN
               'Yes'
             ELSE
               'No'
           END AS IPB0001_18_MATCH,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.PRIOR_MONTH_BALANCE,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.PRIOR_MONTH_BALANCE,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_18_S_PRIOR_MONTH_BALANCE,
           T.PREVIOUS_BALANCE AS IPB0001_18_T_PREVIOUS_BALANCE,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.PAYMENT_RECEIVED,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.PAYMENT_RECEIVED,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_18_S_PAYMENT_RECEIVED,
           T.PAY_AMT AS IPB0001_18_T_PAY_AMT,
           CASE
             WHEN REGEXP_LIKE ( NULLIF(
               REGEXP_REPLACE(
                 S.OTHER_ADJUSTMENT,
                 '[^0-9.-]',
                 ''
               ),
               ''
             ),
                                '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' ) THEN
               TO_NUMBER(NULLIF(
                 REGEXP_REPLACE(
                   S.OTHER_ADJUSTMENT,
                   '[^0-9.-]',
                   ''
                 ),
                 ''
               ))
           END AS IPB0001_18_S_OTHER_ADJUSTMENT,
           T.OTHER_ADJUSTMENTS AS IPB0001_18_T_ADJUSTMENT_AMT,
    -- IPB0001_4: Statement Month/Year vs Coverage End Date
    -- Comparison: STATEMENT_MONTH (MM/DD/YYYY) vs COVERAGE_END_DATE month portion (MM/DD/YYYY → MM)
    -- AND STATEMENT_YEAR (MM/DD/YYYY) vs COVERAGE_END_DATE year portion (MM/DD/YYYY → YYYY)
           CASE
             WHEN SUBSTR(
                 TRIM(S.STATEMENT_MONTH),
                 1,
                 2
               ) = SUBSTR(
                 TRIM(T.COVERAGE_END_DATE),
                 1,
                 2
               )
                AND SUBSTR(
               TRIM(S.STATEMENT_MONTH),
               7,
               4
             ) = SUBSTR(
               TRIM(T.COVERAGE_END_DATE),
               7,
               4
             ) THEN
               'Yes'
             ELSE
               'No'
           END AS IPB0001_4_MATCH,
           S.STATEMENT_MONTH AS IPB0001_4_S_STATEMENT_MONTH,
           T.COVERAGE_END_DATE AS IPB0001_4_T_COVERAGE_END_DATE_FOR_MONTH,
           S.STATEMENT_YEAR AS IPB0001_4_S_STATEMENT_YEAR,
           T.COVERAGE_END_DATE AS IPB0001_4_T_COVERAGE_END_DATE_FOR_YEAR,
    -- IPB0001_5: Invoice Generated Date vs Activity Period
           CASE
             WHEN NVL(
               CASE
                 WHEN REGEXP_LIKE(TRIM(S.INVOICE_GENERATED_DATE),
                                  '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                   TO_CHAR(
                     TO_DATE(TRIM(S.INVOICE_GENERATED_DATE),
                           'MM/DD/YYYY'),
                     'YYYYMMDD'
                   )
                 ELSE
                   TRIM(S.INVOICE_GENERATED_DATE)
               END,
               '~'
             ) = NVL(
               CASE
                 WHEN REGEXP_LIKE(TRIM(T.ACTIVITY_PERIOD),
                                  '^[0-9]{2}/[0-9]{2}/[0-9]{4}$') THEN
                   TO_CHAR(
                     TO_DATE(TRIM(T.ACTIVITY_PERIOD),
                           'MM/DD/YYYY'),
                     'YYYYMMDD'
                   )
                 ELSE
                   TRIM(T.ACTIVITY_PERIOD)
               END,
               '~'
             ) THEN
               'Yes'
             ELSE
               'No'
           END AS IPB0001_5_MATCH,
           S.INVOICE_GENERATED_DATE AS IPB0001_5_S_INVOICE_GENERATED_DATE,
           T.ACTIVITY_PERIOD AS IPB0001_5_T_ACTIVITY_PERIOD
      FROM COMPARE_OWNER.KPIF_CMP_SOURCE_ROC_XML S
      LEFT JOIN COMPARE_OWNER.KPIF_CMP_TARGET_ORMB T
    ON T.BATCH_NBR = S.BATCH_NBR
       AND T.BILL_ID = S.BILL_ID
     WHERE S.BATCH_NBR = V_BATCH_NBR;

  DECLARE
    V_TOTAL_COMPARE_ROC NUMBER;
  BEGIN
    SELECT COUNT(*)
      INTO V_TOTAL_COMPARE_ROC
      FROM COMPARE_OWNER.MOC_CMP_RESULTS
     WHERE BATCH_NBR = V_BATCH_NBR
       AND RUN_ID = P_RUN_ID;

    SET_RUN_STATUS(
      P_STATUS            => 'MOC_CMP_RESULTS INSERTION COMPLETED',
      P_STEP              => 'MOC RESULTS INSERT',
      P_NEXT_STEP         => 'COMPLETE',
      P_TOTAL_COMPARE_ROC => V_TOTAL_COMPARE_ROC
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
    -- Preserve CANCELED status if already set by the cancel endpoint
    BEGIN
      SELECT STATUS
        INTO V_CURRENT_STATUS
        FROM COMPARE_OWNER.KPIF_CMP_RUN_STATUS
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