'use server';

import { connectToDatabase } from '@/db/connection';
import { chatCompletion } from "@/app/services/chatCompletionService2";

const TOTAL_FUNCTIONALITIES = 71;

const ALL_FUNCTIONALITY_NAMES = [
  "Home Page / Refresh UI / Application Loading", "Search RQR", "Update RQR details & Group Info",
  "CAT Upload", "Change RQR Owner", "Quotes Tab", "Retrieve Quote Details", "Quote Name Update",
  "Population Management Group Search", "Create STU", "Find STU", "Search WI", "Create WI",
  "Create WI - addToExistingWorkItem", "Reassign WI", "Update WI", "Delete WI", "Duplicate WI",
  "Ratebuildup View Backup", "Ratebuildup Backup Comment", "Benefit Adjustment Factor View Backup",
  "Benefit Adjustment Factor Backup Overrides", "Pooling BackUp", "Retention View Backup",
  "Other Benefit View Backup", "Demographic Factor View backup", "Trend Factor", "Inforce Rates",
  "Incurred BackUp", "Member Month Summary", "Fetch Industry Code", "Fetch Zip Code",
  "UnderWriter Adjustment Backup", "UnderWriter Adjustment Backup Overrides",
  "UnderWriter Adjustment Roll Back", "UnderWriter Adjustment Cascade", "Capping View Backup",
  "Capping Override", "Medicare RateBuildup View Backup", "RRC Override", "Update RRC", "CA Blend",
  "RRC Deletion", "Tier Rates View Backup", "TierRates Backup Overrides",
  "Multi quote Incurred Claims Adjustment View Backup", "Multi quote Incurred Claim Adjustment Overrides",
  "Paid claims Upload", "SVCC Backup", "Mark for Sale", "View Sold Plan", "Sold Quote Review",
  "Post Sale Overrides", "Open WI", "Rating", "Work Item Unlock",
  "Update Membership and Transition dates", "Updating Sub-group", "Add RQR to the WI",
  "Remove RQR from the WI", "Rename iteration", "Delete iteration", "Duplicate iteration",
  "Update Rate Summary", "Prospect view Backup", "Revenue Track", "Revenue Untrack",
  "CPQ Complete Suite (CS)", "Load Memory Map", "Area Factor", "MOC Complete Suite (CS)"
];

// Sub-types actually handled by buildScorecardPrompt — this is the closed set
// the LLM intent classifier must return.
const VALID_SUB_TYPES = new Set([
  'OVERVIEW', 'SHORT_SUMMARY', 'FUNCTIONALITY_TREND', 'HIGH_UTIL_TREND',
  'ANOMALY_DETECTION', 'TOP_BOTTOM_N', 'TARGET_EXCEEDED_ANALYSIS',
  'UNMEASURED_ANALYSIS', 'CATEGORY_ANALYSIS', 'DATE_COMPARISON', 'THRESHOLD_ANALYSIS'
]);

// Category labels recognised by categorizeFunc / buildCategorySummary.
const VALID_CATEGORIES = new Set([
  'RQR Management', 'Quote Management', 'Work Item Management', 'Backup Operations',
  'Rating & Rates', 'Underwriter Operations', 'Sales & Revenue', 'STU Operations',
  'Iteration Management', 'Complete Suite', 'Capping', 'Medicare',
  'Navigation & Search', 'Data & Factors'
]);

const CANONICAL_FUNCTIONALITY_SET = new Set(ALL_FUNCTIONALITY_NAMES);

// ═══════════════════════════════════════════════════════════════════
// DATE REFERENCE DETECTOR — prevents date strings from being
// treated as functionality names
// ═══════════════════════════════════════════════════════════════════
function isDateReference(text) {
  if (!text) return false;
  const lower = text.toLowerCase().trim().replace(/[?.!,;:]+$/, '');

  const months = [
    'jan', 'january', 'feb', 'february', 'mar', 'march', 'apr', 'april',
    'may', 'jun', 'june', 'jul', 'july', 'aug', 'august', 'sep', 'september',
    'oct', 'october', 'nov', 'november', 'dec', 'december'
  ];

  const dateTerms = [
    'today', 'yesterday', 'tomorrow', 'last', 'this', 'current', 'past',
    'next', 'previous', 'recent', 'week', 'weeks', 'month', 'months',
    'day', 'days', 'year', 'years', 'ago', 'prior'
  ];

  const words = lower.split(/[\s''\u2019]+/).filter(w => w.length > 0);

  // If ALL words are date-related or numeric → it's a date reference
  const allDateRelated = words.length > 0 && words.every(w => {
    const cleaned = w.replace(/[^a-z0-9]/g, '');
    return months.includes(cleaned) ||
      dateTerms.includes(cleaned) ||
      /^\d{1,4}$/.test(cleaned) ||
      cleaned === '';
  });
  if (allDateRelated) return true;

  // Specific patterns: "feb 2026", "feb'26", "march 2025", "mar26"
  for (const month of months) {
    const patterns = [
      new RegExp(`^${month}['\u2019\\s]*\\d{0,4}$`, 'i'),
      new RegExp(`^\\d{0,4}['\u2019\\s]*${month}$`, 'i'),
      new RegExp(`^${month}$`, 'i'),
    ];
    if (patterns.some(p => p.test(lower))) return true;
  }

  // ISO / US date patterns
  if (/^\d{4}-\d{2}-\d{2}$/.test(lower)) return true;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(lower)) return true;

  // Relative phrases
  if (/^(?:last|this|past|next|previous)\s+\d*\s*(?:day|week|month|year)s?$/i.test(lower)) return true;
  if (/^\d+\s*(?:day|week|month|year)s?$/i.test(lower)) return true;

  return false;
}

// ═══════════════════════════════════════════════════════════════════
// DETECT QUERY SUB-TYPE
// ═══════════════════════════════════════════════════════════════════
function detectScorecardSubType(userPrompt) {
  const lower = userPrompt.toLowerCase().trim().replace(/\bscore\s+card\b/gi, 'scorecard');

  // === THRESHOLD ANALYSIS ===
  const thresholdPatterns = [
    /(?:module|functionalit|feature|component|metric)s?\s+(?:that\s+)?(?:ha[vs]e?\s+)?(?:exceed|exceeding|exceeded|above|over|greater|more)\s*(?:than\s+)?(\d+)%/i,
    /(?:exceed|exceeding|exceeded|above|over|greater|more)\s*(?:than\s+)?(\d+)%\s*(?:of\s+)?(?:target|utilization|threshold)/i,
    /(?:module|functionalit|feature|component|metric)s?\s+.*(?:exceed|exceeding|exceeded|above|over)\s*(\d+)%/i,
  ];
  for (const p of thresholdPatterns) {
    const m = lower.match(p);
    if (m) return { subType: 'THRESHOLD_ANALYSIS', extractedFunctionality: null, threshold: parseInt(m[1], 10) };
  }

  // === ANOMALY / PATTERN DETECTION ===
  const anomalyPatterns = [
    /anomal/i, /concern/i, /pattern/i, /issue/i, /problem/i,
    /unusual/i, /spike/i, /degradation/i, /regression/i,
    /what.*(wrong|issue|problem)/i, /any.*(concern|warning|alert)/i,
    /do you see any/i, /anything.*(worry|concern|flag)/i
  ];
  if (anomalyPatterns.some(p => p.test(lower))) {
    return { subType: 'ANOMALY_DETECTION', extractedFunctionality: null, topN: extractTopN(lower) };
  }

  // === SHORT SUMMARY ===
  if (/\b(short|brief|quick)\s+(summary|overview|report)\b/i.test(lower)) {
    return { subType: 'SHORT_SUMMARY', extractedFunctionality: null };
  }

  // === INSIGHTS / PERFORMANCE TREND (generic) ===
  if (/\b(insight|insights)\b/i.test(lower) || /\bperformance\s+trend\b/i.test(lower)) {
    const ef = extractFunctionalityName(lower);
    if (ef) return { subType: 'FUNCTIONALITY_TREND', extractedFunctionality: ef };
    return { subType: 'OVERVIEW', extractedFunctionality: null };
  }

  // === SCORECARD TREND ===
  if (/\bscorecard\s+trend\b/i.test(lower) || /\btrend\s+(?:for\s+)?(?:last|this|past)/i.test(lower)) {
    const ef = extractFunctionalityName(lower);
    if (ef) return { subType: 'FUNCTIONALITY_TREND', extractedFunctionality: ef };
    return { subType: 'OVERVIEW', extractedFunctionality: null };
  }

  // === TOP / BOTTOM N ===
  const topBottomMatch = lower.match(/(?:top|bottom|worst|best|slowest|fastest|highest|lowest)\s*(\d+)?/i);
  if (topBottomMatch && !lower.includes('trend') && !lower.includes('category')) {
    const n = topBottomMatch[1] ? parseInt(topBottomMatch[1], 10) : 3;
    const direction = /bottom|worst|slowest|highest/i.test(lower) ? 'WORST' : 'BEST';
    return { subType: 'TOP_BOTTOM_N', extractedFunctionality: null, topN: n, direction };
  }

  // === COMPARISON ===
  if ([/compare/i, /vs\.?/i, /versus/i, /difference between/i, /changed from/i, /improvement/i, /deteriorat/i].some(p => p.test(lower))) {
    return { subType: 'DATE_COMPARISON', extractedFunctionality: extractFunctionalityName(lower) };
  }

  // === CATEGORY-SPECIFIC ===
  const categoryKeywords = {
    'RQR Management': ['rqr'], 'Quote Management': ['quote', 'tier rate'],
    'Work Item Management': ['work item', 'wi '], 'Backup Operations': ['backup', 'view backup'],
    'Rating & Rates': ['rate', 'rating', 'rrc'], 'Underwriter Operations': ['underwriter', 'adjustment'],
    'Sales & Revenue': ['sold', 'sale', 'revenue', 'mark for sale'], 'STU Operations': ['stu'],
    'Iteration Management': ['iteration'], 'Complete Suite': ['cpq', 'moc', 'complete suite'],
    'Capping': ['capping'], 'Medicare': ['medicare'],
    'Navigation & Search': ['home', 'loading', 'search', 'fetch'],
    'Data & Factors': ['pooling', 'retention', 'demographic', 'trend factor', 'incurred', 'member month', 'inforce', 'benefit', 'area factor', 'prospect']
  };
  for (const [catName, keywords] of Object.entries(categoryKeywords)) {
    if (lower.includes(catName.toLowerCase()) ||
      lower.match(new RegExp(`\\b(?:${keywords.join('|')})\\b.*(?:category|group|module|section|area)`, 'i')) ||
      lower.match(new RegExp(`(?:category|group|module|section|area).*\\b(?:${keywords.join('|')})\\b`, 'i'))) {
      if (/categor|group|module|section|area|all\s+\w+\s+function/i.test(lower)) {
        return { subType: 'CATEGORY_ANALYSIS', extractedFunctionality: null, extractedCategory: catName };
      }
    }
  }

  // === HIGH UTILIZATION TREND ===
  if (/(?:trend|analysis)\s+(?:for\s+)?(?:high|higher)\s+(?:consumption|utilization)/i.test(lower) ||
    /(?:high|higher)\s+(?:consumption|utilization)\s+(?:trend|analysis)/i.test(lower) ||
    /high\s+utilization/i.test(lower)) {
    return { subType: 'HIGH_UTIL_TREND', extractedFunctionality: null };
  }

  // === Target BREACH ===
  if (/\b(?:exceeded|exceed|exceeding|violation|violated)\b/i.test(lower) && /\b(?:sla|target|threshold)\b/i.test(lower)) {
    return { subType: 'Target_BREACH_ANALYSIS', extractedFunctionality: extractFunctionalityName(lower) };
  }

  // === NO USAGE ===
  if (/\b(?:no usage|not measured|unmeasured|no data|missing|zero|0 value)\b/i.test(lower)) {
    return { subType: 'UNMEASURED_ANALYSIS', extractedFunctionality: null };
  }

  // === FUNCTIONALITY-SPECIFIC ===
  const ef = extractFunctionalityName(lower);
  if (ef) return { subType: 'FUNCTIONALITY_TREND', extractedFunctionality: ef };

  return { subType: 'OVERVIEW', extractedFunctionality: null };
}

