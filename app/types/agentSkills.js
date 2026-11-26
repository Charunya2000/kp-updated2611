/**
 * Shared constants + JSDoc typedefs for the Agent Skills retrieval pipeline.
 */

export const AgentSkillBucket = Object.freeze({
  APPROACH: 'approach',
  IMPRESS: 'impress',
  FOLLOW_UP: 'followUp',
  FINETUNE: 'finetune'
});

export const AgentSkillBucketOrder = [
  AgentSkillBucket.APPROACH,
  AgentSkillBucket.IMPRESS,
  AgentSkillBucket.FOLLOW_UP,
  AgentSkillBucket.FINETUNE
];

/**
 * @typedef {Object} AgentSkillCitation
 * @property {string} sourceTitle
 * @property {string|null} url
 * @property {string} region
 * @property {string} documentOwner
 * @property {string|null} lastUpdated
 */

/**
 * @typedef {Object} AgentSkillInsight
 * @property {string} id
 * @property {string} skillBucket
 * @property {string} summary
 * @property {string|null} quote
 * @property {Array<string>} [keywords]
 * @property {string|null} region
 * @property {string|null} market
 * @property {string|null} documentOwner
 * @property {string|null} lastUpdated
 * @property {AgentSkillCitation} citation
 */

/**
 * @typedef {Object} AgentSkillRequest
 * @property {string|null} teamName
 * @property {string|null} assistantName
 * @property {string|null} smartNoteId
 * @property {string} userRole
 * @property {string|null} region
 * @property {string|null} industry
 * @property {number} limitPerBucket
 * @property {string} mode
 */

/**
 * Creates an empty response shell for callers that need deterministic structures.
 * @returns {{buckets: Array<{id: string, insights: AgentSkillInsight[]}>, diagnostics: object}}
 */
export function createEmptyAgentSkillResponse() {
  return {
    buckets: AgentSkillBucketOrder.map((bucket) => ({ id: bucket, insights: [] })),
    diagnostics: { totalDocuments: 0, dataSource: 'unknown' }
  };
}
