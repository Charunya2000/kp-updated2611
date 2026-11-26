--------------------------------------------------------------------------------
-- Source table: CA XML extract
--------------------------------------------------------------------------------
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE COMPARE_OWNER.KPIF_CMP_SOURCE_CA_XML PURGE';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -942 THEN
      RAISE;
    END IF;
END;
/
CREATE TABLE COMPARE_OWNER.KPIF_CMP_SOURCE_CA_XML (
  BATCH_NBR                                 NUMBER         NOT NULL,
  BILL_ID                                   VARCHAR2(30)   NOT NULL,
  KPMC_TRANSACTION_ID                       VARCHAR2(100)  NOT NULL,
  RGN_CD                                    VARCHAR2(10),
  BATCH_CD                                  VARCHAR2(30),
  TYPE                                      VARCHAR2(50),

  REGION                                    VARCHAR2(100),
  BILLING_UNIT_ID                           VARCHAR2(100),
  INVOICE_GENERATED_DATE                    VARCHAR2(40),
  PAYMENT_DUE_DATE                          VARCHAR2(40),
  RETROACTIVE_DUE                           VARCHAR2(100),
  COVERAGE_THROUGH_MONTH                    VARCHAR2(20),
  COVERGAE_THROUGH_YEAR                     VARCHAR2(20),
  CURRENT_PREMIUM_DUE                       VARCHAR2(100),
  AUTOPAY_INDICATOR                         VARCHAR2(10),
  BILLING_UNIT_TYPE                         VARCHAR2(50),
  JURISDICTION                              VARCHAR2(2),

  ACTIVITY_START_DATE                       VARCHAR2(40),
  ACTIVITY_END_DATE                         VARCHAR2(40),
  PRIOR_MONTH_BALANCE                       VARCHAR2(100),
  PAYMENT_RECEIVED                          VARCHAR2(100),
  TOTAL_ADJUSTMENT_AMT                      VARCHAR2(100),
  SUBTOTAL_DUE                              NUMBER(18,2),
  PAST_DUE                                  VARCHAR2(100),
  REMITTANCE_RVERSAL_AMT                    VARCHAR2(100),
  COVERAGE_THROUGH_MONTH_2                  VARCHAR2(20),

  APTC                                      VARCHAR2(100),
  STATE_SUBSIDY                             VARCHAR2(100),
  STATE_PREMIUM_CREDIT                      VARCHAR2(100),
  RETRO_DUE_WITHOUT_LIS_AMT                 VARCHAR2(100),
  RETRO_DUE_LEP_AMT                         VARCHAR2(100),

  PAST_DUE_COVERAGE_PERIODS                 VARCHAR2(1000),
  PAST_DUE_DATES                            VARCHAR2(1000),
  PAST_DUE_AMOUNTS                          VARCHAR2(1000),

  RETROACTIVE_FEDERAL_COMBINED              VARCHAR2(4000),
  RETROACTIVE_FEDREAL_AMT                   VARCHAR2(100),
  RETROACTIVE_STATE_SUBSIDY_COMBINED        VARCHAR2(4000),
  RETROACTIVE_STATE_SUBSDIY_AMT             VARCHAR2(100),
  RETROACTIVE_TOTAL_AMOUNT                  VARCHAR2(100),

  CREATED_TS                                TIMESTAMP      DEFAULT SYSTIMESTAMP
);


SELECT * FROM COMPARE_OWNER.KPIF_CMP_SOURCE_CA_XML;

--------------------------------------------------------------------------------
-- Source table: ROC XML extract
--------------------------------------------------------------------------------
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE COMPARE_OWNER.KPIF_CMP_SOURCE_ROC_XML PURGE';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -942 THEN
      RAISE;
    END IF;