function extractTopN(text) {
  const m = text.match(/(?:top|bottom|worst|best)\s+(\d+)/i);
  if (m) return parseInt(m[1], 10);
  const wordMap = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const wm = text.match(/(?:top|bottom|worst|best)\s+(one|two|three|four|five|six|seven|eight|nine|ten)/i);
  if (wm) return wordMap[wm[1].toLowerCase()] || 3;
  return 3;
}

// ═══════════════════════════════════════════════════════════════════
// EXTRACT FUNCTIONALITY NAME
// ═══════════════════════════════════════════════════════════════════
function extractFunctionalityName(lower) {
  let extractedFunctionality = null;
  let m;

  const normalized = lower.replace(/\bscore\s+card\b/gi, 'scorecard');

  for (const funcName of ALL_FUNCTIONALITY_NAMES) {
    if (normalized.includes(funcName.toLowerCase())) return funcName;
  }

  const abbreviations = {
    'search wi': 'Search WI', 'create wi': 'Create WI', 'update wi': 'Update WI', 'delete wi': 'Delete WI',
    'open wi': 'Open WI', 'duplicate wi': 'Duplicate WI', 'reassign wi': 'Reassign WI', 'search rqr': 'Search RQR',
    'cat upload': 'CAT Upload', 'home page': 'Home Page / Refresh UI / Application Loading',
    'application loading': 'Home Page / Refresh UI / Application Loading', 'mark for sale': 'Mark for Sale',
    'ca blend': 'CA Blend', 'rating': 'Rating', 'rrc override': 'RRC Override', 'update rrc': 'Update RRC',
    'rrc deletion': 'RRC Deletion', 'svcc backup': 'SVCC Backup', 'revenue track': 'Revenue Track',
    'revenue untrack': 'Revenue Untrack', 'area factor': 'Area Factor', 'trend factor': 'Trend Factor',
    'inforce rates': 'Inforce Rates', 'load memory map': 'Load Memory Map', 'cpq': 'CPQ Complete Suite (CS)',
    'moc': 'MOC Complete Suite (CS)', 'capping override': 'Capping Override', 'capping view': 'Capping View Backup',
    'pooling': 'Pooling BackUp', 'paid claims': 'Paid claims Upload', 'sold quote': 'Sold Quote Review',
    'view sold': 'View Sold Plan', 'post sale': 'Post Sale Overrides', 'member month': 'Member Month Summary',
    'incurred backup': 'Incurred BackUp', 'retention': 'Retention View Backup', 'prospect': 'Prospect view Backup',
    'demographic': 'Demographic Factor View backup', 'work item unlock': 'Work Item Unlock',
    'quotes tab': 'Quotes Tab', 'retrieve quote': 'Retrieve Quote Details', 'quote name': 'Quote Name Update',
    'tier rates': 'Tier Rates View Backup', 'tierrates': 'TierRates Backup Overrides',
    'medicare': 'Medicare RateBuildup View Backup', 'ratebuildup': 'Ratebuildup View Backup',
    'benefit adjustment': 'Benefit Adjustment Factor View Backup', 'underwriter': 'UnderWriter Adjustment Backup',
    'population management': 'Population Management Group Search', 'create stu': 'Create STU', 'find stu': 'Find STU',
    'rename iteration': 'Rename iteration', 'delete iteration': 'Delete iteration',
    'duplicate iteration': 'Duplicate iteration', 'update rate summary': 'Update Rate Summary',
    'fetch industry': 'Fetch Industry Code', 'fetch zip': 'Fetch Zip Code', 'change rqr': 'Change RQR Owner',
    'update rqr': 'Update RQR details & Group Info', 'add rqr': 'Add RQR to the WI',
    'remove rqr': 'Remove RQR from the WI', 'update membership': 'Update Membership and Transition dates',
    'updating sub': 'Updating Sub-group', 'other benefit': 'Other Benefit View Backup'
  };
  for (const [abbr, fullName] of Object.entries(abbreviations)) {
    if (normalized.includes(abbr)) return fullName;
  }

  m = normalized.match(/^for\s+(?:this\s+)?(.+?)\s*,/i);
  if (m) extractedFunctionality = m[1].trim();

  if (!extractedFunctionality) {
    m = normalized.match(/for\s+(?:this\s+)?(.+?)\s+(?:can you|could you|get me|show me|give me)/i);
    if (m) extractedFunctionality = m[1].trim();
  }

  if (!extractedFunctionality) {
    const trendPatterns = [
      /trend\s+(?:for|of|analysis\s+(?:for|of))\s+(.+?)(?:\s+for\s+|\s*$)/i,
      /how\s+(?:is|has|was)\s+(.+?)\s+(?:performing|trending|doing)/i,
      /consumption\s+(?:for|of)\s+(.+?)(?:\s+for\s+|\s*$)/i,
      /analyze\s+(.+?)\s+(?:performance|trend)/i,
      /(.+?)\s+trend\b/i,
    ];
    for (const p of trendPatterns) {
      m = normalized.match(p);
      if (m) { extractedFunctionality = m[1].trim(); break; }
    }
  }

  if (!extractedFunctionality) {
    m = normalized.match(
      /(?:scorecard|performance)\s*(?:analysis|report|data)?\s+for\s+(.+)\s+for\s+(?:last|today|yesterday|this|current|past|next|\d)/i
    );
    if (m) extractedFunctionality = m[1].trim();
  }

  if (!extractedFunctionality) {
    m = normalized.match(
      /(?:scorecard|performance)\s*(?:analysis|report|data|metrics)?\s+(?:for|of)\s+(.+?)$/i
    );
    if (m) {
      const candidate = m[1].trim().replace(/[?.!,]+$/, '');
      if (!isDateReference(candidate) && candidate.length > 2) {
        extractedFunctionality = candidate;
      }
    }
  }

  if (!extractedFunctionality) {
    m = normalized.match(/^(.+?)\s+(?:scorecard|performance)\s*(?:analysis|report|data)?/i);
    if (m) {
      const candidate = m[1].trim();
      const ignorePhrases = [
        'nps', 'the', 'show', 'get', 'give', 'provide', 'me',
        'overall', 'full', 'complete', 'all', 'entire', 'show me',
        'get me', 'give me', 'can you', 'please'
      ];
      if (!ignorePhrases.includes(candidate.toLowerCase()) && !isDateReference(candidate)) {
        extractedFunctionality = candidate;
      }
    }
  }

  if (extractedFunctionality) {
    extractedFunctionality = extractedFunctionality
      .replace(/[?.!,]+$/, '')
      .replace(/^(the|a|an)\s+/i, '')
      .replace(/^(this|that|these|those)\s+/i, '')
      .trim();

    if (isDateReference(extractedFunctionality)) return null;

    const ignoreWords = new Set([
      'nps', 'show', 'get', 'give', 'provide', 'me', 'all', 'overall', 'full', 'complete', 'entire',
      'can', 'you', 'please', 'i', 'want', 'need', 'a', 'an', 'the', 'my', 'our', 'your', 'could',
      'would', 'should', 'this', 'that', 'these', 'those', 'it', 'its', 'of', 'for', 'in', 'on',
      'to', 'and', 'or', 'with', 'about', 'from', 'by', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'shall', 'may', 'might', 'must',
      'not', 'no', 'so', 'if', 'but', 'as', 'at', 'up', 'application', 'app', 'system', 'data',
      'report', 'analysis', 'scorecard', 'performance', 'metrics', 'dashboard', 'summary',
      'details', 'info', 'information',
      'today', 'yesterday', 'tomorrow', 'last', 'current', 'past', 'next', 'previous', 'recent',
      'week', 'weeks', 'month', 'months', 'day', 'days', 'year', 'years', 'ago', 'prior',
      'jan', 'january', 'feb', 'february', 'mar', 'march', 'apr', 'april', 'may', 'jun', 'june',
      'jul', 'july', 'aug', 'august', 'sep', 'september', 'oct', 'october', 'nov', 'november',
      'dec', 'december'
    ]);

    const words = extractedFunctionality.toLowerCase().split(/[\s''\u2019]+/).filter(w => w.length > 0);
    const allWordsIgnorable = words.length > 0 && words.every(w => {
      const cleaned = w.replace(/[^a-z0-9]/g, '');
      return ignoreWords.has(cleaned) || /^\d+$/.test(cleaned);
    });

    if (allWordsIgnorable || extractedFunctionality.length < 2) {
      extractedFunctionality = null;
    }
  }

  return extractedFunctionality;
}

