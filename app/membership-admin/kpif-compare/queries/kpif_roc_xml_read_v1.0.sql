/*
 * The query will get KPIF XML CLOB for an transaction Id i.e. Invoice/Bill Id, and parse it.
 * The query will provide the result in flat structure in column format.
 * Date				Comment
 * 01/26/2026		Initial Draft
 * 01/29/2026		Updated query to accept batch number instead of transaction id.
 *
 */
--KPIF ROC XML structure read
SELECT
  EPL.KPMC_TRANSACTION_ID,
  B.BILL_ID,
  B.RGN_CD,
  B.BATCH_CD,
  B.BATCH_NBR,
  EPL.TYPE,
  xml_file1.Transaction_ID,
  xml_file1.Invoice_Number,
  xml_file1.Region,
  xml_file1.Region_Id,
  xml_file1.Group_Id,
  xml_file1.Bill_GRP_Id,
  xml_file1.Sub_GRP_Id,
  xml_file1.Billing_Unit_Id,
  xml_file1.Invoice_Generated_Date,
  xml_file1.Statement_Month,
  xml_file1.Statement_Year,
  xml_file1.Prior_month_balance,
  xml_file1.Payment_Received,
  xml_file2.Rejected_Payment,
  xml_file1.Current_Premium_Due,
  xml_file1.Total_Balance_Due,
  xml_file1.Other_Adjustment,
  xml_file1.ACI_Pay_Mode,
  xml_file1.Jurisdiction,
  xml_file2.Region_Name_Invoice_Detail,
  xml_file2.Current_Month_Premium,
  xml_file2.Current_Month_Premium_No_LISLEP,
  xml_file2.Advantage_Plus,
  xml_file2.Late_Enrollment_Penalty,
  xml_file2.Low_Income_Subsidy,
  xml_file2.Federal_Subsidy,
  xml_file2.State_Subsidy,
  xml_file2.Subtotal,
  xml_file2.Pay_From_Date,
  xml_file2.Pay_Through_Date,
  xml_file2.Pay_Over_30_Amt,
  xml_file2.Total_Retroactive_Amount,
  xml_file3.Retroactive_Federal_Combined,
  (SELECT SUM(CASE WHEN REGEXP_LIKE(TRIM(REGEXP_SUBSTR(xml_file3.Retroactive_Fedreal_Amt_CSV, '[^,]+', 1, LEVEL)), '^-?[0-9]+(\.[0-9]+)?$') THEN TO_NUMBER(TRIM(REGEXP_SUBSTR(xml_file3.Retroactive_Fedreal_Amt_CSV, '[^,]+', 1, LEVEL))) END) FROM DUAL CONNECT BY REGEXP_SUBSTR(xml_file3.Retroactive_Fedreal_Amt_CSV, '[^,]+', 1, LEVEL) IS NOT NULL) Retroactive_Fedreal_Amt,
  xml_file3.Retroactive_State_Subsidy_Combined,
  (SELECT SUM(CASE WHEN REGEXP_LIKE(TRIM(REGEXP_SUBSTR(xml_file3.Retroactive_State_Subsdiy_Amt_CSV, '[^,]+', 1, LEVEL)), '^-?[0-9]+(\.[0-9]+)?$') THEN TO_NUMBER(TRIM(REGEXP_SUBSTR(xml_file3.Retroactive_State_Subsdiy_Amt_CSV, '[^,]+', 1, LEVEL))) END) FROM DUAL CONNECT BY REGEXP_SUBSTR(xml_file3.Retroactive_State_Subsdiy_Amt_CSV, '[^,]+', 1, LEVEL) IS NOT NULL) Retroactive_State_Subsdiy_Amt,
  CASE WHEN LENGTH(xml_file2.ROC_30_Pay_Dates) > 1000 THEN '##OVERFLOW_S##' ELSE xml_file2.ROC_30_Pay_Dates END,
  CASE WHEN LENGTH(xml_file2.ROC_30_Pay_Amts) > 1000 THEN '##OVERFLOW_S##' ELSE xml_file2.ROC_30_Pay_Amts END
