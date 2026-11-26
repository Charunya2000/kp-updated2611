# Creating test case data for the recent updates to detailed design
Suppose we have this record:

KP_MRN = 110094535259
COVERAGE_START_DATE = 19950301
COVERAGE_END_DATE = 19961201
MBRSHP_EFF_STRT_DT = 01-MAR-95
FIRST_NAME = IDOLYNN
LAST_NAME = NARDENE
MEMBER_SSN = 379114706
MEMBER_GENDER = MALE
RELATIONSHIP_CODE = SUBSCRIBER
PLAN_CODE = 377
ANNUITANT_NUMBER = <EMPTY>
PAYROLL_OFFICE_NUMBER = <EMPTY>
MEMBER_DECEASED = N
SUBSCRIBER_DECEASED = N
MEMBER_AGE = 53
NOT_DISABLED = <EMPTY>
SUBSCRIBER_SSN = 379114706
EXCEPTION_FLAG = <EMPTY>
MEMBER_BIRTH_DATE = 19730501
MEMBER_DECEASED_DATE = <EMPTY>

We want to create tests RCNO rows that we can test on the diagnostic page to verify the app is now working correctly with the updated detailed design - please create a new markdown file with easily copyable single test rcno rows to validate the new detailed design -- put that new markdow file here: docs\rcnoa