// ═══════════════════════════════════════════════════════════════════
// FUZZY MATCH
// ═══════════════════════════════════════════════════════════════════
async function fuzzyMatchFunctionality(extractedName) {
  const db = await connectToDatabase('team-nps-db');
  const allFuncNames = await db.collection('NPS_SCORECARD').distinct('Functionality', { type: 'nps_scorecard' });
  const le = extractedName.toLowerCase();
  let match = allFuncNames.find(f => f.toLowerCase() === le);
  if (match) return match;
  match = allFuncNames.find(f => f.toLowerCase().includes(le));
  if (match) return match;
  match = allFuncNames.find(f => le.includes(f.toLowerCase()));
  if (match) return match;
  const words = le.split(/\s+/).filter(w => w.length > 2);
  if (words.length > 0) {
    match = allFuncNames.find(f => words.every(w => f.toLowerCase().includes(w)));
    if (match) return match;
    const threshold = Math.ceil(words.length * 0.6); let best = null, bc = 0;
    for (const f of allFuncNames) { const c = words.filter(w => f.toLowerCase().includes(w)).length; if (c >= threshold && c > bc) { bc = c; best = f; } }
    if (best) return best;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════
// DATE EXTRACTION
// ═══════════════════════════════════════════════════════════════════
async function extractDateRangeFromPrompt(userPrompt, state) {
  const today = new Date(); const todayISO = today.toISOString().substring(0, 10);
  const lower = userPrompt.toLowerCase().replace(/\bscore\s+card\b/gi, 'scorecard');
  function daysAgo(n) { const d = new Date(today); d.setDate(d.getDate() - n); return d.toISOString().substring(0, 10); }

  if (/\btoday\b/.test(lower) || /\bcurrent\s*date\b/.test(lower) || /\btoday'?s?\b/.test(lower)) return { mode: "specific_date", startDate: todayISO, endDate: todayISO, label: "today" };
  if (/\byesterday\b/.test(lower)) { const d = daysAgo(1); return { mode: "specific_date", startDate: d, endDate: d, label: "yesterday" }; }
  if (/\blast\s+day\b/.test(lower) && !/\blast\s+\d+\s+day/i.test(lower)) { const d = daysAgo(1); return { mode: "specific_date", startDate: d, endDate: d, label: "last day" }; }

  let m2 = lower.match(/last\s+(\d+)\s+days?/); if (m2) return { mode: "date_range", startDate: daysAgo(parseInt(m2[1], 10)), endDate: todayISO, label: `last ${m2[1]} days` };
  const wtn = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  let m3 = lower.match(/last\s+(one|two|three|four|five|six|seven|eight|nine|ten)\s+days?/); if (m3) { const n = wtn[m3[1]] || 1; return { mode: "date_range", startDate: daysAgo(n), endDate: todayISO, label: `last ${n} days` }; }

  m2 = lower.match(/last\s+(\d+)\s+weeks?/); if (m2) return { mode: "date_range", startDate: daysAgo(parseInt(m2[1], 10) * 7), endDate: todayISO, label: `last ${m2[1]} weeks` };
  m3 = lower.match(/last\s+(one|two|three|four|five|six|seven|eight|nine|ten)\s+weeks?/); if (m3) { const n = wtn[m3[1]] || 1; return { mode: "date_range", startDate: daysAgo(n * 7), endDate: todayISO, label: `last ${n} weeks` }; }
  if (/\blast\s+week\b/.test(lower) || /\bpast\s+week\b/.test(lower) || /\b1\s+week\b/.test(lower)) return { mode: "date_range", startDate: daysAgo(7), endDate: todayISO, label: "last week" };

  m2 = lower.match(/last\s+(\d+)\s+months?/); if (m2) { const s = new Date(today); s.setMonth(s.getMonth() - parseInt(m2[1], 10)); return { mode: "date_range", startDate: s.toISOString().substring(0, 10), endDate: todayISO, label: `last ${m2[1]} months` }; }
  if (/\blast\s+month\b/.test(lower) || /\bpast\s+month\b/.test(lower)) { const s = new Date(today); s.setMonth(s.getMonth() - 1); return { mode: "date_range", startDate: s.toISOString().substring(0, 10), endDate: todayISO, label: "last month" }; }
  if (/\bthis\s+month\b/.test(lower)) { const s = new Date(today.getFullYear(), today.getMonth(), 1); return { mode: "date_range", startDate: s.toISOString().substring(0, 10), endDate: todayISO, label: "this month" }; }
  if (/\bthis\s+week\b/.test(lower)) { const dow = today.getDay(); const s = new Date(today); s.setDate(s.getDate() - (dow === 0 ? 6 : dow - 1)); return { mode: "date_range", startDate: s.toISOString().substring(0, 10), endDate: todayISO, label: "this week" }; }

  const monthNames = { jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11 };
  for (const [name, monthIdx] of Object.entries(monthNames)) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(lower)) {
      const yearMatch = lower.match(new RegExp(`${name}['\u2019]?\\s*(\\d{2,4})`, 'i'));
      let year = today.getFullYear();
      if (yearMatch) { const yr = parseInt(yearMatch[1], 10); year = yr < 100 ? 2000 + yr : yr; }
      const s = new Date(year, monthIdx, 1); const e = new Date(year, monthIdx + 1, 0);
      const endCapped = e > today ? today : e;
      return { mode: "date_range", startDate: s.toISOString().substring(0, 10), endDate: endCapped.toISOString().substring(0, 10), label: `${name.charAt(0).toUpperCase() + name.slice(1)} ${year}` };
    }
  }

  const isoM = [...userPrompt.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)].map(m => m[1]).sort();
  if (isoM.length === 1) return { mode: "specific_date", startDate: isoM[0], endDate: isoM[0], label: isoM[0] };
  if (isoM.length >= 2) return { mode: "date_range", startDate: isoM[0], endDate: isoM[isoM.length - 1], label: `${isoM[0]} to ${isoM[isoM.length - 1]}` };
  const usM = [...userPrompt.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)].map(m => `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`).sort();
  if (usM.length === 1) return { mode: "specific_date", startDate: usM[0], endDate: usM[0], label: usM[0] };
  if (usM.length >= 2) return { mode: "date_range", startDate: usM[0], endDate: usM[usM.length - 1], label: `${usM[0]} to ${usM[usM.length - 1]}` };

  try {
    // LLM fallback
    const completionConfig = {
      temperature: 0,
      max_tokens: 250,
      model: "gpt-4o",
      messages: [
        { role: "system", content: `You are a date-range extraction assistant. Today is ${todayISO}.\nGiven a user query about NPS scorecard, extract the date range.\nRespond ONLY with valid JSON:\n{"mode":"specific_date"|"date_range"|"all","startDate":"YYYY-MM-DD"|null,"endDate":"YYYY-MM-DD"|null,"label":"description"}\nIf NO date reference → mode "all", both null.` },
        { role: "user", content: userPrompt }
      ],
      teamName: state?.teamName,
      assistantName: state?.assistantName,
      nuid: state?.nuid
    };

    const response = await chatCompletion(completionConfig);
    // const raw = response.choices[0].message.content.replace(/```json|```/g, "").trim();
    const raw = response.replace(/```json|```/g, "").trim();
    const p = JSON.parse(raw);
    return { mode: p.mode || "all", startDate: p.startDate || null, endDate: p.endDate || null, label: p.label || "all available dates" };
  } catch (err) { console.warn('[extractDateRangeFromPrompt] LLM fallback failed:', err.message); }

  return { mode: "all", startDate: null, endDate: null, label: "all available dates" };
}

// ═══════════════════════════════════════════════════════════════════
// MONGODB QUERY & FETCH
// ═══════════════════════════════════════════════════════════════════
function buildDateFilter(dateRange) {
  const base = { type: 'nps_scorecard' };
  if (!dateRange || dateRange.mode === 'all' || (!dateRange.startDate && !dateRange.endDate)) return base;
  if (dateRange.startDate && dateRange.endDate && dateRange.startDate === dateRange.endDate) return { ...base, Current_date_str: dateRange.startDate };
  const cond = {};
  if (dateRange.startDate) cond.$gte = dateRange.startDate;
  if (dateRange.endDate) cond.$lte = dateRange.endDate;
  return Object.keys(cond).length > 0 ? { ...base, Current_date_str: cond } : base;
}

async function fetchScorecardData(dateRange) {
  try {
    const db = await connectToDatabase('team-nps-db');
    const collection = db.collection('NPS_SCORECARD');
    const filter = buildDateFilter(dateRange);
    console.log(`[fetchScorecardData] filter:`, JSON.stringify(filter));
    const records = await collection.find(filter).sort({ Current_date: 1, S_NO: 1 }).toArray();
    console.log(`[fetchScorecardData] ${records.length} records`);
    let availableDates = [];
    if (records.length === 0) { availableDates = await collection.distinct('Current_date_str', { type: 'nps_scorecard' }); availableDates.sort(); }
    return { records, availableDates };
  } catch (e) { console.error('[fetchScorecardData]', e.message); return { records: [], availableDates: [] }; }
}