END;
/
CREATE TABLE COMPARE_OWNER.KPIF_CMP_SOURCE_ROC_XML (
  BATCH_NBR                                 NUMBER         NOT NULL,
  BILL_ID                                   VARCHAR2(30)   NOT NULL,
  TYPE                                      VARCHAR2(50),

  TRANSACTION_ID                            VARCHAR2(100),
  INVOICE_NUMBER                            VARCHAR2(100),
  REGION                                    VARCHAR2(100),
  REGION_ID                                 VARCHAR2(50),
  GROUP_ID                                  VARCHAR2(50),
  BILL_GRP_ID                               VARCHAR2(50),
  SUB_GRP_ID                                VARCHAR2(50),
  BILLING_UNIT_ID                           VARCHAR2(100),

  INVOICE_GENERATED_DATE                    VARCHAR2(40),
  STATEMENT_MONTH                           VARCHAR2(20),
  STATEMENT_YEAR                            VARCHAR2(20),
  PRIOR_MONTH_BALANCE                       VARCHAR2(100),
  PAYMENT_RECEIVED                          VARCHAR2(100),
  REJECTED_PAYMENT                          VARCHAR2(100),
  CURRENT_PREMIUM_DUE                       VARCHAR2(100),
  TOTAL_BALANCE_DUE                         VARCHAR2(100),
  OTHER_ADJUSTMENT                          VARCHAR2(100),
  ACI_PAY_MODE                              VARCHAR2(50),
  JURISDICTION                              VARCHAR2(2),

  REGION_NAME_INVOICE_DETAIL                VARCHAR2(100),
  CURRENT_MONTH_PREMIUM                     VARCHAR2(100),
  CURRENT_MONTH_PREMIUM_NO_LISLEP           VARCHAR2(100),
  ADVANTAGE_PLUS                            VARCHAR2(100),
  LATE_ENROLLMENT_PENALTY                   VARCHAR2(100),
  LOW_INCOME_SUBSIDY                        VARCHAR2(100),
  FEDERAL_SUBSIDY                           VARCHAR2(100),
  STATE_SUBSIDY                             VARCHAR2(100),
  SUBTOTAL                                  VARCHAR2(100),

  PAY_FROM_DATE                             VARCHAR2(40),
  PAY_THROUGH_DATE                          VARCHAR2(40),
  PAY_OVER_30_AMT                           VARCHAR2(100),
  TOTAL_RETROACTIVE_AMOUNT                  VARCHAR2(100),

  RETROACTIVE_FEDERAL_COMBINED              VARCHAR2(4000),
  RETROACTIVE_FEDREAL_AMT                   VARCHAR2(100),
  RETROACTIVE_STATE_SUBSIDY_COMBINED        VARCHAR2(4000),
  RETROACTIVE_STATE_SUBSDIY_AMT             VARCHAR2(100),

  ROC_30_PAY_DATES                          VARCHAR2(1000),
  ROC_30_PAY_AMTS                           VARCHAR2(1000),

  CREATED_TS                                TIMESTAMP      DEFAULT SYSTIMESTAMP
);


SELECT * FROM COMPARE_OWNER.KPIF_CMP_SOURCE_ROC_XML;
--------------------------------------------------------------------------------
-- Target table: ORMB extract
--------------------------------------------------------------------------------
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE COMPARE_OWNER.KPIF_CMP_TARGET_ORMB PURGE';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -942 THEN
      RAISE;
    END IF;
END;
/
CREATE TABLE COMPARE_OWNER.KPIF_CMP_TARGET_ORMB (
  BILL_ID                             VARCHAR2(30)   NOT NULL,
  BATCH_NBR                           NUMBER         NOT NULL,
  REGION                              VARCHAR2(100),
  LOB                                 VARCHAR2(8),
  PAST_DUE_DT                         VARCHAR2(4000),
  PAST_DUE_AMT                        VARCHAR2(4000),
  PAST_COVERAGE_PERIOD                VARCHAR2(4000),
  ORMB_ACCT_ID                        VARCHAR2(50),
  COVERAGE_START_DATE                 VARCHAR2(10),
  COVERAGE_END_DATE                   VARCHAR2(10),
  ACTIVITY_PERIOD                     VARCHAR2(10),
  ACTIVITY_START_DATE                VARCHAR2(10),
  ACTIVITY_END_DATE                  VARCHAR2(10),
  DUE_DATE                            VARCHAR2(10),
  AUTOPAY_IND                         VARCHAR2(1),
  PAID_FROM_DT                        VARCHAR2(40),
  PAID_THROUGH_DT                     VARCHAR2(40),
  PREVIOUS_BALANCE                    NUMBER(18,2),
  PAY_AMT                             NUMBER(18,2),
  CANCEL_PAY_AMT                      NUMBER(18,2),
  NET_PAY_AMT                         NUMBER(18,2),
  CM_TOT_RETRO_CHRG_AMT               NUMBER(18,2),
  CM_TOT_RETRO_CHRG_CURR_NONPREM_AMT  NUMBER(18,2),
  CURRENT_DUE                         NUMBER(18,2),
  PAST_DUE_TOTAL_AMOUNT               NUMBER(18,2),
  RETRO_DUES                          NUMBER(18,2),
  ADJUSTMENT_AMT                      NUMBER(18,2),
  TOTAL_CURRENT_CHARGES               NUMBER(18,2),
  CURRENT_BALANCE                     NUMBER(18,2),
  TOTAL_AMOUNT_DUE                    NUMBER(18,2),
  APTC                                NUMBER(18,2),
  RETRO_APTC                          NUMBER(18,2),
  STATE_SUBSIDY                       NUMBER(18,2),
  RETRO_STATE_SUBSIDY                 NUMBER(18,2),
  STATE_PRE_CREDIT                    NUMBER(18,2),
  RETRO_STATE_PRE_CREDIT              NUMBER(18,2),
  LIS_AMT                             NUMBER(18,2),
  WS_RDUE_LIS_AMT                     NUMBER(18,2),
  LEP_AMT                             NUMBER(18,2),
  WS_RDUE_LEP_AMT                     NUMBER(18,2),
  SUBSCRIBER_MRN                      VARCHAR2(100),
  RETRO_DUE_WITHOUT_LIS_AMT           NUMBER(18,2),
  PAY_DETAIL_DATE                     VARCHAR2(4000),
  PAY_DETAIL_AMOUNT                   VARCHAR2(4000),
  FEDERAL_RETRO_DETAIL                VARCHAR2(4000),
  STATE_RETRO_DETAIL                  VARCHAR2(4000),
  CREATED_TS          TIMESTAMP      DEFAULT SYSTIMESTAMP
);


