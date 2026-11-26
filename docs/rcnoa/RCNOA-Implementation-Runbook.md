# RCNOA Implementation Runbook

## Implementation status

The RCNOA control plane and processing pipeline are implemented at:

- page: `/{teamName}/admin/rcnoa`
- API: `/api/{teamName}/{assistantName}/rcnoa/...`
- approved team: `reconciliation-notice-processing`
- approved assistant: `rcno-rcna-834`
- permission: `admin.rcnoa.processing.manage`

The team slug was corrected from the historical misspelling `reconciliation-notice-procesing` to `reconciliation-notice-processing`. Before deploying this correction to an environment containing RCNOA data, rename or recreate the team metadata and memberships under the corrected slug and migrate the `user_collection` documents from `team-reconciliation-notice-procesing-db` to `team-reconciliation-notice-processing-db`. The application does not automatically read or migrate the legacy database.

Implemented capabilities:

- protected administration page and navigation;
- schedule editing for daily and selected-weekday Eastern schedules;
- ad hoc direct-to-Blob upload and queued processing;
- controlled ad hoc mock processing from paired, server-owned RCNO and database-response fixtures;
- run history, progress, filters, row failures, retries, and temporary downloads;
- versioned business/transformation and Oracle-query configuration through a dedicated administration tab;
- team-scoped Mongo schedules, runs, row failures, artifacts, and prior-RCNA history;
- EPDS and MDW Oracle lookup adapters;
- row-isolated RCNO-to-RCNA processing;
- RCNA artifact generation followed by business review;
- explicit 834 generation from a generated or uploaded RCNA file;
- explicit outbound SFTP delivery of an uploaded 834 file;
- privacy-preserving prior-RCNA equality keys using HMAC-SHA256;
- enterprise-scheduler bearer-token trigger and atomic queue claims;
- SFTP host verification, deterministic input selection, Blob staging, atomic output rename, and input archive; and
- explicit production-readiness gating.

The page can be deployed before activation. Processing records `CONFIGURATION_BLOCKED` until every required property and approval flag is present.

### Ad hoc application test

Ad hoc testing is performed entirely from the RCNOA admin page and does not require the scheduler, SFTP, scheduler token, or standalone worker command:

1. Confirm the page shows no **Ad hoc processing is blocked** warning.
2. Select **Upload RCNO** and choose a conforming RCNO file. The app uploads it to Blob Storage and creates a queued ad hoc run.
3. Select **Process queued**. The permission-protected application endpoint claims one queued ad hoc run and processes it in the request.
4. Expand the run in **Run history** and download the RCNA or error-report artifact.
5. Review the RCNA file, then select **Generate 834** on the run. The generated 834 is staged as a downloadable artifact.

The **Manual file actions** area also supports uploading a separate RCNA file for conversion to 834 and uploading an existing 834 file for atomic delivery to the outbound SFTP folder.

The in-app action never claims scheduled runs and never invokes SFTP delivery. Keep the schedule disabled during ad hoc testing. Large production files should use the durable worker model because application request timeouts may interrupt synchronous processing.

### Predefined mock test mode

Mock mode is intended for lower non-production environments where EPDS and MDW do not contain a stable cross-system population for deterministic business-rule tests. It replaces only the lookup inputs; the application still runs the production RCNO parser, RCNO-to-RCNA rules, and RCNA serializer. Every fixture pauses after RCNA generation. An authorized user may then invoke the same explicit 834 generation action used by live runs.

Enable the catalog in a deployed lower environment with:

```text
RCNOA_MOCK_FIXTURES_ENABLED=true
```

Development and test processes enable the catalog automatically. Do not set this property in production. Mock mode is available only for ad hoc runs and can never be selected by scheduled processing.

To run a predefined test:

1. Open **Operations** and select **Predefined mock** in the ad hoc source control.
2. Choose one entry from **Predefined test file**. The UI does not expose a local file picker in this mode.
3. Select **Queue test**. The server stages the manifest-owned RCNO file and associates its same-stem mock response with the run.
4. Select **Process queued**.
5. Expand the run marked **mock** in **Run history**. Confirm the fixture ID/version, status, and artifact counts, then download the available artifacts.
6. For a focused fixture, compare the RCNA code with the expected rule/code, select **Generate 834**, and inspect the resulting artifact. The configured 834 intent map must contain the fixture's expected RCNA code or generation will fail as designed.
7. For a broad fixture labeled **RCNA only**, compare every RCNA row with the paired JSON `expectedRows`. Generate an 834 only when the reviewed rows have compatible approved intents.

