import http from "../lib/http";

/**
 * Create or get a conversation thread
 * @param {Object} payload - { peerUserId, itemId?, orderId? }
 * @returns {Promise<Object>} Thread object
 */
export async function createOrGetThread(payload) {
  const { data } = await http.post("/threads", payload);
  return data;
}

/**
 * Get all threads for the authenticated user
 * @param {Object} params - { page?, pageSize? }
 * @returns {Promise<Object>} { data, page, pageSize, total }
 */
export async function fetchThreads(params = {}) {
  const { data } = await http.get("/threads", { params });
  return data;
}

/**
 * Get full details and messages for a specific thread
 * @param {string} threadId - Thread ID
 * @returns {Promise<Object>} Thread with messages
 */
export async function fetchThread(threadId) {
  const { data } = await http.get(`/threads/${threadId}`);
  return data;
}

/**
 * Send a message in a thread
 * @param {string} threadId - Thread ID
 * @param {Object} payload - { type: 'TEXT'|'IMAGE', text?, imageUrl? }
 * @returns {Promise<Object>} Message object
 */
export async function sendMessage(threadId, payload) {
  const { data } = await http.post(`/threads/${threadId}/messages`, payload);
  return data;
}

/**
 * Mark all messages in a thread as read
 * @param {string} threadId - Thread ID
 * @returns {Promise<Object>} { success, markedCount }
 */
export async function markThreadAsRead(threadId) {
  const { data } = await http.patch(`/threads/${threadId}/read`);
  return data;
}

/**
 * Archive or unarchive a thread
 * @param {string} threadId - Thread ID
 * @param {boolean} archived - true to archive, false to unarchive
 * @returns {Promise<Object>} Updated thread object
 */
export async function archiveThread(threadId, archived) {
  const { data } = await http.patch(`/threads/${threadId}/archive`, {
    archived,
  });
  return data;
}
