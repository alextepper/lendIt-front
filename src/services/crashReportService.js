import http from '../lib/http';

/**
 * Send a crash report to the backend
 * @param {Object} payload - { error, occurredAt, route, description? }
 * @returns {Promise<Object>} - { id, message }
 */
export async function sendCrashReport(payload) {
  try {
    const { data } = await http.post('/crash-reports', payload);
    return data;
  } catch (error) {
    console.error('Failed to send crash report:', error);
    throw new Error(
      error?.response?.data?.message || 'Failed to send crash report'
    );
  }
}

/**
 * Format error object into a readable string
 * @param {Error|any} error - Error object or any value
 * @returns {string} - Formatted error string
 */
export function formatError(error) {
  if (error instanceof Error) {
    return `${error.message}\n\nStack Trace:\n${error.stack || 'No stack trace available'}`;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

/**
 * Get current route information
 * @returns {string} - Current route path with query
 */
export function getCurrentRoute() {
  return window.location.pathname + window.location.search + window.location.hash;
}

/**
 * Create crash report payload from error
 * @param {Error|any} error - Error object
 * @param {string} description - Optional user description
 * @returns {Object} - Crash report payload
 */
export function createCrashReportPayload(error, description = '') {
  return {
    error: formatError(error),
    occurredAt: new Date().toISOString(),
    route: getCurrentRoute(),
    ...(description && { description }),
  };
}
