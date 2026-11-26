-- Select all distinct batch ids where XML exists and has RETROACTIVE-STATE-COVERAGE-PERIOD data
WITH ranked AS (
  SELECT
    B.BATCH_NBR,
    B.BILL_ID,
    EPL.KPMC_TRANSACTION_ID,
    B.RGN_CD,
    B.BATCH_CD,
    EPL.TYPE,
    EPL.PAYLOAD_XML,
    xml_file3.Retroactive_State_Subsdiy_Coverage_Period,
    ROW_NUMBER() OVER (
      PARTITION BY B.BATCH_NBR
      ORDER BY EPL.KPMC_TRANSACTION_ID
    ) AS rn
  FROM KPMC_DOCMGMT_ADM.KPMC_EXTRACT_PAYLOAD EPL
  INNER JOIN KPMC_DOCMGMT_ADM.INDV_INVOICE_NON_CONS_CTL B
    ON EPL.KPMC_TRANSACTION_ID = B.KPMC_INDIVIDUAL_INVOICE_TRANSACTION_ID
  INNER JOIN BILLING_OWNER.CI_BILL_ROUTING EB
    ON B.BILL_ID = EB.BILL_ID,
  XMLTABLE(
    '/recipient' PASSING XMLPARSE(DOCUMENT EPL.PAYLOAD_XML) COLUMNS
    Invoice_Details XMLTYPE PATH 'Invoice_Details'
  ) xml_file1,
  XMLTABLE(
    '/Invoice_Details/Covered_Family_Member_Details' PASSING xml_file1.Invoice_Details COLUMNS
    Retroactive_Subsidy_Details XMLTYPE PATH 'Retroactive_Subsidy_Details'
  ) xml_file2,
  XMLTABLE(
    '/Retroactive_Subsidy_Details' PASSING xml_file2.Retroactive_Subsidy_Details COLUMNS
    Retroactive_State_Subsdiy_Coverage_Period PATH 'RETROACTIVE-STATE-COVERAGE-PERIOD'
  ) xml_file3
  WHERE xml_file3.Retroactive_State_Subsdiy_Coverage_Period IS NOT NULL
)
SELECT
  BATCH_NBR,
  BILL_ID,
  KPMC_TRANSACTION_ID,
  RGN_CD,
  BATCH_CD,
  TYPE,
  Retroactive_State_Subsdiy_Coverage_Period,
  PAYLOAD_XML
FROM ranked
WHERE rn = 1;