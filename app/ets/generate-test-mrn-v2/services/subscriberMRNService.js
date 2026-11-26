import xml2js from 'xml2js';

const MRN_ENDPOINT = 'https://service-bus-qa.kp.org/hp_admn/mbr_admn/v1/member_enrollment/MemberEnrollment?envlbl=legacy';

// NCAL / SCAL (Foundation Systems) route through the UAT API gateway instead of the service bus.
const CAL_MRN_ENDPOINT = 'https://api-gtwy-uat.kp.org/hp_admn/mbr_admn/v1/member_enrollment/MemberEnrollment';

const TERMINATION_ENDPOINT = 'https://service-bus-qa.kp.org/hp_admn/mbr_admn/v1/member_termination/MemberTermination';
// No Coverage cancellations (MAS / NCAL / SCAL) terminate through the UAT API gateway.
const GATEWAY_TERMINATION_ENDPOINT = 'https://api-gtwy-uat.kp.org/hp_admn/mbr_admn/v1/member_termination/MemberTermination';
// Regions offering the user-facing "terminated" coverage timing (NCAL / SCAL not yet).
const TERMINATION_REGIONS = new Set(['CO', 'HI', 'NW', 'MAS', 'GA']);
// Region -> assigningOrganization typeId for enrollment and termination. Other regions fall back to DEFAULT_TYPE_ID.
const REGION_TYPE_ID = { CO: '16', NW: '10', GA: '28', HI: '50' };
const DEFAULT_TYPE_ID = '343535352';

function resolveTypeId(region) {
   return REGION_TYPE_ID[region] ?? DEFAULT_TYPE_ID;
}

// Region -> coverage name -> { groupId, subgroupId, billGroupId }.
// Values differ per region. NCAL and SCAL currently do NOT offer MEDICAID.
// CO and GA additionally offer MEDICARE and SELF_FUNDED (GA SELF_FUNDED is TGG1 only).
// For MAS, and GA SELF_FUNDED, coverage IDs vary per environment, so the value is nested
// by environmentName instead of being flat.
// NO_COVERAGE (Non-Member Patient / "NMP") in the Common Membership regions (NW, CO, GA, HI)
// sends literal '0' group/subgroup/bill IDs and doesSubscriberHaveCvg=No. MAS / NCAL / SCAL
// instead enroll under the HMO group and cancel it same-day — see CANCELLED_NO_COVERAGE_REGIONS.
const NO_COVERAGE = { groupId: '0', subgroupId: '0', billGroupId: '0' };
const COVERAGE_MAP = {
   NW: {
      HMO: { groupId: '19040', subgroupId: '101', billGroupId: 'AA' },
      DHMO: { groupId: '24501', subgroupId: '1', billGroupId: 'AA' },
      MEDICAID: { groupId: '19020', subgroupId: '400', billGroupId: 'AD' },
      NO_COVERAGE
   },
   GA: {
      HMO: { groupId: '3417', subgroupId: '100', billGroupId: '00' },
      DHMO: { groupId: '10768', subgroupId: '102', billGroupId: '00' },
      MEDICAID: { groupId: '7004', subgroupId: 'CSC', billGroupId: '00' },
      MEDICARE: { groupId: '403', subgroupId: '800', billGroupId: '00' },
      SELF_FUNDED: {
         TGG1: { groupId: '1104', subgroupId: '102', billGroupId: '01' }
      },
      NO_COVERAGE
   },
   CO: {
      HMO: { groupId: '11017', subgroupId: 'C03', billGroupId: '01' },
      DHMO: { groupId: '6122', subgroupId: '349', billGroupId: '01' },
      MEDICAID: { groupId: '34503', subgroupId: '300', billGroupId: '01' },
      MEDICARE: { groupId: '569', subgroupId: '062', billGroupId: '01' },
      SELF_FUNDED: { groupId: '47343', subgroupId: '001', billGroupId: '01' },
      NO_COVERAGE
   },
   HI: {
      HMO: { groupId: '12064', subgroupId: '001', billGroupId: '10' },
      DHMO: { groupId: '18932', subgroupId: '003', billGroupId: '10' },
      MEDICAID: { groupId: '5', subgroupId: '842', billGroupId: '70' },
      NO_COVERAGE
   },
   MAS: {
      HMO: {
         'CLONE D': { groupId: '26783', subgroupId: '0', billGroupId: '0' },
         'CLONE E': { groupId: '4727', subgroupId: '0', billGroupId: '0' },
         'CLONE I': { groupId: '6458', subgroupId: '114', billGroupId: '0' }
      },
      DHMO: {
         'CLONE D': { groupId: '26811', subgroupId: '1', billGroupId: '0' },
         'CLONE E': { groupId: '22989', subgroupId: '0', billGroupId: '0' },
         'CLONE I': { groupId: '24062', subgroupId: '40', billGroupId: '0' }
      },
      MEDICAID: {
         'CLONE D': { groupId: '22500', subgroupId: '0', billGroupId: '2' },
         'CLONE E': { groupId: '22500', subgroupId: '0', billGroupId: '2' },
         'CLONE I': { groupId: '22500', subgroupId: '20', billGroupId: '2' }
      }
   },
   NCAL: {
      HMO: { groupId: '850', subgroupId: '0', billGroupId: '' },
      DHMO: { groupId: '1904', subgroupId: '5', billGroupId: '' }
   },
   SCAL: {
      HMO: { groupId: '101000', subgroupId: '0', billGroupId: '' },
      DHMO: { groupId: '101828', subgroupId: '1', billGroupId: '' }
   }
};

// These regions have no NMP group: No Coverage enrolls under the HMO group, then terminates it
// with termination date == begin date. Individual subscribers only.
const CANCELLED_NO_COVERAGE_REGIONS = new Set(['MAS', 'NCAL', 'SCAL']);
for (const region of CANCELLED_NO_COVERAGE_REGIONS) {
   COVERAGE_MAP[region].NO_COVERAGE = COVERAGE_MAP[region].HMO;
}

// Region -> default address used when the caller does not supply address fields.
const REGION_DEFAULT_ADDRESS = {
   NW: { addressLine1: '2810 NW NICOLAI', city: 'PORTLAND', state: 'OR', postalCode: '97210' },
   GA: { addressLine1: '455 PHILIP BOULEVARD', city: 'LAWRENCEVILLE', state: 'GA', postalCode: '30046' },
   CO: { addressLine1: '2530 S PARKER RD', city: 'AURORA', state: 'CO', postalCode: '80014' },
   HI: { addressLine1: '515 ALAKAWA STREET', city: 'HONOLULU', state: 'HI', postalCode: '96817' },
   MAS: { addressLine1: '15109 WINSTEAD LN', city: 'SILVER SPRING', state: 'MA', postalCode: '20905' },
   NCAL: { addressLine1: '1901 ARENA BLVD', city: 'SACRAMENTO', state: 'CA', postalCode: '95834' },
   SCAL: { addressLine1: '4647 ZION AVE', city: 'SAN DIEGO', state: 'CA', postalCode: '92120' }
};

// Region name -> SOAP <regionCode><code> value written into the enrollMember XML.
// CO/HI/NW/GA send their region name as-is; MAS/NCAL/SCAL drop the trailing
// letter (MAS→MA, NCAL→NCA, SCAL→SCA). Regions absent from this map fall back
// to the region name.
const REGION_CODE = {
   MAS: 'MA',
   NCAL: 'NCA',
   SCAL: 'SCA'
};

function resolveRegionCode(region) {
   return REGION_CODE[region] || region;
}

// Returns { coverage } on success or { error } describing why the region/coverage combination is invalid.
// For MAS the coverage IDs vary per CLONE environment, so `environmentName` is required to pick
// the correct entry; for other regions the value is flat and `environmentName` is ignored.
// Uppercases and collapses separators so 'Medicare', 'medicare', and 'MEDI CARE' all
// resolve to the same COVERAGE_MAP key ('MEDICARE').
const COVERAGE_ALIASES = { NMP: 'NO_COVERAGE', NON_MEMBER_PATIENT: 'NO_COVERAGE' };

function normalizeCoverageName(coverageName) {
   const key = String(coverageName || '').trim().toUpperCase().replace(/[\s/\-]+/g, '_');
   return COVERAGE_ALIASES[key] || key;
}

function resolveRegionCoverage(region, coverageName, environmentName) {
   const normalizedName = normalizeCoverageName(coverageName);
   const regionCoverages = COVERAGE_MAP[region];
   if (!regionCoverages) {
      return { error: `Region '${region}' is not supported. Valid regions: ${Object.keys(COVERAGE_MAP).join(', ')}.` };
   }
   const entry = regionCoverages[normalizedName];
   if (!entry) {
      return { error: `Coverage '${coverageName}' is not available for region ${region}. Valid coverages for ${region}: ${Object.keys(regionCoverages).join(', ')}.` };
   }
   if (entry.groupId !== undefined) {
      return { coverage: entry };
   }
   const envCoverage = environmentName ? entry[environmentName] : null;
   if (!envCoverage && environmentName) {
      return { error: `Coverage '${coverageName}' is not available for region ${region} environment ${environmentName}. Available environments for this coverage: ${Object.keys(entry).join(', ')}.` };
   }
   if (!envCoverage) {
      return { error: `Coverage '${coverageName}' for region ${region} requires an environment. Valid environments: ${Object.keys(entry).join(', ')}.` };
   }
   return { coverage: envCoverage };
}

// Region -> valid `environment` options, grouped by upstream system.
// Each option carries both the display `environmentName` (shown in the UI /
// used for LLM selection) and the SOAP `environmentCode` written into the
// EnvironmentCode header. Regions with one option auto-fill; regions with
// multiple options require the caller to explicitly pick one.
const REGION_ENVIRONMENT_OPTIONS = {
   // Common Membership
   CO: {
      systemName: 'Common Membership', values: [
         { environmentName: 'ACG5', environmentCode: 'CM_CMSDT31_CQUAL5' }
      ]
   },
   NW: {
      systemName: 'Common Membership', values: [
         { environmentName: 'UPG6', environmentCode: 'CM_CMSDQ21_PEDUC' }
      ]
   },
   GA: {
      systemName: 'Common Membership', values: [
         { environmentName: 'TGG1', environmentCode: 'CM_CMSDQ21_GTEST' },
         { environmentName: 'TGG3', environmentCode: 'CM_CMSDT21_GUAT2' }
      ]
   },
   HI: {
      systemName: 'Common Membership', values: [
         { environmentName: 'CICSTEST', environmentCode: 'CM_CMSDSNT_HISYST' }
      ]
   },
   // KMATE TMS — all MAS CLONE environments share the same SOAP EnvironmentCode ('MA');
   // per-CLONE coverage IDs are captured in COVERAGE_MAP.MAS.
   MAS: {
      systemName: 'KMATE TMS', values: [
         { environmentName: 'CLONE D', environmentCode: 'CLONE_D' },
         { environmentName: 'CLONE E', environmentCode: 'CLONE_E' },
         { environmentName: 'CLONE I', environmentCode: 'CLONE_I' }
      ]
   },
   // Foundation Systems
   NCAL: {
      systemName: 'Foundation Systems', values: [
         { environmentName: 'B SET', environmentCode: 'QA_KPFS_BSET' },
         { environmentName: 'M SET', environmentCode: 'QA_KPFS_MSET' },
         { environmentName: 'C SET', environmentCode: 'QA_KPFS_CSET' }
      ]
   },
   SCAL: {
      systemName: 'Foundation Systems', values: [
         { environmentName: 'B SET', environmentCode: 'QA_KPFS_BSET' },
         { environmentName: 'M SET', environmentCode: 'QA_KPFS_MSET' },
         { environmentName: 'C SET', environmentCode: 'QA_KPFS_CSET' }
      ]
   }
};