async function fetchFunctionalityTrend(funcName, dateRange) {
  try {
    const db = await connectToDatabase('team-nps-db');
    const regex = new RegExp(funcName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const filter = { type: 'nps_scorecard', Functionality: regex };
    if (dateRange?.startDate) { filter.Current_date_str = filter.Current_date_str || {}; filter.Current_date_str.$gte = dateRange.startDate; }
    if (dateRange?.endDate) { filter.Current_date_str = filter.Current_date_str || {}; filter.Current_date_str.$lte = dateRange.endDate; }
    return await db.collection('NPS_SCORECARD').find(filter).sort({ Current_date: 1 }).toArray();
  } catch (e) { return []; }
}

async function fetchHighUtilizationTrend(dateRange) {
  try {
    const db = await connectToDatabase('team-nps-db');
    const filter = buildDateFilter(dateRange); filter.Avg_Value = { $gt: 0 };
    const records = await db.collection('NPS_SCORECARD').find(filter).sort({ Current_date: 1, S_NO: 1 }).toArray();
    const highUtil = records.filter(r => r.Target_Value > 0 && ((r.Avg_Value / r.Target_Value) * 100) > 50);
    const funcMap = {}; highUtil.forEach(r => { if (!funcMap[r.Functionality]) funcMap[r.Functionality] = []; funcMap[r.Functionality].push(r); });
    return funcMap;
  } catch (e) { return {}; }
}

// ═══════════════════════════════════════════════════════════════════
// CATEGORIZATION
// ═══════════════════════════════════════════════════════════════════
function categorizeFunc(funcName) {
  const f = (funcName || '').toLowerCase();
  if (f.includes('rqr')) return 'RQR Management';
  if (f.includes('quote') || f.includes('tier rate')) return 'Quote Management';
  if (f.includes('wi') || f.includes('work item')) return 'Work Item Management';
  if (f.includes('backup') || f.includes('view backup')) return 'Backup Operations';
  if (f.includes('rate') || f.includes('rating') || f.includes('rrc')) return 'Rating & Rates';
  if (f.includes('underwriter') || f.includes('adjustment')) return 'Underwriter Operations';
  if (f.includes('sold') || f.includes('sale') || f.includes('revenue') || f.includes('mark for sale')) return 'Sales & Revenue';
  if (f.includes('stu')) return 'STU Operations';
  if (f.includes('iteration')) return 'Iteration Management';
  if (f.includes('cpq') || f.includes('moc') || f.includes('complete suite')) return 'Complete Suite';
  if (f.includes('capping')) return 'Capping';
  if (f.includes('medicare')) return 'Medicare';
  if (f.includes('home') || f.includes('loading') || f.includes('search') || f.includes('fetch')) return 'Navigation & Search';
  if (f.includes('pooling') || f.includes('retention') || f.includes('demographic') || f.includes('trend') || f.includes('incurred') || f.includes('member month') || f.includes('inforce') || f.includes('benefit') || f.includes('area factor') || f.includes('prospect')) return 'Data & Factors';
  return 'Other';
}

function assignCategoryTier(measured, breached, avgUtil) {
  if (measured === 0) return 'No Data';
  if (breached > 0 || avgUtil > 100) return 'Critical';
  if (avgUtil > 60) return 'Acceptable';
  if (avgUtil > 30) return 'Good';
  return 'Excellent';
}

// ═══════════════════════════════════════════════════════════════════
// COMPUTE ANALYTICS
// ═══════════════════════════════════════════════════════════════════
function buildCategorySummary(records) {
  const catMap = {};
  records.forEach(r => { const cat = categorizeFunc(r.Functionality); if (!catMap[cat]) catMap[cat] = []; catMap[cat].push(r); });
  const categorySummary = {};
  Object.entries(catMap).forEach(([cat, items]) => {
    const cm = items.filter(r => r.Avg_Value > 0);
    const cnm = items.filter(r => r.Avg_Value === 0);
    const cb = cm.filter(r => r.Avg_Value > r.Target_Value);
    const cUtil = cm.length > 0 ? cm.reduce((s, r) => s + ((r.Avg_Value / r.Target_Value) * 100), 0) / cm.length : 0;
    const tier = assignCategoryTier(cm.length, cb.length, cUtil);
    categorySummary[cat] = { total: items.length, measured: cm.length, noUsage: cnm.length, avgUtilization: parseFloat(cUtil.toFixed(2)), breached: cb.length, tier };
  });
  return categorySummary;
}

function computePerDateAnalytics(records, dateStr) {
  const measured = records.filter(r => r.Avg_Value > 0);
  const noUsage = records.filter(r => r.Avg_Value === 0);
  const breached = measured.filter(r => r.Avg_Value > r.Target_Value);
  const withinTarget = measured.filter(r => r.Avg_Value <= r.Target_Value);
  const excellent = measured.filter(r => ((r.Avg_Value / r.Target_Value) * 100) <= 30);
  const good = measured.filter(r => { const p = (r.Avg_Value / r.Target_Value) * 100; return p > 30 && p <= 60; });
  const acceptable = measured.filter(r => { const p = (r.Avg_Value / r.Target_Value) * 100; return p > 60 && p <= 100; });
  const breachBucket = measured.filter(r => ((r.Avg_Value / r.Target_Value) * 100) > 100);
  const avgUtil = measured.length > 0 ? measured.reduce((s, r) => s + ((r.Avg_Value / r.Target_Value) * 100), 0) / measured.length : 0;
  const highUtilCount = acceptable.length + breachBucket.length;
  const categorySummary = buildCategorySummary(records);
  const sorted = [...measured].sort((a, b) => (a.Avg_Value / a.Target_Value) - (b.Avg_Value / b.Target_Value));
  const lowest = sorted.length > 0 ? sorted[0] : null;
  const highest = sorted.length > 0 ? sorted[sorted.length - 1] : null;

  return {
    date: dateStr, totalFunctionalities: TOTAL_FUNCTIONALITIES,
    measuredCount: measured.length, noUsageCount: noUsage.length,
    measurementCoverage: parseFloat(((measured.length / TOTAL_FUNCTIONALITIES) * 100).toFixed(1)),
    targetBreachedCount: breached.length, withinTargetCount: withinTarget.length,
    targetComplianceRate: measured.length > 0 ? parseFloat(((withinTarget.length / measured.length) * 100).toFixed(1)) : 100,
    avgUtilizationPct: parseFloat(avgUtil.toFixed(2)), highUtilCount,
    overallHealth: breached.length === 0 ? 'Green (Stable)' : breached.length <= 3 ? 'Yellow (Caution)' : 'Red (Critical)',
    performanceBuckets: {
      excellent: { count: excellent.length, share: measured.length > 0 ? parseFloat(((excellent.length / measured.length) * 100).toFixed(1)) : 0 },
      good: { count: good.length, share: measured.length > 0 ? parseFloat(((good.length / measured.length) * 100).toFixed(1)) : 0 },
      acceptable: { count: acceptable.length, share: measured.length > 0 ? parseFloat(((acceptable.length / measured.length) * 100).toFixed(1)) : 0 },
      breach: { count: breachBucket.length, share: measured.length > 0 ? parseFloat(((breachBucket.length / measured.length) * 100).toFixed(1)) : 0 }
    },
    categorySummary,
    targetBreachedItems: breached.map(r => ({ S_NO: r.S_NO, Functionality: r.Functionality, Target_Value: r.Target_Value, Avg_Value: r.Avg_Value, Overshoot_Sec: parseFloat((r.Avg_Value - r.Target_Value).toFixed(4)), Overshoot_Pct: r.Target_Value > 0 ? parseFloat((((r.Avg_Value - r.Target_Value) / r.Target_Value) * 100).toFixed(2)) : 0 })),
    lowestUtilization: lowest ? { Functionality: lowest.Functionality, Utilization: parseFloat(((lowest.Avg_Value / lowest.Target_Value) * 100).toFixed(2)) } : null,
    highestUtilization: highest ? { Functionality: highest.Functionality, Utilization: parseFloat(((highest.Avg_Value / highest.Target_Value) * 100).toFixed(2)) } : null,
  };
}

function computeAggregatedAnalytics(records) {
  if (!records || records.length === 0) return { hasData: false };
  const dateGroups = {}; records.forEach(r => { const d = r.Current_date_str || 'Unknown'; if (!dateGroups[d]) dateGroups[d] = []; dateGroups[d].push(r); });
  const dateKeys = Object.keys(dateGroups).sort(); const totalDates = dateKeys.length;
  const perDateAnalytics = {}; dateKeys.forEach(d => { perDateAnalytics[d] = computePerDateAnalytics(dateGroups[d], d); });

  const funcAggMap = {};
  records.forEach(r => { if (!funcAggMap[r.Functionality]) funcAggMap[r.Functionality] = { Target_Value: r.Target_Value, S_NO: r.S_NO, values: [], dates: [] }; funcAggMap[r.Functionality].values.push(r.Avg_Value); funcAggMap[r.Functionality].dates.push(r.Current_date_str); });
  const aggRecords = Object.entries(funcAggMap).map(([func, data]) => {
    const mv = data.values.filter(v => v > 0);
    const avgV = mv.length > 0 ? parseFloat((mv.reduce((s, v) => s + v, 0) / mv.length).toFixed(4)) : 0;
    const minV = mv.length > 0 ? Math.min(...mv) : 0; const maxV = mv.length > 0 ? Math.max(...mv) : 0;
    const variance = mv.length > 1 ? mv.reduce((s, v) => s + Math.pow(v - avgV, 2), 0) / mv.length : 0;
    return { S_NO: data.S_NO, Functionality: func, Target_Value: data.Target_Value, Avg_Value: avgV, Min_Value: minV, Max_Value: maxV, Variance: parseFloat(variance.toFixed(6)), StdDev: parseFloat(Math.sqrt(variance).toFixed(4)), datesCount: data.values.length, measuredDates: mv.length, noUsageDates: data.values.length - mv.length };
  });

  const measured = aggRecords.filter(r => r.Avg_Value > 0);
  const noUsage = aggRecords.filter(r => r.Avg_Value === 0);
  const breached = measured.filter(r => r.Avg_Value > r.Target_Value);
  const withinTarget = measured.filter(r => r.Avg_Value <= r.Target_Value);
  const excellent = measured.filter(r => ((r.Avg_Value / r.Target_Value) * 100) <= 30);
  const good = measured.filter(r => { const p = (r.Avg_Value / r.Target_Value) * 100; return p > 30 && p <= 60; });
  const acceptable = measured.filter(r => { const p = (r.Avg_Value / r.Target_Value) * 100; return p > 60 && p <= 100; });
  const breachBucket = measured.filter(r => ((r.Avg_Value / r.Target_Value) * 100) > 100);
  const avgUtil = measured.length > 0 ? measured.reduce((s, r) => s + ((r.Avg_Value / r.Target_Value) * 100), 0) / measured.length : 0;
  const highUtilCount = acceptable.length + breachBucket.length;
  const categorySummary = buildCategorySummary(aggRecords);
  const sorted = [...measured].sort((a, b) => (a.Avg_Value / a.Target_Value) - (b.Avg_Value / b.Target_Value));
  const lowest = sorted.length > 0 ? sorted[0] : null;
  const highest = sorted.length > 0 ? sorted[sorted.length - 1] : null;

  const trendData = dateKeys.map(d => { const da = perDateAnalytics[d]; return { date: d, measured: da.measuredCount, noUsage: da.noUsageCount, targetCompliance: da.targetComplianceRate, avgUtilization: da.avgUtilizationPct, breachedCount: da.targetBreachedCount, health: da.overallHealth }; });
  const weeklyGroups = {}; dateKeys.forEach(d => { const dt = new Date(d + 'T00:00:00.000Z'); const dow = dt.getDay(); const mon = new Date(dt); mon.setDate(mon.getDate() - (dow === 0 ? 6 : dow - 1)); const wk = mon.toISOString().substring(0, 10); if (!weeklyGroups[wk]) weeklyGroups[wk] = []; weeklyGroups[wk].push(d); });
  const monthlyGroups = {}; dateKeys.forEach(d => { const mk = d.substring(0, 7); if (!monthlyGroups[mk]) monthlyGroups[mk] = []; monthlyGroups[mk].push(d); });
  const anomalies = measured.filter(r => r.StdDev > 0 && r.Target_Value > 0).map(r => ({ ...r, CoefficientOfVariation: parseFloat(((r.StdDev / r.Avg_Value) * 100).toFixed(2)), UtilizationRange: parseFloat(((r.Max_Value - r.Min_Value) / r.Target_Value * 100).toFixed(2)) })).sort((a, b) => b.CoefficientOfVariation - a.CoefficientOfVariation);

  return {
    hasData: true, isMultiDate: totalDates > 1, isSingleDate: totalDates === 1,
    totalDates, dateRange: { first: dateKeys[0], last: dateKeys[dateKeys.length - 1] }, dates: dateKeys,
    totalFunctionalities: TOTAL_FUNCTIONALITIES, totalRecords: records.length,
    measuredCount: measured.length, noUsageCount: noUsage.length,
    measurementCoverage: parseFloat(((measured.length / TOTAL_FUNCTIONALITIES) * 100).toFixed(1)),
    targetBreachedCount: breached.length, withinTargetCount: withinTarget.length,
    targetComplianceRate: measured.length > 0 ? parseFloat(((withinTarget.length / measured.length) * 100).toFixed(1)) : 100,
    avgUtilizationPct: parseFloat(avgUtil.toFixed(2)), highUtilCount,
    overallHealth: breached.length === 0 ? 'Green (Stable)' : breached.length <= 3 ? 'Yellow (Caution)' : 'Red (Critical)',
    performanceBuckets: {
      excellent: { count: excellent.length, share: measured.length > 0 ? parseFloat(((excellent.length / measured.length) * 100).toFixed(1)) : 0 },
      good: { count: good.length, share: measured.length > 0 ? parseFloat(((good.length / measured.length) * 100).toFixed(1)) : 0 },
      acceptable: { count: acceptable.length, share: measured.length > 0 ? parseFloat(((acceptable.length / measured.length) * 100).toFixed(1)) : 0 },
      breach: { count: breachBucket.length, share: measured.length > 0 ? parseFloat(((breachBucket.length / measured.length) * 100).toFixed(1)) : 0 }
    },
    categorySummary,
    targetBreachedItems: breached.map(r => ({ S_NO: r.S_NO, Functionality: r.Functionality, Target_Value: r.Target_Value, Avg_Value: r.Avg_Value, Overshoot_Sec: parseFloat((r.Avg_Value - r.Target_Value).toFixed(4)), Overshoot_Pct: r.Target_Value > 0 ? parseFloat((((r.Avg_Value - r.Target_Value) / r.Target_Value) * 100).toFixed(2)) : 0 })),
    lowestUtilization: lowest ? { Functionality: lowest.Functionality, Utilization: parseFloat(((lowest.Avg_Value / lowest.Target_Value) * 100).toFixed(2)) } : null,
    highestUtilization: highest ? { Functionality: highest.Functionality, Utilization: parseFloat(((highest.Avg_Value / highest.Target_Value) * 100).toFixed(2)) } : null,
    perDateAnalytics, trendData, weeklyGroups, monthlyGroups, aggRecords, anomalies
  };
}

// ═══════════════════════════════════════════════════════════════════
// BUILD SCORECARD PROMPT
// ═══════════════════════════════════════════════════════════════════
function buildScorecardPrompt(records, analytics, userPrompt, dateRange, subType, funcTrendData, highUtilTrendData, extraContext) {
  const dateLabel = dateRange?.label || 'all available dates';
  const isNoDateSpecified = dateRange?.mode === 'all';

  const baseRules = `
=== CRITICAL RULES ===
1. **NEVER use markdown tables.** Use bullet points (•, -, ▸), bold headers (##, ###), and nested lists ONLY.
2. **Total Functionalities is ALWAYS ${TOTAL_FUNCTIONALITIES}.** Never multiply by dates. "Modules" = "Functionalities".
3. Emoji: 🟢 Excellent/Healthy, 🔵 Good, 🟡 Acceptable/Caution, 🔴 Critical/Breach, ✅ Within Target, ❌ Breached, ⚪ No Usage, 🏆 Lowest Util, ⚠️ Highest Util.
4. Use ONLY the pre-computed data. Do NOT invent numbers.
5. **"High Utilization (>60%)" count MUST equal Acceptable + Breach counts** from performance buckets. These are the functionalities in the Acceptable (60-100%) and Breach (>100%) bands.
6. Top Categories: Show ALL 🔴 Critical, ALL 🟡 Acceptable, Top 2 🔵 Good, Top 2 🟢 Excellent. Skip "No Data" categories.
7. Extremes: "Lowest Utilization" (not "Best Performer") and "Highest Utilization" — from the same date-range data.
8. **TERMINOLOGY: Always use "No Usage" (never "Not Measured"). "Modules" = "Functionalities".**
9. Only show data for the specified date range: "${dateLabel}".
10. For performance calculations, only use functionalities with usage data (Avg_Value > 0).
11. Action Summary: Use "Coverage Expansion" (not "Instrumentation Coverage"). Keep clear and actionable.
12. Target Exceeded section: Use format "exceeded target by +Xs (+Y%)" for clarity.
`;

  // ── SHORT SUMMARY ──
  if (subType === 'SHORT_SUMMARY') {
    return `${baseRules}\n=== DATA ===\n- Total: ${TOTAL_FUNCTIONALITIES} | Measured: ${analytics.measuredCount} | No Usage: ${analytics.noUsageCount}\n- Target Compliance: ${analytics.targetComplianceRate}% | Target Exceeds: ${analytics.targetBreachedCount}\n- Avg Utilization: ${analytics.avgUtilizationPct}% | Health: ${analytics.overallHealth}\n\n=== QUERY ===\n${userPrompt}\n\n=== OUTPUT ===\nProvide 3–5 bullet executive summary for "${dateLabel}". Include Target, utilization, Target Exceeds, one recommendation. NO tables.`;
  }

  // ── FUNCTIONALITY TREND ──
  if (subType === 'FUNCTIONALITY_TREND' && funcTrendData?.length > 0) {
    const fn = funcTrendData[0].Functionality; const tv = funcTrendData[0].Target_Value;
    const mp = funcTrendData.filter(r => r.Avg_Value > 0);
    const avgM = mp.length > 0 ? (mp.reduce((s, r) => s + r.Avg_Value, 0) / mp.length).toFixed(4) : '0';
    const avgU = mp.length > 0 ? (mp.reduce((s, r) => s + ((r.Avg_Value / r.Target_Value) * 100), 0) / mp.length).toFixed(2) : '0';
    const bd = funcTrendData.filter(r => r.Avg_Value > 0 && r.Avg_Value > r.Target_Value).length;
    const nud = funcTrendData.filter(r => r.Avg_Value === 0).length;
    const status = bd > 0 ? '🔴 Has Target Exceed' : nud > 0 ? '🟡 Partially Measured' : '🟢 Healthy';
    let daily = funcTrendData.map(r => { const u = r.Target_Value > 0 ? ((r.Avg_Value / r.Target_Value) * 100).toFixed(2) : '0.00'; const st = r.Avg_Value === 0 ? '⚪ No Usage' : r.Avg_Value > r.Target_Value ? '❌ Target Exceeded' : '✅ Within Target'; return `  - **${r.Current_date_str}** → Avg: **${r.Avg_Value}s** / Target: **${r.Target_Value}s** → **${u}%** → ${st}`; }).join('\n');
    return `${baseRules}\n=== DATA ===\n- Functionality: ${fn} | Target: ${tv}s | Date Range: ${dateLabel}\n- Data Points: ${funcTrendData.length} (Measured: ${mp.length}, No Usage: ${nud})\n- Avg Response (measured): ${avgM}s | Avg Utilization: ${avgU}%\n- Target Exceeded: ${bd} | Status: ${status}\n\n### Daily Performance\n${daily}\n\n=== QUERY ===\n${userPrompt}\n\n=== OUTPUT ===\n1. **## 📊 Functionality Analysis: ${fn}** — Summary bullets\n2. **## 📈 Daily Trend** — Each date with trend analysis\n3. **## 📋 Recommendation** — Actionable\nNO tables.`;
  }

  // ── HIGH UTIL TREND ──
  if (subType === 'HIGH_UTIL_TREND' && highUtilTrendData && Object.keys(highUtilTrendData).length > 0) {
    const sf = Object.entries(highUtilTrendData).map(([func, recs]) => ({ func, recs, avgUtil: recs.reduce((s, r) => s + ((r.Avg_Value / r.Target_Value) * 100), 0) / recs.length })).sort((a, b) => b.avgUtil - a.avgUtil).slice(0, 10);
    let sections = sf.map(({ func, recs, avgUtil }) => { const det = recs.map(r => `    - ${r.Current_date_str}: **${r.Avg_Value}s** / **${r.Target_Value}s** → **${((r.Avg_Value / r.Target_Value) * 100).toFixed(2)}%** ${parseFloat(((r.Avg_Value / r.Target_Value) * 100).toFixed(2)) > 100 ? '❌' : '🟡'}`).join('\n'); return `  - ⚠️ **${func}** — Avg: **${avgUtil.toFixed(2)}%**\n${det}`; }).join('\n\n');
    return `${baseRules}\n=== HIGH UTILIZATION (>50%, Top 10) ===\n${sections}\n\n=== QUERY ===\n${userPrompt}\n\n=== OUTPUT ===\n1. **## 📊 High Utilization Analysis** — Overview\n2. Per functionality: daily data as nested bullets with trend\n3. **## 📋 Recommendations** — Ranked actions\nNO tables.`;
  }

  // ── ANOMALY DETECTION ──
  if (subType === 'ANOMALY_DETECTION' && analytics?.anomalies) {
    const topN = extraContext?.topN || 3;
    const top = analytics.anomalies.slice(0, Math.max(topN, 5));
    let ad = top.map((a, i) => `${i + 1}. **${a.Functionality}**\n   - Avg: ${a.Avg_Value}s / Target: ${a.Target_Value}s → **${((a.Avg_Value / a.Target_Value) * 100).toFixed(2)}%**\n   - Range: ${a.Min_Value}s – ${a.Max_Value}s | StdDev: ${a.StdDev}s | CV: ${a.CoefficientOfVariation}%\n   - Measured: ${a.measuredDates}/${a.datesCount} dates`).join('\n\n');
    return `${baseRules}\n=== ANOMALY DATA ===\n- Date Range: ${dateLabel} | Health: ${analytics.overallHealth} | Target: ${analytics.targetComplianceRate}%\n\n### Top ${top.length} Anomalies\n${ad}\n\n=== QUERY ===\n${userPrompt}\n\n=== OUTPUT ===\n1. **## 🔍 Anomaly Analysis** — 2–3 sentence summary\n2. **## ⚠️ Top Anomalies** — Numbered bullets\n3. **## 📋 Risk Assessment & Recommendations**\nNO tables.`;
  }

  // ── TOP/BOTTOM N ──
  if (subType === 'TOP_BOTTOM_N' && analytics?.aggRecords) {
    const n = extraContext?.topN || 3; const dir = extraContext?.direction || 'WORST';
    const mr = analytics.aggRecords.filter(r => r.Avg_Value > 0 && r.Target_Value > 0);
    const sr = [...mr].sort((a, b) => dir === 'WORST' ? (b.Avg_Value / b.Target_Value) - (a.Avg_Value / a.Target_Value) : (a.Avg_Value / a.Target_Value) - (b.Avg_Value / b.Target_Value)).slice(0, n);
    let ld = sr.map((r, i) => `${i + 1}. **${r.Functionality}** → **${((r.Avg_Value / r.Target_Value) * 100).toFixed(2)}%**\n   - Avg: ${r.Avg_Value}s / Target: ${r.Target_Value}s | Measured: ${r.measuredDates}/${r.datesCount} dates`).join('\n\n');
    return `${baseRules}\n=== ${dir === 'WORST' ? 'HIGHEST' : 'LOWEST'} UTILIZATION ===\n- Date Range: ${dateLabel} | Measured: ${mr.length}/${TOTAL_FUNCTIONALITIES}\n\n${ld}\n\n=== QUERY ===\n${userPrompt}\n\n=== OUTPUT ===\nPresent top ${n} as numbered bullets with analysis and recommendations. NO tables.`;
  }

  // ── Target BREACH ──
  if (subType === 'TARGET_EXCEEDED_ANALYSIS') {
    const bi = analytics.targetBreachedItems?.length > 0 ? analytics.targetBreachedItems.map(b => `  - ❌ **${b.Functionality}** (#${b.S_NO}): **${b.Avg_Value}s** exceeded target **${b.Target_Value}s** by **+${b.Overshoot_Sec}s** (+${b.Overshoot_Pct}%)`).join('\n') : '  - ✅ All measured functionalities are Within Target targets';
    return `${baseRules}\n=== TARGET EXCEEDED ANALYSIS ===\n- Date Range: ${dateLabel} | Compliance: ${analytics.targetComplianceRate}% | Exceeded: ${analytics.targetBreachedCount} | Within Target: ${analytics.withinTargetCount}\n\n### Exceed Details\n${bi}\n\n=== QUERY ===\n${userPrompt}\n\n=== OUTPUT ===\n1. **## 🔴 Target Exceeded Analysis** — Status bullets\n2. **## 📋 Exceeded Details** — Each as nested bullets\n3. **## 📋 Remediation Plan**\nNO tables.`;
  }

  // ── NO USAGE ──
  if (subType === 'UNMEASURED_ANALYSIS') {
    const nur = analytics.aggRecords?.filter(r => r.Avg_Value === 0) || [];
    const nul = nur.map(r => `  - ⚪ **${r.Functionality}** (#${r.S_NO}) — Target: ${r.Target_Value}s`).join('\n');
    return `${baseRules}\n=== NO USAGE FUNCTIONALITIES ===\n- Date Range: ${dateLabel} | No Usage: ${analytics.noUsageCount}/${TOTAL_FUNCTIONALITIES} | Coverage: ${analytics.measurementCoverage}%\n\n${nul || '  - ✅ All functionalities have usage data'}\n\n=== QUERY ===\n${userPrompt}\n\n=== OUTPUT ===\n1. **## ⚪ No Usage Functionalities** — List and categorize\n2. **## 📋 Recommendations** — Priority order\nNO tables.`;
  }

  // ── CATEGORY ANALYSIS ──
  if (subType === 'CATEGORY_ANALYSIS' && extraContext?.extractedCategory) {
    const cn = extraContext.extractedCategory; const cd = analytics.categorySummary?.[cn];
    const cr = analytics.aggRecords?.filter(r => categorizeFunc(r.Functionality) === cn) || [];
    let det = cr.map(r => { const u = r.Target_Value > 0 ? ((r.Avg_Value / r.Target_Value) * 100).toFixed(2) : '0'; const st = r.Avg_Value === 0 ? '⚪' : parseFloat(u) > 100 ? '❌' : parseFloat(u) > 60 ? '🟡' : '🟢'; return `  - ${st} **${r.Functionality}** → ${r.Avg_Value}s / ${r.Target_Value}s → **${u}%**`; }).join('\n');
    return `${baseRules}\n=== CATEGORY: ${cn} ===\n- Date Range: ${dateLabel} | Total: ${cd?.total || cr.length} | Measured: ${cd?.measured || 0} | No Usage: ${cd?.noUsage || 0}\n- Avg Utilization: ${cd?.avgUtilization || 0}% | Tier: ${cd?.tier || 'Unknown'}\n\n${det}\n\n=== QUERY ===\n${userPrompt}\n\n=== OUTPUT ===\nDetailed analysis with per-functionality breakdown as bullets and recommendations. NO tables.`;
  }

  // ── DATE COMPARISON ──
  if (subType === 'DATE_COMPARISON' && analytics?.perDateAnalytics) {
    const dk = Object.keys(analytics.perDateAnalytics).sort();
    let cd = dk.map(d => { const da = analytics.perDateAnalytics[d]; return `### 📅 ${d}\n  - Measured: ${da.measuredCount}/${TOTAL_FUNCTIONALITIES} | Target: ${da.targetComplianceRate}% | Avg Util: ${da.avgUtilizationPct}% | Exceeded: ${da.targetBreachedCount} | Health: ${da.overallHealth}`; }).join('\n\n');
    return `${baseRules}\n=== DATE COMPARISON ===\n${cd}\n\n=== QUERY ===\n${userPrompt}\n\n=== OUTPUT ===\n1. **## 📊 Date Comparison** — Grouped bullets per date\n2. **## 📈 Trend Analysis** — What improved/degraded\n3. **## 📋 Key Observations**\nNO tables.`;
  }

  // ── THRESHOLD ANALYSIS ──
  if (subType === 'THRESHOLD_ANALYSIS' && analytics?.aggRecords) {
    const threshold = extraContext?.threshold || 60;
    const exceeding = analytics.aggRecords.filter(r => r.Avg_Value > 0 && r.Target_Value > 0 && ((r.Avg_Value / r.Target_Value) * 100) > threshold).sort((a, b) => (b.Avg_Value / b.Target_Value) - (a.Avg_Value / a.Target_Value));
    let el = exceeding.map((r, i) => { const u = ((r.Avg_Value / r.Target_Value) * 100).toFixed(2); const st = parseFloat(u) > 100 ? '❌ Target Exceeded' : '🟡 High Utilization'; return `${i + 1}. **${r.Functionality}** → **${u}%** utilization (Avg: ${r.Avg_Value}s / Target: ${r.Target_Value}s) — ${st}`; }).join('\n');
    if (exceeding.length === 0) el = '  - ✅ No functionalities exceed the ' + threshold + '% threshold';
    return `${baseRules}\n=== FUNCTIONALITIES EXCEEDING ${threshold}% OF TARGET ===\n- Date Range: ${dateLabel} | Threshold: ${threshold}% | Found: ${exceeding.length}/${analytics.measuredCount} measured\n\n${el}\n\n=== QUERY ===\n${userPrompt}\n\n=== OUTPUT ===\n1. **## 📊 Threshold Analysis (>${threshold}%)** — Summary\n2. List each functionality as numbered bullets with utilization and status\n3. **## 📋 Recommendations** — Priority actions\nNO tables.`;
  }

  // ═══════════════════════════════════════════════════════════════
  // OVERVIEW (default)
  // ═══════════════════════════════════════════════════════════════
  const isSingle = analytics.isSingleDate || false;
  const isMulti = analytics.isMultiDate || false;
  const pb = analytics.performanceBuckets;

  let snapshot;
  if (isSingle) {
    const da = analytics.perDateAnalytics[analytics.dates[0]];
    snapshot = `- **Date:** ${da.date}
- **Total Functionalities:** ${TOTAL_FUNCTIONALITIES}
- **Measured:** ${da.measuredCount} | **No Usage:** ${da.noUsageCount}
- **Measurement Coverage:** ${da.measurementCoverage}%
- **Target Compliance Rate:** ${da.targetComplianceRate}%
- **Target Exceeded:** ${da.targetBreachedCount}
- **Average Target Utilization:** ${da.avgUtilizationPct}%
- **High Utilization (>60%):** ${da.highUtilCount} functionalities (Acceptable: ${da.performanceBuckets.acceptable.count} + Exceeds: ${da.performanceBuckets.breach.count})
- **Overall Health Status:** ${da.overallHealth}`;
  } else {
    snapshot = `- **Date Range:** ${analytics.dateRange.first} to ${analytics.dateRange.last} (${analytics.totalDates} dates)
- **Total Functionalities:** ${TOTAL_FUNCTIONALITIES}
- **Measured:** ${analytics.measuredCount} | **No Usage:** ${analytics.noUsageCount}
- **Measurement Coverage:** ${analytics.measurementCoverage}%
- **Target Compliance Rate:** ${analytics.targetComplianceRate}%
- **Target Exceeded:** ${analytics.targetBreachedCount}
- **Average Target Utilization:** ${analytics.avgUtilizationPct}%
- **High Utilization (>60%):** ${analytics.highUtilCount} functionalities (Acceptable: ${pb.acceptable.count} + Exceed: ${pb.breach.count})
- **Overall Health Status:** ${analytics.overallHealth}`;
  }

  let bucketsData = `- 🟢 **Excellent** (≤ 30%) — ${pb.excellent.count} functionalities (${pb.excellent.share}%)
- 🔵 **Good** (30–60%) — ${pb.good.count} functionalities (${pb.good.share}%)
- 🟡 **Acceptable** (60–100%) — ${pb.acceptable.count} functionalities (${pb.acceptable.share}%)
- 🔴 **Exceeded** (> 100%) — ${pb.breach.count} functionalities (${pb.breach.share}%)`;

  // Top Categories by tier
  const catEntries = Object.entries(analytics.categorySummary || {});
  const criticalCats = catEntries.filter(([_, v]) => v.tier === 'Critical').sort((a, b) => b[1].avgUtilization - a[1].avgUtilization);
  const acceptableCats = catEntries.filter(([_, v]) => v.tier === 'Acceptable').sort((a, b) => b[1].avgUtilization - a[1].avgUtilization);
  const goodCats = catEntries.filter(([_, v]) => v.tier === 'Good').sort((a, b) => b[1].avgUtilization - a[1].avgUtilization);
  const excellentCats = catEntries.filter(([_, v]) => v.tier === 'Excellent').sort((a, b) => a[1].avgUtilization - b[1].avgUtilization);

  let categoryData = '';
  if (criticalCats.length > 0) { categoryData += `**🔴 Critical (>100% or Target Exceeded):**\n${criticalCats.map(([c, v]) => `  - **${c}** — Measured: ${v.measured} | No Usage: ${v.noUsage} | Avg Util: **${v.avgUtilization}%**`).join('\n')}\n\n`; }
  if (acceptableCats.length > 0) { categoryData += `**🟡 Acceptable (60–100%):**\n${acceptableCats.map(([c, v]) => `  - **${c}** — Measured: ${v.measured} | No Usage: ${v.noUsage} | Avg Util: **${v.avgUtilization}%**`).join('\n')}\n\n`; }
  if (goodCats.length > 0) { categoryData += `**🔵 Good (30–60%) — Top ${Math.min(2, goodCats.length)}:**\n${goodCats.slice(0, 2).map(([c, v]) => `  - **${c}** — Measured: ${v.measured} | No Usage: ${v.noUsage} | Avg Util: **${v.avgUtilization}%**`).join('\n')}\n\n`; }
  if (excellentCats.length > 0) { categoryData += `**🟢 Excellent (≤30%) — Top ${Math.min(2, excellentCats.length)}:**\n${excellentCats.slice(0, 2).map(([c, v]) => `  - **${c}** — Measured: ${v.measured} | No Usage: ${v.noUsage} | Avg Util: **${v.avgUtilization}%**`).join('\n')}`; }

  const riskCats = [...criticalCats, ...acceptableCats].map(([c]) => c);
  const riskSignal = riskCats.length > 0 ? `⚠️ ${riskCats.join(' and ')} show higher utilization` : '🟢 No categories are currently at risk';

  let extremesData = '';
  if (analytics.lowestUtilization && analytics.highestUtilization) {
    extremesData = `- 🏆 **Lowest Utilization:** ${analytics.lowestUtilization.Functionality} → **${analytics.lowestUtilization.Utilization}%**
- ⚠️ **Highest Utilization:** ${analytics.highestUtilization.Functionality} → **${analytics.highestUtilization.Utilization}%**`;
  }

  let breachedData;
  if (analytics.targetBreachedItems?.length > 0) {
    breachedData = analytics.targetBreachedItems.map(item =>
      `  - ❌ **${item.Functionality}**: **${item.Avg_Value}s** exceeded target **${item.Target_Value}s** by **+${item.Overshoot_Sec}s** (+${item.Overshoot_Pct}%)`
    ).join('\n');
  } else {
    breachedData = '  - ✅ All measured functionalities are Within Target targets — no target exceed detected';
  }

  const highUtilItems = (analytics.aggRecords || []).filter(r => r.Avg_Value > 0 && ((r.Avg_Value / r.Target_Value) * 100) > 60);
  const topHU = highUtilItems.sort((a, b) => (b.Avg_Value / b.Target_Value) - (a.Avg_Value / a.Target_Value)).slice(0, 5).map(r => r.Functionality);
  const huText = topHU.length > 0 ? topHU.join(', ') : 'None';

  let actionData = `- **Target Remediation:** ${analytics.targetBreachedCount === 0 ? 'None required — all within targets' : `${analytics.targetBreachedCount} Target Exceed require immediate attention`}
- **High Utilization Watch:** ${huText}
- **Coverage Expansion:** ${analytics.noUsageCount} functionalities have no usage data — prioritize enabling monitoring
- **Risk Categories:** ${riskCats.length > 0 ? riskCats.join(', ') : 'None identified'}
- **Monitoring Strategy:** Set threshold-based alerts for functionalities exceeding 60% utilization`;

  let trendSection = '';
  if (isMulti && analytics.trendData) {
    let tb = analytics.trendData.map(t => {
      const hi = t.health === 'Green (Stable)' ? '🟢' : t.health === 'Yellow (Caution)' ? '🟡' : '🔴';
      return `  - **${t.date}** ${hi}\n    - Measured: **${t.measured}** | No Usage: **${t.noUsage}** | Target: **${t.targetCompliance}%** | Avg Util: **${t.avgUtilization}%** | Target Exceeded: **${t.breachedCount}**`;
    }).join('\n');
    trendSection = `\n### 📆 Date-wise Trend\n${tb}`;
  }

  let groupingSection = '';
  if (isNoDateSpecified && analytics.totalDates > 1) {
    const wk = Object.keys(analytics.weeklyGroups || {}).sort();
    const mk = Object.keys(analytics.monthlyGroups || {}).sort();
    if (wk.length > 0) { groupingSection += `\n### 📅 Weekly Grouping\n`; wk.forEach(w => { groupingSection += `  - **Week of ${w}:** ${analytics.weeklyGroups[w].join(', ')}\n`; }); }
    if (mk.length > 0) { groupingSection += `\n### 📅 Monthly Grouping\n`; mk.forEach(m => { groupingSection += `  - **${m}:** ${analytics.monthlyGroups[m].join(', ')}\n`; }); }
  }

  return `${baseRules}

=== PRE-COMPUTED DATA ===

### Executive Snapshot
${snapshot}

### Performance Distribution (Utilization-Based)
${bucketsData}

### Top Categories (by Performance Tier)
${categoryData}
> ${riskSignal}

### Extremes & Outliers
${extremesData}

### Target Exceeded Functionalities
${breachedData}

### Action-Oriented Summary
${actionData}
${trendSection}
${groupingSection}

=== USER QUERY ===
${userPrompt}

=== REQUIRED OUTPUT ===

**## 📊 Executive Summary**
2–3 sentences summarizing overall NPS health for "${dateLabel}".

**### Executive Snapshot**
Reproduce snapshot as clean bullet list. Ensure High Utilization count = Acceptable + Breach.

---

**## 📈 Performance Distribution**

**### Performance Buckets**
Reproduce buckets with emoji indicators.

**### Top Categories (by Performance Tier)**
Reproduce categories grouped by tier.
> Include risk signal.

---

**## 🎯 Extremes & Outliers**
- 🏆 Lowest Utilization and ⚠️ Highest Utilization as bullets.

---

**## 📋 Target Exceeded Functionalities**
Reproduce breach details or "None" message.

---

**## 📋 Action-Oriented Summary**
Reproduce actions as bullets.

**Executive Conclusion:**
One concluding paragraph.

---

${isMulti ? `**## 📆 Date-wise Trend**\nReproduce as nested bullets with trend analysis.\n\n---` : ''}
${isNoDateSpecified && analytics.totalDates > 1 ? `**## 📅 Weekly & Monthly Grouping**\nReproduce groupings.\n\n---` : ''}

CRITICAL: NO markdown tables. Use ONLY bullets. "No Usage" not "Not Measured". "Modules" = "Functionalities".`;
}

// ═══════════════════════════════════════════════════════════════════
// LLM-BASED INTENT + ENTITY EXTRACTION
// Single gpt-4o call that returns subType + dateRange + functionality +
// category + threshold + topN + direction in one JSON response.
// On any failure (network, malformed JSON, invalid subType) it falls
// back to the regex helpers above so behaviour degrades gracefully.
// ═══════════════════════════════════════════════════════════════════
async function extractScorecardIntent(userPrompt, state) {
  const today = new Date();
  const todayISO = today.toISOString().substring(0, 10);

  const systemPrompt = `You are an intent classifier for an NPS (National Pricing System) Scorecard analysis system.

Today's date: ${todayISO}
Current Request: ${state.userContext}
DATE_IDENTIFIER  ${state.identifiers}

Given the user query, return ONLY a JSON object (no markdown fences, no commentary) with this exact schema:

{
  "subType": one of [${[...VALID_SUB_TYPES].join(', ')}],
  "extractedFunctionality": <exact canonical functionality name from the list below, or null>,
  "extractedCategory": <one of the categories below, or null>,
  "threshold": <integer percentage 1-100 if user mentions a specific threshold, else null>,
  "topN": <integer for top/bottom queries (default 3 if N is implied but not stated), else null>,
  "direction": "BEST" | "WORST" | null,
  "dateRange": {
    "mode": "all" | "specific_date" | "date_range",
    "startDate": "YYYY-MM-DD" | null,
    "endDate": "YYYY-MM-DD" | null,
    "label": "<human-friendly description, e.g. 'today', 'last 7 days', 'Feb 2026', 'all available dates'>"
  }
}

SUB-TYPE GUIDE (pick the most specific match — OVERVIEW is the default):
- SHORT_SUMMARY: user asks for a brief / short / quick summary or overview
- FUNCTIONALITY_TREND: trend / insights / performance for ONE specific functionality (only if a canonical functionality is named or clearly implied)
- HIGH_UTIL_TREND: analysis of high-utilization (>50% target) functionalities, "high consumption", "high utilization"
- ANOMALY_DETECTION: anomalies, concerns, issues, problems, unusual patterns, spikes, regressions, "anything wrong"
- TOP_BOTTOM_N: top/bottom/worst/best/slowest/fastest/highest/lowest N performers
- TARGET_EXCEEDED_ANALYSIS: Target breaches, targets exceeded, violations
- UNMEASURED_ANALYSIS: functionalities with no usage / no data / zero values / not measured
- CATEGORY_ANALYSIS: analysis of a specific category (e.g. "RQR category", "all backup operations")
- DATE_COMPARISON: comparing two or more dates/periods, "what changed", "compared to"
- THRESHOLD_ANALYSIS: functionalities exceeding a specific % threshold (e.g. "modules above 80% of target")
- OVERVIEW: default when no other type clearly fits

DIRECTION (only meaningful for TOP_BOTTOM_N):
- "WORST" for: bottom, worst, slowest, highest  (highest utilization = worst performance)
- "BEST"  for: top, best, fastest, lowest

CANONICAL FUNCTIONALITY NAMES (must match EXACTLY, case-sensitive; return null if no clear match):
${ALL_FUNCTIONALITY_NAMES.map(n => `- ${n}`).join('\n')}

CATEGORY NAMES (must match EXACTLY):
${[...VALID_CATEGORIES].join(', ')}

DATE RULES (always relative to today ${todayISO}):
- "today" / "today's" / "current date" → mode "specific_date", startDate=endDate=${todayISO}
- "yesterday" / "last day" → mode "specific_date", both = yesterday
- "last N days" / "past N days" → mode "date_range", startDate=N days ago, endDate=today
- "last week" / "past week" / "1 week" → startDate=7 days ago, endDate=today
- "last N weeks" → startDate = N*7 days ago
- "last month" / "past month" → startDate=1 month ago
- "this month" → startDate=first of current month, endDate=today
- "this week" → startDate=Monday of current week, endDate=today
- "Feb 2026" / "feb'26" / "March 2025" → full month range (cap endDate at today if month is current)
- ISO "YYYY-MM-DD" → mode "specific_date" (single) or "date_range" (multiple)
- "MM/DD/YYYY" → same handling as ISO
- If the request is a FOLLOW_UP, use the DATE_IDENTIFIER filed to determine date range 
- No date reference → mode "all", both dates null, label "all available dates"

Return ONLY the JSON object.`;

  try {
    const response = await chatCompletion({
      temperature: 0,
      max_tokens: 600,
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      teamName: state?.teamName,
      assistantName: state?.assistantName,
      nuid: state?.nuid
    });

    const raw = (response || '').replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(raw);

    if (!VALID_SUB_TYPES.has(parsed.subType)) {
      throw new Error(`Invalid subType "${parsed.subType}" returned by LLM`);
    }

    // Sanitize: only accept canonical functionality / category names.
    // The fuzzyMatchFunctionality fallback in the main node handles cases
    // where the LLM returns a near-miss that isn't in the canonical list.
    const extractedFunctionality = parsed.extractedFunctionality && CANONICAL_FUNCTIONALITY_SET.has(parsed.extractedFunctionality)
      ? parsed.extractedFunctionality
      : (typeof parsed.extractedFunctionality === 'string' && parsed.extractedFunctionality.trim()
        ? parsed.extractedFunctionality.trim() // pass through for fuzzyMatchFunctionality
        : null);

    const extractedCategory = parsed.extractedCategory && VALID_CATEGORIES.has(parsed.extractedCategory)
      ? parsed.extractedCategory
      : null;

    const threshold = Number.isFinite(parsed.threshold)
      ? Math.max(1, Math.min(100, Math.round(parsed.threshold)))
      : null;
    const topN = Number.isFinite(parsed.topN) ? Math.max(1, Math.round(parsed.topN)) : null;
    const direction = parsed.direction === 'BEST' || parsed.direction === 'WORST' ? parsed.direction : null;

    const dr = parsed.dateRange || {};
    const isISODate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
    const dateRange = {
      mode: ['all', 'specific_date', 'date_range'].includes(dr.mode) ? dr.mode : 'all',
      startDate: isISODate(dr.startDate) ? dr.startDate : null,
      endDate: isISODate(dr.endDate) ? dr.endDate : null,
      label: typeof dr.label === 'string' && dr.label.trim() ? dr.label.trim() : 'all available dates'
    };
    // Coerce to "all" if mode says otherwise but no valid dates landed
    if (dateRange.mode !== 'all' && !dateRange.startDate && !dateRange.endDate) {
      dateRange.mode = 'all';
      dateRange.label = 'all available dates';
    }

    console.log(`[extractScorecardIntent] LLM → subType=${parsed.subType}, func=${extractedFunctionality || 'null'}, dateMode=${dateRange.mode}`);

    return {
      subType: parsed.subType,
      extractedFunctionality,
      extractedCategory,
      threshold,
      topN,
      direction,
      dateRange,
    };
  } catch (err) {
    console.warn(`[extractScorecardIntent] LLM call failed (${err.message}); falling back to regex.`);
    const detection = detectScorecardSubType(userPrompt);
    const dateRange = await extractDateRangeFromPrompt(userPrompt, state);
    return {
      subType: detection.subType,
      extractedFunctionality: detection.extractedFunctionality || null,
      extractedCategory: detection.extractedCategory || null,
      threshold: detection.threshold || null,
      topN: detection.topN || null,
      direction: detection.direction || null,
      dateRange,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN NODE
// ═══════════════════════════════════════════════════════════════════
export const scorecardAnalysisNode = async (state) => {
  try {
    console.log('[scorecardAnalysisNode] Starting. Query:', state.userPrompt.substring(0, 100));

    // LLM-based intent + entity extraction (single gpt-4o call, regex fallback inside).
    // Returns subType, extractedFunctionality, extractedCategory, threshold, topN,
    // direction and dateRange — replacing the prior regex-only detection.
    const intent = await extractScorecardIntent(state.userPrompt, state);
    const { subType, dateRange } = intent;
    let extractedFunctionality = intent.extractedFunctionality;
    const extraContext = {
      topN: intent.topN,
      direction: intent.direction,
      extractedCategory: intent.extractedCategory,
      threshold: intent.threshold
    };

    console.log(`[scorecardAnalysisNode] Sub-type: ${subType}, Func: ${extractedFunctionality || 'N/A'}, Threshold: ${extraContext.threshold || 'N/A'}`);
    console.log(`[scorecardAnalysisNode] Date range:`, JSON.stringify(dateRange));

    let funcTrendData = null, highUtilTrendData = null;

    if (subType === 'FUNCTIONALITY_TREND' && extractedFunctionality) {
      funcTrendData = await fetchFunctionalityTrend(extractedFunctionality, dateRange);
      if (funcTrendData.length === 0) {
        const matched = await fuzzyMatchFunctionality(extractedFunctionality);
        if (matched) { console.log(`[scorecardAnalysisNode] Fuzzy matched "${extractedFunctionality}" → "${matched}"`); funcTrendData = await fetchFunctionalityTrend(matched, dateRange); }
      }
      if (!funcTrendData || funcTrendData.length === 0) {
        const noDateData = await fetchFunctionalityTrend(extractedFunctionality, { mode: 'all' });
        const avDates = noDateData.length > 0 ? [...new Set(noDateData.map(r => r.Current_date_str))].sort() : [];
        let errMsg = `No data found for functionality "${extractedFunctionality}"`;
        if (avDates.length > 0) errMsg += ` within "${dateRange.label}". Data exists for: ${avDates.join(', ')}.`;
        else {
          errMsg += `. Please check the name.`;
          const db = await connectToDatabase('team-nps-db');
          const allF = await db.collection('NPS_SCORECARD').distinct('Functionality', { type: 'nps_scorecard' });
          const sug = allF.filter(f => f.toLowerCase().includes(extractedFunctionality.toLowerCase().substring(0, 3))).slice(0, 5);
          if (sug.length > 0) errMsg += ` Did you mean: ${sug.join(', ')}?`;
        }
        return { ...state, scorecardMetaData: { records: [], analytics: { hasData: false }, recordCount: 0, recordFound: false, error: errMsg, dateRange, subType, timestamp: new Date().toISOString() } };
      }
    }

    if (subType === 'HIGH_UTIL_TREND') {
      highUtilTrendData = await fetchHighUtilizationTrend(dateRange);
      if (Object.keys(highUtilTrendData).length === 0) return { ...state, scorecardMetaData: { records: [], analytics: { hasData: false }, recordCount: 0, recordFound: false, error: `No high utilization (>50%) functionalities found for "${dateRange.label}".`, dateRange, subType, timestamp: new Date().toISOString() } };
    }

    const { records, availableDates } = await fetchScorecardData(dateRange);
    if ((!records || records.length === 0) && subType !== 'FUNCTIONALITY_TREND' && subType !== 'HIGH_UTIL_TREND') {
      const msg = availableDates.length > 0 ? `No data for "${dateRange.label}". Available dates: ${availableDates.join(', ')}.` : 'No scorecard data found. Please run the upload script first.';
      return { ...state, scorecardMetaData: { records: [], analytics: { hasData: false }, recordCount: 0, recordFound: false, error: msg, dateRange, availableDates, subType, timestamp: new Date().toISOString() } };
    }

    const analytics = computeAggregatedAnalytics(records);
    console.log(`[scorecardAnalysisNode] Dates: ${analytics.totalDates}, Measured: ${analytics.measuredCount}, Breached: ${analytics.targetBreachedCount}, HighUtil: ${analytics.highUtilCount}`);

    const scorecardSystemPrompt = buildScorecardPrompt(records, analytics, state.userPrompt, dateRange, subType, funcTrendData, highUtilTrendData, extraContext);

    return {
      ...state,
      scorecardMetaData: {
        records: records.slice(0, 200).map(r => ({ S_NO: r.S_NO, UOM: r.UOM, Functionality: r.Functionality, Target_Value: r.Target_Value, Avg_Value: r.Avg_Value, Target_Status: r.Target_Status, Utilization_Pct: r.Utilization_Pct, Difference: r.Difference, Current_date: r.Current_date, Current_date_str: r.Current_date_str })),
        analytics, recordCount: records.length, recordFound: true,
        scorecardSystemPrompt, dateRange, subType, timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('[scorecardAnalysisNode] Error:', error.message);
    return { ...state, scorecardMetaData: { records: [], analytics: { hasData: false }, recordCount: 0, recordFound: false, error: error.message, timestamp: new Date().toISOString() } };
  }
};