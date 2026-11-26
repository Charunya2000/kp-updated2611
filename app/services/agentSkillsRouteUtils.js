const TERMINAL_STATUSES = new Set(['complete', 'error']);

export function normalizeStatus(status) {
  const normalized = (status || '').toString().trim().toLowerCase();

  if (['queued', 'pending'].includes(normalized)) {
    return 'queued';
  }

  if (['processing', 'running', 'in-progress', 'in_progress'].includes(normalized)) {
    return 'processing';
  }

  if (['complete', 'completed', 'ready', 'success', 'succeeded'].includes(normalized)) {
    return 'complete';
  }

  if (['error', 'failed', 'cancelled', 'timeout', 'timedout'].includes(normalized)) {
    return 'error';
  }

  return normalized || 'unknown';
}

export function isTerminalStatus(status) {
  return TERMINAL_STATUSES.has(normalizeStatus(status));
}

export async function withTimeout(promise, timeoutMs, message) {
  let timer = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