// Region -> environmentName -> list of { kphcEnv, rule } options. Each Regional KPHC Env
// optionally requires a PUBSUB naming convention (prefix or suffix appended to firstName)
// to route a synthetic subscriber to that specific KPHC instance; rule is null ("No Rule")
// when no naming convention applies. Region/environment combos absent from this map have
// no KPHC env concept at all (e.g. NCAL/SCAL M SET, C SET).
const REGION_KPHC_OPTIONS = {
   CO: {
      ACG5: [
         { kphcEnv: 'TESTCO4', rule: { type: 'prefix', value: 'TFOUR' } },
         { kphcEnv: 'REGNCOB', rule: null },
         { kphcEnv: 'TESTCO5', rule: { type: 'prefix', value: 'TFIVE' } }
      ]
   },
   GA: {
      TGG1: [
         { kphcEnv: 'PSP2GAM', rule: null }
      ],
      TGG3: [
         { kphcEnv: 'TSTSGAM', rule: null },
         { kphcEnv: 'WITSGAM', rule: null }
      ]
   },
   HI: {
      CICSTEST: [
         { kphcEnv: 'REGNHIM', rule: null },
         { kphcEnv: 'REGNHIB', rule: null },
         { kphcEnv: 'RELSHIM', rule: null }
      ]
   },
   NW: {
      UPG6: [
         { kphcEnv: 'DMDLNWV', rule: { type: 'suffix', value: 'D1' } },
         { kphcEnv: 'DMDLNW2', rule: { type: 'suffix', value: 'D2' } },
         { kphcEnv: 'TESTNWM', rule: { type: 'suffix', value: 'T1' } }
      ]
   },
   MAS: {
      'CLONE D': [
         { kphcEnv: 'STSTMA2', rule: null }
      ],
      'CLONE E': [
         { kphcEnv: 'TESTMA2', rule: null }
      ],
      'CLONE I': [
         { kphcEnv: 'CLMSMAM', rule: null }
      ]
   },
   NCAL: {
      'B SET': [
         { kphcEnv: 'WITSCN3', rule: { type: 'prefix', value: 'WTHREE' } },
         { kphcEnv: 'STGNCNM', rule: { type: 'prefix', value: 'STGN' } },
         { kphcEnv: 'PSP2CNM', rule: { type: 'prefix', value: 'PSPTWO' } }
      ]
   },
   SCAL: {
      'B SET': [
         { kphcEnv: 'WITSCSM', rule: { type: 'prefix', value: 'WITS' } },
         { kphcEnv: 'TSTSCSM', rule: { type: 'prefix', value: 'TSTS' } },
         { kphcEnv: 'PSP2CSM', rule: { type: 'prefix', value: 'PSPTWO' } }
      ]
   }
};

// Returns { option } on success (option is null when the region/environment combo has no
// KPHC options defined) or { error } with a user-facing message.
function resolveKphcOption(region, environmentName, providedValue) {
   const options = REGION_KPHC_OPTIONS[region]?.[environmentName];
   if (!options) return { option: null };
   const validNames = options.map(o => o.kphcEnv);

   if (!providedValue) {
      if (options.length === 1) return { option: options[0] };
      return {
         error: `${region} ${environmentName} has multiple KPHC environments. Please specify one of: ${validNames.join(', ')}.`
      };
   }

   const normalized = String(providedValue).trim().toUpperCase();
   const match = options.find(o => o.kphcEnv.toUpperCase() === normalized);
   if (match) return { option: match };

   return {
      error: `Invalid kphcEnv '${providedValue}' for ${region} ${environmentName}. Valid options: ${validNames.join(', ')}.`
   };
}

// Applies the PUBSUB naming rule (prefix or suffix) required to route a synthetic
// subscriber to a specific Regional KPHC Env. No-op when rule is null ("No Rule").
function applyKphcRule(firstName, rule) {
   if (!rule) return firstName;
   return rule.type === 'suffix' ? `${firstName}${rule.value}` : `${rule.value}${firstName}`;
}

function formatRegionEnvironmentMapping() {
   const bySystem = {};
   for (const [region, entry] of Object.entries(REGION_ENVIRONMENT_OPTIONS)) {
      const names = entry.values.map(v => v.environmentName).join(' or ');
      (bySystem[entry.systemName] ||= []).push(`${region} → ${names}`);
   }
   return Object.entries(bySystem)
      .map(([systemName, lines]) => `${systemName}: ${lines.join(', ')}`)
      .join('; ');
}

// Returns { value } on success or { error } with a user-facing message.
function resolveRegionEnvironment(region, providedValue) {
   const entry = REGION_ENVIRONMENT_OPTIONS[region];
   if (!entry) return { value: providedValue };
   const validNames = entry.values.map(v => v.environmentName);

   if (!providedValue) {
      if (validNames.length === 1) return { value: validNames[0] };
      return {
         error: `Region ${region} has multiple ${entry.systemName} environments. Please specify one of: ${validNames.join(', ')}.`
      };
   }

   const normalized = String(providedValue).trim().toUpperCase();
   const match = entry.values.find(v => v.environmentName.toUpperCase() === normalized);
   if (match) return { value: match.environmentName };

   return {
      error: `Invalid environment '${providedValue}' for region ${region}. Valid options for ${region}: ${validNames.join(', ')}. Full mapping — ${formatRegionEnvironmentMapping()}.`
   };
}

// Returns the SOAP EnvironmentCode paired with `environmentName` under `region`.
// Falls back to the region's first configured option when no name is supplied
// or the name doesn't match. Returns null when the region itself is unknown.
function resolveEnvironmentCode(region, environmentName) {
   const entry = REGION_ENVIRONMENT_OPTIONS[region];
   if (!entry) return null;
   const match = environmentName && entry.values.find(v => v.environmentName === environmentName);
   return match?.environmentCode || entry.values?.[0]?.environmentCode || null;
}

// Default values used when a field is not provided by the user.
// Per the user's spec, most demographic fields are "system generated".
// Address defaults are region-specific — see REGION_DEFAULT_ADDRESS above.
// Environment code defaults are region-specific — see defaultRegionEnvironmentCode().
const DEFAULTS = {
   middleName: '',
   lastNamePool: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'],
   firstNamePool: ['Alex', 'Jordan', 'Taylor', 'Casey', 'Morgan', 'Riley', 'Quinn', 'Avery'],
   maritalStatus: 'Married',
   enrollmentSource: 'Member',
   enrollmentEventReasonCode: 'DPAMedicare'
};

// Age ranges (in years) used to generate a date of birth when one is not provided.
// Subscriber and Spouse share memberType 'adult' but have distinct ranges — see
// resolveAgeRangeKey. Spouse is additionally capped below the subscriber's own age
// (see generateSpouseDob), on top of the 30-40 range.
// Subscriber: 40-50, Spouse: 30-40, Teen: 14-16, Child: 7-10.
const MEMBER_TYPE_AGE_RANGE = {
   subscriber: [40, 50],
   spouse: [30, 40],
   teen: [14, 16],
   child: [7, 10]
};

// Subscriber and Spouse both use memberType 'adult'; only relation distinguishes
// which age range applies.
function resolveAgeRangeKey(memberType, relation) {
   if (memberType === 'adult') {
      return relation === 'Spouse' ? 'spouse' : 'subscriber';
   }
   return memberType;
}

function pickRandom(arr) {
   return arr[Math.floor(Math.random() * arr.length)];
}

function generateUniqueSSN() {
   const min = 100000000;
   const max = 999999999;
   return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomPhone() {
   const areaCode = String(Math.floor(Math.random() * 800) + 200); // 200-999
   const number = String(Math.floor(Math.random() * 9000000) + 1000000); // 7 digits
   return { areaCode, number };
}

function parsePhone(phone) {
   if (!phone) return generateRandomPhone();
   const digits = String(phone).replace(/\D/g, '');
   if (digits.length === 10) {
      return { areaCode: digits.slice(0, 3), number: digits.slice(3) };
   }
   if (digits.length === 11 && digits.startsWith('1')) {
      return { areaCode: digits.slice(1, 4), number: digits.slice(4) };
   }
   if (digits.length === 7) {
      return { areaCode: '000', number: digits };
   }
   return generateRandomPhone();
}

function generateRandomDob(minAge = 18, maxAge = 100) {
   const today = new Date();
   const age = Math.floor(Math.random() * (maxAge - minAge + 1)) + minAge;
   // Anchor to today's month/day `age` years ago (so the effective age equals `age`),
   // then step back a random 0-364 days to vary the birthday while staying in the same age year.
   const dob = new Date(today.getFullYear() - age, today.getMonth(), today.getDate());
   dob.setDate(dob.getDate() - Math.floor(Math.random() * 365));
   const year = dob.getFullYear();
   const month = String(dob.getMonth() + 1).padStart(2, '0');
   const day = String(dob.getDate()).padStart(2, '0');
   return `${year}-${month}-${day}`;
}

function calculateAge(dobStr) {
   const dob = new Date(dobStr);
   const today = new Date();
   let age = today.getFullYear() - dob.getFullYear();
   const monthDiff = today.getMonth() - dob.getMonth();
   if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
   }
   return age;
}

// Generates a spouse DOB within the 30-40 range that is also strictly younger
// than the subscriber (guards the rare case where both ranges overlap at 40).
function generateSpouseDob(subscriberAge) {
   const [minAge, maxAge] = MEMBER_TYPE_AGE_RANGE.spouse;
   const cappedMax = Math.max(minAge, Math.min(maxAge, subscriberAge - 1));
   return generateRandomDob(minAge, cappedMax);
}

// Converts an exact age (in years) to a YYYY-MM-DD DOB using the REAL current date,
// so callers never compute a birth year themselves (which is what caused ages to skew
// a couple of years off). Returns null for a missing/invalid age. Any birth date in
// (today−(age+1)y, today−age y] yields exactly `age` today, so we pick one at random —
// this is exact regardless of leap years.
function ageToDob(age) {
   if (age === null || age === undefined || String(age).trim() === '') return null;
   const n = Math.floor(Number(age));
   if (!Number.isFinite(n) || n < 0) return null;
   const today = new Date();
   const anchor = new Date(today.getFullYear() - n, today.getMonth(), today.getDate());
   const older = new Date(today.getFullYear() - n - 1, today.getMonth(), today.getDate());
   const spanDays = Math.round((anchor - older) / 86400000);
   anchor.setDate(anchor.getDate() - Math.floor(Math.random() * spanDays));
   const year = anchor.getFullYear();
   const month = String(anchor.getMonth() + 1).padStart(2, '0');
   const day = String(anchor.getDate()).padStart(2, '0');
   return `${year}-${month}-${day}`;
}

// Date 3 months from today, in YYYY-MM-DD, used for pre-effective
// (future-dated) coverage when the user does not supply an explicit effective date.
function preEffectiveDate() {
   const d = new Date();
   const target = new Date(d.getFullYear(), d.getMonth() + 3, d.getDate());
   const year = target.getFullYear();
   const month = String(target.getMonth() + 1).padStart(2, '0');
   const day = String(target.getDate()).padStart(2, '0');
   return `${year}-${month}-${day}`;
}

// First day of the current month, in YYYY-MM-DD — the default coverage effective
// date for active coverage (all regions) when the user does not supply one.
function currentMonthStartDate() {
   const d = new Date();
   const month = String(d.getMonth() + 1).padStart(2, '0');
   return `${d.getFullYear()}-${month}-01`;
}

function formatYmd(d) {
   return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Terminated coverage default start: first of the current month, or of the previous month
// during days 1-5 so the default end date (today - 3) still falls after it.
function terminatedDefaultStartDate() {
   const d = new Date();
   const monthOffset = d.getDate() <= 5 ? -1 : 0;
   return formatYmd(new Date(d.getFullYear(), d.getMonth() + monthOffset, 1));
}

// Today - 3 so EPIC already shows the coverage as terminated; falls back to the day after
// coverage start, since the termination date must be strictly after the coverage start date.
function defaultTerminationDate(coverageStartDate) {
   const today = new Date();
   const end = formatYmd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3));
   if (end > coverageStartDate) return end;
   const [y, m, d] = coverageStartDate.split('-').map(Number);
   return formatYmd(new Date(y, m - 1, d + 1));
}

function isFutureDate(dateStr) {
   if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) return false;
   const d = new Date();
   const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
   return dateStr > today;
}

function normalizeDate(value) {
   if (!value) return value;
   const s = String(value).trim();
   // Already YYYY-MM-DD
   if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
   // YYYY/MM/DD or YYYY.MM.DD -> YYYY-MM-DD
   const ymd = s.match(/^(\d{4})[\/.](\d{1,2})[\/.](\d{1,2})$/);
   if (ymd) {
      const [, yyyy, mm, dd] = ymd;
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
   }
   // MM/DD/YYYY or MM-DD-YYYY or M/D/YYYY -> YYYY-MM-DD
   const mdy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
   if (mdy) {
      const [, mm, dd, yyyy] = mdy;
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
   }
   return s;
}

function normalizeDob(dob, ageRangeKey) {
   if (!dob) {
      const [minAge, maxAge] = MEMBER_TYPE_AGE_RANGE[ageRangeKey] || MEMBER_TYPE_AGE_RANGE.subscriber;
      return generateRandomDob(minAge, maxAge);
   }
   return normalizeDate(dob);
}

function normalizeGender(gender) {
   if (gender) {
      const g = String(gender).trim().toLowerCase();
      if (g === 'm' || g === 'male') return 'M';
      if (g === 'f' || g === 'female') return 'F';
   }
   return 'M';
}

// MAS SERVICE CONSUMER NAME is derived from the selected environment name
// by replacing spaces with underscores (e.g. 'CLONE D' -> 'CLONE_D').
function deriveMasConsumerName(environmentName) {
   return String(environmentName || '').trim().replace(/\s+/g, '_');
}

function toLongGender(gender) {
   return gender === 'F' ? 'Female' : 'Male';
}

