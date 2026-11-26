const { isTerminalStatus, normalizeStatus, withTimeout } = require('../agentSkillsRouteUtils.cjs');

describe('agentSkillsRouteUtils', () => {
  test('normalizeStatus maps equivalent statuses', () => {
    expect(normalizeStatus('Queued')).toBe('queued');
    expect(normalizeStatus('in-progress')).toBe('processing');
    expect(normalizeStatus('Succeeded')).toBe('complete');
    expect(normalizeStatus('TimedOut')).toBe('error');
  });

  test('isTerminalStatus only true for complete/error families', () => {
    expect(isTerminalStatus('processing')).toBe(false);
    expect(isTerminalStatus('queued')).toBe(false);
    expect(isTerminalStatus('complete')).toBe(true);
    expect(isTerminalStatus('failed')).toBe(true);
  });

  test('withTimeout resolves successful promises', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 50, 'timeout')).resolves.toBe('ok');
  });

  test('withTimeout rejects when promise exceeds timeout', async () => {
    const never = new Promise(() => { });
    await expect(withTimeout(never, 5, 'timed out')).rejects.toThrow('timed out');
  });
});