SELECT * FROM COMPARE_OWNER.KPIF_CMP_TARGET_ORMB;

--------------------------------------------------------------------------------
-- Run status table: procedure progress tracking
--------------------------------------------------------------------------------
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE COMPARE_OWNER.KPIF_CMP_RUN_STATUS PURGE';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -942 THEN
      RAISE;
    END IF;
END;
/
CREATE TABLE COMPARE_OWNER.KPIF_CMP_RUN_STATUS (
  RUN_ID         NUMBER(13,0)   NOT NULL,
  BATCH_NBR      NUMBER         NOT NULL,
  STATUS         VARCHAR2(100)  NOT NULL,
  CURRENT_STEP   VARCHAR2(200),
  NEXT_STEP      VARCHAR2(200),
  ERROR_MESSAGE  VARCHAR2(1000),
  INVOICES_CA        NUMBER     DEFAULT 0,
  INVOICES_ROC       NUMBER     DEFAULT 0,
  TOTAL_RECORDS_ORMB NUMBER     DEFAULT 0,
  TOTAL_COMPARE_CA   NUMBER     DEFAULT 0,
  TOTAL_COMPARE_ROC  NUMBER     DEFAULT 0,
  START_TS       TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
  LAST_UPDATE_TS TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
  END_TS         TIMESTAMP,
  CONSTRAINT PK_KPIF_CMP_RUN_STATUS PRIMARY KEY (RUN_ID, BATCH_NBR)
);


SELECT * FROM COMPARE_OWNER.KPIF_CMP_RUN_STATUS;

--------------------------------------------------------------------------------
-- Final comparison result table
--------------------------------------------------------------------------------

BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE COMPARE_OWNER.KPIF_CMP_RESULTS PURGE';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -942 THEN
      RAISE;
    END IF;