// MAS enrollMember envelope. Structurally distinct from the Common Membership
// envelope: different namespaces, no middleName / languageCode / state /
// country, two <phoneNumber> blocks (WORK + HOME), <rateLevelId> in place of
// <billgroupId>, no <familyId>, and literal SENDER/RECEIVER identity block.
function buildMasEnrollMemberXML(resolved, ctx) {
   const { username, password, messageDateTime } = ctx;
   const consumerName = deriveMasConsumerName(resolved.environment);
   const genderLong = toLongGender(resolved.gender);
   const workPhone = generateRandomPhone();
   return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:ns1="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Entity/" xmlns:ns2="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Communication/" xmlns:ns3="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Membership/">
   <soapenv:Header>
      <wsse:Security soapenv:mustUnderstand="0" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
         <wsse:UsernameToken>
            <wsse:Username>${username}</wsse:Username>
            <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${password}</wsse:Password>
         </wsse:UsernameToken>
      </wsse:Security>
   </soapenv:Header>
   <soapenv:Body>
      <enrollMemberRequestMessage xmlns="http://svc.kp.org/hp_admn/mbr_admn/member_enrollment/v1/Elements/">
         <header xmlns="">
            <header>
               <MessageDateTime>${messageDateTime}</MessageDateTime>
               <SenderTrnsDetails>
                  <Name>SENDER</Name>
                  <TransactionId>12345</TransactionId>
                  <userIdInfo>
                     <id xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Types/">SR</id>
                     <name xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Types/">KPIT</name>
                  </userIdInfo>
                  <applicationIdInfo>
                     <id xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Types/">MBE</id>
                     <name xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Types/">MBE</name>
                  </applicationIdInfo>
                  <AdditionalDetails>
                     <AddDetailName>SERVICE CONSUMER NAME</AddDetailName>
                     <AddDetailValue>${consumerName}</AddDetailValue>
                  </AdditionalDetails>
               </SenderTrnsDetails>
               <ReceiverTrnsDetails>
                  <Name>RECEIVER</Name>
                  <TransactionId>54321</TransactionId>
                  <userIdInfo>
                     <id xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Types/">SR</id>
                     <name xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Types/">KPIT</name>
                  </userIdInfo>
                  <applicationIdInfo>
                     <id xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Types/">MBE</id>
                     <name xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Types/">MBE</name>
                  </applicationIdInfo>
                  <AdditionalDetails>
                     <AddDetailName>SERVICE CONSUMER NAME</AddDetailName>
                     <AddDetailValue>${consumerName}</AddDetailValue>
                  </AdditionalDetails>
               </ReceiverTrnsDetails>
            </header>
         </header>
         <region xmlns="">
            <regionCode>
               <code>${resolved.regionCode}</code>
            </regionCode>
         </region>
         <enrollMemberRequest xmlns="">
            <person>
               <personId>
                  <assigningOrganization>
                     <code>${resolved.regionCode}</code>
                  </assigningOrganization>
                  <id>${resolved.personId ?? ''}</id>
               </personId>
               <otherpersonId>
                  <assigningOrganization>
                     <code>SSA</code>
                  </assigningOrganization>
                  <id>${resolved.ssn}</id>
               </otherpersonId>
            </person>
            <memberInfo>
               <primaryAttributeInfo>
                  <personInformation>
                     <ns1:lastName>${resolved.lastName}</ns1:lastName>
                     <ns1:firstName>${resolved.firstName}</ns1:firstName>
                     <ns1:gender>${genderLong}</ns1:gender>
                     <ns1:dateofBirth>${resolved.dateOfBirth}</ns1:dateofBirth>
                  </personInformation>
                  <maritalStatusCode>${resolved.maritalStatus}</maritalStatusCode>
               </primaryAttributeInfo>
               <secondaryAttributeInfo>
                  <isInterpreterRequiredInd>No</isInterpreterRequiredInd>
                  <specialStatusCode>11</specialStatusCode>
               </secondaryAttributeInfo>
               <address>
                  <addresstype>Home</addresstype>
                  <ns2:addressLine1>${resolved.addressLine1}</ns2:addressLine1>
                  <ns2:city>${resolved.city}</ns2:city>
                  <ns2:postalCode>${resolved.postalCode}</ns2:postalCode>
                  <isValidInd>Yes</isValidInd>
               </address>
               <phoneNumber>
                  <usageTypeCode>WORK</usageTypeCode>
                  <areaCode>${workPhone.areaCode}</areaCode>
                  <number>${workPhone.number}</number>
                  <isTTYInd>Yes</isTTYInd>
                  <isValidInd>Yes</isValidInd>
               </phoneNumber>
               <phoneNumber>
                  <usageTypeCode>HOME</usageTypeCode>
                  <areaCode>${resolved.phone.areaCode}</areaCode>
                  <number>${resolved.phone.number}</number>
                  <isTTYInd>Yes</isTTYInd>
                  <isValidInd>Yes</isValidInd>
               </phoneNumber>
            </memberInfo>
            <membershipEnrollmentInfo>
               <groupId>
                  <id>${resolved.groupId}</id>
               </groupId>
               <subgroupId>
                  <id>${resolved.subgroupId}</id>
               </subgroupId>
               <rateLevelId>${resolved.billGroupId}</rateLevelId>
               <doesSubscriberHaveCvg>Yes</doesSubscriberHaveCvg>
               <relationshipCode>${resolved.relation}</relationshipCode>
               <MembershipApplicationDetails>
                  <idCardSuppressInd>Yes</idCardSuppressInd>
                  <acceptCertificationInd>No</acceptCertificationInd>
               </MembershipApplicationDetails>
               <rateUpStartEndDate>
                  <beginDate>${resolved.coverageEffectiveDate}</beginDate>
               </rateUpStartEndDate>
            </membershipEnrollmentInfo>
         </enrollMemberRequest>
      </enrollMemberRequestMessage>
   </soapenv:Body>
</soapenv:Envelope>`;
}

// MAS dependent enrollMember envelope. Same header / region shape as the MAS
// subscriber envelope but structurally different in the enrollMemberRequest:
// no <personId>, <otherPersonId> uppercase P with empty <id> and idType=FULL,
// hardcoded <maritalStatusCode>Unknown, and a <familyId> block with literal
// subscriberId placeholders.
function buildMasDependentEnrollMemberXML(resolved, ctx) {
   const { username, password, messageDateTime } = ctx;
   const consumerName = deriveMasConsumerName(resolved.environment);
   const genderLong = toLongGender(resolved.gender);
   const workPhone = generateRandomPhone();
   return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:ns1="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Entity/" xmlns:ns2="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Communication/" xmlns:ns3="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Membership/">
   <soapenv:Header>
      <wsse:Security soapenv:mustUnderstand="0" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
         <wsse:UsernameToken>
            <wsse:Username>${username}</wsse:Username>
            <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${password}</wsse:Password>
         </wsse:UsernameToken>
      </wsse:Security>
   </soapenv:Header>
   <soapenv:Body>
      <enrollMemberRequestMessage xmlns="http://svc.kp.org/hp_admn/mbr_admn/member_enrollment/v1/Elements/">
         <header xmlns="">
            <header>
               <MessageDateTime>${messageDateTime}</MessageDateTime>
               <SenderTrnsDetails>
                  <Name>SENDER</Name>
                  <TransactionId>12345</TransactionId>
                  <userIdInfo>
                     <id xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Types/">SR</id>
                     <name xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Types/">KPIT</name>
                  </userIdInfo>
                  <applicationIdInfo>
                     <id xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Types/">MBE</id>
                     <name xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Types/">MBE</name>
                  </applicationIdInfo>
                  <AdditionalDetails>
                     <AddDetailName>SERVICE CONSUMER NAME</AddDetailName>
                     <AddDetailValue>${consumerName}</AddDetailValue>
                  </AdditionalDetails>
               </SenderTrnsDetails>
               <ReceiverTrnsDetails>
                  <Name>RECEIVER</Name>
                  <TransactionId>54321</TransactionId>
                  <userIdInfo>
                     <id xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Types/">SR</id>
                     <name xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Types/">KPIT</name>
                  </userIdInfo>
                  <applicationIdInfo>
                     <id xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Types/">MBE</id>
                     <name xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Types/">MBE</name>
                  </applicationIdInfo>
                  <AdditionalDetails>
                     <AddDetailName>SERVICE CONSUMER NAME</AddDetailName>
                     <AddDetailValue>${consumerName}</AddDetailValue>
                  </AdditionalDetails>
               </ReceiverTrnsDetails>
            </header>
         </header>
         <region xmlns="">
            <regionCode>
               <code>${resolved.regionCode}</code>
            </regionCode>
         </region>
         <enrollMemberRequest xmlns="">
            <person>${resolved.personId ? `
               <personId>
                  <assigningOrganization>
                     <code>${resolved.regionCode}</code>
                  </assigningOrganization>
                  <id>${resolved.personId}</id>
               </personId>` : ''}
               <otherPersonId>
                  <assigningOrganization>
                     <code>SSA</code>
                  </assigningOrganization>
                  <id></id>
                  <idType>FULL</idType>
               </otherPersonId>
            </person>
            <memberInfo>
               <primaryAttributeInfo>
                  <personInformation>
                     <ns1:lastName>${resolved.lastName}</ns1:lastName>
                     <ns1:firstName>${resolved.firstName}</ns1:firstName>
                     <ns1:gender>${genderLong}</ns1:gender>
                     <ns1:dateofBirth>${resolved.dateOfBirth}</ns1:dateofBirth>
                  </personInformation>
                  <maritalStatusCode>Unknown</maritalStatusCode>
               </primaryAttributeInfo>
               <secondaryAttributeInfo>
                  <isInterpreterRequiredInd>No</isInterpreterRequiredInd>
                  <specialStatusCode>11</specialStatusCode>
               </secondaryAttributeInfo>
               <address>
                  <addresstype>Home</addresstype>
                  <ns2:addressLine1>${resolved.addressLine1}</ns2:addressLine1>
                  <ns2:city>${resolved.city}</ns2:city>
                  <ns2:postalCode>${resolved.postalCode}</ns2:postalCode>
                  <isValidInd>Yes</isValidInd>
               </address>
               <phoneNumber>
                  <usageTypeCode>WORK</usageTypeCode>
                  <areaCode>${workPhone.areaCode}</areaCode>
                  <number>${workPhone.number}</number>
                  <isTTYInd>Yes</isTTYInd>
                  <isValidInd>Yes</isValidInd>
               </phoneNumber>
               <phoneNumber>
                  <usageTypeCode>HOME</usageTypeCode>
                  <areaCode>${resolved.phone.areaCode}</areaCode>
                  <number>${resolved.phone.number}</number>
                  <isTTYInd>Yes</isTTYInd>
                  <isValidInd>Yes</isValidInd>
               </phoneNumber>
            </memberInfo>
            <membershipEnrollmentInfo>
               <groupId>
                  <id>${resolved.groupId}</id>
               </groupId>
               <subgroupId>
                  <id>${resolved.subgroupId}</id>
               </subgroupId>
               <familyId>
                  <familySequenceNum>${resolved.familySequenceNum}</familySequenceNum>
                  <subscriberId>
                     <id xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Membership/">
                        <assigningOrganization xmlns="">
                           <typeId xsi:nil="true" xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Entity/"/>
                           <code>${resolved.regionCode}</code>
                        </assigningOrganization>
                        <id xmlns="">${resolved.familySubscriberId}</id>
                     </id>
                     <lastName>NonMedicare</lastName>
                     <firstName>Member</firstName>
                  </subscriberId>
               </familyId>
               <rateLevelId>${resolved.billGroupId}</rateLevelId>
               <doesSubscriberHaveCvg>Yes</doesSubscriberHaveCvg>
               <relationshipCode>${resolved.relation}</relationshipCode>
               <MembershipApplicationDetails>
                  <idCardSuppressInd>Yes</idCardSuppressInd>
                  <acceptCertificationInd>No</acceptCertificationInd>
               </MembershipApplicationDetails>
               <rateUpStartEndDate>
                  <beginDate>${resolved.coverageEffectiveDate}</beginDate>
               </rateUpStartEndDate>
            </membershipEnrollmentInfo>
         </enrollMemberRequest>
      </enrollMemberRequestMessage>
   </soapenv:Body>
</soapenv:Envelope>`;
}

// NCAL and SCAL (Foundation Systems) share one envelope shape. Only the
// regionCode (NCA / SCA), the personId <idPartition>, and the group IDs differ.
const CAL_REGIONS = new Set(['NCAL', 'SCAL']);

// Foundation Systems partitions person IDs by region.
const CAL_ID_PARTITION = { NCAL: '11', SCAL: '00' };

// Foundation Systems maritalStatusCode is a closed enumeration that other regions
// don't share: Divorced, Common Law, Married, Single / Not Married, Separated,
// Unknown, Widowed, Domestic Partner. Map common shorthand (and other regions'
// 'Single') onto the exact CAL spelling, keyed by lowercased input.
const CAL_MARITAL_STATUS = {
   'single': 'Single / Not Married',
   'not married': 'Single / Not Married',
   'unmarried': 'Single / Not Married',
   'single / not married': 'Single / Not Married',
   'married': 'Married',
   'divorced': 'Divorced',
   'separated': 'Separated',
   'widowed': 'Widowed',
   'unknown': 'Unknown',
   'common law': 'Common Law',
   'domestic partner': 'Domestic Partner'
};