### MDW query batch size

The **Configuration** tab stores `mdwSsnBatchSize` with the EPDS and MDW SQL in the versioned MongoDB query-configuration document. It controls the maximum number of unique member SSNs placed in `:ssnsJson` for each MDW query. The allowed range is 1 through 5000 and the default is 300. It is not loaded from KP Config or `configActions`.

Mock runs bypass EPDS, MDW, and Mongo prior-RCNA reads. They also do not save generated prior-RCNA history, preventing synthetic records from contaminating later live tests. A run stores the fixture ID, version, and SHA-256 checksum. Processing or retry fails if the paired files change after that run was queued.

Fixtures are stored in `docs/rcnoa/testFiles` as an allowlisted set:

```text
manifest.json
<fixture-id>.rcno
<fixture-id>.mock.json
```

The RCNO file contains ordinary 73-column input rows. Its paired JSON contains a fixed `businessDate`, positional `membershipRecords`, `recent834Records`, `priorRcnaRecords`, and expected rule/code metadata. Multi-row fixtures include ordered `expectedRows`, `ruleFamily`, and `rcnaOnly` metadata. The API accepts only a fixture ID present in `manifest.json`; it never accepts a client-supplied path or independently selected mock JSON file.

The ten focused fixtures cover `A100`, `B200`, `F13000`, `F14000`, `I4000`, `I5000`, `I6000`, `I7000`, `N0000`, and `N12000`. Five broad fixtures collectively cover all 51 ordered rules: 2 A/B rows, 15 F rows, 7 I rows, 22 N rows, and 5 fallback rows. All values are synthetic. Regenerate and verify the catalog after changing its definitions:

```powershell
npm run generate-rcnoa-mock-fixtures
npm test -- --runInBand app/services/rcnoa/__tests__/rcnoaMockFixtureService.test.js
```

To add a broad-coverage scenario, add its concrete positional definition to `scripts/rcnoaMockScenarioDefinitions.mjs`, including its catalog ID, expected rule, and code, then regenerate. The generator executes the real `RcnoToRcnaService` with each family's shared lookups and stops if a fixture selects an unexpected outcome or the 51-case catalog has a gap or duplicate. Commit the generator change, manifest, RCNO file, and paired mock JSON together.

## Creating database-grounded RCNO test files

EPDS and MDW can identify non-production records that support realistic RCNO tests, but neither database is an authoritative RCNO source. An RCNO row contains paired PSHBS and MENR values plus OPM comparison results. The queries below therefore discover candidate lookup records; they do not directly generate the 73-column RCNO file.

Run these statements only through approved read-only database accounts in an authorized non-production environment. The results contain protected member information. Keep extracts in an approved encrypted location, do not paste raw rows into tickets or chat, and delete temporary extracts according to the test-data handling policy. Share only masked identifiers, candidate classifications, expected rules, counts, and sanitized errors when asking for assistance.

### Choose one business date

Use one `YYYYMMDD` business date for candidate discovery, RCNO assembly, and the test run. The application currently calculates the processing business date from the UTC calendar date when **Process queued** is selected. For a same-day test, replace `20260810` in all three statements below with that UTC date.

These are manual discovery statements. Do not paste them into the admin page's Oracle query editors: the runtime EPDS and MDW queries must retain their exact four- and 19-column positional contracts and `:businessDate` bind. Do not store selected SSNs, MRNs, names, or other PII as SQL literals in MongoDB configuration.

### EPDS status-domain check

Run this first. It confirms the actual `FILE_TYPE` and `BATCH_RUN.STATUS_CODE` values present in the intended 30-day window. The runtime query currently assumes file type `834` and successful status `SUCCESS`; do not reinterpret other status values without EPDS owner confirmation.

