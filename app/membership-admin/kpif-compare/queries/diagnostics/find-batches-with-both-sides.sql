--------------------------------------------------------------------------------
-- Diagnostics: Find batch numbers that have data on BOTH sides of the
-- comparison (XML source from KPMC_DOCMGMT_ADM  +  DB target from BILLING_OWNER)
--
-- The XML (source) side is driven by:
--   KPMC_DOCMGMT_ADM.INDV_INVOICE_NON_CONS_CTL  (joined to KPMC_EXTRACT_PAYLOAD)
-- The DB (target) side is driven by:
--   BILLING_OWNER.CI_BILL_ROUTING  (BATCH_CD = 'CM-BILEX')
--
-- Results are ordered by the number of records on the smaller side first,
-- so the most "balanced" batches with the most data float to the top.
--------------------------------------------------------------------------------

WITH xml_side AS (
  SELECT
    B.BATCH_NBR,
    COUNT(*)                  AS XML_RECORD_COUNT,
    COUNT(DISTINCT B.BILL_ID) AS XML_DISTINCT_BILLS
  FROM
    KPMC_DOCMGMT_ADM.INDV_INVOICE_NON_CONS_CTL B
    INNER JOIN KPMC_DOCMGMT_ADM.KPMC_EXTRACT_PAYLOAD EPL
      ON EPL.KPMC_TRANSACTION_ID = B.KPMC_INDIVIDUAL_INVOICE_TRANSACTION_ID
  WHERE
    B.RGN_CD IN ('NCR', 'SCR')
  GROUP BY
    B.BATCH_NBR
),
-- Uses CI_BILL_ROUTING only (for batch grouping / routing-level counts)
db_side_routing AS (
  SELECT
    BR.BATCH_NBR,
    COUNT(*)                    AS ROUTING_RECORD_COUNT,
    COUNT(DISTINCT BR.BILL_ID) AS ROUTING_DISTINCT_BILLS
  FROM
    BILLING_OWNER.CI_BILL_ROUTING BR
  WHERE
    BR.BATCH_CD = 'CM-BILEX'
  GROUP BY
    BR.BATCH_NBR
),
-- Mirrors BILL_LATEST: only bills that exist in BOTH CI_BILL_ROUTING and CM_EXTR_BILL
db_side_extr AS (
  SELECT
    BR.BATCH_NBR,
    COUNT(*)                    AS EXTR_RECORD_COUNT,
    COUNT(DISTINCT BR.BILL_ID) AS EXTR_DISTINCT_BILLS
  FROM
    BILLING_OWNER.CI_BILL_ROUTING BR
    INNER JOIN BILLING_OWNER.CM_EXTR_BILL CEB ON BR.BILL_ID = CEB.BILL_ID
  WHERE
    BR.BATCH_CD = 'CM-BILEX'
  GROUP BY
    BR.BATCH_NBR
)
SELECT
  x.BATCH_NBR,
  x.XML_RECORD_COUNT,
  x.XML_DISTINCT_BILLS,
  r.ROUTING_RECORD_COUNT,
  r.ROUTING_DISTINCT_BILLS,
  e.EXTR_RECORD_COUNT,
  e.EXTR_DISTINCT_BILLS,
  -- Difference: bills in routing but NOT in CM_EXTR_BILL
  (r.ROUTING_DISTINCT_BILLS - NVL(e.EXTR_DISTINCT_BILLS, 0)) AS ROUTING_ONLY_BILLS,
  -- How many BILL_IDs overlap (joinable rows for comparison)
  (
    SELECT COUNT(DISTINCT B.BILL_ID)
    FROM KPMC_DOCMGMT_ADM.INDV_INVOICE_NON_CONS_CTL B
    WHERE B.BATCH_NBR = x.BATCH_NBR
      AND B.RGN_CD IN ('NCR', 'SCR')
      AND B.BILL_ID IN (
        SELECT BR.BILL_ID
        FROM BILLING_OWNER.CI_BILL_ROUTING BR
          INNER JOIN BILLING_OWNER.CM_EXTR_BILL CEB ON BR.BILL_ID = CEB.BILL_ID
        WHERE BR.BATCH_CD = 'CM-BILEX'
          AND BR.BATCH_NBR = x.BATCH_NBR
      )
  ) AS OVERLAPPING_BILLS
FROM
  xml_side x
  INNER JOIN db_side_routing r ON x.BATCH_NBR = r.BATCH_NBR
  LEFT  JOIN db_side_extr    e ON x.BATCH_NBR = e.BATCH_NBR
ORDER BY
  LEAST(x.XML_RECORD_COUNT, NVL(e.EXTR_RECORD_COUNT, 0)) DESC,
  OVERLAPPING_BILLS DESC;
