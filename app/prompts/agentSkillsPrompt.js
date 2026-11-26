import fs from 'node:fs';
import path from 'node:path';

const PROMPT_TEMPLATE_PATH = path.join(process.cwd(), 'infoSourceData', 'PROMP_TEMPLATE.md');
let cachedTemplate = null;

function loadTemplate() {
  if (!cachedTemplate) {
    cachedTemplate = fs.readFileSync(PROMPT_TEMPLATE_PATH, 'utf-8');
  }
  return cachedTemplate;
}

/**
 * Builds the agent skills prompt by hydrating the template placeholders.
 * Defaults follow the Seller persona so callers can omit optional params.
 */
export function buildAgentSkillsPrompt(variables = {}) {
  const template = loadTemplate();
  const hydrated = template
    .replaceAll('{{User_Role}}', variables.userRole || 'Seller')
    .replaceAll('{{User_State}}', variables.region || 'California')
    .replaceAll('{{Prospect_Industry}}', variables.industry || 'Healthcare');

  return hydrated.trim();
}

export function getAgentSkillsPromptTemplate() {
  return loadTemplate();
}
