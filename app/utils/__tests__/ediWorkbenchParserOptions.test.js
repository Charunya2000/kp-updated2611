import {
  buildEdiWorkbenchParserOptions,
  DEFAULT_SUBSCRIBER_BATCH_SIZE,
  isValidSubscriberBatchSizeInput,
  parseSubscriberBatchSizeInput,
} from '../ediWorkbenchParserOptions.js';

describe('EDI Workbench Subscribers per batch control', () => {
  test('defaults to 1', () => {
    expect(DEFAULT_SUBSCRIBER_BATCH_SIZE).toBe(1);
    expect(parseSubscriberBatchSizeInput(DEFAULT_SUBSCRIBER_BATCH_SIZE)).toBe(1);
  });

  test.each(['10', '25', '100'])('accepts positive integer input %s', (value) => {
    expect(isValidSubscriberBatchSizeInput(value)).toBe(true);
    expect(parseSubscriberBatchSizeInput(value)).toBe(Number(value));
  });

  test.each(['', 'ten', '2.5', '0', '-1'])('rejects invalid input %p', (value) => {
    expect(isValidSubscriberBatchSizeInput(value)).toBe(false);
    expect(() => parseSubscriberBatchSizeInput(value)).toThrow(
      /Subscribers per batch must be a positive integer/,
    );
  });

  test('builds a numeric page-to-worker value without changing existing options', () => {
    const result = buildEdiWorkbenchParserOptions({
      dbValidation: true,
      streaming: true,
      includeParsed: false,
      includeEnriched: false,
    }, '25');

    expect(result).toEqual({
      dbValidation: true,
      streaming: true,
      includeParsed: false,
      includeEnriched: false,
      subscriberBatchSize: 25,
    });
    expect(typeof result.subscriberBatchSize).toBe('number');
  });
});