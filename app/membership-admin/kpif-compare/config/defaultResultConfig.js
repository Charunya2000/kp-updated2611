/**
 * Default result configuration per invoice type.
 *
 * Each entry defines the SQL file, worksheet/filename labels, and ordered
 * column headers for the Excel export.  Column headers use the shape
 * { name, sqlAlias?, notes? } consumed by the worker's Excel builder.
 *
 * This file is the single source of truth for the hardcoded defaults.
 * At runtime the config admin UI can override these via MongoDB — see
 * kpifCompareResultConfigService for the DB-backed version.
 */
export const DEFAULT_RESULT_CONFIG_BY_INVOICE_TYPE = {
  ca: {
    sqlFile: 'select_final_results_ca.sql',
    worksheetName: 'IPB0001 Non-Consolidated',
    filenameLabel: 'Non-Consolidated',
    columnHeaders: [
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
        "name": "Process Date",
        "sqlAlias": "PROCESS_DATE"
      },
      {
        "name": "Line of Business",
        "sqlAlias": "LOB"
      },
      {
        "name": "Billing Unit ID",
        "sqlAlias": "BILLING_UNIT_ID"
      },
      {
        "name": "MRN",
        "sqlAlias": "MRN"
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
        "name": "Jurisdiction",
        "sqlAlias": "JURISDICTION"
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
        "name": "IPB0001_3",
        "sqlAlias": "IPB0001_3",
        "notes": [
          'The Month and Year of the premium statement are present and correct',
          'The Month and Year of the premium statement are present and correct',
          `"Date Format:
Month YYYY

The Premium Statement Month and Year are the month and year for the upcoming month of coverage."`
        ]
      },
      {
        "name": "IPB0001_4",
        "sqlAlias": "IPB0001_4",
        "notes": [
          'Statement Date is correct',
          'The Statement Date is correct based on the Bill Date in ORMB.',
          `Date Format:
MM/DD/YYYY

Verify via the Bill page.
=> Dashboard | Current Context zone
=> Click on the Account Context drop-down arrow (second drop-down arrow)
=> Click on Go To Bill 
=> Select Search 
=> Click on the applicable Bill ID (Invoice Number)
=> Bill page | Main tab | Bill Date"`
        ]
      },
      {
        "name": "IPB0001_6",
        "sqlAlias": "IPB0001_6",
        "notes": [
          'Billing Unit ID is present and correct',
          'The Billing Unit ID [BUID] is present and correct based on the data in ORMB.',
          `Verify via the Customer 360° Information page. 
=> Account tab | Account List zone 
=> Broadcast the applicable account

NCR, SCR: 
=> Account Information zone => Account Identifier => The BUID is the last string of digits [9-digit FS legacy BUIK].
Example: NCR-800111-4001-123456789  

KPIF Off Exchange:
NCR, SCR: 9-digit FS legacy BUIK

KPIF On Exchange:
10-digit ORMB Account ID`
        ]
      },
      {
        "name": "IPB0001_12",
        "sqlAlias": "IPB0001_12",
        "notes": [
          'Autopay enrollment status is correct',
          'Autopay enrollment status is present and correct based on the Subscribers profile in ORMB.',
          `""N/A"" if subscriber was not enrolled in autopay at the time the invoice was generated.

Verify via the Account page.
=>Dashboard | Current Context zone 
=> Click on the Account Information hyperlink 
=> Account page |Auto Pay tab`
        ]
      },
      {
        "name": "IPB0001_16",
        "sqlAlias": "IPB0001_16",
        "notes": [
          'Payment due verbiage and date are present and correct',
          `The payment due verbiage and date are present and correct based on the accounts status in ORMB.

If not past due:
""Payment due now"" by:"" MM/DD/YYY

If past due: 
""Payment due now"" and ""This total includes an amount thats past due""`,
          `Due Date:
Last day of the month prior to coverage month.`
        ]
      },
      {
        "name": "IPB0001_17",
        "sqlAlias": "IPB0001_17",
        "notes": [
          'Total Balance Due is present and correct',
          'The Total Balance Due amount in the blue box is present and correct based on any corrections or changes made prior to the generation of this invoice.',
          `This amount will match the Current Balance displayed in the Financial Information zone of the Dashboard IF no changes have been made to the account since the invoice was generated.

Verify via the Account Financial History page.
 => Dashboard | Current Context zone 
=> Click on the Account Context drop-down arrow (second drop-down arrow) 
=> Click on Go To Account Financial Hist
=> Account Financial History page
=> Identify the last transaction posted (Arrears Date) prior to the invoice Statement Date. The Current Balance will be the same as the Total Balance Due on the invoice.`
        ]
      },
      {
        "name": "IPB0001_22",
        "sqlAlias": "IPB0001_22",
        "notes": [
          'Prior Month\'s Balance is present and correct',
          'The Prior Months Balance is present and correct in the Premium Charges section based on the Total Balance Due on the previous months invoice in ORMB.',
          `Verify via the Bill page.
 =>Dashboard | Current Context zone 
=> Click on the Account Context drop-down arrow (second drop-down arrow) 
=> Click on Go To Bill 
=> Select Search 
=> Click on the previous months bill
=> Bill page | Main tab 
=> Click on Display Bill

If the Bill fails to display in ORMB, verify via CARS.
=> Search tab
=> Expand Individual Bills
=> Enter the Subscribers MRN into the MRN Prefix and MRN boxes
=> Click on Search
=> Identify the previous months bill by the Coverage Period column in the Search Results
=> Open and view the previous months bill`
        ]
      },
      {
        "name": "IPB0001_23",
        "sqlAlias": "IPB0001_23",
        "notes": [
          'Payment(s) Received are present and correct',
          'Payments received in the Premium Charges section are present and contains all payments received and rejected since the last generated bill.',
          `Verify via the Account Payment History page.
=> Dashboard |Current Context zone 
=> Click on the Account Context drop-down arrow (second drop-down arrow)
=> Click on Go To Payment History 
=> Account Payment History page

If you think payments are missing, check if posted to the previous invoice.  

Payment Status: 
Frozen/Balanced: Payment applied to the account.
Pending: Payment has not cleared and is not applied to the account. 
Canceled: Payment canceled.`
        ]
      },
      {
        "name": "IPB0001_24",
        "sqlAlias": "IPB0001_24",
        "notes": [
          'Past Due Amount(s) is present and correct',
          'The past due amount(s), total past due amount and date(s) are present and correct per ORMB.',
          `""N/A"" if member is not past due.

Past Due Amount line item will display in Premium Charges section of letter if applicable.

Verify via ORMB.
=> Account Bill/Payment History Page. Bill entries in red font are unpaid. Determine if the bill is past due by the current date and the Premium Month the bill is for. The dates and amount unpaid can be found in the ""Activity information"" column. 

Navigation to Account Bill/Payment History Page: Dashboard => Current Context Zone => Open the Account information drop-down arrow =>  select ""Go To Account Bill/Payment History"" => Account Bill/Payment History.`
        ]
      },
      {
        "name": "IPB0001_25",
        "sqlAlias": "IPB0001_25",
        "notes": [
          'Current Month Charges are present and correct',
          'The Current month charges in the Premium Charges section are present and correct based on the sum of all active plans for the Subscriber. The charges will include medical premiums, dental premiums, federal subsidies, and state subsidies, if applicable.',
          `Verify via the Membership page.
=> Customer 360 Information page => Person tab => Person Hierarchy zone
=> Select the applicable Membership entry in the Hierarchy table 
=> Membership page => Contracts and Charges tab => Billable Charges zone => refer to the Start Date, End Date, Price Item Information, and Amount columns

Verify the correctness of the premium by comparing the premium amounts from the Exchange and the NRT. If they do not match, mark the TE, ""No"".
=> Broadcast the entry with the applicable Start and End dates => Billable Charge Timeline Details => Broadcast the entry with the applicable Start and End dates:

Pricing Calculation Details: Contains the total premium for the household. The data comes from the Exchange via the 834 file. Note: The value will be the same as the value in the Billable Charges zone.

Legacy Pricing Calculation Details: Contains the individual premiums per member. The data comes from the NRT.

Subsidies:
Federal (APTC): Federal Subsidy
State: State Subsidy and/or Supplemental Subsidy; California Premium Credit`
        ]
      },
      {
        "name": "IPB0001_26",
        "sqlAlias": "IPB0001_26",
        "notes": [
          'Adjustments are present and correct',
          'The Adjustments in the Premium Charges section are present and are correct based on any corrections or changes made prior to the generation of this invoice.',
          `Verify via the Adjustment page.
=> Dashboard |Current Context zone 
=> Click on the Account Context drop-down arrow (second drop-down arrow)
=> Click on Go To Adjustment => => Click Search => Select the applicable adjustments since the last bill was generated
=> Adjustment page`
        ]
      },
      {
        "name": "IPB0001_27",
        "sqlAlias": "IPB0001_27",
        "notes": [
          'Total Balance Due is present and correct',
          'The Total Balance Due is present and correct   based on the previous balance minus applied payments plus current charges and adjustments prior to the generation of this invoice.',
          `This amount will match the Current Balance displayed in the Financial Information zone of the Dashboard IF no changes have been made to the account since the invoice was generated.

Verify via the Account Financial History page.
 =>Dashboard | Current Context zone 
=> Click on the Account Context drop-down arrow (second drop-down arrow) 
=> Click on Go To Account Financial Hist
=> Account Financial History page
=> Identify the last transaction posted (Arrears Date) prior to the invoice Statement Date. The Current Balance will be the same as the Total Balance Due on the invoice.`
        ]
      },
      {
        "name": "IPB0001_28",
        "sqlAlias": "IPB0001_28",
        "notes": [
          'Past Due amount(s) breakdown chart is present and correct',
          'The past due amount(s), total past due amount and date(s) are present and correct per ORMB.',
          `""N/A"" if member is not greater than 4 months past due.

ORMB:
Verify via the Account Bill/Payment History Page. Bill entries in red font are unpaid and past due. The dates and amount unpaid can be found in the ""Activity information"" column. 

Navigation to Account Bill/Payment History Page: Dashboard => Current Context Zone => Open the Account information drop-down arrow =>  select """"Go To Account Bill/Payment History"""" => Account Bill/Payment History.`
        ]
      },
      {
        "name": "IPB0001_29",
        "sqlAlias": "IPB0001_29",
        "notes": [
          "Retroactive Subsidies section is present and correct",
          "The subsidies (federal and state) applied retroactively are present and correct in the Retroactive Subsidies section.",
          `"""N/A"" if less than three (3) retroactive subsidies were received.

Verify via the Contract Financial History page.
Dashboard => Current Context zone 
=> Click on the Account Context drop-down arrow (second drop-down arrow) 
=> Click on Go to Contract Financial History 
=> Click on the applicable Active Contract Type
=> Contract Financial History page"`
        ]
      },
      {
        "name": "Compare Values",
        "sqlAlias": "COMPARE_VALUES",
        "notes": [
          'Populated when a mismatch is found',
          'Contains a Key/Value pair list of the fields that were compared for each IPB and the root values used in the comparison',
          'Note that some root comparison values can be visibly different, but still match. Example: N/A represents null, but would still be considered equal to 0 in some cases'
        ]
      }
    ],
  },
  moc: {
    sqlFile: 'select_final_results_moc.sql',
    worksheetName: 'IPB0001 MOC',
    filenameLabel: 'MOC',
    columnHeaders: [
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
        "name": "Process Date",
        "sqlAlias": "PROCESS_DATE"
      },
      {
        "name": "Line of Business",
        "sqlAlias": "LOB"
      },
      {
        "name": "Billing Unit ID",
        "sqlAlias": "BILLING_UNIT_ID"
      },
      {
        "name": "MRN",
        "sqlAlias": "MRN"
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
        "name": "Jurisdiction",
        "sqlAlias": "JURISDICTION"
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
        name: 'IPB0001_19',
        sqlAlias: 'IPB0001_19',
        notes: [
          'Total Balance Due is present and correct',
          'The Total Balance Due amount in the blue box is present and correct based on any corrections or changes made prior to the generation of this invoice.',
          `This amount will match the Current Balance displayed in the Financial Information zone of the Dashboard IF no changes have been made to the account since the invoice was generated.

Verify via the Account Financial History page.
 =>Dashboard | Current Context zone 
=> Click on the Account Context drop-down arrow (second drop-down arrow) 
=> Click on Go To Account Financial Hist
=> Account Financial History page
=> Identify the last transaction posted (Arrears Date) prior to the invoice Statement Date. The Current Balance will be the same as the Total Balance Due on the invoice.`
        ]
      },
      {
        name: 'IPB0001_8',
        sqlAlias: 'IPB0001_8',
        notes: [
          'Billing Unit ID is present and correct',
          'The Billing Unit ID [BUID] is present and correct based on the Account ID in ORMB.',
          `Verify via the Customer 360° Information page. 
=> Account tab | Account List zone 
=> Broadcast the applicable account

KPIF On Exchange: 
10-digit ORMB Account ID
=> The BUID is embedded in the Account Information value.
Example: Sim,Bill,T,Individual On-Exchange,$1,277.02,7831234567,Invoice Account

KPIF Off Exchange:
NCR, SCR: 9-digit FS legacy BUIK
COL, GEO, HAW, KNW: 21-character CM BUID
MAS: 10-digit ORMB Account ID
WAS: 10-digit ORMB Account ID

21-character CM BUID:
[Region, Group, Bill Group, MRN, subgroup]
Example: 1244444D1000123456379
Bill Groups: 
COL, HAW: D1 
GEO: 00
KNW: DA (Medical) and DB (Dental)`
        ]
      },
      {
        name: 'IPB0001_29',
        sqlAlias: 'IPB0001_29',
        notes: [
          'Total Balance Due is present and correct',
          'The Total Balance Due is present and correct   based on the previous balance minus applied payments plus current charges and adjustments prior to the generation of this invoice.',
          `This amount will match the Current Balance displayed in the Financial Information zone of the Dashboard IF no changes have been made to the account since the invoice was generated.

Verify via the Account Financial History page.
 =>Dashboard | Current Context zone 
=> Click on the Account Context drop-down arrow (second drop-down arrow) 
=> Click on Go To Account Financial Hist
=> Account Financial History page
=> Identify the last transaction posted (Arrears Date) prior to the invoice Statement Date. The Current Balance will be the same as the Total Balance Due on the invoice.`
        ]
      },
      {
        name: 'IPB0001_24',
        sqlAlias: 'IPB0001_24',
        notes: [
          'Prior Month\'s Balance is present and correct',
          'The Prior Month\'s Balance is present and correct in the Premium Charges section based on the Total Balance Due on the previous month\'s invoice in ORMB.',
          `Verify via the Bill page.
 =>Dashboard | Current Context zone 
=> Click on the Account Context drop-down arrow (second drop-down arrow) 
=> Click on Go To Bill 
=> Select Search 
=> Click on the previous month's bill
=> Bill page | Main tab 
=> Click on Display Bill

If the Bill fails to display in ORMB, verify via CARS.
=> Search tab
=> Expand Individual Bills
=> Enter the Subscriber's MRN into the MRN Prefix and MRN boxes
=> Click on Search
=> Identify the previous month's bill by the Coverage Period column in the Search Results
=> Open and view the previous month's bill`
        ]
      },
      {
        name: 'IPB0001_25',
        sqlAlias: 'IPB0001_25',
        notes: [
          'Payments Received are present and correct',
          'The payments received in the Premium Charges section are present and contains all payments received and rejected since the last generated bill.',
          `Verify via the Account Payment History page.
=> Dashboard |Current Context zone 
=> Click on the Account Context drop-down arrow (second drop-down arrow)
=> Click on Go To Payment History 
=> Account Payment History page

If you think payments are missing, check if posted to the previous invoice.  

Payment Status: 
Frozen/Balanced: Payment applied to the account.
Pending: Payment has not cleared and is not applied to the account. 
Canceled: Payment canceled.`
        ]
      },
      {
        name: 'IPB0001_30',
        sqlAlias: 'IPB0001_30',
        notes: [
          'Payments Received section is present and correct',
          'The payments received entries in the Payments Received section are present and correct based on the payments listed in ORMB.',
          `“N/A” if only one payment was received.

The payments received (and total) should equal the payments received listed under the Premium Charges section.`
        ]
      },
      {
        name: 'IPB0001_42',
        sqlAlias: 'IPB0001_42',
        notes: [
          'Current Month Charges are present and correct',
          'The Current month charges in the Premium Charges section are present and correct based on the sum of all active plans for the Subscriber. The charges will include medical premiums, dental premiums, federal subsidies, and state subsidies, if applicable.',
          `Verify via the Membership page.
=> Customer 360 Information page => Person tab => Person Hierarchy zone
=> Select the applicable Membership entry in the Hierarchy table 
=> Membership page => Contracts and Charges tab => Billable Charges zone => refer to the Start Date, End Date, Price Item Information, and Amount columns

Verify the correctness of the premium by comparing the premium amounts from the Exchange and the NRT. If they do not match, mark the TE, "No".
=> Broadcast the entry with the applicable Start and End dates => Billable Charge Timeline Details => Broadcast the entry with the applicable Start and End dates:

Pricing Calculation Details: Contains the total premium for the household. The data comes from the Exchange via the 834 file. Note: The value will be the same as the value in the Billable Charges zone.

Legacy Pricing Calculation Details: Contains the individual premiums per member. The data comes from the NRT.`
        ]
      },
      {
        name: 'IPB0001_28',
        sqlAlias: 'IPB0001_28',
        notes: [
          'Adjustments are present and correct',
          'The Adjustments in the Premium Charges section are present and are correct based on any corrections or changes made prior to the generation of this invoice.',
          `Verify via the Adjustment page.
=> Dashboard |Current Context zone 
=> Click on the Account Context drop-down arrow (second drop-down arrow)
=> Click on Go To Adjustment => => Click Search => Select the applicable adjustments since the last bill was generated
=> Adjustment page`
        ]
      },
      {
        name: 'IPB0001_31',
        sqlAlias: 'IPB0001_31',
        notes: [
          'Retroactive Subsidies section is present and correct',
          'The subsidies (federal and state) applied retroactively are present and correct in the Retroactive Subsidies section.',
          `"N/A" if less than three (3) retroactive subsidies were received.

Verify via the Contract Financial History page.
Dashboard => Current Context zone 
=> Click on the Account Context drop-down arrow (second drop-down arrow) 
=> Click on Go to Contract Financial History 
=> Click on the applicable Active Contract Type
=> Contract Financial History page`
        ]
      },
      {
        name: 'IPB0001_43',
        sqlAlias: 'IPB0001_43',
        notes: [
          'Subtotal is present and correct',
          'The Subtotal in the Premium Charges section is present and correct based on the sum of the prior month\'s balance, payments received and rejected, current month premiums, and subsidies.',
          ''
        ]
      },
      {
        name: 'IPB0001_14',
        sqlAlias: 'IPB0001_14',
        notes: [
          'Autopay enrollment status is correct',
          'The Autopay enrollment status is present and correct based on the Subscriber\'s profile in ORMB.',
          `"N/A" if subscriber was not enrolled in autopay at the time the invoice was generated.

Verify via the Account page.
=>Dashboard | Current Context zone 
=> Click on the Account Information hyperlink 
=> Account page |Auto Pay tab`
        ]
      },
      {
        name: 'IPB0001_18',
        sqlAlias: 'IPB0001_18',
        notes: [
          'Payment due verbiage and date are present and correct',
          `The payment due verbiage and date are present and correct based on the account's status in ORMB at the time the invoice was generated.

If not past due:
"Payment due by:" MM/DD/YYYY

If past due: 
"Payment due now" and "This total includes an amount that's past due"`,
          `Due Date:
MD: First day of the coverage month
All other jurisdictions: Last day of the month prior to coverage month.`
        ]
      },
      {
        name: 'IPB0001_4',
        sqlAlias: 'IPB0001_4',
        notes: [
          'Month and Year of the Premium statement are present and correct',
          'The Federal Segregation of Funds Notice is present and correct.',
          `"N/A" if the LOB is KPIF Off Exchange.

"N/A" if the jurisdiction is Georgia (GA).

"N/A" if the invoice is not for the January premium.`
        ]
      },
      {
        name: 'IPB0001_5',
        sqlAlias: 'IPB0001_5',
        notes: [
          'Statement Date is correct',
          'The Statement Date is correct based on the Bill Date in ORMB.',
          `Date Format: 
MM/DD/YYYY

Verify via the Bill page.
=> Dashboard | Current Context zone 
=> Click on the Account Context drop-down arrow (second drop-down arrow)
=> Click on Go To Bill 
=> Select Search 
=> Click on the applicable Bill ID (Invoice Number)
=> Bill page | Main tab | Bill Date`
        ]
      },
      {
        "name": "Compare Values",
        "sqlAlias": "COMPARE_VALUES",
        "notes": [
          'Populated when a mismatch is found',
          'Contains a Key/Value pair list of the fields that were compared for each IPB and the root values used in the comparison',
          'Note that some root comparison values can be visibly different, but still match. Example: N/A represents null, but would still be considered equal to 0 in some cases'
        ]
      }
    ],
  },
};
