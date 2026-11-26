WITH BILL_SCOPE AS (
  SELECT DISTINCT BR.BILL_ID,
                  BR.BATCH_NBR
    FROM BILLING_OWNER.CI_BILL_ROUTING BR
   WHERE BR.BATCH_CD = 'CM-BILEX'
     AND BR.BATCH_NBR = :BATCH
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
             WHEN SS.CHRG_DESCR LIKE 'State Subsidy%'
                 OR UPPER(SS.CHRG_DESCR) LIKE 'STATE SUBSIDY%'
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
             WHEN SS.CHRG_DESCR LIKE 'State Subsidy%'
                 OR UPPER(SS.CHRG_DESCR) LIKE 'STATE SUBSIDY%'
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
  SELECT BL.BILL_ID,
         BL.CM_EXT_SEQ_NUM,
         LISTAGG((TO_CHAR(
           EBP.PAY_DT,
           'MM/DD/YYYY'
         )),
                 ', ' ON OVERFLOW TRUNCATE '||OVF||' WITHOUT COUNT) WITHIN GROUP(
          ORDER BY EBP.PAY_DT,
                   EBP.PAY_AMT) PAY_DETAIL_DATE,
         LISTAGG(EBP.PAY_AMT,
                 ', ' ON OVERFLOW TRUNCATE '||OVF||' WITHOUT COUNT) WITHIN GROUP(
          ORDER BY EBP.PAY_DT,
                   EBP.PAY_AMT) PAY_DETAIL_AMOUNT
    FROM BILL_LATEST BL
    LEFT JOIN BILLING_OWNER.CM_EXTR_BILL_PAY EBP
  ON BL.BILL_ID = EBP.BILL_ID
     AND BL.CM_EXT_SEQ_NUM = EBP.CM_EXT_SEQ_NUM
   WHERE EBP.PAY_STATUS_FLG != '60'
   GROUP BY BL.BILL_ID,
            BL.CM_EXT_SEQ_NUM
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
       ( K.CURRENT_DUE + K.PREVIOUS_BALANCE + K.NET_PAY_AMT ) TOTAL_AMOUNT_DUE, -- SUB TOTAL
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