FROM
  KPMC_DOCMGMT_ADM.KPMC_EXTRACT_PAYLOAD EPL
  INNER JOIN KPMC_DOCMGMT_ADM.INDV_INVOICE_NON_CONS_CTL B ON EPL.KPMC_TRANSACTION_ID = B.KPMC_INDIVIDUAL_INVOICE_TRANSACTION_ID,
  XMLTABLE(
    '/recipient' PASSING XMLPARSE(DOCUMENT EPL.PAYLOAD_XML) COLUMNS Transaction_ID PATH 'KPMC_Individual_Invoice_Transaction_ID',
    Invoice_Number PATH 'ROC-INVOICE-NUMBER',
    Region PATH 'ROC-REGION-NAME',
    Region_Id PATH 'ROC-REGION-ID',
    Group_Id PATH 'ROC-GROUP-ID',
    Bill_GRP_Id PATH 'ROC-BILL-GRP-ID',
    Sub_GRP_Id PATH 'ROC-SUB-GRP-ID',
    Billing_Unit_Id PATH 'ROC-ORMB-ACCT-ID',
    Invoice_Generated_Date PATH 'ROC-INV-GENERATED-DATE',
    Statement_Month PATH 'ROC-INV-STMT-MONTH',
    Statement_Year PATH 'ROC-INV-STMT-YEAR',
    Prior_month_balance PATH 'ROC-INV-SMRY-PREV-BAL',
    Payment_Received PATH 'ROC-PAY-TOT-AMOUNT',
    Current_Premium_Due PATH 'ROC-INV-SMRY-CURR-PREM_DUE',
    Total_Balance_Due PATH 'ROC-INV-SMRY-TOT-BAL-DUE',
    Other_Adjustment PATH 'ROC-TOT-ADJ-AMT',
    ACI_Pay_Mode PATH 'ROC-INV-ACI-PAY-MODE',
    Invoice_Details XMLTYPE PATH 'Invoice_Details',
    Jurisdiction PATH 'JURISDICTION'
  ) xml_file1,
  XMLTable(
    '/Invoice_Details/Covered_Family_Member_Details' PASSING xml_file1.Invoice_Details COLUMNS Region_Name_Invoice_Detail PATH 'ROC-REGION-NAME-INVOICE-DETAIL',
    Current_Month_Premium PATH 'ROC-MED-NON-SUP-PREM-AMT',
    Current_Month_Premium_No_LISLEP PATH 'ROC-PREM-DUE-NO-LISLEP',
    Advantage_Plus PATH 'ROC-SUPPL-PREM-AMT',
    Late_Enrollment_Penalty PATH 'ROC-LEP-AMT',
    Low_Income_Subsidy PATH 'ROC-LIS-AMT',
    Federal_Subsidy PATH 'APTC',
    State_Subsidy PATH 'STE_SUBSIDY',
    Subtotal PATH 'ROC-SUB-TOT',
    Pay_From_Date PATH 'ROC-PAY-FRM-DATE',
    Rejected_Payment PATH 'ROC-PAY-TOT-REJ-AMOUNT',
    Pay_Through_Date PATH 'ROC-PAY-THRU-DATE',
    Pay_Over_30_Amt PATH 'ROC-PAY-OVER-30-AMT',
    Total_Retroactive_Amount PATH 'RETROACTIVE-TOTAL-AMOUNT',
    Retroactive_Subsidy_Details XMLTYPE PATH 'Retroactive_Subsidy_Details',
    -- Concatenate ALL Itemized_Payment_Details entries sorted by date then amount
    ROC_30_Pay_Dates  VARCHAR2(4000) PATH 'fn:string-join(for $i in Itemized_Payment_Details order by concat(substring($i/ROC-30-PAY-DATE, 7, 4), substring($i/ROC-30-PAY-DATE, 1, 2), substring($i/ROC-30-PAY-DATE, 4, 2)), number($i/ROC-30-PAY-AMT) return string($i/ROC-30-PAY-DATE), ", ")',
    ROC_30_Pay_Amts   VARCHAR2(4000) PATH 'fn:string-join(for $i in Itemized_Payment_Details order by concat(substring($i/ROC-30-PAY-DATE, 7, 4), substring($i/ROC-30-PAY-DATE, 1, 2), substring($i/ROC-30-PAY-DATE, 4, 2)), number($i/ROC-30-PAY-AMT) return string($i/ROC-30-PAY-AMT), ", ")'
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
         where string-length($d/RETROACTIVE-FEDERAL-AMOUNT) > 0
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
         where string-length($d/RETROACTIVE-STATE-AMOUNT) > 0
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
  ) XML_FILE3
WHERE
  B.RGN_CD NOT IN ('NCR', 'SCR')
  AND B.KPMC_MARKET_SEGMENT IN ( 'INDON', 'INDOFF' )
  AND B.BATCH_NBR = :batchNumber --'3274'--