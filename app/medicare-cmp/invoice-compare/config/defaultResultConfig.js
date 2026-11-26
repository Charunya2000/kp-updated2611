/**
 * Default result configuration for medicare C-Bills.
 *
 * Each entry defines the SQL file, worksheet/filename labels, and ordered
 * column headers for the Excel export.  Column headers use the shape
 * { name, sqlAlias?, notes? } consumed by the worker"s Excel builder.
 *
 * This file is the single source of truth for the hardcoded defaults.
 * At runtime the config admin UI can override these via MongoDB — see
 * medicareCompareResultConfigService for the DB-backed version.
 */
export const DEFAULT_RESULT_CONFIG_BY_INVOICE_TYPE = {
  "med": {
    "sqlFile": "select_final_results_med.sql",
    "worksheetName": "IPB0001 Non-Consolidated",
    "filenameLabel": "Non-Consolidated",
    "columnHeaders": [
      {
        "name": "Run ID",
        "sqlAlias": "RUN_ID"
      },
      {
        "name": "Index",
        "sqlAlias": "ID"
      },
      {
        "name": "Batch Number",
        "sqlAlias": "BATCH_NBR"
      },
      {
        "name": "Auditor",
        "sqlAlias": "AUDITOR"
      },
      {
        "name": "Audit Period",
        "sqlAlias": "AUDIT_PERIOD"
      },
      {
        "name": "Audit Date",
        "sqlAlias": "AUDIT_DATE"
      },
      {
        "name": "Letter ID",
        "sqlAlias": "LETTER_ID"
      },
      {
        "name": "Letter Name",
        "sqlAlias": "LETTER_NAME"
      },
      {
        "name": "Region",
        "sqlAlias": "REGION"
      },
      {
        "name": "KPMC Transaction ID",
        "sqlAlias": "KPMC_TRANSACTION_ID"
      },
      {
        "name": "Pass or Flag",
        "sqlAlias": "PASS_OR_FLAG"
      },
      {
        "name": "Auditor Notes",
        "sqlAlias": "AUDITOR_NOTES",
        "notes": ["Test Name", "Test Description", "Test Notes"]
      },
      {
        "name": "Invoice Total Amount",
        "sqlAlias": "INVOICE_TOTAL_AMOUNT_MATCH"
      },
      {
        "name": "Coverage Through Month",
        "sqlAlias": "COVERAGE_THROUGH_MONTH_MATCH"
      },
      {
        "name": "Coverage Through Year",
        "sqlAlias": "COVERAGE_THROUGH_YEAR_MATCH"
      },
      {
        "name": "Invoice Summary Due Date",
        "sqlAlias": "INVOICE_SUMMARY_DUE_DATE_MATCH"
      },
      {
        "name": "Activity Start Date",
        "sqlAlias": "ACTIVITY_START_DATE_MATCH"
      },
      {
        "name": "Activity End Date",
        "sqlAlias": "ACTIVITY_END_DATE_MATCH"
      },
      {
        "name": "Coverage Through Month Detail",
        "sqlAlias": "COVERAGE_THROUGH_MONTH_DETAIL_MATCH"
      },
      {
        "name": "Ormb Acct Id",
        "sqlAlias": "ORMB_ACCT_ID_MATCH"
      },
      {
        "name": "Primary Sub Total Amount",
        "sqlAlias": "PRIMARY_SUB_TOTAL_AMOUNT_MATCH"
      },
      {
        "name": "Secondary Parent Billing Unit",
        "sqlAlias": "SECONDARY_PARENT_BILLING_UNIT_MATCH"
      },
      {
        "name": "Secondary Sub Total Amount",
        "sqlAlias": "SECONDARY_SUB_TOTAL_AMOUNT_MATCH"
      },
      {
        "name": "Beginning Balance",
        "sqlAlias": "BEGINNING_BALANCE_MATCH"
      },
      {
        "name": "Payments Amount",
        "sqlAlias": "PAYMENTS_AMOUNT_MATCH"
      },
      {
        "name": "Remittance Reversal Amount",
        "sqlAlias": "REMITTANCE_REVERSAL_AMOUNT_MATCH"
      },
      {
        "name": "Med Non Sup Prem Amount",
        "sqlAlias": "MED_NON_SUP_PREM_AMOUNT_MATCH"
      },
      {
        "name": "Adjustment Amount",
        "sqlAlias": "ADJUSTMENT_AMOUNT_MATCH"
      },
      {
        "name": "Sub Total",
        "sqlAlias": "SUB_TOTAL_MATCH"
      },
      {
        "name": "Mrn Prefix",
        "sqlAlias": "MRN_PREFIX_MATCH"
      },
      {
        "name": "Aci Acct Nb",
        "sqlAlias": "INVOICE_ACI_ACCT_NB_MATCH"
      },
      {
        "name": "Aci Auto Pay Date",
        "sqlAlias": "INVOICE_ACI_AUTO_PAY_DATE_MATCH"
      },
      {
        "name": "Past Due Coverage Period",
        "sqlAlias": "PAST_DUE_COVERAGE_PERIOD_MATCH"
      },
      {
        "name": "Past Due Due Date",
        "sqlAlias": "PAST_DUE_DUE_DATE_MATCH"
      },
      {
        "name": "Past Due Amount",
        "sqlAlias": "PAST_DUE_AMOUNT_MATCH"
      },
      {
        "name": "Payments 30 Date",
        "sqlAlias": "PAYMENTS_30_DATE_MATCH"
      },
      {
        "name": "Payments 30 Amount",
        "sqlAlias": "PAYMENTS_30_AMOUNT_MATCH"
      },
      {
        "name": "Secondary Family Account No",
        "sqlAlias": "SECONDARY_FAMILY_ACCOUNT_NO_MATCH"
      },
      {
        "name": "Secondary Mrn Suffix",
        "sqlAlias": "SECONDARY_MRN_SUFFIX_MATCH"
      },
      {
        "name": "Mrn Suffix",
        "sqlAlias": "MRN_SUFFIX_MATCH"
      },
      {
        "name": "Current Retiree Subsidy Amount",
        "sqlAlias": "CURRENT_RETIREE_SUBSIDY_AMOUNT_MATCH"
      },
      {
        "name": "Current Spdap Amount",
        "sqlAlias": "CURRENT_SPDAP_AMOUNT_MATCH"
      },
      {
        "name": "Current Dues Lep Amount",
        "sqlAlias": "CURRENT_DUES_LEP_AMOUNT_MATCH"
      },
      {
        "name": "Current Dues Lis Amount",
        "sqlAlias": "CURRENT_DUES_LIS_AMOUNT_MATCH"
      },
      {
        "name": "Retroactive Dues Lep Amount",
        "sqlAlias": "RETROACTIVE_DUES_LEP_AMOUNT_MATCH"
      },
      {
        "name": "Retroactive Lis Amount",
        "sqlAlias": "RETROACTIVE_LIS_AMOUNT_MATCH"
      },
      {
        "name": "Retroactive Retiree Subsidy Amount",
        "sqlAlias": "RETROACTIVE_RETIREE_SUBSIDY_AMOUNT_MATCH"
      },
      {
        "name": "Retroactive Spdap Amount",
        "sqlAlias": "RETROACTIVE_SPDAP_AMOUNT_MATCH"
      },
      {
        "name": "Invoice Generated Date",
        "sqlAlias": "INVOICE_GENERATED_DATE_MATCH"
      },
      {
        "name": "Subscriber First Name",
        "sqlAlias": "SUBSCRIBER_FIRST_NAME_MATCH"
      },
      {
        "name": "Subscriber Middle Initial",
        "sqlAlias": "SUBSCRIBER_MID_INTL_MATCH"
      },
      {
        "name": "Subscriber Last Name",
        "sqlAlias": "SUBSCRIBER_LAST_NAME_MATCH"
      },
      {
        "name": "Subscriber Care Of First Name",
        "sqlAlias": "SUBSCRIBER_ADDR_CARE_OF_FIRST_NAME_MATCH"
      },
      {
        "name": "Subscriber Care Of Middle Name",
        "sqlAlias": "SUBSCRIBER_ADDR_CARE_OF_MID_NAME_MATCH"
      },
      {
        "name": "Subscriber Care Of Last Name",
        "sqlAlias": "SUBSCRIBER_ADDR_CARE_OF_LAST_NAME_MATCH"
      },
      {
        "name": "Subscriber Address Line 1",
        "sqlAlias": "SUBSCRIBER_ADDR_ADDR_LN1_MATCH"
      },
      {
        "name": "Subscriber Address Line 2",
        "sqlAlias": "SUBSCRIBER_ADDR_ADDR_LN2_MATCH"
      },
      {
        "name": "Subscriber Address City",
        "sqlAlias": "SUBSCRIBER_ADDR_ADDR_CITY_MATCH"
      },
      {
        "name": "Subscriber Address State",
        "sqlAlias": "SUBSCRIBER_ADDR_ADDR_STATE_CD_MATCH"
      },
      {
        "name": "Subscriber Address ZIP",
        "sqlAlias": "SUBSCRIBER_ADDR_ADDR_ZIP_CD_MATCH"
      },
      {
        "name": "Subscriber Address ZIP+4",
        "sqlAlias": "SUBSCRIBER_ADDR_ADDR_ZIP_CD_PLUS4_MATCH"
      },
      {
        "name": "Compare Values",
        "sqlAlias": "COMPARE_VALUES",
        "notes": [
          "Populated when a mismatch is found",
          "Contains a Key/Value pair list of the fields that were compared for each IPB and the root values used in the comparison",
          "Note that some root comparison values can be visibly different, but still match. Example: N/A represents null, but would still be considered equal to 0 in some cases"
        ]
      }
    ],
  }
};