END;
/
CREATE TABLE COMPARE_OWNER.KPIF_CMP_RESULTS (
  RUN_ID              NUMBER(13,0)   NOT NULL,
  BATCH_NBR           NUMBER         NOT NULL,
  KPMC_TRANSACTION_ID VARCHAR2(100)  NOT NULL,
  REGION              VARCHAR2(10),
  RGN_CD              VARCHAR2(10),
  LOB                 VARCHAR2(8),
  SUBSCRIBER_MRN      VARCHAR2(100),
  JURISDICTION        VARCHAR2(2),

  IPB0001_22_MATCH    VARCHAR2(3),
  IPB0001_22_S_Prior_Month_Balance       NUMBER(18,2),
  IPB0001_22_T_Previous_Balance       NUMBER(18,2),
  IPB0001_23_MATCH    VARCHAR2(3),
  IPB0001_23_S_Activity_Start_Date       VARCHAR2(40),
  IPB0001_23_T_Activity_Start_Date       VARCHAR2(10),
  IPB0001_23_S_Activity_End_Date       VARCHAR2(40),
  IPB0001_23_T_Activity_End_Date       VARCHAR2(10),
  IPB0001_23_S_Payment_Received       NUMBER(18,2),
  IPB0001_23_T_Pay_Amt       NUMBER(18,2),
  IPB0001_23_S_Remittance_Rversal_Amt       NUMBER(18,2),
  IPB0001_23_T_Cancel_Pay_Amt       NUMBER(18,2),
  IPB0001_24_MATCH    VARCHAR2(3),
  IPB0001_24_S_Past_Due_Coverage_Period       VARCHAR2(4000),
  IPB0001_24_T_Past_Coverage_Period       VARCHAR2(4000),
  IPB0001_24_S_Past_Due_Date       VARCHAR2(4000),
  IPB0001_24_T_Past_Due_Dt       VARCHAR2(4000),
  IPB0001_24_S_Past_Due_Amount       VARCHAR2(4000),
  IPB0001_24_T_Past_Due_Amt       VARCHAR2(4000),
  IPB0001_24_S_Past_Due       NUMBER(18,2),
  IPB0001_24_T_Past_Due_Total_Amount       NUMBER(18,2),
  IPB0001_28_MATCH    VARCHAR2(3),
  IPB0001_28_S_Past_Due_Coverage_Period       VARCHAR2(4000),
  IPB0001_28_T_Past_Coverage_Period       VARCHAR2(4000),
  IPB0001_25_MATCH    VARCHAR2(3),
  IPB0001_25_S_Coverage_Through_Month       VARCHAR2(20),
  IPB0001_25_T_Coverage_End_Date       VARCHAR2(10),
  IPB0001_26_MATCH    VARCHAR2(3),
  IPB0001_26_S_Retro_Due_Without_LIS_Amt       NUMBER(18,2),
  IPB0001_26_T_RETRO_DUE_WITHOUT_LIS_AMT       NUMBER(18,2),
  IPB0001_26_S_Retro_Due_LEP_Amt       NUMBER(18,2),
  IPB0001_26_T_WS_RDUE_LEP_AMT       NUMBER(18,2),
  IPB0001_17_MATCH    VARCHAR2(3),
  IPB0001_17_S_Subtotal_Due        NUMBER(18,2),
  IPB0001_17_T_Total_Amount_Due        NUMBER(18,2),
  IPB0001_27_MATCH    VARCHAR2(3),
  IPB0001_27_S_Prior_Month_Balance       NUMBER(18,2),
  IPB0001_27_T_Prior_Month_Balance       NUMBER(18,2),
  IPB0001_27_S_Payment_Received       NUMBER(18,2),
  IPB0001_27_T_Payment_Received       NUMBER(18,2),
  IPB0001_27_S_Total_Adjustment_Amt       NUMBER(18,2),
  IPB0001_27_T_Total_Adjustment_Amt       NUMBER(18,2),
  IPB0001_6_MATCH    VARCHAR2(3),
  IPB0001_6_S_Billing_Unit_Id       VARCHAR2(100),
  IPB0001_6_T_ORMB_ACCT_ID       VARCHAR2(50),
  IPB0001_12_MATCH    VARCHAR2(3),
  IPB0001_12_S_Autopay_Indicator       VARCHAR2(10),
  IPB0001_12_T_AUTOPAY_IND       VARCHAR2(10),
  IPB0001_16_MATCH    VARCHAR2(3),
  IPB0001_16_S_Payment_Due_Date       VARCHAR2(10),
  IPB0001_16_T_DUE_DATE       VARCHAR2(10),
  IPB0001_16_S_Prior_Month_Balance       NUMBER(18,2),
  IPB0001_16_T_PREVIOUS_BALANCE       NUMBER(18,2),
  IPB0001_16_S_Payment_Received       NUMBER(18,2),
  IPB0001_16_T_PAY_AMT       NUMBER(18,2),
  IPB0001_16_S_Total_Adjustment_Amt       NUMBER(18,2),
  IPB0001_16_T_ADJUSTMENT_AMT       NUMBER(18,2),
  IPB0001_16_S_RetroActive_Due       NUMBER(18,2),
  IPB0001_16_T_RETRO_DUES       NUMBER(18,2),
  IPB0001_3_MATCH    VARCHAR2(3),
  IPB0001_3_S_Coverage_Through_Month       VARCHAR2(20),
  IPB0001_3_T_Coverage_End_Date_For_Month       VARCHAR2(10),
  IPB0001_3_S_Coverage_Through_Year       VARCHAR2(20),
  IPB0001_3_T_Coverage_End_Date_For_Year       VARCHAR2(10),
  IPB0001_4_MATCH    VARCHAR2(3),
  IPB0001_4_S_Invoice_Generated_Date       VARCHAR2(10),
  IPB0001_4_T_ACTIVITY_PERIOD       VARCHAR2(10),
  IPB0001_29_MATCH                          VARCHAR2(3),
  IPB0001_29_S_Retroactive_Federal_Combined VARCHAR2(4000),
  IPB0001_29_T_Federal_Retro_Detail         VARCHAR2(4000),
  IPB0001_29_S_Retroactive_State_Subsidy_Combined VARCHAR2(4000),
  IPB0001_29_T_State_Retro_Detail           VARCHAR2(4000),
  IPB0001_29_S_Retroactive_Fedreal_Amt      NUMBER(18,2),
  IPB0001_29_T_APTC                         NUMBER(18,2),
  IPB0001_29_S_Retroactive_State_Subsdiy_Amt NUMBER(18,2),
  IPB0001_29_T_Retro_State_Subsidy          NUMBER(18,2),
  IPB0001_29_S_Retroactive_Total_Amount     NUMBER(18,2),
  IPB0001_29_T_CM_TOT_RETRO_CHRG_AMT       NUMBER(18,2),

  CREATED_TS          TIMESTAMP      DEFAULT SYSTIMESTAMP
);