```sql
WITH params AS (
  SELECT TO_TIMESTAMP('20260810', 'YYYYMMDD') AS business_timestamp
  FROM dual
)
SELECT
  UPPER(TRIM(file_info.FILE_TYPE)) AS file_type,
  UPPER(TRIM(batch.STATUS_CODE)) AS batch_status_code,
  COUNT(*) AS file_count,
  MIN(file_info.INTERCHANGE_TIMESTAMP) AS first_interchange_timestamp,
  MAX(file_info.INTERCHANGE_TIMESTAMP) AS last_interchange_timestamp
FROM RAWDATA_OWNER.FILE_INFO file_info
JOIN RAWDATA_OWNER.BATCH_RUN batch
  ON batch.BATCH_IK = file_info.BATCH_IK
 AND batch.SOURCE_FILE_NAME = file_info.SOURCE_FILE_NAME
CROSS JOIN params
WHERE file_info.INTERCHANGE_TIMESTAMP >= params.business_timestamp - INTERVAL '30' DAY
  AND file_info.INTERCHANGE_TIMESTAMP < params.business_timestamp
GROUP BY
  UPPER(TRIM(file_info.FILE_TYPE)),
  UPPER(TRIM(batch.STATUS_CODE))
ORDER BY file_type, batch_status_code;
```

Record the observed domain values in the test worksheet. If they differ from the assumptions, stop and obtain the approved mapping before changing the Mongo-managed EPDS runtime query.

### EPDS recent-834 candidate query

This query returns up to 25 processed and 25 unprocessed candidate rows, stratified by `Y`/`N`. It retains source identifiers for traceability but returns the same four business values consumed by the application. `processed` is still based on the provisional `SUCCESS` assumption confirmed by the preceding query.

```sql
WITH params AS (
  SELECT TO_TIMESTAMP('20260810', 'YYYYMMDD') AS business_timestamp
  FROM dual
),
base_candidates AS (
  SELECT DISTINCT
    file_info.SOURCE_FILE_NAME,
    file_info.INTERCHANGE_TIMESTAMP,
    file_info.REGION_CODE,
    file_info.INTERCHANGE_CONTROL_NUMBER,
    coverage.TRANSACTIONSET_CONTROL_NUMBER,
    coverage_member.HEALTH_COVERAGE_MEMBER_IK,
    UPPER(TRIM(batch.STATUS_CODE)) AS batch_status_code,
    demographics.SSN AS member_or_subscriber_ssn,
    TO_CHAR(coverage_member.EFFECTIVE_START_DATE, 'YYYYMMDD') AS coverage_start_date,
    TO_CHAR(coverage_member.EFFECTIVE_END_DATE, 'YYYYMMDD') AS coverage_end_date,
    CASE
      WHEN UPPER(TRIM(batch.STATUS_CODE)) = 'SUCCESS' THEN 'Y'
      ELSE 'N'
    END AS processed
  FROM RAWDATA_OWNER.FILE_INFO file_info
  JOIN RAWDATA_OWNER.BATCH_RUN batch
    ON batch.BATCH_IK = file_info.BATCH_IK
   AND batch.SOURCE_FILE_NAME = file_info.SOURCE_FILE_NAME
  JOIN RAWDATA_OWNER.HEALTH_COVERAGE coverage
    ON coverage.REGION_CODE = file_info.REGION_CODE
   AND coverage.INTERCHANGE_CONTROL_NUMBER = file_info.INTERCHANGE_CONTROL_NUMBER
   AND coverage.SOURCE_FILE_NAME = file_info.SOURCE_FILE_NAME
  JOIN RAWDATA_OWNER.HEALTH_COVERAGE_MEMBER coverage_member
    ON coverage_member.REGION_CODE = coverage.REGION_CODE
   AND coverage_member.INTERCHANGE_CONTROL_NUMBER = coverage.INTERCHANGE_CONTROL_NUMBER
   AND coverage_member.TRANSACTIONSET_CONTROL_NUMBER = coverage.TRANSACTIONSET_CONTROL_NUMBER
   AND coverage_member.SOURCE_FILE_NAME = coverage.SOURCE_FILE_NAME
  JOIN RAWDATA_OWNER.MEMBER_DEMOGRAPHICS demographics
    ON demographics.REGION_CODE = coverage_member.REGION_CODE
   AND demographics.INTERCHANGE_CONTROL_NUMBER = coverage_member.INTERCHANGE_CONTROL_NUMBER
   AND demographics.TRANSACTIONSET_CONTROL_NUMBER = coverage_member.TRANSACTIONSET_CONTROL_NUMBER
   AND demographics.HEALTH_COVERAGE_MEMBER_IK = coverage_member.HEALTH_COVERAGE_MEMBER_IK
   AND demographics.SOURCE_FILE_NAME = coverage_member.SOURCE_FILE_NAME
  CROSS JOIN params
  WHERE UPPER(TRIM(file_info.FILE_TYPE)) = '834'
    AND file_info.INTERCHANGE_TIMESTAMP >= params.business_timestamp - INTERVAL '30' DAY
    AND file_info.INTERCHANGE_TIMESTAMP < params.business_timestamp
    AND demographics.SSN IS NOT NULL
    AND coverage_member.EFFECTIVE_START_DATE IS NOT NULL
),
ranked_candidates AS (
  SELECT
    base_candidates.*,
    ROW_NUMBER() OVER (
      PARTITION BY processed
      ORDER BY interchange_timestamp DESC, source_file_name, health_coverage_member_ik
    ) AS sample_rank
  FROM base_candidates
)
SELECT
  source_file_name,
  interchange_timestamp,
  region_code,
  interchange_control_number,
  transactionset_control_number,
  health_coverage_member_ik,
  batch_status_code,
  member_or_subscriber_ssn,
  coverage_start_date,
  coverage_end_date,
  processed
FROM ranked_candidates
WHERE sample_rank <= 25
ORDER BY processed DESC, sample_rank;
```

