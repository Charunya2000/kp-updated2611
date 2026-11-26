SELECT
  RUN_ID,
  ROW_NUMBER() OVER (ORDER BY RUN_ID) AS ID,
  BATCH_NBR,
  'SYSTEM' AS AUDITOR,
  TO_CHAR(CREATED_TS, 'Mon-YYYY') AS AUDIT_PERIOD,
  CREATED_TS as AUDIT_DATE,
  :PROCESS_DATE AS PROCESS_DATE,
  CAST(NULL AS VARCHAR2(255)) AS FILE_NAME,
  CASE TRIM(LOB) WHEN 'INDON' THEN 'KPIF ON' WHEN 'INDOFF' THEN 'KPIF OFF' ELSE TRIM(LOB) END AS LOB,
  IPB0001_6_S_BILLING_UNIT_ID AS BILLING_UNIT_ID,
  CASE WHEN SUBSCRIBER_MRN IS NOT NULL THEN RGN_CD || '-' || SUBSTR(SUBSCRIBER_MRN, 4) END AS MRN,
  'IPB0001' AS LETTER_ID,
  'IPB0001 Invoice (Non-Consolidated)' AS LETTER_NAME,
  REGION,
  JURISDICTION,
  CAST(NULL AS VARCHAR2(50)) AS "DOCUMENT_ID",
  KPMC_TRANSACTION_ID,
  CASE
    WHEN IPB0001_3_MATCH = 'Yes'
      AND IPB0001_4_MATCH = 'Yes'
      AND IPB0001_6_MATCH = 'Yes'
      AND IPB0001_12_MATCH = 'Yes'
      AND IPB0001_16_MATCH = 'Yes'
      AND IPB0001_17_MATCH = 'Yes'
      AND IPB0001_22_MATCH = 'Yes'
      AND IPB0001_23_MATCH = 'Yes'
      AND IPB0001_24_MATCH = 'Yes'
      AND IPB0001_25_MATCH = 'Yes'
      AND IPB0001_26_MATCH = 'Yes'
      AND IPB0001_27_MATCH = 'Yes'
      AND IPB0001_28_MATCH = 'Yes'
      AND IPB0001_29_MATCH = 'Yes'
    THEN 'Pass'
    ELSE 'Flag'
  END AS PASS_OR_FLAG,
  RTRIM(
    CASE WHEN IPB0001_3_MATCH = 'No' THEN
      'IPB0001-3: Mismatch in: Coverage End Date (Month/Year)'
      || CHR(10)
    END
    || CASE WHEN IPB0001_4_MATCH = 'No' THEN
      'IPB0001-4: Mismatch in: Activity Period'
      || CHR(10)
    END
    || CASE WHEN IPB0001_6_MATCH = 'No' THEN
      'IPB0001-6: Mismatch in: Billing Unit ID'
      || CHR(10)
    END
    || CASE WHEN IPB0001_12_MATCH = 'No' THEN
      'IPB0001-12: Mismatch in: Autopay Indicator'
      || CHR(10)
    END
    || CASE WHEN IPB0001_16_MATCH = 'No' THEN
      'IPB0001-16: Mismatch in one of these fields: Payment Due Date, Previous Balance, Pay Amount, Total Adjustment Amount, Retroactive Due'
      || CHR(10)
    END
    || CASE WHEN IPB0001_17_MATCH = 'No' THEN
      'IPB0001-17: Mismatch in one of these fields: Subtotal, Total Amount Due'
      || CHR(10)
    END
    || CASE WHEN IPB0001_22_MATCH = 'No' THEN
      'IPB0001-22: Mismatch in: Previous Balance'
      || CHR(10)
    END
    || CASE WHEN IPB0001_23_MATCH = 'No' THEN
      'IPB0001-23: Mismatch in one of these fields: Activity Start Date, Activity End Date, Pay Amount, Cancel Pay Amount'
      || CHR(10)
    END
    || CASE WHEN IPB0001_24_MATCH = 'No' THEN
      'IPB0001-24: Mismatch in one of these fields: Past Coverage Period, Past Due Amount, Past Due Total Amount'
      || CHR(10)
    END
    || CASE WHEN IPB0001_25_MATCH = 'No' THEN
      'IPB0001-25: Mismatch in: Coverage End Date'
      || CHR(10)
    END
    || CASE WHEN IPB0001_26_MATCH = 'No' THEN
      'IPB0001-26: Mismatch in one of these fields: Retro Due Without LIS Amount, Retro Due LEP Amount'
      || CHR(10)
    END
    || CASE WHEN IPB0001_27_MATCH = 'No' THEN
      'IPB0001-27: Mismatch in one of these fields: Prior Month Balance, Payment Received, Total Adjustment Amount'
      || CHR(10)
    END
    || CASE WHEN IPB0001_28_MATCH = 'No' THEN
      'IPB0001-28: Mismatch in: Past Due Coverage Period'
      || CHR(10)
    END
    || CASE WHEN IPB0001_29_MATCH = 'No' THEN
      'IPB0001-29: Mismatch in: one of these fields: Retroactive Federal or State Coverage Periods or Amount, Retroactive Total Amount'
      || CHR(10)
    END
  , CHR(10)) AS AUDITOR_NOTES,
  IPB0001_3_MATCH AS IPB0001_3,
  IPB0001_4_MATCH AS IPB0001_4,
  IPB0001_6_MATCH AS IPB0001_6,
  IPB0001_12_MATCH AS IPB0001_12,
  IPB0001_16_MATCH AS IPB0001_16,
  IPB0001_17_MATCH AS IPB0001_17,
  IPB0001_22_MATCH AS IPB0001_22,
  IPB0001_23_MATCH AS IPB0001_23,
  IPB0001_24_MATCH AS IPB0001_24,
  IPB0001_25_MATCH AS IPB0001_25,
  IPB0001_26_MATCH AS IPB0001_26,
  IPB0001_27_MATCH AS IPB0001_27,
  IPB0001_28_MATCH AS IPB0001_28,
  IPB0001_29_MATCH AS IPB0001_29,
  RTRIM(
    CASE WHEN IPB0001_3_MATCH = 'No' THEN
      'IPB0001_3_S_Coverage_Through_Month: ' || TO_CHAR(IPB0001_3_S_Coverage_Through_Month) || ' | IPB0001_3_T_Coverage_End_Date_For_Month: ' || TO_CHAR(IPB0001_3_T_Coverage_End_Date_For_Month)
      || ', IPB0001_3_S_Coverage_Through_Year: ' || TO_CHAR(IPB0001_3_S_Coverage_Through_Year) || ' | IPB0001_3_T_Coverage_End_Date_For_Year: ' || TO_CHAR(IPB0001_3_T_Coverage_End_Date_For_Year)
      || CHR(10)
    END
    || CASE WHEN IPB0001_4_MATCH = 'No' THEN
      'IPB0001_4_S_Invoice_Generated_Date: ' || TO_CHAR(IPB0001_4_S_Invoice_Generated_Date) || ' | IPB0001_4_T_ACTIVITY_PERIOD: ' || TO_CHAR(IPB0001_4_T_ACTIVITY_PERIOD)
      || CHR(10)
    END
    || CASE WHEN IPB0001_6_MATCH = 'No' THEN
      'IPB0001_6_S_Billing_Unit_Id: ' || TO_CHAR(IPB0001_6_S_Billing_Unit_Id) || ' | IPB0001_6_T_ORMB_ACCT_ID: ' || TO_CHAR(IPB0001_6_T_ORMB_ACCT_ID)
      || CHR(10)
    END
    || CASE WHEN IPB0001_12_MATCH = 'No' THEN
      'IPB0001_12_S_Autopay_Indicator: ' || TO_CHAR(IPB0001_12_S_Autopay_Indicator) || ' | IPB0001_12_T_AUTOPAY_IND: ' || TO_CHAR(IPB0001_12_T_AUTOPAY_IND)
      || CHR(10)
    END
    || CASE WHEN IPB0001_16_MATCH = 'No' THEN
      'IPB0001_16_S_Payment_Due_Date: ' || TO_CHAR(IPB0001_16_S_Payment_Due_Date) || ' | IPB0001_16_T_DUE_DATE: ' || TO_CHAR(IPB0001_16_T_DUE_DATE)
      || ', IPB0001_16_S_Prior_Month_Balance: ' || TO_CHAR(IPB0001_16_S_Prior_Month_Balance) || ' | IPB0001_16_T_PREVIOUS_BALANCE: ' || TO_CHAR(IPB0001_16_T_PREVIOUS_BALANCE)
      || ', IPB0001_16_S_Payment_Received: ' || TO_CHAR(IPB0001_16_S_Payment_Received) || ' | IPB0001_16_T_PAY_AMT: ' || TO_CHAR(IPB0001_16_T_PAY_AMT)
      || ', IPB0001_16_S_Total_Adjustment_Amt: ' || TO_CHAR(IPB0001_16_S_Total_Adjustment_Amt) || ' | IPB0001_16_T_ADJUSTMENT_AMT: ' || TO_CHAR(IPB0001_16_T_ADJUSTMENT_AMT)
      || ', IPB0001_16_S_RetroActive_Due: ' || TO_CHAR(IPB0001_16_S_RetroActive_Due) || ' | IPB0001_16_T_RETRO_DUES: ' || TO_CHAR(IPB0001_16_T_RETRO_DUES)
      || CHR(10)
    END
    || CASE WHEN IPB0001_17_MATCH = 'No' THEN
      'IPB0001_17_S_Subtotal_Due: ' || TO_CHAR(IPB0001_17_S_Subtotal_Due) || ' | IPB0001_17_T_Total_Amount_Due: ' || TO_CHAR(IPB0001_17_T_Total_Amount_Due)
      || CHR(10)
    END
    || CASE WHEN IPB0001_22_MATCH = 'No' THEN
      'IPB0001_22_S_Prior_Month_Balance: ' || TO_CHAR(IPB0001_22_S_Prior_Month_Balance) || ' | IPB0001_22_T_Previous_Balance: ' || TO_CHAR(IPB0001_22_T_Previous_Balance)
      || CHR(10)
    END
    || CASE WHEN IPB0001_23_MATCH = 'No' THEN
      'IPB0001_23_S_Activity_Start_Date: ' || TO_CHAR(IPB0001_23_S_Activity_Start_Date) || ' | IPB0001_23_T_Activity_Start_Date: ' || TO_CHAR(IPB0001_23_T_Activity_Start_Date)
      || ', IPB0001_23_S_Activity_End_Date: ' || TO_CHAR(IPB0001_23_S_Activity_End_Date) || ' | IPB0001_23_T_Activity_End_Date: ' || TO_CHAR(IPB0001_23_T_Activity_End_Date)
      || ', IPB0001_23_S_Payment_Received: ' || TO_CHAR(IPB0001_23_S_Payment_Received) || ' | IPB0001_23_T_Pay_Amt: ' || TO_CHAR(IPB0001_23_T_Pay_Amt)
      || ', IPB0001_23_S_Remittance_Rversal_Amt: ' || TO_CHAR(IPB0001_23_S_Remittance_Rversal_Amt) || ' | IPB0001_23_T_Cancel_Pay_Amt: ' || TO_CHAR(IPB0001_23_T_Cancel_Pay_Amt)
      || CHR(10)
    END
    || CASE WHEN IPB0001_24_MATCH = 'No' THEN
      'IPB0001_24_S_Past_Due_Coverage_Period: ' || TO_CHAR(IPB0001_24_S_Past_Due_Coverage_Period) || ' | IPB0001_24_T_Past_Coverage_Period: ' || TO_CHAR(IPB0001_24_T_Past_Coverage_Period)
      || ', IPB0001_24_S_Past_Due_Date: ' || TO_CHAR(IPB0001_24_S_Past_Due_Date) || ' | IPB0001_24_T_Past_Due_Dt: ' || TO_CHAR(IPB0001_24_T_Past_Due_Dt)
      || ', IPB0001_24_S_Past_Due_Amount: ' || TO_CHAR(IPB0001_24_S_Past_Due_Amount) || ' | IPB0001_24_T_Past_Due_Amt: ' || TO_CHAR(IPB0001_24_T_Past_Due_Amt)
      || ', IPB0001_24_S_Past_Due: ' || TO_CHAR(IPB0001_24_S_Past_Due) || ' | IPB0001_24_T_Past_Due_Total_Amount: ' || TO_CHAR(IPB0001_24_T_Past_Due_Total_Amount)
      || CHR(10)
    END
    || CASE WHEN IPB0001_25_MATCH = 'No' THEN
      'IPB0001_25_S_Coverage_Through_Month: ' || TO_CHAR(IPB0001_25_S_Coverage_Through_Month) || ' | IPB0001_25_T_Coverage_End_Date: ' || TO_CHAR(IPB0001_25_T_Coverage_End_Date)
      || CHR(10)
    END
    || CASE WHEN IPB0001_26_MATCH = 'No' THEN
      'IPB0001_26_S_Retro_Due_Without_LIS_Amt: ' || TO_CHAR(IPB0001_26_S_Retro_Due_Without_LIS_Amt) || ' | IPB0001_26_T_RETRO_DUE_WITHOUT_LIS_AMT: ' || TO_CHAR(IPB0001_26_T_RETRO_DUE_WITHOUT_LIS_AMT)
      || ', IPB0001_26_S_Retro_Due_LEP_Amt: ' || TO_CHAR(IPB0001_26_S_Retro_Due_LEP_Amt) || ' | IPB0001_26_T_WS_RDUE_LEP_AMT: ' || TO_CHAR(IPB0001_26_T_WS_RDUE_LEP_AMT)
      || CHR(10)
    END
    || CASE WHEN IPB0001_27_MATCH = 'No' THEN
      'IPB0001_27_S_Prior_Month_Balance: ' || TO_CHAR(IPB0001_27_S_Prior_Month_Balance) || ' | IPB0001_27_T_Prior_Month_Balance: ' || TO_CHAR(IPB0001_27_T_Prior_Month_Balance)
      || ', IPB0001_27_S_Payment_Received: ' || TO_CHAR(IPB0001_27_S_Payment_Received) || ' | IPB0001_27_T_Payment_Received: ' || TO_CHAR(IPB0001_27_T_Payment_Received)
      || ', IPB0001_27_S_Total_Adjustment_Amt: ' || TO_CHAR(IPB0001_27_S_Total_Adjustment_Amt) || ' | IPB0001_27_T_Total_Adjustment_Amt: ' || TO_CHAR(IPB0001_27_T_Total_Adjustment_Amt)
      || CHR(10)
    END
    || CASE WHEN IPB0001_28_MATCH = 'No' THEN
      'IPB0001_28_S_Past_Due_Coverage_Period: ' || TO_CHAR(IPB0001_28_S_Past_Due_Coverage_Period) || ' | IPB0001_28_T_Past_Coverage_Period: ' || TO_CHAR(IPB0001_28_T_Past_Coverage_Period)
      || CHR(10)
    END
    || CASE WHEN IPB0001_29_MATCH = 'No' THEN
      'IPB0001_29_S_Retroactive_Federal_Combined: ' || TO_CHAR(IPB0001_29_S_Retroactive_Federal_Combined) || ' | IPB0001_29_T_Federal_Retro_Detail: ' || TO_CHAR(IPB0001_29_T_Federal_Retro_Detail)
      || ', IPB0001_29_S_Retroactive_State_Subsidy_Combined: ' || TO_CHAR(IPB0001_29_S_Retroactive_State_Subsidy_Combined) || ' | IPB0001_29_T_State_Retro_Detail: ' || TO_CHAR(IPB0001_29_T_State_Retro_Detail)
      || ', IPB0001_29_S_Retroactive_Fedreal_Amt: ' || TO_CHAR(IPB0001_29_S_Retroactive_Fedreal_Amt) || ' | IPB0001_29_T_APTC: ' || TO_CHAR(IPB0001_29_T_APTC)
      || ', IPB0001_29_S_Retroactive_State_Subsdiy_Amt: ' || TO_CHAR(IPB0001_29_S_Retroactive_State_Subsdiy_Amt) || ' | IPB0001_29_T_Retro_State_Subsidy: ' || TO_CHAR(IPB0001_29_T_Retro_State_Subsidy)
      || ', IPB0001_29_S_Retroactive_Total_Amount: ' || TO_CHAR(IPB0001_29_S_Retroactive_Total_Amount) || ' | IPB0001_29_T_CM_TOT_RETRO_CHRG_AMT: ' || TO_CHAR(IPB0001_29_T_CM_TOT_RETRO_CHRG_AMT)
      || CHR(10)
    END
  , CHR(10)) AS COMPARE_VALUES
FROM COMPARE_OWNER.KPIF_CMP_RESULTS
WHERE BATCH_NBR = :BATCH_NUMBER
AND RUN_ID = :RUN_ID