SELECT * FROM COMPARE_OWNER.KPIF_CMP_RESULTS;

--------------------------------------------------------------------------------
-- Final comparison result table (ROC / MOC)
--------------------------------------------------------------------------------

BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE COMPARE_OWNER.MOC_CMP_RESULTS PURGE';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -942 THEN
      RAISE;
    END IF;
END;
/
CREATE TABLE COMPARE_OWNER.MOC_CMP_RESULTS (
  RUN_ID                                    NUMBER(13,0)   NOT NULL,
  BATCH_NBR                                 NUMBER         NOT NULL,
  KPMC_TRANSACTION_ID                       VARCHAR2(100)  NOT NULL,
  REGION                                    VARCHAR2(10),
  RGN_CD                                    VARCHAR2(10),
  LOB                                       VARCHAR2(8),
  SUBSCRIBER_MRN                            VARCHAR2(100),
  JURISDICTION                              VARCHAR2(2),

  IPB0001_19_MATCH                          VARCHAR2(3),
  IPB0001_19_S_TOTAL_BALANCE_DUE            NUMBER(18,2),
  IPB0001_19_T_TOTAL_CURRENT_CHARGES        NUMBER(18,2),

  IPB0001_29_MATCH                          VARCHAR2(3),
  IPB0001_29_S_PRIOR_MONTH_BALANCE          NUMBER(18,2),
  IPB0001_29_T_PREVIOUS_BALANCE             NUMBER(18,2),
  IPB0001_29_S_PAYMENT_RECEIVED             NUMBER(18,2),
  IPB0001_29_T_PAY_AMT                      NUMBER(18,2),
  IPB0001_29_S_OTHER_ADJUSTMENT             NUMBER(18,2),
  IPB0001_29_T_ADJUSTMENT_AMT               NUMBER(18,2),

  IPB0001_8_MATCH                           VARCHAR2(3),
  IPB0001_8_S_BILLING_UNIT_ID               VARCHAR2(100),
  IPB0001_8_T_ORMB_ACCT_ID                  VARCHAR2(50),

  IPB0001_24_MATCH                          VARCHAR2(3),
  IPB0001_24_S_PRIOR_MONTH_BALANCE          NUMBER(18,2),
  IPB0001_24_T_PREVIOUS_BALANCE             NUMBER(18,2),

  IPB0001_25_MATCH                          VARCHAR2(3),
  IPB0001_25_S_PAY_FROM_DATE                VARCHAR2(40),
  IPB0001_25_T_PAID_FROM_DT                 VARCHAR2(40),
  IPB0001_25_S_PAY_THROUGH_DATE             VARCHAR2(40),
  IPB0001_25_T_PAID_THROUGH_DT              VARCHAR2(40),
  IPB0001_25_S_ROC_30_PAY_AMNTS             VARCHAR2(4000),
  IPB0001_25_T_PAY_DETAIL_AMOUNT            VARCHAR2(4000),
  IPB0001_25_S_PAYMENT_RECEIVED             NUMBER(18,2),
  IPB0001_25_T_PAY_AMT                      NUMBER(18,2),
  IPB0001_25_S_REJECTED_PAYMENT             NUMBER(18,2),
  IPB0001_25_T_CANCEL_PAY_AMT               NUMBER(18,2),

  IPB0001_30_MATCH                          VARCHAR2(3),
  IPB0001_30_S_PAYMENT_RECEIVED             NUMBER(18,2),
  IPB0001_30_T_PAY_AMT                      NUMBER(18,2),
  IPB0001_30_S_ROC_30_PAY_DATES             VARCHAR2(4000),
  IPB0001_30_T_PAY_DETAIL_DATE              VARCHAR2(4000),
  IPB0001_30_S_ROC_30_PAY_AMTS              VARCHAR2(4000),
  IPB0001_30_T_PAY_DETAIL_AMOUNT            VARCHAR2(4000),

  IPB0001_42_MATCH                          VARCHAR2(3),
  IPB0001_42_S_FEDERAL_SUBSIDY              NUMBER(18,2),
  IPB0001_42_T_APTC                         NUMBER(18,2),
  IPB0001_42_S_REGION                       VARCHAR2(100),
  IPB0001_42_T_REGION                       VARCHAR2(100),
  IPB0001_42_S_STATE_SUBSIDY                NUMBER(18,2),
  IPB0001_42_T_STATE_SUBSIDY                NUMBER(18,2),

  IPB0001_28_MATCH                          VARCHAR2(3),
  IPB0001_28_S_RETROACTIVE_FEDREAL_AMT      NUMBER(18,2),
  IPB0001_28_T_APTC                         NUMBER(18,2),
  IPB0001_28_S_RETROACTIVE_STATE_SUBSIDY_AMT NUMBER(18,2),
  IPB0001_28_T_RETRO_STATE_SUBSIDY          NUMBER(18,2),
  IPB0001_28_S_TOTAL_RETROACTIVE_AMOUNT     NUMBER(18,2),
  IPB0001_28_T_RETRO_DUES                   NUMBER(18,2),
  IPB0001_28_S_OTHER_ADJUSTMENT             NUMBER(18,2),
  IPB0001_28_T_ADJUSTMENT_AMT               NUMBER(18,2),
  IPB0001_28_S_RETROACTIVE_FEDERAL_COMBINED VARCHAR2(4000),
  IPB0001_28_T_FEDERAL_RETRO_DETAIL         VARCHAR2(4000),
  IPB0001_28_S_RETROACTIVE_STATE_SUBSIDY_COMBINED VARCHAR2(4000),
  IPB0001_28_T_STATE_RETRO_DETAIL           VARCHAR2(4000),

  IPB0001_31_MATCH                          VARCHAR2(3),
  IPB0001_31_S_RETROACTIVE_FEDERAL_AMT      NUMBER(18,2),
  IPB0001_31_T_APTC                         NUMBER(18,2),
  IPB0001_31_S_RETROACTIVE_STATE_SUBSIDY_AMT NUMBER(18,2),
  IPB0001_31_T_RETRO_STATE_SUBSIDY          NUMBER(18,2),
  IPB0001_31_S_TOTAL_RETROACTIVE_AMOUNT     NUMBER(18,2),
  IPB0001_31_T_RETRO_DUES                   NUMBER(18,2),
  IPB0001_31_S_RETROACTIVE_FEDERAL_COMBINED VARCHAR2(4000),
  IPB0001_31_T_FEDERAL_RETRO_DETAIL         VARCHAR2(4000),
  IPB0001_31_S_RETROACTIVE_STATE_SUBSIDY_COMBINED VARCHAR2(4000),
  IPB0001_31_T_STATE_RETRO_DETAIL           VARCHAR2(4000),

  IPB0001_43_MATCH                          VARCHAR2(3),
  IPB0001_43_S_SUBTOTAL                     NUMBER(18,2),
  IPB0001_43_T_TOTAL_AMOUNT_DUE             NUMBER(18,2),

  IPB0001_14_MATCH                          VARCHAR2(3),
  IPB0001_14_S_ACI_PAY_MODE                 VARCHAR2(50),
  IPB0001_14_T_AUTOPAY_IND                  VARCHAR2(10),

  IPB0001_18_MATCH                          VARCHAR2(3),
  IPB0001_18_S_PRIOR_MONTH_BALANCE          NUMBER(18,2),
  IPB0001_18_T_PREVIOUS_BALANCE             NUMBER(18,2),
  IPB0001_18_S_PAYMENT_RECEIVED             NUMBER(18,2),
  IPB0001_18_T_PAY_AMT                      NUMBER(18,2),
  IPB0001_18_S_OTHER_ADJUSTMENT             NUMBER(18,2),
  IPB0001_18_T_ADJUSTMENT_AMT               NUMBER(18,2),

  IPB0001_4_MATCH                           VARCHAR2(3),
  IPB0001_4_S_STATEMENT_MONTH               VARCHAR2(20),
  IPB0001_4_T_COVERAGE_END_DATE_FOR_MONTH   VARCHAR2(10),
  IPB0001_4_S_STATEMENT_YEAR                VARCHAR2(20),
  IPB0001_4_T_COVERAGE_END_DATE_FOR_YEAR    VARCHAR2(10),

  IPB0001_5_MATCH                           VARCHAR2(3),
  IPB0001_5_S_INVOICE_GENERATED_DATE        VARCHAR2(40),
  IPB0001_5_T_ACTIVITY_PERIOD               VARCHAR2(10),

  CREATED_TS                                TIMESTAMP      DEFAULT SYSTIMESTAMP
);


