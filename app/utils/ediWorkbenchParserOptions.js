export const DEFAULT_SUBSCRIBER_BATCH_SIZE = 1;
export const SUBSCRIBER_BATCH_SIZE_ERROR = 'Subscribers per batch must be a positive integer';

export function normalizeSubscriberBatchSize(value) {
  const subscriberBatchSize = value ?? DEFAULT_SUBSCRIBER_BATCH_SIZE;

  if (!Number.isInteger(subscriberBatchSize) || subscriberBatchSize < 1) {
    throw new Error(SUBSCRIBER_BATCH_SIZE_ERROR);
  }

  return subscriberBatchSize;
}

export function parseSubscriberBatchSizeInput(value) {
  if (typeof value === 'string' && value.trim() === '') {
    throw new Error(SUBSCRIBER_BATCH_SIZE_ERROR);
  }

  return normalizeSubscriberBatchSize(typeof value === 'number' ? value : Number(value));
}

export function isValidSubscriberBatchSizeInput(value) {
  try {
    parseSubscriberBatchSizeInput(value);
    return true;
  } catch {
    return false;
  }
}

export function buildEdiWorkbenchParserOptions(parserOptions, subscriberBatchSizeInput) {
  return {
    ...parserOptions,
    subscriberBatchSize: parseSubscriberBatchSizeInput(subscriberBatchSizeInput),
  };
}