Select at least one `Y` and one `N` candidate when both states are available. Keep each candidate's SSN, start date, and end date together; those three values must exactly match the corresponding RCNO fields for recent-834 rules to fire.

### MDW membership candidate query

This query returns the exact 19 business columns consumed by the application plus trace columns and an `ACTIVE`/`INACTIVE` classification. It samples up to 25 rows per activity and subscriber/dependent class.

To investigate one EPDS candidate, set `candidate_ssn` in the `params` CTE to that SSN. Leave it as `NULL` for a stratified general sample. Supplying a literal may put PII in SQL history; use an approved bind-variable equivalent when the SQL client supports it.

```sql
WITH params AS (
  SELECT
    TO_DATE('20260810', 'YYYYMMDD') AS business_date,
    CAST(NULL AS VARCHAR2(9)) AS candidate_ssn
  FROM dual
),
person_death AS (
  SELECT
    PRSN_IK,
    MAX(DEATH_DT) AS DEATH_DT
  FROM MDW2_V.PRSN_DEATH_CRNT
  GROUP BY PRSN_IK
),
base_candidates AS (
  SELECT
    membership.LNE_NB AS membership_line_number,
    membership.PRSN_IK AS member_person_key,
    membership.SBSCRB_PRSN_IK AS subscriber_person_key,
    CASE
      WHEN membership.PRSN_IK = membership.SBSCRB_PRSN_IK THEN 'SUBSCRIBER'
      ELSE 'DEPENDENT'
    END AS member_role,
    CASE
      WHEN membership.MBRSHP_EFF_STRT_DT <= params.business_date
       AND (
         membership.MBRSHP_EFF_END_DT IS NULL
         OR membership.MBRSHP_EFF_END_DT >= params.business_date
       ) THEN 'ACTIVE'
      ELSE 'INACTIVE'
    END AS coverage_activity,
    member_person.MRN_NB AS kp_mrn,                                           -- 1
    TO_CHAR(membership.MBRSHP_EFF_STRT_DT, 'YYYYMMDD')                       -- 2
      AS coverage_start_date,
    TO_CHAR(membership.MBRSHP_EFF_END_DT, 'YYYYMMDD')                        -- 3
      AS coverage_end_date,
    member_person.FRST_NM AS first_name,                                      -- 4
    member_person.LST_NM AS last_name,                                        -- 5
    member_person.SSN_NB AS member_ssn,                                       -- 6
    NVL(member_person.GNDR_CD, 'U') AS member_gender,                         -- 7
    membership.REL_TO_SBSCRB_CD AS relationship_code,                        -- 8
    coverage.SRC_SYS_KEY_3_TX AS plan_code,                                   -- 9
    CAST(NULL AS VARCHAR2(50)) AS annuitant_number,                           -- 10
    CAST(NULL AS VARCHAR2(50)) AS payroll_office_number,                      -- 11
    CASE WHEN member_death.DEATH_DT IS NULL THEN 'N' ELSE 'Y' END             -- 12
      AS member_deceased,
    CASE WHEN subscriber_death.DEATH_DT IS NULL THEN 'N' ELSE 'Y' END         -- 13
      AS subscriber_deceased,
    TRUNC(MONTHS_BETWEEN(params.business_date, member_person.BRTH_DT) / 12)   -- 14
      AS member_age,
    CAST(NULL AS VARCHAR2(1)) AS not_disabled,                                -- 15
    subscriber_person.SSN_NB AS subscriber_ssn,                               -- 16
    CAST(NULL AS VARCHAR2(1)) AS exception_flag,                              -- 17
    TO_CHAR(member_person.BRTH_DT, 'YYYYMMDD') AS member_birth_date,          -- 18
    TO_CHAR(member_death.DEATH_DT, 'YYYYMMDD') AS member_deceased_date        -- 19
  FROM MDW2_V.MBRSHP_CRNT membership
  JOIN MDW2_V.PRSN_CRNT member_person
    ON member_person.PRSN_IK = membership.PRSN_IK
  JOIN MDW2_V.PRSN_CRNT subscriber_person
    ON subscriber_person.PRSN_IK = membership.SBSCRB_PRSN_IK
  JOIN MDW2_V.MBRSHP_CVRG_OPTN_CRNT coverage
    ON coverage.PRSN_IK = membership.PRSN_IK
   AND coverage.RGN_CD = membership.RGN_CD
   AND coverage.MBRSHP_LNE_NB = membership.LNE_NB
  LEFT JOIN person_death member_death
    ON member_death.PRSN_IK = member_person.PRSN_IK
  LEFT JOIN person_death subscriber_death
    ON subscriber_death.PRSN_IK = subscriber_person.PRSN_IK
  CROSS JOIN params
  WHERE member_person.MRN_NB IS NOT NULL
    AND member_person.FRST_NM IS NOT NULL
    AND member_person.LST_NM IS NOT NULL
    AND subscriber_person.SSN_NB IS NOT NULL
    AND membership.MBRSHP_EFF_STRT_DT IS NOT NULL
    AND (
      params.candidate_ssn IS NULL
      OR member_person.SSN_NB = params.candidate_ssn
      OR subscriber_person.SSN_NB = params.candidate_ssn
    )
),
ranked_candidates AS (
  SELECT
    base_candidates.*,
    ROW_NUMBER() OVER (
      PARTITION BY coverage_activity, member_role
      ORDER BY coverage_start_date DESC, membership_line_number
    ) AS sample_rank
  FROM base_candidates
)
SELECT
  membership_line_number,
  member_person_key,
  subscriber_person_key,
  member_role,
  coverage_activity,
  kp_mrn,
  coverage_start_date,
  coverage_end_date,
  first_name,
  last_name,
  member_ssn,
  member_gender,
  relationship_code,
  plan_code,
  annuitant_number,
  payroll_office_number,
  member_deceased,
  subscriber_deceased,
  member_age,
  not_disabled,
  subscriber_ssn,
  exception_flag,
  member_birth_date,
  member_deceased_date
FROM ranked_candidates
WHERE sample_rank <= 25
ORDER BY coverage_activity, member_role, sample_rank;
```