SELECT * FROM COMPARE_OWNER.MOC_CMP_RESULTS;

--------------------------------------------------------------------------------
-- Useful indexes
--------------------------------------------------------------------------------
BEGIN
  EXECUTE IMMEDIATE 'DROP INDEX COMPARE_OWNER.IX_KPIF_CMP_SRC_CA_01';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -1418 THEN
      RAISE;
    END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE 'DROP INDEX COMPARE_OWNER.IX_KPIF_CMP_SRC_ROC_01';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -1418 THEN
      RAISE;
    END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE 'DROP INDEX COMPARE_OWNER.IX_KPIF_CMP_TRGT_01';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -1418 THEN
      RAISE;
    END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE 'DROP INDEX COMPARE_OWNER.IX_KPIF_CMP_RES_01';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -1418 THEN
      RAISE;
    END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE 'DROP INDEX COMPARE_OWNER.IX_KPIF_CMP_RES_02';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -1418 THEN
      RAISE;
    END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE 'DROP INDEX COMPARE_OWNER.IX_KPIF_CMP_RUN_STATUS_01';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -1418 THEN
      RAISE;
    END IF;
END;
/

CREATE INDEX IX_KPIF_CMP_SRC_CA_01 ON COMPARE_OWNER.KPIF_CMP_SOURCE_CA_XML (BATCH_NBR, BILL_ID);
CREATE INDEX IX_KPIF_CMP_SRC_ROC_01 ON COMPARE_OWNER.KPIF_CMP_SOURCE_ROC_XML (BATCH_NBR);
CREATE INDEX IX_KPIF_CMP_TRGT_01 ON COMPARE_OWNER.KPIF_CMP_TARGET_ORMB (BATCH_NBR, BILL_ID);
CREATE INDEX IX_KPIF_CMP_RES_01 ON COMPARE_OWNER.KPIF_CMP_RESULTS (BATCH_NBR);
CREATE INDEX IX_KPIF_CMP_RES_02 ON COMPARE_OWNER.KPIF_CMP_RESULTS (RUN_ID);
CREATE INDEX IX_KPIF_CMP_RUN_STATUS_01 ON COMPARE_OWNER.KPIF_CMP_RUN_STATUS (BATCH_NBR, LAST_UPDATE_TS);

BEGIN
  EXECUTE IMMEDIATE 'DROP INDEX COMPARE_OWNER.IX_MOC_CMP_RES_01';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -1418 THEN
      RAISE;
    END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE 'DROP INDEX COMPARE_OWNER.IX_MOC_CMP_RES_02';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -1418 THEN
      RAISE;
    END IF;
END;
/

CREATE INDEX IX_MOC_CMP_RES_01 ON COMPARE_OWNER.MOC_CMP_RESULTS (BATCH_NBR);
CREATE INDEX IX_MOC_CMP_RES_02 ON COMPARE_OWNER.MOC_CMP_RESULTS (RUN_ID);