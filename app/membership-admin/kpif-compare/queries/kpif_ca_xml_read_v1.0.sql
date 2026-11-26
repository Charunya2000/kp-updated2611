SELECT
  B.BATCH_NBR,
  B.BILL_ID,
  EPL.KPMC_TRANSACTION_ID,
  B.FAMILY_ACCT_NO as RGN_CD,
  B.BATCH_CD,
  EPL.TYPE,
  xml_file1.Region,
  xml_file1.Billing_Unit_Id,
  xml_file1.Invoice_Generated_Date,
  xml_file1.Payment_Due_Date,
  xml_file1.RetroActive_Due,
  xml_file1.Coverage_Through_Month,
  xml_file1.Covergae_Through_Year,
  xml_file1.Current_Premium_Due,
  xml_file1.Autopay_Indicator,
  xml_file1.Billing_Unit_Type,
  xml_file1.Jurisdiction,
  xml_file2.Activity_Start_Date,
  xml_file2.Activity_End_Date,
  xml_file2.Prior_month_balance,
  xml_file2.Payment_Received,
  xml_file2.Total_Adjustment_Amt,
  xml_file2.SubTotal_Due,
  xml_file2.Past_Due,
  xml_file2.Remittance_Rversal_Amt,
  xml_file2.APTC,
  xml_file2.State_Subsidy,
  xml_file2.State_Premium_Credit,
  xml_file2.Retro_Due_Without_LIS_Amt,
  xml_file2.Retro_Due_LEP_Amt,
  CASE WHEN LENGTH(xml_file2.Past_Due_Coverage_Periods) > 1000 THEN '##OVERFLOW_S##' ELSE xml_file2.Past_Due_Coverage_Periods END,
  CASE WHEN LENGTH(xml_file2.Past_Due_Dates) > 1000 THEN '##OVERFLOW_S##' ELSE xml_file2.Past_Due_Dates END,
  CASE WHEN LENGTH(xml_file2.Past_Due_Amounts) > 1000 THEN '##OVERFLOW_S##' ELSE xml_file2.Past_Due_Amounts END,
  xml_file4.Retroactive_Federal_Combined,
  (SELECT SUM(CASE WHEN REGEXP_LIKE(TRIM(REGEXP_SUBSTR(xml_file4.Retroactive_Fedreal_Amt_CSV, '[^,]+', 1, LEVEL)), '^-?[0-9]+(\.[0-9]+)?$') THEN TO_NUMBER(TRIM(REGEXP_SUBSTR(xml_file4.Retroactive_Fedreal_Amt_CSV, '[^,]+', 1, LEVEL))) END) FROM DUAL CONNECT BY REGEXP_SUBSTR(xml_file4.Retroactive_Fedreal_Amt_CSV, '[^,]+', 1, LEVEL) IS NOT NULL) Retroactive_Fedreal_Amt,
  xml_file4.Retroactive_State_Subsidy_Combined,
  (SELECT SUM(CASE WHEN REGEXP_LIKE(TRIM(REGEXP_SUBSTR(xml_file4.Retroactive_State_Subsdiy_Amt_CSV, '[^,]+', 1, LEVEL)), '^-?[0-9]+(\.[0-9]+)?$') THEN TO_NUMBER(TRIM(REGEXP_SUBSTR(xml_file4.Retroactive_State_Subsdiy_Amt_CSV, '[^,]+', 1, LEVEL))) END) FROM DUAL CONNECT BY REGEXP_SUBSTR(xml_file4.Retroactive_State_Subsdiy_Amt_CSV, '[^,]+', 1, LEVEL) IS NOT NULL) Retroactive_State_Subsdiy_Amt,
  xml_file2.Retroactive_Total_Amount
  FROM
  KPMC_DOCMGMT_ADM.KPMC_EXTRACT_PAYLOAD EPL
  INNER JOIN KPMC_DOCMGMT_ADM.INDV_INVOICE_NON_CONS_CTL B
    ON EPL.KPMC_TRANSACTION_ID = B.KPMC_INDIVIDUAL_INVOICE_TRANSACTION_ID,
  XMLTABLE(
    '/recipient' PASSING XMLPARSE(DOCUMENT EPL.PAYLOAD_XML)
    COLUMNS
      Transaction_ID           PATH 'KPMC_Individual_Invoice_Transaction_ID',
      Region                   PATH 'WS-REGION',
      Billing_Unit_Id          PATH 'WS-Parent-Billing-Unit',
      Invoice_Generated_Date   PATH 'Stmnt_Dt',
      Payment_Due_Date         PATH 'WS-Payment-due-date',
      RetroActive_Due          PATH 'WS-Retroactive-Dues',
      Coverage_Through_Month   PATH 'WS-Coverage-through-month',
      Covergae_Through_Year    PATH 'WS-Coverage-through-year',
      Current_Premium_Due      PATH 'WS-Current-Dues',
      Autopay_Indicator        PATH 'WS-AUTOPAY-IND',
      Invoice_Details          XMLTYPE PATH 'Invoice_Details',
      Billing_Unit_Type        PATH 'WS-BU-TYPE',
      Jurisdiction             PATH 'WS-Member-State'
  ) xml_file1,
  XMLTable(
    '/Invoice_Details/Covered_Family_Member_Details' PASSING xml_file1.Invoice_Details
    COLUMNS
      Activity_Start_Date        PATH 'WS-Activity-Start-date',
      Activity_End_Date          PATH 'WS-Activity-End-date',
      Prior_month_balance        PATH 'WS-Beginning-Balance',
      Payment_Received           PATH 'WS-Payments',
      Total_Adjustment_Amt       PATH 'WS-Adjustment-amount',
      SubTotal_Due               PATH 'WS-Sub-total',
      Past_Due                   PATH 'Past-Due-Total-Amount',
      Remittance_Rversal_Amt     PATH 'WS-Remittance-reversal-amt',
      Coverage_Through_month     PATH 'WS-Coverage-through-month',
      APTC                       PATH 'APTC',
      State_Subsidy              PATH 'STE_SUBSIDY',
      State_Premium_Credit       PATH 'STE-PRE-CREDIT',
      Retro_Due_Without_LIS_Amt  PATH 'WS-RDUE-WITHOUT-LIS-AMT',
      Retro_Due_LEP_Amt          PATH 'WS-RDUE-LEP-AMT',
      -- Concatenate ALL Past_Due_Details entries sorted by due date then amount
      Past_Due_Coverage_Periods  VARCHAR2(4000) PATH 'fn:string-join(for $i in Past_Due_Details order by concat(substring($i/Past-Due-Coverage-Period, 7, 4), substring($i/Past-Due-Coverage-Period, 1, 2), substring($i/Past-Due-Coverage-Period, 4, 2)), number($i/Past-Due-Amount) return string($i/Past-Due-Coverage-Period), ", ")',
      Past_Due_Dates             VARCHAR2(4000) PATH 'fn:string-join(for $i in Past_Due_Details order by concat(substring($i/Past-Due-Due-Date, 7, 4), substring($i/Past-Due-Due-Date, 1, 2), substring($i/Past-Due-Due-Date, 4, 2)), number($i/Past-Due-Amount) return string($i/Past-Due-Due-Date), ", ")',
      Past_Due_Amounts           VARCHAR2(4000) PATH 'fn:string-join(for $i in Past_Due_Details order by concat(substring($i/Past-Due-Due-Date, 7, 4), substring($i/Past-Due-Due-Date, 1, 2), substring($i/Past-Due-Due-Date, 4, 2)), number($i/Past-Due-Amount) return string($i/Past-Due-Amount), ", ")',
      Retroactive_Subsidy_Details XMLTYPE PATH 'Retroactive_Subsidy_Details',
      Retroactive_Total_Amount   PATH 'RETROACTIVE-TOTAL-AMOUNT'
  ) xml_file2,
  XMLTABLE(
    'let $details := /Invoice_Details/Covered_Family_Member_Details/Retroactive_Subsidy_Details
     return <r>
       <fed>{string-join(
         for $d in $details
         where string-length($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD) > 0
         order by concat(substring($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD, 7, 4), substring($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD, 1, 2), substring($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD, 4, 2)), number($d/RETROACTIVE-FEDERAL-AMOUNT)
         return concat($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD, "=", $d/RETROACTIVE-FEDERAL-AMOUNT)
       , ", ")}</fed>
       <fed_amt>{string-join(
         for $d in $details
         where string-length($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD) > 0 and string-length($d/RETROACTIVE-FEDERAL-AMOUNT) > 0
         order by concat(substring($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD, 7, 4), substring($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD, 1, 2), substring($d/RETROACTIVE-FEDERAL-COVERAGE-PERIOD, 4, 2)), number($d/RETROACTIVE-FEDERAL-AMOUNT)
         return string($d/RETROACTIVE-FEDERAL-AMOUNT)
       , ",")}</fed_amt>
       <state>{string-join(
         for $d in $details
         where string-length($d/RETROACTIVE-STATE-COVERAGE-PERIOD) > 0
         order by concat(substring($d/RETROACTIVE-STATE-COVERAGE-PERIOD, 7, 4), substring($d/RETROACTIVE-STATE-COVERAGE-PERIOD, 1, 2), substring($d/RETROACTIVE-STATE-COVERAGE-PERIOD, 4, 2)), number($d/RETROACTIVE-STATE-AMOUNT)
         return concat($d/RETROACTIVE-STATE-COVERAGE-PERIOD, "=", $d/RETROACTIVE-STATE-AMOUNT)
       , ", ")}</state>
       <state_amt>{string-join(
         for $d in $details
         where string-length($d/RETROACTIVE-STATE-COVERAGE-PERIOD) > 0 and string-length($d/RETROACTIVE-STATE-AMOUNT) > 0
         order by concat(substring($d/RETROACTIVE-STATE-COVERAGE-PERIOD, 7, 4), substring($d/RETROACTIVE-STATE-COVERAGE-PERIOD, 1, 2), substring($d/RETROACTIVE-STATE-COVERAGE-PERIOD, 4, 2)), number($d/RETROACTIVE-STATE-AMOUNT)
         return string($d/RETROACTIVE-STATE-AMOUNT)
       , ",")}</state_amt>
     </r>'
    PASSING xml_file1.Invoice_Details
    COLUMNS
      Retroactive_Federal_Combined VARCHAR2(4000) PATH '/r/fed',
      Retroactive_Fedreal_Amt_CSV VARCHAR2(4000) PATH '/r/fed_amt',
      Retroactive_State_Subsidy_Combined VARCHAR2(4000) PATH '/r/state',
      Retroactive_State_Subsdiy_Amt_CSV VARCHAR2(4000) PATH '/r/state_amt'
  ) XML_FILE4
WHERE
  B.RGN_CD IN ('NCR', 'SCR')
  AND B.KPMC_MARKET_SEGMENT IN ( 'INDON', 'INDOFF' )
  AND B.BATCH_NBR = :batchNumber