The `NULL` placeholders are intentional. The current design has no approved MDW physical mappings for plan code, annuitant number, payroll office, disability, or exception flag. Do not infer those values. Source them from an approved system or leave them blank and avoid test scenarios whose predicates require them. Address fields are also not supplied by this query because their authoritative MDW mapping remains unresolved.

Before the first in-app run, review the execution plans and expected row counts of the separate runtime queries with the database owners. The application currently loads the complete result of each runtime lookup query for the business date; reducing the RCNO test file to one row does not reduce Oracle lookup volume. Stop if either runtime query is expected to exceed the application request duration or approved non-production query limits.

### Candidate scenario matrix

Start with a small file containing one independently understood row per scenario. Earlier rules take precedence, so avoid introducing unrelated discrepancies.

| Scenario | Candidate evidence | Required RCNO alignment | Expected rule |
|---|---|---|---|
| Baseline match | A complete non-production identity | Column 4 = `M`; populate all fields required by the configured 834 mapping | `A100` / `MM` |
| Processed 834 with active coverage | EPDS `Y` candidate plus matching active MDW subscriber | Column 4 = `I`; RCNO columns 12/15 match MDW last/first name; column 23 matches MDW subscriber SSN; MENR dates in columns 30/33 match EPDS dates | `I4000` / `AC500` |
| Processed 834 without active coverage | EPDS `Y` candidate plus matching inactive MDW subscriber | Same alignment as above | `I5000` / `CE500` |
| Unprocessed 834 with active coverage | EPDS `N` candidate plus matching active MDW subscriber | Same alignment as above | `I6000` / `AC501` |
| Unprocessed 834 without active coverage | EPDS `N` candidate plus matching inactive MDW subscriber | Same alignment as above | `I7000` / `CE501` |
| Missing membership | A deliberately nonexistent synthetic MRN | Column 4 = `N`; column 6 contains the synthetic MRN | `N0000` / `KICKO` |

