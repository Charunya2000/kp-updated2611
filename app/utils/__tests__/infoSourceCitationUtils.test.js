import {
  KP_POLICY_INDEX_NAME,
  buildKpPolicyCitationKey,
  isAllowedInfoSourceIndex,
  isKpPolicySource,
  resolveKpPolicyMetadata,
} from '../infoSourceCitationUtils';

describe('InfoSource KP Policy citation utilities', () => {
  test('only allows the configured InfoSource retrieval indexes', () => {
    expect(isAllowedInfoSourceIndex('infosource_assets_2026-03-25')).toBe(true);
    expect(isAllowedInfoSourceIndex('infosource_pages2_2026-03-25')).toBe(true);
    expect(isAllowedInfoSourceIndex(KP_POLICY_INDEX_NAME)).toBe(true);
    expect(isAllowedInfoSourceIndex('unapproved-index')).toBe(false);
  });

  test('recognizes KP Policy citations from current and persisted shapes', () => {
    expect(isKpPolicySource({ citationType: 'kp-policy' })).toBe(true);
    expect(isKpPolicySource({ indexName: KP_POLICY_INDEX_NAME })).toBe(true);
    expect(isKpPolicySource({ trace: { indexName: KP_POLICY_INDEX_NAME } })).toBe(true);
    expect(isKpPolicySource({ indexName: 'infosource_pages2_2026-03-25' })).toBe(false);
  });

  test('maps policy metadata and never exposes keywords', () => {
    const metadata = resolveKpPolicyMetadata({
      policyTitle: 'Clinical Documentation Policy',
      leftNavSelection: 'National',
      documentOwner: 'Policy Operations',
      publicationDate: '2026-08-01T00:00:00Z',
      titleUrl: 'https://policy.kp.org/current',
      evergreenLink: 'https://policy.kp.org/evergreen',
      sectionPath: ['Requirements', 'Documentation'],
      categories: ['Clinical'],
    });

    expect(metadata).toEqual(expect.objectContaining({
      citationType: 'kp-policy',
      sourceTitle: 'Clinical Documentation Policy',
      region: 'National',
      documentOwner: 'Policy Operations',
      lastUpdated: '2026-08-01T00:00:00Z',
      sourceLabel: 'KP Policy Library',
      url: 'https://policy.kp.org/current',
      sectionTitle: 'Requirements > Documentation',
      keywords: [],
    }));
  });

  test('falls back to evergreenLink when titleUrl is absent', () => {
    const metadata = resolveKpPolicyMetadata({
      policyTitle: 'Fallback Policy',
      evergreenLink: 'https://policy.kp.org/evergreen',
    });

    expect(metadata.url).toBe('https://policy.kp.org/evergreen');
  });

  test('consolidates chunks in one section but preserves distinct policy topics', () => {
    const common = {
      uniqueId: 'policy-123',
      policyTitle: 'Clinical Documentation Policy',
    };

    const firstSectionChunk = buildKpPolicyCitationKey({
      ...common,
      chunkId: 'chunk-1',
      sectionPath: ['Requirements'],
    });
    const secondSectionChunk = buildKpPolicyCitationKey({
      ...common,
      chunkId: 'chunk-2',
      sectionPath: ['Requirements'],
    });
    const differentTopic = buildKpPolicyCitationKey({
      ...common,
      chunkId: 'chunk-3',
      sectionPath: ['Exceptions'],
    });

    expect(firstSectionChunk).toBe(secondSectionChunk);
    expect(differentTopic).not.toBe(firstSectionChunk);
  });
});
