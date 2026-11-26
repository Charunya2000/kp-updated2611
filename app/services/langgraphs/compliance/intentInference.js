export const SUPPORTED_LOBS = ['Medicare', 'Medicaid', 'CHIP', 'Commercial', 'Marketplace', 'NCQA'];

const LOB_REFERENCE_URLS = {
  CHIP: 'https://www.pa.gov/agencies/dhs/resources/chip',
  Marketplace: 'https://pennie.com/',
  Medicare: 'https://www.pa.gov/agencies/aging/aging-programs-and-services/pa-medi-medicare-counseling',
  Medicaid: 'https://www.pa.gov/agencies/dhs/resources/medicaid',
  Commercial: 'https://www.geisinger.org/health-plan/employers/small-business',
  NCQA: 'https://healthinsuranceratings.ncqa.org/2019/search/Commercial/PA'
};

const COMPARISON_CUES = [
  'compare', 'comparison', 'comparing', 'versus', 'vs', 'difference', 'differences',
  'different', 'side by side', 'side-by-side', 'contrast', 'gap analysis',
  'what changed', 'change from', 'compare to', 'between'
];

export function buildUnsupportedLobMessage() {
  return `I'm happy to answer questions related to the following lines of business: ${SUPPORTED_LOBS.join(', ')}.`;
}

export function normalizeSupportedLob(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const lower = raw.toLowerCase();
  if (lower === 'aca' || lower.includes('marketplace') || lower.includes('exchange') || lower.includes('pennie')) return 'Marketplace';
  if (lower.includes('medicare') || lower.includes('medigap')) return 'Medicare';
  if (lower.includes('medicaid') || lower.includes('medical assistance') || lower === 'ma') return 'Medicaid';
  if (lower.includes('chip') || lower.includes('children')) return 'CHIP';
  if (lower.includes('commercial') || lower.includes('private') || lower.includes('employer')) return 'Commercial';
  if (lower.includes('ncqa') || lower.includes('hedis') || lower.includes('accreditation') || lower.includes('rating')) return 'NCQA';

  const found = SUPPORTED_LOBS.find((lob) => lob.toLowerCase() === lower);
  return found || '';
}

export function inferLobFromText(text) {
  const value = String(text || '').toLowerCase();
  if (!value) return '';

  const scoreByLob = new Map(SUPPORTED_LOBS.map((lob) => [lob, 0]));
  const addScore = (lob, weight) => scoreByLob.set(lob, (scoreByLob.get(lob) || 0) + weight);
  const addIfMatch = (lob, weight, patterns) => {
    if (patterns.some((pattern) => value.includes(pattern))) {
      addScore(lob, weight);
    }
  };

  addIfMatch('Marketplace', 4, [
    'marketplace', 'aca marketplace', 'exchange plan', 'health insurance exchange',
    'pennie', 'qualifying life event', 'open enrollment', 'special enrollment',
    'aptc', 'premium tax credit', 'cost sharing reduction', 'csr',
    'coming from medicaid', 'browse & sign up', 'get covered', 'pennie-certified'
  ]);
  addIfMatch('Medicare', 4, [
    'medicare', 'part a', 'part b', 'part c', 'part d', 'medicare advantage',
    'medigap', 'ship', 'pa medi', '1-800-medicare', 'ssdi', 'disability entitlement period',
    'pa medi helpline', 'senior medicare patrol', 'medicare supplement', 'medicare appeal'
  ]);
  addIfMatch('Medicaid', 4, [
    'medicaid', 'medical assistance', 'healthchoices', 'community healthchoices',
    'physical healthchoices', 'behavioral healthchoices', 'compass', 'county assistance office',
    'consumer service center for health care coverage', 'waiver', 'long-term supports',
    'omap', 'office of medical assistance programs', 'ma fee schedule',
    'children with special needs', 'ph95', 'medicaid workers with disabilities', 'hipp'
  ]);
  addIfMatch('CHIP', 5, [
    'chip', 'children\'s health insurance program', 'kids coverage', 'child health insurance',
    'teens uninsured', 'uninsured child', 'chip state plan', 'chip keeps pa kids strong',
    'is your child eligible', 'apply for chip', 'renew chip', 'chip coverage'
  ]);
  addIfMatch('Commercial', 4, [
    'commercial', 'private insurance', 'employer plan', 'group plan', 'small business',
    'self-funded', 'administrative services only', 'aso', 'level-funded',
    'employee health plan', 'get a quote', 'groups 25+', 'fewer than 51 employees',
    'cigna healthcare ppo network', 'group health plans'
  ]);
  addIfMatch('NCQA', 5, [
    'ncqa', 'hedis', 'accreditation', 'plan ratings', 'consumer satisfaction',
    'prevention score', 'treatment score', 'quality rating',
    'summary report', 'overall rating', 'private/commercial', 'health insurance plan ratings'
  ]);

  if (value.includes('children') || value.includes('child') || value.includes('teen') || value.includes('pediatric')) {
    addScore('CHIP', 3);
    addScore('Medicaid', 1);
  }

  if (value.includes('ineligible for medicaid') || value.includes('not eligible for medicaid')) {
    addScore('CHIP', 4);
  }

  if (value.includes('65') || value.includes('retiree') || value.includes('retired') || value.includes('senior')) {
    addScore('Medicare', 3);
  }

  if (value.includes('disabilit') || value.includes('disabled')) {
    addScore('Medicaid', 3);
    addScore('Medicare', 1);
  }

  if (value.includes('children') && (value.includes('uninsured') || value.includes('teen'))) {
    addScore('CHIP', 4);
  }

  if (value.includes('quality') && (value.includes('rating') || value.includes('accreditation') || value.includes('hedis'))) {
    addScore('NCQA', 3);
  }

  if (value.includes('small business') || value.includes('employer')) {
    addScore('Commercial', 3);
  }

  if (value.includes('open enrollment') || value.includes('qualifying life event')) {
    addScore('Marketplace', 4);
  }

  if (value.includes('eligible') && (value.includes('support') || value.includes('assistance') || value.includes('health care support'))) {
    addScore('Medicaid', 2);
  }

  if (value.includes('exchange') && (value.includes('individual') || value.includes('family'))) {
    addScore('Marketplace', 2);
  }

  if (value.includes('employer') || value.includes('group')) {
    addScore('Commercial', 2);
    // Employer and group language should de-emphasize Marketplace unless explicit Pennie/QLE wording exists.
    addScore('Marketplace', -1);
  }

  if (value.includes('rating') || value.includes('measure') || value.includes('quality metric')) {
    addScore('NCQA', 2);
  }

  const sorted = Array.from(scoreByLob.entries()).sort((a, b) => b[1] - a[1]);
  const [topLob, topScore] = sorted[0] || ['', 0];
  const [, secondScore] = sorted[1] || ['', 0];

  // Require a minimal signal and some separation to avoid unstable ties.
  if (topScore >= 3 && topScore >= secondScore + 1) {
    return topLob;
  }

  return '';
}

