// PTS Utility Functions

/**
 * Remove spaces from filename while preserving extension
 */
export const removeSpaces = (filename) => {
  if (!filename) return '';
  const parts = filename.split('.');
  const ext = parts.pop();
  const name = parts.join('.');
  const cleanName = name.replace(/\s+/g, '_');
  return ext ? `${cleanName}.${ext}` : cleanName;
};

/**
 * Validate session ID
 */
export const validateSessionId = (sessionId) => {
  if (!sessionId || sessionId.trim().length === 0) {
    return { valid: false, error: 'Session ID is required' };
  }

  if (sessionId.length < 3) {
    return { valid: false, error: 'Session ID must be at least 3 characters' };
  }

  if (sessionId.length > 50) {
    return { valid: false, error: 'Session ID must not exceed 50 characters' };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    return {
      valid: false,
      error: 'Session ID can only contain letters, numbers, underscores, and hyphens',
    };
  }

  return { valid: true };
};

/**
 * Format file size in human-readable format
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Format date to readable string
 */
export const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Create FormData from file
 */
export const createFormData = (file, additionalData = {}) => {
  const formData = new FormData();
  formData.append('file', file);

  Object.entries(additionalData).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => formData.append(`${key}[]`, v));
    } else {
      formData.append(key, value);
    }
  });

  return formData;
};

/**
 * Fetch with timeout
 */
export const fetchWithTimeout = (url, options = {}, timeout = 30000) => {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    ),
  ]);
};

/**
 * Retry fetch with exponential backoff
 */
export const fetchWithRetry = async (
  url,
  options = {},
  maxRetries = 3,
  delay = 1000
) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetchWithTimeout(url, options);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
};

/**
 * Download file from URL
 */
export const downloadFile = (url, filename) => {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

/**
 * Convert CSV string to array
 */
export const parseCSV = (csvString) => {
  const lines = csvString.trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.trim());
  const data = lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index];
    });
    return obj;
  });
  return { headers, data };
};

/**
 * Convert array to CSV string
 */
export const convertToCSV = (data) => {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csv = [
    headers.map((h) => `"${h}"`).join(','),
    ...data.map((row) =>
      headers.map((h) => `"${row[h] || ''}"`).join(',')
    ),
  ].join('\n');

  return csv;
};

/**
 * Download CSV from data array
 */
export const downloadCSV = (data, filename) => {
  const csv = convertToCSV(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename || 'download.csv';
  link.click();
};

/**
 * Format percentage
 */
export const formatPercentage = (value, decimals = 2) => {
  return `${(value || 0).toFixed(decimals)}%`;
};

/**
 * Format number with thousand separators
 */
export const formatNumber = (value) => {
  if (typeof value !== 'number') return value;
  return value.toLocaleString('en-US');
};

/**
 * Calculate SLA compliance
 */
export const calculateSLACompliance = (actual, slaLimit, isResponseTime = false) => {
  if (!actual || !slaLimit) return null;

  if (isResponseTime) {
    // For response time, lower is better
    return actual <= slaLimit ? 100 : (slaLimit / actual) * 100;
  } else {
    // For TPS/throughput, higher is better
    return actual >= slaLimit ? 100 : (actual / slaLimit) * 100;
  }
};

/**
 * Get compliance status color
 */
export const getComplianceColor = (compliance) => {
  if (compliance >= 95) return 'success'; // Green
  if (compliance >= 80) return 'warning'; // Yellow
  return 'error'; // Red
};

/**
 * Group array by key
 */
export const groupBy = (array, key) => {
  return array.reduce((result, item) => {
    const group = item[key];
    if (!result[group]) {
      result[group] = [];
    }
    result[group].push(item);
    return result;
  }, {});
};

/**
 * Sort array by multiple keys
 */
export const sortByKeys = (array, keys) => {
  return array.sort((a, b) => {
    for (const key of keys) {
      if (a[key] < b[key]) return -1;
      if (a[key] > b[key]) return 1;
    }
    return 0;
  });
};

/**
 * Calculate statistics
 */
export const calculateStats = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const mean = sum / sorted.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const min = Math.min(...sorted);
  const max = Math.max(...sorted);
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];

  return { mean, median, min, max, p95, p99, sum };
};

/**
 * Debounce function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};