For I-family scenarios, I1-I3 run before I4-I7. The selected dates must therefore avoid satisfying I1, and an exact recent-834 date match must exist so I2/I3 do not win first. Before including any scenario, verify that its expected RCNA code has an entry in the admin page's 834 intent map; the current pipeline attempts 834 generation for every successfully transformed row.

### Full collaborative procedure

1. **You: define the test charter.** Choose a business date, target rules, expected RCNA codes, maximum row count, authorized non-production systems, and the approved location for temporary PII-bearing extracts.
2. **You: verify configuration.** Open the RCNOA admin page, confirm no ad hoc readiness warning, inspect the current EPDS/MDW runtime SQL, and confirm the envelope, relationship map, intent map, address behavior, and match-key secret are set.
3. **You: confirm EPDS domains.** Run the status-domain query and record only the observed file/status codes and counts in the test worksheet. Resolve unexpected domain values with the EPDS owner.
4. **You: collect EPDS candidates.** Run the stratified EPDS query and retain the complete trace identifiers with each selected SSN/date/status tuple in the protected worksheet.
5. **You: collect MDW candidates.** Run the MDW query first as a stratified sample, then with the optional SSN filter for selected EPDS identities. Retain membership and person keys for traceability.
6. **You: choose deterministic intersections.** Select rows that satisfy one scenario's predicate and do not accidentally satisfy an earlier rule. If EPDS and MDW have no suitable cross-system identity/date intersection, record that gap and use a different scenario; do not alter database evidence to force a match.
7. **You: source missing RCNO fields.** Obtain PSHBS-side values, MENR-side values, plan, address, and other fields absent from these queries from an approved non-production source. Never invent a production-like identity. Controlled synthetic values may be used only where the scenario intentionally requires a non-match and the value cannot match a real person.
8. **You: build a 73-column worksheet.** Use the data dictionary in `RCNO-RCNA-834-Detailed-Design.md`, Section 7. Keep one numbered column per RCNO position. Populate column 1 with the approved detail record type, then all 24 PSHBS/MENR/result triplets. Dates use `YYYYMMDD`; SSNs remain nine-character strings; result columns use the approved comparison values.
9. **You: document intentional mutations.** For every row, record the source trace keys, changed RCNO columns, reason for each change, expected rule, expected priority/code, and whether 834 generation is expected to succeed. This worksheet is the test oracle and must stay with the protected test evidence.
10. **You: export the RCNO file.** Export only data rows as UTF-8 text joined by `|`, with no header, trailer, quoting, or embedded pipe characters. Give the file a `.rcno` extension.
11. **You: validate structure locally.** Confirm every nonblank line has exactly 73 fields before upload. A PowerShell structural check is:

    ```powershell
    $lineNumber = 0
    Get-Content .\rcnoa-test.rcno | ForEach-Object {
      $lineNumber += 1
      $fieldCount = ($_ -split '\|', -1).Count
      [PSCustomObject]@{ Line = $lineNumber; Fields = $fieldCount; Valid = $fieldCount -eq 73 }
    }
    ```

12. **You and I: review safely before execution.** You may provide the scenario names, expected rules, column numbers changed, field counts, and fully masked identifiers. I can review rule precedence, file structure, and expected outcomes. Do not provide raw names, dates of birth, addresses, MRNs, SSNs, database keys, or complete file rows.
13. **You: run the in-app test.** Keep scheduling disabled, select **Upload RCNO**, choose the file, verify the queued run, and select **Process queued**. Start with one to four rows to stay well within the application request duration.
14. **You: collect results.** Record the run ID and status. Download the RCNA, 834, and error report as applicable. Keep artifacts in the approved test-evidence location.
15. **You and I: compare actual to expected.** Share sanitized rule IDs, output codes, row counts, and error codes. I can trace discrepancies against rule precedence and implementation without receiving PII.
16. **You: reconcile back to source.** Use the protected worksheet's EPDS and MDW trace identifiers to verify that the application used the intended candidates and business date.
17. **You: clean up.** Remove temporary query exports and RCNO/RCNA/834 files according to policy, retaining only approved evidence. Record unresolved mappings or data gaps before expanding the scenario set.