export function normalizeInteraction(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw === 'conversation' || raw === 'conversational' || raw === 'chat') return 'Conversation';
  if (raw === 'comparison' || raw === 'compare' || raw === 'comparative') return 'Comparison';
  return '';
}

export function inferInteractionFromText(text) {
  const value = String(text || '').toLowerCase();
  if (!value) return 'Conversation';

  const hasComparisonCue = COMPARISON_CUES.some((cue) => value.includes(cue));
  if (hasComparisonCue) {
    return 'Comparison';
  }

  return 'Conversation';
}

export function resolveInteractionIntent({ selectedInteraction, parsedInteraction, userPrompt }) {
  const selected = normalizeInteraction(selectedInteraction);
  if (selected) return selected;

  const inferred = inferInteractionFromText(userPrompt);
  // If prompt clearly asks for comparison, prefer deterministic cue over LLM parse.
  if (inferred === 'Comparison') {
    return 'Comparison';
  }

  const parsed = normalizeInteraction(parsedInteraction);
  return parsed || inferred || 'Conversation';
}

export function isQuestionAppropriateForCompliance(text) {
  const value = String(text || '').toLowerCase();
  if (!value) return false;

  const complianceSignals = [
    'medicare', 'medicaid', 'medical assistance', 'chip', 'marketplace', 'aca', 'commercial', 'ncqa',
    'coverage', 'eligibility', 'premium', 'cost', 'benefit', 'appeal', 'grievance',
    'policy', 'regulation', 'cms', 'health care', 'healthcare', 'insurance', 'plan',
    'retired', 'senior', 'elderly', 'pennie', 'healthchoices', 'hedis', 'accreditation'
  ];

  return complianceSignals.some((signal) => value.includes(signal));
}

export function stripSharePointGuidance(text) {
  const source = String(text || '');
  if (!source) return '';

  const lines = source
    .split('\n')
    .filter((line) => {
      const lower = line.toLowerCase();
      return !(lower.includes('sharepoint') || lower.includes('shared documents') || lower.includes('sp-cloud.kp.org'));
    });

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function buildLobReferenceMarkdown(lob) {
  const normalizedLob = normalizeSupportedLob(lob);
  if (!normalizedLob) return '';
  const url = LOB_REFERENCE_URLS[normalizedLob];
  return url
    ? `Reference: <a href="${url}" target="_blank" rel="noopener noreferrer">${normalizedLob}</a>`
    : '';
}

export function isUnsupportedLobMessage(text) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  return normalized === buildUnsupportedLobMessage().toLowerCase();
}

export function userRequestsReference(text) {
  const value = String(text || '').toLowerCase();
  if (!value) return false;

  const cues = [
    'source', 'sources', 'reference', 'references', 'cite', 'citation',
    'where did', 'how do we know', 'evidence', 'link'
  ];

  return cues.some((cue) => value.includes(cue));
}