function toCalMaritalStatus(maritalStatus) {
   const key = String(maritalStatus || '').trim().toLowerCase();
   return CAL_MARITAL_STATUS[key] || maritalStatus;
}

// California accepts a wider gender enum than the M/F other regions use:
// Female, Male, Other, Unknown. Defaults to Male when unset.
function toCalGender(gender) {
   const g = String(gender || '').trim().toLowerCase();
   if (g === 'f' || g === 'female') return 'Female';
   if (g === 'o' || g === 'other') return 'Other';
   if (g === 'u' || g === 'unknown') return 'Unknown';
   return 'Male';
}

// NCAL / SCAL subscriber enrollMember envelope (Foundation Systems). Distinct from
// both the Common Membership and MAS envelopes: per-element namespace declarations
// instead of prefixes, an <idPartition> on personId, a mandatory <advancedDirective>
// block, long-form gender, and no billgroupId / rateLevelId / phoneNumber.
function buildCalEnrollMemberXML(resolved, ctx) {
   const { username, password, messageDateTime } = ctx;
   const d = resolved.coverageEffectiveDate;
   return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
   <soapenv:Header>
      <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
         <wsse:UsernameToken wsu:Id="UsernameToken-23994247" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
            <wsse:Username>${username}</wsse:Username>
            <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${password}</wsse:Password>
            <wsse:Nonce>vGnbKL0rRFZx1sf4O+taWQ==</wsse:Nonce>
            <wsu:Created>2012-07-17T07:08:43.599Z</wsu:Created>
         </wsse:UsernameToken>
      </wsse:Security>
   </soapenv:Header>
   <soapenv:Body>
      <enrollMemberRequestMessage xmlns="http://svc.kp.org/hp_admn/mbr_admn/member_enrollment/v1/Elements/">
         <header xmlns="">
            <header>
               <MessageDateTime>${messageDateTime}</MessageDateTime>
               <SenderTrnsDetails>
                  <Name>sourceapplication</Name>
                  <TransactionId>NUID</TransactionId>
                  <userIdInfo>
                     <id xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Types/">W002770</id>
                  </userIdInfo>
                  <applicationIdInfo>
                     <id xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Types/">MBE</id>
                  </applicationIdInfo>
                  <AdditionalDetails>
                     <AddDetailName>EnvironmentCode</AddDetailName>
                     <AddDetailValue>${resolved.environmentCode}</AddDetailValue>
                  </AdditionalDetails>
               </SenderTrnsDetails>
               <ReceiverTrnsDetails>
                  <Name>sourceapplication</Name>
                  <TransactionId>NUID</TransactionId>
                  <userIdInfo>
                     <id xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Types/">E748900</id>
                  </userIdInfo>
                  <applicationIdInfo>
                     <id xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Types/">MBE</id>
                  </applicationIdInfo>
                  <AdditionalDetails>
                     <AddDetailName>EnvironmentCode</AddDetailName>
                     <AddDetailValue>${resolved.environmentCode}</AddDetailValue>
                  </AdditionalDetails>
               </ReceiverTrnsDetails>
            </header>
         </header>
         <region xmlns="">
            <regionCode>
               <typeId xsi:nil="true"/>
               <code>${resolved.regionCode}</code>
               <description>Test</description>
            </regionCode>
         </region>
         <enrollMemberRequest xmlns="">
            <person>
               <personId>
                  <assigningOrganization>
                     <typeId xsi:nil="true" xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Entity/"/>
                     <code>${resolved.regionCode}</code>
                  </assigningOrganization>
                  <id>${resolved.personId ?? '0'}</id>
                  <idPartition>${CAL_ID_PARTITION[resolved.region]}</idPartition>
               </personId>
               <otherPersonId>
                  <assigningOrganization>
                     <code>SSA</code>
                  </assigningOrganization>
                  <id>${resolved.ssn}</id>
                  <idType>FULL</idType>
               </otherPersonId>
            </person>
            <memberInfo>
               <primaryAttributeInfo>
                  <personInformation>
                     <middleName xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Entity/">${resolved.middleName}</middleName>
                     <lastName xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Entity/">${resolved.lastName}</lastName>
                     <firstName xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Entity/">${resolved.firstName}</firstName>
                     <gender xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Entity/">${resolved.calGender}</gender>
                     <dateofBirth xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Entity/">${resolved.dateOfBirth}</dateofBirth>
                  </personInformation>
                  <maritalStatusCode>${toCalMaritalStatus(resolved.maritalStatus)}</maritalStatusCode>
               </primaryAttributeInfo>
               <secondaryAttributeInfo>
                  <ethnicGroupCode/>
                  <raceCode/>
                  <languageCode>
                     <code>English</code>
                     <isSpokenInd>Yes</isSpokenInd>
                     <isWrittenInd>Yes</isWrittenInd>
                  </languageCode>
                  <isInterpreterRequiredInd>Yes</isInterpreterRequiredInd>
                  <specialAttentionCode/>
                  <mothersMaidenName/>
                  <marriageDate xsi:nil="true"/>
                  <divorceDate xsi:nil="true"/>
                  <specialStatusCode>0</specialStatusCode>
                  <specialDependentStatusCode/>
               </secondaryAttributeInfo>
               <advancedDirective>
                  <advDirectiveInd>Yes</advDirectiveInd>
                  <advDirectiveProxyName/>
                  <advDirectiveDocumentDate xsi:nil="true"/>
                  <advDirectiveTTYInd>Yes</advDirectiveTTYInd>
                  <advDirectiveProxyPhone>
                     <usageTypeCode/>
                     <countryCode/>
                     <areaCode/>
                     <number/>
                     <extension/>
                     <deviceTypeCode/>
                     <preferredContactTimeCode/>
                     <isTTYInd>No</isTTYInd>
                     <tieLine/>
                     <startEndDate>
                        <beginDate>${resolved.coverageEffectiveDate}</beginDate>
                        <endDate xsi:nil="true"/>
                     </startEndDate>
                     <isValidInd>No</isValidInd>
                  </advDirectiveProxyPhone>
               </advancedDirective>
               <address>
                  <addresstype>HOME</addresstype>
                  <addressLine1 xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Communication/">${resolved.addressLine1}</addressLine1>
                  <addressLine2 xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Communication/">${resolved.addressLine2}</addressLine2>
                  <city xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Communication/">${resolved.city}</city>
                  <state xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Communication/">
                     <code xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Types/">${resolved.state}</code>
                     <typeId xsi:nil="true" xmlns=""/>
                  </state>
                  <postalCode xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Communication/">${resolved.postalCode}</postalCode>
                  <isValidInd>Yes</isValidInd>
               </address>
            </memberInfo>
            <membershipEnrollmentInfo>
               <groupId>
                  <id>${resolved.groupId}</id>
                  <name/>
               </groupId>
               <subgroupId>
                  <id>${resolved.subgroupId}</id>
               </subgroupId>
               <doesSubscriberHaveCvg>Yes</doesSubscriberHaveCvg>
               <relationshipCode>${resolved.relation}</relationshipCode>
               <familySize xsi:nil="true"/>
               <MembershipApplicationDetails>
                  <enrollmentSource>Purchaser</enrollmentSource>
                  <enrollmentEventReasonCode>PurchrRqstd</enrollmentEventReasonCode>
                  <enrollmentEventDate>${d}</enrollmentEventDate>
                  <enrollmentReportingDate>${d}</enrollmentReportingDate>
                  <enrollmentRequestEffectiveDate>${d}</enrollmentRequestEffectiveDate>
                  <applicationSignedDate>${d}</applicationSignedDate>
                  <idCardSuppressInd>Yes</idCardSuppressInd>
                  <acceptCertificationInd>Yes</acceptCertificationInd>
               </MembershipApplicationDetails>
               <employmentStatusCode>Working</employmentStatusCode>
            </membershipEnrollmentInfo>
         </enrollMemberRequest>
      </enrollMemberRequestMessage>
   </soapenv:Body>
</soapenv:Envelope>`;
}

// NCAL / SCAL dependent enrollMember envelope. Same shape as the CAL subscriber
// envelope except: personId <id> is empty, <specialStatusCode> is empty, no
// addressLine2, and a <familyId> block linking to the subscriber's MRN (which
// must repeat the subscriber's region code and idPartition).
function buildCalDependentEnrollMemberXML(resolved, ctx) {
   const { username, password, messageDateTime } = ctx;
   const idPartition = CAL_ID_PARTITION[resolved.region];
   const d = resolved.coverageEffectiveDate;
   return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
   <soapenv:Header>
      <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
         <wsse:UsernameToken wsu:Id="UsernameToken-23994247" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
            <wsse:Username>${username}</wsse:Username>
            <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${password}</wsse:Password>
            <wsse:Nonce>vGnbKL0rRFZx1sf4O+taWQ==</wsse:Nonce>
            <wsu:Created>2012-07-17T07:08:43.599Z</wsu:Created>
         </wsse:UsernameToken>
      </wsse:Security>
   </soapenv:Header>
   <soapenv:Body>
      <enrollMemberRequestMessage xmlns="http://svc.kp.org/hp_admn/mbr_admn/member_enrollment/v1/Elements/">
         <header xmlns="">
            <header>
               <MessageDateTime>${messageDateTime}</MessageDateTime>
               <SenderTrnsDetails>
                  <Name>sourceapplication</Name>
                  <TransactionId>NUID</TransactionId>
                  <userIdInfo>
                     <id xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Types/">E748900</id>
                  </userIdInfo>
                  <applicationIdInfo>
                     <id xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Types/">MBE</id>
                  </applicationIdInfo>
                  <AdditionalDetails>
                     <AddDetailName>EnvironmentCode</AddDetailName>
                     <AddDetailValue>${resolved.environmentCode}</AddDetailValue>
                  </AdditionalDetails>
               </SenderTrnsDetails>
               <ReceiverTrnsDetails>
                  <Name>sourceapplication</Name>
                  <TransactionId>NUID</TransactionId>
                  <userIdInfo>
                     <id xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Types/">E748900</id>
                  </userIdInfo>
                  <applicationIdInfo>
                     <id xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Types/">MBE</id>
                  </applicationIdInfo>
                  <AdditionalDetails>
                     <AddDetailName>EnvironmentCode</AddDetailName>
                     <AddDetailValue>${resolved.environmentCode}</AddDetailValue>
                  </AdditionalDetails>
               </ReceiverTrnsDetails>
            </header>
         </header>
         <region xmlns="">
            <regionCode>
               <typeId xsi:nil="true"/>
               <code>${resolved.regionCode}</code>
               <description>Test</description>
            </regionCode>
         </region>
         <enrollMemberRequest xmlns="">
            <person>
               <personId>
                  <assigningOrganization>
                     <typeId xsi:nil="true" xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Entity/"/>
                     <code>${resolved.regionCode}</code>
                  </assigningOrganization>
                  <id>${resolved.personId ?? ''}</id>
                  <idPartition>${idPartition}</idPartition>
               </personId>
            </person>
            <memberInfo>
               <primaryAttributeInfo>
                  <personInformation>
                     <middleName xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Entity/">${resolved.middleName}</middleName>
                     <lastName xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Entity/">${resolved.lastName}</lastName>
                     <firstName xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Entity/">${resolved.firstName}</firstName>
                     <gender xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Entity/">${resolved.calGender}</gender>
                     <dateofBirth xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Entity/">${resolved.dateOfBirth}</dateofBirth>
                  </personInformation>
                  <maritalStatusCode>${toCalMaritalStatus(resolved.maritalStatus)}</maritalStatusCode>
               </primaryAttributeInfo>
               <secondaryAttributeInfo>
                  <ethnicGroupCode/>
                  <raceCode/>
                  <languageCode>
                     <code>English</code>
                     <isSpokenInd>Yes</isSpokenInd>
                     <isWrittenInd>Yes</isWrittenInd>
                  </languageCode>
                  <isInterpreterRequiredInd>Yes</isInterpreterRequiredInd>
                  <specialAttentionCode/>
                  <mothersMaidenName/>
                  <marriageDate xsi:nil="true"/>
                  <divorceDate xsi:nil="true"/>
                  <specialStatusCode/>
                  <specialDependentStatusCode/>
               </secondaryAttributeInfo>
               <advancedDirective>
                  <advDirectiveInd>Yes</advDirectiveInd>
                  <advDirectiveProxyName/>
                  <advDirectiveDocumentDate xsi:nil="true"/>
                  <advDirectiveTTYInd>Yes</advDirectiveTTYInd>
                  <advDirectiveProxyPhone>
                     <usageTypeCode/>
                     <countryCode/>
                     <areaCode/>
                     <number/>
                     <extension/>
                     <deviceTypeCode/>
                     <preferredContactTimeCode/>
                     <isTTYInd>No</isTTYInd>
                     <tieLine/>
                     <startEndDate>
                        <beginDate>${resolved.coverageEffectiveDate}</beginDate>
                        <endDate>4000-12-31</endDate>
                     </startEndDate>
                     <isValidInd>No</isValidInd>
                  </advDirectiveProxyPhone>
               </advancedDirective>
               <address>
                  <addresstype>HOME</addresstype>
                  <addressLine1 xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Communication/">${resolved.addressLine1}</addressLine1>
                  <city xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Communication/">${resolved.city}</city>
                  <state xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Communication/">
                     <code xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Types/">${resolved.state}</code>
                     <typeId xsi:nil="true" xmlns=""/>
                  </state>
                  <postalCode xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Communication/">${resolved.postalCode}</postalCode>
                  <isValidInd>Yes</isValidInd>
               </address>
            </memberInfo>
            <membershipEnrollmentInfo>
               <groupId>
                  <id>${resolved.groupId}</id>
                  <name/>
               </groupId>
               <subgroupId>
                  <id>${resolved.subgroupId}</id>
               </subgroupId>
               <familyId>
                  <familySequenceNum>${resolved.familySequenceNum}</familySequenceNum>
                  <subscriberId>
                     <id xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Membership/">
                        <assigningOrganization xmlns="">
                           <typeId xsi:nil="true" xmlns="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Entity/"/>
                           <code>${resolved.regionCode}</code>
                        </assigningOrganization>
                        <id xmlns="">${resolved.familySubscriberId}</id>
                        <idPartition xmlns="">${idPartition}</idPartition>
                     </id>
                     <lastName>NonMedicare</lastName>
                     <firstName>Member</firstName>
                  </subscriberId>
               </familyId>
               <doesSubscriberHaveCvg>No</doesSubscriberHaveCvg>
               <relationshipCode>${resolved.relation}</relationshipCode>
               <familySize xsi:nil="true"/>
               <MembershipApplicationDetails>
                  <enrollmentSource>Purchaser</enrollmentSource>
                  <enrollmentEventReasonCode>PurchrRqstd</enrollmentEventReasonCode>
                  <enrollmentEventDate>${d}</enrollmentEventDate>
                  <enrollmentReportingDate>${d}</enrollmentReportingDate>
                  <enrollmentRequestEffectiveDate>${d}</enrollmentRequestEffectiveDate>
                  <applicationSignedDate>${d}</applicationSignedDate>
                  <idCardSuppressInd>Yes</idCardSuppressInd>
                  <acceptCertificationInd>Yes</acceptCertificationInd>
               </MembershipApplicationDetails>
               <employmentStatusCode>Working</employmentStatusCode>
            </membershipEnrollmentInfo>
         </enrollMemberRequest>
      </enrollMemberRequestMessage>
   </soapenv:Body>
</soapenv:Envelope>`;
}