Do not begin with a broad production-sized file. The first successful cycle should prove one candidate and one expected rule end to end; add scenarios incrementally after the RCNA and 834 outputs are understood.

## Runtime configuration

Infrastructure and transport properties are server-only and should be populated by `.env.local` or KPConfig. Business/transformation values are maintained in MongoDB through the protected RCNOA admin page. Never expose or log connection or secret values.

### Mock fixtures

```text
RCNOA_MOCK_FIXTURES_ENABLED=true
```

This lower-environment-only switch exposes the predefined fixture catalog in the admin UI. It does not permit arbitrary mock-response upload and does not affect scheduled processing.

### Oracle

```text
RCNOA_EPDS_JDBC_URL
RCNOA_EPDS_USERNAME
RCNOA_EPDS_PASSWORD

RCNOA_MDW_JDBC_URL
RCNOA_MDW_USERNAME
RCNOA_MDW_PASSWORD
```

The JDBC URL is normalized by removing `jdbc:oracle:thin:@` before it is passed to the Node Oracle driver.

The EPDS and MDW SQL statements are stored in the team MongoDB as the versioned `RcnoaQueryConfiguration` document. The document is seeded with the approved design queries when the RCNOA admin state is first loaded. Administrators with `admin.rcnoa.processing.manage` permission edit both statements under **Oracle lookup queries** on the RCNOA admin page. Saving takes effect for new runs without a build or deployment; a run already executing keeps the statements it loaded when its Oracle lookups began.

Queries must be one read-only `SELECT` or `WITH` statement and must use the bind variable `:businessDate` in `YYYYMMDD` format. Other bind names, multiple statements, and mutating SQL are rejected. The Oracle users must also have read-only database privileges because application validation cannot prevent side effects from a database function invoked by a `SELECT`.

The EPDS query must return columns in this order:

1. subscriber SSN
2. coverage start date
3. coverage end date
4. processed indicator

The MDW query must return columns in this order:

1. MRN
2. coverage start date
3. coverage end date
4. first name
5. last name
6. member SSN
7. gender
8. relationship
9. plan code
10. annuitant
11. payroll office
12. member deceased indicator
13. subscriber deceased indicator
14. member age
15. not-disabled indicator
16. subscriber SSN
17. exception flag
18. birth date
19. deceased date

Dates returned to the transformation must use `YYYYMMDD`.

### SFTP

```text
RCNOA_REMOTE_SERVER
RCNOA_REMOTE_PORT=22
RCNOA_REMOTE_FOLDER
RCNOA_REMOTE_OUTPUT_FOLDER
RCNOA_REMOTE_ARCHIVE_FOLDER
RCNOA_USERNAME
RCNOA_PASSWORD
RCNOA_SFTP_HOST_KEY_SHA256
RCNOA_INBOUND_FILE_PATTERN=^(?:TST_)?(?:PSHB|FEHB)_[A-Z0-9]{4}_RCNO_\d{8}_\d{8}_\d{8}\.txt\.pgp$
```

`RCNOA_INBOUND_FILE_PATTERN` is optional; the value shown is the application default. Override it only when the transfer partner requires a narrower program or carrier expression. `RCNOA_SFTP_HOST_KEY_SHA256` is mandatory. Output files are uploaded under a temporary `.uploading` name and atomically renamed. Input is moved to the archive folder only after required output delivery succeeds.

### Fixed file contracts

RCNO input and RCNA output are always UTF-8, pipe (`|`) delimited, and contain data rows only, with no header or trailer rows. RCNO input rows contain exactly 73 columns; outbound RCNA rows contain exactly 76 columns and use CRLF line endings. Embedded pipes and quoted-field escaping are not supported.

These are interface specifications, not environment or admin-page settings. The 834 is independently serialized as an X12 transaction using its ISA/GS/ST envelope and X12 delimiter rules.

### Transformation and X12

Administrators with `admin.rcnoa.processing.manage` maintain the following under **Configuration > Business and transformation**:

- N12 code, defaulting to the approved `AE999`;
- 834 envelope JSON;
- RCNA-code-to-834 intent JSON;
- relationship map JSON;
- address line 3 behavior;
- prior-RCNA match-key secret; and
- the 834-mapping approval gate.

