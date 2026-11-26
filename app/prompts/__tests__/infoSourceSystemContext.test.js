import { INFO_SOURCE_SYSTEM_CONTEXT } from '../infoSourceSystemContext';

describe('InfoSource system context', () => {
  test('defines InfoSource and KP Policy Library as complementary sources', () => {
    expect(INFO_SOURCE_SYSTEM_CONTEXT).toContain('InfoSource primarily supports Sales');
    expect(INFO_SOURCE_SYSTEM_CONTEXT).toContain('KP Policy Library contains formal national and regional policies');
    expect(INFO_SOURCE_SYSTEM_CONTEXT).toContain('without requiring users to choose an index');
  });

  test('preserves security and governance boundaries for technical questions', () => {
    expect(INFO_SOURCE_SYSTEM_CONTEXT).toContain('ordinary technical implementation and configuration questions');
    expect(INFO_SOURCE_SYSTEM_CONTEXT).toContain('Do not disclose or help obtain secrets');
    expect(INFO_SOURCE_SYSTEM_CONTEXT).toContain('Do not provide instructions to bypass authentication');
    expect(INFO_SOURCE_SYSTEM_CONTEXT).toContain('actions requiring authorization');
  });

  test('does not broadly redirect benign technical or business questions', () => {
    expect(INFO_SOURCE_SYSTEM_CONTEXT).toContain('Do not route a legitimate business');
    expect(INFO_SOURCE_SYSTEM_CONTEXT).not.toContain('Users might ask about');
    expect(INFO_SOURCE_SYSTEM_CONTEXT).not.toContain('Only answer questions that are within InfoSource scope');
  });

  test('requires grounded, region-aware citations', () => {
    expect(INFO_SOURCE_SYSTEM_CONTEXT).toContain('Never assume that a policy from one region applies nationally');
    expect(INFO_SOURCE_SYSTEM_CONTEXT).toContain('Use only citation numbers in the current Citation Catalog');
    expect(INFO_SOURCE_SYSTEM_CONTEXT).toContain('do not add unrelated citations');
  });
});