// Resolves user-supplied params into the fully-defaulted `resolved` object and
// the SOAP request context (credentials, timestamps, txn id) shared by every
// enrollMember envelope builder.
function resolveEnrollmentContext(params) {
   const region = String(params.region || '').toUpperCase();
   const coverageName = normalizeCoverageName(params.coverageName);
   const { coverage } = resolveRegionCoverage(region, coverageName, params.environment);
   const regionAddress = REGION_DEFAULT_ADDRESS[region] || {};

   const memberType = ['adult', 'teen', 'child'].includes(params.memberType) ? params.memberType : 'adult';
   const coverageTiming = ['preEffective', 'terminated'].includes(params.coverageTiming) ? params.coverageTiming : 'active';
   const defaultStartDate = coverageTiming === 'preEffective'
      ? preEffectiveDate()
      : coverageTiming === 'terminated' ? terminatedDefaultStartDate() : currentMonthStartDate();
   const coverageEffectiveDate = normalizeDate(params.coverageEffectiveDate) || defaultStartDate;

   const resolved = {
      relation: params.relation || 'Subscriber',
      region,
      regionCode: resolveRegionCode(region),
      memberType,
      coverageTiming,
      coverageName,
      hasCoverage: coverageName !== 'NO_COVERAGE',
      groupId: coverage.groupId,
      subgroupId: coverage.subgroupId,
      billGroupId: coverage.billGroupId,
      firstName: applyKphcRule(params.firstName || pickRandom(DEFAULTS.firstNamePool), params.kphcRule),
      lastName: params.lastName || pickRandom(DEFAULTS.lastNamePool),
      middleName: params.middleName || DEFAULTS.middleName,
      gender: normalizeGender(params.gender),
      kphcEnv: params.kphcEnv || null,
      // California accepts a wider gender enum (Female/Male/Other/Unknown); other regions send Male/Female only.
      calGender: toCalGender(params.gender),
      // Prefer an explicit dateOfBirth; else derive it from `age` server-side (real current
      // date); else fall back to the role's random age range.
      dateOfBirth: normalizeDob(params.dateOfBirth || ageToDob(params.age), resolveAgeRangeKey(memberType, params.relation || 'Subscriber')),
      maritalStatus: params.maritalStatus || DEFAULTS.maritalStatus,
      addressLine1: params.addressLine1 || regionAddress.addressLine1,
      addressLine2: params.addressLine2 || '',
      city: params.city || regionAddress.city,
      state: params.state || regionAddress.state,
      postalCode: params.postalCode || regionAddress.postalCode,
      ssn: params.ssn || String(generateUniqueSSN()),
      phone: parsePhone(params.phoneNumber),
      coverageEffectiveDate,
      // Null for a new member; set to an existing MRN when adding secondary coverage.
      personId: null,
      // For dependents, this is the subscriber's MRN so the SOAP service links
      // primary subscriber  stays "0".
      familySubscriberId: params.subscriberMRN ? String(params.subscriberMRN) : '0',
      // Family linkage value captured from the subscriber creation response (MAS / CAL).
      familySequenceNum: params.familySequenceNum || '',
      environment: params.environment || 'Membership',
      environmentCode: params.environmentCode || resolveEnvironmentCode(region, params.environment)
   };

   const ctx = {
      username: process.env[`host.${process.env.envName}-aiportal-web-2.generateTestMrn.api.user`],
      password: process.env[`host.${process.env.envName}-aiportal-web-2.generateTestMrn.api.password`],
      messageDateTime: new Date().toISOString()
   };

   return { resolved, ctx };
}

// Standard (non-MAS) enrollMember envelope. MAS uses buildMasEnrollMemberXML /
// buildMasDependentEnrollMemberXML instead — see createSubscriberMRN for the branch.
function buildEnrollMemberXML(resolved, ctx) {2
   const { username, password, messageDateTime } = ctx;
   return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:elem="http://svc.kp.org/hp_admn/mbr_admn/member_enrollment/v1/Elements/" xmlns:typ="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Types/" xmlns:ent="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Entity/" xmlns:com="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Communication/" xmlns:mem="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Membership/">
   <soapenv:Header>
      <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
         <wsse:UsernameToken xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
            <wsse:Username>${username}</wsse:Username>
            <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${password}</wsse:Password>
         </wsse:UsernameToken>
      </wsse:Security>
   </soapenv:Header>
   <soapenv:Body>
      <ns8:enrollMemberRequestMessage xmlns:ns2="http://org.kp.svc/schema/commonTypes/exceptionTypes/v1" xmlns:ns4="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Entity/" xmlns:ns3="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Types/" xmlns:ns5="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Membership/" xmlns:ns6="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Communication/" xmlns:ns7="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/v1/Elements/" xmlns:ns8="http://svc.kp.org/hp_admn/mbr_admn/member_enrollment/v1/Elements/">
         <header>
            <header>
               <MessageDateTime>${messageDateTime}</MessageDateTime>
               <SenderTrnsDetails>
                  <Name>P198673</Name>
                  <TransactionId>1354233616274</TransactionId>
                  <userIdInfo>
                     <ns3:id>P198673</ns3:id>
                     <typeCode>1</typeCode>
                     <ns3:name>P198673</ns3:name>
                  </userIdInfo>
                  <applicationIdInfo>
                     <ns3:id>MBE</ns3:id>
                     <ns3:name>PEP</ns3:name>
                  </applicationIdInfo>
               </SenderTrnsDetails>
               <ReceiverTrnsDetails>
                  <Name>P198673</Name>
                  <TransactionId>1354233616274</TransactionId>
                  <AdditionalDetails>
                     <AddDetailName>EnvironmentCode</AddDetailName>
                     <AddDetailValue>${resolved.environmentCode}</AddDetailValue>
                  </AdditionalDetails>
               </ReceiverTrnsDetails>
            </header>
         </header>
         <region>
            <regionCode>
               <code>${resolved.regionCode}</code>
            </regionCode>
         </region>
         <enrollMemberRequest>
            <person>
               <personId>
                  <assigningOrganization>
                     <typeId>${resolveTypeId(resolved.region)}</typeId>
                     <code>${resolved.region}</code>
                  </assigningOrganization>
                  <id>${resolved.personId ?? '0'}</id>
               </personId>
               <otherPersonId>
                  <assigningOrganization>
                     <code>SSA</code>
                  </assigningOrganization>
                  <id>${resolved.ssn}</id>
                  <idType>FULL</idType>
               </otherPersonId>
            </person>
            <memberInfo>
               <primaryAttributeInfo>
                  <personInformation>
                     <ns4:lastName>${resolved.lastName}</ns4:lastName>
                     <ns4:firstName>${resolved.firstName}</ns4:firstName>
                     <ns4:middleName>${resolved.middleName}</ns4:middleName>
                     <ns4:gender>${toLongGender(resolved.gender)}</ns4:gender>
                     <ns4:dateofBirth>${resolved.dateOfBirth}</ns4:dateofBirth>
                  </personInformation>
                  <maritalStatusCode>${resolved.maritalStatus}</maritalStatusCode>
               </primaryAttributeInfo>
               <secondaryAttributeInfo>
                  <languageCode>
                     <code>English</code>
                     <isSpokenInd>Yes</isSpokenInd>
                     <isWrittenInd>Yes</isWrittenInd>
                  </languageCode>
                  <isInterpreterRequiredInd>No</isInterpreterRequiredInd>
               </secondaryAttributeInfo>
               <address>
                  <addresstype>Home</addresstype>
                  <ns6:addressLine1>${resolved.addressLine1}</ns6:addressLine1>
                  <ns6:addressLine2>${resolved.addressLine2}</ns6:addressLine2>
                  <ns6:city>${resolved.city}</ns6:city>
                  <ns6:state>
                     <ns3:code>${resolved.state}</ns3:code>
                  </ns6:state>
                  <ns6:country>
                     <ns3:code>UnitedStates</ns3:code>
                  </ns6:country>
                  <ns6:postalCode>${resolved.postalCode}</ns6:postalCode>
                  <postalCodeExtn/>
                  <startEndDate>
                     <beginDate>${resolved.coverageEffectiveDate}</beginDate>
                  </startEndDate>
                  <isValidInd>Yes</isValidInd>
               </address>
               <membershipPhone>
                  <usageTypeCode>Home</usageTypeCode>
                  <countryCode>1</countryCode>
                  <areaCode>${resolved.phone.areaCode}</areaCode>
                  <number>${resolved.phone.number}</number>
                  <extension>?</extension>
                  <deviceTypeCode>?</deviceTypeCode>
                  <preferredContactTimeCode>?</preferredContactTimeCode>
                  <isTTYInd>?</isTTYInd>
                  <tieLine>?</tieLine>
                  <startEndDate>
                     <beginDate>${resolved.coverageEffectiveDate}</beginDate>
                     <endDate>?</endDate>
                  </startEndDate>
                  <isValidInd>?</isValidInd>
               </membershipPhone>
            </memberInfo>
            <membershipEnrollmentInfo>
               <groupId>
                  <id>${resolved.groupId}</id>
               </groupId>
               <subgroupId>
                  <id>${resolved.subgroupId}</id>
               </subgroupId>
               <familyId>
                  <subscriberId>
                     <mem:id>
                        <assigningOrganization>
                           <code>${resolved.region}</code>
                        </assigningOrganization>
                        <id>${resolved.familySubscriberId}</id>
                     </mem:id>
                  </subscriberId>
               </familyId>
               <billgroupId>
                  <id>${resolved.billGroupId}</id>
               </billgroupId>
               <doesSubscriberHaveCvg>${resolved.hasCoverage ? 'Yes' : 'No'}</doesSubscriberHaveCvg>
               <relationshipCode>${resolved.relation}</relationshipCode>
               <MembershipApplicationDetails>
                  <enrollmentSource>${DEFAULTS.enrollmentSource}</enrollmentSource>
                  <enrollmentEventReasonCode>${DEFAULTS.enrollmentEventReasonCode}</enrollmentEventReasonCode>
                  <enrollmentRequestEffectiveDate>${resolved.coverageEffectiveDate}</enrollmentRequestEffectiveDate>
                  <idCardSuppressInd>Yes</idCardSuppressInd>
                  <acceptCertificationInd>Unknown</acceptCertificationInd>
               </MembershipApplicationDetails>
            </membershipEnrollmentInfo>
         </enrollMemberRequest>
      </ns8:enrollMemberRequestMessage>
   </soapenv:Body>
</soapenv:Envelope>`;
}

// MemberTermination envelope (CO, HI, NW, MAS, GA). Terminates the coverage identified by
// resolved.groupId / subgroupId for the member `mrn`, who is also the family subscriber.
function buildTerminateMemberXML(resolved, ctx, mrn) {
   const { username, password, messageDateTime } = ctx;
   const typeId = resolveTypeId(resolved.region);
   return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:elem="http://svc.kp.org/hp_admn/mbr_admn/member_termination/v1/Elements/" xmlns:typ="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/Types/" xmlns:ent="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/Entity/" xmlns:mem="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/Membership/">
   <soapenv:Header>
      <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
         <wsse:UsernameToken wsu:Id="UsernameToken-23994247" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
            <wsse:Username>${username}</wsse:Username>
            <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${password}</wsse:Password>
            <wsse:Nonce>vGnbKL0rRFZx1sf4O+taWQ==</wsse:Nonce>
            <wsu:Created>2012-07-17T07:08:43.599Z</wsu:Created>
         </wsse:UsernameToken>
      </wsse:Security>
   </soapenv:Header>
   <soapenv:Body>
      <elem:terminateMemberRequestMessage>
         <header>
            <header>
               <MessageDateTime>${messageDateTime}</MessageDateTime>
               <SenderTrnsDetails>
                  <Name>test</Name>
                  <TransactionId>test</TransactionId>
                  <userIdInfo>
                     <typ:id>test</typ:id>
                  </userIdInfo>
                  <applicationIdInfo>
                     <typ:id>CM</typ:id>
                  </applicationIdInfo>
               </SenderTrnsDetails>
               <ReceiverTrnsDetails>
                  <Name>test</Name>
                  <TransactionId>test</TransactionId>
                  <AdditionalDetails>
                     <AddDetailName>EnvironmentCode</AddDetailName>
                     <AddDetailValue>${resolved.environmentCode}</AddDetailValue>
                  </AdditionalDetails>
               </ReceiverTrnsDetails>
            </header>
         </header>
         <region>
            <regionCode>
               <typeId>${typeId}</typeId>
               <code>${resolved.regionCode}</code>
            </regionCode>
         </region>
         <terminateMemberReqMsg>
            <person>
               <personId>
                  <assigningOrganization>
                     <ent:typeId>${typeId}</ent:typeId>
                     <code>${resolved.regionCode}</code>
                  </assigningOrganization>
                  <id>${mrn}</id>
               </personId>
            </person>
            <terminationInfo>
               <terminateMembershipIdentifiers>
                  <groupId>
                     <id>${resolved.groupId}</id>
                  </groupId>
                  <subgroupId>
                     <id>${resolved.subgroupId}</id>
                  </subgroupId>
                  <familyId>
                     <subscriberId>
                        <mem:id>
                           <assigningOrganization>
                              <ent:typeId>${typeId}</ent:typeId>
                              <code>${resolved.regionCode}</code>
                           </assigningOrganization>
                           <id>${mrn}</id>
                        </mem:id>
                     </subscriberId>
                  </familyId>
               </terminateMembershipIdentifiers>
               <terminateReasonCode>CancelBaby</terminateReasonCode>
               <requestedTermDate>${resolved.terminationDate}</requestedTermDate>
            </terminationInfo>
            <terminateRequestCategoryCode>MemberOnly</terminateRequestCategoryCode>
            <terminateRequestTypeCode>TerminateEffectiveCoverage</terminateRequestTypeCode>
         </terminateMemberReqMsg>
      </elem:terminateMemberRequestMessage>
      <elem1:enrollMemberRequestMessage xmlns:elem1="http://svc.kp.org/hp_admn/mbr_admn/member_enrollment/v1/Elements/"/>
   </soapenv:Body>
</soapenv:Envelope>`;
}