Values are stored in the versioned `RcnoaBusinessConfiguration` Mongo document and are loaded for new processing runs without a build or deployment. When the document does not exist, first access seeds it from corresponding legacy `RCNOA_*` environment values if they are present. MongoDB is authoritative after that initial seed.

The match-key secret is write-only in the UI and API. The page reports whether one is configured; leaving its field blank preserves the existing value. A replacement must contain at least 32 characters, and rotation requires rebuilding or migrating prior-RCNA match keys.

Address line 3 handling accepts `reject` or `append-to-line2`. The latter must be approved before use because it changes address semantics.

The envelope JSON must provide the fields required by `RcnaTo834Service`, including sender and receiver qualifiers/IDs, usage indicator, control numbers, application sender/receiver codes, transaction reference, group number, sponsor, and payer.

Each entry in the intent map associates an RCNA notice code with:

```json
{
  "bgnAction": "2",
  "maintenanceType": "001",
  "maintenanceReason": "AI",
  "benefitStatus": "A",
  "coverageLevel": "FAM"
}
```

### Scheduler

```text
RCNOA_SCHEDULER_TOKEN
RCNOA_SCHEDULER_AUTH_APPROVED=false
RCNOA_WORKER_MAX_RUNS=10
```

The preferred production model is for the enterprise scheduler to launch a one-shot worker process or Kubernetes Job at a fixed heartbeat interval:

```text
npm run rcnoa-worker
```

The worker atomically enqueues a due schedule and processes up to `RCNOA_WORKER_MAX_RUNS` queued runs. Its lifetime is owned by the scheduled job rather than a Next.js request, so processing can use the job platform's timeout, restart, and monitoring controls.

For platforms that require an HTTP trigger, the protected single-work endpoint is also available:

```text
POST /api/reconciliation-notice-processing/rcno-rcna-834/rcnoa/runs/trigger
Authorization: Bearer <RCNOA_SCHEDULER_TOKEN>
```

Each HTTP invocation atomically enqueues a due schedule, skips overlap, claims at most one queued run, and advances it. Because HTTP request timeouts can interrupt large files, use the one-shot worker job for production unless the platform explicitly guarantees a sufficient request lifetime. Replace the provisional shared bearer token when the platform workload-token validation contract is available.

## Activation checklist

1. Assign `admin.rcnoa.processing.manage` through the existing role/permission administration flow.
2. Populate Oracle environment properties for ad hoc testing; add SFTP and scheduler properties before scheduled testing.
3. Confirm the EPDS and MDW query projections against the canonical column orders above.
4. Apply and verify Mongo indexes by opening the administration page or invoking the run-list API.
5. Confirm Blob retention is 90 days and Mongo operational/audit retention is seven years.
6. Validate SFTP fingerprint, input selection, archive behavior, and remote output names in a non-production folder.
7. Save the complete intent map, relationship map, X12 envelope, address behavior, and match-key secret on the admin Configuration tab after validation with the receiving trading partner.
8. Enable the 834-mapping admin-page approval gate and the scheduler environment approval flag only after their contracts are signed off.
9. Configure the enterprise scheduler to launch the one-shot worker at the approved heartbeat and monitor the first run by run ID.
10. Review logs to confirm they contain run IDs and counts but no credentials, SAS tokens, SQL values, or member data.

## Deferred question catalog

These answers are not required to deploy the disabled control plane, but they are required before production activation.

1. What 834 and error-report naming templates are required? RCNO and RCNA use the approved OPM naming contract in the detailed design.
2. What are the final inbound, outbound, and archive SFTP folders, and what host-key fingerprint is approved?
3. Which role templates or named users receive `admin.rcnoa.processing.manage` initially?
4. What platform workload-token validation replaces or fronts the provisional scheduler bearer token?
5. Is reconciliation cycle calendar month, file cycle, pay period, or another business key?
6. Which 73 RCNO fields form the canonical prior-RCNA match identity? The implementation currently hashes the normalized full 73-column prefix to preserve existing Rule B behavior.
7. What is the complete RCNA-code-to-834 intent map?
8. What are the production ISA/GS/ST envelope constants and control-number allocation rules?
9. What is the approved relationship-code map?
10. Should address line 3 be rejected, appended to line 2, or transformed by another rule?
11. Should EPDS/MDW queries read an as-of snapshot beyond the current `businessDate` bind?
12. Are 90-day Blob retention, seven-year Mongo audit retention, 100 MB upload limit, and 15-minute SAS validity accepted by records management and security?