// No Coverage cancellation envelope for MAS / NCAL / SCAL (gateway endpoint). `enrollData` is the parsed
// enrollment response; it omits familySequenceNum, so '1' (a new single-subscriber family) is used.
function buildNoCoverageTerminateMemberXML(resolved, ctx, mrn, enrollData = {}) {
   const { username, password, messageDateTime } = ctx;
   // MAS has no person ID partition.
   const idPartition = CAL_ID_PARTITION[resolved.region] ? `<idPartition>${CAL_ID_PARTITION[resolved.region]}</idPartition>` : '';
   return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
   <soapenv:Header>
      <wsse:Security soapenv:mustUnderstand="0" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
         <wsse:UsernameToken wsu:Id="UsernameToken-19328307" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
            <wsse:Username>${username}</wsse:Username>
            <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${password}</wsse:Password>
            <wsse:Nonce>vGnbKL0rRFZx1sf4O+taWQ==</wsse:Nonce>
            <wsu:Created>2012-07-17T07:08:43.599Z</wsu:Created>
         </wsse:UsernameToken>
      </wsse:Security>
   </soapenv:Header>
   <soapenv:Body>
      <ns5:terminateMemberRequestMessage xmlns:ns2="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/Types/" xmlns:ns3="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/Entity/" xmlns:ns4="http://svc.kp.org/hp_admn/mbr_admn/canonicalCommon/Membership/" xmlns:ns5="http://svc.kp.org/hp_admn/mbr_admn/member_termination/v1/Elements/">
         <header>
            <header>
               <MessageDateTime>${messageDateTime}</MessageDateTime>
               <SenderTrnsDetails>
                  <Name>T4.B_Medicare Enrollment_Terminate_Medicare Dis-enrollment</Name>
                  <TransactionId>14650323</TransactionId>
                  <userIdInfo>
                     <ns2:id>MBEBATCH</ns2:id>
                  </userIdInfo>
                  <applicationIdInfo>
                     <ns2:id>MBE</ns2:id>
                  </applicationIdInfo>
                  <AdditionalDetails>
                     <AddDetailName>EnvironmentCode</AddDetailName>
                     <AddDetailValue>${resolved.environmentCode}</AddDetailValue>
                  </AdditionalDetails>
               </SenderTrnsDetails>
               <ReceiverTrnsDetails>
                  <Name>terminateMemberRequestMessage</Name>
                  <TransactionId>20200717232722</TransactionId>
                  <transactionTypeCode>Terminate</transactionTypeCode>
                  <applicationIdInfo>
                     <ns2:id>KPFS</ns2:id>
                  </applicationIdInfo>
                  <AdditionalDetails>
                     <AddDetailName>EnvironmentCode</AddDetailName>
                     <AddDetailValue>${resolved.environmentCode}</AddDetailValue>
                  </AdditionalDetails>
               </ReceiverTrnsDetails>
            </header>
         </header>
         <region>
            <regionCode>
               <code>${resolved.regionCode}</code>
            </regionCode>
         </region>
         <terminateMemberReqMsg>
            <person>
               <personId>
                  <assigningOrganization>
                     <code>${resolved.regionCode}</code>
                  </assigningOrganization>
                  <id>${mrn}</id>
                  ${idPartition}
                  <idType>MRN</idType>
               </personId>
            </person>
            <terminationInfo>
               <terminateMembershipIdentifiers>
                  <groupId>
                     <id>${resolved.groupId}</id>
                  </groupId>
                  <subgroupId>
                     <id>${resolved.subgroupId}</id>
                  </subgroupId>
                  <familyId>
                     <familySequenceNum>${enrollData.familySequenceNum || '1'}</familySequenceNum>
                     <subscriberId>
                        <ns4:id>
                           <assigningOrganization>
                              <code>${resolved.regionCode}</code>
                           </assigningOrganization>
                           <id>${mrn}</id>
                           ${idPartition}
                           <idType>MRN</idType>
                        </ns4:id>
                        <lastName>${resolved.lastName}</lastName>
                        <firstName>${resolved.firstName}</firstName>
                     </subscriberId>
                  </familyId>
                  <membershipSeqNum>${enrollData.membershipSeqNum || '1'}</membershipSeqNum>
               </terminateMembershipIdentifiers>
               <terminateReasonCode>MbrRqstd</terminateReasonCode>
               <requestedTermDate>${resolved.terminationDate}</requestedTermDate>
            </terminationInfo>
            <terminateRequestCategoryCode>SubscriberAndFamily</terminateRequestCategoryCode>
            <terminateRequestTypeCode>TerminateEffectiveCoverage</terminateRequestTypeCode>
         </terminateMemberReqMsg>
      </ns5:terminateMemberRequestMessage>
   </soapenv:Body>
</soapenv:Envelope>`;
}

function phoneDisplay(phone) {
   return `(${phone.areaCode}) ${phone.number.slice(0, 3)}-${phone.number.slice(3)}`;
}

// Pick the response format strictly from params.responseFormat. This is
// independent of memberType / coverageTiming — a teen subscriber with a
// concise-style prompt should still get the concise output, etc.
function formatSuccessMessage(r, mrn, params, secondaryName = null) {
   const format = params.responseFormat;
   const timingWord = isFutureDate(r.coverageEffectiveDate) ? 'pre-effective' : 'active';
   const isTerminated = r.coverageTiming === 'terminated';

   if (isTerminated && (!format || format === 'minimal')) {
      return `The Terminated adult Subscriber MRN has been successfully created with **${r.coverageName}** coverage in the **${r.region}** region.\n\n`
         + `- Coverage Effective Start Date: **${r.coverageEffectiveDate}**\n`
         + `- Coverage Effective End Date: **${r.terminationDate}**\n\n`
         + `Generated Subscriber MRN: **${mrn}**`;
   }

   if (secondaryName && (!format || format === 'minimal')) {
      return `The dual coverage adult Subscriber MRN has been successfully created in the **${r.region}** region.\n\n`
         + `- Primary Coverage: **${r.coverageName}** (${timingWord}, effective ${r.coverageEffectiveDate})\n`
         + `- Secondary Coverage: **${secondaryName}**\n\n`
         + `Generated Subscriber MRN: **${mrn}**`;
   }

   // Prompt 6: teen — only when the prompt itself is the bare teen one-liner style.
   if (format === 'teen') {
      return `The Teen MRN **${mrn}** is successfully created in **${r.region}** region **${r.environment}** environment.\n\n`
         + `**Demographics:**\n`
         + `- Last Name, First Name: ${r.lastName}, ${r.firstName}\n`
         + `- DOB: ${r.dateOfBirth}`;
   }

   // Prompt 3: pre-effective (future-dated) member
   if (r.hasCoverage && (format === 'preEffective' || r.coverageTiming === 'preEffective')) {
      return `A new pre-effective (future-dated) subscriber member is successfully created with **${r.coverageName}** coverage in the **${r.region}** region, effective **${r.coverageEffectiveDate}**.\n\n`
         + `Generated Subscriber MRN: **${mrn}**`;
   }

   // Prompt 2: detailed — full details including contact details
   if (format === 'detailed') {
      const addressParts = [r.addressLine1, r.addressLine2].filter(Boolean).join(', ');
      return `A new Subscriber MRN is successfully created in **${r.environment}** for **${r.firstName} ${r.lastName}**.\n\n`
         + `- **MRN**: ${mrn}\n`
         + `- **Region**: ${r.region}\n`
         + `- **Date of Birth**: ${r.dateOfBirth}\n`
         + `- **Gender**: ${r.gender}\n`
         + `- **SSN**: ${r.ssn}\n`
         + (isTerminated
            ? `- Coverage under **${r.coverageName}** was effective ${r.coverageEffectiveDate} and is **terminated** as of ${r.terminationDate}\n\n`
            : r.hasCoverage
               ? `- Coverage under **${r.coverageName}** is **${timingWord}** effective ${r.coverageEffectiveDate}\n\n`
               : `- **No Coverage** (Non-Member Patient) — no coverage enrollment was created\n\n`)
         + `Address: **${addressParts}**, City: **${r.city}**, Zip Code: **${r.postalCode}**, and Phone Number **${phoneDisplay(r.phone)}** have been **captured and saved successfully**.\n\n`
         + `The subscriber record is created successfully with complete demographics and ${isTerminated ? 'terminated coverage' : r.hasCoverage ? `${timingWord} coverage` : 'no coverage'}, and a **unique MRN has been generated and assigned.**`;
   }

   // Prompt 5: grouped — sectioned output with demographics
   if (format === 'grouped') {
      return `Subscriber MRN has been successfully created.\n\n`
         + `MRN: **${mrn}**\n\n`
         + `**Subscriber Details:**\n`
         + `- Name: ${r.firstName} ${r.lastName}\n`
         + `- Date of Birth: ${r.dateOfBirth}\n`
         + `- Gender: ${r.gender}\n`
         + `- Region: ${r.region}\n\n`
         + `**Coverage Details:**\n`
         + (isTerminated
            ? `- Plan: ${r.coverageName}\n`
            + `- Coverage Effective Date: ${r.coverageEffectiveDate}\n`
            + `- Coverage Termination Date: ${r.terminationDate}\n`
            + `- Coverage Status: Terminated\n\n`
            : r.hasCoverage
               ? `- Plan: ${r.coverageName}\n`
               + `- Coverage Effective Date: ${r.coverageEffectiveDate}\n`
               + `- Coverage Status: ${timingWord === 'pre-effective' ? 'Pre-Effective' : 'Active'}\n\n`
               : `- Plan: No Coverage (Non-Member Patient)\n`
               + `- Coverage Status: None\n\n`)
         + `**Demographics:**\n`
         + `- Address: ${r.addressLine1}\n`
         + `- City: ${r.city}\n`
         + `- State: ${r.state}\n`
         + `- Zip Code: ${r.postalCode}\n`
         + `- Phone Number: ${phoneDisplay(r.phone)}`;
   }

   // Prompt 1: concise — name shown, coverage summary
   if (format === 'concise') {
      return `Subscriber MRN has been successfully created in **${r.environment}** for **${r.firstName} ${r.lastName}**.\n\n`
         + `MRN: **${mrn}**\n\n`
         + (isTerminated
            ? `Coverage **${r.coverageName}** was effective **${r.coverageEffectiveDate}** and is **terminated** as of **${r.terminationDate}**.`
            : r.hasCoverage
               ? `Coverage **${r.coverageName}** is **${timingWord}** effective **${r.coverageEffectiveDate}**.`
               : `No coverage enrollment was created (Non-Member Patient).`)
         + ` Demographics and address details have been saved successfully.`;
   }

   // Prompt 4: minimal (default)
   const coveragePhrase = r.hasCoverage ? `${timingWord} **${r.coverageName}** coverage` : `**No Coverage** (Non-Member Patient)`;
   return `The adult Subscriber MRN has been successfully created with ${coveragePhrase} in the **${r.region}** region.\n\n`
      + `Generated Subscriber MRN: **${mrn}**`;
}

async function parseSOAPResponse(xmlText) {
   const parser = new xml2js.Parser({ explicitArray: false, tagNameProcessors: [xml2js.processors.stripPrefix] });
   try {
      const result = await parser.parseStringPromise(xmlText);

      if (result.Envelope?.Body?.Fault) {
         const fault = result.Envelope.Body.Fault;
         const businessException = fault.detail?.businessExceptionElement;
         const systemException = fault.detail?.systemExceptionElement;
         const ex = businessException || systemException;

         const otherInfo = ex?.OtherInfo;
         const otherInfoArray = Array.isArray(otherInfo) ? otherInfo : (otherInfo ? [otherInfo] : []);
         const errorDetail = otherInfoArray.length > 0
            ? otherInfoArray.map(info => `${info.Name}: ${info.Value}`).join('; ')
            : ex?.ExceptionDetail?.ExceptionDescription;

         return {
            success: false,
            error: {
               faultCode: fault.faultcode,
               faultString: fault.faultstring,
               exceptionCode: ex?.ExceptionDetail?.ExceptionCode,
               exceptionDescription: ex?.ExceptionDetail?.ExceptionDescription,
               exceptionType: ex?.ExceptionType,
               errorDetail
            }
         };
      }

      const responseMessage = result.Envelope?.Body?.enrollMemberResponseMessage;
      if (responseMessage) {
         const rsp = responseMessage.enrollMemberRspMsg;
         const personId = rsp?.personId || rsp?.person?.personId;
         const mrn = personId?.id;
         // MAS / CAL family linkage: the subscriber response carries the real family sequence
         // number (membershipIdentifiers.familyId) and the backend-assigned effective
         // date (membershipIdentifiers.startEndDate.beginDate, which may differ from what
         // was sent). Every dependent must echo both. Absent for Common Membership responses.
         const familySequenceNum = rsp?.membershipIdentifiers?.familyId?.familySequenceNum;
         const effectiveBeginDate = rsp?.membershipIdentifiers?.startEndDate?.beginDate;
         const membershipSeqNum = rsp?.membershipIdentifiers?.membershipSeqNum;
         return {
            success: true,
            data: { mrn, familySequenceNum, effectiveBeginDate, membershipSeqNum }
         };
      }

      if (result.Envelope?.Body?.terminateMemberResponseMessage) {
         return { success: true, data: {} };
      }

      return {
         success: false,
         error: { faultString: 'Unknown response format' }
      };
   } catch (error) {
      return {
         success: false,
         error: { faultString: 'Failed to parse XML response', details: error.message }
      };
   }
}

// Returns { secondary: null } when none was requested, { secondary } when valid, or { error }.
function resolveSecondaryCoverage(region, primaryKey, secondaryCoverageName, environmentName) {
   if (!secondaryCoverageName) return { secondary: null };
   const secondaryKey = normalizeCoverageName(secondaryCoverageName);
   if (secondaryKey === 'NO_COVERAGE') {
      return { error: `Secondary coverage cannot be No Coverage (Non-Member Patient).` };
   }
   if (secondaryKey === normalizeCoverageName(primaryKey)) {
      return { error: `Primary and secondary coverage must be different (both were ${secondaryKey}).` };
   }
   const result = resolveRegionCoverage(region, secondaryKey, environmentName);
   if (result.error) return { error: `Secondary coverage: ${result.error}` };
   return { secondary: { name: secondaryKey, ...result.coverage } };
}

function buildEnrollXml(resolved, ctx) {
   const isDependent = resolved.relation !== 'Subscriber';
   if (resolved.region === 'MAS') {
      return isDependent ? buildMasDependentEnrollMemberXML(resolved, ctx) : buildMasEnrollMemberXML(resolved, ctx);
   }
   if (CAL_REGIONS.has(resolved.region)) {
      return isDependent ? buildCalDependentEnrollMemberXML(resolved, ctx) : buildCalEnrollMemberXML(resolved, ctx);
   }
   return buildEnrollMemberXML(resolved, ctx);
}

// Dual coverage: re-enroll an already-created member (same demographics/SSN) under a second
// coverage by sending its MRN as personId. A Common Membership subscriber must also send the MRN
// as familyId.subscriberId, or the backend rejects it with CM0376 "HRN AND SUBSCRIBER SHOULD BE THE SAME".
async function addSecondaryCoverage(resolved, ctx, mrn, secondary) {
   const secondaryResolved = {
      ...resolved,
      personId: String(mrn),
      ...(resolved.relation === 'Subscriber' && { familySubscriberId: String(mrn) }),
      coverageName: secondary.name,
      groupId: secondary.groupId,
      subgroupId: secondary.subgroupId,
      billGroupId: secondary.billGroupId
   };
   try {
      const response = await fetch(CAL_REGIONS.has(resolved.region) ? CAL_MRN_ENDPOINT : MRN_ENDPOINT, {
         method: 'POST',
         headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': ''
         },
         body: buildEnrollXml(secondaryResolved, ctx)
      });
      const xmlText = await response.text();

      console.log(JSON.stringify({
         kpmsg: {
            id: 'AI_PORTAL_NOTEBOOK',
            name: 'addSecondaryCoverage',
            detail: { status: response.status, region: resolved.region, relation: resolved.relation, mrn, coverage: secondary.name }
         }
      }));

      const parsed = await parseSOAPResponse(xmlText);
      if (parsed.success) return { success: true };
      return {
         success: false,
         error: parsed.error?.errorDetail
            || parsed.error?.exceptionDescription
            || parsed.error?.faultString
            || 'Unknown enrollment failure'
      };
   } catch (error) {
      console.error(JSON.stringify({
         kpmsg: {
            id: 'AI_PORTAL_NOTEBOOK',
            name: 'addSecondaryCoverage',
            detail: { mrn, coverage: secondary.name, error: error.message }
         }
      }));
      return { success: false, error: error.message };
   }
}

async function terminateCoverage(resolved, ctx, mrn, enrollData, cancelsNoCoverage = false) {
   try {
      const response = await fetch(cancelsNoCoverage ? GATEWAY_TERMINATION_ENDPOINT : TERMINATION_ENDPOINT, {
         method: 'POST',
         headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': ''
         },
         body: cancelsNoCoverage
            ? buildNoCoverageTerminateMemberXML(resolved, ctx, mrn, enrollData)
            : buildTerminateMemberXML(resolved, ctx, mrn)
      });
      const xmlText = await response.text();

      console.log(JSON.stringify({
         kpmsg: {
            id: 'AI_PORTAL_NOTEBOOK',
            name: 'terminateCoverage',
            detail: { status: response.status, region: resolved.region, mrn, coverage: resolved.coverageName, terminationDate: resolved.terminationDate }
         }
      }));

      const parsed = await parseSOAPResponse(xmlText);
      if (parsed.success) return { success: true };
      return {
         success: false,
         error: parsed.error?.errorDetail
            || parsed.error?.exceptionDescription
            || parsed.error?.faultString
            || 'Unknown termination failure'
      };
   } catch (error) {
      console.error(JSON.stringify({
         kpmsg: {
            id: 'AI_PORTAL_NOTEBOOK',
            name: 'terminateCoverage',
            detail: { mrn, coverage: resolved.coverageName, error: error.message }
         }
      }));
      return { success: false, error: error.message };
   }
}

/**
 * Create a Subscriber MRN by calling the SOAP MemberEnrollment service.
 * Returns a JSON-serializable summary suitable for returning to an LLM tool call.
 */
export async function createSubscriberMRN(params) {
   if (!params?.region) {
      return { success: false, error: 'Region is required (e.g., CO, NW, HI, GA, MAS, NCAL, SCAL).' };
   }
   const region = String(params.region).toUpperCase();
   const envResult = resolveRegionEnvironment(region, params.environment);
   if (envResult.error) {
      return { success: false, error: envResult.error };
   }
   const coverageKey = normalizeCoverageName(params.coverageName);
   const coverageResult = resolveRegionCoverage(region, coverageKey, envResult.value);
   if (coverageResult.error) {
      return { success: false, error: coverageResult.error };
   }
   let secondaryCoverage = null;
   if (params.secondaryCoverageName) {
      const secondaryCheck = resolveSecondaryCoverage(region, coverageKey, params.secondaryCoverageName, envResult.value);
      if (secondaryCheck.error) {
         return { success: false, error: secondaryCheck.error };
      }
      secondaryCoverage = secondaryCheck.secondary;
   }
   const kphcResult = resolveKphcOption(region, envResult.value, params.kphcEnv);
   if (kphcResult.error) {
      return { success: false, error: kphcResult.error };
   }
   const cancelsCoverage = coverageKey === 'NO_COVERAGE' && CANCELLED_NO_COVERAGE_REGIONS.has(region);
   if (cancelsCoverage) {
      if (params.relation && params.relation !== 'Subscriber') {
         return { success: false, error: `No Coverage (Non-Member Patient) in region ${region} is only available for an individual Subscriber.` };
      }
      if (secondaryCoverage) {
         return { success: false, error: 'No Coverage (Non-Member Patient) cannot be combined with dual coverage.' };
      }
   }
   const isTerminated = params.coverageTiming === 'terminated';
   if (isTerminated) {
      if (!TERMINATION_REGIONS.has(region)) {
         return { success: false, error: `Terminated coverage is not supported for region ${region}. Supported regions: ${[...TERMINATION_REGIONS].join(', ')}.` };
      }
      if (coverageKey === 'NO_COVERAGE') {
         return { success: false, error: 'Terminated coverage requires a coverage plan; it cannot be combined with No Coverage (Non-Member Patient).' };
      }
      if (secondaryCoverage) {
         return { success: false, error: 'Terminated coverage cannot be combined with dual coverage.' };
      }
      if (params.terminationDate && !/^\d{4}-\d{2}-\d{2}$/.test(normalizeDate(params.terminationDate))) {
         return { success: false, error: `Invalid termination date '${params.terminationDate}'. Use YYYY-MM-DD or MM/DD/YYYY.` };
      }
   }

   const resolvedParams = {
      ...params,
      environment: envResult.value,
      kphcEnv: kphcResult.option?.kphcEnv,
      kphcRule: kphcResult.option?.rule || null
   };

   const { resolved, ctx } = resolveEnrollmentContext(resolvedParams);
   if (isTerminated && params.terminationDate && normalizeDate(params.terminationDate) <= resolved.coverageEffectiveDate) {
      return { success: false, error: `Termination date ${params.terminationDate} must be after the coverage start date ${resolved.coverageEffectiveDate}.` };
   }
   const isCal = CAL_REGIONS.has(resolved.region);
   const isCommonMembership = !isCal && resolved.region !== 'MAS';
   const xml = buildEnrollXml(resolved, ctx);
   try {
      const response = await fetch(isCal ? CAL_MRN_ENDPOINT : MRN_ENDPOINT, {
         method: 'POST',
         headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': ''
         },
         body: xml
      });
      const xmlText = await response.text();

      console.log(JSON.stringify({
         kpmsg: {
            id: 'AI_PORTAL_NOTEBOOK',
            name: 'createSubscriberMRN',
            detail: {
               status: response.status,
               region: resolved.region,
               coverage: resolved.coverageName,
               kphcEnv: resolved.kphcEnv,
               ...(isCommonMembership && {
                  relation: resolved.relation,
                  requestedGender: params.gender ?? null,
                  submittedGender: resolved.gender
               })
            }
         }
      }));

      const parsed = await parseSOAPResponse(xmlText);

      if (parsed.success) {
         const mrn = parsed.data.mrn;
         if (isTerminated || cancelsCoverage) {
            // The backend may assign a different start date than was sent; termination must follow it.
            const backendStart = String(parsed.data.effectiveBeginDate || '').slice(0, 10);
            const coverageStart = /^\d{4}-\d{2}-\d{2}$/.test(backendStart) ? backendStart : resolved.coverageEffectiveDate;
            resolved.coverageEffectiveDate = coverageStart;
            resolved.terminationDate = cancelsCoverage
               ? coverageStart
               : normalizeDate(params.terminationDate) || defaultTerminationDate(coverageStart);
            if (isTerminated && resolved.terminationDate <= coverageStart) {
               return {
                  success: false,
                  mrn,
                  error: `Subscriber MRN ${mrn} was created with ${resolved.coverageName} coverage starting ${coverageStart}, but the termination date ${resolved.terminationDate} must be after the coverage start date.`,
                  resolved
               };
            }
            const terminationResult = await terminateCoverage(resolved, ctx, mrn, parsed.data, cancelsCoverage);
            if (!terminationResult.success) {
               return {
                  success: false,
                  mrn,
                  error: cancelsCoverage
                     ? `Subscriber MRN ${mrn} was created, but cancelling its placeholder HMO enrollment to leave it with No Coverage failed: ${terminationResult.error}`
                     : `Subscriber MRN ${mrn} was created with ${resolved.coverageName} coverage, but terminating the coverage failed: ${terminationResult.error}`,
                  resolved
               };
            }
         }
         let formattedMessage = formatSuccessMessage(resolved, mrn, params, secondaryCoverage?.name);
         if (secondaryCoverage) {
            const secondaryResult = await addSecondaryCoverage(resolved, ctx, mrn, secondaryCoverage);
            if (!secondaryResult.success) {
               return {
                  success: false,
                  mrn,
                  error: `Subscriber MRN ${mrn} was created with ${resolved.coverageName} coverage, but adding secondary ${secondaryCoverage.name} coverage failed: ${secondaryResult.error}`,
                  resolved
               };
            }
            if (params.responseFormat && params.responseFormat !== 'minimal') {
               formattedMessage += `\n\nSecondary coverage **${secondaryCoverage.name}** has been added to MRN **${mrn}**.`;
            }
         }
         return {
            success: true,
            mrn,
            familySequenceNum: parsed.data.familySequenceNum,
            effectiveDate: parsed.data.effectiveBeginDate,
            terminationDate: resolved.terminationDate || null,
            secondaryCoverageName: secondaryCoverage?.name || null,
            resolved,
            formattedMessage
         };
      }
      return {
         success: false,
         error: parsed.error?.errorDetail
            || parsed.error?.exceptionDescription
            || parsed.error?.faultString
            || 'Unknown enrollment failure',
         details: parsed.error,
         resolved
      };
   } catch (error) {
      console.error(JSON.stringify({
         kpmsg: {
            id: 'AI_PORTAL_NOTEBOOK',
            name: 'createSubscriberMRN',
            detail: { error: error.message }
         }
      }));
      return { success: false, error: error.message, resolved };
   }
}

// Merge shared family-level params (region, coverage, address, etc.) with per-member overrides.
// Per-member fields (memberOverrides) always win. Address/phone from the shared block is only
// applied if the member does not supply their own value.
function buildMemberParams(shared, memberOverrides, extras) {
   return {
      region: shared.region,
      coverageName: shared.coverageName,
      coverageEffectiveDate: shared.coverageEffectiveDate,
      coverageTiming: shared.coverageTiming,
      secondaryCoverageName: shared.secondaryCoverageName,
      environment: shared.environment,
      environmentCode: shared.environmentCode,
      kphcEnv: shared.kphcEnv,
      addressLine1: shared.addressLine1,
      addressLine2: shared.addressLine2,
      city: shared.city,
      state: shared.state,
      postalCode: shared.postalCode,
      phoneNumber: shared.phoneNumber,
      ...memberOverrides,
      ...extras
   };
}

function formatFamilySuccessMessage(results) {
   const subscriberEntry = results.find(x => x.role === 'Subscriber');
   const dependents = results.filter(x => x.role !== 'Subscriber');
   const subscriber = subscriberEntry?.result;

   if (!subscriber?.success) {
      return `Family MRN creation failed: the primary subscriber could not be created (${subscriber?.error || 'unknown error'}).`;
   }

   const dependentParts = dependents.map(({ role, result }) => {
      if (result.success && result.mrn) {
         return `**${result.mrn}** (${role})`;
      }
      return `_failed_ (${role}: ${result.error || 'unknown error'})`;
   });

   const r = subscriber.resolved;
   const timingWord = isFutureDate(r.coverageEffectiveDate) ? 'pre-effective' : 'active';
   const dependentLabel = dependents.length === 1 ? 'Dependent MRN' : 'Dependent MRNs';

   // Two trailing spaces before \n = Markdown hard line break (no paragraph gap).
   const br = '  \n';
   const lines = [
      `Family MRNs are successfully created.`,
      `Membership Environment: **${r.environment}**`,
      `Subscriber MRN: **${subscriber.mrn}**`
   ];
   if (dependents.length > 0) {
      lines.push(`${dependentLabel}: ${dependentParts.join(', ')}`);
   }
   lines.push(
      `Region: **${r.region}**`,
      `Coverage under **${r.coverageName}** is **${timingWord}** effective from **${r.coverageEffectiveDate}**.`
   );
   if (subscriber.secondaryCoverageName) {
      lines.push(`Secondary coverage **${subscriber.secondaryCoverageName}** has been added to each successfully created member.`);
   }
   lines.push(
      `Address, phone, demographics, coverage, and relationship details have been captured and saved successfully.`
   );
   return lines.join(br);
}

// Family composition options control which dependents are created alongside the Subscriber.
const FAMILY_COMPOSITIONS = {
   subscriber_spouse: { spouse: true, teen: false, child: false },
   subscriber_child: { spouse: false, teen: false, child: true },
   subscriber_teen: { spouse: false, teen: true, child: false },
   subscriber_spouse_child: { spouse: true, teen: false, child: true },
   subscriber_spouse_teen: { spouse: true, teen: true, child: false },
   subscriber_spouse_teen_child: { spouse: true, teen: true, child: true }
};

/**
 * Create a family of Subscriber MRNs via sequential SOAP calls.
 * The Subscriber is always created first; its MRN is then passed as `subscriberMRN` when
 * creating each dependent so the SOAP service links them under the same family.
 *
 * `params.familyComposition` controls which dependents are created (in addition to the
 * Subscriber). Supported values: subscriber_spouse, subscriber_child, subscriber_teen,
 * subscriber_spouse_child, subscriber_spouse_teen, subscriber_spouse_teen_child (default).
 */
export async function createFamilyMRN(params) {
   if (!params?.region) {
      return { success: false, error: 'Region is required (e.g., CO, NW, HI, GA, MAS, NCAL, SCAL).' };
   }
   const region = String(params.region).toUpperCase();
   const envResult = resolveRegionEnvironment(region, params.environment);
   if (envResult.error) {
      return { success: false, error: envResult.error };
   }
   const familyCoverageKey = normalizeCoverageName(params?.coverageName);
   if (familyCoverageKey === 'NO_COVERAGE') {
      return { success: false, error: `No Coverage (NMP / Non-Member Patient) is only valid for an individual Subscriber MRN, not a family.` };
   }
   const familyCoverageResult = resolveRegionCoverage(region, familyCoverageKey, envResult.value);
   if (familyCoverageResult.error) {
      return { success: false, error: familyCoverageResult.error };
   }
   const familySecondaryCheck = resolveSecondaryCoverage(region, familyCoverageKey, params.secondaryCoverageName, envResult.value);
   if (familySecondaryCheck.error) {
      return { success: false, error: familySecondaryCheck.error };
   }
   const kphcResult = resolveKphcOption(region, envResult.value, params.kphcEnv);
   if (kphcResult.error) {
      return { success: false, error: kphcResult.error };
   }

   const compositionKey = params.familyComposition || 'subscriber_spouse_teen_child';
   const composition = FAMILY_COMPOSITIONS[compositionKey];
   if (!composition) {
      return {
         success: false,
         error: `familyComposition must be one of: ${Object.keys(FAMILY_COMPOSITIONS).join(', ')} (got '${params.familyComposition}').`
      };
   }

   const shared = {
      region: params.region,
      coverageName: params.coverageName,
      coverageEffectiveDate: params.coverageEffectiveDate,
      coverageTiming: params.coverageTiming,
      secondaryCoverageName: params.secondaryCoverageName,
      environment: envResult.value,
      environmentCode: params.environmentCode,
      kphcEnv: kphcResult.option?.kphcEnv,
      addressLine1: params.addressLine1,
      addressLine2: params.addressLine2,
      city: params.city,
      state: params.state,
      postalCode: params.postalCode,
      phoneNumber: params.phoneNumber
   };

   const subscriberInput = params.subscriber || {};
   const subscriberParams = buildMemberParams(shared, subscriberInput, {
      relation: 'Subscriber',
      memberType: 'adult',
      maritalStatus: subscriberInput.maritalStatus || (composition.spouse ? 'Married' : 'Single')
   });

   const subscriberResult = await createSubscriberMRN(subscriberParams);
   if (!subscriberResult.success) {
      return {
         success: false,
         error: `Failed to create primary subscriber: ${subscriberResult.error}`,
         members: { subscriber: subscriberResult }
      };
   }

   const subscriberMRN = subscriberResult.mrn;
   // Dependents get fully randomized demographics (name/DOB/gender/SSN) and their own
   // otherPersonId (SSN) — only the family linkage (subscriberMRN) and role-specific
   // relation / memberType / maritalStatus are enforced by the family orchestrator.
   // MAS and CAL dependents additionally echo the real family sequence number from the
   // subscriber response (ignored by Common Membership regions). Every dependent also inherits
   // the subscriber's backend-assigned effective date (falls back to the resolved date)
   // so the whole family shares one date the backend already accepted.
   const dependentExtras = {
      subscriberMRN,
      coverageEffectiveDate: subscriberResult.effectiveDate || subscriberResult.resolved.coverageEffectiveDate,
      familySequenceNum: subscriberResult.familySequenceNum
   };

   const dependentJobs = [];
   if (composition.spouse) {
      // Default spouse to opposite gender of the primary subscriber; user-supplied gender wins.
      const spouseInput = params.spouse || {};
      const oppositeGender = subscriberResult.resolved.gender === 'F' ? 'M' : 'F';
      const subscriberAge = calculateAge(subscriberResult.resolved.dateOfBirth);
      const spouseParams = buildMemberParams(shared, spouseInput, {
         relation: 'Spouse',
         memberType: 'adult',
         maritalStatus: 'Married',
         gender: spouseInput.gender || oppositeGender,
         // Only default the spouse DOB when the caller gave neither an explicit DOB nor an age.
         ...(spouseInput.dateOfBirth == null && spouseInput.age == null
            ? { dateOfBirth: generateSpouseDob(subscriberAge) }
            : {}),
         ...dependentExtras
      });
      dependentJobs.push({ role: 'Spouse', key: 'spouse', params: spouseParams });
   }
   if (composition.teen) {
      const teenParams = buildMemberParams(shared, params.teen || {}, {
         relation: 'Child',
         memberType: 'teen',
         maritalStatus: 'Single',
         ...dependentExtras
      });
      dependentJobs.push({ role: 'Teen', key: 'teen', params: teenParams });
   }
   if (composition.child) {
      const childParams = buildMemberParams(shared, params.child || {}, {
         relation: 'Child',
         memberType: 'child',
         maritalStatus: 'Single',
         ...dependentExtras
      });
      dependentJobs.push({ role: 'Child', key: 'child', params: childParams });
   }

   const dependentResults = await Promise.all(
      dependentJobs.map(job => createSubscriberMRN(job.params))
   );

   const results = [
      { role: 'Subscriber', result: subscriberResult },
      ...dependentJobs.map((job, i) => ({ role: job.role, result: dependentResults[i] }))
   ];

   const allSucceeded = results.every(r => r.result.success);
   const formattedMessage = formatFamilySuccessMessage(results);

   const members = { subscriber: subscriberResult };
   dependentJobs.forEach((job, i) => {
      members[job.key] = dependentResults[i];
   });

   const dependentLogDetail = Object.fromEntries(
      dependentJobs.map((job, i) => [`${job.key}MRN`, dependentResults[i].mrn])
   );

   console.log(JSON.stringify({
      kpmsg: {
         id: 'AI_PORTAL_NOTEBOOK',
         name: 'createFamilyMRN',
         detail: {
            region: subscriberResult.resolved.region,
            coverage: subscriberResult.resolved.coverageName,
            composition: compositionKey,
            subscriberMRN,
            ...dependentLogDetail,
            allSucceeded
         }
      }
   }));

   return {
      success: allSucceeded,
      subscriberMRN,
      composition: compositionKey,
      members,
      formattedMessage
   };
}
